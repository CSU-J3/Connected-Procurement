# Connected Procurement: Methodology

This page documents the registry's load-bearing conventions and excluded scope decisions. Each entry names what the rule says, why it exists, and what it does not promise. Conventions are versioned; changes carry a dated changelog entry.

## Source authority

### `primary_source_url`

`primary_source_url` must point at either an OGE-hosted PDF or a mirror of an OGE-certified PDF. When a mirror is used, `_parse_provenance.primary_source_authority` must document the certification chain (electronic signatures, OGE Director countersignature) present in the PDF. The registry does not cryptographically verify these signatures; it captures the chain so an external auditor can.

Operative consequence: a mirror URL is acceptable only when the underlying PDF carries the OGE certification chain on its face. A mirror of an uncertified copy is not acceptable. The certification chain lives in the document, not in the URL.

### `primary_source_url` and publisher infrastructure migration

`primary_source_url` records the publisher's current canonical URL for the document. The field's purpose is to give readers a working pointer to the document as currently served; it is not an archeological record of where the document was originally retrieved.

When a publisher migrates infrastructure — for example, DocumentCloud's shift from `s3.documentcloud.org` to `assets.documentcloud.org` — the publisher's canonical URL changes. The authority chain is unchanged: same publisher, same document, same certification path. Only the URL through the publisher's infrastructure has shifted. `primary_source_url` follows the publisher to the new canonical URL.

The retrieval archeology — the URL used at record-creation time, the method used, any hosts that failed during retrieval — belongs in `_parse_provenance.method`, not in `primary_source_url`.

**Maintenance posture: reactive, not periodic.** URLs are verified opportunistically. When a record is touched for any reason and its `primary_source_url` is found to no longer resolve cleanly, the URL is updated to the publisher's current canonical path and the change recorded in `_parse_provenance.method`. No proactive re-verification of all URLs is performed on a schedule.

Locked: 2026-05-20.

## Filing dates

### Convention 1: `source_filing_date`

`source_filing_date` on a filing record is the filer-signed date of the filing record itself.

#### Pattern (a): same-PDF revisions during the OGE review window

Observed in Kushner 2018 and 2019 annual 278 filings (`cp_filing_0001`, `cp_filing_0002`).

The OGE Form 278e review process allows for data revisions between the filer's electronic signature and final OGE certification. Under 5 CFR Part 2634, filings move through agency ethics official review and OGE certifying-official review before certification. Edits made during this review window, typically in response to ethics-official questions, appear as "Data Revised" stamps inside the same certified PDF. The filer does not re-sign for each revision; the existing signature carries through to certification.

For filings of this pattern:

- `source_filing_date` is the single filer-signature date on the certified PDF
- `change_type` is whatever the filing cycle dictates (annual, new_entrant, termination); not `amendment`
- Each revision date is recorded in `interest_disclosed.data_revisions_recorded_on_form`
- OGE certification date is recorded in `interest_disclosed.oge_certification_date`, separate from the filer-signature date

The Kushner 2018 278 illustrates: filer signature 2018-05-15, agency ethics opinion 2018-10-26, OGE certification 2019-04-03, with five intervening "Data Revised" stamps spanning 2018-09-19 to 2019-03-27. One filer signature, multiple revisions, single certified document.

#### Pattern (b): separately-filed amendments — deferred

A second pattern, where a post-certification amendment is filed as a discrete PDF with its own filer signature on the OGE PAS Index, is anticipated but not yet observed in the registry. Pattern (a) and pattern (b) are distinct regulatory categories: review-window revisions modify a pre-certification draft, while amendments correct a post-certification record and typically initiate a new review cycle.

Resolution deferred until a separately-filed amendment enters the registry. The convention will then be extended with explicit handling for `change_type: amendment` records: which signature populates `source_filing_date` (the amendment's, not the original's), and how `replaces_filing_id` chains across the supersession.

### Convention 2: `observed_on`

