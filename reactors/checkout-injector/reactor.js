/**
 * Browser Proxy · Inject
 * https://developers.basistheory.com/docs/guides/browser-proxy#inject-the-card-into-a-browser-session
 *
 * Attaches to a cloud browser session your automation already opened on the
 * merchant's checkout, checks the page and the order total against a mandate
 * your backend signed, then fills the card and submits in one step inside the
 * page. Fixed code: no model makes a decision here.
 *
 * `event.req.card` arrives as the card data, because the caller sent
 * `{{ token: <id> | json: "$.data" }}` and Basis Theory resolved it before
 * this code ran. Neither the caller nor anything it logs ever held the number.
 */
const crypto = require("crypto");

module.exports = async function (event) {
  const { req, configuration } = event;

  // Your backend signs the mandate when the customer approves the purchase.
  const mandate = verifyMandate(req.mandate, req.signature, configuration.MANDATE_SIGNING_KEY);
  if (!mandate) return reply(403, { status: "rejected", reason: "invalid_mandate" });

  // The checkout page and its fields come from configuration, never from the caller.
  const merchant = JSON.parse(configuration.MERCHANTS)[mandate.merchant];
  if (!merchant) return reply(400, { status: "rejected", reason: "unknown_merchant" });

  const { default: Browserbase } = await import("@browserbasehq/sdk");
  const { chromium } = await import("playwright-core");

  // #region attach
  const browserbase = new Browserbase({ apiKey: configuration.BROWSERBASE_API_KEY });
  const session = await browserbase.sessions.retrieve(mandate.session_id);
  const browser = await chromium.connectOverCDP(session.connectUrl);
  // #endregion

  try {
    const page = browser.contexts()[0].pages().find((candidate) => {
      const url = new URL(candidate.url());
      return url.origin === merchant.origin && url.pathname === merchant.checkout_path;
    });
    if (!page) return reply(409, { status: "rejected", reason: "checkout_not_open" });

    // Pin the checkout document and verify it before any card data is sent to the browser.
    // If the page navigates after this point, calls through the handle fail instead of
    // reaching the new document.
    const checkout = await page.evaluateHandle(() => document);
    if (!(await checkout.evaluate(isCheckout, merchant))) {
      return reply(409, { status: "rejected", reason: "checkout_not_open" });
    }

    const card = req.card;
    const filled = await checkout.evaluate(fillAndSubmit, {
      merchant,
      mandate,
      fields: {
        card_number: card.number,
        expiry: `${String(card.expiration_month).padStart(2, "0")}/${String(card.expiration_year).slice(-2)}`,
        security_code: card.cvc,
      },
    });
    if (filled.status !== "submitted") return reply(409, filled);

    // Wait for the merchant's response, then clear the card fields from the page.
    const outcome = await page
      .locator(merchant.selectors.result)
      .filter({ hasText: /\S/ })
      .textContent({ timeout: 15000 });
    await checkout.evaluate(clearFields, merchant).catch(() => {});

    return reply(200, { status: "submitted", total_minor_units: filled.total_minor_units, outcome });
  } catch (error) {
    // Fail closed. Do not retry automatically: the card may already have been submitted.
    return reply(409, { status: "aborted", reason: "checkout_changed" });
  } finally {
    await browser.close();
  }
};

function isCheckout(doc, merchant) {
  return doc.location.origin === merchant.origin && doc.location.pathname === merchant.checkout_path;
}

// #region fill
// Runs inside the checkout document as one synchronous task, so the page cannot navigate
// between the checks and the fill.
function fillAndSubmit(doc, { merchant, mandate, fields }) {
  if (doc.location.origin !== merchant.origin || doc.location.pathname !== merchant.checkout_path) {
    return { status: "rejected", reason: "checkout_not_open" };
  }

  const totalText = doc.querySelector(merchant.selectors.total)?.textContent || "";
  const match = /(\d+)\.(\d{2})/.exec(totalText.replace(/,/g, ""));
  if (!match) return { status: "rejected", reason: "total_not_found" };
  const total = Number(match[1]) * 100 + Number(match[2]);
  if (merchant.currency !== mandate.currency || total > mandate.max_amount_minor_units) {
    return { status: "rejected", reason: "mandate_mismatch", total_minor_units: total };
  }

  const inputs = Object.keys(fields).map((name) => doc.querySelector(merchant.selectors[name]));
  const submit = doc.querySelector(merchant.selectors.submit);
  if (inputs.some((input) => !input) || !submit) {
    return { status: "rejected", reason: "field_not_found" };
  }

  const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
  Object.values(fields).forEach((value, index) => {
    setValue.call(inputs[index], value);
    inputs[index].dispatchEvent(new Event("input", { bubbles: true }));
    inputs[index].dispatchEvent(new Event("change", { bubbles: true }));
  });
  submit.click();

  return { status: "submitted", total_minor_units: total };
}
// #endregion

function clearFields(doc, merchant) {
  const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
  for (const name of ["card_number", "expiry", "security_code"]) {
    const input = doc.querySelector(merchant.selectors[name]);
    if (input) setValue.call(input, "");
  }
}

// #region verify
function verifyMandate(mandate, signature, key) {
  if (typeof mandate !== "string" || typeof signature !== "string") return null;
  const expected = crypto.createHmac("sha256", key).update(mandate).digest();
  const presented = Buffer.from(signature, "hex");
  if (presented.length !== expected.length || !crypto.timingSafeEqual(presented, expected)) {
    return null;
  }

  const parsed = JSON.parse(mandate);
  if (!Number.isSafeInteger(parsed.max_amount_minor_units) || !(Date.parse(parsed.expires_at) > Date.now())) {
    return null;
  }
  return parsed;
}
// #endregion

function reply(statusCode, body) {
  return { res: { statusCode, body } };
}
