# Decision Engine Model

Status: DERIVED v1 (Phase 7), 2026-08-29. Deliverable 16 (MASTER.md section 16).
Requirements served: REQ-ENGINE-01/02 (declarative pipeline, explainable result shape),
REQ-Q-06 (no numeric scoring), REQ-Q-07 (computed counterfactuals), REQ-AVAIL-03
(availability and fit as independent factors), REQ-GAP-01/03 (gap records and
relaxation paths), REQ-TRUST-01 (all seven outcomes expressible), REQ-REPORT-01/02
(deterministic, traceable report inputs), REQ-ORCH-10 (unanswered-question tolerance
and next-question selection).

Inputs, linked not restated (REQ-OPS-03): entity shapes and file split from
[schema-proposal.md](schema-proposal.md) (sections 3 and 7.1; this file evaluates over
exactly those shapes and adds none); constraint definitions, derive rules, relations,
Conway rules, and the relaxation ledger from [constraints.md](constraints.md); question
content from [questions.md](questions.md); edges, stages, dominance rules, and the
unanswered/next-question rules from [question-graph.md](question-graph.md); the
credibility predicate and dual-output semantics from
[state-transition.md](state-transition.md); scales from [migration.md](migration.md);
topology priors and inference from [topology.md](topology.md); edition firewall from
[enterprise-layer.md](enterprise-layer.md); statuses, derivation-block format, and
export spellings from [../ux/report-design.md](../ux/report-design.md); version
surfaces from [../maintenance/versioning-strategy.md](../maintenance/versioning-strategy.md);
cells from [../matrix/matrix-compact.tsv](../matrix/matrix-compact.tsv).

Scope rule: this file specifies **evaluation semantics** over the schema's data. Where
a rule id already exists in a sibling artifact (`rule.*`, `predicate.*`,
`dominance.*`), this file consumes it and never redefines it; new normative content
introduced here carries `engine.*` ids. Everything below is implementable from the
named records without reinterpreting prose.

---

## 1. Engine contract (REQ-ENGINE-01, REQ-ENGINE-02)

### 1.1 Two pure functions

```ts
evaluate(dataset: Dataset, answers: Answer[]): EngineOutputs      // schema 3.21
nextQuestion(dataset: Dataset, answers: Answer[]): Id | null      // section 4.4
```

`Dataset` is the schema-proposal 7.1 collection set at one pinned
(`version.schema`, `version.model`, `version.research`) triple. `Answer[]` is the
`Assessment.answers` array (schema 3.21). Both functions are pure: no clock, no
randomness, no network, no LLM, no mutable state. The interactive experience is the
loop `ask(nextQuestion) -> append answer -> evaluate`, and `evaluate` may be called
after any prefix of answers (`rule.retain-by-default`): partial-information output is
a first-class result, not an error.

### 1.2 Structural guards

- **`engine.rule.declarative-only`** (REQ-ENGINE-01): every eliminating, ranking,
  deriving, suppressing, or relaxing decision is parameterized by a named data record
  (the per-step tables in section 2 name it). Engine code contains no rule content.
- **`engine.rule.no-vendor-branching`** (REQ-ENGINE-02, REQ-KEYTEST-01): engine code
  never tests a `unit.*`, `impl.*`, or `alias.*` id. All unit-specific behavior
  arrives through matrix cells, implementation records, and family membership. With
  every `impl.*` and `alias.*` record deleted, `evaluate` still runs and produces the
  family-level half of every output.
- **`engine.rule.no-scores`** (REQ-Q-06): no numeric composite is computed, stored,
  or compared. The only ordered comparisons are scale ordinals (schema 3.16), the
  predicate thresholds (schema 3.17), and counts of named eliminated/violated items,
  which are structural facts disclosed with their member lists
  (question-graph.md 3.2 discipline).
- **`engine.rule.stage-firewall`**: at each stage the engine accepts bindings only
  for scopes in that stage's `mayBind` (schema 3.14); a binding whose
  `ConstraintDef.scope` is outside the current stage's `mayBind` is a dataset error
  (validator check 7), and at runtime it is refused, never silently applied.
  Consequences: edition answers never eliminate families (REQ-ENT-01);
  implementation-stage results never reopen family selection (constraints.md 1.3).

---

## 2. Evaluation pipeline

Order fixed by `engine.ordering` (state-transition.md section 9; REQ-STATE-12) and
REQ-ENGINE-02 (facts before constraints before candidates). Steps carry stable ids;
each lists inputs, outputs, and the exact artifact that parameterizes it.

```text
answers
  E1 intake            -> facts + direct bindings
  E2 topology-infer    -> inferred topology + confirm node + priors
  E3 derive            -> entailed/confirm bindings (derive.*)
  E4 compose           -> effective binding set (slots resolved, target credibility)
  E5 relations         -> warn/prune effects, gap seeds
  E6 eliminate-family  -> survivor families + exclusions with origin chains
  E7 rank-family       -> ordered family candidates (preference effects)
  E8 dominance         -> suppressed questions + disclosures
  E9 next-question     -> loop back to E1, or closure
  E10 stage-implementation -> implementation candidates/exclusions
  E11 stage-edition    -> edition/operating-plan candidates
  E12 availability-lens -> independent availability/maturity annotations
  E13 dual-output      -> slots.bestToday / slots.bestAfterTransition
  E14 gap-detect       -> gapRecords, assessmentStatus
  E15 relaxation       -> ordered relaxationOffers
  E16 counterfactuals  -> counterfactuals (section 6)
  E17 emit             -> EngineOutputs + derivation graph
```

E1 to E9 rerun after every answer (all monotone per `rule.monotone-elimination`, so
rerunning never revokes an elimination); E10 to E17 run whenever output is requested.

### E1 `engine.step.intake`

- **Inputs**: `Answer[]`; **outputs**: fact instances (`{fact, subject, value}` with
  provenance, schema 3.15) and the direct `ConstraintBinding`s of each chosen
  `AnswerOption.binds`, each with `origin: ["answer:<question-id>"]`.
- **Parameterized by**: `questions.json` (answer options, classes, facet ceilings),
  `scales.json` (scale-level answers).
- Rules applied: `rule.unanswered-inert` (an absent answer contributes nothing; no
  default is ever hard); `question.rule.state-fork` (a future-tense answer routes to
  `state.target` plus the septet, never to a current fact); facet ceilings (a
  `desirability` facet cannot produce a binding above `class.strong-preference`;
  structural via `maxClass`, schema 3.13).
- **`engine.rule.horizon-select`**: a stated integration deadline is not a
  constraint; it selects `migration.horizon.first-integration` as the governing
  horizon for every appetite binding (migration.md section 6) and is echoed in the
  report as a risk line. Convergence-horizon appetites bind only under E4's
  credibility handling.

### E2 `engine.step.topology-infer`

- **Inputs**: `ownership.*` facts; **outputs**: inferred topology label(s)
  per boundary, the `question.topology.confirm` node armed, and topology **priors**.
