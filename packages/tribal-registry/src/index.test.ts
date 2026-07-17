// Every Nation, identifier seed, geometry, source, and contact in this file is FICTIONAL.
import { describe, expect, it } from 'vitest';

import publicRegistry from '@ewm/tribal-registry/registry.public.json' with { type: 'json' };

import {
  assertValidTribalRegistry,
  buildSearchIndex,
  contactsForRender,
  EMPTY_TRIBAL_REGISTRY,
  hazardIsElevated,
  InvalidNationIdSeedError,
  issueNationId,
  loadTribalRegistry,
  lookupIssuedNationId,
  mayRenderT1,
  mintGeometryComponentId,
  mintNationId,
  NationIdIssuanceError,
  RedirectLoopError,
  resolveNationSelection,
  TribalRegistryError,
  validateTribalRegistry,
  validateTribalRegistryTransition,
  type GeometryComponent,
  type IssuedNationRecord,
  type NationEntity,
  type NationGeometryAssociation,
  type NationId,
  type Provenance,
  type TribalRegistry,
} from './index.js';

const provenance: Provenance = {
  sourceId: 'fictional-source-record',
  citation: 'Fictional fixture source; not a real Nation record',
  retrievedDate: '2026-01-02',
  verifiedDate: '2026-01-03',
};

const nationASeed = { authorityNamespace: 'fictional-boundaries', publicFeatureIds: ['fictional-a'] } as const;
const nationBSeed = { authorityNamespace: 'fictional-boundaries', publicFeatureIds: ['fictional-b'] } as const;
const nationCSeed = { authorityNamespace: 'fictional-boundaries', publicFeatureIds: ['fictional-c'] } as const;
const retiredNationSeed = {
  authorityNamespace: 'fictional-boundaries',
  publicFeatureIds: ['fictional-retired'],
} as const;
const nationAId = mintNationId(nationASeed);
const nationBId = mintNationId(nationBSeed);
const nationCId = mintNationId(nationCSeed);
const retiredNationId = mintNationId(retiredNationSeed);

function fictionalIssuance(
  seed: { readonly authorityNamespace: string; readonly publicFeatureIds: readonly string[] },
  status: IssuedNationRecord['status'] = 'active',
): IssuedNationRecord {
  return {
    seedAuthorityNamespace: seed.authorityNamespace,
    seedFeatureIds: [...seed.publicFeatureIds].sort(),
    issuedDate: '2026-01-01',
    status,
  };
}

function fictionalNation(
  nationId: NationId,
  text: string,
  options: Partial<Pick<NationEntity, 'status' | 'predecessorIds' | 'successorIds' | 'idsDataTier'>> = {},
): NationEntity {
  return {
    nationId,
    status: options.status ?? 'active',
    predecessorIds: options.predecessorIds ?? [],
    successorIds: options.successorIds ?? [],
    names: [
      {
        value: { text, kind: 'official' },
        effectiveFrom: '2020-01-01',
        provenance,
      },
    ],
    aliases: [
      {
        value: { text: 'Fictional Shared Alias', kind: 'search' },
        effectiveFrom: '2020-01-01',
        provenance,
      },
    ],
    contacts: [
      {
        office: 'Fictional Emergency Office',
        title: 'Fictional Duty Desk',
        publicPhone: '+1-555-0100',
        publicEmail: 'desk@example.invalid',
        website: 'https://example.invalid/fictional-office',
        source: 'Fictional public office directory',
        verifiedDate: '2026-01-03',
      },
    ],
    idsDataTier: options.idsDataTier ?? 'T1',
    location: { latitude: 0, longitude: 0, subdivisionCode: 'ZZ', region: 'Fictional Test Region' },
    hazardContext: { floodPlain: true, wildfireRisk: 'high', seismicZone: 'moderate' },
  };
}

