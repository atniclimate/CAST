// All data in this file is FICTIONAL, used only to exercise the machinery
// (docs/DATA_SOVEREIGNTY.md: test data is fictional and labeled as such).
import { describe, expect, it } from 'vitest';

import {
  contactsForRender,
  EMPTY_TRIBAL_REGISTRY,
  hazardIsElevated,
  loadTribalRegistry,
  mayRenderT1,
  TribalRegistryError,
  type TribalNationRecord,
} from './index.js';

const fictionalNation: TribalNationRecord = {
  englishName: 'Fictional Example Nation',
  location: { latitude: 0, longitude: 0, state: 'WA', region: 'Test Region' },
  source: 'Fictional fixture, not a real record',
  idsDataTier: 'T1',
  hazardContext: { floodPlain: true, wildfireRisk: 'high', seismicZone: 'moderate', tsunamiZone: false },
  contact: { emergencyContact: { note: 'fictional legacy block' } },
  contacts: {
    website: 'https://example.invalid',
    emergencyManagement: { note: 'fictional' },
  },
};

/** One of the two legacy shapes the real file contains, fictionalized. */
const fictionalLegacyNation: TribalNationRecord = {
  englishName: 'Fictional Legacy-Shaped Nation',
  location: { latitude: 0, longitude: 0, state: 'BC' },
  boundingBox: { north: 1, south: 0, east: 1, west: 0 },
  crossBorder: false,
  hazardContext: { cascadiaZone: true, earthquakeRisk: 'high', floodRisk: 'low', tsunamiRisk: false },
  idsDataTier: 'T1',
  source: 'Fictional fixture, not a real record',
};

describe('tier gate', () => {
  it('renders no T1 when nothing is selected', () => {
    expect(mayRenderT1({ selectedNationId: null }, 'fictional-example')).toBe(false);
    expect(contactsForRender({ selectedNationId: null }, 'fictional-example', fictionalNation)).toBeNull();
  });

  it('renders no T1 for a different selection', () => {
    expect(mayRenderT1({ selectedNationId: 'other-nation' }, 'fictional-example')).toBe(false);
  });

  it('renders T1 with attribution only for the explicitly selected Nation', () => {
    const rendered = contactsForRender({ selectedNationId: 'fictional-example' }, 'fictional-example', fictionalNation);
    expect(rendered).not.toBeNull();
    expect(rendered?.attribution).toBe('Fictional fixture, not a real record');
    expect(rendered?.contacts?.emergencyManagement).toEqual({ note: 'fictional' });
    // The website is T0 and travels outside the gated block.
    expect('website' in (rendered?.contacts ?? {})).toBe(false);
  });

  it('gates the heterogeneous legacy contact block the same way', () => {
    expect(contactsForRender({ selectedNationId: null }, 'x', fictionalNation)).toBeNull();
    const rendered = contactsForRender({ selectedNationId: 'x' }, 'x', fictionalNation);
    expect(rendered?.legacyContact).toEqual({ emergencyContact: { note: 'fictional legacy block' } });
  });
});

describe('hazard flags (verified thresholds from the schema evidence report)', () => {
  it('elevated: boolean true, extreme, high, very-high', () => {
    expect(hazardIsElevated(true)).toBe(true);
    expect(hazardIsElevated('extreme')).toBe(true);
    expect(hazardIsElevated('high')).toBe(true);
    expect(hazardIsElevated('very-high')).toBe(true);
  });

  it('not elevated: moderate, low, false, absent', () => {
    expect(hazardIsElevated('moderate')).toBe(false);
    expect(hazardIsElevated('low')).toBe(false);
    expect(hazardIsElevated(false)).toBe(false);
    expect(hazardIsElevated('none')).toBe(false);
    expect(hazardIsElevated(undefined)).toBe(false);
    expect(hazardIsElevated(null)).toBe(false);
  });
});

describe('legacy-shape tolerance', () => {
  it('legacy records typecheck and pass through the loader', () => {
    const registry = loadTribalRegistry({
      version: '9.9.9',
      provenance: 'Fictional test authority statement',
      nations: { legacy: fictionalLegacyNation },
    });
    expect(registry.nations['legacy']?.crossBorder).toBe(false);
  });
});

describe('loader', () => {
  it('loads the empty placeholder without provenance requirements', () => {
    const registry = loadTribalRegistry({ nations: {} });
    expect(registry.nations).toEqual({});
    expect(registry.provenance).toBe(EMPTY_TRIBAL_REGISTRY.provenance);
  });

  it('refuses nation data without provenance', () => {
    expect(() =>
      loadTribalRegistry({ version: '9.9.9', nations: { 'fictional-example': fictionalNation } }),
    ).toThrow(TribalRegistryError);
  });

  it('refuses nation data without a version', () => {
    expect(() =>
      loadTribalRegistry({
        provenance: 'Fictional test authority statement',
        nations: { 'fictional-example': fictionalNation },
      }),
    ).toThrow(TribalRegistryError);
  });

  it('strips records above T1 and fails closed on unknown tiers', () => {
    const registry = loadTribalRegistry({
      version: '9.9.9',
      provenance: 'Fictional test authority statement',
      nations: {
        ok0: { ...fictionalNation, idsDataTier: 'T0' },
        ok1: { ...fictionalNation, idsDataTier: 'T1' },
        confidential: { ...fictionalNation, idsDataTier: 'T2' },
        sacred: { ...fictionalNation, idsDataTier: 'T3' },
        unlabeled: { ...fictionalNation, idsDataTier: undefined },
        garbled: { ...fictionalNation, idsDataTier: 'tier-unknown' },
      },
    });
    expect(Object.keys(registry.nations).sort()).toEqual(['ok0', 'ok1', 'unlabeled']);
  });
});
