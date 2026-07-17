import type { NormalizedAlert } from '../model.js';

export interface RequiredAlertSource {
  sourceId: string;
  /** Maximum age of the source `asOf` timestamp while it remains fresh. */
  freshForMs: number;
}

export interface AlertStoreConfig {
  requiredSources: readonly RequiredAlertSource[];
  /** Injectable clock for deterministic tests. */
  now?: () => number;
}

export type AlertSourceStatus = 'fresh' | 'stale' | 'unavailable';

export interface AlertSourceSnapshot {
  sourceId: string;
  status: AlertSourceStatus;
  generation: number;
  asOf: string | null;
  lastSuccessfulCommitAt: string | null;
  alertCount: number;
}

export interface AlertStoreSnapshot {
  generation: number;
  alerts: readonly NormalizedAlert[];
  activeAlerts: readonly NormalizedAlert[];
  sources: Readonly<Record<string, AlertSourceSnapshot>>;
  quietEligible: boolean;
}

export interface CommitAccepted {
  accepted: true;
  generation: number;
}

export interface CommitRejected {
  accepted: false;
  generation: number;
  reason: 'stale-generation';
}

export type CommitResult = CommitAccepted | CommitRejected;

export interface AlertStore {
  getSnapshot(): AlertStoreSnapshot;
  subscribe(listener: () => void): () => void;
  beginSourceUpdate(sourceId: string): number;
  commitSource(
    sourceId: string,
    alerts: readonly NormalizedAlert[],
    asOf: string,
    generation?: number,
  ): CommitResult;
  markSourceUnavailable(sourceId: string, generation?: number): CommitResult;
}

interface MutableSource {
  sourceId: string;
  freshForMs: number | null;
  required: boolean;
  unavailable: boolean;
  generation: number;
  asOf: string | null;
  lastSuccessfulCommitAt: string | null;
  alerts: readonly NormalizedAlert[];
}

function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function cloneAlert(alert: NormalizedAlert): NormalizedAlert {
  return deepFreeze(structuredClone(alert));
}

function parseTimestamp(value: string, label: string): number {
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) throw new Error(`${label} is not a parseable timestamp: "${value}"`);
  return parsed;
}

/** Creates a framework-agnostic external store suitable for React `useSyncExternalStore`. */
export function createAlertStore(config: AlertStoreConfig): AlertStore {
  const now = config.now ?? Date.now;
  const sources = new Map<string, MutableSource>();
  const listeners = new Set<() => void>();
  let snapshotGeneration = 0;

  for (const requirement of config.requiredSources) {
    if (requirement.sourceId.trim() === '') throw new Error('Required sourceId must not be empty');
    if (!Number.isFinite(requirement.freshForMs) || requirement.freshForMs < 0) {
      throw new Error(`Required source "${requirement.sourceId}" has invalid freshForMs`);
    }
    if (sources.has(requirement.sourceId)) {
      throw new Error(`Required source "${requirement.sourceId}" is configured more than once`);
    }
    sources.set(requirement.sourceId, {
      sourceId: requirement.sourceId,
      freshForMs: requirement.freshForMs,
      required: true,
      unavailable: true,
      generation: 0,
      asOf: null,
      lastSuccessfulCommitAt: null,
      alerts: Object.freeze([]),
    });
  }

  function getOrCreateSource(sourceId: string): MutableSource {
    if (sourceId.trim() === '') throw new Error('sourceId must not be empty');
    const existing = sources.get(sourceId);
    if (existing !== undefined) return existing;
    const created: MutableSource = {
      sourceId,
      freshForMs: null,
      required: false,
      unavailable: true,
      generation: 0,
      asOf: null,
      lastSuccessfulCommitAt: null,
      alerts: Object.freeze([]),
    };
    sources.set(sourceId, created);
    return created;
  }

  function sourceStatus(source: MutableSource, time: number): AlertSourceStatus {
    if (source.unavailable || source.asOf === null) return 'unavailable';
    if (source.freshForMs === null) return 'fresh';
    return time - parseTimestamp(source.asOf, `${source.sourceId} asOf`) <= source.freshForMs
      ? 'fresh'
      : 'stale';
  }

  function makeSnapshot(time: number): AlertStoreSnapshot {
    const allAlerts = [...sources.values()]
      .flatMap((source) => source.alerts)
      .sort((left, right) => left.alertId.localeCompare(right.alertId));
    const activeAlerts = allAlerts.filter(({ lifecycleState }) => lifecycleState === 'active');
    const sourceSnapshots: Record<string, AlertSourceSnapshot> = {};
    for (const source of sources.values()) {
      sourceSnapshots[source.sourceId] = deepFreeze({
        sourceId: source.sourceId,
        status: sourceStatus(source, time),
        generation: source.generation,
        asOf: source.asOf,
        lastSuccessfulCommitAt: source.lastSuccessfulCommitAt,
        alertCount: source.alerts.length,
      });
    }
    const everyRequiredSourceFresh = [...sources.values()].every(
      (source) => !source.required || sourceStatus(source, time) === 'fresh',
    );
    return deepFreeze({
      generation: snapshotGeneration,
      alerts: allAlerts,
      activeAlerts,
      sources: sourceSnapshots,
      quietEligible: activeAlerts.length === 0 && everyRequiredSourceFresh,
    });
  }

  let snapshot = makeSnapshot(now());

  function publish(): void {
    snapshotGeneration += 1;
    snapshot = makeSnapshot(now());
    for (const listener of [...listeners]) listener();
  }

  function refreshFreshness(): void {
    const time = now();
    const changed = Object.values(snapshot.sources).some((previous) => {
      const source = sources.get(previous.sourceId);
      return source !== undefined && previous.status !== sourceStatus(source, time);
    });
    if (changed) {
      snapshotGeneration += 1;
      snapshot = makeSnapshot(time);
    }
  }

  return {
    getSnapshot(): AlertStoreSnapshot {
      refreshFreshness();
      return snapshot;
    },

    subscribe(listener: () => void): () => void {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    beginSourceUpdate(sourceId: string): number {
      const source = getOrCreateSource(sourceId);
      source.generation += 1;
      return source.generation;
    },

    commitSource(
      sourceId: string,
      alerts: readonly NormalizedAlert[],
      asOf: string,
      generation?: number,
    ): CommitResult {
      const source = getOrCreateSource(sourceId);
      if (generation !== undefined && generation !== source.generation) {
        return { accepted: false, generation: source.generation, reason: 'stale-generation' };
      }
      parseTimestamp(asOf, `${sourceId} asOf`);

      for (const alert of alerts) {
        if (alert.sourceId !== sourceId) {
          throw new Error(
            `Alert "${alert.alertId}" belongs to source "${alert.sourceId}", not commit source "${sourceId}"`,
          );
        }
      }

      const nextAlerts = Object.freeze(alerts.map(cloneAlert));
      if (generation === undefined) source.generation += 1;
      source.alerts = nextAlerts;
      source.asOf = asOf;
      source.lastSuccessfulCommitAt = new Date(now()).toISOString();
      source.unavailable = false;
      publish();
      return { accepted: true, generation: source.generation };
    },

    markSourceUnavailable(sourceId: string, generation?: number): CommitResult {
      const source = getOrCreateSource(sourceId);
      if (generation !== undefined && generation !== source.generation) {
        return { accepted: false, generation: source.generation, reason: 'stale-generation' };
      }
      if (generation === undefined) source.generation += 1;
      source.unavailable = true;
      publish();
      return { accepted: true, generation: source.generation };
    },
  };
}
