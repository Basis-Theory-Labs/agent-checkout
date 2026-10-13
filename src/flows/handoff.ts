import 'server-only';
import { BT_API, config, reactorConfig } from '@/lib/config';
import { connect, openSession, release } from '@/lib/browserbase';
import { signMandate } from '@/lib/mandate';
import { APPROVAL, formatMinor, type Emit, type Result, type Step } from '@/lib/run';
import { linger } from './intercept';

/**
 * Hand an open checkout to a Reactor.
 *
 *   Browser Proxy · Inject — fixed code fills the card.
 *   https://developers.basistheory.com/docs/guides/browser-proxy#inject-the-card-into-a-browser-session
 *
 *   PCI Agent Runtimes · Agents and Browsers — an agent decides, narrow tools act.
 *   https://developers.basistheory.com/docs/guides/pci-agent-runtimes/agents-and-browsers
 *
 * This server's part is the same for both: open a session that outlives its
 * own connection, drive it to the payment step, let go of it, sign what the
 * customer approved, and invoke the Reactor with a token expression for the
 * card. The card is resolved inside the Reactor; this server never holds it.
 */
export async function handoff({
  reactor,
  emit,
  signal,
}: {
  reactor: 'inject' | 'agent';
  emit: Emit;
  signal: AbortSignal;
}) {
  const { storeUrl, cardTokenId, privateKey } = config();
  const { mandateSigningKey, injectReactorId, agentReactorId } = reactorConfig();
  const reactorId = reactor === 'agent' ? agentReactorId : injectReactorId;

  // 1. A session that keeps running when this server disconnects, with recording and
  //    logging off so neither captures the card data the Reactor enters.
  emit({ type: 'step', step: { id: 'browser', label: 'Opening a Browserbase session', status: 'running' } });
  const session = await openSession({ keepAlive: true });
  emit({ type: 'browser', liveViewUrl: session.liveViewUrl, sessionId: session.id });
  emit({
    type: 'step',
    step: { id: 'browser', label: 'Browserbase session open', status: 'done', detail: `${short(session.id)} · keep-alive` },
  });

  try {
    // 2. Drive the browser to the merchant's payment step, then stop touching it.
    emit({ type: 'step', step: { id: 'checkout', label: 'Going to checkout', status: 'running' } });
    // #region let-go
    const { browser, page } = await connect(session);
    await page.goto(new URL('/checkout', storeUrl).href);
    await page.locator('#order-total').filter({ hasText: /\S/ }).waitFor();
    const total = await page.locator('#order-total').textContent();
    // Disconnect, but keep the session: `keepAlive` holds it open for the Reactor.
    await browser.close();
    // #endregion
    emit({
      type: 'step',
      step: { id: 'checkout', label: 'At checkout, then let go', status: 'done', detail: total ?? undefined },
    });

    // 3. Sign what the customer approved.
    const { mandate, signature } = signMandate(session.id, mandateSigningKey);
    emit({
      type: 'exchange',
      exchange: {
        id: 'mandate',
        step: 'mandate',
        title: 'Signed mandate',
        caption: 'HMAC-SHA256. Only this server and the Reactor hold the key.',
        body: { mandate: JSON.parse(mandate) as unknown, signature },
      },
    });
    emit({
      type: 'step',
      step: { id: 'mandate', label: 'Approval signed', status: 'done', detail: `up to ${formatMinor(APPROVAL.maxAmountMinorUnits)}` },
    });

    // 4. Hand the session to the Reactor with a token expression for the card.
    // #region invoke
    const url = `${BT_API}/reactors/${reactorId}/react`;
    const body = { mandate, signature, card: `{{ token: ${cardTokenId} | json: "$.data" }}` };
    // #endregion
    const exchange = {
      id: 'reactor',
      step: 'reactor',
      title: 'Sent to Basis Theory',
      caption: 'The card is a token expression. No card data leaves this server.',
      method: 'POST',
      url,
      headers: { 'BT-API-KEY': '<BT_PRIVATE_API_KEY>', 'Content-Type': 'application/json' },
      body: { ...body, mandate: '<signed mandate, step 03>' },
    };
    emit({ type: 'exchange', exchange });
    emit({
      type: 'step',
      step: {
        id: 'reactor',
        label: reactor === 'agent' ? 'Handing off to the agent' : 'Handing off to the Reactor',
        status: 'running',
      },
    });

    const started = Date.now();
    // #region invoke-call
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'BT-API-KEY': privateKey, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    });
    // #endregion
    const answer = (await response.json().catch(() => ({}))) as Answer;
    const seconds = ((Date.now() - started) / 1000).toFixed(1);

    emit({ type: 'exchange', exchange: { ...exchange, response: { status: response.status, body: answer } } });
    emit({
      type: 'step',
      step: {
        id: 'reactor',
        label: reactor === 'agent' ? 'Agent returned' : 'Reactor returned',
        status: answer.status === 'submitted' ? 'done' : 'failed',
        detail: `HTTP ${response.status} · ${seconds} s`,
      },
    });
    for (const step of insideReactor(reactor, answer, session.id)) emit({ type: 'step', step });
    emit({ type: 'result', result: describe(answer, response.status, total) });
  } finally {
    await linger(signal);
    await release(session.id);
    emit({ type: 'browser-closed' });
  }
}

