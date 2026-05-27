import Link from 'next/link';
import { SearchInput } from '@/components/SearchInput';
import { getEntities, getPersons, getRelationships } from '@/lib/data';

export const metadata = {
  title: 'Search — Connected Procurement',
};

const RESULT_CAP = 50;

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = '' } = await searchParams;
  const query = q.trim();
  const lower = query.toLowerCase();

  const [entities, persons, rels] = await Promise.all([
    getEntities(),
    getPersons(),
    getRelationships(),
  ]);

  const entityEdgeCount = new Map<string, number>();
  const personFilingsSeen = new Map<string, Set<string>>();
  for (const r of rels) {
    if (r.source_id.startsWith('cp_entity_')) {
      entityEdgeCount.set(r.source_id, (entityEdgeCount.get(r.source_id) ?? 0) + 1);
    }
    if (r.target_id.startsWith('cp_entity_')) {
      entityEdgeCount.set(r.target_id, (entityEdgeCount.get(r.target_id) ?? 0) + 1);
    }
    if (r.source_id.startsWith('cp_person_')) {
      const seen = personFilingsSeen.get(r.source_id) ?? new Set();
      seen.add(r.filing_source);
      personFilingsSeen.set(r.source_id, seen);
    }
  }

  let entityResults: Array<{
    id: string;
    name: string;
    matchedAlias?: string;
    edges: number;
  }> = [];
  let personResults: Array<{ id: string; name: string; matchedAlias?: string; filingCount: number }> = [];

  if (lower) {
    entityResults = entities
      .map((e) => {
        const nameMatch = e.canonical_name.toLowerCase().includes(lower);
        const aliasMatch = e.aliases.find((a) => a.name.toLowerCase().includes(lower));
        if (!nameMatch && !aliasMatch) return null;
        return {
          id: e.entity_id,
          name: e.canonical_name,
          matchedAlias: nameMatch ? undefined : aliasMatch?.name,
          edges: entityEdgeCount.get(e.entity_id) ?? 0,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)
      .sort((a, b) => b.edges - a.edges)
      .slice(0, RESULT_CAP);

    personResults = persons
      .map((p) => {
        const nameMatch = p.canonical_name.toLowerCase().includes(lower);
        const aliasMatch = p.aliases.find((a) => a.name.toLowerCase().includes(lower));
        if (!nameMatch && !aliasMatch) return null;
        return {
          id: p.person_id,
          name: p.canonical_name,
          matchedAlias: nameMatch ? undefined : aliasMatch?.name,
          filingCount: personFilingsSeen.get(p.person_id)?.size ?? 0,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)
      .slice(0, RESULT_CAP);
  }

  const noResults =
    lower.length > 0 && entityResults.length === 0 && personResults.length === 0;

  return (
    <div className="space-y-6">
      <SearchInput defaultValue={query} autoFocus />

      {lower.length === 0 ? (
        <div className="font-mono text-xs text-[color:var(--color-muted)]">
          Enter an entity or filer name to search.
        </div>
      ) : noResults ? (
        <div className="font-mono text-xs text-[color:var(--color-muted)]">
          nothing matches &ldquo;{query}&rdquo;
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <section>
            <h2 className="prose-sans text-sm font-semibold border-b border-[color:var(--color-rule-strong)] pb-1 mb-2">
              ENTITIES{' '}
              <span className="font-mono text-[11px] text-[color:var(--color-muted)] font-normal">
                {entityResults.length}
                {entityResults.length === RESULT_CAP ? '+ (capped)' : ''}
              </span>
            </h2>
            {entityResults.length === 0 ? (
              <div className="font-mono text-xs text-[color:var(--color-muted)]">no entity matches</div>
            ) : (
              <ul>
                {entityResults.map((r) => (
                  <li key={r.id} className="border-b border-[color:var(--color-rule)] py-1.5">
                    <Link href={`/entity/${r.id}`} className="no-underline hover:underline">
                      <span className="prose-sans text-sm">{r.name}</span>
                    </Link>
                    <div className="font-mono text-[11px] text-[color:var(--color-muted)] mt-0.5">
                      {r.id} · {r.edges} {r.edges === 1 ? 'edge' : 'edges'}
                      {r.matchedAlias ? ` · matched alias: ${r.matchedAlias}` : ''}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <h2 className="prose-sans text-sm font-semibold border-b border-[color:var(--color-rule-strong)] pb-1 mb-2">
              PERSONS{' '}
              <span className="font-mono text-[11px] text-[color:var(--color-muted)] font-normal">
                {personResults.length}
              </span>
            </h2>
            {personResults.length === 0 ? (
              <div className="font-mono text-xs text-[color:var(--color-muted)]">no person matches</div>
            ) : (
              <ul>
                {personResults.map((r) => (
                  <li key={r.id} className="border-b border-[color:var(--color-rule)] py-1.5">
                    <Link href={`/person/${r.id}`} className="no-underline hover:underline">
                      <span className="prose-sans text-sm">{r.name}</span>
                    </Link>
                    <div className="font-mono text-[11px] text-[color:var(--color-muted)] mt-0.5">
                      {r.id} · {r.filingCount} {r.filingCount === 1 ? 'filing' : 'filings'}
                      {r.matchedAlias ? ` · matched alias: ${r.matchedAlias}` : ''}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
