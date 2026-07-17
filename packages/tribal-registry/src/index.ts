/**
 * Tribal registry: schema types, tier gate, and loader.
 *
 * This package ships the SHAPE of the Tribal Database and none of the data
 * (docs/DATA_SOVEREIGNTY.md; the data-location question is decision DS-014).
 * Deployments provide the dataset outside version control; the loader below
 * refuses data without provenance and strips anything above tier T1 before
 * it can enter the application.
 *
 * Types verified against the actual database file (v1.10.5, 112 Nations) by
 * the 07/17/2026 schema evidence report. Realities the types tolerate:
 * two legacy-shaped records (boundingBox as north/south/east/west,
 * crossBorder as literal false, divergent hazard keys), mixed enum and
 * boolean hazard values, and BOTH a heterogeneous singular `contact` block
 * (112/112) and a structured plural `contacts` block (88/112).
 *
 * Tier semantics: every v1.10.5 record carries idsDataTier "T1" as a
 * record-level classification. The APPLICATION rule is field-level: names,
 * locations, and hazard context are T0; contact information is T1 and
 * renders only through the gate below. Record-level idsDataTier drives the
 * loader's fail-closed admission check, not per-field rendering.
 */

// ---------------------------------------------------------------------------
// Data tiers (CARE Principles; see docs/DATA_SOVEREIGNTY.md)
// ---------------------------------------------------------------------------

/**
 * T0: public, no restrictions.
 * T1: attribution required; renders only for an explicitly selected Nation.
 * T2/T3: confidential/sacred — never enter this application in any form.
 */
export type DataTier = 'T0' | 'T1' | 'T2' | 'T3';

/** Tiers this application is permitted to hold at all. */
export const ADMISSIBLE_TIERS: readonly DataTier[] = ['T0', 'T1'];

// ---------------------------------------------------------------------------
// Schema types (verified 07/17/2026; optionality is presence-based)
// ---------------------------------------------------------------------------

export interface NationLocation {
  readonly latitude: number;
  readonly longitude: number;
  /** Two-letter code; the same field carries US states and BC. */
  readonly state: string;
  readonly region?: string;
  readonly coastal?: boolean;
  readonly coordinates?: { readonly latitude?: number; readonly longitude?: number; readonly note?: string };
}

export interface LatLngPoint {
  readonly latitude: number;
  readonly longitude: number;
}

/** 110/112 records use sw/ne (source "derived"); two legacy records use edges. */
export type NationBoundingBox =
  | { readonly sw: LatLngPoint; readonly ne: LatLngPoint; readonly source?: string }
  | { readonly north: number; readonly south: number; readonly east: number; readonly west: number };

export interface NationCrossBorderInfo {
  readonly flag?: boolean;
  readonly distanceToBorderKm?: number;
  readonly canadianNeighbors?: readonly string[];
  readonly usNeighbors?: readonly string[];
  readonly sharedWatersheds?: readonly string[];
}

/** Object in 110/112 records; literal false in the two legacy-shaped records. */
export type NationCrossBorder = NationCrossBorderInfo | false;

/** Verified enums; keep unions open to strings the next data version may add. */
export type SeismicZone = 'very-high' | 'high' | 'moderate' | 'low' | (string & {});
export type WildfireRisk = 'extreme' | 'high' | 'moderate' | 'low' | (string & {}) | boolean;

/**
 * Per-Nation hazard exposure profile. Drives SHIELD card weighting.
 * All fields optional: volcanicZone appears in only 18/112 records, and the
 * two legacy records carry the legacy keys instead.
 */
export interface HazardContext {
  readonly tsunamiZone?: boolean;
  readonly floodPlain?: boolean;
  readonly laharZone?: boolean;
  readonly atmosphericRiverExposure?: boolean;
  readonly stormSurgeExposure?: boolean;
  readonly volcanicZone?: boolean;
  readonly seismicZone?: SeismicZone;
  readonly wildfireRisk?: WildfireRisk;
  /** Legacy keys (two records): interpret through hazardIsElevated only. */
  readonly cascadiaZone?: boolean | string;
  readonly earthquakeRisk?: boolean | string;
  readonly floodRisk?: boolean | string;
  readonly tsunamiRisk?: boolean | string;
}

