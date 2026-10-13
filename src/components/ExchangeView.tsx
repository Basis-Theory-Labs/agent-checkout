import type { Exchange } from '@/lib/run';

/**
 * One request as it went over the wire, and what came back. Token expressions
 * are highlighted: they are what travels in place of the card.
 */
export function ExchangeView({ exchange }: { exchange: Exchange }) {
  const headers = Object.entries(exchange.headers ?? {});
  // The Basis Theory headers are the point; the browser's own are forwarded as they were.
  const shown = headers.filter(([name]) => /^bt-|^content-type$/i.test(name));
  const forwarded = headers.length - shown.length;

  return (
    <section className="animate-rise overflow-hidden rounded-2xl bg-surface ring-1 ring-rule">
      <header className="border-b border-rule px-5 py-4">
        <h3 className="font-display text-[14px] font-medium text-ink">{exchange.title}</h3>
        <p className="mt-1 text-[12.5px] leading-snug text-ink-muted">{exchange.caption}</p>
      </header>

      <div className="px-5 py-4">
        {exchange.method && exchange.url && (
          <div className="flex min-w-0 items-baseline gap-2 font-mono text-[12px]">
            <span className="shrink-0 text-lime">{exchange.method}</span>
            <span className="truncate text-ink" title={exchange.url}>
              {exchange.url}
            </span>
          </div>
        )}
        {shown.length > 0 && (
          <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 font-mono text-[11.5px]">
            {shown.map(([name, value]) => (
              <div key={name} className="contents">
                <dt className="text-ink-faint">{name}</dt>
                <dd className="truncate text-ink-muted" title={value}>
                  {value}
                </dd>
              </div>
            ))}
          </dl>
        )}
        {forwarded > 0 && (
          <p className="mt-1 font-mono text-[11.5px] text-ink-faint">+ {forwarded} headers forwarded from the browser</p>
        )}
        <Json value={exchange.body} className={exchange.method || shown.length > 0 ? 'mt-3' : undefined} />
      </div>

      {exchange.response && (
        <div className="border-t border-rule px-5 py-4">
          <div className="font-mono text-[12px] text-ink-muted">
            Response{' '}
            <span className={exchange.response.status < 400 ? 'text-lime' : 'text-warn'}>{exchange.response.status}</span>
          </div>
          <Json value={exchange.response.body} className="mt-2" />
        </div>
      )}
    </section>
  );
}

const EXPRESSION = /(\{\{[^}]*\}\})/g;

/**
 * JSON, laid out for reading rather than parsing: strings are printed as they
 * are, so an expression reads `json: "$.data"` instead of `json: \"$.data\"`.
 */
function Json({ value, className }: { value: unknown; className?: string }) {
  return (
    <pre
      className={`font-mono text-[11.5px] leading-[1.65] whitespace-pre-wrap text-ink-muted [overflow-wrap:anywhere] ${className ?? ''}`}
    >
      {layout(value).split(EXPRESSION).map((part, index) =>
        index % 2 === 1 ? (
          <mark key={index} className="rounded-[3px] bg-lime-tint px-0.5 text-lime">
            {part}
          </mark>
        ) : (
          part
        ),
      )}
    </pre>
  );
}

function layout(value: unknown, depth = 0): string {
  const pad = '  '.repeat(depth + 1);
  const close = '  '.repeat(depth);
  if (typeof value === 'string') return `"${value}"`;
  if (Array.isArray(value)) {
    if (value.length === 0) return '[]';
    return `[\n${value.map((item) => pad + layout(item, depth + 1)).join(',\n')}\n${close}]`;
  }
  if (value && typeof value === 'object') {
    const entries = Object.entries(value);
    if (entries.length === 0) return '{}';
    return `{\n${entries.map(([key, item]) => `${pad}"${key}": ${layout(item, depth + 1)}`).join(',\n')}\n${close}}`;
  }
  return String(value);
}
