# Constraint Model

Status: DERIVED v1 (2026-08-29). Deliverable 5 (constraint model: hard/preference/derived/
dependencies) per MASTER.md section 16. Requirements served: REQ-Q-02 (classes and
elimination semantics), REQ-DATA-04 (facts, implications, rules, and preferences kept
separate), REQ-ENGINE-01 (constraints and derivation rules as declarative engine data),
REQ-STATE-02 (Conway default), REQ-GAP-03 (relaxation duty), REQ-AVAIL-03 (independent fit
factors).

Inputs, linked not restated (REQ-OPS-03): dimension and pole ids from
[taxonomy.md](taxonomy.md) section 2, guard attributes from taxonomy.md section 4.1, family
ids and per-family attribute claims from [families.md](families.md), ownership facts and
topology pressures from [topology.md](topology.md), the migration scale and its
hard-constraint mapping from [migration.md](migration.md), the credibility predicate from
[state-transition.md](state-transition.md) section 3, edition/operability atoms from
[enterprise-layer.md](enterprise-layer.md), attribute definitions from
[../matrix/attributes.md](../matrix/attributes.md), and cell values from
[../matrix/matrix-compact.tsv](../matrix/matrix-compact.tsv) with per-cell conditions in
`../matrix/columns/<unit>.json`.

Every elimination claim below is verifiable: the constraint names the attribute ids it
binds, the matrix rows for those ids decide which units pass, and the family sections in
families.md state the same attribute ids in their definitions and limitation fields
(REQ-FRAME-02, REQ-ORCH-08).

---

## 1. Modeling stance and vocabulary

### 1.1 What a constraint is (REQ-DATA-04)

Four things are kept separate and never blended into a score (REQ-Q-06):

- **Facts** are observed answers about the user's situation (`ownership.*` facts,
  septet records, appetite levels). They carry provenance (REQ-DATA-05) and a state slot
  (`state.current` / `state.target`, [state-transition.md](state-transition.md) section 2).
- **Constraints** (this file, `constraint.*`) are demands the candidate space must satisfy.
  A constraint binds one or more dimension poles or matrix attribute ids and defines a
  predicate over units/families in terms of those ids.
- **Derivation rules** (`derive.*`, section 3) map facts onto constraints. They are engine
  data: premises in, constraint binding out (REQ-ENGINE-01, REQ-ENGINE-02).
- **Preferences** are constraints bound at a non-eliminating class; they rank and surface
  as unresolved tradeoffs, never exclude (REQ-Q-02).

### 1.2 Constraint classes (REQ-Q-02)

| Class id | Behavior |
|---|---|
| `class.hard-constraint` | Eliminates every unit/family whose cells fail the predicate; violation is fatal regardless of all other merit. |
| `class.strong-preference` | Ranks among survivors; a violated strong preference must appear in the report as an explicit tradeoff (REQ-REPORT-03). |
| `class.weak-preference` | Tie-break among otherwise equivalent survivors; silently droppable. |
| `class.irrelevant-by-default` | Recorded but inert until a derivation rule or explicit answer activates it; the default for every constraint no fact has touched (REQ-ORCH-10: unanswered never defaults to hard). |

Class is a property of a **binding**, not of the constraint id: the same
`constraint.participant-modification-ceiling` is hard for an acquired portal and a weak
preference for an actively maintained in-house app (migration.md section 5). Each
constraint below lists its *default* class and its *class ceiling* (the strongest class it
may legitimately take at its scope). Topology priors (section 2.14) adjust defaults;
explicit answers override priors (topology.md section 1).

### 1.3 Scopes: what a constraint may eliminate

| Scope id | May eliminate | Firewall |
|---|---|---|
| `scope.family` | Architectural families and their units | none: this is the REQ-Q-02 core |
| `scope.implementation` | Implementations inside surviving families | never reaches back into family selection (REQ-Q-09 level 2; taxonomy.md 4.3) |
| `scope.edition` | Editions/operating models of surviving implementations | never eliminates a family or downgrades a community edition's architectural fit (REQ-ENT-01, enterprise-layer.md section 11) |
| `scope.inventory` | Whole units from the comparison universe | inclusion guard only (REQ-AVAIL-01) |

Availability and maturity constraints are additionally ring-fenced by REQ-AVAIL-03: they
are reported as independent fit factors beside architectural/organizational/operational/
transition fit, never merged with them.

### 1.4 Binding record shape (engine data)

Conceptual; schema authority stays with `schema-proposal.md`:

```jsonc
{
  "constraint": "constraint.participant-modification-ceiling",
  "subject": "participant:acquired-portal",     // per-boundary, not global (topology.md s1)
  "class": "class.hard-constraint",
  "params": { "maxLevel": "migration.integration-adapter" },
  "slot": "state.current",                       // section 5 decides target-slot eligibility
  "origin": ["answer:<question-id>", "derive.unmodifiable-participant-floor"],
  "provenance": { "value": "...", "confidence": "...", "evidence": ["..."], "verifiedAt": "..." }
}
```

The engine's outputs (`satisfiedConstraints`, `violatedConstraints`, `excludedStrategies`,
`tradeoffs`; REQ-ENGINE-01) cite these bindings by id, which keeps every recommendation
explainable from data (REQ-REPORT-02).

---

## 2. Constraint taxonomy

Grouped by the dimension cluster each constraint binds. "Hard form" describes what the
`class.hard-constraint` binding retains or eliminates, with the verification pointer.
Families are cited by id; per-unit deviations inside a family resolve at the cell level
(mode-forked units per taxonomy.md 3.5 and families.md 6.3 are scored per configuration).

### 2.1 Realm and failure containment (`dimension.runtime-realm`)

- **`constraint.fault-containment`** : a participant's post-mount failure, leaked
  resources, or corrupted state must not reach host or siblings, and recovery must not
  require a page reload.
  Binds: `isolation.failure.post-mount-exception`, `isolation.lifecycle.reclaim`,
  `isolation.recovery.in-page`. Default `class.strong-preference`; ceiling hard;
  `scope.family`.
  Hard form retains `family.document-embedding` (families.md 3.7 isolation field; all
  three cells y for hyperfrontend and iframe-composition) and `family.route-partition`
  (satisfied by construction: failures are per-navigation, taxonomy.md 2.5); retains
  `family.virtualized-rehosting` only per configuration (wujie and web-fragments client
  mode score y/y/y, qiankun scores n/c/c: matrix rows). Eliminates
  `family.module-graph-federation` and `family.custom-element-composition`
  (families.md 3.4/3.3 "isolation: none"; cells n) and `family.lifecycle-orchestration`
  (quarantine is not containment: families.md 3.5; `isolation.lifecycle.reclaim`=n for
  both members).
