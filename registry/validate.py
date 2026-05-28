"""Connected Procurement registry validator: load every record through its model and run cross-record checks."""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path
from typing import Callable, Iterable

from pydantic import BaseModel, ValidationError

from registry.models import (
    Entity,
    Filing,
    Merge,
    Person,
    Relationship,
    Watchlist,
)


REPO_ROOT = Path(__file__).resolve().parent.parent
DATA_ROOT = REPO_ROOT / "data"

TABLES: dict[str, tuple[str, str, type[BaseModel]]] = {
    "filings": ("filing", "filing_id", Filing),
    "entities": ("entity", "entity_id", Entity),
    "persons": ("person", "person_id", Person),
    "entity_relationships": ("rel", "relationship_id", Relationship),
    "merges": ("merge", "merge_id", Merge),
    "watchlist": ("watch", "watchlist_id", Watchlist),
}


class _ErrorCollector:
    def __init__(self) -> None:
        self.items: list[str] = []

    def add(self, msg: str) -> None:
        self.items.append(msg)

    def __bool__(self) -> bool:
        return bool(self.items)


def _load_table(
    dir_path: Path, id_prefix: str, id_field: str, model: type[BaseModel], errors: _ErrorCollector
) -> dict[str, BaseModel]:
    records: dict[str, BaseModel] = {}
    if not dir_path.exists():
        return records
    pattern = re.compile(rf"^cp_{id_prefix}_\d{{4,}}$")
    for path in sorted(dir_path.glob("*.json")):
        rel = path.relative_to(REPO_ROOT)
        stem = path.stem
        if not pattern.match(stem):
            errors.add(f"{rel}: filename does not match cp_{id_prefix}_NNNN")
            continue
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except json.JSONDecodeError as e:
            errors.add(f"{rel}: invalid JSON: {e}")
            continue
        if not isinstance(data, dict):
            errors.add(f"{rel}: top-level JSON must be an object")
            continue
        try:
            obj = model.model_validate(data)
        except ValidationError as e:
            errors.add(f"{rel}: validation failed:\n{_indent(str(e))}")
            continue
        id_value = data.get(id_field)
        if id_value != stem:
            errors.add(f"{rel}: {id_field}={id_value!r} does not match filename {stem!r}")
            continue
        if stem in records:
            errors.add(f"{rel}: duplicate id {stem}")
            continue
        records[stem] = obj
    return records


def _indent(text: str, prefix: str = "    ") -> str:
    return "\n".join(prefix + line for line in text.splitlines())


def _check_references(records: dict[str, dict[str, BaseModel]], errors: _ErrorCollector) -> None:
    filings = records["filings"]
    entities = records["entities"]
    persons = records["persons"]
    rels = records["entity_relationships"]
    merges = records["merges"]
    watchlist = records["watchlist"]

    for fid, f in filings.items():
        if f.replaces_filing_id and f.replaces_filing_id not in filings:
            errors.add(f"filings/{fid}: replaces_filing_id={f.replaces_filing_id} not found")
        if f.filer_id:
            table = entities if f.filer_id.startswith("cp_entity_") else persons
            kind = "entities" if f.filer_id.startswith("cp_entity_") else "persons"
            if f.filer_id not in table:
                errors.add(f"filings/{fid}: filer_id={f.filer_id} not found in {kind}")

    for eid, e in entities.items():
        if e.merged_into and e.merged_into not in entities:
            errors.add(f"entities/{eid}: merged_into={e.merged_into} not found")
        if e.last_updated_from_filing and e.last_updated_from_filing not in filings:
            errors.add(
                f"entities/{eid}: last_updated_from_filing={e.last_updated_from_filing} not found"
            )

    for pid, p in persons.items():
        if p.merged_into and p.merged_into not in persons:
            errors.add(f"persons/{pid}: merged_into={p.merged_into} not found")
        if p.last_updated_from_filing and p.last_updated_from_filing not in filings:
            errors.add(
                f"persons/{pid}: last_updated_from_filing={p.last_updated_from_filing} not found"
            )

    for rid, r in rels.items():
        for endpoint, val in (("source_id", r.source_id), ("target_id", r.target_id)):
            if val.startswith("cp_entity_") and val not in entities:
                errors.add(f"entity_relationships/{rid}: {endpoint}={val} not in entities")
            elif val.startswith("cp_person_") and val not in persons:
                errors.add(f"entity_relationships/{rid}: {endpoint}={val} not in persons")
        if r.filing_source not in filings:
            errors.add(f"entity_relationships/{rid}: filing_source={r.filing_source} not found")
        if r.superseded_by and r.superseded_by not in rels:
            errors.add(f"entity_relationships/{rid}: superseded_by={r.superseded_by} not found")
        if r.value and r.value.imputation_source:
            src = r.value.imputation_source
            if src.startswith("cp_filing_") and src not in filings:
                errors.add(
                    f"entity_relationships/{rid}: value.imputation_source={src} not in filings"
                )
            elif src.startswith("cp_rel_") and src not in rels:
                errors.add(
                    f"entity_relationships/{rid}: value.imputation_source={src} "
                    f"not in entity_relationships"
                )

    for mid, m in merges.items():
        kind = m.loser_id.split("_", 2)[1]
        table = entities if kind == "entity" else persons
        table_name = "entities" if kind == "entity" else "persons"
        for endpoint, val in (("loser_id", m.loser_id), ("winner_id", m.winner_id)):
            if val not in table:
                errors.add(f"merges/{mid}: {endpoint}={val} not in {table_name}")

    for wid, w in watchlist.items():
        if w.person_id not in persons:
            errors.add(f"watchlist/{wid}: person_id={w.person_id} not in persons")


