# Scenario: acquisition-no-rewrite

Status: TRACED (2026-08-29).

## 1. Situation

We are a payroll software company with about 200 engineers organized around a single product
platform that our teams release together. Three months ago we acquired a smaller company
whose expense-tracking product our customers love; it was built over eight years by a
12-person team using technology none of our engineers work with. Sales has already promised
joint customers that expenses will appear inside our product as one experience, and that
commitment is two quarters out. The acquired team is fully occupied honoring existing support
contracts, and under the terms of the deal we cannot direct their engineering work until the
earn-out period ends next year. Practically speaking, their application has to show up inside
ours exactly as it is: we cannot touch their code, their build, or their release process, and
they will keep shipping on their own schedule. Our CTO has said in all-hands meetings that
"eventually everything will be on one stack", but there is no approved plan, no budget, and
no timeline for that. Our own platform team can do whatever glue work is needed on our side.
We want customers to feel like it is one product, though we accept it will not be
pixel-perfect on day one.

## 2. Normalized inputs

Re-normalized 2026-08-29 against the canonical ids of
[constraints.md](../model/constraints.md), [questions.md](../model/questions.md),
[topology.md](../model/topology.md), [migration.md](../model/migration.md), and
[state-transition.md](../model/state-transition.md). Changes: each input now names its
constraint binding, class, and derivation route; the two-quarter deadline is reclassified
from hard-constraint to the governing horizon per `engine.rule.horizon-select` (a deadline
selects a horizon, it is not a constraint id); the "one experience" commitment is split out
as `constraint.single-screen-mixing` and the platform team's glue capacity as
`constraint.host-modification-ceiling`; `ownership.no-cross-deployment-control` is recorded
as a corroborating fact; the septet is filed on `dimension.adaptation-floor` with
`predicate.target-credible` named; values otherwise unchanged. Note:
[state-transition.md](../model/state-transition.md) section 10 hand-works a nearly identical
situation as an illustrative micro-example; this fixture is the durable version and takes
precedence for testing.

Subjects: `host` (the payroll platform), `participant:expenses` (the acquired product).

| Input | Canonical binding | Class / marking |
|---|---|---|
| Topology label (per-boundary) | `topology.acquisition` | label (informational; facts govern) |
| `ownership.acquired-participant` = yes | primary topology evidence (topology.md section 3); unlocks `question.trajectory.legacy-horizon` / `.integration-duration` | observed fact, `state.current` |
| `ownership.host-unmodifiable-participant` = yes (until earn-out ends) | premise of `derive.unmodifiable-participant-floor` | observed fact, `state.current` |
| `ownership.multi-repo`, `ownership.independent-releases` = yes | topology evidence; corroborate `constraint.independent-deploy` | observed fact, `state.current` |
| `ownership.no-cross-deployment-control` = yes | premise of `derive.no-cross-deploy-control` | observed fact, asymmetric in origin (the earn-out bars the host from directing their releases; the converse is unstated), corroborating only |
| `ownership.external-participant` = no | `derive.external-principal` does not fire; rank 5 never unlocks (see Model finding 1) | observed fact |
| `migration.appetite`(participant:expenses, `migration.horizon.first-integration`) = `migration.no-modification-possible` (9) | `constraint.participant-modification-ceiling`(expenses, maxLevel=`migration.integration-adapter`, payableBy=host) via `derive.unmodifiable-participant-floor` | `class.hard-constraint` (entailed) |
| `migration.appetite`, host side, up to `migration.moderate-refactor` (5); host-paid `migration.integration-adapter` work available | `constraint.host-modification-ceiling`(host, maxLevel=5) via `question.migration.host-ceiling` | `class.hard-constraint` (stated ceiling, migration.md section 5) |
| Acquired team keeps deploying independently; integration must survive their releases | `constraint.independent-deploy` via `question.deploy.independence` = "no shared release train" (and `derive.no-cross-deploy-control`) | `class.hard-constraint` |
| Expenses appears inside the product as one experience (one screen, two owners) | `constraint.single-screen-mixing` via `question.granularity.single-screen` = yes (product-shape fact) | `class.hard-constraint` |
| Estate runs two incompatible stacks, alignment unfunded | `constraint.framework-major-coexistence` via `derive.mixed-majors-present` | `class.hard-constraint` (entailed; see Model finding 3 on the bound atoms) |
| First integration live within two quarters | `engine.rule.horizon-select`: governing horizon `migration.horizon.first-integration`; echoed as a report risk line | horizon selection, not a constraint |
| Seamless single-product look and feel, desired, explicitly compromisable at launch | `constraint.seamless-ux` via `question.ux.seam-tolerance` | `class.strong-preference` (facet ceiling; never eliminates, REQ-Q-02) |
| Acquisition topology preference tendency (constraints.md 2.15) | `constraint.bounded-exit`, confirming question `question.trajectory.bounded-exit` unanswered | `class.strong-preference`, `prior-unconfirmed` |

State septet, framework-stack dimension (mapped to `dimension.adaptation-floor` per
state-transition.md section 2):

| Field | Value |
|---|---|
| `state.current` | two incompatible stacks |
| `state.target` | single stack ("everything on one stack") |
| `transition.willingness` | stated verbally only |
| `transition.cost` | `migration.framework-migration` or `migration.rewrite` for the acquired product |
| `transition.authority` | CTO voiced intent; not engaged on a plan |
| `transition.confidence` | `transition.confidence.planned-unapproved` (3) at best |
| `transition.horizon` | none stated |

Buy-in signals: all absent except partial `buyin.executive-sponsorship` (verbal);
`buyin.budget`, `buyin.timeline`, `buyin.staffing` absent. The target state is an
aspiration, not credible per `predicate.target-credible`
([state-transition.md](../model/state-transition.md) sections 3 and 4).

## 3. Guardrail expectations

Sanity checks only; no predicted winner.

- Any recommended strategy must not require modifying the acquired application's source,
  build, bootstrap, or release process: its appetite is `migration.no-modification-possible`,
  so only work executable entirely on the acquiring side at `migration.integration-adapter`
  depth or below is admissible ([migration.md](../model/migration.md) section 2, level 9 note).
- `recommendation.best-today` must not depend on the single-stack aspiration; at confidence 3
  with no buy-in signals, anything depending on it may appear only as a warning-annotated
  `fit.transition-dependent` conditional
  ([state-transition.md](../model/state-transition.md) sections 3-4).
- The trace must answer `question.trajectory.no-transition-outcome`: the today recommendation
  remains acceptable if the stack convergence never happens.
- Any elimination on migration grounds carries its counterfactual: which appetite increase
  readmits which candidates ([migration.md](../model/migration.md) section 5; REQ-Q-07).
- Consolidating into one codebase within the timeline is not an admissible outcome (violates
  both the appetite hard constraint and the two-quarter deadline).

REQ-TRUST-01 outcome classes allowed (ids per [README.md](README.md)): `trust.hf-community`,
`trust.other-oss`, `trust.commercial`, `trust.no-match`, `trust.change-assumptions`;
`trust.hfe-future` only under the REQ-AVAIL-02 pairing; `trust.no-mfe` only in the
minimal-embed baseline sense (e.g. a plain frame embed), never as single-codebase
consolidation.

## 4. Trace

