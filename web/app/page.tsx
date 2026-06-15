import Link from 'next/link';
import { SearchInput } from '@/components/SearchInput';
import { FilingCard } from '@/components/FilingCard';
import { NexusCard } from '@/components/NexusCard';
import {
  getFilings,
  getRelationships,
  getPersonIndex,
  getNexusLinks,
  getEntityIndex,
} from '@/lib/data';

export default async function HomePage() {
  const [filings, relationships, personIndex, nexusLinks, entityIndex] = await Promise.all([
    getFilings(),
    getRelationships(),
    getPersonIndex(),
    getNexusLinks(),
    getEntityIndex(),
  ]);

  const sortedNexus = [...nexusLinks].sort((a, b) => a.nexus_id.localeCompare(b.nexus_id));
  const nexusCounted = sortedNexus.filter((n) => n.counting_status === 'counted').length;

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

      {sortedNexus.length > 0 ? (
        <section className="border border-[color:var(--color-rule-strong)] p-4 space-y-3">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="prose-sans text-base font-semibold">Procurement connections</h2>
            <Link href="/nexus" className="font-mono text-[11px] underline">
              all nexus →
            </Link>
          </div>
          <p className="prose-sans text-sm text-[color:var(--color-muted)] leading-relaxed max-w-2xl">
            {sortedNexus.length} federal procurement{' '}
            {sortedNexus.length === 1 ? 'connection' : 'connections'} documented,{' '}
            {nexusCounted} counted. Identity is corroborated by name, UEI, and address.
            Connections are{' '}
            <span className="text-[color:var(--color-foreground)]">
              not counted toward the headline figures
            </span>{' '}
            unless the holder&apos;s disclosed holding period overlaps the instrument&apos;s
            active period under OGE-278 sourcing.{' '}
            <a href="/methodology#federal-procurement-nexus" className="underline">
              See methodology.
            </a>
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {sortedNexus.map((n) => (
              <NexusCard key={n.nexus_id} nexus={n} entity={entityIndex.get(n.entity_id)} />
            ))}
          </div>
        </section>
      ) : null}

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
