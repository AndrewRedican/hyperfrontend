# Conditional-Relevance Question Graph

Status: DERIVED v1 (2026-08-29). Deliverable 7 (MASTER.md section 16). Requirements
served: REQ-Q-03 (progressively-disclosed conditional graph, not a tree, never a
100-question survey), REQ-Q-08 (dominance relationships that skip questions),
REQ-ORCH-10 (unanswered-question tolerance and "single most useful next question"),
REQ-Q-09 (two-level stage boundary), REQ-Q-04 (short honest exits), REQ-Q-07
(counterfactual duty on conditional outputs).

Inputs, linked not restated (REQ-OPS-03): question ids, gain numbers, answer classes,
and unlock conditions from [questions.md](questions.md) (this file wires, never
redefines); constraint bindings, derivation rules (`derive.*`), and the relation set
(`rel.requires` / `rel.excludes` / `rel.relaxes`) from
[constraints.md](constraints.md) sections 3 and 4; family evidence from
[families.md](families.md); matrix rows from
[../matrix/matrix-compact.tsv](../matrix/matrix-compact.tsv); topology inference and
fact checklist from [topology.md](topology.md) sections 3 and 4; state fork and
credibility from [state-transition.md](state-transition.md); migration batteries from
[migration.md](migration.md) section 8; operability seeds from
[enterprise-layer.md](enterprise-layer.md) section 3.

Verification inheritance: every elimination cited under a dominance rule or edge is
verified in constraints.md section 2 against matrix cells and family sections; this
file adds only *relevance* structure (when a question is worth asking), never new
elimination claims (REQ-FRAME-02, REQ-ORCH-08).

---

## 1. The graph (REQ-Q-03)

### 1.1 Nodes and edge types

Nodes are the question ids fixed in questions.md (sections 3 to 7), plus one
inference-confirmation node this file introduces:

- `question.topology.confirm` : after the rank-1 facts, the engine shows the inferred
  topology label for confirmation; a rejected inference reveals a mismodeled situation
  at the cheapest possible moment (topology.md section 4: the graph never asks "which
  topology are you?").

Edge types (engine data):

| Edge type | Meaning | Grounded in |
|---|---|---|
| `edge.spine` | unconditionally relevant once the stage is entered | questions.md gating column ("always") |
| `edge.unlocks` | answer X to Q makes Q' relevant | per-question "Unlocks" fields; `derive.*` premises |
| `edge.prunes` | answer X to Q makes Q' vacuous (asking it could not change any output) | `rel.relaxes` rows, constraints.md section 4 |
| `edge.warns` | answer X to Q makes a hard answer to Q' jointly unsatisfiable; Q' is still asked, with the exclusion shown at ask time (REQ-GAP-01) | `rel.excludes` rows |
| `edge.forks` | a future-tense answer to Q forks into the septet and readiness pair | `question.rule.state-fork`, questions.md section 4 |

This is a graph, not a tree (REQ-Q-03): `question.trust.malicious-participant` has
three in-edges (rank 1 external-party facts, rank 13 plugin-author confirm, rank 14
customer seat); the trajectory battery has in-edges from ranks 1, 2, and 4; rank 15
has in-edges from ranks 3 and 10. No node has two "parents" that disagree about its
content, only about its relevance.

### 1.2 Entry nodes

Exactly one entry node: `question.ownership.composition-parties` (rank 1). Everything
else is reachable only through it (questions.md 3.1: asking anything else first risks
wasted questions, REQ-ORCH-10). The spine after it:
`question.topology.confirm` then rank 2, rank 3, rank 4 (per surviving participant
class, section 4 restructuring R1), rank 7. Ranks 5, 6, 8 to 16 are all conditional.

### 1.3 Adjacency (edge.unlocks and edge.prunes)

| From (answer condition) | Makes relevant | Basis |
|---|---|---|
| rank 1 (any) | `question.topology.confirm`, rank 2 | questions.md 3.1 |
| rank 1 (external party owns a piece; plugin authors; b2b hop) | rank 5 (confirm mode) | `derive.external-principal`, `derive.plugin-admission`, `derive.b2b-chain` |
| rank 1 (user's product is the embedded party) | rank 14 | `derive.white-label-fit` |
| rank 1 (participants unknown at host ship time + no cross-deploy control) | rank 13 (confirm mode) | `derive.plugin-admission` |
| rank 1 (any fact answered current vs target divergent) | trajectory battery | `edge.forks`; questions.md section 4 |
| rank 2 (independent-deploy binds hard or strong) | `question.impl.drift-machinery` relevance (stage 2), `question.trajectory.bounded-exit` | questions.md 3.2 |
| rank 2 (atomic-release hard) | family stage ends; jump to stage 2 | dominance.fusion-subsumes-drift-and-dedup (2.2); questions.md 3.2 |
| rank 2 (future tense) | `question.deploy.independence.value` + `.readiness` | `edge.forks` |
| rank 3 (yes: single-screen mixing) | `question.ux.chrome-persistence`; ranks 6, 9, 11, 12, 15 become reachable | questions.md 3.3 |
| rank 3 (no: page seams acceptable) | prunes ranks 6, 9, 11, 12, 15 and `question.ux.chrome-persistence` follow-through | `rel.relaxes` (single-screen negated), constraints.md s4 |
| rank 4 (acquisition/legacy facts) | `question.trajectory.legacy-horizon`, `question.trajectory.integration-duration`, `question.migration.strangler` | questions.md 3.4 |
| rank 4 (any ceiling stated) | `question.migration.host-ceiling` | questions.md 3.4 |
| rank 5 (distinct-principal hard) | rank 10 via `edge.warns` (`gap.secure-seamlessness`); `question.guard.verbatim-bytes` when regulated facts present; identity block reference (stage 2b) | constraints.md s4; questions.md 3.5 |
| rank 5 (distinct-principal hard) | prunes the interference-damping and css follow-ups | `rel.relaxes` (browser boundary subsumes damping); dominance.browser-boundary (2.2) |
| rank 6 (governance impossible, hard) | prunes rank 12's hard form (presented as tradeoff acknowledgment, `gap.autonomous-dedup` with rank 2) | `rel.requires` on payload-dedup; questions.md 3.12 |
| rank 7 (static-hosting hard) | `edge.warns` to rank 8 (joint bind redirects to prerendered baselines); prunes `constraint.no-new-infra-tier` question form | `rel.excludes`, `rel.relaxes` static-implies-no-tier |
| rank 8 (SEO premise yes) | rank 8 confirm sub-question; hard bind adds `edge.warns` to `question.ux.chrome-persistence` | questions.md 3.8, constraints.md 2.5 |
| rank 9 (containment hard) | rank 10; `constraint.main-thread-protection` and `constraint.css-containment` follow-ups; memory-budget cost note | questions.md 3.9 |
| rank 10 (survivors span serialized and live boundaries) | rank 15 | questions.md 3.15 gating |
| rank 13 (roster-change hard) | rank 5 confirm; `question.impl.paved-road` preference; stage-2b review/registry seeds | questions.md 3.13 |
| rank 14 (host ceiling 1 hard) | stage-2b b2b credentials block; rank 5 from the customer's seat | questions.md 3.14; topology.md 2.8 |
| rank 16 (either pole) | bridge to stage 2; hard no-strategy-runtime prunes `question.impl.paved-road` hard-ish forms | `rel.excludes` no-strategy-runtime vs paved-road |
| trajectory (credible target exists) | `question.trajectory.funding`, `question.trajectory.authority` | questions.md section 4 |
| any `fit.transition-dependent` output pending | `question.trajectory.no-transition-outcome` (mandatory before emission) | questions.md section 4; state-transition.md s7 |
| stage 2 entered (regulated facts) | `question.impl.rollback-actuation` entailed-hard confirm; `question.guard.verbatim-bytes` | `derive.regulated-release` |
| stage 2 entered (3+ deploying parties + drift-surface=y survivors) | `question.impl.drift-machinery` escalated | `derive.many-party-drift` |
| stage 2 complete | stage 2b operability groups; `derive.b2b-chain` unlocks the identity/commerce group | REQ-ENT-03; enterprise-layer.md s3 |
| user raises RSC / supply-chain policy facts appear | `question.guard.rsc-federation` / `question.guard.artifact-integrity` | questions.md section 7 |

Warn edges not already listed (`edge.warns`, all from constraints.md section 4):
rank 5 vs rank 12 (`gap.untrusted-dedup`), rank 5 vs rank 15, rank 9 vs rank 15,
rank 13 (ownerless atom) vs `question.impl.delivery-governance` intermediary atom
(`gap.governed-ownerless-onboarding`). A warn edge fires at ask time, so contradictory
hard sets are caught before the report (REQ-GAP-01).

### 1.4 Progressive-disclosure contract

1. **Circumstances first**: every stage-1 entry-side question is answerable from the
   user's situation with zero architecture vocabulary (the C phrasings of questions.md;
   REQ-AUD-01). The first three screens ask who ships what, whether a release train is
   livable, and whether two teams' work shares a screen. No mechanism is named before
   the user's facts make it meaningful (REQ-Q-05).
2. **Terminology taught at first relevance**: the migration level scale appears only
   when rank 4 unlocks (with the scale shown inline); "principal/containment" language
   only at rank 5; drift/contract vocabulary only at stage 2 when
   `derive.many-party-drift` holds; "edition" vocabulary only at stage 2b. The
   topology label is never asked, only inferred and confirmed
   (`question.topology.confirm`).
3. **Relevance = could change an output**: a node is presented only when (a) its
   unlock condition holds and (b) its dynamic gain over the current survivor set is
   nonzero (section 3.2). Rank 15's gating ("zero gain otherwise, so the graph
   suppresses it") is the general law, applied to every node.
4. **Engine-answered, never displayed**: `constraint.installable-today` and
   `constraint.code-ownership` (uniform columns; questions.md section 7).

---

## 2. Dominance relationships (REQ-Q-08)

### 2.1 Semantics

`dominance.<slug>` : under stated conditions, candidate set X offers no advantage over
candidate set Y, so every question whose only remaining effect is to discriminate X
from Y is suppressed. Dominance is not elimination: dominated candidates stay in the
survivor set (rule.monotone-elimination, section 3), their discriminating questions
are merely skipped, and the report discloses each applied dominance rule with its
conditions so the trace stays auditable (REQ-REPORT-02). If the user later withdraws a
condition, the dominance dissolves and the suppressed questions unlock.

### 2.2 Rules (each verified; matrix row values quoted from matrix-compact.tsv)

- **`dominance.fused-baselines-over-mfe`** : conditions:
  `derive.single-coordinated-team` fired (rank 1) AND rank 2 answered
  train-acceptable. Then no MFE family offers any advantage over the baseline group,
  because every advantage the seven MFE families carry binds exactly the constraints
  that rule re-classed irrelevant (`constraint.independent-deploy`,
  `constraint.no-version-governance`, `constraint.framework-major-coexistence`,
  `constraint.runtime-roster-change`; constraints.md section 3), while the baselines
  are strictly better on the two axes that remain live.
  Matrix verification: `performance.shared-dependency-dedup` = y for
  modular-monolith, monorepo-package-composition, plain-spa-routing,
  islands-architecture, bit (vs n for hyperfrontend, iframe-composition, luigi,
  qiankun, wujie, opencomponents, podium); `contracts.drift-surface` = n for those
  same baseline units (drift structurally impossible) vs y for every deploy-decoupled
  unit. Family evidence: families.md section 5 ("the positions that dissolve the
  entire microfrontend question load").
  Skips: ranks 5 to 16 and the whole co-residence cluster; the family stage closes
  after two questions (the REQ-Q-04 exit).
- **`dominance.route-partition-over-coresident-runtimes`** : conditions: rank 3
  answered no (page seams acceptable) AND `constraint.persistent-chrome` not required
  AND `constraint.cross-boundary-soft-nav` not required. Then
  `family.module-graph-federation`, `family.lifecycle-orchestration`, and
  `family.virtualized-rehosting` offer no advantage over `family.route-partition`:
  the only capabilities route-partition lacks are same-screen co-display, persistent
  chrome, and soft navigation, which are exactly the three waived conditions, while
  the co-resident families cost strictly more (standing version governance, higher
  participant floors, a shipped runtime).
  Matrix verification: route-partition members reverse-proxy-route-composition,
  nextjs-multi-zones, cloudflare-workers-microfrontends score
  `runtime.concurrent-participants` = n/n/n, `ux.persistent-shared-chrome` = n/n/n,
  `ux.cross-boundary-soft-nav` = n/n/n (the lacks, all waived) and
  `coordination.shared-dependency-governance` = n/n/n, while module-federation,
  native-federation, import-map-architectures, single-spa, piral all score y on
  governance; `deployment.host-rebuild-required` = n for all three route-partition
  members (independence preserved). Family evidence: families.md 3.1 works-well.
  Skips: ranks 6, 9, 11, 12, 15 (already pruned by the rank-3 edge) plus rank 16 at
  family scope (route-partition is `orchestration.primitive`).
- **`dominance.browser-boundary-over-simulated-realm`** : condition:
  `constraint.distinct-principal` bound hard (rank 5). Then
  `family.virtualized-rehosting` offers no advantage over
  `family.document-embedding`: every virtualization advantage (closer UX integration,
  shared-realm interop at damping trust) is unusable under a malice adversary, and
  virtualization is never a security boundary (REQ-MATRIX-05).
  Matrix verification: `security.untrusted-third-party-viable` = n for qiankun,
  micro-app-jd, wujie, web-fragments (all four virtualized members) vs c for
  hyperfrontend and iframe-composition; `isolation.security.malicious-participant` =
  n for all virtualized members vs c for hyperfrontend, iframe-composition,
  reverse-proxy-route-composition. Relation evidence: `rel.relaxes`
  distinct-principal subsumes `constraint.interference-damping` (constraints.md s4).
  Skips: the interference-damping follow-up, the css-containment follow-up (browser
  boundary enforces both directions, families.md 3.7), and rank 11's discrimination
  work among survivors (document embedding scores
  `framework.same-framework-major-coexistence` = y for hyperfrontend and
  iframe-composition).
- **`dominance.fusion-subsumes-drift-and-dedup`** : condition:
  `constraint.atomic-release` bound hard (rank 2 train branch). Payload dedup is
  satisfied by construction (`deps.single-copy-by-build`) and drift machinery is
  pointless (drift structurally impossible), so ranks 12 and 15 and
  `question.impl.drift-machinery` are never asked.
  Matrix verification: `performance.shared-dependency-dedup` = y and
  `contracts.drift-surface` = n for modular-monolith, monorepo-package-composition,
  plain-spa-routing, islands-architecture, bit (commercetools-frontend NA cells noted
  per REQ-MATRIX-05). Relation evidence: `rel.relaxes` atomic-release relaxes
  explicit-drift-surfacing (constraints.md s4).
- **`dominance.static-subsumes-infra-tier`** : condition:
  `constraint.static-hosting-only` bound hard (rank 7). The no-new-infra-tier
  question is never asked: static delivery already implies no composition tier
  (`rel.relaxes` row, constraints.md s4; matrix `deployment.strategy-service-in-path`).
- **`dominance.html-entry-at-low-ceiling`** (stage 2, implementation scope): within
  `family.virtualized-rehosting`, when rank 4 bound maxLevel<=2 for a participant,
  the HTML-entry members (micro-app-jd, wujie, web-fragments client mode) dominate
  the bootstrap-lineage member (qiankun, floor 4: constraints.md 2.6, questions.md
  3.4), so no stage-2 question needs to discriminate qiankun for that participant.

The first four rules are the load-bearing path-shorteners; rules one to four are each
verified above against named matrix rows (the phase requirement of at least 3 real
verified dominance rules is met by rules 1, 2, 3, and 4 independently).

---

## 3. Unanswered-question semantics (REQ-ORCH-10)

### 3.1 Rules

- **`rule.unanswered-inert`**: an unanswered question binds nothing; its constraints
  stay `class.irrelevant-by-default` (constraints.md 1.2). No elimination ever
  follows from silence, and no question defaults to hard.
- **`rule.monotone-elimination`**: elimination flows only from bound hard constraints
  (explicit answers or entailed `derive.*` premises whose facts are present). More
  answers only shrink the survivor set; therefore any elimination already performed
  is final regardless of gaps, and the engine may report exclusions at any time
  (`excludedStrategies` with origin chains, REQ-ENGINE-01).
- **`rule.retain-by-default`**: every candidate not eliminated is retained and
  reportable, with `unresolvedQuestions` listing what remains askable and what each
  remaining answer could still change.
- **`rule.conditional-output`**: the engine may emit a recommendation despite gaps in
  exactly three shapes:
  1. **clean**: every still-askable question has, over the current survivors, only
     preference effect (its constraint ceilings among survivors are strong/weak, or
     its eliminating answers eliminate nothing that remains). Recommendation is
     emitted with unresolved preferences listed as tradeoffs (REQ-REPORT-03).
  2. **conditional**: some unanswered question could still eliminate a recommended
     candidate. The recommendation is emitted labeled conditional, naming that
     question and the answer that would overturn it; this doubles as the REQ-Q-07
     counterfactual ("if you later find X, the answer becomes Y").
  3. **transition-dependent**: gaps are in credibility, not facts; the
     state-transition.md section 4 downgrade rule applies, and
     `question.trajectory.no-transition-outcome` must be asked first (section 1.3).
  Uncertainty in the data itself (`?` cells, unresolved conditional cells) is flagged
  per REQ-MATRIX-05 and never read as satisfied.
- **`rule.dominance-suppression`**: a question suppressed by an active dominance rule
  is not "unanswered" for output purposes; it is irrelevant-while-dominated and is
  excluded from `unresolvedQuestions` (with the dominance id recorded instead).

### 3.2 The single most useful next question (`rule.next-question`)

Data-driven, computed per turn over the *current* survivor set S (never the static
ranking of questions.md, which is the cold-start special case where S = everything):

1. Candidates: every node whose unlock condition holds, not pruned, not suppressed by
   dominance, not already answered.
2. For each candidate q and each of its answers a, compute `elim(q,a,S)`: the
   families/implementations in S removed by the bindings a would produce, evaluated
   against matrix cells (the same verification chain as constraints.md section 2).
3. Guaranteed gain = min over a of `elim(q,a,S)` (worst case); expected gain uses the
   G3 plausibility classes (common / plausible / rare, seeded by topology priors,
   constraints.md 2.15) as ordinals, never numeric weights (REQ-Q-06).
4. Select argmax by guaranteed gain; tie-break in order by expected-gain class, then
   class-setting reach (G2: how many other nodes the answer unlocks or prunes), then
   stage order, then questions.md rank.
5. **`rule.question-closure`** (stop rule): stop asking when no candidate question has
   nonzero guaranteed or expected effect on the recommendation set (elimination or
   rank change). At closure the engine reports; anything still open goes to
   `unresolvedQuestions` under rule.conditional-output.

Every selection is explainable as counts over named matrix cells ("this question can
eliminate 4 of your 6 surviving families; no other askable question can eliminate
more than 1"), which keeps REQ-Q-06's no-numeric-scoring discipline: counts of
eliminated candidates are structural facts, not utility scores.

---

## 4. Worst-path count (phase gate)

### 4.1 Counting discipline

One "question event" = one prompt the user answers (a composite screen with a fixed
small set of sub-facts, such as the three capability preconditions, counts as one
event; its parts are never split across screens). Report-stage relaxation offers
(constraints.md 6.2) are excluded: they occur only when the hard set is empty,
replacing further questioning rather than adding to it.

### 4.2 Restructurings applied (documented per the gate)

The unrestructured graph failed the gate two ways: the rank-4 battery was linear in
participant count (10 participants = 40+ events, unbounded in principle), and stage
2b was a 17-item binary survey. Path total for the worst scenario exceeded 85 and
was unbounded. Three restructurings fix it; they are graph structure, present in the
walk below:

- **R1, ownership-class batching**: the rank-4 battery (preconditions + level probes)
  is asked once per *ownership class* of participants (own-team / acquired-or-legacy /
  external-vendor; cap 3), not per participant; participants in one class share
  bindings, and the level probe bisects the migration scale (at most 3 probes reach
  any level on the 9-level scale) instead of walking it. Battery = 1 preconditions
  composite + at most 3 probes = 4 events per class, 12 worst case, independent of
  participant count. Per-participant deviations inside a class are captured by
  exception ("does any piece in this group differ?"), which is part of the
  preconditions composite.
- **R2, operability grouping**: the 15 stage-2b seeds + targeting collapse into 3
  grouped composite events (hosting/registry, governance, identity/commerce) plus
  `question.edition.operability.managed-service-preference` plus
  `question.edition.targeting` = 5 events (REQ-ENT-07 atoms stay atomic as data;
  only the presentation is grouped).
- **R3, derivation-first**: any question whose binding is entailed by present facts is
  never asked (rank 11 mostly, rank 4 in four topologies); confirm-mode derivations
  cost 1 confirmation event instead of a full question (ranks 5, 8, 13). Already
  fixed in questions.md/constraints.md; the graph enforces it via edge conditions.

### 4.3 The walk

Worst constructible journey (all pruners dodged): b2b-distribution vendor with an
acquired legacy participant and an external one, plugin admission, single-screen
mixing, SEO surface, regulated releases, a credible reorg target, RSC raised, full
stage 2 and 2b. Counts:

| Segment | Events |
|---|---|
| rank 1 + topology confirm | 2 |
| rank 2 (current + value + readiness fork) | 3 |
| rank 3 + chrome follow-up | 2 |
| rank 4 batteries (3 classes x 4, R1) + host-ceiling + strangler | 14 |
| ranks 5, 6, 7 | 3 |
| rank 8 (premise + confirm) | 2 |
| rank 9 (+ main-thread, css follow-ups) | 3 |
| rank 10 (seam + a11y) | 2 |
| ranks 11, 12, 13, 14, 15, 16 | 6 |
| trajectory battery (9 ids + bounded-exit) | 10 |
| guards (verbatim-bytes, artifact-integrity, rsc-federation) | 3 |
| stage 2 (5.1 to 5.6) | 6 |
| stage 2b (R2 groups + preference + targeting) | 5 |
| **Worst-path total** | **61** |

**The number: 61 question events**, bounded and participant-count-independent. It is
reachable only by the maximal scenario above dodging both great pruners (rank 2 train
branch, rank 3 page-seams branch) while triggering every gated cluster at once.
Typical journeys: 6 to 10 family-stage events (questions.md section 2), plus 3 to 4
at stage 2 and 0 to 2 at stage 2b when reached; the REQ-Q-04 exit is 2. 61 is well
clear of 100-survey territory, and the two quantities that could regrow it
(participants, operability atoms) are both capped by R1/R2 structurally, not by
policy.

---

## 5. Stage boundaries (REQ-Q-09, REQ-ENT-03)

| Stage id | Nodes | May bind / eliminate | Firewall |
|---|---|---|---|
| `stage.family` | ranks 1 to 16, trajectory battery, state forks, family-scope guards (`question.guard.verbatim-bytes`) | `scope.family` constraints; output = family-level recommendation (REQ-Q-09 level 1) plus honest exits (REQ-Q-04) | enterprise/operability and availability questions cannot appear here |
| `stage.implementation` (2a) | questions.md 5.1 to 5.6, impl-scope guards (`question.guard.artifact-integrity`, `question.guard.rsc-federation`) | `scope.implementation`; availability/stewardship answers reported as independent factors (REQ-AVAIL-03) | never reaches back into family choice (constraints.md 1.3 scope firewall) |
| `stage.edition` (2b) | `question.edition.operability.*` (15 seeds, grouped per R2), `question.edition.targeting` | `scope.edition`; eliminates editions/operating plans only | never eliminates a family or downgrades a community edition's fit (REQ-ENT-01); b2b identity/commerce subset unlocks only from `derive.b2b-chain` |
| `stage.report` | no question nodes; relaxation offers (`rule.relaxation-ordering`), counterfactuals (REQ-Q-07), gap records (REQ-GAP-02), dominance disclosures | nothing; it explains | all bindings frozen; only relaxation re-opens questioning, restarting at the stage that owns the relaxed constraint |

Stages 2a and 2b together are REQ-Q-09's level 2 ("implementations worth
evaluating"); enterprise questions are confined to them by construction: no
`constraint.operability.*` or stewardship binding has family scope (constraints.md
2.13, 2.14). Stage transitions are one-way per journey except via report-stage
relaxation; the rank-2 atomic branch and the dominance.fused-baselines-over-mfe rule
are the two legitimate early transitions into stage 2a.

---

## 6. Coverage and traceability check

- Every question id of questions.md sections 3 to 7 appears in exactly one stage row
  (section 5) and is reachable from the entry node via section 1.3 edges; the two
  engine-answered guards are deliberately unreachable (questions.md section 7).
- Every `rel.relaxes` row of constraints.md section 4 appears as an `edge.prunes` or
  inside a dominance rule; every `rel.excludes` row appears as an `edge.warns`;
  every `rel.requires` row is enforced by an unlock condition (rank 12's
  prerequisite, rank 5's containment presupposition, chrome's granularity
  presupposition).
- Every dominance rule cites matrix rows or family sections already verified in
  constraints.md section 2; rules 1 to 4 are row-verified in this file as well.
- Worst path (61) enumerated in section 4.3 covers every node at most once per
  subject class, so the bound is a structural invariant of the graph, not an
  estimate.

---

Next stage (deliverable 16, decision-engine.md): the decision-engine pipeline
consumes this graph as data (`edge.*` records, dominance rules, rule.next-question)
alongside constraints.md; scenario tests should replay the section 4.3 worst path and
the two REQ-Q-04 short exits end to end.
