import type { GeoJSON } from 'geojson';

export interface MapView {
  /** [longitude, latitude] in WGS84. */
  center: [number, number];
  zoom: number;
}

export interface RasterSourceSpec {
  /** Tile URL templates with {z}/{x}/{y} placeholders. */
  tiles: string[];
  /** Mandatory: honest maps credit their sources. */
  attribution: string;
  tileSize?: number;
  maxzoom?: number;
}

/**
 * The minimal layer vocabulary the platform needs today. Grows deliberately —
 * every addition must be supportable by MapLibre style layers.
 */
export type LayerSpec =
  | { id: string; source: string; kind: 'raster' }
  | {
      id: string;
      source: string;
      kind: 'circle' | 'fill' | 'line';
      paint?: Record<string, unknown>;
      /** Initial visibility; defaults to true. */
      visible?: boolean;
    };

/**
 * The subset of map behavior modules are allowed to use. Implemented for
 * MapLibre in `createMapLibreRuntime`; trivially fakeable in tests.
 */
export interface MapRuntime extends VisibilityController {
  addRasterSource(id: string, spec: RasterSourceSpec): void;
  addGeoJsonSource(id: string, data: GeoJSON): void;
  addLayer(spec: LayerSpec): void;
  hasLayer(id: string): boolean;
  getView(): MapView;
  setView(view: MapView): void;
  /** Fires after the view settles (pan/zoom end). Returns an unsubscribe function. */
  onViewChange(listener: (view: MapView) => void): () => void;
}

/** The one capability the surface manager needs — kept narrow for testability. */
export interface VisibilityController {
  setLayerVisibility(layerId: string, visible: boolean): void;
}
