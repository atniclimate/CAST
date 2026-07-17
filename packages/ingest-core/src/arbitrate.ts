import type { AlertSourceStatus, AlertStore, CommitResult } from '@ewm/alerts-schema/store';
import type { StatusState } from '@ewm/core-status';

import type { AlertBatch, ParseContext, ParseFailure, ParseOutcome } from './contracts.js';
import { finalizeParseOutcome } from './finalize.js';
import { classifyFreshness } from './freshness.js';

export type IngestTransport = 'direct' | 'origin-snapshot' | 'cache';
export type ArbitrationAction =
  'committed' | 'kept-last-good' | 'marked-unavailable' | 'committed-then-marked-unavailable';

export interface ArbitrateBatchInput {
  readonly store: AlertStore;
  readonly context: ParseContext;
  readonly outcome: ParseOutcome;
  readonly now: Date;
  readonly transport: IngestTransport;
  /** Transport that produced data already held by the store, when known. */
  readonly lastGoodTransport?: IngestTransport;
  /** True when this cache candidate is being used after an origin refresh failure. */
  readonly refreshFailed?: boolean;
  readonly generation?: number;
}

export interface BatchArbitrationResult {
  readonly action: ArbitrationAction;
  readonly sourceId: string;
  readonly storeStatus: AlertSourceStatus;
  readonly coreStatus: StatusState;
  readonly asOf: string | null;
  readonly failures: readonly ParseFailure[];
  readonly batch?: AlertBatch;
  readonly storeResult?: CommitResult;
}

function retainedStatus(
  asOf: string,
  now: Date,
  failed: boolean,
): Pick<BatchArbitrationResult, 'storeStatus' | 'coreStatus'> {
  const freshness = classifyFreshness(asOf, now);
  if (freshness === 'stale') return { storeStatus: 'stale', coreStatus: 'stale' };
  if (freshness === 'fresh') {
    return { storeStatus: 'fresh', coreStatus: failed ? 'degraded' : 'live' };
  }
  return { storeStatus: 'unavailable', coreStatus: 'unavailable' };
}

function markUnavailable(
  input: ArbitrateBatchInput,
  failures: readonly ParseFailure[],
): BatchArbitrationResult {
  const storeResult = input.store.markSourceUnavailable(input.context.source.id, input.generation);
  if (!storeResult.accepted) {
    const current = input.store.getSnapshot().sources[input.context.source.id];
    const asOf = current?.asOf ?? null;
    const storeStatus = current?.status ?? 'unavailable';
    return {
      action: 'kept-last-good',
      sourceId: input.context.source.id,
      storeStatus,
      coreStatus:
        storeStatus === 'fresh' ? 'live' : storeStatus === 'stale' ? 'stale' : 'unavailable',
      asOf,
      failures,
      storeResult,
    };
  }
  return {
    action: 'marked-unavailable',
    sourceId: input.context.source.id,
    storeStatus: 'unavailable',
    coreStatus: 'unavailable',
    asOf: null,
    failures,
    storeResult,
  };
}

/**
 * Atomically commits only a complete, provenance-valid, usable, newer batch. Otherwise it
 * retains usable last-good data or marks the source unavailable without clearing its alerts.
 */
export function arbitrateBatch(input: ArbitrateBatchInput): BatchArbitrationResult {
  const finalized = finalizeParseOutcome(input.outcome, input.context);
  const source = input.store.getSnapshot().sources[input.context.source.id];
  const lastGoodAsOf = source?.asOf ?? null;

  if (!finalized.accepted) {
    if (lastGoodAsOf === null || classifyFreshness(lastGoodAsOf, input.now) === 'unavailable') {
      return markUnavailable(input, finalized.failures);
    }
    if (input.lastGoodTransport === 'cache') {
      const storeResult = input.store.markSourceUnavailable(
        input.context.source.id,
        input.generation,
      );
      if (!storeResult.accepted) {
        const current = input.store.getSnapshot().sources[input.context.source.id];
        const storeStatus = current?.status ?? 'unavailable';
        return {
          action: 'kept-last-good',
          sourceId: input.context.source.id,
          storeStatus,
          coreStatus:
            storeStatus === 'fresh' ? 'live' : storeStatus === 'stale' ? 'stale' : 'unavailable',
          asOf: current?.asOf ?? null,
          failures: finalized.failures,
          storeResult,
        };
      }
      return {
        action: 'marked-unavailable',
        sourceId: input.context.source.id,
        storeStatus: 'unavailable',
        coreStatus: 'cached',
        asOf: lastGoodAsOf,
        failures: finalized.failures,
        storeResult,
      };
    }
    return {
      action: 'kept-last-good',
      sourceId: input.context.source.id,
      ...retainedStatus(lastGoodAsOf, input.now, true),
      asOf: lastGoodAsOf,
      failures: finalized.failures,
    };
  }

  const candidateFreshness = classifyFreshness(finalized.batch.observedAt, input.now);
  if (candidateFreshness === 'unavailable') {
    const failures = Object.freeze([
      {
        code: 'candidate-too-old',
        message: `Candidate observation "${finalized.batch.observedAt}" is older than 72 hours`,
      },
    ]);
    if (lastGoodAsOf !== null && classifyFreshness(lastGoodAsOf, input.now) !== 'unavailable') {
      return {
        action: 'kept-last-good',
        sourceId: input.context.source.id,
        ...retainedStatus(lastGoodAsOf, input.now, false),
        asOf: lastGoodAsOf,
        failures,
      };
    }
    return markUnavailable(input, failures);
  }

  if (lastGoodAsOf !== null && Date.parse(finalized.batch.observedAt) <= Date.parse(lastGoodAsOf)) {
    return {
      action: 'kept-last-good',
      sourceId: input.context.source.id,
      ...retainedStatus(lastGoodAsOf, input.now, false),
      asOf: lastGoodAsOf,
      failures: Object.freeze([]),
    };
  }

  const storeResult = input.store.commitSource(
    input.context.source.id,
    finalized.batch.alerts,
    finalized.batch.observedAt,
    input.generation,
  );
  if (!storeResult.accepted) {
    const current = input.store.getSnapshot().sources[input.context.source.id];
    const asOf = current?.asOf ?? null;
    const storeStatus = current?.status ?? 'unavailable';
    return {
      action: 'kept-last-good',
      sourceId: input.context.source.id,
      storeStatus,
      coreStatus:
        storeStatus === 'fresh' ? 'live' : storeStatus === 'stale' ? 'stale' : 'unavailable',
      asOf,
      failures: Object.freeze([
        { code: 'stale-generation', message: 'Store rejected an older source generation' },
      ]),
      storeResult,
    };
  }
  if (input.transport === 'cache' && input.refreshFailed === true) {
    const unavailableResult = input.store.markSourceUnavailable(
      input.context.source.id,
      input.generation,
    );
    return {
      action: 'committed-then-marked-unavailable',
      sourceId: input.context.source.id,
      storeStatus: 'unavailable',
      coreStatus: 'cached',
      asOf: finalized.batch.observedAt,
      failures: Object.freeze([]),
      batch: finalized.batch,
      storeResult: unavailableResult,
    };
  }

  return {
    action: 'committed',
    sourceId: input.context.source.id,
    storeStatus: candidateFreshness,
    coreStatus:
      input.transport === 'cache' ? 'cached' : candidateFreshness === 'fresh' ? 'live' : 'stale',
    asOf: finalized.batch.observedAt,
    failures: Object.freeze([]),
    batch: finalized.batch,
    storeResult,
  };
}
