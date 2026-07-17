import { resolveAlertLifecycle } from '@ewm/alerts-schema';

import type {
  AlertBatch,
  FinalizeOutcome,
  IngestDiagnostic,
  ParseContext,
  ParseFailure,
  ParseOutcome,
} from './contracts.js';
import { validateAlertProvenance } from './provenance.js';

export const ECCC_MIXED_ACTIVE_COHORT_FAILURE = 'eccc-multiple-active-cohorts' as const;

function timestampFailure(value: string, label: string): ParseFailure | undefined {
  return Number.isNaN(Date.parse(value))
    ? { code: 'invalid-observation-time', message: `${label} is not parseable: "${value}"` }
    : undefined;
}

function validateMessage(
  alert: ParseOutcome['messages'][number],
  itemIndex: number,
): ParseFailure[] {
  const failures: ParseFailure[] = [];
  for (const [field, value] of [
    ['sent', alert.sent],
    ['effective', alert.effective],
    ['onset', alert.onset],
    ['expires', alert.expires],
  ] as const) {
    if (value !== undefined && value !== null && Number.isNaN(Date.parse(value))) {
      failures.push({
        code: 'invalid-message-timestamp',
        message: `Alert "${alert.alertId}" ${field} is not parseable: "${value}"`,
        itemIndex,
        ...(alert.provenance?.originalId === undefined
          ? {}
          : { originalId: alert.provenance.originalId }),
      });
    }
  }
  const languageBlocks = Object.values(alert.sourceLanguage);
  if (
    languageBlocks.length === 0 ||
    languageBlocks.some((block) => block.headline.trim() === '' || block.description.trim() === '')
  ) {
    failures.push({
      code: 'missing-source-text',
      message: `Alert "${alert.alertId}" has no complete source-authored language block`,
      itemIndex,
      ...(alert.provenance?.originalId === undefined
        ? {}
        : { originalId: alert.provenance.originalId }),
    });
  }
  return failures;
}

/**
 * The sole ingestion call site for `resolveAlertLifecycle`. It validates the complete
 * candidate first, resolves update and cancel chains once, and projects event currents.
 */
export function finalizeParseOutcome(
  outcome: ParseOutcome,
  context: ParseContext,
): FinalizeOutcome {
  const failures: ParseFailure[] = [...outcome.failures];
  const observedAtFailure = timestampFailure(outcome.observedAt, 'observedAt');
  if (observedAtFailure !== undefined) failures.push(observedAtFailure);
  if (outcome.sourceUpdatedAt !== undefined) {
    const sourceUpdatedAtFailure = timestampFailure(outcome.sourceUpdatedAt, 'sourceUpdatedAt');
    if (sourceUpdatedAtFailure !== undefined) failures.push(sourceUpdatedAtFailure);
  }
  outcome.messages.forEach((alert, index) => {
    failures.push(...validateMessage(alert, index));
    failures.push(...validateAlertProvenance(alert, context, index));
  });
  if (outcome.completeness === 'rejected' && failures.length === 0) {
    failures.push({
      code: 'batch-rejected',
      message: 'Parser rejected the candidate batch without an item failure',
    });
  }

  if (outcome.completeness !== 'complete' || failures.length > 0) {
    return Object.freeze({
      accepted: false,
      sourceId: context.source.id,
      observedAt: outcome.observedAt,
      diagnostics: Object.freeze([...outcome.diagnostics]),
      failures: Object.freeze(failures.map((item) => Object.freeze({ ...item }))),
    });
  }

  const lifecycle = resolveAlertLifecycle(outcome.messages, outcome.observedAt);
  const lifecycleDiagnostics: IngestDiagnostic[] = lifecycle.rejected.map((rejection) => ({
    code: `lifecycle-${rejection.reason}`,
    message: `Lifecycle rejected "${rejection.alertId}" for event "${rejection.eventId}"`,
    severity: 'warning',
    originalId: rejection.alertId,
  }));
  const alerts = lifecycle.events.flatMap(({ current }) => (current === null ? [] : [current]));
  const batch: AlertBatch = {
    sourceId: context.source.id,
    alerts: Object.freeze(alerts),
    observedAt: outcome.observedAt,
    ...(outcome.sourceUpdatedAt === undefined ? {} : { sourceUpdatedAt: outcome.sourceUpdatedAt }),
    mappingApplied: Object.freeze({ ...context.mapping }),
    diagnostics: Object.freeze([...outcome.diagnostics, ...lifecycleDiagnostics]),
    lifecycle,
  };

  return Object.freeze({ accepted: true, batch: Object.freeze(batch) });
}
