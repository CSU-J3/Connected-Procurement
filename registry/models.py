"""Connected Procurement registry models per the schema spec."""
from __future__ import annotations

from datetime import date
from enum import Enum
from typing import Annotated, Any

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    StringConstraints,
    field_validator,
    model_validator,
)


CpFilingId = Annotated[str, StringConstraints(pattern=r"^cp_filing_\d{4,}$")]
CpEntityId = Annotated[str, StringConstraints(pattern=r"^cp_entity_\d{4,}$")]
CpPersonId = Annotated[str, StringConstraints(pattern=r"^cp_person_\d{4,}$")]
CpRelationshipId = Annotated[str, StringConstraints(pattern=r"^cp_rel_\d{4,}$")]
CpMergeId = Annotated[str, StringConstraints(pattern=r"^cp_merge_\d{4,}$")]
CpEntityOrPersonId = Annotated[str, StringConstraints(pattern=r"^cp_(entity|person)_\d{4,}$")]
CpFilingOrRelId = Annotated[str, StringConstraints(pattern=r"^cp_(filing|rel)_\d{4,}$")]


class Unit(str, Enum):
    OWNERSHIP_PERCENT = "ownership_percent"
    DOLLAR_HOLDING = "dollar_holding"
    DOLLAR_COMPENSATION = "dollar_compensation"
    NONE = "none"


class Shape(str, Enum):
    EXACT = "exact"
    RANGE = "range"
    BINARY = "binary"
    IMPUTED = "imputed"
    FLOOR = "floor"


class ChangeType(str, Enum):
    ORIGINAL = "original"
    AMENDMENT = "amendment"
    PARSE_CORRECTION = "parse_correction"
    ANNUAL_SUPERSESSION = "annual_supersession"


class RelationKind(str, Enum):
    FAMILY_TO_ENTITY = "family_to_entity"
    ENTITY_TO_ENTITY_PARENT = "entity_to_entity_parent"
    ENTITY_TO_ENTITY_SUBSIDIARY = "entity_to_entity_subsidiary"
    ENTITY_TO_ENTITY_DEBT = "entity_to_entity_debt"
    SPOUSAL = "spousal"
    FAMILY_BLOOD = "family_blood"
    FAMILY_MARRIAGE = "family_marriage"
    FAMILY_ADOPTION = "family_adoption"


class InterestType(str, Enum):
    OWNERSHIP = "ownership"
    EMPLOYMENT = "employment"
    DEBT_INSTRUMENT_HELD = "debt_instrument_held"
    DEBT_INSTRUMENT_OWED = "debt_instrument_owed"
    TRUST_BENEFICIAL = "trust_beneficial"
    TRUST_TRUSTEE = "trust_trustee"
    SPOUSAL_IMPUTED = "spousal_imputed"
    LICENSE_COUNTERPARTY = "license_counterparty"


class ExternalIdType(str, Enum):
    UEI = "uei"
    CIK = "cik"
    EIN = "ein"
    STATE_CORP_REG = "state_corp_reg"
    DUNS_LEGACY = "duns_legacy"
    OTHER = "other"


_FINANCIAL_RELATION_KINDS = {
    RelationKind.FAMILY_TO_ENTITY,
    RelationKind.ENTITY_TO_ENTITY_PARENT,
    RelationKind.ENTITY_TO_ENTITY_SUBSIDIARY,
    RelationKind.ENTITY_TO_ENTITY_DEBT,
}

_PERSON_TO_PERSON_KINDS = {
    RelationKind.SPOUSAL,
    RelationKind.FAMILY_BLOOD,
    RelationKind.FAMILY_MARRIAGE,
    RelationKind.FAMILY_ADOPTION,
}

_ENTITY_TO_ENTITY_KINDS = {
    RelationKind.ENTITY_TO_ENTITY_PARENT,
    RelationKind.ENTITY_TO_ENTITY_SUBSIDIARY,
    RelationKind.ENTITY_TO_ENTITY_DEBT,
}


class _Base(BaseModel):
    model_config = ConfigDict(extra="forbid")


class QualifyingRole(_Base):
    role: str
    start_date: date
    end_date: date | None = None

    @field_validator("role")
    @classmethod
    def _nonempty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("role must be non-empty")
        return v

    @model_validator(mode="after")
    def _check_dates(self) -> QualifyingRole:
        if self.end_date is not None and self.end_date < self.start_date:
            raise ValueError("end_date must be on or after start_date")
        return self


