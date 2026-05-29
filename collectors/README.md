# Collectors

Detection collectors for the live-collection phase. Each collector reads the registry
(`data/`) and a live federal source and writes **pending** detection records to
`collectors/state/` only. Design and conventions are set in the planning artifact
(`docs/handoffs/2026-05-28-session-01.md`), which is the source of truth.

## The one hard boundary

A collector writes only to `collectors/state/`. It never writes to `data/`, never amends a
methodology entry, and never decides membership or ingestion. Detection surfaces a
candidate; a human-gated ingest session decides what becomes of it. `registry.validate`
does not load `collectors/state/`, so nothing a collector emits can enter the registry.

`triage_status` is set to `pending` on write and never changed by a collector. The
transition to `ingested` / `dismissed` / `confirmed` is an ingest-session action.

## Layout

```
collectors/
├── shapes.py        # Candidate / Match pydantic records (detection records, not registry)
├── state.py         # id allocation, last-seen load/save, pending-record writers
├── match.py         # shared name+address scorer, placeholder bands, in-scope entity load
├── httpio.py        # stdlib HTTP helpers (no requests dependency)
├── usaspending.py   # weekly procurement match: federal contract awards
├── gsa_lease.py     # weekly procurement match: GSA IOLP lease inventory
├── sam.py           # weekly procurement match: SAM.gov entity registration (keyed)
├── oge_278.py       # daily filer detection: OGE 278 search + CREW bulk diff
└── state/           # committed detection workspace (outside data/)
    ├── queue/                 # candidate-<date>-<hash>.json (daily filer candidates)
    ├── procurement-matches/   # cp_match_NNNN.json (weekly match candidates)
    ├── gsa-cache/             # cached bulk source file (gitignored; re-downloadable)
    ├── oge-278-seen.json      # OGE last-seen, keyed (filer, year, type, pointer)
    └── crew-seen.json         # CREW last-seen
```

`ig_report`, `gao_protest`, and `pacer` collectors are noted future expansion, not built.

## Running

All collectors are Python modules run from the repo root:

```
python -m collectors.usaspending     # weekly procurement match (USAspending)
python -m collectors.gsa_lease        # weekly procurement match (GSA leases)
python -m collectors.sam              # weekly procurement match (SAM.gov, keyed)
python -m collectors.oge_278          # daily filer detection (OGE + CREW)
```

### Expected-empty results (correct by design, not failures)

- **Procurement collectors** match the in-scope entity set: entities reachable from
  non-excluded (live-counting) relationships. Every comparative edge today is
  `excluded_from_total: true`, so that set is empty and a default run surfaces nothing
  ("0 in-scope entities"). The first match enters once a live-counting edge exists.
- **OGE/CREW** polls watchlist members with `poll_mode: poll_direct`. All current anchors
  are `impute_via_part5`, so the filter matches zero members ("0 poll-direct watchlist
  members"). The first poll-direct target enters via event-driven watchlist expansion.

### `--all-entities` (build-validation only)

The procurement collectors accept `--all-entities`, which widens the input to every entity
(not just the live-counting set) to exercise the pipeline against real awards. Matches it
produces are stamped in `notes` as build-validation artifacts, **not** live-scope
detections, and do not bring those entities into live scope. Default is off.

## Environment variables

| Variable | Used by | Default | Notes |
| --- | --- | --- | --- |
| `SAM_API_KEY` | `collectors/sam.py` | unset | SAM.gov Entity Management API key. **Never committed.** When unset, the SAM collector logs `SAM_API_KEY unset, skipping SAM entity match` and exits clean (zero matches, no error). A basic-tier key allows 10 requests/day, so SAM queries are capped per run. |

No other collector requires a key. USAspending, the GSA IOLP file, and the OGE/CREW
sources are public.