/**
 * What happened inside the Reactor, told from what its response proves. The
 * Reactor runs the guide's code and reports a status, a total and, for the
 * agent, the tools the model called. Anything but `submitted` is shown as the
 * one step where the code stopped.
 */
function insideReactor(reactor: 'inject' | 'agent', answer: Answer, sessionId: string): Step[] {
  // No status: Basis Theory refused the call (a bad expression, a missing permission)
  // and the code never ran.
  if (!answer.status) return [];

  const step = (id: string, label: string, detail?: string, status: Step['status'] = 'done'): Step => ({
    id: `inside-${id}`,
    label,
    detail,
    status,
    scope: 'reactor',
  });

  if (answer.status !== 'submitted') {
    return [step('stop', 'Stopped before paying', answer.reason ?? answer.status, 'failed')];
  }

  const steps = [
    step('card', 'Token expression → card', 'event.req.card'),
    step('mandate', 'Mandate verified', 'signature, expiry, merchant'),
    step('attach', 'Attached to the Browserbase session', short(sessionId)),
  ];
  if (reactor === 'inject') {
    const total = answer.total_minor_units === undefined ? 'Total' : formatMinor(answer.total_minor_units);
    return [
      ...steps,
      step('check', `${total} is within the ${formatMinor(APPROVAL.maxAmountMinorUnits)} approved`),
      step('fill', 'Card typed, order placed'),
      step('clear', 'Card fields cleared'),
    ];
  }
  const called = new Set(answer.tools_called);
  if (called.has('read_checkout')) steps.push(step('read', 'Model → read_checkout', 'items and total, no card'));
  if (called.has('fill_payment_fields')) steps.push(step('fill', 'Model → fill_payment_fields', 'checked in code, card typed'));
  if (called.has('submit_order')) steps.push(step('submit', 'Model → submit_order', 'order placed, fields cleared'));
  return steps;
}

function short(id: string): string {
  return id.slice(0, 8);
}

/** The Reactor's body, or Basis Theory's problem details when the call itself failed. */
interface Answer {
  status?: 'submitted' | 'rejected' | 'not_submitted' | 'aborted';
  reason?: string;
  outcome?: string;
  total_minor_units?: number;
  agent_summary?: string;
  tools_called?: string[];
  title?: string;
  detail?: string;
}

/**
 * Status comes from what the Reactor's code observed, never from the model's
 * words: an agent's summary is shown, but it does not decide the outcome.
 */
function describe(answer: Answer, httpStatus: number, total: string | null): Result {
  const facts: Array<{ label: string; value: string }> = [];
  if (total) facts.push({ label: 'Checkout total', value: total });
  facts.push({ label: 'Approved', value: `up to ${formatMinor(APPROVAL.maxAmountMinorUnits)}` });
  if (answer.tools_called) facts.push({ label: 'Tools called', value: answer.tools_called.join(' → ') || 'none' });

  // `submitted` means the Reactor pressed the button. Whether it paid is the store's answer.
  if (answer.status === 'submitted' && /confirmed/i.test(answer.outcome ?? '')) {
    return { outcome: 'paid', title: 'Order placed', detail: answer.outcome, quote: answer.agent_summary, facts };
  }
  if (answer.status) {
    return {
      outcome: 'failed',
      title: answer.status === 'submitted' ? 'The store declined' : 'No order placed',
      detail: answer.outcome ?? answer.reason,
      quote: answer.agent_summary,
      facts,
    };
  }
  return { outcome: 'failed', title: answer.title ?? `Basis Theory returned ${httpStatus}`, detail: answer.detail };
}
