# Scenario: independent-teams-different-frameworks

Status: TRACED (2026-08-29).

## 1. Situation

We are an insurance group whose online presence grew up as three separate products: quoting,
claims, and a customer account area, each owned by its own team of eight to twelve engineers
with its own repository and its own release schedule. Over the years the teams chose
different tools; each product is built on a different UI stack, and each team is productive
and proud of its choice. Customers increasingly experience this as three different websites
wearing the same logo, and our group CPO has made "one connected experience" the top goal for
next year, with a nine-month target for shared navigation and a single visual language. When
we floated standardizing on one stack, two of the three teams pushed back hard, and
leadership explicitly decided not to mandate it; team autonomy is considered a hiring and
retention asset here. Each team is willing to do real work inside its own codebase, such as
changing how their application starts up or restructuring styles, as long as it does not mean
rewriting the product or synchronizing releases with the other teams. Nobody may force
another team to upgrade a shared library on someone else's schedule; that rule is written
into our engineering handbook. There is no platform team today, though the CPO has budget
approved to staff a small one starting next quarter.

## 2. Normalized inputs

Re-normalized 2026-08-29 against the canonical ids of
[constraints.md](../model/constraints.md), [questions.md](../model/questions.md),
[question-graph.md](../model/question-graph.md), [topology.md](../model/topology.md),
[migration.md](../model/migration.md), and
[state-transition.md](../model/state-transition.md). Changes: each input now names its
constraint binding, class, subject, and derivation route; the handbook rule is split into its
two products, `constraint.no-version-governance` (hard, entailed) and
`constraint.framework-major-coexistence` (hard; see Model finding 1 on the derivation route);
"three different UI stacks must run inside one experience" binds
`constraint.framework-major-coexistence` and explicitly NOT
`constraint.single-screen-mixing`, which stays unbound because the Situation never says two
teams' output shares a screen (guardrail 5 depends on that distinction, and rank 3 becomes
this trace's decisive open question); the nine-month goal is reclassified from hard-constraint
to the governing horizon per `engine.rule.horizon-select`, and doubles as the decision horizon
`predicate.target-credible` compares against; the participant ceiling is stated as
maxLevel=`migration.moderate-refactor` (5), which subsumes the brief's "(7) and above refused"
and also excludes level 6; the three participants are batched into one ownership class per
question-graph.md 4.2 R1. Values otherwise unchanged.

Subjects: `host` (the shared navigation surface, which does not exist yet) and
`participant:quoting`, `participant:claims`, `participant:account`, one ownership class
(own-team, source access, working builds, active maintainers).

| Input | Canonical binding | Class / marking |
|---|---|---|
| Topology label | `topology.independent-teams`, co-evidenced `topology.fragmentation` | label (informational; facts govern) |
| `ownership.multi-repo` = yes, `ownership.independent-releases` = yes | rank 1 facts; topology evidence (topology.md section 3) | observed fact, `state.current` |
| `ownership.single-team` = no, `ownership.external-participant` = no, `ownership.acquired-participant` = no, `ownership.host-unmodifiable-participant` = no | rank 1 facts; block `derive.single-coordinated-team`, `derive.external-principal`, `derive.unmodifiable-participant-floor` | observed fact, `state.current` |
| "must not mean synchronizing releases with the other teams"; each team ships on its own schedule today | `constraint.independent-deploy` (global) via `question.deploy.independence` = `answer.deploy-independence.no-shared-train`; confirms the `topology.independent-teams` hard tendency (constraints.md 2.15) | `class.hard-constraint` |
| Handbook rule: nobody may force another team to upgrade a shared library on someone else's schedule | fact `ownership.uncoordinated-upgrades` = y, premise of `derive.broken-governance`, which binds `constraint.no-version-governance` (global) hard and `constraint.framework-major-coexistence` strong | `class.hard-constraint` (entailed; no question spent, R3) |
| Incompatible shared-library versions must be able to coexist; three different UI stacks must run inside one experience; leadership declined to fund or mandate alignment | `constraint.framework-major-coexistence` (global) via `question.deps.major-coexistence` answered in its hard form (funding fact present, estate fact borrowed; Model finding 1), composed with the strong binding above; strictest class wins (E4) | `class.hard-constraint` |
| `migration.appetite`, each participant: bootstrap edits and style restructuring yes, product rewrite no | `constraint.participant-modification-ceiling`(participant:quoting/claims/account, maxLevel=`migration.moderate-refactor`) via `question.migration.participant-ceiling`, one ownership-class battery (R1) | `class.hard-constraint` (stated ceiling, migration.md section 5) |
| Capability preconditions: source access, reproducible builds, active maintainers, all three teams | `question.migration.capability-preconditions` (migration.md section 8): nothing caps the ceiling below the stated level | observed fact |
| No composing surface exists yet; host work is unconstrained in depth but unstaffed until next quarter | `question.migration.host-ceiling` unanswered (`rule.unanswered-inert`); the staffing state feeds `fit.operational` and the E13 septet, never a binding | fact; no constraint id |
| "One connected experience" delivered in nine months | `engine.rule.horizon-select`: governing horizon `migration.horizon.first-integration`, report risk line; also the decision horizon for `predicate.target-credible` | horizon selection, not a constraint |
| Shared navigation and a single visual language | product goal; reaches the engine only through the still-unanswered `question.granularity.single-screen` and its `question.ux.chrome-persistence` follow-up | unbound (see 4.9) |
| Degree of visual seamlessness beyond shared navigation and visual language, desired | `constraint.seamless-ux` (global) via `question.ux.seam-tolerance`; the desirability facet ceiling caps it here regardless (REQ-Q-02) | `class.strong-preference` |
| Three independently deploying parties | premise of `derive.many-party-drift`, which binds `constraint.explicit-drift-surfacing` at `scope.implementation` | `class.strong-preference` (entailed) |

State septet, framework-stack dimension (the rejected consolidation):

| Field | Value |
|---|---|
| `state.current` | three different stacks |
| `state.target` | keep three stacks (consolidation considered and rejected) |
| `transition.willingness` | absent; two of three teams refused |
| `transition.cost` | `migration.framework-migration` for two products |
| `transition.authority` | leadership holds it and explicitly declined to use it |
| `transition.confidence` | `transition.confidence.undesirable` (1) |
| `transition.horizon` | not applicable |

Platform-team dimension: `state.current` = no platform team; `state.target` = small platform
team; `transition.confidence.leadership-approved` (4) with `buyin.budget` and
`buyin.executive-sponsorship` present, `buyin.staffing` starting next quarter.

Deployment-model dimension: `state.current` = independent pipelines and cadences;
`state.target` equal; `transition.confidence.operating-in-target` (7), so no transition
reasoning applies to it (state-transition.md section 2).

## 3. Guardrail expectations

Sanity checks only; no predicted winner.

- No recommendation may require any team to change UI frameworks or rewrite its product: the
  appetite ceiling sits below `migration.framework-migration` (hard), and the consolidation
  target is discarded at confidence 1 per
  [state-transition.md](../model/state-transition.md) section 3.
- Strategies whose correctness depends on synchronized dependency versions or coordinated
  releases are eliminated ([topology.md](../model/topology.md) section 4 elimination for
  uncoordinated-upgrade facts), regardless of how well they score elsewhere (REQ-Q-02).
- The framework-coexistence hard constraint eliminates single-framework strategies outright.
- The trace must not recommend reorganizing or merging the three teams to fit a technology
  (REQ-STATE-11).
- A non-composition outcome (three deployables sharing a design system and navigation
  conventions, connected by ordinary links) does satisfy every hard constraint above; the
  trace may reach it, but only by showing the "one connected experience" goal is satisfiable
  without composition, never by dropping a hard constraint.

