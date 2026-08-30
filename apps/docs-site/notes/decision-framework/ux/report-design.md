# Deterministic Strategy-Report Design

Status: PROVISIONAL v0 (guidance-derived, 2026-08-28); refine at its phase gate

Covers: REQ-REPORT-01..06, REQ-LOCAL-01/02, REQ-LEAD-01..04, REQ-FRAME-01, REQ-TRUST-01.
Source: transcript [10] (user ask) and [11] (addendum: availability, gap handling, client-side
strategy reports). Sibling artifacts are linked, not restated.

Related artifacts:

- Engine semantics that produce the report inputs: [../model/decision-engine.md](../model/decision-engine.md) (Phase 7)
- Risk categories and transition modeling: [../model/state-transition.md](../model/state-transition.md)
- Editions and availability facts: [../model/enterprise-layer.md](../model/enterprise-layer.md)
- Topology narrative source: [../model/topology.md](../model/topology.md)
- Gap records and relaxation paths: [../positioning/market-gaps.md](../positioning/market-gaps.md)
- Version/refresh policy the report depends on: [../maintenance/versioning-strategy.md](../maintenance/versioning-strategy.md)
- Methodology the framing cites: [../research/hyperfrontend-thesis.md](../research/hyperfrontend-thesis.md)

---

## 1. Purpose (`report.purpose`)

The report is a real, shareable internal strategy document, not a transient wizard result
(REQ-REPORT-03). Target readers: architects, engineering managers, CTOs, platform teams,
product engineering leadership. Quality bar: an architect can argue with individual
assumptions rather than dismiss it as marketing (REQ-FRAME-02). The page is one interface to
it; the same inputs must be renderable by other consumers (REQ-DATA-01).

## 2. Candidate sections (`report.section.*`)

Seventeen candidate sections per REQ-REPORT-03; order below is the default reading order.
Each row: one-line content spec, plus the model artifact/engine output that feeds it.
Sections with no content for a given assessment render as an explicit "not applicable"
or are omitted with a note, never silently padded.

| Id | Section | Content spec | Fed by |
|----|---------|--------------|--------|
| `report.section.executive-summary` | Executive summary | The architectural direction that best fits the stated circumstances, in a few paragraphs, with its status label. | Engine `candidateStrategies` + statuses (REQ-ENGINE-01) |
| `report.section.current-state` | Current state | The facts the user supplied, normalized and echoed back verbatim enough to be checkable. | Answers + current-state facts ([state-transition](../model/state-transition.md), REQ-STATE-01) |
| `report.section.desired-state` | Desired state | What the user is trying to achieve, with willingness/authority/confidence qualifiers. | Answers + trajectory model (REQ-STATE-01/04) |
| `report.section.hard-constraints` | Hard constraints | Requirements that eliminated options, each with what it eliminated. | Normalized constraints + `excludedStrategies` (REQ-Q-02) |
| `report.section.preferences` | Preferences | Factors that influenced ranking but eliminated nothing. | Constraint model preference tiers (REQ-Q-02) |
| `report.section.organizational-topology` | Organizational topology | Which modeled topology applies and how ownership/coordination shaped the result. | [topology.md](../model/topology.md) (REQ-ORG-01/02) |
| `report.section.architectural-strategy` | Architectural strategy | Recommended vendor-neutral family or families, level 1 of the two-level recommendation. | [families.md](../model/families.md) (REQ-Q-09, REQ-FAM-01/02) |
| `report.section.candidate-implementations` | Candidate implementations | Concrete options worth evaluating, level 2, each tagged with edition where relevant. | [implementations.md](../model/implementations.md) + research/solutions/ (REQ-Q-09, REQ-ENT-02) |
| `report.section.hyperfrontend-fit` | HyperFrontend fit | Where Community and/or Enterprise fit, if relevant; emergent, never presupposed. | [positioning](../positioning/hyperfrontend-positioning.md) + [enterprise-layer](../model/enterprise-layer.md) |
| `report.section.availability` | Availability | Which recommendations exist today vs future/planned, per REQ-AVAIL-01 statuses. | Availability facts per implementation (REQ-AVAIL-01/02) |
| `report.section.tradeoffs` | Tradeoffs | What is gained and sacrificed by the recommended direction; never a score. | Engine `tradeoffs` (REQ-Q-06) |
| `report.section.risks` | Risks | Technical, organizational, operational, and transition risks, using the four risk categories. | REQ-STATE-10 categories ([state-transition](../model/state-transition.md)) |
| `report.section.alternatives-considered` | Alternatives considered | Why other major strategies were rejected, traced to the eliminating constraints. | Engine `excludedStrategies` + reasons (REQ-ENGINE-01) |
| `report.section.counterfactuals` | What would change this recommendation | Conditions under which another option becomes preferable. | Counterfactual rules (REQ-Q-07); relaxation paths from [market-gaps](../positioning/market-gaps.md) (REQ-GAP-03) |
| `report.section.transition-path` | Transition path | Current -> transition -> target when the preferred future architecture is not yet achievable. | REQ-STATE-06/07 dual output |
| `report.section.unresolved-questions` | Unresolved questions | Anything unanswered that still materially affects the decision, phrased as the next most useful question. | Engine `unresolvedQuestions` (REQ-ENGINE-01, REQ-ORCH-10) |
| `report.section.evidence` | Evidence | Research references backing the claims used, with provenance and review dates. | Matrix evidence refs (REQ-MATRIX-05, REQ-DATA-05/07) |

