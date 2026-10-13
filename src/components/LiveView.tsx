import { BrowserbaseMark } from './Logos';

/**
 * The run's Browserbase session, through Browserbase's live view.
 *
 * Watch-only: pointer events are off so nobody in the room clicks into the
 * checkout mid-run. A live view sees everything the page shows, including a
 * card a Reactor typed into it: fine for a test card, and something to keep
 * closed in production.
 */
export function LiveView({ url, sessionId, closed }: { url?: string; sessionId?: string; closed: boolean }) {
  const live = Boolean(url) && !closed;
  return (
    <section className="overflow-hidden rounded-2xl bg-surface ring-1 ring-rule">
      <header className="flex items-center justify-between gap-3 border-b border-rule px-4 py-3">
        <div className="flex items-center gap-2.5">
          <BrowserbaseMark className="h-4 text-ink" />
          <span className="text-[13px] text-ink">Browserbase</span>
          <span className="text-[13px] text-ink-faint">live view</span>
        </div>
        <div className="flex items-center gap-2 font-mono text-[11px] text-ink-muted">
          {sessionId && <span>{sessionId.slice(0, 8)}</span>}
          <span className={`h-1.5 w-1.5 rounded-full ${live ? 'animate-pulse bg-lime' : 'bg-ink-faint'}`} aria-hidden />
          <span>{live ? 'live' : closed ? 'released' : 'idle'}</span>
        </div>
      </header>

      <div className="relative aspect-[16/10] w-full bg-black">
        {live ? (
          <iframe
            src={`${url}${url!.includes('?') ? '&' : '?'}navbar=false`}
            title="Browserbase session"
            sandbox="allow-same-origin allow-scripts"
            className="pointer-events-none h-full w-full border-0"
          />
        ) : (
          <div className="grid h-full place-items-center px-10 text-center text-[13px] leading-relaxed text-ink-faint">
            {closed ? 'Session released.' : 'Press Run to open a session.'}
          </div>
        )}
      </div>

      <footer className="px-4 py-2.5 text-[11.5px] text-ink-faint">Watch-only · recording and logs off</footer>
    </section>
  );
}
