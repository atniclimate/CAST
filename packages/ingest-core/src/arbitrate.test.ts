import { createAlertStore } from '@ewm/alerts-schema/store';
import { describe, expect, it } from 'vitest';

import { arbitrateBatch } from './arbitrate.js';
import { ECCC_MIXED_ACTIVE_COHORT_FAILURE } from './finalize.js';
import { FRESHNESS_POLICY } from './freshness.js';
import { SYNTHETIC_CONTEXT, syntheticAlert, syntheticOutcome } from './test-helpers.js';

const NOW = new Date('2026-07-17T12:00:00Z');

function store() {
  return createAlertStore({
    requiredSources: [
      { sourceId: SYNTHETIC_CONTEXT.source.id, freshForMs: FRESHNESS_POLICY.freshForMs },
    ],
    now: () => NOW.getTime(),
  });
}

describe('all-or-last-good batch arbitration with synthetic fixtures', () => {
  it('never commits a partial batch', () => {
    const alertStore = store();
    const result = arbitrateBatch({
      store: alertStore,
      context: SYNTHETIC_CONTEXT,
      outcome: syntheticOutcome([syntheticAlert()], {
        completeness: 'rejected',
        failures: [
          {
            code: 'synthetic-malformed-item',
            message: 'Synthetic second item is malformed',
            itemIndex: 1,
          },
        ],
      }),
      now: NOW,
      transport: 'direct',
    });

    expect(result.action).toBe('marked-unavailable');
    expect(alertStore.getSnapshot().alerts).toEqual([]);
    expect(alertStore.getSnapshot().sources[SYNTHETIC_CONTEXT.source.id]?.status).toBe(
      'unavailable',
    );
  });

  it('retains a usable last-good batch when a replacement is rejected', () => {
    const alertStore = store();
    const retained = syntheticAlert('synthetic-retained');
    alertStore.commitSource(SYNTHETIC_CONTEXT.source.id, [retained], '2026-07-17T11:50:00Z');

    const result = arbitrateBatch({
      store: alertStore,
      context: SYNTHETIC_CONTEXT,
      outcome: syntheticOutcome([], {
        completeness: 'rejected',
        failures: [{ code: 'synthetic-truncated', message: 'Synthetic collection was truncated' }],
      }),
      now: NOW,
      transport: 'direct',
      lastGoodTransport: 'origin-snapshot',
    });

    expect(result).toMatchObject({
      action: 'kept-last-good',
      storeStatus: 'fresh',
      coreStatus: 'degraded',
      asOf: '2026-07-17T11:50:00Z',
    });
    expect(alertStore.getSnapshot().alerts.map(({ alertId }) => alertId)).toEqual([
      retained.alertId,
    ]);
  });

  it('applies fail-and-last-good to a synthetic ECCC mixed active cohort failure', () => {
    const alertStore = store();
    const retained = syntheticAlert('synthetic-eccc-last-good');
    alertStore.commitSource(SYNTHETIC_CONTEXT.source.id, [retained], '2026-07-17T11:50:00Z');

    const result = arbitrateBatch({
      store: alertStore,
      context: SYNTHETIC_CONTEXT,
      outcome: syntheticOutcome([syntheticAlert('synthetic-incompatible-cohort')], {
        completeness: 'rejected',
        failures: [
          {
            code: ECCC_MIXED_ACTIVE_COHORT_FAILURE,
            message: 'Synthetic CAP contains incompatible active cohorts',
          },
        ],
      }),
      now: NOW,
      transport: 'origin-snapshot',
    });

    expect(result.action).toBe('kept-last-good');
    expect(alertStore.getSnapshot().alerts.map(({ alertId }) => alertId)).toEqual([
      retained.alertId,
    ]);
  });

  it('marks a source unavailable when its retained data is past 72 hours', () => {
    const alertStore = store();
    const retained = syntheticAlert('synthetic-expired-last-good');
    alertStore.commitSource(SYNTHETIC_CONTEXT.source.id, [retained], '2026-07-14T11:59:59Z');

    const result = arbitrateBatch({
      store: alertStore,
      context: SYNTHETIC_CONTEXT,
      outcome: syntheticOutcome([], {
        completeness: 'rejected',
        failures: [{ code: 'synthetic-source-failure', message: 'Synthetic source failure' }],
      }),
      now: NOW,
      transport: 'direct',
    });

    expect(result).toMatchObject({
      action: 'marked-unavailable',
      storeStatus: 'unavailable',
      coreStatus: 'unavailable',
    });
    expect(alertStore.getSnapshot().alerts).toHaveLength(1);
    expect(alertStore.getSnapshot().sources[SYNTHETIC_CONTEXT.source.id]).toMatchObject({
      status: 'unavailable',
      alertCount: 1,
    });
    expect(alertStore.getSnapshot().quietEligible).toBe(false);
  });

  it('encodes cache retention after refresh failure as cached but unavailable to quiet mode', () => {
    const alertStore = store();
    const result = arbitrateBatch({
      store: alertStore,
      context: SYNTHETIC_CONTEXT,
      outcome: syntheticOutcome([syntheticAlert('synthetic-cache')]),
      now: NOW,
      transport: 'cache',
      refreshFailed: true,
    });

    expect(result).toMatchObject({
      action: 'committed-then-marked-unavailable',
      storeStatus: 'unavailable',
      coreStatus: 'cached',
    });
    expect(alertStore.getSnapshot().sources[SYNTHETIC_CONTEXT.source.id]).toMatchObject({
      status: 'unavailable',
      alertCount: 1,
    });
  });

  it('does not report a stale source generation as committed', () => {
    const alertStore = store();
    const staleGeneration = alertStore.beginSourceUpdate(SYNTHETIC_CONTEXT.source.id);
    alertStore.beginSourceUpdate(SYNTHETIC_CONTEXT.source.id);

    const result = arbitrateBatch({
      store: alertStore,
      context: SYNTHETIC_CONTEXT,
      outcome: syntheticOutcome([syntheticAlert('synthetic-stale-generation')]),
      now: NOW,
      transport: 'direct',
      generation: staleGeneration,
    });

    expect(result).toMatchObject({
      action: 'kept-last-good',
      storeStatus: 'unavailable',
      coreStatus: 'unavailable',
      storeResult: { accepted: false, reason: 'stale-generation' },
    });
    expect(alertStore.getSnapshot().alerts).toEqual([]);
  });
});