- **`constraint.css-containment`** : styles must be confined in both directions by an
  enforced mechanism.
  Binds: `isolation.css.outbound`, `isolation.css.inbound`. Default
  `class.strong-preference`; ceiling hard; `scope.family`. Hard form retains
  `family.document-embedding` (browser-enforced, families.md 3.7),
  `family.custom-element-composition` (shadow-DOM style scoping, families.md 3.3, style
  level only), `family.virtualized-rehosting` (framework-enforced rewriting/scoping,
  families.md 3.6), and `family.route-partition` (vacuous: no co-residence).
- **`constraint.main-thread-protection`** : a busy or crashing participant must leave the
  host responsive.
  Binds: `isolation.resource.main-thread`, `isolation.process.crash`. Default
  `class.irrelevant-by-default`; ceiling hard; `scope.family`. Hard form retains only the
  `realm.separate-document` pole, and only conditionally (cells c for hyperfrontend,
  iframe-composition, luigi: process isolation is engine- and origin-dependent;
  REQ-MATRIX-05 forbids promising it unconditionally).
- **`constraint.seamless-ux`** : composed content must flow, size, overlay, and focus as
  one native document.
  Binds: `ux.natural-layout-flow`, `ux.body-portal-compat`, `ux.overlay-viewport-escape`,
  `ux.cross-boundary-focus-mgmt`. Default `class.strong-preference`; ceiling hard;
  `scope.family`. Hard form eliminates `family.document-embedding` (families.md 3.7 hard
  limitations; `ux.natural-layout-flow`=n cells); all other families retain.
- **`constraint.a11y-continuity`** : assistive technology must traverse the composed page
  as one document.
  Binds: `ux.screenreader-continuity` (the taxonomy.md 4.1 pole guard). Default
  `class.strong-preference`; ceiling hard (legal mandates exist independently of taste);
  `scope.family`. Hard form eliminates the `realm.separate-document` pole unless the
  implementation carries a compensating protocol (hyperfrontend cell `?`, iframe cell c:
  per-cell conditions decide; never assume).
- **`constraint.sync-boundary-calls`** : participants must be able to invoke each other's
  live objects synchronously.
  Binds: `contracts.sync-calls`. Default `class.irrelevant-by-default`; ceiling hard;
  `scope.family`. Hard form eliminates `family.document-embedding` (serialized boundary,
  families.md 3.7) and `family.route-partition` (participants never co-reside; NA cells
  fail the need). Retains shared-realm and virtualized families (cells y).
- **`constraint.participant-self-containment`** : the participant must neither leak
  styles/globals outward nor break when a hostile host environment leaks inward.
  Binds: `isolation.css.outbound`, `runtime.global-registration-collision`,
  `ownership.participant-unmodifiable-host`. Default `class.irrelevant-by-default`;
  ceiling hard; `scope.family`. The white-label pressure (topology.md 2.8). Hard form
  retains units scoring y on `ownership.participant-unmodifiable-host` (hyperfrontend,
  iframe-composition, opencomponents, picard-js, web-components-composition cells).

### 2.2 Trust (`dimension.trust-ceiling`)

- **`constraint.distinct-principal`** : a participant must be composable as a separate
  security principal whose malice or compromise the boundary contains.
  Binds: `security.untrusted-third-party-viable`,
  `isolation.security.malicious-participant`, `security.cross-origin-boundary`,
  `security.sandbox-attribute-applicable`, `security.per-participant-csp`,
  `security.capability-narrowing`, `isolation.storage.partition`,
  `isolation.origin.host-authority`, `isolation.navigation.top-level-guard`,
  `ownership.external-participant`. Default `class.irrelevant-by-default`; ceiling hard;
  `scope.family`. The landscape's sharpest eliminator (taxonomy.md 2.2:
  `security.untrusted-third-party-viable` is No for 27 of 30 units). Hard form retains
  only `family.document-embedding` at the cross-origin plus sandbox posture (cells c for
  hyperfrontend and iframe-composition; luigi iframe mode conditional; the posture, not
  the product, decides: families.md 6.3), and conditionally `family.route-partition` at
  page granularity (reverse-proxy cell c on `isolation.security.malicious-participant`).
  Everything else is eliminated, including `family.virtualized-rehosting` (never a
  security boundary: families.md 3.6, REQ-MATRIX-05).
- **`constraint.interference-damping`** : accidental global/DOM/CSS collisions between
  cooperating teams must be absorbed by the mechanism.
  Binds: `isolation.js.virtualized-global`, `isolation.dom.virtualized`. Default
  `class.irrelevant-by-default`; ceiling strong (never sell damping as the answer to a
  trust requirement; taxonomy.md 3.1). `scope.family`. Satisfied at
  `trust.interference-damped` and above.
- **`constraint.verbatim-participant-bytes`** : participant code must execute exactly as
  shipped, with no host-side rewriting.
  Binds: `ownership.participant-bytes-verbatim`. Default `class.irrelevant-by-default`;
  ceiling hard (audit/regulatory settings); `scope.family`. Hard form eliminates
  `family.virtualized-rehosting` (bytes transformed before execution: families.md 3.6
  definition) and rewriting server tiers (taxonomy.md 2.2).

### 2.3 Integration time and deployment (`dimension.integration-time`)

- **`constraint.independent-deploy`** : a team's deploy must reach users without
  rebuilding or redeploying the host, and the team must own its schedule.
  Binds: `composition.phase.deploy-unit-per-participant`,
  `deployment.host-rebuild-required` (=n), `ownership.deploy-schedule-ownership`. Default
  `class.strong-preference`; ceiling hard; `scope.family`. Hard form eliminates all five
  baseline families (`family.modular-monolith`, `family.package-composition`,
  `family.spa-routing`, `family.server-templates`, `family.islands`: "no independent
  deployment, by definition", families.md section 5; `deployment.host-rebuild-required`=y
  cells for all their units). All seven MFE families retain.
- **`constraint.atomic-release`** : cross-boundary version drift must be structurally
  impossible and contracts verified before deploy.
  Binds: `contracts.drift-surface` (=n), `operations.deploy-time-contract-verification`,
  `contracts.types-shared`. Default `class.irrelevant-by-default`; ceiling hard;
  `scope.family`. Hard form retains only the `time.build-fused` pole (the five baselines;
  taxonomy.md 2.3). Mutually exclusive with `constraint.independent-deploy` by
  construction (section 4).
