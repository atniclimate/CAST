/**
 * @ewm/contract — the hazard module contract.
 *
 * This is the platform's most load-bearing artifact: the interface every
 * hazard module (drought, hydro, winter, severe, …) implements, and the
 * platform context each module registers against. The shell composes modules
 * knowing only these types; modules stay embeddable anywhere because the
 * contract is vanilla TypeScript with no UI-framework dependency.
 *
 * Prose companion: docs/MODULE_CONTRACT.md.
 */

export type { HazardKind } from './hazards.js';
export { HAZARD_KINDS } from './hazards.js';
export type {
  ConditionSurface,
  EventLayer,
  LegendEntry,
  TelemetrySourceDecl,
  ViewPreset,
  BriefingSectionDecl,
} from './declarations.js';
export type { PlatformContext, HazardModule } from './module.js';
export { validateHazardModule } from './validate.js';
