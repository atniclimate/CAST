# ADR-0002: MapLibre GL + PMTiles for all map rendering and self-hosted data

- **Status:** accepted
- **Date:** 2026-07-14

## Context

Every EWM module is a map. The platform serves Tribal Nations and First Nations, some
on constrained or self-controlled infrastructure; invariants require serverless-static
deployment, no tracking, and no dependence on a vendor's goodwill or API keys.
The DDM already ships on MapLibre GL and validated this stack.

## Decision

1. **MapLibre GL** is the only map runtime. It is imported in exactly one package,
   `@ewm/map-core`; everything else programs against the `MapRuntime` interface.
2. **PMTiles** is the format for self-hosted vector/raster data: a single static file,
   HTTP range-requested from any dumb host — the strongest possible match for
   serverless-static and for Nations hosting their own data.
3. The **OSM raster basemap** registered in `@ewm/sources` is a development
   convenience only. Its `SourceRecord` documents the ODbL license, the OSMF tile
   usage policy, and the obligation to replace it with self-hosted PMTiles before
   production (ROADMAP Phase 4).

## Consequences

- No Mapbox/Google/Esri runtime dependencies, tokens, or telemetry, ever.
- We own basemap production eventually (Phase 4 pipeline) — that is real work, accepted
  deliberately.
- The single-import rule means a future map-runtime change (or a second renderer for
  low-power devices) is one package's problem.
- maplibre-gl dominates bundle size (~1 MB minified). Acceptable for map apps; code
  splitting is available if the shell needs a lighter first paint.

## Alternatives rejected

- **Mapbox GL JS** — license and token requirements are disqualifying for sovereign
  self-hosting.
- **Leaflet** — the PNW dashboard prototype used it; fine for markers, weak for the
  vector-tile, data-dense surfaces the platform needs.
- **Tile servers (TileServer GL, etc.)** — violates serverless-static; a server per
  deployment is a burden Nations should not inherit from us.
