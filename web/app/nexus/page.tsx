import { NexusCard } from '@/components/NexusCard';
import { getNexusLinks, getEntityIndex } from '@/lib/data';

export const metadata = {
  title: 'Federal procurement nexus — Connected Procurement',
};

export default async function NexusIndexPage() {
  const [nexusLinks, entityIndex] = await Promise.all([getNexusLinks(), getEntityIndex()]);

  const sorted = [...nexusLinks].sort((a, b) => a.nexus_id.localeCompare(b.nexus_id));
  const counted = sorted.filter((n) => n.counting_status === 'counted').length;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="prose-sans text-2xl font-semibold leading-tight">
          Federal procurement nexus
        </h1>
        <div className="font-mono text-[11px] text-[color:var(--color-muted)] mt-2">
          {sorted.length} {sorted.length === 1 ? 'nexus' : 'nexuses'} · {counted} counted
        </div>
        <p className="prose-sans text-sm text-[color:var(--color-muted)] mt-3 max-w-2xl">
          Each record links a registry entity to a specific federal instrument — a GSA
          lease or a contract award. A nexus is{' '}
          <span className="text-[color:var(--color-foreground)]">counted</span> only when
          identity is corroborated{' '}
          <span className="text-[color:var(--color-foreground)]">and</span> the
          instrument&apos;s active period overlaps the holder&apos;s disclosed holding
          period. Identity without temporal overlap is documented, not counted.{' '}
          <a href="/methodology#federal-procurement-nexus" className="underline">
            How nexus is determined →
          </a>
        </p>
      </header>

      {sorted.length === 0 ? (
        <div className="font-mono text-xs text-[color:var(--color-muted)]">
          No federal-procurement nexus recorded in the current registry.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {sorted.map((n) => (
            <NexusCard
              key={n.nexus_id}
              nexus={n}
              entity={entityIndex.get(n.entity_id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
