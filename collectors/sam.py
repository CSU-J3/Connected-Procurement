"""SAM.gov entity collector (artifact section 2; keyed source).

Crosses in-scope registry entities against SAM.gov Entity Management registration data and
emits pending match candidates. Writes nothing to data/.

Endpoint (contract verified at build time 2026-05-29 against open.gsa.gov/api/entity-api/):
  GET https://api.sam.gov/entity-information/v3/entities?api_key=KEY&legalBusinessName=NAME
  Response: entityData[] -> each has entityRegistration.{legalBusinessName, ueiSAM} and
  coreData.physicalAddress.{city, stateOrProvinceCode, zipCode}.

Key handling:
  - The key is read from the SAM_API_KEY environment variable. It is never hardcoded and
    never committed.
  - No-op gracefully when unset: log and exit clean (zero matches, no error) so a fresh
    checkout with no key does not break the daily/weekly run.
  - Basic-tier keys are limited to 10 requests/day, so queries are capped (--max-queries)
    and the cap is logged, not silent. A rate-limit response (HTTP 429) is a logged
    warning, not a crash.
"""
from __future__ import annotations

import argparse
import os
import sys
import time
import urllib.error
import urllib.parse

from collectors import match, state
from collectors.httpio import get_json
from collectors.shapes import AwardRef, AwardSource, ConfidenceBand, Match

API_URL = "https://api.sam.gov/entity-information/v3/entities"
ENTITY_PROFILE_PREFIX = "https://sam.gov/entity/"
# Conservative default so an --all-entities pass cannot blow a 10/day basic-tier budget.
DEFAULT_MAX_QUERIES = 8


def _query_entities(legal_name: str, api_key: str) -> list[dict]:
    qs = urllib.parse.urlencode(
        {"api_key": api_key, "legalBusinessName": legal_name, "includeSections": "entityRegistration,coreData"}
    )
    data = get_json(f"{API_URL}?{qs}")
    return data.get("entityData", []) or []


def run(all_entities: bool = False, max_queries: int = DEFAULT_MAX_QUERIES, sleep: float = 0.0) -> int:
    api_key = os.environ.get("SAM_API_KEY")
    if not api_key:
        print("[sam] SAM_API_KEY unset, skipping SAM entity match.")
        return 0

    entities, diag = match.load_in_scope_entities(all_entities=all_entities)
    mode = "ALL ENTITIES (build-validation)" if all_entities else "live-counting in-scope set"
    print(f"[sam] input: {mode}")
    print(f"[sam] {diag['in_scope_count']} in-scope entities (total: {diag['total_entities']})")

    if not entities:
        print("[sam] 0 in-scope entities; nothing to match. Run with --all-entities for a build-validation pass.")
        return 0

    if len(entities) > max_queries:
        print(
            f"[sam] capping queries at {max_queries} of {len(entities)} entities to stay within "
            f"the basic-tier 10/day budget; {len(entities) - max_queries} entities NOT queried this run."
        )
        entities = entities[:max_queries]

    alloc = state.match_allocator()
    surfaced = 0
    for ent in entities:
        if sleep:
            time.sleep(sleep)
        try:
            results = _query_entities(ent.canonical_name, api_key)
        except urllib.error.HTTPError as e:
            if e.code == 429:
                print("[sam] WARN rate limit hit (HTTP 429); stopping SAM run early.")
                break
            print(f"[sam] WARN query failed for {ent.entity_id} (HTTP {e.code}); continuing.")
            continue
        except Exception as e:  # noqa: BLE001
            print(f"[sam] WARN query failed for {ent.entity_id}: {e}; continuing.")
            continue

        for rec in results:
            reg = rec.get("entityRegistration", {}) or {}
            core = rec.get("coreData", {}) or {}
            addr = core.get("physicalAddress", {}) or {}
            legal_name = reg.get("legalBusinessName") or ""
            uei = reg.get("ueiSAM") or ""
            ns = match.name_score(ent.names, legal_name)
            ascore = match.address_score(None, {"state": addr.get("stateOrProvinceCode")})
            band, band_note = match.classify_band(ns, ascore, state_match=None)
            if band == ConfidenceBand.DROP:
                continue
            note_parts = [f"matched SAM legalBusinessName {legal_name!r} against {ent.canonical_name!r}"]
            if band_note:
                note_parts.append(band_note)
            if all_entities:
                note_parts.append(match.BUILD_VALIDATION_MARKER)
            m = Match(
                match_id=alloc.next(),
                surfaced_at=state.now_utc(),
                entity_id=ent.entity_id,
                award_source=AwardSource.SAM,
                award_ref=AwardRef(
                    source_record_id=uei or "unknown",
                    source_url=(ENTITY_PROFILE_PREFIX + uei) if uei else API_URL,
                ),
                name_score=round(ns, 4),
                address_score=ascore,
                confidence_band=band,
                notes="; ".join(note_parts),
            )
            state.write_match(m)
            surfaced += 1

    print(f"[sam] surfaced {surfaced} pending match candidates.")
    return 0


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="SAM.gov entity match collector (keyed via SAM_API_KEY).")
    ap.add_argument(
        "--all-entities",
        action="store_true",
        help="Build-validation: match against all entities, not just the live-counting "
        "in-scope set. Matches are stamped as build-validation artifacts, not live scope.",
    )
    ap.add_argument(
        "--max-queries",
        type=int,
        default=DEFAULT_MAX_QUERIES,
        help="Cap on entities queried per run (basic-tier keys allow only 10 requests/day).",
    )
    ap.add_argument("--sleep", type=float, default=0.0, help="Seconds between queries (politeness).")
    args = ap.parse_args(argv)
    return run(all_entities=args.all_entities, max_queries=args.max_queries, sleep=args.sleep)


if __name__ == "__main__":
    sys.exit(main())
