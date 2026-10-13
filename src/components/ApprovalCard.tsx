import { APPROVAL, formatMinor } from '@/lib/run';
import { Prose } from './Prose';

/**
 * What the customer approved, and where that approval lives. In this demo it
 * is a constant; in production your backend records it when the customer
 * confirms a purchase, and signs it.
 */
export function ApprovalCard() {
  return (
    <section className="rounded-2xl bg-surface p-5 ring-1 ring-rule">
      <h2 className="text-[12px] tracking-[0.08em] text-ink-faint uppercase">What the customer approved</h2>
      <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-6 gap-y-1.5 text-[13.5px]">
        <dt className="text-ink-muted">Items</dt>
        <dd className="text-ink">{APPROVAL.items.join(', ')}</dd>
        <dt className="text-ink-muted">Up to</dt>
        <dd className="text-ink">
          {formatMinor(APPROVAL.maxAmountMinorUnits)} <span className="text-ink-faint">{APPROVAL.currency}</span>
        </dd>
        <dt className="text-ink-muted">Merchant</dt>
        <dd className="text-ink">Halden</dd>
        <dt className="text-ink-muted">Valid</dt>
        <dd className="text-ink">5 minutes</dd>
      </dl>
      <Prose
        className="mt-4 text-[12px] text-ink-faint"
        text="Your backend signs it (`src/lib/mandate.ts`). Basis Theory never stores it."
      />
    </section>
  );
}
