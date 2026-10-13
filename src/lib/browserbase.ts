import 'server-only';
import Browserbase from '@browserbasehq/sdk';
import { chromium } from 'playwright-core';
import { config } from './config';

export interface BrowserSession {
  id: string;
  connectUrl: string;
  liveViewUrl: string;
}

/**
 * A cloud browser with recording and logging off. Browserbase only accepts
 * either setting when the session is created, and both default to on: a
 * recorded session would keep whatever a Reactor typed into the page.
 *
 * `keepAlive` lets the session outlive this app's connection, which is how it
 * is handed to a Reactor: this app disconnects, the Reactor attaches.
 */
export async function openSession({ keepAlive }: { keepAlive: boolean }): Promise<BrowserSession> {
  const { browserbaseProjectId } = config();
  const browserbase = client();
  // #region open-session
  const session = await browserbase.sessions.create({
    projectId: browserbaseProjectId,
    keepAlive,
    browserSettings: {
      recordSession: false,
      logSession: false,
      viewport: { width: 1280, height: 800 },
    },
  });
  // #endregion
  const { debuggerFullscreenUrl } = await browserbase.sessions.debug(session.id);
  return { id: session.id, connectUrl: session.connectUrl, liveViewUrl: debuggerFullscreenUrl };
}

/** Attaches over CDP and returns the session's first page. */
export async function connect(session: BrowserSession) {
  const browser = await chromium.connectOverCDP(session.connectUrl);
  const page = browser.contexts()[0].pages()[0];
  return { browser, page };
}

export async function release(sessionId: string): Promise<void> {
  const { browserbaseProjectId } = config();
  await client()
    .sessions.update(sessionId, { projectId: browserbaseProjectId, status: 'REQUEST_RELEASE' })
    .catch(() => undefined);
}

function client() {
  return new Browserbase({ apiKey: config().browserbaseApiKey });
}
