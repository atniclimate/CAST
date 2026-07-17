import { describe, expect, it } from 'vitest';

import type { IngestParser } from './contracts.js';
import { replayCorpus } from './replay.js';
import { SYNTHETIC_CONTEXT, syntheticAlert, syntheticOutcome } from './test-helpers.js';

describe('corpus replay harness', () => {
  it('replays byte-exact synthetic fixture input below the supplied root path', async () => {
    const bytes = new TextEncoder().encode('{"originalId":"synthetic-replay"}\n');
    const parser: IngestParser<Uint8Array> = (payload) => {
      const parsed = JSON.parse(new TextDecoder().decode(payload)) as { originalId: string };
      return syntheticOutcome([syntheticAlert(parsed.originalId)]);
    };
    const seenPaths: string[] = [];

    const report = await replayCorpus(
      'C:\\fixtures\\ingest-nws',
      [
        {
          label: 'synthetic replay fixture',
          relativePath: 'synthetic\\alert.json',
          context: SYNTHETIC_CONTEXT,
          decode: (input) => input,
          expectedCompleteness: 'complete',
        },
      ],
      parser,
      (path) => {
        seenPaths.push(path);
        return Promise.resolve(bytes);
      },
    );

    expect(seenPaths).toEqual(['C:\\fixtures\\ingest-nws\\synthetic\\alert.json']);
    expect(report).toMatchObject({
      rootPath: 'C:\\fixtures\\ingest-nws',
      fixtureCount: 1,
      completeCount: 1,
      rejectedCount: 0,
      messageCount: 1,
      failureCount: 0,
    });
    expect(report.fixtures[0]).toMatchObject({
      byteLength: bytes.byteLength,
      messageCount: 1,
      finalizedAlertCount: 1,
    });
    expect(report.fixtures[0]?.inputSha256).toMatch(/^[a-f0-9]{64}$/);
  });
});
