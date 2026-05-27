import Link from 'next/link';
import { InterestPill } from './InterestPill';
import { ValueCell } from './ValueCell';
import { SourceLink } from './SourceLink';
import { formatDate } from '@/lib/format';
import { isEntityId, isPersonId } from '@/lib/data';
import type {
  EntityIndex,
  PersonIndex,
  FilingIndex,
} from '@/lib/data';
import type { Relationship } from '@/lib/types';

interface BaseProps {
  rel: Relationship;
  entityIndex: EntityIndex;
  personIndex: PersonIndex;
  filingIndex: FilingIndex;
}

function NodeLink({
  id,
  entityIndex,
  personIndex,
}: {
  id: string;
  entityIndex: EntityIndex;
  personIndex: PersonIndex;
}) {
  if (isEntityId(id)) {
    const e = entityIndex.get(id);
    return (
      <Link href={`/entity/${id}`} className="no-underline hover:underline">
        <span className="prose-sans">{e?.canonical_name ?? id}</span>
      </Link>
    );
  }
  if (isPersonId(id)) {
    const p = personIndex.get(id);
    return (
      <Link href={`/person/${id}`} className="no-underline hover:underline">
        <span className="prose-sans">{p?.canonical_name ?? id}</span>
      </Link>
    );
  }
  return <span>{id}</span>;
}

export function ChainRow({ rel, entityIndex, personIndex, filingIndex }: BaseProps) {
  const filing = filingIndex.get(rel.filing_source);
  const source = filing?.primary_source_url ?? '#';
  const supersededMark = rel.superseded_by ? (
    <span
      className="font-mono text-[10px] text-[color:var(--color-muted)]"
      title={`superseded by ${rel.superseded_by}`}
    >
      superseded ↦
    </span>
  ) : null;
  const hasNotes = rel.notes && rel.notes.length > 0;

  return (
    <details className="border-b border-[color:var(--color-rule)] py-2 group">
      <summary className="list-none cursor-pointer grid grid-cols-12 gap-3 items-baseline">
        <div className="col-span-12 md:col-span-5 text-sm">
          <NodeLink id={rel.source_id} entityIndex={entityIndex} personIndex={personIndex} />
          <span className="text-[color:var(--color-muted)] mx-1">→</span>
          <NodeLink id={rel.target_id} entityIndex={entityIndex} personIndex={personIndex} />
        </div>
        <div className="col-span-4 md:col-span-2">
          <InterestPill interestType={rel.interest_type} />
        </div>
        <div className="col-span-4 md:col-span-2 text-sm">
          <ValueCell value={rel.value} />
        </div>
        <div className="col-span-2 md:col-span-1 font-mono text-[11px] text-[color:var(--color-muted)]">
          {formatDate(rel.observed_on)}
        </div>
        <div className="col-span-2 md:col-span-2 flex items-center justify-end gap-2">
          {supersededMark}
          <SourceLink href={source} />
        </div>
      </summary>
      {hasNotes ? (
        <div className="prose-sans text-xs text-[color:var(--color-muted)] mt-2 pl-1 leading-relaxed">
          <div className="font-mono text-[10px] uppercase tracking-wider mb-1">
            {rel.relationship_id}
            {rel.qualifying_role ? ` · ${rel.qualifying_role.role}` : ''}
          </div>
          {rel.notes}
        </div>
      ) : null}
    </details>
  );
}

export function EntityViewRow({ rel, personIndex, filingIndex }: Omit<BaseProps, 'entityIndex'>) {
  const filing = filingIndex.get(rel.filing_source);
  const source = filing?.primary_source_url ?? '#';
  const filer = filing && personIndex.get(filing.filer_id);

  return (
    <details className="border-b border-[color:var(--color-rule)] py-2">
      <summary className="list-none cursor-pointer grid grid-cols-12 gap-3 items-baseline">
        <div className="col-span-12 md:col-span-3 text-sm">
          {filer ? (
            <Link href={`/person/${filer.person_id}`} className="no-underline hover:underline">
              <span className="prose-sans">{filer.canonical_name}</span>
            </Link>
          ) : (
            <span className="text-[color:var(--color-muted)]">(unknown filer)</span>
          )}
        </div>
        <div className="col-span-6 md:col-span-2 font-mono text-[11px]">
          <Link href={`/filing/${rel.filing_source}`} className="no-underline hover:underline">
            {rel.filing_source}
          </Link>
        </div>
        <div className="col-span-6 md:col-span-2">
          <InterestPill interestType={rel.interest_type} />
        </div>
        <div className="col-span-6 md:col-span-2 text-sm">
          <ValueCell value={rel.value} />
        </div>
        <div className="col-span-3 md:col-span-1 font-mono text-[11px] text-[color:var(--color-muted)]">
          {formatDate(rel.observed_on)}
        </div>
        <div className="col-span-3 md:col-span-2 flex justify-end">
          <SourceLink href={source} />
        </div>
      </summary>
      {rel.notes ? (
        <div className="prose-sans text-xs text-[color:var(--color-muted)] mt-2 pl-1 leading-relaxed">
          <div className="font-mono text-[10px] uppercase tracking-wider mb-1">
            {rel.relationship_id}
            <span className="ml-2">
              {rel.source_id} → {rel.target_id}
            </span>
          </div>
          {rel.notes}
        </div>
      ) : null}
    </details>
  );
}