def _detect_cycles(
    node_ids: Iterable[str],
    get_next: Callable[[str], str | None],
    label: str,
    errors: _ErrorCollector,
    max_hops: int = 1000,
) -> None:
    explored: set[str] = set()
    for start in node_ids:
        if start in explored:
            continue
        path: list[str] = []
        current: str | None = start
        while current is not None:
            if current in explored:
                break
            if current in path:
                cycle = " -> ".join(path[path.index(current):] + [current])
                errors.add(f"{label}: cycle detected: {cycle}")
                break
            path.append(current)
            if len(path) > max_hops:
                errors.add(f"{label}: chain starting at {start} exceeds {max_hops} hops")
                break
            current = get_next(current)
        explored.update(path)


def _check_cycles(records: dict[str, dict[str, BaseModel]], errors: _ErrorCollector) -> None:
    rels = records["entity_relationships"]
    entities = records["entities"]
    persons = records["persons"]

    _detect_cycles(
        rels.keys(),
        lambda x: rels[x].superseded_by if x in rels else None,
        "superseded_by[entity_relationships]",
        errors,
    )

    _detect_cycles(
        entities.keys(),
        lambda x: entities[x].merged_into if x in entities else None,
        "merged_into[entities]",
        errors,
    )

    _detect_cycles(
        persons.keys(),
        lambda x: persons[x].merged_into if x in persons else None,
        "merged_into[persons]",
        errors,
    )

    def imp_next(rid: str) -> str | None:
        r = rels.get(rid)
        if r is None or r.value is None or r.value.imputation_source is None:
            return None
        src = r.value.imputation_source
        return src if src in rels else None

    _detect_cycles(rels.keys(), imp_next, "imputation_source[entity_relationships]", errors)


def main() -> int:
    errors = _ErrorCollector()
    if not DATA_ROOT.exists():
        print(f"data root not found: {DATA_ROOT}", file=sys.stderr)
        return 1

    records: dict[str, dict[str, BaseModel]] = {}
    for table_dir, (id_prefix, id_field, model) in TABLES.items():
        records[table_dir] = _load_table(
            DATA_ROOT / table_dir, id_prefix, id_field, model, errors
        )

    if errors:
        _report(errors)
        return 1

    _check_references(records, errors)
    _check_cycles(records, errors)

    if errors:
        _report(errors)
        return 1

    counts = {name: len(records[name]) for name in records}
    print(f"validation passed. records: {counts}")
    return 0


def _report(errors: _ErrorCollector) -> None:
    print(f"Validation failed with {len(errors.items)} error(s):", file=sys.stderr)
    for item in errors.items:
        print(f"  - {item}", file=sys.stderr)


if __name__ == "__main__":
    sys.exit(main())
