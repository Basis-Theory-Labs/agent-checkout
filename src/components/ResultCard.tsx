import type { Result } from '@/lib/run';

const TONE = {
  paid: { ring: 'ring-lime/30', badge: 'bg-lime-tint text-lime', label: 'Paid' },
  failed: { ring: 'ring-danger/30', badge: 'bg-danger-tint text-danger', label: 'Failed' },
} as const;

/** How the run ended. */
export function ResultCard({ result }: { result: Result }) {
  const tone = TONE[result.outcome];
  return (
    <section className={`animate-rise rounded-2xl bg-surface p-5 ring-1 ${tone.ring}`}>
      <span className={`inline-flex rounded-full px-2.5 py-1 text-[11.5px] font-medium ${tone.badge}`}>{tone.label}</span>
      <h3 className="mt-3 font-display text-[19px] leading-snug font-medium text-ink">{result.title}</h3>
      {result.detail && <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink-muted">{result.detail}</p>}

      {result.quote && (
        <blockquote className="mt-4 border-l-2 border-rule-strong pl-3 text-[13px] leading-relaxed text-ink-muted italic">
          <span className="not-italic text-ink-faint">The agent: </span>
          {result.quote}
        </blockquote>
      )}

      {result.facts && result.facts.length > 0 && (
        <dl className="mt-4 flex flex-col gap-2 border-t border-rule pt-4">
          {result.facts.map((fact) => (
            <div key={fact.label} className="flex items-baseline justify-between gap-4 text-[13px]">
              <dt className="text-ink-muted">{fact.label}</dt>
              <dd className="text-right font-mono text-[12px] text-ink">{fact.value}</dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}
