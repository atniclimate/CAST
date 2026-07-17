import type { AlertLanguageBlock, NormalizedAlert } from '@ewm/alerts-schema';

export interface EcccLanguageInput extends AlertLanguageBlock {
  readonly language: string;
}

/** Format-neutral input consumed by the one shared ECCC normalizer. */
export interface EcccAlertInput {
  readonly originalId: string;
  readonly references: readonly string[];
  readonly sent: string;
  readonly messageType: NormalizedAlert['messageType'];
  readonly event: string;
  readonly originalDesignation: string;
  readonly alertType?: string;
  readonly severity?: string;
  readonly urgency?: string;
  readonly certainty?: string;
  readonly mscImpact?: string;
  readonly colour?: string;
  readonly ended: boolean;
  readonly effective: string;
  readonly onset?: string;
  readonly expires: string | null;
  readonly geometry: NormalizedAlert['geometry'];
  readonly geometryBasis: NormalizedAlert['provenance']['coverage']['geometryBasis'];
  readonly geocodes: readonly string[];
  readonly areaDesc?: string;
  readonly languages: readonly EcccLanguageInput[];
}