/** Structured T1 contact block (88/112). Never rendered without the tier gate. */
export interface NationContacts {
  /** Public website: treated as T0 (provisional classification, DS-014 review). */
  readonly website?: string;
  readonly leadership?: unknown;
  readonly generalContact?: unknown;
  readonly emergencyManagement?: unknown;
  readonly media?: unknown;
  readonly territory?: unknown;
}

export interface TribalNationRecord {
  readonly traditionalName?: string;
  readonly englishName: string;
  readonly displayFormat?: string;
  readonly alternateNames?: readonly string[];
  readonly meaning?: string | null;
  readonly language?: string;
  readonly languageFamily?: string;
  readonly languageSubgroup?: string | null;
  readonly location: NationLocation;
  readonly boundingBox?: NationBoundingBox;
  readonly crossBorder?: NationCrossBorder;
  readonly neighbors?: readonly string[];
  readonly watersheds?: readonly string[];
  readonly hazardContext?: HazardContext;
  readonly treaty?: string | null;
  readonly source?: string | null;
  readonly verificationStatus?: string;
  readonly lastVerified?: unknown;
  readonly idsDataTier?: DataTier | (string & {});
  /**
   * T1. The heterogeneous legacy contact block, present 112/112 and rich in
   * named people with direct phone/email. Renders only behind the tier gate.
   */
  readonly contact?: unknown;
  /** T1 (except website). The structured contact block, present 88/112. */
  readonly contacts?: NationContacts;
  readonly classification?: unknown;
  readonly environmentalPlanning?: unknown;
  readonly partnerships?: unknown;
  readonly federalAgencies?: unknown;
  readonly interTribalMemberships?: unknown;
  readonly federalStatus?: { readonly country?: 'Canada' | 'United States' | (string & {}) } & Record<string, unknown>;
  readonly parentNation?: string | null;
  readonly notes?: string;
}

export interface CrossBorderWatershed {
  readonly name: string;
  readonly countries: readonly string[];
  readonly usTribes?: readonly string[];
  readonly canadianNations?: readonly string[];
  readonly notes?: string;
}

export interface TreatyArea {
  readonly name: string;
  readonly signatories?: readonly string[];
  readonly cededTerritory?: string;
}

export interface TribalRegistry {
  readonly version: string;
  /**
   * Human-written declaration of the authority under which this dataset is
   * provided. Required: data without stated authority does not load.
   */
  readonly provenance: string;
  readonly nations: Readonly<Record<string, TribalNationRecord>>;
  /** Display name to nation ID (253 aliases in v1.10.5, all resolving). */
  readonly aliases: Readonly<Record<string, string>>;
  readonly crossBorderWatersheds: readonly CrossBorderWatershed[];
  readonly treatyAreas: Readonly<Record<string, TreatyArea>>;
}

/**
 * The placeholder every fresh deployment starts with: structurally valid,
 * semantically empty (the empty-placeholder pattern, docs/DATA_SOVEREIGNTY.md).
 */
export const EMPTY_TRIBAL_REGISTRY: TribalRegistry = {
  version: '0.0.0',
  provenance: 'Empty placeholder. No Tribal Nation data is present.',
  nations: {},
  aliases: {},
  crossBorderWatersheds: [],
  treatyAreas: {},
};

// ---------------------------------------------------------------------------
// Tier gate
// ---------------------------------------------------------------------------

/**
 * The tier check is a rendering-layer concern enforced in components, not
 * only in data plumbing. The question is always: "Is this specific Tribal
 * Nation currently selected by the user?" Selection is the user's explicit
 * action; geolocation, aggregate views, and search results never count.
 */
export interface TierSelectionContext {
  /** Nation ID the user has explicitly selected, or null. */
  readonly selectedNationId: string | null;
}

/** True only when the user has explicitly selected this exact Nation. */
export function mayRenderT1(ctx: TierSelectionContext, nationId: string): boolean {
  return ctx.selectedNationId !== null && ctx.selectedNationId === nationId;
}

/** T1 contact data paired with its mandatory attribution line. */
export interface AttributedContacts {
  /** The structured block (minus the T0 website), when present. */
  readonly contacts: Omit<NationContacts, 'website'> | null;
  /** The heterogeneous legacy block, when present. Same T1 handling applies. */
  readonly legacyContact: unknown;
  /** Attribution per the Tribal Database source field. Always displayed. */
  readonly attribution: string;
}

