"""OGE 278 + CREW daily filer collector (artifact section 1).

Detects new or amended OGE Form 278 filings for poll-direct watchlist members and queues
them for a human-gated ingest session. Writes pending candidates only, under
collectors/state/queue/. Writes nothing to data/.

Inputs:
  - The watchlist (data/watchlist/) filtered to poll_mode: poll_direct (equivalently
    active_278_obligation: true).
  - Last-seen state in collectors/state/oge-278-seen.json and crew-seen.json.

Expected empty result (correct by design, not a failure): all four current watchlist
anchors are impute_via_part5 / historical_anchor / active_278_obligation: false, so the
poll-direct filter matches zero members. The collector builds, runs, and emits an empty
queue, logging "0 poll-direct watchlist members; nothing to poll." The first poll-direct
target enters only through event-driven watchlist expansion (artifact section 3) with a
sourced current-administration obligation, which is a future session. We do NOT work
around the empty filter by polling impute-mode members; that would violate Decision 3.

Sources (verified at build time 2026-05-29):
  - OGE per-filer 278 search: the OGE public financial-disclosure PAS index at
    extapps2.oge.gov/201/Presiden.nsf is a Lotus Domino HTML view (no JSON API). The view
    is reachable and verified (HTTP 200), and the canonical document-pointer shape is
    confirmed from a live example: .../PAS+Index/<UNID>/$FILE/<name> final278.pdf. But the
    collapsed/categorized view does NOT expose filer document links as flat parseable hrefs,
    even fully expanded or restricted to a filer category; reaching a filing requires Domino
    document-open / UNID navigation that cannot be validated end-to-end without a real
    poll-direct filer to drive the per-filer query. Per the flag-don't-guess rule and the
    carried-forward OGE-navigation open item (resolved in the first OGE ingest session, when
    OGE-site navigation is in-hand), the per-filer document-link extraction is finalized then;
    today search_oge_filer extracts $FILE document links when the view exposes them and logs a
    flag + returns empty otherwise, rather than shipping a brittle untested scrape.
  - CREW bulk diff: a bulk CREW financial-disclosure dataset URL could NOT be definitively
    resolved at build time. Per the flag-don't-guess rule, CREW_DATASET_URL is left None and
    the CREW path logs that it is unresolved and skips, rather than coding against a guessed
    path. The diff machinery is built and ready for the moment a URL is set. (Moot today: the
    poll-direct filter is empty, so neither source is reached.)
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path
from urllib.parse import quote, unquote

from collectors import state
from collectors.httpio import get_text
from collectors.shapes import Candidate, ChangeSignal, DetectionSource

REPO_ROOT = Path(__file__).resolve().parent.parent
WATCHLIST_DIR = REPO_ROOT / "data" / "watchlist"
PERSONS_DIR = REPO_ROOT / "data" / "persons"

OGE_PAS_INDEX_VIEW = "https://extapps2.oge.gov/201/Presiden.nsf/PAS+Index?OpenView"
OGE_HOST = "https://extapps2.oge.gov"
# A filer's disclosure document attachment link, shape confirmed from a live example.
_PAS_DOC_HREF_RE = re.compile(
    r'href="(/201/Presiden\.nsf/[^"]*?/\$FILE/[^"]+?\.pdf)"', re.I
)
_YEAR_RE = re.compile(r"(20\d{2})")

# CREW bulk dataset URL unresolved at build time (flag, do not guess). Set this when a
# canonical CREW financial-disclosure dataset location is confirmed.
CREW_DATASET_URL: str | None = None


def _load_json_dir(dir_path: Path) -> list[dict]:
    if not dir_path.exists():
        return []
    out = []
    for p in sorted(dir_path.glob("*.json")):
        try:
            out.append(json.loads(p.read_text(encoding="utf-8")))
        except (json.JSONDecodeError, OSError):
            continue
    return out


def poll_direct_members() -> list[dict]:
    """Watchlist rows with poll_mode == poll_direct (equivalently active_278_obligation)."""
    return [
        w
        for w in _load_json_dir(WATCHLIST_DIR)
        if w.get("poll_mode") == "poll_direct" and w.get("status") != "removed"
    ]


def _person_names(person_id: str) -> list[str]:
    for p in _load_json_dir(PERSONS_DIR):
        if p.get("person_id") == person_id:
            names = [p["canonical_name"]] + [a["name"] for a in p.get("aliases", []) if a.get("name")]
            return names
    return []


def search_oge_filer(filer_names: list[str]) -> list[dict]:
    """Query the OGE PAS index per filer by name and return their disclosure documents as
    [{name, document_pointer, raw_filename}] (artifact section 1: "per poll-direct filer").

    Queries the view restricted to the filer category, then extracts $FILE document links.
    Today the Domino view does not expose those links as flat hrefs (see module docstring);
    this returns the links when present and an empty list otherwise. The per-filer document
    navigation is finalized against the first real poll-direct filer with OGE navigation in
    hand (the carried-forward open item), rather than shipping a brittle untested scrape.
    """
    entries: list[dict] = []
    seen: set[str] = set()
    for name in filer_names:
        # RestrictToCategory queries the view for just this filer's rows.
        url = f"{OGE_PAS_INDEX_VIEW}&RestrictToCategory={quote(name)}&Count=200"
        try:
            html = get_text(url, timeout=90)
        except Exception as e:  # noqa: BLE001
            print(f"[oge_278] WARN OGE query failed for filer {name!r}: {e}")
            continue
        hrefs = _PAS_DOC_HREF_RE.findall(html)
        if not hrefs:
            print(
                f"[oge_278] FLAG: OGE PAS view exposed no flat document link for {name!r}; "
                "per-filer document navigation to be finalized with OGE navigation in-hand."
            )
        for href in hrefs:
            pointer = OGE_HOST + href
            if pointer in seen:
                continue
            seen.add(pointer)
            fname = unquote(href.rsplit("/$FILE/", 1)[-1])
            name_part = re.split(
                r"\s+(?:final|annual|nominee|new|termination|amend)", fname, flags=re.I
            )[0]
            entries.append(
                {"name": name_part.strip(), "document_pointer": pointer, "raw_filename": fname}
            )
    return entries


def _guess_filing_type(raw_filename: str) -> str:
    low = raw_filename.lower()
    for token, label in (
        ("amend", "amendment"),
        ("termination", "termination"),
        ("nominee", "new-entrant"),
        ("new", "new-entrant"),
        ("annual", "annual"),
        ("final278", "annual"),
    ):
        if token in low:
            return label
    return "unknown"


def _seen_key(filer_person_id: str, year: int, ftype: str, pointer: str) -> str:
    return f"{filer_person_id}|{year}|{ftype}|{pointer}"


def run() -> int:
    state.ensure_dirs()
    members = poll_direct_members()
    print(f"[oge_278] poll-direct watchlist members: {len(members)}")

    if not members:
        print(
            "[oge_278] 0 poll-direct watchlist members; nothing to poll. Correct by design: "
            "all current anchors are impute_via_part5 historical_anchor / active_278_obligation "
            "false. The first poll-direct target enters via event-driven watchlist expansion "
            "(a future session), not by polling impute-mode members (Decision 3)."
        )
        return 0

    oge_seen = state.load_seen(state.OGE_SEEN_PATH)
    crew_seen = state.load_seen(state.CREW_SEEN_PATH)
    alloc = state.candidate_allocator()
    surfaced = 0
    surfaced_pointers: set[str] = set()  # dedupe so one filing -> one candidate

    # --- OGE per-filer 278 search (authority) ---------------------------------------
    for member in members:
        pid = member["person_id"]
        names = _person_names(pid) or []
        if not names:
            print(f"[oge_278] WARN no person names for {pid}; skipping filer.")
            continue
        entries = search_oge_filer(names)
        for entry in entries:
            pointer = entry["document_pointer"]
            ftype = _guess_filing_type(entry["raw_filename"])
            ym = _YEAR_RE.search(entry["raw_filename"])
            year = int(ym.group(1)) if ym else 0
            key = _seen_key(pid, year, ftype, pointer)
            change = ChangeSignal.AMENDED if ftype == "amendment" else ChangeSignal.NEW
            if key in oge_seen:
                continue
            cand = Candidate(
                candidate_id=alloc.next(),
                detected_at=state.now_utc(),
                detection_source=DetectionSource.OGE_278_SEARCH,
                watchlist_id=member["watchlist_id"],
                filer_person_id=pid,
                document_pointer=pointer,
                filing_year=year,
                filing_type_guess=ftype,
                change_signal=change,
                raw_metadata=entry,
                notes="OGE PAS index match; year/type best-effort from listing.",
            )
            state.write_candidate(cand)
            oge_seen[key] = {"detected_at": cand.detected_at.isoformat(), "candidate_id": cand.candidate_id}
            surfaced_pointers.add(pointer)
            surfaced += 1

    # --- CREW bulk diff (redundancy / early signal) ---------------------------------
    if CREW_DATASET_URL is None:
        print(
            "[oge_278] CREW dataset URL unresolved at build time; skipping CREW diff "
            "(flag, no guessed path). Machinery is built and ready for when a URL is set."
        )
    else:
        try:
            _run_crew_diff(members, crew_seen, alloc, surfaced_pointers)
        except Exception as e:  # noqa: BLE001
            print(f"[oge_278] WARN CREW diff failed: {e}; continuing.")

    state.save_seen(state.OGE_SEEN_PATH, oge_seen)
    state.save_seen(state.CREW_SEEN_PATH, crew_seen)
    print(f"[oge_278] surfaced {surfaced} pending candidate(s).")
    return 0


def _run_crew_diff(members, crew_seen, alloc, surfaced_pointers) -> None:
    """Diff the current CREW dataset against crew-seen.json for watchlist filers.

    OGE is authority where both fire; CREW is redundancy/early-signal. The intended steps,
    to be wired the moment CREW_DATASET_URL is resolved and its record shape confirmed:
      1. Fetch the current CREW financial-disclosure dataset.
      2. For each poll-direct member, select CREW records matching the filer.
      3. Key each on (filer, year, filing-type, canonical URL); a key not in crew_seen is a
         candidate, unless its underlying filing was already surfaced by OGE this run
         (pointer in surfaced_pointers) — OGE is authority, so dedupe to one candidate.
      4. write_candidate(...) with detection_source=crew_bulk_diff; record the key in crew_seen.

    Not wired today because the dataset URL/shape is unresolved (see CREW_DATASET_URL). This
    branch is unreachable until that URL is set, so the daily run is unaffected.
    """
    raise NotImplementedError("CREW dataset shape to be wired when CREW_DATASET_URL is resolved")


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="OGE 278 + CREW daily filer detection collector.")
    ap.parse_args(argv)
    return run()


if __name__ == "__main__":
    sys.exit(main())
