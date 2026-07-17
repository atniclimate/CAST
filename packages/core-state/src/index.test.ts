import { describe, expect, it } from 'vitest';
import {
  createMemoryUrlStateBus,
  parseViewState,
  serializeViewState,
  type ViewState,
} from './index.js';

describe('serializeViewState / parseViewState', () => {
  it('round-trips a full view state', () => {
    const state: ViewState = {
      center: [-122.5, 47.2],
      zoom: 6.5,
      surface: 'precip-6h',
      events: ['river-flood', 'ar-track'],
      params: { 'hydro.gauge': 'demo-1' },
    };
    expect(parseViewState(serializeViewState(state))).toEqual(state);
  });

  it('round-trips a minimal view state', () => {
    const state: ViewState = { center: [0, 0], zoom: 2 };
    expect(parseViewState(serializeViewState(state))).toEqual(state);
  });

  it('is stable after one serialize (precision rounding is idempotent)', () => {
    const noisy: ViewState = { center: [-122.123456789, 47.987654321], zoom: 7.123456 };
    const once = serializeViewState(noisy);
    const twice = serializeViewState(parseViewState(once) as ViewState);
    expect(twice).toBe(once);
  });

  it('rounds coordinates to ~1 m and zoom to 2 decimals', () => {
    const serialized = serializeViewState({ center: [-122.123456789, 47.9876543], zoom: 7.129 });
    expect(serialized).toContain('c=-122.12346%2C47.98765');
    expect(serialized).toContain('z=7.13');
  });

  it('returns null for unusable input', () => {
    expect(parseViewState('')).toBeNull();
    expect(parseViewState('not even close')).toBeNull();
    expect(parseViewState('c=-122.5,47.2')).toBeNull(); // missing zoom
    expect(parseViewState('c=-122.5,95.0&z=5')).toBeNull(); // latitude out of range
    expect(parseViewState('c=-122.5,47.2&z=notanumber')).toBeNull();
    expect(parseViewState('c=-122.5&z=5')).toBeNull(); // center missing latitude
  });

  it('accepts a leading # or ? on input', () => {
    const serialized = serializeViewState({ center: [-120, 45], zoom: 5 });
    expect(parseViewState(`#${serialized}`)).not.toBeNull();
    expect(parseViewState(`?${serialized}`)).not.toBeNull();
  });

  it('carries unknown keys through params', () => {
    const parsed = parseViewState('c=-120,45&z=5&hydro.basin=demo');
    expect(parsed?.params).toEqual({ 'hydro.basin': 'demo' });
  });

  it('rejects params that collide with reserved keys', () => {
    expect(() => serializeViewState({ center: [0, 0], zoom: 1, params: { z: 'sneaky' } })).toThrow(
      /reserved/,
    );
  });

  it('round-trips the selected Nation ID through the n key', () => {
    const serialized = serializeViewState({ center: [-122.5, 48.7], zoom: 8, nation: 'ncast-x7f2' });
    expect(serialized).toContain('n=ncast-x7f2');
    const parsed = parseViewState(serialized);
    expect(parsed?.nation).toBe('ncast-x7f2');
  });

  it('omits the n key when no Nation is selected and never invents one', () => {
    const serialized = serializeViewState({ center: [0, 0], zoom: 1 });
    expect(serialized).not.toContain('n=');
    expect(parseViewState(serialized)?.nation).toBeUndefined();
    expect(parseViewState('c=0,0&z=1&n=')?.nation).toBeUndefined();
  });

  it('rejects a params key of n now that Nation selection is reserved', () => {
    expect(() => serializeViewState({ center: [0, 0], zoom: 1, params: { n: 'sneaky' } })).toThrow(
      /reserved/,
    );
  });
});

describe('createMemoryUrlStateBus', () => {
  it('reads back what was written and notifies subscribers', () => {
    const bus = createMemoryUrlStateBus();
    const seen: string[] = [];
    bus.subscribe((s) => seen.push(s));
    bus.write('c=-120,45&z=5');
    expect(bus.read()).toBe('c=-120,45&z=5');
    expect(seen).toEqual(['c=-120,45&z=5']);
  });

  it('does not notify on a no-op write', () => {
    const bus = createMemoryUrlStateBus('same');
    let calls = 0;
    bus.subscribe(() => {
      calls += 1;
    });
    bus.write('same');
    expect(calls).toBe(0);
  });

  it('stops notifying after unsubscribe', () => {
    const bus = createMemoryUrlStateBus();
    let calls = 0;
    const unsubscribe = bus.subscribe(() => {
      calls += 1;
    });
    bus.write('a=1');
    unsubscribe();
    bus.write('a=2');
    expect(calls).toBe(1);
  });
});
