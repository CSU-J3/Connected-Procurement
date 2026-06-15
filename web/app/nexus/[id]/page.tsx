import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  getNexus,
  getNexusLinks,
  getNexusHolderChain,
  isNexusId,
} from '@/lib/data';
import { SourceLink } from '@/components/SourceLink';
import { NexusStatusPill } from '@/components/NexusStatusPill';
import { instrumentTypeLabel } from '@/lib/format';
import type { NexusId } from '@/lib/types';

export async function generateStaticParams() {
  const links = await getNexusLinks();
  return links.map((n) => ({ id: n.nexus_id }));
}

export const dynamicParams = false;

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-baseline gap-0.5 sm:gap-3 border-b border-[color:var(--color-rule)] py-1.5">
      <span className="font-mono text-[10px] uppercase tracking-wider text-[color:var(--color-muted)] sm:w-40 shrink-0">
        {label}
      </span>
      <span className="font-mono text-[12px]">{children}</span>
    </div>
  );
}

export default async function NexusPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!isNexusId(id)) notFound();

  const nexus = await getNexus(id as NexusId);
  if (!nexus) notFound();

  const { entity, parentEntity, holderEdge, filing, filer } =
    await getNexusHolderChain(nexus);

  const entityName = entity?.canonical_name ?? nexus.entity_id;
  const counted = nexus.counting_status === 'counted';

  return (
    <article className="space-y-8 max-w-3xl">
      {/* §1 — Header: entity, holder, ownership chain, status */}
      <header>
        <div className="flex items-start justify-between gap-3">
          <h1 className="prose-sans text-2xl font-semibold leading-tight">{entityName}</h1>
          <NexusStatusPill status={nexus.counting_status} />
        </div>
        <div className="prose-sans text-sm text-[color:var(--color-muted)] mt-1">
          Federal procurement nexus
        </div>
        <div className="font-mono text-[11px] text-[color:var(--color-muted)] mt-2 leading-relaxed">
          Held by{' '}
          {filer ? (
            <Link href={`/person/${filer.person_id}`} className="underline">
              {filer.canonical_name}
            </Link>
          ) : (
            'a disclosed family member'
          )}
          {parentEntity ? (
            <>
              {' '}via{' '}
              <Link href={`/entity/${parentEntity.entity_id}`} className="underline">
                {parentEntity.canonical_name}
              </Link>{' '}
              →{' '}
            </>
          ) : (
            ' → '
          )}
          {entity ? (
            <Link href={`/entity/${entity.entity_id}`} className="underline">
              {entity.canonical_name}
            </Link>
          ) : (
            entityName
          )}
          {holderEdge ? <> · disclosed as-of {holderEdge.observed_on}</> : null}
          {filing ? (
            <>
              {' '}on{' '}
              <Link href={`/filing/${filing.filing_id}`} className="underline">
                {filing.filing_id}
              </Link>
            </>
          ) : null}
        </div>
        <div className="font-mono text-[11px] text-[color:var(--color-muted)] mt-1">
          {nexus.nexus_id}
        </div>
      </header>

      {/* §2 — The connection: the federal instrument */}
      <section>
        <h2 className="prose-sans text-base font-semibold border-b border-[color:var(--color-rule-strong)] pb-1 mb-2">
          The connection
        </h2>
        <div>
          <Row label="instrument">{instrumentTypeLabel(nexus.instrument_type)}</Row>
          <Row label="identifier">{nexus.instrument_id}</Row>
          {nexus.agency ? <Row label="agency">{nexus.agency}</Row> : null}
          <Row label="award source">{nexus.award_source}</Row>
          <Row label="recorded">{nexus.observed_on}</Row>
          <Row label="source">
            <SourceLink href={nexus.source_url} label="USAspending award" />
          </Row>
        </div>
      </section>

      {/* §3 — Identity corroboration: rendered match_basis prose, labeled */}
      <section>
        <h2 className="prose-sans text-base font-semibold border-b border-[color:var(--color-rule-strong)] pb-1 mb-2">
          Identity corroboration
        </h2>
        <p className="prose-sans text-xs text-[color:var(--color-muted)] mb-2">
          How the registry entity and the federal recipient are shown to be the same legal
          entity. Identity match:{' '}
          <span className="text-[color:var(--color-foreground)]">
            {nexus.confidence_tier} confidence
          </span>
          .
        </p>
        <p className="prose-sans text-sm leading-relaxed whitespace-pre-wrap">
          {nexus.match_basis}
        </p>
      </section>

      {/* §4 — Temporal-overlap determination: rendered notes prose */}
      {nexus.notes ? (
        <section>
          <h2 className="prose-sans text-base font-semibold border-b border-[color:var(--color-rule-strong)] pb-1 mb-2">
            Temporal-overlap determination
          </h2>
          <p className="prose-sans text-sm leading-relaxed whitespace-pre-wrap">
            {nexus.notes}
          </p>
        </section>
      ) : null}

      {/* §5 — Status and why: the conservative-counting discipline, stated */}
      <section className="border border-[color:var(--color-rule-strong)] p-4">
        <div className="flex items-center gap-2">
          <NexusStatusPill status={nexus.counting_status} />
        </div>
        <p className="prose-sans text-sm leading-relaxed mt-3">
          {counted ? (
            <>
              Counted toward the headline figures: identity is corroborated and the
              instrument&apos;s active period overlaps the holder&apos;s disclosed holding
              period.
            </>
          ) : (
            <>
              Documented because identity corroboration is solid (matched at{' '}
              {nexus.confidence_tier} confidence). Not counted because the bar for counting
              — confirmed overlap between the instrument&apos;s active period and the
              holder&apos;s disclosed holding period — is not met under available (OGE-278)
              sourcing. Counting it would assert a connection the sourced evidence does not
              establish. The reasoning is in the determination above.
            </>
          )}
        </p>
      </section>

      {/* §6 — Sources and methodology */}
      <section className="border-t border-[color:var(--color-rule)] pt-4 font-mono text-[11px] text-[color:var(--color-muted)] leading-relaxed flex flex-wrap gap-x-4 gap-y-1 items-baseline">
        <SourceLink href={nexus.source_url} label="USAspending award" />
        <a href="/methodology#federal-procurement-nexus" className="underline">
          how nexus is determined →
        </a>
      </section>
    </article>
  );
}
