import { createAlertId, type MappingApplied, type NormalizedAlert } from '@ewm/alerts-schema';

import type { AlertBatch } from './contracts.js';

export const SNAPSHOT_VERSION = 1 as const;

/** Bodies must be published before the manifest that makes them discoverable. */
export const SNAPSHOT_WRITE_ORDER = Object.freeze(['source-snapshot', 'manifest'] as const);

export interface SnapshotMetadata {
  readonly sourceId: string;
  readonly observedAt: string;
  readonly sourceUpdatedAt?: string;
  readonly alertCount: number;
  readonly mappingApplied: MappingApplied;
  readonly diagnosticCounts: Readonly<Record<string, number>>;
}

export interface SourceSnapshot extends SnapshotMetadata {
  readonly version: typeof SNAPSHOT_VERSION;
  readonly kind: 'source-snapshot';
  readonly alerts: readonly NormalizedAlert[];
}

export interface SnapshotManifestEntry extends SnapshotMetadata {
  readonly contentUrl: string;
  readonly sha256: string;
}

export interface SnapshotManifest {
  readonly version: typeof SNAPSHOT_VERSION;
  readonly kind: 'manifest';
  readonly generatedAt: string;
  readonly sources: readonly SnapshotManifestEntry[];
  /**
   * A writer publishes every content-addressed source body first and this manifest last.
   * The literal makes the publication discipline visible to readers and future writers.
   */
  readonly publication: {
    readonly order: 'manifest-last';
  };
}

export type SnapshotDocument = SourceSnapshot | SnapshotManifest;

function diagnosticCounts(batch: AlertBatch): Readonly<Record<string, number>> {
  const counts: Record<string, number> = {};
  for (const diagnostic of batch.diagnostics)
    counts[diagnostic.code] = (counts[diagnostic.code] ?? 0) + 1;
  return Object.freeze(counts);
}

export function createSourceSnapshot(batch: AlertBatch): SourceSnapshot {
  const snapshot: SourceSnapshot = {
    version: SNAPSHOT_VERSION,
    kind: 'source-snapshot',
    sourceId: batch.sourceId,
    observedAt: batch.observedAt,
    alertCount: batch.alerts.length,
    mappingApplied: Object.freeze({ ...batch.mappingApplied }),
    diagnosticCounts: diagnosticCounts(batch),
    alerts: Object.freeze([...batch.alerts]),
    ...(batch.sourceUpdatedAt === undefined ? {} : { sourceUpdatedAt: batch.sourceUpdatedAt }),
  };
  assertSourceSnapshot(snapshot);
  return Object.freeze(snapshot);
}

export function createSnapshotManifest(
  generatedAt: string,
  sources: readonly SnapshotManifestEntry[],
): SnapshotManifest {
  const manifest: SnapshotManifest = {
    version: SNAPSHOT_VERSION,
    kind: 'manifest',
    generatedAt,
    sources: Object.freeze(sources.map((entry) => Object.freeze({ ...entry }))),
    publication: Object.freeze({ order: 'manifest-last' }),
  };
  assertSnapshotManifest(manifest);
  return Object.freeze(manifest);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requireRecord(value: unknown, label: string): Record<string, unknown> {
  if (!isRecord(value)) throw new Error(`${label} must be an object`);
  return value;
}

function requireString(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.trim() === '')
    throw new Error(`${label} must be a non-empty string`);
  return value;
}

function requireTimestamp(value: unknown, label: string): string {
  const timestamp = requireString(value, label);
  if (Number.isNaN(Date.parse(timestamp)))
    throw new Error(`${label} must be a parseable timestamp`);
  return timestamp;
}