The `observed_on` value on a relationship is the as-of date for the disclosure's analytical anchor, used for time-ordering filings from the same filer and for the supersession chain. It is not the as-of date of the dollar values disclosed on the form.

- **Annual 278**: end of the calendar year covered (12/31/YYYY).
- **Termination 278**: filer's exit date from the position.
- **New-entrant 278**: filer's date of appointment / commencement of position. This is the 18 USC 208 trigger date and the moment the disclosure exists to document against. The form's value brackets reflect filing-date holdings, which on new-entrants postdates the appointment by weeks to months. This gap is a property of new-entrant form mechanics, not an `observed_on` problem; the gap is documented here so consumers of the registry understand that new-entrant value brackets and `observed_on` do not necessarily share an as-of date.
- **Amendment**: inherits the `observed_on` of the filing it amends. The amendment's filer-signature date goes in `source_filing_date`; `observed_on` does not change.

The new-entrant rule was tested on the Ivanka Trump 2017 new-entrant 278 (`cp_filing_0004`): date of appointment 03/29/2017 sets `observed_on` on the filing's derived relationships, while the form's value brackets are end-of-reporting-period figures (the reporting period runs into late May 2017; filer signature 06/12/2017 under a 45-day extension). Picking filer-signature date would have placed the analytical anchor after the events the filing exists to document (the 03/09/2017 trust restructuring, the 03/29/2017 appointment); appointment date is the only candidate that aligns analytically.

Locked: 2026-05-20.

## Relationship modeling

### Convention 4: trust → subsidiary edges

When a trust holds an interest in an underlying entity and both are modeled as `cp_entity` records, the connecting edge uses `relation_kind: entity_to_entity_subsidiary` with `source_id` set to the holding entity (the trust, or any parent) and `target_id` set to the held entity. The schema does not enforce this direction: `_check_endpoint_kinds` in `registry/models.py` requires only that both endpoints be entities, not that source is the parent. This is editorial discipline, not a validator-checked rule.

The schema offers two relation_kinds for entity-to-entity links — `entity_to_entity_parent` and `entity_to_entity_subsidiary`. A holder→held relationship can be expressed as either ("X is parent of Y" or "Y is subsidiary of X"). The convention picks `_subsidiary` for trust→holding edges to keep one canonical direction and avoid double-edging the same fact. `_parent` remains in the enum so it can still represent the inverse view if a future filing names a held entity first and walks up to its trust.

In the current registry, `cp_rel_0009`, `cp_rel_0010`, and `cp_rel_0011` all run cp_entity_0003 (Donald J. Trump Revocable Trust) → cp_entity_0004/0005/0006 (845 UN LP, DJT Operations I LLC, Trump International Golf Links Doonbeg). `qualifying_role` is null on these because corporate edges are not gated by an officeholder's appointment.

What can go wrong: picking the wrong source/target endpoints reverses the meaning of the edge (the held entity appears as the holder). The validator will not catch this. Catching it is on the registry maintainer, with the underlying filing as the source of truth: a Schedule A item disclosed by a filer at the trust level lists the underlying assets under the trust, never the trust under the assets.

### Value shape: `floor`

When an OGE 278 records a value in an open-ended upper-bound category (e.g., "Over $50,000,000"), the relationship's `value` uses `shape: floor` with the `floor` field set to OGE's stated threshold. No ceiling is invented; OGE's disclosure granularity is preserved as the only documented quantitative fact. `floor` is a parallel variant to `exact`, `range`, `binary`, and `imputed`: a single numeric field naming a structural property of the disclosure ("at least this much, with no documented ceiling"), not the disclosure's verbiage.

First applied to the Business Trust royalty-income line on Ivanka Trump's 2017 new-entrant 278 (`cp_rel_0012`, `floor: 50000000`). The variant was added after two filings forced it: `cp_filing_0003` first surfaced the gap (five "Over $50,000,000" lines held back), and the Ivanka filing surfaced a sixth. The five `cp_filing_0003` lines are eligible for backfill under this shape; that backfill is deferred to a separate pass.

