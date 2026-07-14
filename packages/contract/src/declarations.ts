import type { HazardKind } from './hazards.js';

/** One entry in a surface's legend. Color is any CSS color string. */
export interface LegendEntry {
  label: string;
  color: string;
}

/**
 * A condition surface: a continuous "how are things right now / soon"
 * layer (raster or vector) such as a precipitation analysis or a drought
 * index. Surfaces are one-visible-at-a-time per map — enforced by
 * SurfaceManager in @ewm/map-core.
 */
export interface ConditionSurface {
  /** Unique within the module, kebab-case, e.g. "precip-6h". */
  id: string;
  title: string;
  description: string;
  hazards: HazardKind[];
  kind: 'raster' | 'vector';
  /**
   * Id of the SourceRecord this surface draws from. Must exist in the
   * platform's verified source registry when the module registers —
   * invariant #7: no ad-hoc fetch URLs in module code.
   */
  sourceId: string;
  /**
   * Id this surface reports honest status under. The module registers it in
   * the StatusRegistry during register() — invariant #5: no layer without a
   * status. Convention: "<moduleId>.<surfaceId>".
   */
  statusId: string;
  legend?: LegendEntry[];
}

/**
 * A discrete-event layer: individually identifiable things with geometry —
 * fire perimeters, flood polygons, storm tracks, alert areas.
 */
export interface EventLayer {
  /** Unique within the module, kebab-case. */
  id: string;
  title: string;
  description: string;
  hazards: HazardKind[];
  geometry: 'point' | 'line' | 'polygon';
  /** See ConditionSurface.sourceId. */
  sourceId: string;
  /** See ConditionSurface.statusId. */
  statusId: string;
}

/**
 * A telemetry feed the module consumes: stations, stream gauges, buoys,
 * SNOTEL sites, cameras. Declared so the platform can inventory every feed a
 * deployment depends on and drive per-feed status.
 */
export interface TelemetrySourceDecl {
  /** Unique within the module, kebab-case. */
  id: string;
  title: string;
  kind: 'station' | 'gauge' | 'buoy' | 'camera' | 'other';
  /** See ConditionSurface.sourceId. */
  sourceId: string;
  /** See ConditionSurface.statusId. */
  statusId: string;
}

/**
 * A named, shareable starting view: center/zoom plus which surface and event
 * layers are on. Presets serialize through @ewm/core-state like any other
 * view — invariant #4: URL as state.
 */
export interface ViewPreset {
  /** Unique within the module, kebab-case. */
  id: string;
  title: string;
  description?: string;
  view: {
    /** [longitude, latitude] in WGS84. */
    center: [number, number];
    zoom: number;
  };
  /** Surface to activate; omit to leave surfaces untouched. */
  surfaceId?: string;
  /** Event layers to show; omit to leave them untouched. */
  eventLayerIds?: string[];
}

/**
 * A section this module contributes to generated situation briefings
 * (the future briefing/report feature). Declaration only for now — the
 * rendering contract lands with the briefing engine.
 */
export interface BriefingSectionDecl {
  /** Unique within the module, kebab-case. */
  id: string;
  title: string;
  /** Sort order across all modules' sections; lower renders first. */
  order: number;
  hazards: HazardKind[];
}
