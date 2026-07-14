# ADR-0001: pnpm-workspace monorepo with internal-source packages

- **Status:** accepted
- **Date:** 2026-07-14

## Context

EWM unifies several hazard modules that share a contract, a map runtime, and core
services. The existing DDM lives in its own repo and will migrate in; future modules
and a shell will be built here. We need shared code without publish overhead, on
Windows dev machines and Linux CI.

## Decision

1. **One monorepo**, pnpm workspaces (`packages/*`, `modules/*`, `apps/*`). pnpm for
   strict node_modules (no phantom dependencies), workspace protocol, and catalogs —
   shared dependency versions are pinned once in `pnpm-workspace.yaml`.
2. **Internal-source packages**: every `@ewm/*` package's `exports` points at
   `./src/index.ts`. Consumers (Vite, Vitest, tsc with `moduleResolution: bundler`)
   compile from source. There is no per-package dist build and no build ordering;
   `pnpm build` builds deployable apps (currently `modules/hydro` via Vite), and
   `pnpm typecheck` is the whole-workspace correctness gate.
3. **Cross-platform scripts only** in package.json (no bash-isms); LF normalized via
   `.gitattributes`.

## Consequences

- Zero build-order complexity; refactors across packages are atomic.
- Anything consuming `@ewm/*` must be able to transform TS — true for Vite/Vitest/tsc,
  false for plain Node. If an external consumer ever appears (e.g. the alerts backend
  living outside this repo, or publishing `@ewm/alerts-schema` for the companions),
  add a dist build **to that package only** and flip its `exports`; nothing else
  changes. Revisit this ADR at that point.
- The DDM migration inherits this pattern: its module becomes a workspace app built by
  Vite, not a published library.

## Alternatives rejected

- **npm/yarn workspaces** — weaker phantom-dependency protection, no catalogs.
- **Per-package tsc dist builds now** — build ordering, watch complexity, and stale-dist
  bugs, purchased before any consumer needs dist output.
- **Polyrepo** — the contract would drift across repos; the DDM experience says shared
  invariants need shared enforcement.
