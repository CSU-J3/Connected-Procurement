import { interestPillClasses, interestPillLabel } from '@/lib/format';
import type { InterestType } from '@/lib/types';

interface InterestPillProps {
  interestType: InterestType | null;
}

export function InterestPill({ interestType }: InterestPillProps) {
  return (
    <span className={interestPillClasses(interestType)}>
      {interestPillLabel(interestType)}
    </span>
  );
}
