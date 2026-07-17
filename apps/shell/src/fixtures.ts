import { createAlertEventGroup, type AlertEventGroup, type NormalizedAlert } from '@ewm/alerts-schema';
import { createAlertStore, type AlertStore } from '@ewm/alerts-schema/store';
import type { StatusSnapshot } from '@ewm/core-status';
import {
  loadTribalRegistry,
  mintNationId,
  type HazardContext,
  type NationEntity,
  type NationId,
  type NationIdSeed,
  type RoleBasedContact,
  type TribalRegistry,
} from '@ewm/tribal-registry';

export const FIXTURE_NOW = '2026-01-15T12:00:00.000Z';

const fixtureProvenance = {
  sourceId: 'shell-fictional-fixtures',
  citation: 'Fictional SHIELD shell fixture. Not a real Nation record.',
  retrievedDate: '2026-01-15',
  verifiedDate: '2026-01-15',
} as const;

const nationSeeds = [
  { authorityNamespace: 'shield-fixture', publicFeatureIds: ['cedar'] },
  { authorityNamespace: 'shield-fixture', publicFeatureIds: ['river'] },
  { authorityNamespace: 'shield-fixture', publicFeatureIds: ['coast'] },
] as const satisfies readonly NationIdSeed[];

export const FIXTURE_NATION_IDS = {
  cedar: mintNationId(nationSeeds[0]),
  river: mintNationId(nationSeeds[1]),
  coast: mintNationId(nationSeeds[2]),
} as const;

function roleContact(label: string): RoleBasedContact {
  return {
    office: `${label} Fixture Emergency Office`,
    title: 'Fixture duty desk',
    publicPhone: '555-0100',
    publicEmail: 'fixture@example.invalid',
    source: 'Fictional public office directory fixture',
    verifiedDate: '2026-01-15',
  };
}

function fixtureNation(
  nationId: NationId,
  name: string,
  contact: RoleBasedContact,
  hazardContext: HazardContext,
): NationEntity {
  return {
    nationId,
    status: 'active',
    predecessorIds: [],
    successorIds: [],
    names: [
      {
        value: { text: name, kind: 'display' },
        effectiveFrom: '2026-01-15',
        provenance: fixtureProvenance,
      },
    ],
    aliases: [
      {
        value: { text: name.replace('Fictional ', ''), kind: 'search' },
        effectiveFrom: '2026-01-15',
        provenance: fixtureProvenance,
      },
    ],
    contacts: [contact],
    idsDataTier: 'T1',
    hazardContext,
  };
}

const fixtureNationEntries = [
  fixtureNation(
    FIXTURE_NATION_IDS.cedar,
    'Fictional Cedar Nation',
    roleContact('Cedar'),
    { wildfireRisk: 'high' },
  ),
  fixtureNation(
    FIXTURE_NATION_IDS.river,
    'Fictional River Nation',
    roleContact('River'),
    { floodPlain: true, atmosphericRiverExposure: true },
  ),
  fixtureNation(
    FIXTURE_NATION_IDS.coast,
    'Fictional Coast Nation',
    roleContact('Coast'),
    { tsunamiZone: true, stormSurgeExposure: true },
  ),
] as const;

export const FIXTURE_TRIBAL_REGISTRY: TribalRegistry = loadTribalRegistry({
  version: '1.0.0-fixture',
  provenance: 'Fictional shell fixtures only. Contains no real Nation data.',
  issuedNations: Object.fromEntries(
    nationSeeds.map((seed) => {
      const nationId = mintNationId(seed);
      return [
        nationId,
        {
          seedAuthorityNamespace: seed.authorityNamespace,
          seedFeatureIds: [...seed.publicFeatureIds],
          issuedDate: '2026-01-15',
          status: 'active',
        },
      ];
    }),
  ),
  nations: Object.fromEntries(fixtureNationEntries.map((nation) => [nation.nationId, nation])),
  geometryComponents: {},
  associations: [],
  relationships: [],
  redirects: {
    version: '1.0.0-fixture',
    entries: [
      {
        fromId: 'fixture-legacy-river',
        toIds: [FIXTURE_NATION_IDS.river],
        reason: 'legacy-id',
        effectiveDate: '2026-01-15',
        provenance: fixtureProvenance,
      },
    ],
  },
  searchIndex: [],
});