REQ-TRUST-01 outcome classes allowed (ids per [README.md](README.md)): `trust.hf-community`,
`trust.other-oss`, `trust.commercial`, `trust.no-match`, `trust.change-assumptions`;
`trust.no-mfe` only in the shared-design-system-plus-links form described above;
`trust.hfe-future` only under the REQ-AVAIL-02 pairing.

## 4. Trace

Hand-traced 2026-08-29 through the [decision-engine.md](../model/decision-engine.md) pipeline
(E1 to E17), with cells quoted from
[matrix-compact.tsv](../matrix/matrix-compact.tsv) and per-cell conditions from
`matrix/columns/<unit>.json` (version.research 2026.08.0).

### 4.1 E1 `engine.step.intake`

The section 2 table is the intake record. Rank 1 fills the ownership checklist for three
peer boundaries; the release-independence statement answers `question.deploy.independence`
at its hard level; the handbook rule is a `state.current` capability fact consumed by E3
rather than a question (R3 derivation-first, so rank 6 is never asked); the appetite
statement answers one rank-4 battery for the single ownership class the three participants
form (R1), with the capability preconditions confirming that nothing caps the ceiling below
the stated level; the seamlessness wish answers `question.ux.seam-tolerance` at
`class.strong-preference` (the desirability facet ceiling caps it there regardless).

Two intake decisions carry the trace and are recorded explicitly:

- The nine-month "one connected experience" goal is not a constraint. Per
  `engine.rule.horizon-select` it selects `migration.horizon.first-integration` as the
  governing horizon for every appetite binding, produces a report risk line, and supplies
  the decision horizon that `predicate.target-credible` compares transition horizons
  against in 4.4.
- "Shared navigation and a single visual language" is a product goal whose architectural
  content is exactly `question.granularity.single-screen` (does one screen concurrently
  render two teams' output?) and its `question.ux.chrome-persistence` follow-up (must the
  navigation stay mounted across transitions?). The Situation answers neither. Per
  `rule.unanswered-inert` nothing binds, `constraint.single-screen-mixing` and
  `constraint.persistent-chrome` stay `class.irrelevant-by-default`, and rank 3 becomes the
  single most useful next question (4.9). Binding either of them from the goal statement
  would be the B4 failure questions.md 1.3 forbids, and would contradict guardrail 5 by
  eliminating the page-seam outcome the brief declares admissible.

### 4.2 E2 `engine.step.topology-infer`

`ownership.multi-repo` + `ownership.independent-releases` with no external, acquired, or
unmodifiable participant infer `topology.independent-teams` for all three host/participant
boundaries. `ownership.uncoordinated-upgrades` = y is simultaneously the primary evidence
for `topology.fragmentation` (topology.md section 3), and topology.md 2.2's own follow-up
instructs the re-test: "can governance actually enforce a shared contract? If not, re-test
against `topology.fragmentation`." It cannot, by handbook rule, so both labels are inferred
and `question.topology.confirm` is confirmed for the pair (the brief's label row is
informational; facts govern).

Priors armed as the union of the two rows of constraints.md 2.15, per
`engine.rule.prior-bindings`:

- hard tendencies already covered by explicit answers or entailed derivations:
  `constraint.independent-deploy` (both rows), `constraint.no-version-governance`
  (fragmentation row);
- `constraint.fault-containment` (fragmentation row, blast radius) enters as a
  `prior-unconfirmed` hard tendency and therefore eliminates nothing: its confirming
  question is rank 9, which is itself gated on a rank-3 yes and is not askable yet. It goes
  to `unresolvedQuestions`;
- preference tendencies enter as `prior-unconfirmed` preferences that may rank:
  `constraint.seamless-ux` (already answered), `constraint.explicit-drift-surfacing`
  (independently entailed in 4.3), `constraint.no-strategy-runtime` and
  `constraint.no-platform-team` (fragmentation row), whose confirming questions are rank 16
  and `question.impl.platform-team`.

The `constraint.no-platform-team` prior is the only route by which the Situation's "no
platform team today" reaches E7 at all; see Model finding 3.

### 4.3 E3 `engine.step.derive`

Fired:

- `derive.broken-governance` (entailed arm; premise `ownership.uncoordinated-upgrades` = y
  present as a written handbook rule, which states the capability is absent rather than
  merely disliked, topology.md 2.9): binds `constraint.no-version-governance` (global) at
  `class.hard-constraint`, and `constraint.framework-major-coexistence` (global) at
  `class.strong-preference`.
- `derive.many-party-drift` (entailed; three independently deploying parties and every
  surviving candidate scores `contracts.drift-surface` = y): binds
  `constraint.explicit-drift-surfacing` at `class.strong-preference`, `scope.implementation`.

Not fired (premises absent): `derive.single-coordinated-team` (three teams, three repos),
`derive.external-principal` and `derive.plugin-admission` and `derive.b2b-chain` (no external
participant, participants known, one legal entity), `derive.unmodifiable-participant-floor`
and `derive.legacy-untouchable` (every participant is actively maintained with source access
and a working build), `derive.no-cross-deploy-control` (the group does control its own
deployments; what is stated is a policy against forced upgrades, not an absence of control),
`derive.white-label-fit` (the group is the host), `derive.static-estate`, `derive.seo-surface`,
`derive.regulated-release`, `derive.payload-budget` (no budget fact).

`derive.mixed-majors-present` did NOT fire: its premise names "incompatible majors of one
framework", and this estate runs three different frameworks. The hard
`constraint.framework-major-coexistence` binding therefore arrives from the explicit answer
route of questions.md 3.11 rather than from a derivation. This is Model finding 1 and it is
disclosed on every conclusion that depends on the constraint.

### 4.4 E4 `engine.step.compose`

| Constraint | Subject | Class | Params | Slot | Origin |
|---|---|---|---|---|---|
| `constraint.independent-deploy` | global | hard | | current | answer:question.deploy.independence; topology prior (confirmed) |
| `constraint.no-version-governance` | global | hard | | current | derive.broken-governance; fact ownership.uncoordinated-upgrades |
| `constraint.framework-major-coexistence` | global | hard | | current | answer:question.deps.major-coexistence (hard form) composed with derive.broken-governance (strong); strictest class wins |
| `constraint.participant-modification-ceiling` | participant:quoting, :claims, :account | hard | maxLevel=`migration.moderate-refactor` | current | answer:question.migration.participant-ceiling (one R1 class battery) |
| `constraint.seamless-ux` | global | strong-preference | | current | answer:question.ux.seam-tolerance |
| `constraint.explicit-drift-surfacing` | global (`scope.implementation`) | strong-preference | | current | derive.many-party-drift; topology prior |
| `constraint.fault-containment` | global | prior-unconfirmed hard tendency (inert) | | current | topology.fragmentation prior |
| `constraint.no-strategy-runtime` | global | prior-unconfirmed strong | | current | topology.fragmentation prior |
| `constraint.no-platform-team` | global (`scope.implementation`) | prior-unconfirmed strong | | current | topology.fragmentation prior |

Target slots, evaluated against `predicate.target-credible`:

- **Framework stack**: `transition.confidence.undesirable` (ordinal 1). Per
  state-transition.md section 3, ordinals 0 to 1 discard the target for recommendation
  purposes: it is recorded only so the report can explain why it was set aside. It binds
  nothing, produces no aspiration annotation, and triggers no
  `rule.aspiration-warning`. This is half of guardrail 1.
- **Platform team**: ordinal 4 (`leadership-approved`) plus the buy-in minimum subset
  (`buyin.budget` present, `buyin.staffing` scheduled for next quarter), authority held by
  the CPO, horizon inside the nine-month decision horizon. The predicate PASSES, matching
  the calibration evidence recorded in state-transition.md section 4 for this fixture. The
  credible target participates only in the `bestAfterTransition` evaluation (E13);
  `rule.no-target-satisfies-hard` keeps it out of current-state elimination.
- **Deployment model**: target equals current at ordinal 7; no transition reasoning.

### 4.5 E5 `engine.step.relations`

