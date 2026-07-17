import type {
  IdentityRedirect,
  NationEntity,
  NationGeometryAssociation,
  NationRelationship,
  TribalRegistry,
} from './model.js';
import { EMPTY_TRIBAL_REGISTRY } from './model.js';
import { buildSearchIndex } from './search.js';
import { assertValidTribalRegistry } from './validation.js';

export class TribalRegistryError extends Error {
  override readonly name = 'TribalRegistryError';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Load a deployment registry after enforcing provenance and the T0/T1 gate.
 * T2/T3 and unknown-tier entities are removed together with every associated
 * geometry link, relationship, redirect target, and search entry.
 */
export function loadTribalRegistry(raw: unknown): TribalRegistry {
  if (!isRecord(raw)) throw new TribalRegistryError('Registry data must be an object.');
  const rawNations = isRecord(raw['nations']) ? raw['nations'] : {};
  const nationCount = Object.keys(rawNations).length;
  const version = typeof raw['version'] === 'string' ? raw['version'] : '';
  const provenance = typeof raw['provenance'] === 'string' ? raw['provenance'].trim() : '';
  if (nationCount > 0 && version === '') throw new TribalRegistryError('Registry with nation data must declare its version.');
  if (nationCount > 0 && provenance === '') {
    throw new TribalRegistryError(
      'Registry with nation data must declare provenance: a human-written statement of the authority under which it is provided.',
    );
  }

  const admittedRaw: Record<string, Record<string, unknown>> = {};
  for (const [id, entry] of Object.entries(rawNations)) {
    if (!isRecord(entry)) continue;
    const tier = typeof entry['idsDataTier'] === 'string' ? entry['idsDataTier'].toUpperCase() : 'T0';
    if (tier === 'T0' || tier === 'T1') admittedRaw[id] = entry;
  }
  const admittedIds = new Set(Object.keys(admittedRaw));
  const restrictedIds = new Set(Object.keys(rawNations).filter((id) => !admittedIds.has(id)));
  const nations: Record<string, NationEntity> = {};
  for (const [id, entry] of Object.entries(admittedRaw)) {
    const predecessorIds = Array.isArray(entry['predecessorIds'])
      ? entry['predecessorIds'].filter((target): target is string => typeof target === 'string' && admittedIds.has(target))
      : entry['predecessorIds'];
    const successorIds = Array.isArray(entry['successorIds'])
      ? entry['successorIds'].filter((target): target is string => typeof target === 'string' && admittedIds.has(target))
      : entry['successorIds'];
    nations[id] = { ...entry, predecessorIds, successorIds } as unknown as NationEntity;
  }
  const rawIssuedNations = isRecord(raw['issuedNations']) ? raw['issuedNations'] : {};
  const issuedNations = Object.fromEntries(
    Object.entries(rawIssuedNations).filter(
      ([id, issuance]) =>
        isRecord(issuance) && (admittedIds.has(id) || (issuance['status'] === 'retired' && !restrictedIds.has(id))),
    ),
  );

  const rawAssociations = Array.isArray(raw['associations']) ? raw['associations'] : [];
  const associations = rawAssociations.filter(
    (association): association is NationGeometryAssociation =>
      isRecord(association) && typeof association['nationId'] === 'string' && admittedIds.has(association['nationId']),
  );
  const usedComponentIds = new Set<string>(associations.map(({ componentId }) => componentId));
  const rawComponents = isRecord(raw['geometryComponents']) ? raw['geometryComponents'] : {};
  const geometryComponents = Object.fromEntries(
    Object.entries(rawComponents).filter(([componentId]) => usedComponentIds.has(componentId)),
  );
  const relationships = (Array.isArray(raw['relationships']) ? raw['relationships'] : []).filter(
    (relationship): relationship is NationRelationship =>
      isRecord(relationship) &&
      typeof relationship['fromNationId'] === 'string' &&
      typeof relationship['toNationId'] === 'string' &&
      admittedIds.has(relationship['fromNationId']) &&
      admittedIds.has(relationship['toNationId']),
  );

  const rawRedirectTable = isRecord(raw['redirects']) ? raw['redirects'] : {};
  const rawRedirectEntries = Array.isArray(rawRedirectTable['entries']) ? rawRedirectTable['entries'] : [];
  const redirectRecords = rawRedirectEntries.filter(
    (entry): entry is IdentityRedirect => isRecord(entry) && typeof entry['fromId'] === 'string' && Array.isArray(entry['toIds']),
  );
  const activeAdmittedIds = new Set(
    Object.entries(nations)
      .filter(([, nation]) => nation.status === 'active')
      .map(([id]) => id),
  );
  const redirects = redirectRecords.filter(
    (entry) => !restrictedIds.has(entry.fromId) && entry.toIds.length > 0 && entry.toIds.every((target) => activeAdmittedIds.has(target)),
  );

  const candidateWithoutIndex: TribalRegistry = {
    version: version === '' ? EMPTY_TRIBAL_REGISTRY.version : version,
    provenance: provenance === '' ? EMPTY_TRIBAL_REGISTRY.provenance : provenance,
    issuedNations: issuedNations as TribalRegistry['issuedNations'],
    nations,
    geometryComponents: geometryComponents as TribalRegistry['geometryComponents'],
    associations,
    relationships,
    redirects: {
      version: typeof rawRedirectTable['version'] === 'string' ? rawRedirectTable['version'] : version || '1.0.0',
      entries: redirects,
    },
    searchIndex: [],
  };
  return assertValidTribalRegistry({
    ...candidateWithoutIndex,
    searchIndex: buildSearchIndex(candidateWithoutIndex),
  });
}
