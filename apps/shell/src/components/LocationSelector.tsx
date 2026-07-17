import type { ViewState } from '@ewm/core-state';
import type { NationEntity, TribalRegistry } from '@ewm/tribal-registry';
import { useState } from 'react';

export function nationDisplayName(nation: NationEntity): string {
  return (
    nation.names.find(({ value }) => value.kind === 'display')?.value.text ??
    nation.names[0]?.value.text ??
    'Unnamed fixture Nation'
  );
}

export function LocationSelector({
  registry,
  view,
  selectedNationId,
  onSelect,
}: {
  readonly registry: TribalRegistry;
  readonly view: ViewState;
  readonly selectedNationId: string | null;
  readonly onSelect: (nationId: string | null) => void;
}) {
  const nations = Object.values(registry.nations).sort((left, right) =>
    nationDisplayName(left).localeCompare(nationDisplayName(right)),
  );
  const [query, setQuery] = useState('');

  const acceptSearch = () => {
    const normalized = query.trim().toLocaleLowerCase('en-US');
    const match = nations.find((nation) => {
      const names = [
        ...nation.names.map(({ value }) => value.text),
        ...nation.aliases.map(({ value }) => value.text),
      ];
      return names.some((name) => name.toLocaleLowerCase('en-US') === normalized);
    });
    if (match !== undefined) onSelect(match.nationId);
  };

  return (
    <section className="location-selector" aria-labelledby="location-heading">
      <div>
        <p className="eyebrow">Fixture location</p>
        <h2 id="location-heading">Select a Tribal Nation</h2>
        <p>Selection is stored only in the shareable URL key <code>n</code>.</p>
      </div>
      <div className="location-selector__controls">
        <label htmlFor="nation-search">Search the fictional fixture set</label>
        <div className="search-row">
          <input
            id="nation-search"
            type="search"
            list="fixture-nations"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Type an exact fixture name"
          />
          <datalist id="fixture-nations">
            {nations.map((nation) => <option key={nation.nationId} value={nationDisplayName(nation)} />)}
          </datalist>
          <button type="button" onClick={acceptSearch}>Accept</button>
        </div>
        <label htmlFor="nation-browse">Or browse alphabetically</label>
        <select
          id="nation-browse"
          value={selectedNationId ?? ''}
          onChange={(event) => onSelect(event.target.value === '' ? null : event.target.value)}
        >
          <option value="">All fixture locations</option>
          {nations.map((nation) => <option key={nation.nationId} value={nation.nationId}>{nationDisplayName(nation)}</option>)}
        </select>
        {view.nation !== undefined && selectedNationId === null ? (
          <p className="selection-error" role="status">The URL contains an unknown fixture Nation ID. No Nation contacts are shown.</p>
        ) : null}
      </div>
    </section>
  );
}
