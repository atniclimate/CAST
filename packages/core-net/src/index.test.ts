import { describe, expect, it } from 'vitest';
import { createStatusRegistry } from '@ewm/core-status';
import { fetchWithPolicy, trackedFetch, NetError } from './index.js';

/** A fetch stub that returns queued results in order, recording each attempt. */
function fetchStub(
  results: Array<Response | Error | 'hang'>,
): { impl: typeof fetch; attempts: () => number } {
  let calls = 0;
  const impl: typeof fetch = (_input, init) => {
    const result = results[Math.min(calls, results.length - 1)];
    calls += 1;
    if (result === 'hang') {
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () =>
          reject(new DOMException('The operation was aborted.', 'AbortError')),
        );
      });
    }
    if (result instanceof Error) {
      return Promise.reject(result);
    }
    return Promise.resolve(result as Response);
  };
  return { impl, attempts: () => calls };
}

const ok = () => new Response('ok', { status: 200 });
const http = (status: number) => new Response('err', { status });
const FAST = { retryDelayMs: 0, timeoutMs: 50 };

describe('fetchWithPolicy', () => {
  it('resolves on first success', async () => {
    const stub = fetchStub([ok()]);
    const response = await fetchWithPolicy('https://example.test/a', {}, {
      ...FAST,
      fetchImpl: stub.impl,
    });
    expect(response.ok).toBe(true);
    expect(stub.attempts()).toBe(1);
  });

  it('retries 5xx responses and succeeds', async () => {
    const stub = fetchStub([http(503), http(503), ok()]);
    const response = await fetchWithPolicy('https://example.test/a', {}, {
      ...FAST,
      retries: 2,
      fetchImpl: stub.impl,
    });
    expect(response.ok).toBe(true);
    expect(stub.attempts()).toBe(3);
  });

  it('throws a typed http error when retries are exhausted', async () => {
    const stub = fetchStub([http(503)]);
    const error = await fetchWithPolicy('https://example.test/a', {}, {
      ...FAST,
      retries: 1,
      fetchImpl: stub.impl,
    }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(NetError);
    expect((error as NetError).kind).toBe('http');
    expect((error as NetError).status).toBe(503);
    expect(stub.attempts()).toBe(2);
  });

  it('does not retry 4xx responses — they will not get better', async () => {
    const stub = fetchStub([http(404)]);
    const error = await fetchWithPolicy('https://example.test/a', {}, {
      ...FAST,
      retries: 3,
      fetchImpl: stub.impl,
    }).catch((e: unknown) => e);
    expect((error as NetError).kind).toBe('http');
    expect((error as NetError).status).toBe(404);
    expect(stub.attempts()).toBe(1);
  });

  it('retries network errors', async () => {
    const stub = fetchStub([new TypeError('fetch failed'), ok()]);
    const response = await fetchWithPolicy('https://example.test/a', {}, {
      ...FAST,
      retries: 1,
      fetchImpl: stub.impl,
    });
    expect(response.ok).toBe(true);
    expect(stub.attempts()).toBe(2);
  });

  it('turns a hung request into a timeout error', async () => {
    const stub = fetchStub(['hang']);
    const error = await fetchWithPolicy('https://example.test/slow', {}, {
      retryDelayMs: 0,
      retries: 0,
      timeoutMs: 20,
      fetchImpl: stub.impl,
    }).catch((e: unknown) => e);
    expect((error as NetError).kind).toBe('timeout');
  });

  it('honors caller aborts without retrying', async () => {
    const controller = new AbortController();
    const stub = fetchStub(['hang']);
    const pending = fetchWithPolicy('https://example.test/a', {}, {
      ...FAST,
      retries: 5,
      signal: controller.signal,
      fetchImpl: stub.impl,
    }).catch((e: unknown) => e);
    controller.abort();
    const error = await pending;
    expect((error as NetError).kind).toBe('aborted');
    expect(stub.attempts()).toBe(1);
  });
});

describe('trackedFetch', () => {
  it('reports live with an asOf timestamp on success', async () => {
    const status = createStatusRegistry();
    status.register('layer');
    const stub = fetchStub([ok()]);
    await trackedFetch(status, 'layer', 'https://example.test/a', {}, {
      ...FAST,
      fetchImpl: stub.impl,
    });
    const snapshot = status.get('layer');
    expect(snapshot.state).toBe('live');
    expect(snapshot.asOf).not.toBeNull();
  });

  it('reports degraded and preserves the old asOf when a refresh fails', async () => {
    const status = createStatusRegistry();
    status.register('layer');
    status.report('layer', { state: 'live', asOf: '2026-07-14T10:00:00Z' });
    const stub = fetchStub([http(500)]);
    await expect(
      trackedFetch(status, 'layer', 'https://example.test/a', {}, {
        ...FAST,
        retries: 0,
        fetchImpl: stub.impl,
      }),
    ).rejects.toThrow();
    const snapshot = status.get('layer');
    expect(snapshot.state).toBe('degraded');
    expect(snapshot.asOf).toBe('2026-07-14T10:00:00Z');
  });

  it('reports unavailable when there was never any data', async () => {
    const status = createStatusRegistry();
    status.register('layer');
    const stub = fetchStub([http(500)]);
    await expect(
      trackedFetch(status, 'layer', 'https://example.test/a', {}, {
        ...FAST,
        retries: 0,
        fetchImpl: stub.impl,
      }),
    ).rejects.toThrow();
    expect(status.get('layer').state).toBe('unavailable');
  });
});
