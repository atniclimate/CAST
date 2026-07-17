import { contactsForRender, mayRenderT1, type NationEntity } from '@ewm/tribal-registry';
import { nationDisplayName } from './LocationSelector.js';

export function NationContacts({
  nation,
  selectedNationId,
}: {
  readonly nation: NationEntity | null;
  readonly selectedNationId: string | null;
}) {
  if (nation === null || !mayRenderT1({ selectedNationId }, nation.nationId)) return null;
  const rendered = contactsForRender({ selectedNationId }, nation.nationId, nation);
  if (rendered === null) return null;
  return (
    <section className="contacts" aria-labelledby="contacts-heading">
      <p className="eyebrow">Role-based fixture contacts</p>
      <h2 id="contacts-heading">{nationDisplayName(nation)} contacts</h2>
      {rendered.contacts.map((contact) => (
        <address key={`${contact.office}:${contact.title}`}>
          <strong>{contact.office}</strong>
          <span>{contact.title}</span>
          {contact.publicPhone ? <a href={`tel:${contact.publicPhone}`}>{contact.publicPhone}</a> : null}
          {contact.publicEmail ? <a href={`mailto:${contact.publicEmail}`}>{contact.publicEmail}</a> : null}
        </address>
      ))}
      <p className="attribution">Source: {rendered.attribution.join(', ')}</p>
    </section>
  );
}