- **Parameterized by**: `topologies.json` (ownership-evidence mapping, hard and
  preference tendencies; topology.md sections 2 and 3), `question-graph.json`.
- **`engine.rule.prior-bindings`**: a prior enters as a provisional binding flagged
  `prior-unconfirmed`. Preference-class priors may rank (preferences never
  eliminate) and are listed in `unresolvedQuestions` until confirmed;
  hard-tendency priors NEVER eliminate before their confirming question or an
  entailing `derive.*` premise arrives (topology.md section 1; migration.md
  section 7: "a prior never eliminates"). Explicit answers always override priors.

### E3 `engine.step.derive`

- **Inputs**: fact instances; **outputs**: derived `ConstraintBinding`s with
  `origin: [<derive-id>, ...premise fact refs]`.
- **Parameterized by**: `derive-rules.json` (constraints.md section 3).
- Semantics: premises evaluate over present facts only (`PremiseGroup` all/any);
  `mode: "entailed"` binds immediately at the stated class; `mode: "confirm"` binds
  as a `prior-unconfirmed` binding plus an armed confirmation question (question
  cost: one confirm event, question-graph.md 4.2 R3). `reclass` effects re-class a
  constraint's default (e.g. `derive.single-coordinated-team`).

### E4 `engine.step.compose`

- **Inputs**: all bindings (direct, derived, prior); **outputs**: the effective
  binding set per (constraint, subject).
- **Parameterized by**: `engine-rules.json` (`rule.conway-default`,
  `rule.target-credibility`, `rule.no-target-satisfies-hard`,
  `rule.aspiration-warning`, `predicate.target-credible`), `constraints.json`
  (class ceilings), septet and buy-in records in the assessment.
- Composition semantics (constraints.md section 3 closing rule): several bindings on
  one (constraint, subject) compose to the **strictest class**; every contributing
  binding keeps its `origin` chain, and the composed binding's origin is the union.
  A class ceiling (`ConstraintDef.classCeiling`, facet `maxClass`) truncates, never
  errors: the binding is recorded at the ceiling with the truncation noted.
- Slot resolution: `slot: "state.current"` bindings feed E6. A
  `slot: "state.target"` binding is evaluated against `predicate.target-credible`
  over the dimension's septet and buy-in records: pass = the binding participates
  only in the `bestAfterTransition` evaluation (E13); fail at confidence 2 to 3 =
  retained as an annotation feeding `rule.aspiration-warning`; confidence 0 to 1 =
  set aside with the reason recorded. No target binding at any confidence below 7
  ever satisfies a hard constraint in current-state evaluation.

### E5 `engine.step.relations`

- **Inputs**: the effective binding set; **outputs**: ask-time warnings, prune
  effects, and gap seeds.
- **Parameterized by**: `relations.json` (constraints.md section 4),
  `question-graph.json` (`edge.warns`, `edge.prunes`).
- Semantics: an active `rel.excludes` whose `from` set is bound hard arms the warn
  edge on the `to` constraint's question (shown at ask time, REQ-GAP-01); if both
  sides become hard anyway, the relation's `gapSeed` is queued for E14.
  `rel.relaxes` with an active `from` re-classes the `to` constraints to
  `class.irrelevant-by-default` and prunes their questions. `rel.requires` gates
  unlock conditions (a question whose prerequisite constraint set cannot hold is
  not offered as a live choice; it is presented as a tradeoff acknowledgment,
  question-graph.md 1.3 rank-12 row).

### E6 `engine.step.eliminate-family`

- **Inputs**: hard bindings with `scope.family` (and `scope.inventory` guards);
  **outputs**: the family-level survivor set and `excludedStrategies` entries.
- **Parameterized by**: `constraints.json` (each constraint's bound attribute ids
  and per-band semantics), `matrix.json` cells, `families.json` membership,
  `scales.json` (ceiling parameters compare by `ScaleLevel.ordinal`).
- Semantics: a hard binding eliminates every family/unit whose deciding cells fail
  the constraint's predicate; the elimination is verified against the same cells
  constraints.md section 2 cites (the engine re-checks cells, it does not trust
  prose). Per-unit deviations inside a family resolve at cell level: mode-forked
  and posture-split units (families.md 6.3) are eliminated or retained **per
  configuration**, and a family survives if any configuration of any member
  survives, with the surviving configuration named in the candidate's `condition`.
- Cell-value discipline (REQ-MATRIX-05): `y`/`n` decide; `c` retains only with the
  cell's `condition` attached to the candidate; `?` and `na` never satisfy a hard
  requirement and are surfaced as data uncertainty; absent = `unknown`.
- **`engine.rule.attribution`** (taxonomy.md 3.4; constraints.md section 4 closing
  duty): before eliminating on `deployment.strategy-service-in-path`,
  `governance.rollback`, or `migration.host.new-infra-tier-required`, resolve the
  cell's condition text to the actual upstream cause (request-path composer vs
  registry vs delivery platform); eliminate only units whose cause matches the
  bound constraint.
- Engine-answered guards (questions.md section 7): `constraint.installable-today`
  and `constraint.code-ownership` are evaluated here from uniform cells and
  reported as satisfied without a question ever being asked.
- Monotonicity: elimination flows only from bound hard constraints
  (`rule.monotone-elimination`); each `Exclusion` records
  `{candidate, violated: [binding refs], origin: [answer/derive ids]}`.

### E7 `engine.step.rank-family`

- **Inputs**: survivor set + strong/weak preference bindings; **outputs**: ordered
  `candidateStrategies` with statuses, fit flags, and tradeoffs.
- **Parameterized by**: `constraints.json`, `matrix.json`, `families.json`
  (inherent-costs fields feed tradeoff text refs), `report-spec.json` statuses.
- **`engine.rule.candidate-order`** (contextual, explainable, no scores):
  1. status order `status.match.strong` > `viable` > `conditional` > `weak`
     (assignment per report-design.md section 5 semantics: strong = hard set
     satisfied and preferences largely satisfied on cells; viable = hard set
     satisfied with named preference violations; conditional = survives only under
     a named condition; weak = unmitigated cost pile-up, listed not recommended);
  2. among equal status: fewer violated `class.strong-preference` bindings, each
     violation named in `tradeoffs` (a count of named items, not a score);
  3. then fewer violated `class.weak-preference` bindings;
  4. then candidate id, lexicographic (a disclosed stable arbitrary order).
  Every adjacent pair in the output order must be justifiable by rule 1 to 3
  references; rule 4 alone means "tied, order not meaningful" and the report says
  so.
- Fit flags (REQ-STATE-10, REQ-AVAIL-03): each candidate carries the four
  independent `fit.*` records with `because` chains: `fit.architectural` from
  technical-cluster bindings (constraints.md 2.1 to 2.5, 2.7, 2.9, 2.10),
  `fit.organizational` from ownership/topology/coordination bindings (2.3, 2.6,
  2.8, 2.15), `fit.operational` from delivery/operations bindings (2.4, 2.11,
  2.13 consequences), `fit.transition-dependent` true iff any supporting binding
  originates in a `state.target` slot. Never blended.

