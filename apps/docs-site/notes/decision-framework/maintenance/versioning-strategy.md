# Maintenance and Versioning Strategy

Status: PROVISIONAL v0 (guidance-derived, 2026-08-28); refine at its phase gate.

Source authority: [MASTER.md](../MASTER.md) section 15 (REQ-MAINT-01), REQ-DATA-07,
REQ-REPORT-06, REQ-ORCH-09; transcript [6] ("Date and version the research", deliverable 19)
and [14] ("Research should be resumable", "Maintain project state") of the source
conversation.
Related artifacts (may not exist yet; link, do not restate):
[schema-proposal.md](../model/schema-proposal.md) (owns the concrete field shapes these
surfaces land in), [decision-engine.md](../model/decision-engine.md) (consumes staleness and
availability), [families.md](../model/families.md) (the taxonomy a new family enters),
[report-design.md](../ux/report-design.md) (renders the user-facing dating and reassess flow),
[market-gaps.md](../positioning/market-gaps.md) (gap records reviewed on the same cadence),
[solutions/TEMPLATE.md](../research/solutions/TEMPLATE.md) (the record shape a new
implementation instantiates).

Design stance: the system is refreshed by editing data, never by redesigning the system
(REQ-MAINT-01). Every mechanism below exists to keep three properties true under change:
recommendations stay explainable backward through the evidence chain (REQ-ORCH-08), old
reports stay honest (REQ-REPORT-06), and any single record can be refreshed without a full
re-research pass (REQ-DATA-07).

---

## 1. Versioning surfaces

Five surfaces, each answering a different question. Stable identifiers:

| Id | Surface | Question it answers |
|----|---------|---------------------|
| `version.schema` | Schema version | "What shape is the data?" SemVer over the canonical entity/field shapes defined in [schema-proposal.md](../model/schema-proposal.md). |
| `version.model` | Decision-model version | "How does the framework reason?" SemVer over dimensions, families, questions, implications, and decision rules (REQ-ENGINE-01). |
| `version.research` | Research snapshot version | "What did the ecosystem look like when the facts were gathered?" Calendar-anchored: `YYYY.MM` plus an integer revision, e.g. `2026.08.0`, `2026.08.3`. |
| `record.dates` | Per-record dating | "When was this specific record last true?" Each implementation, family, evidence, and gap record carries `record.researchedAt`, `record.verifiedAt`, `record.lastReviewed`, and `record.statusAtResearch` (REQ-DATA-07, REQ-AVAIL-01). |
| `source.dates` | Per-source review dates | "When was this source consulted, and for what?" Each evidence reference carries `source.retrievedAt` and `source.reviewedAt` (REQ-MATRIX-05, REQ-DATA-05). |

### 1.1 How they relate

The surfaces are ordered by blast radius, not by hierarchy:

- `version.schema` change can force a `version.model` and `version.research` migration.
- `version.model` change never forces a schema change, and never rewrites facts; it changes
  how existing facts are interpreted.
- `version.research` change never forces a model change: adding, retiring, or re-verifying
  implementations is pure data motion (REQ-Q-09, REQ-ENGINE-02: no vendor branching to edit).
- `record.dates` and `source.dates` move constantly and bump only the `version.research`
  revision when they change a published fact.

Reports pin the pair (`version.model`, `version.research`) at generation time
(REQ-REPORT-05); that pair is the unit of comparability for REQ-REPORT-06.

### 1.2 Semver-ish bump rules with examples

`version.schema` (SemVer):

- MAJOR: a shape change that breaks existing data or exported decision JSON (field removed,
  meaning changed, entity split). Ships with a migration (section 2.7).
- MINOR: additive field or entity; old data remains valid with the field absent/`Unknown`.
- PATCH: description or documentation-only change to the schema itself.

`version.model` (SemVer):

- MAJOR: a change that can flip a recommendation for unchanged answers: a family split or
  redefinition, a rule's semantics changed, a hard-constraint mapping altered (REQ-Q-02).
  Requires a full scenario-fixture run (REQ-TEST-01) before release.
