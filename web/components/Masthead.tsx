import Link from 'next/link';

interface MastheadProps {
  filings: number;
  entities: number;
  persons: number;
  edges: number;
}

export function Masthead({ filings, entities, persons, edges }: MastheadProps) {
  return (
    <header className="border-b border-[color:var(--color-rule)]">
      <div className="max-w-6xl w-full mx-auto px-4 sm:px-6 py-3 flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-1">
        <Link
          href="/"
          className="font-mono text-sm uppercase tracking-wide no-underline hover:no-underline"
        >
          CP // CONNECTED PROCUREMENT
        </Link>
        <div className="font-mono text-[11px] text-[color:var(--color-muted)]">
          {filings} filings · {entities} entities · {persons} persons · {edges} edges · pre-collection
        </div>
      </div>
    </header>
  );
}
