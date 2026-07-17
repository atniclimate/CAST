/**
 * @ewm/core-state — URL as state.
 *
 * Platform invariant #4: any view a user composes must be shareable as a URL.
 * Serialization lives here, in core, so every module speaks the same format.
 *
 * Reserved keys: `c` (center "lon,lat"), `z` (zoom), `n` (selected Tribal
 * Nation, opaque stable Nation ID), `s` (active condition surface id), `e`
 * (comma-separated visible event-layer ids). Anything else round-trips
 * through `params` so modules can add their own state under namespaced keys
 * (convention: `<moduleId>.<key>`).
 *
 * Framework-agnostic: vanilla TypeScript, zero dependencies.
 */

export interface ViewState {
  /** [longitude, latitude] in WGS84. */
  center: [number, number];
  zoom: number;
  /**
   * Selected Tribal Nation: the opaque stable Nation ID. Per DS-006 the
   * presence of this key in a URL constitutes explicit selection (it gates
   * T1 rendering). Legacy-ID redirects resolve in the registry BEFORE this
   * state is written; this layer carries the canonical ID only.
   */
  nation?: string;
  /** Active condition surface id (one visible at a time). */
  surface?: string;
  /** Visible event-layer ids. */
  events?: string[];
  /** Module-defined extras. Keys must not collide with the reserved keys. */
  params?: Record<string, string>;
}

const RESERVED_KEYS = new Set(['c', 'z', 'n', 's', 'e']);

/** ~1 m of precision; keeps URLs short and round-trips stable. */
const COORD_DECIMALS = 5;
const ZOOM_DECIMALS = 2;

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

/**
 * Serialize a view to a URL query/fragment string (no leading `?` or `#`).
 * Output is deterministic: reserved keys first, extras sorted.
 */
export function serializeViewState(state: ViewState): string {
  const search = new URLSearchParams();
  const lon = round(state.center[0], COORD_DECIMALS);
  const lat = round(state.center[1], COORD_DECIMALS);
  search.set('c', `${lon},${lat}`);
  search.set('z', String(round(state.zoom, ZOOM_DECIMALS)));
  if (state.nation !== undefined && state.nation !== '') {
    search.set('n', state.nation);
  }
  if (state.surface !== undefined) {
    search.set('s', state.surface);
  }
  if (state.events !== undefined && state.events.length > 0) {
    search.set('e', state.events.join(','));
  }
  if (state.params !== undefined) {
    for (const key of Object.keys(state.params).sort()) {
      if (RESERVED_KEYS.has(key)) {
        throw new Error(`param key "${key}" collides with a reserved view-state key`);
      }
      const value = state.params[key];
      if (value !== undefined) {
        search.set(key, value);
      }
    }
  }
  return search.toString();
}

/**
 * Parse a query/fragment string back into a ViewState.
 * Returns null when the string does not contain a usable view (missing or
 * malformed center/zoom) — callers fall back to their default view.
 */
export function parseViewState(input: string): ViewState | null {
  const search = new URLSearchParams(input.replace(/^[?#]/, ''));

  const rawCenter = search.get('c');
  const rawZoom = search.get('z');
  if (rawCenter === null || rawZoom === null) return null;

  const parts = rawCenter.split(',').map(Number);
  const [lon, lat] = parts;
  if (parts.length !== 2 || lon === undefined || lat === undefined) return null;
  if (!Number.isFinite(lon) || !Number.isFinite(lat)) return null;
  if (lon < -180 || lon > 180 || lat < -90 || lat > 90) return null;

  const zoom = Number(rawZoom);
  if (!Number.isFinite(zoom) || zoom < 0 || zoom > 24) return null;

  const state: ViewState = { center: [lon, lat], zoom };

  const nation = search.get('n');
  if (nation !== null && nation !== '') {
    state.nation = nation;
  }
  const surface = search.get('s');
  if (surface !== null && surface !== '') {
    state.surface = surface;
  }
  const events = search.get('e');
  if (events !== null && events !== '') {
    state.events = events.split(',').filter((id) => id !== '');
  }

  let params: Record<string, string> | undefined;
  for (const [key, value] of search.entries()) {
    if (RESERVED_KEYS.has(key)) continue;
    params ??= {};
    params[key] = value;
  }
  if (params !== undefined) {
    state.params = params;
  }

  return state;
}

/**
 * Transport abstraction between serialized view state and an actual URL.
 * Browsers use the hash bus; tests and non-browser hosts use the memory bus.
 */
export interface UrlStateBus {
  read(): string;
  write(serialized: string, opts?: { replace?: boolean }): void;
  /** Notified when the state changes. Returns an unsubscribe function. */
  subscribe(listener: (serialized: string) => void): () => void;
}

export function createMemoryUrlStateBus(initial = ''): UrlStateBus {
  let current = initial;
  const listeners = new Set<(serialized: string) => void>();
  return {
    read: () => current,
    write(serialized) {
      if (serialized === current) return;
      current = serialized;
      for (const listener of listeners) {
        listener(serialized);
      }
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

/**
 * Hash-fragment bus for browsers. Writes use history.replaceState by default
 * so panning the map does not flood session history; external changes
 * (back/forward, hand-edited URL) arrive via `hashchange`.
 */
export function createHashUrlStateBus(win: Window): UrlStateBus {
  const listeners = new Set<(serialized: string) => void>();
  const read = () => win.location.hash.replace(/^#/, '');
  win.addEventListener('hashchange', () => {
    const serialized = read();
    for (const listener of listeners) {
      listener(serialized);
    }
  });
  return {
    read,
    write(serialized, opts) {
      if (serialized === read()) return;
      if (opts?.replace === false) {
        win.location.hash = serialized;
      } else {
        win.history.replaceState(null, '', `#${serialized}`);
      }
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
