# NuOrbit SDK

Headless utilities that let you embed the NuOrbit checkout flow in any JavaScript/TypeScript app. This package ships:

- `NuorbitSdk`: an orchestrator that talks to the NuOrbit API and guides a wallet through the transfer → execution → proof pipeline.
- `launchNuorbitCheckout`: a popup helper if you prefer to defer UX to the NuOrbit-hosted checkout.
- Config helpers for chain metadata, direct receivers, and provider call templates so you can express the networks your product supports.

The SDK does not render UI. You can use it in a browser, in React Native, or inside your own backend—wherever you can provide a `fetch` implementation and wallet-side transfer function.

## Installation

```bash
npm install @nuorbit/sdk
# or: pnpm add @nuorbit/sdk / yarn add @nuorbit/sdk
```

All exports are available from the package root:

```ts
import { NuorbitSdk, launchNuorbitCheckout, type NuorbitChainConfig } from '@nuorbit/sdk';
```

## Usage Overview

1. **Describe the networks you support.** Provide an array of `NuorbitChainConfig` objects (id, label, chainId, and available stablecoins).
2. **Describe who receives funds for each direct-proof network.** Build a `DirectReceiverMap` keyed by `${chainId}:${stable}`.
3. **Instantiate `NuorbitSdk`.** Pass your API key, optional base URL, the chain metadata, and any sensible defaults like `defaultProviderCallId`.
4. **Call `runFlow`** whenever a user wants to pay. Supply the session parameters and a `transfer` callback that originates the ERC-20 transfer from the user’s wallet.

### Example

```ts
import { NuorbitSdk, type NuorbitRunFlowOptions, type NuorbitChainConfig, directReceiverKey } from '@nuorbit/sdk';

const chains: NuorbitChainConfig[] = [
  {
    id: 'base-mainnet',
    label: 'Base',
    chainId: 8453,
    stablecoins: {
      USDC: { symbol: 'USDC', address: '0xA0b869...', decimals: 6 },
      USDT: { symbol: 'USDT', address: '0x...', decimals: 6 },
    },
  },
];

const directReceivers = {
  [directReceiverKey(8453, 'USDC')]: '0xReceiverAddress',
};

const sdk = new NuorbitSdk({
  apiKey: process.env.NUORBIT_API_KEY,
  baseUrl: 'https://portal.nuorbit.xyz',
  chains,
  directReceivers,
  defaultProviderCallId: 'registry-permit-base',
});

async function runNuOrbitCheckout(participant: string) {
  const result = await sdk.runFlow({
    network: 'base',
    chainLabel: 'Base',
    chainId: 8453,
    priceUsd: 25,
    payTo: 'nuorbit-goat',
    description: 'Premium plan',
    assetSymbol: 'USDC',
    assetDecimals: 6,
    assetAddress: '0xA0b869...',
    participantAddress: participant,
    stableSymbol: 'USDC',
    flowMode: 'cross-chain',
    transfer: async (request) => {
      // Fire a wallet request, send ERC-20 transfer, return the tx hash:
      const txHash = await wallet.sendErc20(request);
      return txHash;
    },
    onEvent: (event) => console.log('NuOrbit event', event.type, event),
  } satisfies NuorbitRunFlowOptions);

  console.log('NuOrbit session complete', result.session.sessionId, result.transferTx);
}
```

`runFlow` waits for every backend step and resolves with `session`, `sessionToken`, `transferTx`, and (for cross-chain flows) the registry transaction hash. If any step fails you’ll receive a thrown error and a `flow-error` event.

### Lifecycle Events

Register `onEvent` to keep your UI in sync. Events fire in this order for a cross-chain flow:

| Event type | When it fires |
| --- | --- |
| `flow-started` | `runFlow` begins with resolved `flowMode`. |
| `session-created` | NuOrbit session + token returned from the API. |
| `transfer-requested` | SDK built the transfer payload passed to your wallet. |
| `transfer-submitted` | Your `transfer` callback resolved with a tx hash. |
| `transfer-confirmed` | NuOrbit confirmed the payment with its API. |
| `execution-started` | Cross-chain execution RPC kicked off. |
| `execution-complete` | Provider call finished (registry tx hash available). |
| `proof-pending` | Waiting for the cross-chain proof window. |
| `proof-ready` | Proof is recorded; direct-proof flows jump straight here. |
| `flow-completed` | Session marked complete on the NuOrbit backend. |
| `flow-error` | Emitted whenever any step throws. |

Use these to display progress indicators, let users retry, or gather telemetry.

### Manual Control

Prefer to orchestrate each call yourself? Use the public methods directly:

```ts
const { session, sessionToken } = await sdk.createSession({ ... });
await sdk.confirmTransfer(sessionToken, sourceTxHash);
await sdk.executeSession(sessionToken);
await sdk.fetchProof(sessionToken);
await sdk.completeSession(sessionToken);
```

You can insert custom polling, multi-step confirmations, or server-side actions between calls. All helpers accept the same token returned by the previous step.

## Checkout Popup Launcher

`launchNuorbitCheckout` creates a managed popup that listens for `postMessage` results:

```ts
import { launchNuorbitCheckout } from '@nuorbit/sdk';

const handle = launchNuorbitCheckout({
  baseUrl: 'https://app.nuorbit.xyz',
  path: '/demo/checkout',
  priceUsd: 42,
  payTo: 'nuorbit-goat',
  description: 'Annual license',
  prefillNetwork: 'base',
  prefillStable: 'USDC',
  flowMode: 'cross-chain',
  onPopupBlocked: () => alert('Please allow popups to continue.'),
});

const outcome = await handle.result;
```

`handle.result` resolves with a discriminated union:

