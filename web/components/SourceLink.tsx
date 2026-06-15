import { isHttpUrl } from '@/lib/format';

interface SourceLinkProps {
  href: string | null | undefined;
  label?: string;
  // Plain-text provenance rendered when href is not a resolvable http(s) URL
  // (null-URL / Form-201 records). No anchor, no ↗ glyph.
  fallbackText?: string | null;
}

export function SourceLink({ href, label = 'source', fallbackText }: SourceLinkProps) {
  if (isHttpUrl(href)) {
    return (
      <a
        href={href as string}
        target="_blank"
        rel="noopener noreferrer"
        className="font-mono text-[11px] text-[color:var(--color-muted)] hover:text-[color:var(--color-foreground)] whitespace-nowrap"
      >
        {label} ↗
      </a>
    );
  }

  const text =
    fallbackText && fallbackText.trim()
      ? fallbackText
      : 'source retained; no public URL (see methodology)';

  return (
    <span className="font-mono text-[11px] text-[color:var(--color-muted)] leading-snug">
      {text}
    </span>
  );
}