Hand-traced 2026-08-29 through the [decision-engine.md](../model/decision-engine.md) pipeline
(E1 to E17), with cells quoted from
[matrix-compact.tsv](../matrix/matrix-compact.tsv) and per-cell conditions from
`matrix/columns/<unit>.json` (version.research 2026.08.0). Subjects: `host`,
`participant:expenses`. This fixture is also walked in decision-engine.md section 5; where
this trace and that walk disagree, section 4.16 names the divergence and settles it.

### 4.1 E1 `engine.step.intake`

The section 2 table is the intake record. Rank 1
(`question.ownership.composition-parties`) fills the ownership facts from the Situation.
The independent-deploy commitment answers `question.deploy.independence` at
`answer.deploy-independence.no-shared-train`. The "one experience" commitment answers
`question.granularity.single-screen` yes, a product-shape fact. The platform team's glue
capacity answers `question.migration.host-ceiling` at `migration.moderate-refactor`. The
seam statement answers `question.ux.seam-tolerance`; the desirability facet's `maxClass`
caps it at `class.strong-preference` regardless of wording (REQ-Q-02). The level-9 appetite
is a fact consumed by E3 (R3 derivation-first: rank 4's battery is entailed in
`topology.acquisition`, questions.md 3.4, so no probe is spent on the expenses class). The
two-quarter deadline is not a constraint: `engine.rule.horizon-select` makes
`migration.horizon.first-integration` the governing horizon for every appetite binding and
emits a report risk line. The CTO's "eventually everything will be on one stack" is a
future-tense answer, so `question.rule.state-fork` routes it to `state.target` plus the
septet and the buy-in checklist, never to a current fact (B4 defense).

### 4.2 E2 `engine.step.topology-infer`

`ownership.acquired-participant` (primary evidence) plus
`ownership.host-unmodifiable-participant`, `ownership.multi-repo`,
`ownership.independent-releases` infer `topology.acquisition` for the host/expenses
boundary; `question.topology.confirm` confirmed (the brief's label row is informational,
facts govern). Priors armed from the acquisition row of constraints.md 2.15: the three
hard tendencies (`constraint.participant-modification-ceiling` low,
`constraint.framework-major-coexistence`, `constraint.independent-deploy`) all arrive as
explicit answers or entailed derivations in 4.3, so no hard prior eliminates ahead of its
evidence (`engine.rule.prior-bindings`; migration.md section 7 "a prior never eliminates").
Of the two preference tendencies, `constraint.seamless-ux` is already answered and
`constraint.bounded-exit` enters as a `prior-unconfirmed` strong preference whose confirming
question `question.trajectory.bounded-exit` goes to `unresolvedQuestions`.

### 4.3 E3 `engine.step.derive`

Fired:

- `derive.unmodifiable-participant-floor` (entailed; both `any` premises present:
  `ownership.host-unmodifiable-participant`=y and appetite level 9): binds
  `constraint.participant-modification-ceiling`(`participant:expenses`,
  maxLevel=`migration.integration-adapter`, payableBy=host) at `class.hard-constraint`.
- `derive.no-cross-deploy-control` (entailed): `constraint.independent-deploy` hard, a
  second origin for a constraint already bound by answer; both far-side modification
  ceilings near zero, already covered by the explicit ceilings.
- `derive.mixed-majors-present` (entailed on the reading that "two incompatible stacks" is
  an incompatible-coexistence estate fact and alignment is unfunded, `buyin.budget`=no at
  confidence 3): binds `constraint.framework-major-coexistence` hard. The premise text and
  the bound atoms do not actually cover different-stack coexistence: see Model finding 3,
  which is load-bearing for the conditions carried by two survivors.

Not fired (premises absent): `derive.external-principal` (the acquired company is not
`ownership.external-participant`, so rank 5 never unlocks and `constraint.distinct-principal`
stays `class.irrelevant-by-default`; Model finding 1), `derive.single-coordinated-team`,
`derive.broken-governance` (neither `ownership.uncoordinated-upgrades` nor
`ownership.distrusted-cadence` is stated), `derive.legacy-untouchable` (the acquired build
runs; its owners are simply unavailable), `derive.static-estate`, `derive.seo-surface`,
`derive.regulated-release` (so `question.guard.verbatim-bytes` is never armed; Model
finding 1), `derive.plugin-admission`, `derive.white-label-fit`, `derive.b2b-chain`,
`derive.many-party-drift` (two deploying parties), `derive.payload-budget`.

### 4.4 E4 `engine.step.compose`

| Constraint | Subject | Class | Params | Slot | Origin |
|---|---|---|---|---|---|
| `constraint.independent-deploy` | global | hard | | current | answer:question.deploy.independence; derive.no-cross-deploy-control |
| `constraint.single-screen-mixing` | global | hard | | current | answer:question.granularity.single-screen |
| `constraint.participant-modification-ceiling` | participant:expenses | hard | maxLevel=`migration.integration-adapter`, payableBy=host | current | derive.unmodifiable-participant-floor; facts `ownership.host-unmodifiable-participant`, `migration.appetite` |
| `constraint.framework-major-coexistence` | global | hard | | current | derive.mixed-majors-present; septet `state.current` |
| `constraint.host-modification-ceiling` | host | hard | maxLevel=`migration.moderate-refactor` | current | answer:question.migration.host-ceiling |
| `constraint.seamless-ux` | global | strong-preference | | current | answer:question.ux.seam-tolerance |
| `constraint.bounded-exit` | global | strong-preference (`prior-unconfirmed`) | | current | topology.acquisition prior |

Target slot: `predicate.target-credible` evaluated over the `dimension.adaptation-floor`
septet. Confidence ordinal 3, below the 5 threshold; the alternative level-4 path needs
ordinal 4 plus `buyin.budget` and one of `buyin.timeline` / `buyin.staffing`, and the
ordinal is 3 with budget absent. Authority is voiced, not engaged. Horizon is unstated, so
the 3x robustness probe cannot even be run. Result: the single-stack target binds nothing in
current-state evaluation (`rule.no-target-satisfies-hard`) and is retained as an aspiration
annotation feeding E13 (`rule.aspiration-warning`). This is the calibration case recorded in
state-transition.md section 4 ("acquisition-no-rewrite fails: ordinal 3, budget absent").

### 4.5 E5 `engine.step.relations`

No `rel.excludes` pair is jointly hard: `constraint.atomic-release`,
`constraint.distinct-principal`, `constraint.payload-dedup`,
`constraint.sync-boundary-calls`, `constraint.static-hosting-only`,
`constraint.composed-first-paint`, `constraint.no-version-governance`,
`constraint.persistent-chrome` are all unbound. No `rel.relaxes` premise is active
(single-screen was affirmed, not negated, so the co-residence cluster stays live and ranks
6, 9, 11, 12, 15 remain reachable). `rel.requires` gates nothing here: rank 12's dedup
prerequisite is untested because rank 12 is unanswered. No warn edges armed; no gap seeds
queued.

### 4.6 E6 `engine.step.eliminate-family` (cells quoted from matrix-compact.tsv)

