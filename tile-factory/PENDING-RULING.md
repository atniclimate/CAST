# Draft ADR: repository boundary for the tile factory

- Status: Proposed, pending maintainer ruling
- Decision owner: Maintainer
- Scope: Repository language and tooling boundary for `tile-factory/`

## Context

The current architecture states a TypeScript-everywhere invariant and disallows a
second implementation language in the repository. The ratified map architecture,
however, requires self-hosted PMTiles for slow-changing reference layers and names
tippecanoe plus the PMTiles CLI as the intended native geospatial toolchain. Those
tools and the reproducible orchestration around them do not naturally belong to
the browser/runtime TypeScript workspace.

This contract wave adds only documentation and JSON. Pipeline implementation
remains unauthorized, so the conflict must be ruled before executable pipeline
files or CI are introduced.

## Proposed decision

1. Designate `tile-factory/` as a governed non-TypeScript geospatial build
   boundary, exempt from package-workspace globs and the root TypeScript lint and
   typecheck scope.
2. Scope the TypeScript-only invariant to product and shared runtime code under
   `packages/`, `modules/`, and `apps/`.
3. Keep `tile-factory/` outside runtime dependency graphs. Its interface to the
   product is immutable PMTiles artifacts plus manifests conforming to the JSON
   contracts in this directory.
4. Require the tile factory to own language-appropriate linting, tests, pinned
   external tools, reproducibility evidence, provenance, license verification,
   conformance checks, and an independently documented release process.
5. Keep workspace and root lint configuration unchanged during the contract-only
   wave. Any later configuration edit requires a separately authorized change.
6. If pipeline scale, release cadence, security boundaries, binary storage, or
   maintainership becomes materially independent, extract `tile-factory/` into a
   dedicated repository. The extraction boundary is the whole directory; its
   internal paths and contracts remain valid after the move.

## Consequences

- The runtime remains strictly TypeScript while native geospatial tooling has an
  explicit, narrow exception instead of an accidental policy violation.
- Root workspace operations remain focused on deployable application code and do
  not require native GIS tools.
- Artifact manifests and conformance evidence become the audited seam between the
  pipeline and runtime.
- The exception requires its own maintenance and security-update discipline.
- Extraction remains straightforward, but a separate repository would add release
  coordination and artifact-version management.

## Alternatives considered

### Keep all orchestration in TypeScript

This preserves the literal invariant but still shells out to non-TypeScript native
tools, adds runtime wrappers without removing the external dependency, and risks
making the language choice more important than reproducibility and GIS fitness.

### Extract immediately

This creates the cleanest policy boundary now, but adds repository, release, and
coordination overhead before pipeline scale is known. The proposed directory
boundary preserves this option without paying that cost in the contract wave.

### Treat the directory as an undocumented exception

This is rejected because root lint/workspace behavior and ownership would remain
ambiguous, making both local verification and later extraction fragile.

## Ratification

This text is a proposal only. The maintainer must accept, amend, or reject it.
Nothing in this file authorizes pipeline code, tool installation, binary artifacts,
workspace configuration changes, or production publication.

