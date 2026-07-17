import { describe, expect, it } from 'vitest';

import { FRESHNESS_POLICY, FRESHNESS_STATUS_TABLE, classifyFreshness } from './freshness.js';

describe('DS-009 freshness boundaries', () => {
  const now = new Date('2026-07-17T12:00:00Z');

  it('treats the 15-minute edge as fresh and the next millisecond as stale', () => {
    expect(classifyFreshness('2026-07-17T11:45:00.000Z', now)).toBe('fresh');
    expect(classifyFreshness('2026-07-17T11:44:59.999Z', now)).toBe('stale');
  });

  it('treats the 72-hour edge as stale and the next millisecond as unavailable', () => {
    expect(classifyFreshness('2026-07-14T12:00:00.000Z', now)).toBe('stale');
    expect(classifyFreshness('2026-07-14T11:59:59.999Z', now)).toBe('unavailable');
  });

  it('exports one complete binding table for all five core states and three store states', () => {
    expect(FRESHNESS_POLICY).toEqual({ freshForMs: 900_000, usableForMs: 259_200_000 });
    expect(new Set(FRESHNESS_STATUS_TABLE.map(({ coreStatus }) => coreStatus))).toEqual(
      new Set(['live', 'cached', 'stale', 'degraded', 'unavailable']),
    );
    expect(new Set(FRESHNESS_STATUS_TABLE.map(({ storeStatus }) => storeStatus))).toEqual(
      new Set(['fresh', 'stale', 'unavailable']),
    );
  });
});