| Eliminated | Violated binding(s) | Deciding cells |
|---|---|---|
| `family.modular-monolith`, `family.package-composition`, `family.spa-routing`, `family.server-templates`, `family.islands` | `constraint.independent-deploy`; independently `constraint.participant-modification-ceiling` | `deployment.host-rebuild-required` = y for modular-monolith, monorepo-package-composition, plain-spa-routing, server-rendered-templates, islands-architecture, bit (commercetools-frontend c, whose condition fails the need); families.md section 5 "no independent deployment, by definition". Participant floors are `migration.major-refactor` (6) for the four fused baselines and `migration.framework-migration` (7) for commercetools-frontend, all above the maxLevel=2 ceiling |
| `family.route-partition` | `constraint.single-screen-mixing` | `runtime.concurrent-participants` = n for reverse-proxy-route-composition, nextjs-multi-zones, cloudflare-workers-microfrontends; families.md 3.1 "cannot place two teams' output on one screen" |
| `family.module-graph-federation` | `constraint.participant-modification-ceiling`(expenses, maxLevel=2) | `migration.participant.min-level` = `migration.bundler-change` (3) for module-federation, 4 for native-federation; import-map-architectures carries a level-1 branch ("if the app already ships such ESM") but fails the same constraint's other bound atoms, `migration.participant.thirdparty-unmodified-viable` = n and `migration.participant.legacy-no-build-viable` = n, so no configuration survives (constraints.md 2.6) |
| `family.lifecycle-orchestration` | same ceiling; also `constraint.host-modification-ceiling` | `migration.participant.min-level` = `migration.bootstrap-change` (4) for single-spa and piral; piral additionally `migration.host.min-level` = `migration.major-refactor` (6) > 5 and `migration.host.shell-takeover-required` = c |

Per-configuration exclusions inside otherwise surviving families (E6 cell-level semantics):

- `impl.qiankun`: `migration.participant.min-level` = `migration.bootstrap-change` (4 > 2);
  `thirdparty-unmodified-viable` = n, `legacy-no-build-viable` = n.
- `impl.hyperfrontend`: `migration.participant.min-level` = `migration.bootstrap-change`
  (4 > 2); `thirdparty-unmodified-viable` = n; `legacy-no-build-viable` = c, "the hostee SDK
  must run in its pages". The sponsor's own unit is excluded by the fixture's central
  constraint and is not steered around (REQ-MISSION-01).
- `impl.luigi` full-client configuration: `migration.participant.min-level` c names two
  positions, `migration.trivial-adaptation` (embed-only by URL) and
  `migration.bootstrap-change` (full Luigi Client participation); only the embed-only
  configuration survives.
- `impl.entando`: `migration.host.min-level` = `migration.rewrite` (8 > 5) and
  `migration.host.shell-takeover-required` = y; participant floor 4 as well.
- `impl.opencomponents`: `migration.participant.thirdparty-unmodified-viable` = n,
  `migration.participant.legacy-no-build-viable` = n,
  `migration.participant.deployment-change-required` = y ("registry publish"), and
  `framework.same-framework-major-coexistence` = `?`, which never satisfies a hard
  requirement (REQ-MATRIX-05). Excluded on both hard bindings.

Survivors, per configuration, with the coexistence and independence cells re-checked:

- **`family.virtualized-rehosting`**, HTML-entry configuration.
  `impl.wujie`: `migration.participant.min-level` = `migration.trivial-adaptation` (1),
  `thirdparty-unmodified-viable` = y, `legacy-no-build-viable` = y,
  `source-modification-required` = n, `deployment.host-rebuild-required` = n,
  `ownership.deploy-schedule-ownership` = y,
  `framework.same-framework-major-coexistence` = y,
  `runtime.concurrent-participants` = y. No condition attached: this member satisfies the
  hard set outright.
  `impl.micro-app-jd`: floor 1, but `thirdparty-unmodified-viable` = c ("fetchable entry,
  CORS, sandbox tolerance; if already true, host-side work alone suffices"),
  `legacy-no-build-viable` = c ("with-sandbox breaks implicit cross-script globals typical
  of legacy code"), `source-modification-required` = c ("global-leakage or router-base
  issues can force edits despite zero-mod marketing"). Retained with all three conditions
  attached, never read as satisfied.
  `impl.web-fragments` client reframing mode: floor 1, `thirdparty-unmodified-viable` = y,
  `legacy-no-build-viable` = y, coexistence y. Retained with the mode condition
  (families.md 6.3 dual mapping).
- **`family.document-embedding`**, embed-only posture.
  iframe-composition (practice unit): floor 1, `legacy-no-build-viable` = y, coexistence y,
  host floor `migration.integration-adapter` (2);
  `migration.participant.thirdparty-unmodified-viable` = c, "participant must not forbid
  framing; X-Frame-Options and frame-ancestors are participant-controlled" (the admission
  condition, Model finding 6).
  `impl.luigi` embed-only: `thirdparty-unmodified-viable` = y,
  `legacy-no-build-viable` = y, coexistence y, `migration.host.min-level` =
  `migration.integration-adapter` on the luigi-container branch (2 <= 5), no shell takeover.
- **`family.server-fragment-assembly`**, host-built adapter configuration.
  `impl.podium` (floor 2): `thirdparty-unmodified-viable` = c, "no URL-only participation;
  the integrating team must build a wrapper podlet fronting the untouched app", which is
  precisely host-payable level-2 work; `deployment-change-required` = c.
  server-side-fragment-composition (floor 2): `thirdparty-unmodified-viable` = c, "SSI can
  include any reachable endpoint verbatim (full-page markup and trust problems aside)".
  edge-side-composition (floor 1): `thirdparty-unmodified-viable` = c, "only if an existing
  URL already returns fragment-suitable HTML; otherwise fragment endpoints need owner
  action". Coexistence cells are c/c/c on the same-major atom, retained with their
  conditions; `migration.host.new-infra-tier-required` = y for all three is a cost, not an
  elimination (`constraint.no-new-infra-tier` unbound, `rule.unanswered-inert`).
- **`family.custom-element-composition`**, host-built element-wrap configuration.
  web-components-composition (practice unit): `migration.participant.min-level` =
  `migration.integration-adapter` (2), `legacy-no-build-viable` = y,
  `source-modification-required` = n, host floor 1; conditions:
  `migration.participant.bootstrap-change-required` = c, "avoidable when a separate wrapper
  entry mounts the app; apps that auto-boot into document.body need entry changes", and
  `composition.phase.deploy-unit-per-participant` = c, "yes under the MFE pairing (per-team
  bundle URLs)". Coexistence c. `impl.entando` excluded above.

Engine-answered guards: `constraint.installable-today` (`unit.availability.installable-today`
= y uniformly) and `constraint.code-ownership` (`ownership.code-boundary-ownership` = y
uniformly) are satisfied without spending a question (questions.md section 7).

### 4.7 E7 `engine.step.rank-family`

Status assignment per report-design.md section 5. `family.virtualized-rehosting` satisfies
the hard set through `impl.wujie` with no condition attached, so it is
`status.match.viable` (meaningful preference and operational costs remain: sandbox execution
tax, damping-only trust ceiling, `deps.duplicated`, single-maintainer stewardship). The other
three satisfy the hard set only under stated conditions and are therefore
`status.match.conditional`, each with its condition printed.

`engine.rule.candidate-order`, applied literally:

1. **`family.virtualized-rehosting`** [viable], HTML-entry members. Rule 1 places it first:
   viable outranks conditional. Violated strong preferences: none.
   `constraint.seamless-ux` cells `ux.natural-layout-flow` / `ux.body-portal-compat` /
   `ux.overlay-viewport-escape` / `ux.cross-boundary-focus-mgmt` = y/y/c/c for wujie and
   y/y/y/y for micro-app-jd; `constraint.bounded-exit`
   (`migration.exit.participants-standalone`) = y/y/y.
