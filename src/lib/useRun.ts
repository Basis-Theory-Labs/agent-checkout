'use client';

import { useCallback, useRef, useState } from 'react';
import { readEvents, type Exchange, type Flow, type Result, type Step } from './run';

export interface RunState {
  status: 'idle' | 'running' | 'finished';
  steps: Step[];
  liveViewUrl?: string;
  sessionId?: string;
  browserClosed: boolean;
  exchanges: Exchange[];
  result?: Result;
}

const IDLE: RunState = { status: 'idle', steps: [], browserClosed: false, exchanges: [] };

/** Posts a run and folds its event stream into one piece of state. */
export function useRun() {
  const [state, setState] = useState<RunState>(IDLE);
  const controller = useRef<AbortController | null>(null);

  const start = useCallback(async (flow: Flow) => {
    controller.current?.abort();
    const abort = new AbortController();
    controller.current = abort;
    setState({ ...IDLE, status: 'running' });

    try {
      const response = await fetch('/api/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ flow }),
        signal: abort.signal,
      });

      for await (const event of readEvents(response)) {
        setState((current) => {
          switch (event.type) {
            case 'step':
              return { ...current, steps: upsert(current.steps, event.step) };
            case 'exchange':
              return { ...current, exchanges: upsert(current.exchanges, event.exchange) };
            case 'browser':
              return { ...current, liveViewUrl: event.liveViewUrl, sessionId: event.sessionId, browserClosed: false };
            case 'browser-closed':
              return { ...current, browserClosed: true };
            case 'result':
              return { ...current, result: event.result };
            case 'done':
              return { ...current, status: 'finished' };
          }
        });
      }
    } catch (error) {
      if ((error as Error).name === 'AbortError') return;
      setState((current) => ({
        ...current,
        status: 'finished',
        result: { outcome: 'failed', title: 'Lost the connection to the run', detail: String(error) },
      }));
    }
  }, []);

  const reset = useCallback(() => {
    controller.current?.abort();
    setState(IDLE);
  }, []);

  return { state, start, reset };
}

/** Replaces the entry with the same id, so a step or exchange updates in place. */
function upsert<T extends { id: string }>(list: T[], next: T): T[] {
  return list.some((item) => item.id === next.id)
    ? list.map((item) => (item.id === next.id ? next : item))
    : [...list, next];
}
