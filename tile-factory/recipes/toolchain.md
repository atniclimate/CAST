# Proposed tile toolchain recipe

This recipe records proposed pins and trusted acquisition locations. It does not
authorize installation or execution. Review and update the pins deliberately;
never resolve `latest` during a production build.

## tippecanoe

- Proposed pin: `2.79.0`
- Purpose: normalize GeoJSON/FlatGeobuf input into deterministic vector-tile
  layers with explicit layer ids, zoom bounds, retained attributes, clipping,
  and simplification policy.
- Install source: the Felt tippecanoe release tagged `2.79.0` at
  <https://github.com/felt/tippecanoe/releases/tag/2.79.0>.
- Upstream installation documentation:
  <https://github.com/felt/tippecanoe#installation>.
- Acquisition rule: use a release asset or build from the exact signed tag in an
  isolated build image; capture and independently verify the acquired bytes.

## PMTiles CLI

- Proposed pin: `1.30.0` from `protomaps/go-pmtiles`
- Archive format: PMTiles specification version 3
- Purpose: inspect archive metadata, convert MBTiles when needed, verify or
  extract archives, and publish only after conformance succeeds.
- Install source: the Protomaps go-pmtiles release tagged `v1.30.0` at
  <https://github.com/protomaps/go-pmtiles/releases/tag/v1.30.0>.
- Upstream CLI documentation: <https://github.com/protomaps/PMTiles>.
- Acquisition rule: select the release asset for the build platform, verify its
  published digest or provenance when available, and record the local SHA-256.

## Build environment record

The future pipeline must pin the operating-system image by immutable digest and
record platform architecture, locale, time zone, tool versions, input hashes,
and every material tiling parameter. Production builds must not depend on a
developer workstation's ambient tools.

## Why tools are not vendored

These are independently maintained native binaries with their own release and
security lifecycles. Vendoring would enlarge the repository, obscure upstream
provenance, create platform-specific binary churn, and turn source review into
binary trust. The contract instead pins upstream versions and requires verified,
ephemeral acquisition in the future authorized build environment. No tool binary
or package-manager dependency belongs in this contract wave.

