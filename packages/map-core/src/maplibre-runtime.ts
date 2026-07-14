import type { AddLayerObject, Map as MapLibreMap } from 'maplibre-gl';
import type { GeoJSON } from 'geojson';
import type { LayerSpec, MapRuntime, MapView, RasterSourceSpec } from './runtime.js';

/**
 * Adapt a live maplibre-gl Map to the framework-agnostic MapRuntime interface.
 * Thin, deliberate glue: no behavior lives here that would need unit tests —
 * behavior belongs in SurfaceManager and the modules.
 */
export function createMapLibreRuntime(map: MapLibreMap): MapRuntime {
  return {
    addRasterSource(id, spec: RasterSourceSpec) {
      map.addSource(id, {
        type: 'raster',
        tiles: spec.tiles,
        tileSize: spec.tileSize ?? 256,
        attribution: spec.attribution,
        ...(spec.maxzoom !== undefined ? { maxzoom: spec.maxzoom } : {}),
      });
    },
    addGeoJsonSource(id, data: GeoJSON) {
      map.addSource(id, { type: 'geojson', data });
    },
    addLayer(spec: LayerSpec) {
      if (spec.kind === 'raster') {
        map.addLayer({ id: spec.id, type: 'raster', source: spec.source });
        return;
      }
      // One cast at the glue boundary: LayerSpec's open paint bag cannot be
      // narrowed to MapLibre's per-kind paint unions without duplicating them.
      map.addLayer({
        id: spec.id,
        type: spec.kind,
        source: spec.source,
        paint: spec.paint ?? {},
        layout: { visibility: (spec.visible ?? true) ? 'visible' : 'none' },
      } as AddLayerObject);
    },
    hasLayer: (id) => map.getLayer(id) !== undefined,
    setLayerVisibility(layerId, visible) {
      map.setLayoutProperty(layerId, 'visibility', visible ? 'visible' : 'none');
    },
    getView() {
      const center = map.getCenter();
      return { center: [center.lng, center.lat], zoom: map.getZoom() };
    },
    setView(view: MapView) {
      map.jumpTo({ center: view.center, zoom: view.zoom });
    },
    onViewChange(listener) {
      const handler = () => {
        const center = map.getCenter();
        listener({ center: [center.lng, center.lat], zoom: map.getZoom() });
      };
      map.on('moveend', handler);
      return () => {
        map.off('moveend', handler);
      };
    },
  };
}
