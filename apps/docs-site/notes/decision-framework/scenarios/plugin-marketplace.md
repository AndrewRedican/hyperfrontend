# Scenario: plugin-marketplace

Status: TRACED (2026-08-29).

## 1. Situation

We sell a project-management product used by about four thousand companies, built by roughly
sixty engineers who ship the whole product together twice a week. Today, when a customer
needs something custom, such as a timesheet panel or an industry-specific report, our
professional-services group writes it into the main codebase, and every one of those
customizations rides our release train forever. Our board has approved a different future: an
add-on marketplace where customers and outside software shops build extensions themselves,
publish them after our review, and have them appear inside the product for whoever installs
them, with none of it waiting on our releases. The platform group that will own this exists
as of last month: six engineers, funded for two years, with a director accountable for it and
a public target of opening the marketplace in twelve months. We cannot know today who will
write these add-ons or how good they will be; some authors will be one-person shops we never
talk to. Whatever they do, a broken or malicious add-on must not be able to take down a
customer's workspace or read data the customer did not grant it. We expect to review add-ons
before listing them and to pull a bad one quickly. The core product team keeps shipping twice
a week throughout; the marketplace work cannot slow them down.

## 2. Normalized inputs

Re-normalized 2026-08-29 against the canonical ids of
[constraints.md](../model/constraints.md), [questions.md](../model/questions.md),
[question-graph.md](../model/question-graph.md), [topology.md](../model/topology.md),
[migration.md](../model/migration.md) and
[state-transition.md](../model/state-transition.md). Changes: every input now names its
constraint binding, class, scope, state slot and derivation route; the single
"addition/update without host rebuild" row splits into `constraint.independent-deploy`
(the update half, `deployment.host-rebuild-required`=n) and
`constraint.no-host-change-per-participant` (the addition half, family-scope atom
`deployment.new-participant-host-change`=n) because the model carries no single id for the
pair; `constraint.runtime-roster-change` is held at `prior-unconfirmed` rather than hard
(the Situation never requires admission inside a running document and
`derive.plugin-admission` derives it confirm-mode); the contract requirement binds
`constraint.explicit-drift-surfacing` on its descriptor and versioning atoms only, not on
the connect-gate atoms (the Situation states a compatibility policy, not a machine-readable
connect-time refusal; REQ-Q-05, questions.md 5.3); the twelve-month opening is reclassified
from an input to the governing horizon per `engine.rule.horizon-select`; "core cadence
undisturbed" becomes a co-origin of the admission binding rather than a constraint of its
own; the review/delisting/monitoring row resolves to `scope.edition` ids; values otherwise
unchanged.