- **`constraint.runtime-roster-change`** : participants or versions must be addable and
  swappable inside a running document.
  Binds: `runtime.late-participant-registration`, `runtime.loaded-version-hot-swap`.
  Default `class.irrelevant-by-default`; ceiling hard; `scope.family`. Hard form retains
  the `time.runtime-live` units (taxonomy.md 2.3 list; matrix rows), spanning
  `family.document-embedding`, `family.virtualized-rehosting`, and conditionally the
  loader-based members of `family.module-graph-federation` and
  `family.lifecycle-orchestration`.
- **`constraint.no-host-change-per-participant`** : onboarding a new participant must not
  require host code change, rebuild, or a central owner's action.
  Binds: `deployment.new-participant-host-change` (=n),
  `ownership.onboarding-without-central-owner`. Default `class.irrelevant-by-default`;
  ceiling hard; `scope.family` for the first atom, `scope.implementation` for the second
  (registry mediation is a roster-authority position realized per implementation:
  taxonomy.md 2.8). Hard form on the second atom retains registry-mediated units
  (opencomponents, piral, zephyr-cloud cells y).

### 2.4 Assembly locus and delivery surface (`dimension.assembly-locus`)

- **`constraint.static-hosting-only`** : production delivery must run from static
  hosting/CDN with no operated composition service in the request path.
  Binds: `ssr.static-hosting-sufficient`, `deployment.strategy-service-in-path` (=n),
  `deployment.participants-static-artifacts`. Default `class.irrelevant-by-default`;
  ceiling hard; `scope.family`. Hard form eliminates `family.server-fragment-assembly`
  (families.md 3.2 hard limitations; cells n for podium, server-side-fragment-composition,
  edge-side-composition; opencomponents survives only in its client-mode profile,
  families.md 6.3) and constrains `family.route-partition` to existing routing
  infrastructure (cells c). Caveat (taxonomy.md 3.4): `deployment.strategy-service-in-path`
  has two unrelated causes (request-path composer vs discovery/registry service); the
  engine must attribute the violation to the actual cause before eliminating.
- **`constraint.composed-first-paint`** : first paint must deliver composed, crawlable
  content without client-side JS.
  Binds: `ux.composed-first-paint`, `ssr.crawler-indexable`, `ssr.no-js-first-paint`.
  Default `class.irrelevant-by-default`; ceiling hard; `scope.family`. Hard form retains
  `family.server-fragment-assembly`, `family.route-partition`, `family.server-templates`,
  `family.islands`, `family.package-composition`/`family.modular-monolith` (prerendered),
  and web-fragments pierced mode; eliminates the client-runtime families in their default
  configurations (cells n for module-federation, single-spa, piral, qiankun,
  hyperfrontend; conditional SSR paths are per-cell conditions, never assumed).
- **`constraint.no-new-infra-tier`** : adoption must not require standing up a new
  infrastructure tier.
  Binds: `migration.host.new-infra-tier-required` (=n). Default
  `class.weak-preference`; ceiling hard; `scope.family`. Hard form eliminates
  `family.server-fragment-assembly` and fresh adoptions of `family.route-partition`
  (families.md 3.1/3.2 migration fields).

### 2.5 Granularity and UX continuity (`dimension.composition-granularity`)

- **`constraint.single-screen-mixing`** : one screen must concurrently display output of
  more than one participant/team.
  Binds: `runtime.concurrent-participants`. Default `class.irrelevant-by-default`;
  ceiling hard; `scope.family`. Hard form eliminates `family.route-partition` (families.md
  3.1 hard limitations: "cannot place two teams' output on one screen"; cells n for all
  three members) and `family.server-templates`. Its *negation* (page-seam composition is
  acceptable) relaxes the whole co-residence cluster to `class.irrelevant-by-default`
  (taxonomy.md 2.5: the questions never arise).
- **`constraint.persistent-chrome`** : shared chrome must stay mounted across all
  cross-unit transitions.
  Binds: `ux.persistent-shared-chrome`. Default `class.strong-preference`; ceiling hard;
  `scope.family`. Hard form eliminates `family.route-partition` and the classic
  document-reloading members of `family.server-fragment-assembly` (cells n for podium and
  server-side-fragment-composition; families.md 3.2 inherent costs). Requires both region
  granularity and a persistent client document (taxonomy.md 3.2); jointly with
  `constraint.composed-first-paint` (hard) it is reachable only via web-fragments pierced
  mode or the build-fused baselines (cells y/y).
- **`constraint.cross-boundary-soft-nav`** : navigation between units must be soft
  (no full document reload).
  Binds: `ux.cross-boundary-soft-nav`. Default `class.strong-preference`; ceiling hard;
  `scope.family`. Hard form eliminates `family.route-partition` (families.md 3.1) and the
  document-reloading fragment members; `family.document-embedding` conditional (cells c).

### 2.6 Adaptation floors (`dimension.adaptation-floor`; migration.md)

- **`constraint.participant-modification-ceiling`** : per participant, the required
  migration level must not exceed the stated appetite. Parameter: `maxLevel` on the
  migration.md section 2 scale; per-boundary subject (migration.md section 3).
  Binds: `migration.participant.min-level` plus its atoms
  (`migration.source-modification-required`,
  `migration.participant.bootstrap-change-required`,
  `migration.participant.thirdparty-unmodified-viable`,
  `migration.participant.legacy-no-build-viable`). Default: hard whenever stated as a
  ceiling (migration.md section 5: the canonical eliminating answer); a "would rather
  not" answer binds at `class.strong-preference`. `scope.family` via the taxonomy.md 2.6
  bands. Hard form at maxLevel<=2 retains the band-1/2 units (route-partition,
  server-fragment-assembly, document-embedding embed-only posture, the HTML-entry
  virtualized members); maxLevel<3 eliminates `family.module-graph-federation` (floor 3:
  families.md 3.4 works-poorly, REQ-Q-02); maxLevel<4 eliminates
  `family.lifecycle-orchestration` (floor 4: families.md 3.5 hard limitations) and the
  SDK-handshake posture of `family.document-embedding`; existing separate applications
  are eliminated from the baselines below maxLevel 6 (families.md section 5 migration
  fields).
- **`constraint.host-modification-ceiling`** : the host side's adoption work must not
  exceed the host owner's appetite (symmetric facet; white-label caps it at level 1,
  migration.md section 3).
  Binds: `migration.host.min-level`, `migration.host.shell-takeover-required` (=n).
  Default as above; `scope.family` and `scope.implementation`. Hard form at low ceilings
  eliminates host-inversion implementations (piral shell takeover; entando and
  commercetools platform-as-host: taxonomy.md 2.6 host-inversion band).