function requireStringArray(value: unknown, label: string): readonly string[] {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array of strings`);
  const strings: string[] = [];
  for (const item of value as unknown[]) {
    if (typeof item !== 'string') throw new Error(`${label} must be an array of strings`);
    strings.push(item);
  }
  return strings;
}

function requireEnum(value: unknown, allowed: readonly string[], label: string): void {
  if (typeof value !== 'string' || !allowed.includes(value)) {
    throw new Error(`${label} must be one of ${allowed.join(', ')}`);
  }
}

function assertMapping(value: unknown, label: string): void {
  const mapping = requireRecord(value, label);
  requireString(mapping.name, `${label}.name`);
  requireString(mapping.version, `${label}.version`);
}

function assertMetadata(record: Record<string, unknown>, label: string): void {
  requireString(record.sourceId, `${label}.sourceId`);
  requireTimestamp(record.observedAt, `${label}.observedAt`);
  if (record.sourceUpdatedAt !== undefined)
    requireTimestamp(record.sourceUpdatedAt, `${label}.sourceUpdatedAt`);
  if (!Number.isInteger(record.alertCount) || (record.alertCount as number) < 0) {
    throw new Error(`${label}.alertCount must be a non-negative integer`);
  }
  assertMapping(record.mappingApplied, `${label}.mappingApplied`);
  const counts = requireRecord(record.diagnosticCounts, `${label}.diagnosticCounts`);
  for (const [code, count] of Object.entries(counts)) {
    if (code.trim() === '' || !Number.isInteger(count) || (count as number) < 0) {
      throw new Error(`${label}.diagnosticCounts must contain non-negative integers`);
    }
  }
}

function assertAlert(value: unknown, index: number): void {
  const label = `source snapshot alert ${index}`;
  const alert = requireRecord(value, label);
  for (const field of [
    'alertId',
    'eventId',
    'sourceId',
    'sent',
    'event',
    'originalDesignation',
    'effective',
    'translationAuthority',
  ] as const) {
    requireString(alert[field], `${label}.${field}`);
  }
  requireTimestamp(alert.sent, `${label}.sent`);
  requireTimestamp(alert.effective, `${label}.effective`);
  if (alert.onset !== undefined) requireTimestamp(alert.onset, `${label}.onset`);
  if (alert.expires !== null) requireTimestamp(alert.expires, `${label}.expires`);
  requireStringArray(alert.references, `${label}.references`);
  requireEnum(alert.messageType, ['alert', 'update', 'cancel'], `${label}.messageType`);
  requireEnum(
    alert.lifecycleState,
    ['active', 'superseded', 'cancelled', 'expired'],
    `${label}.lifecycleState`,
  );
  requireEnum(alert.band, ['extreme', 'severe', 'moderate', 'minor', 'unstated'], `${label}.band`);
  requireEnum(alert.posture, ['act-now', 'prepare', 'monitor', 'ended'], `${label}.posture`);
  requireEnum(
    alert.confidence,
    ['observed', 'likely', 'possible', 'unknown'],
    `${label}.confidence`,
  );
  if (alert.geometry !== null) requireRecord(alert.geometry, `${label}.geometry`);

  const language = requireRecord(alert.sourceLanguage, `${label}.sourceLanguage`);
  if (Object.keys(language).length === 0)
    throw new Error(`${label}.sourceLanguage must not be empty`);
  for (const [tag, blockValue] of Object.entries(language)) {
    const block = requireRecord(blockValue, `${label}.sourceLanguage.${tag}`);
    requireString(block.headline, `${label}.sourceLanguage.${tag}.headline`);
    requireString(block.description, `${label}.sourceLanguage.${tag}.description`);
    if (block.instruction !== undefined)
      requireString(block.instruction, `${label}.sourceLanguage.${tag}.instruction`);
  }

  const provenance = requireRecord(alert.provenance, `${label}.provenance`);
  const agency = requireString(provenance.agency, `${label}.provenance.agency`);
  const originalId = requireString(provenance.originalId, `${label}.provenance.originalId`);
  if (alert.alertId !== createAlertId(agency, originalId)) {
    throw new Error(`${label}.alertId does not match its provenance identity`);
  }
  requireTimestamp(provenance.fetchedAt, `${label}.provenance.fetchedAt`);
  assertMapping(provenance.mappingApplied, `${label}.provenance.mappingApplied`);
  const coverage = requireRecord(provenance.coverage, `${label}.provenance.coverage`);
  requireEnum(
    coverage.geometryBasis,
    ['polygon', 'zone', 'point', 'none'],
    `${label}.provenance.coverage.geometryBasis`,
  );
  requireStringArray(coverage.geocodes, `${label}.provenance.coverage.geocodes`);
}

function assertVersionAndKind(
  record: Record<string, unknown>,
  kind: SnapshotDocument['kind'],
): void {
  if (record.version !== SNAPSHOT_VERSION) {
    throw new Error(`Unsupported snapshot version "${String(record.version)}"`);
  }
  if (record.kind !== kind) throw new Error(`Snapshot kind must be "${kind}"`);
}

export function assertSourceSnapshot(value: unknown): asserts value is SourceSnapshot {
  const record = requireRecord(value, 'source snapshot');
  assertVersionAndKind(record, 'source-snapshot');
  assertMetadata(record, 'source snapshot');
  if (!Array.isArray(record.alerts)) throw new Error('source snapshot alerts must be an array');
  record.alerts.forEach(assertAlert);
  if (record.alertCount !== record.alerts.length) {
    throw new Error('source snapshot alertCount does not match alerts length');
  }
  for (const [index, valueAlert] of record.alerts.entries()) {
    const alert = valueAlert as Record<string, unknown>;
    if (alert.sourceId !== record.sourceId) {
      throw new Error(`source snapshot alert ${index} has a different sourceId`);
    }
    const provenance = alert.provenance as Record<string, unknown>;
    const mapping = provenance.mappingApplied as Record<string, unknown>;
    const snapshotMapping = record.mappingApplied as Record<string, unknown>;
    if (mapping.name !== snapshotMapping.name || mapping.version !== snapshotMapping.version) {
      throw new Error(`source snapshot alert ${index} has a different mapping version`);
    }
  }
}

export function assertSnapshotManifest(value: unknown): asserts value is SnapshotManifest {
  const record = requireRecord(value, 'snapshot manifest');
  assertVersionAndKind(record, 'manifest');
  requireTimestamp(record.generatedAt, 'snapshot manifest.generatedAt');
  const publication = requireRecord(record.publication, 'snapshot manifest.publication');
  if (publication.order !== 'manifest-last') {
    throw new Error('snapshot manifest publication order must be manifest-last');
  }
  if (!Array.isArray(record.sources)) throw new Error('snapshot manifest sources must be an array');
  const ids = new Set<string>();
  for (const [index, valueEntry] of record.sources.entries()) {
    const entry = requireRecord(valueEntry, `snapshot manifest source ${index}`);
    assertMetadata(entry, `snapshot manifest source ${index}`);
    const sourceId = requireString(entry.sourceId, `snapshot manifest source ${index}.sourceId`);
    if (ids.has(sourceId)) throw new Error(`snapshot manifest repeats source "${sourceId}"`);
    ids.add(sourceId);
    requireString(entry.contentUrl, `snapshot manifest source ${index}.contentUrl`);
    const sha256 = requireString(entry.sha256, `snapshot manifest source ${index}.sha256`);
    if (!/^[a-f0-9]{64}$/.test(sha256)) {
      throw new Error(`snapshot manifest source ${index}.sha256 must be lowercase SHA-256 hex`);
    }
  }
}

export function serializeSnapshot(document: SnapshotDocument): string {
  if (document.kind === 'source-snapshot') assertSourceSnapshot(document);
  else assertSnapshotManifest(document);
  return `${JSON.stringify(document)}\n`;
}

export function deserializeSnapshot(json: string): SnapshotDocument {
  let value: unknown;
  try {
    value = JSON.parse(json);
  } catch (error) {
    throw new Error('Snapshot JSON is malformed', { cause: error });
  }
  const record = requireRecord(value, 'snapshot document');
  if (record.kind === 'source-snapshot') {
    assertSourceSnapshot(record);
    return record;
  }
  if (record.kind === 'manifest') {
    assertSnapshotManifest(record);
    return record;
  }
  throw new Error(`Unknown snapshot kind "${String(record.kind)}"`);
}
