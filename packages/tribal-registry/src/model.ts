/** Public-data tiers enforced at load and render boundaries. */
export type DataTier = 'T0' | 'T1' | 'T2' | 'T3';

export const ADMISSIBLE_TIERS: readonly DataTier[] = ['T0', 'T1'];

declare const nationIdBrand: unique symbol;
declare const geometryComponentIdBrand: unique symbol;

/** Opaque identifier assigned to one Nation identity and never reused. */
export type NationId = string & { readonly [nationIdBrand]: true };

/** Stable identifier assigned to one geometry component. */
export type GeometryComponentId = string & { readonly [geometryComponentIdBrand]: true };

export const NATION_ID_PATTERN = /^tn_[0-9a-f]{32}$/;
export const GEOMETRY_COMPONENT_ID_PATTERN = /^gc_[0-9a-f]{32}$/;

export interface NationIdSeed {
  readonly authorityNamespace: string;
  readonly publicFeatureIds: readonly string[];
}

export type IssuedNationStatus = 'active' | 'retired';

/** Persisted one-time issuance record. Seed fields are immutable snapshots. */
export interface IssuedNationRecord {
  readonly seedAuthorityNamespace: string;
  readonly seedFeatureIds: readonly string[];
  readonly issuedDate: string;
  readonly status: IssuedNationStatus;
}

export type NationIssuanceLedger = Readonly<Record<string, IssuedNationRecord>>;

export class InvalidNationIdSeedError extends Error {
  override readonly name = 'InvalidNationIdSeedError';
}

export class NationIdIssuanceError extends Error {
  override readonly name = 'NationIdIssuanceError';
}

export interface GeometryComponentIdSeed {
  readonly authorityNamespace: string;
  readonly sourceFeatureId: string;
}

function hash128(value: string): string {
  let h1 = 0x9e3779b9;
  let h2 = 0x243f6a88;
  let h3 = 0xb7e15162;
  let h4 = 0xdeadbeef;
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    h1 = Math.imul(h1 ^ code, 0x85ebca6b);
    h2 = Math.imul(h2 ^ code, 0xc2b2ae35);
    h3 = Math.imul(h3 ^ code, 0x27d4eb2f);
    h4 = Math.imul(h4 ^ code, 0x165667b1);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 0x85ebca6b) ^ h2;
  h2 = Math.imul(h2 ^ (h2 >>> 13), 0xc2b2ae35) ^ h3;
  h3 = Math.imul(h3 ^ (h3 >>> 16), 0x85ebca6b) ^ h4;
  h4 = Math.imul(h4 ^ (h4 >>> 13), 0xc2b2ae35) ^ h1;
  return [h1, h2, h3, h4].map((part) => (part >>> 0).toString(16).padStart(8, '0')).join('');
}

/**
 * Mint a geospatially seeded opaque Nation ID from public identifiers.
 *
 * This is a one-time minting operation. Persist the result permanently:
 * renames, redraws, source feature replacement, parcel changes, recognition
 * changes, and all subsequent geometry changes MUST NEVER recompute the ID.
 */
export function mintNationId(seed: NationIdSeed): NationId {
  const authorityNamespace = typeof seed?.authorityNamespace === 'string' ? seed.authorityNamespace.trim().toLowerCase() : '';
  if (authorityNamespace === '') throw new InvalidNationIdSeedError('Nation ID seed authorityNamespace must be non-empty.');
  if (!Array.isArray(seed?.publicFeatureIds) || seed.publicFeatureIds.length === 0) {
    throw new InvalidNationIdSeedError('Nation ID seed publicFeatureIds must contain at least one public feature ID.');
  }
  const featureIds = seed.publicFeatureIds.map((value) => (typeof value === 'string' ? value.trim() : ''));
  if (featureIds.some((value) => value === '')) {
    throw new InvalidNationIdSeedError('Nation ID seed publicFeatureIds must contain only non-empty strings.');
  }
  if (new Set(featureIds).size !== featureIds.length) {
    throw new InvalidNationIdSeedError('Nation ID seed publicFeatureIds must not contain duplicates.');
  }
  const canonicalSeed = `${authorityNamespace}\u001f${featureIds.sort().join('\u001e')}`;
  return `tn_${hash128(canonicalSeed)}` as NationId;
}

