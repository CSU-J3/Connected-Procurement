"""Shared detection-workspace plumbing: paths, sequential id allocation, last-seen
load/save, and pending-record writers.

collectors/state/ is the committed detection workspace, deliberately outside data/ so
registry.validate never loads it. Everything a collector writes lands here.

Id allocation scans existing records for the highest NNNN and hands out the next one.
Allocation is collision-safe within a single run (the allocator caches the running max
and increments in memory); concurrent runs are not a concern at daily/weekly cadence.
"""
from __future__ import annotations

import hashlib
import json
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from collectors.shapes import Candidate, Match

REPO_ROOT = Path(__file__).resolve().parent.parent
STATE_DIR = REPO_ROOT / "collectors" / "state"
QUEUE_DIR = STATE_DIR / "queue"
MATCHES_DIR = STATE_DIR / "procurement-matches"
OGE_SEEN_PATH = STATE_DIR / "oge-278-seen.json"
CREW_SEEN_PATH = STATE_DIR / "crew-seen.json"
GSA_CACHE_DIR = STATE_DIR / "gsa-cache"


def ensure_dirs() -> None:
    for d in (STATE_DIR, QUEUE_DIR, MATCHES_DIR, GSA_CACHE_DIR):
        d.mkdir(parents=True, exist_ok=True)


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def now_utc_z() -> str:
    return now_utc().strftime("%Y-%m-%dT%H:%M:%SZ")


class IdAllocator:
    """Hands out sequential cp_<kind>_NNNN ids, starting one past the highest seen."""

    def __init__(self, prefix: str, existing_ids: list[str]) -> None:
        self.prefix = prefix
        pat = re.compile(rf"^{re.escape(prefix)}_(\d+)$")
        self._n = max(
            (int(m.group(1)) for i in existing_ids if (m := pat.match(i))),
            default=0,
        )

    def next(self) -> str:
        self._n += 1
        return f"{self.prefix}_{self._n:04d}"


def _ids_from_field(dir_path: Path, id_field: str) -> list[str]:
    ids: list[str] = []
    if not dir_path.exists():
        return ids
    for p in dir_path.glob("*.json"):
        try:
            data = json.loads(p.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            continue
        if isinstance(data, dict) and isinstance(data.get(id_field), str):
            ids.append(data[id_field])
    return ids


def candidate_allocator() -> IdAllocator:
    """Candidate files are named candidate-<date>-<hash>.json, so the id lives in the
    candidate_id field rather than the filename; scan the field."""
    return IdAllocator("cp_cand", _ids_from_field(QUEUE_DIR, "candidate_id"))


def match_allocator() -> IdAllocator:
    """Match files are named cp_match_NNNN.json, so the id is the filename stem."""
    stems = [p.stem for p in MATCHES_DIR.glob("*.json")] if MATCHES_DIR.exists() else []
    return IdAllocator("cp_match", stems)


def load_seen(path: Path) -> dict[str, Any]:
    if not path.exists():
        return {}
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return {}
    return data if isinstance(data, dict) else {}


def save_seen(path: Path, data: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def _dump(model: Candidate | Match) -> str:
    return json.dumps(model.model_dump(mode="json"), indent=2, ensure_ascii=False) + "\n"


def candidate_filename(detected_at: datetime, document_pointer: str) -> str:
    """candidate-<detected-date>-<short-hash>.json. The hash is over the document pointer
    so the same underlying filing maps to a stable filename (dedupe-friendly)."""
    short = hashlib.sha1(document_pointer.encode("utf-8")).hexdigest()[:10]
    return f"candidate-{detected_at.astimezone(timezone.utc).date().isoformat()}-{short}.json"


def write_candidate(candidate: Candidate) -> Path:
    ensure_dirs()
    path = QUEUE_DIR / candidate_filename(candidate.detected_at, candidate.document_pointer)
    path.write_text(_dump(candidate), encoding="utf-8")
    return path


def write_match(match: Match) -> Path:
    ensure_dirs()
    path = MATCHES_DIR / f"{match.match_id}.json"
    path.write_text(_dump(match), encoding="utf-8")
    return path
