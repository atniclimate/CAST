/**
 * The closed vocabulary of hazards the platform understands.
 *
 * Grouping into modules is a product decision, not a schema one — the
 * contract only needs a stable vocabulary so surfaces, alerts, and briefings
 * can be cross-referenced across modules. Extend deliberately; renames are
 * breaking changes for every module and every saved URL.
 */
export type HazardKind =
  // Drought module (existing DDM)
  | 'drought'
  | 'extreme-heat'
  | 'wildfire'
  // Hydro module
  | 'flood'
  | 'atmospheric-river'
  | 'heavy-precipitation'
  // Winter module
  | 'blizzard'
  | 'snow'
  | 'ice'
  // Severe module
  | 'tornado'
  | 'high-wind'
  | 'hail';

export const HAZARD_KINDS: readonly HazardKind[] = [
  'drought',
  'extreme-heat',
  'wildfire',
  'flood',
  'atmospheric-river',
  'heavy-precipitation',
  'blizzard',
  'snow',
  'ice',
  'tornado',
  'high-wind',
  'hail',
] as const;
