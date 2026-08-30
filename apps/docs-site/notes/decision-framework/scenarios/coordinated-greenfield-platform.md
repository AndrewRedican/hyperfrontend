# Scenario: coordinated-greenfield-platform

Status: TRACED (2026-08-29).

## 1. Situation

We are a national grocery retailer building a new customer portal from the ground up; nothing
has been written yet. The program is funded for three years and a vice-president sponsors it
personally. We have hired a platform group of eight engineers to own the portal's shared
frame (navigation, sign-in, design system) and four product teams of five to eight engineers
each to build the sections: shopping, delivery, loyalty, and pharmacy. From day one the
product teams are expected to ship their own sections on their own schedules; we have all
agreed that waiting on a combined release is exactly what made our previous portal miserable.
That expectation is written into the program charter, the teams have signed up for it, and
the release process is being set up this quarter. All teams will use the same UI framework by
governance decision; nobody is asking for different stacks. The first public release is
twelve months out. We want the portal to feel like one seamless product to shoppers, whatever
we do behind the scenes.

## 2. Normalized inputs

Re-normalized 2026-08-29 against the canonical ids of
[constraints.md](../model/constraints.md), [questions.md](../model/questions.md),
[topology.md](../model/topology.md), and [migration.md](../model/migration.md). Changes: each
input now names its constraint binding, class, and derivation route; the greenfield appetite
and the single-framework governance decision are restated as explicit *non*-bindings (the two
constraints they would otherwise touch stay `class.irrelevant-by-default`); the host-side
recurring-cost row is bound to `constraint.no-host-change-per-participant` and marked as the
explicit answer that overrides the `topology.platform-product` hard-tendency prior; the
twelve-month release is reclassified from a program fact to the governing horizon per
`engine.rule.horizon-select`; two rows are added for facts the Situation states but the
provisional table left implicit (the platform group's ownership of the frame and contract, and
the five-party deploying count that entails `derive.many-party-drift`); values otherwise
unchanged.

| Input | Canonical binding | Class / marking |
|---|---|---|
| Topology label | `topology.platform-product` | label (informational; facts govern) |
| `ownership.multi-repo` = yes, `ownership.independent-releases` = yes (chartered, process standing up this quarter) | topology-inference evidence (topology.md section 3); premises of no `derive.*` rule | observed facts, `state.current` with a `state.target` pair on the deployment-ownership dimension |
| `ownership.single-team` = no; no external, acquired, or unmodifiable participant | blocks `derive.single-coordinated-team`, `derive.external-principal`, `derive.no-cross-deploy-control`, `derive.broken-governance`, `derive.plugin-admission`, `derive.white-label-fit`, `derive.legacy-untouchable` | observed fact (the absence is the signal) |
| Section addition/update without a portal-wide release (program charter) | `constraint.independent-deploy` (global) via `question.deploy.independence`; sub-ids per REQ-STATE-03: `.current` (no product ships yet), `.value` = yes (desirability, facet-capped at preference), `.readiness` = yes (fact, checked against the buy-in signals) | `class.hard-constraint`, slot `state.current` (see Model finding 1) |
| `migration.appetite`(host and all four sections) = `migration.greenfield` (0) | no binding: `constraint.participant-modification-ceiling` and `constraint.host-modification-ceiling` stay `class.irrelevant-by-default` (questions.md 3.4 classification: "greenfield participant = irrelevant") | observed fact; the guardrail-1 non-binding |
| First public release twelve months out | `engine.rule.horizon-select`: governing horizon `migration.horizon.first-integration`; echoed as a report risk line | horizon selection, not a constraint |
| Single UI framework across all teams (governance decision) | `derive.mixed-majors-present` does not fire (no incompatible-majors estate, no unfunded alignment); `constraint.framework-major-coexistence` stays `class.irrelevant-by-default` | observed fact (framework independence irrelevant) |
| One seamless product experience for shoppers | `constraint.seamless-ux` via `question.ux.seam-tolerance`, binding `ux.natural-layout-flow`, `ux.body-portal-compat`, `ux.overlay-viewport-escape`, `ux.cross-boundary-focus-mgmt` | `class.strong-preference` (desirability facet ceiling; never eliminates, REQ-Q-02) |
| Four known sections; occasional shell releases tolerable | `constraint.no-host-change-per-participant` (family-scope atom `deployment.new-participant-host-change`) via the host-side facet of `question.roster.runtime-admission`; explicit answer overrides the topology hard-tendency prior (topology.md section 1) | `class.weak-preference` |
| Platform group of eight owns the shared frame, the contract, and the host | `constraint.no-platform-team` stays `class.irrelevant-by-default` (the standing platform role exists and is funded); signals `buyin.platform-responsibility`, `buyin.staffing` | observed fact |
| Five independently deploying parties (platform group plus four product teams) | `derive.many-party-drift` (entailed; every surviving candidate scores `contracts.drift-surface` = y): `constraint.explicit-drift-surfacing` at `class.strong-preference`, `scope.implementation` | entailed; confirmed at stage 2 by `question.impl.drift-machinery` |
| `topology.platform-product` priors (constraints.md 2.15) | hard tendencies `constraint.explicit-drift-surfacing` (arrives entailed at strong, above) and `constraint.no-host-change-per-participant` (overridden by the explicit weak answer, above); preference tendencies `constraint.instant-rollback`, `constraint.paved-road` | `prior-unconfirmed`; priors never eliminate (E2 `engine.rule.prior-bindings`) |