Result ordering inside the document follows the transcript [11] result hierarchy: situation ->
states -> hard constraints -> credible org changes -> families -> available implementations ->
future/planned implementations -> tradeoffs/risks -> relaxation alternatives; lead capture is
outside the report body entirely (section 9).

## 3. Determinism contract (`report.determinism`)

Per REQ-REPORT-01 the report is produced by a deterministic, non-LLM engine.

Inputs (`report.inputs.*`): answers; normalized constraints; derived implications; decision
rules; strategy matches; implementation matches; evidence; availability; risk; unresolved
questions. Nothing else. All of these are declarative data from the canonical model
(REQ-ENGINE-01/02, REQ-DATA-04).

Contract: same inputs + same decision-model version + same research snapshot version =
the same report, byte-for-byte at the data level (rendering chrome may vary). Consequences
the contract buys: repeatability, auditability, trust, testability (scenario fixtures per
REQ-TEST-01 assert on report data), offline execution, and cross-version comparison.

LLM boundary: an LLM may later explain or summarize a generated report, and a conversational
interface may translate prose into the same normalized constraints
([llm-interface](../model/llm-interface.md), REQ-LLM-01); it never authors, alters, or
regenerates the recommendation or any historical report.

## 4. Traceability format (`report.trace.derivation-block`)

Per REQ-REPORT-02 every significant conclusion carries a derivation block: the conclusion,
the satisfied/violated items, and the question-level provenance in Q-id -> normalized-fact
form (transcript [11] canonical example):

```text
Recommendation: <strategy family>          [status: strong match]

Why:
+ <requirement satisfied>                  (fact id)
...

Tradeoffs accepted:
~ <cost>                                   (implication id)
...

Derived from:
Q04 -> "No host rebuild"                   (constraint id)
Q09 -> "No participant modification"
```

Rules: every line resolves to a stable id (question, fact, implication, rule) so the
source-evidence -> facts -> capabilities -> implications -> rules -> recommendation chain is
walkable (REQ-ORCH-08). The UI hides raw rule syntax by default but the reasoning is
inspectable on demand; the JSON export always contains the full derivation graph.

## 5. Uncertainty statuses (`status.*`)

Per REQ-REPORT-04. Candidate-level statuses (apply to a strategy or implementation):

| Id | Semantics |
|----|-----------|
| `status.match.strong` | All hard constraints satisfied; preferences largely satisfied; evidence confident. |
| `status.match.viable` | All hard constraints satisfied; meaningful preference or operational costs remain. |
| `status.match.conditional` | Satisfies hard constraints only under a stated condition (an answer, an org change, a capability mode); the condition is printed with the status. |
| `status.match.weak` | No hard-constraint violation, but significant unmitigated costs or poor preference fit; listed for completeness, not recommended. |
| `status.match.incompatible` | Violates at least one hard constraint; shown only in alternatives-considered with the violated constraint. |
| `status.match.future-potential` | Would plausibly satisfy the constraints via a planned capability that is not available today (REQ-AVAIL-02); always paired with the best available-today option, never shown alone. |

Assessment-level statuses (apply to the report as a whole):

| Id | Semantics |
|----|-----------|
| `status.assessment.insufficient-information` | Unanswered questions prevent a responsible conclusion; the report names which answers would resolve it (REQ-ORCH-10). |
| `status.assessment.no-current-strong-match` | No researched solution satisfies all hard constraints; the exact gap is stated as a gap record and a constraint-relaxation path is offered (REQ-GAP-01/02/03). Never lower the bar until something wins. |

