"""Shared match pipeline for the procurement collectors (USAspending, GSA lease, SAM).

Built for step 2 (USAspending) and reused by steps 3 and 4. Holds:
  - name normalization and a self-contained token-set-ratio name scorer (no third-party
    fuzzy-match dependency; stdlib difflib),
  - a null-tolerant address scorer,
  - the placeholder confidence bands as named constants (NOT tuned this session), and
  - in-scope entity loading.

Two deliberate properties, per the build directive:

1. address_score is null-tolerant. Registry Entity records carry no structured address
   field (extra="forbid": only canonical_name, aliases, external_ids), so there is no
   registry-side address to score against today; the address scorer returns None and the
   band keys off the name score alone. The interface keeps an optional structured
   registry-side address for the day entities carry one, but we do not parse addresses
   out of free-text alias notes (brittle and unearned).

2. The in-scope entity set is "entities reachable from non-excluded (live-counting)
   relationships." Every comparative edge today is excluded_from_total: true, so that set
   is empty and a default run surfaces nothing. The --all-entities build-validation flag
   widens the input to every entity to exercise the pipeline against real awards; matches
   it produces are stamped as build-validation artifacts, not live-scope detections.
"""
from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from difflib import SequenceMatcher
from pathlib import Path

from collectors.shapes import ConfidenceBand

REPO_ROOT = Path(__file__).resolve().parent.parent
DATA_ROOT = REPO_ROOT / "data"

# --- Confidence bands: PLACEHOLDER defaults, do not tune this session. -----------------
# The tuning session edits these named constants in one place against real-data
# false-positive / false-negative rates (artifact section 2).
AUTO_SURFACE_NAME = 0.92  # auto-surface: name >= this AND a state match
REVIEW_NAME_LOW = 0.85  # review band floor; below this is dropped
# (auto-surface also requires a state match; when address_score is null the state-match
#  condition is unevaluable and auto-surface falls back to name >= AUTO_SURFACE_NAME alone.)

_CORP_SUFFIXES = {
    "LLC", "L.L.C.", "LLC.", "INC", "INC.", "INCORPORATED", "CORP", "CORP.",
    "CORPORATION", "LP", "L.P.", "LLP", "L.L.P.", "CO", "CO.", "COMPANY", "TRUST",
}
_PUNCT = re.compile(r"[^\w\s]")
_WS = re.compile(r"\s+")


def normalize_name(name: str) -> str:
    """Uppercase; strip corporate suffixes and punctuation; collapse whitespace
    (artifact section 2 name normalization)."""
    up = name.upper()
    # Drop suffix tokens before punctuation strip so "L.L.C." is caught.
    tokens = [t for t in _WS.split(up.strip()) if t and t not in _CORP_SUFFIXES]
    cleaned = _PUNCT.sub(" ", " ".join(tokens))
    return _WS.sub(" ", cleaned).strip()


def _ratio(a: str, b: str) -> float:
    return SequenceMatcher(None, a, b).ratio()


def token_set_ratio(a: str, b: str) -> float:
    """Token-set ratio in [0, 1] (the rapidfuzz/fuzzywuzzy algorithm, on stdlib difflib).
    Order-independent and robust to one side carrying extra tokens."""
    set_a = set(a.split())
    set_b = set(b.split())
    if not set_a or not set_b:
        return 0.0
    inter = sorted(set_a & set_b)
    diff_ab = sorted(set_a - set_b)
    diff_ba = sorted(set_b - set_a)
    t0 = " ".join(inter)
    t1 = (t0 + " " + " ".join(diff_ab)).strip()
    t2 = (t0 + " " + " ".join(diff_ba)).strip()
    return max(_ratio(t0, t1), _ratio(t0, t2), _ratio(t1, t2))


def name_score(entity_names: list[str], candidate_name: str) -> float:
    """Best normalized token-set ratio across the entity's alias set (artifact section 2:
    take the best score across the entity's alias set)."""
    cand = normalize_name(candidate_name)
    if not cand:
        return 0.0
    return max((token_set_ratio(normalize_name(n), cand) for n in entity_names), default=0.0)


