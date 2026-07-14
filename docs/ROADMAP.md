# EWM Roadmap

Sequencing favors: prove the contract, migrate the mature module, build hydro for
real, then widen. Dates are deliberately absent — this is order, not schedule.

## Phase 0 — Groundwork ✅ (this repo, 2026-07)

Monorepo scaffolding, `@ewm/contract`, core packages with tests, hydro proof-of-life,
docs + ADRs, CI. Done when `install / lint / typecheck / test / build` are green and
the proof-of-life map runs.

## Phase 1 — DDM migration (drought module)

Move the [Dynamic Drought Module](https://github.com/atniclimate/dynamic-drought-module)
into `modules/drought` as a contract-conforming module. Plan first (see
`modules/drought/README.md` for the conformance checklist); the migration doubles as
the contract's shakedown cruise — expect contract refinements, record them as ADRs.
DDM's existing deployments must keep working throughout (its current repo stays the
deploy source until cutover).

## Phase 2 — Hydro for real

Replace the proof-of-life with actual content: precipitation/AR condition surfaces,
flood event layers, river gauge telemetry — every endpoint entering through the source
verification process. The PNW dashboard prototype
([pnw-tribal-dashboard](https://github.com/atniclimate/pnw-tribal-dashboard)) is the
requirements reference: what it showed, who used it, what it lacked. Its code is not a
source.

## Phase 3 — Shell

`apps/shell`: one static app hosting all modules with unified navigation, the shared
URL grammar, and a combined status panel. Framework choice (React is the likely
candidate) happens here and only here — core stays framework-free (ADR-0003).

## Phase 4 — PMTiles pipeline

Tooling (separate repo or workspace, may not be TypeScript) that produces self-hosted
PMTiles for basemaps and heavy layers, removing the OSM dev-basemap dependency —
required before any production deployment per the OSMF tile policy. Includes a
documented recipe a Nation can run for its own region.

## Phase 5 — Alerts backend + companion integration

A small, separate backend workspace: CAP ingestion (NWS + ECCC) normalized into
`@ewm/alerts-schema`, subscription management, and the integration surface for the
indigenousaccess.org companions (alerts, localized forecasts, resources, emergency
contacts, safety info). Design must pass DATA_SOVEREIGNTY review (boundary matching
stays Nation-controlled).

## Phase 6 — Winter & severe modules

Built on a by-then-proven contract. Winter first (PNW relevance), severe after.

## Deliberately not now

Recorded so their absence reads as a decision, not an oversight:

- **React / any UI framework** — Phase 3, shell only.
- **Backend, database, auth** — Phase 5, separate workspace.
- **Docker / deployment config** — modules are static folders; deployment is a CDN
  concern, documented per-deployment.
- **Real data source URLs** — only through source verification (ARCHITECTURE.md).
- **Package publishing / dist builds** — internal-source packages until something
  outside the monorepo needs them (ADR-0001).
- **`verifiedAt` staleness CI check** — wanted, small, not yet.
