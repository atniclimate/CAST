# ATNI-CAST Roadmap

ATNI-CAST follows a 0.x sequence that establishes the data foundation before the
public dashboard and hazard modules. The sequence is an order of work, not a release
schedule. Only Phase 0.1 is complete. Phase 0.2 is in progress, and all later phases
are planned.

## 0.1 Foundation: complete 07/17/2026

The foundation established the shared module contract, framework-agnostic core
packages, design tokens, Tribal registry tier machinery, and the ratified decision
register. It also established the pnpm and TypeScript monorepo, MapLibre GL and
PMTiles as the map stack, serverless-static delivery, URL-based state, honest data
status, and the verified source registry.

## 0.2 Data layer: in progress

The data layer will implement the normalized alert model, the four ranked impact
bands plus Unstated, separate action posture and confidence, native regulatory
scales, and cross-border event grouping without merging agency products. Scheduled
static snapshots will provide the resilient data spine, with direct NWS and ECCC
top-ups where current browser access permits. Every surface will retain source
provenance, geometry basis, honest status, and an "as of" timestamp.

This phase will also build the purpose-specific Tribal registry from publicly
accessible T0 Nation data and verified, role-based public contacts. Named-person
contact records will remain outside public history. Slow-changing reference layers
will enter a reproducible PMTiles pipeline, while active alert geometry will remain
runtime GeoJSON. The pipeline will include a documented regional recipe that a
Nation can run for its own area.

Every external endpoint must enter through the verified source registry. The PMTiles
pipeline will replace development basemap dependencies before production deployment.

## 0.3 SHIELD

SHIELD will become the location-aware entry point for ATNI-CAST. React 19 on Vite
will remain confined to the shell and module view layers, while shared packages will
remain framework-agnostic. A search-first location flow will resolve stable Nation
IDs into shareable URLs. The four module cards will keep a fixed order, and an event
hero will carry urgency without moving controls under the reader's hand.

The dashboard will present accessible alert lists before maps, source-specific alert
details, contextual safety resources, role-based emergency contacts, and affirmative
quiet mode. Quiet mode will show a monitoring heartbeat, seasonal preparedness, and
ambient conditions, and it will remain visually distinct from loading or failure.

## 0.4 Module pages

The Drought and Heat, Flood and Coastal, Severe Weather, and Snow and Ice modules
will become contract-conforming public pages. The Dynamic Drought Module migration
will serve as a contract shakedown, with necessary contract refinements recorded as
architectural decisions. Existing Dynamic Drought Module deployments will remain on
their current deployment source until an explicit cutover.

Flood and Coastal work will turn the hydro proof of life into operational
precipitation, atmospheric river, flood, coastal, and river gauge surfaces. Snow and
Ice and Severe Weather will then apply the proven module contract. Each module will
use registered sources, honest status, native hazard scales where applicable, and
shareable URL state.

## 0.5 Briefings and offline

ATNI-CAST will add self-contained, script-free HTML briefings with print CSS, compact
text sharing, text-only routes, Web Share support, and message composition links.
Briefings will preserve provenance and absolute "as of" timestamps when forwarded.

Offline support will precache the revisioned application shell and retain
schema-validated last-good alert data with explicit cached or stale status. Briefings
will use bounded immutable caching. Maps will remain network-only initially;
downloadable regional packs will follow only after measurement confirms storage and
range-request behavior.

## 0.6 Expanded sources

The platform will widen verified coverage for drought and heat, flood and coastal,
severe weather, snow and ice, air quality, river conditions, and cross-border
hazards. Each source will carry ownership, license, cadence, verification, and
provenance metadata. New sources will use scheduled snapshots and carefully bounded
direct access according to source capabilities.

Native Land Digital integration will retain full attribution and provenance.
Licensing reconciliation across sources will occur late in the working application
sequence, with restricted data excluded unless permission permits redistribution.

## 0.7 Geographic expansion

PNW and British Columbia coverage will be completed before expansion. Each later
region requires individual maintainer ratification. The ratified sequence is Great
Lakes, Great Plains, Southwest, Southeast, Northeast, Alaska interior, Puerto Rico,
and Hawaii.

The Southeast step will fund tropical cyclone capability for reuse in later regions.
DS-017 remains open on whether that capability becomes a fifth module or a
cross-module event orchestrator. No implementation choice will precede that ruling.

## 0.8 Design refinement and accessibility

The suite will refine the ATNI Climate Design System across the shell, modules,
maps, briefings, print output, and low-bandwidth views. Work will include final
severity tokens, contrast and color-vision audits, keyboard and screen-reader
testing, responsive behavior, reduced-motion support, and accessible alternatives to
every map interaction.

## 0.9 Performance, testing, and launch

The final prelaunch phase will enforce measured mobile and throttled-network budgets,
complete cross-browser and assistive-technology testing, exercise offline and stale
data paths, validate source failure behavior, and verify production PMTiles delivery.
It will also complete launch documentation, deployment checks, attribution, and the
late licensing reconciliation.

## Deliberately deferred

The following items remain deliberate deferrals rather than omissions:

- No application backend, service-owned database, or authentication system will be
  added without a newly ratified architectural decision. Static snapshots and safe
  client top-ups remain the delivery model.
- Docker and deployment-specific configuration remain outside the module folders.
  Modules are static assets, and each deployment documents its CDN configuration.
- External source URLs enter only through the verified source registry.
- Internal packages remain source packages until a consumer outside the monorepo
  requires published artifacts.
- Automated `verifiedAt` staleness enforcement remains a later reliability check.