- MINOR: additive reasoning that only refines: new question, new follow-up edge, new derived
  implication, new family added without disturbing existing ones, attribute decomposed into
  two finer attributes (REQ-MATRIX-03 refinement).
- PATCH: wording, explanations, question phrasing; identifiers untouched (REQ-DATA-06).

`version.research` (`YYYY.MM.rev`):

- `YYYY.MM` advances only when the corpus-level review claim advances (section 4.1).
- `rev` increments on any published fact change: a record refreshed, an implementation added,
  a status flipped, evidence superseded.

Worked examples of what bumps what:

| Event | schema | model | research |
|-------|--------|-------|----------|
| qiankun release changes one matrix cell from No to Conditional | no | no | rev bump; record `verifiedAt` updated |
| New implementation discovered and catalogued | no | no | rev bump |
| Project archived on GitHub | no | no | rev bump (availability status only) |
| Attribute "style isolation" decomposed into scoped-CSS vs document-boundary attributes | no | MINOR | rev bump after the column re-verify (section 2.4 analogue) |
| New architectural family recognized | no | MINOR (MAJOR if an existing family is redefined) | rev bump |
| Evidence field gains an optional `supersededAt` | MINOR | no | no |
| Answer enum changes meaning | MAJOR | MAJOR | migration + full re-verify of affected cells |
| Quarterly review completes with only date confirmations | no | no | rev bump (dates are data) |
| Annual full pass completes | no | usually no | `YYYY.MM` advances |

---

## 2. Refresh playbook per change type

Each play states: trigger, data touched, versions bumped, downstream obligations. All plays
share one invariant: prior values are superseded, never erased, so the evidence chain behind
any historical report remains reconstructible (REQ-ORCH-08).

### 2.1 `refresh.implementation.new` (newly discovered implementation)

- Instantiate [solutions/TEMPLATE.md](../research/solutions/TEMPLATE.md); classify
  product/framework/library/platform-capability/strategy per REQ-SCOPE-04; apply the
  inclusion bar of REQ-SCOPE-03.
- Map to one or more families honestly (REQ-FAM-03); fill its matrix row with the standard
  value vocabulary (REQ-MATRIX-02) and evidence rules (REQ-MATRIX-05); set availability
  (REQ-AVAIL-01) and edition structure if commercial (REQ-ENT-02).
- Bumps: research rev. No model or engine edit is permitted; if the implementation cannot be
  expressed without new rules, that is a taxonomy finding, escalate to 2.4 (REQ-KEYTEST-01).

### 2.2 `refresh.implementation.abandoned` (abandoned project)

- Never delete the record. Flip availability to `deprecated` or `inactive` (REQ-AVAIL-01)
  with dated evidence (last release, archive notice, maintainer statement).
- Keep the record in the landscape: it may still materially illustrate a category
  (REQ-SCOPE-03) and it remains referenced by historical reports and gap records.
- Engine consequence is automatic: excluded from "best available today", retained for
  explanation (REQ-AVAIL-02). Bumps: research rev.

### 2.3 `refresh.capability.changed` (capability change in an implementation)

- Update the affected fact values only. Append new evidence with `source.retrievedAt`; mark
  displaced evidence superseded rather than deleting it (REQ-DATA-05).
- Re-derive only the downstream chain of the changed facts: implications, then any rules that
  cite them (REQ-ORCH-08 layering makes the affected set enumerable).
- Re-run scenario fixtures whose expected outcomes mention the implementation (REQ-TEST-01).
- Bumps: research rev; `record.verifiedAt` on the touched record.

### 2.4 `refresh.family.new` (new architectural family; rare, schema-stable)

- Families are first-class data (REQ-FAM-02), so the schema does not change; this is the
  design reason the event is survivable.
- Author the family with the full REQ-FAM-02 field set; audit every existing implementation's
  family mapping for re-homing (REQ-FAM-04: no artificial differentiation); re-check
  dominance relationships (REQ-Q-08) and which questions now discriminate between families
  (REQ-Q-01).
- Full scenario-fixture run before release; a family addition that flips fixture outcomes is
  a MAJOR model change by rule 1.2.