/** Issue and persist a new Nation ID. Existing active and retired IDs cannot be re-issued. */
export function issueNationId(
  ledger: NationIssuanceLedger,
  seed: NationIdSeed,
  issuedDate: string,
): { readonly nationId: NationId; readonly issuedNations: NationIssuanceLedger } {
  const nationId = mintNationId(seed);
  if (ledger[nationId] !== undefined) {
    throw new NationIdIssuanceError(`Nation ID ${nationId} has already been issued and cannot be re-used.`);
  }
  const seedAuthorityNamespace = seed.authorityNamespace.trim().toLowerCase();
  const seedFeatureIds = seed.publicFeatureIds.map((value) => value.trim()).sort();
  return {
    nationId,
    issuedNations: {
      ...ledger,
      [nationId]: { seedAuthorityNamespace, seedFeatureIds, issuedDate, status: 'active' },
    },
  };
}

/** Return a persisted ID without consulting current geometry or recomputing its seed. */
export function lookupIssuedNationId(ledger: NationIssuanceLedger, nationId: string): NationId {
  if (ledger[nationId] === undefined) {
    throw new NationIdIssuanceError(`Nation ID ${nationId} is not present in the issuance ledger.`);
  }
  return nationId as NationId;
}

/** Mint a stable component ID from the source feature's original identity. */
export function mintGeometryComponentId(seed: GeometryComponentIdSeed): GeometryComponentId {
  return `gc_${hash128(`${seed.authorityNamespace.trim().toLowerCase()}\u001f${seed.sourceFeatureId.trim()}`)}` as GeometryComponentId;
}

export interface Provenance {
  /** Identifier of the corresponding verified SourceRecord. */
  readonly sourceId: string;
  readonly citation: string;
  readonly retrievedDate: string;
  readonly verifiedDate: string;
}

export interface EffectiveDatedAttribute<T> {
  readonly value: T;
  readonly effectiveFrom: string;
  readonly effectiveTo?: string;
  readonly provenance: Provenance;
}

export interface NationName {
  readonly text: string;
  readonly kind: 'official' | 'display' | 'traditional';
  readonly language?: string;
}

export interface NationAlias {
  readonly text: string;
  readonly kind: 'alternate' | 'historical' | 'abbreviation' | 'search';
  readonly language?: string;
}

export interface NationLocation {
  readonly latitude: number;
  readonly longitude: number;
  /** Two-letter subdivision code, including US states and BC. */
  readonly subdivisionCode: string;
  readonly region?: string;
}

export interface HazardContext {
  readonly tsunamiZone?: boolean;
  readonly floodPlain?: boolean;
  readonly laharZone?: boolean;
  readonly atmosphericRiverExposure?: boolean;
  readonly stormSurgeExposure?: boolean;
  readonly volcanicZone?: boolean;
  readonly seismicZone?: string;
  readonly wildfireRisk?: string | boolean;
}

/** DS-015 public contact. It intentionally has no person-identity field. */
export interface RoleBasedContact {
  readonly office: string;
  readonly title: string;
  readonly publicPhone?: string;
  readonly publicEmail?: string;
  readonly website?: string;
  readonly source: string;
  readonly verifiedDate: string;
}

export interface NationEntity {
  readonly nationId: NationId;
  readonly status: 'active' | 'retired';
  readonly predecessorIds: readonly NationId[];
  readonly successorIds: readonly NationId[];
  readonly names: readonly EffectiveDatedAttribute<NationName>[];
  readonly aliases: readonly EffectiveDatedAttribute<NationAlias>[];
  readonly contacts: readonly RoleBasedContact[];
  readonly idsDataTier?: DataTier;
  readonly location?: NationLocation;
  readonly hazardContext?: HazardContext;
}

