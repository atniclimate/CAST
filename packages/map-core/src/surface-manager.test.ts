import { describe, expect, it } from 'vitest';
import { SurfaceManager } from './surface-manager.js';
import type { VisibilityController } from './runtime.js';

function recordingController(): VisibilityController & {
  calls: Array<{ layerId: string; visible: boolean }>;
} {
  const calls: Array<{ layerId: string; visible: boolean }> = [];
  return {
    calls,
    setLayerVisibility(layerId, visible) {
      calls.push({ layerId, visible });
    },
  };
}

describe('SurfaceManager', () => {
  it('hides a surface at registration — nothing shows until activated', () => {
    const controller = recordingController();
    const manager = new SurfaceManager(controller);
    manager.registerSurface('precip', ['precip-raster']);
    expect(controller.calls).toEqual([{ layerId: 'precip-raster', visible: false }]);
    expect(manager.active()).toBeNull();
  });

  it('activating one surface hides the previously active one', () => {
    const controller = recordingController();
    const manager = new SurfaceManager(controller);
    manager.registerSurface('precip', ['precip-raster']);
    manager.registerSurface('snowpack', ['snow-raster', 'snow-outline']);
    controller.calls.length = 0;

    manager.activate('precip');
    expect(controller.calls).toEqual([{ layerId: 'precip-raster', visible: true }]);

    controller.calls.length = 0;
    manager.activate('snowpack');
    expect(controller.calls).toEqual([
      { layerId: 'precip-raster', visible: false },
      { layerId: 'snow-raster', visible: true },
      { layerId: 'snow-outline', visible: true },
    ]);
    expect(manager.active()).toBe('snowpack');
  });

  it('activate(null) hides everything', () => {
    const controller = recordingController();
    const manager = new SurfaceManager(controller);
    manager.registerSurface('precip', ['precip-raster']);
    manager.activate('precip');
    controller.calls.length = 0;

    manager.activate(null);
    expect(controller.calls).toEqual([{ layerId: 'precip-raster', visible: false }]);
    expect(manager.active()).toBeNull();
  });

  it('re-activating the active surface is a no-op', () => {
    const controller = recordingController();
    const manager = new SurfaceManager(controller);
    manager.registerSurface('precip', ['precip-raster']);
    manager.activate('precip');
    controller.calls.length = 0;

    manager.activate('precip');
    expect(controller.calls).toEqual([]);
  });

  it('rejects unknown surfaces, duplicate registration, and empty surfaces', () => {
    const controller = recordingController();
    const manager = new SurfaceManager(controller);
    manager.registerSurface('precip', ['precip-raster']);
    expect(() => manager.activate('ghost')).toThrow(/not registered/);
    expect(() => manager.registerSurface('precip', ['x'])).toThrow(/already registered/);
    expect(() => manager.registerSurface('empty', [])).toThrow(/at least one layer/);
  });
});
