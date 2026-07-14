# Data Sovereignty

EWM centers Tribal Nations. That is an architectural property, not a landing-page
sentence, and it produces hard rules about what this repository may contain and what
the platform may do with Nation-specific data.

## What never ships in this repo

- Tribal boundary geometries, in any format, at any precision.
- Names, locations, or attributes of specific communities, facilities, or cultural
  sites.
- Community indicator data (health, infrastructure, vulnerability, capacity — anything
  a Nation might attach to its places).
- Test fixtures derived from any of the above. Test data is fictional and labeled as
  such (see `packages/places/src/index.test.ts`).

If a contribution needs realistic sovereign-shaped data to develop against, it uses the
fictional fixtures or generates synthetic data in code, the way `modules/hydro` does.

## The empty-placeholder pattern

`@ewm/places` ships the **shape** of place data and none of the data:

- `PlacesDataset` — the schema a deploying organization fills: `schemaVersion`,
  `provenance`, `places[]` (id, name, kind, geometry, opaque `indicators`).
- `EMPTY_PLACES_DATASET` — the placeholder every fresh deployment starts with:
  structurally valid, semantically empty, and self-describing.
- Deployments provide their own dataset **outside version control**. Convention:
  `places.local.json`, which the root `.gitignore` refuses (alongside
  `**/sovereign-data/`).

Each Nation populates its own deployment, on infrastructure it chooses, from data it
controls. Two Nations running EWM share code and share nothing else.

## The provenance gate

`loadPlacesDataset` **rejects** any dataset that contains places but lacks a non-empty
`provenance` statement — a human-written declaration of the authority under which the
data is published (e.g. "Published by the <Nation> GIS office, approved 2026-05-01").
This is a structural gate, not a convention: sovereign data without stated authority
does not load, in any deployment, ever.

The `indicators` field is opaque to the platform by contract. Core code never
interprets, aggregates, or transmits it. Features that want to _render_ indicators
receive render instructions from the deployment, not schema knowledge in core.

## No phoning home

The platform makes no requests that carry place data anywhere. Nothing in core or in
any module transmits the contents of the place engine — there is no analytics
endpoint, no telemetry, no "usage improvement" channel. The verified source registry
(all outbound URLs in one auditable table) is what makes this claim checkable.

## Relation to the alerts backend (future)

The planned alerts/subscription backend inverts the flow — users opt in to receive
alerts for areas they choose. Its design must preserve the same property: a Nation's
boundary used for alert matching stays under that Nation's control (deployment-side
matching or Nation-hosted services, not a central boundary database). That design work
is tracked in ROADMAP and must be reviewed against this document.

## Review rule

Any PR touching `@ewm/places`, `.gitignore`'s sovereign-data lines, or this document
gets a named human reviewer and cannot be merged by automation alone.
