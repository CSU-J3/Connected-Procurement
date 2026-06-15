// Registry types. Mirrors connected-procurement-registry-schema-spec.md with
// data-faithful labels (interest_type uses debt_instrument_owed, trust_beneficial
// per directive). Adds the floor value-shape variant present in data, and the
// disclosure_part / disclosure_item fields written by web/scripts/sync-data.mjs.

export type FilingId = `cp_filing_${string}`;
export type EntityId = `cp_entity_${string}`;
export type PersonId = `cp_person_${string}`;
export type RelId = `cp_rel_${string}`;
export type MergeId = `cp_merge_${string}`;
export type AnyRegistryId = FilingId | EntityId | PersonId | RelId | MergeId;

export type InterestType =
  | 'ownership'
  | 'trust_beneficial'
  | 'spousal_imputed'
  | 'debt_instrument_owed'
  | 'debt_instrument_held'
  | 'trust_trustee'
  | 'employment'
  | 'license_counterparty';

export type RelationKind =
  | 'entity_to_entity_subsidiary'
  | 'entity_to_entity_parent'
  | 'entity_to_entity_debt'
  | 'family_to_entity'
  | 'spousal'
  | 'family_blood'
  | 'family_marriage'
  | 'family_adoption';

export type ValueUnit = 'ownership_percent' | 'dollar_holding' | 'dollar_compensation' | 'none';
export type ValueShape = 'exact' | 'range' | 'binary' | 'imputed' | 'floor';

export interface RegistryValue {
  unit: ValueUnit;
  shape: ValueShape;
  low: number | null;
  high: number | null;
  exact: number | null;
  floor?: number | null;
  imputation_source: string | null;
}

export interface QualifyingRole {
  role: string;
  start_date: string;
  end_date: string | null;
}

export interface Relationship {
  relationship_id: RelId;
  source_id: EntityId | PersonId;
  target_id: EntityId | PersonId;
  relation_kind: RelationKind;
  interest_type: InterestType | null;
  value: RegistryValue | null;
  filing_source: FilingId;
  observed_on: string;
  superseded_by: RelId | null;
  excluded_from_total: boolean;
  exclusion_reason: string | null;
  qualifying_role: QualifyingRole | null;
  notes: string;
  disclosure_part: string | null;
  disclosure_item: string | null;
}

export interface AliasRef {
  name: string;
  source_url: string;
  source_filing_date: string;
  notes: string | null;
}

export type ExternalIdType = 'uei' | 'cik' | 'ein' | 'state_corp_reg' | 'duns_legacy' | 'other';

export interface ExternalId {
  id_type: ExternalIdType;
  id_value: string;
  jurisdiction: string | null;
  source_url: string;
  observed_on: string;
  superseded_by: number | null;
}

export interface Entity {
  entity_id: EntityId;
  canonical_name: string;
  aliases: AliasRef[];
  external_ids: ExternalId[];
  last_updated_from_filing: FilingId | null;
  merged_into: EntityId | null;
  notes: string;
}

export interface Person {
  person_id: PersonId;
  canonical_name: string;
  aliases: AliasRef[];
  last_updated_from_filing: FilingId | null;
  merged_into: PersonId | null;
  notes: string;
}

export type ChangeType = 'original' | 'amendment' | 'parse_correction' | 'annual_supersession';

export interface Filing {
  filing_id: FilingId;
  primary_source_url: string | null;
  source_filing_date: string;
  filer_id: PersonId;
  filing_type: string;
  interest_disclosed: {
    report_type?: string;
    date_of_appointment_or_termination?: string;
    filer_position?: string;
    _excluded_categories?: {
      _methodology?: string;
      categories?: Array<{ category: string; approx_entries: number; rationale: string }>;
    };
    [k: string]: unknown;
  };
  change_type: ChangeType;
  replaces_filing_id: FilingId | null;
  change_rationale: string | null;
  // ISO 8601 UTC datetime when this filing entered the registry under live-collection.
  // Null/absent for pre-2025 comparative records. Presence marks the live-collection phase.
  ingestion_timestamp?: string | null;
  notes: string;
}

export interface Merge {
  merge_id: MergeId;
  loser_id: EntityId | PersonId;
  winner_id: EntityId | PersonId;
  rationale: string;
  source_urls: string[];
  merged_on: string;
  merged_by: string;
}

export interface SyncedAt {
  synced_at: string;
}

export type NexusId = `cp_nexus_${string}`;
export type InstrumentType = 'gsa_lease' | 'federal_award';
export type NexusAwardSource = 'usaspending' | 'sam' | 'gsa_lease';
export type ConfidenceTier = 'high' | 'medium' | 'low';
// The nexus's own ruling under the locked procurement-nexus counting standard
// (methodology 2026-06-13). Distinct from a holder edge's excluded_from_total.
export type CountingStatus = 'counted' | 'documented_not_counted';

export interface NexusLink {
  nexus_id: NexusId;
  entity_id: EntityId;
  instrument_type: InstrumentType;
  instrument_id: string;
  source_url: string;
  match_basis: string;
  confidence_tier: ConfidenceTier;
  counting_status: CountingStatus;
  award_source: NexusAwardSource;
  observed_on: string;
  agency: string | null;
  detection_match_id: `cp_match_${string}` | null;
  superseded_by: NexusId | null;
  ingestion_timestamp: string | null;
  notes: string | null;
}

// entity_id -> nexus_id[]. Emitted by sync-data.mjs as nexus-by-entity.json.
export type NexusByEntity = Record<string, NexusId[]>;

// Per-entity facets precomputed by sync-data.mjs (entities-index.json). connected_persons
// is filing-filer attribution (the filer of each filing that sourced a touching edge).
export interface EntityIndexFacet {
  edge_count: number;
  connected_persons: PersonId[];
  nexus_ids: NexusId[];
}
export type EntitiesIndex = Record<string, EntityIndexFacet>;
