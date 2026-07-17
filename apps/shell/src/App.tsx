import type { AlertEventGroup } from '@ewm/alerts-schema';
import type { AlertStore } from '@ewm/alerts-schema/store';
import {
  parseViewState,
  serializeViewState,
  type UrlStateBus,
  type ViewState,
} from '@ewm/core-state';
import type { StatusSnapshot } from '@ewm/core-status';
import { resolveNationSelection, type NationEntity, type TribalRegistry } from '@ewm/tribal-registry';
import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { HeroBanner, SemanticAlertList } from './components/AlertSurfaces.js';
import {
  FailureState,
  HazardCardGrid,
  HonestStatusGallery,
  QuietState,
} from './components/Dashboard.js';
import { LocationSelector } from './components/LocationSelector.js';
import { MapPlaceholder } from './components/MapPlaceholder.js';
import { NationContacts } from './components/NationContacts.js';

const DEFAULT_VIEW: ViewState = { center: [-120.5, 47.25], zoom: 4 };

export interface AppProps {
  readonly store: AlertStore;
  readonly registry: TribalRegistry;
  readonly eventGroups: readonly AlertEventGroup[];
  readonly statusExamples: Readonly<Record<string, StatusSnapshot>>;
  readonly urlBus: UrlStateBus;
}

function selectedNation(
  registry: TribalRegistry,
  requestedNationId: string | undefined,
): { readonly nation: NationEntity | null; readonly canonicalId: string | null; readonly redirected: boolean } {
  if (requestedNationId === undefined) return { nation: null, canonicalId: null, redirected: false };
  const resolution = resolveNationSelection(registry, requestedNationId);
  if (resolution.kind !== 'resolved') return { nation: null, canonicalId: null, redirected: false };
  return {
    nation: registry.nations[resolution.nationId] ?? null,
    canonicalId: resolution.nationId,
    redirected: resolution.redirected,
  };
}

export function App({ store, registry, eventGroups, statusExamples, urlBus }: AppProps) {
  const subscribeStore = useCallback((listener: () => void) => store.subscribe(listener), [store]);
  const readStore = useCallback(() => store.getSnapshot(), [store]);
  const subscribeUrl = useCallback(
    (listener: (serialized: string) => void) => urlBus.subscribe(listener),
    [urlBus],
  );
  const readUrl = useCallback(() => urlBus.read(), [urlBus]);
  const snapshot = useSyncExternalStore(subscribeStore, readStore, readStore);
  const serializedView = useSyncExternalStore(subscribeUrl, readUrl, readUrl);
  const view = parseViewState(serializedView) ?? DEFAULT_VIEW;
  const selection = selectedNation(registry, view.nation);

  useEffect(() => {
    if (selection.redirected && selection.canonicalId !== null) {
      urlBus.write(serializeViewState({ ...view, nation: selection.canonicalId }));
    }
  }, [selection.redirected, selection.canonicalId, serializedView, urlBus]);

  const writeSelection = (nationId: string | null) => {
    const next: ViewState = { ...view };
    if (nationId === null) delete next.nation;
    else next.nation = nationId;
    urlBus.write(serializeViewState(next), { replace: false });
  };

  return (
    <div className="app-shell">
      <header className="site-header">
        <div>
          <p className="eyebrow">ATNI-CAST fixture preview</p>
          <h1>SHIELD</h1>
          <p>Severe Hazards Intelligence & Emergency Link Dashboard</p>
        </div>
        <span className="fixture-flag">FIXTURE DATA ONLY</span>
      </header>
      <main>
        <LocationSelector
          registry={registry}
          view={view}
          selectedNationId={selection.canonicalId}
          onSelect={writeSelection}
        />
        <NationContacts nation={selection.nation} selectedNationId={selection.canonicalId} />
        <HeroBanner alerts={snapshot.activeAlerts} />
        <QuietState snapshot={snapshot} hazardContext={selection.nation?.hazardContext} />
        <FailureState snapshot={snapshot} />
        <HazardCardGrid snapshot={snapshot} />
        <SemanticAlertList alerts={snapshot.activeAlerts} eventGroups={eventGroups} />
        <MapPlaceholder />
        <HonestStatusGallery examples={statusExamples} />
      </main>
      <footer>
        <p>SHIELD shell fixture. No live network requests, real alerts, or real Nation records.</p>
      </footer>
    </div>
  );
}