### E8 `engine.step.dominance`

- **Inputs**: fired rules + answers; **outputs**: active dominance rules, the
  suppressed-question set, `dominanceApplied` disclosures.
- **Parameterized by**: `dominance.json` (question-graph.md section 2).
- Semantics (`rule.dominance-suppression`): a rule is active while every condition
  holds; dominated candidates STAY in the survivor set; the rule's `skips`
  questions are removed from the askable set and excluded from
  `unresolvedQuestions` (the dominance id is recorded instead). A withdrawn
  condition dissolves the dominance and the questions unlock. Every active rule is
  disclosed with its conditions (REQ-REPORT-02).

### E9 `engine.step.next-question`

Section 4.4; loops to E1 until `rule.question-closure` or until the caller requests
emission (`rule.conditional-output` governs what may then be said).

### E10 `engine.step.stage-implementation`

- **Inputs**: surviving families; implementation-stage answers; **outputs**:
  `candidateImplementations` and implementation-scope exclusions.
- **Parameterized by**: `implementations.json` (members, configurations, editions),
  `constraints.json` (`scope.implementation` constraints incl. the 2.13 lens),
  `matrix.json` (`unit.*` cells), stage record (`stage.implementation`).
- Semantics: identical machinery to E6/E7 at `scope.implementation`, over the
  member units (in their surviving configurations) of surviving families only.
  Lens constraints (2.13) and `constraint.host-modification-ceiling` at
  implementation scope act here. Nothing reaches back into family choice.

### E11 `engine.step.stage-edition`

- **Inputs**: surviving implementations; edition-stage answers; **outputs**: viable
  editions/operating plans per candidate.
- **Parameterized by**: `implementations.json` edition records and capability
  attachments, `constraints.json` 2.14 (`constraint.operability.*`,
  `scope.edition`), `capability-atoms.json`.
- Semantics: a hard operability binding means "some operable plan must satisfy it"
  (edition capability, third-party product, or in-house build all count,
  REQ-ENT-07); it prices candidates and eliminates only editions/operating plans.
  Commercial editions are selected only in combination with a managed answer on
  `question.edition.operability.managed-service-preference`. A capability
  attachment with `availability` in {`avail.announced-planned`,
  `avail.future-roadmap`} satisfies NO binding (REQ-AVAIL-01; validator check 9
  enforces the same at rest).

### E12 `engine.step.availability-lens`

- **Inputs**: candidate implementations/editions; **outputs**: availability and
  maturity annotations as independent factors.
- **Parameterized by**: `implementations.json` availability/maturity facts.
- **`engine.rule.availability-lens`** (REQ-AVAIL-03): availability never modifies a
  fit flag and never re-orders candidates within a status; it is carried beside
  them. Consequences: members at `avail.deprecated`/`avail.inactive` are excluded
  from `slots.bestToday` but retained in `candidateImplementations` with the state
  explained (versioning-strategy.md 2.2); `avail.available-immature` is an
  annotation, not a downgrade; a planned capability that fits produces
  `status.match.future-potential` with `pairedAvailableToday` REQUIRED
  (REQ-AVAIL-02; structural in schema 3.21).

### E13 `engine.step.dual-output`

- **Inputs**: E6 to E12 results under current-state bindings, plus a second
  evaluation pass with credible target bindings added; **outputs**:
  `slots.bestToday` (always) and `slots.bestAfterTransition` (conditionally).
- **Parameterized by**: `engine-rules.json` (`rule.conway-default`,
  `rule.dual-slot-divergence`, `rule.aspiration-warning`), septet records.
- Semantics: `bestToday` is the E7/E10 output; produced regardless
  (REQ-STATE-02). `bestAfterTransition` is produced when at least one dimension
  has a credible target differing from current (a full re-evaluation with those
  bindings), or when a non-credible aspiration exists, in which case the slot
  carries the `rule.aspiration-warning` conditional (status
  `fit.transition-dependent`, missing buy-in signals listed) instead of a
  recommendation. Before any `fit.transition-dependent` output is emitted,
  `question.trajectory.no-transition-outcome` must have been asked
  (question-graph.md 1.3). When the slots diverge, the causing septet records are
  cited (`rule.dual-slot-divergence`).

### E14 `engine.step.gap-detect`

- **Inputs**: survivor sets, queued gap seeds, gap-trigger bindings; **outputs**:
  `gapRecords`, `assessmentStatus`.
- **Parameterized by**: `gaps.json`, `relations.json` (`gapSeed`),
  `constraints.json` 2.12 gap-triggers.
- Semantics (REQ-GAP-01): when the hard set empties a candidate space (family
  stage: no family; implementation stage: no member of any surviving family), the
  engine NEVER relaxes silently; it emits
  `status.assessment.no-current-strong-match`, a `GapRecord` naming the exact
  jointly-unsatisfiable hard bindings (`constraints`), the relations or traces
  that prove it (`discoveredFrom`), the failing capability atoms/attributes
  (`unmetCapabilities`), and its classification (schema 3.20; classification
  content maintained in `positioning/market-gaps.md`). A hard binding of a
  gap-trigger constraint (`constraint.artifact-integrity`,
  `constraint.rsc-federation`) emits its landscape-wide gap record even though
  other candidates survive on other constraints.

### E15 `engine.step.relaxation`

- **Inputs**: the gap state; **outputs**: `relaxationOffers`, ordered.
- **Parameterized by**: `relaxation.json` (constraints.md 6.1),
  `engine-rules.json` (`rule.relaxation-ordering`).
- Semantics (REQ-GAP-03): offers are generated only from ledger rows whose
  `constraint` (+ params) is actually bound hard in this assessment; each offer
  names what it reopens and the reopened candidates' consequences (family
  inherent-costs refs). Order per `rule.relaxation-ordering`: (1) re-confirmation
  of preferences mistaken for hard, (2) organizational/governance relaxations
  (subject to E4 credibility), (3) deployment/infrastructure acceptances, (4) UX
  acceptances, (5) adaptation-appetite increases, (6) a different composition
  boundary, last. Implementation/edition-scope relaxations are offered only after
  every family-scope offer (constraints.md 6.1 closing rule).

### E16 `engine.step.counterfactuals`

Section 6. **Outputs**: `counterfactuals` (REQ-Q-07).

### E17 `engine.step.emit`

- **Inputs**: everything above; **outputs**: one `EngineOutputs` (schema 3.21)
  plus the full `derivation` line set (section 3.3), canonically ordered
  (section 4.3). The caller wraps it in an `Assessment` (adds `createdAt`, pinned
  versions, label); export spellings are fixed by schema 3.21's envelope note.