const componentAId = mintGeometryComponentId({
  authorityNamespace: 'fictional-boundaries',
  sourceFeatureId: 'fictional-parcel-a',
});
const componentA2Id = mintGeometryComponentId({
  authorityNamespace: 'fictional-boundaries',
  sourceFeatureId: 'fictional-parcel-a-2',
});
const sharedComponentId = mintGeometryComponentId({
  authorityNamespace: 'census-aiannh-fictional',
  sourceFeatureId: 'fictional-shared-geography',
});
const conflictComponentId = mintGeometryComponentId({
  authorityNamespace: 'databc-fictional',
  sourceFeatureId: 'fictional-conflicting-parcel',
});

function fictionalComponent(componentId: GeometryComponent['componentId'], sourceFeatureId: string): GeometryComponent {
  return {
    componentId,
    authorityNamespace: 'fictional-boundaries',
    sourceFeatureId,
    vintage: 'fictional-2026',
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [0, 0],
          [1, 0],
          [1, 1],
          [0, 0],
        ],
      ],
    },
    lifecycle: { status: 'active', effectiveFrom: '2020-01-01', successorComponentIds: [] },
    provenance,
  };
}

function association(
  nationId: NationId,
  componentId: GeometryComponent['componentId'],
  status: NationGeometryAssociation['status'],
): NationGeometryAssociation {
  return {
    nationId,
    componentId,
    status,
    reviewStatus: status === 'unresolved' ? 'escalated' : 'reviewed',
    provenance,
    notes: 'Fictional association for mechanism testing',
  };
}

function withBuiltIndex(registry: Omit<TribalRegistry, 'searchIndex'>): TribalRegistry {
  const withoutIndex = { ...registry, searchIndex: [] };
  return { ...withoutIndex, searchIndex: buildSearchIndex(withoutIndex) };
}

function validRegistry(): TribalRegistry {
  const nationA = fictionalNation(nationAId, 'Fictional Alpha Nation');
  const nationB = fictionalNation(nationBId, 'Fictional Beta Nation', { predecessorIds: [retiredNationId] });
  const nationC = fictionalNation(nationCId, 'Fictional Gamma Nation', { predecessorIds: [retiredNationId] });
  const retired = fictionalNation(retiredNationId, 'Fictional Former Nation', {
    status: 'retired',
    successorIds: [nationBId, nationCId],
  });
  return withBuiltIndex({
    version: '9.9.9-fictional',
    provenance: 'Fictional registry authority statement; no real Nation data',
    issuedNations: {
      [nationAId]: fictionalIssuance(nationASeed),
      [nationBId]: fictionalIssuance(nationBSeed),
      [nationCId]: fictionalIssuance(nationCSeed),
      [retiredNationId]: fictionalIssuance(retiredNationSeed, 'retired'),
    },
    nations: {
      [nationAId]: nationA,
      [nationBId]: nationB,
      [nationCId]: nationC,
      [retiredNationId]: retired,
    },
    geometryComponents: {
      [componentAId]: fictionalComponent(componentAId, 'fictional-parcel-a'),
      [componentA2Id]: fictionalComponent(componentA2Id, 'fictional-parcel-a-2'),
      [sharedComponentId]: fictionalComponent(sharedComponentId, 'fictional-shared-geography'),
      [conflictComponentId]: fictionalComponent(conflictComponentId, 'fictional-conflicting-parcel'),
    },
    associations: [
      association(nationAId, componentAId, 'verified'),
      association(nationAId, componentA2Id, 'verified'),
      association(nationAId, sharedComponentId, 'multi-nation'),
      association(nationBId, sharedComponentId, 'multi-nation'),
      association(nationCId, conflictComponentId, 'unresolved'),
    ],
    relationships: [
      {
        relationshipId: 'fictional-cross-border-link',
        fromNationId: nationAId,
        toNationId: nationBId,
        kind: 'cross-border-counterpart',
        status: 'unresolved',
        reviewStatus: 'pending',
        provenance,
        notes: 'Fictional cross-border ambiguity; no merge implied',
      },
      {
        relationshipId: 'fictional-same-name-link',
        fromNationId: nationBId,
        toNationId: nationCId,
        kind: 'same-name-distinct',
        status: 'verified',
        reviewStatus: 'reviewed',
        provenance,
        notes: 'Fictional same-name entities remain distinct',
      },
    ],
    redirects: {
      version: '3.0.0-fictional',
      entries: [
        {
          fromId: 'fictional-legacy-alpha',
          toIds: [nationAId],
          reason: 'legacy-id',
          effectiveDate: '2026-01-01',
          provenance,
        },
        {
          fromId: retiredNationId,
          toIds: [nationBId, nationCId],
          reason: 'split',
          effectiveDate: '2026-01-01',
          provenance,
        },
      ],
    },
  });
}

