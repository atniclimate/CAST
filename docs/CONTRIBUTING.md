# Contributing to ATNI-CAST

ATNI-CAST welcomes contributions that improve trustworthy, accessible climate hazard
information for Tribal Nations and the public. Contributions should preserve the
project's serverless-static architecture, public-source provenance, and data
sovereignty safeguards.

## Quickstart

The repository uses pnpm through Corepack. A local checkout can be prepared and
verified with the following commands:

```powershell
corepack enable
pnpm install
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

The Flood and Coastal proof of life can be run locally with:

```powershell
pnpm --filter hydro dev
```

## Architecture invariants

Every contribution must follow the non-negotiable principles in
[`docs/ARCHITECTURE.md`](ARCHITECTURE.md). These principles cover serverless-static
delivery, strict TypeScript, MapLibre GL, URL-based state, honest data status,
sovereignty protections, verified sources, and framework-agnostic shared packages.

## Writing rules

Public project prose uses institutional third person and the Oxford comma. It does
not use em dashes. Dates use `MM/DD/YYYY`. The words Tribe, Tribal, Treaty, and
Nation are always capitalized. Full formal Nation names are never abbreviated.

## Sovereignty review

Changes to `packages/tribal-registry`, `packages/places`, sovereign `.gitignore`
lines, or [`docs/DATA_SOVEREIGNTY.md`](DATA_SOVEREIGNTY.md) require a named human
reviewer and cannot merge by automation alone. Publicly accessible Nation data must
remain T0, role-based contact records must cite a public source and verification
date, and named-person contact records must never enter public history without a
ratified consent and verification process.

## Architectural decisions

Architectural decisions are ratified by the maintainers and recorded publicly.
Accepted architectural decision records live in
[`docs/DECISIONS`](DECISIONS/). A contribution that changes an invariant, a shared
contract, a data boundary, or a cross-module behavior should identify the applicable
record or request a new decision before implementation.
