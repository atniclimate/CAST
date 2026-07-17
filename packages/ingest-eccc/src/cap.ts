import { mapEcccAlert, type NormalizedAlert } from '@ewm/alerts-schema';
import {
  ECCC_MIXED_ACTIVE_COHORT_FAILURE,
  type IngestParser,
  type ParseContext,
  type ParseFailure,
  type ParseOutcome,
} from '@ewm/ingest-core';
import { XMLParser, XMLValidator } from 'fast-xml-parser';

import { normalizeEcccAlert } from './normalizer.js';
import type { EcccAlertInput, EcccLanguageInput } from './types.js';
import {
  optionalString,
  requireRecord,
  requireString,
  requireTimestamp,
  unique,
  type UnknownRecord,
} from './validation.js';

const UTF8 = new TextDecoder('utf-8', { fatal: true });
const ARRAY_TAGS = new Set(['info', 'area', 'parameter', 'geocode', 'polygon']);

/*
 * CAP-CP is untrusted XML. The parser keeps values as strings
 * (`parseTagValue: false`, `parseAttributeValue: false`), rejects boolean
 * attributes, trims element text, and forces repeated CAP elements to arrays.
 * Entity substitution is disabled (`processEntities: false`) along with the
 * HTML entity table (`htmlEntities: false`). We also reject DOCTYPE/ENTITY
 * declarations before validation, so no DTD is ever handed to the parser.
 * Attributes are ignored because normalization consumes CAP elements only.
 */
const CAP_XML_OPTIONS = Object.freeze({
  ignoreAttributes: true,
  allowBooleanAttributes: false,
  parseTagValue: false,
  parseAttributeValue: false,
  trimValues: true,
  processEntities: false,
  htmlEntities: false,
  isArray: (tagName: string): boolean => ARRAY_TAGS.has(tagName),
});

const CAP_XML_PARSER = new XMLParser(CAP_XML_OPTIONS);

interface CapInfoCandidate {
  readonly language: EcccLanguageInput;
  readonly event: string;
  readonly originalDesignation: string;
  readonly alertType?: string;
  readonly severity?: string;
  readonly urgency?: string;
  readonly certainty?: string;
  readonly mscImpact?: string;
  readonly colour?: string;
  readonly locationStatus?: string;
  readonly effective: string;
  readonly onset?: string;
  readonly expires: string | null;
  readonly geometry: NormalizedAlert['geometry'];
  readonly geometryBasis: EcccAlertInput['geometryBasis'];
  readonly geocodes: readonly string[];
  readonly areaDesc?: string;
}

function failure(code: string, message: string, originalId?: string): ParseFailure {
  return originalId === undefined
    ? { code, message, itemIndex: 0 }
    : { code, message, itemIndex: 0, originalId };
}

