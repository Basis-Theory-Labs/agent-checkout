import type { PlannedStep, Snippet } from '@/lib/catalog';
import type { Exchange, Step } from '@/lib/run';
import { CodeToggle } from './CodeBlock';
import { ExchangeView } from './ExchangeView';
import { Prose } from './Prose';

/**
 * A flow's steps, readable before the run starts and filled in as it
 * runs. Everything a step produced — a request, a response, the mandate —
 * sits under that step, and what happened inside the Reactor sits under the
 * step that invoked it.
 */
export function Timeline({
  plan,
  steps,
  exchanges,
  snippets,
}: {
  plan: PlannedStep[];
  steps: Step[];
  exchanges: Exchange[];
  /** The code behind each step, by step id. */
  snippets: Record<string, Snippet[]>;
}) {
  const reported = new Map(steps.filter((step) => !step.scope).map((step) => [step.id, step]));
  const inside = steps.filter((step) => step.scope === 'reactor');

  return (
    <ol className="flex flex-col">
      {plan.map((planned, index) => {
        const step = reported.get(planned.id);
        const attached = exchanges.filter((exchange) => exchange.step === planned.id);
        return (
          <li key={planned.id} className="relative flex gap-4 pb-8 last:pb-0">
            {index < plan.length - 1 && (
              <span className="absolute top-7 bottom-2 left-[11px] w-px bg-rule-strong" aria-hidden />
            )}
            <StatusIcon status={step?.status ?? 'pending'} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <h3 className={`text-[15px] leading-snug ${step ? 'text-ink' : 'text-ink-muted'}`}>
                  <span className="mr-2 font-mono text-[11.5px] text-ink-faint">{String(index + 1).padStart(2, '0')}</span>
                  {step?.label ?? planned.label}
                </h3>
                {step?.detail && <span className="font-mono text-[11.5px] text-ink-muted">{step.detail}</span>}
              </div>
              <Prose text={planned.explain} className="mt-1 text-[13px] text-ink-muted" />
              {snippets[planned.id] && <CodeToggle snippets={snippets[planned.id]} />}

              {attached.map((exchange) => (
                <div key={exchange.id} className="mt-4">
                  <ExchangeView exchange={exchange} />
                </div>
              ))}

              {planned.id === 'reactor' && inside.length > 0 && <InsideReactor steps={inside} />}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function InsideReactor({ steps }: { steps: Step[] }) {
  return (
    <section className="animate-rise mt-4 rounded-2xl bg-surface p-5 ring-1 ring-lime/25">
      <h4 className="text-[12px] text-lime">
        Inside the Reactor <span className="text-ink-faint">· from its response</span>
      </h4>
      <ol className="mt-4 flex flex-col">
        {steps.map((step, index) => (
          <li key={step.id} className="relative flex gap-3.5 pb-3.5 last:pb-0">
            {index < steps.length - 1 && (
              <span className="absolute top-6 bottom-1 left-[9px] w-px bg-rule-strong" aria-hidden />
            )}
            <StatusIcon status={step.status} small />
            <div className="min-w-0 pt-px">
              <div className="text-[13.5px] leading-snug text-ink">{step.label}</div>
              {step.detail && <div className="mt-0.5 font-mono text-[11.5px] text-ink-muted">{step.detail}</div>}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

function StatusIcon({ status, small }: { status: Step['status']; small?: boolean }) {
  const size = small ? 'h-[19px] w-[19px]' : 'h-[23px] w-[23px]';
  if (status === 'pending') {
    return <span className={`mt-px shrink-0 rounded-full ring-1 ring-rule-strong ring-inset ${size}`} aria-label="Not started" />;
  }
  if (status === 'running') {
    return (
      <span className={`relative mt-px shrink-0 ${size}`} aria-label="Running">
        <span className="absolute inset-0 animate-spin rounded-full border-[1.5px] border-rule-strong border-t-lime" />
      </span>
    );
  }
  const failed = status === 'failed';
  return (
    <span
      className={`mt-px grid shrink-0 place-items-center rounded-full ${size} ${failed ? 'bg-danger-tint text-danger' : 'bg-lime-tint text-lime'}`}
      aria-label={failed ? 'Failed' : 'Done'}
    >
      <svg viewBox="0 0 12 12" className="h-2.5 w-2.5" aria-hidden>
        {failed ? (
          <path d="M3 3l6 6M9 3L3 9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        ) : (
          <path d="M2.5 6.2l2.3 2.3 4.7-5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        )}
      </svg>
    </span>
  );
}
