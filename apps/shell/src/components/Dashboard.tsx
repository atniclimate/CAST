import type { NormalizedAlert, SeverityBand } from '@ewm/alerts-schema';
import type { AlertSourceSnapshot, AlertStoreSnapshot } from '@ewm/alerts-schema/store';
import type { StatusSnapshot } from '@ewm/core-status';
import type { HazardContext } from '@ewm/tribal-registry';
import { HAZARD_MODULES, conditionPresentation, sourceAsOf } from '../logic.js';
import { BandBadge, PostureBadge } from './AlertSurfaces.js';
import { formatAsOf, StatusDisplay } from './StatusDisplay.js';

function statusFromSource(source: AlertSourceSnapshot | undefined): StatusSnapshot {
  if (source === undefined || source.status === 'unavailable') {
    return { state: 'unavailable', asOf: null, detail: 'Required fixture source has no data' };
  }
  if (source.status === 'stale') {
    return { state: 'stale', asOf: sourceAsOf(source), detail: 'Required fixture source is overdue' };
  }
  return { state: 'live', asOf: sourceAsOf(source), detail: 'Required fixture source is current' };
}

function highestModuleAlert(alerts: readonly NormalizedAlert[]): NormalizedAlert | null {
  const rank: Readonly<Record<SeverityBand, number>> = {
    extreme: 5,
    severe: 4,
    moderate: 3,
    minor: 2,
    unstated: 1,
  };
  return [...alerts].sort((left, right) => rank[right.band] - rank[left.band])[0] ?? null;
}

function HazardCard({
  name,
  alerts,
  source,
}: {
  readonly name: string;
  readonly alerts: readonly NormalizedAlert[];
  readonly source: AlertSourceSnapshot | undefined;
}) {
  const lead = highestModuleAlert(alerts);
  const band = lead?.band ?? 'unstated';
  const posture = lead?.posture ?? 'monitor';
  const summary = lead === null
    ? source?.status === 'unavailable'
      ? 'Required fixture source has no displayable data.'
      : 'No active alerts in this fixture snapshot.'
    : Object.values(lead.sourceLanguage)[0]?.headline ?? lead.event;
  return (
    <article className="hazard-card">
      <div className="hazard-card__heading">
        <h3>{name}</h3>
        <strong className="active-count">{alerts.length} active</strong>
      </div>
      <div className="badge-row">
        <BandBadge band={band} />
        <PostureBadge posture={posture} />
      </div>
      <p className="hazard-card__summary">{summary}</p>
      <StatusDisplay snapshot={statusFromSource(source)} compact />
      {lead !== null ? <p className="placeholder-slot">PLACEHOLDER: sourced safety guidance and resources.</p> : null}
    </article>
  );
}

export function HazardCardGrid({ snapshot }: { readonly snapshot: AlertStoreSnapshot }) {
  return (
    <section aria-labelledby="module-heading">
      <div className="section-heading">
        <p className="eyebrow">Fixed canonical order</p>
        <h2 id="module-heading">Hazard modules</h2>
      </div>
      <div className="hazard-grid">
        {HAZARD_MODULES.map((module) => (
          <HazardCard
            key={module.id}
            name={module.name}
            alerts={snapshot.activeAlerts.filter(({ sourceId }) => sourceId === module.sourceId)}
            source={snapshot.sources[module.sourceId]}
          />
        ))}
      </div>
    </section>
  );
}

function richQuietMode(hazardContext: HazardContext | undefined): boolean {
  if (hazardContext === undefined) return false;
  return Object.values(hazardContext).some((value) => value === true || (typeof value === 'string' && value !== ''));
}

export function QuietState({
  snapshot,
  hazardContext,
}: {
  readonly snapshot: AlertStoreSnapshot;
  readonly hazardContext: HazardContext | undefined;
}) {
  if (conditionPresentation(snapshot) !== 'quiet') return null;
  const latestCheck = Object.values(snapshot.sources)
    .map(({ asOf }) => asOf)
    .filter((value): value is string => value !== null)
    .sort()
    .at(-1) ?? null;
  const rich = richQuietMode(hazardContext);
  return (
    <section className={`quiet-state quiet-state--${rich ? 'rich' : 'compact'}`} aria-labelledby="quiet-heading">
      <div className="quiet-state__all-clear">
        <p className="eyebrow">Monitoring heartbeat</p>
        <h2 id="quiet-heading">Conditions normal in the fixture snapshot</h2>
        <p role="status">All required sources are fresh. Last checked {formatAsOf(latestCheck)}.</p>
      </div>
      <article>
        <h3>Seasonal preparedness</h3>
        <p>PLACEHOLDER: editorial seasonal-preparedness slot. No Nation-specific guidance is authored here.</p>
      </article>
      <article>
        <h3>Ambient conditions</h3>
        <p>PLACEHOLDER: sourced ambient-conditions slot.</p>
      </article>
    </section>
  );
}

export function FailureState({ snapshot }: { readonly snapshot: AlertStoreSnapshot }) {
  if (conditionPresentation(snapshot) !== 'failure') return null;
  const blockedSources = Object.values(snapshot.sources).filter(({ status }) => status !== 'fresh');
  return (
    <section className="failure-state" aria-labelledby="failure-heading">
      <p className="eyebrow">Monitoring incomplete</p>
      <h2 id="failure-heading">Conditions cannot be confirmed</h2>
      <p role="status">One or more required fixture sources are stale or unavailable. The affirmative quiet state is withheld.</p>
      <ul>
        {blockedSources.map((source) => (
          <li key={source.sourceId}>
            {source.sourceId}: {source.status}. As of {formatAsOf(sourceAsOf(source))}.
          </li>
        ))}
      </ul>
    </section>
  );
}

export function HonestStatusGallery({ examples }: { readonly examples: Readonly<Record<string, StatusSnapshot>> }) {
  return (
    <section className="status-gallery" aria-labelledby="status-heading">
      <div className="section-heading">
        <p className="eyebrow">Reusable presentations</p>
        <h2 id="status-heading">Honest source status</h2>
      </div>
      <div className="status-gallery__grid">
        {Object.entries(examples).map(([name, snapshot]) => <StatusDisplay key={name} snapshot={snapshot} />)}
      </div>
    </section>
  );
}
