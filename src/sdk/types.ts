import type {
  NuorbitCompletion,
  NuorbitContractCall,
  NuorbitFlowMode,
  NuorbitPermit,
  NuorbitPermitTypedData,
  NuorbitProof,
  NuorbitSession,
  NuorbitSessionStatus,
} from './sessionTypes';
import type {
  DirectReceiverMap,
  NuorbitChainConfig,
  NuorbitSupportedChain,
  StableSymbol,
} from '../config/chains';

export type {
  NuorbitCompletion,
  NuorbitContractCall,
  NuorbitFlowMode,
  NuorbitPermit,
  NuorbitPermitTypedData,
  NuorbitProof,
  NuorbitSession,
  NuorbitSessionStatus,
};
export type { StableSymbol, NuorbitSupportedChain } from '../config/chains';

export interface NuorbitSdkRoutes {
  session: string;
  transfer: string;
  execute: string;
  proof: string;
  directProof: string;
  complete: string;
}

export interface NuorbitSdkOptions {
  /**
   * API key issued by the NuOrbit service. Required.
   */
  apiKey?: string;
  /**
   * Base URL that prefixes every API request (e.g. https://galacticpools.io).
   * Defaults to an empty string which targets the current origin.
   */
  baseUrl?: string;
  /**
   * Custom fetch implementation. Defaults to the global fetch if available.
   */
  fetch?: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
  /**
   * Extra headers sent with every API request (authorization, etc).
   */
  defaultHeaders?: Record<string, string>;
  /**
   * Override API route paths. Useful when the provider hosts the NuOrbit
   * endpoints under a different prefix.
   */
  routes?: Partial<NuorbitSdkRoutes>;
  /**
   * Override the directory of supported chains.
   */
  chains?: readonly NuorbitChainConfig[];
  /**
   * Map of `${chainId}:${stable}` -> receiver address for direct payments.
   */
  directReceivers?: DirectReceiverMap;
  /**
   * Default provider call template identifier for cross-chain execution.
   */
  defaultProviderCallId?: string;
}

export interface NuorbitSessionRequest {
  network: string;
  chainLabel: string;
  chainId: number;
  priceUsd: number;
  payTo: string;
  description: string;
  assetSymbol: string;
  assetDecimals: number;
  assetAddress: string;
  participantAddress: string;
  flowMode?: NuorbitFlowMode;
  providerCallId?: string | null;
  stableSymbol?: StableSymbol;
}

export interface NuorbitSessionResponse {
  session: NuorbitSession;
  sessionToken: string;
}

export interface NuorbitTransferConfirmation {
  session: NuorbitSession;
  sessionToken: string;
}

export interface NuorbitTransferRequest {
  chainId: number;
  tokenAddress: string;
  recipient: string;
  amountAtomic: bigint;
  decimals: number;
  symbol: string;
  session: NuorbitSession;
}

export type NuorbitTransferFunction = (request: NuorbitTransferRequest) => Promise<string>;

export type NuorbitFlowEvent =
  | { type: 'flow-started'; mode: NuorbitFlowMode }
  | { type: 'session-created'; session: NuorbitSession; sessionToken: string }
  | { type: 'transfer-requested'; payload: NuorbitTransferRequest }
  | { type: 'transfer-submitted'; txHash: string; session: NuorbitSession }
  | { type: 'transfer-confirmed'; session: NuorbitSession }
  | { type: 'execution-started'; session: NuorbitSession }
  | { type: 'execution-complete'; session: NuorbitSession }
  | { type: 'proof-pending'; session: NuorbitSession }
  | { type: 'proof-ready'; session: NuorbitSession }
  | { type: 'flow-completed'; session: NuorbitSession }
  | { type: 'flow-error'; error: Error; session?: NuorbitSession };

export interface NuorbitRunFlowOptions extends NuorbitSessionRequest {
  /**
   * Provide a transfer implementation that sends the ERC-20 payment on the
   * user's behalf. It must resolve with the source-chain transaction hash.
   */
  transfer?: NuorbitTransferFunction;
  /**
   * Skip invoking the transfer callback and supply a pre-existing tx hash.
   */
  transferTxHash?: string;
  /**
   * Receive lifecycle events during the flow.
   */
  onEvent?: (event: NuorbitFlowEvent) => void;
  /**
   * Delay (ms) between sequential API calls. Defaults to 400ms.
   */
  stepDelayMs?: number;
  /**
   * Delay (ms) before fetching the cross-chain proof. Defaults to 900ms.
   */
  proofDelayMs?: number;
  /**
   * Provider call template identifier required for cross-chain execution.
   */
  providerCallId?: string | null;
}

export interface NuorbitFlowResult {
  session: NuorbitSession;
  sessionToken: string;
  transferTx?: string;
  registryTx?: string;
}

export type NuorbitChainListing = NuorbitSupportedChain;