class Value(_Base):
    unit: Unit
    shape: Shape
    low: float | None = None
    high: float | None = None
    exact: float | None = None
    floor: float | None = None
    imputation_source: CpFilingOrRelId | None = None

    @model_validator(mode="after")
    def _check_shape_rules(self) -> Value:
        s = self.shape
        if s == Shape.RANGE:
            if self.low is None or self.high is None:
                raise ValueError("shape=range requires non-null low and high")
            if self.exact is not None:
                raise ValueError("shape=range forbids exact")
            if self.floor is not None:
                raise ValueError("shape=range forbids floor")
            if self.imputation_source is not None:
                raise ValueError("shape=range forbids imputation_source")
            if self.high < self.low:
                raise ValueError("shape=range requires high >= low")
        elif s == Shape.EXACT:
            if self.exact is None:
                raise ValueError("shape=exact requires non-null exact")
            if self.low is not None or self.high is not None:
                raise ValueError("shape=exact forbids low and high")
            if self.floor is not None:
                raise ValueError("shape=exact forbids floor")
            if self.imputation_source is not None:
                raise ValueError("shape=exact forbids imputation_source")
        elif s == Shape.BINARY:
            if self.unit != Unit.NONE:
                raise ValueError("shape=binary requires unit=none")
            if (
                self.low is not None
                or self.high is not None
                or self.exact is not None
                or self.floor is not None
            ):
                raise ValueError("shape=binary forbids all numerics")
            if self.imputation_source is not None:
                raise ValueError("shape=binary forbids imputation_source")
        elif s == Shape.IMPUTED:
            if self.imputation_source is None:
                raise ValueError("shape=imputed requires non-null imputation_source")
            if (
                self.low is not None
                or self.high is not None
                or self.exact is not None
                or self.floor is not None
            ):
                raise ValueError("shape=imputed forbids numerics on the imputed edge")
        elif s == Shape.FLOOR:
            if self.floor is None:
                raise ValueError("shape=floor requires non-null floor")
            if self.low is not None or self.high is not None or self.exact is not None:
                raise ValueError("shape=floor forbids low, high, and exact")
            if self.imputation_source is not None:
                raise ValueError("shape=floor forbids imputation_source")
        if self.unit == Unit.NONE and s not in (Shape.BINARY, Shape.IMPUTED):
            raise ValueError("unit=none is only legal when shape is binary or imputed")
        return self


class Alias(_Base):
    name: str
    source_url: str
    source_filing_date: date
    notes: str | None = None

    @field_validator("name", "source_url")
    @classmethod
    def _nonempty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("must be non-empty")
        return v


class ExternalId(_Base):
    id_type: ExternalIdType
    id_value: str
    jurisdiction: str | None = None
    source_url: str
    observed_on: date
    superseded_by: int | None = None

    @field_validator("id_value", "source_url")
    @classmethod
    def _nonempty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("must be non-empty")
        return v


class Filing(_Base):
    filing_id: CpFilingId
    primary_source_url: str
    source_filing_date: date
    filer_id: CpEntityOrPersonId | None = None
    filing_type: str
    interest_disclosed: dict[str, Any]

    change_type: ChangeType = ChangeType.ORIGINAL
    replaces_filing_id: CpFilingId | None = None
    change_rationale: str | None = None
    notes: str | None = None

    @field_validator("primary_source_url", "filing_type")
    @classmethod
    def _nonempty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("must be non-empty")
        return v

    @model_validator(mode="after")
    def _check_change_record(self) -> Filing:
        if self.change_type == ChangeType.ORIGINAL:
            if self.replaces_filing_id is not None:
                raise ValueError("change_type=original requires replaces_filing_id null")
            if self.change_rationale is not None:
                raise ValueError("change_type=original requires change_rationale null")
        else:
            if self.replaces_filing_id is None:
                raise ValueError(
                    f"change_type={self.change_type.value} requires replaces_filing_id"
                )
            if not self.change_rationale or not self.change_rationale.strip():
                raise ValueError(
                    f"change_type={self.change_type.value} requires non-empty change_rationale"
                )
            if self.replaces_filing_id == self.filing_id:
                raise ValueError("filing cannot replace itself")
        return self


class Entity(_Base):
    entity_id: CpEntityId
    canonical_name: str
    aliases: list[Alias] = Field(default_factory=list)
    external_ids: list[ExternalId] = Field(default_factory=list)
    last_updated_from_filing: CpFilingId | None = None
    merged_into: CpEntityId | None = None
    notes: str | None = None

    @field_validator("canonical_name")
    @classmethod
    def _nonempty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("canonical_name must be non-empty")
        return v

    @model_validator(mode="after")
    def _check_merge_self_ref(self) -> Entity:
        if self.merged_into == self.entity_id:
            raise ValueError("entity cannot be merged into itself")
        return self

    @model_validator(mode="after")
    def _check_external_id_supersession(self) -> Entity:
        n = len(self.external_ids)
        for i, ext in enumerate(self.external_ids):
            sb = ext.superseded_by
            if sb is None:
                continue
            if sb == i:
                raise ValueError(f"external_ids[{i}] cannot be superseded by itself")
            if sb < 0 or sb >= n:
                raise ValueError(
                    f"external_ids[{i}].superseded_by={sb} out of range [0,{n})"
                )
        return self


