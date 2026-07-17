/** Ratified ATNI-CAST alert model, mappings, lifecycle, and legacy adapters. */

export type {
  ActionPosture,
  AlertConfidence,
  AlertCoverage,
  AlertEventGroup,
  AlertEventIdentity,
  AlertLanguageBlock,
  AlertLifecycleRejection,
  AlertLifecycleResolution,
  AlertLifecycleState,
  AlertMessageType,
  AlertProvenance,
  AlertTombstone,
  GeometryBasis,
  MappingApplied,
  NormalizedAlert,
  SeverityBand,
} from './model.js';
export {
  compareSeverityBands,
  createAlertEventGroup,
  createAlertId,
  highestSeverityBand,
} from './model.js';

export type { EcccMappingInput, MappedAlertDimensions, NwsMappingInput } from './mappings.js';
export { ECCC_MAPPING_TABLE, NWS_MAPPING_TABLE, mapEcccAlert, mapNwsAlert } from './mappings.js';

export { resolveAlertLifecycle } from './lifecycle.js';

export type {
  Alert,
  AlertCertainty,
  AlertRegion,
  AlertSeverity,
  AlertUrgency,
  CapAlertInput,
} from './legacy.js';
export {
  normalizeCapAlert,
  normalizeCertainty,
  normalizeSeverity,
  normalizeUrgency,
} from './legacy.js';
