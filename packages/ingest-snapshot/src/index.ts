/**
 * @ewm/ingest-snapshot: Node-only snapshot transport.
 *
 * Wave-1d lane target. The scheduled writer fetches each registered runtime
 * source, parses through the shared agency parsers, finalizes through
 * @ewm/ingest-core, refuses rejected or partial batches, and publishes
 * content-addressed snapshot bodies with the manifest written last
 * (SNAPSHOT_WRITE_ORDER). Skeleton only; no transport logic yet.
 */
export const INGEST_SNAPSHOT_PACKAGE = '@ewm/ingest-snapshot';
