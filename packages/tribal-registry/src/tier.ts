import type { NationEntity, RoleBasedContact } from './model.js';

export interface TierSelectionContext {
  readonly selectedNationId: string | null;
}

export function mayRenderT1(ctx: TierSelectionContext, nationId: string): boolean {
  return ctx.selectedNationId !== null && ctx.selectedNationId === nationId;
}

export interface AttributedContacts {
  readonly contacts: readonly RoleBasedContact[];
  readonly attribution: readonly string[];
}

/** The only sanctioned render path for DS-015 role-based contacts. */
export function contactsForRender(
  ctx: TierSelectionContext,
  nationId: string,
  nation: NationEntity,
): AttributedContacts | null {
  if (!mayRenderT1(ctx, nationId) || nation.contacts.length === 0) return null;
  return {
    contacts: nation.contacts,
    attribution: [...new Set(nation.contacts.map(({ source }) => source))].sort(),
  };
}

export function hazardIsElevated(flag: boolean | string | null | undefined): boolean {
  if (flag === true) return true;
  if (typeof flag === 'string') {
    const value = flag.trim().toLowerCase();
    return value === 'extreme' || value === 'high' || value === 'very-high';
  }
  return false;
}
