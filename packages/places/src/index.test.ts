import { describe, expect, it } from 'vitest';
import {
  createEmptyPlaceEngine,
  EMPTY_PLACES_DATASET,
  loadPlacesDataset,
  PlacesValidationError,
  validatePlacesDataset,
  type PlacesDataset,
} from './index.js';

// Deliberately fictional test data. Real place data never enters this repo —
// see docs/DATA_SOVEREIGNTY.md.
const FICTIONAL: PlacesDataset = {
  schemaVersion: 1,
  provenance: 'Synthetic test fixture — fictional places, no real-world referent.',
  places: [
    {
      id: 'test-area-1',
      name: 'Example Placeholder Area',
      kind: 'region',
      geometry: { type: 'Point', coordinates: [0, 0] },
    },
    {
      id: 'test-poi-1',
      name: 'Example Point of Interest',
      kind: 'point-of-interest',
      geometry: null,
      indicators: { anything: 'the platform must treat this as opaque' },
    },
  ],
};

describe('createEmptyPlaceEngine', () => {
  it('starts valid, documented, and empty', () => {
    const engine = createEmptyPlaceEngine();
    expect(engine.size()).toBe(0);
    expect(engine.list()).toEqual([]);
    expect(engine.provenance()).toContain('PLACEHOLDER');
  });

  it('ships a placeholder dataset that passes its own validation', () => {
    expect(validatePlacesDataset(EMPTY_PLACES_DATASET)).toEqual([]);
  });
});

describe('loadPlacesDataset', () => {
  it('loads a valid dataset and answers lookups', () => {
    const engine = loadPlacesDataset(FICTIONAL);
    expect(engine.size()).toBe(2);
    expect(engine.get('test-area-1')?.name).toBe('Example Placeholder Area');
    expect(engine.byKind('point-of-interest').map((p) => p.id)).toEqual(['test-poi-1']);
    expect(engine.provenance()).toContain('Synthetic test fixture');
  });

  it('rejects a dataset with places but no provenance — the structural sovereignty gate', () => {
    const unattributed = { ...FICTIONAL, provenance: '   ' };
    expect(() => loadPlacesDataset(unattributed)).toThrow(PlacesValidationError);
    expect(() => loadPlacesDataset(unattributed)).toThrow(/provenance/);
  });

  it('rejects duplicate place ids', () => {
    const duplicated = {
      ...FICTIONAL,
      places: [FICTIONAL.places[0], FICTIONAL.places[0]],
    };
    expect(() => loadPlacesDataset(duplicated)).toThrow(/duplicated/);
  });

  it('rejects unknown kinds and malformed geometry', () => {
    const problems = validatePlacesDataset({
      schemaVersion: 1,
      provenance: 'test',
      places: [{ id: 'x', name: 'X', kind: 'galaxy', geometry: 42 }],
    });
    expect(problems.some((p) => p.includes('kind'))).toBe(true);
    expect(problems.some((p) => p.includes('geometry'))).toBe(true);
  });

  it('rejects wrong schema versions', () => {
    expect(validatePlacesDataset({ schemaVersion: 2, provenance: 'x', places: [] })).toEqual([
      'schemaVersion must be 1',
    ]);
  });
});