Scores: no universal numeric scoring (REQ-Q-06). If any compatibility indicator is ever
rendered it is a visualization aid summarizing the independent factors of REQ-AVAIL-03
(architectural/organizational/operational/transition fit, availability, maturity, adoption
cost), each independently inspectable; the statuses and reasons are the truth, the number
is not.

## 6. Versioned assessments (`report.versioning`)

Per REQ-REPORT-06 and REQ-DATA-07. Every assessment records at creation:

- `createdAt` (date)
- `decisionModelVersion` (question graph + rules + schema)
- `researchSnapshotVersion` (e.g. "August 2026")

Behavior on return: if the live dataset is newer, surface a non-blocking notice ("This
assessment was generated using the August 2026 research snapshot; newer research is
available.") with an explicit reassess action. Reassessment generates a NEW assessment
against the new versions; the old report is never silently mutated, re-rendered against new
data, or LLM-regenerated. Old and new reports are comparable because both are deterministic
data (section 3). Version identity policy lives in
[versioning-strategy.md](../maintenance/versioning-strategy.md).

## 7. Local-first storage evaluation (`storage.*`)

Per REQ-LOCAL-01: no account, no server-side persistence, browser-only decision state; the
user can return later and can explicitly clear the saved strategy. Expected data size: answers
plus one or a few generated assessments, realistically 10-200 KB of JSON.

| Id | Option | Fit |
|----|--------|-----|
| `storage.local-storage` | localStorage | Synchronous, universally supported, ~5 MB string quota; ample for the expected size; survives sessions; simplest to make robust (single versioned key, JSON value). |
| `storage.indexeddb` | IndexedDB | Structured, async, large quota; earns its complexity only if multi-assessment history or embedded evidence grows beyond localStorage comfort; not needed for v1. |
| `storage.url-state` | Serialized URL state | Good for a small shareable subset (answer vector + versions) so a colleague can reproduce an assessment; URLs leak into history/logs/referrers, so the label, free text, and generated report never enter a URL; length limits rule it out as primary storage. |
| `storage.file-snapshot` | Downloadable/importable decision file | Explicit portability and backup; identical to the JSON export (section 10); complements rather than replaces primary storage. |

Provisional recommendation (simplest sufficient, per REQ-LOCAL-01): `storage.local-storage`
as primary, one versioned key holding `{schemaVersion, answers, label?, assessments[]}`;
`storage.file-snapshot` for portability; `storage.url-state` only as an optional share
mechanism for the label-free answer subset; promote to `storage.indexeddb` only if a later
multi-assessment feature demonstrably outgrows localStorage. A visible "clear saved
strategy" action deletes the key entirely.

Privacy rules (binding, from REQ-LEAD-04/REQ-LOCAL-02): the label is never transmitted;
answers, constraints, results are never silently sent to HyperFrontend or any analytics
sink; no telemetry event may carry answer content or the label; the only data that leaves
the browser is an explicit form submission (section 9).

## 8. Local company/strategy label (`report.label`)

Per REQ-LOCAL-02. Optional free-text label (company name, org name, or strategy name; any
string accepted, no validation against "real" names). Used only to title the output:

```text
<Label>
Microfrontend Strategy Assessment

Generated: 28 August 2026
Decision framework: v<decisionModelVersion>
Research reviewed: <researchSnapshotVersion>
```

Exact transparency copy requirements (wording refinable, meaning fixed):

- At the label input: "This label is stored locally with your assessment and is not sent to
  HyperFrontend."
- The label input is skippable with no loss of function; a blank label yields an untitled
  assessment.
- The label appears in local storage, in the report title/header, and in exports the user
  downloads; it appears nowhere else, including URLs and any submission payload, unless the
  user explicitly types it into a contact form themselves.

## 9. Lead capture (`lead.*`)

Per REQ-LEAD-01..04; positioned per the transcript [11] result hierarchy: lead capture
occurs after the recommendation, never before.

Rules:

1. `lead.rule.result-first` The complete decision outcome is generated and shown BEFORE any
   contact ask; an email is never required to see, export, or keep the result (REQ-LEAD-02).
2. `lead.rule.relevance-gated` The interest prompt appears only when the assessment actually
   aligns with planned HFE capabilities or exposes a gap HF could address (REQ-LEAD-01,
   REQ-GAP-02); never as a blanket footer on every result.
3. `lead.rule.no-promised-dates` Copy never implies a delivery date. Allowed: "Get updates
   when this capability becomes available." / "Let us know if this is a problem you would
   like HyperFrontend Enterprise to address." Forbidden: "We'll contact you in three
   months." (REQ-LEAD-01)
4. `lead.rule.minimal-fields` Fields: name, email, optional company, optional role, optional
   free-text context; each field carries an inline reason, e.g. "Used only to contact you
   about HyperFrontend capabilities relevant to this result." Collect nothing not useful
   (REQ-LEAD-03).
5. `lead.rule.explicit-attachment` Attaching any decision context (answers, constraints,
   the gap record, the recommendation) to a submission is a separate, unchecked, explicit
   opt-in that states exactly what would be sent; default is send-nothing-but-the-form
   (REQ-LEAD-04).
6. Opt-in intents supported: receive updates; contact when relevant capabilities become
   available; submit additional context; give feedback about the missing capability
   (REQ-LEAD-01).

Neutrality guarantee: the report (and the lead-capture logic around it) must be able to
express all seven REQ-TRUST-01 outcomes, and lead capture attaches only to the fourth and
fifth (and optionally gap feedback):

| Id | Outcome |
|----|---------|
| `outcome.hf-community-strongest` | HyperFrontend Community is the strongest current match. |
| `outcome.other-oss-strongest` | Another open-source framework is the strongest current match. |
| `outcome.commercial-strongest` | A commercial competitor is the strongest current match. |
| `outcome.hfe-future-fit` | HFE appears likely to fit but is unavailable; use Solution X today (both shown, REQ-AVAIL-02). |
| `outcome.no-strong-match` | No currently researched solution strongly fits (with gap record + relaxation path). |
| `outcome.no-mfe-needed` | You probably do not need microfrontends (simpler architectures recommended, REQ-Q-04). |
| `outcome.viable-with-changes` | Viable only if specific stated assumptions change (relaxation path, boundary preserved first, REQ-GAP-03). |

Scenario fixtures (REQ-TEST-01) should include at least one expected report per outcome id.

## 10. Export surfaces (`export.*`)

Per REQ-REPORT-05; all browser-side, no backend.

| Id | Surface | Notes |
|----|---------|-------|
| `export.html-print` | Printable HTML | Print-stylesheet view of the report; the canonical human-readable artifact. |
| `export.pdf-print` | Browser print-to-PDF | Same view through the browser's print dialog; no PDF library shipped. |
| `export.markdown` | Markdown export | Full report as Markdown for wikis/PRs/docs; derivation blocks preserved as fenced text. |
| `export.json` | JSON export | Machine-readable: `{frameworkVersion, researchVersion, assessment, answers, constraints, recommendations}` plus the derivation graph; re-importable to restore state and consumable by other interfaces (CLI, LLM, future UI). |
| `export.snapshot` | Downloadable decision snapshot | The JSON export used as a portable save-file (`storage.file-snapshot`); import validates schema version before restore. |

Every export embeds `createdAt`, `decisionModelVersion`, `researchSnapshotVersion` (section
6) so historical reports remain interpretable without regeneration.

## 11. First-principles framing (`framing.placement.*`)

Per REQ-FRAME-01. The methodology statement (fixed meaning): "Rather than beginning with
frameworks and comparing feature lists, this assessment starts with boundaries, ownership,
deployment, coordination, isolation, and change constraints, then derives which architectural
strategies fit those conditions." The article "Microfrontends from First Principles" is
linked naturally, once per placement:

- `framing.placement.intro` One sentence in the experience introduction.
- `framing.placement.methodology-panel` The full methodology statement plus link; the one
  place that explains the approach in depth.
- `framing.placement.report-footer` Attribution line in the generated report: methodology
  name, article link, versions.
- `framing.placement.how-this-works` The "How this works" explainer page/panel.
- `framing.placement.architect-view` The detailed matrix/architect entry point (REQ-AUD-01).

No-repeated-promotion rule: these five placements are the complete set; the article is not
linked from questions, per-section report copy, status labels, or lead-capture copy, and no
placement repeats the promotion within itself. The framing explains methodology; it is never
marketing copy.

## 12. Open items for the phase gate

- Section order vs audience: whether the architect view reorders sections (evidence earlier).
- Status terminology polish during UX work (REQ-REPORT-04 allows renaming; ids are stable).
- Whether URL-share (label-free subset) ships in v1 or is deferred.
- Exact copy strings above are meaning-fixed but wording-provisional; finalize with UX.
