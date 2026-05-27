interface FooterProps {
  syncedAt: string;
}

export function Footer({ syncedAt }: FooterProps) {
  return (
    <footer className="border-t border-[color:var(--color-rule)] mt-12">
      <div className="max-w-6xl w-full mx-auto px-4 sm:px-6 py-3 font-mono text-[11px] text-[color:var(--color-muted)]">
        Data synced from registry at {syncedAt}. Registry source:{' '}
        <a
          href="https://github.com/CSU-J3/Connected-Procurement"
          target="_blank"
          rel="noopener noreferrer"
        >
          github.com/CSU-J3/Connected-Procurement
        </a>
        .
      </div>
    </footer>
  );
}
