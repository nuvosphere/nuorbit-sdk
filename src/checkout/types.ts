import type { NuorbitFlowMode } from '../sdk/types';

export type NuorbitCheckoutStatus = 'success' | 'pending' | 'error' | 'cancelled';

export interface NuorbitCheckoutBaseResult {
  status: NuorbitCheckoutStatus;
  message?: string;
  network?: string;
  networkLabel?: string;
  flowMode?: NuorbitFlowMode;
  stableSymbol?: string;
}

export interface NuorbitCheckoutSuccess extends NuorbitCheckoutBaseResult {
  status: 'success';
  flowMode: NuorbitFlowMode;
  targetNetwork?: string;
  targetChainId?: number;
  sourceChainId?: number;
  transferTx?: string;
  registryTx?: string;
  proofTx?: string;
  proofId?: string;
  completionId?: string;
  contract?: string;
  amount?: string;
  goatAccount?: string;
  sessionId?: string;
  /**
   * Legacy field emitted by older builds; preserved for compatibility.
   */
  txHash?: string;
}

export interface NuorbitCheckoutPending extends NuorbitCheckoutBaseResult {
  status: 'pending';
}

export interface NuorbitCheckoutError extends NuorbitCheckoutBaseResult {
  status: 'error';
  message: string;
}

export interface NuorbitCheckoutCancelled extends NuorbitCheckoutBaseResult {
  status: 'cancelled';
  message?: string;
}

export type NuorbitCheckoutResult =
  | NuorbitCheckoutSuccess
  | NuorbitCheckoutPending
  | NuorbitCheckoutError
  | NuorbitCheckoutCancelled;

export interface NuorbitCheckoutOptions {
  /**
   * Base URL hosting the checkout page. Defaults to current origin.
   */
  baseUrl?: string;
  /**
   * Path to the checkout route. Defaults to `/demo/checkout`.
   */
  path?: string;
  /**
   * Optional popup window name.
   */
  windowName?: string;
  /**
   * Window features passed to `window.open`.
   */
  windowFeatures?: string;
  /**
   * NuOrbit price (USD). When omitted, the checkout defaults.
   */
  priceUsd?: number | string;
  /**
   * Pay-to address for the NuOrbit session.
   */
  payTo?: string;
  /**
   * Description shown in the checkout UI.
   */
  description?: string;
  /**
   * Preselects a source network slug.
   */
  prefillNetwork?: string;
  /**
   * Preselects a stablecoin symbol (USDC or USDT).
   */
  prefillStable?: string;
  /**
   * Initial flow mode for the checkout popup.
   */
  flowMode?: NuorbitFlowMode;
  /**
   * Optional: override the expected origin when listening for postMessage events.
   */
  targetOrigin?: string;
  /**
   * Called when the popup fails to open.
   */
  onPopupBlocked?: () => void;
}

export interface NuorbitCheckoutHandle {
  /**
   * Underlying window reference.
   */
  readonly popup: Window;
  /**
   * Promise resolving with the checkout outcome.
   */
  readonly result: Promise<NuorbitCheckoutResult>;
  /**
   * Manually close the popup.
   */
  close(): void;
  /**
   * Brings the popup into focus.
   */
  focus(): void;
}
