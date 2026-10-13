'use client';

import Link from 'next/link';
import { FLOW_INFO, type Snippet } from '@/lib/catalog';
import type { Flow } from '@/lib/run';
import { useRun } from '@/lib/useRun';
import { ApprovalCard } from './ApprovalCard';
import { Header } from './Header';
import { LiveView } from './LiveView';
import { Prose } from './Prose';
import { ResultCard } from './ResultCard';
import { Timeline } from './Timeline';

export function FlowPage({
  flow,
  model,
  storeUrl,
  snippets,
}: {
  flow: Flow;
  model?: string;
  storeUrl: string;
  snippets: Record<string, Snippet[]>;
}) {
  const info = FLOW_INFO[flow];
  // Which model the agent runs on belongs with the step that hands off to it.
  const plan = info.plan.map((step) =>
    step.id === 'reactor' && info.model && model ? { ...step, explain: `${step.explain} Model: \`${model}\`.` } : step,
  );
  const { state, start } = useRun();
  const running = state.status === 'running';

  return (
    <div className="mx-auto max-w-[1240px] px-6 pb-24 sm:px-10">
      <Header storeUrl={storeUrl} docs={info.docs} />

      <Link href="/" className="text-[13px] text-ink-muted transition-colors hover:text-ink">
        ← All flows
      </Link>

      <section className="mt-8 max-w-[780px]">
        <div className="text-[12.5px] text-lime">{info.product}</div>
        <h1 className="mt-2 font-display text-[38px] leading-tight font-medium tracking-[-0.01em] text-ink">{info.name}</h1>
        <p className="mt-3 text-[16px] leading-relaxed text-ink-muted">{info.intro}</p>
      </section>

      <section className="mt-10 grid gap-4 lg:grid-cols-2">
        <div className="flex flex-col rounded-2xl bg-surface p-5 ring-1 ring-rule">
          <h2 className="text-[12px] tracking-[0.08em] text-ink-faint uppercase">The checkout</h2>
          <p className="mt-3 text-[13.5px] text-ink">
            Wireless headphones, $42.00.{' '}
            <a
              href={`${storeUrl}/checkout`}
              target="_blank"
              rel="noreferrer"
              className="text-ink-muted underline decoration-rule-strong underline-offset-2 hover:text-ink"
            >
              Open it
            </a>
          </p>

          <p className="mt-4 flex gap-2 text-[13px] text-ink-muted">
            <ShieldIcon />
            {info.guard}
          </p>

          <div className="mt-auto flex items-center justify-between gap-4 pt-6">
            <span className="font-mono text-[11px] text-ink-faint">Paying with test Visa •••• 4242</span>
            <button
              type="button"
              onClick={() => start(flow)}
              disabled={running}
              className="rounded-full bg-lime px-6 py-2.5 text-[14px] font-medium text-black transition-opacity disabled:opacity-40"
            >
              {running ? 'Running…' : state.status === 'finished' ? 'Run again' : 'Run'}
            </button>
          </div>
        </div>

        {flow === 'intercept' ? <MatcherCard /> : <ApprovalCard />}
      </section>

      <section className="mt-14 grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,480px)]">
        <div className="min-w-0">
          <Timeline plan={plan} steps={state.steps} exchanges={state.exchanges} snippets={snippets} />
          {state.result && (
            <div className="mt-10">
              <ResultCard result={state.result} />
            </div>
          )}
        </div>
        <div className="self-start lg:sticky lg:top-6">
          <LiveView url={state.liveViewUrl} sessionId={state.sessionId} closed={state.browserClosed} />
          <Prose text={`Code: \`${info.source}\``} className="mt-3 px-1 text-[12px] text-ink-faint" />
        </div>
      </section>
    </div>
  );
}

/** Intercept has no mandate: the matcher decides which request gets the card. */
function MatcherCard() {
  const rows: Array<[string, string]> = [
    ['Request', 'POST /api/pay, once'],
    ['Fake card', '4111 1111 1111 1111'],
    ['Swapped', 'number, exp_month, exp_year, cvc'],
    ['Every other request', 'untouched, never proxied'],
  ];
  return (
    <section className="rounded-2xl bg-surface p-5 ring-1 ring-rule">
      <h2 className="text-[12px] tracking-[0.08em] text-ink-faint uppercase">Which request gets the card</h2>
      <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-6 gap-y-1.5 text-[13px]">
        {rows.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-ink-muted">{label}</dt>
            <dd className="font-mono text-[12px] text-ink">{value}</dd>
          </div>
        ))}
      </dl>
      <Prose className="mt-4 text-[12px] text-ink-faint" text="One matcher per merchant: `withTokenExpressions` in `src/flows/intercept.ts`." />
    </section>
  );
}

function ShieldIcon() {
  return (
    <svg viewBox="0 0 16 16" className="mt-[3px] h-3.5 w-3.5 shrink-0 text-lime" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <path d="M8 1.5l5.5 2v4c0 3.3-2.3 5.9-5.5 7-3.2-1.1-5.5-3.7-5.5-7v-4L8 1.5z" strokeLinejoin="round" />
    </svg>
  );
}
