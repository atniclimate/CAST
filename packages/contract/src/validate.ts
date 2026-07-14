import { HAZARD_KINDS, type HazardKind } from './hazards.js';
import type { HazardModule } from './module.js';

const ID_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/**
 * Structural validation of a module's declarations. Returns a list of
 * problems; empty means valid. The shell runs this before register() so a
 * malformed module fails loudly at composition time, not at runtime depth.
 *
 * (Source-registry and status-registry cross-checks happen at registration,
 * where the live registries exist.)
 */
export function validateHazardModule(module: HazardModule): string[] {
  const problems: string[] = [];

  if (!ID_PATTERN.test(module.id)) {
    problems.push(`module id "${module.id}" must be kebab-case`);
  }
  if (module.name.trim() === '') {
    problems.push('module name must be non-empty');
  }
  if (module.hazards.length === 0) {
    problems.push('module must declare at least one hazard');
  }
  for (const hazard of module.hazards) {
    if (!HAZARD_KINDS.includes(hazard)) {
      problems.push(`unknown hazard kind "${String(hazard)}"`);
    }
  }

  const declared = new Set<HazardKind>(module.hazards);
  const checkHazards = (where: string, hazards: HazardKind[]): void => {
    for (const hazard of hazards) {
      if (!declared.has(hazard)) {
        problems.push(`${where} references hazard "${hazard}" that the module does not declare`);
      }
    }
  };

  const checkIds = (kind: string, items: Array<{ id: string }>): void => {
    const seen = new Set<string>();
    for (const item of items) {
      if (!ID_PATTERN.test(item.id)) {
        problems.push(`${kind} id "${item.id}" must be kebab-case`);
      }
      if (seen.has(item.id)) {
        problems.push(`${kind} id "${item.id}" is duplicated`);
      }
      seen.add(item.id);
    }
  };

  checkIds('surface', module.surfaces);
  checkIds('event layer', module.eventLayers);
  checkIds('telemetry', module.telemetry);
  checkIds('view preset', module.viewPresets);
  checkIds('briefing section', module.briefingSections);

  for (const surface of module.surfaces) {
    checkHazards(`surface "${surface.id}"`, surface.hazards);
  }
  for (const layer of module.eventLayers) {
    checkHazards(`event layer "${layer.id}"`, layer.hazards);
  }
  for (const section of module.briefingSections) {
    checkHazards(`briefing section "${section.id}"`, section.hazards);
  }

  const surfaceIds = new Set(module.surfaces.map((s) => s.id));
  const eventLayerIds = new Set(module.eventLayers.map((l) => l.id));
  for (const preset of module.viewPresets) {
    if (preset.surfaceId !== undefined && !surfaceIds.has(preset.surfaceId)) {
      problems.push(`view preset "${preset.id}" references unknown surface "${preset.surfaceId}"`);
    }
    for (const layerId of preset.eventLayerIds ?? []) {
      if (!eventLayerIds.has(layerId)) {
        problems.push(`view preset "${preset.id}" references unknown event layer "${layerId}"`);
      }
    }
    const [lon, lat] = preset.view.center;
    if (lon < -180 || lon > 180 || lat < -90 || lat > 90) {
      problems.push(`view preset "${preset.id}" has an out-of-range center`);
    }
  }

  return problems;
}