- **`constraint.strangler-path`** : adoption must be able to proceed one route/region at
  a time with the untouched legacy in production.
  Binds: `migration.strangler.incremental`. Default `class.strong-preference`; ceiling
  hard; `scope.implementation` (near-uniform y; eliminates only the platform-rewrite
  entries: commercetools-frontend and entando cells n).
- **`constraint.bounded-exit`** : participants must remain standalone deployable outside
  the composition (low `cost.evolve`).
  Binds: `migration.exit.participants-standalone`. Default `class.strong-preference`;
  ceiling hard; `scope.family`. Hard form eliminates the build-fused baselines (cells n)
  and conditions several platform-thick implementations (cells c/n: piral,
  opencomponents).

### 2.7 Dependency economy (`dimension.dependency-economy`)

- **`constraint.no-version-governance`** : no strategy may depend on standing cross-team
  dependency-version governance, because the organization cannot supply it.
  Binds: `coordination.shared-dependency-governance` (=n), `ownership.uncoordinated-upgrades`
  (=y), `ownership.distrusted-cadence` (=y). Default `class.irrelevant-by-default`;
  ceiling hard (this is a capability fact, not a taste: topology.md 2.9); `scope.family`.
  Hard form eliminates `family.module-graph-federation` (all three members require
  governance: cells y; families.md 3.4 "the family's defining burden") and
  `family.lifecycle-orchestration` (cells y for single-spa and piral; families.md 3.5
  inherits the burden); retains the `deps.duplicated` families and the baselines
  (single build needs no standing governance: cell n for monorepo-package-composition).
- **`constraint.framework-major-coexistence`** : incompatible majors of one framework
  must coexist on composed pages indefinitely.
  Binds: `framework.same-framework-major-coexistence`, `runtime.side-by-side-versions`.
  Default `class.irrelevant-by-default`; ceiling hard; `scope.family`. Hard form retains
  `family.document-embedding` and `family.virtualized-rehosting` (cells y) and
  conditionally the negotiated units (cells c: skew falls back to duplication);
  eliminates the build-fused baselines (cells n).
- **`constraint.payload-dedup`** : a library shared by several participants must ship
  once per page.
  Binds: `performance.shared-dependency-dedup`, `performance.duplicate-framework-same-page`
  (=n). Default `class.weak-preference`; ceiling hard; `scope.family`. Hard form retains
  `family.module-graph-federation` and the build-fused baselines (cells y); eliminates the
  `deps.duplicated` families (families.md 3.3/3.6/3.7 inherent costs).

### 2.8 Roster authority and operations (`dimension.roster-authority`)

- **`constraint.no-platform-team`** : effective operation must not require a standing
  platform-owner role or a centrally owned roster artifact.
  Binds: `ownership.platform-team-role-required` (=n), `runtime.central-routing-map` (=n).
  Default `class.irrelevant-by-default`; ceiling hard; `scope.implementation` (roster
  position varies inside families: taxonomy.md 2.8). Hard form retains the
  `roster.host-authored` units (hyperfrontend, iframe-composition, micro-app-jd, wujie,
  web-components-composition cells n on the first atom).
- **`constraint.non-developer-composition`** : non-developers must hold page-composition
  authority through a supported UI.
  Binds: `ownership.non-developer-composition`. Default `class.irrelevant-by-default`;
  ceiling hard; `scope.implementation` (only entando and commercetools-frontend score y:
  taxonomy.md 2.8; a hard binding is nearly an implementation pick and must be flagged as
  such in the report).

### 2.9 Release actuation and contract machinery (`dimension.release-actuation`, `dimension.contract-explicitness`)

- **`constraint.instant-rollback`** : rollback to a prior participant version must be a
  first-party repoint, without rebuilding the participant.
  Binds: `governance.rollback`, `deployment.immutable-version-retention`. Default
  `class.strong-preference`; ceiling hard; `scope.implementation` (both causes are
  implementation positions: `actuation.pointer-switch` or a delivery platform;
  taxonomy.md 3.4 dual-cause note, REQ-ENT-01 keeps the platform cause out of family
  selection). Hard form retains pointer-switch units (import-map-architectures,
  opencomponents, zephyr-cloud cells y; conditionals per cell).
- **`constraint.version-pinning`** : consumers must be able to pin an exact participant
  version. Binds: `deployment.consumer-version-pin`. Default `class.irrelevant-by-default`;
  ceiling hard; `scope.implementation`.
- **`constraint.per-user-targeting`** : preview/canary audiences must receive different
  participant versions. Binds: `deployment.per-user-version-targeting`. Default
  `class.irrelevant-by-default`; ceiling hard; `scope.edition` (satisfied almost only by
  commercial delivery tiers: piral and zephyr-cloud cells y; REQ-ENT-01).
- **`constraint.explicit-drift-surfacing`** : version drift between independently
  deployed sides must surface as an explicit machine-readable refusal, not a late runtime
  failure.
  Binds: `contracts.formal-descriptor`, `contracts.contract-versioned`,
  `contracts.connect-compat-gate`, `contracts.drift-explicit`. Default
  `class.strong-preference` whenever `contracts.drift-surface`=y among candidates
  (auto-escalated by `derive.many-party-drift`); ceiling hard; `scope.implementation`
  (the gate is an implementation property inside several families: taxonomy.md 2.10).
  Hard form on all four atoms retains hyperfrontend only (taxonomy.md 2.10); partial-gate
  cells (module-federation c) must never be read as satisfied (REQ-MATRIX-05).
- **`constraint.schema-validated-boundary`** : cross-boundary payloads must be validated
  by the mechanism. Binds: `contracts.schema-validated-payloads`. Default
  `class.weak-preference`; ceiling strong; `scope.implementation`.

### 2.10 Orchestration thickness (`dimension.orchestration-thickness`)

- **`constraint.no-strategy-runtime`** : nothing strategy-owned may ship on the page or
  impose a version floor; the mechanism's lifetime must be the browser's.
  Binds: `runtime.shared-runtime-library` (=n), `framework.version-floor-imposed` (=n),
  `buildtime.host-integrates-buildless` (=y). Default `class.irrelevant-by-default`;
  ceiling hard; `scope.family` at the pole level (retains `orchestration.primitive`
  units: taxonomy.md 2.11 list), `scope.implementation` inside families whose thickness
  spans the scale (families.md 3.7, FC-5).
- **`constraint.paved-road`** : the strategy should ship lifecycle-failure handling,
  messaging, loading/error UI, and composed local dev.
  Binds: `contracts.builtin-messaging`, `ux.builtin-loading-ui`,
  `ux.builtin-error-fallback-ui`, `isolation.failure.lifecycle-quarantine`,
  `operations.local-composed-dev-firstparty`. Default `class.weak-preference`; ceiling
  `class.strong-preference` (never hard: DIY is always possible, only priced);
  `scope.implementation`.

