import 'server-only';
import { createHmac } from 'node:crypto';
import { APPROVAL } from './run';

/**
 * What the customer approved, signed with a key only this backend and the
 * Reactor hold. The Reactor checks the signature, the expiry, the merchant,
 * the items and the amount itself, so whoever invokes it cannot raise the
 * amount, change the merchant, or point it at another browser session.
 *
 * The mandate travels as the exact string that was signed.
 */
// #region sign
export function signMandate(sessionId: string, signingKey: string) {
  const mandate = JSON.stringify({
    session_id: sessionId,
    merchant: APPROVAL.merchant,
    items: APPROVAL.items,
    max_amount_minor_units: APPROVAL.maxAmountMinorUnits,
    currency: APPROVAL.currency,
    expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
  });
  const signature = createHmac('sha256', signingKey).update(mandate).digest('hex');
  return { mandate, signature };
}
// #endregion
