import Link from 'next/link';
import { NexusStatusPill } from '@/components/NexusStatusPill';
import { instrumentTypeLabel } from '@/lib/format';
import type { Entity, NexusLink } from '@/lib/types';

interface NexusCardProps {
  nexus: NexusLink;
  entity: Entity | undefined;
}

// Whole-card link to the nexus detail, matching the filing-card pattern. The onward
// link to the entity page lives on the detail header (nested anchors are invalid).
export function NexusCard({ nexus, entity }: NexusCardProps) {
  return (
    <Link
      href={`/nexus/${nexus.nexus_id}`}
      className="block border border-[color:var(--color-rule)] p-4 hover:border-[color:var(--color-rule-strong)] no-underline hover:no-underline"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="prose-sans text-base font-semibold leading-snug">
          {entity?.canonical_name ?? nexus.entity_id}
        </div>
        <NexusStatusPill status={nexus.counting_status} />
      </div>
      <div className="font-mono text-xs mt-3">
        {instrumentTypeLabel(nexus.instrument_type)} · {nexus.instrument_id}
      </div>
      {nexus.agency ? (
        <div className="font-mono text-[11px] text-[color:var(--color-muted)] mt-1">
          {nexus.agency}
        </div>
      ) : null}
      <div className="font-mono text-[11px] text-[color:var(--color-muted)] mt-2">
        identity match · {nexus.confidence_tier} confidence
      </div>
      <div className="font-mono text-[11px] text-[color:var(--color-muted)] mt-3">
        {nexus.nexus_id}
      </div>
    </Link>
  );
}
