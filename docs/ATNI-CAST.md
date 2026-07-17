# ATNI-CAST: Climate Alerts & Severity Tracker

**ATNI-CAST is the product this repository builds.** It is a public-facing
climate hazard intelligence platform from the Affiliated Tribes of Northwest
Indians (ATNI), delivering sourced, contextualized severe weather and climate
alerts to Tribal communities, emergency managers, Tribal leadership, and the
general public. ATNI serves 57 member Tribal Nations across the Pacific
Northwest; the platform centers Tribal Nations, extends to Canadian First
Nations across shared watersheds, and is usable by anyone.

This is not a consumer weather dashboard. It is an intergovernmental climate
resilience tool. Many of the communities it serves are rural and
reservation-based, in places where weather hazards are life-critical and
connectivity is limited. The platform must be trustworthy, fast on a phone
during an emergency, and respectful of Tribal data sovereignty at every layer.

## SHIELD

**Severe Hazards Intelligence & Emergency Link Dashboard** (`apps/shell`) is
the single entry point. A user selects a location: a Tribal Nation, a
community, or a geographic area. SHIELD then shows four module cards
reflecting the current hazard state for that place, each a live status
indicator with the current alert level, active alert count, a human-readable
summary, and a link into the full module. A map shows the spatial extent of
active hazards. When alerts are active, safety guidance and emergency
resources surface alongside them. When nothing is active, SHIELD shows an
affirmative conditions-normal state with its last-updated timestamp and
seasonal preparedness content keyed to the selected Nation's hazard profile.

## The Four Modules

| Module | Repository home | Scope |
| --- | --- | --- |
| Drought & Heat | `modules/drought` | Drought severity (USDM categories), excessive heat, fire weather, air quality, wildfire smoke |
| Flood & Coastal | `modules/hydro` | Flash floods, river flooding, coastal flooding, storm surge, tsunami, atmospheric rivers, high surf, rip currents |
| Severe Weather | `modules/severe` | Tornadoes, thunderstorms, high wind, hail, lightning, dust storms, dense fog |
| Snow & Ice | `modules/winter` | Blizzards, ice storms, winter storms, wind chill, freeze warnings, avalanche, snow load |

Each module is a self-contained page with detailed hazard data, maps, sourced
analysis, and module-specific resources, navigable independently and from
SHIELD. All modules implement the shared contract (`packages/contract`).

## Data Sovereignty

The platform operates under the CARE Principles (Collective Benefit,
Authority to Control, Responsibility, Ethics) and a four-tier data model:

- **T0 (public):** weather and hazard data from public agencies, public
  geopolitical boundaries, place names, and general Tribal Nation locations.
  Renders for every user.
- **T1 (attribution required):** direct Tribal contact information. Renders
  only after a user explicitly selects that specific Tribal Nation, and
  always with attribution. The system never pre-populates T1 data in
  aggregate views, search results, or dashboard cards.
- **T2 and T3 (confidential and sacred):** do not exist in this application.
  No schema, no field, no placeholder; the loading layer strips anything so
  marked before it can enter (`packages/tribal-registry`).

The tier check is enforced at the rendering layer in components, not only in
data plumbing. Every map and boundary display carries the sovereignty
disclaimer: public-source land-area representations are not definitive
depictions of Tribal jurisdiction. The repository itself ships no Tribal
Nation data (see `DATA_SOVEREIGNTY.md`).

## Relationship to the Architecture

ATNI-CAST inherits every invariant in `ARCHITECTURE.md`: serverless-static
delivery, TypeScript strict, MapLibre GL with self-hosted tiles, URL as
state, the honest five-state status machine with "as of" timestamps, the
verified source registry, and framework-agnostic core packages. Alert data
normalizes into a unified schema harmonizing United States (NWS/CAP) and
Canadian (ECCC) sources, and every alert carries full provenance: source
agency, original alert ID, fetch timestamp, severity mapping applied, and
geographic coverage.

The visual and editorial authority is the ATNI Climate Design System,
implemented as code in `packages/design-tokens`: the dark ground, the
luminance surface ladder, square edges, the Spartan MB and TeX Gyre families
(self-hosted), the relative type scale, and the house writing rules.

## Status

Foundation phase (07/2026). The module contract, core packages, design
tokens, and the tribal-registry tier machinery are real; SHIELD and the
module experiences are being built on them. The existing
[Dynamic Drought Module](https://github.com/atniclimate/dynamic-drought-module)
migrates in as the Drought & Heat module; the
[PNW Tribal dashboard](https://github.com/atniclimate/pnw-tribal-dashboard)
prototype serves as the requirements reference for SHIELD and Flood &
Coastal.