### 2.11 Delivery governance and licensing (`dimension.delivery-governance`)

- **`constraint.no-vendor-control-plane`** : composition must run without a vendor SaaS
  in the delivery or metadata path, on adopter infrastructure.
  Binds: `deployment.vendor-hosting-required` (=n), `hosting.control-plane` (=y,
  self-hostable), `unit.editions.oss-self-sufficient` (=y). Default
  `class.strong-preference`; ceiling hard; `scope.implementation`/`scope.edition`
  (taxonomy.md 2.12: this dimension selects implementations and editions, never
  families). Hard form eliminates zephyr-cloud, cloudflare-workers-microfrontends,
  commercetools-frontend (cells y/n/n on the three atoms respectively).
- **`constraint.no-delivery-intermediary`** : participant code must not route through a
  shared intermediary requiring code-execution trust.
  Binds: `security.delivery-intermediary-trust` (=n). Default
  `class.irrelevant-by-default`; ceiling hard; `scope.implementation`. Hard form
  eliminates registry/feed/composer-mediated units (cells y: opencomponents, piral,
  podium, zephyr-cloud, the fragment composers) and retains `delivery.unmediated` units.
- **`constraint.osi-core-license`** : the core composition capability must carry an
  OSI-approved license. Binds: `unit.license.osi-core`. Default
  `class.strong-preference`; ceiling hard; `scope.implementation`.

### 2.12 Guards and gap-triggers (taxonomy.md 4.1)

- **`constraint.installable-today`** : only units obtainable and production-runnable
  enter comparison. Binds: `unit.availability.installable-today`. Class locked
  `class.hard-constraint`; `scope.inventory` (REQ-AVAIL-01; currently uniform y).
- **`constraint.artifact-integrity`** : participant code must be integrity-verified
  before execution. Binds: `security.artifact-integrity-verification`. Ceiling hard;
  `scope.implementation`. A hard binding is a **gap-trigger**: the landscape-wide answer
  is No (19x n, rest c/?/NA), so the engine emits a REQ-GAP-02 gap record instead of an
  empty recommendation (section 6.3).
- **`constraint.rsc-federation`** : React Server Components must federate across the
  participant boundary first-party. Binds: `ssr.rsc-federation`. Ceiling hard;
  `scope.implementation`; gap-trigger (no unqualified y anywhere).
- **`constraint.memory-budget`** : per-unit document boot and process memory must fit
  constrained devices. Binds: `performance.per-unit-document-boot`,
  `performance.process-memory-overhead`. Default `class.weak-preference`; ceiling
  strong; `scope.family` (a cost note attached to the `realm.separate-document` pole,
  taxonomy.md 4.1; hard-form elimination is forbidden because the cells are conditional
  cost facts, not capabilities).
- **`constraint.code-ownership`** : teams must hold enforceable code-level ownership.
  Binds: `ownership.code-boundary-ownership`. Class locked
  `class.irrelevant-by-default`: uniform y across all 30 units (taxonomy.md 4.1); the
  constraint exists so the engine can answer "every strategy provides this" instead of
  pretending the ask differentiates.

### 2.13 Availability and stewardship lens (taxonomy.md 4.3; REQ-AVAIL-03)

All `scope.implementation`, applied only at REQ-Q-09's second level, reported as an
independent maturity/confidence factor, never blended into architectural fit:

| Constraint id | Binds | Default class | Ceiling |
|---|---|---|---|
| `constraint.maintenance-activity` | `unit.maintenance.release-within-12mo`, `unit.maintenance.commit-within-6mo` | strong-preference | hard |
| `constraint.stewardship-durability` | `unit.maintenance.multi-maintainer`, `unit.maintenance.org-steward`, `operations.single-sponsor-concentration` (=n), `ownership.upstream-contract-lifetime` (=n) | strong-preference | hard |
| `constraint.adoption-evidence` | `unit.maintenance.adoption-scale-10k`, `unit.maintenance.adoption-outside-sponsor` | weak-preference | strong |
| `constraint.stable-line` | `unit.availability.stable-line-shipped`, `unit.availability.single-current-line` | strong-preference | hard |
| `constraint.no-forced-remigration` | `migration.forced-remigration-pending` (=n), `migration.permanent-viability` (=y) | strong-preference | hard |

### 2.14 Enterprise operability scheme (`scope.edition`; enterprise-layer.md)

Each operability seed in enterprise-layer.md section 3 induces one constraint,
id `constraint.operability.<seed-slug>` (e.g. `constraint.operability.governance.rbac`
binding the `governance.rbac` atom; `constraint.operability.identity.consumer-credentials`
binding `identity.consumer-credentials` and `identity.key-issuance`). Uniform rules,
enforced as data, not convention:

- Scope is always `scope.edition`; a hard binding eliminates editions/operating plans,
  never families or community editions' architectural fit (REQ-ENT-01; the section 11
  firewall of enterprise-layer.md applies verbatim).
- Every atom is satisfiable by an edition capability, a third-party product, or in-house
  build (REQ-ENT-07); a hard operability binding therefore means "some operable plan must
  satisfy it", and it prices candidates rather than excluding architectures. Only
  combined with `constraint.operability.managed-service-preference` (=managed) does it
  select commercial editions.
- Planned capabilities never satisfy any binding (REQ-AVAIL-01); where a planned
  capability fits, the engine shows the shipping alternative beside it (REQ-AVAIL-02).

### 2.15 Topology priors: default class adjustments

Priors in the topology.md section 1 sense: starting classes the engine must confirm with
a real question before treating as hard; explicit answers always override. Verification
of each pressure is topology.md section 2; elimination verification is this file.

