import type { VisibilityController } from './runtime.js';

/**
 * Enforces the platform rule that condition surfaces are one-visible-at-a-time.
 * A "surface" is a named group of map layers (e.g. a raster layer plus its
 * hillshade); activating one hides every other registered surface.
 *
 * Pure logic over the narrow VisibilityController interface, so the rule is
 * unit-testable without MapLibre or a DOM.
 */
export class SurfaceManager {
  private readonly surfaces = new Map<string, string[]>();
  private activeId: string | null = null;

  constructor(private readonly controller: VisibilityController) {}

  /** Register a surface and hide its layers until it is activated. */
  registerSurface(surfaceId: string, layerIds: string[]): void {
    if (this.surfaces.has(surfaceId)) {
      throw new Error(`surface "${surfaceId}" is already registered`);
    }
    if (layerIds.length === 0) {
      throw new Error(`surface "${surfaceId}" must own at least one layer`);
    }
    this.surfaces.set(surfaceId, [...layerIds]);
    this.setVisible(surfaceId, false);
  }

  /** Show one surface and hide all others. Pass null to hide everything. */
  activate(surfaceId: string | null): void {
    if (surfaceId !== null && !this.surfaces.has(surfaceId)) {
      throw new Error(`surface "${surfaceId}" is not registered`);
    }
    if (surfaceId === this.activeId) {
      return;
    }
    if (this.activeId !== null) {
      this.setVisible(this.activeId, false);
    }
    if (surfaceId !== null) {
      this.setVisible(surfaceId, true);
    }
    this.activeId = surfaceId;
  }

  active(): string | null {
    return this.activeId;
  }

  registeredSurfaceIds(): string[] {
    return [...this.surfaces.keys()];
  }

  private setVisible(surfaceId: string, visible: boolean): void {
    for (const layerId of this.surfaces.get(surfaceId) ?? []) {
      this.controller.setLayerVisibility(layerId, visible);
    }
  }
}
