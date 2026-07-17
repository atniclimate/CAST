import type { Geometry } from 'geojson';

/** @deprecated Use `NormalizedAlert.provenance.agency` and an agency source registry record. */
export type AlertRegion = 'us' | 'ca';

/** @deprecated Use `SeverityBand`; absent CAP severity maps to `unstated`. */
export type AlertSeverity = 'extreme' | 'severe' | 'moderate' | 'minor' | 'unknown';

/** @deprecated Use `ActionPosture`; urgency is an input to the posture mapping. */
export type AlertUrgency = 'immediate' | 'expected' | 'future' | 'past' | 'unknown';

/** @deprecated Use `AlertConfidence`; CAP `unlikely` maps to `unknown`. */
export type AlertCertainty = 'observed' | 'likely' | 'possible' | 'unlikely' | 'unknown';

/** @deprecated Use `NormalizedAlert`, whose provenance, language, and lifecycle fields are required. */
export interface Alert {
  id: string;
  sourceRegion: AlertRegion;
  sender: string;
  sent: string;
  event: string;
  headline?: string;
  description?: string;
  instruction?: string;
  severity: AlertSeverity;
  urgency: AlertUrgency;
  certainty: AlertCertainty;
  effective: string;
  onset?: string;
  expires: string | null;
  geometry: Geometry | null;
  areaDesc?: string;
  raw?: unknown;
}

function normalizeEnum<T extends string>(
  value: string | null | undefined,
  allowed: readonly T[],
  unknown: T,
): T {
  if (typeof value !== 'string') return unknown;
  const lowered = value.trim().toLowerCase() as T;
  return allowed.includes(lowered) ? lowered : unknown;
}

/** @deprecated Use `mapNwsAlert` or `mapEcccAlert`. */
export function normalizeSeverity(value: string | null | undefined): AlertSeverity {
  return normalizeEnum(value, ['extreme', 'severe', 'moderate', 'minor', 'unknown'], 'unknown');
}

/** @deprecated Use `mapNwsAlert` or `mapEcccAlert` to derive `ActionPosture`. */
export function normalizeUrgency(value: string | null | undefined): AlertUrgency {
  return normalizeEnum(value, ['immediate', 'expected', 'future', 'past', 'unknown'], 'unknown');
}

/** @deprecated Use `mapNwsAlert` or `mapEcccAlert` to derive `AlertConfidence`. */
export function normalizeCertainty(value: string | null | undefined): AlertCertainty {
  return normalizeEnum(value, ['observed', 'likely', 'possible', 'unlikely', 'unknown'], 'unknown');
}

/** @deprecated Parser lanes should construct `NormalizedAlert` with required provenance. */
export interface CapAlertInput {
  id: string;
  sender: string;
  sent: string;
  event: string;
  headline?: string | null;
  description?: string | null;
  instruction?: string | null;
  severity?: string | null;
  urgency?: string | null;
  certainty?: string | null;
  effective?: string | null;
  onset?: string | null;
  expires?: string | null;
  geometry?: Geometry | null;
  areaDesc?: string | null;
  raw?: unknown;
}

/** @deprecated Parser lanes should construct `NormalizedAlert` and use the exported mapping tables. */
export function normalizeCapAlert(input: CapAlertInput, region: AlertRegion): Alert {
  for (const field of ['id', 'sender', 'sent', 'event'] as const) {
    if (typeof input[field] !== 'string' || input[field].trim() === '') {
      throw new Error(`CAP alert is missing required field "${field}"`);
    }
  }
  if (Number.isNaN(Date.parse(input.sent))) {
    throw new Error(`CAP alert "sent" is not a parseable timestamp: "${input.sent}"`);
  }

  const alert: Alert = {
    id: `${region}:${input.id}`,
    sourceRegion: region,
    sender: input.sender,
    sent: input.sent,
    event: input.event,
    severity: normalizeSeverity(input.severity),
    urgency: normalizeUrgency(input.urgency),
    certainty: normalizeCertainty(input.certainty),
    effective: input.effective ?? input.sent,
    expires: input.expires ?? null,
    geometry: input.geometry ?? null,
  };

  if (input.headline != null) alert.headline = input.headline;
  if (input.description != null) alert.description = input.description;
  if (input.instruction != null) alert.instruction = input.instruction;
  if (input.onset != null) alert.onset = input.onset;
  if (input.areaDesc != null) alert.areaDesc = input.areaDesc;
  if (input.raw !== undefined) alert.raw = input.raw;

  return alert;
}
