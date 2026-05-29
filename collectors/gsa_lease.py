"""GSA lease collector (artifact section 3).

There is no per-call GSA lease API; the lease inventory is a bulk dataset. This collector
resolves the current published IOLP "Leases" file at build time, downloads and caches it
under collectors/state/gsa-cache/, parses it locally, and reuses the step-2 match pipeline.
Writes nothing to data/.

Source resolution (verified live 2026-05-29): the GSA Inventory of Owned and Leased
Properties (IOLP) dataset page on data.gov lists a dated "IOLP Leases.xlsx" resource. We
scrape the dataset page for the current dated download URL rather than hardcoding a stale,
rotating filename. The file is parsed with stdlib (zipfile + xml) so no openpyxl dependency
is added. If the live URL will not resolve, the collector flags it and exits clean rather
than coding against a guessed path.

Known source limitation (flagged, not worked around): the IOLP leased dataset carries the
building/asset name, street, city, state, and ZIP, but NOT the lessor/landlord legal
company name. The beat's lease subject is the landlord (the entity receiving lease
payments), so name matching here scores against the building "Real Property Asset Name",
which is a weak axis; the address columns would carry the real signal, but registry
entities have no structured address yet (the same null-address condition as USAspending).
This is recorded for the field-mapping/tuning session; it does not block the build.

Same expected-empty-on-first-run behavior as USAspending (empty live-counting set);
--all-entities runs the build-validation widening.
"""
from __future__ import annotations

import argparse
import io
import re
import sys
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path

from collectors import match, state
from collectors.httpio import get_bytes, get_text
from collectors.shapes import AwardRef, AwardSource, ConfidenceBand, Match

DATASET_PAGE = "https://catalog.data.gov/dataset/inventory-of-owned-and-leased-properties-iolp"
# The current dated leases file lives on inventory.data.gov; resolve its URL from the
# dataset page so the rotating filename is never hardcoded.
LEASES_HREF_RE = re.compile(r"https://inventory\.data\.gov/[^\"'\s]*?iolp-leases\.xlsx", re.I)
CACHE_PATH = state.GSA_CACHE_DIR / "iolp-leases.xlsx"

_XLNS = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"


def resolve_download_url() -> str | None:
    """Scrape the data.gov dataset page for the current dated IOLP Leases .xlsx URL."""
    try:
        html = get_text(DATASET_PAGE)
    except Exception as e:  # noqa: BLE001
        print(f"[gsa_lease] WARN could not load dataset page to resolve download URL: {e}")
        return None
    matches = sorted(set(LEASES_HREF_RE.findall(html)))
    if not matches:
        print("[gsa_lease] WARN no IOLP Leases .xlsx link found on the dataset page.")
        return None
    # Prefer the lexically-greatest (latest dated) URL.
    return matches[-1]


def fetch_to_cache(url: str) -> Path | None:
    try:
        raw = get_bytes(url, timeout=180)
    except Exception as e:  # noqa: BLE001
        print(f"[gsa_lease] WARN download failed ({url}): {e}")
        return None
    state.ensure_dirs()
    CACHE_PATH.write_bytes(raw)
    print(f"[gsa_lease] cached {len(raw)} bytes -> {CACHE_PATH.relative_to(state.REPO_ROOT)}")
    return CACHE_PATH


def parse_xlsx(path: Path) -> tuple[list[str], list[list[str]]]:
    """Parse the first worksheet into (header, rows) using stdlib only."""
    z = zipfile.ZipFile(path)
    shared: list[str] = []
    if "xl/sharedStrings.xml" in z.namelist():
        st = ET.fromstring(z.read("xl/sharedStrings.xml"))
        for si in st.findall(f"{_XLNS}si"):
            shared.append("".join(t.text or "" for t in si.iter(f"{_XLNS}t")))
    sheet = ET.fromstring(z.read("xl/worksheets/sheet1.xml"))

    def cell_value(c: ET.Element) -> str:
        v = c.find(f"{_XLNS}v")
        if v is None or v.text is None:
            # inline string
            is_ = c.find(f"{_XLNS}is")
            if is_ is not None:
                return "".join(t.text or "" for t in is_.iter(f"{_XLNS}t"))
            return ""
        if c.get("t") == "s":
            return shared[int(v.text)]
        return v.text

    rows: list[list[str]] = []
    for row in sheet.iter(f"{_XLNS}row"):
        rows.append([cell_value(c) for c in row.findall(f"{_XLNS}c")])
    if not rows:
        return [], []
    return rows[0], rows[1:]


