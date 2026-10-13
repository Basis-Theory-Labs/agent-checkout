/**
 * What a run is, and what it reports while it runs.
 *
 * The console posts a flow to /api/run and reads back a stream
 * of these events, one JSON object per server-sent event. This file is
 * imported by both sides, so it holds types and pure functions only.
 */

export type Flow = 'intercept' | 'inject' | 'agent';

export const FLOWS: Flow[] = ['intercept', 'inject', 'agent'];

/** What the customer approved, in every run that carries a mandate. */
export const APPROVAL = {
  merchant: 'halden',
  items: ['Wireless headphones'],
  maxAmountMinorUnits: 5000,
  currency: 'USD',
} as const;

export interface Step {
  id: string;
  label: string;
  /** `pending` is the console's own: a planned step the run has not reached. */
  status: 'pending' | 'running' | 'done' | 'failed';
  detail?: string;
  /** Happened inside the Reactor, on Basis Theory, rather than on this server. */
  scope?: 'reactor';
}

/**
 * Something a step produced, shown under it: a request as it went over the
 * wire with any key replaced by its name, or a document such as the mandate.
 */
export interface Exchange {
  id: string;
  /** The step it belongs to. */
  step: string;
  title: string;
  caption: string;
  /** Absent on a document, which is not sent anywhere by itself. */
  method?: string;
  url?: string;
  headers?: Record<string, string>;
  body: unknown;
  response?: { status: number; body: unknown };
}

export interface Result {
  outcome: 'paid' | 'failed';
  title: string;
  detail?: string;
  /** The agent's own words. Shown, never used to decide the outcome. */
  quote?: string;
  facts?: Array<{ label: string; value: string }>;
}

export type RunEvent =
  | { type: 'step'; step: Step }
  | { type: 'browser'; liveViewUrl: string; sessionId: string }
  | { type: 'browser-closed' }
  | { type: 'exchange'; exchange: Exchange }
  | { type: 'result'; result: Result }
  | { type: 'done' };

export type Emit = (event: RunEvent) => void;

export function encodeEvent(event: RunEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

/** Reads a server-sent event stream into events. Ends with `done` however the stream ends. */
export async function* readEvents(response: Response): AsyncGenerator<RunEvent> {
  if (!response.ok || !response.body) {
    const problem = (await response.json().catch(() => ({}))) as { detail?: string };
    yield {
      type: 'result',
      result: { outcome: 'failed', title: `The run could not start (${response.status})`, detail: problem.detail },
    };
    yield { type: 'done' };
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let boundary;
    while ((boundary = buffer.indexOf('\n\n')) !== -1) {
      const frame = buffer.slice(0, boundary).replace(/^data: /, '');
      buffer = buffer.slice(boundary + 2);
      if (frame) yield JSON.parse(frame) as RunEvent;
    }
  }
  yield { type: 'done' };
}

export function formatMinor(minor: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(minor / 100);
}
