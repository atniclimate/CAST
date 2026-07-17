import { describe, expect, it } from 'vitest';

import { finalizeParseOutcome } from './finalize.js';
import { SYNTHETIC_CONTEXT, syntheticAlert, syntheticOutcome } from './test-helpers.js';

describe('finalization with synthetic messages', () => {
  it('rejects missing provenance as first-class failures', () => {
    const valid = syntheticAlert('synthetic-bad-provenance');
    const invalid = {
      ...valid,
      provenance: undefined as never,
    };

    const result = finalizeParseOutcome(syntheticOutcome([invalid]), SYNTHETIC_CONTEXT);

    expect(result.accepted).toBe(false);
    if (!result.accepted) {
      expect(result.failures.map(({ code }) => code)).toContain('missing-provenance');
    }
  });

  it('delegates one synthetic update chain to the shared lifecycle resolver', () => {
    const original = syntheticAlert('synthetic-original', '2026-07-17T10:00:00Z');
    const update = syntheticAlert('synthetic-update', '2026-07-17T11:00:00Z', 'update', [
      'synthetic-original',
    ]);

    const result = finalizeParseOutcome(syntheticOutcome([original, update]), SYNTHETIC_CONTEXT);

    expect(result.accepted).toBe(true);
    if (result.accepted) {
      expect(result.batch.alerts).toHaveLength(1);
      expect(result.batch.alerts[0]).toMatchObject({
        alertId: 'nws:synthetic-update',
        eventId: 'nws:synthetic-original',
        lifecycleState: 'active',
      });
      expect(result.batch.lifecycle.events[0]?.tombstones).toEqual([
        {
          alertId: 'nws:synthetic-original',
          eventId: 'nws:synthetic-original',
          sent: '2026-07-17T10:00:00Z',
          state: 'superseded',
          replacedByAlertId: 'nws:synthetic-update',
        },
      ]);
    }
  });

  it('reports a malformed synthetic message timestamp without calling lifecycle', () => {
    const valid = syntheticAlert('synthetic-bad-sent');
    const invalid = { ...valid, sent: 'not-a-timestamp' };

    const result = finalizeParseOutcome(syntheticOutcome([invalid]), SYNTHETIC_CONTEXT);

    expect(result.accepted).toBe(false);
    if (!result.accepted) {
      expect(result.failures).toContainEqual(
        expect.objectContaining({ code: 'invalid-message-timestamp', itemIndex: 0 }),
      );
    }
  });
});
