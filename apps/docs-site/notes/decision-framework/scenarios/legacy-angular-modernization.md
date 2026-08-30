# Scenario: legacy-angular-modernization

Status: TRACED (2026-08-29).

## 1. Situation

We are a freight logistics company whose dispatchers, drivers, and back-office staff all work
inside a web application we started building in 2013. It is roughly 400,000 lines on a UI
framework that reached end of life years ago; the engineers who built it are gone, and the
two maintenance developers who keep it alive are only confident making very small, contained
changes. A full rewrite has been proposed to the board twice and never funded, and we do not
expect that to change soon. What leadership HAS approved, with budget and a new six-person
team starting next quarter, is that all new capabilities will be built outside the old
application on our current standard stack. The old application must keep running as it is for
years; realistically we can change its configuration and perhaps add a script tag, but
restructuring its code is off the table given our test coverage. Our staff should keep
experiencing one system: one sign-in, one navigation, no obvious seams, because retraining
three thousand field users is not something operations will accept. We would like each new
capability to replace a piece of the old application over time, at whatever pace funding
allows. If the old application is still here in five years, whatever we set up now has to
still be acceptable.

## 2. Normalized inputs

Re-normalized 2026-08-29 against the canonical ids of
[constraints.md](../model/constraints.md), [questions.md](../model/questions.md),
[topology.md](../model/topology.md), [migration.md](../model/migration.md), and
[families.md](../model/families.md). Changes: every input now names its constraint binding,
class, subject, and derivation route; the two subjects are separated (`participant:legacy`,
`participant:new-capability`) so the split appetite is per boundary; "protected from legacy
global-scope and CSS leakage" is split into `constraint.css-containment` (hard, exact fit)
and `constraint.interference-damping` (truncated to its class ceiling, Model finding 6);
"one navigation, no obvious seams" is split into `constraint.seamless-ux`,
`constraint.persistent-chrome`, and `constraint.cross-boundary-soft-nav`; the five-year row
is reclassified from a family-stage hard constraint to `constraint.no-forced-remigration` at
`scope.implementation` plus the `question.trajectory.no-transition-outcome` answer at family
stage; `constraint.framework-major-coexistence` is added as the entailed binding the
provisional table left implicit; the sign-in row is kept verbatim and marked UNBINDABLE
(Model finding 1). No stated value changed.

Appetite is recorded per participant, per the split noted in
[topology.md](../model/topology.md) section 2.5.

| Input | Canonical binding | Class / marking |
|---|---|---|
| Topology label | `topology.legacy-modernization` | label (informational; facts govern; see Model finding 4) |
| One organization; two teams (legacy maintenance pair, new six-person team); new code lives outside the old application | `ownership.single-team`=n, `ownership.multi-repo`=y, `ownership.independent-releases`=y; `ownership.external-participant`=n, `ownership.acquired-participant`=n, `ownership.no-cross-deployment-control`=n | observed facts, `state.current` |
| Legacy in maintenance-only mode; original engineers gone; test coverage forbids restructuring | `question.migration.capability-preconditions` (migration.md section 8): source and build present, active maintainers ABSENT, so levels 5+ are unreachable regardless of willingness | observed fact (capability precondition) |
| `migration.appetite`(`participant:legacy`, first-integration) = `migration.trivial-adaptation` (1); config and a script tag only | `constraint.participant-modification-ceiling`(`participant:legacy`, maxLevel=`migration.trivial-adaptation`) via `question.migration.participant-ceiling` | `class.hard-constraint` (stated ceiling, migration.md section 5) |
| `migration.appetite`(`participant:new-capability`) = `migration.greenfield` (0) | no binding: level 0 is a circumstance, not a demand (migration.md section 2) | observed fact |
| Host-side adoption work funded (budget, six-person team) | `constraint.host-modification-ceiling` unbound on the new composition surface; bound at maxLevel=`migration.trivial-adaptation` only on the alternative legacy-as-host boundary (4.6b) | not bound / conditional per boundary |
| Legacy on an EOL framework, new code on the current standard stack, alignment unfunded | `constraint.framework-major-coexistence` via `derive.mixed-majors-present` (entailed) | `class.hard-constraint` (entailed) |
| Single sign-in / one session across old and new | NO CANONICAL BINDING EXISTS (constraints.md section 2 has no session/identity constraint at `scope.family`; the nearest ids are `scope.edition`). Carried as a per-candidate condition over `deployment.single-domain-required`, `isolation.storage.partition`, `isolation.origin.host-authority`, `security.cross-origin-boundary` | stated hard; UNBINDABLE (Model finding 1, guardrail 3 FAIL) |
| New code protected from legacy CSS leakage | `constraint.css-containment` via the `question.failure.containment` css follow-up, corroborated by the `topology.legacy-modernization` prior (constraints.md 2.15) | `class.hard-constraint` |
| New code protected from legacy global-scope leakage | `constraint.interference-damping`; the hard answer is truncated to the constraint's class ceiling | `class.strong-preference` (ceiling truncation noted, E4) |
| Recommendation acceptable if the legacy still exists in five years | `constraint.no-forced-remigration` (constraints.md 2.13) via the `question.impl.stewardship-floor` facet; and the answer to `question.trajectory.no-transition-outcome` | `class.hard-constraint` at `scope.implementation` |
| One navigation, no obvious seams | `constraint.seamless-ux` (`question.ux.seam-tolerance`), `constraint.persistent-chrome` + `constraint.cross-boundary-soft-nav` (`question.ux.chrome-persistence`) | `class.strong-preference` (facet ceiling caps the desirability facet; REQ-Q-02) |
| Boundary movable incrementally (capability-by-capability replacement) | `constraint.strangler-path` via `question.migration.strangler`; `constraint.bounded-exit` enters as the topology's `prior-unconfirmed` preference tendency | `class.strong-preference` |
| Composition direction (new inside old, old inside new, side by side) | NOT ASKED: topology.md 2.5 lists it as an unlocked follow-up but questions.md adopts no id for it | unresolved structural fact (Model finding 2) |

State septet, legacy-retirement dimension (`dimension.adaptation-floor`, state-transition.md
section 2 relevance note):

| Field | Value |
|---|---|
| `state.current` | legacy application carries all workflows |
| `state.target` | legacy retired eventually |
| `transition.willingness` | present but unfunded |
| `transition.cost` | `migration.rewrite` (8) for the legacy participant |
| `transition.authority` | board; has declined twice |
| `transition.confidence` | `transition.confidence.theoretical` (2) |
| `transition.horizon` | none stated |