/** Backward-compatible package name for the now identity-aware record. */
export type TribalNationRecord = NationEntity;

export type Position = readonly [longitude: number, latitude: number];
export type LinearRing = readonly Position[];
export type PolygonCoordinates = readonly LinearRing[];

export type NationGeometry =
  | { readonly type: 'Polygon'; readonly coordinates: PolygonCoordinates }
  | { readonly type: 'MultiPolygon'; readonly coordinates: readonly PolygonCoordinates[] };

export interface GeometryLifecycle {
  readonly status: 'active' | 'retired' | 'replaced';
  readonly effectiveFrom: string;
  readonly effectiveTo?: string;
  readonly successorComponentIds: readonly GeometryComponentId[];
}

export interface GeometryComponent {
  readonly componentId: GeometryComponentId;
  /** Extensible authority namespace, for example census-aiannh or databc. */
  readonly authorityNamespace: string;
  readonly sourceFeatureId: string;
  readonly vintage: string;
  readonly geometry: NationGeometry;
  readonly lifecycle: GeometryLifecycle;
  readonly provenance: Provenance;
}

export type AssociationStatus = 'verified' | 'unresolved' | 'conflicting' | 'multi-nation';
export type ReviewStatus = 'pending' | 'reviewed' | 'escalated';

/** Many-to-many link. Neither side is treated as the other's identity. */
export interface NationGeometryAssociation {
  readonly nationId: NationId;
  readonly componentId: GeometryComponentId;
  readonly status: AssociationStatus;
  readonly reviewStatus: ReviewStatus;
  readonly provenance: Provenance;
  readonly notes?: string;
}

/** Records ambiguity and relatedness without ever merging entity identities. */
export interface NationRelationship {
  readonly relationshipId: string;
  readonly fromNationId: NationId;
  readonly toNationId: NationId;
  readonly kind: 'cross-border-counterpart' | 'same-name-distinct' | 'related-not-merged';
  readonly status: 'verified' | 'unresolved' | 'conflicting';
  readonly reviewStatus: ReviewStatus;
  readonly provenance: Provenance;
  readonly notes?: string;
}

export interface IdentityRedirect {
  /** Legacy or retired identifier originally requested by a client. */
  readonly fromId: string;
  /** One target for a rename/merge, multiple targets for a split. */
  readonly toIds: readonly string[];
  readonly reason: 'legacy-id' | 'merge' | 'split' | 'recognition-change';
  readonly effectiveDate: string;
  readonly provenance: Provenance;
}

export interface VersionedRedirectTable {
  readonly version: string;
  readonly entries: readonly IdentityRedirect[];
}

export interface SearchIndexEntry {
  readonly alias: string;
  readonly normalizedAlias: string;
  readonly nationId: NationId;
}

export interface TribalRegistry {
  readonly version: string;
  /** Human-written statement of the authority under which data is provided. */
  readonly provenance: string;
  readonly issuedNations: NationIssuanceLedger;
  readonly nations: Readonly<Record<string, NationEntity>>;
  readonly geometryComponents: Readonly<Record<string, GeometryComponent>>;
  readonly associations: readonly NationGeometryAssociation[];
  readonly relationships: readonly NationRelationship[];
  readonly redirects: VersionedRedirectTable;
  readonly searchIndex: readonly SearchIndexEntry[];
}

/** Structurally valid public placeholder. No Nation data is bundled yet. */
export const EMPTY_TRIBAL_REGISTRY: TribalRegistry = {
  version: '1.0.0',
  provenance: 'Empty public placeholder. No Tribal Nation data is present.',
  issuedNations: {},
  nations: {},
  geometryComponents: {},
  associations: [],
  relationships: [],
  redirects: { version: '1.0.0', entries: [] },
  searchIndex: [],
};
