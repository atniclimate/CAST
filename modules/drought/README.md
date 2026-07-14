# Drought / Extreme Heat / Wildfire module

**Status: stub.** The [Dynamic Drought Module](https://github.com/atniclimate/dynamic-drought-module)
(DDM) — a mature, deployed TypeScript + Vite + MapLibre app — migrates into this
directory as ROADMAP Phase 1. Until cutover, the DDM repo remains the deploy source
and nothing here is built.

Do **not** copy DDM code in piecemeal; the migration is a planned, reviewed move.

## Contract-conformance TODO (drives the migration plan)

- [ ] Inventory DDM layers → express as `ConditionSurface[]` (drought indices, heat,
      fire weather) and `EventLayer[]` (fire perimeters etc.); hazards:
      `drought`, `extreme-heat`, `wildfire`
- [ ] Inventory DDM stations/feeds → `TelemetrySourceDecl[]`
- [ ] Move every DDM endpoint into `@ewm/sources` records via the source verification
      process (owner, license, cadence, region, verifiedAt)
- [ ] Map DDM's status handling onto `@ewm/core-status` five-state semantics
- [ ] Replace DDM URL handling with `@ewm/core-state` (define redirects for existing
      shared URLs — they must not break)
- [ ] Route all map calls through `@ewm/map-core` `MapRuntime`; one-visible-surface
      audit against `SurfaceManager`
- [ ] Sovereign data audit: anything Nation-specific moves behind the `@ewm/places`
      placeholder pattern
- [ ] `validateHazardModule` passes; `register(ctx)` is the only wiring entry point
- [ ] Contract gaps found during migration → ADRs, not workarounds
- [ ] Cutover plan for existing embeds/deployments

## Manifest

`module.manifest.json` declares identity and planned hazards so platform tooling can
inventory this module before any code exists.
