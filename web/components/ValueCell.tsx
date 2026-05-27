import { formatValue } from '@/lib/format';
import type { RegistryValue } from '@/lib/types';

interface ValueCellProps {
  value: RegistryValue | null;
}

export function ValueCell({ value }: ValueCellProps) {
  const text = formatValue(value);
  const muted =
    value == null ||
    value.shape === 'binary' ||
    value.shape === 'imputed';
  return (
    <span className={`font-mono whitespace-nowrap ${muted ? 'text-[color:var(--color-muted)]' : ''}`}>
      {text}
    </span>
  );
}
