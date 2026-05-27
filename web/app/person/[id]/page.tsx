import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  getPerson,
  getPersons,
  getRelationshipsForPerson,
  getFilingsForPerson,
  getEntityIndex,
  isPersonId,
} from '@/lib/data';
import { formatDate } from '@/lib/format';
import type { PersonId, EntityId, QualifyingRole } from '@/lib/types';

export async function generateStaticParams() {
  const persons = await getPersons();
  return persons.map((p) => ({ id: p.person_id }));
}

export const dynamicParams = false;

function currentRole(roles: QualifyingRole[]): QualifyingRole | null {
  if (roles.length === 0) return null;
  const active = roles.filter((r) => !r.end_date || r.end_date > new Date().toISOString());
  if (active.length > 0) {
    return active.sort((a, b) => b.start_date.localeCompare(a.start_date))[0];
  }
  return roles.sort((a, b) => b.start_date.localeCompare(a.start_date))[0];
}

export default async function PersonPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!isPersonId(id)) notFound();

  const person = await getPerson(id as PersonId);
  if (!person) notFound();

  const [filings, rels, entityIndex] = await Promise.all([
    getFilingsForPerson(id as PersonId),
    getRelationshipsForPerson(id as PersonId),
    getEntityIndex(),
  ]);

  const allRoles = rels
    .map((r) => r.qualifying_role)
    .filter((r): r is QualifyingRole => r != null);
  const role = currentRole(allRoles);

  const filingEdgeCount = new Map<string, number>();
  for (const r of rels) {
    filingEdgeCount.set(r.filing_source, (filingEdgeCount.get(r.filing_source) ?? 0) + 1);
  }

  const entityEdgeCount = new Map<string, number>();
  for (const r of rels) {
    const candidate =
      r.source_id === id
        ? r.target_id
        : r.target_id === id
        ? r.source_id
        : null;
    if (candidate && candidate.startsWith('cp_entity_')) {
      entityEdgeCount.set(candidate, (entityEdgeCount.get(candidate) ?? 0) + 1);
    }
  }

  const topEntities = [...entityEdgeCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 25);

  const sortedFilings = [...filings].sort((a, b) => a.source_filing_date.localeCompare(b.source_filing_date));

  return (
    <article className="space-y-6">
      <header>
        <h1 className="prose-sans text-2xl font-semibold leading-tight">
          {person.canonical_name}
        </h1>
        {role ? (
          <div className="prose-sans text-sm text-[color:var(--color-muted)] mt-0.5">
            {role.role}{' '}
            <span className="font-mono text-[11px]">
              ({formatDate(role.start_date)}
              {role.end_date ? ` – ${formatDate(role.end_date)}` : ''})
            </span>
          </div>
        ) : null}
        <div className="font-mono text-[11px] text-[color:var(--color-muted)] mt-1">
          {person.person_id}
        </div>
        {person.aliases.length > 0 ? (
          <div className="mt-3 font-mono text-[11px] text-[color:var(--color-muted)]">
            aliases: {person.aliases.map((a) => a.name).join(' · ')}
          </div>
        ) : null}
      </header>

      <section>
        <h2 className="prose-sans text-sm font-semibold mb-2">
          Filings ({sortedFilings.length})
        </h2>
        {sortedFilings.length === 0 ? (
          <div className="font-mono text-xs text-[color:var(--color-muted)]">
            No filings on record where this person is the filer.
          </div>
        ) : (
          <ul className="space-y-1">
            {sortedFilings.map((f) => {
              const edges = filingEdgeCount.get(f.filing_id) ?? 0;
              return (
                <li key={f.filing_id} className="flex flex-wrap items-baseline gap-3 border-b border-[color:var(--color-rule)] py-1">
                  <Link href={`/filing/${f.filing_id}`} className="font-mono text-sm no-underline hover:underline">
                    {f.filing_id}
                  </Link>
                  <span className="prose-sans text-sm">
                    {f.filing_type.replace(/^OGE_Form_278e_/, '').replace(/_/g, ' ')}
                  </span>
                  <span className="font-mono text-[11px] text-[color:var(--color-muted)]">
                    {f.source_filing_date}
                  </span>
                  <span className="font-mono text-[11px] text-[color:var(--color-muted)] ml-auto">
                    {edges} edges
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section>
        <h2 className="prose-sans text-sm font-semibold mb-2">
          Top entities by edge count{topEntities.length === 25 ? ' (capped at 25)' : ''}
        </h2>
        {topEntities.length === 0 ? (
          <div className="font-mono text-xs text-[color:var(--color-muted)]">
            No entities tied to this person.
          </div>
        ) : (
          <ul className="space-y-1">
            {topEntities.map(([eid, count]) => {
              const e = entityIndex.get(eid as EntityId);
              return (
                <li key={eid} className="flex flex-wrap items-baseline gap-3 border-b border-[color:var(--color-rule)] py-1">
                  <Link href={`/entity/${eid}`} className="no-underline hover:underline">
                    <span className="prose-sans text-sm">{e?.canonical_name ?? eid}</span>
                  </Link>
                  <span className="font-mono text-[11px] text-[color:var(--color-muted)]">
                    {eid}
                  </span>
                  <span className="font-mono text-[11px] text-[color:var(--color-muted)] ml-auto">
                    {count} {count === 1 ? 'edge' : 'edges'}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {person.notes ? (
        <section className="border-t border-[color:var(--color-rule)] pt-4">
          <h2 className="prose-sans text-sm font-semibold mb-2">Notes</h2>
          <p className="prose-sans text-sm text-[color:var(--color-muted)] leading-relaxed whitespace-pre-wrap">
            {person.notes}
          </p>
        </section>
      ) : null}
    </article>
  );
}