### Encoding "value not readily ascertainable" 278 disclosures

5 CFR 2634.301 permits filers to disclose a holding's existence on Form 278 without a value bracket when the value cannot reasonably be determined (closely-held LLC interests without recent valuation events, illiquid private-fund interests, in-progress restructurings, etc.). The registry encodes these disclosures using the existing `binary` value shape (`unit: none`, all numeric fields forbidden), which structurally captures "interest exists, value not stated."

The form-text disclosure ("value not readily ascertainable") is recorded verbatim in the relationship's `notes` field so the audit trail preserves the filer-side disclosure language. The data-layer encoding (`binary`) preserves the substantive fact (interest exists) without inventing a value bracket that wasn't disclosed.

Distinction from bracketed low-value disclosures: "None (or less than $1,001)" — common in Part 6 — is a disclosed bracketed value (the holding has value in the $0–$1,001 range). The registry encodes this as `range` with `low: 0, high: 1001`. "Value not readily ascertainable" is qualitatively different: no value bracket was disclosed at all. A bare "None" without the "(or less than $1,001)" qualifier is a third case (genuine zero / no holding) and is not given an arbitrary encoding; it is surfaced for review.

This encoding pattern was formalized in Fork D after the §3 inspection surfaced dozens of Part 5 and Part 6 entries carrying the "value not readily ascertainable" disclosure language. The encoding applies retroactively to any earlier registry edges that should have used it but didn't.

Locked: 2026-05-21.

### Contingent-rights meta-disclosures

Some OGE Form 278 entries take the form of a meta-disclosure pointing at a class of contingent rights rather than naming a specific holding. The canonical pattern reads: "Contingent rights to ownership interests in entities ... entities listed in endnote." The disclosure exists to alert reviewers that the filer may receive future interests in named entities if specified conditions are met (revenue targets, IRR thresholds, etc.); the underlying entities are enumerated in the matching endnote.

These meta-rows are captured via the underlying entities' direct edges where they appear elsewhere in the form, not as standalone meta-edges. No `family_to_entity` edge is written for the meta-row itself. The substantive disclosure — Jared has a contingent path to entity X — is recoverable through whatever edges entity X carries from other parts of the form.

