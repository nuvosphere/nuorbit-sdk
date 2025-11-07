import { type NuorbitCheckoutHandle, type NuorbitCheckoutOptions, type NuorbitCheckoutResult } from './types';

const DEFAULT_WINDOW_FEATURES = ['popup=yes', 'resizable=yes', 'width=420', 'height=720', 'noopener=yes'].join(',');

function isObjectLike(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function resolveBaseUrl(baseUrl?: string): URL {
  if (typeof window === 'undefined') {
    throw new Error('NuOrbit checkout launcher requires a browser environment with window.');
  }
  if (!baseUrl) {
    return new URL(window.location.origin);
  }
  try {
    return new URL(baseUrl, window.location.href);
  } catch {
    throw new Error(`Invalid baseUrl provided to NuOrbit checkout launcher: ${baseUrl}`);
  }
}

function stringifyPrice(price?: number | string): string | undefined {
  if (price == null) return undefined;
  if (typeof price === 'number') {
    if (!Number.isFinite(price)) {
      throw new Error('priceUsd must be a finite number.');
    }
    return price.toString();
  }
  return price;
}

export function launchNuorbitCheckout(options: NuorbitCheckoutOptions = {}): NuorbitCheckoutHandle {
  if (typeof window === 'undefined') {
    throw new Error('NuOrbit checkout launcher requires a browser window.');
  }

  const {
    baseUrl,
    path = '/demo/checkout',
    windowName = 'nuorbit-checkout',
    windowFeatures = DEFAULT_WINDOW_FEATURES,
    priceUsd,
    payTo,
    description,
    prefillNetwork,
    prefillStable,
    flowMode,
    targetOrigin,
    onPopupBlocked,
  } = options;

  const base = resolveBaseUrl(baseUrl);
  const checkoutUrl = new URL(path.startsWith('/') ? path : `/${path}`, base.href);

  const priceParam = stringifyPrice(priceUsd);
  if (priceParam) checkoutUrl.searchParams.set('price', priceParam);
  if (payTo) checkoutUrl.searchParams.set('payTo', payTo);
  if (description) checkoutUrl.searchParams.set('description', description);
  if (prefillNetwork) checkoutUrl.searchParams.set('prefillNetwork', prefillNetwork);
  if (flowMode) checkoutUrl.searchParams.set('flowMode', flowMode);
  if (prefillStable) checkoutUrl.searchParams.set('prefillStable', prefillStable);

  const popup = window.open(checkoutUrl.toString(), windowName, windowFeatures);
  if (!popup) {
    if (onPopupBlocked) {
      onPopupBlocked();
    }
    throw new Error('NuOrbit checkout popup was blocked by the browser.');
  }

  try {
    popup.focus();
  } catch {
    /* ignore focus errors */
  }

  const expectedOrigin =
    targetOrigin ||
    (() => {
      try {
        return base.origin;
      } catch {
        return window.location.origin;
      }
    })();

  const resultPromise = new Promise<NuorbitCheckoutResult>((resolve) => {
    let finished = false;
    let closeTimer: number | undefined;

    const cleanup = () => {
      if (closeTimer !== undefined) {
        window.clearInterval(closeTimer);
        closeTimer = undefined;
      }
      window.removeEventListener('message', onMessage);
    };

    const finish = (result: NuorbitCheckoutResult) => {
      if (finished) return;
      finished = true;
      cleanup();
      resolve(result);
    };

    const onMessage = (event: MessageEvent) => {
      if (expectedOrigin !== '*' && event.origin !== expectedOrigin) {
        return;
      }
      const payload = event.data;
      if (!isObjectLike(payload) || payload.type !== 'x402-payment') {
        return;
      }

      const status = typeof payload.status === 'string' ? payload.status : 'error';
      const normalizedFlowMode =
        payload.flowMode === 'direct-proof'
          ? 'direct-proof'
          : payload.flowMode === 'cross-chain'
            ? 'cross-chain'
            : undefined;
      const network = typeof payload.network === 'string' ? payload.network : undefined;
      const networkLabel = typeof payload.networkLabel === 'string' ? payload.networkLabel : undefined;
      const targetNetwork = typeof payload.targetNetwork === 'string' ? payload.targetNetwork : undefined;
      const targetChainId =
        typeof payload.targetChainId === 'number' && Number.isFinite(payload.targetChainId)
          ? payload.targetChainId
          : undefined;
      const sourceChainId =
        typeof payload.sourceChainId === 'number' && Number.isFinite(payload.sourceChainId)
          ? payload.sourceChainId
          : undefined;
      const registryTx = typeof payload.registryTx === 'string' ? payload.registryTx : undefined;
      const proofTx = typeof payload.proofTx === 'string' ? payload.proofTx : undefined;
      const proofId = typeof payload.proofId === 'string' ? payload.proofId : undefined;
      const completionId = typeof payload.completionId === 'string' ? payload.completionId : undefined;
      const contract = typeof payload.contract === 'string' ? payload.contract : undefined;
      const amount = typeof payload.amount === 'string' ? payload.amount : undefined;
      const goatAccount = typeof payload.goatAccount === 'string' ? payload.goatAccount : undefined;
      const sessionId = typeof payload.sessionId === 'string' ? payload.sessionId : undefined;
      const txHash = typeof payload.txHash === 'string' ? payload.txHash : undefined;
      const message = typeof payload.message === 'string' ? payload.message : undefined;
      const stableSymbol = typeof payload.stableSymbol === 'string' ? payload.stableSymbol : undefined;

      if (status === 'success') {
        const flowModeValue = normalizedFlowMode ?? 'cross-chain';
        const transferTx = typeof payload.transferTx === 'string' ? payload.transferTx : txHash;

        finish({
          status: 'success',
          flowMode: flowModeValue,
          network,
          networkLabel,
          targetNetwork,
          targetChainId,
          sourceChainId,
          stableSymbol,
          transferTx,
          registryTx,
          proofTx,
          proofId,
          completionId,
          contract,
          amount,
          goatAccount,
          sessionId,
          txHash,
        });
      } else if (status === 'pending') {
        finish({
          status: 'pending',
          message,
          network,
          networkLabel,
          stableSymbol,
          flowMode: normalizedFlowMode,
        });
      } else {
        finish({
          status: 'error',
          message: message || 'NuOrbit checkout failed.',
          network,
          networkLabel,
          stableSymbol,
          flowMode: normalizedFlowMode,
        });
      }
    };

    window.addEventListener('message', onMessage);

    closeTimer = window.setInterval(() => {
      if (popup.closed) {
        finish({
          status: 'cancelled',
          message: 'NuOrbit checkout popup closed before completion.',
        });
      }
    }, 600);
  });

  const handle: NuorbitCheckoutHandle = {
    popup,
    result: resultPromise,
    close() {
      try {
        popup.close();
      } catch {
        /* ignore close errors */
      }
    },
    focus() {
      try {
        popup.focus();
      } catch {
        /* ignore focus errors */
      }
    },
  };

  return handle;
}