describe('opaque identity and geometry model', () => {
  it('mints stable opaque IDs from canonicalized fictional public seeds', () => {
    const reordered = mintNationId({
      authorityNamespace: 'FICTIONAL-BOUNDARIES',
      publicFeatureIds: ['fictional-b', 'fictional-a'],
    });
    const canonical = mintNationId({
      authorityNamespace: 'fictional-boundaries',
      publicFeatureIds: ['fictional-a', 'fictional-b'],
    });
    expect(reordered).toBe(canonical);
    expect(canonical).toMatch(/^tn_[0-9a-f]{32}$/);
  });

  it('rejects empty or missing fictional public feature-ID seed sets', () => {
    expect(() => mintNationId({ authorityNamespace: 'fictional-boundaries', publicFeatureIds: [] })).toThrow(
      InvalidNationIdSeedError,
    );
    expect(() =>
      mintNationId({ authorityNamespace: 'fictional-boundaries' } as never),
    ).toThrow(InvalidNationIdSeedError);
  });

  it('looks up the persisted Nation ID while parcel associations are added and removed', () => {
    const complete = validRegistry();
    const { [componentA2Id]: _removedComponent, ...startingComponents } = complete.geometryComponents;
    const starting = {
      ...complete,
      geometryComponents: startingComponents,
      associations: complete.associations.filter(({ componentId }) => componentId !== componentA2Id),
    };
    expect(validateTribalRegistry(starting).ok).toBe(true);
    expect(lookupIssuedNationId(starting.issuedNations, nationAId)).toBe(nationAId);

    const added = {
      ...starting,
      geometryComponents: {
        ...starting.geometryComponents,
        [componentA2Id]: fictionalComponent(componentA2Id, 'fictional-parcel-a-2'),
      },
      associations: [...starting.associations, association(nationAId, componentA2Id, 'verified')],
    };
    expect(validateTribalRegistry(added).ok).toBe(true);
    expect(lookupIssuedNationId(added.issuedNations, nationAId)).toBe(nationAId);

    const { [componentAId]: _removedOriginalComponent, ...remainingComponents } = added.geometryComponents;
    const removed = {
      ...added,
      geometryComponents: remainingComponents,
      associations: added.associations.filter(({ componentId }) => componentId !== componentAId),
    };
    expect(validateTribalRegistry(removed).ok).toBe(true);
    expect(lookupIssuedNationId(removed.issuedNations, nationAId)).toBe(nationAId);
    expect(Object.keys(removed.nations)).toContain(nationAId);
    expect(removed.nations[nationAId]?.nationId).toBe(nationAId);
  });

  it('rejects re-minting active and retired issued Nation IDs', () => {
    const active = issueNationId({}, nationASeed, '2026-01-01');
    expect(() => issueNationId(active.issuedNations, nationASeed, '2026-01-02')).toThrow(NationIdIssuanceError);
    const activeIssuance = active.issuedNations[active.nationId];
    if (activeIssuance === undefined) throw new Error('Fictional issuance fixture was not persisted.');
    const retiredLedger = {
      ...active.issuedNations,
      [active.nationId]: { ...activeIssuance, status: 'retired' as const },
    };
    expect(() => issueNationId(retiredLedger, nationASeed, '2026-01-03')).toThrow(NationIdIssuanceError);
  });

  it('represents shared geography and unresolved parcel conflict without collapsing Nations', () => {
    const registry = validRegistry();
    const shared = registry.associations.filter(({ componentId }) => componentId === sharedComponentId);
    expect(shared).toHaveLength(2);
    expect(shared.map(({ status }) => status)).toEqual(['multi-nation', 'multi-nation']);
    expect(new Set(shared.map(({ nationId }) => nationId))).toEqual(new Set([nationAId, nationBId]));
    expect(registry.associations.find(({ componentId }) => componentId === conflictComponentId)?.status).toBe(
      'unresolved',
    );
  });
});

