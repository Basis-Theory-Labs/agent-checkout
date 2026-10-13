'use client';

import { useState } from 'react';
import type { Snippet } from '@/lib/catalog';

/** A step's code, closed until asked for. */
export function CodeToggle({ snippets }: { snippets: Snippet[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="font-mono text-[11.5px] text-ink-faint transition-colors hover:text-lime"
      >
        {open ? '− code' : '</> code'}
      </button>
      {open && (
        <div className="animate-rise mt-3 flex flex-col gap-3">
          {snippets.map((snippet) => (
            <CodeBlock key={`${snippet.file}${snippet.caption}`} snippet={snippet} />
          ))}
        </div>
      )}
    </div>
  );
}

function CodeBlock({ snippet }: { snippet: Snippet }) {
  return (
    <section className="overflow-hidden rounded-2xl bg-[#0b0b0d] ring-1 ring-rule">
      <header className="flex items-baseline justify-between gap-4 border-b border-rule px-5 py-2.5">
        <span className="text-[12px] text-ink">{snippet.caption}</span>
        <span className="truncate font-mono text-[11px] text-ink-faint">{snippet.file}</span>
      </header>
      <pre className="overflow-x-auto px-5 py-4 font-mono text-[11.5px] leading-[1.7] text-ink-muted">
        <Highlighted code={snippet.code} />
      </pre>
    </section>
  );
}

// Comments, strings and keywords: enough to read the code, without a highlighter dependency.
const TOKEN =
  /(\/\/[^\n]*)|('(?:\\.|[^'\\\n])*'|"(?:\\.|[^"\\\n])*"|`(?:\\.|[^`\\])*`)|\b(const|let|await|async|return|if|else|function|new|throw|export|try|catch|finally)\b/g;

function Highlighted({ code }: { code: string }) {
  const parts: React.ReactNode[] = [];
  let last = 0;
  for (const match of code.matchAll(TOKEN)) {
    const index = match.index ?? 0;
    if (index > last) parts.push(code.slice(last, index));
    const [text, comment, string] = match;
    parts.push(
      <span key={index} className={comment ? 'text-ink-faint italic' : string ? 'text-lime/85' : 'text-ink'}>
        {text}
      </span>,
    );
    last = index + text.length;
  }
  parts.push(code.slice(last));
  return <>{parts}</>;
}
