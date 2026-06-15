import Link from 'next/link';

interface MastheadProps {
  filings: number;
  entities: number;
  persons: number;
  edges: number;
  nexuses: number;
  nexusCounted: number;
  phase: string;
}

export function Masthead({
  filings,
  entities,
  persons,
  edges,
  nexuses,
  nexusCounted,
  phase,
}: MastheadProps) {
  return (
    <header className="border-b border-[color:var(--color-rule)]">
      <div className="max-w-6xl w-full mx-auto px-4 sm:px-6 py-3 flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-1">
        <div className="flex flex-wrap items-baseline gap-x-4">
          <Link
            href="/"
            className="font-mono text-sm uppercase tracking-wide no-underline hover:no-underline"
          >
            CP // CONNECTED PROCUREMENT
          </Link>
          <Link
            href="/entities"
            className="font-mono text-[11px] uppercase tracking-wider text-[color:var(--color-muted)] no-underline hover:underline"
          >
            entities
          </Link>
        </div>
        <div className="font-mono text-[11px] text-[color:var(--color-muted)]">
          {filings} filings · {entities} entities · {persons} persons · {edges} edges ·{' '}
          <Link href="/nexus" className="no-underline hover:underline">
            {nexuses} nexus ({nexusCounted} counted)
          </Link>{' '}
          · {phase}
        </div>
      </div>
    </header>
  );
}
