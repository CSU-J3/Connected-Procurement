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

### `primary_source_url` when no public URL exists (Form-201 / nominee-report records)

`primary_source_url` records the publisher's current canonical URL for the document. Some authoritative OGE records have no such URL: a nominee 278e obtained via an OGE Form 201 request is released to the requester but is not posted to a stable public OGE path, and the nominee copy is subject to retention-destruction one year after the related action under 5 CFR 2634, so no durable public URL ever exists to point at.

For these records `primary_source_url` is null. The provenance that would otherwise live in the URL is carried by `interest_disclosed._parse_provenance`: the certification chain and the documented no-public-URL reason (retention-destruction window, absence from the OGE PAS Index) live in `primary_source_authority`; the retrieval archeology (Form 201 request, fulfillment date, local retention path) lives in `method`. The validator's required-`primary_source_url` rule is relaxed to permit a null URL only when `interest_disclosed._parse_provenance.primary_source_authority` is non-empty; a null URL without that documented authority remains a validation error. That the authority text actually documents the no-public-URL reason is maintainer discipline, not a machine check. The guarantee is unchanged (every record carries documented, auditable provenance); the provenance is simply no longer required to be a resolvable URL when no resolvable URL exists.

Display consequence: the surface renders a `source ↗` link only when `primary_source_url` is a resolvable http(s) URL. For null-URL records it renders the provenance as plain text from `primary_source_authority`, not as a link. This removes the prior failure mode where explanatory prose was stored in `primary_source_url` and rendered by the display as a relative link that did not resolve.

First applied 2026-06-15 to `cp_filing_0005` (Charles Kushner nominee 278e), whose Form 201 fulfillment copy has no stable public OGE URL.

Forward point: the same no-public-URL prose is currently duplicated in 124 records sourced to this filing, 123 entity-alias `source_url` fields and `cp_merge_0002.source_urls[0]`. These are not rendered by the display, so they carry no dead-link exposure under the http(s) guard, but they are the same modeling compromise. Their migration to this convention is deferred to a separate pass that resolves no-public-URL handling for `Alias.source_url` and `Merge.source_urls`, neither of which carries a `_parse_provenance` to hold the migrated reason.

Locked: 2026-06-15.

### source_url normalization

Alias `source_url` and `primary_source_url` fields reference publisher-canonical hosting URLs (e.g., `assets.documentcloud.org` for DocumentCloud-hosted records, `www.citizensforethics.org/wp-content/uploads/legacy/...` for CREW-hosted records, OGE PAS Index URLs for OGE-hosted 278 filings). Internal or temporary URLs (`s3.amazonaws.com/...`, `s3.documentcloud.org/...`, OGE Notes-DB `oge.gov/Web/oge.nsf/...`) get normalized to publisher-canonical at the next applicable fork.

Repo-relative paths (`assets/<filename>`, etc.) are not used; the registry references external authoritative sources directly so the certification-chain attribution stays anchored to the publisher's infrastructure rather than to a repo copy that lacks the signed-certification context.

HTTP-verify the proposed canonical URL before write. If the verify fails, surface and pause rather than fall back to the internal/temporary URL — a failed verify means either the publisher has migrated infrastructure again (research needed) or the document is no longer hosted by that publisher (different publisher-canonical needed).