- Bumps: model MINOR (MAJOR if an existing family was split/redefined); research rev.

### 2.5 `refresh.evidence.changed` (changed evidence)

- Trigger: a source is retracted, contradicted, moved, or a stronger source appears.
- Re-triangulate the affected claims per REQ-MATRIX-05, preserving the guarantee-class label
  (framework guarantee vs browser guarantee vs convention vs inference).
- If a fact value flips, continue as 2.3. If only confidence changes, update the fact's
  confidence and `record.verifiedAt`. Either way the old evidence stays, marked superseded,
  with the reason recorded.
- Bumps: research rev.

### 2.6 `refresh.report.historical` (historical recommendation preservation)

- Old reports are immutable: never regenerate or silently mutate one because the dataset
  moved (REQ-REPORT-06, transcript [11] "Versioned assessments").
- Each research snapshot that produced published reports is retained as an addressable
  archive (the pinned pair from 1.1 must remain resolvable to the data that produced the
  report, or at minimum to its recorded reasoning trace per REQ-REPORT-02).
- Reassessment is a deliberate user action producing a NEW report that records both the old
  and new version pairs; the flow is specified in section 4.2 and rendered per
  [report-design.md](../ux/report-design.md).

### 2.7 `refresh.schema.migration` (schema evolution)

- Prefer additive evolution (MINOR); absent fields read as `Unknown`, which the value
  vocabulary already supports (REQ-MATRIX-02) and the engine already tolerates (REQ-ORCH-10).
- A MAJOR schema change ships with: a migration transform for the repository data, a
  migration or explicit refusal path for user-exported decision JSON (REQ-REPORT-05 makes
  those files re-importable, so each export records its `version.schema`), and a note in the
  schema changelog stating what old data cannot express.
- Never migrate by hand-editing records in place without the transform; the transform is the
  auditable artifact (REQ-OPS-01 spirit).

---

## 3. Independent record refresh (REQ-DATA-07)

The unit of refresh is a record, not the corpus. This is a load-bearing consequence of three
existing design commitments: facts carry individual provenance (REQ-DATA-05), identifiers are
stable so references never dangle (REQ-DATA-06), and reasoning is layered so the downstream
impact of one record is enumerable (REQ-ORCH-08).

### 3.1 Procedure (one record, one sitting)

1. Open the record; read its resumability block (section 5): sources, dates, claim support,
   open uncertainties.
2. Re-consult each recorded source; note moved/dead sources as evidence changes (2.5).
3. Re-verify each claim the record makes; confirm, amend, or mark `Unknown` with reason.
4. Update `record.verifiedAt` (and `record.lastReviewed` even when nothing changed: a
   confirmation is information).
5. If any fact changed, follow 2.3's downstream re-derivation; bump research rev.

No other record is touched. A refresh session needs the record and this document, not the
history of the original research pass.

### 3.2 Staleness indicators

Staleness is derived from dates, never hand-set. Decay rate depends on the guarantee class of
the underlying evidence (REQ-MATRIX-05's ladder), because claims rot at different speeds:

| Id | Decay class | Rationale | Indicative half-life |
|----|-------------|-----------|----------------------|
| `decay.platform` | Browser/spec guarantees | Standards move slowly and compatibly | years |
| `decay.framework` | Framework guarantees, documented capabilities | Move with major releases | ~12 months |
| `decay.convention` | Common patterns, community conventions | Drift with ecosystem fashion | ~6 months |
| `decay.status` | Project status, activity, availability | The fastest-moving facts in the corpus | ~3 months |

Derived record states: `staleness.fresh`, `staleness.aging`, `staleness.stale`,
`staleness.expired`, computed from `record.verifiedAt` age against the record's dominant
decay class. Thresholds are provisional and belong in the schema as data, not in code.

Engine and UI consequences: `stale` lowers displayed confidence (REQ-REPORT-04 statuses,
REQ-AVAIL-03 maturity/confidence axis); `expired` facts are treated as reduced-confidence,
never as `Unknown` erasure, and flag the record into the next review queue (section 6).
Staleness must never silently flip a value: only re-verification changes facts.

---

## 4. User-facing dating and deliberate reassessment

### 4.1 "Last reviewed" (transcript [6])

- Corpus level: the landscape UI carries "Last reviewed: <Month Year>" derived from
  `version.research`'s `YYYY.MM`. That date advances only when a full pass (or a defined
  coverage threshold of record refreshes) completes; partial refreshes must not inflate the
  corpus claim. Never imply the comparison is permanently current.
