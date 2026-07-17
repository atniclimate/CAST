import {
  GEOMETRY_COMPONENT_ID_PATTERN,
  NATION_ID_PATTERN,
  mintNationId,
  type EffectiveDatedAttribute,
  type IssuedNationRecord,
  type NationAlias,
  type NationName,
  type Provenance,
  type TribalRegistry,
} from './model.js';
import { buildSearchIndex, normalizeSearchAlias } from './search.js';

export interface RegistryValidationIssue {
  readonly path: string;
  readonly message: string;
}

export type RegistryValidationResult =
  | { readonly ok: true; readonly value: TribalRegistry }
  | { readonly ok: false; readonly errors: readonly RegistryValidationIssue[] };

export class TribalRegistryValidationError extends Error {
  override readonly name = 'TribalRegistryValidationError';

  constructor(readonly errors: readonly RegistryValidationIssue[]) {
    super(`Invalid Tribal registry:\n${errors.map(({ path, message }) => `- ${path}: ${message}`).join('\n')}`);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

class Validator {
  readonly errors: RegistryValidationIssue[] = [];

  issue(path: string, message: string): void {
    this.errors.push({ path, message });
  }

  object(value: unknown, path: string): Record<string, unknown> | null {
    if (!isRecord(value)) {
      this.issue(path, 'must be an object');
      return null;
    }
    return value;
  }

  exactKeys(value: Record<string, unknown>, path: string, allowed: readonly string[]): void {
    const allowedSet = new Set(allowed);
    for (const key of Object.keys(value)) {
      if (!allowedSet.has(key)) this.issue(`${path}.${key}`, 'is not an allowed field');
    }
  }

  string(value: unknown, path: string): value is string {
    if (typeof value !== 'string' || value.trim() === '') {
      this.issue(path, 'must be a non-empty string');
      return false;
    }
    return true;
  }

  enum(value: unknown, path: string, allowed: readonly string[]): value is string {
    if (typeof value !== 'string' || !allowed.includes(value)) {
      this.issue(path, `must be one of: ${allowed.join(', ')}`);
      return false;
    }
    return true;
  }

  array(value: unknown, path: string): readonly unknown[] | null {
    if (!Array.isArray(value)) {
      this.issue(path, 'must be an array');
      return null;
    }
    return value as readonly unknown[];
  }

  date(value: unknown, path: string): value is string {
    if (!this.string(value, path)) return false;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00Z`))) {
      this.issue(path, 'must be an ISO calendar date (YYYY-MM-DD)');
      return false;
    }
    return true;
  }
}

function validateProvenance(v: Validator, value: unknown, path: string): value is Provenance {
  const item = v.object(value, path);
  if (item === null) return false;
  v.exactKeys(item, path, ['sourceId', 'citation', 'retrievedDate', 'verifiedDate']);
  const sourceOk = v.string(item['sourceId'], `${path}.sourceId`);
  const citationOk = v.string(item['citation'], `${path}.citation`);
  const retrievedOk = v.date(item['retrievedDate'], `${path}.retrievedDate`);
  const verifiedOk = v.date(item['verifiedDate'], `${path}.verifiedDate`);
  return sourceOk && citationOk && retrievedOk && verifiedOk;
}

function validateNationName(v: Validator, value: unknown, path: string): value is NationName {
  const item = v.object(value, path);
  if (item === null) return false;
  v.exactKeys(item, path, ['text', 'kind', 'language']);
  const textOk = v.string(item['text'], `${path}.text`);
  const kindOk = v.enum(item['kind'], `${path}.kind`, ['official', 'display', 'traditional']);
  const languageOk = item['language'] === undefined || v.string(item['language'], `${path}.language`);
  return textOk && kindOk && languageOk;
}

function validateNationAlias(v: Validator, value: unknown, path: string): value is NationAlias {
  const item = v.object(value, path);
  if (item === null) return false;
  v.exactKeys(item, path, ['text', 'kind', 'language']);
  const textOk = v.string(item['text'], `${path}.text`);
  const kindOk = v.enum(item['kind'], `${path}.kind`, ['alternate', 'historical', 'abbreviation', 'search']);
  const languageOk = item['language'] === undefined || v.string(item['language'], `${path}.language`);
  return textOk && kindOk && languageOk;
}

function validateAttribute<T>(
  v: Validator,
  value: unknown,
  path: string,
  validateValue: (validator: Validator, candidate: unknown, candidatePath: string) => candidate is T,
): value is EffectiveDatedAttribute<T> {
  const item = v.object(value, path);
  if (item === null) return false;
  v.exactKeys(item, path, ['value', 'effectiveFrom', 'effectiveTo', 'provenance']);
  const valueOk = validateValue(v, item['value'], `${path}.value`);
  const fromOk = v.date(item['effectiveFrom'], `${path}.effectiveFrom`);
  const toOk = item['effectiveTo'] === undefined || v.date(item['effectiveTo'], `${path}.effectiveTo`);
  const provenanceOk = validateProvenance(v, item['provenance'], `${path}.provenance`);
  if (
    fromOk &&
    toOk &&
    typeof item['effectiveFrom'] === 'string' &&
    typeof item['effectiveTo'] === 'string' &&
    item['effectiveTo'] < item['effectiveFrom']
  ) {
    v.issue(`${path}.effectiveTo`, 'must not precede effectiveFrom');
    return false;
  }
  return valueOk && fromOk && toOk && provenanceOk;
}

function validateStringArray(v: Validator, value: unknown, path: string, pattern?: RegExp): boolean {
  const values = v.array(value, path);
  if (values === null) return false;
  let valid = true;
  const seen = new Set<string>();
  values.forEach((entry, index) => {
    const itemPath = `${path}[${index}]`;
    if (!v.string(entry, itemPath)) valid = false;
    else {
      if (pattern !== undefined && !pattern.test(entry)) {
        v.issue(itemPath, `has an invalid ID format (${pattern.source})`);
        valid = false;
      }
      if (seen.has(entry)) {
        v.issue(itemPath, 'must not duplicate another entry');
        valid = false;
      }
      seen.add(entry);
    }
  });
  return valid;
}

function validateIssuedNation(
  v: Validator,
  value: unknown,
  path: string,
  nationId: string,
): value is IssuedNationRecord {
  const item = v.object(value, path);
  if (item === null) return false;
  v.exactKeys(item, path, ['seedAuthorityNamespace', 'seedFeatureIds', 'issuedDate', 'status']);
  let valid = v.string(item['seedAuthorityNamespace'], `${path}.seedAuthorityNamespace`);
  const featureIds = v.array(item['seedFeatureIds'], `${path}.seedFeatureIds`);
  if (featureIds === null || featureIds.length === 0) {
    if (featureIds !== null) v.issue(`${path}.seedFeatureIds`, 'must contain at least one snapshotted public feature ID');
    valid = false;
  } else {
    const canonicalFeatureIds: string[] = [];
    featureIds.forEach((featureId, index) => {
      if (!v.string(featureId, `${path}.seedFeatureIds[${index}]`)) valid = false;
      else canonicalFeatureIds.push(featureId.trim());
    });
    if (new Set(canonicalFeatureIds).size !== canonicalFeatureIds.length) {
      v.issue(`${path}.seedFeatureIds`, 'must not contain duplicate feature IDs');
      valid = false;
    }
    if (JSON.stringify(canonicalFeatureIds) !== JSON.stringify([...canonicalFeatureIds].sort())) {
      v.issue(`${path}.seedFeatureIds`, 'must preserve the canonical sorted seed snapshot');
      valid = false;
    }
  }
  valid = v.date(item['issuedDate'], `${path}.issuedDate`) && valid;
  valid = v.enum(item['status'], `${path}.status`, ['active', 'retired']) && valid;
  if (
    valid &&
    typeof item['seedAuthorityNamespace'] === 'string' &&
    Array.isArray(item['seedFeatureIds']) &&
    item['seedFeatureIds'].every((featureId): featureId is string => typeof featureId === 'string')
  ) {
    const derivedId = mintNationId({
      authorityNamespace: item['seedAuthorityNamespace'],
      publicFeatureIds: item['seedFeatureIds'],
    });
    if (derivedId !== nationId) {
      v.issue(path, `seed snapshot must derive its issuance ledger key (${nationId})`);
      valid = false;
    }
  }
  return valid;
}

function validateContact(v: Validator, value: unknown, path: string): boolean {
  const item = v.object(value, path);
  if (item === null) return false;
  const allowed = ['office', 'title', 'publicPhone', 'publicEmail', 'website', 'source', 'verifiedDate'];
  v.exactKeys(item, path, allowed);
  let valid = v.string(item['office'], `${path}.office`) && v.string(item['title'], `${path}.title`);
  valid = v.string(item['source'], `${path}.source`) && valid;
  valid = v.date(item['verifiedDate'], `${path}.verifiedDate`) && valid;
  for (const key of ['publicPhone', 'publicEmail', 'website'] as const) {
    if (item[key] !== undefined && !v.string(item[key], `${path}.${key}`)) valid = false;
  }
  if (item['publicPhone'] === undefined && item['publicEmail'] === undefined && item['website'] === undefined) {
    v.issue(path, 'must provide at least one publicPhone, publicEmail, or website');
    valid = false;
  }
  return valid;
}

function validateLocation(v: Validator, value: unknown, path: string): boolean {
  const item = v.object(value, path);
  if (item === null) return false;
  v.exactKeys(item, path, ['latitude', 'longitude', 'subdivisionCode', 'region']);
  let valid = true;
  if (typeof item['latitude'] !== 'number' || !Number.isFinite(item['latitude']) || item['latitude'] < -90 || item['latitude'] > 90) {
    v.issue(`${path}.latitude`, 'must be a finite number from -90 through 90');
    valid = false;
  }
  if (typeof item['longitude'] !== 'number' || !Number.isFinite(item['longitude']) || item['longitude'] < -180 || item['longitude'] > 180) {
    v.issue(`${path}.longitude`, 'must be a finite number from -180 through 180');
    valid = false;
  }
  valid = v.string(item['subdivisionCode'], `${path}.subdivisionCode`) && valid;
  if (item['region'] !== undefined && !v.string(item['region'], `${path}.region`)) valid = false;
  return valid;
}

function validateHazardContext(v: Validator, value: unknown, path: string): boolean {
  const item = v.object(value, path);
  if (item === null) return false;
  const booleanKeys = [
    'tsunamiZone',
    'floodPlain',
    'laharZone',
    'atmosphericRiverExposure',
    'stormSurgeExposure',
    'volcanicZone',
  ] as const;
  v.exactKeys(item, path, [...booleanKeys, 'seismicZone', 'wildfireRisk']);
  let valid = true;
  for (const key of booleanKeys) {
    if (item[key] !== undefined && typeof item[key] !== 'boolean') {
      v.issue(`${path}.${key}`, 'must be a boolean');
      valid = false;
    }
  }
  if (item['seismicZone'] !== undefined && !v.string(item['seismicZone'], `${path}.seismicZone`)) valid = false;
  if (item['wildfireRisk'] !== undefined && typeof item['wildfireRisk'] !== 'boolean' && typeof item['wildfireRisk'] !== 'string') {
    v.issue(`${path}.wildfireRisk`, 'must be a boolean or string');
    valid = false;
  }
  return valid;
}

function validateNation(v: Validator, value: unknown, path: string, key: string): boolean {
  const item = v.object(value, path);
  if (item === null) return false;
  v.exactKeys(item, path, [
    'nationId',
    'status',
    'predecessorIds',
    'successorIds',
    'names',
    'aliases',
    'contacts',
    'idsDataTier',
    'location',
    'hazardContext',
  ]);
  let valid = v.string(item['nationId'], `${path}.nationId`);
  if (typeof item['nationId'] === 'string' && !NATION_ID_PATTERN.test(item['nationId'])) {
    v.issue(`${path}.nationId`, 'must be an opaque tn_ ID with 32 lowercase hexadecimal digits');
    valid = false;
  }
  if (item['nationId'] !== key) {
    v.issue(`${path}.nationId`, `must match its nations map key (${key})`);
    valid = false;
  }
  valid = v.enum(item['status'], `${path}.status`, ['active', 'retired']) && valid;
  valid = validateStringArray(v, item['predecessorIds'], `${path}.predecessorIds`, NATION_ID_PATTERN) && valid;
  valid = validateStringArray(v, item['successorIds'], `${path}.successorIds`, NATION_ID_PATTERN) && valid;
  for (const relationKey of ['predecessorIds', 'successorIds'] as const) {
    if (Array.isArray(item[relationKey]) && item[relationKey].includes(key)) {
      v.issue(`${path}.${relationKey}`, 'must not contain the Nation itself');
      valid = false;
    }
  }
  const names = v.array(item['names'], `${path}.names`);
  if (names !== null) {
    if (names.length === 0) {
      v.issue(`${path}.names`, 'must contain at least one effective-dated name');
      valid = false;
    }
    names.forEach((entry, index) => {
      if (!validateAttribute(v, entry, `${path}.names[${index}]`, validateNationName)) valid = false;
    });
  } else valid = false;
  const aliases = v.array(item['aliases'], `${path}.aliases`);
  if (aliases !== null) aliases.forEach((entry, index) => validateAttribute(v, entry, `${path}.aliases[${index}]`, validateNationAlias));
  else valid = false;
  const contacts = v.array(item['contacts'], `${path}.contacts`);
  if (contacts !== null) contacts.forEach((entry, index) => validateContact(v, entry, `${path}.contacts[${index}]`));
  else valid = false;
  if (item['idsDataTier'] !== undefined && !v.enum(item['idsDataTier'], `${path}.idsDataTier`, ['T0', 'T1'])) valid = false;
  if (item['location'] !== undefined && !validateLocation(v, item['location'], `${path}.location`)) valid = false;
  if (item['hazardContext'] !== undefined && !validateHazardContext(v, item['hazardContext'], `${path}.hazardContext`)) valid = false;
  return valid;
}

function validatePosition(v: Validator, value: unknown, path: string): boolean {
  if (!Array.isArray(value) || value.length !== 2 || value.some((part) => typeof part !== 'number' || !Number.isFinite(part))) {
    v.issue(path, 'must be a [longitude, latitude] numeric position');
    return false;
  }
  const [longitude, latitude] = value as readonly unknown[];
  if (typeof longitude !== 'number' || typeof latitude !== 'number' || longitude < -180 || longitude > 180 || latitude < -90 || latitude > 90) {
    v.issue(path, 'must contain longitude from -180 through 180 and latitude from -90 through 90');
    return false;
  }
  return true;
}

function validatePolygon(v: Validator, value: unknown, path: string): boolean {
  const rings = v.array(value, path);
  if (rings === null) return false;
  let valid = rings.length > 0;
  if (rings.length === 0) v.issue(path, 'must contain at least one linear ring');
  rings.forEach((ring, ringIndex) => {
    if (!Array.isArray(ring) || ring.length < 4) {
      v.issue(`${path}[${ringIndex}]`, 'must be a linear ring with at least four positions');
      valid = false;
      return;
    }
    ring.forEach((position, positionIndex) => {
      if (!validatePosition(v, position, `${path}[${ringIndex}][${positionIndex}]`)) valid = false;
    });
    if (JSON.stringify(ring[0]) !== JSON.stringify(ring.at(-1))) {
      v.issue(`${path}[${ringIndex}]`, 'must be closed (first and last positions equal)');
      valid = false;
    }
  });
  return valid;
}

function validateGeometry(v: Validator, value: unknown, path: string): boolean {
  const item = v.object(value, path);
  if (item === null) return false;
  v.exactKeys(item, path, ['type', 'coordinates']);
  if (item['type'] === 'Polygon') return validatePolygon(v, item['coordinates'], `${path}.coordinates`);
  if (item['type'] === 'MultiPolygon') {
    const polygons = v.array(item['coordinates'], `${path}.coordinates`);
    if (polygons === null) return false;
    let valid = polygons.length > 0;
    if (polygons.length === 0) v.issue(`${path}.coordinates`, 'must contain at least one polygon');
    polygons.forEach((polygon, index) => {
      if (!validatePolygon(v, polygon, `${path}.coordinates[${index}]`)) valid = false;
    });
    return valid;
  }
  v.issue(`${path}.type`, 'must be Polygon or MultiPolygon');
  return false;
}

function validateComponent(v: Validator, value: unknown, path: string, key: string): boolean {
  const item = v.object(value, path);
  if (item === null) return false;
  v.exactKeys(item, path, ['componentId', 'authorityNamespace', 'sourceFeatureId', 'vintage', 'geometry', 'lifecycle', 'provenance']);
  let valid = v.string(item['componentId'], `${path}.componentId`);
  if (typeof item['componentId'] === 'string' && !GEOMETRY_COMPONENT_ID_PATTERN.test(item['componentId'])) {
    v.issue(`${path}.componentId`, 'must be an opaque gc_ ID with 32 lowercase hexadecimal digits');
    valid = false;
  }
  if (item['componentId'] !== key) {
    v.issue(`${path}.componentId`, `must match its geometryComponents map key (${key})`);
    valid = false;
  }
  valid = v.string(item['authorityNamespace'], `${path}.authorityNamespace`) && valid;
  valid = v.string(item['sourceFeatureId'], `${path}.sourceFeatureId`) && valid;
  valid = v.string(item['vintage'], `${path}.vintage`) && valid;
  valid = validateGeometry(v, item['geometry'], `${path}.geometry`) && valid;
  const lifecycle = v.object(item['lifecycle'], `${path}.lifecycle`);
  if (lifecycle !== null) {
    v.exactKeys(lifecycle, `${path}.lifecycle`, ['status', 'effectiveFrom', 'effectiveTo', 'successorComponentIds']);
    valid = v.enum(lifecycle['status'], `${path}.lifecycle.status`, ['active', 'retired', 'replaced']) && valid;
    const fromOk = v.date(lifecycle['effectiveFrom'], `${path}.lifecycle.effectiveFrom`);
    const toOk = lifecycle['effectiveTo'] === undefined || v.date(lifecycle['effectiveTo'], `${path}.lifecycle.effectiveTo`);
    valid = fromOk && toOk && valid;
    valid = validateStringArray(v, lifecycle['successorComponentIds'], `${path}.lifecycle.successorComponentIds`, GEOMETRY_COMPONENT_ID_PATTERN) && valid;
  } else valid = false;
  valid = validateProvenance(v, item['provenance'], `${path}.provenance`) && valid;
  return valid;
}

function validateAssociation(v: Validator, value: unknown, path: string): boolean {
  const item = v.object(value, path);
  if (item === null) return false;
  v.exactKeys(item, path, ['nationId', 'componentId', 'status', 'reviewStatus', 'provenance', 'notes']);
  let valid = v.string(item['nationId'], `${path}.nationId`);
  if (typeof item['nationId'] === 'string' && !NATION_ID_PATTERN.test(item['nationId'])) valid = false;
  valid = v.string(item['componentId'], `${path}.componentId`) && valid;
  if (typeof item['componentId'] === 'string' && !GEOMETRY_COMPONENT_ID_PATTERN.test(item['componentId'])) valid = false;
  valid = v.enum(item['status'], `${path}.status`, ['verified', 'unresolved', 'conflicting', 'multi-nation']) && valid;
  valid = v.enum(item['reviewStatus'], `${path}.reviewStatus`, ['pending', 'reviewed', 'escalated']) && valid;
  valid = validateProvenance(v, item['provenance'], `${path}.provenance`) && valid;
  if (item['notes'] !== undefined && !v.string(item['notes'], `${path}.notes`)) valid = false;
  return valid;
}

function validateRelationship(v: Validator, value: unknown, path: string): boolean {
  const item = v.object(value, path);
  if (item === null) return false;
  v.exactKeys(item, path, ['relationshipId', 'fromNationId', 'toNationId', 'kind', 'status', 'reviewStatus', 'provenance', 'notes']);
  let valid = v.string(item['relationshipId'], `${path}.relationshipId`);
  valid = v.string(item['fromNationId'], `${path}.fromNationId`) && valid;
  valid = v.string(item['toNationId'], `${path}.toNationId`) && valid;
  if (item['fromNationId'] === item['toNationId']) {
    v.issue(path, 'must relate two distinct Nation IDs');
    valid = false;
  }
  valid = v.enum(item['kind'], `${path}.kind`, ['cross-border-counterpart', 'same-name-distinct', 'related-not-merged']) && valid;
  valid = v.enum(item['status'], `${path}.status`, ['verified', 'unresolved', 'conflicting']) && valid;
  valid = v.enum(item['reviewStatus'], `${path}.reviewStatus`, ['pending', 'reviewed', 'escalated']) && valid;
  valid = validateProvenance(v, item['provenance'], `${path}.provenance`) && valid;
  if (item['notes'] !== undefined && !v.string(item['notes'], `${path}.notes`)) valid = false;
  return valid;
}

function validateRedirects(v: Validator, value: unknown, path: string): boolean {
  const table = v.object(value, path);
  if (table === null) return false;
  v.exactKeys(table, path, ['version', 'entries']);
  let valid = v.string(table['version'], `${path}.version`);
  const entries = v.array(table['entries'], `${path}.entries`);
  if (entries === null) return false;
  const sources = new Set<string>();
  entries.forEach((entry, index) => {
    const entryPath = `${path}.entries[${index}]`;
    const item = v.object(entry, entryPath);
    if (item === null) {
      valid = false;
      return;
    }
    v.exactKeys(item, entryPath, ['fromId', 'toIds', 'reason', 'effectiveDate', 'provenance']);
    if (!v.string(item['fromId'], `${entryPath}.fromId`)) valid = false;
    else if (sources.has(item['fromId'])) {
      v.issue(`${entryPath}.fromId`, 'must be unique in the redirect table');
      valid = false;
    } else sources.add(item['fromId']);
    const targetOk = validateStringArray(v, item['toIds'], `${entryPath}.toIds`);
    if (Array.isArray(item['toIds']) && item['toIds'].length === 0) {
      v.issue(`${entryPath}.toIds`, 'must contain at least one target');
      valid = false;
    }
    valid = targetOk && valid;
    valid = v.enum(item['reason'], `${entryPath}.reason`, ['legacy-id', 'merge', 'split', 'recognition-change']) && valid;
    valid = v.date(item['effectiveDate'], `${entryPath}.effectiveDate`) && valid;
    valid = validateProvenance(v, item['provenance'], `${entryPath}.provenance`) && valid;
  });
  return valid;
}

function validateSearchIndex(v: Validator, value: unknown, path: string): boolean {
  const entries = v.array(value, path);
  if (entries === null) return false;
  let valid = true;
  entries.forEach((entry, index) => {
    const itemPath = `${path}[${index}]`;
    const item = v.object(entry, itemPath);
    if (item === null) {
      valid = false;
      return;
    }
    v.exactKeys(item, itemPath, ['alias', 'normalizedAlias', 'nationId']);
    valid = v.string(item['alias'], `${itemPath}.alias`) && valid;
    valid = v.string(item['normalizedAlias'], `${itemPath}.normalizedAlias`) && valid;
    valid = v.string(item['nationId'], `${itemPath}.nationId`) && valid;
    if (typeof item['alias'] === 'string' && item['normalizedAlias'] !== normalizeSearchAlias(item['alias'])) {
      v.issue(`${itemPath}.normalizedAlias`, 'must equal normalizeSearchAlias(alias)');
      valid = false;
    }
  });
  return valid;
}

function validateReferences(v: Validator, registry: TribalRegistry): void {
  const nationIds = new Set(Object.keys(registry.nations));
  const componentIds = new Set(Object.keys(registry.geometryComponents));
  for (const [id, nation] of Object.entries(registry.nations)) {
    const issuance = registry.issuedNations[id];
    if (issuance === undefined) v.issue(`$.nations.${id}.nationId`, 'must have a persisted issuance ledger record');
    else if (issuance.status !== nation.status) {
      v.issue(`$.issuedNations.${id}.status`, `must match Nation status ${nation.status}`);
    }
    for (const [label, targets] of [
      ['predecessorIds', nation.predecessorIds],
      ['successorIds', nation.successorIds],
    ] as const) {
      targets.forEach((target, index) => {
        if (!nationIds.has(target)) v.issue(`$.nations.${id}.${label}[${index}]`, `references unknown Nation ${target}`);
      });
    }
  }
  for (const [id, issuance] of Object.entries(registry.issuedNations)) {
    const nation = registry.nations[id];
    if (issuance.status === 'active' && nation === undefined) {
      v.issue(`$.issuedNations.${id}.status`, 'active issuance must have an active Nation entity');
    }
    if (issuance.status === 'retired' && nation?.status === 'active') {
      v.issue(`$.issuedNations.${id}.status`, 'retired issuance is a tombstone and cannot be assigned to an active Nation');
    }
  }
  for (const [id, component] of Object.entries(registry.geometryComponents)) {
    component.lifecycle.successorComponentIds.forEach((target, index) => {
      if (!componentIds.has(target)) v.issue(`$.geometryComponents.${id}.lifecycle.successorComponentIds[${index}]`, `references unknown component ${target}`);
    });
  }
  const associationPairs = new Set<string>();
  const componentAssociationCounts = new Map<string, number>();
  registry.associations.forEach((association, index) => {
    if (!nationIds.has(association.nationId)) v.issue(`$.associations[${index}].nationId`, `references unknown Nation ${association.nationId}`);
    if (!componentIds.has(association.componentId)) v.issue(`$.associations[${index}].componentId`, `references unknown component ${association.componentId}`);
    const pair = `${association.nationId}\u0000${association.componentId}`;
    if (associationPairs.has(pair)) v.issue(`$.associations[${index}]`, 'duplicates an existing Nation-to-component association');
    associationPairs.add(pair);
    componentAssociationCounts.set(association.componentId, (componentAssociationCounts.get(association.componentId) ?? 0) + 1);
  });
  registry.associations.forEach((association, index) => {
    if (association.status === 'multi-nation' && (componentAssociationCounts.get(association.componentId) ?? 0) < 2) {
      v.issue(`$.associations[${index}].status`, 'multi-nation requires the component to be associated with at least two Nations');
    }
  });
  registry.relationships.forEach((relationship, index) => {
    if (!nationIds.has(relationship.fromNationId)) v.issue(`$.relationships[${index}].fromNationId`, `references unknown Nation ${relationship.fromNationId}`);
    if (!nationIds.has(relationship.toNationId)) v.issue(`$.relationships[${index}].toNationId`, `references unknown Nation ${relationship.toNationId}`);
  });
  registry.searchIndex.forEach((entry, index) => {
    if (!nationIds.has(entry.nationId)) v.issue(`$.searchIndex[${index}].nationId`, `references unknown Nation ${entry.nationId}`);
  });
  const expectedIndex = buildSearchIndex(registry);
  if (JSON.stringify(registry.searchIndex) !== JSON.stringify(expectedIndex)) {
    v.issue('$.searchIndex', 'must be the complete, deterministically ordered output of buildSearchIndex(registry)');
  }
  const redirects = new Map(registry.redirects.entries.map((entry) => [entry.fromId, entry.toIds]));
  const visit = (id: string, path: readonly string[]): boolean => {
    const loopIndex = path.indexOf(id);
    if (loopIndex >= 0) {
      v.issue('$.redirects.entries', `contains redirect loop: ${[...path.slice(loopIndex), id].join(' -> ')}`);
      return false;
    }
    const targets = redirects.get(id);
    if (targets === undefined) return nationIds.has(id);
    return targets.every((target) => visit(target, [...path, id]));
  };
  for (const source of redirects.keys()) {
    if (!visit(source, [])) v.issue('$.redirects.entries', `redirect from ${source} does not terminate at a known Nation`);
  }
  validateLineageAndRedirectIntegrity(v, registry);
}

function sameIds(left: readonly string[], right: readonly string[]): boolean {
  return JSON.stringify([...left].sort()) === JSON.stringify([...right].sort());
}

function validateLineageAndRedirectIntegrity(v: Validator, registry: TribalRegistry): void {
  const lineageRedirects = new Map(
    registry.redirects.entries
      .filter(({ reason }) => reason === 'merge' || reason === 'split')
      .map((entry) => [entry.fromId, entry]),
  );
  for (const [id, nation] of Object.entries(registry.nations)) {
    for (const predecessorId of nation.predecessorIds) {
      const predecessor = registry.nations[predecessorId];
      if (predecessor !== undefined && !predecessor.successorIds.includes(nation.nationId)) {
        v.issue(`$.nations.${id}.predecessorIds`, `predecessor ${predecessorId} must name ${id} as a successor`);
      }
    }
    for (const successorId of nation.successorIds) {
      const successor = registry.nations[successorId];
      if (successor !== undefined) {
        if (successor.status !== 'active') {
          v.issue(`$.nations.${id}.successorIds`, `successor ${successorId} must be active`);
        }
        if (!successor.predecessorIds.includes(nation.nationId)) {
          v.issue(`$.nations.${id}.successorIds`, `successor ${successorId} must name ${id} as a predecessor`);
        }
      }
    }
    if (nation.successorIds.length > 0) {
      const redirect = lineageRedirects.get(id);
      if (redirect === undefined || !sameIds(redirect.toIds, nation.successorIds)) {
        v.issue(`$.nations.${id}.successorIds`, 'must exactly match a merge/split redirect target set');
      }
    }
  }
  registry.redirects.entries.forEach((redirect, index) => {
    const path = `$.redirects.entries[${index}]`;
    redirect.toIds.forEach((targetId, targetIndex) => {
      const target = registry.nations[targetId];
      if (target === undefined || target.status !== 'active') {
        v.issue(`${path}.toIds[${targetIndex}]`, `redirect target ${targetId} must be an existing active Nation`);
      }
    });
    if (redirect.reason === 'split' || redirect.reason === 'merge') {
      const source = registry.nations[redirect.fromId];
      if (source === undefined || source.status !== 'retired') {
        v.issue(`${path}.fromId`, `${redirect.reason} redirect source must be an existing retired Nation`);
      } else if (!sameIds(source.successorIds, redirect.toIds)) {
        v.issue(`${path}.toIds`, `must exactly match ${redirect.fromId}'s successorIds`);
      }
      if (redirect.reason === 'split' && redirect.toIds.length < 2) {
        v.issue(`${path}.toIds`, 'split redirect must have multiple successor targets');
      }
      if (redirect.reason === 'merge' && redirect.toIds.length !== 1) {
        v.issue(`${path}.toIds`, 'merge redirect must have exactly one successor target');
      }
    } else if (redirect.toIds.length > 1) {
      v.issue(`${path}.toIds`, 'multiple successor targets require an explicit split redirect');
    }
  });
}

