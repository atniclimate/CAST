# ADR-0003: Framework-agnostic core; UI frameworks only at the edges

- **Status:** accepted
- **Date:** 2026-07-14

## Context

EWM modules must be embeddable anywhere: the ATNI website, a Squarespace iframe (how
the PNW dashboard prototype shipped), a Nation's own CMS, a kiosk. The shell may want
React later. Frameworks churn on a 3–7 year cycle; hazard-monitoring infrastructure for
Tribal Nations should not.

## Decision

1. Every `packages/*` package is **vanilla TypeScript with zero UI-framework
   dependency**. The contract (`HazardModule`, `PlatformContext`) is framework-free by
   type: nothing in it can smuggle in a component model.
2. Framework adoption is only permitted in `apps/*` (the shell) and, sparingly, inside
   a module's own view code — never in anything another workspace imports.
3. Core exposes framework-friendly seams instead: subscription functions returning
   unsubscribers (`StatusRegistry.subscribe`, `UrlStateBus.subscribe`,
   `MapRuntime.onViewChange`) adapt trivially to React `useSyncExternalStore`, signals,
   or raw DOM.

## Consequences

- The hydro proof-of-life renders its status pill with ~30 lines of DOM code — the
  cost of the rule at current scale, and a demonstration that the seams work.
- If the shell adopts React (likely, Phase 3), it wraps core; core does not know.
- Testability: core logic (status machine, surface manager, URL grammar) tests in
  plain Vitest with no DOM environment.
- Discipline burden: PR review must reject `react`/`vue`/etc. appearing in any
  `packages/*` package.json — the dependency graph is the enforcement point.

## Alternatives rejected

- **React everywhere now** — couples every module's embeddability to one framework's
  lifecycle and bundle; contradicts the DDM's proven embed pattern.
- **Web components as the boundary** — heavier contract surface than five interfaces;
  can be adopted later _on top of_ this core if embedding demands it.
