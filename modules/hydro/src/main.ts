/**
 * Platform bootstrap for the hydro proof-of-life.
 *
 * This file plays the role the future shell will play: it assembles the
 * PlatformContext (map runtime, status registry, source registry, place
 * engine, URL-state bus), validates the module, and registers it.
 */

import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { validateHazardModule } from '@ewm/contract';
import type { PlatformContext } from '@ewm/contract';
import { createStatusRegistry, STATUS_STATES, type StatusSnapshot } from '@ewm/core-status';
import { createSourceRegistry, OSM_RASTER_BASEMAP } from '@ewm/sources';
import { createEmptyPlaceEngine } from '@ewm/places';
import {
  createHashUrlStateBus,
  parseViewState,
  serializeViewState,
  type ViewState,
} from '@ewm/core-state';
import { createMapLibreRuntime } from '@ewm/map-core';
import { hydroModule, DEMO_LAYER_ID, DEMO_STATUS_ID } from './hydro-module.js';

const DEFAULT_VIEW: ViewState = { center: [-120.5, 46.5], zoom: 5.5 };

// --- assemble the platform context ------------------------------------------
const status = createStatusRegistry();
const sources = createSourceRegistry([OSM_RASTER_BASEMAP]);
const places = createEmptyPlaceEngine(); // sovereign placeholder: valid, documented, empty
const urlState = createHashUrlStateBus(window);

const initialView = parseViewState(urlState.read()) ?? DEFAULT_VIEW;

const map = new maplibregl.Map({
  container: 'map',
  style: { version: 8, sources: {}, layers: [] },
  center: initialView.center,
  zoom: initialView.zoom,
  attributionControl: { compact: false },
});
const runtime = createMapLibreRuntime(map);

map.on('load', () => {
  // Basemap URL comes from the verified source registry, never inline.
  const basemap = sources.get(OSM_RASTER_BASEMAP.id);
  runtime.addRasterSource('basemap', {
    tiles: [basemap.url],
    attribution: '© OpenStreetMap contributors',
    maxzoom: 19,
  });
  runtime.addLayer({ id: 'basemap', source: 'basemap', kind: 'raster' });

  // --- register the hydro module through the contract -----------------------
  const problems = validateHazardModule(hydroModule);
  if (problems.length > 0) {
    throw new Error(`hydro module failed contract validation:\n${problems.join('\n')}`);
  }
  const ctx: PlatformContext = { map: runtime, status, sources, places, urlState };
  hydroModule.register(ctx);

  applyView(initialView);
});

// --- URL as state ------------------------------------------------------------
let demoLayerVisible = true;

function currentViewState(): ViewState {
  const view = runtime.getView();
  const state: ViewState = { center: view.center, zoom: view.zoom };
  if (demoLayerVisible) state.events = [DEMO_LAYER_ID];
  return state;
}

function applyView(state: ViewState): void {
  runtime.setView({ center: state.center, zoom: state.zoom });
  setDemoLayerVisible(state.events?.includes(DEMO_LAYER_ID) ?? false);
}

runtime.onViewChange(() => urlState.write(serializeViewState(currentViewState())));
urlState.subscribe((serialized) => {
  const state = parseViewState(serialized);
  if (state !== null) applyView(state);
});

// --- status pill --------------------------------------------------------------
const pill = document.querySelector('#status-pill') as HTMLElement;
const dot = pill.querySelector('.dot') as HTMLElement;
const label = pill.querySelector('.label') as HTMLElement;
const STATE_COLORS: Record<string, string> = {
  live: '#3fb950',
  cached: '#4493f8',
  stale: '#d4a72c',
  degraded: '#e8793a',
  unavailable: '#f85149',
};

function renderPill(snapshot: StatusSnapshot): void {
  dot.style.background = STATE_COLORS[snapshot.state] ?? '#888';
  const asOf = snapshot.asOf === null ? 'no data' : `as of ${new Date(snapshot.asOf).toLocaleTimeString()}`;
  label.textContent = `demo gauges: ${snapshot.state} · ${asOf}`;
  pill.title = snapshot.detail ?? '';
}

status.subscribe((id, snapshot) => {
  if (id === DEMO_STATUS_ID) renderPill(snapshot);
});

// Click the pill to preview all five states (demo affordance only).
pill.addEventListener('click', () => {
  const current = status.get(DEMO_STATUS_ID);
  const next =
    STATUS_STATES[(STATUS_STATES.indexOf(current.state) + 1) % STATUS_STATES.length] ?? 'unavailable';
  status.report(DEMO_STATUS_ID, {
    state: next,
    asOf: next === 'unavailable' ? null : (current.asOf ?? new Date().toISOString()),
    detail: 'state preview — click cycles through the five honest states',
  });
});

// --- demo layer toggle (exercises URL round-trip of the "e" param) -----------
const toggle = document.querySelector('#layer-toggle') as HTMLButtonElement;

function setDemoLayerVisible(visible: boolean): void {
  demoLayerVisible = visible;
  if (runtime.hasLayer(DEMO_LAYER_ID)) {
    runtime.setLayerVisibility(DEMO_LAYER_ID, visible);
  }
  toggle.textContent = visible ? 'Hide demo gauges' : 'Show demo gauges';
}

toggle.addEventListener('click', () => {
  setDemoLayerVisible(!demoLayerVisible);
  urlState.write(serializeViewState(currentViewState()));
});