- `rel.excludes` three-way, `constraint.no-version-governance` (hard) plus
  `constraint.independent-deploy` (hard) against `constraint.payload-dedup` (hard): both
  `from` sides are bound hard, so the warn edge on rank 12 is armed. Its `rel.requires`
  prerequisite (dedup exists only with version governance or build fusion) cannot hold once
  E6 runs, so rank 12 is presented as a tradeoff acknowledgment rather than a live choice
  (question-graph.md 1.3 rank-12 row). No `gapSeed` is queued: the `to` side is never bound,
  so `gap.autonomous-dedup` is armed but does not fire.
- `rel.excludes` `constraint.independent-deploy` against `constraint.atomic-release`:
  the `to` side is unbound; the exclusion is inert and is the reason the rank-2 train branch
  is closed for this fixture.
- `rel.relaxes` on a negated `constraint.single-screen-mixing`: NOT active, because rank 3 is
  unanswered rather than answered "no". Consequence: the co-residence cluster
  (`constraint.fault-containment`, `constraint.css-containment`,
  `constraint.framework-major-coexistence`, `constraint.no-version-governance`) is neither
  relaxed nor unlocked, and the hard coexistence binding stays live against families whose
  cells are `na` for lack of co-residence. That collision is Model finding 2.
- No other `rel.requires` or `rel.relaxes` premise is active.

### 4.6 E6 `engine.step.eliminate-family` (cells quoted from matrix-compact.tsv)

| Eliminated | Violated binding(s) | Deciding cells |
|---|---|---|
| `family.modular-monolith`, `family.package-composition`, `family.spa-routing`, `family.server-templates`, `family.islands` | `constraint.independent-deploy`; `constraint.participant-modification-ceiling`; `constraint.framework-major-coexistence` | `deployment.host-rebuild-required` = y for modular-monolith, monorepo-package-composition, plain-spa-routing, server-rendered-templates, islands-architecture, bit (commercetools-frontend = c, condition "any component code change requires rebuilding and redeploying the single app" fails the need); `ownership.deploy-schedule-ownership` = n for all; `migration.participant.min-level` conditions place existing separate applications at level 6 (modular-monolith, monorepo-package-composition, plain-spa-routing, islands-architecture), 6 to 7 (server-rendered-templates, "SPAs escalate to migration.framework-migration") and 7 (commercetools-frontend), all above maxLevel 5; `framework.same-framework-major-coexistence` = n for all seven units |
| `family.module-graph-federation` | `constraint.no-version-governance` | `coordination.shared-dependency-governance` = y for module-federation, native-federation, import-map-architectures (all three members); families.md 3.4 "the family's defining burden". The ceiling does NOT eliminate it (floors 3, 3 to 4, and 1 to 3 all sit inside maxLevel 5), so the elimination is purely organizational |
| `family.lifecycle-orchestration` | `constraint.no-version-governance` | `coordination.shared-dependency-governance` = y for single-spa and piral; families.md 3.5 inherits the burden. Floors 4 and 3 to 4 are inside the ceiling; again a purely organizational elimination |

Layers die with their host families: `impl.zephyr-cloud`
(`coordination.shared-dependency-governance` = y, attached to module-graph-federation) and
`impl.picard-js` (attached to module-graph-federation and lifecycle-orchestration;
independently `avail.inactive`).

Per-configuration exclusions inside surviving families (E6 cell-level semantics):

