'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';

export interface EntityRow {
  id: string;
  name: string;
  aliases: string[];
  persons: { id: string; name: string }[];
  edgeCount: number;
  nexusIds: string[];
}

type SortKey = 'edges' | 'name' | 'person' | 'nexus';

const SORTS: { key: SortKey; label: string }[] = [
  { key: 'edges', label: 'edges (most first)' },
  { key: 'name', label: 'name A–Z' },
  { key: 'person', label: 'connected person' },
  { key: 'nexus', label: 'nexus first' },
];

export function EntitiesTable({ rows }: { rows: EntityRow[] }) {
  const [query, setQuery] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('edges');
  const [nexusOnly, setNexusOnly] = useState(false);
  const [person, setPerson] = useState('');

  const persons = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of rows) for (const p of r.persons) m.set(p.id, p.name);
    return [...m.entries()].map(([id, name]) => ({ id, name })).sort((a, b) =>
      a.name.localeCompare(b.name),
    );
  }, [rows]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    let out = rows.filter((r) => {
      if (nexusOnly && r.nexusIds.length === 0) return false;
      if (person && !r.persons.some((p) => p.id === person)) return false;
      if (q) {
        const hay = [r.name, ...r.aliases].join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    out = [...out].sort((a, b) => {
      switch (sortKey) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'person': {
          const pa = a.persons[0]?.name ?? '￿';
          const pb = b.persons[0]?.name ?? '￿';
          return pa.localeCompare(pb) || b.edgeCount - a.edgeCount;
        }
        case 'nexus': {
          const na = a.nexusIds.length > 0 ? 0 : 1;
          const nb = b.nexusIds.length > 0 ? 0 : 1;
          return na - nb || b.edgeCount - a.edgeCount;
        }
        case 'edges':
        default:
          return b.edgeCount - a.edgeCount || a.name.localeCompare(b.name);
      }
    });
    return out;
  }, [rows, query, sortKey, nexusOnly, person]);

  const inputCls =
    'font-mono text-[12px] bg-transparent border border-[color:var(--color-rule)] px-2 py-1 focus:border-[color:var(--color-rule-strong)] outline-none';

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="filter by name or alias…"
          className={`${inputCls} flex-1 min-w-[12rem]`}
        />
        <select
          value={sortKey}
          onChange={(e) => setSortKey(e.target.value as SortKey)}
          className={inputCls}
          aria-label="sort"
        >
          {SORTS.map((s) => (
            <option key={s.key} value={s.key}>
              sort: {s.label}
            </option>
          ))}
        </select>
        <select
          value={person}
          onChange={(e) => setPerson(e.target.value)}
          className={inputCls}
          aria-label="filter by family member"
        >
          <option value="">all family members</option>
          {persons.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <label className="font-mono text-[11px] text-[color:var(--color-muted)] flex items-center gap-1.5 select-none">
          <input
            type="checkbox"
            checked={nexusOnly}
            onChange={(e) => setNexusOnly(e.target.checked)}
          />
          has nexus
        </label>
      </div>

      <div className="font-mono text-[11px] text-[color:var(--color-muted)]">
        {visible.length} of {rows.length} shown
      </div>

      {/* header */}
      <div className="hidden sm:grid grid-cols-[1fr_1fr_5rem_4rem] gap-3 border-b border-[color:var(--color-rule-strong)] pb-1 font-mono text-[10px] uppercase tracking-wider text-[color:var(--color-muted)]">
        <span>entity</span>
        <span>connected via</span>
        <span className="text-right">edges</span>
        <span>nexus</span>
      </div>

      <div>
        {visible.map((r) => (
          <div
            key={r.id}
            className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_5rem_4rem] gap-x-3 gap-y-0.5 border-b border-[color:var(--color-rule)] py-1.5 items-baseline"
          >
            <Link href={`/entity/${r.id}`} className="prose-sans text-[13px] no-underline hover:underline">
              {r.name}
            </Link>
            <span className="font-mono text-[11px] text-[color:var(--color-muted)] flex flex-wrap gap-x-2 gap-y-0.5">
              {r.persons.length === 0 ? (
                <span aria-hidden>—</span>
              ) : (
                r.persons.map((p) => (
                  <Link
                    key={p.id}
                    href={`/person/${p.id}`}
                    className="no-underline hover:underline"
                  >
                    {p.name}
                  </Link>
                ))
              )}
            </span>
            <span className="font-mono text-[12px] sm:text-right tabular-nums">{r.edgeCount}</span>
            <span className="font-mono text-[11px] flex flex-wrap gap-2">
              {r.nexusIds.length === 0
                ? null
                : r.nexusIds.map((nid) => (
                    <Link
                      key={nid}
                      href={`/nexus/${nid}`}
                      className="text-emerald-700 dark:text-emerald-400 no-underline hover:underline whitespace-nowrap"
                    >
                      nexus ↗
                    </Link>
                  ))}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
