import { NWS_MAPPING_TABLE, type NormalizedAlert } from '@ewm/alerts-schema';
import { NWS_ALERTS_ACTIVE_SOURCE } from '@ewm/sources';

import type { ParseContext, ParseOutcome } from './contracts.js';
import { stampAlertProvenance } from './provenance.js';

export const SYNTHETIC_CONTEXT: ParseContext = {
  source: NWS_ALERTS_ACTIVE_SOURCE,
  fetchedAt: '2026-07-17T12:00:00Z',
  mapping: { name: NWS_MAPPING_TABLE.name, version: NWS_MAPPING_TABLE.version },
};

export function syntheticAlert(
  originalId = 'synthetic-original',
  sent = '2026-07-17T11:55:00Z',
  messageType: NormalizedAlert['messageType'] = 'alert',
  references: readonly string[] = [],
): NormalizedAlert {
  return stampAlertProvenance(
    {
      sent,
      messageType,
      event: 'Synthetic Flood Warning',
      originalDesignation: 'Synthetic Flood Warning',
      band: 'severe',
      posture: 'act-now',
      confidence: 'likely',
      effective: sent,
      expires: '2026-07-18T00:00:00Z',
      geometry: null,
      sourceLanguage: {
        'en-US': {
          headline: 'Synthetic Flood Warning',
          description: 'Synthetic test fixture only.',
        },
      },
      translationAuthority: 'Synthetic Test Agency',
    },
    SYNTHETIC_CONTEXT,
    {
      agency: 'nws',
      originalId,
      references,
      coverage: { geometryBasis: 'zone', geocodes: ['SYN001'] },
    },
  );
}

export function syntheticOutcome(
  messages: readonly NormalizedAlert[],
  overrides: Partial<ParseOutcome> = {},
): ParseOutcome {
  return {
    messages,
    observedAt: '2026-07-17T12:00:00Z',
    diagnostics: [],
    failures: [],
    completeness: 'complete',
    ...overrides,
  };
}