describe('tier gate', () => {
  const nation = fictionalNation(nationAId, 'Fictional Alpha Nation');

  it('renders no T1 when nothing or another Nation is selected', () => {
    expect(mayRenderT1({ selectedNationId: null }, nationAId)).toBe(false);
    expect(contactsForRender({ selectedNationId: null }, nationAId, nation)).toBeNull();
    expect(contactsForRender({ selectedNationId: nationBId }, nationAId, nation)).toBeNull();
  });

  it('renders role-based T1 contacts with attribution only for the explicit selection', () => {
    const rendered = contactsForRender({ selectedNationId: nationAId }, nationAId, nation);
    expect(rendered?.contacts[0]?.office).toBe('Fictional Emergency Office');
    expect(rendered?.attribution).toEqual(['Fictional public office directory']);
  });
});

describe('hazard gate compatibility', () => {
  it('preserves the established elevated thresholds', () => {
    for (const value of [true, 'extreme', 'high', 'very-high']) expect(hazardIsElevated(value)).toBe(true);
    for (const value of [false, 'moderate', 'low', 'none', undefined, null]) expect(hazardIsElevated(value)).toBe(false);
  });
});

describe('registry validators', () => {
  it('accepts the full valid fictional registry', () => {
    const result = validateTribalRegistry(validRegistry());
    expect(result.ok).toBe(true);
    expect(() => assertValidTribalRegistry(validRegistry())).not.toThrow();
  });

  it('rejects malformed records with useful paths', () => {
    const registry = validRegistry();
    const malformed = {
      ...registry,
      nations: {
        ...registry.nations,
        [nationAId]: { ...registry.nations[nationAId], names: [] },
      },
    };
    const result = validateTribalRegistry(malformed);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.some(({ path, message }) => path.includes('.names') && message.includes('at least one'))).toBe(true);
  });

  it('rejects a named-person contact field', () => {
    const registry = validRegistry();
    const nation = registry.nations[nationAId];
    expect(nation).toBeDefined();
    const forbiddenField = ['person', 'Name'].join('');
    const malformed = {
      ...registry,
      nations: {
        ...registry.nations,
        [nationAId]: {
          ...nation,
          contacts: [{ ...nation?.contacts[0], [forbiddenField]: 'Fictional Person, not real' }],
        },
      },
    };
    const result = validateTribalRegistry(malformed);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.some(({ path }) => path.endsWith(`.${forbiddenField}`))).toBe(true);
  });

  it('rejects malformed many-to-many status usage', () => {
    const registry = validRegistry();
    const malformed = {
      ...registry,
      associations: registry.associations.filter(
        ({ nationId, componentId }) => !(nationId === nationBId && componentId === sharedComponentId),
      ),
    };
    const result = validateTribalRegistry(malformed);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.some(({ message }) => message.includes('at least two Nations'))).toBe(true);
  });

  it('rejects removing or reassigning an issued Nation ID tombstone across versions', () => {
    const tombstoneSeed = {
      authorityNamespace: 'fictional-boundaries',
      publicFeatureIds: ['fictional-tombstone-only'],
    } as const;
    const tombstoneId = mintNationId(tombstoneSeed);
    const previous = {
      ...validRegistry(),
      issuedNations: {
        ...validRegistry().issuedNations,
        [tombstoneId]: fictionalIssuance(tombstoneSeed, 'retired'),
      },
    };
    expect(validateTribalRegistry(previous).ok).toBe(true);
    const removed = validateTribalRegistryTransition(previous, validRegistry());
    expect(removed.ok).toBe(false);
    if (!removed.ok) expect(removed.errors.some(({ message }) => message.includes('must never be removed'))).toBe(true);

    const reassignedWithoutIndex = {
      ...previous,
      nations: {
        ...previous.nations,
        [tombstoneId]: fictionalNation(tombstoneId, 'Fictional Reassigned Tombstone Nation', { status: 'retired' }),
      },
      searchIndex: [],
    };
    const reassigned = { ...reassignedWithoutIndex, searchIndex: buildSearchIndex(reassignedWithoutIndex) };
    expect(validateTribalRegistry(reassigned).ok).toBe(true);
    const transition = validateTribalRegistryTransition(previous, reassigned);
    expect(transition.ok).toBe(false);
    if (!transition.ok) expect(transition.errors.some(({ message }) => message.includes('cannot be reassigned'))).toBe(true);
  });

  it('rejects lineage/redirect mismatches and non-active redirect targets', () => {
    const registry = validRegistry();
    const mismatched = {
      ...registry,
      redirects: {
        ...registry.redirects,
        entries: registry.redirects.entries.map((entry) =>
          entry.fromId === retiredNationId ? { ...entry, toIds: [nationBId] } : entry,
        ),
      },
    };
    const mismatchResult = validateTribalRegistry(mismatched);
    expect(mismatchResult.ok).toBe(false);
    if (!mismatchResult.ok) {
      expect(mismatchResult.errors.some(({ message }) => message.includes('exactly match'))).toBe(true);
      expect(mismatchResult.errors.some(({ message }) => message.includes('multiple successor'))).toBe(true);
    }

    const inactiveTarget = {
      ...registry,
      redirects: {
        ...registry.redirects,
        entries: registry.redirects.entries.map((entry) =>
          entry.fromId === 'fictional-legacy-alpha' ? { ...entry, toIds: [retiredNationId] } : entry,
        ),
      },
    };
    const targetResult = validateTribalRegistry(inactiveTarget);
    expect(targetResult.ok).toBe(false);
    if (!targetResult.ok) expect(targetResult.errors.some(({ message }) => message.includes('existing active Nation'))).toBe(true);
  });
});

