interface SearchInputProps {
  defaultValue?: string;
  autoFocus?: boolean;
}

export function SearchInput({ defaultValue = '', autoFocus = false }: SearchInputProps) {
  return (
    <form action="/search" method="get" className="w-full">
      <input
        type="text"
        name="q"
        defaultValue={defaultValue}
        autoFocus={autoFocus}
        placeholder={'look up an entity or filer — try "Affinity Partners" or "Trump International"'}
        className="w-full font-mono text-sm bg-transparent border border-[color:var(--color-rule)] px-3 py-2 outline-none focus:border-[color:var(--color-foreground)] placeholder:text-[color:var(--color-muted)]"
        aria-label="Search entities and filers"
      />
    </form>
  );
}
