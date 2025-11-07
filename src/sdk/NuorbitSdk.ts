import {
  type NuorbitSdkOptions,
  type NuorbitSdkRoutes,
  type NuorbitSessionRequest,
  type NuorbitSessionResponse,
  type NuorbitTransferConfirmation,
  type NuorbitTransferRequest,
  type NuorbitTransferFunction,
  type NuorbitRunFlowOptions,
  type NuorbitFlowResult,
  type NuorbitFlowEvent,
  type NuorbitSession,
  type StableSymbol,
  type NuorbitChainListing,
} from './types';
import { listSupportedChains, type NuorbitChainConfig } from '../config/chains';

const DEFAULT_ROUTES: NuorbitSdkRoutes = {
  session: '/api/demo/nuorbit/session',
  transfer: '/api/demo/nuorbit/transfer',
  execute: '/api/demo/nuorbit/execute',
  proof: '/api/demo/nuorbit/proof',
  directProof: '/api/demo/nuorbit/direct-proof',
  complete: '/api/demo/nuorbit/complete',
};

function normalizeBaseUrl(url?: string): string {
  if (!url) return '';
  return url.replace(/\/+$/u, '');
}

export class NuorbitSdk {
  private readonly baseUrl: string;
  private readonly fetchImpl: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
  private readonly defaultHeaders: Record<string, string>;
  private readonly routes: NuorbitSdkRoutes;
  private readonly chains: readonly NuorbitChainConfig[];
  private readonly directReceivers: Record<string, string>;
  private readonly defaultProviderCallId?: string;
  private readonly apiKey: string;

  constructor(options: NuorbitSdkOptions = {}) {
    this.baseUrl = normalizeBaseUrl(options.baseUrl);
    const fallbackFetch = typeof fetch === 'function' ? fetch.bind(globalThis) : undefined;
    const fetchImpl = options.fetch ?? fallbackFetch;
    if (!fetchImpl) {
      throw new Error('NuorbitSdk requires a fetch implementation. Provide one via options.fetch.');
    }
    const apiKey = options.apiKey?.trim();
    if (!apiKey) {
      throw new Error('NuorbitSdk requires an apiKey. Pass it via NuorbitSdkOptions.apiKey.');
    }
    this.apiKey = apiKey;
    this.fetchImpl = fetchImpl;
    this.defaultHeaders = { ...(options.defaultHeaders ?? {}) };
    this.defaultHeaders['X-NUORBIT-API-KEY'] = this.apiKey;
    this.routes = { ...DEFAULT_ROUTES, ...(options.routes ?? {}) };
    this.chains = options.chains ?? [];
    this.directReceivers = { ...(options.directReceivers ?? {}) };
    this.defaultProviderCallId = options.defaultProviderCallId;
  }

  getSupportedChains(stable: StableSymbol, flow: NuorbitSession['flowMode'] = 'cross-chain'): NuorbitChainListing[] {
    return listSupportedChains({
      stable,
      flow,
      chains: this.chains,
      directReceivers: this.directReceivers,
    });
  }

  async createSession(params: NuorbitSessionRequest): Promise<NuorbitSessionResponse> {
    return this.post<NuorbitSessionResponse>(this.routes.session, {
      network: params.network,
      chainLabel: params.chainLabel,
      chainId: params.chainId,
      priceUsd: params.priceUsd,
      payTo: params.payTo,
      description: params.description,
      assetSymbol: params.assetSymbol,
      assetDecimals: params.assetDecimals,
      assetAddress: params.assetAddress,
      participantAddress: params.participantAddress,
      flowMode: params.flowMode,
      providerCallId: params.providerCallId ?? null,
      stableSymbol: params.stableSymbol,
    });
  }

  async confirmTransfer(sessionToken: string, txHash?: string): Promise<NuorbitTransferConfirmation> {
    return this.post<NuorbitTransferConfirmation>(this.routes.transfer, {
      sessionToken,
      txHash,
    });
  }

  async executeSession(sessionToken: string): Promise<NuorbitTransferConfirmation> {
    return this.post<NuorbitTransferConfirmation>(this.routes.execute, {
      sessionToken,
    });
  }

  async fetchProof(sessionToken: string): Promise<NuorbitTransferConfirmation> {
    return this.post<NuorbitTransferConfirmation>(this.routes.proof, {
      sessionToken,
    });
  }

  async fetchDirectProof(sessionToken: string, txHash?: string): Promise<NuorbitTransferConfirmation> {
    return this.post<NuorbitTransferConfirmation>(this.routes.directProof, {
      sessionToken,
      txHash,
    });
  }

  async completeSession(sessionToken: string): Promise<NuorbitTransferConfirmation> {
    return this.post<NuorbitTransferConfirmation>(this.routes.complete, {
      sessionToken,
    });
  }

