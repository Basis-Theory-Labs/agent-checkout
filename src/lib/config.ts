import 'server-only';

/** Every call in this app goes to the TEST tenant. */
export const BT_API = 'https://api.test.basistheory.com';

/** The demo merchant. Pages link to it, so it is readable before setup has run. */
export function storeUrl(): string {
  return (process.env.STORE_URL || 'https://halden-store-cyan.vercel.app').replace(/\/+$/, '');
}

/** What every flow needs. */
export function config() {
  return read({
    privateKey: process.env.BT_PRIVATE_API_KEY,
    cardTokenId: process.env.CARD_TOKEN_ID,
    browserbaseApiKey: process.env.BROWSERBASE_API_KEY,
    browserbaseProjectId: process.env.BROWSERBASE_PROJECT_ID,
    storeUrl: storeUrl(),
  });
}

/** What the Reactor flows need on top. Intercept runs without any of it. */
export function reactorConfig() {
  return read({
    injectReactorId: process.env.INJECT_REACTOR_ID,
    agentReactorId: process.env.AGENT_REACTOR_ID,
    mandateSigningKey: process.env.MANDATE_SIGNING_KEY,
  });
}

/**
 * Read at call time, not import time, so a missing value fails the run that
 * needs it with a message that says how to fix it.
 */
function read<T extends Record<string, string | undefined>>(values: T): { [K in keyof T]: string } {
  const missing = Object.entries(values)
    .filter(([, value]) => !value)
    .map(([name]) => name);
  if (missing.length > 0) {
    throw new Error(`Missing ${missing.join(', ')} in .env.local. Run \`npm run setup\` first.`);
  }
  return values as { [K in keyof T]: string };
}