export function validateTribalRegistry(raw: unknown): RegistryValidationResult {
  const v = new Validator();
  const root = v.object(raw, '$');
  if (root === null) return { ok: false, errors: v.errors };
  v.exactKeys(root, '$', ['version', 'provenance', 'issuedNations', 'nations', 'geometryComponents', 'associations', 'relationships', 'redirects', 'searchIndex']);
  v.string(root['version'], '$.version');
  v.string(root['provenance'], '$.provenance');
  const issuedNations = v.object(root['issuedNations'], '$.issuedNations');
  if (issuedNations !== null) {
    for (const [key, issuance] of Object.entries(issuedNations)) {
      if (!NATION_ID_PATTERN.test(key)) v.issue(`$.issuedNations.${key}`, 'map key must be an opaque tn_ ID');
      validateIssuedNation(v, issuance, `$.issuedNations.${key}`, key);
    }
  }
  const nations = v.object(root['nations'], '$.nations');
  if (nations !== null) {
    for (const [key, nation] of Object.entries(nations)) {
      if (!NATION_ID_PATTERN.test(key)) v.issue(`$.nations.${key}`, 'map key must be an opaque tn_ ID');
      validateNation(v, nation, `$.nations.${key}`, key);
    }
  }
  const components = v.object(root['geometryComponents'], '$.geometryComponents');
  if (components !== null) {
    for (const [key, component] of Object.entries(components)) {
      if (!GEOMETRY_COMPONENT_ID_PATTERN.test(key)) v.issue(`$.geometryComponents.${key}`, 'map key must be an opaque gc_ ID');
      validateComponent(v, component, `$.geometryComponents.${key}`, key);
    }
  }
  const associations = v.array(root['associations'], '$.associations');
  associations?.forEach((association, index) => validateAssociation(v, association, `$.associations[${index}]`));
  const relationships = v.array(root['relationships'], '$.relationships');
  relationships?.forEach((relationship, index) => validateRelationship(v, relationship, `$.relationships[${index}]`));
  validateRedirects(v, root['redirects'], '$.redirects');
  validateSearchIndex(v, root['searchIndex'], '$.searchIndex');
  if (v.errors.length === 0) validateReferences(v, raw as TribalRegistry);
  return v.errors.length === 0 ? { ok: true, value: raw as TribalRegistry } : { ok: false, errors: v.errors };
}

