import { nexusStatusLabel, nexusStatusPillClasses } from '@/lib/format';
import type { CountingStatus } from '@/lib/types';

export function NexusStatusPill({ status }: { status: CountingStatus }) {
  return <span className={nexusStatusPillClasses(status)}>{nexusStatusLabel(status)}</span>;
}