- Record level: individual implementation/family pages may show their own
  `record.lastReviewed`, which can be newer or older than the corpus date. Honest divergence
  is the point (REQ-TRUST-01 spirit: credibility is the product).

### 4.2 Reassess-deliberately flow (REQ-REPORT-06)

1. A returning user's saved assessment carries its pinned (`version.model`,
   `version.research`) pair (browser-local per REQ-LOCAL-01).
2. The system compares against current versions and, when newer, surfaces: "This assessment
   was generated using the <snapshot> research snapshot. Newer research is available."
3. The old report remains rendered exactly as generated (2.6). No auto-refresh, no silent
   re-scoring.
4. The user may deliberately reassess: answers are replayed against the current model, any
   questions added since (model MINOR) are asked, and a new report is generated recording
   both version pairs. An optional diff ("what changed and why") is a report-design concern,
   linked not specified here ([report-design.md](../ux/report-design.md)).

---

## 5. The research-resumability contract (REQ-ORCH-09)

Every research unit (a solution record, a strategy record, a matrix column verification, a
sweep) records six things, stored with the record itself so a refresh session can start cold:

| Id | Recorded | Content |
|----|----------|---------|
| `resume.researched` | What was researched | The record ids and attribute ids covered by the session. |
| `resume.sources` | Sources consulted | Each source: locator, title, source type on the REQ-MATRIX-05 ladder. |
| `resume.dates` | When | `source.retrievedAt` / `source.reviewedAt` per source; session date. |
| `resume.claims` | Claim support | Which claims each source supports (the fact ↔ evidence references of REQ-DATA-05). |
| `resume.uncertainties` | What remains uncertain | Explicit `Unknown` and `Conditional` values with the reason they could not be resolved. |
| `resume.followups` | What needs further work | Concrete next investigations, sized so a later 5-10 minute thread can pick one up (REQ-OPS-02). |

This is the same information the evidence rules already demand; the contract adds only that
it is co-located and dated so that section 3.1 step 1 works. Corpus-level continuation state
(current phase, open questions) stays in [BACKLOG.md](../BACKLOG.md) per REQ-ORCH-05; the
per-record contract deliberately does not duplicate it (REQ-OPS-03).

---

## 6. Cadence recommendation (reasoning, not mandate)

The cadence follows the decay table in 3.2: cheap checks often for fast-decaying facts,
expensive re-derivation rarely for slow-decaying structure.

- `cadence.quarterly-light`: a status-and-availability sweep. Re-verify `decay.status` fields
  across all active implementations (releases, archive notices, maintenance signals), triage
  accumulated change reports into playbook plays, refresh any record flagged
  `staleness.stale`. Cheap precisely because of section 3: each item is an independent record
  refresh. Output: research rev bumps and an updated review queue.
- `cadence.annual-full`: the full pass. Re-triangulate load-bearing facts
  (`decay.framework`), stress-test the taxonomy against scenario fixtures (REQ-TEST-01,
  REQ-ORCH-11), re-check dominance relationships (REQ-Q-08), review gap records against the
  new landscape ([market-gaps.md](../positioning/market-gaps.md)), then advance the corpus
  `YYYY.MM` and the user-facing "Last reviewed" claim (4.1).
- `cadence.event-driven`: out-of-cycle interrupts that should not wait: a major release of a
  tracked implementation, a deprecation/archive notice, a browser platform change touching
  isolation primitives, a significant new entrant. Handle as the matching section 2 play.

Why this shape and not another: quarterly matches the observed half-life of availability
facts (the claims most likely to embarrass the framework if wrong); annual matches the rate
at which frameworks make guarantee-level changes; anything more frequent buys little because
slow-decay facts dominate the corpus, and anything less frequent lets the "Last reviewed"
claim drift into dishonesty, which violates the neutrality-through-credibility posture
(REQ-TRUST-01). Teams operating this later should re-derive the cadence from their own
observed change rates; the decay classes are the durable part, the intervals are estimates.