Mapping to `engine.ordering` (REQ-STATE-12): ordering steps 1 to 4 are E1 to E4;
step 5 is E6/E7; step 6 is E13's second pass; step 7 is E10; step 8 is E11; step 9
is E15/E16.

---

## 3. Result shape (REQ-ENGINE-01, REQ-AVAIL-03, REQ-STATE-10, REQ-REPORT-02)

### 3.1 The eight fields and their producers

`EngineOutputs` (authoritative shape: schema-proposal.md 3.21) carries
REQ-ENGINE-01's key set verbatim, populated as follows:

| Field | Produced by | Content rule |
|---|---|---|
| `satisfiedConstraints` | E4 + E6/E10/E11 | every effective binding whose predicate holds over the recommended set; bindings keep `origin` |
| `violatedConstraints` | E7/E10 | preference bindings violated by retained candidates (hard violations live in exclusions, never here) |
| `inferredRequirements` | E3 | every `derive.*` product, with rule id + premise facts in `origin` |
| `candidateStrategies` | E7 | ordered `CandidateResult`s at family level (REQ-Q-09 level 1); multiple candidates with explained remaining tradeoffs are a normal result (REQ-Q-04) |
| `excludedStrategies` | E6 | `Exclusion` records: candidate, violated binding refs, origin chain |
| `candidateImplementations` | E10 to E12 | ordered `CandidateResult`s (REQ-Q-09 level 2), editions tagged, availability annotated |
| `unresolvedQuestions` | E9 state | still-askable nodes with `couldStillChange` (what each remaining answer could still eliminate or re-rank); dominance-suppressed nodes excluded with the rule id recorded |
| `tradeoffs` | E7/E10 | per candidate: gained/sacrificed with refs into family/implementation cost fields and violated bindings |

Extensions (same record): `slots` (E13, REQ-STATE-06), `assessmentStatus` (E14,
REQ-REPORT-04), `dominanceApplied` (E8, REQ-Q-08 disclosure), `gapRecords` (E14,
REQ-GAP-02), `relaxationOffers` (E15, REQ-GAP-03), `counterfactuals` (E16,
REQ-Q-07), `derivation` (E17, REQ-REPORT-02).

### 3.2 Fit and availability separation (REQ-AVAIL-03, REQ-STATE-10)

Each `CandidateResult` decomposes into independent factors, none summed:

- four fit flags with `because` chains (`fit.architectural`, `fit.organizational`,
  `fit.operational`, `fit.transition-dependent`; assignment per E7);
- `status` (`status.match.*`) with mandatory `condition` for `conditional` and
  `future-potential`;
- availability state and maturity facts, annotated by E12, never blended;
- adoption cost via the `cost.adopt`/`cost.operate`/`cost.evolve` triple references
  in tradeoffs (state-transition.md section 6), never a number.

Any summary indicator a UI renders is computed at presentation time from these and
cannot persist (schema 5.2 guard).

### 3.3 Derivation chains (REQ-REPORT-02, REQ-ORCH-08)

**`engine.rule.full-chain`**: every conclusion in `EngineOutputs` must be walkable
back to its inputs entirely through stable ids:

```text
answer:<question-id> (or fact instance)
  -> fact id(s)                     (ownership.*, migration.*, septet records)
  -> derive.* rule id               (when derived rather than directly bound)
  -> ConstraintBinding              (constraint id + subject + class + params)
  -> deciding evidence              (matrix cell ids / family doc refs / relation ids)
  -> candidate cell                 (family.* / impl.* / impl.*.<edition>)
```

Concretely: `Exclusion.origin`, `CandidateResult.fit[*].because`,
`tradeoffs[*].refs`, `dominanceApplied[*].conditions`,
`relaxationOffers[*].row.eliminates`, and `counterfactuals[*].refs` are all id
lists; E17 additionally emits the flat `DerivationLine` list in the
report-design.md section 4 display grammar (`Q04 -> "No host rebuild"`), one line
per satisfied requirement, accepted tradeoff, and derivation link. The JSON export
always contains the full graph; UIs may collapse it (report-design.md section 4).

A conclusion that cannot produce its chain is a bug in the engine, not a
formatting concern: the chain is how a questionable recommendation is traced to
its failing layer (REQ-ORCH-08).

---

## 4. Determinism contract (REQ-REPORT-01, REQ-ORCH-10)

### 4.1 The contract

Same `version.schema` + `version.model` + `version.research` + same `Answer[]`
(order-insensitive; see 4.3) = the same `EngineOutputs`, byte-for-byte after
canonical serialization. No LLM participates in evaluation; an LLM may translate
prose into `Answer[]` upstream (llm-interface.md) or summarize the report
downstream, and never authors, alters, or regenerates a recommendation
(report-design.md section 3).

**`engine.rule.no-clock`**: `evaluate` takes no wall-clock input. `createdAt` is
stamped by the `Assessment` wrapper, outside `EngineOutputs`. Staleness states
(`staleness.*`) are a presentation-layer derivation from record dates plus viewing
time (versioning-strategy.md 3.2) and appear nowhere in `EngineOutputs`; they lower
displayed confidence only. The one date-flavored semantic input, the horizon
comparison inside `predicate.target-credible`, compares the septet's stated
`transition.horizon` against the decision horizon the user stated, both of which
are answers, not clock reads.

### 4.2 Version sensitivity

A changed `version.research` (rev bump) may flip cell-decided outcomes with
unchanged answers; a changed `version.model` may flip rule-decided outcomes; both
are the intended meaning of those bumps (versioning-strategy.md 1.2), which is why
assessments pin the pair and reassessment is deliberate (REQ-REPORT-06). The
engine never mixes collections from different snapshots: `Dataset` load fails if
collection envelopes disagree with `meta.json`.

### 4.3 Canonical ordering (`engine.rule.canonical-order`)

So that determinism is byte-level, every output list has a fixed sort:

- `Answer[]` is canonicalized by (question id, facet id, tense) before evaluation;
  duplicate answers to one (question, facet) are a caller error, refused.
- bindings (`satisfiedConstraints`, `violatedConstraints`,
  `inferredRequirements`): by (constraint id, subject, slot);
- `excludedStrategies`: by candidate id; `candidateStrategies` and
  `candidateImplementations`: by `engine.rule.candidate-order` (E7 rule, itself
  deterministic through its rule-4 id tiebreak);
- `unresolvedQuestions`: by (stage order, questions.md rank, id);
- `dominanceApplied`, `gapRecords`, `relaxationOffers` (after the ordering rule's
  bands), `counterfactuals`: by id;
- `derivation`: pipeline-step order, then ref id.

