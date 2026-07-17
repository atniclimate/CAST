import type { IngestParser, ParseContext, ParseOutcome } from './contracts.js';
import { finalizeParseOutcome } from './finalize.js';
import { validateAlertProvenance } from './provenance.js';

export type CorpusFileReader = (absolutePath: string) => Promise<Uint8Array>;

export interface CorpusFixture<Payload> {
  /** Human-readable fixture label. Synthetic inputs must include "synthetic" in this label. */
  readonly label: string;
  readonly relativePath: string;
  readonly context: ParseContext;
  /** Decodes the exact bytes supplied by the harness into the parser's payload type. */
  readonly decode: (bytes: Uint8Array) => Payload;
  readonly expectedCompleteness?: ParseOutcome['completeness'];
}

export interface CorpusFixtureResult {
  readonly label: string;
  readonly relativePath: string;
  readonly byteLength: number;
  readonly inputSha256: string;
  readonly normalizedOutputSha256: string;
  readonly completeness: ParseOutcome['completeness'];
  readonly messageCount: number;
  readonly finalizedAlertCount: number;
  readonly failureCount: number;
  readonly diagnosticCounts: Readonly<Record<string, number>>;
  readonly unrecognizedVocabulary: readonly string[];
}

export interface CorpusReplayReport {
  readonly rootPath: string;
  readonly fixtureCount: number;
  readonly completeCount: number;
  readonly rejectedCount: number;
  readonly messageCount: number;
  readonly failureCount: number;
  readonly fixtures: readonly CorpusFixtureResult[];
}

export class CorpusReplayInvariantError extends Error {
  readonly fixtureLabel: string;

  constructor(fixtureLabel: string, message: string) {
    super(`Corpus fixture "${fixtureLabel}": ${message}`);
    this.name = 'CorpusReplayInvariantError';
    this.fixtureLabel = fixtureLabel;
  }
}

export function resolveCorpusFixturePath(rootPath: string, relativePath: string): string {
  if (rootPath.trim() === '') throw new Error('Corpus rootPath must not be empty');
  if (/^(?:[a-zA-Z]:|[\\/])/.test(relativePath)) {
    throw new Error(`Corpus fixture path must be relative: "${relativePath}"`);
  }
  const segments = relativePath.split(/[\\/]+/);
  if (segments.length === 0 || segments.some((segment) => segment === '' || segment === '..')) {
    throw new Error(`Corpus fixture path must stay below rootPath: "${relativePath}"`);
  }
  const separator = rootPath.includes('\\') && !rootPath.includes('/') ? '\\' : '/';
  return `${rootPath.replace(/[\\/]+$/, '')}${separator}${segments.join(separator)}`;
}

async function sha256(bytes: Uint8Array): Promise<string> {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  const digest = await globalThis.crypto.subtle.digest('SHA-256', buffer);
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, '0')).join('');
}

function countDiagnostics(outcome: ParseOutcome): Readonly<Record<string, number>> {
  const counts: Record<string, number> = {};
  for (const diagnostic of outcome.diagnostics) {
    counts[diagnostic.code] = (counts[diagnostic.code] ?? 0) + 1;
  }
  return Object.freeze(counts);
}

function assertOutcome(
  fixture: CorpusFixture<unknown>,
  outcome: ParseOutcome,
  repeated: ParseOutcome,
): void {
  if (JSON.stringify(outcome) !== JSON.stringify(repeated)) {
    throw new CorpusReplayInvariantError(fixture.label, 'parser output is not deterministic');
  }
  if (Number.isNaN(Date.parse(outcome.observedAt))) {
    throw new CorpusReplayInvariantError(fixture.label, 'observedAt is not parseable');
  }
  if (outcome.completeness === 'complete' && outcome.failures.length > 0) {
    throw new CorpusReplayInvariantError(
      fixture.label,
      'complete outcome contains item failures and would be a partial batch',
    );
  }
  if (outcome.completeness === 'rejected' && outcome.failures.length === 0) {
    throw new CorpusReplayInvariantError(
      fixture.label,
      'rejected outcome has no first-class failure',
    );
  }
  if (
    fixture.expectedCompleteness !== undefined &&
    fixture.expectedCompleteness !== outcome.completeness
  ) {
    throw new CorpusReplayInvariantError(
      fixture.label,
      `expected ${fixture.expectedCompleteness}, received ${outcome.completeness}`,
    );
  }
  const provenanceFailures = outcome.messages.flatMap((alert, index) =>
    validateAlertProvenance(alert, fixture.context, index),
  );
  if (provenanceFailures.length > 0) {
    throw new CorpusReplayInvariantError(
      fixture.label,
      `emitted invalid provenance: ${provenanceFailures.map(({ code }) => code).join(', ')}`,
    );
  }
}

/**
 * Replays exact fixture bytes below a caller-provided root. File access is injected so the
 * framework-free package has no filesystem or machine-path dependency.
 */
export async function replayCorpus<Payload>(
  rootPath: string,
  fixtures: readonly CorpusFixture<Payload>[],
  parser: IngestParser<Payload>,
  readFile: CorpusFileReader,
): Promise<CorpusReplayReport> {
  const results: CorpusFixtureResult[] = [];

  for (const fixture of fixtures) {
    const absolutePath = resolveCorpusFixturePath(rootPath, fixture.relativePath);
    const bytes = await readFile(absolutePath);
    const outcome = parser(fixture.decode(bytes), fixture.context);
    const repeated = parser(fixture.decode(bytes), fixture.context);
    assertOutcome(fixture, outcome, repeated);
    const finalized = finalizeParseOutcome(outcome, fixture.context);
    const normalizedBytes = new TextEncoder().encode(JSON.stringify(outcome.messages));
    const diagnosticCounts = countDiagnostics(outcome);
    const unrecognizedVocabulary = Object.keys(diagnosticCounts).filter((code) =>
      /unknown|unrecognized/.test(code),
    );
    results.push(
      Object.freeze({
        label: fixture.label,
        relativePath: fixture.relativePath,
        byteLength: bytes.byteLength,
        inputSha256: await sha256(bytes),
        normalizedOutputSha256: await sha256(normalizedBytes),
        completeness: outcome.completeness,
        messageCount: outcome.messages.length,
        finalizedAlertCount: finalized.accepted ? finalized.batch.alerts.length : 0,
        failureCount: outcome.failures.length,
        diagnosticCounts,
        unrecognizedVocabulary: Object.freeze(unrecognizedVocabulary),
      }),
    );
  }

  return Object.freeze({
    rootPath,
    fixtureCount: results.length,
    completeCount: results.filter(({ completeness }) => completeness === 'complete').length,
    rejectedCount: results.filter(({ completeness }) => completeness === 'rejected').length,
    messageCount: results.reduce((sum, result) => sum + result.messageCount, 0),
    failureCount: results.reduce((sum, result) => sum + result.failureCount, 0),
    fixtures: Object.freeze(results),
  });
}
