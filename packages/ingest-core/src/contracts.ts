import type { AlertLifecycleResolution, MappingApplied, NormalizedAlert } from '@ewm/alerts-schema';
import type { SourceRecord } from '@ewm/sources';

/** Everything a pure agency parser may use from the outside world. */
export interface ParseContext {
  readonly source: SourceRecord;
  readonly fetchedAt: string;
  /** Exact mapping table name and version expected on every emitted message. */
  readonly mapping: MappingApplied;
}

export interface IngestDiagnostic {
  readonly code: string;
  readonly message: string;
  readonly severity: 'info' | 'warning' | 'error';
  readonly itemIndex?: number;
  readonly originalId?: string;
}

/** A rejected alert-like item. Any one of these makes the candidate batch non-committable. */
export interface ParseFailure {
  readonly code: string;
  readonly message: string;
  readonly itemIndex?: number;
  readonly originalId?: string;
}

export interface ParseOutcome {
  readonly messages: readonly NormalizedAlert[];
  /** Complete collection observation time, including for a valid empty collection. */
  readonly observedAt: string;
  readonly sourceUpdatedAt?: string;
  readonly diagnostics: readonly IngestDiagnostic[];
  readonly failures: readonly ParseFailure[];
  readonly completeness: 'complete' | 'rejected';
}

/** A parser is synchronous and pure. Payload decoding is part of the parser implementation. */
export type IngestParser<Payload = unknown> = (
  payload: Payload,
  context: ParseContext,
) => ParseOutcome;

export interface AlertBatch {
  readonly sourceId: string;
  readonly alerts: readonly NormalizedAlert[];
  readonly observedAt: string;
  readonly sourceUpdatedAt?: string;
  readonly mappingApplied: MappingApplied;
  readonly diagnostics: readonly IngestDiagnostic[];
  /** Includes tombstones and ordering rejections from the shared lifecycle resolver. */
  readonly lifecycle: AlertLifecycleResolution;
}

export interface FinalizedBatch {
  readonly accepted: true;
  readonly batch: AlertBatch;
}

export interface RejectedBatch {
  readonly accepted: false;
  readonly sourceId: string;
  readonly observedAt: string;
  readonly diagnostics: readonly IngestDiagnostic[];
  readonly failures: readonly ParseFailure[];
}

export type FinalizeOutcome = FinalizedBatch | RejectedBatch;
