import { createAlertId, type AlertCoverage, type NormalizedAlert } from '@ewm/alerts-schema';

import type { ParseContext, ParseFailure } from './contracts.js';

export type UnstampedAlertMessage = Omit<
  NormalizedAlert,
  'alertId' | 'eventId' | 'sourceId' | 'references' | 'lifecycleState' | 'provenance'
>;

export interface ProvenanceStamp {
  readonly agency: string;
  readonly originalId: string;
  readonly references?: readonly string[];
  readonly coverage: AlertCoverage;
}

function requireText(value: string, label: string): void {
  if (value.trim() === '') throw new Error(`${label} must not be empty`);
}

function requireTimestamp(value: string, label: string): void {
  if (Number.isNaN(Date.parse(value))) {
    throw new Error(`${label} is not a parseable timestamp: "${value}"`);
  }
}

function namespaceReference(agency: string, reference: string): string {
  return reference.startsWith(`${agency}:`) ? reference : createAlertId(agency, reference);
}

/**
 * Creates the complete provenance envelope and namespaces message identity and CAP references.
 * Agency parsers should use this as the final construction step for every emitted message.
 */
export function stampAlertProvenance(
  message: UnstampedAlertMessage,
  context: ParseContext,
  stamp: ProvenanceStamp,
): NormalizedAlert {
  requireText(context.source.id, 'source id');
  requireTimestamp(context.fetchedAt, 'fetchedAt');
  requireText(context.mapping.name, 'mapping name');
  requireText(context.mapping.version, 'mapping version');
  requireText(stamp.agency, 'agency');
  requireText(stamp.originalId, 'originalId');

  const alertId = createAlertId(stamp.agency, stamp.originalId);
  return Object.freeze({
    ...message,
    alertId,
    eventId: alertId,
    sourceId: context.source.id,
    lifecycleState: 'active',
    references: Object.freeze(
      (stamp.references ?? []).map((reference) => namespaceReference(stamp.agency, reference)),
    ),
    provenance: Object.freeze({
      agency: stamp.agency,
      originalId: stamp.originalId,
      fetchedAt: context.fetchedAt,
      mappingApplied: Object.freeze({ ...context.mapping }),
      coverage: Object.freeze({
        geometryBasis: stamp.coverage.geometryBasis,
        geocodes: Object.freeze([...stamp.coverage.geocodes]),
      }),
    }),
  });
}

function failure(code: string, message: string, itemIndex?: number): ParseFailure {
  return itemIndex === undefined ? { code, message } : { code, message, itemIndex };
}

/** Returns first-class failures for any provenance field that is absent or inconsistent. */
export function validateAlertProvenance(
  alert: NormalizedAlert,
  context: ParseContext,
  itemIndex?: number,
): readonly ParseFailure[] {
  const failures: ParseFailure[] = [];
  const provenance = alert.provenance;

  if (alert.sourceId !== context.source.id) {
    failures.push(
      failure(
        'source-id-mismatch',
        `Alert "${alert.alertId}" belongs to source "${alert.sourceId}", expected "${context.source.id}"`,
        itemIndex,
      ),
    );
  }
  if (provenance === undefined || provenance === null) {
    failures.push(
      failure('missing-provenance', `Alert "${alert.alertId}" has no provenance`, itemIndex),
    );
    return failures;
  }
  if (typeof provenance.agency !== 'string' || provenance.agency.trim() === '') {
    failures.push(failure('missing-agency', `Alert "${alert.alertId}" has no agency`, itemIndex));
  }
  if (typeof provenance.originalId !== 'string' || provenance.originalId.trim() === '') {
    failures.push(
      failure('missing-original-id', `Alert "${alert.alertId}" has no originalId`, itemIndex),
    );
  }
  if (
    typeof provenance.fetchedAt !== 'string' ||
    Number.isNaN(Date.parse(provenance.fetchedAt)) ||
    provenance.fetchedAt !== context.fetchedAt
  ) {
    failures.push(
      failure(
        'invalid-fetched-at',
        `Alert "${alert.alertId}" fetchedAt does not match its parse context`,
        itemIndex,
      ),
    );
  }
  if (
    provenance.mappingApplied?.name !== context.mapping.name ||
    provenance.mappingApplied.version !== context.mapping.version
  ) {
    failures.push(
      failure(
        'mapping-mismatch',
        `Alert "${alert.alertId}" does not carry mapping ${context.mapping.name}@${context.mapping.version}`,
        itemIndex,
      ),
    );
  }
  if (
    provenance.coverage === undefined ||
    !['polygon', 'zone', 'point', 'none'].includes(provenance.coverage.geometryBasis) ||
    !Array.isArray(provenance.coverage.geocodes) ||
    provenance.coverage.geocodes.some((geocode) => typeof geocode !== 'string')
  ) {
    failures.push(
      failure('invalid-coverage', `Alert "${alert.alertId}" has incomplete coverage`, itemIndex),
    );
  }
  if (
    typeof provenance.agency === 'string' &&
    provenance.agency.trim() !== '' &&
    typeof provenance.originalId === 'string' &&
    provenance.originalId.trim() !== '' &&
    alert.alertId !== createAlertId(provenance.agency, provenance.originalId)
  ) {
    failures.push(
      failure(
        'alert-id-mismatch',
        `Alert "${alert.alertId}" is not namespaced from its provenance identity`,
        itemIndex,
      ),
    );
  }
  const prefix = `${provenance.agency}:`;
  if (
    typeof provenance.agency === 'string' &&
    alert.references.some((reference) => !reference.startsWith(prefix))
  ) {
    failures.push(
      failure(
        'unnamespaced-reference',
        `Alert "${alert.alertId}" contains a reference outside agency namespace "${prefix}"`,
        itemIndex,
      ),
    );
  }

  return Object.freeze(failures);
}
