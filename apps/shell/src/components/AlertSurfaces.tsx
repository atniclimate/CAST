import type { AlertEventGroup, NormalizedAlert, SeverityBand } from '@ewm/alerts-schema';
import { severityBand } from '@ewm/design-tokens';
import { HAZARD_MODULES, selectHeroAlert } from '../logic.js';

function titleCase(value: string): string {
  return value.replaceAll('-', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function BandBadge({ band }: { readonly band: SeverityBand }) {
  const colors = severityBand[band];
  return (
    <span className="badge badge--band" style={{ backgroundColor: colors.bg, color: colors.ink }}>
      Band: {titleCase(band)}
    </span>
  );
}

export function PostureBadge({ posture }: { readonly posture: NormalizedAlert['posture'] }) {
  return <span className={`badge badge--posture badge--posture-${posture}`}>Posture: {titleCase(posture)}</span>;
}

function moduleName(sourceId: string): string {
  return HAZARD_MODULES.find((module) => module.sourceId === sourceId)?.name ?? 'Hazard alert';
}

export function HeroBanner({ alerts }: { readonly alerts: readonly NormalizedAlert[] }) {
  const hero = selectHeroAlert(alerts);
  if (hero === null) return null;
  const headline = Object.values(hero.sourceLanguage)[0]?.headline ?? hero.event;
  return (
    <section className="hero-banner" aria-labelledby="hero-heading">
      <p className="eyebrow">Highest active alert · {moduleName(hero.sourceId)}</p>
      <h2 id="hero-heading">{headline}</h2>
      <div className="badge-row">
        <BandBadge band={hero.band} />
        <PostureBadge posture={hero.posture} />
      </div>
      <p className="placeholder-slot">PLACEHOLDER: sourced protective-action and safety-resource slot.</p>
    </section>
  );
}

export function SemanticAlertList({
  alerts,
  eventGroups,
}: {
  readonly alerts: readonly NormalizedAlert[];
  readonly eventGroups: readonly AlertEventGroup[];
}) {
  return (
    <section className="alert-list" aria-labelledby="alert-list-heading">
      <div className="section-heading">
        <p className="eyebrow">Canonical accessible surface</p>
        <h2 id="alert-list-heading">Active alerts</h2>
      </div>
      {alerts.length === 0 ? (
        <p>No active alerts are present in this fixture snapshot.</p>
      ) : (
        <ol>
          {alerts.map((alert) => (
            <li key={alert.alertId}>
              <div>
                <strong>{Object.values(alert.sourceLanguage)[0]?.headline ?? alert.event}</strong>
                <span>{moduleName(alert.sourceId)} · {alert.provenance.coverage.geometryBasis} coverage</span>
              </div>
              <div className="badge-row">
                <BandBadge band={alert.band} />
                <PostureBadge posture={alert.posture} />
              </div>
            </li>
          ))}
        </ol>
      )}
      {eventGroups.map((group) => (
        <p className="event-group" key={group.id}>
          <strong>Cross-border event group:</strong> {group.watershed ?? group.id}. {group.highest.memberCount} source alerts remain separate. Highest member band: {group.highest.band}.
        </p>
      ))}
    </section>
  );
}