Serialization is a fixpoint: emitting twice yields identical bytes (same stance as
the schema's generated projections, schema-proposal.md 1.3).

### 4.4 Unanswered-question semantics and next-question selection

The five rules of question-graph.md section 3.1 are consumed as data
(`engine-rules.json`) and are normative here without restatement:
`rule.unanswered-inert`, `rule.monotone-elimination`, `rule.retain-by-default`,
`rule.conditional-output` (the three emission shapes: clean / conditional /
transition-dependent), `rule.dominance-suppression`. Data-side uncertainty (`?`
and unresolved `c` cells) is flagged and never read as satisfied (REQ-MATRIX-05).

`nextQuestion` implements question-graph.md 3.2 (`rule.next-question`) as an
engine function; restated as the implementable procedure:

```text
nextQuestion(dataset, answers):
  S  := current survivor set (families, or members in stage 2)
  C  := askable nodes: unlock condition holds (edges), not pruned (E5),
        not dominance-suppressed (E8), not answered
  for q in C (iterate by stage order, rank, id):
    for each answer a of q:
      elim(q,a,S) := candidates in S removed by a's bindings, cell-verified
    guaranteed(q) := min over a of |elim(q,a,S)|   (with member lists kept)
    expected(q)   := G3 plausibility class of the eliminating answer
                     (common / plausible / rare; topology priors seed it)
    reach(q)      := count of nodes a's answers unlock or prune (G2)
  pick argmax by: guaranteed, then expected class, then reach,
                  then stage order, then rank, then id
  if no q has nonzero guaranteed or expected effect on the recommendation
  set (elimination or rank change): return null    (rule.question-closure)
```

Iteration order plus the final id tiebreak makes selection deterministic. The
cold start (no answers) degenerates to the entry node
`question.ownership.composition-parties` (question-graph.md 1.2). Every selection
is explainable as counts over named cells, never a utility score (REQ-Q-06).

---

## 5. Worked example: `scenario.acquisition-no-rewrite`, by hand

Fixture: [../scenarios/acquisition-no-rewrite.md](../scenarios/acquisition-no-rewrite.md)
(normalized inputs, section 2 of the brief; the brief itself is not updated here:
Phase 8 owns the trace section). Dataset: `version.research` 2026.08.0. Subject
label for the acquired product: `participant:expenses`.

### 5.1 E1 intake

| Brief input | Engine record |
|---|---|
| ownership facts (acquired, host-unmodifiable, multi-repo, independent-releases, all yes) | facts on `state.current`, provenance from Situation; answers rank 1 `question.ownership.composition-parties` |
| "acquired team keeps deploying independently; integration must survive their releases" (hard) | `question.deploy.independence` = `answer.deploy-independence.no-shared-train`: binds `constraint.independent-deploy` hard, origin `answer:question.deploy.independence` |
| "expenses will appear inside our product as one experience" | `question.granularity.single-screen` = yes: binds `constraint.single-screen-mixing` hard (product-shape fact) |
| `migration.appetite`(expenses, first-integration) = `migration.no-modification-possible` (hard) | fact; feeds E3 (R3 derivation-first: rank 4 battery not asked for this class) |
| host appetite up to `migration.moderate-refactor`; host-paid adapter work available | `question.migration.host-ceiling`: binds `constraint.host-modification-ceiling`(maxLevel=`migration.moderate-refactor`) hard |
| seamless look and feel, desired, compromisable at launch (strong preference) | `question.ux.seam-tolerance`: binds `constraint.seamless-ux` at `class.strong-preference` (not hard) |
| first integration live within two quarters (hard) | `engine.rule.horizon-select`: governing horizon = `migration.horizon.first-integration`; report risk line; no constraint id |
| CTO single-stack aspiration | `question.rule.state-fork`: septet on `dimension.adaptation-floor` (`state.target` = single stack, confidence `transition.confidence.planned-unapproved`, ordinal 3); buy-in record: `buyin.executive-sponsorship` partial, `buyin.budget`/`buyin.timeline`/`buyin.staffing` no |

### 5.2 E2 topology inference

`ownership.acquired-participant`=y (primary evidence) + host-unmodifiable +
multi-repo + independent-releases infer `topology.acquisition` for the
host/expenses boundary; `question.topology.confirm` confirmed (the brief's label
row is informational, facts govern). Priors armed (constraints.md 2.15,
acquisition row): hard tendencies already covered by explicit answers/derivations
below; preference tendencies `constraint.seamless-ux` (already answered) and
`constraint.bounded-exit` (enters as `prior-unconfirmed` strong preference; its
confirming question `question.trajectory.bounded-exit` goes to
`unresolvedQuestions`).

### 5.3 E3 derive closure

Fired:

- `derive.unmodifiable-participant-floor` (entailed; both `any` premises present:
  `ownership.host-unmodifiable-participant`=y and appetite level 9): binds
  `constraint.participant-modification-ceiling`(`participant:expenses`,
  maxLevel=`migration.integration-adapter`, payableBy=host) at
  `class.hard-constraint`.
- `derive.mixed-majors-present` (entailed; current estate runs two incompatible
  stacks; alignment unfunded: `buyin.budget`=no at confidence 3): binds
  `constraint.framework-major-coexistence` hard.

Not fired (premises absent): `derive.external-principal` (the acquired company is
not `ownership.external-participant`, so rank 5 never unlocks and
`constraint.distinct-principal` stays `class.irrelevant-by-default`),
`derive.broken-governance`, `derive.single-coordinated-team`,
`derive.no-cross-deploy-control` (one side does control its own host),
`derive.static-estate`, `derive.seo-surface`, `derive.regulated-release`,
`derive.plugin-admission`, `derive.white-label-fit`, `derive.b2b-chain`,
`derive.many-party-drift` (2 deploying parties), `derive.payload-budget`.

### 5.4 E4 composed binding set

| Constraint | Subject | Class | Params | Slot | Origin |
|---|---|---|---|---|---|
| `constraint.independent-deploy` | global | hard | | current | answer:question.deploy.independence |
| `constraint.single-screen-mixing` | global | hard | | current | answer:question.granularity.single-screen |
| `constraint.participant-modification-ceiling` | participant:expenses | hard | maxLevel=`migration.integration-adapter`, payableBy=host | current | derive.unmodifiable-participant-floor; facts ownership.host-unmodifiable-participant, migration.appetite |
| `constraint.framework-major-coexistence` | global | hard | | current | derive.mixed-majors-present; septet fact |
| `constraint.host-modification-ceiling` | host | hard | maxLevel=`migration.moderate-refactor` | current | answer:question.migration.host-ceiling |
| `constraint.seamless-ux` | global | strong-preference | | current | answer:question.ux.seam-tolerance |
| `constraint.bounded-exit` | global | strong-preference (prior-unconfirmed) | | current | topology.acquisition prior |

Target slot: `predicate.target-credible` over the `dimension.adaptation-floor`
septet: ordinal 3 < 5; alt path needs ordinal 4 plus `buyin.budget` and one of
timeline/staffing: fails (ordinal 3, budget=no). Result: the single-stack target
binds nothing in current-state evaluation (`rule.no-target-satisfies-hard`);
retained as an aspiration annotation feeding E13 (`rule.aspiration-warning`).

### 5.5 E5 relations

No `rel.excludes` pair is jointly hard (`constraint.atomic-release`,
`constraint.distinct-principal`, `constraint.payload-dedup`,
`constraint.sync-boundary-calls`, `constraint.static-hosting-only`,
`constraint.composed-first-paint` are all unbound). No `rel.relaxes` premise is
active (single-screen was affirmed, not negated). No warn edges armed; no gap
seeds queued.

### 5.6 E6 family-stage elimination (cells quoted from matrix-compact.tsv)

| Eliminated | Violated binding | Deciding cells |
|---|---|---|
| `family.modular-monolith`, `family.package-composition`, `family.spa-routing`, `family.server-templates`, `family.islands` | `constraint.independent-deploy` | `deployment.host-rebuild-required` = y for modular-monolith, monorepo-package-composition, plain-spa-routing, server-rendered-templates, islands-architecture, bit (commercetools-frontend c, condition fails the need); families.md section 5 "no independent deployment, by definition" |
| `family.route-partition` | `constraint.single-screen-mixing` | `runtime.concurrent-participants` = n for reverse-proxy-route-composition, nextjs-multi-zones, cloudflare-workers-microfrontends |
| `family.module-graph-federation` | `constraint.participant-modification-ceiling`(expenses, maxLevel=2) | participant floor 3 (`migration.participant.min-level` condition `migration.bundler-change` for module-federation; constraints.md 2.6 band) |
| `family.lifecycle-orchestration` | same ceiling | participant floor 4 (`migration.bootstrap-change`; constraints.md 2.6) |

Per-configuration exclusions inside surviving families (cell-level, E6 semantics):
`impl.qiankun` (min-level `migration.bootstrap-change`, ordinal 4 > 2),
`impl.hyperfrontend` (min-level `migration.bootstrap-change`: the hostee SDK must
run in participant pages; 4 > 2), luigi full-client posture (min-level condition:
`migration.trivial-adaptation` embed-only; `migration.bootstrap-change` full Luigi
Client participation: only the embed-only posture survives), `impl.entando`
(host-inversion, host floor 8 > `migration.moderate-refactor` ordinal 5, violates
`constraint.host-modification-ceiling`).

Survivors (with the surviving configuration named, coexistence cells checked
against `constraint.framework-major-coexistence`):

- `family.document-embedding`, embed-only posture: iframe-composition (min-level
  `migration.trivial-adaptation`; coexistence y), impl.luigi embed-only
  (`migration.trivial-adaptation`; coexistence y).
- `family.virtualized-rehosting`, HTML-entry configuration: impl.wujie,
  impl.micro-app-jd, impl.web-fragments client mode (all min-level
  `migration.trivial-adaptation`; coexistence y y y;
  `migration.participant.legacy-no-build-viable` y y y).
- `family.server-fragment-assembly`, conditional: floors 1 to 2
  (podium/opencomponents/server-side-fragment-composition `migration.integration-adapter`,
  edge-side-composition `migration.trivial-adaptation`, host-paid adapter endpoint
  around the unchanged app), but coexistence cells are c (edge-side, podium,
  server-side-fragment) and ? (opencomponents: flagged data uncertainty, never
  read as satisfied); plus the `constraint.no-new-infra-tier` weak-preference cost.
- `family.custom-element-composition`, conditional: adapter wrap at level 2
  (web-components-composition min-level `migration.integration-adapter`,
  host-paid), coexistence c; shared-realm interference exposure noted from family
  isolation field.

Engine-answered guards: `constraint.installable-today` and
`constraint.code-ownership` satisfied uniformly; no question spent.

### 5.7 E7 family ranking

All four survivors have the hard set satisfied. Status and order per
`engine.rule.candidate-order`:

1. `family.virtualized-rehosting`: `status.match.conditional` (condition:
   HTML-entry members only; per-configuration guarantees). Violates no strong
   preference (`ux.natural-layout-flow` y for the members). fit.architectural
   holds; fit.organizational holds (unmodified participant, independent cadence);
   fit.operational holds with the sandbox-maintenance cost noted;
   fit.transition-dependent no.
2. `family.document-embedding`: `status.match.viable`. Violates
   `constraint.seamless-ux` (strong): `ux.natural-layout-flow` = n for
   hyperfrontend and iframe-composition; reported as the explicit tradeoff
   (compromisable per the answer). All four fit flags as above;
   browser-enforced containment and zero co-residence coupling are its gained
   side.
3. `family.server-fragment-assembly`: `status.match.conditional` (conditions:
   fragment-endpoint adapter feasible for a whole SPA product; coexistence c
   cells; new infra tier accepted).
4. `family.custom-element-composition`: `status.match.conditional` (conditions:
   level-2 element wrap; coexistence c; no interference damping for a foreign
   stack in one realm).

Ordering note: 1 vs 2 is decided by rule 2 (document-embedding carries one named
violated strong preference, virtualized none); 2 vs 3 vs 4 by rule 1 (viable
before conditional) and rule 4 among the conditionals... corrected: 3 and 4 are
both conditional and follow 2; their mutual order falls to rule 2 (neither
violates a strong preference; tie) then rule 4 (id order,
`family.custom-element-composition` < `family.server-fragment-assembly`
lexicographically; disclosed as not meaningful). REQ-Q-04 is served: multiple
candidates, remaining tradeoffs explained; the discriminating unanswered
questions are listed below.

### 5.8 E8 dominance

Active: `dominance.html-entry-at-low-ceiling` (condition: rank 4 bound maxLevel
<= 2 for participant:expenses): within `family.virtualized-rehosting` the
HTML-entry members dominate the bootstrap-lineage member, so no stage-2 question
discriminates qiankun for this participant (qiankun is independently excluded by
the ceiling; the rule still suppresses its discriminators). Disclosed in
`dominanceApplied` with its condition. The four big path-shorteners are inactive
(their conditions fail: no train answer, single-screen affirmed, no
distinct-principal, no atomic-release).

### 5.9 E9 next-question and closure

Askable set after the answers above: `question.ux.chrome-persistence` (unlocked
by rank 3 yes), `question.delivery.server-capacity` (spine),
`question.failure.containment` (co-residence confirmed),
`question.deps.payload-budget`, `question.contracts.sync-calls` (survivors span
serialized and live boundaries), `question.trajectory.bounded-exit`,
`question.trajectory.legacy-horizon`, `question.trajectory.integration-duration`,
`question.migration.strangler`, `question.trajectory.no-transition-outcome`
(mandatory before E13's warning slot). Suppressed as zero-gain:
`question.coordination.upgrade-train` (every surviving member is
`deps.duplicated`; no answer changes any output, relevance law 1.4.3), rank 11
(already derived), stage-2b operability block (no edition-splitting candidate
survives and no `derive.b2b-chain`).

Sample selection table over S = 4 families (worst-case gains):

| Candidate q | guaranteed | expected class | reach |
|---|---|---|---|
| `question.ux.chrome-persistence` | 0 | common (host chrome in a one-experience product) | prunes classic fragment members |
| `question.failure.containment` | 0 | plausible (semi-trusted boundary) | unlocks rank 10 follow-through, memory note |
| `question.delivery.server-capacity` | 0 | rare (200-engineer platform org) | warn edge to rank 8 |
| `question.contracts.sync-calls` | 0 | rare | none |
| `question.deps.payload-budget` | 0 | rare (no budget fact) | none |

argmax by (guaranteed=0 tie, expected class): `question.ux.chrome-persistence`
is asked next. The fixture supplies no further answers, so the engine emits under
`rule.conditional-output` shape 2 (conditional): some unanswered questions could
still eliminate recommended candidates, and each is named with its overturning
answer in `unresolvedQuestions` (e.g. containment-hard would eliminate
`family.custom-element-composition` and restrict virtualized to the
wujie/web-fragments-client cells; a chrome-persistence hard answer would drop the
classic fragment members; a sync-calls hard answer would eliminate
`family.document-embedding`). `question.trajectory.no-transition-outcome` is asked
before emission because a `fit.transition-dependent` slot entry is pending; the
brief's own guardrail supplies the answer: the embedding remains acceptable if
convergence never happens (`migration.permanent-viability` y for iframe-composition
and luigi cells).

### 5.10 E10 to E12 stage 2 and the availability lens

Members evaluated (surviving configurations only); no implementation-stage
question is answered, so lens constraints stay inert and availability is pure
annotation:

| Candidate | Config | Availability (independent factor) | Notable lens facts |
|---|---|---|---|
| iframe-composition (practice unit; family substance, no impl record) | embed-only | n/a (browser primitive) | `migration.permanent-viability` y; `unit.availability.stable-line-shipped` na |
| impl.luigi | embed-only mode | `avail.available` | org steward y (SAP), multi-maintainer y, stable line y; `ux.screenreader-continuity` c (per-frame titles) |
| impl.wujie | HTML-entry | `avail.available` | multi-maintainer n; `migration.permanent-viability` c |
| impl.micro-app-jd | HTML-entry | `avail.available-immature` (perpetual RC) | adoption below threshold |
| impl.web-fragments | client reframing | `avail.available-immature` (beta, stalled cadence) | roadmap items are `avail.future-roadmap`, satisfy nothing |
| impl.podium / impl.opencomponents / practice units | fragment adapter | `avail.available` / `avail.available` | opencomponents coexistence ? flagged |
| web-components-composition (practice) | element wrap | n/a | interference exposure |

Excluded at stage 2 with origin chains: impl.hyperfrontend (participant floor
`migration.bootstrap-change` > ceiling 2; origin
derive.unmodifiable-participant-floor), impl.qiankun (same), impl.entando (host
floor > `migration.moderate-refactor`; origin
answer:question.migration.host-ceiling). No availability exclusions (nothing
recommended is deprecated/inactive).

### 5.11 E13 dual output

- `slots.bestToday`: the section 5.7 ordering, headed by
  `family.virtualized-rehosting` (HTML-entry) and `family.document-embedding`
  (embed-only) with their stage-2 member lists above. Always produced; depends on
  no aspiration (guardrail 2 satisfied).
- `slots.bestAfterTransition`: the single-stack target is not credible (5.4), so
  the slot carries the `rule.aspiration-warning` conditional, not a
  recommendation: `family.module-graph-federation` with
  `status.match.conditional`, `fit.transition-dependent` holds,
  `dependsOnTransitions: [{dimension: dimension.adaptation-floor, confidence:
  transition.confidence.planned-unapproved}]`, missing signals listed
  (`buyin.budget`, `buyin.timeline`, `buyin.staffing`), and the
  no-transition-outcome answer attached (the today architecture is acceptable
  permanently, so the recommendation is robust under the 3x probe).

### 5.12 E14 to E16 gaps, relaxation, counterfactuals

`gapRecords`: empty (survivor set non-empty; no gap-trigger constraint bound).
`relaxationOffers`: empty (offers exist only when the hard set empties a space;
REQ-GAP-01 not triggered). `counterfactuals` (mechanics in section 6):

1. From the relaxation ledger row for
   `constraint.participant-modification-ceiling` (maxLevel<=2): "raise the
   ceiling to `migration.bundler-change` (3): `family.module-graph-federation`
   returns; to `migration.bootstrap-change` (4): `family.lifecycle-orchestration`
   plus the SDK postures return (impl.qiankun, impl.hyperfrontend, luigi full
   client)". Refs: relaxation row, families.md 3.4/3.5 migration fields. This is
   the earn-out counterfactual the brief's guardrail 4 demands.
2. From dominance conditions: withdrawing the maxLevel<=2 condition dissolves
   `dominance.html-entry-at-low-ceiling` and unlocks qiankun discrimination.
3. From unanswered eliminating answers (shape-2 emission):
   containment-hard drops `family.custom-element-composition`; sync-calls-hard
   drops `family.document-embedding`; chrome-hard drops the classic
   fragment members; each recorded as `{candidate, wouldBecome:
   status.match.incompatible, if: <answer>, refs}`.
4. From the credibility flip: "if the single-stack transition reaches
   `transition.confidence.teams-committed`, or `leadership-approved` plus
   `buyin.budget` and one of timeline/staffing, re-run: `slots.bestAfterTransition`
   gains `family.module-graph-federation` as a genuine candidate".

### 5.13 E17 emission and derivation sample

Derivation lines (display grammar), a sample of the full graph:

```text
Recommendation: family.virtualized-rehosting (HTML-entry)   [status: conditional]
Recommendation: family.document-embedding (embed-only)      [status: viable]

Why:
+ participant integrates unmodified                (migration.participant.min-level = migration.trivial-adaptation)
+ survives independent participant releases        (deployment.host-rebuild-required = n)
+ incompatible stacks coexist indefinitely         (framework.same-framework-major-coexistence = y)

Tradeoffs accepted:
~ document-embedding: seam engineering vs one-document flow   (ux.natural-layout-flow = n; constraint.seamless-ux violated at strong)
~ virtualized-rehosting: sandbox tax, damping-only trust      (performance.sandbox-execution-tax; trust.interference-damped)

Derived from:
question.deploy.independence -> "no shared release train"     (constraint.independent-deploy)
ownership.host-unmodifiable-participant -> derive.unmodifiable-participant-floor
  -> constraint.participant-modification-ceiling(expenses, maxLevel=2)
question.granularity.single-screen -> "one screen, two owners" (constraint.single-screen-mixing)
```

### 5.14 Guardrail check (brief section 3; the brief itself is not modified)

| Guardrail | Result |
|---|---|
| No recommended strategy modifies the acquired app's source/build/bootstrap/release; only host-payable work at level <= 2 | PASS: every retained configuration has min-level `migration.trivial-adaptation` or host-paid `migration.integration-adapter`; SDK/bootstrap postures excluded per configuration |
| `recommendation.best-today` independent of the single-stack aspiration; aspiration appears only as warning-annotated `fit.transition-dependent` | PASS: 5.4 predicate failure, 5.11 slot handling |
| Trace answers `question.trajectory.no-transition-outcome` | PASS: asked before emission (5.9); today architecture permanently acceptable |
| Migration eliminations carry counterfactuals | PASS: 5.12 item 1 |
| Single-codebase consolidation inadmissible | PASS: baselines excluded by `constraint.independent-deploy` (and level-6 extraction exceeds both ceiling and horizon) |

Outcome class exercised: `trust.other-oss` (the strongest current candidates are
non-HyperFrontend OSS units and browser practice; impl.hyperfrontend is excluded
by the participant ceiling with its counterfactual stated). Allowed by the brief;
the engine did not steer around the sponsor's elimination (REQ-MISSION-01).

---

## 6. Counterfactual duty (REQ-Q-07): computed, never authored

`counterfactuals` entries are generated from four data sources; no free-text
counterfactual may be emitted without one of these as its `refs` base:

1. **Elimination inversion via the relaxation ledger** (`relaxation.json`): for
   every hard binding that produced exclusions, look up the ledger row(s) for
   (constraint, params). Each row supplies the smallest meaningful relaxation and
   the exact reopened candidates with consequences; parameterized rows
   (ceilings) walk the scale ordinally to the next level that readmits at least
   one candidate. Emitted as `{candidate, wouldBecome, if: <relaxation>, refs:
   [row, family cost fields]}`.
2. **Dominance conditions** (`dominance.json`): each active rule contributes "if
   condition X is withdrawn, the dominated set re-enters discrimination and the
   suppressed questions unlock", refs the rule id and its conditions.
3. **Unanswered eliminating answers** (`rule.conditional-output` shape 2): for
   each still-askable question whose some answer would eliminate a retained
   candidate, emit the downward counterfactual "if you later find X, Y becomes
   incompatible", refs the question and binding it would produce. This is the
   same computation `unresolvedQuestions.couldStillChange` uses; the two fields
   cite the same records.
4. **Credibility flips** (`predicate.target-credible` + buy-in records): for each
   non-credible target that E13 downgraded, emit "if the predicate passes (name
   the exact missing signals / ordinal step), re-run; slot gains Z", refs the
   septet, the buy-in record, and the predicate id.

Ordering: sources 1 and 4 follow `rule.relaxation-ordering` bands when they act
as relaxations; sources 2 and 3 follow candidate order. Symmetry duty: the report
must carry at least one counterfactual per excluded family whose exclusion came
from a single hard binding (the cheapest thing that would change the answer), and
one per recommended candidate (the cheapest thing that would overturn it); both
fall out of sources 1 and 3 mechanically.

---

## 7. REQ-TRUST-01 expressibility gate

Verification that `EngineOutputs` can express all seven outcome classes
(ids per [../scenarios/README.md](../scenarios/README.md); report vocabulary per
report-design.md section 9). Gate verdict: **PASS**; no outcome requires a shape
this file does not produce.

| Outcome | Engine expression |
|---|---|
| `trust.hf-community` | `candidateImplementations` headed by `impl.hyperfrontend.community` at `status.match.strong`/`viable`; availability annotation `avail.available-immature` carried independently (E12) |
| `trust.other-oss` | produced by the section 5 trace: non-HF OSS heads the ordering while the sponsor's unit sits in `excludedStrategies` with its origin chain and counterfactual |
| `trust.commercial` | a commercial edition/implementation heads the ordering (e.g. `impl.nextjs-multi-zones.vercel-platform`, `impl.bit.cloud`) with edition provenance; nothing in E7/E10 tests vendor identity (`engine.rule.no-vendor-branching`) |
| `trust.hfe-future` | `status.match.future-potential` on `impl.hyperfrontend.enterprise` with REQUIRED `pairedAvailableToday` naming the shipping alternative (schema 3.21 guard; REQ-AVAIL-02); planned capabilities satisfy no binding (E11) |
| `trust.no-match` | `assessmentStatus: status.assessment.no-current-strong-match` + `gapRecords` + ordered `relaxationOffers` (E14/E15); the bar is never lowered (REQ-GAP-01) |
| `trust.no-mfe` | baseline families head `candidateStrategies` after `derive.single-coordinated-team` + the rank-2 train branch (`dominance.fused-baselines-over-mfe`); reachable after two question events (REQ-Q-04) |
| `trust.change-assumptions` | shape-2/3 conditional emission plus `counterfactuals`/`relaxationOffers` naming the exact assumption changes that open candidates (sections 4.4 and 6) |

If a future model change makes any row above unproducible (for example a schema
change dropping `pairedAvailableToday`, or a status enum losing a member), that is
a Phase-7-gate regression and blocks release (versioning-strategy.md 1.2:
full fixture run before any model MAJOR).

---

## 8. Coverage check

| Requirement | Where satisfied |
|---|---|
| REQ-ENGINE-01 | Section 1 (declarative guards), section 3.1 (eight fields verbatim, producers named) |
| REQ-ENGINE-02 | Section 2 pipeline order (facts -> constraints -> inferred requirements -> strategies -> implementations); `engine.rule.no-vendor-branching` |
| REQ-Q-06 | `engine.rule.no-scores`; `engine.rule.candidate-order` (counts of named items, disclosed ties); 4.4 gain-as-counts |
| REQ-Q-07 | Section 6 (four computed sources; symmetry duty); worked instances 5.12 |
| REQ-AVAIL-03 | E12 `engine.rule.availability-lens`; 3.2 factor separation; 5.10 annotations |
| REQ-GAP-01 | E14 (never lower the bar; exact gap named); 7 (`trust.no-match` row) |
| REQ-GAP-03 | E15 ordering per `rule.relaxation-ordering`; ledger-driven offers |
| REQ-TRUST-01 | Section 7 gate: PASS with per-outcome expression |
| REQ-REPORT-01 | Section 4 determinism contract (pure functions, no clock, canonical ordering, version pinning) |
| REQ-REPORT-02 | Section 3.3 `engine.rule.full-chain`; 5.13 sample derivation |
| REQ-ORCH-10 | Section 4.4 (five unanswered rules consumed; `nextQuestion` restated as a deterministic engine function); 5.9 worked selection |
| REQ-STATE-02/06/10/12 | E4/E13 slots and Conway rules; fit flags in E7; `engine.ordering` mapping at end of section 2 |
| REQ-ENT-01/03 | `engine.rule.stage-firewall`; E11 edition semantics |

Phase-8 note: the section 5 walk is this file's specification-by-example; the
durable fixture trace (brief section 4) is produced in Phase 8 with this pipeline
and must reproduce sections 5.6 to 5.12 or fault the abstraction, never add a
special case (REQ-ORCH-11).
