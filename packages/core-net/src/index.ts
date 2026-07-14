/**
 * @ewm/core-net — the one way EWM talks to the network.
 *
 * Every fetch is abortable, has a timeout, and retries transient failures with
 * backoff. `trackedFetch` additionally reports honest outcomes into the
 * status registry so no layer can fail silently.
 *
 * Framework-agnostic: vanilla TypeScript; depends only on @ewm/core-status.
 */

import type { StatusRegistry } from '@ewm/core-status';

export type NetErrorKind = 'timeout' | 'aborted' | 'http' | 'network';

export class NetError extends Error {
  readonly kind: NetErrorKind;
  /** HTTP status code, present when kind is 'http'. */
  readonly status?: number;

  constructor(kind: NetErrorKind, message: string, status?: number) {
    super(message);
    this.name = 'NetError';
    this.kind = kind;
    if (status !== undefined) {
      this.status = status;
    }
  }
}

export interface FetchPolicy {
  /** Per-attempt timeout. Default 10 000 ms. */
  timeoutMs?: number;
  /** Retries after the first attempt (total attempts = retries + 1). Default 2. */
  retries?: number;
  /** Base backoff delay, doubled per retry. Default 500 ms; 0 disables waiting. */
  retryDelayMs?: number;
  /** Caller-owned cancellation. External aborts are never retried. */
  signal?: AbortSignal;
  /** Injection point for tests. Defaults to globalThis.fetch. */
  fetchImpl?: typeof fetch;
}

const TIMEOUT_REASON = 'ewm-timeout';

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new NetError('aborted', 'aborted while waiting to retry'));
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

async function attemptOnce(
  url: string,
  init: RequestInit,
  timeoutMs: number,
  external: AbortSignal | undefined,
  fetchImpl: typeof fetch,
): Promise<Response> {
  if (external?.aborted) {
    throw new NetError('aborted', `request to ${url} was aborted before it started`);
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(TIMEOUT_REASON), timeoutMs);
  const onExternalAbort = () => controller.abort();
  external?.addEventListener('abort', onExternalAbort, { once: true });
  try {
    return await fetchImpl(url, { ...init, signal: controller.signal });
  } catch (error) {
    if (controller.signal.aborted && controller.signal.reason === TIMEOUT_REASON) {
      throw new NetError('timeout', `request to ${url} timed out after ${timeoutMs} ms`);
    }
    if (external?.aborted) {
      throw new NetError('aborted', `request to ${url} was aborted by the caller`);
    }
    const message = error instanceof Error ? error.message : String(error);
    throw new NetError('network', `request to ${url} failed: ${message}`);
  } finally {
    clearTimeout(timer);
    external?.removeEventListener('abort', onExternalAbort);
  }
}

/**
 * Fetch with per-attempt timeout and retry-with-backoff.
 *
 * Retries: network errors, timeouts, and 5xx responses.
 * Never retried: caller aborts and 4xx responses (they will not get better).
 * Resolves only with `response.ok`; anything else becomes a typed NetError.
 */
export async function fetchWithPolicy(
  url: string,
  init: RequestInit = {},
  policy: FetchPolicy = {},
): Promise<Response> {
  const {
    timeoutMs = 10_000,
    retries = 2,
    retryDelayMs = 500,
    signal,
    fetchImpl = globalThis.fetch,
  } = policy;

  let lastError: NetError = new NetError('network', `request to ${url} was never attempted`);

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    if (attempt > 0) {
      await sleep(retryDelayMs * 2 ** (attempt - 1), signal);
    }
    try {
      const response = await attemptOnce(url, init, timeoutMs, signal, fetchImpl);
      if (response.ok) {
        return response;
      }
      const httpError = new NetError(
        'http',
        `request to ${url} returned HTTP ${response.status}`,
        response.status,
      );
      if (response.status >= 500) {
        lastError = httpError;
        continue;
      }
      throw httpError;
    } catch (error) {
      const netError =
        error instanceof NetError
          ? error
          : new NetError('network', error instanceof Error ? error.message : String(error));
      if (netError.kind === 'aborted') {
        throw netError;
      }
      if (netError.kind === 'http' && netError.status !== undefined && netError.status < 500) {
        throw netError;
      }
      lastError = netError;
    }
  }

  throw lastError;
}

/**
 * `fetchWithPolicy` that reports its outcome into the status registry.
 *
 * - Success → `live`, `asOf` = receipt time. Callers holding a better data
 *   timestamp (e.g. a product issuance time from the payload) should re-report.
 * - Failure with older data still on screen (a previous `asOf` exists) →
 *   `degraded`, previous `asOf` preserved: the map still shows *something*,
 *   and the user is owed its true age.
 * - Failure with nothing to show → `unavailable`.
 */
export async function trackedFetch(
  status: StatusRegistry,
  statusId: string,
  url: string,
  init: RequestInit = {},
  policy: FetchPolicy = {},
): Promise<Response> {
  try {
    const response = await fetchWithPolicy(url, init, policy);
    status.report(statusId, {
      state: 'live',
      asOf: new Date().toISOString(),
      detail: `fetched ${url}`,
    });
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const previous = status.get(statusId);
    if (previous.asOf !== null) {
      status.report(statusId, {
        state: 'degraded',
        asOf: previous.asOf,
        detail: `refresh failed: ${message}`,
      });
    } else {
      status.report(statusId, {
        state: 'unavailable',
        asOf: null,
        detail: message,
      });
    }
    throw error;
  }
}
