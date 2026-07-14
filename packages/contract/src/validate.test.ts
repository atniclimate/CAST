import { describe, expect, it } from 'vitest';
import { validateHazardModule } from './validate.js';
import type { HazardModule } from './module.js';

function demoModule(overrides: Partial<HazardModule> = {}): HazardModule {
  return {
    id: 'hydro',
    name: 'Hydro — Flooding & Atmospheric Rivers',
    hazards: ['flood', 'atmospheric-river'],
    surfaces: [
      {
        id: 'precip-6h',
        title: '6-hour precipitation',
        description: 'Demo surface',
        hazards: ['heavy-precipitation'],
        kind: 'raster',
        sourceId: 'demo-source',
        statusId: 'hydro.precip-6h',
      },
    ],
    eventLayers: [
      {
        id: 'flood-areas',
        title: 'Flood areas',
        description: 'Demo layer',
        hazards: ['flood'],
        geometry: 'polygon',
        sourceId: 'demo-source',
        statusId: 'hydro.flood-areas',
      },
    ],
    telemetry: [],
    viewPresets: [
      {
        id: 'pnw-overview',
        title: 'PNW overview',
        view: { center: [-120.5, 46.5], zoom: 5 },
        surfaceId: 'precip-6h',
        eventLayerIds: ['flood-areas'],
      },
    ],
    briefingSections: [
      { id: 'river-status', title: 'River status', order: 10, hazards: ['flood'] },
    ],
    register: () => undefined,
    ...overrides,
  };
}

describe('validateHazardModule', () => {
  it('flags hazards referenced by declarations but not declared by the module', () => {
    // The base fixture deliberately uses 'heavy-precipitation' on a surface
    // while the module only declares flood + atmospheric-river.
    const problems = validateHazardModule(demoModule());
    expect(problems).toEqual([
      'surface "precip-6h" references hazard "heavy-precipitation" that the module does not declare',
    ]);
  });

  it('accepts a coherent module', () => {
    const module = demoModule({
      hazards: ['flood', 'atmospheric-river', 'heavy-precipitation'],
    });
    expect(validateHazardModule(module)).toEqual([]);
  });

  it('rejects non-kebab-case and duplicate ids', () => {
    const module = demoModule({
      id: 'Hydro Module',
      viewPresets: [
        { id: 'dup', title: 'A', view: { center: [0, 0], zoom: 1 } },
        { id: 'dup', title: 'B', view: { center: [0, 0], zoom: 1 } },
      ],
    });
    const problems = validateHazardModule(module);
    expect(problems.some((p) => p.includes('module id'))).toBe(true);
    expect(problems.some((p) => p.includes('"dup" is duplicated'))).toBe(true);
  });

  it('rejects modules with no hazards or unknown hazard kinds', () => {
    expect(validateHazardModule(demoModule({ hazards: [] }))).toContain(
      'module must declare at least one hazard',
    );
    const problems = validateHazardModule(demoModule({ hazards: ['earthquake' as never] }));
    expect(problems.some((p) => p.includes('unknown hazard kind "earthquake"'))).toBe(true);
  });

  it('rejects presets pointing at unknown surfaces, layers, or bad coordinates', () => {
    const module = demoModule({
      hazards: ['flood', 'atmospheric-river', 'heavy-precipitation'],
      viewPresets: [
        {
          id: 'broken',
          title: 'Broken preset',
          view: { center: [-200, 95], zoom: 4 },
          surfaceId: 'no-such-surface',
          eventLayerIds: ['no-such-layer'],
        },
      ],
    });
    const problems = validateHazardModule(module);
    expect(problems.some((p) => p.includes('unknown surface'))).toBe(true);
    expect(problems.some((p) => p.includes('unknown event layer'))).toBe(true);
    expect(problems.some((p) => p.includes('out-of-range center'))).toBe(true);
  });
});