  async runFlow(options: NuorbitRunFlowOptions): Promise<NuorbitFlowResult> {
    const {
      transfer,
      transferTxHash,
      onEvent,
      stepDelayMs = 400,
      proofDelayMs = 900,
      providerCallId: providerCallOverride,
      ...sessionInput
    } = options;

    const emit = (event: NuorbitFlowEvent) => {
      if (onEvent) {
        onEvent(event);
      }
    };

    const resolvedFlowMode = sessionInput.flowMode ?? 'cross-chain';
    emit({ type: 'flow-started', mode: resolvedFlowMode });

    const providerCallId =
      resolvedFlowMode === 'cross-chain'
        ? providerCallOverride ?? this.defaultProviderCallId ?? null
        : null;
    if (resolvedFlowMode === 'cross-chain' && !providerCallId) {
      throw new Error('Cross-chain execution requires a providerCallId (configure one on NuorbitSdk).');
    }

    let sessionToken = '';
    let session: NuorbitSession | undefined;

    try {
      const sessionResponse = await this.createSession({
        ...sessionInput,
        flowMode: resolvedFlowMode,
        providerCallId,
      });
      session = sessionResponse.session;
      sessionToken = sessionResponse.sessionToken;
      let currentSession: NuorbitSession = sessionResponse.session;
      emit({ type: 'session-created', session: currentSession, sessionToken });

      const transferRequest: NuorbitTransferRequest = {
        chainId: currentSession.sourceChainId ?? sessionInput.chainId,
        tokenAddress: currentSession.assetAddress,
        recipient: currentSession.sourceAddress,
        amountAtomic: BigInt(currentSession.amountAtomic),
        decimals: currentSession.assetDecimals,
        symbol: currentSession.assetSymbol,
        session: currentSession,
      };

      emit({ type: 'transfer-requested', payload: transferRequest });

      let sourceTxHash = transferTxHash;
      if (!sourceTxHash) {
        const transferFn: NuorbitTransferFunction | undefined = transfer;
        if (!transferFn) {
          throw new Error('NuorbitSdk runFlow requires a transfer callback or a transferTxHash.');
        }
        sourceTxHash = await transferFn(transferRequest);
      }

      emit({ type: 'transfer-submitted', txHash: sourceTxHash, session: currentSession });

      const afterTransfer = await this.confirmTransfer(sessionToken, sourceTxHash);
      sessionToken = afterTransfer.sessionToken;
      currentSession = afterTransfer.session;
      session = currentSession;
      emit({ type: 'transfer-confirmed', session: currentSession });

      await this.delay(stepDelayMs);

      let registryTxHash: string | undefined;

      if (currentSession.flowMode === 'cross-chain') {
        emit({ type: 'execution-started', session: currentSession });
        const afterExecute = await this.executeSession(sessionToken);
        sessionToken = afterExecute.sessionToken;
        currentSession = afterExecute.session;
        session = currentSession;
        registryTxHash = currentSession.contractCall?.txHash;
        emit({ type: 'execution-complete', session: currentSession });

        await this.delay(proofDelayMs);
        emit({ type: 'proof-pending', session: currentSession });

        const afterProof = await this.fetchProof(sessionToken);
        sessionToken = afterProof.sessionToken;
        currentSession = afterProof.session;
        session = currentSession;
        emit({ type: 'proof-ready', session: currentSession });
      } else {
        await this.delay(stepDelayMs);
        const afterDirectProof = await this.fetchDirectProof(sessionToken, sourceTxHash);
        sessionToken = afterDirectProof.sessionToken;
        currentSession = afterDirectProof.session;
        session = currentSession;
        emit({ type: 'proof-ready', session: currentSession });
      }

      await this.delay(stepDelayMs);
      const afterComplete = await this.completeSession(sessionToken);
      sessionToken = afterComplete.sessionToken;
      currentSession = afterComplete.session;
      session = currentSession;
      emit({ type: 'flow-completed', session: currentSession });

      return {
        session: currentSession,
        sessionToken,
        transferTx: sourceTxHash,
        registryTx: currentSession.contractCall?.txHash ?? registryTxHash,
      };
    } catch (unknownError) {
      const error = unknownError instanceof Error ? unknownError : new Error(String(unknownError));
      emit({ type: 'flow-error', error, session });
      throw error;
    }
  }

  private async post<T>(path: string, body: unknown): Promise<T> {
    const url = this.resolveUrl(path);
    const headers = {
      'Content-Type': 'application/json',
      ...this.defaultHeaders,
    };
    const response = await this.fetchImpl(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body ?? {}),
    });

    const text = await response.text();
    let parsed: any = {};
    if (text) {
      try {
        parsed = JSON.parse(text);
      } catch {
        throw new Error(`Unable to parse response from ${url}`);
      }
    }

    if (!response.ok) {
      const message = typeof parsed?.error === 'string' ? parsed.error : `Request to ${url} failed (${response.status})`;
      throw new Error(message);
    }

    return parsed as T;
  }

  private resolveUrl(path: string): string {
    const finalPath = path.startsWith('/') ? path : `/${path}`;
    if (!this.baseUrl) {
      return finalPath;
    }
    return `${this.baseUrl}${finalPath}`;
  }

  private async delay(ms: number): Promise<void> {
    if (ms <= 0) return;
    await new Promise((resolve) => setTimeout(resolve, ms));
  }
}
