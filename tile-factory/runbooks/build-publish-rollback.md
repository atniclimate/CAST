# NOT YET AUTHORIZED: build, publish, and rollback runbook

This document describes an intended production flow only. No build, upload,
promotion, or rollback is authorized until the pending toolchain ruling is
ratified and an operator approves the target storage and release controls.

## Preconditions

1. Select an immutable source snapshot and retain its primary metadata URL.
2. Confirm source terms and required attribution. An `unverified` terms status
   blocks production publication.
3. Approve a source-layer contract instance against
   `contract/source-layer-contract.schema.json`.
4. Use only the pinned tools and acquisition sources in
   `recipes/toolchain.md`, with independently verified downloaded checksums.
5. Record build parameters, source retrieval time, source checksum, operator,
   tool versions, and intended artifact version in the build record.

## Intended build flow

1. Fetch the approved snapshot into ephemeral build storage without modifying
   the source.
2. Verify the input checksum and expected coordinate reference system.
3. Normalize only the fields promised by the source-layer contract. Preserve
   stable agency identifiers and do not infer jurisdiction or legal status.
4. Validate geometry, then generate vector tiles with explicit layer ids and
   zoom bounds. Convert or package the result as PMTiles version 3.
5. Inspect archive metadata and calculate SHA-256 over the final bytes.
6. Create the immutable manifest, replace all `PENDING_BUILD` sentinels, and
   validate it against `contract/artifact-manifest.schema.json`.
7. Run every case in `qa/conformance-cases.json`. Retain the results with the
   release record. Any failure blocks publication.

## Intended publish flow

1. Upload the archive and manifest to a versioned, immutable staging prefix.
2. Verify remote byte length, SHA-256, range requests, content type, cache
   headers, and CORS behavior from the serving origin.
3. Smoke-test representative layers, zooms, seams, attribution, and low-bandwidth
   behavior against staging.
4. Promote by changing one small release pointer from the previous immutable
   version to the approved version. Never overwrite an existing artifact.
5. Verify the public pointer, then record publisher, time, previous version,
   new version, manifest checksum, and conformance result.

## Rollback triggers

Rollback is required for checksum mismatch, corrupt range responses, missing
layers or required attributes, material seam/topology defects, incorrect source
vintage, invalid attribution, newly discovered terms restrictions, or runtime
failure attributable to the artifact.

## Intended rollback flow

1. Freeze further promotion and mark the affected version unavailable without
   deleting its audit evidence.
2. Repoint the release pointer to the last conformance-passing immutable version.
3. Purge only the mutable pointer or metadata cache. Immutable artifact URLs stay
   immutable and are not silently replaced.
4. Verify checksum, range behavior, layers, attribution, and representative map
   views for the restored version.
5. Record the trigger, detection time, operator, restored version, public impact,
   and follow-up owner. A terms or provenance defect requires governance review
   before the failed version can be rebuilt.

## Evidence retained per release

- Source URLs, vintage, retrieval time, and input checksums
- Tool names, versions, acquisition checksums, and build parameters
- Artifact manifest and SHA-256
- Machine-readable and human-reviewed conformance results
- Publication and rollback receipts