def address_score(registry_address: dict | None, source_address: dict | None) -> float | None:
    """USPS-component address score with state and ZIP5 high weight. Null-tolerant:
    returns None when the registry side has no structured address (every entity today),
    in which case the band keys off name score alone."""
    if not registry_address:
        return None
    if not source_address:
        return 0.0
    weights = {"state": 0.35, "zip5": 0.35, "city": 0.15, "street": 0.15}
    score = 0.0
    for comp, w in weights.items():
        rv = (registry_address.get(comp) or "").strip().upper()
        sv = (source_address.get(comp) or "").strip().upper()
        if rv and sv and rv == sv:
            score += w
    return score


def classify_band(
    name: float, addr: float | None, state_match: bool | None
) -> tuple[ConfidenceBand, str | None]:
    """Return (band, note_fragment). note_fragment records the null-address fallback so it
    lands in the match's notes; None when no caveat applies.

    - auto-surface: name >= AUTO_SURFACE_NAME and a state match. When addr is None the
      state-match condition is unevaluable, so auto-surface falls back to name alone and a
      note records that the state-match condition could not be evaluated.
    - review: REVIEW_NAME_LOW <= name < AUTO_SURFACE_NAME, or a strong name with a partial
      address match (the latter collapses to name-only when addr is None).
    - drop: name < REVIEW_NAME_LOW.
    """
    if name >= AUTO_SURFACE_NAME:
        if addr is None:
            return (
                ConfidenceBand.AUTO_SURFACE,
                "state-match condition unevaluable (no registry-side structured address); "
                "auto-surfaced on name score alone",
            )
        if state_match:
            return ConfidenceBand.AUTO_SURFACE, None
        # strong name but no state match: review with a partial-address signal
        return ConfidenceBand.REVIEW, "strong name, no state match"
    if name >= REVIEW_NAME_LOW:
        return ConfidenceBand.REVIEW, None
    return ConfidenceBand.DROP, None


@dataclass
class ScopedEntity:
    entity_id: str
    canonical_name: str
    names: list[str] = field(default_factory=list)  # canonical + alias names
    address: dict | None = None  # structured registry address, None today


def _load_json_dir(rel: str) -> list[dict]:
    d = DATA_ROOT / rel
    if not d.exists():
        return []
    out = []
    for p in sorted(d.glob("*.json")):
        try:
            out.append(json.loads(p.read_text(encoding="utf-8")))
        except (json.JSONDecodeError, OSError):
            continue
    return out


def load_in_scope_entities(all_entities: bool = False) -> tuple[list[ScopedEntity], dict]:
    """Load the in-scope entity set and a small diagnostics dict.

    Default: entities reachable from non-excluded (live-counting) relationships. Today
    every edge is excluded_from_total: true, so this is empty.
    all_entities=True: every entity (build-validation widening; not live scope).
    """
    entities = {e["entity_id"]: e for e in _load_json_dir("entities")}
    rels = _load_json_dir("entity_relationships")

    live_counting_edges = [r for r in rels if not r.get("excluded_from_total", False)]
    scoped_ids: set[str] = set()
    for r in live_counting_edges:
        for ep in (r.get("source_id"), r.get("target_id")):
            if isinstance(ep, str) and ep.startswith("cp_entity_"):
                scoped_ids.add(ep)

    selected_ids = set(entities) if all_entities else scoped_ids

    scoped: list[ScopedEntity] = []
    for eid in sorted(selected_ids):
        e = entities.get(eid)
        if not e:
            continue
        names = [e["canonical_name"]] + [a["name"] for a in e.get("aliases", []) if a.get("name")]
        scoped.append(ScopedEntity(entity_id=eid, canonical_name=e["canonical_name"], names=names))

    diag = {
        "total_entities": len(entities),
        "live_counting_edges": len(live_counting_edges),
        "in_scope_count": len(scoped_ids),
        "selected_count": len(scoped),
        "all_entities_mode": all_entities,
    }
    return scoped, diag


# Marker stamped into the notes of any match produced under --all-entities so a future
# triage session cannot mistake a build-validation match for a live-scope detection.
BUILD_VALIDATION_MARKER = (
    "build-validation pass: matched outside live-counting scope; not a live-scope detection"
)
