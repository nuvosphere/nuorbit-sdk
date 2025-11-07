import type { StableSymbol } from '../config/chains';

export type NuorbitFlowMode = 'cross-chain' | 'direct-proof';

export type NuorbitSessionStatus =
  | 'awaiting-transfer'
  | 'transfer-confirmed'
  | 'executed'
  | 'proof-ready'
  | 'completed';

export interface NuorbitPermitTypedData {
  domain: {
    name: string;
    version: string;
    chainId: number;
    verifyingContract: string;
  };
  types: Record<string, Array<{ name: string; type: string }>>;
  message: Record<string, string>;
}

export interface NuorbitPermit {
  assetSymbol: string;
  assetAddress: string;
  amountAtomic: string;
  amountFormatted: string;
  decimals: number;
  deadline: number;
  signature: string;
  signer: string;
  spender: string;
  permitType: 'erc20-permit';
  issuedBy: string;
  typedData: NuorbitPermitTypedData;
  nonce: string;
  valueAtomic: string;
}

export interface NuorbitContractCall {
  to: string;
  data: string;
  description: string;
  txHash: string;
  blockNumber?: number;
}

export interface NuorbitProof {
  proofId: string;
  contractAddress: string;
  goatAccount: string;
  payer: string;
  amountAtomic: string;
  amountFormatted: string;
  stablecoin: string;
  sessionHash: string;
  recordedAt: number;
  txHash: string;
  blockNumber?: number;
}

export interface NuorbitCompletion {
  submissionId: string;
  submittedAt: number;
  acknowledgedBy: string;
}

export interface NuorbitSession {
  sessionId: string;
  sessionHash: string;
  flowMode: NuorbitFlowMode;
  stableSymbol: StableSymbol;
  network: string;
  chainLabel: string;
  sourceChainId: number | null;
  priceUsd: number;
  payTo: string;
  description: string;
  assetSymbol: string;
  assetDecimals: number;
  assetAddress: string;
  amountAtomic: string;
  amountFormatted: string;
  goatAccount: string;
  sourceAddress: string;
  targetAddress: string;
  targetChainId: number;
  targetNetwork: string;
  status: NuorbitSessionStatus;
  providerCallId?: string | null;
  createdAt: number;
  updatedAt: number;
  sourceTxHash?: string;
  permit?: NuorbitPermit;
  contractCall?: NuorbitContractCall;
  proof?: NuorbitProof;
  pendingProof?: {
    proofHash: string;
    txHash: string;
    initiatedAt: number;
  };
  completion?: NuorbitCompletion;
}
