# EWM Shell

**Status: stub — no build yet.** ROADMAP Phase 3.

The shell is the one static app that will host all hazard modules on the ATNI website:
unified navigation between drought / hydro / winter / severe, the shared URL grammar
(`@ewm/core-state`) so links deep-link across modules, a combined status panel over
every registered layer, and a single place to assemble the `PlatformContext`.

What the shell is **not**:

- Not required — every module must keep running standalone and embeddable (the DDM's
  deployment model, invariant #8).
- Not a backend — it stays serverless-static like everything else (invariant #1).
- Not framework-neutral — this is the one workspace where a UI framework (likely
  React) may be adopted, per ADR-0003. Core packages stay vanilla TS.

Until the DDM migration and real hydro content exist, building the shell would be
gold-plating; the hydro proof-of-life's `main.ts` currently plays the shell's role and
documents the composition pattern.