describe('redirect resolver', () => {
  it('resolves legacy IDs before selection and preserves the requested ID for audit', () => {
    const result = resolveNationSelection(validRegistry(), 'fictional-legacy-alpha');
    expect(result).toMatchObject({
      kind: 'resolved',
      requestedId: 'fictional-legacy-alpha',
      nationId: nationAId,
      redirected: true,
    });
  });

  it('returns explicit unresolved outcomes', () => {
    expect(resolveNationSelection(validRegistry(), 'fictional-missing')).toMatchObject({
      kind: 'unresolved',
      requestedId: 'fictional-missing',
      reason: 'not-found',
    });
  });

  it('returns an explicit multiple-successor result for splits', () => {
    const result = resolveNationSelection(validRegistry(), retiredNationId);
    expect(result.kind).toBe('multiple-successors');
    if (result.kind === 'multiple-successors') {
      expect(result.requestedId).toBe(retiredNationId);
      expect(result.successorIds).toEqual([...result.successorIds].sort());
      expect(new Set(result.successorIds)).toEqual(new Set([nationBId, nationCId]));
    }
  });

  it('rejects redirect loops', () => {
    const registry = validRegistry();
    const looped: TribalRegistry = {
      ...registry,
      redirects: {
        version: 'loop-fictional',
        entries: [
          { fromId: 'fictional-loop-a', toIds: ['fictional-loop-b'], reason: 'legacy-id', effectiveDate: '2026-01-01', provenance },
          { fromId: 'fictional-loop-b', toIds: ['fictional-loop-a'], reason: 'legacy-id', effectiveDate: '2026-01-01', provenance },
        ],
      },
    };
    expect(() => resolveNationSelection(looped, 'fictional-loop-a')).toThrow(RedirectLoopError);
    expect(validateTribalRegistry(looped).ok).toBe(false);
  });
});

