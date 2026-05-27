import { SearchInput } from '@/components/SearchInput';
import { FilingCard } from '@/components/FilingCard';
import {
  getFilings,
  getRelationships,
  getPersonIndex,
} from '@/lib/data';

export default async function HomePage() {
  const [filings, relationships, personIndex] = await Promise.all([
    getFilings(),
    getRelationships(),
    getPersonIndex(),
  ]);

  const byFiling = new Map<string, { entities: Set<string>; edges: number }>();
  for (const r of relationships) {
    let acc = byFiling.get(r.filing_source);
    if (!acc) {
      acc = { entities: new Set(), edges: 0 };
      byFiling.set(r.filing_source, acc);
    }
    acc.edges++;
    if (r.source_id.startsWith('cp_entity_')) acc.entities.add(r.source_id);
    if (r.target_id.startsWith('cp_entity_')) acc.entities.add(r.target_id);
  }

  const sortedFilings = [...filings].sort((a, b) =>
    a.filing_id.localeCompare(b.filing_id),
  );

  return (
    <div className="space-y-10">
      <section>
        <SearchInput autoFocus />
      </section>

      <section>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {sortedFilings.map((f) => {
            const counts = byFiling.get(f.filing_id) ?? { entities: new Set(), edges: 0 };
            return (
              <FilingCard
                key={f.filing_id}
                filing={f}
                filer={personIndex.get(f.filer_id)}
                entityCount={counts.entities.size}
                edgeCount={counts.edges}
              />
            );
          })}
        </div>
      </section>

      <section className="border border-[color:var(--color-rule)] p-4">
        <p className="prose-sans text-sm">
          Every edge traces to a primary source.{' '}
          <a href="/methodology" className="underline">
            See how the registry is built →
          </a>
        </p>
      </section>
    </div>
  );
}
