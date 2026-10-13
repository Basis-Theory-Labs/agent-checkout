import 'server-only';
import { BT_API, config } from '@/lib/config';
import { connect, openSession, release } from '@/lib/browserbase';
import type { Emit } from '@/lib/run';

/**
 * Browser Proxy · Intercept
 * https://developers.basistheory.com/docs/guides/browser-proxy#intercept-the-checkout-request
 *
 * The automation types a placeholder card and submits. The page's payment
 * request is captured before it leaves the browser, the card fields are
 * replaced with token expressions, and the request is sent to the merchant
 * through the Basis Theory Proxy, which swaps in the real card. The real card
 * never enters the browser, and this server only ever holds the token id.
 */

// A placeholder that passes the page's validation. It must never reach the merchant.
const PLACEHOLDER = { number: '4111111111111111', expiry: '12/30', cvc: '123' };

// #region swap
/** Where the card fields sit in this store's payment request. Write one per merchant. */
function withTokenExpressions(body: { card: Record<string, string> }, tokenId: string) {
  body.card.number = `{{ token: ${tokenId} | json: "$.data.number" }}`;
  body.card.exp_month = `{{ token: ${tokenId} | json: "$.data" | card_exp: "MM" }}`;
  body.card.exp_year = `{{ token: ${tokenId} | json: "$.data" | card_exp: "YY" }}`;
  body.card.cvc = `{{ token: ${tokenId} | json: "$.data.cvc" }}`;
  return body;
}
// #endregion

