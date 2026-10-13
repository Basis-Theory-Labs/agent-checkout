import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { FlowPage } from '@/components/FlowPage';
import { FLOW_INFO, type Snippet } from '@/lib/catalog';
import { storeUrl } from '@/lib/config';
import { FLOWS, type Flow } from '@/lib/run';
import { readSnippet } from '@/lib/snippets';

export const dynamicParams = false;

export function generateStaticParams() {
  return FLOWS.map((flow) => ({ flow }));
}

export async function generateMetadata({ params }: { params: Promise<{ flow: string }> }): Promise<Metadata> {
  const { flow } = await params;
  const info = FLOW_INFO[flow as Flow];
  return { title: info ? `${info.name} · ${info.product} — Agent Checkout` : 'Agent Checkout' };
}

export default async function Page({ params }: { params: Promise<{ flow: string }> }) {
  const { flow } = await params;
  if (!FLOWS.includes(flow as Flow)) notFound();

  // Each step's code, read from the files that run it.
  const snippets: Record<string, Snippet[]> = {};
  for (const step of FLOW_INFO[flow as Flow].plan) {
    if (step.code) snippets[step.id] = step.code.map(readSnippet);
  }

  // The model the agent Reactor was configured with by `npm run setup`.
  return <FlowPage flow={flow as Flow} model={process.env.MODEL} storeUrl={storeUrl()} snippets={snippets} />;
}
