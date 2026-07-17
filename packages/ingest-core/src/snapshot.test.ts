import { describe, expect, it } from 'vitest';

import { finalizeParseOutcome } from './finalize.js';
import {
  SNAPSHOT_VERSION,
  SNAPSHOT_WRITE_ORDER,
  createSnapshotManifest,
  createSourceSnapshot,
  deserializeSnapshot,
  serializeSnapshot,
} from './snapshot.js';
import { SYNTHETIC_CONTEXT, syntheticAlert, syntheticOutcome } from './test-helpers.js';

describe('content-addressed snapshot contract with synthetic data', () => {
  it('round-trips a versioned payload and manifest with manifest-last ordering', () => {
    const finalized = finalizeParseOutcome(
      syntheticOutcome([syntheticAlert('synthetic-snapshot')]),
      SYNTHETIC_CONTEXT,
    );
    expect(finalized.accepted).toBe(true);
    if (!finalized.accepted) return;

    const source = createSourceSnapshot(finalized.batch);
    const manifest = createSnapshotManifest('2026-07-17T12:01:00Z', [
      {
        sourceId: source.sourceId,
        observedAt: source.observedAt,
        alertCount: source.alertCount,
        mappingApplied: source.mappingApplied,
        diagnosticCounts: source.diagnosticCounts,
        contentUrl: `/data/alerts/v1/${source.sourceId}/${'a'.repeat(64)}.json`,
        sha256: 'a'.repeat(64),
      },
    ]);

    expect(deserializeSnapshot(serializeSnapshot(source))).toEqual(source);
    expect(deserializeSnapshot(serializeSnapshot(manifest))).toEqual(manifest);
    expect(source.version).toBe(SNAPSHOT_VERSION);
    expect(manifest).toMatchObject({
      version: SNAPSHOT_VERSION,
      publication: { order: 'manifest-last' },
    });
    expect(SNAPSHOT_WRITE_ORDER).toEqual(['source-snapshot', 'manifest']);
  });

  it('rejects an unknown snapshot version', () => {
    expect(() =>
      deserializeSnapshot(
        JSON.stringify({ version: 2, kind: 'manifest', generatedAt: '2026-07-17T12:00:00Z' }),
      ),
    ).toThrow(/version/);
  });
});
