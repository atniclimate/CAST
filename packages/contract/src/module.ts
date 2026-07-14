import type { MapRuntime } from '@ewm/map-core';
import type { StatusRegistry } from '@ewm/core-status';
import type { SourceRegistry } from '@ewm/sources';
import type { PlaceEngine } from '@ewm/places';
import type { UrlStateBus } from '@ewm/core-state';
import type { HazardKind } from './hazards.js';
import type {
  BriefingSectionDecl,
  ConditionSurface,
  EventLayer,
  TelemetrySourceDecl,
  ViewPreset,
} from './declarations.js';

/**
 * Everything the platform hands a module at registration time. Modules use
 * ONLY these capabilities to reach the outside world:
 *
 * - `map` — the MapLibre-backed runtime (invariant #3).
 * - `status` — the honest-status registry every layer reports through (inv. #5).
 * - `sources` — the verified source registry; the only place URLs come from (inv. #7).
 * - `places` — the sovereign place engine; empty unless the deploying Nation
 *   loaded its own data (inv. #6).
 * - `urlState` — the URL-as-state bus (inv. #4).
 *
 * Deliberately absent: fetch (use @ewm/core-net), storage, DOM. The context
 * carries no UI framework — invariant #8.
 */
export interface PlatformContext {
  map: MapRuntime;
  status: StatusRegistry;
  sources: SourceRegistry;
  places: PlaceEngine;
  urlState: UrlStateBus;
}

/**
 * A hazard module: a self-describing, statically-deployable unit that
 * declares WHAT it offers (surfaces, event layers, telemetry, presets,
 * briefing sections) as data, and wires HOW in exactly one place —
 * `register()`.
 *
 * The declarations are inert metadata: the shell can inventory, list, and
 * route to a module without executing it. `register()` is where the module
 * creates map sources/layers, registers status ids, and subscribes to URL
 * state. It must be idempotent-hostile: called exactly once per platform
 * instance; throwing is the correct response to a second call.
 */
export interface HazardModule {
  /** Globally unique, kebab-case, stable forever (it appears in URLs): "hydro". */
  id: string;
  /** Human-readable name: "Hydro — Flooding & Atmospheric Rivers". */
  name: string;
  /** The hazards this module covers. Every declaration's hazards must be a subset. */
  hazards: HazardKind[];
  surfaces: ConditionSurface[];
  eventLayers: EventLayer[];
  telemetry: TelemetrySourceDecl[];
  viewPresets: ViewPreset[];
  briefingSections: BriefingSectionDecl[];
  register(ctx: PlatformContext): void;
}
