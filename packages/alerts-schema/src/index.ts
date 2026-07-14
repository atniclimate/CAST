/**
 * @ewm/alerts-schema — the shared alert model.
 *
 * One normalized shape derived from CAP (Common Alerting Protocol) that both
 * NWS (api.weather.gov, US) and Environment and Climate Change Canada
 * (weather.gc.ca CAP feeds) map into. The future alerts backend and the
 * indigenousaccess.org companion systems will speak this type; modules never
 * see raw provider payloads.
 *
 * This package is types + pure normalizers only. No fetching, no endpoints —
 * those belong to the alerts backend workspace (see docs/ROADMAP.md) and must
 * go through the verified source registry.
 *
 * Framework-agnostic: vanilla TypeScript; only a GeoJSON type dependency.
 */

import type { Geometry } from 'geojson';

/** Which national system issued the alert. */
export type AlertRegion = 'us' | 'ca';

/** CAP severity, lowercased and closed over 'unknown'. */
export type AlertSeverity = 'extreme' | 'severe' | 'moderate' | 'minor' | 'unknown';

/** CAP urgency, lowercased and closed over 'unknown'. */
export type AlertUrgency = 'immediate' | 'expected' | 'future' | 'past' | 'unknown';

/** CAP certainty, lowercased and closed over 'unknown'. */
export type AlertCertainty = 'observed' | 'likely' | 'possible' | 'unlikely' | 'unknown';

/**
 * A normalized alert. Every field either exists in both NWS and ECCC CAP or
 * is explicitly nullable/optional so neither provider has to invent data.
 */
export interface Alert {
  /** Provider-scoped identifier, prefixed with the region ("us:..." / "ca:..."). */
  id: string;
  sourceRegion: AlertRegion;
  /** CAP <sender> — the issuing office/system. */
  sender: string;
  /** ISO 8601 instant the alert was sent. */
  sent: string;
  /** CAP <event>, e.g. "Flood Warning". Provider vocabulary, not normalized. */
  event: string;
  headline?: string;
  description?: string;
  instruction?: string;
  severity: AlertSeverity;
  urgency: AlertUrgency;
  certainty: AlertCertainty;
  /** ISO 8601 instant the alert takes effect (defaults to `sent`). */
  effective: string;
  /** ISO 8601 instant the hazard is expected to begin, when stated. */
  onset?: string;
  /** ISO 8601 expiry, or null for alerts with no stated expiry. */
  expires: string | null;
  /** Affected area, or null when the provider gave only an areaDesc. */
  geometry: Geometry | null;
  /** Human-readable affected-area description (CAP <areaDesc>). */
  areaDesc?: string;
  /** The untouched provider payload, retained for audit and debugging. */
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

export function normalizeSeverity(value: string | null | undefined): AlertSeverity {
  return normalizeEnum(value, ['extreme', 'severe', 'moderate', 'minor', 'unknown'], 'unknown');
}

export function normalizeUrgency(value: string | null | undefined): AlertUrgency {
  return normalizeEnum(value, ['immediate', 'expected', 'future', 'past', 'unknown'], 'unknown');
}

export function normalizeCertainty(value: string | null | undefined): AlertCertainty {
  return normalizeEnum(value, ['observed', 'likely', 'possible', 'unlikely', 'unknown'], 'unknown');
}

/**
 * The provider-agnostic subset a CAP adapter extracts before normalization.
 * NWS adapters fill this from GeoJSON feature properties; ECCC adapters from
 * CAP XML <info> blocks. Both are trivial projections.
 */
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

/**
 * Normalize a provider-extracted CAP alert into the shared Alert shape.
 * Throws when required identity fields are missing — an alert we cannot
 * identify or date is not an alert we can responsibly display.
 */
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
