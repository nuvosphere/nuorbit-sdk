import type { NuorbitFlowMode } from '../sdk/types';

export type StableSymbol = 'USDC' | 'USDT';

export interface StablecoinConfig {
  symbol: StableSymbol;
  address: string;
  decimals: number;
}

export interface NuorbitChainConfig {
  id: string;
  label: string;
  chainId: number;
  testnet?: boolean;
  stablecoins: Partial<Record<StableSymbol, StablecoinConfig>>;
}

export interface NuorbitSupportedChain extends StablecoinConfig {
  id: string;
  chainId: number;
  label: string;
  testnet: boolean;
  directReceiver?: string;
}

export type DirectReceiverMap = Record<string, string>;

export interface ChainQueryOptions {
  stable: StableSymbol;
  flow: NuorbitFlowMode;
  directReceivers?: DirectReceiverMap;
  chains?: readonly NuorbitChainConfig[];
}

export type NuorbitChainIdentifier = string;

export function listSupportedChains({
  stable,
  flow,
  directReceivers = {},
  chains = [],
}: ChainQueryOptions): NuorbitSupportedChain[] {
  return chains.reduce<NuorbitSupportedChain[]>((acc, chain) => {
    const stablecoin = chain.stablecoins[stable];
    if (!stablecoin) return acc;
    const directReceiver = directReceivers[directReceiverKey(chain.chainId, stable)];
    if (flow === 'direct-proof' && !directReceiver) {
      return acc;
    }
    acc.push({
      id: chain.id,
      chainId: chain.chainId,
      label: chain.label,
      testnet: Boolean(chain.testnet),
      symbol: stablecoin.symbol,
      address: stablecoin.address,
      decimals: stablecoin.decimals,
      directReceiver,
    });
    return acc;
  }, []);
}

export function directReceiverKey(chainId: number, stable: StableSymbol): string {
  return `${chainId}:${stable}`;
}
