import type { Flow } from './run';

/** Code a step runs, read from its source file by region. */
export interface CodeRef {
  file: string;
  regions: string[];
  caption: string;
}

/** A CodeRef, read. */
export interface Snippet {
  file: string;
  caption: string;
  code: string;
}

export interface PlannedStep {
  id: string;
  label: string;
  /** One line. Backticks render as code. */
  explain: string;
  code?: CodeRef[];
}

const OPEN_SESSION: CodeRef = { file: 'src/lib/browserbase.ts', regions: ['open-session'], caption: 'This server' };

export interface FlowInfo {
  product: 'Browser Proxy' | 'PCI Agent Runtimes';
  name: string;
  /** One line, for the home page. */
  summary: string;
  /** Completes "Use it when …", from the guide's comparison. */
  when: string;
  /** Where the card goes. */
  path: string;
  /** One or two sentences under the title. */
  intro: string;
  /** What stops a wrong payment, or a card going where it should not, in one line. */
  guard: string;
  plan: PlannedStep[];
  /** The file to read first. */
  source: string;
  docs: string;
  model?: boolean;
}

const handoff = (reactor: string): PlannedStep[] => [
  {
    id: 'browser',
    label: 'Open a Browserbase session',
    explain: '`keepAlive: true`, so the Reactor can attach later. Recording off.',
    code: [OPEN_SESSION],
  },
  {
    id: 'checkout',
    label: 'Go to checkout, then let go',
    explain: 'This server never touches the payment fields.',
    code: [{ file: 'src/flows/handoff.ts', regions: ['let-go'], caption: 'This server' }],
  },
  {
    id: 'mandate',
    label: 'Sign the approval',
    explain: 'HMAC over items, amount, merchant and session.',
    code: [
      { file: 'src/lib/mandate.ts', regions: ['sign'], caption: 'This server signs' },
      { file: reactor, regions: ['verify'], caption: 'The Reactor verifies' },
    ],
  },
];

export const FLOW_INFO: Record<Flow, FlowInfo> = {
  intercept: {
    product: 'Browser Proxy',
    name: 'Intercept',
    summary: 'The browser types a fake card. Basis Theory swaps in the real one on the way to the store.',
    when: 'the page posts the card fields in a request you can match. The card never enters the browser.',
    path: 'Basis Theory → store',
    intro: 'The browser types a fake card. Basis Theory swaps in the real one on the way to the store.',
    guard: 'Only the one matched request goes through Basis Theory. The rest of the page loads as usual.',
    plan: [
      { id: 'browser', label: 'Open a Browserbase session', explain: 'Recording and logs off.', code: [OPEN_SESSION] },
      {
        id: 'checkout',
        label: 'Go to checkout',
        explain: 'Ordinary automation.',
        code: [{ file: 'src/flows/intercept.ts', regions: ['goto'], caption: 'This server' }],
      },
      {
        id: 'type',
        label: 'Type a fake card',
        explain: '`4111 1111 1111 1111` never reaches the store.',
        code: [{ file: 'src/flows/intercept.ts', regions: ['type', 'submit'], caption: 'This server' }],
      },
      {
        id: 'capture',
        label: 'Catch the payment request',
        explain: '`page.route` holds it inside the browser.',
        code: [{ file: 'src/flows/intercept.ts', regions: ['matcher'], caption: 'Inside page.route' }],
      },
      {
        id: 'proxy',
        label: 'Swap in the real card',
        explain: 'Token expressions → `POST /proxy` → the store.',
        code: [{ file: 'src/flows/intercept.ts', regions: ['swap', 'request', 'proxy', 'fulfill'], caption: 'This server' }],
      },
    ],
    source: 'src/flows/intercept.ts',
    docs: 'https://developers.basistheory.com/docs/guides/browser-proxy#intercept-the-checkout-request',
  },
  inject: {
    product: 'Browser Proxy',
    name: 'Inject',
    summary: 'A Reactor attaches to the browser, checks the order, then types the card.',
    when: 'the page encrypts the card before sending it, or the store only takes requests from the browser.',
    path: 'Reactor → checkout page',
    intro: 'The browser stops at checkout. A Reactor attaches, checks the order against the approval, and types the card.',
    guard: 'The Reactor checks the total against the signed approval.',
    plan: [
      ...handoff('reactors/checkout-injector/reactor.js'),
      {
        id: 'reactor',
        label: 'Hand off to the Reactor',
        explain: 'The card travels as `{{ token: … }}`.',
        code: [
          { file: 'src/flows/handoff.ts', regions: ['invoke', 'invoke-call'], caption: 'This server' },
          { file: 'reactors/checkout-injector/reactor.js', regions: ['attach', 'fill'], caption: 'In the Reactor' },
        ],
      },
    ],
    source: 'reactors/checkout-injector/reactor.js',
    docs: 'https://developers.basistheory.com/docs/guides/browser-proxy#inject-the-card-into-a-browser-session',
  },
  agent: {
    product: 'PCI Agent Runtimes',
    name: 'Checkout agent',
    summary: 'An AI agent inside a Reactor decides. Tools pay. The model never sees the card.',
    when: 'a model should judge the checkout before paying. Code still decides what it may pay for.',
    path: 'Reactor → checkout page',
    intro: 'The browser stops at checkout. An AI agent inside a Reactor decides whether to pay, and tools do the work. The model never sees the card.',
    guard: 'Every tool re-checks items and total in code. The model can stop a purchase, not change it.',
    plan: [
      ...handoff('reactors/checkout-agent/reactor.js'),
      {
        id: 'reactor',
        label: 'Hand off to the agent',
        explain: 'Tools: `read_checkout`, `fill_payment_fields`, `submit_order`.',
        code: [
          { file: 'src/flows/handoff.ts', regions: ['invoke', 'invoke-call'], caption: 'This server' },
          { file: 'reactors/checkout-agent/reactor.js', regions: ['tools'], caption: 'In the Reactor: the tools' },
          { file: 'reactors/checkout-agent/reactor.js', regions: ['guard'], caption: 'In the Reactor: the guard every tool runs' },
        ],
      },
    ],
    source: 'reactors/checkout-agent/reactor.js',
    docs: 'https://developers.basistheory.com/docs/guides/pci-agent-runtimes/agents-and-browsers',
    model: true,
  },
};