| Topology | Hard-tendency constraints | Preference-tendency constraints |
|---|---|---|
| `topology.coordinated-team` | none from topology | `constraint.seamless-ux`, `constraint.payload-dedup`; autonomy constraints re-classed irrelevant (`derive.single-coordinated-team`) |
| `topology.independent-teams` | `constraint.independent-deploy` | `constraint.no-version-governance` (confirm), `constraint.seamless-ux`, `constraint.explicit-drift-surfacing` |
| `topology.platform-product` | `constraint.explicit-drift-surfacing` (contract stability), `constraint.no-host-change-per-participant` | `constraint.instant-rollback`, `constraint.paved-road`; modification ceilings are negotiable (platform authority) |
| `topology.acquisition` | `constraint.participant-modification-ceiling` (low), `constraint.framework-major-coexistence`, `constraint.independent-deploy` | `constraint.seamless-ux` (compromised at first), `constraint.bounded-exit` |
| `topology.legacy-modernization` | `constraint.participant-modification-ceiling` (legacy side only; split appetite per participant), `constraint.framework-major-coexistence`, `constraint.css-containment` | `constraint.strangler-path`, `constraint.cross-boundary-soft-nav`, `constraint.bounded-exit` |
| `topology.third-party-vendor` | `constraint.participant-modification-ceiling` (level 9), `constraint.distinct-principal`, `constraint.fault-containment`, `constraint.independent-deploy` | `constraint.seamless-ux` (trades against boundary strength) |
| `topology.plugin-ecosystem` | `constraint.independent-deploy`, `constraint.runtime-roster-change`, `constraint.fault-containment`, `constraint.no-host-change-per-participant`; `constraint.distinct-principal` (confirm author trust) | `constraint.paved-road` (plugin-author DX), `constraint.instant-rollback` |
| `topology.white-label` | `constraint.host-modification-ceiling` (level 1), `constraint.participant-self-containment`, `constraint.independent-deploy` (vendor updates without customer action) | depth-of-integration spectrum (`constraint.seamless-ux` per customer) |
| `topology.fragmentation` | `constraint.no-version-governance`, `constraint.independent-deploy`, `constraint.fault-containment` (blast radius) | everything reducing cross-team surface (`constraint.no-strategy-runtime`, `constraint.no-platform-team`) |
| `topology.b2b-distribution` | union of third-party-vendor and white-label hard tendencies per hop | `constraint.operability.*` block (entitlement, credentials: edition scope) |

---

## 3. Derived constraints (`derive.*`; REQ-ENGINE-01)

Rules of the form "facts imply constraint binding". Engine data: premises are fact ids
with values (ownership facts from topology.md section 3, appetite facts from migration.md,
situation facts noted inline); the derivation column names the constraint, class, and
parameters bound. "Confirm" = the binding is a prior the engine must confirm with a
question before hard treatment (topology.md section 1); "entailed" = the premise already
states the incapacity, no confirmation needed (REQ-Q-02).

| Rule id | Premises (all must hold) | Derives | Mode |
|---|---|---|---|
| `derive.unmodifiable-participant-floor` | `ownership.host-unmodifiable-participant`=y, or `migration.appetite`(p)=`migration.no-modification-possible` | `constraint.participant-modification-ceiling`(p, maxLevel=2, host-side payable only) at `class.hard-constraint` (migration.md sections 3 and 5) | entailed |
| `derive.external-principal` | `ownership.external-participant`=y | `constraint.distinct-principal` at `class.hard-constraint` (topology.md 2.6 pressure) | confirm |
| `derive.no-cross-deploy-control` | `ownership.no-cross-deployment-control`=y | `constraint.independent-deploy` hard; `constraint.participant-modification-ceiling` and `constraint.host-modification-ceiling` near-zero on both far sides (migration.md section 3) | entailed |
| `derive.broken-governance` | `ownership.uncoordinated-upgrades`=y or `ownership.distrusted-cadence`=y | `constraint.no-version-governance` hard (the fact states the capability is absent: topology.md 2.9); `constraint.framework-major-coexistence` strong | entailed / confirm |
| `derive.legacy-untouchable` | participant is legacy with no reproducible build (migration.md section 8 capability preconditions fail) | `constraint.participant-modification-ceiling`(p, maxLevel=2) hard, requiring `migration.participant.legacy-no-build-viable`=y | entailed |
| `derive.mixed-majors-present` | current estate runs incompatible majors of one framework; no alignment funded (`state.current` fact) | `constraint.framework-major-coexistence` hard | entailed |
| `derive.plugin-admission` | `ownership.no-cross-deployment-control`=y and participants unknown at host ship time | `constraint.independent-deploy` hard; `constraint.runtime-roster-change` hard (confirm: batch admission may suffice); `constraint.fault-containment` hard (confirm); `constraint.no-host-change-per-participant` strong; plus `derive.external-principal` when authors are external | mixed |
| `derive.white-label-fit` | `ownership.participant-unmodifiable-host`=y | `constraint.host-modification-ceiling`(maxLevel=1) hard; `constraint.participant-self-containment` hard (confirm); `constraint.no-strategy-runtime` strong (the host cannot adopt a runtime) | mixed |
| `derive.static-estate` | organization states no server-operations capacity or a static-hosting mandate | `constraint.static-hosting-only` hard | entailed |
| `derive.seo-surface` | composed pages carry SEO-critical unauthenticated content | `constraint.composed-first-paint` strong; escalate to hard only on explicit confirmation | confirm |
| `derive.regulated-release` | regulated rollback/audit obligations stated | `constraint.instant-rollback` hard; `constraint.version-pinning` hard; `constraint.verbatim-participant-bytes` (confirm) | mixed |
| `derive.single-coordinated-team` | `ownership.single-team`=y and no external participants | re-class to `class.irrelevant-by-default`: `constraint.independent-deploy`, `constraint.no-version-governance`, `constraint.framework-major-coexistence`, `constraint.runtime-roster-change`; admit the baseline families as first-class candidates (REQ-Q-04, topology.md 2.1) | entailed |
| `derive.many-party-drift` | >= 3 independently deploying parties and surviving candidates have `contracts.drift-surface`=y | `constraint.explicit-drift-surfacing` strong (the drift hinge: taxonomy.md 3.3) | entailed |
| `derive.payload-budget` | strict payload budget and many co-displayed units | `constraint.payload-dedup` strong; hard only on confirmation | confirm |
| `derive.b2b-chain` | `topology.b2b-distribution` confirmed (topology.md 2.10) | per-hop application of `derive.external-principal` and `derive.white-label-fit`; activate the `constraint.operability.*` block (identity/entitlement atoms) at `scope.edition` | mixed |

Rules compose: several rules may bind the same constraint for different subjects; the
strictest class per subject wins, and every binding keeps its `origin` chain so the report
can cite which answers produced which elimination (REQ-REPORT-02).

---

## 4. Dependencies and conflicts between constraints

Relations are engine data with ids `rel.requires` (holding A auto-binds or presupposes B),
`rel.excludes` (hard A and hard B are jointly unsatisfiable in the current landscape;
verification cited), and `rel.relaxes` (holding A makes B inert or cheaper). Exclusions
are landscape facts, not logic: a future unit can dissolve them, so each cites the matrix
evidence that currently grounds it (REQ-GAP-01 feeds on exactly these pairs).