describe('deterministic search index', () => {
  it('is byte-identical across repeated builds and Nation map insertion orders', () => {
    const registry = validRegistry();
    const repeated = buildSearchIndex(registry);
    const reversedNations = Object.fromEntries(Object.entries(registry.nations).reverse());
    const reversed = buildSearchIndex({ nations: reversedNations });
    expect(JSON.stringify(repeated)).toBe(JSON.stringify(buildSearchIndex(registry)));
    expect(JSON.stringify(repeated)).toBe(JSON.stringify(reversed));
  });

  it('keeps a shared alias mapped to distinct Nation IDs', () => {
    const matches = buildSearchIndex(validRegistry()).filter(
      ({ normalizedAlias }) => normalizedAlias === 'fictional shared alias',
    );
    expect(matches).toHaveLength(4);
    expect(new Set(matches.map(({ nationId }) => nationId)).size).toBe(4);
  });
});

describe('provenance-gated loader', () => {
  it('loads the empty placeholder without supplied provenance', () => {
    const registry = loadTribalRegistry({ nations: {} });
    expect(registry.nations).toEqual({});
    expect(registry.provenance).toBe(EMPTY_TRIBAL_REGISTRY.provenance);
  });

  it('refuses Nation data without provenance or version', () => {
    const nation = fictionalNation(nationAId, 'Fictional Alpha Nation');
    expect(() => loadTribalRegistry({ version: 'fictional', nations: { [nationAId]: nation } })).toThrow(
      TribalRegistryError,
    );
    expect(() =>
      loadTribalRegistry({ provenance: 'Fictional authority', nations: { [nationAId]: nation } }),
    ).toThrow(TribalRegistryError);
  });

  it('admits T0/T1, defaults an absent tier to T0, and strips T2/T3/unknown plus linked data', () => {
    const t3Seed = { authorityNamespace: 'fictional-boundaries', publicFeatureIds: ['fictional-t3'] } as const;
    const t3Id = mintNationId(t3Seed);
    const t0 = fictionalNation(nationAId, 'Fictional T0 Nation', { idsDataTier: 'T0', successorIds: [t3Id] });
    const t1 = fictionalNation(nationBId, 'Fictional T1 Nation', { idsDataTier: 'T1', predecessorIds: [t3Id] });
    const implicitT0 = { ...fictionalNation(nationCId, 'Fictional Implicit T0 Nation') };
    delete (implicitT0 as { idsDataTier?: string }).idsDataTier;
    const t2 = fictionalNation(retiredNationId, 'Fictional T2 Restricted Nation', { idsDataTier: 'T2' });
    const t3 = {
      ...fictionalNation(t3Id, 'Fictional T3 Restricted Nation', {
        idsDataTier: 'T3',
        predecessorIds: [nationAId],
        successorIds: [nationBId],
      }),
      aliases: [
        {
          value: { text: 'Fictional T3 Search Alias', kind: 'search' as const },
          effectiveFrom: '2020-01-01',
          provenance,
        },
      ],
    };
    const unknownSeed = { authorityNamespace: 'fictional-boundaries', publicFeatureIds: ['fictional-unknown-tier'] } as const;
    const unknownId = mintNationId(unknownSeed);
    const unknownTier = { ...fictionalNation(unknownId, 'Fictional Unknown Tier Nation'), idsDataTier: 'not-a-tier' };
    const t3ComponentId = mintGeometryComponentId({
      authorityNamespace: 'fictional-boundaries',
      sourceFeatureId: 'fictional-t3-linked-component',
    });
    const loaded = loadTribalRegistry({
      version: '9.9.9-fictional',
      provenance: 'Fictional registry authority statement',
      issuedNations: {
        [nationAId]: fictionalIssuance(nationASeed),
        [nationBId]: fictionalIssuance(nationBSeed),
        [nationCId]: fictionalIssuance(nationCSeed),
        [retiredNationId]: fictionalIssuance(retiredNationSeed),
        [t3Id]: fictionalIssuance(t3Seed),
        [unknownId]: fictionalIssuance(unknownSeed),
      },
      nations: {
        [nationAId]: t0,
        [nationBId]: t1,
        [nationCId]: implicitT0,
        [retiredNationId]: t2,
        [t3Id]: t3,
        [unknownId]: unknownTier,
      },
      geometryComponents: {
        [componentAId]: fictionalComponent(componentAId, 'fictional-t0-linked-component'),
        [conflictComponentId]: fictionalComponent(conflictComponentId, 'fictional-private-linked-component'),
        [t3ComponentId]: fictionalComponent(t3ComponentId, 'fictional-t3-linked-component'),
      },
      associations: [
        association(nationAId, componentAId, 'verified'),
        association(retiredNationId, conflictComponentId, 'unresolved'),
        association(t3Id, t3ComponentId, 'verified'),
      ],
      relationships: [
        {
          relationshipId: 'fictional-admitted-link',
          fromNationId: nationAId,
          toNationId: nationBId,
          kind: 'related-not-merged',
          status: 'verified',
          reviewStatus: 'reviewed',
          provenance,
        },
        {
          relationshipId: 'fictional-t3-linked-relationship',
          fromNationId: t3Id,
          toNationId: nationAId,
          kind: 'related-not-merged',
          status: 'unresolved',
          reviewStatus: 'pending',
          provenance,
        },
      ],
      redirects: {
        version: 'fictional',
        entries: [
          {
            fromId: 'fictional-admitted-legacy',
            toIds: [nationAId],
            reason: 'legacy-id',
            effectiveDate: '2026-01-01',
            provenance,
          },
          {
            fromId: 'fictional-t2-legacy',
            toIds: [retiredNationId],
            reason: 'legacy-id',
            effectiveDate: '2026-01-01',
            provenance,
          },
          {
            fromId: t3Id,
            toIds: [nationBId],
            reason: 'recognition-change',
            effectiveDate: '2026-01-01',
            provenance,
          },
        ],
      },
      searchIndex: [
        { alias: 'Fictional T3 Search Alias', normalizedAlias: 'fictional t3 search alias', nationId: t3Id },
      ],
    });
    expect(Object.keys(loaded.nations).sort()).toEqual([nationAId, nationBId, nationCId].sort());
    expect(loaded.nations[t3Id]).toBeUndefined();
    expect(loaded.nations[retiredNationId]).toBeUndefined();
    expect(loaded.nations[unknownId]).toBeUndefined();
    expect(loaded.nations[nationAId]?.successorIds).toEqual([]);
    expect(loaded.nations[nationBId]?.predecessorIds).toEqual([]);
    expect(Object.keys(loaded.issuedNations).sort()).toEqual([nationAId, nationBId, nationCId].sort());
    expect(loaded.associations).toEqual([association(nationAId, componentAId, 'verified')]);
    expect(Object.keys(loaded.geometryComponents)).toEqual([componentAId]);
    expect(loaded.relationships.map(({ relationshipId }) => relationshipId)).toEqual(['fictional-admitted-link']);
    expect(loaded.redirects.entries.map(({ fromId }) => fromId)).toEqual(['fictional-admitted-legacy']);
    expect(new Set(loaded.searchIndex.map(({ nationId }) => nationId))).toEqual(new Set([nationAId, nationBId, nationCId]));
    expect(loaded.searchIndex.some(({ normalizedAlias }) => normalizedAlias === 'fictional t3 search alias')).toBe(false);
  });
});

describe('bundled public dataset', () => {
  it('is importable through the package export, valid, and empty', () => {
    expect(Object.keys(publicRegistry.nations)).toHaveLength(0);
    expect(Object.keys(publicRegistry.issuedNations)).toHaveLength(0);
    expect(validateTribalRegistry(publicRegistry).ok).toBe(true);
  });
});
