import { notFound } from 'next/navigation';
import {
  getFiling,
  getFilings,
  getRelationshipsForFiling,
  getEntityIndex,
  getPersonIndex,
  getFilingIndex,
  isFilingId,
} from '@/lib/data';
import { ChainRow } from '@/components/RelationshipRow';
import { SourceLink } from '@/components/SourceLink';
import { comparePartLabels, filingSourceAuthority } from '@/lib/format';
import type { FilingId, InterestType, Relationship } from '@/lib/types';
import { InterestPill } from '@/components/InterestPill';

export async function generateStaticParams() {
  const filings = await getFilings();
  return filings.map((f) => ({ id: f.filing_id }));
}

export const dynamicParams = false;

function groupByPart(rels: Relationship[]): Map<string, Relationship[]> {
  const groups = new Map<string, Relationship[]>();
  for (const r of rels) {
    const key = r.disclosure_part ?? 'Other';
    const arr = groups.get(key);
    if (arr) arr.push(r);
    else groups.set(key, [r]);
  }
  return groups;
}

export default async function FilingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!isFilingId(id)) notFound();

  const filing = await getFiling(id as FilingId);
  if (!filing) notFound();

  const [rels, entityIndex, personIndex, filingIndex] = await Promise.all([
    getRelationshipsForFiling(id as FilingId),
    getEntityIndex(),
    getPersonIndex(),
    getFilingIndex(),
  ]);

  const filer = personIndex.get(filing.filer_id);
  const filerPosition = (filing.interest_disclosed?.filer_position as string | undefined) ?? '';
  const reportType = (filing.interest_disclosed?.report_type as string | undefined) ?? '';

  const interestCounts = new Map<InterestType | 'null', number>();
  const entitiesTouched = new Set<string>();
  for (const r of rels) {
    const key = r.interest_type ?? 'null';
    interestCounts.set(key, (interestCounts.get(key) ?? 0) + 1);
    if (r.source_id.startsWith('cp_entity_')) entitiesTouched.add(r.source_id);
    if (r.target_id.startsWith('cp_entity_')) entitiesTouched.add(r.target_id);
  }
  const sortedInterests = [...interestCounts.entries()].sort((a, b) => b[1] - a[1]);

  const groups = groupByPart(rels);
  const partLabels = [...groups.keys()].sort(comparePartLabels);

  const excludedCategories = filing.interest_disclosed?._excluded_categories?.categories ?? [];

  return (
    <article className="space-y-8">
      <header>
        <h1 className="prose-sans text-2xl font-semibold leading-tight">
          {filer?.canonical_name ?? 'Unknown filer'}
        </h1>
        <div className="prose-sans text-sm text-[color:var(--color-muted)] mt-0.5">
          {filerPosition || reportType}
        </div>
        <div className="font-mono text-[11px] text-[color:var(--color-muted)] mt-1 flex flex-wrap gap-x-3 gap-y-1 items-baseline">
          <span>{filing.filing_id}</span>
          <span>{filing.filing_type.replace(/_/g, ' ')}</span>
          <span>filed {filing.source_filing_date}</span>
          <SourceLink
            href={filing.primary_source_url}
            fallbackText={filingSourceAuthority(filing)}
          />
        </div>
      </header>

      <section>
        <div className="border border-[color:var(--color-rule)] p-3 flex flex-wrap gap-x-6 gap-y-2 items-baseline">
          <div className="font-mono text-[11px] uppercase tracking-wider text-[color:var(--color-muted)]">
            <span>{entitiesTouched.size}</span> entities ·{' '}
            <span>{rels.length}</span> edges
          </div>
          <div className="flex flex-wrap gap-1.5 items-center">
            {sortedInterests.map(([it, count]) => (
              <span key={it} className="flex items-center gap-1">
                <InterestPill interestType={it === 'null' ? null : (it as InterestType)} />
                <span className="font-mono text-[11px] text-[color:var(--color-muted)]">{count}</span>
              </span>
            ))}
          </div>
        </div>
      </section>

      {partLabels.map((label) => {
        const arr = groups.get(label) ?? [];
        const sorted = [...arr].sort((a, b) => {
          const ai = a.disclosure_item ?? '';
          const bi = b.disclosure_item ?? '';
          const na = parseFloat(ai);
          const nb = parseFloat(bi);
          if (Number.isFinite(na) && Number.isFinite(nb)) return na - nb;
          return ai.localeCompare(bi);
        });
        return (
          <section key={label}>
            <h2 className="prose-sans text-base font-semibold border-b border-[color:var(--color-rule-strong)] pb-1 mb-2">
              {label}{' '}
              <span className="font-mono text-[11px] text-[color:var(--color-muted)] font-normal">
                {arr.length} {arr.length === 1 ? 'edge' : 'edges'}
              </span>
            </h2>
            <div>
              {sorted.map((rel) => (
                <ChainRow
                  key={rel.relationship_id}
                  rel={rel}
                  entityIndex={entityIndex}
                  personIndex={personIndex}
                  filingIndex={filingIndex}
                />
              ))}
            </div>
          </section>
        );
      })}

      {excludedCategories.length > 0 ? (
        <section className="border-t border-[color:var(--color-rule)] pt-4">
          <h2 className="prose-sans text-sm font-semibold mb-2">
            Also disclosed in registry-excluded categories
          </h2>
          <p className="prose-sans text-xs text-[color:var(--color-muted)] mb-3">
            These disclosures fall in categories outside the registry&apos;s scope.{' '}
            <a href="/methodology" className="underline">
              See methodology for criteria.
            </a>
          </p>
          <ul className="space-y-0.5">
            {excludedCategories
              .filter((c) => c.approx_entries > 0)
              .sort((a, b) => b.approx_entries - a.approx_entries)
              .map((c) => (
                <li
                  key={c.category}
                  className="flex items-baseline justify-between gap-3 border-b border-[color:var(--color-rule)] py-1"
                >
                  <span className="font-mono text-[12px]">{c.category}</span>
                  <span className="font-mono text-[11px] text-[color:var(--color-muted)]">
                    {c.approx_entries} items
                  </span>
                </li>
              ))}
          </ul>
        </section>
      ) : null}

      <section className="border-t border-[color:var(--color-rule)] pt-4 font-mono text-[11px] text-[color:var(--color-muted)] leading-relaxed">
        All edges from this filing are pre-2025 disclosures in the comparative case set per PROJECT.md scope.{' '}
        <a href="/methodology" className="underline">
          See methodology.
        </a>
      </section>
    </article>
  );
}