This rule keeps the registry's edge semantics clean: edges represent actual holdings, not conditional-future-holdings-that-may-materialize. The contingent-rights footnote text is preserved in the corresponding filing's `interest_disclosed` payload (or in the underlying entity's notes where the connection is otherwise unrecoverable) so the audit trail keeps the form-language.

First applied in Fork E to cp_filing_0001 Part 6 item 18.6 and cp_filing_0002 Part 6 item 18.2.

Locked: 2026-05-23.

### Multi-to-one supersession resolution

When per-row writes surface multi-to-one supersession matches via the (entity, parcel descriptor, form-block context) match key — typically where a single predecessor filing discloses the same parcel in both the EOY-value block and the period-max block — the period-max row carries the supersession link to the successor filing's row. The EOY-value-update row stands without successor. The EOY value remains recoverable from that row's `notes` field (form-block context); the substantively comparable disclosure is the period-max row.

The rule applies the same way when a successor filing has its own EOY/period-max pair for the same parcel: the predecessor period-max row chains to the successor period-max row. Predecessor EOY rows stand without successor regardless of the successor structure.

The pre-existing Fork E close has a corner case where a single predecessor filing carries *two* period-max rows for the same parcel (KMP1 items 208 and 230 cp_filing_0001), both pointing to the same successor row. That edge case isn't fully resolved by this convention as written; the Fork E implementation matched both predecessor period-max rows to the later successor row. A later fork may refine that behavior if a substantive analysis question depends on it.

Locked: 2026-05-23.

### Convention 5: debt instrument direction

The schema distinguishes filer-as-creditor and filer-as-debtor debt instruments via two separate `interest_type` values:

- `debt_instrument_held` — filer is the creditor; the entity is the obligor on the note. Used when the filer (or a wholly-owned LLC of the filer) holds a loan-receivable secured by the entity's assets or revenue. This is the historical `debt` enum semantic, renamed for clarity at the enum-value layer; the rename was zero-cost (no existing records used `interest_type: "debt"`) and landed bundled with Fork F's Part 8 write commit.
- `debt_instrument_owed` — filer is the debtor; the entity is the creditor holding the note. Used for Part 8 (Liabilities) disclosures where the filer owes money to a bank, mortgage lender, or other counterparty.

Both values use the same `family_to_entity` relation kind with the same `source=person, target=entity` endpoint orientation. The direction of the underlying debt is captured at the `interest_type` layer only; the edge endpoint orientation does not flip. This keeps the supersession-chain and validator semantics uniform across both directions.

Counterparty entities under `debt_instrument_owed` (banks, mortgage lenders, etc.) are registered as `cp_entity_NNNN` records to satisfy the `target_id` reference requirement on the family_to_entity edge. The procurement-relevance test under "Registry inclusion test (278-sourced entities)" applies; operating-company banks land under default-include because they are themselves federal procurement counterparties (banking services contracts) and because the registry's purpose is to capture the universe of family-financial-counterparty entities regardless of which side of the obligation they sit on.

Locked: 2026-05-23.

### Convention 6: external-source entity_to_entity relationships

Entity_to_entity subsidiary edges and similar relational structures require a filing-disclosed source per Convention 4. External corporate-structure knowledge — bank parent/subsidiary trees, publicly-known holding relationships, named-but-undisclosed corporate ownership — is captured in entity `notes` and defers to a future fork that adds an external-source registry edge mechanism. Do not invent value brackets or stretch `binary` shapes to accommodate non-filing-disclosed relationships.

The Fork F DBAG ↔ DBTCA case is the canonical example: Deutsche Bank AG (cp_entity_0131) is the German parent of Deutsche Bank Trust Company Americas (cp_entity_0132). The parent-subsidiary relationship is public corporate structure (SEC 10-K, Delaware corporate registrations) but is not disclosed by any of the four OGE filings currently in the registry. Both entities were registered to anchor the Part 8 edges that target them, but the subsidiary edge between them was deferred per this convention; the relationship is captured in each entity's notes pending an external-source edge mechanism.

Locked: 2026-05-23.

### Convention 3: spousal imputation

Where 18 USC 208(a)(2) imputes a spousal interest to a filer, the imputed interest is recorded as a separate `Relationship` with `interest_type: spousal_imputed`, `shape: imputed`, and `imputation_source` pointing at the `Relationship` ID of the principal interest on the spouse's side. Imputed edges:

- Have their own `observed_on`, sourced to the imputing filer's filing.
- Do not restate the principal's value bracket. The bracket is recoverable by traversal through `imputation_source`. Restating would invite silent edits if the principal's bracket later updates.
- Have independent supersession chains. A later filing of the principal can update or drop the underlying interest without affecting the imputed edge's status, and vice versa. Supersession follows the chain of the filer who recorded the observation, not the chain of the principal.
- Are flagged for de-duplication where totals are constructed to count distinct underlying interests. The dedup key is `interest_type == spousal_imputed`; rows matching this key are excluded from totals that count distinct interests.

The schema does not collapse imputed and principal edges into a single multi-sourced edge. The observation layer preserves what each filing actually disclosed; the totals layer handles de-duplication via the `interest_type` filter.

**Forward-point case.** When an imputed edge's `observed_on` precedes the `observed_on` of its `imputation_source`, the imputation chain points forward in time. This reflects the sampling pattern of filings — when each filer happened to file relative to when the underlying interest was held — rather than a substantive inconsistency. The principal interest was held continuously across the gap; the registry simply lacks a contemporaneous principal observation. Imputed edges are not required to link to a principal whose `observed_on` is at or before the imputed `observed_on`; the chain links to the best-available principal observation regardless of temporal direction.

Locked: 2026-05-20.

## Inspection and transcription

### Renderer

PDF inspection for value-bracket transcription uses a rasterized page rendering at 200dpi minimum, viewed via the inspection tool. Any raster PDF tool meets the rule — `pdftocairo`, `pypdfium2`, `PyMuPDF`, etc. The substantive requirement is rasterized output at sufficient resolution to resolve column-collision on dense OGE-form tables, not the specific tool name.

`pdftotext` and equivalent text-extraction tools are permitted only as a cross-check against the visual read, never as the sole source of value brackets or entity names. Fork D's experience with `pdftotext` mis-extracting roughly half the column-collision rows on Jared Kushner's 2018 Part 6 is the load-bearing reason for the rule. The form's dense tabular layout breaks text extractors that lose track of column boundaries; visual reads do not.

When a row's value cell is ambiguous at 200dpi (column wrap, footnote glyph overlapping the bracket text, adjacent-cell bleed), re-render the row at 300dpi with row-band cropping for the spot-check. The 300dpi pass is reserved for individual ambiguities and for headline-claim verifications (see below), not used as a default for all transcription.

First applied in Fork E (substituted `pypdfium2` for `pdftocairo` per pre-flight authorization; the substitution preserved methodology in substance since both produce 200dpi PNG output).

Locked: 2026-05-23.

### Headline-claim verification

Confidence flagging on visual transcription catches structural anomalies — adjacent duplicates, ambiguous columns, unclear descriptors — but does not exhaustively verify entity names or value brackets on rows that pass without flag. For high-stakes claims (material supersession changes, top-bracket values, headline disclosure events called out in commit messages), do a targeted 300dpi re-render verification before the claim is written. Per-row writes land based on the original 200dpi transcription; the targeted verification is reserved for claims that become load-bearing in commit messages or in downstream research output.

Fork E demonstrated the rule by example: three different headline-class claims (BFPS Ventures "material increase," WT 25 Columbia "appreciation," Times Square "duplicate disclosure") all surfaced as transcription errors when verified at 300dpi. The 300dpi pass takes minutes per row; a load-bearing commit-message claim built on an unverified row is hard to retract once published.

Locked: 2026-05-23.

### Surface count vs. write count

Row counts surfaced in inspection forks' §3 reports are estimates, not precise figures. The per-row write convention can surface additional rows during writes where the initial transcription collapsed sub-parcel disclosures that the form actually splits. Final counts come from the post-write `validate` output, not the §3 surface table.

Fork E surfaced 146 registered rows in its §3 report and wrote 169 edges. The delta came from per-row sub-parcel splits that the §3 table's aggregation by entity-or-by-trust did not separately number. The §3 surface is the inspection deliverable; the post-write registry counts are the authoritative answer.

Locked: 2026-05-23.

## Named family member

### In-laws of in-laws

PROJECT.md's exhaustive list of named family member categories does not include in-laws of in-laws. The exclusion list reads, in part: "The list does not include: friends, business associates without a family tie, in-laws of in-laws, romantic partners short of marriage, or extended family beyond the categories above. If a borderline case arises, the default is exclusion."

For working purposes, "in-law of an in-law" means the parent or other relative of a person who is connected to the President only through marriage to a President's child or sibling. The relationship is sometimes called "co-parent-in-law" or, in Yiddish, "machatunim." A direct in-law of the President (the spouse of a President's child or sibling) is in the named family member list under category 2 or 4. The parents of that spouse are not.

