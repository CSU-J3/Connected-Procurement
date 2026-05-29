"""USAspending procurement collector (artifact section 2).

Crosses in-scope registry entities against federal contract awards via the public
USAspending API (no authentication) and emits pending match candidates under
collectors/state/procurement-matches/. Writes nothing to data/.

Endpoint: POST https://api.usaspending.gov/api/v2/search/spending_by_award
Contract verified live at build time (2026-05-29): filters.award_type_codes is required;
recipient_search_text filters by recipient name; results carry Recipient Name, Place of
Performance State Code, Award ID, and generated_internal_id (used to build the award URL).

Expected-empty on the current registry: the in-scope (live-counting) entity set is empty,
so a default run logs "0 in-scope entities" and surfaces nothing. Run with --all-entities
to exercise the pipeline against real awards (build-validation; matches are stamped as
build-validation artifacts, not live-scope detections).
"""
from __future__ import annotations

import argparse
import sys
import time

from collectors import match, state
from collectors.httpio import post_json
from collectors.shapes import AwardRef, AwardSource, ConfidenceBand, Match

API_URL = "https://api.usaspending.gov/api/v2/search/spending_by_award/"
AWARD_URL_PREFIX = "https://www.usaspending.gov/award/"
# Procurement (contract) award types. Grants/loans/etc. are out of scope for the beat.
CONTRACT_AWARD_TYPE_CODES = ["A", "B", "C", "D"]
RESULT_FIELDS = [
    "Award ID",
    "Recipient Name",
    "Awarding Agency",
    "Place of Performance State Code",
    "Award Amount",
    "generated_internal_id",
]


def _query_awards(recipient_name: str, limit: int) -> list[dict]:
    payload = {
        "filters": {
            "award_type_codes": CONTRACT_AWARD_TYPE_CODES,
            "recipient_search_text": [recipient_name],
        },
        "fields": RESULT_FIELDS,
        "page": 1,
        "limit": limit,
        "sort": "Award Amount",
        "order": "desc",
    }
    data = post_json(API_URL, payload)
    return data.get("results", []) or []


def run(all_entities: bool = False, per_entity_limit: int = 25, sleep: float = 0.0) -> int:
    entities, diag = match.load_in_scope_entities(all_entities=all_entities)
    mode = "ALL ENTITIES (build-validation)" if all_entities else "live-counting in-scope set"
    print(f"[usaspending] input: {mode}")
    print(
        f"[usaspending] {diag['in_scope_count']} in-scope entities "
        f"(live-counting edges: {diag['live_counting_edges']}; total entities: {diag['total_entities']})"
    )

    if not entities:
        print(
            "[usaspending] 0 in-scope entities; nothing to match. This is correct on the "
            "current registry (no entity is reachable from a live-counting edge yet). "
            "Run with --all-entities for a build-validation pass."
        )
        return 0

    alloc = state.match_allocator()
    surfaced = 0
    examined = 0
    for ent in entities:
        if sleep:
            time.sleep(sleep)
        try:
            results = _query_awards(ent.canonical_name, per_entity_limit)
        except Exception as e:  # noqa: BLE001 - surface as a logged warning, keep going
            print(f"[usaspending] WARN query failed for {ent.entity_id} ({ent.canonical_name}): {e}")
            continue
        for award in results:
            examined += 1
            recipient = award.get("Recipient Name") or ""
            ns = match.name_score(ent.names, recipient)
            # Registry entities carry no structured address; address_score is null and the
            # state-match condition (Place of Performance State Code) is unevaluable.
            ascore = match.address_score(None, {"state": award.get("Place of Performance State Code")})
            band, band_note = match.classify_band(ns, ascore, state_match=None)
            if band == ConfidenceBand.DROP:
                continue
            gen_id = award.get("generated_internal_id") or ""
            award_id = award.get("Award ID") or gen_id or "unknown"
            note_parts = [f"matched recipient {recipient!r} against {ent.canonical_name!r}"]
            if band_note:
                note_parts.append(band_note)
            if all_entities:
                note_parts.append(match.BUILD_VALIDATION_MARKER)
            m = Match(
                match_id=alloc.next(),
                surfaced_at=state.now_utc(),
                entity_id=ent.entity_id,
                award_source=AwardSource.USASPENDING,
                award_ref=AwardRef(
                    source_record_id=award_id,
                    source_url=(AWARD_URL_PREFIX + gen_id) if gen_id else API_URL,
                ),
                name_score=round(ns, 4),
                address_score=ascore,
                confidence_band=band,
                notes="; ".join(note_parts),
            )
            state.write_match(m)
            surfaced += 1

    print(f"[usaspending] examined {examined} awards; surfaced {surfaced} pending match candidates.")
    return 0


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="USAspending procurement match collector.")
    ap.add_argument(
        "--all-entities",
        action="store_true",
        help="Build-validation: match against all entities, not just the live-counting "
        "in-scope set. Matches are stamped as build-validation artifacts, not live scope.",
    )
    ap.add_argument("--limit", type=int, default=25, help="Max awards fetched per entity.")
    ap.add_argument(
        "--sleep",
        type=float,
        default=0.0,
        help="Seconds to pause between per-entity queries (politeness; helps the "
        "build-validation pass avoid connection throttling).",
    )
    args = ap.parse_args(argv)
    return run(all_entities=args.all_entities, per_entity_limit=args.limit, sleep=args.sleep)


if __name__ == "__main__":
    sys.exit(main())
