# Scenario: should-not-use-microfrontends

Status: TRACED (2026-08-29).

## 1. Situation

We are a fourteen-person startup building a scheduling product for dental clinics; six of us
are engineers, working as one team in one repository on one web application. We deploy
several times a day, everyone reviews everyone's code, and the whole frontend is one codebase
on one framework, all of it written in the last two years. Nothing in the product comes from
outside vendors, and no other team's code runs in our app. We just raised a Series A, and our
CEO keeps saying we will be a hundred engineers in two years; nobody has planned what teams
would even look like then, and we are not reorganizing anything now. A few of us read
engineering blogs from large tech companies about splitting the frontend into independently
shipped pieces so teams do not block each other, and it sounds like the professional thing to
grow into. Our actual complaints today are that production builds take eleven minutes and the
app bundle is getting heavy. We are willing to invest real engineering time now, weeks or
even a quarter, if it sets us up correctly. We would rather not discover in two years that we
built ourselves into a corner.

## 2. Normalized inputs

Re-normalized 2026-08-29 against the canonical ids of
[constraints.md](../model/constraints.md), [questions.md](../model/questions.md),
[question-graph.md](../model/question-graph.md), [topology.md](../model/topology.md),
[migration.md](../model/migration.md), and [families.md](../model/families.md). Changes: each
input now names its constraint binding, class, subject, slot, and derivation route; the
absence rows are expanded into the explicit `ownership.*` = n facts that
`derive.single-coordinated-team` needs as premises; the appetite row is reclassified from a
bare fact to `constraint.host-modification-ceiling`(host, maxLevel=`migration.major-refactor`)
with no participant-side binding, because this situation has zero composition boundaries
(Model finding 5); "independent deployment ... weak preference" is reclassified as a
`slot: state.target` desirability binding on `dimension.integration-time` per
`question.rule.state-fork`, capped by the facet ceiling and then set aside by
`predicate.target-credible`; "avoid foreclosing a future split" is named as
`constraint.bounded-exit` at its default `class.strong-preference` (the Situation states a
wish, so the hard ceiling is not reached; the competing in-edge is Model finding 7); the two
coordinated-team preference tendencies are added as the E2 `prior-unconfirmed` bindings the
provisional table left implicit; and the two stated pains are marked UNBINDABLE (Model
finding 6). No stated value changed.

| Input | Canonical binding | Class / marking |
|---|---|---|
| Topology label | `topology.coordinated-team` | label (informational; facts govern) |
| One team, one repository, one application; six engineers, everyone reviews everyone's code | `ownership.single-team`=y, `ownership.multi-team-single-repo`=n, `ownership.multi-repo`=n, `ownership.independent-releases`=n, `ownership.distrusted-cadence`=n, `ownership.uncoordinated-upgrades`=n | observed facts, `state.current` |
| Nothing from outside vendors; no other team's code runs in the app | `ownership.external-participant`=n, `ownership.acquired-participant`=n, `ownership.host-unmodifiable-participant`=n, `ownership.participant-unmodifiable-host`=n, `ownership.no-cross-deployment-control`=n | observed facts (the absence is the signal; these are the premises of `derive.single-coordinated-team`) |
| Deploys several times a day as one product | `question.deploy.independence.current` = teams do not ship separately today, and one train is livable | observed fact; no atomicity or audit mandate is stated, so `constraint.atomic-release` does NOT bind (questions.md 3.2) |
| "sounds like the professional thing to grow into" | `question.deploy.independence.value`, a desirability facet (`maxClass` = `class.strong-preference`), stated in future tense, so `question.rule.state-fork` routes it to `slot: state.target` on `dimension.integration-time` | target-slot preference; never a current-state binding (`rule.no-target-satisfies-hard`) |
| Nobody has planned what teams would look like; not reorganizing now | `question.deploy.independence.readiness` = no; `question.trajectory.goal-status` = aspiration, not formally decided; `question.trajectory.topology-stability` = stable for the decision period | observed facts, `state.current` |
| Willing to invest weeks or a quarter; source owned, build runs, six active maintainers | `question.migration.capability-preconditions` all pass (levels 5+ reachable); `question.migration.host-ceiling` binds `constraint.host-modification-ceiling`(host, maxLevel=`migration.major-refactor`) | `class.hard-constraint` (stated ceiling, migration.md section 5), `state.current` |
| The same appetite read as a participant ceiling | NO BINDING: there is no `participant:*` subject, because no application is being composed into another (constraints.md 1.4 makes `subject` per boundary) | Model finding 5 |
| Production builds take eleven minutes | UNBINDABLE: constraints.md section 2 defines no constraint over build or CI duration, questions.md section 8's coverage table has no route, and no matrix attribute records it | observed fact, and the stated problem (Model finding 6) |
| The app bundle is getting heavy | UNBINDABLE as stated: `constraint.payload-dedup` binds `performance.shared-dependency-dedup` and `performance.duplicate-framework-same-page`, both of which are about a library shared by several co-displayed participants; `derive.payload-budget`'s premise ("strict payload budget AND many co-displayed units") fails at one unit | observed fact, and the stated problem (Model finding 6) |
| "would rather not discover in two years that we built ourselves into a corner" | `constraint.bounded-exit` (global) via `question.trajectory.bounded-exit` | `class.strong-preference` (constraint default, constraints.md 2.6), `state.current` |
| "a hundred engineers in two years", shape unplanned | septet on `dimension.integration-time`; `state.target` only | aspiration; not credible (4.4) |
| Hard constraints arising from topology | none: constraints.md 2.15's coordinated-team row has no hard-tendency column entry. Its two preference tendencies enter at E2 as `prior-unconfirmed` bindings: `constraint.seamless-ux` and `constraint.payload-dedup`, both `class.strong-preference` | priors (never eliminate; `engine.rule.prior-bindings`) |