class Person(_Base):
    person_id: CpPersonId
    canonical_name: str
    aliases: list[Alias] = Field(default_factory=list)
    last_updated_from_filing: CpFilingId | None = None
    merged_into: CpPersonId | None = None
    notes: str | None = None

    @field_validator("canonical_name")
    @classmethod
    def _nonempty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("canonical_name must be non-empty")
        return v

    @model_validator(mode="after")
    def _check_merge_self_ref(self) -> Person:
        if self.merged_into == self.person_id:
            raise ValueError("person cannot be merged into itself")
        return self


class Relationship(_Base):
    relationship_id: CpRelationshipId
    source_id: CpEntityOrPersonId
    target_id: CpEntityOrPersonId
    relation_kind: RelationKind
    interest_type: InterestType | None = None
    value: Value | None = None
    filing_source: CpFilingId
    observed_on: date
    superseded_by: CpRelationshipId | None = None
    excluded_from_total: bool = False
    exclusion_reason: str | None = None
    qualifying_role: QualifyingRole | None = None
    notes: str | None = None

    @model_validator(mode="after")
    def _check_interest_required(self) -> Relationship:
        if self.relation_kind in _FINANCIAL_RELATION_KINDS:
            if self.interest_type is None:
                raise ValueError(
                    f"relation_kind={self.relation_kind.value} requires interest_type"
                )
            if self.value is None:
                raise ValueError(
                    f"relation_kind={self.relation_kind.value} requires value"
                )
        else:
            if self.interest_type is not None:
                raise ValueError(
                    f"relation_kind={self.relation_kind.value} forbids interest_type"
                )
            if self.value is not None:
                raise ValueError(
                    f"relation_kind={self.relation_kind.value} forbids value"
                )
        return self

    @model_validator(mode="after")
    def _check_exclusion(self) -> Relationship:
        has_reason = bool(self.exclusion_reason and self.exclusion_reason.strip())
        if self.excluded_from_total and not has_reason:
            raise ValueError("excluded_from_total=true requires non-empty exclusion_reason")
        if not self.excluded_from_total and has_reason:
            raise ValueError("exclusion_reason set but excluded_from_total=false")
        return self

    @model_validator(mode="after")
    def _check_self_ref(self) -> Relationship:
        if self.source_id == self.target_id:
            raise ValueError("relationship cannot point from an id to itself")
        if self.superseded_by == self.relationship_id:
            raise ValueError("relationship cannot supersede itself")
        return self

    @model_validator(mode="after")
    def _check_endpoint_kinds(self) -> Relationship:
        rk = self.relation_kind
        s_is_person = self.source_id.startswith("cp_person_")
        t_is_person = self.target_id.startswith("cp_person_")
        s_is_entity = self.source_id.startswith("cp_entity_")
        t_is_entity = self.target_id.startswith("cp_entity_")
        if rk in _PERSON_TO_PERSON_KINDS:
            if not (s_is_person and t_is_person):
                raise ValueError(
                    f"relation_kind={rk.value} requires both endpoints to be persons"
                )
        elif rk == RelationKind.FAMILY_TO_ENTITY:
            if not (s_is_person and t_is_entity):
                raise ValueError(
                    "relation_kind=family_to_entity requires source=person, target=entity"
                )
        elif rk in _ENTITY_TO_ENTITY_KINDS:
            if not (s_is_entity and t_is_entity):
                raise ValueError(
                    f"relation_kind={rk.value} requires both endpoints to be entities"
                )
        return self


class Merge(_Base):
    merge_id: CpMergeId
    loser_id: CpEntityOrPersonId
    winner_id: CpEntityOrPersonId
    rationale: str
    source_urls: list[str]
    merged_on: date
    merged_by: str

    @field_validator("rationale", "merged_by")
    @classmethod
    def _nonempty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("must be non-empty")
        return v

    @field_validator("source_urls")
    @classmethod
    def _source_urls_nonempty(cls, v: list[str]) -> list[str]:
        if not v:
            raise ValueError("source_urls cannot be empty")
        for url in v:
            if not url.strip():
                raise ValueError("source_urls entries must be non-empty")
        return v

    @model_validator(mode="after")
    def _check_same_kind(self) -> Merge:
        loser_kind = self.loser_id.split("_", 2)[1]
        winner_kind = self.winner_id.split("_", 2)[1]
        if loser_kind != winner_kind:
            raise ValueError(
                f"loser ({loser_kind}) and winner ({winner_kind}) must be the same kind"
            )
        if self.loser_id == self.winner_id:
            raise ValueError("loser_id and winner_id must differ")
        return self