/** Validate that an issuance ledger transition preserves every ID and tombstone. */
export function validateTribalRegistryTransition(previousRaw: unknown, currentRaw: unknown): RegistryValidationResult {
  const previous = validateTribalRegistry(previousRaw);
  if (!previous.ok) return previous;
  const current = validateTribalRegistry(currentRaw);
  if (!current.ok) return current;
  const errors: RegistryValidationIssue[] = [];
  for (const [nationId, priorIssuance] of Object.entries(previous.value.issuedNations)) {
    const nextIssuance = current.value.issuedNations[nationId];
    if (nextIssuance === undefined) {
      errors.push({ path: `$.issuedNations.${nationId}`, message: 'previously issued ID tombstone must never be removed' });
      continue;
    }
    if (
      priorIssuance.seedAuthorityNamespace !== nextIssuance.seedAuthorityNamespace ||
      priorIssuance.issuedDate !== nextIssuance.issuedDate ||
      !sameIds(priorIssuance.seedFeatureIds, nextIssuance.seedFeatureIds)
    ) {
      errors.push({ path: `$.issuedNations.${nationId}`, message: 'issuance basis is immutable and cannot be reassigned' });
    }
    if (priorIssuance.status === 'retired' && nextIssuance.status !== 'retired') {
      errors.push({ path: `$.issuedNations.${nationId}.status`, message: 'retired ID tombstone cannot be reactivated' });
    }
    if (previous.value.nations[nationId] === undefined && current.value.nations[nationId] !== undefined) {
      errors.push({ path: `$.nations.${nationId}`, message: 'a tombstoned ID cannot be reassigned to an entity' });
    }
  }
  return errors.length === 0 ? { ok: true, value: current.value } : { ok: false, errors };
}

export function assertValidTribalRegistry(raw: unknown): TribalRegistry {
  const result = validateTribalRegistry(raw);
  if (!result.ok) throw new TribalRegistryValidationError(result.errors);
  return result.value;
}
