# The Hazard Module Contract

Prose companion to `@ewm/contract` (`packages/contract/src/`). The TypeScript is the
source of truth; this document explains intent.

## What a module is

A hazard module is a self-describing, statically-deployable unit that answers one
question well: _"what is this hazard doing right now, near me, and what should I know?"_
Drought, hydro, winter, and severe are modules. The shell composes them; each module
also runs standalone (as the DDM does today, embedded on partner sites).

A module has two halves:

- **Declarations** — inert data: `surfaces`, `eventLayers`, `telemetry`, `viewPresets`,
  `briefingSections`. The shell can inventory a module, build menus, and route URLs
  without executing any module code.
- **`register(ctx)`** — the one place wiring happens: create map sources/layers,
  register status ids, subscribe to URL state. Called exactly once per platform
  instance.

## The vocabulary

| Concept               | What it is                                                    | Example                                       |
| --------------------- | ------------------------------------------------------------- | --------------------------------------------- |
| `ConditionSurface`    | Continuous "state of things" layer, **one visible at a time** | 6-hour precipitation analysis                 |
| `EventLayer`          | Discrete identifiable things with geometry                    | flood polygons, fire perimeters, storm tracks |
| `TelemetrySourceDecl` | Station/gauge feeds the module consumes                       | stream gauges, SNOTEL                         |
| `ViewPreset`          | Named shareable starting view                                 | "PNW overview"                                |
| `BriefingSectionDecl` | Section contributed to generated briefings                    | "River status"                                |

The one-visible-surface rule is enforced by `SurfaceManager` in `@ewm/map-core`:
condition surfaces answer the same question in different ways, and stacking them
produces maps that lie. Event layers, by contrast, compose freely.

## The platform context

`register(ctx)` receives exactly five capabilities:

| Field                     | Package            | Invariant it carries          |
| ------------------------- | ------------------ | ----------------------------- |
| `map: MapRuntime`         | `@ewm/map-core`    | MapLibre only, framework-free |
| `status: StatusRegistry`  | `@ewm/core-status` | honest five-state status      |
| `sources: SourceRegistry` | `@ewm/sources`     | no ad-hoc URLs                |
| `places: PlaceEngine`     | `@ewm/places`      | sovereign data never ships    |
| `urlState: UrlStateBus`   | `@ewm/core-state`  | URL as state                  |

Deliberately absent: raw `fetch` (use `@ewm/core-net`, which reports honest status),
storage, the DOM, any UI framework. If a module needs a capability the context lacks,
that is a contract discussion, not a workaround.

## Conventions

- **Ids** are kebab-case and stable forever — they appear in shared URLs. Module ids
  are globally unique; declaration ids are unique within their module.
- **Status ids** follow `<moduleId>.<declarationId>` (e.g. `hydro.demo-gauges`).
- **URL params** a module adds beyond the core grammar are namespaced
  `<moduleId>.<key>`.
- **Every** `sourceId` must resolve in the registry at registration; every surface and
  event layer must register its `statusId` before first render.

## Conformance

`validateHazardModule(module)` performs the structural checks (id grammar, duplicate
ids, hazard coverage, preset references). The shell runs it before `register()` and
refuses malformed modules. Runtime conformance — statuses actually registered, sources
actually resolved — is enforced by the registries themselves throwing.

The DDM migration (ROADMAP) is the contract's first real test: its drought/heat/fire
content must express itself as declarations plus one `register()` without losing
capability. Where it cannot, the contract — not the DDM — is what needs revisiting.
