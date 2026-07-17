import { describe, expect, it } from 'vitest';
import type { NormalizedAlert } from '../model.js';
import { createAlertStore } from './index.js';

function alert(alertId: string): NormalizedAlert {
  return {
    alertId,
    eventId: alertId,
    sourceId: 'nws',
    sent: '2026-07-17T12:00:00Z',
    messageType: 'alert',
    references: [],
    lifecycleState: 'active',
    event: 'Flood Warning',
    originalDesignation: 'Flood Warning',
    band: 'severe',
    posture: 'act-now',
    confidence: 'likely',
    effective: '2026-07-17T12:00:00Z',
    expires: null,
    geometry: null,
    sourceLanguage: {
      'en-US': { headline: 'Flood Warning', description: 'Flooding is expected.' },
    },
    translationAuthority: 'National Weather Service',
    provenance: {
      agency: 'nws',
      originalId: alertId.replace('nws:', ''),
      fetchedAt: '2026-07-17T12:00:00Z',
      mappingApplied: { name: 'atni-cast-nws-cap', version: '1.0.0' },
      coverage: { geometryBasis: 'zone', geocodes: ['WAZ001'] },
    },
  };
}

describe('alert store', () => {
  it('rejects a stale generation without changing the atomic source snapshot', () => {
    const store = createAlertStore({
      requiredSources: [{ sourceId: 'nws', freshForMs: 60_000 }],
      now: () => Date.parse('2026-07-17T12:00:30Z'),
    });
    const staleGeneration = store.beginSourceUpdate('nws');
    const currentGeneration = store.beginSourceUpdate('nws');

    expect(
      store.commitSource('nws', [alert('nws:stale')], '2026-07-17T12:00:00Z', staleGeneration),
    ).toEqual({ accepted: false, generation: currentGeneration, reason: 'stale-generation' });
    expect(store.getSnapshot().alerts).toEqual([]);

    expect(
      store.commitSource('nws', [alert('nws:current')], '2026-07-17T12:00:00Z', currentGeneration),
    ).toEqual({ accepted: true, generation: currentGeneration });
    expect(store.getSnapshot().alerts.map(({ alertId }) => alertId)).toEqual(['nws:current']);
  });

  it('does not allow quiet mode with an unavailable or stale required source', () => {
    let time = Date.parse('2026-07-17T12:00:00Z');
    const store = createAlertStore({
      requiredSources: [{ sourceId: 'nws', freshForMs: 60_000 }],
      now: () => time,
    });

    expect(store.getSnapshot()).toMatchObject({ alerts: [], quietEligible: false });
    expect(store.getSnapshot().sources.nws?.status).toBe('unavailable');

    store.commitSource('nws', [], '2026-07-17T12:00:00Z');
    expect(store.getSnapshot().quietEligible).toBe(true);

    time = Date.parse('2026-07-17T12:01:01Z');
    expect(store.getSnapshot().sources.nws?.status).toBe('stale');
    expect(store.getSnapshot().quietEligible).toBe(false);
  });

  it('publishes cached, deeply immutable snapshots detached from caller input', () => {
    const store = createAlertStore({ requiredSources: [] });
    const input = alert('nws:immutable');
    store.commitSource('nws', [input], '2026-07-17T12:00:00Z');

    const first = store.getSnapshot();
    const second = store.getSnapshot();
    expect(second).toBe(first);
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(first.alerts)).toBe(true);
    expect(Object.isFrozen(first.alerts[0]?.sourceLanguage['en-US'])).toBe(true);

    input.sourceLanguage['en-US']!.headline = 'Mutated outside the store';
    expect(first.alerts[0]?.sourceLanguage['en-US']?.headline).toBe('Flood Warning');
    expect(() => {
      (first.alerts as NormalizedAlert[]).push(alert('nws:mutation'));
    }).toThrow();
  });
});
