import Link from 'next/link';
import type { Filing, Person } from '@/lib/types';

interface FilingCardProps {
  filing: Filing;
  filer: Person | undefined;
  entityCount: number;
  edgeCount: number;
}

export function FilingCard({ filing, filer, entityCount, edgeCount }: FilingCardProps) {
  const filerPosition =
    (filing.interest_disclosed?.filer_position as string | undefined) ??
    (filing.interest_disclosed?.report_type as string | undefined) ??
    '';
  const year = filing.source_filing_date.slice(0, 4);
  const filingTypeLabel = filing.filing_type
    .replace(/^OGE_Form_278e_/, '')
    .replace(/_/g, ' ');

  return (
    <Link
      href={`/filing/${filing.filing_id}`}
      className="block border border-[color:var(--color-rule)] p-4 hover:border-[color:var(--color-rule-strong)] no-underline hover:no-underline"
    >
      <div className="prose-sans text-base font-semibold leading-snug">
        {filer?.canonical_name ?? 'Unknown filer'}
      </div>
      {filerPosition ? (
        <div className="prose-sans text-xs text-[color:var(--color-muted)] mt-0.5">
          {filerPosition}
        </div>
      ) : null}
      <div className="font-mono text-xs mt-3">
        {year} {filingTypeLabel}
      </div>
      <div className="font-mono text-[11px] text-[color:var(--color-muted)] mt-2">
        {entityCount} entities · {edgeCount} edges
      </div>
      <div className="font-mono text-[11px] text-[color:var(--color-muted)] mt-3">
        {filing.filing_id}
      </div>
    </Link>
  );
}
