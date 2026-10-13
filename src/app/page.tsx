import Link from 'next/link';
import { Header } from '@/components/Header';
import { BasisTheoryWordmark, BrowserbaseMark } from '@/components/Logos';
import { FLOW_INFO } from '@/lib/catalog';
import { storeUrl } from '@/lib/config';
import type { Flow } from '@/lib/run';

const PRODUCTS: Array<{ name: string; description: string; docs: string; flows: Flow[] }> = [
  {
    name: 'Browser Proxy',
    description: 'Scripted automation. No model.',
    docs: 'https://developers.basistheory.com/docs/guides/browser-proxy',
    flows: ['intercept', 'inject'],
  },
  {
    name: 'PCI Agent Runtimes',
    description: 'An AI agent inside a Basis Theory Reactor.',
    docs: 'https://developers.basistheory.com/docs/guides/pci-agent-runtimes/overview',
    flows: ['agent'],
  },
];

export default function Home() {
  return (
    <div className="mx-auto max-w-[1240px] px-6 pb-24 sm:px-10">
      <Header storeUrl={storeUrl()} />

      <section className="max-w-[760px] pt-12 pb-12">
        <h1 className="font-display text-[34px] leading-[1.15] font-medium tracking-[-0.01em] text-ink">
          Browsers and AI agents pay with a card they never hold.
        </h1>
        <p className="mt-4 text-[16px] text-ink-muted">Live runs against a demo store, each one paid with a card token. Pick one and press Run.</p>
        <div className="mt-6 flex items-center gap-5 text-[12.5px] text-ink-faint">
          <span>Built on</span>
          <BasisTheoryWordmark className="h-[20px] text-ink" />
          <span className="flex items-center gap-2 text-ink">
            <BrowserbaseMark className="h-4" />
            Browserbase
          </span>
        </div>
      </section>

      <div className="flex flex-col gap-12">
        {PRODUCTS.map((product) => (
          <section key={product.name}>
            <div className="mb-4 flex items-baseline justify-between gap-4">
              <div>
                <h2 className="font-display text-[20px] font-medium text-ink">{product.name}</h2>
                <p className="mt-1 text-[13.5px] text-ink-muted">{product.description}</p>
              </div>
              <a
                href={product.docs}
                target="_blank"
                rel="noreferrer"
                className="shrink-0 text-[13px] text-ink-muted transition-colors hover:text-ink"
              >
                Guide ↗
              </a>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {product.flows.map((flow) => {
                const info = FLOW_INFO[flow];
                return (
                  <Link
                    key={flow}
                    href={`/${flow}`}
                    className="group flex flex-col rounded-2xl bg-surface p-6 ring-1 ring-rule transition-colors hover:bg-lime-tint hover:ring-lime/40"
                  >
                    <span className="flex items-center justify-between">
                      <span className="font-display text-[20px] font-medium text-ink">{info.name}</span>
                      <span className="text-[13px] text-ink-muted transition-colors group-hover:text-lime">Open →</span>
                    </span>
                    <span className="mt-2 text-[13.5px] leading-relaxed text-ink-muted">{info.summary}</span>
                    <span className="mt-auto pt-5">
                      <span className="block border-t border-rule pt-4 text-[12.5px] leading-relaxed text-ink-faint">
                        <span className="text-ink-muted">Use it when</span> {info.when}
                      </span>
                      <span className="mt-3 block font-mono text-[11px] text-ink-faint">Card: {info.path}</span>
                    </span>
                  </Link>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
