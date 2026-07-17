# Data Sovereignty

ATNI-CAST centers Tribal Nations. That is an architectural property, not a
landing-page sentence, and it produces hard rules about what this repository
may contain and what the platform may do with Nation-specific data. This
document was revised 07/17/2026 under decision DS-014; the prior revision
treated all Nation data as non-shippable, and that rule now applies only to
the categories listed below.

## The tier model (CARE Principles)

- **T0, public.** Publicly accessible Nation data: official names, general
  locations, public-source boundaries (Census AIANNH, NRCan Aboriginal
  Lands, BIA LAR for general cartography), hazard exposure context, public
  websites, and all weather, climate, and alert data from public agencies.
  T0 data embeds directly in the suite and may ship in this repository. The
  registry's scope is all federally recognized and state-recognized Tribes
  and Canadian First Nations.
- **T1, attribution required.** Contact information and other
  Tribe-associated records that render only when a user has explicitly
  selected that specific Tribal Nation, always with attribution. The tier
  gate in `@ewm/tribal-registry` is the only sanctioned rendering path.
- **T2 and T3, confidential and sacred.** Never enter this application in
  any form. No schema, no field, no placeholder; the loader strips anything
  so marked before it can exist in memory.

## What still never ships in this repository

1. **Named-person contact details** (a person's name beside a direct phone
   number or email). Their handling is an open decision (DS-015); until it
   is ruled, sensitive extracts live only under `data/sensitive/`, which
   version control refuses.
2. Community indicator data, cultural or sacred site information, and
   anything a Nation has not published to the public.
3. Data whose source terms forbid redistribution (for example BC TANTALIS
   Treaty settlement lands, licensed Access Only, until explicit permission
   is obtained).
4. Test fixtures derived from any of the above. Test data is fictional and
   labeled as such.

## The registry is purpose-built

The example Tribal Database is a scaffold: this project builds its own
registry, informed by that structure, populated from public sources with
full provenance per record. The loader (`@ewm/tribal-registry`) enforces two
structural gates: registry data without a provenance statement does not
load, and records marked above T1 do not load, in any deployment, ever.

Attribution commitments travel with the data. Native Land Digital layers are
used with full provenance and full attribution, working with that project
directly; licensing reconciliation across all sources is a scheduled
late-phase pass (DS-016), and every layer carries owner, license, and
vintage metadata in `packages/sources` from the day it is staged.

## Community data keeps the empty-placeholder pattern

`@ewm/places` still ships the shape of community-level data and none of the
data. Indicators, community places, and anything a Nation attaches to its
places remain deployment-provided, outside version control, behind the
provenance gate. The public registry describes Nations from public sources;
the places engine carries what Nations choose to add, on infrastructure they
control.

## No phoning home

The platform makes no requests that carry place or selection data anywhere.
There is no analytics endpoint, no telemetry, and no usage channel. The
verified source registry, with every outbound URL in one auditable table, is
what makes this claim checkable.

## Boundary displays

Every map and boundary display carries the sovereignty disclaimer:
public-source land-area representations are not definitive depictions of
Tribal jurisdiction. The disclaimer is a component, not copy-pasted text.

## Review rule

Any PR touching `@ewm/tribal-registry`, `@ewm/places`, the sovereign-data
lines of `.gitignore`, or this document gets a named human reviewer and
cannot be merged by automation alone.
