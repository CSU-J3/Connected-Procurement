import type { InterestType, RegistryValue } from './types';

const usd = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

const EN_DASH = '–';
const GE = '≥';

export function formatValue(value: RegistryValue | null): string {
  if (value == null) return '(no value disclosed)';
  const { unit, shape } = value;

  if (shape === 'binary') return '(disclosed, no value)';

  if (shape === 'imputed') {
    return value.imputation_source
      ? `(imputed from ${value.imputation_source})`
      : '(imputed)';
  }

  if (shape === 'floor') {
    const f = value.floor ?? null;
    if (f == null) return `${GE} (floor)`;
    return `${GE} ${usd.format(f)}`;
  }

  if (shape === 'range') {
    if (value.low == null || value.high == null) return '(range, no bounds)';
    if (unit === 'ownership_percent') {
      return `${value.low}% ${EN_DASH} ${value.high}%`;
    }
    return `${usd.format(value.low)} ${EN_DASH} ${usd.format(value.high)}`;
  }

  if (shape === 'exact') {
    if (value.exact == null) return '(exact, no value)';
    if (unit === 'ownership_percent') return `${value.exact}%`;
    return usd.format(value.exact);
  }

  return '(unknown shape)';
}

export function interestPillClasses(it: InterestType | null): string {
  const base =
    'inline-block px-1.5 py-0.5 text-[10px] uppercase tracking-wider font-mono border';
  if (it == null) return `${base} border-neutral-500 text-neutral-500`;
  switch (it) {
    case 'ownership':
      return `${base} border-blue-500 text-blue-600 dark:text-blue-400`;
    case 'employment':
      return `${base} border-green-600 text-green-700 dark:text-green-400`;
    case 'debt_instrument_owed':
    case 'debt_instrument_held':
      return `${base} border-rose-500 text-rose-600 dark:text-rose-400`;
    case 'trust_beneficial':
      return `${base} border-amber-500 text-amber-600 dark:text-amber-400`;
    case 'spousal_imputed':
      return `${base} border-neutral-500 text-neutral-600 dark:text-neutral-400`;
    case 'license_counterparty':
      return `${base} border-purple-500 text-purple-600 dark:text-purple-400`;
    case 'trust_trustee':
      return `${base} border-teal-500 text-teal-600 dark:text-teal-400`;
    default:
      return `${base} border-neutral-500 text-neutral-500`;
  }
}

export function interestPillLabel(it: InterestType | null): string {
  if (it == null) return '(family-tree edge)';
  return it;
}

export function partSortKey(label: string): [number, string] {
  if (label === 'Other') return [99, ''];
  const m = label.match(/^Part\s+(\d+)(?:\s+(Schedule|Exhibit)\s+([AB]))?$/);
  if (!m) return [98, label];
  return [parseInt(m[1], 10), `${m[2] ?? ''} ${m[3] ?? ''}`];
}

export function comparePartLabels(a: string, b: string): number {
  const ka = partSortKey(a);
  const kb = partSortKey(b);
  return ka[0] - kb[0] || ka[1].localeCompare(kb[1]);
}

export function formatDate(iso: string): string {
  return iso.slice(0, 10);
}

export function headingId(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}
