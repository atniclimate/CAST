import type { NormalizedAlert, SeverityBand } from '@ewm/alerts-schema';
import type { AlertSourceSnapshot, AlertStoreSnapshot } from '@ewm/alerts-schema/store';
import { severityBandOrder } from '@ewm/design-tokens';

export type HazardModuleId = 'drought' | 'hydro' | 'severe' | 'winter';

export interface HazardModuleDefinition {
  readonly id: HazardModuleId;
  readonly name: string;
  readonly sourceId: string;
}

export const HAZARD_MODULES: readonly HazardModuleDefinition[] = [
  { id: 'drought', name: 'Drought & Heat', sourceId: 'fixture-drought' },
  { id: 'hydro', name: 'Flood & Coastal', sourceId: 'fixture-hydro' },
  { id: 'severe', name: 'Severe Weather', sourceId: 'fixture-severe' },
  { id: 'winter', name: 'Snow & Ice', sourceId: 'fixture-winter' },
];

const bandRank = new Map<SeverityBand, number>(
  severityBandOrder.map((band, index) => [band, severityBandOrder.length - index]),
);

export function selectHeroAlert(alerts: readonly NormalizedAlert[]): NormalizedAlert | null {
  return (
    [...alerts]
      .filter(({ lifecycleState }) => lifecycleState === 'active')
      .sort((left, right) => {
        const severityDifference = (bandRank.get(right.band) ?? 0) - (bandRank.get(left.band) ?? 0);
        if (severityDifference !== 0) return severityDifference;
        const moduleDifference =
          HAZARD_MODULES.findIndex(({ sourceId }) => sourceId === left.sourceId) -
          HAZARD_MODULES.findIndex(({ sourceId }) => sourceId === right.sourceId);
        if (moduleDifference !== 0) return moduleDifference;
        return right.sent.localeCompare(left.sent);
      })[0] ?? null
  );
}

export type ConditionPresentation = 'active' | 'quiet' | 'failure';

export function conditionPresentation(snapshot: AlertStoreSnapshot): ConditionPresentation {
  if (snapshot.activeAlerts.length > 0) return 'active';
  return snapshot.quietEligible ? 'quiet' : 'failure';
}

export function sourceAsOf(source: AlertSourceSnapshot | undefined): string | null {
  return source?.asOf ?? source?.lastSuccessfulCommitAt ?? null;
}