/**
 * The only sanctioned path to T1 contact data. Returns null unless the gate
 * passes; the returned value carries the attribution the component must show.
 * Covers BOTH contact blocks: the structured `contacts` and the legacy
 * `contact` (which also holds named people with direct phone/email).
 */
export function contactsForRender(
  ctx: TierSelectionContext,
  nationId: string,
  nation: TribalNationRecord,
): AttributedContacts | null {
  if (!mayRenderT1(ctx, nationId)) return null;
  if (nation.contacts === undefined && nation.contact === undefined) return null;
  let structured: Omit<NationContacts, 'website'> | null = null;
  if (nation.contacts !== undefined) {
    const { website: _website, ...t1 } = nation.contacts;
    structured = t1;
  }
  return {
    contacts: structured,
    legacyContact: nation.contact,
    attribution: nation.source ?? 'Attribution unavailable; source field missing.',
  };
}

/**
 * Interpreter for hazard exposure values, matching the verified thresholds
 * of the schema evidence report: boolean true, or the strings "extreme",
 * "high", and "very-high", count as elevated; "moderate", "low", and
 * everything else do not.
 */
export function hazardIsElevated(flag: boolean | string | null | undefined): boolean {
  if (flag === true) return true;
  if (typeof flag === 'string') {
    const v = flag.trim().toLowerCase();
    return v === 'extreme' || v === 'high' || v === 'very-high';
  }
  return false;
}

// ---------------------------------------------------------------------------
// Loader
// ---------------------------------------------------------------------------

export class TribalRegistryError extends Error {
  override readonly name = 'TribalRegistryError';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Load a registry dataset provided by the deployment.
 *
 * Structural gates, in order:
 * 1. Version and non-empty provenance are required whenever any nation is
 *    present — sovereign-shaped data without stated authority does not load.
 *    (The source file's own `metadata.version` is "1.10.5"; the deployment
 *    dataset carries `version` and `provenance` at its root.)
 * 2. Records marked above T1 (idsDataTier T2/T3, or unrecognized tier values,
 *    which fail closed) are stripped before the registry exists in memory.
 *    No schema, field, or placeholder for T2/T3 survives loading. In
 *    v1.10.5 every record is marked "T1", so all admit; the strip is the
 *    permanent safety net for future data versions.
 */
export function loadTribalRegistry(raw: unknown): TribalRegistry {
  if (!isRecord(raw)) {
    throw new TribalRegistryError('Registry data must be an object.');
  }
  const nations = isRecord(raw['nations']) ? raw['nations'] : {};
  const nationCount = Object.keys(nations).length;

  const version = typeof raw['version'] === 'string' ? raw['version'] : '';
  const provenance = typeof raw['provenance'] === 'string' ? raw['provenance'].trim() : '';

  if (nationCount > 0) {
    if (version === '') {
      throw new TribalRegistryError('Registry with nation data must declare its version.');
    }
    if (provenance === '') {
      throw new TribalRegistryError(
        'Registry with nation data must declare provenance: a human-written statement of the authority under which it is provided.',
      );
    }
  }

  const admitted: Record<string, TribalNationRecord> = {};
  for (const [id, entry] of Object.entries(nations)) {
    if (!isRecord(entry)) continue;
    const tier = typeof entry['idsDataTier'] === 'string' ? entry['idsDataTier'].toUpperCase() : 'T0';
    if (tier !== 'T0' && tier !== 'T1') continue; // fail closed: unknown tiers do not load
    admitted[id] = entry as unknown as TribalNationRecord;
  }

  return {
    version: version === '' ? EMPTY_TRIBAL_REGISTRY.version : version,
    provenance: provenance === '' ? EMPTY_TRIBAL_REGISTRY.provenance : provenance,
    nations: admitted,
    aliases: isRecord(raw['aliases']) ? (raw['aliases'] as Record<string, string>) : {},
    crossBorderWatersheds: Array.isArray(raw['crossBorderWatersheds'])
      ? (raw['crossBorderWatersheds'] as CrossBorderWatershed[])
      : [],
    treatyAreas: isRecord(raw['treatyAreas']) ? (raw['treatyAreas'] as Record<string, TreatyArea>) : {},
  };
}