| Input | Canonical binding | Class / marking |
|---|---|---|
| Topology label, current (host/professional-services boundary) | `topology.coordinated-team` | label (informational; facts govern) |
| Topology label, target (host/add-on boundary) | `topology.plugin-ecosystem` | label (informational; facts govern) |
| One codebase, one twice-weekly train, ~60 engineers, no external participants today | `ownership.single-team` + `ownership.multi-team-single-repo`; premises of `derive.single-coordinated-team` | observed facts, `state.current` |
| `ownership.external-participant` = yes; open-ended, unknown authors | premise of `derive.external-principal` (confirm) and of `derive.plugin-admission` | observed fact, `state.target` |
| `ownership.no-cross-deployment-control` = yes | premise of `derive.no-cross-deploy-control` and `derive.plugin-admission` | observed fact, `state.target` |
| Participants unknown at host ship time | second premise of `derive.plugin-admission` | observed fact, `state.target` |
| Add-on **update** reaches users without a host rebuild or redeploy | `constraint.independent-deploy` (global) via `derive.plugin-admission` / `derive.no-cross-deploy-control` | `class.hard-constraint` (entailed), `state.target` |
| Add-on **addition** reaches users without a host rebuild or redeploy; the core train is never the bottleneck | `constraint.no-host-change-per-participant` (global, family-scope atom `deployment.new-participant-host-change`) via `question.roster.runtime-admission` | `class.hard-constraint` (explicit answer, composing over `derive.plugin-admission`'s strong default), `state.target` |
| Add-ons appear and disappear per installing customer (no requirement that this happen inside a running document) | `constraint.runtime-roster-change` via `derive.plugin-admission` (confirm mode) | `prior-unconfirmed`, ranks only; open in `unresolvedQuestions` |
| No central-owner-free onboarding required (review gate is deliberate) | `ownership.onboarding-without-central-owner` atom of `constraint.no-host-change-per-participant`, `scope.implementation` | answered "not required": `class.irrelevant-by-default` |
| Per-add-on failure containment (workspace survives a broken add-on) | `constraint.fault-containment` via `question.failure.containment`, confirming `derive.plugin-admission` | `class.hard-constraint` |
| Data access only as granted by the installing customer; hostile authors assumed | `constraint.distinct-principal` via `question.trust.malicious-participant`, confirming `derive.external-principal` | `class.hard-constraint` |
| Stable, versioned, documented host contract with a compatibility policy | `constraint.explicit-drift-surfacing` on `contracts.formal-descriptor` + `contracts.contract-versioned`, `scope.implementation`; escalated from `derive.many-party-drift` (strong) | `class.hard-constraint` on those two atoms only |
| In-product UI extension (add-ons appear inside the product) | `constraint.single-screen-mixing` via `question.granularity.single-screen` (product-shape fact) | `class.hard-constraint` |
| `migration.appetite`, add-on authors = `migration.greenfield` (0) | `constraint.participant-modification-ceiling` not bound; `derive.unmodifiable-participant-floor` does NOT fire (a participant that does not exist yet cannot be unmodifiable; migration.md section 7 plugin-ecosystem prior: participants 0) | `class.irrelevant-by-default` |
| Host appetite: funded platform group of six, no stated ceiling | `constraint.host-modification-ceiling` unbound (`rule.unanswered-inert`); migration.md section 7 host prior is level 1 per addition | not bound |
| Twelve-month public opening | `engine.rule.horizon-select`: governing horizon `migration.horizon.first-integration`; report risk line | horizon selection, not a constraint |
| Review before listing; rapid delisting; usage visibility | `constraint.operability.governance.approval-workflow`, `.operability.private-registry` (`registry.deployable-feature`), `.governance.rollback`, `.governance.usage-visibility`, all `scope.edition`; plus `constraint.instant-rollback` at `scope.implementation` | `class.strong-preference` (REQ-ENT-03 firewall; never family-scope) |
| Add-on author experience (simple to build and test against the contract) | `constraint.paved-road`, `scope.implementation` | `class.strong-preference` (ceiling strong; never hard) |

State septet. The "extensibility model" of the brief maps onto three taxonomy dimensions
(state-transition.md section 2 relevance note): `dimension.integration-time`,
`dimension.roster-authority`, `dimension.trust-ceiling`. All three carry the same septet,
recorded once:

| Field | Value |
|---|---|
| `state.current` | services-written customizations inside the main codebase |
| `state.target` | reviewed third-party add-ons, independent of product releases |
| `transition.willingness` | high; board-approved |
| `transition.cost` | contract design, host surface, review pipeline (new work, no participant migration) |
| `transition.authority` | board approved; accountable director engaged |
| `transition.confidence` | `transition.confidence.transitioning` (6) |
| `transition.horizon` | marketplace opens in twelve months |

Buy-in signals present: `buyin.executive-sponsorship`, `buyin.budget`, `buyin.staffing`,
`buyin.timeline`, `buyin.platform-responsibility`. Credible per
[state-transition.md](../model/state-transition.md) section 3.

## 3. Guardrail expectations

Sanity checks only; no predicted winner.

- Both output slots are required: `recommendation.best-today` (the coordinated single-codebase
  reality persists during the build-out) and `recommendation.best-after-transition` (credible
  at confidence 6 with signals, so a genuine recommendation, not a warning)
  ([state-transition.md](../model/state-transition.md) sections 3-5).
- Any strategy requiring a host rebuild or redeploy per add-on addition or update is
  eliminated for the target state.
- The boundary must assume hostile input: containment or data-access control that depends on
  add-on authors behaving well is inadmissible ([topology.md](../model/topology.md)
  section 2.7 trust posture).
- Registry, review workflow, rollback, and usage monitoring select implementations, editions,
  and operating models, never architectural families (REQ-ENT-01, REQ-ENT-03, REQ-ENT-08); a
  trace whose family choice hinges on a commercial capability is defective.
- If a planned-but-unavailable capability fits strongly, the trace must pair it with the best
  available today (REQ-AVAIL-01, REQ-AVAIL-02).

REQ-TRUST-01 outcome classes allowed (ids per [README.md](README.md)): `trust.hf-community`,
`trust.other-oss`, `trust.commercial`, `trust.hfe-future` (with pairing), `trust.no-match`,
`trust.change-assumptions`. `trust.no-mfe` is excluded: in-product third-party UI extension
is itself a hard input, so a no-composition outcome contradicts the fixture rather than
exercising judgment.

## 4. Trace

Hand-traced 2026-08-29 through the [decision-engine.md](../model/decision-engine.md)
pipeline (E1 to E17), with cells quoted from
[matrix-compact.tsv](../matrix/matrix-compact.tsv) and per-cell conditions from
`matrix/columns/<unit>.json` (version.research 2026.08.0). Subjects: `host` (the
project-management product), `participant:add-on` (the ownership class of every add-on;
question-graph.md 4.2 R1 batches the class, not the author).

**This trace produces one guardrail FAIL.** It is recorded in 4.16 and diagnosed in 4.17;
the fixture is not patched (REQ-ORCH-11).

### 4.1 E1 `engine.step.intake`

The section 2 table is the intake record. Rank 1 fills two boundaries' ownership facts:
the host/professional-services boundary in `state.current` (one codebase, one train, no
external party) and the host/add-on boundary in `state.target` (external authors, no
cross-deployment control, participants unknown at host ship time). Every marketplace
requirement is future-tense, so `question.rule.state-fork` routes it to `state.target`
plus the septet, never to a current fact (B4 defense, questions.md 1.3).

The board decision answers rank 13 (`question.roster.runtime-admission`) at its hard level
on the host-change atom ("with none of it waiting on our releases", reinforced by "the
marketplace work cannot slow them down") and at "not required" on the ownerless-onboarding
atom (the review gate is a deliberate central-owner action). The security office's sentence
answers rank 5 (`question.trust.malicious-participant`) hard. The workspace-survival
sentence answers rank 9 (`question.failure.containment`) hard. The product bet answers rank
3 (`question.granularity.single-screen`) yes-hard. The contract sentence answers
`question.impl.drift-machinery` at its descriptor-and-versioning level, not at the
connect-gate level: the Situation states a compatibility policy, not "the system itself
must refuse the mismatch", and questions.md 5.3 keeps the weaker honest answers first-class
precisely so this question cannot be read as a single-implementation selector. The
twelve-month opening selects `migration.horizon.first-integration` and produces a report
risk line only. Add-on authors are `migration.greenfield` (level 0), so the rank-4 battery
is not spent at all (questions.md 3.4: greenfield participant = irrelevant).

### 4.2 E2 `engine.step.topology-infer`

Per-boundary inference (topology.md section 1). Host/professional-services, current:
`ownership.single-team` plus `ownership.multi-team-single-repo` with no external
participant infer `topology.coordinated-team`. Host/add-on, target:
`ownership.external-participant` plus `ownership.no-cross-deployment-control` plus
participants-unknown-at-ship-time infer `topology.plugin-ecosystem` (the third fact is what
separates it from `topology.third-party-vendor`, whose participants are known and
contracted). `question.topology.confirm` confirmed on both.

Priors armed from constraints.md 2.15, plugin-ecosystem row. Hard tendencies:
`constraint.independent-deploy` (arrives entailed in 4.3), `constraint.runtime-roster-change`
(stays `prior-unconfirmed`; `engine.rule.prior-bindings` forbids a hard-tendency prior from
eliminating before its confirming question, and no answer confirms in-document admission),
`constraint.fault-containment` (arrives as an explicit answer),
`constraint.no-host-change-per-participant` (arrives as an explicit answer),
`constraint.distinct-principal` (confirm; arrives as an explicit answer). Preference
tendencies `constraint.paved-road` and `constraint.instant-rollback` are both answered in
section 2, so no `prior-unconfirmed` preference remains open.

### 4.3 E3 `engine.step.derive`

Fired on `state.current`:

- `derive.single-coordinated-team` (entailed): re-classes `constraint.independent-deploy`,
  `constraint.no-version-governance`, `constraint.framework-major-coexistence` and
  `constraint.runtime-roster-change` to `class.irrelevant-by-default` **in the
  current-state pass only** and admits the five baseline families as first-class
  candidates.

Fired on `state.target`:

- `derive.no-cross-deploy-control` (entailed): `constraint.independent-deploy` hard.
- `derive.plugin-admission` (mixed): `constraint.independent-deploy` hard (entailed);
  `constraint.runtime-roster-change` hard **in confirm mode**, so it binds as
  `prior-unconfirmed` plus an armed confirmation question, not as an eliminator;
  `constraint.fault-containment` hard in confirm mode, confirmed by the answer at E1;
  `constraint.no-host-change-per-participant` at `class.strong-preference`; and
  `derive.external-principal` because the authors are external.
- `derive.external-principal` (confirm mode; confirmed hard by the security requirement):
  `constraint.distinct-principal`(participant:add-on) hard.
- `derive.many-party-drift` (entailed: thousands of independently deploying authors, and
  every deploy-decoupled unit scores `contracts.drift-surface` = y):
  `constraint.explicit-drift-surfacing` strong, escalated to hard on two atoms by the
  stated contract requirement.

Not fired, premises absent: `derive.unmodifiable-participant-floor` (add-on authors are
greenfield at level 0; `ownership.host-unmodifiable-participant` describes an existing
artifact and there is none, so no participant ceiling binds and no floor-3/floor-4 family
is eliminated on migration grounds), `derive.broken-governance`,
`derive.mixed-majors-present` (no current-estate coexistence fact; the target-state stack
diversity of unknown authors is caught at rank 11, still open),
`derive.white-label-fit` (the user is the host), `derive.b2b-chain` (authors publish to the
host's marketplace and the host's customers install; there is no hop where a customer
republishes to its own consumers, so the identity/entitlement edition block stays locked),
`derive.legacy-untouchable`, `derive.static-estate`, `derive.seo-surface` (authenticated
product), `derive.regulated-release`, `derive.payload-budget` (no budget fact).

### 4.4 E4 `engine.step.compose`

Current-state slot:

| Constraint | Subject | Class | Slot | Origin |
|---|---|---|---|---|
| `constraint.independent-deploy` | global | irrelevant-by-default (re-classed) | current | derive.single-coordinated-team |
| `constraint.no-version-governance`, `constraint.framework-major-coexistence`, `constraint.runtime-roster-change` | global | irrelevant-by-default (re-classed) | current | derive.single-coordinated-team |

Target-state slot:

| Constraint | Subject | Class | Scope | Origin |
|---|---|---|---|---|
| `constraint.independent-deploy` | global | hard | family | derive.no-cross-deploy-control; derive.plugin-admission |
| `constraint.no-host-change-per-participant` | global | hard | family (host-change atom) | answer:question.roster.runtime-admission, composed over derive.plugin-admission (strong) to the strictest class |
| `constraint.distinct-principal` | participant:add-on | hard | family | answer:question.trust.malicious-participant; derive.external-principal |
| `constraint.fault-containment` | participant:add-on | hard | family | answer:question.failure.containment; derive.plugin-admission |
| `constraint.single-screen-mixing` | global | hard | family | answer:question.granularity.single-screen |
| `constraint.explicit-drift-surfacing` | global | hard on `contracts.formal-descriptor` + `contracts.contract-versioned` | implementation | answer:question.impl.drift-machinery; derive.many-party-drift |
| `constraint.runtime-roster-change` | global | prior-unconfirmed (hard tendency, unconfirmed) | family | topology prior; derive.plugin-admission confirm |
| `constraint.instant-rollback` | global | strong-preference | implementation | answer (delisting/rollback) |
| `constraint.paved-road` | global | strong-preference (facet ceiling) | implementation | answer (author DX) |
| `constraint.operability.governance.approval-workflow` / `.private-registry` / `.governance.rollback` / `.governance.usage-visibility` | global | strong-preference | edition | answers (review, registry, delisting, monitoring) |

Target credibility, `predicate.target-credible` over the three dimensions' shared septet:
`transition.confidence.transitioning` (ordinal 6) >= 5, so condition 1 passes on the
primary path without needing the buy-in subset; authority is held and engaged (board
approved, accountable director named), so condition 2 passes; the twelve-month horizon sits
inside the decision horizon and the 3x probe (thirty-six months) leaves
`slots.bestToday` valid throughout, so condition 3 passes. The target is **credible**: its
bindings evaluate in the `bestAfterTransition` pass as a genuine second evaluation, not as
a `rule.aspiration-warning` annotation. This matches state-transition.md section 4's own
calibration note, which records plugin-marketplace as passing on ordinal >= 5 with the
signals as corroboration.

### 4.5 E5 `engine.step.relations`

- `rel.requires`: `constraint.distinct-principal` (hard) presupposes
  `constraint.fault-containment` (already hard) and `constraint.css-containment`
  (satisfied by construction on any browser-boundary pole; families.md 3.7).
- `rel.relaxes`: `constraint.distinct-principal` re-classes
  `constraint.interference-damping` to `class.irrelevant-by-default`; its follow-ups are
  pruned.
- `edge.warns` armed, each shown at ask time as a tradeoff acknowledgment: rank 5 vs rank
  10 (`gap.secure-seamlessness`), rank 5 vs rank 12 (`gap.untrusted-dedup`), rank 5 vs
  rank 15 (`rel.excludes` distinct-principal vs sync-calls), rank 13's ownerless atom vs
  `question.impl.delivery-governance` (`gap.governed-ownerless-onboarding`).
- No gap seed queued from `rel.*`: no `to` side of any exclusion row is bound hard. **No
  warn edge exists for the pair that actually empties this assessment**
  (`constraint.distinct-principal` x `constraint.no-host-change-per-participant`), because
  constraints.md section 4 carries no `rel.excludes` row for it. See Model finding 2.

### 4.6 E6 `engine.step.eliminate-family`, current-state pass

`derive.single-coordinated-team` has re-classed the four autonomy eliminators, and no
target binding may satisfy or eliminate anything here (`rule.no-target-satisfies-hard`).
Nothing is bound hard in the current slot, so nothing is eliminated: all twelve families
are retained and E7 ranks them. Engine-answered guards `constraint.installable-today` and
`constraint.code-ownership` are satisfied uniformly; no question spent.

### 4.7 E6 `engine.step.eliminate-family`, target-state pass (cells quoted)

| Eliminated | Violated binding(s) | Deciding cells |
|---|---|---|
| `family.modular-monolith`, `family.package-composition`, `family.spa-routing`, `family.server-templates`, `family.islands` | `constraint.independent-deploy` | `deployment.host-rebuild-required` = y for modular-monolith, monorepo-package-composition, plain-spa-routing, server-rendered-templates, islands-architecture, bit; commercetools-frontend c ("page-composition changes ship with no rebuild; any component code change requires rebuilding and redeploying the single app") fails the need; families.md section 5 "no independent deployment, by definition" |
| `family.route-partition` | `constraint.single-screen-mixing` | `runtime.concurrent-participants` = n for reverse-proxy-route-composition, nextjs-multi-zones, cloudflare-workers-microfrontends; families.md 3.1 "cannot place two teams' output on one screen" |
| `family.module-graph-federation` | `constraint.distinct-principal`, `constraint.fault-containment` | `security.untrusted-third-party-viable` = n for module-federation ("Loading a remote equals a script include of third-party code"), native-federation, import-map-architectures ("Isolation-grade trust boundaries require a different family"); `isolation.failure.post-mount-exception` = n for all three |
| `family.lifecycle-orchestration` | `constraint.distinct-principal`, `constraint.fault-containment` | `security.untrusted-third-party-viable` = n for single-spa ("all participants fully trusted per the documented model") and piral ("pilets are trusted first-party code by stated model"); `isolation.lifecycle.reclaim` = n for both (quarantine is not containment, families.md 3.5) |
| `family.custom-element-composition` | `constraint.distinct-principal`, `constraint.fault-containment` | `security.untrusted-third-party-viable` = n for web-components-composition ("trusted-code-only; untrusted participants require iframes or vendor sandboxes instead") and entando ("Trust model is Hub curation; installing a bundle grants shared-page and cluster presence"); `isolation.lifecycle.reclaim` = n for both |
| `family.server-fragment-assembly` | `constraint.distinct-principal`, `constraint.fault-containment` | `security.untrusted-third-party-viable` = n for podium ("layout trusts configured podlets; same-document, same-realm execution"), opencomponents ("trust model is explicitly single-organization; no signing or consumer-side verification"), edge-side-composition, server-side-fragment-composition; `isolation.failure.post-mount-exception` = n for all four |
| `family.virtualized-rehosting` | `constraint.distinct-principal`; also `constraint.no-host-change-per-participant` | `security.untrusted-third-party-viable` = n for qiankun, micro-app-jd ("own trust model: first-party/trusted children only"), wujie ("Not a sandbox for untrusted code; any child can read/write host DOM, storage, cookies"), web-fragments ("Cooperative, bypassable same-origin illusion"); families.md 3.6 and REQ-MATRIX-05: never a security boundary. Independently: `deployment.new-participant-host-change` = y for all four |
| **`family.document-embedding`** | **`constraint.no-host-change-per-participant`** | **`deployment.new-participant-host-change` = y for hyperfrontend ("host must install the feature's shell and declare a mount (one-time; script tag or npm)") and iframe-composition ("someone must place the new frame tag; the strategy ships no registry or roster"). impl.luigi is retained by that cell (c, "config-only if Core fetches its navigation config dynamically") but eliminated per configuration by `constraint.distinct-principal`: `security.untrusted-third-party-viable` = n, "Trust model broadcasts host-issued tokens to frames; documented example uses wildcard target"** |

**Survivor set: empty.** The two hard bindings partition the landscape with no overlap. Of
30 units, exactly two are conditionally viable for untrusted third parties (hyperfrontend
c, iframe-composition c, plus reverse-proxy-route-composition c on
`isolation.security.malicious-participant` alone), and exactly four score
`deployment.new-participant-host-change` = n (entando, piral,
reverse-proxy-route-composition, and zephyr-cloud, which is a delivery-governance layer
over `family.module-graph-federation` and inherits that family's exclusion, families.md
6.1). The intersection is empty, and
`constraint.single-screen-mixing` removes the one unit that appears on both lists in a
different atom (reverse-proxy at page granularity).

`engine.rule.attribution` was applied where it is defined
(`deployment.strategy-service-in-path`, `governance.rollback`,
`migration.host.new-infra-tier-required`): none of those three decides an elimination here.
It is **not** defined for `deployment.new-participant-host-change`, which is the atom that
decides the outcome. See Model finding 1.

### 4.8 E7 `engine.step.rank-family`

Current-state pass: all twelve families retained, ranked by
`engine.rule.candidate-order`. `family.modular-monolith` takes
`status.match.strong` (it is the operating architecture and violates no bound preference),
with `family.package-composition` and `family.spa-routing` adjacent at `viable`. The
professional-services customizations riding the train forever are reported as a
`cost.operate` tradeoff, not as a violated hard constraint: nothing in the current slot
binds against them, which is exactly why the marketplace is a transition and not a repair.

Target-state pass: `candidateStrategies` is empty. `violatedConstraints` carries nothing
(preference violations belong to retained candidates and none are retained);
`excludedStrategies` carries all twelve families with their violated bindings and origin
chains.

### 4.9 E8 `engine.step.dominance`

- `dominance.fused-baselines-over-mfe`: **active in the current-state pass** (conditions:
  `derive.single-coordinated-team` fired, and the twice-weekly train is answered
  acceptable because it is today's operating reality). Skips ranks 5 to 16 in that pass;
  the current-state family stage closes after two question events, the REQ-Q-04 shape.
  Dissolved in the target pass, where `derive.single-coordinated-team` does not fire.
- `dominance.browser-boundary-over-simulated-realm`: active in the target pass (condition:
  `constraint.distinct-principal` hard), but active-moot: its dominated set
  (`family.virtualized-rehosting`) is independently excluded. Disclosed with its condition.
- Inactive: `dominance.route-partition-over-coresident-runtimes` (rank 3 answered yes),
  `dominance.fusion-subsumes-drift-and-dedup` (no atomic-release binding),
  `dominance.static-subsumes-infra-tier`, `dominance.html-entry-at-low-ceiling` (no rank-4
  ceiling exists; participants are greenfield).

### 4.10 E9 next-question and emission shape

Target pass, askable with nonzero effect over an empty survivor set: none.
`rule.monotone-elimination` makes every elimination final, so no answer reopens one, and
question-graph.md 4.1 excludes report-stage relaxation offers from the question budget
because they replace further questioning when the hard set is empty. `nextQuestion` returns
null (`rule.question-closure`).

`question.trajectory.no-transition-outcome` is asked before emission, as it must be
whenever a `fit.transition-dependent` output is pending (question-graph.md 1.3). The
Situation supplies the answer: if the marketplace never opens, the professional-services
model continues inside the main codebase, which is `slots.bestToday` unchanged. The
recommendation is therefore robust under the 3x probe.

Still open and recorded in `unresolvedQuestions` with `couldStillChange`:
`question.roster.runtime-admission`'s in-document-admission confirmation (rank 13),
`question.ux.seam-tolerance` and its `constraint.a11y-continuity` facet (rank 10),
`question.deps.major-coexistence` (rank 11), `question.deps.payload-budget` (rank 12),
`question.contracts.sync-calls` (rank 15), the `constraint.main-thread-protection`
follow-up of rank 9, and `question.guard.artifact-integrity` (a marketplace is a
supply chain, so the guard is armed but not asked absent a stated policy fact).

### 4.11 E10 to E12: stage 2 and the availability lens

With an empty family-stage survivor set the implementation and edition stages have nothing
to rank (`engine.rule.stage-firewall`: stage 2 evaluates members of surviving families
only, and nothing reaches back into family choice). Both stages therefore run on the
relaxation branch of 4.13 and 4.14, where they carry the content that settles guardrails 4
and 5:

- **Guardrail 4 mechanics.** No `constraint.operability.*` binding entered E6 or E7. The
  review, registry, rollback and usage-monitoring answers bound at `scope.edition` and
  were evaluated only at E11; `constraint.instant-rollback` bound at `scope.implementation`
  and was evaluated only at E10. The atom that eliminated `family.document-embedding` is
  `deployment.new-participant-host-change`, a neutral `dimension.roster-authority`
  attribute (taxonomy.md 2.8), not a commercial capability. The firewall held. The
  collinearity risk is real and disclosed in Model finding 1c.
- **Guardrail 5 mechanics.** `impl.hyperfrontend.enterprise` carries
  `registry.deployable-feature`, `registry.marketplace`, `governance.approval-workflow`,
  `governance.rollback` and `governance.usage-monitoring` at `avail.announced-planned`
  (implementations.md 2.7; enterprise-layer.md section 11). Every one of them satisfies
  **no** binding (REQ-AVAIL-01); each is emitted as `status.match.future-potential` with
  `pairedAvailableToday` REQUIRED. The shipping alternatives are named beside them:
  `registry.deployable-feature` = y today on `impl.opencomponents`, `impl.piral` (OSS feed
  plus `impl.piral.cloud`), `impl.entando` and `impl.zephyr-cloud`; `governance.rollback`
  = y on `impl.opencomponents` and `impl.zephyr-cloud`; `governance.usage-monitoring` has
  no y anywhere in the landscape (market-gaps.md section 4). Because REQ-ENT-07 makes every
  operability atom satisfiable by an edition capability, a third-party product **or an
  in-house build**, and because the four shipping registry products sit in families
  eliminated at 4.7, the honest pairing is: the shipping architecture-carrying line plus an
  in-house registry, review and delisting plan owned by the funded platform group, with
  those four products named as reference implementations of the atoms rather than as
  architectural alternatives. Noted, no fix required: schema 3.21's `pairedAvailableToday`
  is a single `Id` and cannot carry a multi-product operating plan, so the plan travels in
  the candidate's `condition` text.

### 4.12 E13 `engine.step.dual-output`

- **`slots.bestToday`**: produced (REQ-STATE-02, always). The 4.8 current-state ordering:
  `family.modular-monolith` at `status.match.strong`, then `family.package-composition`
  and `family.spa-routing`. Fit flags `fit.architectural`, `fit.organizational`,
  `fit.operational` hold; `fit.transition-dependent` no. This is the coordinated
  single-codebase reality persisting through the build-out, exactly as guardrail 1
  anticipates. It is **not** the assessment's outcome class: see 4.15 and Model finding 3.
- **`slots.bestAfterTransition`**: produced, and not a `rule.aspiration-warning`
  conditional (the target is credible at ordinal 6, 4.4). It carries
  `assessmentStatus: status.assessment.no-current-strong-match` plus a gap record plus an
  ordered relaxation path, because the second evaluation pass emptied the candidate space.
  `rule.dual-slot-divergence` cites the septet records driving the divergence: `state.target`
  on `dimension.roster-authority` (host-authored roster to per-customer installation
  records), on `dimension.trust-ceiling` (`trust.cooperative` to
  `trust.distinct-principal`), and on `dimension.integration-time` (`time.build-fused` to
  `time.deploy-decoupled`).

### 4.13 E14 to E16: gap, relaxation, counterfactuals

**`gapRecords`** (one, proposed; schema 3.20, classification vocabulary
`positioning/market-gaps.md`):

- `gapId`: `gap.untrusted-plugin-admission` (new; not among the six proven records).
- `constraints`: `constraint.distinct-principal` (hard),
  `constraint.no-host-change-per-participant` (hard, on the
  `deployment.new-participant-host-change` atom), `constraint.single-screen-mixing` (hard).
- `discoveredFrom`: `scenario.plugin-marketplace`; **no** `rel.excludes` row exists for the
  pair, which is Model finding 2.
- `currentCandidates`: none. The near misses are the whole finding: the only two units
  conditionally viable for untrusted third parties (hyperfrontend, iframe-composition)
  score `deployment.new-participant-host-change` = y, and the four scoring n
  (entando, piral, reverse-proxy-route-composition, zephyr-cloud) score
  `security.untrusted-third-party-viable` = n or na.
- `unmetCapabilities`: `security.untrusted-third-party-viable` together with
  `deployment.new-participant-host-change` = n at `runtime.concurrent-participants` = y.
- `classification`: `gap.class.expandable`. Nothing in browser primitives couples the two:
  a roster driven by per-customer installation records over cross-origin sandboxed frames
  is ordinary host code. Expansion surfaces `gap.surface.community-plausible` (a
  manifest/roster layer over the document boundary) and `gap.surface.enterprise-plausible`
  (`registry.deployable-feature` plus `registry.marketplace`, both planned and therefore
  satisfying nothing today).
- `gap.closes-when`: any unit scores `security.untrusted-third-party-viable` y or c
  together with `deployment.new-participant-host-change` = n.
- **Disposition caveat**: if Model finding 1 is accepted, this record is **withdrawn, not
  closed**, because the combination was never unsatisfiable. That decision must be taken
  before the record is published (market-gaps.md section 4 promotion rule).

**`relaxationOffers`**, ordered per `rule.relaxation-ordering`:

1. *(band 1, preferences mistaken for hard)* Re-confirm what "without host rebuild or
   redeploy" means. If it means "no host **release** per add-on" rather than "no host code,
   ever", then a one-time host-built admission layer satisfies it and
   `family.document-embedding` at the cross-origin plus sandbox posture returns. This is
   the offer Model finding 1 says the model should have generated automatically.
   **It has no ledger row today**, which is Model finding 2.
2. *(band 1)* Re-confirm the contract requirement. Bound hard on
   `contracts.formal-descriptor` plus `contracts.contract-versioned` it is an
   implementation-scope eliminator; re-classed to strong (the platform group authors and
   versions the descriptor itself) it reopens the iframe-composition practice at stage 2.
3. *(band 3, deployment/infrastructure acceptances)* Accept a registry or feed in the
   delivery path. `constraint.no-delivery-intermediary` is not bound here, so this is free,
   and it reopens the `roster.registry-mediated` pole (opencomponents, piral, entando,
   zephyr-cloud). **Reopens nothing while the security bar holds**: all four score
   `security.untrusted-third-party-viable` = n. Emitted with that joint block stated, which
   with offer 6 discharges the symmetry duty of decision-engine.md section 6.
4. *(band 5, adaptation-appetite increases)* Not offerable: add-on authors are greenfield
   at level 0 and no host ceiling is bound, so no appetite increase exists to buy.
5. *(band 4, UX acceptances)* Not offerable: no UX constraint is bound.
6. *(band 6, a different composition boundary, offered last)* Accept page seams: give each
   add-on its own URL space on its own subdomain instead of a region of a product screen.
   Negating `constraint.single-screen-mixing` reopens `family.route-partition` via
   reverse-proxy-route-composition, the one unit scoring
   `deployment.new-participant-host-change` = n ("A new app joins by claiming a prefix in
   proxy config; config change, not a rebuild") together with
   `isolation.security.malicious-participant` = c. Two conditions travel with it: the
   cell's own ("subdomain topology only, and parent-Domain session cookies remain
   domain-wide trust"), and the unresolved reading of `constraint.distinct-principal`
   recorded as Model finding 1 of
   [third-party-vendor-widget.md](third-party-vendor-widget.md), since the same unit's
   `security.untrusted-third-party-viable` cell is n. It also costs the brief's hard
   in-product-extension input, which is why it is last.

**`counterfactuals`** (mechanics: decision-engine.md section 6):

1. *(source 1, ledger row for `constraint.distinct-principal`)* Accept
   `trust.interference-damped` instead of malice containment: `family.virtualized-rehosting`
   returns at participant floor 1 (micro-app-jd, wujie). Blocked twice over: guardrail 3
   forbids it, and all four members independently fail
   `deployment.new-participant-host-change`. Emitted so the cost of the boundary is visible.
2. *(source 1, ledger row for `constraint.no-host-change-per-participant`)* **Does not
   exist.** Model finding 2.
3. *(source 2, dominance)* Withdrawing the security requirement dissolves
   `dominance.browser-boundary-over-simulated-realm` and unlocks the virtualized
   discriminators. Withdrawing the marketplace itself re-fires
   `derive.single-coordinated-team` in both slots and `dominance.fused-baselines-over-mfe`
   collapses the assessment to `slots.bestToday`.
4. *(source 3, unanswered eliminating answers)* Rank 13's in-document-admission
   confirmation answered hard additionally eliminates entando
   (`runtime.late-participant-registration` = n) and piral
   (`runtime.loaded-version-hot-swap` = n), removing two of the three units that survive
   the admission atom. Rank 13's ownerless atom answered hard fires the already-proven
   `gap.governed-ownerless-onboarding`; the review gate is what keeps it unbound. Rank 10
   answered hard fires `gap.secure-seamlessness` against the retained posture of offer 1.
   Rank 12 answered hard fires `gap.untrusted-dedup`. `question.guard.artifact-integrity`
   answered hard emits the landscape-wide `gap.artifact-integrity` record even though other
   candidates survive (E14 gap-trigger rule), which for a marketplace is the likeliest
   second gap. `question.impl.stewardship-floor` answered hard on
   `constraint.stable-line`, `constraint.stewardship-durability` or
   `constraint.no-forced-remigration` empties stage 2 of offer 1 entirely: see 4.14.
5. *(source 4, credibility flip, inverted)* The target is credible, so the probe runs
   downward: if the platform group's two-year funding lapses or the director's authority is
   withdrawn (`transition.confidence` below ordinal 5 with `buyin.budget` absent),
   `slots.bestAfterTransition` degrades to a `rule.aspiration-warning` conditional and
   `slots.bestToday` stands alone unchanged.
6. *(source 3)* If add-ons become paid products sold to the customers' own consumers,
   `derive.b2b-chain` fires, the `identity.consumer-credentials` and
   `commerce.entitlement` edition block unlocks, and per-hop
   `derive.white-label-fit` applies. No family-level consequence (REQ-ENT-03).

### 4.14 What offer 1 produces, if taken

Recorded here because guardrails 4 and 5 are only testable against a non-empty candidate
set, and because Model finding 1 predicts this is the result the model should have reached
directly.

**E6 under offer 1.** `family.document-embedding` survives at the cross-origin plus sandbox
posture, `status.match.conditional`, condition: "the host builds a data-driven admission
layer once, and each add-on is admitted by an installation record rather than by host
code". Members retained per configuration: iframe-composition
(`security.untrusted-third-party-viable` c, "cross-origin hosting required; cross-site plus
process isolation for Spectre-class containment"; sandbox-attribute y, per-participant-csp
y, capability-narrowing y, storage.partition y, navigation.top-level-guard y; fault triple
y/y/y; `deployment.host-rebuild-required` n) and impl.hyperfrontend (same c cells;
storage.partition c, navigation.top-level-guard c; fault triple y/y/y;
`deployment.host-rebuild-required` c, "no while the contract holds", a condition the
brief's own frozen-contract input satisfies). impl.luigi stays excluded per configuration.
Every other family stays excluded exactly as in 4.7. Participant floors never bind: authors
are greenfield, so hyperfrontend's `migration.participant.min-level` of
`migration.bootstrap-change` prices the SDK the authors adopt by choice, not a migration
they refuse.

**E10.** `constraint.explicit-drift-surfacing` hard on the descriptor and versioning atoms
retains impl.hyperfrontend (`contracts.formal-descriptor` y, "versioned FeatureContract plus
metadata.json FeatureDescriptor"; `contracts.contract-versioned` y) and eliminates
iframe-composition (n / n). At landscape level that binding is not a single-unit selector
(podium, opencomponents, piral and entando score both atoms y; native-federation scores the
descriptor atom y and the versioning atom ?); it becomes one only after `constraint.distinct-principal` has already reduced the
space to one family, and the report must say so, with offer 2 as the exact re-classification
that restores the practice.

**E11 and E12.** `impl.hyperfrontend.community` is the sole candidate implementation,
`status.match.conditional`. The availability lens carries, beside it and never blended into
fit: `avail.available-immature` (`unit.availability.stable-line-shipped` = n, pre-1.0,
breaking wire changes permitted), `unit.maintenance.multi-maintainer` = n,
`unit.maintenance.org-steward` = n, `operations.single-sponsor-concentration` = y,
`unit.maintenance.adoption-outside-sponsor` = ?, `unit.maintenance.adoption-scale-10k` = ?.
Violated strong preferences, printed as named tradeoffs:
`constraint.no-forced-remigration` (`migration.forced-remigration-pending` = y, "pre-1.0:
breaking wire changes permitted and have occurred"; `migration.permanent-viability` = c)
against a public twelve-month commitment to a frozen contract, and
`constraint.instant-rollback` (`governance.rollback` = n, "same-URL model; no
pointer-repoint mechanism"; `deployment.immutable-version-retention` = n), whose in-house
answer is the same installation-record roster that offer 1 builds: delisting is a data
change. `impl.hyperfrontend.enterprise` appears only as `status.match.future-potential`
per 4.11. A hard answer at `question.impl.stewardship-floor` on stable-line, stewardship
durability or forced remigration eliminates the sole candidate and produces a second,
different gap, which is the honest counterweight to a sole-survivor result.

### 4.15 E17 emission, outcome class, derivation sample

```text
Assessment status: status.assessment.no-current-strong-match   (target state)

Best today:            family.modular-monolith                 [strong]
Best after transition: no current strong match                 [gap.untrusted-plugin-admission]

Why nothing fits:
- add-ons must be admitted without a host release      (deployment.new-participant-host-change = n)
- the boundary must contain a hostile author           (security.untrusted-third-party-viable, isolation.security.malicious-participant)
- add-ons must render inside a product screen          (runtime.concurrent-participants = y)
  no unit in the 2026.08.0 landscape scores all three

Derived from:
question.ownership.composition-parties -> "outside authors we never meet"  (ownership.external-participant)
  -> derive.external-principal -> question.trust.malicious-participant
  -> constraint.distinct-principal(participant:add-on)
ownership.no-cross-deployment-control + participants unknown at ship time
  -> derive.plugin-admission -> constraint.independent-deploy
question.roster.runtime-admission -> "nothing waits on our releases"
  -> constraint.no-host-change-per-participant (host-change atom, family scope)
question.granularity.single-screen -> "add-ons appear inside the product"
  -> constraint.single-screen-mixing

Smallest change that opens the space:
~ re-read "no host rebuild per add-on" as "no host release per add-on", build the
  admission layer once, and family.document-embedding returns at the cross-origin
  plus sandbox posture                                  (relaxation offer 1; Model finding 1)
~ or accept page seams and family.route-partition returns at page granularity
                                                        (relaxation offer 6)
```

Outcome class as emitted: **`trust.no-match`** (allowed by the brief). Derivation chain:
`constraint.distinct-principal` hard (answer:question.trust.malicious-participant,
derive.external-principal) plus `constraint.no-host-change-per-participant` hard
(answer:question.roster.runtime-admission, composing over derive.plugin-admission) plus
`constraint.single-screen-mixing` hard (answer:question.granularity.single-screen), verified
against the `security.untrusted-third-party-viable`, `deployment.new-participant-host-change`
and `runtime.concurrent-participants` rows, produce an empty survivor set at E6, which E14
turns into `status.assessment.no-current-strong-match` plus `gap.untrusted-plugin-admission`
plus the ordered relaxation path of 4.13 (four live offers across the six bands). The bar was never lowered (REQ-GAP-01).

Outcome class under Model finding 1's fix: **`trust.hf-community`** for the architecture
(`impl.hyperfrontend.community` heads `candidateImplementations` at
`status.match.conditional`, availability `avail.available-immature` carried independently),
**paired with `trust.hfe-future`** for the operability half
(`impl.hyperfrontend.enterprise`'s registry, approval-workflow, rollback and usage atoms at
`status.match.future-potential` with `pairedAvailableToday` required). Both classes are
allowed by the brief.

### 4.16 Guardrail verification (brief section 3)

| Guardrail | Result |
|---|---|
| Both output slots required; `bestAfterTransition` a genuine recommendation, not a warning | **FAIL.** Settled at 4.7, the E6 target pass: `constraint.no-host-change-per-participant` eliminates hyperfrontend and iframe-composition on `deployment.new-participant-host-change` = y, and `constraint.distinct-principal` eliminates every unit that scores that atom n. Both slots are produced and the slot is correctly not a `rule.aspiration-warning` (the target is credible at ordinal 6, 4.4), but it carries `status.assessment.no-current-strong-match` instead of a recommendation. Diagnosed in 4.17 |
| Any strategy requiring a host rebuild or redeploy per add-on addition or update is eliminated for the target state | PASS at 4.7: the five baselines plus bit and commercetools-frontend by `constraint.independent-deploy` on `deployment.host-rebuild-required`; every `roster.host-authored` and classic-fragment unit by `constraint.no-host-change-per-participant` on `deployment.new-participant-host-change`. This guardrail is what empties the space |
| The boundary must assume hostile input; containment or data-access control that depends on add-on authors behaving well is inadmissible | PASS at 4.7. Every elimination on `constraint.distinct-principal` quotes a *stated trust model* and refuses to credit it: piral "pilets are trusted first-party code", entando "Hub curation, not runtime isolation", opencomponents "explicitly single-organization", micro-app-jd "robustness not security", wujie "accidental-interference hygiene, never adversary containment", luigi "Core broadcasts auth tokens to frames". `family.virtualized-rehosting` is eliminated explicitly as never a security boundary. The review gate is bound at `scope.edition` and is never read as containment |
| Registry, review workflow, rollback and usage monitoring select implementations, editions and operating models, never families | PASS at 4.11 by `engine.rule.stage-firewall`: no `constraint.operability.*` binding entered E6 or E7; `constraint.instant-rollback` acted only at E10; the deciding atom is the neutral `dimension.roster-authority` attribute `deployment.new-participant-host-change`. Recorded with a caveat: among adoptable implementations the n-pole of that atom is occupied only by units that also ship a commercial registry tier, so the elimination is observationally close to selecting on registry capability. Model finding 1c |
| A planned-but-unavailable capability that fits strongly must be paired with the best available today | PASS at 4.11: the five planned HyperFrontend Enterprise atoms satisfy no binding (REQ-AVAIL-01), are emitted as `status.match.future-potential` with `pairedAvailableToday` required, and the shipping occupants of each atom are named, including the four registry products that sit in eliminated families and the in-house plan that REQ-ENT-07 makes a first-class option |

REQ-MISSION-01 check on 4.14: offer 1's result is a sole-survivor recommendation for the
sponsor's own unit. It is disclosed as such, it is reached only after two landscape facts
neither of which is a modeling choice (two units carry a conditional untrusted-viable cell;
one of those two carries a versioned descriptor contract), offer 2 names the exact
re-classification that restores the vendor-neutral practice, the availability lens prints
the worst stewardship profile in the family beside it, and the model fix in 4.17 is argued
from cell-scoring inconsistency that is entirely independent of which unit it readmits.

### 4.17 Model findings

Per REQ-ORCH-08 the failing layer is named for each; per REQ-ORCH-11 no fixture content was
changed to make any of them go away.

**1. `deployment.new-participant-host-change` eliminates on a shipped-product fact, at
family scope, with no attribution rule.** This is the guardrail-1 FAIL.

- *(1a, evidence layer)* The column set scores the same underlying question two opposite
  ways. native-federation is c because "unless the host builds routes/mount points
  dynamically from the manifest, referencing a brand-new remote needs a host code change";
  picard-js is c because "discovery-driven hosts can take new participants from the feed
  response"; luigi is c because "config-only if Core fetches its navigation config
  dynamically"; import-map-architectures is c on the same adopter-side reasoning. Those
  four are credited for an adopter-built dynamic mount. micro-app-jd is y with the note
  "absent adopter-built config-driven rendering", and iframe-composition is y with "the
  strategy ships no registry or roster": the same adopter-built path, named, and not
  credited. Three columns also disagree across a family boundary: server-side-fragment-
  composition's c condition says "registry-based implementations (OC, ILC) onboard without
  composer redeploy", while opencomponents' own cell is y.
- *(1b, taxonomy layer)* The attribute conflates a one-time host mechanism build with a
  recurring per-participant host change, and `constraint.no-host-change-per-participant`
  inherits the conflation while binding at `scope.family`. migration.md section 7's own
  plugin-ecosystem prior says the host pays `migration.trivial-adaptation` (level 1,
  "configuration, metadata, or packaging changes only") **per addition**, which is exactly
  what an installation-record roster costs and exactly what the atom denies to every
  `roster.host-authored` unit. taxonomy.md 2.8 states the causal chain in the shipped-product
  sense ("Host authorship, so every roster change is a host code change and deploy"), which
  is true of the bare practice and false of a platform that builds the roster once.
- *(1c, logic layer)* constraints.md 2.15 lists
  `constraint.no-host-change-per-participant` as a **hard tendency** of
  `topology.plugin-ecosystem` while `derive.plugin-admission` derives the same constraint
  for the same topology at **strong**. E4's strictest-class composition then lets any
  explicit answer promote it to a family-scope eliminator that the derivation rule
  deliberately declined to be. Separately, the n-pole of the deciding atom is occupied,
  among adoptable implementations, only by units that also ship a commercial registry tier
  (entando, piral, zephyr-cloud; reverse-proxy is the one vendor-neutral occupant and is
  page-granular), so the neutral atom and the `registry.deployable-feature` edition atom are
  near-collinear and the REQ-ENT-01 firewall holds only by construction.
- **Proposed fix.** (i) Extend `engine.rule.attribution` to
  `deployment.new-participant-host-change` with two causes, exactly as it already does for
  `deployment.strategy-service-in-path`: *structural*, where the composition mechanism makes
  a new participant a change to host source or the host build (the build-fused baselines,
  entando's bundle install), and *no-shipped-roster*, where a data-driven host-authored
  roster is achievable at a one-time host cost priced on `migration.host.min-level` (the
  whole `roster.host-authored` pole). Eliminate only on the structural cause; retain the
  second cause conditionally with "host builds the admission layer" as the named condition.
  (ii) Re-score the `roster.host-authored` cells to c with that condition, so the column set
  stops treating the adopter-built path as decisive for four units and absent for three.
  (iii) Reconcile constraints.md 2.15 with `derive.plugin-admission` so the same constraint
  has one class for one topology. Under (i) alone this fixture reaches 4.14 directly and the
  guardrail passes.

**2. The constraint that empties this assessment has neither a `rel.excludes` row nor a
relaxation-ledger row** (layer: logic). constraints.md section 4 carries no exclusion pair
for `constraint.distinct-principal` x `constraint.no-host-change-per-participant`, so E5
armed no warn edge and the contradiction surfaced at report time rather than ask time,
against REQ-GAP-01's stated intent. constraints.md 6.1 carries no row for
`constraint.no-host-change-per-participant` at all, so E15 could generate no offer for it
(offers come only from ledger rows whose constraint is bound hard) and E16 source 1 could
generate no counterfactual; offer 1 and the missing counterfactual above were reconstructed
by hand, which an engine implementation cannot do. Proposed fix, two rows:

- `rel.excludes` | `constraint.distinct-principal` (hard) | `constraint.no-host-change-per-participant` (hard, host-change atom) | basis: `security.untrusted-third-party-viable` is c only for hyperfrontend and iframe-composition, both of which score `deployment.new-participant-host-change` = y; the four units scoring that atom n score untrusted-viable n or na. `gapSeed`: `gap.untrusted-plugin-admission`.
- relaxation ledger | `constraint.no-host-change-per-participant` (host-change atom) | eliminates the whole `roster.host-authored` pole plus the classic fragment members and the baselines | smallest meaningful relaxation: accept a one-time host-built admission layer, admitting each participant by an installation record | reopens every `roster.host-authored` unit; consequence: the host owns roster, review-gate and inventory code as `cost.operate` (families.md 3.3, 3.6, 3.7).

Note that the fix in finding 1 and the ledger row in finding 2 are not alternatives: if 1 is
accepted the row still belongs in the ledger, because a structural-cause elimination remains
possible and must remain relaxable.

**3. The outcome class is slot-ambiguous in a dual-slot assessment** (layer:
interpretation). decision-engine.md section 7 defines `trust.no-mfe` as "baseline families
head `candidateStrategies` after `derive.single-coordinated-team` plus the rank-2 train
branch (`dominance.fused-baselines-over-mfe`)". That is precisely the shape of this
fixture's current-state pass, and `candidateStrategies` is a single field fed by E7. An
engine reading the outcome class off that field would emit `trust.no-mfe`, which this
brief excludes by construction. Proposed fix: qualify the section 7 rows to the slot that
carries the bound target, and state in `rule.dual-slot-divergence` that the assessment's
REQ-TRUST-01 class is read from `slots.bestAfterTransition` whenever a credible target
exists.

**4. Confirms Model finding 1 of
[third-party-vendor-widget.md](third-party-vendor-widget.md)** (layer: interpretation
codified into taxonomy). Relaxation offer 6 reproduces it independently:
constraints.md 2.2 retains `family.route-partition` conditionally on the reverse-proxy
`isolation.security.malicious-participant` = c cell while the same unit's
`security.untrusted-third-party-viable` cell is n, so an all-atoms reading of
`constraint.distinct-principal` cancels the model's own last-resort relaxation for this
fixture. Two fixtures now depend on the per-granularity deciding-atom semantics proposed
there; it should be treated as blocking rather than as a disclosure.

### 4.18 Regression expectations

Stable assertions any engine implementation must reproduce for this fixture. Section A holds
while the model is unchanged; section B replaces A's first three rows on the version.model
bump that lands Model finding 1, and the fixture must be re-traced on that bump
(versioning-strategy.md 1.2).

#### A. Against the model as it stands (version.research 2026.08.0)

- `slots.bestToday` is produced and headed by `family.modular-monolith`, with
  `dominance.fused-baselines-over-mfe` active and disclosed in the current-state pass only.
  The assessment's outcome class is never read from this slot (Model finding 3).
- `slots.bestAfterTransition` is produced, is **not** a `rule.aspiration-warning`
  conditional (`predicate.target-credible` passes on `transition.confidence.transitioning`,
  ordinal 6, authority engaged, twelve-month horizon surviving the 3x probe), and carries
  `status.assessment.no-current-strong-match`.
- Outcome class `trust.no-match`, with exactly one gap record whose constraint set is
  {`constraint.distinct-principal`, `constraint.no-host-change-per-participant`,
  `constraint.single-screen-mixing`} all hard.
- Eliminated families with their rule ids, all cell-verified:
  - the five baselines by `constraint.independent-deploy`
    (`deployment.host-rebuild-required` = y; commercetools-frontend c fails the need);
  - `family.route-partition` by `constraint.single-screen-mixing`
    (`runtime.concurrent-participants` = n for all three members);
  - `family.module-graph-federation`, `family.lifecycle-orchestration`,
    `family.custom-element-composition`, `family.server-fragment-assembly` and
    `family.virtualized-rehosting` by `constraint.distinct-principal` with
    `constraint.fault-containment` as co-origin (`security.untrusted-third-party-viable` = n
    for every member);
  - `family.document-embedding` by `constraint.no-host-change-per-participant`
    (`deployment.new-participant-host-change` = y for hyperfrontend and iframe-composition;
    impl.luigi retained by that atom at c and excluded per configuration by
    `constraint.distinct-principal`).
- `derive.unmodifiable-participant-floor` never fires and no participant-modification
  ceiling is ever bound: add-on authors are `migration.greenfield`. Any trace that
  eliminates a family on a participant floor here is wrong.
- `derive.single-coordinated-team` fires in the current slot and not in the target slot;
  `derive.plugin-admission`, `derive.external-principal`, `derive.no-cross-deploy-control`
  and `derive.many-party-drift` fire in the target slot; `derive.b2b-chain` does not fire.
- `constraint.runtime-roster-change` stays `prior-unconfirmed` and eliminates nothing
  (`engine.rule.prior-bindings`). Its hard confirmation is a recorded counterfactual that
  additionally removes entando (`runtime.late-participant-registration` = n) and piral
  (`runtime.loaded-version-hot-swap` = n).
- No `constraint.operability.*` binding ever appears in `excludedStrategies` at
  `scope.family` (`engine.rule.stage-firewall`; guardrail 4).
- Every `avail.announced-planned` HyperFrontend Enterprise capability satisfies no binding
  and appears only as `status.match.future-potential` with `pairedAvailableToday` populated.
- Key counterfactuals present: accepting `trust.interference-damped` reopens
  `family.virtualized-rehosting` and is blocked a second time by the admission atom;
  accepting page seams reopens `family.route-partition` at page granularity via
  reverse-proxy-route-composition; a hard `question.guard.artifact-integrity` answer emits
  `gap.artifact-integrity` alongside; a hard `question.impl.stewardship-floor` answer on
  stable-line or forced remigration empties stage 2 of the relaxed branch.
- Guardrail 1 FAILS and the failure is reported, never absorbed. An implementation that
  quietly produces a recommendation here has patched the fixture (REQ-ORCH-11).

#### B. After Model finding 1's fix lands

- Outcome class `trust.hf-community` paired with `trust.hfe-future`; guardrail 1 PASSES.
- `slots.bestAfterTransition` is headed by `family.document-embedding` at
  `status.match.conditional`, condition naming the host-built data-driven admission layer,
  with iframe-composition and impl.hyperfrontend as the retained configurations and
  impl.luigi excluded per configuration by `constraint.distinct-principal`.
- Stage 2 leaves `impl.hyperfrontend` alone through `constraint.explicit-drift-surfacing`
  on `contracts.formal-descriptor` plus `contracts.contract-versioned`, and the report
  carries the offer-2 re-classification that restores iframe-composition, the
  `constraint.no-forced-remigration` violation
  (`migration.forced-remigration-pending` = y), the `constraint.instant-rollback` violation
  (`governance.rollback` = n), and the full availability annotation
  (`avail.available-immature`, `multi-maintainer` = n, `org-steward` = n).
- `gap.untrusted-plugin-admission` is **withdrawn, not closed**; the relaxation-ledger row
  and the `rel.excludes` row of Model finding 2 remain required.
- Everything in section A's elimination list except the `family.document-embedding` row
  still holds unchanged. A fix that also readmits any other family has overshot.