Two appointees from the current administration sit at the boundary the rule was written to handle. Both are popularly described as "Trump family." Both fall outside the definition under PROJECT.md as written. Both are excluded from the registry.

#### Charles Kushner

Confirmed by the Senate as Ambassador Extraordinary and Plenipotentiary to the French Republic and concurrently to the Principality of Monaco on May 19, 2025, by a vote of 51-45 (Senate Roll Call Vote 261, 119th Congress; nomination PN24-4, Senate Foreign Relations Committee). Sworn in July 11, 2025. Father of Jared Kushner, who is married to Ivanka Trump. Charles Kushner is therefore the parent of the President's son-in-law.

Walking the categories:

- Category 1 (President's children): does not apply.
- Category 2 (spouses of President's children): does not apply. Charles is not married to a President's child.
- Category 3 (President's siblings): does not apply.
- Category 4 (spouses of President's siblings): does not apply.
- Category 5 (relative of the President by blood, marriage, or adoption who holds a Senate-confirmed federal position): Charles holds a Senate-confirmed federal position. The question is whether he is a "relative of the President by blood, marriage, or adoption." His connection to the President runs through one marriage (his son's). PROJECT.md's exclusion list treats this connection as out of scope under the in-laws-of-in-laws bar. Borderline-cases-default-to-exclusion reinforces the call. Category 5 does not reach him.
- Category 6 (relative of a Senate-confirmed appointee who is in one of the relationships above to the President): Charles is himself the Senate-confirmed appointee, not a relative of one. Category 6 captures his relatives who independently fit categories 1-5. Jared Kushner is such a relative (Charles's son and a category 2 named family member), but Jared is already in the registry under category 2. Category 6 does not add Charles.

Charles Kushner is excluded from the registry. Connected entities he holds in his individual capacity (Kushner Companies interests, ambassadorial-period holdings) are not in scope on Charles's account. They may be in scope independently if a category 1-4 named family member, including Jared, holds a documented financial interest in the same entity.

#### Massad Boulos

Senior Advisor to the President on Arab and Middle Eastern Affairs (announced November 30, 2024) and concurrently Senior Advisor for Africa at the U.S. Department of State (announced April 1, 2025). Senior advisor positions of this kind are not Senate-confirmed. Father of Michael Boulos, who is married to Tiffany Trump. Massad Boulos is therefore the parent of the President's son-in-law, structurally identical to Charles Kushner.

Walking the categories:

- Categories 1-4: do not apply, same logic as the Kushner walk.
- Category 5: requires both that the person be a relative of the President and that the person hold a Senate-confirmed position. Massad fails on both prongs. The marriage chain bars him under the in-laws-of-in-laws rule. The senior advisor role is not Senate-confirmed. Either failure is sufficient.
- Category 6: same logic as the Kushner walk. Massad is not a Senate-confirmed appointee, so the rule about relatives of Senate-confirmed appointees is not the right test. Even if it were, Michael Boulos (Massad's son and a category 2 named family member as Tiffany's husband) is already covered under category 2 directly.

Massad Boulos is excluded from the registry. Connected entities he holds in his individual capacity (his Nigeria-based business interests, any post-appointment holdings) are not in scope on his account. Any tie that runs through Michael Boulos to a category 2 family member-held entity would be tracked via Michael, not via Massad.

#### Why the rule does work the registry needs

Both cases are the kind of high-profile, popularly-framed-as-family appointment the registry has to be defensible against. The popular sense of "Trump family" reaches further than PROJECT.md's exhaustive list. If the registry quietly broadened the definition to cover Charles Kushner because he is Senate-confirmed and well-known, the registry would be making a definitional choice on the fly under public pressure, which is the silent-edit failure mode the methodology principles exist to prevent.

The methodology disclosure is the answer. The exclusion is documented, dated, and sourced. Subsequent cases that fit the same pattern (in-laws of in-laws appointed to federal positions, Senate-confirmed or not) are excluded under the same rule and added to this section.

If the rule itself is later judged too narrow, that is a versioned definitional change with a dated changelog entry, not a quiet broadening of the definition. PROJECT.md states that defined terms are fixed and that changes are versioned and dated. This methodology section is the audit trail.

#### Sources

- Charles Kushner nomination: Congress.gov, "PN24-4 - Nomination of Charles Kushner for Department of State, 119th Congress (2025-2026)," `https://www.congress.gov/nomination/119th-congress/24/4`. Confirmed 51-45 on May 19, 2025; sworn in July 11, 2025.
- Massad Boulos senior advisor announcement: White House statement of November 30, 2024, archived at The American Presidency Project, `https://www.presidency.ucsb.edu/documents/statement-president-elect-donald-j-trump-announcing-the-appointment-massad-boulos-senior`.
- Massad Boulos Senior Advisor for Africa role: U.S. Department of State, Office of the Spokesperson, "Announcement of Massad Boulos as Senior Advisor for Africa," April 1, 2025, `https://www.state.gov/announcement-of-massad-boulos-as-senior-advisor-for-africa`.

## Comparative set selection

### Family unit

For the purpose of step 4 selection ("different filer, different family unit") and convention 2 testing, "family unit" means *distinct named family member* under the categories enumerated in PROJECT.md, not *household*.

Rationale: convention 3 (spousal asymmetry) exists specifically to handle 18 USC 208(a)(2) spousal imputation. The household reading collapses convention 3 before it can be tested by treating any married pair of named family members as a single test surface. Distinct-named-family-member preserves the registry's ability to model spousal pairs as separate filers whose interests link via imputation, which is the question convention 3 has to decide.

Locked: 2026-05-20. Subject to revision if a later filing surfaces a case the rationale doesn't cover.

## Registry scope

### Registry inclusion test (278-sourced entities)

Connected-entity registry inclusion for entities disclosed on OGE Form 278 filings is governed by procurement-relevance, not by the breadth of the underlying financial-interest definition. Every Schedule A entry is a financial interest by definition; not every financial interest is meaningful for procurement matching against USAspending, SAM.gov, GSA lease records, or GAO/IG sources.

**Default include:**

- Operating companies (any business with employees, contracts, or revenue)
- Commercial real estate holding entities, including single-property holders (federal lease counterparties can be single-property entities — the GSA Old Post Office lease counterparty is the textbook case)
- Holding companies that sit above multiple operating or commercial entities
- Fund managers and named investment vehicles where the family member has a direct stake in the manager or vehicle (not in pooled units)
- Named ventures, partnerships, joint ventures
- Hospitality, hotel, and service entities

**Default exclude:**

- Residential rental property holding LLCs (apartment buildings, single-family rentals) — these entities don't typically appear as federal procurement counterparties
- Personal-use property entities (vacation property, personal residences, family-use property holders)
- Pooled investment instruments (mutual fund units, ETF units, index fund units, money-market fund units) — the holding is an instrument, not a direct interest in the underlying entities
- Direct securities holdings in publicly-traded companies — evaluated case-by-case; default exclude for small passive holdings, default include for substantial holdings or any holding paired with a non-passive relationship element (board seat, employment, contract)
- Foreign-operating entities whose business activities are conducted entirely outside US jurisdiction — these cannot receive US federal civilian contracts and have no plausible match against USAspending, SAM.gov, or GSA lease records. Default exclude. Foreign-operating status is determined by the filing's description (e.g., "hotel manager, Bali, Indonesia"; "golf manager, Dubai, UAE"). A US-organized, US-jurisdiction entity that operates internationally is not foreign-operating for this purpose; nor is a US-organized holding company whose downstream holdings are foreign-operating.

Default exclusions are reversible. If an excluded entity subsequently appears in federal procurement data, it gets a registry entry retroactively with a methodology note explaining the reversal.

Excluded entities are recorded in the corresponding filing record under a sibling `_excluded_categories` field as grouped counts with rationale, not as individual entity entries. `_excluded_categories` is a key inside the filing record's `interest_disclosed` object, sibling to `_parse_provenance` — it is structured data within an existing free-form field and requires no schema change. Borderline cases default to inclusion with a flag for review.

(Foreign-operating exclusion added 2026-05-21, Fork D §4.0.B.)

This rule applies to all 278-sourced registry adds going forward. Records added before this rule was written (cp_filing_0001/0002 original capture, cp_filing_0003, cp_filing_0004) may not fully conform; reconciliation for cp_filing_0001/0002 happens through Fork D. cp_filing_0003 and cp_filing_0004 conformance is checked in their respective queued forks.

Locked: 2026-05-21.

### Part 8 (Liabilities) exclusion buckets

OGE Form 278e Part 8 carries regulatory exclusions at 5 CFR 2634.308(b)(2). Excluded liabilities are tracked in the filing record's `_excluded_categories.categories` array parallel to the Part 6 exclusion buckets that Fork D established. Each excluded row counts toward its bucket's `entries` or `approx_entries`; no `family_to_entity` edge is written for excluded liabilities.

Four bucket types apply to Part 8:

- **`personal_residence_mortgage`** — 5 CFR 2634.308(b)(2)(i). Mortgages on the filer's primary personal residence. Excluded from Part 8 disclosure by regulation, so excluded from registry edges as well. (Limitations apply for PAS filers; the regulatory cite is the same.)

- **`vehicle_loan`** — 5 CFR 2634.308(b)(2)(ii). Loans secured by a personal motor vehicle, household furniture, or appliances, unless the loan exceeds the item's purchase price. Excluded from Part 8 disclosure by regulation.

- **`credit_card_under_threshold`** — 5 CFR 2634.308(b)(2)(iii). Credit card and revolving charge account balances under $10,000 outstanding to a single creditor at the end of the reporting period. Excluded from Part 8 disclosure by regulation.

- **`family_loan`** — 5 CFR 2634.308(b)(2)(iv). Loans from a spouse, parent, sibling, or child of the filer. Excluded from Part 8 disclosure by regulation.

**Scope precision on `family_loan`:** The OGE exclusion is interpersonal only — a loan from a named-relative individual (a natural person) to the filer. A loan from a family-controlled entity (e.g., a Kushner family trust, Westminster Management, or any family-controlled LLC lending to Jared) does NOT fall under this bucket. Entity-to-filer debt relationships are written as normal `debt_instrument_owed` edges with the family-controlled entity registered as a `cp_entity_NNNN` record per Convention 5. The bucket exists to capture interpersonal lending only; entity intermediation breaks the exclusion regardless of who owns the lending entity.

If Part 8 surfaces a row where the counterparty is borderline (e.g., a trust that is family-controlled but whose precise legal structure is not clear from the form), surface for review rather than auto-bucketing.

Beyond the four regulatory buckets, Part 8 rows may surface where the counterparty is otherwise excluded under the §3.0 "Registry inclusion test (278-sourced entities)" — for example, a loan from an entity that fails the procurement-relevance test on its own merits. Those are a separate orthogonal screen; surface for review rather than silently bucketing under a regulatory-exclusion category that doesn't fit.

Locked: 2026-05-23.

### `direct_commodity_or_precious_metal_holdings` exclusion bucket

Direct holdings of commodities, precious metals, or physical assets that aren't entity ownership. Disclosed on filing per OGE reporting requirements but don't generate `family_to_entity` edges because no entity is referenced — the asset is the commodity itself, not equity in a producing or holding company. Examples: direct gold investment, physical silver bullion, oil futures held individually rather than via an investment vehicle.

If the disclosure is for a commodity-themed investment vehicle (commodity ETF, precious-metals mutual fund), use `pooled_investment_instruments` instead. This bucket is for direct physical or unit commodity holdings only.

First populated by Fork G (cp_filing_0003 Part 6 p020 "INVESTMENT IN GOLD" line, $100,001 - $250,000 bracket).

Locked: 2026-05-23.
