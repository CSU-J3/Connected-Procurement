import { getEntities, getEntitiesIndex, getPersonIndex } from '@/lib/data';
import { EntitiesTable, type EntityRow } from '@/components/EntitiesTable';

export const metadata = {
  title: 'Entities — Connected Procurement',
};

export default async function EntitiesPage() {
  const [entities, index, personIndex] = await Promise.all([
    getEntities(),
    getEntitiesIndex(),
    getPersonIndex(),
  ]);

  const mergedCount = entities.filter((e) => e.merged_into).length;

  const rows: EntityRow[] = entities
    .filter((e) => !e.merged_into)
    .map((e) => {
      const f = index[e.entity_id] ?? { edge_count: 0, connected_persons: [], nexus_ids: [] };
      return {
        id: e.entity_id,
        name: e.canonical_name,
        aliases: e.aliases.map((a) => a.name),
        persons: f.connected_persons.map((pid) => ({
          id: pid,
          name: personIndex.get(pid)?.canonical_name ?? pid,
        })),
        edgeCount: f.edge_count,
        nexusIds: f.nexus_ids,
      };
    });

  const withNexus = rows.filter((r) => r.nexusIds.length > 0).length;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="prose-sans text-2xl font-semibold leading-tight">Entities</h1>
        <div className="font-mono text-[11px] text-[color:var(--color-muted)] mt-2">
          {rows.length} entities
          {withNexus > 0 ? ` · ${withNexus} with a procurement nexus` : ''}
          {mergedCount > 0 ? ` · ${mergedCount} merged into others, not shown` : ''}
        </div>
      </header>

      <EntitiesTable rows={rows} />
    </div>
  );
}