---

## 7. Projection drift guard

The published dataset at `apps/docs-site/src/data/decision-framework.ts` is a hand-derived
projection of these notes, not a generated artifact
(completeness audit, known gap 3). Nothing structurally prevents
it from disagreeing with the model, so the disagreement is made detectable instead:
[../matrix/check-projection.mjs](../matrix/check-projection.mjs) reads both sides and
reports where they diverge. Plain `node`, no dependencies, no build step:

```
node apps/docs-site/notes/decision-framework/matrix/check-projection.mjs
```

or `npm run check:decision-framework` from `apps/docs-site`.

Exit 0 means no drift, 1 means drift, 2 means the guard could not run (a model file moved,
or the projection literal stopped being readable as data). The output has three parts:
DRIFT (blocking), REVIEW (supported but only weakly or partially), and UNCHECKED (the
claims the guard deliberately refuses to pass silently).

**When to run it.** After any edit to the projection; after any play in section 2 that
touches an id, a rank, an availability state, or an elimination set (2.1, 2.2, 2.3, 2.4 in
particular); before advancing a `version.research` rev that publishes changed facts; and as
part of the `cadence.quarterly-light` triage, where a status flip in a record is exactly
the change that the projection most often fails to follow.

**What it checks.** Family ids in both directions against
[../model/families.md](../model/families.md) sections 3 and 5, plus each family's group
(microfrontend versus baseline), canonical name, and `time.*` integration poles;
implementation and edition ids in both directions against
[../model/implementations.md](../model/implementations.md), plus availability state,
edition suffix, and family mapping per entry; question ids and ranks against the
[../model/questions.md](../model/questions.md) ranked index, plus each question's exposed
dimension and each answer's elimination set against that question's Eliminates/favors
bullet; the `Availability` union against the seven `avail.*` states; every family id
referenced anywhere in the projection; internal answer-id and `unlockedBy` integrity; and
`unitCount` and `attributeCount` against [../matrix/attributes.json](../matrix/attributes.json) and
`../matrix/columns/`.

**What it cannot catch.** The model is prose, so the guard reads only what the prose states
mechanically as dotted ids:

- Every prose field is unverified: family definitions, plain names, advantages, costs,
  limitations, works-well and works-poorly lists, `differsBy`, notes, urls, and all four
  question phrasings. A rewritten definition that contradicts the model passes.
- `answerClass` and `favors` are unverified: the model classifies bindings per constraint
  in [../model/constraints.md](../model/constraints.md), not per answer id, so there is no
  per-answer counterpart to compare against.
- `unlockedBy` is checked only for internal consistency. The edge set belongs to
  [../model/question-graph.md](../model/question-graph.md), which the guard does not parse;
  a backward edge is reported as REVIEW because rank is expected-gain order, not ask order.
- Eliminations the model states without a family id are UNCHECKED, not passed: rank 1 routes
  its elimination through a `derive.*` rule, and ranks 14 and 16 eliminate at implementation
  or pole scope, so their absence from the projection cannot be judged mechanically either.
- Per-posture and per-level qualifications are flattened. Where the model eliminates a family
  only in a configuration ("the SDK-handshake posture", "maxLevel<4"), the guard can check
  the subset relation but not the degree, and reports the weaker check.
- Editorial choices are only surfaced, never judged: collapsed edition splits, omitted
  graveyard entries, and the metadata version, snapshot, and review dates.
- It compares two statements; it never says which side is right. A drift finding means the
  projection and the model disagree, and the model is the authority only because the design
  stance says so, not because the guard proved it.

Passing the guard is therefore a floor, not a warrant: it means the ids, ranks, states, and
elimination sets agree, not that the projection tells the same story. The durable fix stays
the one in known gap 3, generating the projection from the canonical collections
([schema-proposal.md](../model/schema-proposal.md)); until that exists, this guard is what
keeps the drift visible.
