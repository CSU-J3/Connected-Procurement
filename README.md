# Connected Procurement Tracker

![status](https://img.shields.io/badge/status-pre--launch-orange) ![data collection](https://img.shields.io/badge/data%20collection-not%20yet%20active-lightgrey) ![scope](https://img.shields.io/badge/scope-federal%20civilian%20only-blue)

A research tracker monitoring federal civilian contract awards and GSA lease arrangements where the recipient entity has a documented financial interest held by a named family member of the current administration. The beat is mechanism-focused: where do existing federal procurement oversight mechanisms (FAR, agency IGs, GSA contracting review, GAO bid protests, OGE disclosures, the Procurement Integrity Act) catch or fail to catch this class of transaction.

This repo currently contains only the project scope and methodology. Data collection is not yet active. Companion project to [Follow-the-Moneys](https://github.com/CSU-J3/Follow-the-Moneys), which tracks Board of Peace post-conflict reconstruction flows on a different beat.

## Status

| Item                          | State                                  |
| ----------------------------- | -------------------------------------- |
| Scope statement               | Documented (this README)               |
| Defined terms                 | Documented (see below)                 |
| Primary source list           | Documented (see below)                 |
| Collector code                | Not built                              |
| Data file (`data.json`)       | Not present                            |
| Public dashboard              | Not deployed                           |
| Methodology page              | Not yet written                        |
| First record collected        | None                                   |

The repo exists at this stage to document the scope publicly before any data collection begins. The project instructions are versioned alongside the code so any future scope change is auditable.

## Core analytical question

Where do existing federal procurement oversight mechanisms catch or fail to catch contract awards and lease arrangements going to entities with named-family-member financial interests?

The relevant mechanisms include:

- The Federal Acquisition Regulation (FAR), particularly Parts 3 (Improper Business Practices), 9 (Contractor Qualifications), and 15 (Contracting by Negotiation)
- Agency Inspector General offices and their public audit and investigation reports
- GSA contracting officer review and the GSA Office of Inspector General
- GAO bid protest jurisdiction (4 CFR Part 21) and the Comptroller General's published decisions
- OGE financial disclosure requirements (Form 278 filings under 5 CFR Part 2634)
- The Procurement Integrity Act (41 USC 2101-2107)
- 18 USC 208 (acts affecting a personal financial interest) and the conflict-of-interest framework at 5 CFR Part 2640

The frame is descriptive, not prescriptive. The tracker documents how oversight engages, or doesn't, with a defined class of transaction. It does not allege intent.

## Defined terms

Both definitions are fixed. Changes are versioned with a dated changelog entry; silent edits are not permitted.

### Named family member

The list is exhaustive:

- The President's children (biological, adopted, and step-children)
- Spouses of the President's children
- The President's siblings (biological, adopted, and step-siblings)
- Spouses of the President's siblings
- Any relative of the President by blood, marriage, or adoption who currently holds or has held during this administration a Senate-confirmed federal position
- Any relative of a Senate-confirmed appointee by blood, marriage, or adoption who is in one of the relationships above to the President

The list does not include: friends, business associates without a family tie, in-laws of in-laws, romantic partners short of marriage, or extended family beyond the categories above. Borderline cases default to exclusion. Exclusion rationales are documented on the methodology page (forthcoming) so the rule is auditable.

### Financial interest

Per 5 CFR 2640.103(a) and 18 USC 208(a), a financial interest is one of the following:

- Ownership stake (any share, partnership interest, or membership interest)
- Employment by the entity (including consulting and contractor relationships)
- Debt instruments held by the named family member where the entity is the obligor
- Beneficial interest in a trust where the entity is among the trust's holdings
- Spousal interests imputed under 18 USC 208(a)(2)

If a relationship doesn't fit one of these five categories, it doesn't count for tracker purposes, regardless of how it appears in reporting.

### Connected entity

Any entity in which a named family member holds a financial interest as defined above, documented through OGE 278 filings, SEC filings, public corporate registrations, or court filings. News reporting alone does not establish a connection; news reporting is a pointer to a primary source that does.

## Primary sources

The tracker pulls from federal records on the cadence those records publish, not on a fixed clock. The cadence is honest about what each source actually provides:

| Source                          | Cadence            | What it covers                     |
| ------------------------------- | ------------------ | ---------------------------------- |
| USAspending.gov                 | Roughly biweekly   | All federal contract awards        |
| SAM.gov contract opportunities  | On posting         | Solicitations and awards           |
| GSA lease records (PBS)         | Irregular          | Federal real property leases       |
| OGE Form 278 filings            | Annual             | Public financial disclosure        |
| Agency IG public reports        | On publication     | Audits and investigations          |
| GAO bid protest decisions       | On publication     | Protest filings and decisions      |
| Federal court filings (PACER)   | On filing          | Procurement-related litigation     |

The tracker is automated retrieval and structured matching. It is not investigative reporting. Records are flagged for further inquiry, not adjudicated. Every record cites the underlying primary federal source.

## Evidence hierarchy

Strongest to weakest:

1. Primary federal records: USAspending entries, SAM postings, GSA lease records, OGE 278 filings, court filings, IG reports, GAO decisions, congressional testimony
2. Tracker data with traceable primary federal record
3. Reporting from outlets with demonstrated procurement-beat capacity (Reuters, AP, NYT, WaPo, ProPublica, Federal News Network, Government Executive)
4. Analysis from named experts at established institutions (CREW, POGO, academic ethics scholars, OGE alumni)
5. Opinion writing

Claims published in the connected research portfolio cite category 1 or 2 by default. Reliance on category 3 or below is rare and disclosed.

## Out of scope

Hard exclusions, named to prevent scope drift:

- Foreign sovereign or sovereign-adjacent money flowing to administration-connected businesses (separate companion project)
- Post-conflict reconstruction financial governance (the [Follow-the-Moneys](https://github.com/CSU-J3/Follow-the-Moneys) project covers this)
- State and local procurement (different oversight regime, different data sources)
- DoD direct contracts and subcontracts (different data infrastructure; potential future expansion, explicitly out for v1)
- Pure policy decisions that benefit industries without a traceable specific contract
- Anything pre-2025 except as historical comparison
- Allegations of intent, motive, or character
- The underlying political fights about the people involved
- Pre-2025 cases (Hunter Biden / Burisma, etc.) except as comparative methodology references

## Comparative case set

Historical cases the methodology references for procurement-mechanism comparisons (not moral equivalents):

- 2017-2020 Trump Organization period federal payments (CREW reporting, House Oversight Committee work)
- The DC and Maryland v. Trump emoluments litigation
- GSA Office of Inspector General report on the Old Post Office lease (2019)
- Connected-entity contracting cases in prior administrations (Halliburton/KBR, Bechtel) as procurement-mechanism precedents
- Academic ethics literature: Painter, Eisen, Canter on conflicts of interest in federal procurement

The same evidence rules apply to any case in the comparison set.

## Methodology disclosure principles

Borrowed from Follow-the-Moneys after its methodology hardening pass:

- Every record traces to a primary federal source. Records without a primary source are flagged and excluded from totals.
- Every excluded scope decision is documented on the methodology page with the rationale.
- Cadence is disclosed honestly. The tracker updates when sources update; it does not pretend otherwise.
- Defined terms are fixed. Changes are versioned and dated.
- Errors get corrected publicly with a changelog entry, not silent edits.

## Architecture (planned, not yet built)

Anticipated structure when development begins:

```
connected-procurement/
├── README.md                          # this file
├── PROJECT.md                         # full project instructions for Claude Projects
├── docs/
│   ├── index.html                     # public dashboard
│   ├── methodology.html               # methodology page
│   └── data.json                      # tracker output
├── data/
│   ├── records.json                   # canonical records
│   ├── candidates.json                # pending review
│   └── connected_entities.json        # entity registry with sourced ties
├── collectors/
│   ├── usaspending_collector.py
│   ├── sam_collector.py
│   ├── gsa_lease_collector.py
│   ├── oge_278_collector.py
│   ├── ig_report_collector.py
│   ├── gao_protest_collector.py
│   └── pacer_collector.py
└── .github/workflows/
    └── collect-and-deploy.yml
```

The collectors run on the cadence their sources support. There is no global "every 6 hours" cadence; that's a Follow-the-Moneys pattern that doesn't apply to federal record sources.

## License

Public accountability project. Use it, fork it, build on it.

— CJ / [das_DEMARC:/](https://dasdemarc.substack.com/)

## Related work

- [Follow-the-Moneys](https://github.com/CSU-J3/Follow-the-Moneys): post-conflict reconstruction financial governance, anchored by the Board of Peace
- Foreign sovereign money tracker: planned third companion project, scope statement not yet drafted
