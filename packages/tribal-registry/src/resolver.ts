import type { NationId, TribalRegistry, VersionedRedirectTable } from './model.js';

export type NationSelectionResolution =
  | {
      readonly kind: 'resolved';
      readonly requestedId: string;
      readonly nationId: NationId;
      readonly redirected: boolean;
      readonly redirectPath: readonly string[];
    }
  | {
      readonly kind: 'unresolved';
      readonly requestedId: string;
      readonly reason: 'not-found' | 'retired-without-successor' | 'redirect-target-not-found';
      readonly redirectPath: readonly string[];
    }
  | {
      readonly kind: 'multiple-successors';
      readonly requestedId: string;
      readonly successorIds: readonly NationId[];
      readonly redirectPath: readonly string[];
    };

export class RedirectLoopError extends Error {
  override readonly name = 'RedirectLoopError';

  constructor(readonly loopPath: readonly string[]) {
    super(`Redirect loop detected: ${loopPath.join(' -> ')}`);
  }
}

function redirectMap(table: VersionedRedirectTable): ReadonlyMap<string, readonly string[]> {
  return new Map(table.entries.map((entry) => [entry.fromId, entry.toIds]));
}

export function resolveNationSelection(registry: TribalRegistry, requestedId: string): NationSelectionResolution {
  const redirects = redirectMap(registry.redirects);
  const visit = (id: string, path: readonly string[]): NationSelectionResolution => {
    const loopIndex = path.indexOf(id);
    if (loopIndex >= 0) throw new RedirectLoopError([...path.slice(loopIndex), id]);
    const nextPath = [...path, id];
    const targets = redirects.get(id);
    if (targets !== undefined) {
      if (targets.length > 1) {
        const resolvedTargets = new Set<NationId>();
        for (const target of targets) {
          const result = visit(target, nextPath);
          if (result.kind === 'resolved') resolvedTargets.add(result.nationId);
          else if (result.kind === 'multiple-successors') {
            for (const successorId of result.successorIds) resolvedTargets.add(successorId);
          }
        }
        if (resolvedTargets.size === 0) {
          return { kind: 'unresolved', requestedId, reason: 'redirect-target-not-found', redirectPath: nextPath };
        }
        return {
          kind: 'multiple-successors',
          requestedId,
          successorIds: [...resolvedTargets].sort(),
          redirectPath: nextPath,
        };
      }
      const target = targets[0];
      if (target === undefined) {
        return { kind: 'unresolved', requestedId, reason: 'redirect-target-not-found', redirectPath: nextPath };
      }
      return visit(target, nextPath);
    }
    const nation = registry.nations[id];
    if (nation === undefined) {
      return {
        kind: 'unresolved',
        requestedId,
        reason: path.length === 0 ? 'not-found' : 'redirect-target-not-found',
        redirectPath: nextPath,
      };
    }
    if (nation.status === 'retired') {
      return { kind: 'unresolved', requestedId, reason: 'retired-without-successor', redirectPath: nextPath };
    }
    return {
      kind: 'resolved',
      requestedId,
      nationId: nation.nationId,
      redirected: requestedId !== nation.nationId,
      redirectPath: nextPath,
    };
  };
  return visit(requestedId, []);
}
