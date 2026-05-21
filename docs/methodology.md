# Connected Procurement: Methodology

This page documents the registry's load-bearing conventions and excluded scope decisions. Each entry names what the rule says, why it exists, and what it does not promise. Conventions are versioned; changes carry a dated changelog entry.

## Source authority

### `primary_source_url`

`primary_source_url` must point at either an OGE-hosted PDF or a mirror of an OGE-certified PDF. When a mirror is used, `_parse_provenance.primary_source_authority` must document the certification chain (electronic signatures, OGE Director countersignature) present in the PDF. The registry does not cryptographically verify these signatures; it captures the chain so an external auditor can.

Operative consequence: a mirror URL is acceptable only when the underlying PDF carries the OGE certification chain on its face. A mirror of an uncertified copy is not acceptable. The certification chain lives in the document, not in the URL.

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

### Convention 3: spousal imputation

Where 18 USC 208(a)(2) imputes a spousal interest to a filer, the imputed interest is recorded as a separate `Relationship` with `interest_type: spousal_imputed`, `shape: imputed`, and `imputation_source` pointing at the `Relationship` ID of the principal interest on the spouse's side. Imputed edges:

- Have their own `observed_on`, sourced to the imputing filer's filing.
- Do not restate the principal's value bracket. The bracket is recoverable by traversal through `imputation_source`. Restating would invite silent edits if the principal's bracket later updates.
- Have independent supersession chains. A later filing of the principal can update or drop the underlying interest without affecting the imputed edge's status, and vice versa. Supersession follows the chain of the filer who recorded the observation, not the chain of the principal.
- Are flagged for de-duplication where totals are constructed to count distinct underlying interests. The dedup key is `interest_type == spousal_imputed`; rows matching this key are excluded from totals that count distinct interests.

The schema does not collapse imputed and principal edges into a single multi-sourced edge. The observation layer preserves what each filing actually disclosed; the totals layer handles de-duplication via the `interest_type` filter.

**Forward-point case.** When an imputed edge's `observed_on` precedes the `observed_on` of its `imputation_source`, the imputation chain points forward in time. This reflects the sampling pattern of filings — when each filer happened to file relative to when the underlying interest was held — rather than a substantive inconsistency. The principal interest was held continuously across the gap; the registry simply lacks a contemporaneous principal observation. Imputed edges are not required to link to a principal whose `observed_on` is at or before the imputed `observed_on`; the chain links to the best-available principal observation regardless of temporal direction.

Locked: 2026-05-20.

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
