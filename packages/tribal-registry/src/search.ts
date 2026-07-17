import type { NationEntity, SearchIndexEntry, TribalRegistry } from './model.js';

export function normalizeSearchAlias(value: string): string {
  return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').trim().replace(/\s+/g, ' ').toLocaleLowerCase('en-US');
}

function attributesForSearch(nation: NationEntity): readonly string[] {
  return [...nation.names.map(({ value }) => value.text), ...nation.aliases.map(({ value }) => value.text)];
}

/**
 * Build a byte-stable alias-to-Nation-ID index. Duplicate aliases remain as
 * separate entries, so same-name Nations stay ambiguous instead of merging.
 */
export function buildSearchIndex(registry: Pick<TribalRegistry, 'nations'>): readonly SearchIndexEntry[] {
  const deduplicated = new Map<string, SearchIndexEntry>();
  for (const nation of Object.values(registry.nations)) {
    for (const alias of attributesForSearch(nation)) {
      const normalizedAlias = normalizeSearchAlias(alias);
      const key = `${normalizedAlias}\u0000${nation.nationId}`;
      if (normalizedAlias !== '' && !deduplicated.has(key)) {
        deduplicated.set(key, { alias, normalizedAlias, nationId: nation.nationId });
      }
    }
  }
  return [...deduplicated.values()].sort(
    (left, right) =>
      left.normalizedAlias.localeCompare(right.normalizedAlias, 'en-US') ||
      left.nationId.localeCompare(right.nationId, 'en-US') ||
      left.alias.localeCompare(right.alias, 'en-US'),
  );
}
