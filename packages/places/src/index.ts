/**
 * @ewm/places — the boundary/place engine and the sovereign
 * empty-placeholder pattern.
 *
 * Platform invariant #6: Tribal boundaries, community indicators, and any
 * Nation-specific data ship as EMPTY, documented placeholder structures.
 * Each deploying Nation populates its own deployment, at deploy time, from
 * data it controls. This repository never bundles, fetches, or phones home
 * sovereign data. See docs/DATA_SOVEREIGNTY.md.
 *
 * Framework-agnostic: vanilla TypeScript; only a GeoJSON type dependency.
 */

import type { Geometry } from 'geojson';

export type PlaceKind = 'nation' | 'community' | 'region' | 'point-of-interest';

const PLACE_KINDS: readonly PlaceKind[] = ['nation', 'community', 'region', 'point-of-interest'];

export interface PlaceRecord {
  /** Deployment-scoped unique id. The deploying organization owns this namespace. */
  id: string;
  name: string;
  kind: PlaceKind;
  /** WGS84 geometry, or null for places tracked without a published boundary. */
  geometry: Geometry | null;
  /**
   * Community-defined indicator values. The schema of this object is owned by
   * the deploying Nation; the platform treats it as opaque and never
   * interprets, aggregates, or transmits it.
   */
  indicators?: Record<string, unknown>;
}

export const PLACES_SCHEMA_VERSION = 1;

/**
 * The deploy-time dataset a deploying organization provides.
 *
 * `provenance` is a required, human-written statement of the authority under
 * which this data is published (e.g. "Published by <Nation> GIS office,
 * approved <date>"). A dataset that contains places but no provenance is
 * rejected — attribution without authority is how sovereign data gets
 * mishandled.
 */
export interface PlacesDataset {
  schemaVersion: typeof PLACES_SCHEMA_VERSION;
  provenance: string;
  places: PlaceRecord[];
}

/**
 * The placeholder this repository ships: structurally valid, semantically empty.
 * Deployments replace it with their own dataset outside version control
 * (convention: `places.local.json`, which is gitignored).
 */
export const EMPTY_PLACES_DATASET: PlacesDataset = {
  schemaVersion: PLACES_SCHEMA_VERSION,
  provenance:
    'PLACEHOLDER — this deployment has not loaded any place data. ' +
    'See docs/DATA_SOVEREIGNTY.md for how a deploying Nation provides its own.',
  places: [],
};

export interface PlaceEngine {
  list(): PlaceRecord[];
  get(id: string): PlaceRecord | undefined;
  byKind(kind: PlaceKind): PlaceRecord[];
  size(): number;
  /** The provenance statement of the loaded dataset. */
  provenance(): string;
}

export class PlacesValidationError extends Error {
  readonly problems: string[];
  constructor(problems: string[]) {
    super(`invalid places dataset: ${problems.join('; ')}`);
    this.name = 'PlacesValidationError';
    this.problems = problems;
  }
}

/**
 * Validate a candidate dataset. Returns a list of problems; empty means valid.
 */
export function validatePlacesDataset(candidate: unknown): string[] {
  const problems: string[] = [];
  if (typeof candidate !== 'object' || candidate === null) {
    return ['dataset must be an object'];
  }
  const dataset = candidate as Partial<PlacesDataset>;

  if (dataset.schemaVersion !== PLACES_SCHEMA_VERSION) {
    problems.push(`schemaVersion must be ${PLACES_SCHEMA_VERSION}`);
  }
  if (!Array.isArray(dataset.places)) {
    problems.push('places must be an array');
    return problems;
  }
  const hasData = dataset.places.length > 0;
  if (hasData && (typeof dataset.provenance !== 'string' || dataset.provenance.trim() === '')) {
    problems.push(
      'a dataset containing places requires a non-empty provenance statement — ' +
        'sovereign data must carry its publishing authority',
    );
  }
  const seen = new Set<string>();
  dataset.places.forEach((place, index) => {
    const where = `places[${index}]`;
    if (typeof place !== 'object' || place === null) {
      problems.push(`${where} must be an object`);
      return;
    }
    if (typeof place.id !== 'string' || place.id.trim() === '') {
      problems.push(`${where}.id must be a non-empty string`);
    } else if (seen.has(place.id)) {
      problems.push(`${where}.id "${place.id}" is duplicated`);
    } else {
      seen.add(place.id);
    }
    if (typeof place.name !== 'string' || place.name.trim() === '') {
      problems.push(`${where}.name must be a non-empty string`);
    }
    if (!PLACE_KINDS.includes(place.kind)) {
      problems.push(`${where}.kind must be one of ${PLACE_KINDS.join(', ')}`);
    }
    if (place.geometry !== null && typeof place.geometry?.type !== 'string') {
      problems.push(`${where}.geometry must be null or a GeoJSON geometry`);
    }
  });
  return problems;
}

/**
 * Build a PlaceEngine from a validated dataset. Throws PlacesValidationError
 * on problems — a deployment must fail loudly rather than run with data it
 * cannot vouch for.
 */
export function loadPlacesDataset(candidate: unknown): PlaceEngine {
  const problems = validatePlacesDataset(candidate);
  if (problems.length > 0) {
    throw new PlacesValidationError(problems);
  }
  const dataset = candidate as PlacesDataset;
  const byId = new Map(dataset.places.map((place) => [place.id, place]));
  return {
    list: () => [...byId.values()],
    get: (id) => byId.get(id),
    byKind: (kind) => [...byId.values()].filter((place) => place.kind === kind),
    size: () => byId.size,
    provenance: () => dataset.provenance,
  };
}

/** The engine every fresh deployment starts with: valid, documented, empty. */
export function createEmptyPlaceEngine(): PlaceEngine {
  return loadPlacesDataset(EMPTY_PLACES_DATASET);
}