State septet, `dimension.integration-time` (the team-topology and deployment-model dimension
of state-transition.md section 2's relevance note):

| Field | Value |
|---|---|
| `state.current` | one team, one repo, synchronized daily releases of one artifact |
| `state.target` | "a hundred engineers in two years" (shape unplanned; independently shipped pieces) |
| `transition.willingness` | untested; nobody has planned it |
| `transition.cost` | unknown; no plan exists |
| `transition.authority` | CEO statements only; not engaged on structure |
| `transition.confidence` | `transition.confidence.theoretical` (2) |
| `transition.horizon` | "two years", not tied to any plan |

Buy-in signals (state-transition.md section 4): all nine absent
(`buyin.executive-sponsorship`, `buyin.team-agreement`, `buyin.ownership-defined`,
`buyin.platform-responsibility`, `buyin.budget`, `buyin.timeline`, `buyin.staffing`,
`buyin.governance-plan`, `buyin.release-process-agreement`). The target state is an
aspiration and must not drive recommendations
([state-transition.md](../model/state-transition.md) sections 3 to 4).

## 3. Guardrail expectations

Sanity checks only, with one pinned expectation.

- The expected outcome class is a non-MFE baseline recommendation (`trust.no-mfe`): simpler
  architectures per REQ-Q-04 (modular monolith, packages, build and bundling work, SPA
  routing). This is the fixture that pins REQ-TRUST-01's "you probably do not need
  microfrontends" branch; `ownership.single-team` with no external participants makes that
  outcome a live candidate immediately ([topology.md](../model/topology.md) section 4).
- The hundred-engineer aspiration (confidence 2, zero buy-in signals, no plan) must not drive
  the recommendation (REQ-STATE-02, REQ-STATE-04); it may appear only in the counterfactual:
  what committed change would alter this answer (REQ-Q-07).
- High willingness to invest must not make heavier options rank better: appetite above the
  required level is never a bonus ([migration.md](../model/migration.md) section 1 viability
  rule).
- The trace must not invent team boundaries to justify a technology (REQ-STATE-11).

REQ-TRUST-01 outcome classes allowed (ids per [README.md](README.md)): `trust.no-mfe`
expected; `trust.change-assumptions` admissible only as the counterfactual annex ("if the
split becomes a committed, staffed reorganization, reassess"). Any of `trust.hf-community`,
`trust.other-oss`, `trust.commercial`, `trust.hfe-future`, or `trust.no-match` as the primary
outcome is a regression signal against REQ-TRUST-01 neutrality.

## 4. Trace

Hand-traced 2026-08-29 through the [decision-engine.md](../model/decision-engine.md) pipeline
(E1 to E17), with cells quoted from
[matrix-compact.tsv](../matrix/matrix-compact.tsv) and per-cell conditions from
`matrix/columns/<unit>.json` (version.research 2026.08.0). Single subject: `host`, the one
application. There is no `participant:*` subject anywhere in this trace.

**This trace fails guardrail 1.** The failure is a model bug, diagnosed in 4.15 and left
unpatched per REQ-ORCH-11. Guardrails 2, 3 and 4 pass. Read 4.7 and 4.14 together.

### 4.1 E1 `engine.step.intake`

The section 2 table is the intake record. Rank 1 (`question.ownership.composition-parties`)
fills the eleven `ownership.*` facts, ten of them negative; the ten negatives are as
load-bearing as the one positive, because they are the premises
`derive.single-coordinated-team` needs and the reason ranks 5, 13 and 14 never unlock. Rank 2
splits per REQ-STATE-03: `.current` records one livable release train (a fact),
`.value` records the blog-derived wish, and `.readiness` records "no". The wish is stated in
future tense ("to grow into"), so `question.rule.state-fork` routes it to `state.target` on
`dimension.integration-time` and the engine asks the readiness pair instead of accepting it
as a current fact; the desirability facet's `maxClass` caps it at `class.strong-preference`
regardless (schema 3.13), which is moot once E4 moves it out of the current-state pass.

Rank 4's battery is asked once, for the single own-team ownership class (question-graph.md
4.2, R1). Its capability preconditions (migration.md section 8) all pass: source owned and
legally changeable, build runs end to end (eleven minutes is slow, not broken), six active
maintainers, so levels 5+ are reachable. The level probe bisects to
`migration.major-refactor` (6) from "weeks or even a quarter" (migration.md section 8:
"days, weeks, or quarters" separates 1 to 4 from 5 to 8). The battery has no participant to
bind against, so the only ceiling it produces is the host facet through
`question.migration.host-ceiling`.

No integration deadline is stated, so `engine.rule.horizon-select` does not fire and
`migration.horizon.first-integration` is not selected as a governing horizon; the two-year
sentence is a septet `transition.horizon`, not a deadline.

Two inputs pass through intake and produce nothing: the eleven-minute build and the heavy
bundle. Neither has an `AnswerOption.binds` to land in, because no constraint id covers
either (Model finding 6). Under `rule.unanswered-inert` they contribute nothing to any later
step, which is why they appear nowhere below.

### 4.2 E2 `engine.step.topology-infer`

`ownership.single-team`=y with every external-participant fact = n infers
`topology.coordinated-team` for the one boundary the model can name (the application with
itself); `question.topology.confirm` confirmed, the brief's label row being informational.

Priors armed (constraints.md 2.15, coordinated-team row): **no hard tendencies**, which is
the row's distinguishing feature and the mechanical form of topology.md 2.1's "essentially
none created by the topology itself". Two preference tendencies enter as `prior-unconfirmed`
bindings at `class.strong-preference`: `constraint.seamless-ux` and
`constraint.payload-dedup`. Per `engine.rule.prior-bindings` they may rank but never
eliminate, and they should sit in `unresolvedQuestions` until their confirming questions
(ranks 10 and 12) are answered. They never are: E8 suppresses both. See Model finding 9.

### 4.3 E3 `engine.step.derive`

Fired, one rule:

- `derive.single-coordinated-team` (entailed; both premises present: `ownership.single-team`=y
  and no external participants): re-classes `constraint.independent-deploy`,
  `constraint.no-version-governance`, `constraint.framework-major-coexistence`, and
  `constraint.runtime-roster-change` to `class.irrelevant-by-default`, and admits all five
  baseline families as first-class candidates (constraints.md section 3; topology.md 2.1).

This rule is a `reclass` product, not a positive binding, so `inferredRequirements` carries
four reclassification records with origin `[derive.single-coordinated-team,
ownership.single-team, ownership.external-participant]` and no new constraint.

Not fired (premises absent): `derive.external-principal` (no external participant, so rank 5
never unlocks and `constraint.distinct-principal` stays `class.irrelevant-by-default`),
`derive.no-cross-deploy-control`, `derive.unmodifiable-participant-floor`,
`derive.legacy-untouchable` (build runs, source owned, maintainers active),
`derive.broken-governance` (one repo, mutual review), `derive.mixed-majors-present` (one
framework, all code under two years old), `derive.plugin-admission`, `derive.white-label-fit`,
`derive.static-estate`, `derive.seo-surface` (no unauthenticated SEO surface stated; not
inferred), `derive.regulated-release` (dental clinics may carry regulatory obligations, but
none is stated and the engine may not invent one), `derive.many-party-drift` (one deploying
party), `derive.b2b-chain`, `derive.payload-budget` (its premise needs a stated budget AND
many co-displayed units; there are no co-displayed units, Model finding 6).

Twelve of fourteen derivation rules are inert. That is the signature of this fixture: almost
nothing in the model has anything to say about this organization.

### 4.4 E4 `engine.step.compose`

| Constraint | Subject | Class | Params | Slot | Origin |
|---|---|---|---|---|---|
| `constraint.host-modification-ceiling` | host | hard | maxLevel=`migration.major-refactor` | current | answer:question.migration.host-ceiling |
| `constraint.bounded-exit` | global | strong-preference | | current | answer:question.trajectory.bounded-exit |
| `constraint.seamless-ux` | global | strong-preference (prior-unconfirmed) | | current | topology.coordinated-team prior |
| `constraint.payload-dedup` | global | strong-preference (prior-unconfirmed) | | current | topology.coordinated-team prior |
| `constraint.independent-deploy` | global | irrelevant-by-default | | current | derive.single-coordinated-team (reclass) |
| `constraint.no-version-governance` | global | irrelevant-by-default | | current | derive.single-coordinated-team (reclass) |
| `constraint.framework-major-coexistence` | global | irrelevant-by-default | | current | derive.single-coordinated-team (reclass) |
| `constraint.runtime-roster-change` | global | irrelevant-by-default | | current | derive.single-coordinated-team (reclass) |
| `constraint.independent-deploy` | global | strong-preference | | **target** | answer:question.deploy.independence.value; question.rule.state-fork |

Exactly one hard binding exists in the whole assessment, and it is a ceiling on the
organization's own work.

Target slot: `predicate.target-credible` over the `dimension.integration-time` septet fails
on all three legs. Leg 1: `transition.confidence.theoretical` ordinal 2, below the ordinal-5
threshold and below the ordinal-4 entry to the buy-in path, which would in any case fail
because `buyin.budget` is absent. Leg 2: authority is CEO statements only, not held or
engaged by identifiable people on team structure ("nobody has planned what teams would even
look like"). Leg 3: the two-year horizon is not tied to a plan, so the 3x robustness probe
(six years) has nothing to survive on. Result: the target binding never joins the
current-state elimination or ranking pass (`rule.target-credibility`,
`rule.no-target-satisfies-hard`); at confidence 2 it is retained as an annotation feeding
`rule.aspiration-warning` (E4 slot resolution) and surfaces only in E13's second slot and in
counterfactual 4.

### 4.5 E5 `engine.step.relations`

No `rel.excludes` pair has both sides bound hard: only one hard binding exists, and
`constraint.host-modification-ceiling` appears in no exclusion row. No `rel.requires` gate
fires (`constraint.distinct-principal`, `constraint.persistent-chrome` and
`constraint.payload-dedup` are unbound or preference-class; the payload-dedup prior is a
preference, and constraints.md section 4's `rel.requires` row conditions on its hard form).
No `rel.relaxes` premise is active: `constraint.atomic-release` is unbound, and
`constraint.single-screen-mixing` is neither affirmed nor negated because rank 3 is
unanswered (4.9 and Model finding 8). No warn edges armed; no gap seeds queued.

The attribution duty of `engine.rule.attribution` is not triggered: no elimination in this
trace runs through `deployment.strategy-service-in-path`, `governance.rollback`, or
`migration.host.new-infra-tier-required`.

### 4.6 E6 `engine.step.eliminate-family` (cells quoted from matrix-compact.tsv)

**No family is eliminated.** With one hard binding, and that binding a ceiling at ordinal 6
on a scale whose observed host floors run 1 to 8, the survivor set is all twelve families.
This is the correct and intended result: constraints.md 2.15 gives `topology.coordinated-team`
no hard tendencies, so elimination is not the mechanism by which this fixture is supposed to
reach its outcome.

Per-configuration exclusions inside surviving families (E6 cell-level semantics; the ceiling
compares by `ScaleLevel.ordinal` per E6's `scales.json` parameterization):

| Excluded configuration | Violated binding | Deciding cell |
|---|---|---|
| `impl.entando` | `constraint.host-modification-ceiling`(host, maxLevel=6) | `migration.host.min-level` = `migration.rewrite` (8), "Composition exists only inside platform-served pages; the platform is the shell"; `migration.host.shell-takeover-required` = y. `family.custom-element-composition` survives on web-components-composition (host floor `migration.trivial-adaptation`) |
| `impl.commercetools-frontend` | same, plus the participant reading | `migration.host.min-level` = `migration.rewrite` (8), "The platform-scaffolded app is the application root; the prior shell is discarded"; `migration.participant.min-level` = `migration.framework-migration` (7). `family.package-composition` survives on monorepo-package-composition and impl.bit |
| `islands-architecture`, Astro/Fresh posture | same | `migration.host.min-level` = c, "scale 1 for is-land (one script tag on any server-rendered page); scale 7-8 for Astro/Fresh (the site becomes the meta-framework app)". The is-land posture (host 1, participant 1 to 2) survives, so `family.islands` is retained with that configuration named |

The islands retention carries an unresolvable condition and is the clearest instance of Model
finding 6: `migration.participant.min-level` = c, "scale 1-2 via is-land (in-place tag wrap of
an existing server-rendered page); scale 7 for an existing SPA entering Astro/Fresh
(server-first inversion)". Whether this organization's app is server-rendered or an SPA
decides which posture applies, and no question in the graph asks it.

Cell-value discipline notes carried forward (REQ-MATRIX-05): the baselines'
`ux.cross-boundary-soft-nav` and `performance.duplicate-framework-same-page` cells are `na`
("Single-deploy baseline: no cross-deploy boundaries"), not satisfied; `impl.bit`'s
`unit.maintenance.adoption-outside-sponsor` is `?` and is flagged as data uncertainty at E12,
never read as satisfied.

Engine-answered guards (questions.md section 7), both pointedly relevant here:
`constraint.installable-today` is satisfied uniformly (`unit.availability.installable-today`
= y for all 30 units, including modular-monolith: "Realized today with commodity tooling; no
vendor or version required"), and `constraint.code-ownership` is satisfied uniformly
(`ownership.code-boundary-ownership` = y for all 30 units). The second one answers the
Situation's implicit motivation directly: "so teams do not block each other" reads as an
ownership ask, and the engine's answer is that every strategy in the landscape provides
enforceable code-level ownership, the modular monolith included, so ownership is not a reason
to adopt anything. No question is spent on either.

### 4.7 E7 `engine.step.rank-family`

All twelve families satisfy the single hard binding. Ranking therefore runs entirely on the
three bound strong preferences, and this is where the fixture fails.

Violated strong-preference bindings per family, over retained configurations:

| Family | `constraint.bounded-exit` (`migration.exit.participants-standalone`) | `constraint.payload-dedup` (`performance.shared-dependency-dedup`) | `constraint.seamless-ux` (`ux.natural-layout-flow`) | Violations | Status |
|---|---|---|---|---|---|
| `family.module-graph-federation` | **y** (native-federation: "Remotes stay runnable apps if they share what they import") | y ("Composed import map downloads and instantiates each shared dependency once per page") | y | **0** | `status.match.strong` |
| `family.lifecycle-orchestration` | n (single-spa: "apps surrendered their HTML entry"; piral: "pilets are plain libraries") | y (piral) | y | 1 | viable |
| `family.modular-monolith` | n ("Modules are not runnable alone, though drawn boundaries ease later extraction") | y ("The single build dedupes shared vendor chunks structurally") | y | 1 | viable |
| `family.package-composition` | n ("Packages are libraries, not runnable deployables") | y | y | 1 | viable |
| `family.route-partition` | y | n ("No cross-app bundle sharing") | na | 1 | viable |
| `family.server-fragment-assembly` | c / n (opencomponents n) | n | y | 1 (+1 conditional) | viable |
| `family.spa-routing` | n ("Route chunks are loading units, not standalone applications") | y | y | 1 | viable |
| `family.virtualized-rehosting` | y ("Children must remain standalone URL-runnable apps") | n | y | 1 | viable |
| `family.document-embedding` | y ("participants are standalone apps by construction") | n | n ("fixed rectangle") | 2 | viable |
| `family.server-templates` | n | n ("No mechanism; repeated assets across pages dedupe only via the HTTP cache") | na | 2 | viable |
| `family.custom-element-composition` | c ("an element bundle is a library, not an app; a one-line harness page runs it standalone") | c ("only via explicit cross-team convention") | y | 0 firm, 2 conditional | conditional |
| `family.islands` | n ("Islands are components of one app") | y | y | 1 (+ posture condition) | conditional |

`engine.rule.candidate-order` applied literally:

1. Rule 1 (status order) puts `family.module-graph-federation` first. It is the only family
   with zero violated strong preferences and therefore the only `status.match.strong`; every
   baseline carries one named violation and drops to `status.match.viable` ("hard set
   satisfied with named preference violations").
2. Rule 2 orders the viable band by violated-strong count: seven families at 1, two at 2.
3. Rule 3 is inert (no weak-preference binding exists).
4. Rule 4 breaks the seven-way tie by lexicographic id and must be disclosed as "tied, order
   not meaningful".

Computed `candidateStrategies`:

```text
1  family.module-graph-federation (native-federation)   strong
2  family.lifecycle-orchestration                       viable   ]
3  family.modular-monolith                              viable   ] rule-4 tie,
4  family.package-composition                           viable   ] order not
5  family.route-partition                               viable   ] meaningful
6  family.server-fragment-assembly                      viable   ]
7  family.spa-routing                                   viable   ]
8  family.virtualized-rehosting                         viable   ]
9  family.document-embedding                            viable
10 family.server-templates                              viable
11 family.custom-element-composition                    conditional
12 family.islands                                       conditional
```

A microfrontend family heads the recommendation for a six-engineer single-team startup, and
the first baseline is third, tied with five others in an order the report must itself call
meaningless. The outcome class computed by the pipeline is `trust.other-oss`, which the
brief names as a regression signal.

Sensitivity: the failure is not an artifact of one debatable normalization. Two readings in
this trace are genuinely undetermined by the model (Model findings 7 and 10), giving four
combinations:

| Reading | `constraint.bounded-exit` | `constraint.host-modification-ceiling` atoms | Head of `candidateStrategies` | Outcome class |
|---|---|---|---|---|
| A1 | unbound (rank-2 in-edge governs; the input is inert) | ordinal only | `family.lifecycle-orchestration` (0 violations via piral) | `trust.other-oss` FAIL |
| A2 | unbound | all-atoms (`shell-takeover-required`=n eliminates single-spa, conditions piral) | `family.modular-monolith`, with `family.module-graph-federation` tied second and disclosed not meaningful | `trust.no-mfe` by lexicographic accident |
| **B1 (traced above)** | strong (rank-1 fork governs) | ordinal only | `family.module-graph-federation` | `trust.other-oss` FAIL |
| B2 | strong | all-atoms | `family.module-graph-federation` (still 0; baselines still 1) | `trust.other-oss` FAIL |

Three readings fail outright. The fourth passes only because `family.modular-monolith` sorts
before `family.module-graph-federation` in rule 4's explicitly arbitrary id tiebreak, while
declaring the two equally good. In no reading does the engine produce the REQ-Q-04 conclusion
"you probably do not need microfrontends"; at best it produces a list in which a baseline
happens to sort first.

Fit flags, for the families that matter to the verdict:

- `family.modular-monolith`: `fit.architectural` holds (one framework, one build, no
  composition boundary to satisfy); `fit.organizational` holds exactly
  (`ownership.single-team`, one train, `deployment.host-rebuild-required` = y is a match, not
  a cost, at this topology); `fit.operational` holds ("Lowest operational cost in the
  landscape", families.md 5.1); `fit.transition-dependent` no.
- `family.module-graph-federation`: `fit.architectural` holds on cells;
  `fit.organizational` is where it should fail and cannot, because the fact that decides it
  (`coordination.shared-dependency-governance` = y, "Singleton plus strictVersion policy
  couples shared framework versions; standing cross-team semver governance required") binds
  `constraint.no-version-governance`, which `derive.single-coordinated-team` re-classed to
  `class.irrelevant-by-default`. The reclass records that the organization *can* supply
  governance; nothing records that supplying it costs a standing role this organization has
  no one to fill. `fit.transition-dependent` no, which is itself telling: the family heading
  `slots.bestToday` is the family the aspiration points at, and no flag says so.

### 4.8 E8 `engine.step.dominance`

Active: **`dominance.fused-baselines-over-mfe`**. Both conditions hold:
`derive.single-coordinated-team` fired at E3, and rank 2 is answered train-acceptable at E1.
Its matrix verification reproduces here exactly as question-graph.md 2.2 states it:
`performance.shared-dependency-dedup` = y for modular-monolith, monorepo-package-composition,
plain-spa-routing, islands-architecture and bit versus n for hyperfrontend,
iframe-composition, luigi, qiankun, wujie, opencomponents and podium; `contracts.drift-surface`
= n for those same baseline units ("Host and modules deploy atomically; drift is structurally
impossible") versus y for every deploy-decoupled unit. Skips: ranks 5 to 16 and the whole
co-residence cluster. Disclosed in `dominanceApplied` with its conditions.

And it changes nothing. `rule.dominance-suppression` acts only on the askable set;
`engine.rule.candidate-order` has no dominance term; dominated candidates stay in the
survivor set and, as 4.7 shows, one of them heads it. Meanwhile decision-engine.md section 7
attributes the entire `trust.no-mfe` outcome to this rule ("baseline families head
`candidateStrategies` after `derive.single-coordinated-team` + the rank-2 train branch
(`dominance.fused-baselines-over-mfe`)"). That attribution is the bug, stated in the engine
spec's own words. Model finding 1.

Also active if rank 3 were answered "no": `dominance.route-partition-over-coresident-runtimes`
(its other two conditions hold, since neither `constraint.persistent-chrome` nor
`constraint.cross-boundary-soft-nav` is required). It is not evaluated because rank 3 is
unanswered.

Inactive: `dominance.fusion-subsumes-drift-and-dedup` (its condition is
`constraint.atomic-release` bound hard, and no atomicity mandate was stated: the train is
livable, not required), `dominance.browser-boundary-over-simulated-realm` (no
`constraint.distinct-principal`), `dominance.static-subsumes-infra-tier` (no
`constraint.static-hosting-only`), `dominance.html-entry-at-low-ceiling` (no participant
ceiling exists to be low).

The inactivity of `dominance.fusion-subsumes-drift-and-dedup` deserves its own line, because
it is the only path by which this pipeline reaches a baseline recommendation structurally
rather than by ordering: a hard `constraint.atomic-release` eliminates all seven MFE families
outright. This organization has no atomicity mandate and should not need to invent one to be
told to keep its monolith.

### 4.9 E9 `engine.step.next-question` and emission shape

Askable set: `question.granularity.single-screen` (rank 3, spine, not in the active dominance
rule's `skips` list), `question.trajectory.no-transition-outcome` (mandatory before any
`fit.transition-dependent` output), and the answered trajectory members.

Suppressed with the dominance id recorded: ranks 5 to 16 entire, which includes both
confirming questions for the E2 priors (rank 10 `question.ux.seam-tolerance`, rank 12
`question.deps.payload-budget`). Not offered for lack of an unlock: `question.trajectory.funding`
and `question.trajectory.authority` (both unlock only on a credible target, and the target is
not credible), rank 5, rank 13, rank 14, and the guards.

Selection table over S = 12 families:

| Candidate q | guaranteed | expected class | reach |
|---|---|---|---|
| `question.granularity.single-screen` | 0 | see Model finding 8: both circumstance branches presuppose two teams | prunes ranks 6, 9, 11, 12, 15; arms `dominance.route-partition-over-coresident-runtimes` |
| `question.trajectory.no-transition-outcome` | 0 | mandatory, not selected by gain | none |
| `question.trajectory.topology-stability` | 0 | answered | none |

`rule.question-closure` does not fire: a yes on rank 3 eliminates `family.route-partition` and
`family.server-templates` (`runtime.concurrent-participants` = n for
reverse-proxy-route-composition, nextjs-multi-zones, cloudflare-workers-microfrontends and
server-rendered-templates), one of which is a retained candidate, so the question has nonzero
effect. argmax therefore selects rank 3, and that is precisely the question the engine should
not ask this organization: its circumstance phrasing is "is there a page where two different
teams' work is visible at the same time, or does each page belong to one team", and both
branches require the user to name team boundaries that do not exist. The trace declines to
answer it and records it in `unresolvedQuestions` with its overturning answer. See Model
finding 8 and guardrail 4.

`question.trajectory.no-transition-outcome` is asked before emission because a
`fit.transition-dependent` slot entry is pending, and the fixture answers it from the
Situation's own last sentence: if the hundred-engineer split never happens, whatever is built
now must still be acceptable. The cells support the answer: `migration.permanent-viability` =
y for modular-monolith ("2026 practitioner default; consolidation trend runs toward it, not
away"), monorepo-package-composition, plain-spa-routing, server-rendered-templates and
islands-architecture.

Emission under `rule.conditional-output` shape 2 (conditional): rank 3 is named with the
answer that would overturn two retained candidates, and the shape-3 material rides in the
second slot at E13.

### 4.10 E10 to E12: stage 2 and the availability lens

Stage 2 runs over the members of surviving families in their surviving configurations. For
the recommendation the fixture pins, the striking fact is how little there is to select:

| Candidate | Unit type | Availability (independent factor) | Notes |
|---|---|---|---|
| modular-monolith | strategy (`unit.type.adoptable-implementation` = n) | n/a; `unit.availability.stable-line-shipped` = na, "Strategy: no release line exists" | `migration.permanent-viability` = y; `migration.strangler.incremental` = y, "Modularize one domain at a time inside the shipping app; boundary mistakes stay cheap" |
| monorepo-package-composition | strategy | n/a | `migration.strangler.incremental` = y, "Published on-ramp: isolate domains as packages one at a time"; `migration.permanent-viability` = y, "also the published staging ground toward MFEs" |
| plain-spa-routing | strategy | n/a | `migration.permanent-viability` = y, "The published null hypothesis and practiced default until independent deployment is a hard requirement" |
| islands-architecture | strategy | n/a | retained in the is-land posture only (4.6); `performance.hydration-deferrable-per-unit` is the axis that would matter here and nothing binds it |
| `impl.bit` | product | `avail.available` (CLI 1.13.x, `stable-line-shipped` = y) | `adoption-scale-10k` = n, `adoption-outside-sponsor` = ? (flagged data uncertainty, never read as satisfied); `impl.bit.cloud` is the commercial tier and nothing selects it |

No implementation-stage question is answered, so the 2.13 lens constraints stay inert and
availability is pure annotation (`engine.rule.availability-lens`). No availability exclusions:
nothing recommended is `avail.deprecated` or `avail.inactive`. No `status.match.future-potential`
record, so REQ-AVAIL-02 has nothing to pair.

Excluded at stage 2 with origin chains: `impl.entando` and `impl.commercetools-frontend` (host
floor `migration.rewrite` > `migration.major-refactor`; origin
answer:question.migration.host-ceiling), already resolved per configuration at E6.

E11 is not entered: no operability fact appeared, every `constraint.operability.*` is
`class.irrelevant-by-default`, and `question.edition.operability.managed-service-preference`
is unanswered, so no commercial edition can be selected (constraints.md 2.14). The
`scope.edition` firewall is untested here and holds vacuously.

The stage-2 shape is itself the signature of the pinned outcome: four of the five baseline
entries are commodity practice with no vendor, no release line, and no adoption decision to
make. `trust.no-mfe` is the outcome class in which the correct recommendation requires buying
and installing nothing.

### 4.11 E13 `engine.step.dual-output`

- `slots.bestToday`: the 4.7 ordering, computed entirely from `slot: state.current` bindings.
  Every binding in the 4.4 table that participates carries `slot: current`; the single
  `state.target` binding was set aside at E4 and is cited nowhere in the ordering. The
  aspiration did not cause the guardrail failure, and this is verifiable line by line: the
  family that heads the list does so on `migration.exit.participants-standalone`,
  `performance.shared-dependency-dedup` and `ux.natural-layout-flow`, three present-tense
  cells.
- `slots.bestAfterTransition`: produced, because a non-credible aspiration exists (E13
  semantics). It carries the `rule.aspiration-warning` conditional, not a recommendation:
  `family.module-graph-federation` at `status.match.conditional`, `fit.transition-dependent`
  true, `dependsOnTransitions: [{dimension: dimension.integration-time, confidence:
  transition.confidence.theoretical}]`, and all nine buy-in signals listed as missing. The
  attached `question.trajectory.no-transition-outcome` answer (4.9) makes the today
  architecture robust under the 3x probe.
- `rule.dual-slot-divergence`: **does not fire**, and that is a symptom rather than a result.
  Under the computed ordering the two slots name the same family, so the report cannot draw
  the contrast REQ-STATE-06 exists to draw ("here is what fits you today; here is what would
  fit the company your CEO describes; they are different, and here is the septet that
  separates them"). Once Model finding 1 is fixed, the slots diverge (`family.modular-monolith`
  today, `family.module-graph-federation` after a committed reorganization) and the septet is
  cited.

### 4.12 E14 to E16: gaps, relaxation, counterfactuals

`gapRecords`: empty. The survivor set is never emptied and no gap-trigger constraint
(`constraint.artifact-integrity`, `constraint.rsc-federation`) is bound.
`assessmentStatus` is not `status.assessment.no-current-strong-match`.

`relaxationOffers`: empty. REQ-GAP-01 is not triggered, so E15 generates nothing; the one
hard binding's ledger row feeds E16 as a counterfactual instead.

`counterfactuals` (mechanics in decision-engine.md section 6):

1. **Source 1, elimination inversion via the relaxation ledger.** The row for
   `constraint.host-modification-ceiling` (constraints.md 6.1) walked ordinally upward: raising
   the host ceiling from `migration.major-refactor` (6) to `migration.rewrite` (8) readmits
   `impl.entando`, `impl.commercetools-frontend`, and the Astro/Fresh posture of
   `islands-architecture`. Refs: ledger row, families.md 5.2 and 3.3 overlay notes. This
   discharges the symmetry duty for the three configurations E6 excluded.
2. **Source 2, dominance conditions.** Withdrawing either condition of
   `dominance.fused-baselines-over-mfe` dissolves it and unlocks ranks 5 to 16. Concretely:
   (a) if `ownership.single-team` becomes n because a second team owns a repository and a
   release schedule, `derive.single-coordinated-team` stops firing, the four autonomy
   constraints return to askable, and rank 2 becomes the decisive question again; (b) if the
   train stops being livable, `constraint.independent-deploy` binds hard and eliminates all
   five baseline families on `deployment.host-rebuild-required` = y (modular-monolith:
   "Atomic artifact; every change ships the whole app on one release train";
   monorepo-package-composition: "A package change reaches users only when every consuming app
   rebuilds and redeploys"; plain-spa-routing: "Shipping one route's fix ships a new whole-app
   build"; server-rendered-templates; islands-architecture; bit; commercetools-frontend c).
   This is the counterfactual guardrail 2 demands: the committed change that would alter this
   answer is a real second team with its own release schedule, not a headcount projection.
3. **Source 3, unanswered eliminating answers.** Rank 3 answered yes-hard eliminates
   `family.route-partition` and `family.server-templates` (`runtime.concurrent-participants`
   = n). An escalation of `constraint.bounded-exit` from strong to hard eliminates all five
   baseline families at once (`migration.exit.participants-standalone` = n for every baseline
   unit) and is the single answer that would make this fixture's pinned outcome unreachable
   by legitimate means; questions.md section 4's own audit line names the defense ("this is
   the question that makes exit cost a present-tense fact instead of a hope"), and the honest
   reading of the Situation is a wish, so the ceiling is not reached. A confirmed
   `constraint.payload-dedup` at hard eliminates the `deps.duplicated` families and
   `family.server-templates` while retaining the baselines and
   `family.module-graph-federation`. A hard `constraint.atomic-release` (an audit or
   atomicity mandate) eliminates all seven MFE families and is, per 4.8, the only route by
   which this pipeline reaches `trust.no-mfe` structurally.
4. **Source 4, credibility flip.** If the hundred-engineer story reaches
   `transition.confidence.teams-committed` (5), or `transition.confidence.leadership-approved`
   (4) plus `buyin.budget` and one of `buyin.timeline` / `buyin.staffing`, re-run: E13's
   second pass evaluates with `constraint.independent-deploy` bound hard, the baselines are
   eliminated on the cells of counterfactual 2b, and `slots.bestAfterTransition` becomes a
   genuine recommendation rather than a warning. Refs: septet, the nine buy-in records,
   `predicate.target-credible`. This is the `trust.change-assumptions` annex the brief allows.

### 4.13 E17 emission, outcome class, derivation sample

Outcome class as the pipeline computes it: **`trust.other-oss`**, a regression signal per the
brief's own REQ-TRUST-01 clause. Derivation chain of that class:
`candidateStrategies[0]` = `family.module-graph-federation` in its native-federation
configuration, a non-HyperFrontend open-source unit, reached because it is the only family at
`status.match.strong` under `engine.rule.candidate-order` rule 1 (4.7), which it is because
`constraint.bounded-exit` is the one bound preference on which the microfrontend families beat
the baselines and nothing in E7 or E8 counts the costs that make it the wrong answer.

Outcome class the fixture pins and that Model findings 1 to 3 restore: **`trust.no-mfe`**,
headed by `family.modular-monolith`, then `family.package-composition`, then
`family.spa-routing` (`status.match.strong`, tied by rules 2 and 3, ordered by rule 4 and
disclosed as not meaningful), then `family.server-templates` (viable: `payload-dedup` prior
violated), then `family.islands` (conditional: is-land posture), with the seven microfrontend
families listed at `status.match.weak` carrying `dominance.fused-baselines-over-mfe` as their
condition. Derivation chain: answer:question.ownership.composition-parties ->
`ownership.single-team` = y with every external-participant fact = n ->
`derive.single-coordinated-team` -> four autonomy constraints re-classed
`class.irrelevant-by-default` -> answer:question.deploy.independence.current = train livable
-> `dominance.fused-baselines-over-mfe` active -> baseline group dominates -> section 7's
`trust.no-mfe` row.

```text
Recommendation (computed):  family.module-graph-federation (native-federation)   [strong]
Recommendation (required):  family.modular-monolith                              [strong]

Why the computed head won:
+ participants stay standalone deployable       (migration.exit.participants-standalone = y, native-federation)
+ one copy of shared libraries per page         (performance.shared-dependency-dedup = y)
+ composed regions flow as one document         (ux.natural-layout-flow = y)

What the computation never counted:
~ standing cross-team version governance forever (coordination.shared-dependency-governance = y;
                                                  bound by constraint.no-version-governance, re-classed
                                                  class.irrelevant-by-default by derive.single-coordinated-team)
~ contract drift becomes structurally possible   (contracts.drift-surface = y vs n for every baseline unit)
~ a page-wide runtime every team co-versions     (runtime.shared-runtime-library = y)
~ the exit the baselines "fail" costs level 6    (migration.exit.participants-standalone = n, but the level
                                                  is inside the stated appetite: Model finding 3)

Derived from:
question.ownership.composition-parties -> ownership.single-team = y; external-participant = n
  -> derive.single-coordinated-team
  -> reclass(constraint.independent-deploy, constraint.no-version-governance,
             constraint.framework-major-coexistence, constraint.runtime-roster-change
             -> class.irrelevant-by-default)
question.deploy.independence.current  -> "one train is livable"   (constraint.atomic-release NOT bound)
question.deploy.independence.value    -> question.rule.state-fork -> slot state.target, confidence 2
                                      -> predicate.target-credible FAILS -> rule.aspiration-warning
question.migration.host-ceiling       -> constraint.host-modification-ceiling(host, maxLevel = migration.major-refactor)
question.trajectory.bounded-exit      -> constraint.bounded-exit (class.strong-preference)
[no route]                            -> eleven-minute build, heavy bundle: no binding exists
```

### 4.14 Guardrail verification (brief section 3)

| Guardrail | Result |
|---|---|
| The expected outcome class is a non-MFE baseline recommendation (`trust.no-mfe`) | **FAIL (model bug; fixture not patched, REQ-ORCH-11).** Settled at E7 by `engine.rule.candidate-order` rule 1. `family.module-graph-federation` in its native-federation configuration is the only family with zero violated strong-preference bindings (`migration.exit.participants-standalone` = y, `performance.shared-dependency-dedup` = y, `ux.natural-layout-flow` = y) and therefore the only `status.match.strong`; every baseline family carries one named violation of `constraint.bounded-exit` (`migration.exit.participants-standalone` = n) and is knocked to `status.match.viable`; status order puts the microfrontend family first, so `candidateStrategies` is headed by an MFE family and the outcome class reads `trust.other-oss`. `dominance.fused-baselines-over-mfe` is active and disclosed at E8 with both conditions holding and its matrix verification reproducing exactly, and it has no ordering power whatever, because `rule.dominance-suppression` acts only on the askable question set and `engine.rule.candidate-order` has no dominance term. decision-engine.md section 7 nevertheless attributes this exact outcome class to that exact rule. The failure survives all four readings of the two undetermined normalizations (4.7 sensitivity table); the one reading that lands on a baseline does so through rule 4's explicitly arbitrary id tiebreak while declaring the monolith and module federation equally good. Diagnosis and fix: Model findings 1 to 4 |
| The hundred-engineer aspiration must not drive the recommendation; it may appear only in the counterfactual | **PASS** at E1/E4/E13. `question.rule.state-fork` routes the wish to `slot: state.target` at intake; `predicate.target-credible` fails on all three legs at E4 (ordinal 2, below both the ordinal-5 threshold and the ordinal-4 buy-in path, which `buyin.budget` = absent would fail anyway; authority is CEO statements not engaged; the two-year horizon is tied to no plan and cannot survive the 3x probe); `rule.no-target-satisfies-hard` never had to act, because no target binding attempted to satisfy a hard constraint. `slots.bestToday` is computed from `slot: state.current` bindings only, and the three cells that produce the wrong head are all present-tense, so the guardrail-1 failure is demonstrably not caused by the aspiration. The aspiration appears in exactly two places: `slots.bestAfterTransition` as the `rule.aspiration-warning` conditional with all nine buy-in signals listed missing, and counterfactual 4 |
| High willingness to invest must not make heavier options rank better | **PASS** at E6/E7, with a caveat that must be read. No ordering rule reads `migration.required-level` or the stated appetite: `engine.rule.candidate-order` reads status and counts of violated preference bindings only, and the level-6 ceiling acts solely as an E6 predicate. Worked instances: `family.module-graph-federation` (participant floor 3 to 4, host floor 1 to 3) and `family.lifecycle-orchestration` (participant floor 4, host floor 4 to 6) are both comfortably affordable at this appetite, and neither is promoted for being affordable; `migration.rule.viability` is applied as pass/fail, never as a bonus. Caveat: the guardrail's protective intent is defeated anyway, by the unrelated route of Model finding 1, so this PASS must not be read as reassurance that the fixture resists heavy options. The mirror hazard is worse and is recorded as Model finding 5: a LOW appetite would eliminate the baselines |
| The trace must not invent team boundaries to justify a technology (REQ-STATE-11) | **PASS** at E1/E4/E9. The trace records `ownership.single-team` = y and creates no `participant:*` subject anywhere; the rank-4 battery is asked once for the single own-team ownership class (R1) and produces a host-side ceiling only; no binding in the 4.4 table is justified by a hypothetical team, and the hundred-engineer target is confined to the septet. Hazard recorded as Model finding 8: at closure the next-question selector points at rank 3, whose circumstance phrasing presupposes two teams in both branches, so an LLM front-end normalizing this Situation is actively invited to manufacture the boundary; the graph has no prune edge from `derive.single-coordinated-team` to rank 3, and this trace declines the question by hand rather than by rule |

### 4.15 Model findings

Ten findings, surfaced by the trace per REQ-ORCH-08 and belonging to the model, not the
fixture (REQ-ORCH-11). Findings 1 to 4 are the guardrail failure; 1 is load-bearing and 2 to
4 are the reasons it bites here rather than staying latent.

1. **`engine.rule.candidate-order` has no dominance term, so `trust.no-mfe` is not
   producible** (layer: logic). This is the guardrail-1 failure. question-graph.md 2.1 defines
   dominance as question suppression and explicitly preserves dominated candidates in the
   survivor set; E8 repeats that; E7's four ordering rules never mention `dominance.*`; and
   decision-engine.md section 7's expressibility gate nevertheless certifies `trust.no-mfe` as
   producible by naming `dominance.fused-baselines-over-mfe` as the mechanism that makes
   baseline families head `candidateStrategies`. No such mechanism exists. The consequence is
   not confined to this fixture: any organization at `topology.coordinated-team` reaches a
   survivor set of all twelve families with at most a handful of preference bindings, and the
   head of the list is then decided by whichever preferences happen to be bound, with rule 4's
   arbitrary id tiebreak as the fallback. At the canonical two-question REQ-Q-04 exit of
   questions.md 3.2 (rank 1 single team, rank 2 train acceptable, nothing else answered), the
   only bound preferences are the two E2 topology priors, six families tie at zero violations,
   and rule 4 hands the head to `family.lifecycle-orchestration` on the alphabet. The
   two-question exit that three artifacts promise cannot be produced by the pipeline.
   Proposed fix: add a rule 0 to `engine.rule.candidate-order`, ahead of the status rule. For
   every active dominance rule, every candidate in its dominated set is ordered strictly after
   every candidate in its dominating set and is capped at `status.match.weak` ("listed, not
   recommended") with the dominance id as its `condition`. This is a partial order over named
   sets, not a composite score, so `engine.rule.no-scores` is preserved, and it is declarative,
   so `engine.rule.declarative-only` is preserved. It requires one schema change: `dominance.json`
   records must carry explicit `dominating` and `dominated` id lists, which today exist only as
   prose inside each rule's description. Amend question-graph.md 2.1 from "Dominance is not
   elimination" to "Dominance is not elimination; it is a disclosed ordering cap", so that
   `rule.retain-by-default` and REQ-Q-04 honesty are preserved (the dominated families stay
   listed and explained) while they can no longer outrank their dominators.
2. **`dominance.fused-baselines-over-mfe`'s justification is factually incomplete** (layer:
   evidence, feeding interpretation). The rule asserts that "every advantage the seven MFE
   families carry binds exactly the constraints that rule re-classed irrelevant", and verifies
   only `performance.shared-dependency-dedup` and `contracts.drift-surface`.
   `constraint.bounded-exit` is not among the four constraints `derive.single-coordinated-team`
   re-classes, it is live in this fixture, and the microfrontend families are strictly better
   on it: `migration.exit.participants-standalone` = n for modular-monolith,
   monorepo-package-composition, plain-spa-routing, server-rendered-templates,
   islands-architecture, bit and commercetools-frontend, versus y for native-federation,
   iframe-composition, wujie, micro-app-jd, qiankun, reverse-proxy-route-composition and
   nextjs-multi-zones, and c for module-federation, import-map-architectures and
   web-components-composition. The assertion is therefore false as written, and this fixture is
   its counterexample.
   Proposed fix: extend the rule's matrix verification with the exit axis and the honest
   concession that the baselines lose it, and add a disclosure duty: whenever the rule is
   active while `constraint.bounded-exit` is bound, the report must carry the conceded axis as
   an explicit tradeoff (REQ-REPORT-03) with its price attached from finding 3, instead of
   letting it silently invert the ordering. Do not turn the concession into a dissolving
   condition: an organization that would rather keep its options open is not thereby an
   organization that needs independent deployment, and dissolving the dominance on a wish is
   exactly the B4 aspiration inflation questions.md 1.3 forbids.
3. **`cost.evolve` is scored as a boolean where the model defines it as a level** (layer:
   taxonomy). constraints.md 2.6 binds `constraint.bounded-exit` to
   `migration.exit.participants-standalone`, a yes/no attribute ("do participants remain
   standalone runnable and deployable applications outside the composition"), while
   state-transition.md section 6 defines `cost.evolve` as "the migration level of leaving or
   converging" and migration.md section 4 makes the same mapping. The boolean cannot
   distinguish "this can never be dissolved" from "dissolving this costs
   `migration.major-refactor`, which the organization has already budgeted", and the cell notes
   say exactly that distinction in prose without encoding it: modular-monolith,
   "Modules are not runnable alone, though drawn boundaries ease later extraction";
   monorepo-package-composition, whose `migration.permanent-viability` note calls it "the
   published staging ground toward MFEs"; server-rendered-templates, "the page seam eases later
   proxy-based extraction". In this fixture the exit price of the recommended baseline is level
   6 and the stated appetite is level 6, so the "corner" the user fears is priced and
   affordable, and the model reports it as a violation.
   Proposed fix: add a scale-valued attribute `migration.exit.min-level` (mirroring the two
   existing scale rows, condition text carrying the level id) and let `constraint.bounded-exit`
   compare it ordinally against a stated exit appetite, with `migration.exit.participants-standalone`
   demoted to the atom that justifies the level. Add its relaxation-ledger row to constraints.md
   6.1 ("accept that dissolving the composition costs a level-N refactor"), which it currently
   lacks, along with the eight other missing rows already itemized in
   legacy-angular-modernization.md finding 7.
4. **Family inherent costs have no engine representation, and the reclass erases them instead
   of pricing them** (layer: taxonomy). `derive.single-coordinated-team` re-classes
   `constraint.no-version-governance` to `class.irrelevant-by-default`, which is the correct
   fact ("this organization can run an upgrade train") and the wrong consequence: it makes
   `coordination.shared-dependency-governance` = y cost the candidate nothing at all, in the
   exact situation where topology.md 2.1 says "paying for them is unjustified overhead
   (REQ-THESIS-02 cuts both ways)". The constraint has three useful states and only two ids:
   hard ("the organization cannot supply governance", eliminates), irrelevant ("it can",
   free), and the missing middle ("it can, and it costs a standing role a six-engineer team has
   nobody to fill"). The same hole applies to every families.md "Inherent costs" and "Hard
   limitations" field: `runtime.shared-runtime-library` = y, `contracts.drift-surface` = y,
   `performance.sandbox-execution-tax`, `performance.per-unit-document-boot` are all facts the
   engine holds and never counts, because a candidate is only ever ranked down for violating a
   preference somebody bound.
   Proposed fix: the model's declared answer to unpriced costs is dominance, so the primary fix
   is finding 1. Alongside it, give E7 a disclosure duty rather than a scoring rule: every
   dominated candidate's `tradeoffs` must carry the inherent-cost field refs of its family, so
   the report can say what the dominated option would cost and why nothing in this assessment
   pays for it. That keeps `engine.rule.no-scores` intact (named cost items with refs, never a
   number) and makes the "for what benefit" ledger of questions.md 1.3's B2 pattern visible in
   the output as well as in the questions.
5. **Zero composition boundaries: `constraint.participant-modification-ceiling` has no subject,
   and the baselines' participant floor answers a question that does not arise** (layer: logic).
   constraints.md 1.4 makes `subject` a per-boundary field and topology.md section 1 makes
   topology a per-boundary property, but nothing in the engine handles the case of zero
   boundaries, which is precisely the case REQ-Q-04 exists to serve. This trace binds only the
   host facet, on the reasoning that there is no participant; nothing in the model requires
   that reading, and the alternative is destructive. The baselines record
   `migration.participant.min-level` = `migration.major-refactor` (6), which families.md 5.1
   glosses as the cost "for an existing *separate* application to join" and then adds "Within
   the codebase: refactoring, not migration". If this fixture's appetite had been stated as
   "days" rather than "weeks or even a quarter", the level probe would bind maxLevel 3 or 4, and
   a literal E6 would eliminate all five baseline families (floor 6 exceeds the ceiling) while
   every microfrontend family survives on floors 1 to 4. A one-team startup that will not
   invest much would be told to adopt microfrontends because it cannot afford to keep its
   monolith. That inversion is reachable from this fixture by changing one answer.
   Proposed fix: two parts. (a) E6 must evaluate a family's `migration.participant.min-level`
   only against subjects that are actual participants of a composition boundary; with zero
   participant boundaries the appetite fact binds `constraint.host-modification-ceiling` alone,
   and the participant floor is not consulted. (b) Encode families.md 5.1's incumbent reading
   as data rather than prose: an estate that already IS the candidate pays nothing to remain it.
   A `migration.incumbent.min-level` row, or an E6 guard keyed on the absence of a participant
   subject, both work; the prose currently carries the whole load.
6. **The fixture's actual problem statement is unbindable** (layer: taxonomy). The Situation
   names its real complaints explicitly ("Our actual complaints today are that production
   builds take eleven minutes and the app bundle is getting heavy") and neither produces a
   binding. constraints.md section 2 defines no constraint over build or CI duration;
   questions.md section 8's coverage table lists no route; attributes.md records no attribute
   for build duration or total initial payload (the `buildtime.*` group is about tooling
   requirements, the `performance.*` group about per-page composition overheads); and
   `derive.payload-budget`'s premise requires "many co-displayed units", of which there are
   none. Under `rule.unanswered-inert` both inputs contribute nothing. Two consequences bite.
   First, nothing discriminates inside the baseline group, whose five members differ from each
   other chiefly on exactly those axes, so the recommended set is ordered by rule 4 and
   disclosed as not meaningful. Second, the engine cannot state whether its own recommendation
   addresses the user's complaint, which is the one thing this user will check. Note that
   questions.md 3.8 already contains the pattern for the fix in an adjacent case: when
   first-paint motivation turns out to be performance rather than crawlability, "the engine
   routes to the honest baselines instead (`family.islands`, `family.spa-routing`; families.md
   5.5, 5.3) rather than binding". No equivalent reroute exists for the build-time and
   bundle-weight motivation, which is the most common real motivation for asking this question
   at all.
   Proposed fix: add `question.performance.delivery-pain` as a spine node after rank 3, with a
   circumstance phrasing that names the symptom rather than any mechanism ("What is actually
   slow or heavy today: how long a production build takes, how much JavaScript users download,
   both, or neither?"). It binds nothing hard by construction (a performance taste may never
   eliminate, questions.md 1.3 pattern B2): bundle weight sets `constraint.payload-dedup` at
   weak-to-strong, build duration sets a new `constraint.build-scalability` at
   `class.weak-preference` with ceiling `class.strong-preference`. Its load-bearing output is a
   non-binding reroute record, mirroring 3.8's: bundle weight routes to `family.spa-routing`
   and `family.islands`, build duration routes to build tooling and to
   `family.modular-monolith` / `family.package-composition` with the honest note that splitting
   a build across deploy units trades build duration for the drift surface
   (`contracts.drift-surface` flips n to y). Grounding the ranking half additionally needs two
   matrix attributes that do not yet exist (an incremental-build atom and a total-initial-
   payload atom); until they do, the reroute is reportable and the ranking half is not, and the
   report should say so rather than imply the recommendation was chosen for the stated pain.
7. **`question.trajectory.bounded-exit` has two contradictory in-edges** (layer: logic).
   question-graph.md 1.3 unlocks it from rank 2 under the condition "independent-deploy binds
   hard or strong", and separately unlocks "the trajectory battery" from rank 1 under
   `edge.forks` whenever any fact diverges current versus target; state-transition.md section 7
   and questions.md section 4 both define the battery as the nine trajectory ids plus
   `question.trajectory.bounded-exit` as its tenth member. In this fixture the rank-2 condition
   fails (the constraint is `class.irrelevant-by-default` in the current-state slot after the
   reclass, and the only preference binding sits in `state.target`) while the rank-1 fork
   fires, so the question is simultaneously unreachable and askable. The choice decides whether
   the Situation's "built ourselves into a corner" sentence binds anything at all. A second,
   smaller ambiguity rides along: the rank-2 condition is stated in terms of a binding class
   without naming a slot, so it does not say whether a `state.target` preference arms it.
   Proposed fix: name the governing edge (the rank-1 fork is the right one: exit cost is a
   present-tense property of any candidate, not a consequence of wanting independent deploys),
   delete or demote the rank-2 row to a relevance boost, and qualify every binding-class unlock
   condition in question-graph.md 1.3 with the slot it reads.
8. **Rank 3 presupposes team boundaries and is unanswerable at `ownership.single-team`**
   (layer: logic; the guardrail-4 hazard). `question.granularity.single-screen` is spine, is
   not in `dominance.fused-baselines-over-mfe`'s `skips` list, and retains nonzero gain here
   because a yes eliminates `family.server-templates` from the recommended set, so
   `rule.question-closure` does not fire and `nextQuestion` selects it. Both of its
   circumstance branches name teams ("is there a page where two different teams' work is
   visible at the same time, or does each page belong to one team"), and this organization has
   one team, so answering either way manufactures a boundary REQ-STATE-11 forbids. The engine
   has no way to answer it and no way to decline it. The same reclass that admits the baselines
   should have made it vacuous: with zero participants, `runtime.concurrent-participants`
   cannot be a question about ownership.
   Proposed fix: add an `edge.prunes` row from `derive.single-coordinated-team` to rank 3 and
   its chrome follow-up, re-classing `constraint.single-screen-mixing` to
   `class.irrelevant-by-default` (concurrency of participants cannot arise with no
   participants), and re-home the `family.server-templates` discrimination onto the
   rendering-model fact that finding 6's new question would carry. Until then, a trace at
   `ownership.single-team` must record rank 3 as inapplicable rather than answer it, as this
   one does.
9. **A dominance-suppressed prior ranks candidates while being invisible in
   `unresolvedQuestions`** (layer: logic). `engine.rule.prior-bindings` says preference-class
   priors "may rank (preferences never eliminate) and are listed in `unresolvedQuestions` until
   confirmed"; `rule.dominance-suppression` says a suppressed question "is excluded from
   `unresolvedQuestions` (with the dominance id recorded instead)". Here
   `dominance.fused-baselines-over-mfe` suppresses ranks 5 to 16, which includes the confirming
   questions for both E2 priors, so `constraint.seamless-ux` and `constraint.payload-dedup`
   rank permanently as `prior-unconfirmed` and appear in no output field. This is
   decision-relevant, not cosmetic: the payload-dedup prior is the only binding that separates
   `family.server-templates` from the other baselines, and both priors are inputs to the
   ordering the guardrail-1 failure rides on.
   Proposed fix: make disclosure unconditional. A `prior-unconfirmed` binding must appear
   either in `unresolvedQuestions` or in a new `priorsApplied` list beside `dominanceApplied`,
   carrying the prior's topology origin, its class, and what it is currently ranking, so no
   binding can shape an ordering without appearing in the output.
10. **The all-atoms defect recurs a third time, here on
    `constraint.host-modification-ceiling`** (layer: interpretation codified into logic). The
    constraint binds one ordinal atom (`migration.host.min-level`) and one flat atom
    (`migration.host.shell-takeover-required` = n). Under a literal all-atoms read,
    `impl.single-spa` is eliminated at any ceiling whatever (cell y, "root config owns the
    document shell"), including ceilings far above the level of the work; under the ordinal
    read it is retained (host floor `migration.bootstrap-change`, well inside the level-6
    ceiling). The reading is decision-relevant here: it moves `family.lifecycle-orchestration`
    between `status.match.strong` and `status.match.conditional` and thereby decides the head
    of the list in the A-branch of 4.7's sensitivity table. Two smaller defects sit alongside
    it: constraints.md 2.6's prose attributes shell takeover to piral ("piral shell takeover")
    while the cells put y on single-spa and c on piral ("yes on the standard path ... embedding
    piral-core/piral-base as a library is the documented possible-extension"); and
    native-federation's two min-level cells encode bare integers ("2", "4") where migration.md
    section 9 resolution 3 requires the scale id in the condition text, so a strict
    `scales.json` lookup fails to parse the cells of the very configuration that heads the
    computed ordering.
    Proposed fix: adopt the per-constraint deciding-atom semantics already proposed by
    third-party-vendor-widget.md finding 1 and legacy-angular-modernization.md finding 3, which
    is now the third recurrence of one defect class reached from three different constraints
    and three different families, and settle it generally rather than per cell. Correct the
    2.6 prose to the cells, and re-serialize native-federation's two min-level conditions as
    `migration.integration-adapter` and `migration.bootstrap-change`.

### 4.16 Regression expectations

Stable assertions any engine implementation must reproduce for this fixture:

- **Guardrail 1 must be reported as FAILING until Model finding 1 is fixed.** A trace that
  reports `trust.no-mfe` without a dominance term in `engine.rule.candidate-order` has either
  regressed or been patched, and a trace that reports it via reading A2 of 4.7 must disclose
  that the verdict rests on rule 4's arbitrary id tiebreak.
- Outcome class after the fix: `trust.no-mfe`, with `family.modular-monolith` heading
  `candidateStrategies`, then `family.package-composition` and `family.spa-routing` at
  `status.match.strong` (tied by rules 2 and 3, ordered by rule 4, disclosed as not
  meaningful), then `family.server-templates` at viable on the `constraint.payload-dedup`
  prior, then `family.islands` at conditional on its is-land posture, and the seven
  microfrontend families listed at `status.match.weak` with
  `dominance.fused-baselines-over-mfe` as their condition. Never `trust.hf-community`:
  `impl.hyperfrontend` sits inside a dominated family and no binding in this assessment favors
  it. Never `trust.hfe-future`: no planned capability fits anything, so REQ-AVAIL-02 has
  nothing to pair.
- **No family may be eliminated at E6.** The survivor set is all twelve families. Exactly one
  hard binding exists in the entire assessment
  (`constraint.host-modification-ceiling`(host, maxLevel=`migration.major-refactor`)), and it
  produces exactly three per-configuration exclusions: `impl.entando` and
  `impl.commercetools-frontend` on `migration.host.min-level` = `migration.rewrite`, and the
  Astro/Fresh posture of `islands-architecture` on the same row. An implementation that
  eliminates families here has bound something the answers do not support.
- **The low-appetite inversion must not occur** (Model finding 5). Re-running with the appetite
  stated as "days" (maxLevel 3 or 4) must still recommend the baselines. An implementation that
  eliminates all five baseline families on `migration.participant.min-level` = 6 for an
  organization with no participants has reproduced the bug.
- Exactly one `derive.*` rule fires: `derive.single-coordinated-team`, entailed, producing four
  reclassifications to `class.irrelevant-by-default` and no positive binding. The other
  thirteen rules must stay inert, `derive.payload-budget` included.
- `dominance.fused-baselines-over-mfe` active and disclosed with both conditions;
  `dominance.fusion-subsumes-drift-and-dedup` disclosed as inactive
  (`constraint.atomic-release` is not bound: the train is livable, not mandated);
  `dominance.browser-boundary-over-simulated-realm`, `dominance.static-subsumes-infra-tier`
  and `dominance.html-entry-at-low-ceiling` inactive.
- Both slots produced. `slots.bestToday` must be derivable entirely from `slot: state.current`
  bindings, with no citation of the septet or of any `state.target` binding.
  `slots.bestAfterTransition` must carry the `rule.aspiration-warning` conditional and never a
  recommendation: `family.module-graph-federation`, `status.match.conditional`,
  `fit.transition-dependent` true, `dependsOnTransitions` naming
  `dimension.integration-time` at `transition.confidence.theoretical`, and all nine buy-in
  signals listed as missing. `question.trajectory.no-transition-outcome` must be asked before
  emission and answered from the Situation's last sentence, supported by
  `migration.permanent-viability` = y on all five baseline units. After Model finding 1 is
  fixed the slots diverge and `rule.dual-slot-divergence` must cite the septet.
- `gapRecords` empty, `relaxationOffers` empty, `assessmentStatus` not
  `status.assessment.no-current-strong-match`.
- Next question at closure: `question.granularity.single-screen`, selected with guaranteed gain
  0 over S = 12 families and won on expected class plus reach, and recorded as inapplicable
  rather than answered (Model finding 8). Emission under `rule.conditional-output` shape 2.
- Engine-answered guards must both fire without spending a question, and
  `constraint.code-ownership` must be reported as the answer to the Situation's "so teams do
  not block each other" motivation: uniform y across all 30 units, the modular monolith
  included.
- Key counterfactuals: the committed change that alters this answer is a second team with its
  own repository and release schedule, not the headcount projection (source 2, with
  `deployment.host-rebuild-required` = y quoted for all five baseline units); escalating
  `constraint.bounded-exit` to hard eliminates every baseline on
  `migration.exit.participants-standalone` = n and must be refused as B4 aspiration inflation
  absent a stated requirement; a hard `constraint.atomic-release` is the only route by which
  the unfixed pipeline reaches `trust.no-mfe` structurally; raising the host ceiling to
  `migration.rewrite` readmits `impl.entando`, `impl.commercetools-frontend` and the
  Astro/Fresh islands posture.
- The eleven-minute build and the heavy bundle must remain visible as UNBINDABLE inputs in the
  normalized table until Model finding 6 is fixed. A trace that quietly binds them, or that
  claims the recommendation addresses them, has invented a constraint the model does not have.