State septet, deployment-ownership dimension (`dimension.integration-time` plus
`dimension.release-actuation` per [state-transition.md](../model/state-transition.md)
section 2's relevance note):

| Field | Value |
|---|---|
| `state.current` | release process being stood up this quarter |
| `state.target` | independent per-team releases against a platform contract |
| `transition.willingness` | high; unanimous |
| `transition.cost` | process and contract work only (no existing code) |
| `transition.authority` | VP sponsor engaged; director-level charter |
| `transition.confidence` | `transition.confidence.transitioning` (6) |
| `transition.horizon` | this quarter; launch in twelve months |

Buy-in signals present: `buyin.executive-sponsorship`, `buyin.budget`, `buyin.staffing`,
`buyin.timeline`, `buyin.team-agreement`, `buyin.platform-responsibility`,
`buyin.release-process-agreement`. The target state is credible per
[state-transition.md](../model/state-transition.md) section 3. Not stated, and therefore open:
`buyin.ownership-defined` and `buyin.governance-plan` (they carry the topology.md 2.3
follow-ups; see 4.9).

## 3. Guardrail expectations

Sanity checks only; no predicted winner.

- Greenfield: no candidate may be eliminated on migration grounds; every strategy is
  mechanically reachable and the decision must be driven by the other concern areas
  ([migration.md](../model/migration.md) section 2, level 0 note).
- The transition is credible (confidence 6 plus signals), so `recommendation.best-after-transition`
  may be a genuine recommendation; the desirability/readiness pair (REQ-STATE-03) both check
  out here and the trace must show that check rather than skip it.
- The trace must genuinely evaluate simpler baselines before composing (REQ-Q-04); the
  charter's deployment-autonomy hard constraint is the only input separating this scenario
  from [should-not-use-microfrontends.md](should-not-use-microfrontends.md), and the trace
  must make that dependency explicit. If that constraint were downgraded to a preference,
  `trust.no-mfe` becomes admissible.
- Follow-ups from [topology.md](../model/topology.md) section 2.3 (participant count and
  growth, on-call for the composed whole, contract staffing authority) must appear as
  answered or unresolved questions, not be silently dropped.
- This is a mainstream, well-served constraint set: a `trust.no-match` outcome would indicate
  a model defect, not a genuine gap (REQ-GAP-01 bar).

REQ-TRUST-01 outcome classes allowed (ids per [README.md](README.md)): `trust.hf-community`,
`trust.other-oss`, `trust.commercial`; `trust.no-mfe` only under the downgrade condition
above; `trust.hfe-future` only under the REQ-AVAIL-02 pairing. `trust.no-match` and
`trust.change-assumptions` are regression signals here.

## 4. Trace

Hand-traced 2026-08-29 through the [decision-engine.md](../model/decision-engine.md) pipeline
(E1 to E17), with cells quoted from
[matrix-compact.tsv](../matrix/matrix-compact.tsv) and per-cell conditions from
`matrix/columns/<unit>.json` (version.research 2026.08.0). Subjects: `host` (the portal
frame), `participant:shopping`, `participant:delivery`, `participant:loyalty`,
`participant:pharmacy`, batched as one ownership class per question-graph.md 4.2 R1
(own-team, greenfield, identical appetite).

**Model finding 1 is load-bearing for this trace and is stated before the walk**: the model
has no rule that decides which state slot a chartered-but-not-yet-operating requirement binds
in when every participant is greenfield. This trace applies the proposed
`rule.greenfield-current-binding` (4.15). Under the literal reading of
`question.rule.state-fork` the charter binds in `state.target` only, `slots.bestToday` retains
all five baselines, and the outcome is `trust.no-mfe` without any downgrade, which is the
regression guardrail 3 exists to catch.

### 4.1 E1 `engine.step.intake`

The section 2 table is the intake record. Rank 1 (`question.ownership.composition-parties`)
fills the ownership facts: five parties, all in-house, multi-repo, releases independent by
charter, no external / acquired / unmodifiable participant. Rank 2
(`question.deploy.independence`) is answered in its three sub-ids per REQ-STATE-03 and
questions.md 3.2, which is the check guardrail 2 demands be shown rather than skipped:

| Sub-id | Answer | Engine treatment |
|---|---|---|
| `question.deploy.independence.current` | nothing ships yet; the release process is being set up this quarter | fact; does not by itself establish independent releases (this is what forces Model finding 1) |
| `question.deploy.independence.value` | "waiting on a combined release is exactly what made our previous portal miserable"; unanimous | desirability facet; `maxClass` caps it at `class.strong-preference`, so it can never bind hard on its own (audit B4 defense) |
| `question.deploy.independence.readiness` | teams are prepared and authorized to own their release process; charter signed, process being stood up, platform responsibility assigned | fact, checked against the buy-in signals: seven of nine present, `buyin.release-process-agreement` and `buyin.team-agreement` among them |

The charter's "a section must reach users without a portal-wide release" is the stated policy
fact of questions.md 3.2's hard branch, and it binds `constraint.independent-deploy` hard.
Rank 4's battery is not spent: `migration.appetite` = `migration.greenfield` for the single
ownership class, and questions.md 3.4 classifies a greenfield participant as irrelevant, so
the level probe never runs (question-graph.md 4.2 R3, derivation-first). Rank 10
(`question.ux.seam-tolerance`) is answered at `class.strong-preference`. The host-side
recurring-cost answer binds `constraint.no-host-change-per-participant` weak. The twelve-month
first release selects `migration.horizon.first-integration` and produces a report risk line
only, per `engine.rule.horizon-select`.

Not answered, and therefore inert (`rule.unanswered-inert`): rank 3
(`question.granularity.single-screen`), rank 6, rank 7, rank 8, rank 9, rank 12, rank 13,
rank 15, rank 16, and the chrome follow-up. Their consequences are carried in 4.9 and 4.12.

### 4.2 E2 `engine.step.topology-infer`

`ownership.multi-repo` + `ownership.independent-releases` + asymmetric ownership (one group
owns the host, frame, and contract; four groups own participants) infer
`topology.platform-product` for all four host/section boundaries;
`question.topology.confirm` confirmed (the section 2 label row is informational; facts
govern). Priors armed from constraints.md 2.15, platform-product row:

- `constraint.explicit-drift-surfacing` (hard tendency): arrives independently as an entailed
  strong binding from `derive.many-party-drift` (4.3). Per `engine.rule.prior-bindings` the
  hard tendency does not eliminate before its confirming question
  (`question.impl.drift-machinery`), which is unanswered; it stays at strong and is listed in
  `unresolvedQuestions`. This is the anti-steering hinge of the trace: the sponsor's sharpest
  single-implementation eliminator (taxonomy.md 2.10, hard on all four atoms retains
  hyperfrontend only) is never allowed to harden from a topology prior.
- `constraint.no-host-change-per-participant` (hard tendency): overridden by the explicit
  weak answer (topology.md section 1: explicit answers always override priors).
- `constraint.instant-rollback`, `constraint.paved-road` (preference tendencies): enter as
  `prior-unconfirmed` preference bindings at `scope.implementation`, may rank, and are listed
  in `unresolvedQuestions` until `question.impl.rollback-actuation` and
  `question.impl.paved-road` are answered.
- Modification ceilings are negotiable under this topology (platform authority), which is
  consistent with, and here subsumed by, the greenfield non-binding.

### 4.3 E3 `engine.step.derive`

Fired:

- `derive.many-party-drift` (entailed; five independently deploying parties >= 3, and every
  surviving candidate scores `contracts.drift-surface` = y): binds
  `constraint.explicit-drift-surfacing` at `class.strong-preference`, `scope.implementation`.

Not fired (premises absent): `derive.single-coordinated-team` (`ownership.single-team` = n;
this is why `dominance.fused-baselines-over-mfe` can never activate here, 4.8),
`derive.external-principal`, `derive.no-cross-deploy-control` (the platform group does control
the host and the contract), `derive.unmodifiable-participant-floor`, `derive.legacy-untouchable`,
`derive.mixed-majors-present` (single framework by governance decision, greenfield estate),
`derive.broken-governance`, `derive.plugin-admission` (four known sections, participants known
at host ship time), `derive.white-label-fit`, `derive.b2b-chain`, `derive.static-estate`,
`derive.seo-surface`, `derive.regulated-release`, `derive.payload-budget`.

`inferredRequirements` therefore contains exactly one entry, and it is implementation-scope.

### 4.4 E4 `engine.step.compose`

| Constraint | Subject | Class | Scope | Slot | Origin |
|---|---|---|---|---|---|
| `constraint.independent-deploy` | global | hard | family | current | answer:question.deploy.independence (charter policy fact; `rule.greenfield-current-binding`, Model finding 1) |
| `constraint.seamless-ux` | global | strong-preference | family | current | answer:question.ux.seam-tolerance |
| `constraint.no-host-change-per-participant` | host | weak-preference | family (+ implementation on the ownerless atom) | current | answer (host-side recurring cost); overrides topology prior |
| `constraint.explicit-drift-surfacing` | global | strong-preference | implementation | current | derive.many-party-drift; topology.platform-product prior |
| `constraint.instant-rollback` | global | strong-preference (prior-unconfirmed) | implementation | current | topology.platform-product prior |
| `constraint.paved-road` | global | weak-preference (prior-unconfirmed) | implementation | current | topology.platform-product prior |

Target slot: the deployment-ownership septet is evaluated against
`predicate.target-credible`. Confidence ordinal 6 >= 5 (clause 1 passes on the primary path,
so the buy-in minimum subset is corroboration rather than a gate); authority held and engaged
(VP sponsor, director-level charter, clause 2); horizon this quarter, inside the twelve-month
decision horizon and surviving the 3x robustness probe (three quarters still lands before the
first release, clause 3). Verdict: **credible**. Per `rule.target-credibility` the target
binding participates in the E13 second pass; per `rule.no-target-satisfies-hard` it satisfies
nothing in the current pass, and it is not asked to: the charter binding already stands there.
`rule.aspiration-warning` has nothing to act on (no non-credible target exists).

No class ceiling truncated anything except the desirability facet at rank 2, which is
recorded with the truncation noted.

### 4.5 E5 `engine.step.relations`

- `rel.excludes` `constraint.independent-deploy` (hard) vs `constraint.atomic-release` (hard):
  definitional, and recorded. The train branch of rank 2 is therefore not a live choice while
  the charter binding holds; it reappears only through the 4.12 counterfactual.
- `rel.requires` on `constraint.payload-dedup` (needs standing governance or build fusion):
  rank 12 is not unlocked (rank 3 unanswered), so nothing is queued.
- `rel.relaxes` (single-screen negated): not fired. Rank 3 is unanswered and
  `rule.unanswered-inert` forbids reading silence as the negation, so the co-residence cluster
  (ranks 6, 9, 11, 12, 15) is neither pruned nor confirmed.
- `rel.excludes` `constraint.no-strategy-runtime` vs `constraint.paved-road`: the paved-road
  prior is preference-class and no-strategy-runtime is unbound, so the warn edge on rank 16 is
  armed but not fired.
- No gap seeds queued: no `to` side of any exclusion is bound hard.

### 4.6 E6 `engine.step.eliminate-family` (cells quoted from matrix-compact.tsv)

Exactly one hard binding has `scope.family`, so exactly one elimination set exists.

| Eliminated | Violated binding | Deciding cells |
|---|---|---|
| `family.modular-monolith`, `family.package-composition`, `family.spa-routing`, `family.server-templates`, `family.islands` | `constraint.independent-deploy` | `deployment.host-rebuild-required` = y for modular-monolith ("atomic artifact; every change ships the whole app on one release train"), monorepo-package-composition, plain-spa-routing, server-rendered-templates, islands-architecture, bit; commercetools-frontend = c ("page-composition changes ship with no rebuild; any component code change requires rebuilding and redeploying the single app": the condition fails the need). Second atom, independently decisive: `ownership.deploy-schedule-ownership` = n for all six ("all teams share one release train"; plain-spa-routing's own cell calls this "the one MFE motivation this unit cannot even partially absorb"). families.md section 5: "no independent deployment, by definition" |

Per-configuration exclusion inside a surviving family:

- `impl.entando` (`family.custom-element-composition`): `ownership.deploy-schedule-ownership`
  = c, condition "bundle publish is team-owned; production go-live needs instance-side install
  by platform operators". A central go-live gate fails the second half of
  `constraint.independent-deploy` ("the team must own its schedule"), so the configuration is
  excluded. It is **not** excluded on its level-8 host floor
  (`migration.host.min-level` = "Level 8: wholesale platform adoption") or its level-4
  participant floor, both of which are inert here: guardrail 1.

Retained, per configuration (`c` retains only with its condition attached):

| Family | Retained configuration | Deciding cells |
|---|---|---|
| `family.route-partition` | reverse-proxy-route-composition, impl.nextjs-multi-zones, impl.cloudflare-workers-microfrontends | `deployment.host-rebuild-required` = n/n/n; `ownership.deploy-schedule-ownership` = y/y/y |
| `family.server-fragment-assembly` | podium, opencomponents, server-side-fragment-composition, edge-side-composition, web-fragments (pierced mode) | host-rebuild n x5; deploy-schedule-ownership y x5 |
| `family.custom-element-composition` | web-components-composition in the MFE pairing | `composition.phase.deploy-unit-per-participant` = c, condition "yes under the MFE pairing (per-team bundle URLs); no when elements ship as build-time packages"; host-rebuild n; deploy-schedule-ownership y ("under the per-team bundle-URL pairing, a team's deploy reaches users directly") |
| `family.module-graph-federation` | module-federation, native-federation, import-map-architectures | host-rebuild n x3; deploy-schedule-ownership y x3 |
| `family.lifecycle-orchestration` | single-spa, piral | host-rebuild n/n; deploy-schedule-ownership y/y |
| `family.virtualized-rehosting` | qiankun, micro-app-jd, wujie, web-fragments (client reframing) | host-rebuild n x4; deploy-schedule-ownership y x4 |
| `family.document-embedding` | iframe-composition, impl.luigi (iframe mode), impl.hyperfrontend | host-rebuild n/n/c; hyperfrontend's condition "no while the contract holds; contract-changing updates require the host to install a regenerated shell" is discharged by this scenario's own weak-preference answer (occasional shell releases tolerable), and is carried on the candidate |

Constraints that could have eliminated and did not, each recorded so the elimination story is
falsifiable (this table is the substance of guardrails 1 and 3):

| Constraint | Why it eliminates nothing here |
|---|---|
| `constraint.participant-modification-ceiling` | unbound: appetite `migration.greenfield` for every participant. The floor-3 cluster (module-federation), the floor-4 cluster (native-federation, single-spa, piral, qiankun, entando, hyperfrontend), and the baselines' level-6 extraction floor are all inert; no `migration.participant.min-level` cell decides anything in this trace |
| `constraint.host-modification-ceiling` | unbound: greenfield host plus platform authority (topology.md 2.3). piral's `migration.host.shell-takeover-required` = c and entando's level-8 host floor survive it |
| `constraint.framework-major-coexistence` | `derive.mixed-majors-present` not fired (single framework by governance) |
| `constraint.no-version-governance` | unbound: `derive.broken-governance` premises absent. `coordination.shared-dependency-governance` = y for module-federation, native-federation, import-map-architectures, single-spa, piral is a live tradeoff, not a violation (rank 6 unanswered) |
| `constraint.single-screen-mixing`, `constraint.persistent-chrome`, `constraint.cross-boundary-soft-nav` | unbound: rank 3 unanswered, so its follow-up never unlocks. `runtime.concurrent-participants` = n for all three route-partition members is therefore not read against them |
| `constraint.distinct-principal`, `constraint.fault-containment`, `constraint.main-thread-protection`, `constraint.css-containment` | unbound: no external principal, rank 9 not unlocked |
| `constraint.static-hosting-only`, `constraint.no-new-infra-tier`, `constraint.composed-first-paint` | unbound: rank 7 and rank 8 unanswered. `migration.host.new-infra-tier-required` = y for reverse-proxy-route-composition, podium, opencomponents, edge-side-composition, server-side-fragment-composition, web-fragments is a cost note only |
| `constraint.atomic-release`, `constraint.payload-dedup`, `constraint.sync-boundary-calls`, `constraint.runtime-roster-change`, `constraint.no-strategy-runtime`, `constraint.no-platform-team` | unbound; `constraint.no-platform-team` is affirmatively irrelevant, since the standing platform-owner role exists and is funded |
| `constraint.artifact-integrity`, `constraint.rsc-federation` | gap-trigger constraints, unbound; no gap record is emitted (4.12) |

Engine-answered guards (questions.md section 7): `constraint.installable-today` and
`constraint.code-ownership` satisfied uniformly across all 30 units; no question spent.

Survivor set: **all seven microfrontend families**. Nothing about this is a modelling
accident: it is what "greenfield plus one hard organizational constraint" mechanically means,
and it is the reason the question budget below is high rather than short.

### 4.7 E7 `engine.step.rank-family`

Bound preferences at family scope: `constraint.seamless-ux` (strong) and
`constraint.no-host-change-per-participant` (weak). Seamless-ux atoms per family, best
configuration:

| Family | `ux.natural-layout-flow` | `ux.body-portal-compat` | `ux.overlay-viewport-escape` | `ux.cross-boundary-focus-mgmt` | Verdict |
|---|---|---|---|---|---|
| `family.module-graph-federation` | y | y | y | y | satisfied |
| `family.lifecycle-orchestration` | y | y | y | y | satisfied |
| `family.server-fragment-assembly` | y | y | y | y | satisfied |
| `family.custom-element-composition` | y | c (web-components) | y | y | satisfied, condition carried |
| `family.virtualized-rehosting` | y | y | y | y (wujie c) | satisfied |
| `family.route-partition` | na | y | na | na | **unevaluable**: three of four deciding cells are `na` (Model finding 2) |
| `family.document-embedding` | n (hyperfrontend, iframe-composition), c (luigi) | - | n / c | n | violated |

Weak preference (`deployment.new-participant-host-change` = n), best configuration:
route-partition n (reverse-proxy: "a new app joins by claiming a prefix in proxy config"),
lifecycle-orchestration n (piral: "feed publish onboards a new pilet; shell untouched"),
module-graph-federation c (module-federation: "MF 2.0 registerRemotes/manifest discovery
admits new remotes without a rebuild"), server-fragment-assembly c
(server-side-fragment-composition: "registry-based implementations onboard without composer
redeploy"), document-embedding c (luigi: "config-only if Core fetches its navigation config
dynamically"), custom-element-composition y (violated: "host must emit the new tag and script
URL"), virtualized-rehosting y (violated).

Order per `engine.rule.candidate-order`:

1. **`family.lifecycle-orchestration`** : `status.match.strong`. Hard set satisfied
   unconditionally; strong preference satisfied on cells; weak preference satisfied outright.
   Tradeoff named: `coordination.shared-dependency-governance` = y for both members, the
   standing upgrade-train burden this org has not yet been asked about (rank 6).
2. **`family.module-graph-federation`** : `status.match.strong`. Same profile; weak preference
   conditional rather than satisfied. Same governance tradeoff (families.md 3.4 "the family's
   defining burden"), plus `contracts.connect-compat-gate` = c on the runtime end, never read
   as satisfied (REQ-MATRIX-05).
3. **`family.server-fragment-assembly`** : `status.match.strong`. Hard set satisfied
   unconditionally; strong preference satisfied; weak preference conditional. Tradeoffs:
   `migration.host.new-infra-tier-required` = y for every member, and
   `ux.persistent-shared-chrome` = n / `ux.cross-boundary-soft-nav` = n on the classic members
   (podium, edge-side-composition), which cut against the Situation's stated intent without
   being reachable by any bound constraint (Model finding 2).

   Ordering note for 1 to 3: rule 2 ties (no strong-preference violation among them) and rule
   3 ties (none violates the weak preference). The order therefore falls to rule 4,
   lexicographic id, and the report says so: **tied, order not meaningful**. Three unanswered
   questions separate them and each kills a different one: rank 6 hard removes 1 and 2, rank 7
   hard removes 3, rank 8 hard removes 1 and 2 in their default configurations and retains 3.

4. **`family.route-partition`** : `status.match.conditional`, condition "page-seam composition
   is acceptable". It is the only survivor a rank-3 yes eliminates outright
   (`runtime.concurrent-participants` = n for reverse-proxy-route-composition,
   nextjs-multi-zones, cloudflare-workers-microfrontends), so its retention, not merely its
   rank, is contingent on the next question. Disclosure duty: its
   `constraint.seamless-ux` cells are `na`, so the strong preference the user actually stated
   scores nothing against it even though `ux.persistent-shared-chrome` = n and
   `ux.cross-boundary-soft-nav` = n for all three members.
5. **`family.custom-element-composition`** : `status.match.conditional`, condition "per-team
   bundle-URL pairing" (the `c` cell of 4.6). Ranked after 4 by rule 3 (one violated weak
   preference against none). Tradeoffs: `runtime.global-registration-collision` = y (a
   page-global tag-name treaty), `performance.duplicate-framework-same-page` = y,
   `isolation.failure.post-mount-exception` = n, every operational concern adopter-built.
6. **`family.virtualized-rehosting`** : `status.match.weak` (hard set satisfied, no bound
   preference violated, but an unmitigated cost pile-up: listed, not recommended). Its
   distinguishing capability is level-1 rehosting of already-deployed applications nobody may
   modify, and at `migration.greenfield` no bound constraint buys it, while its inherent costs
   stand: `performance.sandbox-execution-tax` = y (qiankun, micro-app-jd),
   `ownership.participant-bytes-verbatim` = n, `deps.duplicated`, and permanent browser-compat
   maintenance risk concentrated in the framework (families.md 3.6 works-poorly).
7. **`family.document-embedding`** : `status.match.weak`. It violates the one bound strong
   preference (`ux.natural-layout-flow` = n for hyperfrontend and iframe-composition, c for
   luigi), and its distinguishing capabilities (browser-enforced containment,
   `trust.distinct-principal` reachability, external participants) are bought by no binding in
   this assessment, while `performance.per-unit-document-boot` = y,
   `performance.process-memory-overhead` = c, and the seam-engineering program stand as
   unmitigated costs. Ranked last by rule 2 (one violated strong preference against
   virtualized-rehosting's none).

Fit flags, all seven candidates: `fit.architectural` holds (the technical cluster is almost
entirely unbound here); `fit.organizational` holds (each retained configuration gives a
section team its own deploy and its own schedule, which is the whole organizational demand);
`fit.operational` carries the per-family cost refs above; `fit.transition-dependent` is **no**
for every candidate, because no supporting binding originates in a `state.target` slot.

REQ-Q-04 is served twice over: seven candidates with explained remaining tradeoffs is the
normal result here, and the baselines were evaluated and eliminated by a single named binding
rather than assumed away.

### 4.8 E8 `engine.step.dominance`

No dominance rule is active. Each of the six is checked and disclosed with the condition that
fails, because the absence is itself the explanation for the wide survivor set and the high
question budget:

| Rule | Condition | Status |
|---|---|---|
| `dominance.fused-baselines-over-mfe` | `derive.single-coordinated-team` fired AND rank 2 train-acceptable | inactive; `ownership.single-team` = n, so the rule is unreachable in this scenario no matter what rank 2 says |
| `dominance.route-partition-over-coresident-runtimes` | rank 3 = no AND persistent-chrome not required AND soft-nav not required | inactive; rank 3 unanswered (`rule.unanswered-inert`) |
| `dominance.browser-boundary-over-simulated-realm` | `constraint.distinct-principal` hard | inactive; no external principal |
| `dominance.fusion-subsumes-drift-and-dedup` | `constraint.atomic-release` hard | inactive; excluded by the charter binding (4.5) |
| `dominance.static-subsumes-infra-tier` | `constraint.static-hosting-only` hard | inactive; rank 7 unanswered |
| `dominance.html-entry-at-low-ceiling` | rank 4 bound maxLevel <= 2 | inactive; greenfield, no ceiling bound |

Consequence: `dominanceApplied` is empty and no question is suppressed by dominance, so
`unresolvedQuestions` carries the full askable set below.

### 4.9 E9 next-question and emission shape

Askable, with nonzero effect over S = 7 families:

| Candidate q | guaranteed | expected class | reach (G2) |
|---|---|---|---|
| `question.granularity.single-screen` (rank 3) | 0 (yes removes 1, no removes 0) | common (a shared frame plus four sections is the ordinary reading of the Situation) | largest in the set: unlocks `question.ux.chrome-persistence` and ranks 6, 9, 11, 12, 15, or prunes all of them |
| `question.delivery.first-paint` (rank 8, premise sub-question first) | 0 | plausible (a grocery portal plausibly carries an unauthenticated SEO surface; the hard form needs explicit business confirmation) | warn edge to the chrome follow-up |
| `question.coordination.upgrade-train` (rank 6) | 0 (hard removes 2 of the 3 head candidates) | rare (a funded platform group and a governance decision that already aligned one framework are evidence the capability exists) | prunes rank 12's hard form |
| `question.delivery.server-capacity` (rank 7) | 0 (hard removes 1) | rare (three-year funded program at a national retailer) | warn edge to rank 8; would activate `dominance.static-subsumes-infra-tier` |
| `question.contracts.sync-calls` (rank 15) | 0 (hard removes 2) | rare | none |
| `question.orchestration.appetite` (rank 16) | 0 | plausible | bridges to stage 2 |

argmax: guaranteed gain ties at 0, so selection falls to expected class, where rank 3 is the
only `common` entry, and it also wins on reach. **`question.granularity.single-screen` is
asked next.** The fixture supplies no further answers, so the engine emits under
`rule.conditional-output` shape 2 (conditional), naming each unanswered question with the
answer that would overturn a recommended candidate in `unresolvedQuestions.couldStillChange`
(enumerated as counterfactuals in 4.12).

`question.trajectory.no-transition-outcome` is asked, though it is not mandatory here (no
`fit.transition-dependent` output is pending, 4.7): clause 3 of `predicate.target-credible`
requires the 3x robustness probe, and this question is where it is cashed. Answer from the
brief's own guardrail 3: if the independent-release process never actually stands up, the
charter binding downgrades to `class.strong-preference` and the baselines re-enter. That is
the same door as counterfactual 1 in 4.12.

Topology.md 2.3 follow-ups, carried explicitly rather than dropped (guardrail 4):

| Follow-up | Disposition |
|---|---|
| Participant count and growth rate | **Partly answered**: four sections, count fixed by the charter (this is what keeps the host-change preference weak). **Growth unresolved**: a stated open-ended roster would fire `derive.plugin-admission`, unlock rank 13, and bind `constraint.runtime-roster-change` plus `constraint.no-host-change-per-participant` hard, which would re-rank the whole set. Recorded in `unresolvedQuestions` |
| Who is on call for the composed whole | **Unresolved**: the `buyin.ownership-defined` signal is not present. It does not affect credibility (the ordinal-6 path does not consult the buy-in subset), but it is the readiness fact behind `fit.operational` for every candidate, and it is the premise `question.impl.platform-team` would use |
| Platform team staffing authority for the contract | **Answered**: eight engineers hired, `buyin.platform-responsibility` and `buyin.staffing` present, VP sponsor engaged. This is what makes `constraint.explicit-drift-surfacing` a live implementation-stage preference rather than an unfundable wish, and what makes `constraint.no-platform-team` affirmatively irrelevant |

Also open and listed: `buyin.governance-plan`, `question.impl.drift-machinery`,
`question.impl.rollback-actuation`, `question.impl.paved-road`,
`question.impl.stewardship-floor`, `question.trajectory.bounded-exit`, and the three R2
operability groups of stage 2b.

### 4.10 E10 to E12: stage 2 and the availability lens

Stage 2 evaluates the members of surviving families only, and nothing here reaches back into
family choice (`engine.rule.stage-firewall`; constraints.md 1.3). One implementation-scope
preference is bound (`constraint.explicit-drift-surfacing`, strong, from
`derive.many-party-drift`) plus two `prior-unconfirmed` preferences; no implementation-stage
question is answered, so the 2.13 lens constraints stay inert and availability is pure
annotation (`engine.rule.availability-lens`).

Drift atoms (`contracts.formal-descriptor` / `contracts.contract-versioned` /
`contracts.connect-compat-gate` / `contracts.drift-explicit`), within each family only:

| Family | Members, ranked within the family | Drift atoms | Availability (independent factor) |
|---|---|---|---|
| `family.lifecycle-orchestration` | impl.piral, then impl.single-spa | y/y/n/n vs n/n/n/n | piral `avail.available` (1.12.3, monthly cadence; v2 is `avail.announced-planned` and satisfies nothing); single-spa `avail.available` on 6.x with `unit.maintenance.release-within-12mo` = n, `commit-within-6mo` = n, `org-steward` = n, `multi-maintainer` = n, `single-current-line` = n |
| `family.module-graph-federation` | impl.module-federation, then impl.native-federation, then import-map-architectures (family substance, no impl record) | c/c/c/n vs y/?/c/c vs n/n/n/n; partial gates never read as satisfied | module-federation `avail.available` with the strongest maintenance profile in the trace (`multi-maintainer` y, `org-steward` y, `adoption-scale-10k` y, `adoption-outside-sponsor` y, `stable-line-shipped` y); native-federation `avail.available` with `org-steward` = c |
| `family.server-fragment-assembly` | impl.opencomponents, then impl.podium, then impl.web-fragments | y/y/c/c vs y/y/n/n vs n/n/n/n | opencomponents `avail.available` with `stable-line-shipped` = n (0.50.x, never 1.0) and `multi-maintainer` = n; podium `avail.available`, `multi-maintainer` = ?, `adoption-scale-10k` = n; web-fragments `avail.available-immature` (beta, stalled cadence), an annotation and not a downgrade |
| `family.route-partition` | reverse-proxy-route-composition (practice), impl.nextjs-multi-zones, impl.cloudflare-workers-microfrontends | n/n/n/n throughout | practice n/a; nextjs-multi-zones `avail.available`; cloudflare-workers-microfrontends `avail.available-immature` |
| `family.custom-element-composition` | web-components-composition (practice) | c/n/n/n | n/a (browser standard) |
| `family.virtualized-rehosting` | wujie, micro-app-jd, qiankun, web-fragments (client) | n/n/n/n throughout | wujie `avail.available`, `multi-maintainer` = n; micro-app-jd `avail.available-immature` (perpetual RC); qiankun split line (2.x dormant, v3 RC), `migration.forced-remigration-pending` = y |
| `family.document-embedding` | impl.hyperfrontend, impl.luigi, iframe-composition (practice) | y/y/y/y (the landscape's only fully gated contract) vs n/?/y/? vs n/n/n/n | hyperfrontend community `avail.available-immature` (0.x, breaking wire changes permitted, `multi-maintainer` = n, `org-steward` = n, `adoption-outside-sponsor` = ?), `migration.forced-remigration-pending` = y, `migration.permanent-viability` = c; enterprise `avail.announced-planned` and satisfies no binding; luigi `avail.available` (SAP-stewarded) |

The firewall is what decides this trace's outcome and is stated plainly: impl.hyperfrontend
wins the bound implementation-scope preference outright, and that cannot lift
`family.document-embedding` off the bottom of the family ordering, because the family lost on
`constraint.seamless-ux` at `scope.family` and no `scope.implementation` result reopens family
selection. The report carries both facts side by side rather than resolving them into one
number.

Availability exclusions from `slots.bestToday`, retained in `candidateImplementations` with
the state explained (versioning-strategy.md 2.2): `impl.module-federation.nextjs-mf`
(`avail.deprecated`), `impl.module-federation.originjs-vite` (`avail.inactive`),
`impl.picard-js` (`avail.inactive`, the interop layer spanning families 4 and 5). No
`status.match.future-potential` record is produced, so REQ-AVAIL-02 has nothing to pair.

E11 edition stage: every `constraint.operability.*` is `class.irrelevant-by-default` (the
stage-2b block is unanswered) and `question.edition.operability.managed-service-preference` is
unanswered, so no commercial edition is selected: `impl.piral.cloud`,
`impl.nextjs-multi-zones.vercel-platform`, `impl.entando.commercial`, `impl.bit.cloud`, and
`impl.zephyr-cloud` are all present in the catalogue and none is selected, which is why the
outcome class is not `trust.commercial`. Every candidate stands on its OSS edition
(`unit.editions.oss-self-sufficient` = y across the recommended set).

### 4.11 E13 `engine.step.dual-output`

- `slots.bestToday`: the 4.7 ordering with its tie disclosure and its stage-2 member lists.
  Always produced (REQ-STATE-02).
- `slots.bestAfterTransition`: **produced, and a genuine recommendation, not a warning**. The
  deployment-ownership dimension has a credible target differing from current (4.4), which is
  the trigger condition; the second pass re-evaluates with the target bindings added. Result:
  the survivor set and the ordering are identical, because the charter already bound the same
  constraint in the current pass. `rule.dual-slot-divergence` does not fire, and the report
  says why: the septet records are cited to explain that the slot was produced and that it
  converged. `rule.aspiration-warning` is not invoked; no candidate carries
  `fit.transition-dependent`; the missing-signals list is empty.

Convergence is the strongest available robustness result and is exactly what guardrail 2 asks
the trace to demonstrate rather than skip: the recommendation does not depend on the release
process transition completing, only on the charter holding.

### 4.12 E14 to E16: gaps, relaxation, counterfactuals

`gapRecords`: empty. The survivor set is seven families deep, no `rel.excludes` pair is
jointly hard, and neither gap-trigger constraint (`constraint.artifact-integrity`,
`constraint.rsc-federation`) is bound. `assessmentStatus` is not
`status.assessment.no-current-strong-match`: guardrail 5 satisfied.

`relaxationOffers`: empty. Offers exist only when the hard set empties a candidate space
(REQ-GAP-01), which never happens here.

`counterfactuals` (mechanics: decision-engine.md section 6):

1. **(source 1, ledger row for `constraint.independent-deploy`)** Accept one release train:
   `family.modular-monolith`, `family.package-composition`, `family.spa-routing`,
   `family.server-templates`, and `family.islands` all return, and
   `constraint.atomic-release` becomes bindable. Two facts make this the pivotal
   counterfactual of the fixture rather than a formality. First, it is the whole distance
   between this scenario and should-not-use-microfrontends: it is the only binding that
   eliminated anything (4.6). Second, the ledger's usual price for readmitting baselines
   ("to 6+: baselines via extraction") is **zero here**, because every participant is at
   `migration.greenfield` and there is no existing separate application to extract; the
   level-6 `migration.participant.min-level` cells of modular-monolith,
   monorepo-package-composition, plain-spa-routing, and server-rendered-templates never
   apply. Refs: relaxation ledger row, families.md section 5, migration.md section 2 level-0
   note. Under this relaxation the outcome class becomes `trust.no-mfe`, which is precisely
   the admissibility condition guardrail 3 states.
2. **(source 4, credibility)** The inverse probe on the same door: the target is already
   credible, so the counterfactual runs downward. If the release-process transition stalls
   past the first release, or the charter is renegotiated from a requirement to a preference,
   `constraint.independent-deploy` re-classes to `class.strong-preference`, eliminates
   nothing, and the five baselines head the ordering on cost while
   `dominance.fused-baselines-over-mfe` still cannot activate (`ownership.single-team` = n).
   Refs: septet records, `buyin.*` records, `predicate.target-credible`,
   `question.trajectory.no-transition-outcome`.
3. **(source 3, unanswered eliminating answers)** Each recorded as
   `{candidate, wouldBecome: status.match.incompatible, if: <answer>, refs}`:
   - rank 3 yes (single-screen mixing required): `family.route-partition` incompatible
     (`runtime.concurrent-participants` = n x3), and the chrome follow-up unlocks.
   - rank 6 hard (no standing dependency-version governance): `family.module-graph-federation`
     and `family.lifecycle-orchestration` incompatible
     (`coordination.shared-dependency-governance` = y for module-federation,
     native-federation, import-map-architectures, single-spa, piral): two of the three tied
     head candidates.
   - rank 7 hard (static hosting only): `family.server-fragment-assembly` incompatible
     (`ssr.static-hosting-sufficient` = n for podium, opencomponents, edge-side-composition,
     server-side-fragment-composition, web-fragments): the third head candidate. Ranks 6 and 7
     answered hard together empty the entire `strong` band and leave only conditional and weak
     candidates.
   - rank 8 hard (composed, crawlable first paint): `family.module-graph-federation`,
     `family.lifecycle-orchestration`, `family.virtualized-rehosting`,
     `family.document-embedding`, and `family.custom-element-composition` incompatible in
     their default configurations, promoting `family.server-fragment-assembly` and
     `family.route-partition`.
   - rank 9 hard (fault containment): `family.module-graph-federation`,
     `family.lifecycle-orchestration`, and `family.custom-element-composition` incompatible
     (`isolation.failure.post-mount-exception` = n, `isolation.lifecycle.reclaim` = n).
   - chrome-persistence hard: `family.route-partition` and the classic
     `family.server-fragment-assembly` members incompatible
     (`ux.persistent-shared-chrome` = n), which promotes `family.document-embedding` from
     weak (its members score y).
   - rank 15 hard (synchronous boundary calls): `family.document-embedding` and
     `family.route-partition` incompatible.
   - roster growth open-ended (`derive.plugin-admission`): the weak host-change preference
     hardens and `family.custom-element-composition`, `family.server-fragment-assembly`'s
     host-authored members, and `family.virtualized-rehosting` lose their retained
     configurations.
4. **(source 2, dominance)** No rule is active, so the entries run in the positive direction:
   answering rank 3 no would activate
   `dominance.route-partition-over-coresident-runtimes` and suppress ranks 6, 9, 11, 12, 15
   and rank 16 at family scope; answering rank 7 hard would activate
   `dominance.static-subsumes-infra-tier`. `dominance.fused-baselines-over-mfe` is
   unreachable for this organization at any answer.

Symmetry duty satisfied: item 1 covers all five families excluded by a single hard binding,
and item 3 supplies the cheapest overturning answer for every recommended candidate.

### 4.13 E17 emission, outcome class, derivation sample

Outcome class: **`trust.other-oss`**. The head of the ordering is a tied band of three
non-HyperFrontend families whose strongest current members are vendor-neutral OSS
(impl.piral, impl.module-federation, impl.opencomponents / impl.podium and the request-path
practices). `trust.hf-community` is not reached: `family.document-embedding` ranks last of
seven, on a bound strong preference the user stated
(`ux.natural-layout-flow` = n; `constraint.seamless-ux`), and impl.hyperfrontend's win on the
one bound implementation-scope preference is firewalled at `scope.implementation`
(REQ-MISSION-01: the engine did not steer around the sponsor's ranking, and did not steer
toward it either). `trust.commercial` is not reached because no operability answer and no
managed-service preference exist (4.10). `trust.hfe-future` is not reached because no planned
capability fits a need a shipping unit does not already satisfy, so REQ-AVAIL-02 has nothing
to pair. `trust.no-match` and `trust.change-assumptions` are not produced.

```text
Recommendation: family.lifecycle-orchestration   [status: strong; tied, order not meaningful]
Recommendation: family.module-graph-federation   [status: strong; tied, order not meaningful]
Recommendation: family.server-fragment-assembly  [status: strong; tied, order not meaningful]
Also retained: family.route-partition (conditional), family.custom-element-composition
               (conditional), family.virtualized-rehosting (weak),
               family.document-embedding (weak)

Why:
+ a section reaches users without a portal-wide release  (deployment.host-rebuild-required = n; ownership.deploy-schedule-ownership = y)
+ nothing is eliminated by adaptation cost               (migration.appetite = migration.greenfield; both modification ceilings irrelevant-by-default)
+ composed regions flow as one document                  (ux.natural-layout-flow = y; ux.overlay-viewport-escape = y; ux.cross-boundary-focus-mgmt = y)

Tradeoffs accepted:
~ standing cross-team dependency governance              (coordination.shared-dependency-governance = y; families 1 and 2; rank 6 unanswered)
~ one composition tier to operate                        (migration.host.new-infra-tier-required = y; family 3)
~ occasional shell release to onboard a section          (deployment.new-participant-host-change = c; constraint.no-host-change-per-participant at weak)

Derived from:
question.deploy.independence -> "no portal-wide release"  (constraint.independent-deploy)
  -> excludes family.modular-monolith, family.package-composition, family.spa-routing,
     family.server-templates, family.islands
five deploying parties -> derive.many-party-drift
  -> constraint.explicit-drift-surfacing (strong, scope.implementation)
question.ux.seam-tolerance -> "one seamless product"      (constraint.seamless-ux, strong)
migration.appetite = migration.greenfield -> no ceiling binding (guardrail 1)
```

### 4.14 Guardrail verification (brief section 3)

| Guardrail | Result |
|---|---|
| Greenfield: no candidate eliminated on migration grounds | **PASS at E4/E6**: `constraint.participant-modification-ceiling` and `constraint.host-modification-ceiling` are both `class.irrelevant-by-default`, so no `migration.participant.min-level` or `migration.host.min-level` cell decides anything. Verified positively: the floor-3 and floor-4 families both survive and both sit in the head band; piral's shell takeover and entando's level-8 host floor survive; impl.entando is excluded on `ownership.deploy-schedule-ownership` = c (platform-operator go-live), never on its floors. The single elimination in the trace is `constraint.independent-deploy` |
| Credible transition; `recommendation.best-after-transition` may be genuine; the desirability/readiness pair is shown, not skipped | **PASS at E1/E4/E13**: the rank-2 sub-id table in 4.1 shows `.value` facet-capped at preference and `.readiness` checked against the buy-in signals; 4.4 evaluates `predicate.target-credible` clause by clause (ordinal 6, authority engaged, horizon inside the decision horizon and surviving the 3x probe); 4.11 emits the slot as a genuine recommendation with no `rule.aspiration-warning` conditional and no `fit.transition-dependent` candidate |
| Simpler baselines genuinely evaluated; the charter dependency explicit; downgrade admits `trust.no-mfe` | **PASS at E6/E16**, conditional on Model finding 1's fix. All five baselines enter E6 and are eliminated by exactly one binding, cell-verified on two atoms; the non-elimination table proves no other bound constraint touches them; counterfactuals 1 and 2 state the downgrade door and price it at zero because of the greenfield appetite. **This guardrail FAILS under the literal `question.rule.state-fork` reading** (the charter binds in `state.target` only, the baselines survive `slots.bestToday`, and `trust.no-mfe` is produced without any downgrade). See Model finding 1 |
| topology.md 2.3 follow-ups appear as answered or unresolved, not dropped | **PASS at E9**: the 4.9 table records participant count as answered and growth as unresolved (with its `derive.plugin-admission` consequence), on-call for the composed whole as unresolved (`buyin.ownership-defined` absent), and contract staffing authority as answered (eight engineers, `buyin.platform-responsibility`, `buyin.staffing`, VP sponsor) |
| A `trust.no-match` outcome would indicate a model defect | **PASS at E14**: seven surviving families, `gapRecords` empty, `relaxationOffers` empty, `assessmentStatus` not `status.assessment.no-current-strong-match` |
| REQ-TRUST-01 admissible classes | **PASS at E17**: `trust.other-oss`, which the brief allows; `trust.no-mfe` appears only inside counterfactuals 1 and 2 under the stated downgrade condition |

### 4.15 Model findings

Per REQ-ORCH-11 nothing in the fixture was patched; both findings belong to the model.

1. **No state-slot rule for a chartered requirement over a greenfield estate** (layer: logic,
   with an interpretation component; **blocking**). `question.rule.state-fork` routes any
   future-tense answer to `state.target`, and `rule.target-credibility` keeps target bindings
   out of the current-state elimination pass. For a greenfield every answer about the system
   is necessarily future-tense, so the literal reading routes the program charter's
   deployment-autonomy requirement to `state.target`, leaves `slots.bestToday` with no
   family-scope hard binding at all, retains the five baselines, and heads the today slot with
   them: `trust.no-mfe` without the downgrade the brief requires for that outcome. The same
   reading also empties migration.md section 2's level-0 promise, which says a greenfield
   decision "is driven by the other seven concern areas"; under the literal fork those areas
   are muted too, because a greenfield organization's answers about a system that does not
   exist can never bind current-state anything.
   **Proposed fix**, as a named engine rule consumed by E4 beside `rule.conway-default`:
   `rule.greenfield-current-binding` : when `migration.appetite` is `migration.greenfield` for
   every participant on a boundary, the boundary has no incumbent architecture to protect, and
   the slot test for a requirement on that boundary is horizon comparison rather than tense:
   a septet whose `transition.horizon` closes before the governing
   `migration.horizon.first-integration` (selected by `engine.rule.horizon-select`) binds its
   requirement in `state.current`, with the septet still driving E13's second pass. Here the
   release-process transition closes this quarter and the first integration is twelve months
   out, so the charter binds current and the two slots converge (4.11). The rule must remain
   subordinate to `rule.no-target-satisfies-hard`: it decides where a *requirement* binds, and
   never lets a target-state *capability* satisfy one. Until it exists, traces must carry this
   reading with the discrepancy disclosed, as this one does.
   Cross-fixture check before adopting: the rule is inert for every other fixture, because
   each has a non-greenfield participant (acquisition-no-rewrite, legacy-angular-modernization,
   third-party-vendor-widget, b2b2c-embedded-product, independent-teams-different-frameworks,
   should-not-use-microfrontends) and plugin-marketplace's greenfield plugins sit behind a
   host that already exists.

2. **`constraint.seamless-ux` has no deciding atom outside `granularity.region`** (layer:
   taxonomy, with a question-graph consequence; not blocking, disclosed in 4.7). Its four
   atoms describe co-resident region flow. At `granularity.page` they score `na` (three of
   four `na` for every route-partition member), and for document-reloading configurations they
   score `y` while the family visibly breaks single-product continuity
   (`ux.persistent-shared-chrome` = n and `ux.cross-boundary-soft-nav` = n for podium and
   edge-side-composition). The two atoms that do capture it belong to
   `constraint.persistent-chrome` and `constraint.cross-boundary-soft-nav`, reachable only
   through `question.ux.chrome-persistence`, which question-graph.md 1.3 unlocks solely from a
   rank-3 yes. A user whose headline requirement is "one seamless product" and who has not yet
   answered rank 3 therefore gets two families ranked `strong` and `conditional` on a
   preference they would fail on the user's own terms. This is the same defect class as
   third-party-vendor-widget Model finding 1 (a constraint whose deciding atoms are not
   resolved per granularity), which makes it a pattern rather than a one-off.
   **Proposed fix**, either: (a) give `constraint.seamless-ux` per-granularity deciding-atom
   semantics, so `granularity.page` and document-reloading configurations are decided by
   `ux.persistent-shared-chrome` and `ux.cross-boundary-soft-nav` instead of scoring `na` or
   vacuously `y`, mirroring `engine.rule.attribution`'s cause-resolution pattern; or (b) let
   `question.ux.seam-tolerance` (rank 10) bind `constraint.persistent-chrome` and
   `constraint.cross-boundary-soft-nav` at their default strong-preference class whenever the
   answer names continuity across the whole product, rather than gating them behind rank 3.
   Additionally, E7 should carry an explicit rule for a preference whose deciding cells are
   predominantly `na`: the candidate is neither credited nor charged, and the report must say
   the preference was unevaluable for it (proposed `engine.rule.na-preference-disclosure`).
   Impact check: under either fix `family.route-partition` and the classic
   `family.server-fragment-assembly` members carry named strong-preference violations and drop
   below the head, and the outcome class is unchanged.

3. **Evidence note, no fix required.** `deployment.new-participant-host-change` reads `y` for
   opencomponents ("a brand-new component appears only after the host page adds its tag") while
   the server-side-fragment-composition cell's condition names OpenComponents as the
   registry-based case that "onboards without composer redeploy". The two are answering
   different questions (host markup versus composer redeploy) and neither is wrong, but a
   re-trace that reads the family through the `c` cell alone will over-credit the family on
   this atom. Re-traces should check the member cell, not the family-representative condition.

### 4.16 Regression expectations

Stable assertions any engine implementation must reproduce for this fixture:

- Outcome class `trust.other-oss`, emitted under `rule.conditional-output` shape 2. Never
  `trust.no-mfe` as the primary outcome while `constraint.independent-deploy` is bound hard;
  never `trust.no-match`; never `trust.commercial` while
  `question.edition.operability.managed-service-preference` is unanswered.
- Exactly one family-scope hard binding exists: `constraint.independent-deploy`, and it is the
  origin of every exclusion in the trace. Eliminated families with the rule id:
  `family.modular-monolith`, `family.package-composition`, `family.spa-routing`,
  `family.server-templates`, `family.islands`, each on `deployment.host-rebuild-required` = y
  and `ownership.deploy-schedule-ownership` = n.
- No elimination cites `migration.participant.min-level` or `migration.host.min-level`. The
  floor-3 and floor-4 families survive and appear in the recommended set; impl.entando is
  excluded on `ownership.deploy-schedule-ownership` = c, never on its level-8 host floor. Any
  migration-grounded elimination in this fixture is a regression against guardrail 1.
- Survivors: all seven microfrontend families, ordered
  `family.lifecycle-orchestration`, `family.module-graph-federation`,
  `family.server-fragment-assembly` (three-way `strong` tie, disclosed as resolved by rule 4
  and therefore not meaningful), then `family.route-partition` and
  `family.custom-element-composition` (`conditional`), then `family.virtualized-rehosting` and
  `family.document-embedding` (`weak`). `family.document-embedding` must rank last on the
  bound `constraint.seamless-ux` violation, and impl.hyperfrontend's win on
  `constraint.explicit-drift-surfacing` must not move it (scope firewall).
- `dominanceApplied` is empty; all six dominance rules are condition-false and disclosed as
  such. `dominance.fused-baselines-over-mfe` must be reported unreachable for this
  organization at any answer, because `ownership.single-team` = n.
- `slots.bestAfterTransition` is produced (the deployment-ownership target is credible at
  ordinal 6) and converges with `slots.bestToday`; `rule.dual-slot-divergence` does not fire;
  no candidate carries `fit.transition-dependent`; `rule.aspiration-warning` is never invoked.
- `gapRecords` and `relaxationOffers` are both empty.
- `nextQuestion` returns `question.granularity.single-screen`, selected on expected class after
  a guaranteed-gain tie at zero.
- Key counterfactuals: accepting one release train reopens all five baselines at zero
  migration cost (greenfield) and yields `trust.no-mfe`; rank 6 hard removes the first two head
  candidates and rank 7 hard removes the third, jointly emptying the `strong` band; a rank-3
  yes eliminates `family.route-partition`; a hard chrome-persistence answer promotes
  `family.document-embedding` off the bottom.
- The three topology.md 2.3 follow-ups appear by name in the output, two unresolved
  (roster growth, on-call ownership) and one answered (contract staffing authority).