- `impl.entando`: `ownership.distrusted-cadence` = n ("go-live is instance-install mediated,
  so cadence is centrally gated rather than unilateral") fails
  `constraint.no-version-governance`; `ownership.deploy-schedule-ownership` = c whose
  condition ("production go-live needs instance-side install by platform operators") fails
  `constraint.independent-deploy`, and there is no platform team to perform the install; host
  floor level 8 ("wholesale platform adoption").
- `impl.opencomponents`: `framework.same-framework-major-coexistence` = `?`, which never
  satisfies a hard requirement and is surfaced as data uncertainty (REQ-MATRIX-05); and
  `migration.participant.min-level` condition "whole applications must be decomposed into
  oc-compiled components (migration.major-refactor)", level 6 above maxLevel 5. Its
  client-mode profile does not rescue either cell.

Retained, per configuration:

- `family.document-embedding`: iframe-composition practice (`framework.same-framework-major-coexistence`
  = y, `runtime.side-by-side-versions` = y, `coordination.shared-dependency-governance` = n,
  `ownership.uncoordinated-upgrades` = y, `ownership.distrusted-cadence` = y,
  `deployment.host-rebuild-required` = n, participant floor level 1 "already-deployed apps
  embed unchanged; at most serving-config header changes"); impl.luigi in iframe mode (y / c,
  same governance cells, floor level 1 embed-only or level 4 full client, both inside the
  ceiling); impl.hyperfrontend retained with two conditions attached,
  `ownership.distrusted-cadence` = c and `deployment.host-rebuild-required` = c, both
  carrying the same condition ("no while the contract holds; contract-changing updates
  require the host to install a regenerated shell"). That condition is compatible with the
  handbook rule, because the work it schedules is host-side shell regeneration rather than a
  forced participant upgrade, but it is carried on the candidate and never promoted
  (participant floor level 4, inside the ceiling).
- `family.virtualized-rehosting`: impl.wujie (y / y coexistence, governance cells n / y / y,
  floor level 1 "reconstruction mode runs unmodified apps", escalating to level 4 for
  singleton reuse, still inside the ceiling); impl.micro-app-jd (y / c, floor level 1);
  impl.web-fragments in client reframing mode (y / y, floor level 1); impl.qiankun (y / y,
  floor level 4 "lifecycle exports plus UMD build config", inside maxLevel 5, so unlike the
  acquisition fixture qiankun is NOT excluded here and stays in stage-2 discrimination).
- `family.custom-element-composition`, conditional: web-components-composition practice.
  `coordination.shared-dependency-governance` = c ("required only if dedup is wanted;
  default duplication needs none, and tag-name governance is a separate standing need"),
  `ownership.uncoordinated-upgrades` = c ("dependency copies coexist indefinitely with no
  forced train; page-global tag names still require naming coordination"),
  `framework.same-framework-major-coexistence` = c and `runtime.side-by-side-versions` = c
  ("colliding shared element tag names need versioned names or scoped registries, not
  Baseline Aug 2026"), `composition.phase.deploy-unit-per-participant` = c ("yes under the
  MFE pairing, per-team bundle URLs"). Every condition is attached: the family survives only
  if the group accepts default duplication and runs a standing custom-element naming treaty,
  which is a cross-team coordination obligation of exactly the kind the handbook culture
  resists. Participant floor level 2 (wrapper around unchanged source).
- `family.server-fragment-assembly`, conditional: podium, server-side-fragment-composition,
  edge-side-composition (coexistence cells c / c each; floors 1 to 2), web-fragments in
  pierced mode (y / y, floor 1). Governance cells n / y / y throughout.
  `migration.host.new-infra-tier-required` = y and `deployment.strategy-service-in-path` = y
  for all four, and `ownership.platform-team-role-required` = y for all four.
- `family.route-partition`, conditional and contested: reverse-proxy-route-composition
  (floor level 1 "an app already serving a clean URL subtree joins by route claim",
  escalating to level 5 for interleaved URL spaces, at the ceiling),
  impl.nextjs-multi-zones (floor level 1 config-only; `framework.composition-tier-stack-mandated`
  = y, so the OSS zones path fits only the Next.js participant and the rewrite-to-an-existing-app
  variant carries the other two), impl.cloudflare-workers-microfrontends (floor 1 to 3;
  `migration.host.new-infra-tier-required` = y, vendor control plane). All three score
  `deployment.host-rebuild-required` = n, `ownership.deploy-schedule-ownership` = y,
  `coordination.shared-dependency-governance` = n, `ownership.uncoordinated-upgrades` = y,
  `ownership.distrusted-cadence` = y.
  **Contested**: all three members score `-` (na) on
  `framework.same-framework-major-coexistence` and `runtime.side-by-side-versions`, because
  participants never co-reside. E6's cell-value discipline says na never satisfies a hard
  requirement, which eliminates the family; constraints.md 2.7's hard form names only the
  build-fused baselines as eliminated, and constraints.md 2.1 and 2.5 retain
  `family.route-partition` against the sibling co-residence constraints explicitly as
  "vacuous: no co-residence" and "satisfied by construction". This trace carries the
  constraints.md reading (retained, vacuously satisfied) and discloses the discrepancy: see
  Model finding 2 and guardrail 5.

Engine-answered guards: `constraint.installable-today` and `constraint.code-ownership`
satisfied uniformly; no question spent.

Survivor count: 5 of 12 families. Cross-check: topology.md 2.9 predicts, for a boundary whose
governance fact fails, exactly "`family.route-partition`, `family.document-embedding`,
per-configuration `family.virtualized-rehosting`, `family.server-fragment-assembly`, and
`family.custom-element-composition`". The cells reproduce that set independently.

### 4.7 E7 `engine.step.rank-family`

Bound preferences at family scope: `constraint.seamless-ux` (strong) and the
`prior-unconfirmed` `constraint.no-strategy-runtime` (strong, ranking only) plus
`constraint.no-new-infra-tier` (weak default, touched by the "no platform team today" fact).
`constraint.explicit-drift-surfacing` and `constraint.no-platform-team` are
`scope.implementation` and act in 4.10, never here.

Order per `engine.rule.candidate-order`:

1. `family.virtualized-rehosting`: `status.match.strong`. The hard set is satisfied on
   unconditional cells by impl.wujie (y / y coexistence, n / y / y governance, level-1
   floor); no strong preference is violated (`ux.natural-layout-flow` = y for micro-app-jd,
   qiankun, wujie, web-fragments) and `constraint.no-new-infra-tier` holds
   (`migration.host.new-infra-tier-required` = n for qiankun, micro-app-jd, wujie).
   Tradeoffs named, not scored: sandbox execution tax
   (`performance.sandbox-execution-tax`), framework duplication per rehosted app
   (`performance.duplicate-framework-same-page` = y), a page-wide strategy runtime
   (`runtime.shared-runtime-library` = y), and the family trust ceiling
   `trust.interference-damped`, which is adequate here only because no trust constraint is
   bound (no external participant) and which must never be read as a security boundary.
2. `family.document-embedding`: `status.match.viable`. Hard set satisfied; violates
   `constraint.seamless-ux` at strong (`ux.natural-layout-flow` = n for iframe-composition
   and hyperfrontend, c for luigi), reported as the explicit tradeoff the answer already
   declared compromisable. Gained side: browser-enforced containment and zero co-residence
   coupling. Additional named cost against the group's own goal: `ux.token-theming-mechanism`
   = n for iframe-composition and hyperfrontend (c for luigi), so the "single visual
   language" is host-built token plumbing across the boundary.
3. `family.custom-element-composition`: `status.match.conditional` (conditions: default
   duplication accepted, standing tag-name treaty, scoped registries not Baseline). Violates
   no bound strong preference; `ux.natural-layout-flow` = y, `runtime.shared-runtime-library`
   = n (the only survivor at `orchestration.primitive` besides the iframe and route
   practices), `migration.host.new-infra-tier-required` = n, and it is the only survivor
   scoring `ux.token-theming-mechanism` = y, which is the most direct answer in the set to
   "a single visual language". Rule 3 places it ahead of the other conditionals on the weak
   preference.
4. `family.route-partition`: `status.match.conditional` (conditions: the Model finding 2
   vacuity reading; a routing tier stood up and owned; per-member stack mandate for the OSS
   zones path). Violates no bound strong preference: its `constraint.seamless-ux` cells are
   na because no co-resident region exists to seam. Named costs, not violations:
   `ux.persistent-shared-chrome` = n and `ux.cross-boundary-soft-nav` = n for all three
   members, and `migration.host.new-infra-tier-required` = y for reverse-proxy-route-composition
   and cloudflare-workers-microfrontends (c for nextjs-multi-zones), which is the weak-preference
   violation that puts it behind entry 3.
5. `family.server-fragment-assembly`: `status.match.conditional` (conditions: coexistence
   cells c on three of four members; a composition tier operated on the request path).
   `migration.host.new-infra-tier-required` = y and `ownership.platform-team-role-required`
   = y for every member.

Adjacency justification: 1 versus 2 by rule 2 (document-embedding carries one named violated
strong preference, virtualized none); 2 versus 3 by rule 1 (viable before conditional); 3
versus 4 versus 5 by rule 3 (`constraint.no-new-infra-tier`: custom-element n, route-partition
y or c, server-fragment y), with 4 before 5 by rule 4 (id order, disclosed as not meaningful).
REQ-Q-04 is served: five candidates, tradeoffs explained, and the discriminating unanswered
questions named in 4.9.

Fit flags, per E7's cluster map and never blended:

- `fit.architectural` (from 2.1, 2.5, 2.7, 2.10 bindings): holds for all five;
  `because` = `constraint.framework-major-coexistence` cells plus the `constraint.seamless-ux`
  cells listed above.
- `fit.organizational` (2.3, 2.6, 2.8, 2.15): holds for all five;
  `because` = `deployment.host-rebuild-required` = n, `ownership.deploy-schedule-ownership`
  = y, participant floors inside maxLevel 5, topology priors confirmed.
- `fit.operational` (2.4, 2.11, 2.13): holds unconditionally only where
  `ownership.platform-team-role-required` = n, that is iframe-composition, hyperfrontend,
  wujie, micro-app-jd, web-components-composition. It is conditional today for
  entries 4 and 5 in full and for impl.luigi, impl.qiankun, impl.web-fragments, because the
  role they require is funded but unstaffed until next quarter.
- `fit.transition-dependent`: false for every candidate in `slots.bestToday`; true for the
  platform-team-requiring configurations, which is what makes E13 produce two slots.

Note that `constraint.no-version-governance` lands in `fit.architectural` under E7's cluster
map (constraints.md 2.7, dependency economy) although its evidence is a purely organizational
fact. See Model finding 4.

### 4.8 E8 `engine.step.dominance`

`dominanceApplied` is EMPTY. Every rule is disclosed as inactive with the condition that
fails, because three of them are one answer away:

- `dominance.fused-baselines-over-mfe`: inactive; `derive.single-coordinated-team` never
  fired and rank 2 was answered no-train.
- `dominance.route-partition-over-coresident-runtimes`: inactive only because rank 3 is
  unanswered. Its other two conditions (`constraint.persistent-chrome` not required,
  `constraint.cross-boundary-soft-nav` not required) currently hold. A rank-3 "no" activates
  it immediately and collapses entries 1, 3 and the co-resident half of the list into
  `family.route-partition`. This is the mechanism by which guardrail 5's outcome is reached
  without dropping any hard constraint.
- `dominance.browser-boundary-over-simulated-realm`: inactive;
  `constraint.distinct-principal` is unbound, which is precisely why
  `family.virtualized-rehosting` is not dominated here and heads the ordering.
- `dominance.fusion-subsumes-drift-and-dedup`: inactive (`constraint.atomic-release`
  unbound).
- `dominance.static-subsumes-infra-tier`: inactive (`constraint.static-hosting-only`
  unbound).
- `dominance.html-entry-at-low-ceiling`: inactive. Its condition is a rank-4 binding at
  maxLevel <= 2; here maxLevel is 5, so impl.qiankun keeps its stage-2 discriminators.

### 4.9 E9 next-question and emission shape

Askable set: `question.granularity.single-screen` (rank 3, spine),
`question.delivery.server-capacity` (rank 7, spine), `question.migration.host-ceiling`
(unlocked by rank 4), `question.migration.strangler`, `question.orchestration.appetite`
(rank 16, confirming the `constraint.no-strategy-runtime` prior),
`question.trajectory.topology-stability`, `.goal-status`, `.consolidation`,
`.deployment-ownership-change`, `.funding`, `.authority`, `.bounded-exit`, and
`question.trajectory.no-transition-outcome` (mandatory before emission, because a
`fit.transition-dependent` output is pending on the platform-team dimension).

Suppressed as zero-gain or not unlocked: rank 5 (no external, plugin, or b2b fact), rank 6
(entailed, R3), rank 11 (answered), ranks 9, 12, 15 and `question.ux.chrome-persistence`
(gated on a rank-3 yes; rank 12's hard form is additionally warn-flagged jointly
unsatisfiable, 4.5), rank 13 (participants known), rank 14 (the group is the host).

Selection table over S = 5 families:

| Candidate q | guaranteed | expected class | reach |
|---|---|---|---|
| `question.granularity.single-screen` | 0 | common (every product can answer it) | largest in the set: unlocks or prunes ranks 6, 9, 11, 12, 15 and the chrome follow-up, and is the live condition of `dominance.route-partition-over-coresident-runtimes` |
| `question.delivery.server-capacity` | 0 | plausible (a three-product insurance estate probably operates servers, so the eliminating answer is the unlikely one) | warn edge to rank 8 |
| `question.orchestration.appetite` | 0 | plausible (the fragmentation prior seeds it) | bridges to stage 2 |
| `question.migration.host-ceiling` | 0 | rare | none over the current survivors: every host-inversion unit (entando, commercetools-frontend, piral, single-spa) is already eliminated, so no answer changes an output |
| `question.trajectory.no-transition-outcome` | 0 | n/a (mandatory, not selected on gain) | gates E13 emission |

argmax by (guaranteed tie, then expected class, then reach):
`question.granularity.single-screen` is asked next, and it is the question on which this
entire assessment turns. The fixture supplies no answer.

`question.trajectory.no-transition-outcome` is asked before emission because a
`fit.transition-dependent` output is pending. The brief's guardrail 5 supplies the answer:
if the platform team never arrives, three deployables sharing a design system and navigation
conventions remain acceptable. That answer is what forces `slots.bestToday` to be operable
with zero platform team, and it survives the 3x robustness probe (staffing stated for next
quarter, 3x of which consumes the whole nine-month horizon).

Emission is therefore `rule.conditional-output` shape 2 (conditional: an unanswered question
could still eliminate recommended candidates) combined with shape 3
(transition-dependent: the second slot depends on the credible platform-team target).

### 4.10 E10 to E12: stage 2 and the availability lens

Stage-2 bindings in force: `constraint.explicit-drift-surfacing` at
`class.strong-preference` (entailed by `derive.many-party-drift`, never confirmed hard) and
the `prior-unconfirmed` `constraint.no-platform-team` at strong. No stewardship floor is
stated, so the 2.13 lens constraints stay at their defaults and availability is pure
annotation (`engine.rule.availability-lens`).

| Candidate | Config | Availability (independent factor) | Notable lens and stage-2 facts |
|---|---|---|---|
| impl.wujie | reconstruction mode, level-1 floor | `avail.available` (2.1.0, 2026-06; stable line y, single current line y) | `ownership.platform-team-role-required` = n; `multi-maintainer` = n, `adoption-scale-10k` = n; `migration.permanent-viability` = c |
| impl.micro-app-jd | HTML entry, level-1 floor | `avail.available-immature` (perpetual RC, no stable 1.0 in 3+ years) | `platform-team-role-required` = n; `adoption-scale-10k` = n |
| impl.qiankun | lifecycle lineage, level-4 floor | split line: 2.x `avail.available` but dormant (`stable-line-shipped` = c), v3 `avail.available-immature` (`single-current-line` = n) | `platform-team-role-required` = y, so `fit.operational` is transition-dependent today; largest adoption in its family |
| impl.web-fragments | client reframing, and pierced mode in family 5 | `avail.available-immature` (beta 0.8.2, cadence stalled); its dependency-reuse and ShadowRealm items are `avail.future-roadmap` and satisfy nothing | `platform-team-role-required` = y; `ux.token-theming-mechanism` = y |
| iframe-composition | practice unit; family substance, no impl record | n/a (browser primitive) | `platform-team-role-required` = n; `migration.permanent-viability` = y; every operational concern is host-built and priced in tradeoffs |
| impl.luigi | iframe mode | `avail.available`; org steward y (SAP), multi-maintainer y | `platform-team-role-required` = y; `adoption-outside-sponsor` = ?; `contracts.connect-compat-gate` = y |
| impl.hyperfrontend.community | platform-thick, level-4 floor | `avail.available-immature`: pre-1.0 throughout, breaking wire changes explicitly allowed (`stable-line-shipped` = n) | leads its family on `constraint.explicit-drift-surfacing` (the only unit y on all four atoms: `contracts.formal-descriptor`, `contracts.contract-versioned`, `contracts.connect-compat-gate`, `contracts.drift-explicit`); `platform-team-role-required` = n; and, carried beside that and never blended into it, `multi-maintainer` = n, `org-steward` = n, `adoption-outside-sponsor` = ?, the highest-risk stewardship profile in its family |
| impl.hyperfrontend.enterprise | n/a | `avail.announced-planned`, without exception | satisfies NO binding (REQ-AVAIL-01); no `status.match.future-potential` record is produced, because no planned capability answers a need a shipping candidate does not already meet here, so REQ-AVAIL-02 has nothing to pair |
| web-components-composition | practice unit; element wrap at level 2 | n/a | `platform-team-role-required` = n; `runtime.shared-runtime-library` = n; `ux.token-theming-mechanism` = y |
| reverse-proxy-route-composition, impl.nextjs-multi-zones, impl.cloudflare-workers-microfrontends | page granularity | n/a; `avail.available`; `avail.available-immature` respectively | all three `platform-team-role-required` = y; nextjs-multi-zones carries a stack mandate and a commercial edition (`impl.nextjs-multi-zones.vercel-platform`), cloudflare a vendor control plane |
| impl.podium, server-side-fragment-composition, edge-side-composition | fragment endpoints | `avail.available` for podium; practice units otherwise | all `platform-team-role-required` = y, `new-infra-tier-required` = y |

Excluded at stage 2 with origin chains: impl.entando (three independent origins, 4.6),
impl.opencomponents (coexistence `?` plus a level-6 floor for whole applications),
impl.zephyr-cloud and impl.picard-js (their host families eliminated at E6; picard-js also
`avail.inactive`). No availability exclusion is applied to a recommended candidate; nothing
recommended is `avail.deprecated` or `avail.inactive`.

Stage 2b (`stage.edition`) is not entered: no `question.edition.operability.*` is answered and
`question.edition.operability.managed-service-preference` is unanswered, so no commercial
edition is selected and, per the `scope.edition` firewall, nothing here touches family
selection (REQ-ENT-01).

Anti-steering note (REQ-MISSION-01, questions.md 5.3): the one stage-2 preference that
favours the sponsor's implementation was entailed by a party-count fact, not asked; it binds
at strong, not hard; the honest weaker answers (descriptor-only, conventions plus tests) keep
every descriptor-tier unit in play; and the family it sits in is ranked second, not first.

### 4.11 E13 `engine.step.dual-output`

Both slots are produced, and they diverge on ranking and fit rather than on survivors
(`rule.dual-slot-divergence` cites the platform-team septet).

- `slots.bestToday`: the 4.7 ordering restricted, at implementation level, to configurations
  operable with no platform team: impl.wujie and impl.micro-app-jd inside entry 1;
  iframe-composition and impl.hyperfrontend.community inside entry 2;
  web-components-composition inside entry 3. Entries 4 and 5, plus impl.luigi, impl.qiankun
  and impl.web-fragments, are retained with `fit.operational` conditional and the reason
  named. Always produced (REQ-STATE-02); depends on no aspiration.
- `slots.bestAfterTransition`: re-evaluated with the credible platform-team target added.
  No family enters or leaves; what changes is that `ownership.platform-team-role-required`
  = y stops being an operational obstacle, so `family.route-partition` (entry 4) and
  `family.server-fragment-assembly` (entry 5) become fully operable, and impl.luigi,
  impl.qiankun and impl.web-fragments rejoin their families' unconditional configurations.
  `dependsOnTransitions: [{dimension: platform-team, confidence:
  transition.confidence.leadership-approved, buyin: budget + staffing scheduled}]`. The
  no-transition-outcome answer is attached: the today ordering needs no platform team at
  all, so the recommendation is robust under the 3x probe.
- The framework-stack dimension contributes nothing to either slot. Its target was discarded
  at ordinal 1 (4.4), so there is no aspiration warning and no
  `fit.transition-dependent` entry naming a consolidation.

### 4.12 E14 to E16: gaps, relaxation, counterfactuals

`gapRecords`: empty. The survivor set is non-empty at both stages and no gap-trigger
constraint (`constraint.artifact-integrity`, `constraint.rsc-federation`) is bound.
`gap.autonomous-dedup` is armed by 4.5 but does not fire, because
`constraint.payload-dedup` is never bound.

`relaxationOffers`: empty (REQ-GAP-01 is not triggered; the hard set empties no candidate
space).

`counterfactuals`, computed from the four sources of decision-engine.md section 6:

1. (source 1, ledger row for `constraint.no-version-governance`) "Stand up a real upgrade
   train": reopens `family.module-graph-federation` and `family.lifecycle-orchestration`,
   with their consequences named (families.md 3.4 version-skew engineering forever, 3.5 the
   shell as a page-wide upgrade train). Emitted with its credibility gate explicit: the
   handbook rule is a `state.current` policy, so repealing it is an organizational
   transition subject to `predicate.target-credible` and never assumable (constraints.md
   6.1). Nothing in the fixture makes it credible, and leadership declined the analogous
   mandate on stacks. This is the guardrail-2 counterfactual and it satisfies the symmetry
   duty for both eliminated MFE families.
2. (source 1, ledger rows for `constraint.independent-deploy` and
   `constraint.participant-modification-ceiling`) The baselines need BOTH relaxations, and
   the report says so: accepting one release train alone does not readmit them, because
   their participant floors (level 6, or 7 for foreign stacks) still exceed maxLevel 5;
   raising the ceiling to 6 alone does not readmit them either, because
   `deployment.host-rebuild-required` = y stands. The joint block is the symmetry-duty
   counterfactual for the five excluded baseline families.
3. (source 1, ledger row for `constraint.framework-major-coexistence`) "Fund framework
   alignment (level 7 work)" reopens the baselines and unconditional negotiated-dependency
   use. Double-blocked: level 7 exceeds the appetite ceiling, and the septet discards the
   consolidation at `transition.confidence.undesirable`. Emitted with both blocks named,
   never as an offer.
4. (source 3, shape-2 emission) `question.granularity.single-screen` answered yes:
   `family.route-partition` becomes `status.match.incompatible`
   (`runtime.concurrent-participants` = n for reverse-proxy-route-composition,
   nextjs-multi-zones, cloudflare-workers-microfrontends), and ranks 6, 9, 11, 12, 15 plus
   the chrome follow-up unlock. A subsequent hard `constraint.persistent-chrome` additionally
   drops the classic fragment members (`ux.persistent-shared-chrome` = n for podium and
   edge-side-composition, c for server-side-fragment-composition). A subsequent hard
   `constraint.fault-containment`, whose prior is already armed (4.2), conditions or removes
   `family.custom-element-composition` (`isolation.failure.post-mount-exception` = c for
   web-components-composition against constraints.md 2.1's elimination reading) and restricts
   `family.virtualized-rehosting` to wujie and web-fragments client mode
   (`isolation.failure.post-mount-exception` = y / y against qiankun = n).
5. (source 3) `question.granularity.single-screen` answered no: nothing is eliminated, but
   `dominance.route-partition-over-coresident-runtimes` activates and every co-resident
   family is dominated. The recommendation collapses to `family.route-partition`, that is,
   three deployables behind one URL space with a shared design system and navigation
   conventions. This is guardrail 5's outcome, reached through a dominance rule (no
   candidate offers any advantage) and not through any relaxation.
6. (source 3) `question.orchestration.appetite` answered hard on
   `constraint.no-strategy-runtime`, confirming the armed fragmentation prior: eliminates
   every unit scoring `runtime.shared-runtime-library` = y, that is the whole of
   `family.virtualized-rehosting` (wujie, micro-app-jd, qiankun, web-fragments) plus
   impl.luigi and impl.hyperfrontend, leaving the `orchestration.primitive` practices
   (iframe-composition, web-components-composition, reverse-proxy-route-composition,
   nextjs-multi-zones). This is the cheapest single answer that would overturn the head
   candidate, and it is the required per-recommendation counterfactual.
7. (source 3) `question.delivery.server-capacity` answered "static hosting only":
   eliminates `family.server-fragment-assembly` (`ssr.static-hosting-sufficient` = n for
   podium, server-side-fragment-composition, edge-side-composition, web-fragments) and
   constrains `family.route-partition` to existing routing infrastructure
   (`ssr.static-hosting-sufficient` = c for reverse-proxy-route-composition).
8. (source 4, credibility flip in both directions) If the platform-team hire slips beyond
   the 3x probe, `slots.bestAfterTransition` collapses onto `slots.bestToday` and only the
   platform-team-free configurations remain operable. Conversely, if the consolidation
   target ever reached `transition.confidence.teams-committed`, or ordinal 4 plus
   `buyin.budget` and one of timeline or staffing, the framework-stack dimension would gain
   a credible target and the baselines plus `family.module-graph-federation` would re-enter
   `slots.bestAfterTransition`. Recorded as a set-aside, not an offer: leadership explicitly
   declined it, and REQ-STATE-11 forbids proposing the organizational change to fit a
   technology.
9. (source 2) `dominanceApplied` is empty, so this source contributes only its inverse,
   already covered by items 5 and, for
   `dominance.browser-boundary-over-simulated-realm`, by the observation that no trust
   requirement exists to activate it.

### 4.13 E17 emission, outcome class, derivation sample

Outcome class: **`trust.other-oss`**. Derivation chain: `derive.single-coordinated-team`
never fired and the rank-2 train branch is closed, so the baseline group is unreachable and
the engine vocabulary cannot land on `trust.no-mfe` (decision-engine.md section 7 rows);
`slots.bestToday` is headed by `family.virtualized-rehosting` on impl.wujie, an MIT
Tencent-stewarded OSS unit, with vendor-neutral browser practice (iframe-composition,
web-components-composition) filling the next positions; impl.hyperfrontend.community is
retained and ranked, not excluded, but sits inside the second-ranked family, behind
impl.wujie on the one bound strong preference (`ux.natural-layout-flow` = n against y) and
carrying `avail.available-immature` plus the weakest stewardship profile in its family as
independent annotations. `trust.hf-community` is therefore not reached, and it was not
steered around either: the sponsor's unit survives every hard binding and leads its own
family on the entailed drift preference. No commercial edition is selected
(`trust.commercial` not reached; stage 2b never entered). `trust.no-match` is not reached
(non-empty survivor set). `trust.change-assumptions` is not the primary class: the
candidates are viable today with no assumption change; the conditionality is unanswered
questions, reported as shape-2 output. Under a rank-3 "no" the assessment moves to the
`trust.no-mfe` reading the brief sanctions, by way of item 5 of 4.12 and never by dropping a
hard constraint.

```text
Recommendation: family.virtualized-rehosting (reconstruction/HTML-entry) [status: strong]
Recommendation: family.document-embedding (embed-only or gated)          [status: viable]
Recommendation: family.custom-element-composition (element wrap)         [status: conditional]
   ... route-partition and server-fragment-assembly follow, conditional

Why:
+ each team ships on its own schedule                (deployment.host-rebuild-required = n; ownership.deploy-schedule-ownership = y)
+ no standing upgrade train is ever required         (coordination.shared-dependency-governance = n; ownership.uncoordinated-upgrades = y; ownership.distrusted-cadence = y)
+ three stacks and skewed library majors coexist     (framework.same-framework-major-coexistence = y; runtime.side-by-side-versions = y)
+ every team stays inside its stated appetite        (migration.participant.min-level level 1 to 4, ceiling migration.moderate-refactor)

Tradeoffs accepted:
~ virtualized-rehosting: sandbox tax, framework duplication, damping-only trust  (performance.sandbox-execution-tax; performance.duplicate-framework-same-page = y; trust.interference-damped)
~ document-embedding: seam engineering vs one-document flow                      (ux.natural-layout-flow = n; constraint.seamless-ux violated at strong)
~ custom-element-composition: a standing tag-name treaty                         (runtime.global-registration-collision; ownership.uncoordinated-upgrades = c)
~ every survivor: no shared-dependency dedup                                     (performance.shared-dependency-dedup = n; rank 12 is not a live choice, rel.requires)

Derived from:
question.deploy.independence -> "no shared release train"        (constraint.independent-deploy)
ownership.uncoordinated-upgrades (engineering handbook) -> derive.broken-governance
  -> constraint.no-version-governance  [eliminates module-graph-federation, lifecycle-orchestration]
question.deps.major-coexistence -> "versions must coexist"       (constraint.framework-major-coexistence)
question.migration.participant-ceiling -> "bootstrap and styles, not a rewrite"
  -> constraint.participant-modification-ceiling(each team, maxLevel = migration.moderate-refactor)
3 deploying parties -> derive.many-party-drift -> constraint.explicit-drift-surfacing (strong, impl scope)
platform-team septet (ordinal 4 + budget + staffing) -> predicate.target-credible PASS
  -> slots.bestAfterTransition
```

### 4.14 Guardrail verification (brief section 3)

| Guardrail | Result |
|---|---|
| No recommendation may require any team to change UI frameworks or rewrite its product; the ceiling sits below `migration.framework-migration`; the consolidation target is discarded at confidence 1 | **PASS**, settled at E6 and E4. E6: `constraint.participant-modification-ceiling`(maxLevel = `migration.moderate-refactor`) eliminates every unit whose participant floor exceeds 5, which is all seven baseline units (level 6, or 6 to 7 for server-rendered-templates, 7 for commercetools-frontend) and impl.opencomponents (level 6 for whole applications); every retained configuration sits at level 1 to 4, and the one that touches the ceiling (reverse-proxy-route-composition at level 5 for interleaved URL spaces) carries that condition. E4: the framework-stack septet at `transition.confidence.undesirable` (ordinal 1) is discarded per state-transition.md section 3, binds nothing, and produces no aspiration warning; 4.12 item 3 shows the alignment relaxation double-blocked rather than offered |
| Strategies whose correctness depends on synchronized dependency versions or coordinated releases are eliminated regardless of how well they score elsewhere | **PASS**, settled at E6. `constraint.no-version-governance` hard eliminates `family.module-graph-federation` (`coordination.shared-dependency-governance` = y for module-federation, native-federation, import-map-architectures) and `family.lifecycle-orchestration` (= y for single-spa, piral), plus impl.zephyr-cloud and impl.picard-js as attached layers and impl.entando on `ownership.distrusted-cadence` = n; `constraint.independent-deploy` hard eliminates the five baselines on `deployment.host-rebuild-required` = y and `ownership.deploy-schedule-ownership` = n. The REQ-Q-02 point is verifiable here in the sharpest possible form: the migration ceiling was wide enough to admit all four eliminated MFE members (floors 3, 3, 3 to 4, 4, all inside maxLevel 5), so nothing about their adoption cost saved them |
| The framework-coexistence hard constraint eliminates single-framework strategies outright | **PASS**, settled at E6, with Model finding 1 attached. `constraint.framework-major-coexistence` bound hard eliminates every unit scoring n on `framework.same-framework-major-coexistence`: bit, commercetools-frontend, modular-monolith, monorepo-package-composition, plain-spa-routing, server-rendered-templates, islands-architecture, that is the entire build-fused single-framework group, independently corroborated by `framework.per-team-framework-autonomy` = n or c on the same units; and impl.opencomponents on `?`, which never satisfies a hard requirement. The finding concerns the route to the hard class, not the elimination |
| The trace must not recommend reorganizing or merging the three teams to fit a technology (REQ-STATE-11) | **PASS**, settled at E13 and E15. No binding, candidate, tradeoff, or offer proposes a team-structure change; the team-topology dimension is never a target. `relaxationOffers` is empty, and the one organizational relaxation the ledger could ever produce here (repeal the handbook rule and run an upgrade train) is emitted at 4.12 item 1 as a counterfactual gated on `predicate.target-credible`, explicitly not assumable. `slots.bestToday` is fully operable with zero platform team (`ownership.platform-team-role-required` = n for iframe-composition, hyperfrontend, wujie, micro-app-jd, web-components-composition), so no recommended output depends on the organization changing shape; the platform team is consumed as the organization's own approved change, never proposed by the engine |
| A non-composition outcome (three deployables, shared design system and navigation conventions, ordinary links) satisfies every hard constraint; the trace may reach it only by showing the goal is satisfiable without composition | **FAIL (model bug; see Model finding 2)**. The second half PASSES: 4.12 item 5 reaches exactly that outcome through `dominance.route-partition-over-coresident-runtimes`, a "no candidate offers any advantage" rule, with every hard binding still in force, and 4.9 shows the engine asking the question that decides it rather than assuming an answer. The first half does not survive the engine's own rule. `family.route-partition`, the model's nearest expression of the links outcome, scores `-` (na) on `framework.same-framework-major-coexistence` and `runtime.side-by-side-versions` precisely because participants never co-reside, and E6's cell-value discipline states that na never satisfies a hard requirement, so a conforming implementation eliminates the family and the guardrail's premise is false. constraints.md 2.7 names only the build-fused baselines as eliminated, and 2.1 and 2.5 retain route-partition against the sibling co-residence constraints as vacuous or satisfied by construction. Two authoritative layers disagree, and this fixture is where the disagreement decides the answer. Per REQ-ORCH-11 the fixture is not patched: 4.6 carries the constraints.md reading with the discrepancy disclosed, and the fix belongs to the model |

Also verified incidentally: the level-4 credibility path recorded for this fixture in
state-transition.md section 4 ("passes it with budget plus sponsorship and staffing
scheduled") reproduces at E4, and the survivor set reproduces topology.md 2.9's independently
stated prediction for a boundary whose governance fact fails.

### 4.15 Model findings

Findings 1 and 2 were surfaced by this trace per REQ-ORCH-08; finding 2 is the guardrail
failure. Findings 3 and 4 are coverage notes. All belong to the model, never to the fixture
(REQ-ORCH-11).

1. **No model coverage for cross-framework coexistence** (layer: taxonomy, with an
   interpretation consequence). This fixture's headline fact is three different UI stacks.
   The model has: `derive.mixed-majors-present`, whose premise names "incompatible majors of
   one framework"; `constraint.framework-major-coexistence`, which binds
   `framework.same-framework-major-coexistence` and `runtime.side-by-side-versions`; and
   `question.deps.major-coexistence`, whose A and C phrasings both ask only about majors of
   one framework ("Are some pieces stuck on an old version of the same framework newer
   pieces use?"). The matrix does carry the right atoms,
   `framework.mixed-frameworks-one-page` and `framework.per-team-framework-autonomy`, but no
   constraint in constraints.md section 2 binds either, and questions.md section 8's
   coverage table has no row for them. Consequence: a user in this situation cannot answer
   the question that produces the binding their situation demands, and the trace reaches the
   hard class only by reading the handbook rule (no forced upgrades, therefore skewed
   versions coexist) plus the funding fact (leadership declined alignment) as the two
   premises questions.md 3.11 requires, borrowing the estate half. Proposed fix: widen
   `constraint.framework-major-coexistence` to bind `framework.mixed-frameworks-one-page` and
   `framework.per-team-framework-autonomy` as well, rename it `constraint.framework-coexistence`
   with the old id kept as an alias, add `derive.multi-framework-estate` (premises: two or
   more distinct UI frameworks among participants, plus no funded alignment) in entailed
   mode, and add a second phrasing pair to rank 11 covering distinct frameworks. The
   existing relaxation-ledger row stays valid under the widened constraint.
2. **`na` cells collide with vacuous satisfaction, and the collision decides guardrail 5**
   (layer: logic). E6 states that `?` and `na` never satisfy a hard requirement.
   `family.route-partition` scores na on the entire co-residence cluster
   (`framework.same-framework-major-coexistence`, `runtime.side-by-side-versions`,
   `ux.natural-layout-flow`) because its participants never co-reside, which is the
   strongest possible form of satisfying those constraints, not an absence of evidence.
   constraints.md encodes that vacuity in two incompatible ways: as prose retentions
   ("vacuous: no co-residence" in 2.1, "satisfied by construction" for
   `constraint.fault-containment`) and as a `rel.relaxes` row conditioned on an explicit
   rank-3 negation. When rank 3 is unanswered, as here and as in any partial-information
   run, neither route fires and the literal rule eliminates a family the constraint model
   retains. Proposed fix: make the vacuity declarative rather than prose. Give every
   co-residence-cluster constraint a `vacuousAt: [granularity.page]` field (or, equivalently,
   split the cell value `na` into `na-vacuous` and `na-unknown` in
   matrix/attributes.md and have E6 read the kind before applying the never-satisfies rule),
   and keep the `rel.relaxes` row for the question-pruning effect it separately provides.
   Add a validator check that every hard-capable constraint whose cells contain `na` declares
   one or the other. Until fixed, traces must carry the constraints.md reading with the
   discrepancy disclosed, as 4.6 does.
3. **No ownership fact for platform-team capacity** (layer: taxonomy; note). The most
   decisive operational fact in this Situation, "there is no platform team today, one is
   funded from next quarter", has no fact id. topology.md section 3's checklist has no
   `ownership.platform-team-*` entry; `ownership.platform-team-role-required` is a matrix
   attribute describing units, not situations; and `constraint.no-platform-team` is
   `scope.implementation`, reachable only through `question.impl.platform-team`, whose hard
   form is a requirement ("no platform team may ever be required") rather than a staffing
   state. The fact reaches E7 only as a `prior-unconfirmed` preference inherited from the
   `topology.fragmentation` prior, that is, as a guess about the topology rather than as the
   organization's stated position, and the credible target that drives the whole of E13 has
   no `state.current` counterpart in any checklist. Proposed fix: add
   `ownership.platform-capacity` to topology.md section 3 with the REQ-STATE-01 current or
   target pair, and a `derive.no-platform-capacity` rule binding
   `constraint.no-platform-team` at `class.strong-preference` in `state.current` when the
   capacity is absent, so E7 ranks on a binding and E13's divergence is computed rather than
   narrated. Keep the hard form question-only (REQ-ORCH-10).
4. **`constraint.no-version-governance` is reported as architectural misfit** (layer:
   interpretation; note). E7's fit-flag map assigns constraints.md 2.7 (dependency economy)
   to `fit.architectural` and 2.3, 2.6, 2.8, 2.15 to `fit.organizational`. In this fixture
   the 2.7 binding is the single most organizational fact in the assessment: an engineering
   handbook rule about who may oblige whom. Reporting the elimination of
   `family.module-graph-federation` as an architectural misfit inverts the framework's own
   Conway posture (REQ-STATE-11) and would read as wrong to the user whose handbook caused
   it. Proposed fix: route `constraint.no-version-governance` and
   `constraint.framework-major-coexistence` to `fit.organizational` when their origin chain
   terminates in an `ownership.*` fact, and to `fit.architectural` when it terminates in an
   estate or matrix fact; the origin chain already carries the information, so this is a
   change to E7's mapping rule, not to any record.

### 4.16 Regression expectations

Stable assertions any engine implementation must reproduce for this fixture:

- Outcome class `trust.other-oss`, with `slots.bestToday` headed by
  `family.virtualized-rehosting` (impl.wujie, reconstruction mode) at
  `status.match.strong`, `family.document-embedding` second at `status.match.viable`, and
  five surviving families in the 4.7 order. Never `trust.hf-community`:
  impl.hyperfrontend.community must be RETAINED (it violates no hard binding) and must not
  head the assessment. Never `trust.no-mfe` on the current answer set: the baseline families
  are eliminated, so that outcome is reachable only through counterfactual item 5.
- Eliminated families with rule ids: the five baselines by `constraint.independent-deploy`
  (`deployment.host-rebuild-required` = y), jointly with
  `constraint.participant-modification-ceiling` (floors 6 to 7 above maxLevel 5) and
  `constraint.framework-major-coexistence` (`framework.same-framework-major-coexistence`
  = n); `family.module-graph-federation` and `family.lifecycle-orchestration` by
  `constraint.no-version-governance` (`coordination.shared-dependency-governance` = y for
  all five members) and by that rule alone, with every one of their participant floors
  inside the ceiling.
- Per-configuration exclusions: impl.entando (`ownership.distrusted-cadence` = n,
  `ownership.deploy-schedule-ownership` = c failing, host floor 8), impl.opencomponents
  (`framework.same-framework-major-coexistence` = `?`, participant floor 6 for whole
  applications), impl.zephyr-cloud and impl.picard-js as layers over eliminated families.
  impl.qiankun must NOT be excluded: maxLevel 5 admits its level-4 floor, and
  `dominance.html-entry-at-low-ceiling` must be inactive.
- `dominanceApplied` empty, with all six rules disclosed as inactive and the failing
  condition named for each; in particular
  `dominance.route-partition-over-coresident-runtimes` inactive solely because rank 3 is
  unanswered, and `dominance.browser-boundary-over-simulated-realm` inactive because no
  trust constraint is bound.
- `nextQuestion` returns `question.granularity.single-screen`, selected on expected class
  and reach after a guaranteed-gain tie at zero; `question.trajectory.no-transition-outcome`
  asked before emission; emission shape 2 combined with shape 3.
- Both slots produced. `slots.bestAfterTransition` cites the platform-team septet
  (`transition.confidence.leadership-approved`, `buyin.budget`, `buyin.staffing`) and
  differs from `slots.bestToday` only in `fit.operational` and ranking, never in survivors.
  The framework-stack septet contributes no binding and no warning: at ordinal 1 it is
  discarded, not annotated.
- `gapRecords` and `relaxationOffers` both empty; the rank-12 warn edge armed and rank 12
  presented as a tradeoff acknowledgment rather than a live choice.
- Key counterfactuals: repealing the handbook rule reopens the two governance-dependent
  families, gated on `predicate.target-credible` and never assumed; the baselines need both
  a release train and a ceiling raise, neither alone; a hard
  `constraint.no-strategy-runtime` (rank 16) removes the entire head family plus luigi and
  hyperfrontend and is the cheapest overturn of the recommendation; a rank-3 "no" activates
  `dominance.route-partition-over-coresident-runtimes` and produces the sanctioned
  shared-design-system-plus-links outcome with every hard constraint intact.
- Guardrail 5 must FAIL until Model finding 2 is fixed, and must flip to PASS once
  co-residence-cluster constraints declare their vacuity at `granularity.page`. A run that
  reports guardrail 5 as PASS without that fix is reading constraints.md prose instead of
  applying E6.