function recordArray(value: unknown, label: string): readonly UnknownRecord[] {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array`);
  return value.map((entry, index) => requireRecord(entry, `${label}[${index}]`));
}

function parameterValue(info: UnknownRecord, suffix: string): string | undefined {
  const parameters = info.parameter === undefined ? [] : recordArray(info.parameter, 'info.parameter');
  for (const parameter of parameters) {
    const name = optionalString(parameter.valueName);
    if (name?.toLowerCase().endsWith(suffix.toLowerCase()) === true) {
      return optionalString(parameter.value);
    }
  }
  return undefined;
}

function closeRing(ring: [number, number][]): [number, number][] {
  const first = ring[0];
  const last = ring.at(-1);
  if (first !== undefined && last !== undefined && (first[0] !== last[0] || first[1] !== last[1])) {
    ring.push([first[0], first[1]]);
  }
  return ring;
}

function parseCapPolygon(value: string, label: string): [number, number][] {
  const ring = value
    .trim()
    .split(/\s+/)
    .map((position) => {
      const [latitudeText, longitudeText, extra] = position.split(',');
      const latitude = Number(latitudeText);
      const longitude = Number(longitudeText);
      if (
        extra !== undefined ||
        latitudeText === undefined ||
        longitudeText === undefined ||
        !Number.isFinite(latitude) ||
        !Number.isFinite(longitude) ||
        latitude < -90 ||
        latitude > 90 ||
        longitude < -180 ||
        longitude > 180
      ) {
        throw new Error(`${label} contains an invalid CAP latitude,longitude position`);
      }
      return [longitude, latitude] as [number, number];
    });
  closeRing(ring);
  if (ring.length < 4) throw new Error(`${label} must contain at least four closed positions`);
  return ring;
}

function coverage(info: UnknownRecord): Pick<
  CapInfoCandidate,
  'geometry' | 'geometryBasis' | 'geocodes' | 'areaDesc'
> {
  const areas = info.area === undefined ? [] : recordArray(info.area, 'info.area');
  const polygons: [number, number][][] = [];
  const geocodes: string[] = [];
  const areaDescriptions: string[] = [];

  areas.forEach((area, areaIndex) => {
    const areaDesc = optionalString(area.areaDesc);
    if (areaDesc !== undefined) areaDescriptions.push(areaDesc);
    if (area.polygon !== undefined) {
      if (!Array.isArray(area.polygon)) throw new Error(`info.area[${areaIndex}].polygon must be an array`);
      area.polygon.forEach((polygon, polygonIndex) => {
        polygons.push(
          parseCapPolygon(
            requireString(polygon, `info.area[${areaIndex}].polygon[${polygonIndex}]`),
            `info.area[${areaIndex}].polygon[${polygonIndex}]`,
          ),
        );
      });
    }
    if (area.geocode !== undefined) {
      recordArray(area.geocode, `info.area[${areaIndex}].geocode`).forEach((geocode) => {
        const name = requireString(geocode.valueName, 'geocode.valueName');
        const value = requireString(geocode.value, 'geocode.value');
        geocodes.push(`${name}:${value}`);
      });
    }
  });

  let geometry: NormalizedAlert['geometry'] = null;
  if (polygons.length === 1) {
    geometry = { type: 'Polygon', coordinates: [polygons[0] ?? []] };
  } else if (polygons.length > 1) {
    geometry = {
      type: 'MultiPolygon',
      coordinates: polygons.map((polygon) => [polygon]),
    };
  }

  const result: {
    geometry: NormalizedAlert['geometry'];
    geometryBasis: EcccAlertInput['geometryBasis'];
    geocodes: readonly string[];
    areaDesc?: string;
  } = {
    geometry,
    geometryBasis: polygons.length > 0 ? 'polygon' : geocodes.length > 0 ? 'zone' : 'none',
    geocodes: unique(geocodes),
  };
  if (areaDescriptions.length > 0) result.areaDesc = unique(areaDescriptions).join('; ');
  return result;
}

function parseInfo(value: UnknownRecord, index: number): CapInfoCandidate {
  const languageTag = requireString(value.language, `info[${index}].language`);
  const headline = requireString(value.headline, `info[${index}].headline`);
  const description = requireString(value.description, `info[${index}].description`);
  const language: EcccLanguageInput = { language: languageTag, headline, description };
  const instruction = optionalString(value.instruction);
  if (instruction !== undefined) language.instruction = instruction;

  const effective = requireTimestamp(value.effective, `info[${index}].effective`);
  const expires = optionalString(value.expires);
  if (expires !== undefined) requireTimestamp(expires, `info[${index}].expires`);
  const onset = optionalString(value.onset);
  if (onset !== undefined) requireTimestamp(onset, `info[${index}].onset`);

  const alertName = parameterValue(value, ':Alert_Name');
  const result: CapInfoCandidate = {
    language,
    event: requireString(value.event, `info[${index}].event`),
    originalDesignation: alertName ?? headline,
    effective,
    expires: expires ?? null,
    ...coverage(value),
  };
  const optionalFields = {
    alertType: parameterValue(value, ':Alert_Type'),
    severity: optionalString(value.severity),
    urgency: optionalString(value.urgency),
    certainty: optionalString(value.certainty),
    mscImpact: parameterValue(value, ':MSC_Impact'),
    colour: parameterValue(value, ':Colour'),
    locationStatus: parameterValue(value, ':Alert_Location_Status'),
    onset,
  };
  for (const [key, fieldValue] of Object.entries(optionalFields)) {
    if (fieldValue !== undefined) {
      (result as unknown as Record<string, unknown>)[key] = fieldValue;
    }
  }
  return result;
}

function isEnded(candidate: CapInfoCandidate): boolean {
  const status = candidate.locationStatus?.trim().toLowerCase();
  return status === 'ended' || status === 'terminée' || status === 'terminé';
}

function cohortSignature(candidate: CapInfoCandidate): string {
  const mapped = mapEcccAlert({
    mscImpact: candidate.mscImpact ?? null,
    colour: candidate.colour ?? null,
    severity: candidate.severity ?? null,
    urgency: candidate.urgency ?? null,
    certainty: candidate.certainty ?? null,
    event: candidate.alertType ?? null,
    ended: isEnded(candidate),
  });
  return JSON.stringify({
    band: mapped.band,
    posture: mapped.posture,
    confidence: mapped.confidence,
    effective: candidate.effective,
    onset: candidate.onset ?? null,
    expires: candidate.expires,
    ended: isEnded(candidate),
    alertType: candidate.alertType?.toLowerCase() ?? '',
    geometry: candidate.geometry,
    geocodes: candidate.geocodes,
  });
}

function references(value: unknown): readonly string[] {
  const text = optionalString(value);
  if (text === undefined) return [];
  const identifiers: string[] = [];
  const pattern = /(?:^|\s)[^,\s]+,([^,\s]+),[^\s]+/g;
  for (const match of text.matchAll(pattern)) {
    const identifier = match[1];
    if (identifier !== undefined) identifiers.push(identifier);
  }
  return unique(identifiers);
}

function messageType(value: unknown): EcccAlertInput['messageType'] {
  switch (requireString(value, 'alert.msgType').toLowerCase()) {
    case 'alert':
      return 'alert';
    case 'update':
      return 'update';
    case 'cancel':
      return 'cancel';
    default:
      throw new Error('alert.msgType must be Alert, Update, or Cancel');
  }
}

function parseXml(payload: Uint8Array): UnknownRecord {
  const xml = UTF8.decode(payload);
  if (/<!\s*(?:DOCTYPE|ENTITY)\b/i.test(xml)) {
    throw new Error('CAP-CP XML must not contain DOCTYPE or ENTITY declarations');
  }
  const validation = XMLValidator.validate(xml, { allowBooleanAttributes: false });
  if (validation !== true) throw new Error(`invalid CAP-CP XML: ${validation.err.msg}`);
  const document: unknown = CAP_XML_PARSER.parse(xml) as unknown;
  return requireRecord(requireRecord(document, 'CAP-CP document').alert, 'alert');
}

/** Pure conformance parser for one ECCC Datamart CAP-CP document. */
export const parseEcccCapCp: IngestParser<Uint8Array> = (
  payload: Uint8Array,
  context: ParseContext,
): ParseOutcome => {
  let alert: UnknownRecord;
  let originalId: string | undefined;
  try {
    alert = parseXml(payload);
    originalId = requireString(alert.identifier, 'alert.identifier');
    const sent = requireTimestamp(alert.sent, 'alert.sent');
    const candidates = recordArray(alert.info, 'alert.info').map(parseInfo);
    if (candidates.length === 0) throw new Error('alert.info must contain at least one block');

    const active = candidates.filter((candidate) => !isEnded(candidate));
    const selectedPool = active.length > 0 ? active : candidates;
    const cohorts = new Map<string, CapInfoCandidate[]>();
    for (const candidate of selectedPool) {
      const signature = cohortSignature(candidate);
      const cohort = cohorts.get(signature) ?? [];
      cohort.push(candidate);
      cohorts.set(signature, cohort);
    }
    if (cohorts.size !== 1) {
      return {
        messages: [],
        observedAt: context.fetchedAt,
        sourceUpdatedAt: sent,
        diagnostics: [],
        failures: [
          failure(
            ECCC_MIXED_ACTIVE_COHORT_FAILURE,
            `CAP-CP alert contains ${cohorts.size} incompatible active cohorts`,
            originalId,
          ),
        ],
        completeness: 'rejected',
      };
    }

    const cohort = [...cohorts.values()][0];
    if (cohort === undefined) throw new Error('CAP-CP cohort selection failed');
    const byLanguage = new Map<string, CapInfoCandidate>();
    for (const candidate of cohort) {
      if (byLanguage.has(candidate.language.language)) {
        throw new Error(`duplicate info language: "${candidate.language.language}"`);
      }
      byLanguage.set(candidate.language.language, candidate);
    }
    const canonical = byLanguage.get('en-CA') ?? cohort[0];
    if (canonical === undefined) throw new Error('CAP-CP cohort has no canonical info block');

    const input: EcccAlertInput = {
      originalId,
      references: references(alert.references),
      sent,
      messageType: messageType(alert.msgType),
      event: canonical.event,
      originalDesignation: canonical.originalDesignation,
      ended: isEnded(canonical) || String(alert.msgType).toLowerCase() === 'cancel',
      effective: canonical.effective,
      expires: canonical.expires,
      geometry: canonical.geometry,
      geometryBasis: canonical.geometryBasis,
      geocodes: canonical.geocodes,
      languages: Object.freeze(cohort.map(({ language }) => language)),
    };
    const optionalFields = {
      alertType: canonical.alertType,
      severity: canonical.severity,
      urgency: canonical.urgency,
      certainty: canonical.certainty,
      mscImpact: canonical.mscImpact,
      colour: canonical.colour,
      onset: canonical.onset,
      areaDesc: canonical.areaDesc,
    };
    for (const [key, fieldValue] of Object.entries(optionalFields)) {
      if (fieldValue !== undefined) (input as unknown as Record<string, unknown>)[key] = fieldValue;
    }

    return {
      messages: [normalizeEcccAlert(input, context)],
      observedAt: context.fetchedAt,
      sourceUpdatedAt: sent,
      diagnostics: [],
      failures: [],
      completeness: 'complete',
    };
  } catch (error) {
    return {
      messages: [],
      observedAt: context.fetchedAt,
      diagnostics: [],
      failures: [failure('eccc-cap-invalid-alert', String(error), originalId)],
      completeness: 'rejected',
    };
  }
};

export { ECCC_MIXED_ACTIVE_COHORT_FAILURE };
