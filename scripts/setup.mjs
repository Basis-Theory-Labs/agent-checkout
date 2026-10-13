/**
 * One-time setup against your Basis Theory TEST tenant: `npm run setup`.
 *
 * From a Management key and your Browserbase and model provider keys in
 * .env.local, it creates everything the console needs and writes what it
 * created back into .env.local:
 *
 *   1. A private application for the console. An access rule lets it create
 *      and use card tokens in /pci/high/ only, Reactors and the Proxy included.
 *   2. The two Reactors, built from ./reactors and configured for the store.
 *   3. A test card token.
 *
 * Run it again whenever you change a Reactor: the application is kept, the
 * Reactors are updated in place, and a fresh test card is minted.
 *
 * `npm run card` mints the test card alone, in a second. Basis Theory removes
 * a card's security code an hour after it is collected, so run it before you
 * present.
 */
import { randomBytes } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";

const API = "https://api.test.basistheory.com";
const ENV_FILE = new URL("../.env.local", import.meta.url);
const env = process.env;

if (process.argv.includes("--card")) {
  if (!env.BT_PRIVATE_API_KEY) fail("Run `npm run setup` first: it creates the key that mints the card.");
  await mintCard(env.BT_PRIVATE_API_KEY);
  process.exit(0);
}

const required = ["BT_MANAGEMENT_KEY", "BROWSERBASE_API_KEY", "MODEL_API_KEY"];
const missing = required.filter((name) => !env[name]);
if (missing.length > 0) {
  fail(`Set ${missing.join(", ")} in .env.local first. See .env.example.`);
}

const STORE_URL = new URL(env.STORE_URL ?? "https://halden-store-cyan.vercel.app");
const MANDATE_SIGNING_KEY = env.MANDATE_SIGNING_KEY || randomBytes(32).toString("hex");

// Where each Reactor may act. The caller can name a merchant, never a page or a field.
const MERCHANTS = JSON.stringify({
  halden: {
    origin: STORE_URL.origin,
    checkout_path: "/checkout",
    currency: "USD",
    selectors: {
      items: ".line-item-name",
      total: "#order-total",
      card_number: "#card-number",
      expiry: "#card-expiry",
      security_code: "#card-cvc",
      submit: "#place-order",
      result: "#result",
    },
  },
});

const shared = {
  BROWSERBASE_API_KEY: env.BROWSERBASE_API_KEY,
  MANDATE_SIGNING_KEY,
  MERCHANTS,
};

const REACTORS = [
  {
    env: "INJECT_REACTOR_ID",
    name: "Agent Checkout · Inject",
    dir: "checkout-injector",
    configuration: shared,
  },
  {
    env: "AGENT_REACTOR_ID",
    name: "Agent Checkout · Agent",
    dir: "checkout-agent",
    configuration: {
      ...shared,
      MODEL_BASE_URL: env.MODEL_BASE_URL || "https://api.openai.com/v1",
      MODEL_API_KEY: env.MODEL_API_KEY,
      MODEL: env.MODEL || "gpt-4.1-mini",
    },
  },
];

const saved = { MANDATE_SIGNING_KEY };

// 1. The console's own application.
if (env.BT_PRIVATE_API_KEY) {
  step("Private application", "kept");
} else {
  // An access rule rather than `reactor:invoke` and `proxy:invoke`: `token:use` on one
  // container lets the app invoke Reactors and the Proxy with those cards and no others.
  // An application takes either permissions or rules, not both.
  const application = await bt("POST", "/applications", env.BT_MANAGEMENT_KEY, {
    name: "Agent Checkout",
    type: "private",
    // The transform applies to `token:use` too: under `mask`, a Reactor or the Proxy
    // receives `XXXXXXXXXXXX4242` and no security code. Using the card takes `reveal`;
    // creating one does not, so a create response never echoes the number back.
    rules: [
      {
        description: "Pay with the cards this demo holds, through Reactors and the Proxy",
        priority: 1,
        container: "/pci/high/",
        transform: "reveal",
        permissions: ["token:use"],
      },
      {
        description: "Create the test card",
        priority: 2,
        container: "/pci/high/",
        transform: "mask",
        permissions: ["token:create"],
      },
    ],
  });
  saved.BT_PRIVATE_API_KEY = application.key;
  step("Private application", application.id);
}

