/**
 * The hydro module's contract implementation — currently a proof of life.
 *
 * One synthetic demo event layer flows through every platform seam: the
 * verified source registry, the status registry, the map runtime, and the
 * module declarations. This exists to prove the contract is usable, not to
 * be the real hydro module.
 */

import type { HazardModule, PlatformContext } from '@ewm/contract';
import type { SourceRecord } from '@ewm/sources';
import type { FeatureCollection } from 'geojson';

export const DEMO_LAYER_ID = 'demo-gauges';
export const DEMO_STATUS_ID = 'hydro.demo-gauges';
const DEMO_SOURCE_ID = 'hydro-demo-synthetic';

/**
 * Even synthetic data goes through the registry — invariant #7 has no
 * exceptions, which is exactly what makes it auditable. The .invalid TLD is
 * reserved (RFC 2606); nothing is ever fetched from it.
 */
const DEMO_SOURCE: SourceRecord = {
  id: DEMO_SOURCE_ID,
  owner: 'EWM proof-of-life (synthetic)',
  url: 'https://demo.invalid/synthetic-gauges',
  license: 'N/A — generated in code at page load, never fetched',
  cadence: 'generated once at page load',
  region: 'both',
  verifiedAt: '2026-07-14',
  notes: 'Synthetic demonstration points. Remove when the first real hydro feed lands.',
};

/** A small ring of fictional gauge points around a center. Synthetic only. */
function syntheticGauges(center: [number, number], count: number): FeatureCollection {
  const features = Array.from({ length: count }, (_, i) => {
    const angle = (2 * Math.PI * i) / count;
    return {
      type: 'Feature' as const,
      properties: { name: `Synthetic gauge ${i + 1}`, synthetic: true },
      geometry: {
        type: 'Point' as const,
        coordinates: [center[0] + 1.6 * Math.cos(angle), center[1] + 1.1 * Math.sin(angle)],
      },
    };
  });
  return { type: 'FeatureCollection', features };
}

export const hydroModule: HazardModule = {
  id: 'hydro',
  name: 'Hydro — Flooding, Atmospheric Rivers & Heavy Precipitation',
  hazards: ['flood', 'atmospheric-river', 'heavy-precipitation'],
  surfaces: [],
  eventLayers: [
    {
      id: DEMO_LAYER_ID,
      title: 'Demo gauges (synthetic)',
      description:
        'Synthetic proof-of-life points demonstrating the module contract. Not real data.',
      hazards: ['flood'],
      geometry: 'point',
      sourceId: DEMO_SOURCE_ID,
      statusId: DEMO_STATUS_ID,
    },
  ],
  telemetry: [],
  viewPresets: [
    {
      id: 'pnw-overview',
      title: 'Pacific Northwest overview',
      description: 'Default proof-of-life view.',
      view: { center: [-120.5, 46.5], zoom: 5.5 },
      eventLayerIds: [DEMO_LAYER_ID],
    },
  ],
  briefingSections: [],

  register(ctx: PlatformContext): void {
    ctx.sources.add(DEMO_SOURCE);
    const source = ctx.sources.get(DEMO_SOURCE_ID); // resolved, never ad-hoc

    ctx.status.register(DEMO_STATUS_ID);

    const preset = this.viewPresets[0];
    const data = syntheticGauges(preset ? preset.view.center : [-120.5, 46.5], 7);
    ctx.map.addGeoJsonSource(DEMO_LAYER_ID, data);
    ctx.map.addLayer({
      id: DEMO_LAYER_ID,
      source: DEMO_LAYER_ID,
      kind: 'circle',
      paint: {
        'circle-radius': 7,
        'circle-color': '#2f8fdd',
        'circle-stroke-color': '#ffffff',
        'circle-stroke-width': 2,
      },
    });

    // Honest status: this is code-generated data, so it is labeled as what it
    // is — cached at generation time, with the caveat spelled out.
    ctx.status.report(DEMO_STATUS_ID, {
      state: 'cached',
      asOf: new Date().toISOString(),
      detail: `synthetic demo data (source: ${source.id}) — not a live feed`,
    });
  },
};
