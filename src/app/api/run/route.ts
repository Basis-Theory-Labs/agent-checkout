import type { NextRequest } from 'next/server';
import { handoff } from '@/flows/handoff';
import { intercept } from '@/flows/intercept';
import { encodeEvent, FLOWS, type Emit, type Flow } from '@/lib/run';

export const runtime = 'nodejs';

/**
 * Runs one flow and streams what happens, step by step.
 *
 * This route spends the private key, so it only answers this app's own page.
 * The console is meant to run on your machine; do not deploy it as is.
 */
export async function POST(request: NextRequest) {
  const origin = request.headers.get('origin');
  if (origin && new URL(origin).host !== request.headers.get('host')) {
    return Response.json({ detail: 'This route serves its own page only.' }, { status: 403 });
  }

  const input = (await request.json().catch(() => ({}))) as { flow?: Flow };
  const flow = FLOWS.find((candidate) => candidate === input.flow);
  if (!flow) return Response.json({ detail: `flow must be one of ${FLOWS.join(', ')}.` }, { status: 400 });

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const encoder = new TextEncoder();
      let open = true;
      const emit: Emit = (event) => {
        if (!open) return;
        try {
          controller.enqueue(encoder.encode(encodeEvent(event)));
        } catch {
          open = false;
        }
      };
      const signal = request.signal;

      try {
        if (flow === 'intercept') await intercept({ emit, signal });
        else await handoff({ reactor: flow, emit, signal });
      } catch (error) {
        emit({
          type: 'result',
          result: {
            outcome: 'failed',
            title: 'The run stopped',
            detail: describeError(error),
          },
        });
      } finally {
        emit({ type: 'done' });
        if (open) controller.close();
        open = false;
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}

/** `fetch failed` alone says nothing; the network error is on `cause`. */
function describeError(error: unknown): string {
  if (!(error instanceof Error)) return String(error);
  const cause = error.cause instanceof Error ? `: ${error.cause.message}` : '';
  return `${error.message}${cause}`;
}