def _col_index(header: list[str], *candidates: str) -> int | None:
    norm = {h.strip().lower(): i for i, h in enumerate(header)}
    for c in candidates:
        if c.lower() in norm:
            return norm[c.lower()]
    return None


def run(all_entities: bool = False) -> int:
    entities, diag = match.load_in_scope_entities(all_entities=all_entities)
    mode = "ALL ENTITIES (build-validation)" if all_entities else "live-counting in-scope set"
    print(f"[gsa_lease] input: {mode}")
    print(
        f"[gsa_lease] {diag['in_scope_count']} in-scope entities "
        f"(live-counting edges: {diag['live_counting_edges']}; total entities: {diag['total_entities']})"
    )

    if not entities:
        print(
            "[gsa_lease] 0 in-scope entities; nothing to match. Correct on the current "
            "registry. Run with --all-entities for a build-validation pass."
        )
        return 0

    url = resolve_download_url()
    if not url:
        print("[gsa_lease] source URL did not resolve; flagging and exiting clean (no guessed path).")
        return 0
    print(f"[gsa_lease] resolved download URL: {url}")
    path = fetch_to_cache(url)
    if not path:
        print("[gsa_lease] download did not resolve; flagging and exiting clean.")
        return 0

    header, rows = parse_xlsx(path)
    name_ix = _col_index(header, "Real Property Asset Name", "Installation Name")
    state_ix = _col_index(header, "State")
    lease_ix = _col_index(header, "Lease Number", "Location Code")
    city_ix = _col_index(header, "City")
    street_ix = _col_index(header, "Street Address")
    zip_ix = _col_index(header, "Zip Code")
    if name_ix is None:
        print(f"[gsa_lease] WARN expected name column not found in header: {header}")
        return 0
    print(f"[gsa_lease] parsed {len(rows)} lease rows; matching against {len(entities)} entities.")

    def cell(row: list[str], ix: int | None) -> str:
        return row[ix] if ix is not None and ix < len(row) else ""

    # Pre-normalize each lease row's asset name once (not once per entity), and keep its
    # token set for a cheap shared-token prefilter. A pair with zero shared tokens scores
    # well below the drop threshold, so skipping it changes no surfaced match while turning
    # a 456 x 7395 brute force into something tractable.
    prepared = []
    for row in rows:
        asset = cell(row, name_ix)
        if not asset:
            continue
        norm = match.normalize_name(asset)
        if not norm:
            continue
        prepared.append((row, asset, norm, set(norm.split())))

    alloc = state.match_allocator()
    surfaced = 0
    for ent in entities:
        ent_norm = [match.normalize_name(n) for n in ent.names]
        ent_tokens = set().union(*[set(n.split()) for n in ent_norm]) if ent_norm else set()
        for row, asset, asset_norm, asset_tokens in prepared:
            if not (ent_tokens & asset_tokens):
                continue
            ns = max((match.token_set_ratio(en, asset_norm) for en in ent_norm), default=0.0)
            # No registry-side structured address -> address_score null, state unevaluable.
            ascore = match.address_score(None, {"state": cell(row, state_ix)})
            band, band_note = match.classify_band(ns, ascore, state_match=None)
            if band == ConfidenceBand.DROP:
                continue
            lease_ref = cell(row, lease_ix) or "unknown"
            note_parts = [
                f"matched IOLP asset {asset!r} against {ent.canonical_name!r}",
                "IOLP carries no lessor/landlord legal name; name scored against building asset name",
            ]
            if band_note:
                note_parts.append(band_note)
            if all_entities:
                note_parts.append(match.BUILD_VALIDATION_MARKER)
            m = Match(
                match_id=alloc.next(),
                surfaced_at=state.now_utc(),
                entity_id=ent.entity_id,
                award_source=AwardSource.GSA_LEASE,
                award_ref=AwardRef(source_record_id=lease_ref, source_url=url),
                name_score=round(ns, 4),
                address_score=ascore,
                confidence_band=band,
                notes="; ".join(note_parts),
            )
            state.write_match(m)
            surfaced += 1

    print(f"[gsa_lease] surfaced {surfaced} pending match candidates.")
    return 0


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="GSA IOLP lease match collector.")
    ap.add_argument(
        "--all-entities",
        action="store_true",
        help="Build-validation: match against all entities, not just the live-counting "
        "in-scope set. Matches are stamped as build-validation artifacts, not live scope.",
    )
    args = ap.parse_args(argv)
    return run(all_entities=args.all_entities)


if __name__ == "__main__":
    sys.exit(main())
