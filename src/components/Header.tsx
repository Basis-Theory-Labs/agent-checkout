import Link from 'next/link';
import { BasisTheoryWordmark } from './Logos';

export function Header({
  storeUrl,
  docs = 'https://developers.basistheory.com/docs/features/agentic',
}: {
  storeUrl: string;
  docs?: string;
}) {
  return (
    <header className="flex items-center justify-between gap-4 py-7 whitespace-nowrap">
      <Link href="/" className="flex items-center gap-3 sm:gap-4">
        <BasisTheoryWordmark className="h-[22px] text-ink sm:h-[26px]" />
        <span className="h-5 w-px bg-rule-strong" aria-hidden />
        <span className="font-display text-[14px] text-ink-muted sm:text-[15px]">Agent Checkout</span>
      </Link>
      <nav className="flex items-center gap-4 text-[13px] text-ink-muted sm:gap-5">
        <a href={`${storeUrl}/checkout`} target="_blank" rel="noreferrer" className="transition-colors hover:text-ink">
          Store ↗
        </a>
        <a href={docs} target="_blank" rel="noreferrer" className="transition-colors hover:text-ink">
          Docs ↗
        </a>
      </nav>
    </header>
  );
}
