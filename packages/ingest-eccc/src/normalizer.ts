import { mapEcccAlert, type AlertLanguageBlock, type NormalizedAlert } from '@ewm/alerts-schema';
import {
  stampAlertProvenance,
  type ParseContext,
  type UnstampedAlertMessage,
} from '@ewm/ingest-core';

import type { EcccAlertInput } from './types.js';

export const ECCC_AGENCY = 'eccc' as const;
export const ECCC_TRANSLATION_AUTHORITY = 'ECCC' as const;

function requireText(value: string, label: string): string {
  const trimmed = value.trim();
  if (trimmed === '') throw new Error(`${label} must not be empty`);
  return trimmed;
}

function requireTimestamp(value: string, label: string): string {
  if (Number.isNaN(Date.parse(value))) {
    throw new Error(`${label} is not a parseable timestamp: "${value}"`);
  }
  return value;
}

function buildSourceLanguage(
  languages: EcccAlertInput['languages'],
): Readonly<Record<string, AlertLanguageBlock>> {
  if (languages.length === 0) throw new Error('at least one source language block is required');

  const blocks: Record<string, AlertLanguageBlock> = {};
  for (const language of languages) {
    const key = requireText(language.language, 'source language');
    if (blocks[key] !== undefined) throw new Error(`duplicate source language block: "${key}"`);

    const block: AlertLanguageBlock = {
      headline: requireText(language.headline, `${key} headline`),
      description: requireText(language.description, `${key} description`),
    };
    if (language.instruction !== undefined && language.instruction.trim() !== '') {
      block.instruction = language.instruction.trim();
    }
    blocks[key] = Object.freeze(block);
  }
  return Object.freeze(blocks);
}

/** The sole construction path used by both GeoMet and CAP-CP decoders. */
export function normalizeEcccAlert(input: EcccAlertInput, context: ParseContext): NormalizedAlert {
  const mapped = mapEcccAlert({
    mscImpact: input.mscImpact ?? null,
    colour: input.colour ?? null,
    severity: input.severity ?? null,
    urgency: input.urgency ?? null,
    certainty: input.certainty ?? null,
    event: input.alertType ?? null,
    ended: input.ended,
  });

  const message: UnstampedAlertMessage = {
    sent: requireTimestamp(input.sent, 'sent'),
    messageType: input.messageType,
    event: requireText(input.event, 'event'),
    originalDesignation: requireText(input.originalDesignation, 'original designation'),
    band: mapped.band,
    posture: mapped.posture,
    confidence: mapped.confidence,
    effective: requireTimestamp(input.effective, 'effective'),
    expires:
      input.expires === null ? null : requireTimestamp(input.expires, 'expires'),
    geometry: input.geometry,
    sourceLanguage: buildSourceLanguage(input.languages),
    translationAuthority: ECCC_TRANSLATION_AUTHORITY,
  };
  if (input.onset !== undefined) message.onset = requireTimestamp(input.onset, 'onset');
  if (input.areaDesc !== undefined && input.areaDesc.trim() !== '') {
    message.areaDesc = input.areaDesc.trim();
  }

  return stampAlertProvenance(message, context, {
    agency: ECCC_AGENCY,
    originalId: requireText(input.originalId, 'originalId'),
    references: input.references,
    coverage: {
      geometryBasis: input.geometryBasis,
      geocodes: input.geocodes,
    },
  });
}