- `status: 'success'` exposes `flowMode`, `transferTx`, `registryTx`, `proofTx`, `sessionId`, `stableSymbol`, and other metadata.
- `status: 'pending' | 'error' | 'cancelled'` contains an optional `message` plus network data so you can show the correct banner.

Use `targetOrigin` if you are embedding a checkout hosted on a different origin than the one the current window trusts.

### Stock UI usage guide

The launcher talks to the NuOrbit “stock” UI hosted at `https://app.nuorbit.xyz` by default. To drop it into an app:

1. Call `launchNuorbitCheckout` from a user interaction handler (button click). Browsers block popups triggered outside user gestures.
2. Pass `priceUsd`, `payTo`, and `description` to mirror the order summary shown in the popup.
3. Use `prefillNetwork`, `prefillStable`, and `flowMode` to steer the flow the user sees first.
4. Listen to `handle.result` and change your own UI depending on the returned `status`.

```ts
checkoutButton.addEventListener('click', async () => {
  try {
    const handle = launchNuorbitCheckout({
      baseUrl: 'https://app.nuorbit.xyz', // or your self-hosted build
      path: '/demo/checkout',
      priceUsd: Number(amountInput.value),
      payTo: merchantId,
      description: `Pay ${merchantName}`,
      prefillNetwork: preferredNetwork,
      prefillStable: 'USDC',
      flowMode: supportsDirect ? 'direct-proof' : 'cross-chain',
    });

    const outcome = await handle.result;
    renderReceipt(outcome);
  } catch (error) {
    toast.error(error instanceof Error ? error.message : String(error));
  }
});
```

### Customizing the stock UI

You can progressively customize the stock UI without rebuilding it from scratch:

- **Branding + query params:** host your own copy of the NuOrbit checkout app (or ask your NuOrbit contact for a whitelabel URL) and pass that host via `baseUrl`. The launcher keeps all query parameters so you can add branding/tier overrides server-side.
- **Preset window behavior:** tweak `windowName` and `windowFeatures` to match your product guidelines (e.g., `width=520,height=780,left=...,top=...`).
- **Prefills and hints:** `priceUsd`, `payTo`, `description`, `prefillNetwork`, `prefillStable`, and `flowMode` all land in the checkout search params. The hosted UI treats them as defaults but still lets users change selections.
- **Cross-window messaging:** use `targetOrigin='*'` when integrating with a custom origin and handle the resolved payload to trigger transitions in your host app (show receipts, refresh balances, etc.).
- **Popup fallback:** implement `onPopupBlocked` to degrade gracefully into a full-page redirect (call `window.location.assign(checkoutUrl)` inside the callback).

If you need deeper control (branding, translations, additional form fields), fork the stock UI, deploy it under your own domain, and keep using `launchNuorbitCheckout`—just point `baseUrl` to your deployment so you retain the popup plumbing and typed result handling.

## Configuration Helpers

- **`NuorbitChainConfig[]`** describe stablecoin metadata per chain. Supply them to the SDK constructor so methods like `getSupportedChains` can filter networks for a given stable + flow mode.
- **`DirectReceiverMap`** ensures the `direct-proof` flow only lists networks where you operate a receiving contract. Build keys with `directReceiverKey(chainId, stable)`.
- **`NuorbitProviderCallTemplate`** definitions help you keep track of registry targets and labels. The SDK itself only needs the `defaultProviderCallId` string, but sharing template metadata unlocks richer UI (e.g., “Send to Registry on Base”).

```ts
import { directReceiverKey, type NuorbitProviderCallTemplate } from '@nuorbit/sdk';

const providerCalls: NuorbitProviderCallTemplate[] = [
  {
    id: 'registry-permit-base',
    label: 'Base Registry Permit',
    description: 'Cross-chain permit routed to Base registry',
    targetChainId: 8453,
    kind: 'registry-permit',
    registryAddress: '0xRegistry',
  },
];

const directReceivers = {
  [directReceiverKey(8453, 'USDC')]: '0xReceiver',
};
```

## API Reference (summary)

### `new NuorbitSdk(options: NuorbitSdkOptions)`

- `apiKey` **(required)**: NuOrbit-issued API key.
- `baseUrl`: Host that serves NuOrbit endpoints (`/api/demo/nuorbit/...` by default).
- `fetch`: Custom fetch implementation (pass `node-fetch` when running in Node).
- `defaultHeaders`: Extra headers merged into each request.
- `routes`: Override the relative path for each backend endpoint.
- `chains`: Array of `NuorbitChainConfig` objects used by `getSupportedChains` and for your own UI.
- `directReceivers`: Map used when filtering direct-proof chains.
- `defaultProviderCallId`: Provider call template that `runFlow` uses when `flowMode` is `cross-chain` unless a per-flow override is provided.

### Methods

- `getSupportedChains(stable, flow?)` → `NuorbitChainListing[]`
- `createSession(request)` → `{ session, sessionToken }`
- `confirmTransfer(sessionToken, txHash?)`
- `executeSession(sessionToken)`
- `fetchProof(sessionToken)`
- `fetchDirectProof(sessionToken, txHash?)`
- `completeSession(sessionToken)`
- `runFlow(options)` → `{ session, sessionToken, transferTx?, registryTx? }`

Each method throws on HTTP errors with the API-provided error string where available.

### Checkout launcher

`launchNuorbitCheckout(options?: NuorbitCheckoutOptions)` → `NuorbitCheckoutHandle`

Options allow you to adjust `baseUrl`, `path`, popup sizing, preset price/description, and more. The handle exposes `popup`, `result`, `close()`, and `focus()`.

## Development

```bash
npm install
tsc --noEmit
```

Feel free to publish this package to npm or import it directly via a workspace file reference.
