# Tile factory contract

This directory defines the metadata, layer, quality, and operating contracts for
future ATNI-CAST reference-layer PMTiles artifacts. It is contract-only. Nothing
here builds, downloads, publishes, or serves data.

## Extraction story

`tile-factory/` is a self-contained boundary that can be lifted into its own
repository without rewriting paths. All internal paths start at this directory,
and the schemas do not depend on monorepo packages or configuration. A future
extraction should copy this directory as the new repository root, preserve the
relative layout, then add the separately authorized pipeline and CI around these
contracts.

## Layout

- `contract/` contains JSON Schema draft 2020-12 contracts.
- `manifests/fixtures/` contains example artifact metadata, not built artifacts.
- `qa/` describes conformance cases for a future PMTiles archive.
- `runbooks/` describes the intended, not-yet-authorized operating flow.
- `recipes/` pins the proposed external toolchain.
- `PENDING-RULING.md` contains a decision draft that is not accepted policy.

## Placeholder convention

Values that only a real build can produce use an explicit sentinel instead of
fabricated data. A not-yet-built artifact checksum is represented as
`checksum.status: "pending-build"` and `checksum.value: "PENDING_BUILD"`. The
artifact URI follows the same convention as `artifact_uri: "PENDING_BUILD"`.
Production manifests must replace both sentinels, set the checksum status to
`verified`, and record a lowercase 64-character SHA-256 digest before publish.

When an agency identifies a vintage only by year, `vintage.as_of` uses January 1
of that year solely as a machine-readable normalization; `vintage.label` remains
the authoritative wording. A build must replace catalogue-publication vintages
with the exact selected source snapshot or retrieval date.

`license.status: "unverified"` is not a placeholder. It is an honest governance
state meaning the named terms have not been confirmed from a primary source for
that specific dataset and vintage.

## Deliberately absent in this wave

- Pipeline code or executable scripts
- Vendored copies of tippecanoe, the PMTiles CLI, or other tools
- PMTiles, MBTiles, GeoJSON, shapefile, or other binary/data artifacts
- The binary conformance archive, deferred until the toolchain ruling
- Installation steps executed by this repository or workspace dependencies
