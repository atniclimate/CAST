import type { AlertSourceStatus } from '@ewm/alerts-schema/store';
import type { FreshnessPolicy, StatusState } from '@ewm/core-status';

export const FRESHNESS_POLICY = Object.freeze({
  freshForMs: 15 * 60 * 1_000,
  usableForMs: 72 * 60 * 60 * 1_000,
}) satisfies FreshnessPolicy;

export type FreshnessBand = AlertSourceStatus;

export interface FreshnessStatusRow {
  readonly condition:
    | 'direct-complete-fresh'
    | 'snapshot-complete-fresh'
    | 'direct-failed-fresh-snapshot'
    | 'selected-stale-usable'
    | 'cached-fresh-refresh-failed'
    | 'no-usable-data';
  readonly storeAction: 'commit' | 'retain' | 'commit-then-mark-unavailable' | 'mark-unavailable';
  readonly storeStatus: AlertSourceStatus;
  readonly coreStatus: StatusState;
}

/** The binding table between the alert store's three states and core-status's five states. */
export const FRESHNESS_STATUS_TABLE: readonly FreshnessStatusRow[] = Object.freeze([
  Object.freeze({
    condition: 'direct-complete-fresh',
    storeAction: 'commit',
    storeStatus: 'fresh',
    coreStatus: 'live',
  }),
  Object.freeze({
    condition: 'snapshot-complete-fresh',
    storeAction: 'commit',
    storeStatus: 'fresh',
    coreStatus: 'live',
  }),
  Object.freeze({
    condition: 'direct-failed-fresh-snapshot',
    storeAction: 'retain',
    storeStatus: 'fresh',
    coreStatus: 'degraded',
  }),
  Object.freeze({
    condition: 'selected-stale-usable',
    storeAction: 'commit',
    storeStatus: 'stale',
    coreStatus: 'stale',
  }),
  Object.freeze({
    condition: 'cached-fresh-refresh-failed',
    storeAction: 'commit-then-mark-unavailable',
    storeStatus: 'unavailable',
    coreStatus: 'cached',
  }),
  Object.freeze({
    condition: 'no-usable-data',
    storeAction: 'mark-unavailable',
    storeStatus: 'unavailable',
    coreStatus: 'unavailable',
  }),
]);

/** Inclusive at both ratified edges: 15 minutes is fresh and 72 hours is stale. */
export function classifyFreshness(asOf: string, now: Date): FreshnessBand {
  const observed = Date.parse(asOf);
  if (Number.isNaN(observed)) {
    throw new Error(`asOf is not a parseable timestamp: "${asOf}"`);
  }
  if (Number.isNaN(now.getTime())) throw new Error('now is not a valid Date');
  const age = now.getTime() - observed;
  if (age <= FRESHNESS_POLICY.freshForMs) return 'fresh';
  if (age <= FRESHNESS_POLICY.usableForMs) return 'stale';
  return 'unavailable';
}
