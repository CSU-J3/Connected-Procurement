interface SourceLinkProps {
  href: string;
  label?: string;
}

export function SourceLink({ href, label = 'source' }: SourceLinkProps) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="font-mono text-[11px] text-[color:var(--color-muted)] hover:text-[color:var(--color-foreground)] whitespace-nowrap"
    >
      {label} ↗
    </a>
  );
}
