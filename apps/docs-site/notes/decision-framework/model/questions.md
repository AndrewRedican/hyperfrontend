# High-Information Question Model

Status: DERIVED v1 (2026-08-29). Deliverable 6 (MASTER.md section 16). Requirements
served: REQ-Q-01 (smallest high-information set, gain argued, eliminations named),
REQ-Q-02 (hard vs preference per answer), REQ-Q-04 (the no-MFE outcome can fire after
two questions), REQ-Q-05 (anti-steering audit per phrasing), REQ-Q-06 (no numeric
scoring; gain is argued structurally), REQ-AUD-01 (one asked prompt per question,
with the architect vocabulary held in a technical note), REQ-STATE-03/09 (desirability separated from readiness; trajectory
questions), REQ-ENT-03 (operability questions bound to implementation/edition stage),
REQ-ORCH-10 (unanswered never defaults to hard).

Inputs, linked not restated (REQ-OPS-03): constraint ids, classes, and every
elimination verification from [constraints.md](constraints.md); family ids from
[families.md](families.md); implementation ids from
[implementations.md](implementations.md); dimension and pole ids from
[taxonomy.md](taxonomy.md); migration levels and appetite seeds from
[migration.md](migration.md); ownership facts from [topology.md](topology.md) section 3;
state septet, credibility predicate, and trajectory seeds from
[state-transition.md](state-transition.md); operability seeds from
[enterprise-layer.md](enterprise-layer.md) section 3; practitioner evidence from
[../research/community-signals.md](../research/community-signals.md).

Verification inheritance: every eliminates/favors claim below names the constraint
binding it produces, and the elimination set of that binding is verified in
constraints.md section 2 against matrix rows and family sections (REQ-FRAME-02,
REQ-ORCH-08). This file introduces no elimination claim of its own.