New-capabilities-outside dimension (`dimension.integration-time` plus the ownership
checklist): `transition.confidence.leadership-approved` (4) with `buyin.budget`,
`buyin.staffing`, and `buyin.timeline` present: credible per
[state-transition.md](../model/state-transition.md) section 3 (the level-4 path: budget plus
at least one of timeline/staffing; this fixture is section 4's own calibration evidence).

## 3. Guardrail expectations

Sanity checks only; no predicted winner.

- Appetite must be evaluated per participant, never per organization: any strategy requiring
  the legacy application to exceed `migration.trivial-adaptation` is eliminated
  ([migration.md](../model/migration.md) sections 1 and 5), while the new code is free.
- The unfunded rewrite (confidence 2) must not influence `recommendation.best-today`
  (downgrade rule, [state-transition.md](../model/state-transition.md) section 4); the trace
  must pass `question.trajectory.no-transition-outcome` using the five-year sentence in the
  Situation.
- The session-continuity hard constraint must be satisfied without demanding legacy
  restructuring; a strategy that meets it only via legacy refactoring violates the ceiling.
- A transition architecture here may legitimately become permanent (REQ-STATE-07); a
  candidate acceptable only as scaffolding must be flagged fragile, not recommended as if
  robust.

REQ-TRUST-01 outcome classes allowed (ids per [README.md](README.md)): `trust.hf-community`,
`trust.other-oss`, `trust.commercial`, `trust.no-match`, `trust.change-assumptions`;
`trust.no-mfe` only in the simpler-composition sense (e.g. separate pages behind one proxy
with shared sign-on, per REQ-Q-04), never as "keep building inside the legacy application",
which contradicts the approved and funded decision; `trust.hfe-future` only under the
REQ-AVAIL-02 pairing.

## 4. Trace

Hand-traced 2026-08-29 through the [decision-engine.md](../model/decision-engine.md) pipeline
(E1 to E17), with cells quoted from
[matrix-compact.tsv](../matrix/matrix-compact.tsv) and per-cell conditions from
`matrix/columns/<unit>.json` (version.research 2026.08.0). Subjects: `host` (the new
composition surface), `participant:legacy` (the 2013 application),
`participant:new-capability` (each capability the new team ships).

### 4.1 E1 `engine.step.intake`

The section 2 table is the intake record. Rank 1 fills the ownership facts; the R1
ownership-class batching of question-graph.md 4.2 asks the rank-4 battery twice, once per
class (legacy/maintenance-only, own-team greenfield), not once per application. The
capability-preconditions composite answers first and caps the legacy at level 4 before any
willingness answer is heard (the B4 defense of questions.md 3.4: a willing answer cannot
raise a ceiling the estate cannot cash); the stated willingness then caps it at level 1.
The greenfield class produces no binding at all.

Two intake notes:

- **`engine.rule.horizon-select`**: no integration deadline is stated ("a new six-person team
  starting next quarter" is a start date, not a delivery date), so the governing horizon is
  `migration.horizon.first-integration` by default and the convergence-horizon appetite
  (`migration.rewrite`, level 8) reaches E4 only through the credibility test
  (migration.md section 6). A risk line is emitted for the quarter boundary, no constraint id.
- The seam and navigation preferences arrive as volunteered facts ahead of their unlock edge
  (`question.ux.chrome-persistence` is normally unlocked by a rank-3 yes). They are admitted
  at `class.strong-preference`, which is below the `rel.requires` gate that would presuppose
  `constraint.single-screen-mixing`, so no premature binding follows and rank 3 stays open.

The sign-in requirement is stated at hard force and reaches no constraint id (Model finding 1).

### 4.2 E2 `engine.step.topology-infer`

Ownership evidence: one organization, no external or acquired participant, no
cross-deployment-control loss, multi-repo with independent releases. Against
topology.md section 3 that evidence points at `topology.independent-teams`, not at
`topology.legacy-modernization`: the checklist contains no fact for which
`topology.legacy-modernization` is primary evidence (Model finding 4). The label in the
section 2 row is informational, and the facts that actually make this a legacy-modernization
boundary are capability-precondition facts (maintenance-only, EOL framework, coverage-limited
change budget), which E2's declared inputs do not read. `question.topology.confirm` is shown
and confirmed by the user, which is what rescues the label here.

Priors armed once the label is confirmed (constraints.md 2.15, legacy-modernization row):
hard tendencies `constraint.participant-modification-ceiling` (legacy side only) and
`constraint.framework-major-coexistence` arrive as explicit answer and entailed derivation in
4.3/4.4; `constraint.css-containment` arrives as an explicit answer; preference tendencies
`constraint.strangler-path` and `constraint.cross-boundary-soft-nav` are already answered,
and `constraint.bounded-exit` enters as a `prior-unconfirmed` strong preference whose
confirming question `question.trajectory.bounded-exit` goes to `unresolvedQuestions`.

### 4.3 E3 `engine.step.derive`

Fired:

- `derive.mixed-majors-present` (entailed): the estate runs an end-of-life framework line
  beside the current standard stack and no alignment is funded (the rewrite has been declined
  twice; `buyin.budget` absent on the retirement dimension). Binds
  `constraint.framework-major-coexistence` hard. Under the reading where old and new are two
  different frameworks rather than two majors of one, the same constraint arrives through
  `question.deps.major-coexistence` (rank 11) with the same binding, so the outcome is
  insensitive to that reading.

Not fired, premises absent:

- `derive.unmodifiable-participant-floor`: neither premise holds.
  `ownership.host-unmodifiable-participant`=n (the organization owns the legacy and its two
  maintainers do ship changes) and the appetite is level 1, not
  `migration.no-modification-possible` (9). The ceiling therefore arrives ONLY from the
  explicit rank-4 answer, and at level 1 rather than the derived level 2.
- `derive.legacy-untouchable`: its premise is "no reproducible build"; this legacy builds and
  deploys. The precondition that does fail here (maintenance-only) is not in any rule's
  premise set (Model finding 5).
- `derive.single-coordinated-team` (two teams, and see the robustness note in 4.12),
  `derive.external-principal`, `derive.no-cross-deploy-control`, `derive.broken-governance`,
  `derive.plugin-admission`, `derive.white-label-fit`, `derive.static-estate`,
  `derive.seo-surface` (dispatchers, drivers, and back-office staff sign in; no
  unauthenticated crawlable surface), `derive.regulated-release`, `derive.many-party-drift`
  (two deploying parties), `derive.payload-budget` (no stated budget fact), `derive.b2b-chain`.

### 4.4 E4 `engine.step.compose`

| Constraint | Subject | Class | Params | Slot | Origin |
|---|---|---|---|---|---|
| `constraint.participant-modification-ceiling` | participant:legacy | hard | maxLevel=`migration.trivial-adaptation` | current | answer:question.migration.participant-ceiling; answer:question.migration.capability-preconditions |
| `constraint.framework-major-coexistence` | global | hard | | current | derive.mixed-majors-present; estate fact + unfunded-alignment fact |
| `constraint.css-containment` | boundary legacy/new | hard | | current | answer:question.failure.containment (css follow-up); topology.legacy-modernization prior |
| `constraint.no-forced-remigration` | global | hard (`scope.implementation`) | | current | answer:question.impl.stewardship-floor (no-forced-remigration facet); answer:question.trajectory.no-transition-outcome |
| `constraint.interference-damping` | boundary legacy/new | strong-preference (TRUNCATED from the stated hard answer by the constraint's class ceiling) | | current | answer:question.failure.containment |
| `constraint.seamless-ux` | global | strong-preference | | current | answer:question.ux.seam-tolerance |
| `constraint.persistent-chrome` | global | strong-preference | | current | answer:question.ux.chrome-persistence |
| `constraint.cross-boundary-soft-nav` | global | strong-preference | | current | answer:question.ux.chrome-persistence |
| `constraint.strangler-path` | global | strong-preference (`scope.implementation`) | | current | answer:question.migration.strangler |
| `constraint.bounded-exit` | global | strong-preference (prior-unconfirmed) | | current | topology.legacy-modernization prior |

Two composition events are recorded explicitly:

- **Class-ceiling truncation**: the global-scope-protection answer is stated at hard force,
  but `constraint.interference-damping`'s ceiling is `class.strong-preference` by design
  (constraints.md 2.2: damping is never sold as the answer to a trust requirement). Per E4 a
  ceiling truncates and never errors, so the binding is recorded at the ceiling with the
  truncation noted. Marginal effect on this boundary: none, because every family that
  survives hard `constraint.css-containment` is either realm-separated or damping-capable
  except `family.custom-element-composition`, which the level-1 ceiling eliminates anyway
  (the truncation is active-moot here and decision-relevant on the 4.6b boundary; Model
  finding 6).
- **Stage firewall**: `constraint.no-forced-remigration` is `scope.implementation`, so E4
  records it but E6 refuses it. It is accepted at `stage.implementation` and acts in 4.10.
  The same sentence in the Situation therefore does two different jobs at two stages, which
  `engine.rule.stage-firewall` keeps apart.

Target slots, `predicate.target-credible` per dimension:

- Legacy retirement: confidence ordinal 2 (`theoretical`) is below 5 and below the level-4
  path's entry point; authority (the board) has declined twice, so it is neither held nor
  engaged; no horizon is stated. FAILS. Per E4 (confidence 2 to 3) it is retained as an
  aspiration annotation feeding `rule.aspiration-warning`. `rule.no-target-satisfies-hard`
  blocks it from relaxing the level-1 ceiling in the current-state pass.
- New capabilities outside the legacy: ordinal 4 (`leadership-approved`) plus `buyin.budget`
  plus `buyin.timeline` and `buyin.staffing` meets the calibrated minimum subset; authority
  is held (leadership approved with budget); the horizon is next quarter and survives the 3x
  robustness probe because the legacy keeps running regardless. PASSES. Per
  `rule.target-credibility` it participates only in the E13 second pass.

The sign-in requirement produces no row in this table. That absence is the guardrail-3
failure and is diagnosed in 4.15.

### 4.5 E5 `engine.step.relations`

- No `rel.excludes` pair is jointly hard: `constraint.distinct-principal`,
  `constraint.atomic-release`, `constraint.sync-boundary-calls`, `constraint.payload-dedup`,
  `constraint.static-hosting-only`, `constraint.composed-first-paint`,
  `constraint.no-version-governance`, and `constraint.independent-deploy` are all unbound,
  and `constraint.seamless-ux` / `constraint.persistent-chrome` sit at preference class where
  the exclusion rows do not fire. No warn edges armed, no gap seeds queued.
- `rel.relaxes` on a negated `constraint.single-screen-mixing` is NOT active: rank 3 is
  unanswered and `rule.unanswered-inert` forbids reading silence as the negation. The
  co-residence cluster (ranks 6, 9, 11, 12, 15) is therefore neither unlocked nor pruned; it
  stays behind rank 3.
- `rel.requires`: `constraint.persistent-chrome` presupposes `constraint.single-screen-mixing`.
  Because the chrome binding is only a strong preference, no binding is forced; the
  consequence carried forward is that `family.route-partition` can never satisfy that
  preference (page granularity, by construction), which is priced in 4.7 rather than
  eliminating anything.

### 4.6 E6 `engine.step.eliminate-family` (cells quoted from matrix-compact.tsv)

| Eliminated | Violated binding(s) | Deciding cells |
|---|---|---|
| `family.modular-monolith`, `family.package-composition`, `family.spa-routing`, `family.server-templates`, `family.islands` | `constraint.participant-modification-ceiling`(legacy, maxLevel=1); also `constraint.framework-major-coexistence` | joining an existing separate application is `migration.major-refactor` (6) or `migration.framework-migration` (7): `migration.source-modification-required` = y for modular-monolith, monorepo-package-composition, plain-spa-routing, server-rendered-templates and c for bit/islands-architecture; families.md 5.1 to 5.5 migration fields; `framework.same-framework-major-coexistence` = n for all baseline units |
| `family.module-graph-federation` | ceiling (floor 3 > 1); also `constraint.css-containment` | `migration.participant.min-level` c = `migration.bundler-change` for module-federation ("Rises to migration.bootstrap-change when consuming shared deps non-eagerly") and native-federation ("Demands NF build tooling (level 3) plus entry restructuring"); import-map-architectures level 3 typical, level 1 only "when the app already ships suitable ESM", which a 2013 line does not; `migration.participant.legacy-no-build-viable` = n/n/n; `isolation.css.outbound`/`.inbound` = n/n for all three |
| `family.lifecycle-orchestration` | ceiling (floor 4 > 1); also `constraint.css-containment` | single-spa `migration.participant.min-level` c = "export lifecycles, defer boot, surrender HTML entry"; piral c = "pilet tooling (level 3) plus setup-exporting entry (level 4)"; `legacy-no-build-viable` = n/n ("legacy server-rendered pages cannot satisfy the JS lifecycle contract without refactoring"); `isolation.css.outbound`/`.inbound` = n/n for both |
| `family.custom-element-composition` | ceiling (floor 2 > 1) | web-components-composition `migration.participant.min-level` c = `migration.integration-adapter` ("wrapper layer... around unchanged source"); entando c = "Level 4: entry must define a custom element" plus host level 8 |
| `family.server-fragment-assembly` | ceiling; also `constraint.css-containment` | podium c = "serve manifest and fragment endpoints in front of the unchanged app" (level 2) and server-side-fragment-composition c = "carve a region into a fragment endpoint (adapter around unchanged logic)" (level 2); opencomponents c = whole applications must be decomposed (`migration.major-refactor`); edge-side-composition reaches level 1 only where "an endpoint already returning fragment-suitable HTML participates as-is", which a client-rendered legacy does not supply; web-fragments pierced mode is level 1 but its own cell flags "reframing fidelity for old code untested" (data uncertainty, never read as satisfied, REQ-MATRIX-05). Independently: `isolation.css.outbound`/`.inbound` = n/n for podium, server-side-fragment-composition, edge-side-composition, opencomponents |

Every `Exclusion` record carries all violated bindings with origins
(`rule.monotone-elimination`); the ceiling is the single hard binding present in all nine
exclusions, which is what makes counterfactual 1 of 4.12 the symmetry-duty discharge.

Retained, per configuration (`c` retains only with the cell's condition attached):

- **`family.document-embedding`**, embed-only posture, same-origin serving.
  iframe-composition (family substance): `migration.participant.min-level` c =
  `migration.trivial-adaptation`, condition "already-deployed apps embed unchanged; at most
  serving-config header changes (frame-ancestors/XFO)"; `isolation.css.outbound` = y
  ("cascades never merge across documents"), `isolation.css.inbound` = y ("host styles cannot
  enter the frame document"); `framework.same-framework-major-coexistence` = y;
  `migration.participant.legacy-no-build-viable` = y ("the classic strangler-fig entry
  point"). impl.luigi in iframe mode: min-level c = "migration.trivial-adaptation (embed-only
  by URL)"; `isolation.css.inbound` c = "iframe mode: yes"; coexistence y;
  `legacy-no-build-viable` = y.
  Per-configuration exclusions inside the family: impl.hyperfrontend (min-level c = "hostee
  SDK glue in entry plus feature.config plus hf build", `migration.bootstrap-change` (4) > 1;
  `migration.participant.legacy-no-build-viable` = c not y), and luigi's full-client posture
  (the same cell's other branch, "migration.bootstrap-change (full Luigi Client
  participation)").
  Posture note (families.md 6.3): the family's *recommended* posture is cross-origin
  (`deployment.single-domain-required` = n, "cross-origin hosting is the recommended
  posture"), but this scenario deliberately takes the **same-origin** posture, trading away a
  security boundary it does not need (full organizational trust, `constraint.distinct-principal`
  unbound) to keep one cookie jar. The trade is visible in the cells:
  `isolation.storage.partition` = y applies to "cross-origin frames: third-party storage
  partitioned by default in all 2026 engines", and `isolation.origin.host-authority` = c
  "cross-origin frames only; same-origin frames retain full host-origin authority". This is
  the exact mirror of the third-party-vendor fixture, and it is the point at which the
  missing session constraint would have done its work.
- **`family.virtualized-rehosting`**, HTML-entry configuration, reconstruction mode.
  impl.wujie: min-level c = `migration.trivial-adaptation`, condition "Reconstruction mode
  runs unmodified apps (CORS serving config at most); singleton/alive reuse escalates to
  migration.bootstrap-change" (so the surviving configuration forgoes wujie's keepalive
  ergonomics); `isolation.css.outbound` = y, `isolation.css.inbound` = c "shadow root blocks
  host selectors, but inherited and custom properties flow in; degrade mode's iframe blocks
  fully"; coexistence y; `legacy-no-build-viable` = y.
  impl.web-fragments in client reframing mode retains at family stage on the same shape
  (min-level level 1, outbound y, inbound c, coexistence y) and is removed at stage 2.
  Per-configuration exclusions: impl.qiankun (min-level c = "v2: lifecycle exports (entry
  edit) plus UMD build config", floor 4 > 1; `legacy-no-build-viable` = n; and
  `isolation.css.inbound` = n "No mode scopes host styles away from sub-apps"), and
  impl.micro-app-jd, which clears the ceiling ("best case: fetchable index.html plus CORS")
  but fails hard `constraint.css-containment` on `isolation.css.inbound` = n ("host styles
  leak into the child; docs recommend naming conventions for this direction").
- **`family.route-partition`**, path topology, legacy on the default route.
  reverse-proxy-route-composition (family substance): min-level c =
  `migration.trivial-adaptation`, condition "An app already serving a clean URL subtree joins
  by route claim; interleaved URL spaces push to level 5 (prefix refactor)" (the retained
  configuration keeps the legacy as the default route and carves new prefixes, so no prefix
  refactor is demanded); `isolation.css.outbound`/`.inbound` = y/y ("No host document
  exists"); `legacy-no-build-viable` = y ("Classic strangler entry"). impl.nextjs-multi-zones
  retains on the same ceiling ("Config only (assetPrefix/basePath or a rewrite to an existing
  app)"; `legacy-no-build-viable` = y, "Any HTTP-served legacy system can own paths behind
  the router") with the condition that the legacy stays a foreign zone behind the router.
  impl.cloudflare-workers-microfrontends is excluded on the ceiling: min-level c = "server
  apps need a Workers adapter (bundler-change)" and `legacy-no-build-viable` = n ("legacy
  server stacks cannot run on Workers").
  **Retention dispute**: the family's members score `framework.same-framework-major-coexistence`
  = na ("Never one composed page") and, for nextjs-multi-zones, `isolation.css.*` = na
  ("Zones never co-render on one page; page-granular containment"). Under E6's literal
  cell discipline (`na` never satisfies a hard requirement) hard
  `constraint.framework-major-coexistence` eliminates the whole family, while constraints.md
  2.1 and topology.md 2.5 both retain it explicitly and vacuously. The trace carries the
  constraints.md/topology.md reading with the discrepancy disclosed: see Model finding 3.

Engine-answered guards: `constraint.installable-today` and `constraint.code-ownership`
satisfied uniformly; no question spent.

### 4.6b The alternative boundary (composition direction)

The Situation licenses a second boundary shape that the model has no question for (Model
finding 2): "we can change its configuration and perhaps add a script tag" is a host-side
level-1 statement, i.e. the legacy could be the HOST and each new capability a participant.
Evaluated as its own boundary with `constraint.host-modification-ceiling`(host=legacy,
maxLevel=`migration.trivial-adaptation`) hard and no participant ceiling at all:

- `family.custom-element-composition` survives: web-components-composition
  `migration.host.min-level` c = "add the tag and script URL to host markup; adoption is
  per-tag" (level 1), and the participant is greenfield.
- `family.document-embedding` survives: iframe-composition `migration.host.min-level` c =
  "host adds an iframe tag; no build tooling, tier, or re-rooting".
- `family.route-partition` survives: reverse-proxy `migration.host.min-level` c = "Configure
  a routing tier in front; no application source changes".
- `family.virtualized-rehosting` is eliminated here: wujie host floor c = "Host entry
  installs the runtime and mounts children via wrappers or startApp", micro-app-jd host floor
  c = "host installs the package, calls microApp.start() in its entry", both above level 1.

On this boundary the E4 class-ceiling truncation stops being moot:
`family.custom-element-composition` is a shared JS realm ("JavaScript is not isolated at
all", families.md 3.3), so a hard reading of the global-scope requirement would eliminate it,
and `constraint.interference-damping` cannot carry a hard reading. The engine emits both
boundary shapes only as prose today (Model finding 8).

### 4.7 E7 `engine.step.rank-family`

All three survivors satisfy the hard set. `engine.rule.candidate-order`:

1. **`family.document-embedding`** (iframe-composition and impl.luigi, embed-only,
   same-origin), `status.match.viable`: the hard set is satisfied on `y` cells with no
   posture condition (rule 1 puts viable ahead of both conditionals). Violates
   `constraint.seamless-ux` at strong (`ux.natural-layout-flow` = n, "fixed rectangle;
   height-reporting is the workaround"), which the answer already declared compromisable at
   preference class. `ux.persistent-shared-chrome` = y satisfies the chrome preference;
   `ux.cross-boundary-soft-nav` = c "host shell persists (no top-level unload) but the
   destination frame is a full document fetch, parse, and boot" is carried as a condition,
   never as satisfaction. Fit flags: `fit.architectural` holds (browser-enforced containment
   in both CSS directions, coexistence y); `fit.organizational` holds (the legacy is
   untouched at level 1 and its two maintainers are asked for nothing);
   `fit.operational` holds with the seam-engineering and per-unit-document-boot costs named
   (`performance.per-unit-document-boot` = y, `constraint.memory-budget` cost note per
   constraints.md 2.12, never eliminating); `fit.transition-dependent` no.
2. **`family.virtualized-rehosting`** (impl.wujie, reconstruction mode),
   `status.match.conditional` (conditions: reconstruction mode only, no singleton/alive
   reuse; `isolation.css.inbound` = c, inherited and custom properties still flow in).
   Violates NO bound strong preference: `ux.natural-layout-flow` = y ("Child content flows in
   the host page"), `ux.persistent-shared-chrome` = y, `ux.cross-boundary-soft-nav` = y. It
   is the strongest UX fit in the set and it costs a conditional CSS boundary plus the
   stage-2 stewardship picture of 4.10. `performance.sandbox-execution-tax` = n (a real
   iframe realm, not a proxy-window tax), `performance.per-unit-document-boot` = y.
3. **`family.route-partition`** (reverse-proxy-route-composition, impl.nextjs-multi-zones),
   `status.match.conditional` (conditions: the legacy keeps the default route, no URL-prefix
   refactor; plus the na-vacuity reading of 4.6). Violates TWO bound strong preferences,
   both named: `constraint.persistent-chrome` (`ux.persistent-shared-chrome` = n, "Chrome
   re-renders per app; in-memory chrome state is lost at every crossing") and
   `constraint.cross-boundary-soft-nav` (`ux.cross-boundary-soft-nav` = n, "Hard navigation
   at every ownership boundary is the defining property"). Against that it carries the
   landscape's most durable evidence (`migration.permanent-viability` = y, "Consensus
   most-common real-world MFE shape"), one accessibility tree per page
   (`ux.screenreader-continuity` = y), inherent deep links (`ux.deep-link-inner-route` = y),
   and `migration.strangler.incremental` = y with the condition text that names this exact
   scenario ("default-route the legacy, carve one prefix at a time").

Ordering justification: 1 vs 2 by rule 1 (viable before conditional); 2 vs 3 by rule 2
(zero named strong-preference violations vs two). Rule 4 is not reached, so no adjacency is
reported as arbitrary. REQ-Q-04 is served: three candidates with the remaining tradeoff
stated as a genuine three-way choice (browser-enforced boundary and a visible seam; the best
seamless UX at a conditional boundary and a bus-factor-1 steward; the most durable and
lowest-technology option at the price of the two navigation preferences).

Disclosure duty: candidate 3's survival is contingent on Model finding 3, and candidate 3 is
eliminated outright by a rank-3 yes (`runtime.concurrent-participants` = n for
reverse-proxy-route-composition, nextjs-multi-zones, cloudflare-workers-microfrontends). The
report says so.

### 4.8 E8 `engine.step.dominance`

- **`dominance.html-entry-at-low-ceiling`**: ACTIVE (condition: rank 4 bound maxLevel <= 2
  for a participant; here maxLevel = 1 for `participant:legacy`). Inside
  `family.virtualized-rehosting` the HTML-entry members dominate the bootstrap-lineage member,
  so no stage-2 question discriminates impl.qiankun; qiankun is independently excluded by the
  ceiling and by `isolation.css.inbound` = n. Disclosed with its condition.
- **`dominance.browser-boundary-over-simulated-realm`**: INACTIVE, condition
  `constraint.distinct-principal` hard is not bound. This is why
  `family.virtualized-rehosting` is a live and well-ranked candidate here where it was
  eliminated outright in the third-party-vendor fixture. Disclosed as inactive with the
  failing condition, because the difference between the two fixtures rests entirely on it.
- **`dominance.route-partition-over-coresident-runtimes`**: INACTIVE on two of three
  conditions (rank 3 is unanswered rather than answered no; `constraint.persistent-chrome`
  and `constraint.cross-boundary-soft-nav` ARE required at preference class). Recorded
  because it is one answer plus one withdrawn preference away from firing, which would close
  the family stage on candidate 3.
- `dominance.fused-baselines-over-mfe`, `dominance.fusion-subsumes-drift-and-dedup`,
  `dominance.static-subsumes-infra-tier`: inactive (no `derive.single-coordinated-team`, no
  train answer, no static-hosting binding).

### 4.9 E9 `engine.step.next-question` and emission shape

Askable set: `question.granularity.single-screen` (rank 3, spine, unanswered),
`question.deploy.independence` (rank 2, spine, unanswered),
`question.delivery.server-capacity` (rank 7, spine), the `constraint.a11y-continuity` facet
of rank 10, `question.trajectory.bounded-exit`, and the stage-2 lens block. Ranks 6, 9, 11,
12, 15 are unreachable: their unlock edge is a rank-3 yes. Rank 11's binding already arrived
by derivation, so R3 derivation-first would suppress it anyway.

Selection table over S = 3 families (worst-case gains, member lists kept):

| Candidate q | guaranteed | expected class | reach (G2) |
|---|---|---|---|
| `question.granularity.single-screen` | 0 (the page-seams answer eliminates nothing) | common | largest in the set: yes unlocks `question.ux.chrome-persistence` follow-through plus ranks 6, 9, 11, 12, 15; no prunes all of them and can activate `dominance.route-partition-over-coresident-runtimes` |
| `question.deploy.independence` | 0 | rare (the atomic-release answer) | moderate |
| `question.delivery.server-capacity` | 0 | rare (a 400,000-line 2013 estate is server-operating by construction) | warn edge to rank 8 |
| rank 10 a11y facet | 0 | plausible (3,000 field users, no stated legal mandate) | none |
| `question.trajectory.bounded-exit` | 0 | plausible | none |

argmax by (guaranteed = 0 tie, then expected class, then reach):
`question.granularity.single-screen` is asked next. Note what the dynamic computation does to
the static ranking: rank 2 is the landscape's single largest guaranteed splitter
(5 of 12 families either way, questions.md section 2) and here its guaranteed gain is zero,
because the level-1 ceiling has already removed every baseline. `rule.next-question` computes
over the current survivor set, not the static ranking, and this fixture is the clean
demonstration.

`question.trajectory.no-transition-outcome` is asked before emission because a
`fit.transition-dependent` slot entry is pending (question-graph.md 1.3). The Situation
answers it: "If the old application is still here in five years, whatever we set up now has
to still be acceptable."

The fixture supplies no further answers, so emission is `rule.conditional-output` shape 2
(conditional), with each still-eliminating answer named in
`unresolvedQuestions.couldStillChange`, and shape 3 semantics additionally in force for the
E13 aspiration slot.

### 4.10 E10 to E12: stage 2 and the availability lens

Members evaluated in their surviving configurations only. One implementation-stage constraint
is bound hard, `constraint.no-forced-remigration` (the five-year sentence), binding
`migration.forced-remigration-pending` = n AND `migration.permanent-viability` = y.

| Candidate | Config | no-forced-remigration cells | Availability (independent factor) |
|---|---|---|---|
| iframe-composition (practice unit; family substance, no impl record) | embed-only, same-origin | `forced-remigration-pending` = n ("browser primitive; no EOL possible"); `permanent-viability` = y ("perennial platform capability with multi-decade production evidence") | n/a (browser primitive); `unit.availability.stable-line-shipped` = na, "evergreen browsers"; `operations.single-sponsor-concentration` = n |
| reverse-proxy-route-composition (practice unit) | path topology, legacy on default route | n / y ("Consensus most-common real-world MFE shape; decades of proxy routing") | n/a (commodity infrastructure); `single-sponsor-concentration` = n; `unit.maintenance.release-within-12mo` = c "varies by implementation" |
| impl.luigi | iframe mode, embed-only by URL | n / y ("Long-lived SAP-stewarded enterprise shell... positioned as permanent architecture, not scaffolding") | `avail.available` (core 2.31.0); `org-steward` = y, `multi-maintainer` = y, `stable-line-shipped` = y; `adoption-outside-sponsor` = ? and `adoption-scale-10k` = n (SAP-internal gravity); `single-sponsor-concentration` = y |
| impl.nextjs-multi-zones | foreign zone behind the router | n / y | `avail.available`; `org-steward` = y, `multi-maintainer` = y, adoption y/y; `unit.license.osi-core` = c; `single-sponsor-concentration` = y |
| impl.wujie | reconstruction mode | `forced-remigration-pending` = n ("v2 is the current line since June 2026; no announced EOL"); `permanent-viability` = **c**, condition "long production adoption supports staying, but the 2024-2025 stall, bus-factor risk, and fork history temper permanence" | `avail.available` (2.1.0, `stable-line-shipped` = y, `single-current-line` = y) but `multi-maintainer` = n, `adoption-scale-10k` = n (~5.6k weekly), `single-sponsor-concentration` = y |

Excluded at stage 2, with origin chains:

- **impl.web-fragments** (client reframing mode): `migration.permanent-viability` = n, "Pre-1.0,
  stalled cadence, no independent multi-year adopters; permanence unsupported by evidence
  today". Origin: answer:question.trajectory.no-transition-outcome ->
  `constraint.no-forced-remigration`. This is guardrail 4 firing: the only survivor that is
  acceptable purely as scaffolding is removed rather than recommended as robust.
- **impl.hyperfrontend**: excluded twice over and on two different boundaries.
  (a) On `participant:legacy` at E6, `migration.participant.min-level` c = "hostee SDK glue in
  entry plus feature.config plus hf build" (`migration.bootstrap-change`, 4 > 1); origin
  answer:question.migration.participant-ceiling.
  (b) On every boundary at E10, `migration.forced-remigration-pending` = y, "pre-1.0: breaking
  wire changes permitted and have occurred; adopters track a fast-moving contract", against
  the five-year requirement; `migration.permanent-viability` = c. `impl.hyperfrontend.enterprise`
  is `avail.announced-planned` throughout and satisfies no binding (REQ-AVAIL-01); no
  `status.match.future-potential` record is produced, because no planned capability fits a
  need the shipping candidates do not already satisfy, so REQ-AVAIL-02 has nothing to pair
  (REQ-MISSION-01: the sponsor's elimination is stated, not steered around).
- **impl.qiankun** (ceiling and `migration.forced-remigration-pending` = y, "v2 to v3 is a
  breaking rearchitecture... with v3 still RC"), **impl.micro-app-jd** (E6,
  `isolation.css.inbound` = n), **impl.cloudflare-workers-microfrontends** (E6, ceiling).

Lens constraints NOT bound (no `question.impl.stewardship-floor` floors stated beyond the
permanence facet): `constraint.maintenance-activity`, `constraint.stewardship-durability`,
`constraint.adoption-evidence`, `constraint.stable-line`. Per `engine.rule.availability-lens`
their cells are carried beside the candidates and never re-order them: impl.wujie's
`multi-maintainer` = n and `single-sponsor-concentration` = y do not move it below
`family.route-partition`, and the report must say that a stated stewardship floor is the
cheapest answer that would.

E11: no operability question answered, no `derive.b2b-chain`, no
`question.edition.operability.managed-service-preference` answer, so no commercial edition is
selected and none is eliminated. `impl.nextjs-multi-zones.oss` suffices for the routing
boundary (`framework.composition-tier-stack-mandated` = no, "Any HTTP proxy suffices as the
routing tier"), so `impl.nextjs-multi-zones.vercel-platform` is shown as an operating option,
never as a requirement.

### 4.11 E13 `engine.step.dual-output`

`slots.bestToday`: the 4.7 ordering with the 4.10 member lists. It depends on no aspiration:
every hard binding that produced it has `slot: state.current` in the 4.4 table.

`slots.bestAfterTransition` is produced, and it carries two distinct things:

- **The credible target** (new capabilities outside the legacy, ordinal 4 plus the buy-in
  subset): a full second pass is run with its bindings added. The survivor set, the ordering,
  and the stage-2 member lists are UNCHANGED, because the target's architectural content is a
  greenfield participant class (which contributes no ceiling, migration.md section 2) plus
  funded host-side work (which leaves `constraint.host-modification-ceiling` unbound on the
  new surface). `rule.dual-slot-divergence` therefore cites no septet for this dimension and
  the report states the non-divergence explicitly rather than silently omitting the slot.
- **The non-credible aspiration** (legacy retirement, ordinal 2): per
  `rule.aspiration-warning` the slot carries a warning-annotated conditional, not a
  recommendation. Content: if the legacy is ever retired, the composition boundary dissolves
  and the honest answer for the remaining estate is a baseline
  (`family.spa-routing` / `family.modular-monolith` / `family.package-composition`, families.md
  section 5), `status.match.conditional`, `fit.transition-dependent` true,
  `dependsOnTransitions: [{dimension: legacy-retirement, confidence:
  transition.confidence.theoretical}]`, missing signals listed (`buyin.budget`,
  `buyin.timeline`, `buyin.staffing`, `buyin.governance-plan`, and
  `buyin.executive-sponsorship` recorded as refused rather than absent: the board declined
  twice). The `question.trajectory.no-transition-outcome` answer is attached: the today
  architecture must remain acceptable permanently, which is why it was bound as a hard
  implementation-scope constraint in 4.4 rather than left as a hope.

`rule.no-target-satisfies-hard` is exercised concretely: "the rewrite will happen eventually"
does not raise the legacy's level-1 ceiling, so `family.module-graph-federation` and
`family.lifecycle-orchestration` stay in `excludedStrategies` in both slots.

### 4.12 E14 to E16: gaps, relaxation, counterfactuals

`gapRecords`: empty. Three families survive, no candidate space is emptied, and no
gap-trigger constraint (`constraint.artifact-integrity`, `constraint.rsc-federation`) is
bound. The unbindable sign-in requirement is NOT a gap record: a `GapRecord` names jointly
unsatisfiable hard bindings, and this requirement is satisfiable by the retained candidates.
It is a modeling gap, not a landscape gap, and it belongs in 4.15.

`relaxationOffers`: empty (REQ-GAP-01 not triggered).

`counterfactuals`:

1. **(source 1, relaxation ledger row for `constraint.participant-modification-ceiling`,
   walked ordinally)** Raise the legacy ceiling to `migration.integration-adapter` (2, an
   adapter written and paid for by the new team around unchanged legacy source):
   `family.custom-element-composition` returns on the ceiling (web-components-composition,
   "wrapper layer... around unchanged source") at `status.match.conditional`
   (`isolation.css.inbound` = c), and `family.server-fragment-assembly` returns on the
   ceiling (podium, server-side-fragment-composition at floor 2) but stays excluded by hard
   `constraint.css-containment` (`isolation.css.outbound`/`.inbound` = n/n). To
   `migration.bundler-change` (3): `family.module-graph-federation` returns on the ceiling
   and stays excluded by css-containment and by the `coordination.shared-dependency-governance`
   = y price. To `migration.bootstrap-change` (4): `family.lifecycle-orchestration`,
   impl.qiankun, and impl.hyperfrontend's hostee posture return on the ceiling;
   impl.hyperfrontend remains excluded by hard `constraint.no-forced-remigration`
   (`migration.forced-remigration-pending` = y). To `migration.major-refactor` (6+): the five
   baselines return via extraction, which is the funded-rewrite path, i.e. exactly the
   aspiration that sits at confidence 2. This is the migration.md section 5 counterfactual
   duty and it discharges section 6's symmetry duty for all nine excluded families, since the
   ceiling is a violated binding in every one of their exclusions.
2. **(source 2, dominance conditions)** Withdrawing the maxLevel <= 2 condition dissolves
   `dominance.html-entry-at-low-ceiling` and unlocks qiankun discrimination. Conversely,
   answering rank 3 "page seams are acceptable" AND withdrawing the chrome and soft-nav
   preferences activates `dominance.route-partition-over-coresident-runtimes` and closes the
   family stage on `family.route-partition` alone.
3. **(source 3, unanswered eliminating answers; the same records
   `unresolvedQuestions.couldStillChange` cites)**
   - rank 3 answered yes-hard: `family.route-partition` becomes `status.match.incompatible`
     (`runtime.concurrent-participants` = n for all three members), leaving the two
     co-resident survivors.
   - `constraint.seamless-ux` escalated to hard: `family.document-embedding` becomes
     incompatible (`ux.natural-layout-flow` = n); jointly with a rank-3 yes only impl.wujie's
     conditional candidate remains, and the report must present that as one conditional
     candidate rather than a clean recommendation.
   - `constraint.a11y-continuity` hard: the iframe candidate is conditioned on
     `ux.screenreader-continuity` = c ("assistive tech traverses frame content normally but
     each frame needs a title attribute"), impl.wujie on its own c ("normal mode: one
     continuous tree through shadow roots; degrade mode renders child DOM inside an iframe"),
     and `family.route-partition` is favored (`ux.screenreader-continuity` = y).
   - rank 2 answered atomic-release-hard: this does NOT select the baselines, because the
     level-1 ceiling already removed them; the candidate space empties and the engine emits
     `status.assessment.no-current-strong-match` with a `GapRecord` naming
     `constraint.atomic-release` + `constraint.participant-modification-ceiling` and the
     ledger's independent-deploy/atomic-release relaxation offers. The bar is never lowered
     silently (REQ-GAP-01).
4. **(source 4, credibility flips)** If legacy retirement reaches
   `transition.confidence.teams-committed` (5), or `leadership-approved` (4) plus
   `buyin.budget` and one of timeline/staffing, re-run: `slots.bestAfterTransition` gains the
   baselines as a genuine candidate through the level-6 extraction path, the composition
   becomes scaffolding with a funded end date, and `constraint.no-forced-remigration` may
   legitimately relax, readmitting impl.web-fragments and impl.hyperfrontend to the
   implementation set.
5. **(robustness probe on the contrary reading)** If `ownership.single-team` were answered yes
   and `derive.single-coordinated-team` fired, it would re-class
   `constraint.independent-deploy`, `constraint.no-version-governance`,
   `constraint.framework-major-coexistence`, and `constraint.runtime-roster-change` to
   irrelevant, but the baselines would STILL be excluded, because
   `constraint.participant-modification-ceiling` is untouched by that re-class and the legacy
   joins a single build only at level 6. The brief's prohibition on reading `trust.no-mfe` as
   "keep building inside the legacy application" is therefore structurally enforced, not
   merely asserted.

### 4.13 E17 emission, outcome class, derivation sample

Outcome class: **`trust.other-oss`**. The candidate ordering is headed by vendor-neutral
browser and infrastructure practice (iframe-composition, reverse-proxy-route-composition)
with OSS implementations beside them (impl.luigi Apache-2.0, impl.wujie MIT,
impl.nextjs-multi-zones MIT core). No product adoption is required by the leading candidate.
The third candidate is reportable in the brief's sanctioned simpler-composition sense
("separate pages behind one proxy with shared sign-on"), but the engine vocabulary lands on
`trust.other-oss` rather than `trust.no-mfe`, because `family.route-partition` is an MFE
family and neither `derive.single-coordinated-team` nor the rank-2 train branch fired
(decision-engine.md section 7 rows). impl.hyperfrontend sits in `excludedStrategies` with two
origin chains and its counterfactual.

```text
Recommendation: family.document-embedding (embed-only, same-origin)        [viable]
Recommendation: family.virtualized-rehosting (wujie, reconstruction mode)  [conditional]
Recommendation: family.route-partition (path topology, legacy default)     [conditional]

Why:
+ the legacy integrates unmodified                 (migration.participant.min-level = migration.trivial-adaptation; migration.participant.legacy-no-build-viable = y)
+ new code is shielded from the legacy cascade     (isolation.css.outbound = y, isolation.css.inbound = y for iframe-composition; c with condition for wujie)
+ old and new framework lines coexist indefinitely (framework.same-framework-major-coexistence = y)
+ the arrangement is still acceptable in 5 years   (migration.permanent-viability = y; migration.forced-remigration-pending = n)

Tradeoffs accepted:
~ document-embedding: seam engineering vs one-document flow   (ux.natural-layout-flow = n; constraint.seamless-ux violated at strong)
~ virtualized-rehosting: no keepalive at level 1, inbound CSS leaks inherited properties, bus-factor-1 steward (migration.participant.min-level condition; isolation.css.inbound = c; unit.maintenance.multi-maintainer = n)
~ route-partition: chrome remount and hard navigation at every crossing  (ux.persistent-shared-chrome = n; ux.cross-boundary-soft-nav = n)

Derived from:
question.migration.capability-preconditions -> "maintenance-only, coverage-limited"
question.migration.participant-ceiling -> "config and a script tag"
  -> constraint.participant-modification-ceiling(participant:legacy, maxLevel=migration.trivial-adaptation)
estate fact (EOL line beside current stack) + unfunded alignment -> derive.mixed-majors-present
  -> constraint.framework-major-coexistence
question.trajectory.no-transition-outcome -> "must still be acceptable in five years"
  -> constraint.no-forced-remigration (scope.implementation)
```

### 4.14 Guardrail verification (brief section 3)

| Guardrail | Result |
|---|---|
| Appetite per participant, never per organization: any strategy requiring the legacy to exceed `migration.trivial-adaptation` is eliminated, while the new code is free | **PASS** at E4/E6. The binding carries `subject: participant:legacy` and `maxLevel = migration.trivial-adaptation`; no ceiling binding exists for `participant:new-capability` (level 0 is a circumstance, migration.md section 2). Nine families are excluded with their `migration.participant.min-level` conditions quoted, and the same units stay admissible for the greenfield boundary: impl.hyperfrontend is excluded on the legacy boundary at E6 and only later, on a different binding, at E10. Caveat recorded as Model finding 8: `EngineOutputs` has no per-boundary survivor sets, so the "new code is free" half is expressible only as prose and as 4.6b |
| The unfunded rewrite (confidence 2) must not influence `recommendation.best-today`; the trace must pass `question.trajectory.no-transition-outcome` | **PASS** at E4/E9/E13. `predicate.target-credible` fails on all three legs (ordinal 2 < 5 and below the level-4 entry; authority declined twice; no horizon), so the target is set aside as an annotation; every hard binding in the 4.4 table carries `slot: state.current`; `rule.no-target-satisfies-hard` blocks the aspiration from raising the ceiling, verified in counterfactual 1 and probe 5. `question.trajectory.no-transition-outcome` is asked at E9 before emission and answered from the five-year sentence, which then binds `constraint.no-forced-remigration` hard at `scope.implementation` |
| Session continuity satisfied without demanding legacy restructuring; a strategy meeting it only via legacy refactoring violates the ceiling | **FAIL (model bug; fixture not patched, REQ-ORCH-11).** Settled at E1/E4: the requirement produces no `ConstraintBinding`, because constraints.md section 2 contains no session/identity constraint at `scope.family` and questions.md section 8's coverage table has no route to one; the nearest ids are `scope.edition` (`constraint.operability.identity.*`), which `engine.rule.stage-firewall` forbids from eliminating families. Under `rule.unanswered-inert` the requirement is therefore inert, and `satisfiedConstraints` cannot carry it, so no `engine.rule.full-chain` derivation exists for the claim "session continuity holds". The SECOND clause passes transitively: any mechanism that meets it by making the legacy adopt an auth SDK or token handshake raises its `migration.participant.min-level` above 1 and is eliminated by the ceiling (impl.hyperfrontend, level 4, is the worked instance). The FIRST clause fails: the retained candidates do satisfy it on the cells (`isolation.storage.partition` = n for wujie, "Same-origin children share host cookies, localStorage, IndexedDB"; = n for nextjs-multi-zones, "All zones share one origin: cookies, storage, service workers are common"; = c for reverse-proxy, "path-based: single origin, all storage and service workers common property"; iframe-composition at the same-origin posture, where the `= y` partitioning note applies to cross-origin frames only), but the engine did not derive that, it fell out of the survivor set. Diagnosis and fix: Model finding 1 |
| A transition architecture may legitimately become permanent; a scaffolding-only candidate must be flagged fragile, not recommended as robust | **PASS** at E10/E12. `constraint.no-forced-remigration` bound hard removes impl.web-fragments (`migration.permanent-viability` = n, "permanence unsupported by evidence today") and impl.hyperfrontend / impl.qiankun (`migration.forced-remigration-pending` = y); it retains impl.wujie only conditionally with its `c` condition attached verbatim ("the 2024-2025 stall, bus-factor risk, and fork history temper permanence"), and E12 carries the stewardship facts beside it without re-ranking. The two heads carry `migration.permanent-viability` = y and are recommended as robust on evidence, not on hope |

### 4.15 Model findings

Eight findings, surfaced by the trace per REQ-ORCH-08 and belonging to the model, not the
fixture (REQ-ORCH-11). Finding 1 is the guardrail failure.

1. **No `constraint.session-continuity` exists** (layer: taxonomy, with an evidence-layer
   tail). topology.md 2.5 names "navigation, session, and visual continuity across the old/new
   seam" as a pressure that "often escalate[s] to hard for user-facing products", but
   constraints.md 2.15's legacy-modernization row translates only the visual and navigational
   halves (`constraint.cross-boundary-soft-nav`) and drops the session half; constraints.md
   section 2 defines no id for it at `scope.family`, and questions.md section 8's coverage
   table lists no route. The deciding atoms already exist and are already scored
   (`deployment.single-domain-required`, `isolation.storage.partition`,
   `isolation.origin.host-authority`, `security.cross-origin-boundary`,
   `deployment.cross-origin-cors-required`), but nothing composes them into a predicate.
   The gap is not cosmetic: it decides the document-embedding posture (cross-origin, the
   family's recommended posture, partitions storage and breaks one sign-in; same-origin does
   not), and it decides whether virtualized rehosting is admissible at all, since wujie
   executes the rehosted legacy under the HOST origin (`isolation.origin.host-authority` = n,
   `deployment.cross-origin-cors-required` = y), which changes which cookie jar the legacy's
   own backend calls carry.
   Proposed fix: add `constraint.session-continuity` to constraints.md 2.5, scopes
   `scope.family` + `scope.implementation`, default `class.strong-preference`, ceiling hard,
   binding the five atoms above (with `isolation.storage.partition` = y satisfying only under
   an explicit token-propagation condition); reach it from a new question
   `question.identity.session-continuity` gated on survivors that span origins, and arm it as
   a hard tendency in the 2.15 legacy-modernization and acquisition rows. Add its ledger row
   to 6.1 ("accept a second sign-in at the seam, or fund a token-propagation protocol") and a
   `rel.excludes` row against `constraint.distinct-principal`, since cross-origin
   partitioning is simultaneously what makes a security boundary and what breaks a shared
   session; that pair is a new gap seed (`gap.partitioned-session`) for constraints.md 6.3.
2. **The composition-direction question has no id** (layer: taxonomy). topology.md 2.5 lists
   "Which direction does composition run (new inside old, old inside new, or side by side
   under a shell)?" among its unlocked follow-ups, but questions.md adopts no id and
   question-graph.md 1.3 has no edge for it. The answer assigns which subject is `host` and
   which is `participant:*`, and therefore which ceiling binds; in this fixture it changes the
   survivor set (4.6b: `family.custom-element-composition` survives on the legacy-as-host
   boundary and is eliminated on the legacy-as-participant boundary, and
   `family.virtualized-rehosting` does the reverse). It is the single highest-leverage
   unanswered fact here and the engine cannot ask it.
   Proposed fix: adopt `question.composition.direction` as a rank-4 sibling (or an explicit
   facet of `question.migration.host-ceiling`) whose answers assign the `host` /
   `participant:*` subjects for each boundary, unlocked by the acquisition and legacy facts,
   and add the `edge.unlocks` row.
3. **`na` cells versus definitional vacuity** (layer: interpretation codified into logic).
   E6's cell discipline says `na` never satisfies a hard requirement (REQ-MATRIX-05), while
   constraints.md 2.1 retains `family.route-partition` under hard `constraint.css-containment`
   ("vacuous: no co-residence") and topology.md 2.5 retains it under hard
   `constraint.framework-major-coexistence` ("plus, vacuously, `family.route-partition`"). The
   deciding cells are `isolation.css.outbound`/`.inbound` = na for nextjs-multi-zones ("Zones
   never co-render on one page") and `framework.same-framework-major-coexistence` = na for all
   three members ("Never one composed page"). A literal E6 re-check eliminates the family the
   topology model names as this scenario's strangler carrier, and with it the brief's own
   sanctioned `trust.no-mfe` reading. This is the same defect class as the
   third-party-vendor fixture's Model finding 1 (a constraints.md prose retention that the
   cell-level re-check contradicts), reached from a different constraint and a different
   family, which argues for a general fix rather than a per-cell rescore.
   Proposed fix: add a `vacuousAt: [pole ids]` field to the co-residence-cluster constraints
   (`constraint.css-containment`, `constraint.fault-containment`,
   `constraint.framework-major-coexistence`, `constraint.interference-damping`,
   `constraint.payload-dedup`). E6 then satisfies the predicate on an `na` cell exactly when
   the candidate occupies a listed pole (here `granularity.page` / `realm.serial-documents`)
   and leaves `na` unsatisfying everywhere else, so REQ-MATRIX-05's "not evidenced" case is
   untouched and the definitional case becomes data rather than prose.
4. **`topology.legacy-modernization` is unreachable from E2's declared inputs** (layer:
   evidence). E2 is parameterized by `ownership.*` facts against topologies.json, and
   topology.md section 3's checklist names `topology.legacy-modernization` as primary evidence
   for zero of its eleven facts (it appears only in the "Also consistent with" column of
   `ownership.single-team` and `ownership.host-unmodifiable-participant`, and neither holds
   here: this organization can modify its legacy, it just will not). The facts that make this
   boundary a legacy modernization are capability preconditions from migration.md section 8.
   Consequence: the label, and with it the 2.15 priors row that arms
   `constraint.css-containment` as a hard tendency, is reachable only because
   `question.topology.confirm` lets the user assert it.
   Proposed fix: add `ownership.maintenance-only-participant` (or `ownership.frozen-participant`)
   to topology.md section 3 with `topology.legacy-modernization` as primary evidence, sourced
   from the capability-precondition composite the graph already asks, and let E2 read
   capability-precondition facts alongside `ownership.*`.
5. **`derive.legacy-untouchable`'s premise is narrower than migration.md section 8** (layer:
   logic). Its premise is "no reproducible build", but section 8 states three capability
   preconditions, and this fixture fails a different one: maintenance-only mode, which caps
   appetite below level 5 "regardless of willingness". No `derive.*` rule encodes that cap, so
   in an estate whose rank-4 answer is missing the maintenance-only fact binds nothing
   (`rule.unanswered-inert`) and the cap is silently lost.
   Proposed fix: convert the premise to a `PremiseGroup` of mode `any` over the three
   preconditions, with the derived `maxLevel` keyed to which one fails (no source or rights:
   2; no reproducible build: 2; maintenance-only: 4), keeping the rule entailed.
6. **`constraint.interference-damping`'s class ceiling blocks a legitimate hard requirement**
   (layer: taxonomy). Its ceiling is `class.strong-preference` with the rationale "never sell
   damping as the answer to a trust requirement" (constraints.md 2.2, taxonomy.md 3.1). That
   rationale is trust-specific, and this fixture's requirement is not a trust requirement:
   the parties are one organization with full mutual trust, and the ask is accident
   containment against a fragile artifact. The stated hard answer is truncated at E4. Moot on
   the primary boundary, decision-relevant on the 4.6b boundary, where it is the only thing
   that would eliminate `family.custom-element-composition`'s fully shared JS realm.
   Proposed fix: split the id into `constraint.interference-damping` (ceiling strong, the
   trust-adjacent reading, unchanged) and a new `constraint.global-scope-containment`
   (ceiling hard, binding `isolation.js.virtualized-global`, `isolation.dom.virtualized`,
   `runtime.global-registration-collision`, `runtime.primordials-blast-radius`), bound only
   when `constraint.distinct-principal` is NOT bound, so the honesty rule that motivated the
   ceiling still cannot be routed around.
7. **`constraint.css-containment` has no relaxation-ledger row** (layer: logic). It is a hard
   tendency of `topology.legacy-modernization` (constraints.md 2.15), it is one of the two
   eliminating constraints in this trace, and constraints.md 6.1 has no row for it, so
   E15/E16 source 1 can generate neither an offer nor an elimination-inversion counterfactual
   from it. Eight further family-scope hard-capable constraints are also missing rows:
   `constraint.main-thread-protection`, `constraint.a11y-continuity`,
   `constraint.participant-self-containment`, `constraint.no-host-change-per-participant`,
   `constraint.no-new-infra-tier`, `constraint.cross-boundary-soft-nav`,
   `constraint.bounded-exit`, `constraint.payload-dedup`. The symmetry duty is discharged here
   only because the ceiling co-excludes every family that css-containment excludes; a
   legacy-modernization boundary with a level-4 appetite would emit a hard elimination with no
   counterfactual at all.
   Proposed fix: add the nine rows. For `constraint.css-containment` the smallest meaningful
   relaxation is "accept convention-based scoping (prefixing, PostCSS namespacing) instead of
   an enforced mechanism", reopening `family.server-fragment-assembly`,
   `family.module-graph-federation`, and `family.lifecycle-orchestration` with the
   page-global-cascade cost cited from families.md 3.2/3.4/3.5.
8. **`EngineOutputs` has no per-boundary survivor sets** (layer: logic).
   `ConstraintBinding` carries `subject` (constraints.md 1.4) and topology.md section 1 makes
   topology a per-boundary property, but `candidateStrategies`, `excludedStrategies`, and
   `candidateImplementations` are flat: a family excluded for `participant:legacy` is excluded
   full stop, with no way to record that it remains admissible for
   `participant:new-capability`. Guardrail 1's "the new code is free" half is therefore
   expressible only in prose and in the 4.6b subsection, and a legitimate real answer here
   (route-partition or embedding at the legacy seam, plus a build-fused baseline inside the
   new estate) cannot be emitted as a structured recommendation.
   Proposed fix: give `CandidateResult` a `boundary` (or `subject`) field and emit the
   candidate lists per boundary, mirroring the field `ConstraintBinding` already carries;
   `slots.bestToday` then holds one ordering per boundary and the report composes them.

### 4.16 Regression expectations

Stable assertions any engine implementation must reproduce for this fixture:

- Outcome class `trust.other-oss`. Never `trust.hf-community`: impl.hyperfrontend must appear
  in `excludedStrategies` with TWO origin chains, the E6 chain
  (`constraint.participant-modification-ceiling`(participant:legacy, maxLevel=`migration.trivial-adaptation`)
  against `migration.participant.min-level` = `migration.bootstrap-change`) and the E10 chain
  (`constraint.no-forced-remigration` against `migration.forced-remigration-pending` = y).
  Never `trust.hfe-future`: `impl.hyperfrontend.enterprise` is `avail.announced-planned` and
  no `pairedAvailableToday` record is produced. Never `trust.no-mfe` in the
  keep-building-inside-the-legacy sense: the baselines must be excluded by the ceiling
  (level 6 extraction > level 1), and that exclusion must survive a counterfactual firing of
  `derive.single-coordinated-team`.
- Eliminated families with rule ids: all five baselines, `family.module-graph-federation`,
  `family.lifecycle-orchestration`, `family.custom-element-composition`, and
  `family.server-fragment-assembly`, every one of them by
  `constraint.participant-modification-ceiling`(participant:legacy,
  maxLevel=`migration.trivial-adaptation`), with `constraint.css-containment` and
  `constraint.framework-major-coexistence` recorded as co-origins where the cells show n
  (as itemized in 4.6).
- Survivors and order: `family.document-embedding` (embed-only, same-origin;
  iframe-composition practice plus impl.luigi iframe mode) at `status.match.viable`, ahead of
  `family.virtualized-rehosting` (impl.wujie, reconstruction mode) and
  `family.route-partition` (path topology, legacy on the default route), both
  `status.match.conditional`, with wujie ahead of route-partition by rule 2 (zero named
  strong-preference violations vs `constraint.persistent-chrome` and
  `constraint.cross-boundary-soft-nav`). Rule 4 must not be reached.
- Per-configuration exclusions that must hold inside surviving families: impl.qiankun and
  impl.micro-app-jd out of `family.virtualized-rehosting`, impl.hyperfrontend and the luigi
  full-client posture out of `family.document-embedding`,
  impl.cloudflare-workers-microfrontends out of `family.route-partition`.
- Stage 2: `constraint.no-forced-remigration` bound hard at `scope.implementation` (never at
  `scope.family`), removing impl.web-fragments on `migration.permanent-viability` = n and
  retaining impl.wujie only with its `permanent-viability` = c condition attached.
- `dominance.html-entry-at-low-ceiling` active and disclosed;
  `dominance.browser-boundary-over-simulated-realm` disclosed as inactive (its condition is
  the entire difference between this fixture and third-party-vendor-widget).
- Both slots produced: `slots.bestToday` unconditioned by any aspiration, and
  `slots.bestAfterTransition` carrying a non-divergent second pass for the credible
  new-capabilities target plus the `rule.aspiration-warning` conditional for the
  confidence-2 legacy retirement, with `question.trajectory.no-transition-outcome` asked
  before emission.
- Next question at closure: `question.granularity.single-screen`, selected with guaranteed
  gain 0 over S = 3 families and won on expected class plus reach, with
  `question.deploy.independence` recorded at guaranteed gain 0 despite being the landscape's
  largest static splitter.
- Key counterfactuals: raising the legacy ceiling to 2/3/4/6 readmits, in order,
  custom-element composition, module-graph federation, lifecycle orchestration plus the
  hyperfrontend hostee posture, and the baselines; a rank-3 yes eliminates
  `family.route-partition`; a hard `constraint.seamless-ux` eliminates
  `family.document-embedding`; a hard `constraint.atomic-release` empties the space and
  yields a gap record plus relaxation offers rather than the baselines.
- Guardrail 3 must be reported as FAILING until `constraint.session-continuity` (Model
  finding 1) exists; a trace that reports it as passing without a binding and a derivation
  chain has regressed.