For records where the modern canonical is uncertain without out-of-band research (e.g., OGE WHCO memos hosted under legacy Notes-DB paths whose modern OGE Resources page navigation hasn't been done), keep the existing URL and add an annotation in the record's `notes` flagging the deferral. Don't write a guess. Queue the normalization for a future fork with bandwidth for the publisher-site navigation.

First applied at Fork M (2026-05-26). First batch normalization at Fork M: 135 records (131 cp_entity records + 3 alias-array entries on cp_entity_0007 / cp_person_0001 / cp_person_0002 + cp_filing_0001 `primary_source_url`), normalizing the Fork B bulk-write footprint from `s3.amazonaws.com/storage.citizensforethics.org/...` to the CREW canonical at `www.citizensforethics.org/wp-content/uploads/legacy/...`, and the two DocumentCloud references from `s3.documentcloud.org/...` to `assets.documentcloud.org/...`. cp_person_0001's WHCO memo URL deferred per the OGE-canonical-uncertain clause above; queued for the live-collection phase's OGE intake work.

Locked: 2026-05-26 (Fork M).

### Alias `source_filing_date`: aliases wait for a filing source

The `Alias` model requires a `source_filing_date`. That requirement encodes a provenance rule: registry aliases come from filings (or dated source documents), and the date is the as-of date of the document that prints the name variant. When a name variant is known only from a non-filing source (a third-party officeholder bio, an aggregator, an encyclopedia) and no filing carrying that variant is in hand, the alias is deferred, not written with a borrowed or invented date.

Back-filling `source_filing_date` with an unrelated date (e.g., a confirmation date) asserts a filing provenance that does not exist: a future session reading the field would reasonably infer that a filing of that date carries the name, which would be false. This mirrors the locked source_url "don't write a guess" discipline above. Defer the alias until a filing sources it, then write it with the filing as the real source and the filing's real date. Same information, correct provenance.

First applied 2026-05-29 (Live-Collection Session 3). Charles Kushner's legal/birth first name "Chanan" is documented in a LegiStorm officeholder bio but in no filing in hand. The alias was deferred rather than written with the 2025-05-19 confirmation date as a stand-in `source_filing_date`; cp_person_0005 registers canonical-name-only. His nominee OGE 278 (surfaced as a pending candidate by the Session 3 Step 3 OGE run) is the expected filing source: if it prints "Chanan" as his legal first name, the alias is written then with the 278 as its source.

Locked: 2026-05-29.

### Inline n/k/a (now known as) disclosure pattern

When an OGE 278 row, footnote, or Exhibit A "Has ownership interest in:" cell discloses an entity under its prior name with an inline "(n/k/a CURRENT NAME)" notation, the registry encodes one `cp_entity` record using the current name as canonical, with the prior name in the `aliases` array carrying per-alias `source_url` and a `notes` field quoting the inline n/k/a notation verbatim. No `entity_to_entity_successor` edge — the rename is captured in the alias structure, not as a relationship between entities.

Pattern observed:

- Fork K (2026-05-25): cp_entity_0224 DT Venture I LLC and cp_entity_0225 DTW Venture LLC (Schedule A items 125/126 with inline "N/K/A" prefix on the form). Schema gap on `entity_to_entity_successor` analog noted but deferred per "one case isn't enough".
- Fork L (2026-05-26): Trump Briarcliff Manor Development LLC (Exhibit A item 22 standalone + item 24's "Has ownership interest in:" line with parenthetical "(N/K/A TRUMP BRIARCLIFF MANOR DEVELOPMENT LLC)"). Same disposition; alias array carries prior name "Briar Hall Development LLC". Second case promoted the pattern from ad-hoc handling to methodology entry status.

Forward point: if a future case surfaces both the prior-name and current-name entities as separately-numbered standing entities on the same filing (i.e., the form discloses them as distinct registrations rather than via inline n/k/a, suggesting succession rather than rename), the registry would need an `entity_to_entity_successor` analog to capture the relationship structurally. Defer until that case appears. The two cases under this entry are both inline n/k/a renames; neither requires structured succession encoding.

**Extension — prior-name has existing cp_entity record (supersede-and-keep encoding).** Where an inline n/k/a disposition references a prior name that already has a registered `cp_entity` record from earlier project work (typically because the prior-name and current-name entities were registered as separate records by different forks before the rename was surfaced), supersede-and-keep encoding applies:

1. Re-point all edges referencing the prior-name entity to the current-name entity (update `source_id` / `target_id` on every existing relationship pointing at the prior cp_entity_NNNN).
2. Add the prior name to the current-name entity's `aliases` array with per-alias `source_url` and a notes field quoting the inline n/k/a notation verbatim.
3. Set `merged_into` on the prior-name entity record pointing at the current-name entity (uses the existing schema field; same mechanism as a proper entity merge).
4. Create a `Merge` record (`cp_merge_NNNN`) documenting the merge with `loser_id` = prior-name entity, `winner_id` = current-name entity, `rationale` quoting the inline n/k/a notation, `source_urls` referencing the filings disclosing both names, `merged_on` = the fork's commit date, `merged_by` = the fork name.
5. Keep the prior-name entity record in the registry — do not delete. Active-record count for that entity drops by 1, but the record persists for audit trail. Validate against the `merged_into` chain to skip the record when iterating active entities.

The encoding has two schema anchors that apply jointly:

- **`merged_into` on the cp_entity record** (loser-side per-record supersession pointer; per step 3 above). Captures the rename at the record level so any code iterating cp_entity records can resolve a stale ID forward to the current canonical entity.
- **`cp_merge_NNNN` record in `data/merges/`** (per step 4 above). Captures the merge event itself with rationale, source URLs, merge date, and acting fork — the audit-trail anchor that explains why the merge happened, not just that it did.

Both fields are required when applying the encoding. The cp_entity-level `merged_into` is the structural fast-path for record-resolution; the cp_merge record is the audit-trail anchor. Skipping either leaves an unresolvable gap (a stale cp_entity reference without `merged_into` is unresolvable in code; a merge without a cp_merge record is unauditable in review).

First case: cp_entity_0327 (Kushner Village 2 Member LLC) merged into cp_entity_0326 (K MARYLAND ASSOCIATES, LLC) per Fork B Retrofit Part B (c). The rename was surfaced via Jared's 2018/2019 filings' inline n/k/a note ("This entity was previously named Kushner Village 2 Member LLC") that wasn't visible on Ivanka's 2017 NE filing where the two were originally registered as separate items. Merge record cp_merge_0001 anchors the event; cp_entity_0327's `merged_into` points at cp_entity_0326.

Forward point: methodology generalization candidate when a second prior-name-has-existing-record case forces it. Filing-specific to cp_filing_0001 / cp_filing_0002 until then.

Locked: 2026-05-26 (Fork L initial entry). Extension added 2026-05-26 (Fork B Retrofit).

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
- **Nominee report**: filer-signature date (extension dated 2026-06-01; rationale below).

The new-entrant rule was tested on the Ivanka Trump 2017 new-entrant 278 (`cp_filing_0004`): date of appointment 03/29/2017 sets `observed_on` on the filing's derived relationships, while the form's value brackets are end-of-reporting-period figures (the reporting period runs into late May 2017; filer signature 06/12/2017 under a 45-day extension). Picking filer-signature date would have placed the analytical anchor after the events the filing exists to document (the 03/09/2017 trust restructuring, the 03/29/2017 appointment); appointment date is the only candidate that aligns analytically.

Locked: 2026-05-20.

**Extension (2026-06-01): nominee report → `observed_on` = filer-signature date.** A nominee report has no reporting-period or appointment anchor; the form's Date of Appointment is blank because appointment has not occurred. The filer-signature date is the only point at which the document certifies the disclosed holdings were accurate, so it serves as the as-of date.

`observed_on` is the point-in-time the disclosure describes (when the holdings were true), not a procedural milestone in the filer's appointment. That rules out the confirmation date and the swearing-in date: those are events in the filer's timeline, not statements about when the financial snapshot was accurate. The nominee snapshot can become actively false after the filing (e.g., after the 90-day divestiture window the disclosed portfolio has been sold), so `observed_on` cannot be a later milestone on which the data the field stamps was already wrong. Annual reports anchor to the prior year-end and termination reports to the termination date by convention; a nominee report has neither, leaving the signature date as the sole certified as-of point.

Implication, not a conflict: a later incumbent annual 278 from the same filer carries its own (prior-year-end) `observed_on`. The two filings will show different as-of dates for overlapping entities, correctly — the nominee report is the pre-divestiture snapshot, the annual is post-divestiture. Different `observed_on` is how the registry distinguishes the two points in time; it is not a supersession or a conflict.

Determined 2026-06-01 against the Charles Kushner nominee 278 (`cp_filing_0005`, `observed_on` 2025-01-25), confirming the provisional Fork 1 value as ruled.

Locked: 2026-06-01.

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

**Applied 2026-06-05 (Fork S) — Charles Kushner nominee 278 (`cp_filing_0005`) Part 5.** This is an application of the convention, not a change to it. The Part 5 spouse disclosure was modeled as: (1) the unnamed non-filer spouse `cp_person_0006` (per the unnamed-person sub-rule below); (2) **no person-to-person `spousal` edge** — for a non-filer spouse the relationship is carried entirely by the imputation chain, following the `cp_filing_0003` Trump→Melania precedent; the lone `spousal` person-to-person edge in the registry (`cp_rel_0002`, Jared↔Ivanka) is the both-filers case and is not the template here; (3) 55 spouse `family_to_entity` / `ownership` edges for the in-scope Part 5 holdings; (4) 55 filer `spousal_imputed` edges with `shape: imputed` and `imputation_source` pointing at the matching spouse edge. This closed the `convention_3_spousal` open question on `cp_filing_0005`. The decision to omit the p2p edge for non-filer spouses keeps the Melania application (which also has none) consistent; if a future fork wants a uniform p2p spousal edge across both filer and non-filer cases, that is a versioned change with a backfill of the Melania pair, not a silent addition here.

**Forward-point case.** When an imputed edge's `observed_on` precedes the `observed_on` of its `imputation_source`, the imputation chain points forward in time. This reflects the sampling pattern of filings — when each filer happened to file relative to when the underlying interest was held — rather than a substantive inconsistency. The principal interest was held continuously across the gap; the registry simply lacks a contemporaneous principal observation. Imputed edges are not required to link to a principal whose `observed_on` is at or before the imputed `observed_on`; the chain links to the best-available principal observation regardless of temporal direction.

**One-direction application for non-filer family members.** Convention 3 imputation is triggered by the form's disclosure of a spouse's interest, not by the existence of a reciprocal filing. When the spouse is a non-filer (no `cp_filing_NNNN` exists for them as filer), Convention 3 runs in one direction only: the principal filer's spousal_imputed edges land per the form's disclosure (sourced from the spouse's family_to_entity edges, which themselves live inside the principal filer's filing via Part 5 spouse-side disclosure). No reverse-direction imputation from the principal filer's interests to the non-filer spouse, because no form-disclosed observation point exists to anchor reverse imputation. Pattern observed: Trump→Melania on cp_filing_0003 Part 5 (Fork J). Distinct from the bidirectional Jared↔Ivanka case where both are filers and imputation runs both ways via their respective filings (Fork B precedent). Forward point: if downstream analytics require structured tracking of bidirectional-vs-one-direction imputation pairs, design a separate field on the relationship model. One use case isn't enough; defer until a second one-direction pair forces structural change.

Locked: 2026-05-25.

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

### Amendment (2026-05-29): Charles Kushner, Category 5 supersedes the 2026-05-20 exclusion

This entry supersedes, in part, the 2026-05-20 "In-laws of in-laws" determination above, on a new material fact the original category walk did not weigh. It is recorded as a dated, versioned amendment, not a silent edit, per the methodology-disclosure principle that changes to a determination are versioned and dated. The 2026-05-20 determination stays in place above as the record of the prior reasoning; this amendment governs from its date forward.

**What the 2026-05-20 determination held.** Charles Kushner was excluded. The reasoning: his connection to the President runs through one marriage (his son Jared's), so the in-laws-of-in-laws bar applies; Category 5 "does not reach him"; and borderline-cases-default-to-exclusion reinforces the call. That walk treated the in-laws-of-in-laws exclusion as the only operative rule and did not treat his own Senate confirmation as the deciding fact.

**The new material fact.** Charles Kushner was confirmed by the Senate as Ambassador Extraordinary and Plenipotentiary to the French Republic and concurrently to the Principality of Monaco on May 19, 2025, by a vote of 51-45 (nomination PN24-4, 119th Congress). The ambassadorship is a Senate-confirmed (PAS) position. PAS positions carry an independent public financial-disclosure obligation under the Ethics in Government Act (OGE Form 278), separate from any family tie; a confirmed PAS officeholder is a 278 filer in his own right. The confirmation was reported to have been delayed pending processing of his financial-disclosure report, which corroborates that a 278 exists; the obligation itself follows from the PAS position, not from the reporting. This is the fact the 2026-05-20 walk did not weigh: on that date his confirmation was not the operative fact, and the in-laws-of-in-laws bar was the only applicable rule.

**The collision, and its resolution.** The README named-family list pulls in two directions for Charles. Category 5 admits "any relative of the President by blood, marriage, or adoption who currently holds or has held during this administration a Senate-confirmed federal position." The exclusion line states the list "does not include ... in-laws of in-laws." Charles is an in-law of an in-law (father of the President's son-in-law) and now holds a Senate-confirmed position, so the exclusion line points to exclude while Category 5 points to include. The amendment resolves the collision as follows, and this reading is the governing interpretation for future cases:

> The in-laws-of-in-laws exclusion governs persons whose only connection to the administration is the affinity chain itself. Category 5 is an additive qualifier: it admits a person who independently holds (or has held, during this administration) a Senate-confirmed federal position, where that person is a relative of the President by blood, marriage, or adoption. Affinity through a child's marriage is a relationship "by marriage" in the ordinary sense; co-fathers-in-law are related by marriage. Charles Kushner was correctly excluded on 2026-05-20, when the in-laws-of-in-laws bar was the only applicable rule and his own confirmation was not the operative fact. His Senate confirmation as Ambassador (2025-05-19, PN24-4) makes Category 5 applicable; Category 5's holds-a-confirmed-position trigger is the deciding clause and overrides the general affinity-distance exclusion for this person.

**Scope of the amendment.** This is a narrow interpretive rule, not a broadening of the definition. It states one thing: Category 5 is additive and overrides the affinity-distance exclusion when its own trigger (the person independently holds or has held a Senate-confirmed position during this administration) is met. It applies that rule to one person, Charles Kushner. Borderline-cases-default-to-exclusion is untouched for everyone Category 5 does not independently reach. The defined-terms text in README and PROJECT.md is not changed; this amendment interprets the existing Category 5 against the existing exclusion line, it does not rewrite either.

**Massad Boulos, reaffirmed under the corrected logic.** Boulos stays excluded, and the corrected reading makes his exclusion rest on a single coherent ground rather than two. Boulos holds no Senate-confirmed position: Senior Advisor to the President, and the concurrent State Department Senior Advisor for Africa role, is not a PAS position. Because Category 5's trigger requires a Senate-confirmed position and Boulos holds none, Category 5 never becomes applicable to him; the additive qualifier does not fire. With Category 5 out, the in-laws-of-in-laws bar is the only applicable rule, and it excludes him. The role's lack of Senate confirmation is therefore not a second, independent ground; it is the reason Category 5 does not reach him in the first place. The prior "two independent grounds" framing (above, and in the 2026-05-28 watchlist seed note) is superseded by this single-ground reading.

**Consequence.** Charles Kushner is registered as a named family member under Category 5, as amended, and enters the watchlist as the first poll-direct member on the strength of his independent 278 obligation (see this session's registration records). The 2026-05-28 "Live collection / Watchlist" entry below states that Charles Kushner "stay[s] excluded ... that determination is not reopened here"; that reflected the posture as of 2026-05-28, and this amendment reopens and supersedes it as of 2026-05-29. The earlier dated entry is left as written, per the no-silent-edit rule; the later dated entry governs.

Sources: Charles Kushner nomination and confirmation, Congress.gov, "PN24-4 - Nomination of Charles Kushner for Department of State, 119th Congress (2025-2026)," `https://www.congress.gov/nomination/119th-congress/24/4` (confirmed 51-45 on May 19, 2025; sworn in July 11, 2025).

Locked: 2026-05-29.

### Non-filer named family member registration

Named family members under PROJECT.md scope receive `cp_person_NNNN` registration regardless of filer status. The record shape is identical for filer and non-filer cases — the `Person` model in the schema doesn't require a `cp_filing_NNNN` linkage on the person record itself. The distinction lives implicitly in whether a `cp_filing_NNNN` exists with the person as `filer_id`; persons without an entry in `filings.json` filer_id are non-filers.

Provenance for a non-filer registration attaches via:

- `filing_source` on the person's `family_to_entity` edges (sourced to the principal filer's filing where the spouse-side disclosure appears — typically the OGE 278 Part 5 spouse schedule).
- `imputation_source` pointers on `spousal_imputed` edges originating from the principal filer's filing. The Convention 3 chain links the principal filer's imputed edge to the non-filer spouse's family edge; the chain itself is the audit trail for the non-filer's existence in the registry.

The non-filer status is queryable from existing data without a structured flag: cross-reference `data/persons/*.json` against `filings.json` filer_id values; persons without a filing as filer are non-filers.

First applied in Fork J (2026-05-25) on cp_person_0004 Melania Trump, sourced from cp_filing_0003 Part 5. Trump (cp_person_0003) is the principal filer; Melania's 6 family_to_entity edges all carry `filing_source: cp_filing_0003`; Trump's 6 spousal_imputed edges chain via `imputation_source` to the Melania family edges.

### Unnamed non-filer person registration

An unnamed-but-real person who is disclosed only by relationship — never named on the filing — is registered with a **relationship-descriptor `canonical_name`** and an **empty `aliases` array**. The `Person` model requires a non-empty `canonical_name`, so the descriptor (e.g., `"Spouse of Charles Kushner (cp_person_0005)"`) is the canonical value; it is a documented placeholder, not a borrowed or inferred name. No alias is written until a filing supplies an actual name, at which point the alias is added with that filing as its source and the filing's real date, per the locked Alias `source_filing_date` rule. Borrowing a name from a non-filing source (a press report, an aggregator) is forbidden — the same discipline as the deferred-alias rule.

This sits alongside the non-filer registration convention above: a person can be both a non-filer and unnamed. Provenance still attaches through the principal filer's filing — `filing_source` on the unnamed person's `family_to_entity` edges and `imputation_source` on the principal's `spousal_imputed` edges (Convention 3).

First applied 2026-06-05 (Fork S) on cp_person_0006, the spouse of Charles Kushner. The OGE Form 278e nominee report (`cp_filing_0005`) discloses the spouse's holdings under Part 5 ("Spouse's Employment Assets & Income") but prints no spouse name anywhere on the form. Distinct from the Melania case (Fork J), where the non-filer spouse was named; this rule covers the unnamed sub-case the Melania precedent did not reach.

Locked: 2026-06-05.

Forward point: if structured tracking of filer vs non-filer status becomes operationally useful (e.g., for procurement-beat queries that distinguish first-party from imputed-only disclosures, or for audits of which family members lack direct filing observation), design a separate `is_filer` or `non_filer_person` boolean on the cp_person model rather than overloading any existing field. One use case isn't enough; defer until a second non-filer family member surfaces.

Locked: 2026-05-25.

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

### Roadmap-stage row counts as estimates

Row counts surfaced during the eight-step methodology roadmap or similar pre-inspection planning stages are estimates, not authoritative figures. Inspection forks may revise the count upward when deeper form-reading surfaces previously-uncounted rows. The Fork G discovery of 22 Over-$50M rows on cp_filing_0003 (versus the roadmap's 5) illustrates the pattern. Roadmap status should be updated to "partial close — remaining rows in subsequent fork's scope" rather than treating the original count as a complete inventory. The methodological purpose of the roadmap item (e.g., exercising the `floor` value shape) is satisfied by writing any non-trivial subset of the surfaced rows; the remaining rows defer to the next fork that owns the broader scope.

Locked: 2026-05-23.

### OGE 278 Exhibit A *(N) annotation handling (cp_filing_0003 pattern)

Some OGE 278e filings include a standalone Exhibit A schedule that follows the Part 2 Schedule A entries and discloses ownership structure for entities on Part 2 plus additional entities that are not on Part 2. The additional (non-Part-2) entities carry a numerical or text label *(N) indicating the form's stated reason for non-disclosure on Part 2. The cp_filing_0003 (Trump 2021 termination 278) Exhibit A schedule defines the *(N) categories on its first page (PDF p.38, Exhibit A p.A1 of 42), quoted verbatim:

> Part 2 disclosed entities with assets over $1,000 or which produced income of over $200. This Schedule (EXHIBIT A) discloses the ownership structure of the entities on Part 2, as well as additional entities that are not disclosed on Part 2. For each of the entities below that are not disclosed on Part 2, the numerical or text label indicates which reason for non-disclosure applies.
> The numerical labels are as follows: *(1) have no independent value or income and are part of the entity structures listed in Part 2; (2) have no independent value or income and provide back office support functions to other entities; (3) are dormant/inactive; (4) have no independent value or income and exist to hold license deals that are prospective, inactive, or otherwise do not currently have valuable assets or create income; or (5) have no independent value or income, not inactive nor dormant, not part of an entity structure or license deal. This Schedule is being provided to ensure a complete picture of the assets and holdings of the filer. Gaps in numerical sequence are due to the removal of previously reported items no longer reportable on this exhibit. All of the interests listed below in this exhibit, which were formerly held by Donald J. Trump, directly or indirectly, are now held by The Donald J. Trump Revocable Trust.

The shared structural fact across *(1)-*(5): all such entities have no independent value or income. The categories differ in the *reason* for non-disclosure (part of structure / back-office / dormant / license-holder / orphan-extant).

Per-category registry handling:

- **\*(1) — part of entity structures listed in Part 2.** Register as `cp_entity_NNNN` per the locked "Internally-disclosed intermediate entities" convention. Write `entity_to_entity_subsidiary` edges from each immediately-disclosed parent (per the Exhibit A "Owned by:" cell) to the *(1) entity, and from the *(1) entity to each disclosed child (per the Exhibit A "Has ownership interest in:" cell). Do not write a `family_to_entity` edge at the *(1) level — the filer's interest reaches *(1) via the upstream subsidiary chain. The MEMBER CORP / MANAGING MEMBER pass-thru pattern (Fork I-b precedent, generalized in the trust-intermediate convention's multi-parent / pass-thru bullet) is the dominant *(1) shape; treat each pass-thru's subsidiary edge as one of the standard outbound edges, not a special-case addition.

- **\*(2) — back office support functions.** Register as `cp_entity_NNNN` per the §3.0 registry-inclusion test. Back-office *(2) entities are operating companies (payroll, property management, holding-license back-office) and meet the operating-company default-include rule despite carrying "no independent value or income" — value-absence on the filer's row is not the same as procurement-irrelevance. Write upstream subsidiary edges from each disclosed parent. Outbound subsidiary edges are written only if the *(2) entity discloses ownership of operating children (most *(2) back-office entities do not).

- **\*(3) — dormant/inactive.** Do not register. Increment the `dormant_or_inactive_entities` bucket in the filing's `_excluded_categories.categories` array. Dormant entities have no procurement-beat relevance — they cannot receive federal contracts because they do not operate. The exclusion is reversible per the locked §3.0 reversibility note: if a dormant *(3) entity reactivates and surfaces in federal procurement data, the registry adds a retroactive entry with a methodology note.

- **\*(4) — license deals (prospective/inactive).** Do not register. Increment the `inactive_license_holder_entities` bucket. Inactive license-holder shells exist to hold the contractual position for deals that have not gone live or have been suspended; they are not in federal procurement counterparty matching space. Reversible per §3.0 if a license deal activates.

- **\*(5) — not inactive, not part of structure, not license deal.** Surface for per-row review. The *(5) category is the form's residual — neither operating-structure nor dormant nor license-holder nor back-office. Some *(5) entries may be operating entities the form chose not to disclose on Part 2 for value-bracket reasons (value bracket fell below disclosure threshold, e.g., "None (or less than $1,001)"); register these per the §3.0 default-include for operating companies. Other *(5) entries may be the form's residual orphan-extant entities with no procurement-beat relevance; bucket those into `orphan_extant_low_relevance`. The category's name reflects the form's residual framing; the surface-and-pause discipline applies to ambiguous *(5) rows.

All *(N) annotation bucketing on cp_filing_0003 traces back to the filing's own verbatim *(N) annotation key quoted above. Bucket counts are aggregate, not itemized; individual *(3)/*(4)/excluded-*(5) entities are not registered.

Per the closing sentence of cp_filing_0003's *(N) annotation key — "All of the interests listed below in this exhibit, which were formerly held by Donald J. Trump, directly or indirectly, are now held by The Donald J. Trump Revocable Trust" — every *(N) entity in Exhibit A traces ultimately to cp_entity_0003 (DJT Revocable Trust). This blanket attribution means *(1)/*(2) registrations on cp_filing_0003 chain upstream into the existing DJT Revocable Trust structure rather than into other formally-named trusts (the Fred C. Trump December 16, 1976 Trust sits separately in Part 6, not in Exhibit A).

Unannotated Exhibit A entries on cp_filing_0003 are entities already disclosed on Part 2 (per the *(N) key's framing that *(N) labels indicate non-Part-2 disclosure); all such entries are registered via the Part 2 inspection forks (Fork B / Fork G / Fork H / Fork I-a) and require no additional registration via Exhibit A inspection. Per Fork L §4.7 disposition A: all 80 surveyed unannotated entries were already registered (one initially flagged "Country Properties, LLC)" net-new was a `pdftotext` column-bleed artifact, not a real net-new entity).

Forward point: this entry is filing-specific to cp_filing_0003 as written. If a second OGE 278 filing surfaces a similar Exhibit A *(N)-style annotation system (cp_filing_0001/0002/0004 currently do not), generalize then. Per the locked "filing-specific until a second filing forces generalization" discipline.

Locked: 2026-05-26 (Fork L).

### Trust-intermediate convention

When a 278 filing discloses holdings via one or more trust intermediates — whether the trust is legally named (e.g., DJT Revocable Trust) or anonymized by the form using a disclosure label (e.g., "Trust #1") — the registry encodes the disclosure structure rather than collapsing it into direct `family_to_entity` edges.

Apply when: the form's Schedule A, Part 6, or analogous structure groups holdings under a trust header, OR when the filer's interest in an entity is disclosed as held through a named trust.

Encoding:

1. Register the trust as a `cp_entity_NNNN` record. Name: the trust's legal name if disclosed (e.g., "Donald J. Trump Revocable Trust"), or the form's disclosure label anchored to the filing (e.g., "Trust #1 (Ivanka 2017 disclosure)") if anonymized.
2. Write a `family_to_entity` edge from the filer's `cp_person_NNNN` to the trust with `interest_type: trust_beneficial`. Value bracket per the trust-level disclosure if the form reports one; `binary + unit: none` with form text in notes if the trust value is reported as not readily ascertainable or not disclosed at the trust-header level.
3. Write `entity_to_entity_subsidiary` edges from the trust to each in-scope holding within it. Holdings are registered as their own `cp_entity_NNNN` records, with value brackets per the holding-level disclosure on the form.
4. Do **not** write direct `family_to_entity` edges from the filer to holdings within the trust. The chain `filer → trust → holding` is structurally complete via the family edge at the trust level plus the subsidiary chain.
5. The exception is `spousal_imputed` edges. Convention 3 imputation reaches the holdings themselves, not the trust, because 18 USC 208(a)(2) imputes the underlying interest. Write spousal-imputed edges to the holdings directly when Convention 3 applies, with notes capturing the trust intermediate ("Held via Trust #N").
6. Reuse: if a registered trust already exists, write additional subsidiary edges from it for newly-surfaced holdings; do not create a duplicate trust record. The cp_filing_0003 Donald J. Trump Revocable Trust (cp_entity_0003) is the canonical example.
7. **Nesting clarification:** a filing's structural grouping of holdings under a trust header is not, by itself, evidence of a parent-trust nesting relationship between named trusts and labeled-trust headers in the same filing. Multi-level encoding requires positive endnote or Schedule A disclosure (e.g., "Trust #N is held by [Named Trust]" or equivalent reverse-direction language). Without positive disclosure, parallel-trust encoding is the default — each trust header registers as its own entity and stands as a parallel disclosure, not as a nested sub-trust under any other named trust in the filing. The cp_filing_0004 Trust #1–#7 anonymized labels are the canonical example: form structure groups holdings under each Trust #N header, but the endnotes (pp.66-94) contain no parent-trust language, so each is encoded as a parallel independent disclosure.
8. **Ownership-percentage disclosures within trust-intermediate chains.** When a 278 Exhibit A or analogous ownership-structure schedule discloses partial ownership percentages on chain-position entities (e.g., a trust holds 25% of an intermediate holdco, which in turn holds 1.84% of an operating LP), the chain edges encode as `binary + unit: none` with the percentage captured verbatim in the edge's `notes` field. The `value` field carries the binary disclosure-presence flag; the structural percentage is the property of the chain position, not the value bracket. Non-filer co-owners (e.g., "75% Trump Family Members") are captured as contextual prose in notes; no registry edges for non-filer ownership shares. Forward point: if a future use case requires ownership percentages to be queryable as structured data (e.g., aggregating beneficial-interest exposure across chained positions), design a separate `ownership_percentage` field on the relationship model rather than overloading `value`. One project-level use case isn't enough; defer until a second use case or a procurement-beat analytical need surfaces. Canonical example: cp_filing_0003 Schedule A items 122/123 + Exhibit A Ref# 018/141/154/446 (Trump-side Starrett City / Spring Creek Plaza chain via 4 trust-side intermediate holdcos) registered in Fork K.
9. **Multi-parent, pass-thru, and multi-level chain coverage.** An internally-disclosed intermediate may have multiple immediately-disclosed parents (e.g., 0.1% one entity + 99.9% another entity, the canonical Trump-org structure for operating LLCs paired with a 0.1% MEMBER CORP managing member). Write one `entity_to_entity_subsidiary` edge per registered disclosed parent. Where a disclosed parent is itself an intermediate not yet registered (e.g., another *(1) entity in the same Exhibit A), register the parent as well and chain the edges (depth-2 or deeper). Where the intermediate carries the MEMBER CORP / MANAGING MEMBER pass-thru pattern (the *(1) bucket on cp_filing_0003 Exhibit A is dominated by this — 228 MEMBER CORP / MANAGING MEMBER mentions across the schedule), the outbound subsidiary edge from the MEMBER CORP to the paired operating LLC is one of the standard outbound edges, written via the same `entity_to_entity_subsidiary` mechanism. The pass-thru pattern does not require separate methodology treatment beyond what is already locked here. Trust attribution stays anchored at the upstream chain end (the canonical trust per the filing's framing) with immediate-parent variation captured at the subsidiary-edge endpoints rather than via redundant trust→entity duplicates; the audit trail runs filer → trust → intermediate(s) → operating entity, reconstructable from the edges. Edge-count budget: an internally-disclosed intermediate carrying multi-parent and pass-thru patterns may produce 2-4 edges per registration (1-2 upstream + 1-2 downstream) rather than the single-edge norm assumed for direct family→entity disclosures. This is the expected operational shape; not a methodology-amendment trigger. Canonical example: cp_filing_0003 Exhibit A *(1) and *(2) intermediates registered in Fork L (109+9 net-new entities producing ~230-350 chain edges across multi-parent / pass-thru / multi-level coverage).

Forward point: the convention assumes one level of trust intermediation. If a filing surfaces multi-level trust chains (Trust A holds Trust B holds operating entity) *with positive endnote or Schedule A disclosure of the nesting*, surface as a §3 question; the encoding for nested trusts gets designed when the case appears.

Surface-and-pause is mandatory if a handoff specifies direct `family_to_entity` edges to holdings under a trust — the existing convention takes precedence over the handoff's literal wording.

Originally locked for cp_filing_0003 only on 2026-05-23 (Fork B/G context). Generalized to filing-agnostic 2026-05-24 (Fork I-b context, motivated by Ivanka's 7 anonymized "Trust #N" disclosures on cp_filing_0004). Nesting-clarification bullet added 2026-05-25 (Fork I-c context, after endnote inspection on pp.66-94 produced zero descriptions of Trust #1–#7 and the §4.1 ruling defaulted to parallel-trust encoding). Ownership-percentage encoding bullet added 2026-05-25 (Fork K context, after the §1.1 Ref# chain resolution surfaced the partial-ownership disclosure pattern on cp_filing_0003 Exhibit A *(1) intermediates). Multi-parent / pass-thru / multi-level bullet added 2026-05-26 (Fork L context, after the §1.5 surface revealed 228 MEMBER CORP / MANAGING MEMBER pass-thru pairs across cp_filing_0003 Exhibit A *(1) entries and the §4.2 ruling formalized the existing implicit accommodation).

Locked: 2026-05-26.

### Internally-disclosed intermediate entities

A 278 filing's Schedule A organization chart commonly references intermediate holding entities (e.g., DJT Holdings LLC, Seven Springs LLC) that sit between the filer and a registered operating entity but are not themselves financial-interest line items. These entities are *internally disclosed* — their existence is established by the filing's own structure — but they do not generate a `family_to_entity` edge because no direct family-member interest is asserted at the intermediate level.

Registration policy for internally-disclosed intermediates:

1. Register the entity as `cp_entity_NNNN` when it appears as a parent in a subsidiary chain leading to a registered operating entity. Source the entity name and any aliases from the filing itself; `primary_source_url` matches the filing's URL with `_parse_provenance.primary_source_authority` noting "internal disclosure via Schedule A organization chart, no direct interest line."
2. Write the `entity_to_entity_subsidiary` edge connecting the intermediate to its operating child(ren) with `observed_on` matching the filing's signature date.
3. Do **not** write a `family_to_entity` edge at the intermediate level. The chain `filer → intermediate → operating` is *implicit* via the subsidiary edge plus whatever family-to-intermediate-parent edge exists upstream; writing a direct edge would assert a financial interest the filing does not disclose.
4. The intermediate sits in the same "registered but not connected" intermediate state as Fork D's subsidiary entities — entity record exists, no family edge — but the reason is different (internal-disclosure-only vs. value-defer). Surface the distinction in the close commit message of any fork creating these.

Forward point: if a later filing discloses a direct interest in a previously-internal intermediate (a new `family_to_entity` edge at the intermediate level), supersession applies — the prior internal-only registration stands and the new direct edge attaches with its own `observed_on` and value bracket.

Forward bundle from Fork H §4 (DJT Holdings LLC / Seven Springs pattern). Lands before Fork I-a Part 2 Exhibit A inspection so the rule is in force on first encounter.

Locked: 2026-05-24.

### Income disclosure encoding

A Schedule A row on a 278 typically discloses both an ownership/interest value bracket and one or more income components (royalties, management fees, dividends, rent, etc.) for the same entity. The registry encodes these asymmetrically:

1. The relationship's `value` field carries the ownership/interest disclosure only — the bracket or exact figure reported in the asset-value column of Schedule A.
2. Income components are captured in the relationship's `notes` field as prose, with the income type and the disclosed amount (bracket or exact) recorded verbatim from the form. Multiple income components on one row are captured as a single notes entry, not as separate edges.
3. No `interest_type` value for income streams. The five-category `interest_type` enum models the *position* the filer holds in the entity (`ownership`, `employment`, `debt_instrument_held`, `debt_instrument_owed`, `trust_beneficial`, `spousal_imputed`), not the income flowing from that position. Income is a property of the position, captured in notes.

Pattern established by Fork G (cp_rel_0349, cp_rel_0351 — Trump-side Over-$50M edges with golf-resort-revenue and rent-income components captured in notes) and applied by Fork I-a end-to-end across 84 Part 2 Exhibit A edges, including the multi-component case at item 071 (Trump International Hotel Hawaii LLC: royalties + management fees captured in a single edge's notes).

Forward point: if a future use case requires income to be queryable as structured data (e.g., procurement-beat analysis correlating income type with contract awards), design a separate `income_disclosure` field on the relationship model rather than overloading `interest_type` or `value`. One use case isn't enough; defer until a second case surfaces.

Forward bundle from Fork I-a close (commit 243b449). Lands before Fork I-b cp_filing_0004 Part 6 inspection so the rule is in force on Ivanka-side income components.

The `interest_type` enum is itself extended as new fiduciary structures appear. The Fork I-b extension added `trust_trustee` for fiduciary-role-without-beneficial-interest disclosures; that entry follows below.

Locked: 2026-05-24.

### `trust_trustee` interest type

The `trust_trustee` value on the `InterestType` enum captures filer-as-trustee fiduciary roles. The filer holds fiduciary control over the trust without beneficial interest in it. Structurally distinct from `trust_beneficial`: the trustee has authority over trust assets but is not entitled to the trust's economic benefits.

Procurement-beat relevance: the control-without-ownership pattern can still create conflict-of-interest exposure under 18 USC 208 even though no direct financial interest is asserted. Trustees with discretionary authority over trust investments and divestments can direct assets toward or away from federal counterparties; the role is reportable on the 278 even where no beneficial interest is held.

Encoding: standard `family_to_entity` edge with `interest_type: trust_trustee`. Value field carries the trust's disclosed value bracket per the form (the trust's value is reportable even though the filer doesn't beneficially hold it). When the form discloses no trust-level value, use `binary + unit: none` with form text in notes. The `qualifying_role` field captures the trustee tenure (start_date, optional end_date) — particularly important on new-entrant filings where a trustee role may have ended before the appointment date (the disclosure exists due to in-period income, but the role isn't current at `observed_on`).

First applied in Fork I-b on cp_filing_0004 Part 2 item 12 (Ivanka as former Trustee of GCM Trust; role ended 12/2016, $50,000 trustee fees disclosed for the reporting period; `qualifying_role.end_date = "2016-12-31"` captures the temporal precision).

Multi-role forward point: a structured "filer is both trustee and beneficiary" encoding is a methodology amendment candidate when a second case surfaces. The first known case (Ivanka Trump Revocable Trust on cp_filing_0004, where Ivanka is both grantor/beneficiary and trustee) uses `trust_beneficial` as the primary `interest_type` with the trustee role captured in notes; until a second case appears, this notes-based encoding is the convention.

Locked: 2026-05-24.

### `license_counterparty` interest type

The `license_counterparty` value on the `InterestType` enum captures contractual licensing positions where the filer (or filer's family member via Convention 3) generates royalty or licensing-fee income from a counterparty entity, without holding ownership, employment, debt, or trust position in that entity. Structurally distinct from the other enum values:

- Not `ownership`: no equity stake in the counterparty.
- Not `employment`: no employer-employee relationship.
- Not `debt_instrument_held`/`debt_instrument_owed`: no creditor-debtor relationship.
- Not `trust_beneficial`/`trust_trustee`: no trust position.
- Not `spousal_imputed`: the disclosure originates as the filer's (or family member's) own direct contractual position, not as an imputation from another principal.

Procurement-beat relevance: the counterparty to a family member's licensing income stream may be a federal contractor whose relationship to the family creates conflict-of-interest exposure under 18 USC 208 even though no direct financial interest is held in the counterparty.

Encoding: standard `family_to_entity` edge with `interest_type: license_counterparty`. Value field per the form's disclosure on the counterparty entity (often "value not readily ascertainable" → `binary + unit: none` per the locked NRA convention). Royalty income disclosed on the form is captured in the edge's `notes` field verbatim per the locked income-disclosure encoding pattern; no separate edge or structured income field.

First applied in Fork J on cp_filing_0003 Part 5 item 6 (Melania Trump's photographic-image licensing royalty stream from Getty Images Inc., $2,501-$5,000 Royalties for the reporting period). The Trump→Getty Images spousal_imputed edge under Convention 3 carries `interest_type: spousal_imputed` per the locked spousal-imputation pattern; only the principal (Melania) edge carries `interest_type: license_counterparty`.

Forward point: if a second counterparty pattern surfaces that's structurally distinct from licensing (e.g., service contracts, supply contracts), consider broadening to a `contractual_counterparty` super-type rather than proliferating narrow enum values. One license case isn't enough to design the broader hierarchy; defer until a second case forces the question.

Locked: 2026-05-25.

## Federal-procurement nexus

### Nexus standard and the temporal-overlap requirement

A federal-procurement nexus is recorded in the `nexus_links` table (`cp_nexus_NNNN`) when a registry entity is matched to a specific federal instrument (a GSA lease or a federal contract award). Two gates govern whether a corroborated nexus **counts in the live total** (flips the holder's `excluded_from_total` to false):

1. **Identity corroboration** — exact name plus a second signal: a UEI for awards, a property-address match for leases. Name-alone never promotes (lessor/recipient names collide; IOLP/award strings are noisy). The GSA IOLP leased-property dataset carries the *building* asset name, not the lessor LLC, and registry entities have no structured address — so the GSA name channel is structurally near-null and a no-match there is the expected default, never a negative finding.
2. **Temporal overlap** — the instrument's active period (lease term / award period of performance) must overlap the **holder's disclosed holding period** from the filing. The project's claim is that a family member held the entity *while* it was connected to federal procurement, not that they own something that was *once* federally connected. Identity without temporal overlap is documented, not counted.

A corroborated nexus that fails gate 2 is written as a `nexus_link` (it is a true historical fact) with the holder edge **left soft-flagged** — documented-but-not-counted. Counting it would assert a connection the sourced evidence does not establish.

### OGE-278 temporal coverage boundary (known limitation)

OGE Form 278 sourcing only covers a person's federal-official tenure: a person has no 278 filing obligation before taking office, so the evidence model **structurally cannot source a holding that predates their entry into government.** Where federal-procurement activity and a family member's holding overlapped *before* that person became an official, the OGE-only model cannot see the overlap. This is a coverage boundary, not an absence of nexus — it is not counted and it is not inferred.

Flagship case: `cp_nexus_0001`, 666 Fifth Associates LLC (cp_entity_0048, 666 Fifth Avenue). Identity is airtight (exact recipient name + UEI HKPSSRAH39H9 + 666 Fifth Ave address); the GSA/PBS lease IDV GS02B22660 was active 2004→Jan 2013; the only sourced holding is Jared Kushner's, disclosed as-of 2017-12-31 (his 2018 Annual, cp_filing_0001). The likely 2007–2013 overlap (Kushner Companies' 2007 acquisition) is reachable only through outside knowledge, unsourceable within OGE data. Ruled (2026-06-13): documented as historical fact, not counted; `cp_rel_0041` stays `excluded_from_total: true`.

Forward point: resolving a temporally-disjoint-but-likely-overlapping case would require a non-OGE evidence tier (corporate registration / property records) to source the pre-office holding period. That is a scope decision reserved for separate consideration; until it is taken, do not silently assume the overlap. Builds on the two-axis scope test (named member + instrument/agency); temporal overlap is a third, independent gate.

Locked: 2026-06-13.

## Process

### Locked methodology authority over handoff text

When a handoff document conflicts with a locked methodology entry, locked schema enum, or established Fork precedent, the locked source takes precedence. Handoff text that conflicts must be surfaced as a §3 blocker rather than applied silently. The maintainer issues an amendment correcting the handoff; writes proceed only after the amendment lands.

Pattern observed across Forks I-a and I-b: four handoff drifts caught and surfaced (the `primary_source_url` host attribution, the trust-intermediate edge shape under cp_filing_0003, the `observed_on` date for new-entrant filings, and the `trust_beneficial` vs `beneficial_trust_interest` naming). Zero registry corruption resulted; the surface-and-pause discipline plus this rule did the load-bearing work.

Forward point: maintainers drafting handoffs reconstruct from chat summaries and prior handoffs; locked methodology is the authoritative source and the only reliable target for "what's actually in force." Handoff drafts that need to apply a locked rule should quote the locked text rather than paraphrase. Code's role is to verify against locked methodology before any write; surfacing a §3 blocker is the correct response to any conflict.

Locked: 2026-05-24.

### Steady-state surface-and-pause expectation

The locked-methodology-authority process note from the Fork I-b close codified surface-and-pause as exception-handling for handoff drift cases. Fork J was the first fork since the I-a series to clear pre-write inspection without an amendment cycle, demonstrating the intended steady-state: handoffs anchored verbatim to locked methodology produce no drift, and Code's pre-write read finds nothing to surface.

Surface-and-pause remains mandatory when:
- A handoff specifies edge structure that conflicts with locked convention (cp_filing_0003 trust-intermediate convention takes precedence over literal handoff wording per Fork H §0.5)
- New interest_type, relation_kind, or value_shape categories appear in the source filing without a locked enum mapping
- Filing-internal annotations or conventions appear that the methodology page hasn't yet addressed (e.g., the *(N) annotation system on cp_filing_0003 Exhibit A; resolved in Fork L)

Surface-and-pause is exception-handling, not routine procedure. A clean pre-write read is the expected outcome on a well-formed handoff.

Locked: 2026-05-26.

## Live collection

### Live-record handling of `excluded_from_total`

`excluded_from_total` is a per-relationship boolean (default `false`), coupled by the validator with `exclusion_reason`: a `true` flag requires a non-empty reason, and a `false` flag forbids one. The comparative-set edges all carry `excluded_from_total: true` with `exclusion_reason: "pre-2025; comparative case set per PROJECT.md scope"`, which keeps the hand-populated pre-2025 records out of headline totals.

Live-collection records (post-2025 filings ingested under the live phase) omit both fields. The flag defaults to `false`, no `exclusion_reason` is written, and the edge counts toward headline totals automatically. This is a usage convention only: no field is added to the model and no validator rule changes, because the field and its coupling already exist (confirmed in the Session 1 planning artifact).

The boundary is the pre-2025 / post-2025 line. Comparative-set edges (pre-2025, all sourced to cp_filing_0001 through cp_filing_0004) stay excluded; live edges (post-2025, ingested once detection surfaces a filing) count. The totals logic reads the flag, so the audit trail for what counts is the flag value plus this dated boundary. Comparative records are not retro-touched; the convention governs records written from the live phase forward.

Locked: 2026-05-28 (Live-Collection Session 2). Staged in the Session 1 planning artifact (docs/handoffs/2026-05-28-session-01.md, schema delta 1).

### Watchlist

The watchlist is the registry's detection-scope list: the named family members monitored under live-collection, recorded as a validated `data/watchlist/` table (one `cp_watch_NNNN` JSON record per member, the same per-record pattern as the other tables). It is registry state, validated like every other table, so detection-critical scope is auditable rather than living in an unvalidated config file.

**Inclusion rule (Decision 2, option A).** Watchlist membership is the README named-family-member definition (exhaustive, authoritative) intersected with an active independent OGE 278 obligation. It is not "everyone plausibly connected." The four comparative anchors are the seed members: Jared C. Kushner (cp_person_0001, Category 2), Ivanka M. Trump (cp_person_0002, Category 1), Donald J. Trump (cp_person_0003, carried as filer-of-record for the comparative set, not as a named family member per his record), and Melania Trump (cp_person_0004). Massad Boulos and Charles Kushner stay excluded per the dated in-laws-of-in-laws determination in the "Named family member" section above; that determination is not reopened here. [Forward-pointer added 2026-05-29: the Charles Kushner exclusion was reopened and superseded by the 2026-05-29 Category 5 amendment in the "Named family member" section above, on the new material fact of his Senate confirmation as Ambassador (PN24-4). He is now a registered named family member and the first poll-direct watchlist member. Massad Boulos's exclusion is unchanged. This sentence is left as written per the no-silent-edit rule; the forward-pointer records the supersession.]

**Poll-mode rule (Decision 3).** Each member carries a `poll_mode`: `poll_direct` when the member holds an independent OGE 278 filing obligation (a separate filer in their own right), and `impute_via_part5` otherwise, where the member's holdings surface through an obligated filer's Part 5 disclosure under Convention 3. The validator couples `poll_mode` with `active_278_obligation`: `active_278_obligation: true` if and only if `poll_mode: poll_direct`.

No current watchlist member meets the poll-direct test. The four anchors are pre-2025 comparative filers, not current-administration obligated filers, so all four carry `active_278_obligation: false`, `poll_mode: impute_via_part5`, and `status: historical_anchor`. The first poll-direct target enters through event-driven watchlist expansion when a named family member becomes independently obligated, established by a sourced appointment or nomination, not by assertion.

**Record shape.** `watchlist_id` (cp_watch_NNNN), `person_id` (validated to resolve to a persons record), `inclusion_basis` (a citation string anchored to the README category or, where no clean category applies, to the locked basis), `active_278_obligation`, `poll_mode`, `status` (`historical_anchor`, `active`, or `removed`), optional `position`, `source_urls` (required non-empty for `active` members, optional for historical anchors whose provenance is already in the comparative set), `added_on`, optional `removed_on` and `removal_reason` (required together when `status: removed`), and optional `notes`.

**Melania's inclusion basis.** Melania's `inclusion_basis` cites her locked registration rather than a category number: the exhaustive named-family list has no "spouse of the President" category, and her membership rests on the locked non-filer named-family registration (Fork J). That tension between the registered membership and the list as written is logged as a future versioned definitional question (add a spouse-of-the-President category, or document the First Lady as a registered exception with rationale) and is not resolved here.

Locked: 2026-05-28 (Live-Collection Session 2). Staged in the Session 1 planning artifact (schema delta 3).
