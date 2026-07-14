/**
 * @ewm/map-core — the map runtime boundary.
 *
 * Platform invariant #3: MapLibre GL is the map runtime; no proprietary tile
 * providers, no tracking. This package is the ONLY place maplibre-gl is
 * imported. Everything above it (contract, modules, shell) talks to the
 * framework-agnostic MapRuntime interface, which keeps modules embeddable
 * anywhere and keeps core logic (like the one-visible-surface rule) testable
 * without a browser.
 */

export type {
  MapView,
  RasterSourceSpec,
  LayerSpec,
  MapRuntime,
  VisibilityController,
} from './runtime.js';
export { SurfaceManager } from './surface-manager.js';
export { createMapLibreRuntime } from './maplibre-runtime.js';
