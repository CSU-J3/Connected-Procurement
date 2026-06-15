import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  getEntities,
  getEntity,
  getRelationshipsForEntity,
  getEntityIndex,
  getPersonIndex,
  getFilingIndex,
  getMergesForEntity,
  getNexusesForEntity,
  getEntitiesIndex,
  isEntityId,
} from '@/lib/data';
import { EntityViewRow } from '@/components/RelationshipRow';
import { NexusStatusPill } from '@/components/NexusStatusPill';
import { instrumentTypeLabel } from '@/lib/format';
import type { EntityId } from '@/lib/types';

export async function generateStaticParams() {
  const entities = await getEntities();
  return entities.map((e) => ({ id: e.entity_id }));
}

export const dynamicParams = false;

export default async function EntityPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!isEntityId(id)) notFound();

  const entity = await getEntity(id as EntityId);
  if (!entity) notFound();

  const [rels, entityIndex, personIndex, filingIndex, merges, nexuses, entitiesIndex] =
    await Promise.all([
      getRelationshipsForEntity(id as EntityId),
      getEntityIndex(),
      getPersonIndex(),
      getFilingIndex(),
      getMergesForEntity(id as EntityId),
      getNexusesForEntity(id as EntityId),
      getEntitiesIndex(),
    ]);

  // Shared filing-filer connected-person facet (Path A): same source the /entities index
  // reads, so the two views agree. Filing-filer is a superset of the old direct-only set,
  // and it surfaces the disclosing family member for deep sub-entities (e.g. 666 Fifth
  // Associates -> Jared) whose detail page previously showed no connection.
  const connectedPersonIds = entitiesIndex[id]?.connected_persons ?? [];

  const formerNames: string[] = [];
  for (const m of merges.asWinner) {
    if (m.loser_id.startsWith('cp_entity_')) {
      const loser = entityIndex.get(m.loser_id as EntityId);
      if (loser) formerNames.push(loser.canonical_name);
    }
  }

  const sortedRels = [...rels].sort((a, b) => a.observed_on.localeCompare(b.observed_on));

  return (
    <article className="space-y-6">
      <header>
        <h1 className="prose-sans text-2xl font-semibold leading-tight">
          {entity.canonical_name}
        </h1>
        {formerNames.length > 0 ? (
          <div className="font-mono text-xs text-[color:var(--color-muted)] mt-1">
            formerly known as {formerNames.join(', ')}
          </div>
        ) : null}
        <div className="font-mono text-[11px] text-[color:var(--color-muted)] mt-1">
          {entity.entity_id}
        </div>
        {connectedPersonIds.length > 0 ? (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="font-mono text-[10px] uppercase tracking-wider text-[color:var(--color-muted)]">
              Connected via
            </span>
            {connectedPersonIds.map((pid) => {
              const p = personIndex.get(pid as `cp_person_${string}`);
              return (
                <Link
                  key={pid}
                  href={`/person/${pid}`}
                  className="inline-block px-1.5 py-0.5 text-[11px] font-mono border border-[color:var(--color-rule)] hover:border-[color:var(--color-rule-strong)] no-underline hover:no-underline"
                >
                  <span className="prose-sans">{p?.canonical_name ?? pid}</span>
                </Link>
              );
            })}
          </div>
        ) : null}
        {entity.aliases.length > 0 ? (
          <div className="mt-3 font-mono text-[11px] text-[color:var(--color-muted)]">
            aliases: {entity.aliases.map((a) => a.name).join(' · ')}
          </div>
        ) : null}
        {entity.external_ids.length > 0 ? (
          <div className="mt-1 font-mono text-[11px] text-[color:var(--color-muted)]">
            external IDs: {entity.external_ids.map((x) => `${x.id_type}:${x.id_value}`).join(' · ')}
          </div>
        ) : null}
      </header>

      {nexuses.length > 0 ? (
        <section className="border border-[color:var(--color-rule-strong)] p-3">
          <h2 className="font-mono text-[10px] uppercase tracking-wider text-[color:var(--color-muted)] mb-2">
            Federal procurement nexus
          </h2>
          <div className="space-y-2">
            {nexuses.map((n) => (
              <Link
                key={n.nexus_id}
                href={`/nexus/${n.nexus_id}`}
                className="flex flex-wrap items-center gap-x-2 gap-y-1 no-underline hover:underline"
              >
                <NexusStatusPill status={n.counting_status} />
                <span className="font-mono text-[12px]">
                  {instrumentTypeLabel(n.instrument_type)} {n.instrument_id}
                  {n.agency ? ` · ${n.agency}` : ''}
                </span>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <section>
        <h2 className="prose-sans text-sm font-semibold mb-2">
          Relationships ({sortedRels.length})
        </h2>
        {sortedRels.length === 0 ? (
          <div className="font-mono text-xs text-[color:var(--color-muted)]">
            No relationships disclosed touching this entity in the current registry.
          </div>
        ) : (
          <div>
            {sortedRels.map((rel) => (
              <EntityViewRow
                key={rel.relationship_id}
                rel={rel}
                personIndex={personIndex}
                filingIndex={filingIndex}
              />
            ))}
          </div>
        )}
      </section>

      {entity.notes ? (
        <section className="border-t border-[color:var(--color-rule)] pt-4">
          <h2 className="prose-sans text-sm font-semibold mb-2">Notes</h2>
          <p className="prose-sans text-sm text-[color:var(--color-muted)] leading-relaxed whitespace-pre-wrap">
            {entity.notes}
          </p>
        </section>
      ) : null}
    </article>
  );
}
