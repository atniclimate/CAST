# Extreme Weather Monitor (EWM)

A multi-hazard monitoring, preparedness, and response platform built by
[ATNI](https://atnitribes.org) (Affiliated Tribes of Northwest Indians) climate staff.
EWM centers Tribal Nations, extends to Canadian First Nations, and is usable broadly.

## What lives here

This is a **pnpm monorepo**. Hazard modules are independent, serverless-static web maps
that all implement one shared TypeScript contract; core packages provide the plumbing
they share.

| Path                     | Package              | Role                                                                                                              |
| ------------------------ | -------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `packages/contract`      | `@ewm/contract`      | **The hazard module contract** — the interfaces every module implements                                           |
| `packages/core-status`   | `@ewm/core-status`   | Five-state honest-status machine (`live / cached / stale / degraded / unavailable`) with "as of" timestamps       |
| `packages/core-net`      | `@ewm/core-net`      | Abortable fetch with timeout + retry, wired into the status registry                                              |
| `packages/core-state`    | `@ewm/core-state`    | URL-as-state: every composed view is shareable as a URL                                                           |
| `packages/sources`       | `@ewm/sources`       | Verified source registry — every external endpoint is registered with owner/license/cadence/verification metadata |
| `packages/places`        | `@ewm/places`        | Boundary/place engine + the **sovereign empty-placeholder pattern** (no Nation data ever ships in this repo)      |
| `packages/alerts-schema` | `@ewm/alerts-schema` | Normalized CAP-derived alert types (NWS **and** Environment Canada ready)                                         |
| `packages/map-core`      | `@ewm/map-core`      | MapLibre GL wrapper + layer/surface registry                                                                      |
| `modules/drought`        | —                    | Stub. The existing [Dynamic Drought Module](https://github.com/atniclimate/dynamic-drought-module) migrates here  |
| `modules/hydro`          | `hydro`              | Proof-of-life module: flooding / atmospheric rivers / heavy precipitation                                         |
| `modules/winter`         | —                    | Stub: blizzard, snow, ice                                                                                         |
| `modules/severe`         | —                    | Stub: tornado, high wind, hail                                                                                    |
| `apps/shell`             | —                    | Stub: the future unified shell that hosts all modules                                                             |

## Quickstart

```powershell
corepack enable          # once, if pnpm is not installed
pnpm install
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm --filter hydro dev   # proof-of-life map at http://localhost:5173
```

## Architecture invariants

The eight non-negotiable principles (serverless-static first, TypeScript everywhere,
MapLibre GL, URL as state, honest status, sovereign empty placeholders, verified source
registry, framework-agnostic core) are expanded in
[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md). Decisions are recorded as ADRs in
[`docs/DECISIONS/`](docs/DECISIONS/).

**Data sovereignty is load-bearing here.** Read
[`docs/DATA_SOVEREIGNTY.md`](docs/DATA_SOVEREIGNTY.md) before touching anything in
`packages/places` or adding data of any kind.

## Status

Groundwork phase. The contract and core packages are real; `modules/hydro` is a
proof-of-life that exercises them end to end. See [`docs/ROADMAP.md`](docs/ROADMAP.md).