export async function intercept({ emit, signal }: { emit: Emit; signal: AbortSignal }) {
  const { storeUrl, cardTokenId, privateKey } = config();
  const paymentUrl = new URL('/api/pay', storeUrl).href;

  emit({ type: 'step', step: { id: 'browser', label: 'Opening a Browserbase session', status: 'running' } });
  const session = await openSession({ keepAlive: false });
  emit({ type: 'browser', liveViewUrl: session.liveViewUrl, sessionId: session.id });
  emit({
    type: 'step',
    step: { id: 'browser', label: 'Browserbase session open', status: 'done', detail: session.id.slice(0, 8) },
  });

  const { browser, page } = await connect(session);
  let forwarded = 0;

  try {
    await page.route('**/*', async (route) => {
      // #region matcher
      // Every request that carries the placeholder card must be the matched payment request,
      // sent once. Anything else is aborted, so the placeholder never reaches the merchant.
      const request = route.request();
      if (!(request.postData() ?? '').includes(PLACEHOLDER.number)) return route.fallback();

      const url = new URL(request.url());
      const matches = request.method() === 'POST' && url.origin + url.pathname === paymentUrl;
      if (!matches || forwarded > 0) return route.abort('blockedbyclient');
      forwarded += 1;
      // #endregion

      emit({
        type: 'step',
        step: { id: 'capture', label: 'Payment request caught', status: 'done', detail: `POST ${url.pathname}` },
      });
      emit({
        type: 'exchange',
        exchange: {
          id: 'page',
          step: 'capture',
          title: 'What the page tried to send',
          caption: 'Held in the browser. Fake card.',
          method: request.method(),
          url: request.url(),
          body: request.postDataJSON(),
        },
      });

      // #region request
      const body = withTokenExpressions(request.postDataJSON(), cardTokenId);
      const headers = await request.allHeaders();
      delete headers['content-length'];
      // #endregion
      const exchange = {
        id: 'proxy',
        step: 'proxy',
        title: 'Sent to Basis Theory instead',
        caption: 'Same request, card fields as token expressions.',
        method: 'POST',
        url: `${BT_API}/proxy`,
        headers: { ...headers, 'BT-API-KEY': '<BT_PRIVATE_API_KEY>', 'BT-PROXY-URL': request.url() },
        body,
      };
      emit({ type: 'exchange', exchange });
      emit({
        type: 'step',
        step: { id: 'proxy', label: 'Swapping in the real card', status: 'running' },
      });

      // #region proxy
      // Basis Theory replaces the expressions with the card data and calls the merchant.
      const response = await fetch(`${BT_API}/proxy`, {
        method: 'POST',
        headers: { ...headers, 'BT-API-KEY': privateKey, 'BT-PROXY-URL': request.url() },
        body: JSON.stringify(body),
        signal,
      }).catch(() => null);
      // #endregion
      if (!response) {
        // The page is still waiting on its request; answer it, or it hangs until the timeout.
        emit({ type: 'step', step: { id: 'proxy', label: 'The Proxy call failed', status: 'failed' } });
        return route.abort('failed');
      }
      const bytes = Buffer.from(await response.arrayBuffer());

      emit({ type: 'exchange', exchange: { ...exchange, response: { status: response.status, body: parse(bytes) } } });
      emit({
        type: 'step',
        step: {
          id: 'proxy',
          label: 'Real card delivered to the store',
          status: response.ok ? 'done' : 'failed',
          detail: `HTTP ${response.status}`,
        },
      });

      // #region fulfill
      // The page receives the store's answer as if its own request had gone through.
      await route.fulfill({
        status: response.status,
        contentType: response.headers.get('content-type') ?? undefined,
        body: bytes,
      });
      // #endregion
    });

    emit({ type: 'step', step: { id: 'checkout', label: 'Going to checkout', status: 'running' } });
    // #region goto
    await page.goto(new URL('/checkout', storeUrl).href);
    await page.locator('#order-total').filter({ hasText: /\S/ }).waitFor();
    // #endregion
    const total = await page.locator('#order-total').textContent();
    emit({ type: 'step', step: { id: 'checkout', label: 'At checkout', status: 'done', detail: total ?? undefined } });

    emit({ type: 'step', step: { id: 'type', label: 'Typing a fake card', status: 'running' } });
    // #region type
    // Your automation drives the checkout as usual, with the placeholder card.
    await page.locator('#card-number').pressSequentially(PLACEHOLDER.number, { delay: 30 });
    await page.locator('#card-expiry').pressSequentially(PLACEHOLDER.expiry, { delay: 30 });
    await page.locator('#card-cvc').pressSequentially(PLACEHOLDER.cvc, { delay: 30 });
    // #endregion
    emit({
      type: 'step',
      step: { id: 'type', label: 'Fake card typed', status: 'done', detail: '•••• 1111' },
    });

    // #region submit
    await page.click('#place-order');
    // #endregion
    const outcome = await page
      .locator('#result')
      .filter({ hasText: /\S/ })
      .textContent({ timeout: 15000 })
      .catch(() => null);

    if (forwarded !== 1) throw new Error('The payment request was not forwarded through Basis Theory.');

    const charged = /ending (\d{4})/.exec(outcome ?? '')?.[1];
    emit({
      type: 'result',
      result: charged
        ? {
            outcome: 'paid',
            title: 'Paid with the real card',
            detail: outcome ?? undefined,
            facts: [
              { label: 'Typed in the browser', value: '•••• 1111' },
              { label: 'Charged by the store', value: `•••• ${charged}` },
            ],
          }
        : { outcome: 'failed', title: 'The store did not confirm the order', detail: outcome ?? undefined },
    });
  } finally {
    // Hold the last frame first: closing the connection ends a session without keepAlive.
    await linger(signal);
    await browser.close().catch(() => undefined);
    await release(session.id);
    emit({ type: 'browser-closed' });
  }
}

function parse(bytes: Buffer): unknown {
  try {
    return JSON.parse(bytes.toString('utf8'));
  } catch {
    return bytes.toString('utf8');
  }
}

/** Leaves the last frame on screen for a few seconds before the session goes. */
export function linger(signal: AbortSignal, ms = 6000): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener('abort', () => {
      clearTimeout(timer);
      resolve();
    });
  });
}
