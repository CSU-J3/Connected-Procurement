"""Pydantic record shapes for detection output: Candidate and Match.

These are *detection* records, not registry records. They are deliberately defined here
in collectors/ rather than registry/models.py so the validator's TABLES never sees them
and registry.validate never loads collectors/state/. The shapes follow the planning
artifact (docs/handoffs/2026-05-28-session-01.md) sections 1 (Output queue shape) and 2
(Output) exactly.

Foreign-key id fields (person/entity/watchlist) reuse the registry's id-pattern type
aliases so a detection record can only point at a well-formed registry id; importing the
str-constraint aliases does not register these models with the validator.
"""
from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum
from typing import Annotated, Any

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    StringConstraints,
    field_serializer,
    field_validator,
)

# Reuse the registry's id-pattern aliases for cross-record references only.
from registry.models import CpEntityId, CpPersonId, CpWatchlistId

CpCandidateId = Annotated[str, StringConstraints(pattern=r"^cp_cand_\d{4,}$")]
CpMatchId = Annotated[str, StringConstraints(pattern=r"^cp_match_\d{4,}$")]


class DetectionSource(str, Enum):
    OGE_278_SEARCH = "oge_278_search"
    CREW_BULK_DIFF = "crew_bulk_diff"


class ChangeSignal(str, Enum):
    NEW = "new"
    AMENDED = "amended"


class CandidateTriageStatus(str, Enum):
    """Collectors set PENDING on write and never touch it again. The transition to
    INGESTED / DISMISSED / CONFIRMED is a human-gated ingest-session action."""

    PENDING = "pending"
    INGESTED = "ingested"
    DISMISSED = "dismissed"
    CONFIRMED = "confirmed"


class AwardSource(str, Enum):
    USASPENDING = "usaspending"
    SAM = "sam"
    GSA_LEASE = "gsa_lease"


class ConfidenceBand(str, Enum):
    AUTO_SURFACE = "auto_surface"
    REVIEW = "review"
    DROP = "drop"


class MatchTriageStatus(str, Enum):
    PENDING = "pending"
    CONFIRMED = "confirmed"
    DISMISSED = "dismissed"


def _utc_z(v: datetime) -> str:
    """Serialize a datetime to ISO 8601 UTC with an explicit Z offset (no naive datetimes,
    matching the registry ingestion_timestamp convention, e.g. 2026-05-28T14:03:11Z)."""
    return v.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


class _Base(BaseModel):
    model_config = ConfigDict(extra="forbid")


class AwardRef(_Base):
    """The source's record id plus a source URL, per artifact section 2 (award_ref)."""

    source_record_id: str
    source_url: str

    @field_validator("source_record_id", "source_url")
    @classmethod
    def _nonempty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("must be non-empty")
        return v


class Candidate(_Base):
    """Daily filer-detection output (artifact section 1, "Output queue shape").

    One file per candidate under collectors/state/queue/, named
    candidate-<detected-date>-<short-hash>.json.
    """

    candidate_id: CpCandidateId
    detected_at: datetime
    detection_source: DetectionSource
    watchlist_id: CpWatchlistId
    filer_person_id: CpPersonId
    document_pointer: str
    filing_year: int
    filing_type_guess: str
    change_signal: ChangeSignal
    raw_metadata: dict[str, Any] = Field(default_factory=dict)
    triage_status: CandidateTriageStatus = CandidateTriageStatus.PENDING
    notes: str | None = None

    @field_validator("document_pointer", "filing_type_guess")
    @classmethod
    def _nonempty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("must be non-empty")
        return v

    @field_serializer("detected_at")
    def _ser_detected_at(self, v: datetime) -> str:
        return _utc_z(v)


class Match(_Base):
    """Weekly procurement-match output (artifact section 2, "Output").

    One file per surfaced match under collectors/state/procurement-matches/,
    named cp_match_NNNN.json.

    address_score is nullable by design: registry Entity records carry no structured
    address field (only canonical_name, aliases, external_ids), so there is no
    registry-side address to score against today. When the registry side has no address,
    address_score is null and the band keys off name_score alone. See the procurement
    collector for how the band falls back when address_score is null.
    """

    match_id: CpMatchId
    surfaced_at: datetime
    entity_id: CpEntityId
    award_source: AwardSource
    award_ref: AwardRef
    name_score: float
    address_score: float | None = None
    confidence_band: ConfidenceBand
    triage_status: MatchTriageStatus = MatchTriageStatus.PENDING
    notes: str | None = None

    @field_serializer("surfaced_at")
    def _ser_surfaced_at(self, v: datetime) -> str:
        return _utc_z(v)
