export function SovereigntyDisclaimer() {
  return (
    <aside className="sovereignty-disclaimer" aria-labelledby="sovereignty-heading">
      <h3 id="sovereignty-heading">Sovereignty and boundary notice</h3>
      <p>PLACEHOLDER boundary display. Boundaries are for general reference and do not establish jurisdiction, legal status, or ownership.</p>
    </aside>
  );
}

export function MapPlaceholder() {
  return (
    <section className="map-placeholder" aria-labelledby="map-heading">
      <div className="section-heading">
        <p className="eyebrow">Map follows the semantic alert list</p>
        <h2 id="map-heading">Map and boundary placeholder</h2>
      </div>
      <div className="map-placeholder__canvas" aria-label="Map placeholder, no map data loaded">
        <span>MAP PLACEHOLDER</span>
      </div>
      <SovereigntyDisclaimer />
    </section>
  );
}