function alert(
  sourceId: string,
  originalId: string,
  event: string,
  band: NormalizedAlert['band'],
  posture: NormalizedAlert['posture'],
  sent: string,
  geometryBasis: NormalizedAlert['provenance']['coverage']['geometryBasis'] = 'polygon',
): NormalizedAlert {
  return {
    alertId: `fixture-agency:${originalId}`,
    eventId: `fixture-event:${originalId}`,
    sourceId,
    sent,
    messageType: 'alert',
    references: [],
    lifecycleState: 'active',
    event,
    originalDesignation: `${event} Fixture`,
    band,
    posture,
    confidence: 'likely',
    effective: sent,
    expires: '2026-01-15T18:00:00.000Z',
    geometry: null,
    areaDesc: 'Fictional fixture coverage area',
    sourceLanguage: {
      'en-US': {
        headline: `${event} fixture headline`,
        description: 'PLACEHOLDER source-authored description fixture.',
      },
    },
    translationAuthority: 'Fictional fixture agency',
    provenance: {
      agency: 'Fictional fixture agency',
      originalId,
      fetchedAt: FIXTURE_NOW,
      mappingApplied: { name: 'shell-fixture', version: '1.0.0' },
      coverage: { geometryBasis, geocodes: geometryBasis === 'zone' ? ['FIXTURE-ZONE'] : [] },
    },
  };
}

export const ACTIVE_SEVERE_ALERT = alert(
  'fixture-severe',
  'severe-001',
  'Severe Weather Event',
  'severe',
  'act-now',
  '2026-01-15T11:55:00.000Z',
);

const CROSS_BORDER_US_ALERT = alert(
  'fixture-hydro',
  'hydro-us-001',
  'Cross-border Flood Event',
  'moderate',
  'prepare',
  '2026-01-15T11:40:00.000Z',
  'zone',
);

const CROSS_BORDER_CA_ALERT = alert(
  'fixture-hydro',
  'hydro-ca-001',
  'Cross-border Flood Event',
  'minor',
  'monitor',
  '2026-01-15T11:42:00.000Z',
);

export const CROSS_BORDER_EVENT_GROUP: AlertEventGroup = createAlertEventGroup(
  'fixture-cross-border-group',
  [CROSS_BORDER_US_ALERT, CROSS_BORDER_CA_ALERT],
  'Fictional cross-border watershed',
);

export type FixtureScenarioName = 'active' | 'unavailable' | 'quiet';

export interface FixtureScenario {
  readonly store: AlertStore;
  readonly registry: TribalRegistry;
  readonly eventGroups: readonly AlertEventGroup[];
  readonly statusExamples: Readonly<Record<'live' | 'cached' | 'stale' | 'degraded' | 'unavailable', StatusSnapshot>>;
}

export const FIXTURE_STATUS_EXAMPLES: FixtureScenario['statusExamples'] = {
  live: { state: 'live', asOf: '2026-01-15T11:58:00.000Z', detail: 'Fixture source current' },
  cached: { state: 'cached', asOf: '2026-01-15T11:45:00.000Z', detail: 'Fixture cache in use' },
  stale: { state: 'stale', asOf: '2026-01-15T08:00:00.000Z', detail: 'Fixture source overdue' },
  degraded: { state: 'degraded', asOf: '2026-01-15T07:30:00.000Z', detail: 'Fixture fallback is partial' },
  unavailable: { state: 'unavailable', asOf: null, detail: 'Fixture source has no data' },
};

export function createFixtureAlertStore(scenario: FixtureScenarioName): AlertStore {
  const store = createAlertStore({
    now: () => Date.parse(FIXTURE_NOW),
    requiredSources: [
      { sourceId: 'fixture-drought', freshForMs: 30 * 60 * 1000 },
      { sourceId: 'fixture-hydro', freshForMs: 30 * 60 * 1000 },
      { sourceId: 'fixture-severe', freshForMs: 30 * 60 * 1000 },
      { sourceId: 'fixture-winter', freshForMs: 30 * 60 * 1000 },
    ],
  });

  const freshAsOf = '2026-01-15T11:58:00.000Z';
  if (scenario === 'active') {
    store.commitSource('fixture-drought', [], freshAsOf);
    store.commitSource('fixture-hydro', [CROSS_BORDER_US_ALERT, CROSS_BORDER_CA_ALERT], '2026-01-15T08:00:00.000Z');
    store.commitSource('fixture-severe', [ACTIVE_SEVERE_ALERT], freshAsOf);
    store.commitSource('fixture-winter', [], freshAsOf);
  } else if (scenario === 'unavailable') {
    store.commitSource('fixture-drought', [], freshAsOf);
    store.commitSource('fixture-hydro', [], freshAsOf);
    store.commitSource('fixture-winter', [], freshAsOf);
    store.markSourceUnavailable('fixture-severe');
  } else {
    for (const sourceId of ['fixture-drought', 'fixture-hydro', 'fixture-severe', 'fixture-winter']) {
      store.commitSource(sourceId, [], freshAsOf);
    }
  }
  return store;
}

export function createFixtureScenario(scenario: FixtureScenarioName): FixtureScenario {
  return {
    store: createFixtureAlertStore(scenario),
    registry: FIXTURE_TRIBAL_REGISTRY,
    eventGroups: scenario === 'active' ? [CROSS_BORDER_EVENT_GROUP] : [],
    statusExamples: FIXTURE_STATUS_EXAMPLES,
  };
}