Graph mechanics (prerequisite edges, progressive disclosure, "most useful next
question") are deliverable 7, [question-graph.md](question-graph.md); this file fixes
the ids, content, gain ranking, answer classes, and unlock conditions that the graph
wires (REQ-Q-03).

---

## 1. Method

### 1.1 Gain metric (REQ-Q-06: structural, never a score)

A question's expected information gain is argued from three measurable effects against
the actual landscape: 12 families (7 MFE families + 5 baselines, families.md section 2)
and 19 adoptable implementations (`unit.type.adoptable-implementation`=y,
implementations.md section 1.3; the two layer products zephyr-cloud and picard-js are
counted inside the 19 and die with the families they attach to).

- **G1, elimination width**: how many families/implementations each hard answer
  removes. The *guaranteed* gain is the worst case over answers: a question that
  eliminates 5 families one way and 7 the other has guaranteed gain 5.
- **G2, class-setting reach**: how many other constraints the answer re-classes
  (hard / preference / irrelevant), i.e. how many later questions it prunes or unlocks
  (REQ-Q-08 dominance; REQ-Q-03 conditionality).
- **G3, firing probability**: whether the eliminating answer is common or rare, and
  whether the binding is *entailed* by an ownership fact (a `derive.*` rule in
  constraints.md section 3), in which case a cheap fact question inherits the whole
  rule's gain.

Ranking = G1 worst case first, adjusted by G2 and G3. Each entry states its numbers.

### 1.2 Candidate seeds: tested, not assumed

- **Community seed, "why not Module Federation?"** (community-signals.md: the first
  practitioner question, asked 23 minutes after posting, top-scored). Tested: as
  phrased it is an *output demand*, not an input question; it is brand-first (alias
  resolution, implementations.md section 3, handles the brand) and it asks the
  framework to justify a comparison rather than stating a constraint. Its information
  content decomposes into exactly the two facts the thread's own skeptic conceded as
  decisive: code ownership ("the only important item is 'not owned by you'") and
  standing coordination capacity ("so long as you coordinate your build scripts...
  that's standard practice"). Those become `question.ownership.composition-parties`
  (rank 1) and `question.coordination.upgrade-train` (rank 6). The framework must
  remain able to *output* "use Module Federation / coordinated builds" for orgs with
  alignment capacity (REQ-TRUST-01; community-signals implication 4b); the answer
  models below preserve that outcome. Verdict: passes decomposed, fails as phrased.
- **Thesis heuristic, part 1: "is the seam app-shaped?"** Tested: it double-binds two
  dimensions (`dimension.composition-granularity` and `dimension.adaptation-floor`) and
  so fails the atomicity discipline applied to questions (REQ-MATRIX-03 by analogy).
  It decomposes into `question.granularity.single-screen` (rank 3) and
  `question.migration.participant-ceiling` (rank 4). Verdict: decomposed.
- **Thesis heuristic, part 2: "can you negotiate with every host?"** Tested against
  the matrix: it maps one-to-one onto `ownership.participant-unmodifiable-host` and
  the white-label derivation `derive.white-label-fit`, whose elimination set is real
  and verified (constraints.md 2.1, 2.6). Verdict: survives intact as
  `question.host.negotiability` (rank 14; entailed hard under `topology.white-label`).
- **Rejected seed: "do you use multiple frameworks?"** Near-zero gain alone: the
  discriminator is coordination capacity, not the mix (community-signals implication 2:
  a commenter called the org-diversity table "misleading"; the matrix agrees,
  `framework.same-framework-major-coexistence` eliminates only when alignment is
  unfunded, `derive.mixed-majors-present`). The mix enters only as a premise of
  `question.deps.major-coexistence` (rank 11).

### 1.3 Anti-steering audit protocol (REQ-Q-05; MASTER.md sections 5 and 13)

Every phrasing below was tested against four bad patterns:

- **B1, feature advertising**: "do you want superior isolation?" (REQ-Q-05's own bad
  example). Fails if the question names a mechanism or benefit instead of a
  circumstance or constraint.
- **B2, benefit-free cost**: "memory and speed tradeoffs for what benefit?"
  (community-signals objection 1). Fails if a yes-answer routes toward a costly pole
  without a concrete constraint paying for it.
- **B3, evidence-free routing**: the "misleading list" objection (community-signals
  objection 2). Fails if a taste or a stack inventory can masquerade as a capability
  fact.
- **B4, aspiration inflation**: letting a wish satisfy a hard constraint
  (REQ-STATE-04; `rule.no-target-satisfies-hard`, constraints.md section 5). Fails if
  the phrasing invites target-state answers into current-state slots.

Each question carries an audit line naming the pattern(s) most at risk and the design
feature that defends it.

### 1.4 Answer classification discipline (REQ-Q-02)

Each answer is classified hard (eliminates via the named binding), strong preference
(ranks; violated ones reported as tradeoffs), weak preference (tie-break), or
irrelevant. Unanswered is always `class.irrelevant-by-default` (REQ-ORCH-10); no
question below binds hard without an explicit answer or an entailed `derive.*` premise.
Both audiences answer the same question (REQ-AUD-01). The asked prompt states a
circumstance or a constraint and the system infers the binding; the technical note
under it carries the attribute vocabulary and the mechanism, for readers who want
them. Section 3 records both verbatim and the published questionnaire renders them as
written, so a displayed question always has a citable origin (2026-08-30).

---

## 2. Ranked index

Family-selection stage (REQ-Q-09 level 1), ordered by expected gain:

| Rank | Question id | Binds (constraints.md section) | Guaranteed G1 | Max G1 | Gating |
|---|---|---|---|---|---|
| 1 | `question.ownership.composition-parties` | premises of derive.single-coordinated-team / external-principal / no-cross-deploy-control / broken-governance (s3) | 0 direct | reclasses up to 8 constraints | always asked first |
| 2 | `question.deploy.independence` | constraint.independent-deploy vs constraint.atomic-release (2.3) | 5/12 families | 7/12 families, 17/19 impls | always |
| 3 | `question.granularity.single-screen` | constraint.single-screen-mixing (2.5) | 2/12 families | prunes 4 constraint clusters | always |
| 4 | `question.migration.participant-ceiling` | constraint.participant-modification-ceiling (2.6) | 0 (ceiling 8) | 7/12 family entries per participant | per participant |
| 5 | `question.trust.malicious-participant` | constraint.distinct-principal / interference-damping (2.2) | 0 | 10/12 families | external party or plugin/b2b facts |
| 6 | `question.coordination.upgrade-train` | constraint.no-version-governance (2.7) | 0 | 2/12 families, 6/19 impls | co-residence or negotiated deps live |
| 7 | `question.delivery.server-capacity` | constraint.static-hosting-only, no-new-infra-tier (2.4) | 0 | 1/12 families + adoptions | always by mid-graph |
| 8 | `question.delivery.first-paint` | constraint.composed-first-paint (2.4) | 0 | 5/12 families (default configs) | unauthenticated SEO surface fact |
| 9 | `question.failure.containment` | constraint.fault-containment (+ main-thread, css) (2.1) | 0 | 3/12 families | co-residence confirmed |
| 10 | `question.ux.seam-tolerance` | constraint.seamless-ux, a11y-continuity (2.1) | 0 | 1/12 families | separate-document pole among survivors |
| 11 | `question.deps.major-coexistence` | constraint.framework-major-coexistence (2.7) | 0 | 5 baseline entries + conditions negotiated units | mixed-majors estate fact (mostly derived) |
| 12 | `question.deps.payload-budget` | constraint.payload-dedup (2.7) | 0 | all deps.duplicated families | co-display count + budget facts |
| 13 | `question.roster.runtime-admission` | constraint.runtime-roster-change, no-host-change-per-participant (2.3) | 0 | build-fused + admit-by-redeploy units | plugin/marketplace facts |
| 14 | `question.host.negotiability` | constraint.host-modification-ceiling, participant-self-containment (2.6, 2.1) | 0 | host-inversion + runtime-requiring units | you-are-the-embed fact |
| 15 | `question.contracts.sync-calls` | constraint.sync-boundary-calls (2.1) | 0 | 2/12 families | survivors span serialized and live boundaries |
| 16 | `question.orchestration.appetite` | constraint.no-strategy-runtime vs paved-road (2.10) | 0 | thick-runtime members at pole scope | late family stage / impl stage |

Later stages: section 4 (trajectory/state), section 5 (implementation stage), section 6
(edition/operability stage), section 7 (guards and gap triggers).

Progressive-disclosure consequence (REQ-Q-03): ranks 5-16 are all conditionally gated,
so a typical path is 6-10 questions, not 16; the two great pruners are rank 2's
train-accepted branch (family stage ends at the baselines) and rank 3's page-seams
branch (the whole co-residence cluster of ranks 6, 9, 11, 12, 15 becomes vacuous,
`rel.relaxes`, constraints.md section 4).

---

## 3. Family-stage questions

Field key: Why / Exposes (dimension ids) / Sets (constraint bindings per answer with
class) / Eliminates-favors (verified in the cited constraints.md section) / Unlocks
(follow-up ids + condition) / Prompt (asked verbatim) / Technical note (offered under
it, verbatim) / Audit. Sections 4 to 7 keep the older A-and-C phrasing pair: those
questions are modelled but not published, so nothing renders them.

### 3.1 `question.ownership.composition-parties` (rank 1)

- **Why**: the community-validated first discriminator (section 1.2) and the model's
  biggest class-setter: its answers are the premises of four derivation rules that
  decide which of the big eliminators may ever bind hard (constraints.md section 3,
  2.15). Asked first because asking anything else first risks wasted questions
  (REQ-ORCH-10).
- **Exposes**: no dimension directly; it fills the `ownership.*` fact checklist
  (topology.md section 3) from which the topology label is *inferred, never asked*
  (topology.md section 4).
- **Sets**: `ownership.single-team`, `ownership.multi-repo`,
  `ownership.independent-releases`, `ownership.external-participant`,
  `ownership.acquired-participant`, `ownership.host-unmodifiable-participant`,
  `ownership.no-cross-deployment-control` as `state.current` facts with provenance.
  Facts, not constraints: classification happens in the rules they trigger.
- **Eliminates/favors**: none directly. "Single team, no external parties" fires
  `derive.single-coordinated-team`: re-classes `constraint.independent-deploy`,
  `constraint.no-version-governance`, `constraint.framework-major-coexistence`,
  `constraint.runtime-roster-change` to irrelevant and admits all five baseline
  families as first-class candidates: the REQ-Q-04 outcome is live after one question.
  "External party owns a piece" fires `derive.external-principal` (confirm) and
  unlocks rank 5. "Neither side controls the other's deploys" fires
  `derive.no-cross-deploy-control`: `constraint.independent-deploy` hard, both
  modification ceilings near zero (entailed; no further question needed).
- **Unlocks**: everything. Specifically rank 2 (always), rank 5 (external/plugin/b2b
  facts), rank 14 (when the user's product is the embedded party), section 4
  trajectory battery (when any answer differs current vs target).
- **Prompt**: "Who owns the source, build, and deployment pipeline for each piece?"
- **Technical note**: "Control is the fact that matters, not headcount. A piece owned by
  another team in your company can still be scheduled; one owned by a vendor, a
  customer, or an acquired company cannot. Your answer fills the ownership checklist the
  model infers your topology from, rather than ruling anything out by itself."
- **Audit**: B3 (asks parties and control, not stack inventory; the framework-mix
  answer deliberately does not exist here); B1 clean (no mechanism named).

### 3.2 `question.deploy.independence` (rank 2)

- **Why**: the single largest guaranteed split in the landscape. The matrix divides
  exactly on `time.build-fused` (taxonomy 2.3); this is also the drift hinge
  (taxonomy 3.3): one answer positions the team on integration time and prices
  contract machinery simultaneously.
- **Exposes**: `dimension.integration-time`; downstream
  `dimension.contract-explicitness`.
- **Sets**: three sub-ids per REQ-STATE-03:
  - `question.deploy.independence.current` (fact): do teams ship separately today?
  - `question.deploy.independence.value` (desirability): "Would it be valuable if
    teams could deploy without coordinating with each other?" Can only ever set a
    preference (never hard: `rule.no-target-satisfies-hard`).
  - `question.deploy.independence.readiness` (readiness): "Are the affected teams
    prepared and authorized to own their release process, including being on call for
    what they ship?" A fact checked against the buy-in signals
    (state-transition.md section 4).
  Classification: "we cannot share a release train" stated as fact (or entailed via
  `derive.no-cross-deploy-control`) binds `constraint.independent-deploy` hard;
  "valuable but not required" binds it strong-preference; "one train is mandated
  (audit/atomicity policy)" binds `constraint.atomic-release` hard; unanswered:
  irrelevant.
- **Eliminates/favors** (constraints.md 2.3): hard independent-deploy eliminates all
  five baselines: `family.modular-monolith`, `family.package-composition`,
  `family.spa-routing`, `family.server-templates`, `family.islands` (impls bit,
  commercetools-frontend; `deployment.host-rebuild-required`=y cells); all seven MFE
  families retain. Hard atomic-release eliminates all seven MFE families: 17 of 19
  implementations gone, only bit and commercetools-frontend remain. Guaranteed G1:
  5/12 either way.
- **REQ-Q-04**: rank 1 "single team" + rank 2 "train acceptable" lets the engine emit
  "you probably do not need microfrontends" after two questions, with the baselines as
  the recommendation set (families.md section 5).
- **Unlocks**: rank 3 (if independent deploy binds), `question.impl.drift-machinery`
  (drift becomes structurally possible), `question.trajectory.bounded-exit`.
  If atomic-release binds hard: family stage ends; jump to section 5.
- **Prompt**: "Must teams be able to deploy to production on their own schedule, without
  a coordinated release?"
- **Technical note**: "Structurally the question is whether a piece can reach production
  without rebuilding or redeploying the host. Independent deployment is also what makes
  the two sides drift out of contract with each other, so it buys the versioning and
  validation machinery needed to survive that."
- **Audit**: B1 (deployment stated as circumstance, no autonomy rhetoric); B4 (the
  value/readiness split keeps the wish out of the hard slot: an org that merely *wants*
  independence keeps the baselines in play as candidates with a reported tradeoff).

### 3.3 `question.granularity.single-screen` (rank 3)

- **Why**: cheap product fact with double leverage: one answer either removes the
  page-partition families or renders the entire co-residence question cluster vacuous
  (taxonomy 2.5); the biggest G2 in the set.
- **Exposes**: `dimension.composition-granularity`.
- **Sets**: yes = `constraint.single-screen-mixing` hard (it is a product-shape fact;
  a "probably later" answer sets strong preference and the trajectory battery
  catches the rest). No = the negation: relaxation of the co-residence cluster.
- **Eliminates/favors** (constraints.md 2.5, section 4 `rel.relaxes`): yes-hard
  eliminates `family.route-partition` (impls nextjs-multi-zones,
  cloudflare-workers-microfrontends; `runtime.concurrent-participants`=n) and
  `family.server-templates`. No re-classes `constraint.fault-containment`,
  `constraint.css-containment`, `constraint.framework-major-coexistence`,
  `constraint.no-version-governance` to irrelevant and favors
  `family.route-partition` (families.md 3.1 works-well).
- **Unlocks**: yes unlocks `question.ux.chrome-persistence` (follow-up id, binds
  `constraint.persistent-chrome` and `constraint.cross-boundary-soft-nav`,
  constraints.md 2.5) plus ranks 6, 9, 11, 12, 15; no prunes those same ranks.
- **Prompt**: "Does a single screen ever show work from more than one team at the same
  time?"
- **Technical note**: "The test is concurrent rendering: output owned by two
  independently deploying teams alive on the same screen at once. Where team boundaries
  line up with whole-page navigation instead, everything about co-residence stops
  applying: shared dependencies, overlays crossing sections, and one piece taking down
  another."
- **Audit**: B1 clean (describes the product, not a capability); B2 (the entire
  co-residence cost is only taken on the strength of a product fact).

### 3.4 `question.migration.participant-ceiling` (rank 4)

- **Why**: per-participant hard ceilings are the canonical eliminating answers of the
  model (migration.md section 5) and the community-conceded "not owned by you" row in
  question form. Entailed hard in four topologies (constraints.md 2.15: acquisition,
  legacy-modernization, third-party-vendor, b2b), so its gain often arrives free via
  rank 1's facts.
- **Exposes**: `dimension.adaptation-floor`.
- **Sets**: `constraint.participant-modification-ceiling`(participant, maxLevel) per
  boundary. Capability preconditions (source access, reproducible build, active
  maintainers) and the per-level probes are the migration.md section 8 seeds, adopted
  verbatim as sub-questions `question.migration.capability-preconditions` and
  `question.migration.level-probe`; a broken build caps the ceiling at level 2
  regardless of willingness (B4 defense). Classification: stated ceiling = hard;
  "would rather not" = strong preference; greenfield participant = irrelevant.
- **Eliminates/favors** (constraints.md 2.6, verified against the taxonomy 2.6 bands):
  maxLevel<3 eliminates `family.module-graph-federation` for that participant (floor
  3: impls module-federation, native-federation, plus the zephyr-cloud layer that
  inherits the boundary); maxLevel<4 additionally eliminates
  `family.lifecycle-orchestration` (floor 4: single-spa, piral), the SDK-handshake
  posture of `family.document-embedding` (embed-only posture at level 1 survives), the
  bootstrap-lineage member of virtualized rehosting (qiankun), and entando's level-4
  seam inside custom-element composition; existing separate applications are
  eliminated from all five baselines below maxLevel 6 (bit adoption-bridge cases per
  cell). At maxLevel<=2 the surviving set for that participant is: route-partition,
  server-fragment-assembly, custom-element via adapter practice, the HTML-entry
  virtualized members (micro-app-jd, wujie, web-fragments client), and embed-only
  document embedding: up to 7 of 12 family entries removed.
- **Counterfactual duty** (REQ-Q-07): every elimination here must be reported with the
  appetite increase that would readmit which candidates (migration.md section 5); this
  feeds the relaxation ledger (constraints.md 6.1).
- **Unlocks**: `question.migration.host-ceiling` (host facet; the white-label case is
  rank 14), `question.trajectory.integration-duration` and
  `question.trajectory.legacy-horizon` (split horizons, migration.md section 6),
  strangler follow-up `question.migration.strangler` (binds
  `constraint.strangler-path`).
- **Prompt**: "What is the deepest change the owners of a piece can accept in order to
  integrate it?"
- **Technical note**: "The model scales it: configuration and serving only, an adapter
  around unchanged code, a build-tool change, an entry or bootstrap edit, a bounded
  internal refactor, or practically nothing. What counts is the deepest change the
  owners will accept, not the deepest change that is technically possible."
- **Audit**: B3/B4 (appetite is bounded by capability preconditions asked as facts, so
  a willing answer cannot raise a ceiling the build cannot cash); B1 clean.

### 3.5 `question.trust.malicious-participant` (rank 5)

- **Why**: the landscape's sharpest eliminator (`security.untrusted-third-party-viable`
  is No for 27 of 30 units, taxonomy 2.2): when it fires hard it removes more of the
  space than any other single answer. Gated because the eliminating answer is rare;
  its premise arrives from rank 1 (`derive.external-principal`, confirm mode) or the
  plugin/b2b facts (`derive.plugin-admission`, `derive.b2b-chain`).
- **Exposes**: `dimension.trust-ceiling` (gated on `dimension.runtime-realm` per
  taxonomy 3.1).
- **Sets**: three answer levels: "must contain malice/compromise" =
  `constraint.distinct-principal` hard; "accidents between trusted teams" =
  `constraint.interference-damping` (ceiling strong: damping is never sold as the
  answer to a trust requirement, constraints.md 2.2); "full mutual trust" =
  irrelevant.
- **Eliminates/favors** (constraints.md 2.2): hard retains only
  `family.document-embedding` at the cross-origin + sandbox posture (impls
  hyperfrontend, luigi iframe mode, the iframe practice; cells c: the posture, not the
  product, decides, families.md 6.3) and conditionally `family.route-partition` at
  page granularity; everything else is eliminated including
  `family.virtualized-rehosting` explicitly (never a security boundary,
  REQ-MATRIX-05). 10 of 12 families, 15+ of 19 implementations.
- **Interaction duty**: a hard binding here auto-surfaces the exclusions
  `rel.excludes` with hard seamless-ux (`gap.secure-seamlessness`), hard sync-calls,
  and hard payload-dedup (constraints.md section 4), so contradictory hard sets are
  caught at ask time, not report time (REQ-GAP-01).
- **Unlocks**: rank 10 (with the exclusion warning), `question.guard.verbatim-bytes`
  when audit/regulatory context is present, the identity block reference for b2b
  (section 6).
- **Prompt**: "If one piece were compromised or hostile, must the rest of the product
  stay safe anyway?"
- **Technical note**: "Two different adversaries. Containing a hostile piece calls for a
  boundary the browser enforces: no reach into host state, partitioned storage, bounded
  navigation, a narrowed capability surface. Keeping trusted teams from tripping over
  each other calls for convention and review, and rules out almost nothing."
- **Audit**: B1 (this is exactly the question the REQ-Q-05 bad example advertises as
  "superior isolation"; the constraint form names the adversary and the containment
  obligation, never the mechanism); B2 (the document-embedding costs downstream are
  paid by a stated adversary model, which is the one benefit case the community
  thread's skeptic conceded).

### 3.6 `question.coordination.upgrade-train` (rank 6)

- **Why**: the second half of the decomposed community seed. Distinguishes the two
  shared-realm coordination-hungry families from everything else, and its negation is
  a prerequisite of payload dedup (`rel.requires`).
- **Exposes**: `dimension.dependency-economy`; evidence for `topology.fragmentation`
  inference.
- **Sets**: "cannot, as observed fact" (or entailed from
  `ownership.uncoordinated-upgrades` / `ownership.distrusted-cadence`,
  `derive.broken-governance`) = `constraint.no-version-governance` hard (a capability
  fact, not a taste: topology.md 2.9); "could, prefer not to depend on it" = strong
  preference; "yes, trains run today" = irrelevant, and dedup becomes reachable.
- **Eliminates/favors** (constraints.md 2.7): hard eliminates
  `family.module-graph-federation` (module-federation, native-federation, the
  import-map practice; all members require governance, families.md 3.4) and
  `family.lifecycle-orchestration` (single-spa, piral, families.md 3.5); the
  zephyr-cloud and picard-js layers die with them: 6 of 19 implementations. Retains
  the `deps.duplicated` families and the baselines.
- **Unlocks**: rank 12 only if governance available or fusion still live; else rank 12
  is pruned (its hard form would be a proven gap, `gap.autonomous-dedup`).
- **Prompt**: "When a shared library upgrades, do all teams move together, or must
  several versions run side by side?"
- **Technical note**: "Standing version governance means aligned upgrade trains before
  and after every build, and runtime conflicts fixed on a real sprint, indefinitely.
  Approaches that put every piece in one JavaScript realm need that discipline
  permanently, not once during adoption."
- **Audit**: B3 (asks observed behavior, "does it happen today", because
  fragmentation is the topology least likely to be self-reported honestly,
  topology.md 2.9); B4 (a promised future governance change is a section 4 trajectory
  answer subject to credibility, never a current-state fact).

### 3.7 `question.delivery.server-capacity` (rank 7)

- **Why**: cleanly splits request-path assembly from static delivery, and it is a
  capability fact organizations answer reliably.
- **Exposes**: `dimension.assembly-locus`.
- **Sets**: "static hosting only, no operated service in the request path" (or
  entailed via `derive.static-estate`) = `constraint.static-hosting-only` hard;
  "servers exist but a new tier is unwelcome" = `constraint.no-new-infra-tier` at
  strong/weak preference; "we operate server estates routinely" = irrelevant, favors
  nothing by itself.
- **Eliminates/favors** (constraints.md 2.4): hard eliminates
  `family.server-fragment-assembly` (impl podium outright; opencomponents survives
  only in its client-mode profile; web-fragments survives only in client reframing
  mode, which moves it to `family.virtualized-rehosting`) and constrains
  `family.route-partition` to existing routing infrastructure (cells c). Attribution
  duty applies (taxonomy 3.4): this question covers the *request-path composer* cause
  of `deployment.strategy-service-in-path` only; registry/discovery services are
  rank-agnostic here and asked at `question.impl.delivery-governance`.
- **Unlocks**: rank 8 interaction warning: hard static-hosting plus hard
  composed-first-paint jointly redirect to the prerendered build-fused baselines
  (`rel.excludes`, constraints.md section 4); the engine surfaces this before both are
  bound.
- **Prompt**: "Can you operate a service on the request path, or is delivery limited to
  static hosting and a CDN?"
- **Technical note**: "Assembly happens either on the request path, in a server or edge
  service you operate, or in the reader's browser. Static-only delivery removes the
  first group outright, whatever else it offers, so the question is really whether a
  team would carry one more service in production."
- **Audit**: B1 clean; B2 (the no-servers answer's cost, losing composed first paint,
  is surfaced through the exclusion warning at bind time).

### 3.8 `question.delivery.first-paint` (rank 8)

- **Why**: large elimination width (5 of 12 families in default configuration) but
  gated on a business-surface fact and confirm-gated before hard
  (`derive.seo-surface`, constraints.md section 3).
- **Exposes**: `dimension.assembly-locus` (consequence surface `ux.composed-first-paint`).
- **Sets**: premise sub-question first: "does the composed surface carry SEO-critical
  unauthenticated content?" (fact). If yes: `constraint.composed-first-paint` strong
  by default, hard only on explicit confirmation ("crawlability is a business
  requirement, not a wish"). If the motivation turns out to be page performance
  rather than crawlability, the engine routes to the honest baselines instead
  (`family.islands`, `family.spa-routing`; families.md 5.5, 5.3) rather than binding.
- **Eliminates/favors** (constraints.md 2.4): hard retains
  `family.server-fragment-assembly`, `family.route-partition`,
  `family.server-templates`, `family.islands`, prerendered
  `family.package-composition` / `family.modular-monolith`, and web-fragments pierced
  mode; eliminates the client-runtime families in default configurations
  (`family.module-graph-federation`, `family.lifecycle-orchestration`,
  `family.virtualized-rehosting`, `family.document-embedding`,
  `family.custom-element-composition`; conditional SSR paths are per-cell conditions,
  never assumed).
- **Unlocks**: `question.ux.chrome-persistence` tension: hard first-paint plus hard
  persistent chrome is reachable only via web-fragments pierced mode or the
  build-fused baselines (constraints.md 2.5).
- **Prompt**: "Must the composed page render and be crawlable before any JavaScript
  runs?"
- **Technical note**: "This binds only where a business surface depends on composed
  content existing in the first response: indexable markup, or a page that works before
  scripts execute. Wanting the page to feel fast is a different requirement and is
  better bought elsewhere."
- **Audit**: B2 (hard requires a stated business surface; a performance taste is
  rerouted to simpler architectures per REQ-Q-04 instead of buying a composition
  tier); B1 clean.

### 3.9 `question.failure.containment` (rank 9)

- **Why**: separates browser-enforced and per-configuration containment from
  shared-realm exposure; entailed hard in plugin, fragmentation, and third-party
  topologies (constraints.md 2.15), otherwise a strong preference most users hold
  weakly.
- **Exposes**: `dimension.runtime-realm` (failure atoms).
- **Sets**: "the product must survive a participant failure without a reload, as a
  stated blast-radius/regulatory requirement" = `constraint.fault-containment` hard;
  "resilience preferred" = strong preference (the default class); "reload acceptable"
  = irrelevant. Follow-ups can raise `constraint.main-thread-protection` (busy/crash
  containment; conditional cells only, REQ-MATRIX-05) and `constraint.css-containment`
  separately.
- **Eliminates/favors** (constraints.md 2.1): hard retains
  `family.document-embedding`, `family.route-partition` (per navigation, by
  construction), and `family.virtualized-rehosting` only per configuration (wujie and
  web-fragments client mode pass; qiankun fails the reclaim/recovery cells);
  eliminates `family.module-graph-federation`,
  `family.custom-element-composition` (impls module-federation, native-federation,
  entando), and `family.lifecycle-orchestration` (single-spa, piral: quarantine is not
  containment, families.md 3.5).
- **Unlocks**: rank 10 (the seam question becomes decision-relevant once
  document-boundary families are favored), memory-budget cost note
  (`constraint.memory-budget`, weak, never hard-eliminating: constraints.md 2.12).
- **Prompt**: "When one piece fails in production, must everything else keep working?"
- **Technical note**: "Containment means an uncaught exception, a leaked timer, or
  corrupted state inside one piece cannot reach the host or its siblings, and that the
  piece can be restarted in place with its resources reclaimed. Without an enforced
  boundary, one exception is a page-wide event and recovery means a reload."
- **Audit**: B1 (describes the failure event and the obligation, not "better
  isolation"); B2 (the hard form cites who is harmed by shared blast radius: paged
  teams, plugin users, vendors' customers).

### 3.10 `question.ux.seam-tolerance` (rank 10)

- **Why**: the counterweight question: it is the only high-rank question whose hard
  form eliminates the family that survives rank 5, and its honest phrasing is what
  keeps the framework from steering toward document embedding by default
  (REQ-MISSION-01).
- **Exposes**: `dimension.runtime-realm` (UX consequence surface, taxonomy 3.2).
- **Sets**: "the composed page must behave as one document" = `constraint.seamless-ux`
  hard; assistive-technology continuity carries its own binding
  `constraint.a11y-continuity` (ceiling hard independently: legal mandates exist
  regardless of taste); "visible seams acceptable / engineering budget exists for seam
  work" = strong or weak preference.
- **Eliminates/favors** (constraints.md 2.1): hard seamless-ux eliminates
  `family.document-embedding` (impls hyperfrontend, luigi iframe mode;
  `ux.natural-layout-flow`=n, families.md 3.7 hard limitations); every other family
  retains. Hard a11y-continuity eliminates the `realm.separate-document` pole unless
  the implementation carries a compensating protocol (hyperfrontend `?`, iframe c:
  per-cell conditions decide, never assumed).
- **Interaction duty**: if rank 5 already bound hard, a hard answer here is the
  canonical contradiction `gap.secure-seamlessness`: the engine emits the gap record
  and the relaxation path (fund the seam engineering:
  `ux.host-overlay-protocol`, constraints.md 6.1), never a silent downgrade.
- **Unlocks**: rank 15 (boundary call style), `question.impl.paved-road` aspects
  (host-overlay protocols are implementation properties).
- **Prompt**: "Must the composed page behave as one document for layout, overlays,
  focus, and screen readers?"
- **Technical note**: "The demanding version is one accessibility tree and one focus
  order across the whole page, with dialogs and menus free to escape the section that
  owns them. The same boundary that contains a failing or hostile piece is what makes
  those seams appear."
- **Audit**: B1/B2 (seam cost stated as concrete behaviors; the hard form requires a
  mandate such as accessibility law or a product requirement, not aesthetics); B3
  (a11y is split out so a legal fact is never blended with visual taste).

### 3.11 `question.deps.major-coexistence` (rank 11)

- **Why**: mostly *derived*, rarely asked: `derive.mixed-majors-present` binds it hard
  from two facts (incompatible majors in the current estate; no funded alignment).
  Asked directly only when the estate fact is unknown. This is the community
  thread's org-diversity lesson enforced in the model: the mix alone routes nowhere.
- **Exposes**: `dimension.dependency-economy` jointly with `dimension.runtime-realm`.
- **Sets**: estate fact + funding fact = `constraint.framework-major-coexistence` hard
  (entailed); "mixed but alignment is funded and credible" = the alignment is a
  section 4 transition, and the constraint binds strong-preference meanwhile.
- **Eliminates/favors** (constraints.md 2.7): hard retains
  `family.document-embedding` and `family.virtualized-rehosting` (cells y) and
  conditionally the negotiated units (cells c: skew falls back to duplication);
  eliminates the build-fused baselines for the affected participants.
- **Unlocks**: nothing new; narrows survivors.
- **Prompt**: "Must incompatible major versions of the same framework run side by side
  indefinitely?"
- **Technical note**: "The estate fact decides nothing on its own. It binds once no work
  is funded to align the versions, which makes the coexistence permanent rather than
  transitional, and permanent coexistence is what a single shared module graph cannot
  express."
- **Audit**: B3 (binds only with the funding fact attached; a stack list alone is
  insufficient by design); B4 ("the upgrade will happen eventually" is a trajectory
  answer, checked for credibility, never a relaxation of the hard binding:
  `rule.no-target-satisfies-hard`).

### 3.12 `question.deps.payload-budget` (rank 12)

- **Why**: the community thread's cost objection ("memory and speed tradeoffs for what
  benefit?") turned into a question the *user* must pay for: dedup machinery is only
  justified by a stated budget, and duplication is only acceptable given co-display
  counts. Default weak; confirm-gated to hard (`derive.payload-budget`).
- **Exposes**: `dimension.dependency-economy`.
- **Sets**: "strict payload/device budget across many co-displayed units, as a
  requirement" = `constraint.payload-dedup` hard after confirmation; "sensible
  frugality" = weak preference (the default).
- **Eliminates/favors** (constraints.md 2.7): hard retains
  `family.module-graph-federation` and the build-fused baselines
  (`performance.shared-dependency-dedup`=y); eliminates the `deps.duplicated`
  families: `family.document-embedding`, `family.virtualized-rehosting`,
  `family.custom-element-composition`, and the fragment/page families' client side
  (families.md 3.3/3.6/3.7 inherent costs).
- **Prerequisite check** (`rel.requires`, constraints.md section 4): dedup exists only
  with version governance (rank 6 negative) or build fusion (rank 2 train branch); if
  neither survives, the hard form is the proven gap `gap.autonomous-dedup` (or
  `gap.untrusted-dedup` with rank 5 hard) and the question is presented as a tradeoff
  acknowledgment, not a live choice.
- **Prompt**: "Is there a stated page-weight or device budget that every piece on a
  screen shares?"
- **Technical note**: "Shipping one copy of a shared library across independently
  deployed pieces costs coupling: an agreed version policy plus the machinery to enforce
  it at runtime. What the duplication actually costs depends on how many pieces are on
  screen together and on the devices they must run on."
- **Audit**: B2 (this question exists to force the "for what benefit" ledger both
  ways: no budget fact, no dedup requirement; a real budget fact is the concrete
  benefit that justifies shared-realm coupling).

### 3.13 `question.roster.runtime-admission` (rank 13)

- **Why**: the plugin-ecosystem cluster in question form; entailed hard by
  `derive.plugin-admission` when rank 1 reports unknown-future participants. Carries
  the guidance's own canonical circumstance phrasing (REQ-AUD-01).
- **Exposes**: `dimension.integration-time` (runtime-live pole),
  `dimension.roster-authority`.
- **Sets**: "participants/versions must change inside a running document" =
  `constraint.runtime-roster-change` hard (confirm: batch admission may suffice);
  "onboarding must not require host change or a central owner's action" =
  `constraint.no-host-change-per-participant` hard (host-change atom at family scope;
  the ownerless-onboarding atom at implementation scope, taxonomy 2.8); weaker
  answers set strong preference.
- **Eliminates/favors** (constraints.md 2.3): hard roster-change retains the
  `time.runtime-live` units: `family.document-embedding` and
  `family.virtualized-rehosting` fully (hyperfrontend, luigi, micro-app-jd, qiankun,
  wujie, web-fragments), conditionally the loader-based members of
  `family.module-graph-federation` and `family.lifecycle-orchestration` (single-spa,
  module-federation registerRemotes, import-map practice; cells c); eliminates the
  build-fused baselines and admit-by-redeploy configurations. Hard ownerless
  onboarding retains registry-mediated implementations (opencomponents, piral,
  zephyr-cloud, entando) and immediately surfaces the exclusion with
  `constraint.no-delivery-intermediary` (`gap.governed-ownerless-onboarding`).
- **Unlocks**: rank 5 confirm (plugin authors' trust), `question.impl.paved-road`
  (plugin-author DX preference), section 6 review/registry operability seeds.
- **Prompt**: "Can new pieces be added without rebuilding or redeploying the host?"
- **Technical note**: "Stated structurally: new pieces, or new versions of existing
  ones, admitted into a running product with no host code change and no central owner
  acting. Approaches that resolve their participants while the host builds cannot do
  this by construction."
- **Audit**: B1 clean (mechanics of admission, not "runtime flexibility"); B2 (the
  registry-mediation cost, an intermediary in the trust path, is surfaced through the
  exclusion at bind time).

### 3.14 `question.host.negotiability` (rank 14)

- **Why**: the surviving thesis-heuristic seed (section 1.2); entailed hard by
  `derive.white-label-fit` when rank 1 reports the user's product as the embedded
  party. The only question asked from the participant's seat.
- **Exposes**: `dimension.adaptation-floor` (host facet), the white-label pressure
  (topology.md 2.8).
- **Sets**: "hosts cannot be asked to change anything" =
  `constraint.host-modification-ceiling`(maxLevel=1) hard +
  `constraint.participant-self-containment` hard (confirm) +
  `constraint.no-strategy-runtime` strong (the host cannot adopt a runtime); "hosts
  will adopt an SDK/shell if we ask" = preference-graded by how many hosts and how
  credible the ask.
- **Eliminates/favors** (constraints.md 2.6, 2.1): hard eliminates host-inversion
  implementations (piral shell takeover; entando and commercetools-frontend
  platform-as-host) and every strategy requiring host runtime adoption; retains the
  units scoring y on `ownership.participant-unmodifiable-host` (hyperfrontend, the
  iframe practice, opencomponents, picard-js, the web-components practice: matrix
  row).
- **Unlocks**: section 6 b2b credentials block when customer data/credentials are
  involved (topology.md 2.8 follow-ups), rank 5 from the customer's seat.
- **Prompt**: "When your product runs inside a customer's site, can you require them to
  change that site?"
- **Technical note**: "Asked from the seat of the embedded product rather than the host.
  Where nothing can be required, the piece has to survive whatever the host page already
  does: nothing of yours leaking out into their styles or globals, nothing of theirs
  breaking you on the way in."
- **Audit**: B1/B3 (asks the negotiation reality per customer, never "do you want
  self-containment"); B2 clean (the self-containment cost is paid by an ownership
  fact).

### 3.15 `question.contracts.sync-calls` (rank 15)

- **Why**: low expected gain (irrelevant-by-default, rare hard form) but a genuine
  eliminator when the surviving set spans serialized and live-object boundaries;
  offered only then (zero gain otherwise, so the graph suppresses it).
- **Exposes**: `dimension.runtime-realm` (contract consequence).
- **Sets**: "participants must invoke each other's live objects synchronously, traced
  to a real interaction requirement" = `constraint.sync-boundary-calls` hard;
  anything less = preference or irrelevant.
- **Eliminates/favors** (constraints.md 2.1): hard eliminates
  `family.document-embedding` (serialized boundary) and `family.route-partition`
  (participants never co-reside); retains the shared-realm and virtualized families.
  Excluded jointly with hard rank 5 (no unit is untrusted-viable with sync calls) and
  effectively with hard rank 9 (only the hidden-realm virtualized units satisfy both,
  at damping trust only; constraints.md section 4).
- **Prompt**: "Do pieces need to call each other's live objects directly, or is
  asynchronous messaging enough?"
- **Technical note**: "Acting on another piece's live objects in one call stack requires
  a shared JavaScript realm. Across an enforced boundary the same exchange is serialized
  and asynchronous, which is a different programming model rather than a slower version
  of the same one."
- **Audit**: B2 (a yes must name the interaction that needs it, e.g. a shared editing
  surface, else it stays preference); B1 clean.

### 3.16 `question.orchestration.appetite` (rank 16)

- **Why**: the definitional thickness trade (taxonomy 2.11); mostly a ranking
  question, but its hard "nothing strategy-owned" form acts at family-pole scope and
  it discriminates implementations inside families whose thickness spans the scale
  (families.md FC-5), so it bridges to section 5.
- **Exposes**: `dimension.orchestration-thickness`.
- **Sets**: "nothing strategy-owned may ship on the page or impose version floors;
  the mechanism must outlive frameworks" = `constraint.no-strategy-runtime` hard;
  "we want shipped lifecycle/messaging/error UI and composed dev" =
  `constraint.paved-road` at weak/strong (never hard: DIY is always possible, only
  priced; constraints.md 2.10). The two are `rel.excludes` by definition; stating
  both surfaces the trade explicitly.
- **Eliminates/favors** (constraints.md 2.10): hard no-strategy-runtime retains the
  `orchestration.primitive` units (the iframe, import-map, web-components,
  route-partition practices and the build-time baselines; taxonomy 2.11) and
  eliminates thick-runtime members at pole scope (piral, luigi, entando, qiankun,
  hyperfrontend, and the library-tier units per cell).
- **Prompt**: "Are you willing to adopt a page-wide runtime that every team then
  upgrades together?"
- **Technical note**: "A strategy-owned runtime pays for loading states, error handling,
  messaging between pieces, and local development, and charges a version floor that
  every piece co-versions for as long as the product runs. The alternative is browser
  primitives only, with nothing of the strategy outliving the page."
- **Audit**: B1/B2 (the costs of both poles are stated symmetrically in the same
  sentence: co-versioned runtime vs recurring DIY; neither pole is advertised).

---

## 4. Trajectory and state questions (REQ-STATE-03, REQ-STATE-09)

Desirability and readiness are never one question. Mechanics owned by
[state-transition.md](state-transition.md); this section fixes their place in the
question set.

- **Fork rule (`question.rule.state-fork`)**: any family-stage question the user
  answers in future tense ("we will...", "after the reorg...") forks into the
  dimension's septet: the stated value goes to `state.target`, and the engine asks the
  paired readiness questions instead of accepting the answer as current fact. Target
  values bind only under the credibility predicate (state-transition.md section 3) and
  only into `recommendation.best-after-transition` (`rule.target-credibility`,
  constraints.md section 5). Rank 2 carries the canonical pair
  (`question.deploy.independence.value` / `.readiness`) as the built-in example.
- **Trajectory battery**: the nine ids `question.trajectory.*` defined in
  state-transition.md section 7 are adopted verbatim (topology-stability, goal-status,
  consolidation, legacy-horizon, integration-duration, deployment-ownership-change,
  funding, authority, no-transition-outcome). Unlock conditions for the graph:
  acquisition facts unlock `legacy-horizon` and `integration-duration`; any credible
  target unlocks `funding` and `authority`; `no-transition-outcome` (the keystone
  robustness probe) is always asked before any `fit.transition-dependent` output is
  emitted.
- **`question.trajectory.bounded-exit`**: binds `constraint.bounded-exit`
  (constraints.md 2.6; default strong, ceiling hard). Hard: eliminates the build-fused
  baselines (`migration.exit.participants-standalone`=n) and conditions piral and
  opencomponents (cells c/n).
  Phrasing A: "Must participants remain independently deployable outside the
  composition, so the strategy can be dissolved or converged later at low cost
  (`migration.exit.participants-standalone`, `cost.evolve`)?"
  Phrasing C: "If you later decide to merge everything, or to walk away from this
  approach entirely, must each piece still be able to stand on its own?"
  Audit: B4 (this is the question that makes exit cost a present-tense fact instead
  of a hope).
- Migration horizon split: first-integration vs convergence appetite
  (migration.md section 6) is asked through `question.trajectory.integration-duration`
  plus rank 4's per-horizon ceiling; an aspirational convergence appetite never
  relaxes the first-integration constraint (REQ-STATE-02).

---

## 5. Implementation-stage questions (REQ-Q-09 level 2)

Asked only after family selection; nothing here reaches back into family choice
(scope firewall, constraints.md 1.3). Availability/maturity answers are reported as
the independent factors of REQ-AVAIL-03, never blended into architectural fit.

### 5.1 `question.impl.stewardship-floor`

- Binds the section 2.13 lens constraints (constraints.md):
  `constraint.maintenance-activity`, `constraint.stewardship-durability`,
  `constraint.adoption-evidence`, `constraint.stable-line`,
  `constraint.no-forced-remigration`. Classification: each stated floor is hard at
  this scope; defaults are strong/weak per the table.
- Example eliminations (matrix `unit.*` rows; implementations.md carries the full
  facts): hard maintenance-activity removes single-spa and picard-js
  (`unit.maintenance.release-within-12mo`=n); hard stable-line removes micro-app-jd
  and the hyperfrontend community line and forces the qiankun v2-vs-v3 line choice
  (`unit.availability.stable-line-shipped` n/c cells); stewardship-durability
  pressures single-maintainer profiles (hyperfrontend, wujie, opencomponents).
- Phrasing A: "State your floors: releases within 12 months, commits within 6, more
  than one maintainer, an organizational steward, a shipped stable line, adoption
  evidence beyond the sponsor?"
- Phrasing C: "If the one person maintaining a tool walked away next year, could you
  live with owning it, or do you need a project with an organization and a track
  record behind it?"
- Audit: B3 (floors are checked against dated matrix cells, not marketing liveness;
  the graveyard lesson that READMEs outlive projects, implementations.md 2.10).

### 5.2 `question.impl.rollback-actuation`

- Binds `constraint.instant-rollback` and `constraint.version-pinning`
  (constraints.md 2.9); entailed hard by `derive.regulated-release`. Per-user/canary
  targeting is edition scope and moves to section 6 (`question.edition.targeting`,
  binding `constraint.per-user-targeting`).
- Hard retains pointer-switch units (the import-map practice, opencomponents,
  zephyr-cloud, bit; piral conditional; `governance.rollback` cells with the
  taxonomy 3.4 attribution duty: actuation cause vs delivery-platform cause).
- Phrasing A: "Must rollback to a prior participant version be a first-party repoint
  of an immutable version, without rebuilding (`governance.rollback`,
  `deployment.immutable-version-retention`, `deployment.consumer-version-pin`)?"
- Phrasing C: "When a bad version ships at 5pm, is redeploying the old code an
  acceptable fix, or must someone be able to flip back to yesterday's version in one
  action?"
- Audit: B1 clean; B2 (mutable-URL simplicity vs retention infrastructure stated as
  the explicit trade, taxonomy 2.9).

### 5.3 `question.impl.drift-machinery`

- Binds `constraint.explicit-drift-surfacing` (constraints.md 2.9); auto-escalated to
  strong by `derive.many-party-drift` (3+ independently deploying parties among
  drift-exposed survivors), asked to confirm hard.
- Hard on all four atoms retains hyperfrontend only (taxonomy 2.10); partial gates
  (module-federation c: dependency semver, never API shape) are never read as
  satisfied (REQ-MATRIX-05). *Because this is the framework sponsor's sharpest
  single-implementation eliminator, the audit here is the strictest in the file*: the
  question is offered only when the party-count fact already holds, its phrasing
  names the failure mode rather than any capability, and the weaker honest answers
  (descriptor-only, conventions plus tests) are first-class and keep every
  descriptor-tier unit in play (bit, luigi, opencomponents, podium, piral,
  commercetools, zephyr per taxonomy 2.10).
- Phrasing A: "When independently deployed sides drift out of contract compatibility,
  what must happen: an explicit machine-readable refusal at connect time
  (`contracts.connect-compat-gate`, `contracts.drift-explicit`), a descriptor humans
  diff, or conventions plus integration tests?"
- Phrasing C: "Two teams ship on different days and their pieces no longer agree.
  Is it acceptable to find out from a broken page in production, or must the system
  itself refuse the mismatch and say exactly what is incompatible?"
- Audit: B1 (names the failure, not "contract safety"); B2 (ceremony cost for
  one-team-both-sides cases is stated: taxonomy 2.10 "ceremony overhead").

### 5.4 `question.impl.delivery-governance`

- Binds `constraint.no-vendor-control-plane`, `constraint.no-delivery-intermediary`,
  `constraint.osi-core-license` (constraints.md 2.11). Covers the *second* cause of
  `deployment.strategy-service-in-path` (registry/discovery), completing rank 7's
  attribution duty.
- Hard no-vendor-control-plane eliminates zephyr-cloud,
  cloudflare-workers-microfrontends, commercetools-frontend. Hard no-intermediary
  eliminates registry/feed/composer-mediated units (opencomponents, piral, podium,
  zephyr-cloud, the fragment composers) and retains `delivery.unmediated` units;
  jointly with rank 13's ownerless onboarding it is the proven gap
  `gap.governed-ownerless-onboarding`.
- Phrasing A: "May a vendor SaaS sit in the delivery or metadata path
  (`deployment.vendor-hosting-required`)? May any shared intermediary that must be
  trusted with code execution (`security.delivery-intermediary-trust`)? Must the core
  carry an OSI license?"
- Phrasing C: "If the company or service between your teams' code and your users
  disappeared or was compromised, what happens? Must everything keep working from
  infrastructure you own?"
- Audit: B1 clean; B3 (license and hosting answers are policy facts the org already
  has, not preferences invented in the questionnaire).

### 5.5 `question.impl.platform-team`

- Binds `constraint.no-platform-team` and `constraint.non-developer-composition`
  (constraints.md 2.8).
- Hard no-platform-team retains `roster.host-authored` units (hyperfrontend, the
  iframe practice, micro-app-jd, wujie, the web-components practice, bit;
  `ownership.platform-team-role-required`=n cells). Hard non-developer-composition
  retains only entando and commercetools-frontend and is flagged in the report as
  effectively an implementation pick (constraints.md 2.8).
- Phrasing A: "Can a standing platform-owner role exist to own a central roster
  artifact (`ownership.platform-team-role-required`)? Must non-developers hold
  page-composition authority through a supported UI
  (`ownership.non-developer-composition`)?"
- Phrasing C: "Is there, or will there be, a team whose job is running the glue: the
  shared config, the routing map, the registry? And who actually assembles pages:
  engineers, or content/business people in a tool?"
- Audit: B3 (the role question is a staffing fact); B1 clean.

### 5.6 `question.impl.paved-road`

- Binds `constraint.paved-road` (constraints.md 2.10; weak default, strong ceiling,
  never hard) and `constraint.schema-validated-boundary` (weak/strong). Pure ranking:
  it never eliminates; violated preferences appear as tradeoffs (REQ-REPORT-03).
- Phrasing A: "Which of these must ship first-party rather than be built in-house:
  lifecycle-failure handling, messaging, loading/error UI, composed local dev,
  schema-validated boundary payloads?"
- Phrasing C: "When something fails to load, who builds the spinner, the error box,
  and the local dev setup where all pieces run together: the tool, or your team?"
- Audit: B1 (list of concerns, not adjectives); B2 (DIY is priced, not forbidden).

---

## 6. Edition-stage operability questions (REQ-ENT-03)

Marked stage: implementation/edition selection, strictly after family selection; a
hard answer here eliminates editions and operating plans, never families, and never
downgrades a community edition's architectural fit (`scope.edition` firewall,
constraints.md 2.14; enterprise-layer.md section 11).

- **Id scheme**: one question per operability seed, ids
  `question.edition.operability.<seed-slug>` adopting the enterprise-layer.md
  section 3 seed table verbatim (self-host-vs-managed, private-registry,
  approval-workflow, rbac, audit-log, environment-promotion, rollback,
  usage-visibility, compatibility-checking, central-resolution,
  enterprise-auth-integration, consumer-credentials, subscription-entitlement,
  managed-feature-deployment, managed-service-preference), each binding its
  `constraint.operability.<seed-slug>` (constraints.md 2.14).
- **Answer semantics** (REQ-ENT-07): every atom is satisfiable by an edition
  capability, a third-party product, or in-house build; a hard answer therefore means
  "some operable plan must satisfy it" and prices candidates. Only combined with a
  managed answer on `question.edition.operability.managed-service-preference` does it
  select commercial editions. Planned capabilities never satisfy any binding
  (REQ-AVAIL-01); wherever a planned capability fits (every HyperFrontend Enterprise
  atom is `avail.announced-planned`, implementations.md 2.7), the shipping
  alternative is shown beside it (REQ-AVAIL-02).
- **Unlock**: the b2b credentials/entitlement subset (consumer-credentials,
  subscription-entitlement) unlocks only from `derive.b2b-chain` (constraints.md
  section 3; topology.md 2.10 question seeds).
- **Dual-phrasing pattern** (one worked example; the rest follow the same transform
  of their seed wording): `question.edition.operability.rbac`:
  Phrasing A: "Do you need organization-wide roles and permissions over the
  composition platform (`governance.rbac`)?"
  Phrasing C: "Does someone in your company have to be able to control who may
  publish, approve, or remove pieces, with those rules enforced by the platform
  rather than by convention?"
- **Audit**: B1 risk is highest in this block (operability lists read like feature
  tours), defended by the firewall statement shown with every question ("this
  narrows *how you would operate* a choice, never *which architecture fits*") and by
  REQ-AVAIL-02's both-shown rule whenever a planned capability would otherwise be
  favored.

---

## 7. Guards and gap-trigger questions

Asked only on demand; several are never asked at all.

- **`question.guard.artifact-integrity`**: binds `constraint.artifact-integrity`
  (constraints.md 2.12). The landscape-wide answer is No (19x n), so a hard answer
  emits the `gap.artifact-integrity` record (REQ-GAP-02) instead of an empty
  recommendation; the question is offered only when supply-chain policy facts appear.
  Phrasings: A "Must participant code be integrity-verified before execution
  (`security.artifact-integrity-verification`)?" / C "Must the system prove the code
  it runs is exactly the code that was published, before running it?"
- **`question.guard.rsc-federation`**: binds `constraint.rsc-federation`; no
  unqualified y exists anywhere; hard = `gap.rsc-federation` record. Offered only if
  the user raises RSC.
- **`question.guard.verbatim-bytes`**: binds `constraint.verbatim-participant-bytes`
  (constraints.md 2.2); unlocked by `derive.regulated-release` (confirm). Hard
  eliminates `family.virtualized-rehosting` (bytes transformed before execution,
  families.md 3.6) and rewriting server tiers.
  Phrasings: A "Must participant code execute exactly as shipped, with no host-side
  rewriting (`ownership.participant-bytes-verbatim`)?" / C "If auditors compared the
  code your teams shipped with the code that actually ran in the page, must those be
  byte-identical?"
- **Never asked, answered by the engine** (REQ-Q-01 smallest-set duty):
  `constraint.installable-today` (inventory guard, uniform y) and
  `constraint.code-ownership` (uniform y across 30 units: when a user asks for
  "clear code ownership", the engine answers "every strategy provides this" instead
  of spending a question; taxonomy 4.1).

---

## 8. Coverage check

Every constraint in constraints.md section 2 is reachable by exactly one question or
derivation route, and every question binds at least one constraint (REQ-Q-01
traceability):

| Constraint | Route |
|---|---|
| fault-containment / main-thread-protection / css-containment | 3.9 (+ follow-ups; css also entailed by legacy topology prior) |
| seamless-ux / a11y-continuity | 3.10 |
| sync-boundary-calls | 3.15 |
| participant-self-containment | 3.14 |
| distinct-principal / interference-damping | 3.5 |
| verbatim-participant-bytes | 7 (guard) |
| independent-deploy / atomic-release | 3.2 |
| runtime-roster-change / no-host-change-per-participant | 3.13 |
| static-hosting-only / no-new-infra-tier | 3.7 |
| composed-first-paint | 3.8 |
| single-screen-mixing / persistent-chrome / cross-boundary-soft-nav | 3.3 (+ chrome follow-up) |
| participant-modification-ceiling / strangler-path | 3.4 |
| host-modification-ceiling | 3.14 (white-label) and 3.4 host facet |
| bounded-exit | 4 (trajectory) |
| no-version-governance | 3.6 |
| framework-major-coexistence | 3.11 (mostly derived) |
| payload-dedup | 3.12 |
| no-platform-team / non-developer-composition | 5.5 |
| instant-rollback / version-pinning | 5.2 |
| per-user-targeting | 6 (`question.edition.targeting`) |
| explicit-drift-surfacing / schema-validated-boundary | 5.3 / 5.6 |
| no-strategy-runtime / paved-road | 3.16 / 5.6 |
| no-vendor-control-plane / no-delivery-intermediary / osi-core-license | 5.4 |
| installable-today / code-ownership | never asked (engine-answered guards) |
| artifact-integrity / rsc-federation | 7 (gap triggers) |
| memory-budget | 3.9 cost note (never hard-eliminating) |
| maintenance/stewardship/adoption/stable-line/no-forced-remigration lens | 5.1 |
| operability block (2.14) | 6 |

Counts: 16 family-stage questions (of which 5-16 are conditionally gated), 1 state
fork rule + 10 trajectory ids (9 adopted + bounded-exit), 6 implementation-stage, 1
edition block (15 seed-derived ids + targeting), 3 guards, 2 engine-answered. Typical
answered path: 6-10 questions before a family-stage recommendation (REQ-Q-03), 2
questions to the earliest legitimate "you probably do not need microfrontends" exit
(REQ-Q-04).

---

## 9. Disposition of ranks 14 and 16 (2026-08-29)

Both questions were omitted from the published projection on the judgment that their
eliminations are implementation-scoped rather than family-scoped. Re-derived against
the matrix, that judgment is wrong for rank 14 and half wrong for rank 16. This section
records the corrected disposition; it introduces no new constraint and no new
elimination claim, only the family-scope reading of bindings constraints.md already
declares at `scope.family` (2.1 `constraint.participant-self-containment`, 2.6
`constraint.host-modification-ceiling`, 2.10 `constraint.no-strategy-runtime`).

Method: a family is eliminated at `scope.family` only when *every* member unit in the
families.md section 2 member list fails the binding on a definite cell. A `conditional`
cell is never read as satisfied (REQ-MATRIX-05) and never as proof of failure either,
so a family holding a conditional member is reported as narrowed to that posture, not
eliminated. Layers (zephyr-cloud, picard-js) are not members and cannot rescue a
family: they die with the family they attach to (section 1.1, families.md 6.1).

### 9.1 `question.host.negotiability` (rank 14): family-scoped, keep at stage 1

Verdict: **family-scoped**. Its hard answer carries the widest family cut in the
mid-table, 7 of 12 families, second only to rank 2. The entry at 3.14 understated it by
listing only unit eliminations (piral, entando, commercetools-frontend) while stating
the family fact in the "retains" clause instead; the projection read the elimination
list literally and demoted the question. The index row's Max G1 cell should read
`7/12 families` in place of "host-inversion + runtime-requiring units".

Binding: `constraint.host-modification-ceiling`(maxLevel=1) hard plus
`constraint.participant-self-containment` hard, both `scope.family`, entailed by
`derive.white-label-fit` on `ownership.participant-unmodifiable-host`=y. Deciding row:
`ownership.participant-unmodifiable-host` ("can the participant run inside a host page
whose owner makes at most one minimal documented change, adopting no build tool or
framework?", attributes.md). This is the same family answer topology.md 2.8 already
states for `topology.white-label`.

Family-scope eliminations, answer "hosts cannot be asked to change anything" (level-1
host ceiling) -> eliminated family ids, with the row proving every member fails:

| Eliminated family | Members and their `ownership.participant-unmodifiable-host` cells |
|---|---|
| `family.route-partition` | reverse-proxy-route-composition `na` ("No host page exists to embed into"), nextjs-multi-zones `n` ("The host must be the routing tier itself; no one-tag embed exists"), cloudflare-workers-microfrontends `n` ("no embeddable seam; participation means being a Worker behind the organization's router") |
| `family.lifecycle-orchestration` | single-spa `n` ("the host must run the single-spa root config"), piral `n` ("the host must be a built Piral shell"); over-determined by `migration.host.shell-takeover-required` (single-spa `y`, piral `c`) |
| `family.virtualized-rehosting` | qiankun `n`, micro-app-jd `n`, wujie `n`, web-fragments `n`, each cell reading that the host must install the runtime and author mount code |
| `family.modular-monolith` | modular-monolith `n` ("Modules cannot run in arbitrary host pages") |
| `family.package-composition` | monorepo-package-composition `n`, bit `n`, commercetools-frontend `n`, each requiring the host to be a build |
| `family.spa-routing` | plain-spa-routing `n` ("Participants exist only inside the app's own build") |
| `family.server-templates` | server-rendered-templates `n` ("no one-tag embedding model") |

The `na` on reverse-proxy-route-composition is not ignorance: it records that the family
has no embed seat at all, which fails a constraint whose whole subject is the embed
seat. Read it as a fail here, and only here, with the reason stated in the report.

Survivors, and why they are not eliminations: `family.document-embedding`
(iframe-composition `y` "one iframe tag", hyperfrontend `y` "one script tag or install
on an unmodifiable host", luigi `c` via the container custom element),
`family.custom-element-composition` (web-components-composition `y` "one tag plus one
script"; entando `n` falls at implementation scope),
`family.server-fragment-assembly` (opencomponents `y` "one script plus tag on any
page"). Two families survive on conditional cells only and are therefore *narrowed*,
not eliminated: `family.module-graph-federation` (module-federation `n`, but
native-federation `c` in orchestrator mode and import-map-architectures `c` with an
inline map plus a module script) and `family.islands` (`c`: is-land needs one script
tag, Astro and Fresh hosts are the framework app itself). Reporting them as eliminated
would overstate the matrix; reporting them as retained without the posture would
overstate their fit.

picard-js scores `y` and attaches to two eliminated or narrowed families. It does not
rescue either: it owns no boundary, and its `y` comes from custom-element mounting
regions, the seat that belongs to `family.custom-element-composition`, which is
retained on its own member.

Placement: stays at family stage, gated as now on the you-are-the-embed fact reported by
rank 1. Its low rank is a G3 effect (the premise is rare), never a scope effect, and
the index note should say so.

### 9.2 `question.orchestration.appetite` (rank 16): split, do not demote wholesale

Verdict: **dual-scope; the hard limb is family-scoped, the ranking limb is stage 2**.
constraints.md 2.10 already declares `constraint.no-strategy-runtime` as `scope.family`
at the pole level and `scope.implementation` inside families whose thickness spans the
scale, so a wholesale move to stage 2 loses two real family eliminations. Split the
question instead:

- **Hard limb, stays at stage 1**: "nothing strategy-owned may ship on the page or
  impose a version floor" binding `constraint.no-strategy-runtime` hard. Family-scope
  eliminations, proved on `runtime.shared-runtime-library` (definite `y` for every
  member, no conditionals):

| Eliminated family | Members and their `runtime.shared-runtime-library` cells |
|---|---|
| `family.lifecycle-orchestration` | single-spa `y` ("the single-spa orchestrator plus SystemJS drives every participant's lifecycles"), piral `y` ("piral-base loader plus shell state container mediate all pilets") |
| `family.virtualized-rehosting` | qiankun `y` ("Host qiankun runtime fetches, sandboxes, and executes every sub-app"), micro-app-jd `y`, wujie `y` ("the host page runs the wujie runtime that every child's environment is welded to"), web-fragments `y` |

  Both eliminations are definitional rather than incidental, which is what makes them
  family-scope: a mount/unmount lifecycle contract needs an orchestrator on the page to
  call it, and a simulated-realm sandbox *is* a shipped runtime.

- **Ranking limb, moves to stage 2**: `constraint.paved-road` (weak or strong, never
  hard: DIY is always possible, only priced). It is the same trade
  `question.impl.paved-road` (5.6) already runs, so fold it there and let 5.6 carry the
  symmetric cost phrasing. This limb is what makes rank 16 look implementation-scoped.

- **Implementation-scope work that stays inside surviving families** (the FC-5 case):
  within `family.document-embedding` the hard limb keeps iframe-composition
  (`n`/`n`/`y`) and drops hyperfrontend and luigi; within
  `family.custom-element-composition` it keeps web-components-composition and drops
  entando (`framework.version-floor-imposed`=y); within
  `family.module-graph-federation` only import-map-architectures survives, conditionally;
  within `family.server-fragment-assembly` it keeps the server-composed profile and
  drops opencomponents (version floor `y`).

Two reading rules this limb needs before it is published, both flagged rather than
silently applied:

1. `buildtime.host-integrates-buildless` is vacuous for build-fused units. Read
   literally, its `n` cells would eliminate the baselines, which constraints.md 2.10
   explicitly retains. There is no separate participant for a baseline host to
   integrate, so the atom does not apply; score the baselines on the first two atoms
   only.
2. `family.islands` is unresolved. islands-architecture scores `runtime.shared-runtime-library`=y
   ("the implementation's hydration loader; version lockstep automatic within one
   build"), which fails the binding, yet islands-architecture appears in none of the
   three pole lists of taxonomy.md 2.11. Either the pole list gains islands at
   `orchestration.library`, and the elimination follows for this one-member family, or
   the atom is judged vacuous there as in rule 1. Resolve the pole list before claiming
   the elimination; do not publish it as decided.

### 9.3 Host capability floor for separate-document embedding

Needed by the downstream "what would have to change" explanation: the concrete list of
what a host must be able to do for `family.document-embedding` to work at all. Below the
floor, no amount of participant engineering helps and the honest answer is that the
family does not apply to that host, not that it fits poorly. The floor is what
`migration.host.min-level`=`migration.trivial-adaptation` (level 1) actually means on
this family, per families.md 3.7 and migration.md section 2.

Hard floor (all four required; failing any one removes the family for that host):

1. **Place an element.** The host must be able to add one element to its own DOM at a
   position and size it controls, and to keep controlling that geometry:
   `ux.natural-layout-flow`=n for the whole family, so the host measures and manages
   the rectangle (hyperfrontend: "deliberate host geometry authority"; iframe practice:
   fixed rectangle with height-reporting as the workaround). A host that renders only
   fixed server templates with no injection point, or that sanitizes frame elements out
   of authored content, cannot clear this.
2. **Permit framing.** The host's own Content-Security-Policy must allow the embed
   origin in `frame-src` (a `frame-src 'none'` or an origin allowlist the vendor is not
   on is a hard stop), and the participant must be able to name that host in its
   `frame-ancestors` or `X-Frame-Options` (`security.embedding-authorization`=c for the
   whole family: the participant sets the header, the browser enforces it, and it is
   explicitly an operator job, not an SDK feature). Both directions are required; either
   one alone fails closed.
3. **Serve over https.** The host page must be https and the embed URL must be https:
   an http frame inside an https document is blocked as mixed content, and the
   capabilities the family leans on (partitioned storage, Storage Access API, secure
   cookies, site isolation) are secure-context gated. CORS is not part of this floor:
   frame navigation is CORS-exempt.
4. **Tolerate a second document.** The host's page budget must absorb a second browsing
   context: per-unit document boot and per-process memory where site isolation applies
   (roughly 10 to 13 percent desktop, 3 to 5 percent partial Android on Chrome
   measurements), multiplied by co-displayed units. A host on a hard low-end-device
   budget composing many units fails here even when items 1 to 3 pass.

Conditional additions, required only by the posture the vendor chooses (each one raises
what the host must clear, so state which posture the answer assumes):

- **Run one script.** The SDK-handshake posture needs the host to load one script from
  the embed's origin, so the host's `script-src` must allow that origin. The bare-frame
  posture needs none: that difference is the whole gap between a level-1 and a
  level-4 embedding contract on the participant side (families.md 3.7 migration field).
- **Let messages through.** The message protocol needs `postMessage` between the two
  documents, plus whatever host-side listener the protocol requires. A host that
  proxies, rewrites, or strips frame content breaks the channel.
- **Accept the seam, or pay for it.** Overlays clip at the frame edge unless the host
  implements an overlay protocol, focus and screen-reader continuity break at the
  boundary (`ux.screenreader-continuity`: `c` for the iframe practice and needing a
  per-frame title, unknown for hyperfrontend), and frame navigations can pollute
  top-level history. These are not adoption blockers; they are the engineering program
  the family bills for, and they belong in the same answer so the floor is not read as
  the whole cost.
- **Reach the origin, and expect no third-party cookies.** The embed origin must be
  reachable from the customer's network (corporate proxy and allowlist reality), and
  the embed must hold its own session without third-party cookies: cross-origin frames
  get partitioned storage by default in all 2026 engines, with cookies engine- and
  user-conditional (CHIPS, Storage Access API).

---

Next stage (deliverable 7, question-graph.md): wire prerequisites, unlock conditions,
and the "most useful next question" policy over these ids; the dominance prunes
noted at ranks 2 and 3 and the exclusion warnings of constraints.md section 4 become
graph edges there (REQ-Q-08, REQ-ORCH-10).