2. **`family.custom-element-composition`** [conditional]. Rules 1 to 3 tie it with entry 3;
   violated strong preferences: none (seamless-ux y/c/y/y; bounded-exit c, "an element
   bundle is a library, not an app; a one-line harness page runs it standalone").
3. **`family.server-fragment-assembly`** [conditional]. Violated strong preferences: none
   (seamless-ux y/y/y/y on all three retained members; bounded-exit c on all three).
4. **`family.document-embedding`** [conditional]. One violated `class.strong-preference`
   binding, `constraint.seamless-ux`: `ux.natural-layout-flow` = n for iframe-composition
   and c for luigi ("iframe mode is a fixed rectangle with inner scrolling"),
   `ux.overlay-viewport-escape` = n / c, `ux.cross-boundary-focus-mgmt` = n / `?`. Reported
   as the explicit tradeoff the answer already declared compromisable. Bounded-exit y/y.

Ordering disclosure duty: entries 2 and 3 are tied by rules 1 to 3 and separated only by
rule 4 (lexicographic candidate id, `family.custom-element-composition` <
`family.server-fragment-assembly`), so the report must state that their order is not
meaningful. Entry 4 sits last strictly by rule 2. **This ordering is what the rule set
produces and it is wrong on the merits**: it ranks two shared-realm families and one
simulated-realm family above the browser-boundary family for a canonical acquisition, purely
because document embedding is the only survivor honest enough to score `n` on a UX
preference the user marked compromisable, and because the two constraints the model itself
names as the discriminator here are unreachable from an acquisition path. See Model
findings 1 and 2; the fixture is not patched (REQ-ORCH-11).

Fit flags, all four candidates: `fit.architectural` holds (hard set satisfied on cells);
`fit.organizational` holds (unmodified participant, independent cadence, no governance
demand: `coordination.shared-dependency-governance` = n for every retained member);
`fit.operational` holds, with the operating cost differing sharply and disclosed
(virtualized: sandbox fidelity maintenance, `performance.sandbox-execution-tax`;
server-fragment: `migration.host.new-infra-tier-required` = y plus request-time fanout;
document-embedding: seam engineering, `ux.host-overlay-protocol` = n for
iframe-composition; custom-element: every operational concern adopter-built,
`ux.builtin-loading-ui` = n and `ux.builtin-error-fallback-ui` = n). `fit.transition-dependent`
is false for all four: no supporting binding originates in a `state.target` slot.

### 4.8 E8 `engine.step.dominance`

Active: `dominance.html-entry-at-low-ceiling` (condition: rank 4 bound maxLevel <= 2 for
`participant:expenses`). Within `family.virtualized-rehosting` the HTML-entry members
dominate the bootstrap-lineage member, so no stage-2 question discriminates
`impl.qiankun` for this participant; qiankun is independently excluded by the ceiling, so
the rule is disclosed as active-moot. Inactive, with the failing condition named:
`dominance.fused-baselines-over-mfe` (`derive.single-coordinated-team` never fired),
`dominance.route-partition-over-coresident-runtimes` (rank 3 answered yes),
`dominance.browser-boundary-over-simulated-realm` (`constraint.distinct-principal` not bound
and not reachable, Model finding 1), `dominance.fusion-subsumes-drift-and-dedup` (no
atomic-release answer), `dominance.static-subsumes-infra-tier` (no static-hosting answer).

### 4.9 E9 next-question and emission shape

Askable with nonzero effect over S = 4 families:

| Candidate q | guaranteed | expected class | reach / what a hard answer removes |
|---|---|---|---|
| `question.ux.chrome-persistence` | 0 | common (host chrome in a one-experience product) | `ux.persistent-shared-chrome` = n for podium and edge-side-composition, c for server-side-fragment-composition: prunes the classic fragment members and can empty `family.server-fragment-assembly` |
| `question.failure.containment` | 0 | plausible (topology.md 2.4 semi-trusted boundary) | eliminates `family.custom-element-composition` (`isolation.lifecycle.reclaim` = n) and `family.server-fragment-assembly` (post-mount-exception n, recovery n); unlocks the main-thread and css follow-ups and the memory-budget cost note |
| `question.orchestration.appetite` | 0 | plausible | hard `constraint.no-strategy-runtime` (`runtime.shared-runtime-library` = n) eliminates `family.virtualized-rehosting` entirely (luigi y, wujie y, micro-app-jd y, web-fragments y) and retains iframe-composition, web-components-composition, edge-side-composition |
| `question.delivery.server-capacity` | 0 | rare (200-engineer platform org) | hard static-hosting eliminates `family.server-fragment-assembly` |
| `question.contracts.sync-calls` | 0 | rare | hard eliminates `family.document-embedding` (`contracts.sync-calls` = c for iframe-composition and luigi, serialized boundary) |
| `question.deps.payload-budget` | 0 | rare (no budget fact) | hard `constraint.payload-dedup` empties the space (`performance.shared-dependency-dedup` = n for every survivor) and produces a gap record, never a silent downgrade |
| `constraint.a11y-continuity` facet of rank 10 | 0 | plausible | `ux.screenreader-continuity` = c for iframe-composition, luigi and wujie, y elsewhere: conditions the two document-embedding members and wujie |

Suppressed as zero-gain (relevance law, question-graph.md 1.4.3):
`question.coordination.upgrade-train` (every retained member is `deps.duplicated` and
`coordination.shared-dependency-governance` = n, so no answer changes any output),
`question.deps.major-coexistence` (already derived, R3),
`question.migration.strangler` (`migration.strangler.incremental` near-uniform y among
survivors), `question.roster.runtime-admission` and `question.host.negotiability` (unlock
conditions absent), the whole stage-2b operability block (no edition-splitting candidate
survives and `derive.b2b-chain` did not fire). Unreachable rather than suppressed:
`question.trust.malicious-participant` and `question.guard.verbatim-bytes` (Model finding 1).

argmax: guaranteed gain ties at 0 for every candidate, so the tie-break is expected class,
and `question.ux.chrome-persistence` is asked next (common; largest class-setting reach).
Before emission the engine also asks `question.trajectory.no-transition-outcome`, which is
mandatory whenever a `fit.transition-dependent` slot entry is pending (question-graph.md
1.3); the brief's own guardrail supplies the answer, and 4.11 records it.

The fixture supplies no further answers, so emission is `rule.conditional-output` shape 2
(conditional): the questions above are named in `unresolvedQuestions` with the answer that
would overturn each recommendation, and the same records feed `counterfactuals` (4.12).

### 4.10 E10 to E12: stage 2 and the availability lens

Members evaluated in their surviving configurations only; no implementation-stage question
is answered, so the 2.13 lens constraints stay inert and availability is pure annotation
(`engine.rule.availability-lens`).

| Candidate | Config | Availability (independent factor) | Notable lens facts |
|---|---|---|---|
| `impl.wujie` | HTML entry, hidden same-origin iframe realm | `avail.available` (2.1.0, 2026-06) | `stable-line-shipped` y, `single-current-line` y, `org-steward` y (Tencent), `multi-maintainer` n, `adoption-scale-10k` n; `migration.permanent-viability` c |
| `impl.micro-app-jd` | HTML entry, proxy fake window | `avail.available-immature` (perpetual RC, no 1.0 in 3+ years) | `stable-line-shipped` n, `single-current-line` n, `forced-remigration-pending` c ("API shifts between rc releases") |
| `impl.web-fragments` | client reframing | `avail.available-immature` (beta 0.8.2, cadence stalled) | `migration.permanent-viability` **n**; dependency reuse and ShadowRealm are `avail.future-roadmap` and satisfy no binding (REQ-AVAIL-01) |
| iframe-composition | embed-only (practice unit, family substance) | n/a (browser primitive; `unit.availability.stable-line-shipped` na) | `migration.permanent-viability` y; every operational concern (geometry protocol, messaging, loading and error UI) is host-built and priced in tradeoffs |
| `impl.luigi` | embed-only iframe mode | `avail.available` (core 2.31.0, container 1.7.x) | `org-steward` y (SAP), `multi-maintainer` y, `stable-line-shipped` y; `migration.permanent-viability` y; `ux.screenreader-continuity` c (per-frame title labeling) |
| `impl.podium` | host-built wrapper podlet | `avail.available` (v5, 5.4.7 2026-07) | `multi-maintainer` ?, `adoption-scale-10k` n, `migration.host.new-infra-tier-required` y |
| server-side-fragment-composition, edge-side-composition | SSI branch / ESI branch (practice units) | n/a | edge-side `forced-remigration-pending` c ("Akamai Property Manager ESI deprecated in the 2026-06 rule format") |
| web-components-composition | host-built element wrap (practice unit) | n/a | shared-realm interference exposure; `isolation.failure.post-mount-exception` c, `isolation.lifecycle.reclaim` n |

Excluded at stage 2 with origin chains: `impl.hyperfrontend` and `impl.qiankun` (participant
floor `migration.bootstrap-change` > ceiling 2; origin
`derive.unmodifiable-participant-floor`), `impl.luigi` full-client configuration (same),
`impl.opencomponents` (`thirdparty-unmodified-viable` n plus
`deployment-change-required` y plus coexistence `?`; origin
`derive.unmodifiable-participant-floor` and `derive.mixed-majors-present`),
`impl.entando` and `impl.piral` (host floor above `migration.moderate-refactor`; origin
answer:question.migration.host-ceiling), `impl.single-spa`, `impl.module-federation`,
`impl.native-federation` (participant floors 4/3/4), `impl.bit`,
`impl.commercetools-frontend`, `impl.nextjs-multi-zones`,
`impl.cloudflare-workers-microfrontends` (family-stage exclusions),
`impl.zephyr-cloud` and `impl.picard-js` (layers over eliminated families, families.md 6.1).

E11 stage-edition produces nothing: no operability question is answered, and every retained
unit scores `unit.editions.commercial-tier` = n with `unit.editions.oss-self-sufficient` = y
(luigi, wujie, micro-app-jd, web-fragments, podium). edge-side-composition carries
`commercial-tier` = y through CDN ESI contracts, so `trust.commercial` is reachable in
principle, but nothing selects it: commercial editions are chosen only in combination with a
managed answer on `question.edition.operability.managed-service-preference`, which is
unasked. No availability exclusions (nothing recommended is `avail.deprecated` or
`avail.inactive`); `avail.available-immature` is an annotation, not a downgrade. No
`status.match.future-potential` record exists: `impl.hyperfrontend.enterprise` is
`avail.announced-planned`, and its unit is already excluded at family stage, so REQ-AVAIL-02
has nothing to pair and `trust.hfe-future` is not exercised.

### 4.11 E13 `engine.step.dual-output`

- `slots.bestToday`: the 4.7 ordering with its tie disclosure and its per-candidate
  conditions. Always produced (REQ-STATE-02). It depends on no aspiration: every supporting
  binding carries `slot: state.current` (guardrail 2).
- `slots.bestAfterTransition`: the single-stack target is not credible (4.4), so the slot
  carries the `rule.aspiration-warning` conditional rather than a recommendation:
  `family.module-graph-federation` at `status.match.conditional`, `fit.transition-dependent`
  true, `dependsOnTransitions: [{dimension: dimension.adaptation-floor, confidence:
  transition.confidence.planned-unapproved}]`, missing signals listed (`buyin.budget`,
  `buyin.timeline`, `buyin.staffing`; `buyin.executive-sponsorship` partial). The warning
  states the actual enabling change honestly: it is not stack alignment that readmits the
  family but the participant ceiling rising to `migration.bundler-change`, and the stated
  `transition.cost` for that is `migration.framework-migration` to `migration.rewrite`
  (levels 7 to 8), which is the earn-out and a funded rewrite, not a stack preference.
- `question.trajectory.no-transition-outcome`, asked before this slot is emitted, is answered
  from the fixture: the integration must remain acceptable permanently. Cell answer, per
  candidate rather than per report: `migration.permanent-viability` = y for
  iframe-composition and `impl.luigi`; c for `impl.wujie` ("the 2024-2025 stall, bus-factor
  risk, and fork history temper permanence") and `impl.micro-app-jd`; **n for
  `impl.web-fragments`**; y for podium, server-side-fragment-composition and
  web-components-composition; c for edge-side-composition. So the today architecture survives
  the 3x probe outright only in `family.document-embedding`, the family the ordering places
  last, and the probe's answer binds nothing that could act on that (Model finding 4).
- `rule.dual-slot-divergence`: the slots differ, and the causing septet record is cited (the
  `dimension.adaptation-floor` row: current two stacks, target one stack, confidence 3,
  authority voiced, horizon unstated).

### 4.12 E14 to E16: gaps, relaxation, counterfactuals

`gapRecords`: empty (the survivor set is non-empty at both stages and no gap-trigger
constraint, `constraint.artifact-integrity` or `constraint.rsc-federation`, is bound).
`relaxationOffers`: empty (offers exist only when the hard set empties a space; REQ-GAP-01
not triggered). `counterfactuals`, generated from the four sources of decision-engine.md
section 6:

1. (source 1, relaxation ledger row for `constraint.participant-modification-ceiling`,
   maxLevel <= 2) Raise the ceiling to `migration.bundler-change` (3):
   `family.module-graph-federation` returns through `impl.module-federation` and the
   import-map practice. Raise it to `migration.bootstrap-change` (4):
   `family.lifecycle-orchestration` returns (`impl.single-spa`), plus the SDK and
   bootstrap postures inside the surviving families (`impl.qiankun`,
   `impl.hyperfrontend`, `impl.luigi` full-client). Raise it to `migration.major-refactor`
   (6) or above: the baselines re-enter via extraction, which is also the only route to the
   consolidation the CTO describes. This is the earn-out counterfactual guardrail 4 demands.
   Refs: constraints.md 6.1 row, families.md 3.4 and 3.5 migration fields.
2. (source 1, ledger row for `constraint.host-modification-ceiling`) Raise the host ceiling
   to `migration.major-refactor` (6): `impl.piral` re-enters. To `migration.rewrite` (8):
   `impl.entando` and `impl.commercetools-frontend` re-enter as platform overlays. Both are
   host-side and inside the host owner's authority, which is what makes them offerable at
   all.
3. (source 3, unanswered eliminating answers, the shape-2 emission set) A hard
   `question.granularity.single-screen` **no** (page seams acceptable) is the highest-value
   counterfactual in this fixture: it readmits `family.route-partition` at participant floor
   `migration.trivial-adaptation` with `migration.permanent-viability` = y and
   `deployment.host-rebuild-required` = n, fires
   `dominance.route-partition-over-coresident-runtimes`, and prunes the entire co-residence
   cluster. A hard `question.failure.containment` drops
   `family.custom-element-composition` and `family.server-fragment-assembly`. A hard
   `question.orchestration.appetite` (nothing strategy-owned) drops
   `family.virtualized-rehosting` entirely. A hard `question.contracts.sync-calls` drops
   `family.document-embedding`. A hard `question.ux.chrome-persistence` drops the classic
   fragment members. A hard `constraint.payload-dedup` empties the space and produces a gap
   record with its relaxation path, never a silent downgrade. Each is recorded as
   `{candidate, wouldBecome: status.match.incompatible, if: <answer>, refs}`.
4. (source 3, preference re-confirmation, `rule.relaxation-ordering` band 1) If
   `constraint.seamless-ux` is re-confirmed at `class.weak-preference` rather than
   `class.strong-preference` (the answer text says "explicitly compromisable at launch"),
   `family.document-embedding` carries zero violated strong preferences, ties with entries 2
   and 3 at rule 2, and the whole conditional block becomes a rule-4 tie. The fixture's own
   marking is kept (REQ-ORCH-11); the sensitivity is disclosed instead.
5. (source 2, dominance conditions) Withdrawing the maxLevel <= 2 condition dissolves
   `dominance.html-entry-at-low-ceiling` and unlocks qiankun discrimination inside
   `family.virtualized-rehosting`.
6. (source 4, credibility flip) If the single-stack transition reaches
   `transition.confidence.teams-committed` (5), or `leadership-approved` (4) plus
   `buyin.budget` and one of `buyin.timeline` / `buyin.staffing`, and an in-horizon
   `transition.horizon` is stated, re-run: `slots.bestAfterTransition` gains
   `family.module-graph-federation` as a genuine candidate rather than a warning. Refs: the
   septet record, the buy-in records, `predicate.target-credible`.

Symmetry duty satisfied: every family excluded by a single hard binding has a counterfactual
(baselines and route-partition in item 3, module-graph-federation and
lifecycle-orchestration in item 1), and every recommended candidate has the cheapest answer
that would overturn it (item 3).

### 4.13 E17 emission, outcome class, derivation sample

Outcome class: **`trust.other-oss`**. The strongest current candidates are non-HyperFrontend
OSS units (`impl.wujie`, `impl.luigi`, `impl.podium`, `impl.micro-app-jd`,
`impl.web-fragments`) and vendor-neutral browser practice (iframe-composition,
web-components-composition, the SSI and ESI practices); `derive.single-coordinated-team`
never fired and every surviving family is an MFE family, so the vocabulary does not land on
`trust.no-mfe` (decision-engine.md section 7 rows). `impl.hyperfrontend` sits in
`excludedStrategies` with its origin chain and its counterfactual: the sponsor's elimination
is stated, not steered around (REQ-MISSION-01).

```text
Recommendation: family.virtualized-rehosting (HTML entry)          [status: viable]
Recommendation: family.custom-element-composition (element wrap)   [status: conditional]  (tied)
Recommendation: family.server-fragment-assembly (adapter endpoint) [status: conditional]  (tied)
Recommendation: family.document-embedding (embed-only)             [status: conditional]

Why:
+ acquired product integrates unmodified            (migration.participant.min-level = migration.trivial-adaptation; migration.participant.thirdparty-unmodified-viable = y for wujie and luigi)
+ survives independent participant releases         (deployment.host-rebuild-required = n; ownership.deploy-schedule-ownership = y)
+ incompatible stacks coexist indefinitely          (framework.same-framework-major-coexistence = y for the embedding and virtualized members; c for the fragment and element members)
+ no standing cross-team governance required        (coordination.shared-dependency-governance = n)

Tradeoffs accepted:
~ virtualized: sandbox tax, damping-only trust      (performance.sandbox-execution-tax; trust.interference-damped, never a security boundary)
~ element wrap and fragments: foreign code in the host realm  (isolation.failure.post-mount-exception = c / n; isolation.lifecycle.reclaim = n)
~ fragments: a new infrastructure tier              (migration.host.new-infra-tier-required = y)
~ document-embedding: seam engineering vs one-document flow  (ux.natural-layout-flow = n; constraint.seamless-ux violated at strong, declared compromisable)

Derived from:
question.deploy.independence -> "no shared release train"       (constraint.independent-deploy)
ownership.host-unmodifiable-participant -> derive.unmodifiable-participant-floor
  -> constraint.participant-modification-ceiling(expenses, maxLevel=2, payableBy=host)
question.granularity.single-screen -> "one screen, two owners"  (constraint.single-screen-mixing)
question.migration.host-ceiling -> "bounded refactor on our side" (constraint.host-modification-ceiling, maxLevel=5)
state.target(single stack) -> predicate.target-credible FAIL    (rule.aspiration-warning)
```

### 4.14 Guardrail verification (brief section 3)

| Guardrail | Result |
|---|---|
| No recommended strategy modifies the acquired application's source, build, bootstrap or release process; only host-executable work at `migration.integration-adapter` depth or below | **PASS** at E6 and E10. Every retained configuration is level 1 or host-paid level 2; every configuration demanding participant-side source, build or bootstrap change is excluded per configuration with its origin chain (`impl.qiankun`, `impl.hyperfrontend`, `impl.luigi` full-client, `impl.single-spa`, `impl.piral`, `impl.module-federation`, `impl.native-federation`, import-map-architectures, `impl.entando`, `impl.opencomponents`). The three `c` cells that could still reach the participant (`micro-app-jd` `migration.source-modification-required`, `web-components-composition` `bootstrap-change-required`, `server-side-fragment-composition` `source-modification-required`) are retained only with their conditions attached and never read as satisfied (REQ-MATRIX-05). Serving-configuration work is outside the four items the guardrail names but is not host-executable either; it is disclosed as an admission condition (Model finding 6) |
| `recommendation.best-today` independent of the single-stack aspiration; the aspiration appears only as a warning-annotated `fit.transition-dependent` conditional | **PASS** at E4 and E13. `predicate.target-credible` fails on two independent legs (ordinal 3 < 5; the level-4 path needs `buyin.budget`, absent), so `rule.no-target-satisfies-hard` keeps the target out of the current-state pass entirely; every `slots.bestToday` binding carries `slot: state.current`, and `fit.transition-dependent` is false on all four candidates. The aspiration surfaces only in `slots.bestAfterTransition` under `rule.aspiration-warning` with its missing signals named |
| The trace answers `question.trajectory.no-transition-outcome` | **PASS** at E9 and E13, asked before emission as question-graph.md 1.3 requires, and answered per candidate from `migration.permanent-viability`: y for iframe-composition, `impl.luigi`, `impl.podium`, server-side-fragment-composition and web-components-composition; c for `impl.wujie`, `impl.micro-app-jd` and edge-side-composition; n for `impl.web-fragments`. Qualification recorded, not waived: the probe binds nothing, so the model cannot act on its own answer, and the family that answers it cleanly is the one the ordering ranks last (Model finding 4) |
| Any elimination on migration grounds carries its counterfactual | **PASS** at E16 items 1 and 2: the participant ceiling's ledger row is walked ordinally to 3, 4 and 6 with the exact readmitted candidates, and the host ceiling's row to 6 and 8. REQ-Q-07 and migration.md section 5 satisfied |
| Consolidating into one codebase within the timeline is not an admissible outcome | **PASS** at E6, three times over: all five baseline families are excluded by `constraint.independent-deploy` (`deployment.host-rebuild-required` = y cells); they are independently excluded by the participant ceiling (floors `migration.major-refactor` 6 and `migration.framework-migration` 7 against maxLevel 2); and the stated `transition.cost` for consolidation is levels 7 to 8, which `engine.rule.horizon-select` prices against a first-integration horizon of two quarters. Consolidation appears only as counterfactual item 1 at ceiling 6+ |
| Outcome class inside the brief's allowed set | **PASS**: `trust.other-oss`. `trust.hfe-future` is not exercised (no `status.match.future-potential` record exists to pair, 4.10); `trust.commercial` is reachable but unselected; `trust.no-mfe` is correctly not produced, since the baselines are eliminated rather than recommended |

No guardrail fails. The findings below are model defects the trace surfaced, not guardrail
failures, and none of them was fixed by editing this fixture (REQ-ORCH-11).

### 4.15 Model findings

Each is diagnosed to its failing layer per REQ-ORCH-08 (evidence, interpretation, taxonomy,
or logic) with the proposed fix.

1. **An acquisition path cannot reach either constraint the model names as this scenario's
   discriminator** (layer: logic, in the question graph's edge set). topology.md 2.4 states
   the acquisition boundary is "technically foreign" and must be treated "as semi-trusted
   until convergence is real", and state-transition.md section 10 separates
   `family.document-embedding` from `family.virtualized-rehosting` explicitly "by trust
   ceiling and `constraint.verbatim-participant-bytes`". Neither is reachable here.
   `question.trust.malicious-participant` has exactly three in-edges (question-graph.md 1.1
   and 1.3): external participant, plugin authors, b2b hop. `ownership.acquired-participant`
   is none of them, so `constraint.distinct-principal` and `constraint.interference-damping`
   are both unbindable for an acquired participant. `question.guard.verbatim-bytes` unlocks
   only from `derive.regulated-release` or a hard rank 5, so
   `constraint.verbatim-participant-bytes` is unbindable too. Consequence in this trace: E7
   has no way to separate "the foreign codebase executes in our realm"
   (custom-element, server-fragment), "damped simulation over transformed bytes"
   (virtualized: `ownership.participant-bytes-verbatim` = n for wujie, micro-app-jd,
   web-fragments) and "browser-enforced boundary" (document-embedding), and the three land in
   a rules-2-to-4 tie. Proposed fix: add an `edge.unlocks` from
   `ownership.acquired-participant` (and from `ownership.host-unmodifiable-participant`) to
   `question.trust.malicious-participant` in confirm mode, seeded at plausibility class
   "plausible" by the acquisition prior, and add `constraint.interference-damping` plus
   `constraint.verbatim-participant-bytes` (both confirm, both preference-tendency) to the
   `topology.acquisition` row of constraints.md 2.15. Confirm mode, not hard tendency: the
   topology says semi-trusted, and a prior must never eliminate.
2. **`engine.rule.candidate-order` has no term for boundary strength or condition
   robustness, so a disclosed-arbitrary tiebreak decides the headline of a canonical
   fixture** (layer: logic). With the hard set satisfied by four families and only one bound
   strong preference discriminating them, rule 1 separates one candidate, rule 2 demotes the
   single candidate that violates `constraint.seamless-ux`, rule 3 is empty (no weak
   preference is bound), and rule 4 orders the remaining pair lexicographically. The result
   ranks two shared-realm families above the browser-boundary family for an acquisition,
   which contradicts topology.md 2.4's own family implications. The rule set was followed
   exactly; the defect is in the rules. Proposed fix, in order of preference: (a) require
   E7 to emit a rule-4 tie as an unordered *set* with the discriminating unanswered question
   named beside it, rather than as an order the report renders as a ranking; (b) add a
   rule 2.5 ordering by the count of *unbound* constraints each candidate would still satisfy
   at their hard form, disclosed as counts of named constraints, which stays inside
   `engine.rule.no-scores` and would place the browser boundary first here on
   `constraint.fault-containment`, `constraint.distinct-principal` and
   `constraint.css-containment`; (c) let an answer that declares a preference compromisable
   record a `compromisable` flag that rule 2 reads as a half-step, disclosed. Fixes (a) and
   (b) together are the recommendation; (c) alone would hide the problem.
3. **`constraint.framework-major-coexistence` and `derive.mixed-majors-present` cover
   same-framework major skew, not different-stack coexistence, which is this fixture's actual
   fact** (layer: taxonomy). The derive premise reads "current estate runs incompatible majors
   of one framework"; the Situation says two different technology stacks. The constraint binds
   `framework.same-framework-major-coexistence` and `runtime.side-by-side-versions`, while
   the matrix carries a separate, unbound atom `framework.mixed-frameworks-one-page` (y for
   iframe-composition, luigi, wujie, micro-app-jd, web-fragments, web-components-composition,
   podium, edge-side-composition, server-side-fragment-composition) plus
   `framework.per-team-framework-autonomy`. This is load-bearing: reading the mixed-stack
   fact through the same-major atom attaches `c` conditions to
   `family.server-fragment-assembly` and `family.custom-element-composition` and contributes
   a `?`-based exclusion for `impl.opencomponents`, where the actually relevant atom is `y`
   for all of them. It also leaves topology.md 2.4's pressure "framework independence
   (incompatible stacks must coexist)" unverifiable against its own cells. Proposed fix: give
   `constraint.framework-major-coexistence` per-subject deciding-atom semantics, binding
   `framework.mixed-frameworks-one-page` and `framework.per-team-framework-autonomy` for a
   mixed-stack subject and the same-major atoms for a version-skew subject (the same shape as
   third-party-vendor-widget.md finding 1's per-granularity atoms), and restate the derive
   premise as "incompatible stacks, or incompatible majors of one framework, with alignment
   unfunded".
4. **`question.trajectory.no-transition-outcome` is mandatory but binds nothing, and its
   natural attribute sits behind the stage firewall** (layer: logic). question-graph.md 1.3
   makes the probe mandatory before any `fit.transition-dependent` emission; questions.md
   section 4 gives it no binding. `migration.permanent-viability` is bound only by
   `constraint.no-forced-remigration`, which is `scope.implementation` (constraints.md 2.13)
   and reachable only through `question.impl.stewardship-floor` at stage 2, and
   `engine.rule.stage-firewall` refuses a stage-1 binding of an implementation-scope
   constraint. So the keystone robustness probe of the whole state layer cannot rank or
   condition anything at the stage where it is asked. Consequence here:
   `impl.web-fragments` (`migration.permanent-viability` = n) sits inside the top-ranked
   family unmarked, and `impl.wujie` and `impl.micro-app-jd` carry their permanence caveats
   as annotations only. Proposed fix: split `constraint.no-forced-remigration` so that the
   `migration.permanent-viability` atom carries `scope.family` while
   `migration.forced-remigration-pending` stays `scope.implementation`, and bind the family
   half from `question.trajectory.no-transition-outcome` at `class.strong-preference`
   (ceiling hard when the user states permanence as a requirement rather than a hope).
5. **`impl.opencomponents` is carried as a survivor in decision-engine.md 5.6 and 5.10 while
   its own deciding cells exclude it** (layer: evidence). `thirdparty-unmodified-viable` = n,
   `legacy-no-build-viable` = n, `deployment-change-required` = y ("registry publish"), and
   `framework.same-framework-major-coexistence` = `?`, which 5.6 itself calls "never read as
   satisfied" before listing the unit anyway. This trace excludes it. No fix beyond
   correcting that walk; the engine rule (`c` retains with condition, `?` and `na` never
   satisfy) is already right.
6. **Admission-condition visibility for level-1 participants** (layer: evidence; a checkable
   fact is missing). Every level-1 candidate's admissibility rests on a participant-serving
   fact the model has no atom for: iframe-composition's
   `migration.participant.thirdparty-unmodified-viable` = c, "X-Frame-Options and
   frame-ancestors are participant-controlled", and micro-app-jd's, "fetchable entry, CORS,
   sandbox tolerance; if already true, host-side work alone suffices". Meanwhile
   `derive.unmodifiable-participant-floor` binds the ceiling `payableBy=host`, and
   migration.md section 2 makes level 1's precondition "deploy authority over the
   participant's serving infrastructure", which the host does not hold. The pair silently
   admits level-1 work the host cannot execute. The third-party fixture was protected by its
   Situation ("the vendor already ships an embeddable surface"); this Situation states no such
   thing. Proposed fix: promote the precondition to a checked fact
   (`migration.participant.serving-config-host-controllable`) asked once inside the rank-4
   capability-preconditions composite, which migration.md section 8 already owns, and make
   `derive.unmodifiable-participant-floor` set `maxLevel` to
   `migration.integration-adapter` only when it holds. Until fixed, traces must carry the
   condition on the candidate, as 4.6 does.

### 4.16 Divergences from decision-engine.md section 5

decision-engine.md section 5.14 records the same guardrail verdicts and the same outcome
class, and its section 8 requires this trace to reproduce 5.6 to 5.12 or fault the
abstraction. It faults in six places; this trace is right in the first five and both walks
are wrong in the sixth.

| Divergence | Settlement |
|---|---|
| 5.7 assigns `status.match.viable` to `family.document-embedding` and `status.match.conditional` to `family.virtualized-rehosting` | Inverted. report-design.md section 5: conditional means the hard constraints are satisfied "only under a stated condition", and 3.2 makes `condition` mandatory for it. Document embedding survives only in the embed-only posture, with iframe-composition additionally carrying the framing-headers condition; `impl.wujie` satisfies the hard set with nothing attached (its `migration.participant.min-level` cell is `c` only because that row encodes its scale id in `condition`, matrix/README.md, not because the level is conditional). The third-party fixture assigns conditional on exactly this reading |
| 5.7 orders entry 1 above entry 2 "by rule 2" | Illegal as written: `engine.rule.candidate-order` rule 2 applies only "among equal status", and 5.7 applies it across a viable and a conditional. Under the corrected statuses the same candidate leads, legally, by rule 1 |
| 5.7 places `family.document-embedding` second | Not derivable. With three conditionals and one bound strong preference, rule 2 puts the two zero-violation conditionals ahead of it and rule 4 breaks their tie; document embedding is fourth. See Model finding 2 |
| 5.7 cites `ux.natural-layout-flow` = n "for hyperfrontend and iframe-composition" | `impl.hyperfrontend` was already excluded in 5.6, so it cannot supply a deciding cell. Among survivors the deciding cells are iframe-composition = n and luigi = c (iframe mode is a fixed rectangle) |
| 5.6 and 5.10 retain `impl.opencomponents` | Excluded here; Model finding 5 |
| 5.9 answers `question.trajectory.no-transition-outcome` with `migration.permanent-viability` = y "for iframe-composition and luigi" | Those are members of the family its own 5.7 ranks second, not of the family it ranks first. The probe must be answered per candidate; done in 4.11. Model finding 4 |
| 5.3 records `derive.no-cross-deploy-control` as not fired, "one side does control its own host" | The fact is about controlling the *other* party's deployment, which neither party can here. It fires, and only corroborates a constraint already bound by answer, so nothing downstream changes |
| 5.3 fires `derive.mixed-majors-present` on a two-different-stacks fact | Both walks do this; both are wrong in the same way, and the model needs the fix. Model finding 3 |

### 4.17 Regression expectations

Stable assertions any engine implementation must reproduce for this fixture:

- Outcome class `trust.other-oss`. Never `trust.hf-community`: `impl.hyperfrontend` must
  appear in `excludedStrategies` with origin `derive.unmodifiable-participant-floor`, the
  cells `migration.participant.min-level` = `migration.bootstrap-change` and
  `migration.participant.thirdparty-unmodified-viable` = n, and its readmission
  counterfactual at ceiling 4. Never `trust.no-mfe`: the baselines are eliminated, not
  recommended. Never `trust.hfe-future`: no `status.match.future-potential` record can exist
  while the unit is excluded at family stage.
- Eliminated families with rule ids: the five baselines by `constraint.independent-deploy`
  (`deployment.host-rebuild-required` = y) with `constraint.participant-modification-ceiling`
  as co-origin; `family.route-partition` by `constraint.single-screen-mixing`
  (`runtime.concurrent-participants` = n on all three members);
  `family.module-graph-federation` and `family.lifecycle-orchestration` by
  `constraint.participant-modification-ceiling`(maxLevel=2), with
  `constraint.host-modification-ceiling` as co-origin for `impl.piral`.
- Survivor set, exactly four families, each with its surviving configuration named:
  `family.virtualized-rehosting` (HTML entry: wujie, micro-app-jd, web-fragments client
  mode), `family.document-embedding` (embed-only: iframe-composition, luigi),
  `family.server-fragment-assembly` (host-built adapter: podium,
  server-side-fragment-composition, edge-side-composition), and
  `family.custom-element-composition` (host-built element wrap:
  web-components-composition). `impl.opencomponents`, `impl.qiankun`, `impl.entando` and
  `impl.luigi` full-client are excluded per configuration.
- Status assignment: `family.virtualized-rehosting` viable; the other three conditional,
  each printing its condition. Any implementation that emits `family.document-embedding`
  as viable has lost the mandatory-condition rule.
- Ordering: whatever order is emitted, the report must disclose that the rule-4 tie between
  `family.custom-element-composition` and `family.server-fragment-assembly` is not
  meaningful, and must name the unanswered questions that would break it
  (`question.failure.containment`, `question.ux.chrome-persistence`).
- `dominance.html-entry-at-low-ceiling` active and disclosed as moot; the other five
  dominance rules inactive with their failing conditions named.
- `slots.bestToday` produced with no `fit.transition-dependent` candidate;
  `slots.bestAfterTransition` produced as a `rule.aspiration-warning` conditional naming
  `family.module-graph-federation`, `transition.confidence.planned-unapproved`, and the
  missing signals `buyin.budget`, `buyin.timeline`, `buyin.staffing`.
  `question.trajectory.no-transition-outcome` asked before that slot is emitted.
- `gapRecords` and `relaxationOffers` both empty.
- Key counterfactuals: ceiling 3 reopens `family.module-graph-federation`; ceiling 4 reopens
  `family.lifecycle-orchestration` plus `impl.qiankun`, `impl.hyperfrontend` and
  `impl.luigi` full-client; ceiling 6+ reopens the baselines and is the only route to the
  consolidation the CTO describes; a single-screen **no** reopens
  `family.route-partition` and fires
  `dominance.route-partition-over-coresident-runtimes`; a hard
  `question.failure.containment` drops `family.custom-element-composition` and
  `family.server-fragment-assembly`; a hard `question.orchestration.appetite` drops
  `family.virtualized-rehosting`; a hard `constraint.payload-dedup` empties the space into a
  gap record rather than a downgrade; a credibility flip moves
  `family.module-graph-federation` from warning to candidate.
- Model findings 1 to 4 are open: a re-trace after any of those fixes lands is expected to
  change the 4.7 ordering (not the survivor set), and that change is the regression signal
  that the fix took effect.
