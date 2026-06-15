// Bundle one-file-per-record registry JSON from ../data into the four UI shapes
// under web/data, derive disclosure_part/disclosure_item on relationships from
// notes regex, copy methodology.md, and stamp synced-at.json.

import { readFile, writeFile, readdir, mkdir, copyFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..', '..');
const outDir = path.resolve(here, '..', 'data');

async function loadDir(rel) {
  const dir = path.join(repoRoot, rel);
  const files = (await readdir(dir)).filter((f) => f.endsWith('.json')).sort();
  return Promise.all(files.map(async (f) => JSON.parse(await readFile(path.join(dir, f), 'utf8'))));
}

function derivePart(notes) {
  if (!notes || typeof notes !== 'string') return [null, null];
  const partMatch = notes.match(/Part\s+(\d+)/);
  if (!partMatch) return [null, null];
  const partNum = partMatch[1];
  const windowStart = Math.max(0, partMatch.index - 30);
  const windowEnd = (partMatch.index ?? 0) + 140;
  const window = notes.slice(windowStart, windowEnd);
  const subMatch = window.match(/(Exhibit|Schedule)\s+([AB])/);
  const part = subMatch
    ? `Part ${partNum} ${subMatch[1]} ${subMatch[2].toUpperCase()}`
    : `Part ${partNum}`;
  const itemMatch = notes.match(/[Ii]tem(?:\s+number)?\s+(\d+(?:\.\d+)?)/);
  const item = itemMatch ? itemMatch[1] : null;
  return [part, item];
}

function partSortKey(label) {
  if (label === 'Other') return [99, ''];
  const m = label.match(/^Part\s+(\d+)(?:\s+(Schedule|Exhibit)\s+([AB]))?$/);
  if (!m) return [98, label];
  return [parseInt(m[1], 10), `${m[2] ?? ''} ${m[3] ?? ''}`];
}

async function main() {
  await mkdir(outDir, { recursive: true });

  const [filings, entities, persons, merges, watchlist, rawRels, nexusLinks] = await Promise.all([
    loadDir('data/filings'),
    loadDir('data/entities'),
    loadDir('data/persons'),
    loadDir('data/merges'),
    loadDir('data/watchlist'),
    loadDir('data/entity_relationships'),
    loadDir('data/nexus_links'),
  ]);

  const partCounts = new Map();
  const itCounts = new Map();
  const shapeCounts = new Map();
  let matched = 0;

  const relationships = rawRels.map((r) => {
    const [part, item] = derivePart(r.notes);
    const it = r.interest_type ?? '(null)';
    itCounts.set(it, (itCounts.get(it) ?? 0) + 1);
    const v = r.value;
    const shapeKey = v == null ? '(value=null)' : `${v.unit ?? '?'}/${v.shape ?? '?'}`;
    shapeCounts.set(shapeKey, (shapeCounts.get(shapeKey) ?? 0) + 1);
    const bucket = part ?? 'Other';
    partCounts.set(bucket, (partCounts.get(bucket) ?? 0) + 1);
    if (part) matched++;
    return { ...r, disclosure_part: part, disclosure_item: item };
  });

  // Entity-to-nexus reverse map: entity_id -> [nexus_id, ...]. One nexus references
  // exactly one entity (NexusLink.entity_id), so this is a straight inversion the UI
  // reads to surface the nexus block on an entity page without scanning all nexuses.
  const nexusByEntity = {};
  for (const n of nexusLinks) {
    (nexusByEntity[n.entity_id] ??= []).push(n.nexus_id);
  }

  // Per-entity index facets for /entities, and the shared connected-person facet the
  // detail page reads (Path A — computed once, used in both views, agree by construction).
  // connected_persons uses filing-filer attribution: the filer(s) of the filing(s) that
  // source any edge touching the entity — the provenance-faithful "appeared on family
  // member X's disclosure". This resolves deep sub-entities (e.g. 666 Fifth Associates ->
  // Jared via cp_filing_0001) that no direct or transitive person edge reaches.
  const filerByFiling = new Map(filings.map((f) => [f.filing_id, f.filer_id]));
  const idxEdgeCount = new Map();
  const idxPersons = new Map();
  for (const e of entities) {
    idxEdgeCount.set(e.entity_id, 0);
    idxPersons.set(e.entity_id, new Set());
  }
  for (const r of rawRels) {
    const ends = new Set();
    if (r.source_id.startsWith('cp_entity_')) ends.add(r.source_id);
    if (r.target_id.startsWith('cp_entity_')) ends.add(r.target_id);
    const filer = filerByFiling.get(r.filing_source);
    for (const eid of ends) {
      if (!idxEdgeCount.has(eid)) continue;
      idxEdgeCount.set(eid, idxEdgeCount.get(eid) + 1);
      if (filer) idxPersons.get(eid).add(filer);
    }
  }
  const entitiesIndex = {};
  for (const e of entities) {
    entitiesIndex[e.entity_id] = {
      edge_count: idxEdgeCount.get(e.entity_id) ?? 0,
      connected_persons: [...idxPersons.get(e.entity_id)].sort(),
      nexus_ids: nexusByEntity[e.entity_id] ?? [],
    };
  }

  const syncedAt = new Date().toISOString();

  await Promise.all([
    writeFile(path.join(outDir, 'filings.json'), JSON.stringify(filings, null, 2)),
    writeFile(path.join(outDir, 'entities.json'), JSON.stringify(entities, null, 2)),
    writeFile(path.join(outDir, 'persons.json'), JSON.stringify(persons, null, 2)),
    writeFile(path.join(outDir, 'relationships.json'), JSON.stringify(relationships, null, 2)),
    writeFile(path.join(outDir, 'merges.json'), JSON.stringify(merges, null, 2)),
    writeFile(path.join(outDir, 'watchlist.json'), JSON.stringify(watchlist, null, 2)),
    writeFile(path.join(outDir, 'nexus.json'), JSON.stringify(nexusLinks, null, 2)),
    writeFile(path.join(outDir, 'nexus-by-entity.json'), JSON.stringify(nexusByEntity, null, 2)),
    writeFile(path.join(outDir, 'entities-index.json'), JSON.stringify(entitiesIndex, null, 2)),
    copyFile(path.join(repoRoot, 'docs', 'methodology.md'), path.join(outDir, 'methodology.md')),
    writeFile(path.join(outDir, 'synced-at.json'), JSON.stringify({ synced_at: syncedAt }, null, 2)),
  ]);

  const total = relationships.length;
  const pct = total === 0 ? '0.0' : ((matched / total) * 100).toFixed(1);

  console.log('\n[sync-data] bundled:');
  console.log(`  ${filings.length} filings        -> web/data/filings.json`);
  console.log(`  ${entities.length} entities      -> web/data/entities.json`);
  console.log(`  ${persons.length} persons        -> web/data/persons.json`);
  console.log(`  ${relationships.length} relationships -> web/data/relationships.json`);
  console.log(`  ${merges.length} merges         -> web/data/merges.json`);
  console.log(`  ${watchlist.length} watchlist      -> web/data/watchlist.json`);
  console.log(`  ${nexusLinks.length} nexus links    -> web/data/nexus.json (+ nexus-by-entity.json)`);
  console.log(`  ${entities.length} entity facets -> web/data/entities-index.json`);
  console.log(`  methodology.md copied`);
  console.log(`  synced-at: ${syncedAt}`);

  console.log(`\n[sync-data] Part attribution: ${matched}/${total} edges matched (${pct}%)`);
  const sortedParts = [...partCounts.entries()].sort(
    (a, b) => {
      const ka = partSortKey(a[0]);
      const kb = partSortKey(b[0]);
      return ka[0] - kb[0] || String(ka[1]).localeCompare(String(kb[1]));
    },
  );
  for (const [k, v] of sortedParts) console.log(`  ${k.padEnd(28)} ${v}`);

  console.log(`\n[sync-data] interest_type counts:`);
  for (const [k, v] of [...itCounts.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${k.padEnd(28)} ${v}`);
  }

  console.log(`\n[sync-data] value (unit/shape) counts:`);
  for (const [k, v] of [...shapeCounts.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${k.padEnd(28)} ${v}`);
  }

  if (parseFloat(pct) < 90) {
    console.log(
      `\n[sync-data] WARNING: part-attribution coverage ${pct}% is below the 90% gate. ` +
        `Review notes patterns before /filing/[id] is built.`,
    );
  } else {
    console.log(`\n[sync-data] Coverage gate OK (>=90%).`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