// 2. The Reactors. Provisioning is asynchronous: dependencies are installed and
//    scanned for vulnerabilities, which takes a few minutes.
const pending = [];
for (const reactor of REACTORS) {
  const code = await readFile(new URL(`../reactors/${reactor.dir}/reactor.js`, import.meta.url), "utf8");
  const { dependencies } = JSON.parse(
    await readFile(new URL(`../reactors/${reactor.dir}/package.json`, import.meta.url), "utf8"),
  );
  const body = {
    name: reactor.name,
    code,
    configuration: reactor.configuration,
    runtime: { image: "node24", dependencies, timeout: 30, resources: "standard", warm_concurrency: 0 },
  };

  const existing = env[reactor.env];
  const created = existing
    ? await bt("PUT", `/reactors/${existing}`, env.BT_MANAGEMENT_KEY, body)
    : await bt("POST", "/reactors", env.BT_MANAGEMENT_KEY, body);
  saved[reactor.env] = created.id;
  step(reactor.name, `${existing ? "updating" : "creating"} ${created.id}`);
  pending.push({ ...reactor, id: created.id });
}

await saveEnv(saved);

for (const reactor of pending) {
  const state = await settle(reactor.id);
  if (state.state !== "active") {
    const { error_code, error_message, error_details } = state.requested ?? {};
    fail(
      `${reactor.name} is ${state.state}: ${error_code ?? "no error code"} ${error_message ?? ""}\n` +
        JSON.stringify(error_details ?? {}, null, 2),
    );
  }
  step(reactor.name, "active");
}

// 3. A test card.
await mintCard(saved.BT_PRIVATE_API_KEY ?? env.BT_PRIVATE_API_KEY);

console.log("\nDone. Start the console with `npm run dev`.");

/* --- helpers ------------------------------------------------------------- */

/**
 * In production your application already holds card tokens, from Elements or
 * an inbound proxy; this one stands in for them.
 */
async function mintCard(key) {
  const card = await bt("POST", "/tokens", key, {
    type: "card",
    data: { number: "4242424242424242", expiration_month: 12, expiration_year: 2030, cvc: "123" },
  });
  await saveEnv({ CARD_TOKEN_ID: card.id });
  step("Test card token", `${card.id} (${card.card?.brand} ${card.card?.last4})`);
}

async function bt(method, path, key, body) {
  const response = await fetch(`${API}${path}`, {
    method,
    headers: { "BT-API-KEY": key, "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  const parsed = text ? JSON.parse(text) : {};
  if (!response.ok) {
    fail(`${method} ${path} returned ${response.status}\n${JSON.stringify(parsed, null, 2)}`);
  }
  return parsed;
}

async function settle(id) {
  const deadline = Date.now() + 15 * 60_000;
  for (;;) {
    const reactor = await bt("GET", `/reactors/${id}`, env.BT_MANAGEMENT_KEY);
    if (!["creating", "updating"].includes(reactor.state)) return reactor;
    if (Date.now() > deadline) fail(`Reactor ${id} is still ${reactor.state} after 15 minutes.`);
    await new Promise((resolve) => setTimeout(resolve, 10_000));
  }
}

/** Sets keys in .env.local, keeping every other line as it was. */
async function saveEnv(values) {
  const lines = (await readFile(ENV_FILE, "utf8").catch(() => "")).split("\n");
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) continue;
    const index = lines.findIndex((line) => line.startsWith(`${key}=`));
    if (index === -1) lines.splice(lines.at(-1) === "" ? -1 : lines.length, 0, `${key}=${value}`);
    else lines[index] = `${key}=${value}`;
  }
  await writeFile(ENV_FILE, lines.join("\n").replace(/\n*$/, "\n"));
}

function step(label, detail) {
  console.log(`  ✓ ${label.padEnd(28)} ${detail}`);
}

function fail(message) {
  console.error(`\n✗ ${message}`);
  process.exit(1);
}