| Relation | From | To | Basis (verify) |
|---|---|---|---|
| `rel.requires` | `constraint.distinct-principal` (hard) | `constraint.fault-containment`, `constraint.css-containment` | a principal boundary presupposes containment; every unit conditionally viable for untrusted code is a containment unit (taxonomy.md 3.1; matrix `security.untrusted-third-party-viable` c only where document-boundary cells are y) |
| `rel.requires` | `constraint.persistent-chrome` (hard) | `constraint.single-screen-mixing` | persistent chrome needs region granularity plus a persistent client document (taxonomy.md 3.2) |
| `rel.requires` | `constraint.payload-dedup` (hard) | one of: version governance available, or `constraint.atomic-release` | dedup exists only at `deps.negotiated` (governance) or `deps.single-copy-by-build` (taxonomy.md 2.7) |
| `rel.excludes` | `constraint.independent-deploy` (hard) | `constraint.atomic-release` (hard) | definitional: `contracts.drift-surface` cannot be both y and n; matrix row splits the landscape exactly on `time.build-fused` (taxonomy.md 2.3, 3.3) |
| `rel.excludes` | `constraint.distinct-principal` (hard) | `constraint.sync-boundary-calls` (hard) | no unit scores viable-for-untrusted and `contracts.sync-calls`=y together (matrix rows; sync calls are the shared realm's property, taxonomy.md 2.1) |
| `rel.excludes` | `constraint.distinct-principal` (hard) | `constraint.seamless-ux` (hard) | the only retained family loses `ux.natural-layout-flow` (families.md 3.7); the pair is the canonical REQ-GAP-02 record: "secure seamlessness" has no current occupant |
| `rel.excludes` | `constraint.distinct-principal` (hard) | `constraint.payload-dedup` (hard) | all dedup-capable units are `trust.cooperative` (matrix: `performance.shared-dependency-dedup`=y rows vs taxonomy.md 2.2 scale) |
| `rel.excludes` | `constraint.fault-containment` (hard) | `constraint.sync-boundary-calls` (hard) | jointly satisfiable only by the hidden-realm virtualized units (wujie, web-fragments client: cells y on both), whose trust ceiling is `trust.interference-damped`; adding any trust requirement empties the intersection |
| `rel.excludes` | `constraint.static-hosting-only` (hard) | `constraint.composed-first-paint` (hard) | within deploy-decoupled families the pair survives only in web-fragments pierced mode (cells) which itself needs a gateway, violating the first constraint; jointly the pair redirects to prerendered build-fused baselines (REQ-Q-04) |
| `rel.excludes` | `constraint.no-version-governance` (hard) + `constraint.independent-deploy` (hard) | `constraint.payload-dedup` (hard) | three-way: dedup without governance exists only build-fused, which independent-deploy eliminates; emit gap record (section 6.3) |
| `rel.excludes` | `constraint.no-delivery-intermediary` (hard) | `constraint.no-host-change-per-participant` (hard, registry atom) | ownerless onboarding is registry-mediated, and every registry unit scores `security.delivery-intermediary-trust`=y (matrix rows: opencomponents, piral, zephyr-cloud) |
| `rel.excludes` | `constraint.no-strategy-runtime` (hard) | `constraint.paved-road` (strong) | definitional trade of `dimension.orchestration-thickness` (taxonomy.md 2.11) |
| `rel.relaxes` | `constraint.atomic-release` (hard) | `constraint.explicit-drift-surfacing` | drift structurally impossible makes gate machinery pointless; re-class to irrelevant (taxonomy.md 3.3) |
| `rel.relaxes` | `constraint.distinct-principal` (hard) | `constraint.interference-damping` | the browser boundary subsumes simulated damping (taxonomy.md 2.2) |
| `rel.relaxes` | `constraint.single-screen-mixing` negated (page seams acceptable) | `constraint.fault-containment`, `constraint.css-containment`, `constraint.framework-major-coexistence`, `constraint.no-version-governance` | co-residence questions become vacuous at `granularity.page` (taxonomy.md 2.5) |
| `rel.relaxes` | `constraint.static-hosting-only` (hard) | `constraint.no-new-infra-tier` | static delivery already implies no composition tier (matrix: `deployment.strategy-service-in-path`) |

Attribution duty (taxonomy.md 3.4): before applying any exclusion involving
`deployment.strategy-service-in-path`, `governance.rollback`, or
`migration.host.new-infra-tier-required`, the engine must resolve which upstream cause
produced the cell (request-path composer vs registry vs delivery platform); "no services"
eliminates different unit sets per cause.

---

## 5. The Conway default (REQ-STATE-02, REQ-STATE-12)

How state slots bind, stated as engine rules:

- **`rule.conway-default`**: facts in `state.current` bind constraints immediately and by
  default; the entire section 2/3 machinery runs against current state first
  (`engine.ordering` steps 1-2 and 5, state-transition.md section 9).
- **`rule.target-credibility`**: a fact in `state.target` may bind constraints only when
  its transition passes the credibility predicate of
  [state-transition.md](state-transition.md) section 3 (confidence ordinal >= 5, or 4
  plus the buy-in minimum subset; authority held or engaged; horizon inside the decision
  horizon surviving the 3x robustness probe). Credible target bindings evaluate only in
  the `recommendation.best-after-transition` slot (`engine.ordering` step 6); they never
  join the current-state elimination pass.
- **`rule.no-target-satisfies-hard`**: no target-state value, at any confidence below 7,
  ever satisfies a hard constraint in current-state evaluation (REQ-STATE-04:
  aspirational is never equivalent to existing). Relaxing a current-state hard constraint
  because "the reorg will fix it" is exactly the move this rule forbids.
- **`rule.aspiration-warning`**: constraints derived from non-credible targets
  (confidence 2-3) are retained as annotations; any candidate depending on them is
  emitted as a warning-annotated conditional with status `fit.transition-dependent`,
  never as a recommendation (state-transition.md section 4 downgrade rule).
- **`rule.dual-slot-divergence`**: when the two slots eliminate differently, both
  recommendation slots are produced and the report cites the septet records that cause
  the divergence (REQ-STATE-06, REQ-REPORT-02).

---

## 6. Constraint relaxation and the gap seed (REQ-GAP-03)

When the hard-constraint set empties the candidate space, the engine never lowers the bar
silently (REQ-GAP-01). It generates a relaxation path from this table: the smallest
meaningful relaxations, ordered to preserve the user's intended composition boundary
first (relax organizational, deployment, timeline, ownership, governance, UX, and
infrastructure constraints before proposing a different boundary). Every row is verified
against the family sections cited in section 2; the counterfactual duty of migration.md
section 5 ("which appetite increase readmits which candidates") is this table applied to
one constraint.

### 6.1 Relaxation ledger (family scope)

| Hard constraint | Eliminates (section 2 verification) | Smallest meaningful relaxation | Reopens |
|---|---|---|---|
| `constraint.distinct-principal` | everything except `family.document-embedding` (+ route-partition per page, conditionally) | accept accident-damping instead of malice containment (`trust.interference-damped`) | `family.virtualized-rehosting` (families.md 3.6); further relaxation to full cooperation reopens all shared-realm families |
| `constraint.fault-containment` | shared-realm families | accept lifecycle quarantine instead of containment | `family.lifecycle-orchestration` (families.md 3.5 `isolation.failure.lifecycle-quarantine`); accept damping: `family.virtualized-rehosting` |
| `constraint.participant-modification-ceiling` (maxLevel<=2) | `family.module-graph-federation`, `family.lifecycle-orchestration`, baselines for existing apps | raise ceiling to 3 (bundler change) | `family.module-graph-federation` (families.md 3.4 migration field); to 4: `family.lifecycle-orchestration` + remaining virtualized/document-embedding SDK postures; to 6+: baselines via extraction (families.md section 5) |
| `constraint.host-modification-ceiling` (maxLevel<=1) | shell-takeover and platform-host implementations | allow host adoption work (level 4+) | piral-end of `family.lifecycle-orchestration`; platform overlays of entando/commercetools (implementation scope) |
| `constraint.independent-deploy` | all five baseline families | accept one release train | `family.modular-monolith`, `family.package-composition`, `family.spa-routing`, `family.server-templates`, `family.islands` (families.md section 5; the REQ-Q-04 outcome) |
| `constraint.atomic-release` | all seven MFE families | accept structural drift plus gate machinery (`constraint.explicit-drift-surfacing`) | every deploy-decoupled family (taxonomy.md 3.3) |
| `constraint.single-screen-mixing` | `family.route-partition`, `family.server-templates` | none needed downward; its negation is itself the relaxation that reopens them | `family.route-partition` (families.md 3.1 works-well), `family.server-templates` |
| `constraint.static-hosting-only` | `family.server-fragment-assembly` (+ route-partition adoptions) | accept operating one composition tier | `family.server-fragment-assembly`, full `family.route-partition` (families.md 3.2/3.1) |
| `constraint.composed-first-paint` | client-runtime families (default configurations) | accept client composition with designed loading states | `family.module-graph-federation`, `family.lifecycle-orchestration`, `family.virtualized-rehosting`, `family.document-embedding`, `family.custom-element-composition` (families.md 3.3-3.7) |
| `constraint.seamless-ux` | `family.document-embedding` | fund the seam engineering (host-overlay protocol, geometry management: `ux.host-overlay-protocol`) | `family.document-embedding` (families.md 3.7 hard limitations name exactly this program) |
| `constraint.sync-boundary-calls` | `family.document-embedding`, `family.route-partition` | accept serialized async messaging | both (families.md 3.7 boundary contract; 3.1 conventions) |
| `constraint.no-version-governance` | `family.module-graph-federation`, `family.lifecycle-orchestration` | stand up a real upgrade train (a governance change: subject to section 5 credibility, not assumable) | both families (families.md 3.4/3.5 coordination fields) |
| `constraint.persistent-chrome` | `family.route-partition`, classic `family.server-fragment-assembly` members | accept chrome duplication and hard navigations | both (families.md 3.1/3.2 inherent costs) |
| `constraint.runtime-roster-change` | build-fused families; central-map units without late registration | accept admit-by-redeploy | build-fused baselines and remaining central-map implementations (taxonomy.md 2.3/2.8) |
| `constraint.framework-major-coexistence` | build-fused baselines; conditionally negotiated units | fund framework alignment (level 7 work: migration.md) | baselines and unconditional `deps.negotiated` use (taxonomy.md 2.7) |
| `constraint.verbatim-participant-bytes` | `family.virtualized-rehosting`, rewriting server tiers | accept audited transformation | that family (families.md 3.6 definition) |

Implementation- and edition-scope hard constraints (`constraint.instant-rollback`,
`constraint.no-vendor-control-plane`, `constraint.no-delivery-intermediary`,
`constraint.explicit-drift-surfacing`, the operability block) relax by reopening
implementations and editions inside already-selected families; per REQ-ENT-01 their
relaxation never changes family selection, so they appear in the relaxation path only
after every family-scope relaxation has been offered.

### 6.2 Ordering rule

`rule.relaxation-ordering` (REQ-GAP-03): offer relaxations in this order: (1) preferences
mistaken for hard constraints (re-confirmation), (2) organizational/governance
relaxations subject to section 5 credibility, (3) deployment/infrastructure acceptances,
(4) UX acceptances, (5) adaptation-appetite increases, and only last (6) a different
composition boundary than the user intended. Each offered relaxation names its
consequences from the family sections it reopens (inherent costs field), so the user
relaxes with eyes open.

### 6.3 Gap records this model already predicts (REQ-GAP-02 seed)

Combinations the section 4 exclusions prove currently unsatisfiable; each becomes a gap
record, not a lowered bar (REQ-GAP-01), classified per REQ-GAP-02:

- `gap.secure-seamlessness`: `constraint.distinct-principal` + `constraint.seamless-ux`
  (both hard). Constraint-contradiction is partial: the seam is engineerable per
  implementation (families.md 3.7), so candidates exist with the strong-preference form.
- `gap.untrusted-dedup`: `constraint.distinct-principal` + `constraint.payload-dedup`.
  Inherent under current browser primitives (dedup requires a shared realm).
- `gap.autonomous-dedup`: `constraint.independent-deploy` +
  `constraint.no-version-governance` + `constraint.payload-dedup`. Inherent while dedup
  needs negotiation or fusion.
- `gap.artifact-integrity`: any hard `constraint.artifact-integrity`. Landscape-wide
  absence (taxonomy.md 4.1); candidate expansion area for any implementation.
- `gap.rsc-federation`: any hard `constraint.rsc-federation`. Landscape-wide absence.
- `gap.governed-ownerless-onboarding`: `constraint.no-delivery-intermediary` +
  ownerless onboarding. Inherent to registry mediation; relaxation trades trust for
  autonomy explicitly.

Not every gap is a HyperFrontend roadmap item (REQ-GAP-02); the classification of each
record into expandable / better-positioned-family / inherently-contradictory happens in
the gap engine that consumes this seed.

---

Next stage (deliverable 6, questions.md): derive the high-information questions from
these constraints; each question must name the constraint bindings its answers produce
and inherit the elimination verification from this file (REQ-Q-01, REQ-Q-02).
