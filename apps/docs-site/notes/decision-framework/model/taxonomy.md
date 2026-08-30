# Taxonomy: Latent Dimensions of the Composition Landscape

Status: DERIVED v1 (2026-08-29), deliverable 3 (MASTER.md section 16). Derived from the
Phase-3 comparison matrix per REQ-DIM-01 and REQ-DIM-02; supersedes the provisional
candidate list in REQ-DIM-01 where the evidence disagreed with it.

Evidence base: [../matrix/matrix-compact.tsv](../matrix/matrix-compact.tsv) (220 attributes
x 30 units), attribute definitions in [../matrix/attributes.md](../matrix/attributes.md),
per-cell conditions and claim types in `../matrix/columns/<unit>.json`, deep evidence in
[../research/solutions/](../research/solutions/). Sibling models referenced, not restated
(REQ-OPS-03): [migration.md](migration.md) (the level scale used by
`dimension.adaptation-floor`), [topology.md](topology.md) (ownership facts),
[state-transition.md](state-transition.md), [enterprise-layer.md](enterprise-layer.md)
(edition capabilities kept off the architectural axes per REQ-ENT-01).

Every dimension below is falsifiable: each lists the matrix attribute ids it claims to
explain, so an architect can follow any claim back to matrix cells and dossiers
(REQ-FRAME-02, REQ-ORCH-08). The landscape defines the axes; no axis is defined relative
to any single unit (REQ-ORCH-07).

---

## 1. How the dimensions were derived

Method (reproducible against the TSV):

1. **Value coding**: y=1, n=0, c=0.5; NA (`-`) and Unknown (`?`) excluded pairwise.
2. **Attribute correlation**: Pearson r over all attribute pairs sharing at least 12
   scored units. 565 pairs reach |r| >= 0.75. The pairs are not evenly spread: they
   concentrate into a small number of bundles, each of which becomes one dimension below.
3. **Unit similarity**: mean per-attribute agreement over shared known cells, followed by
   average-link agglomerative clustering to 8 clusters (section 5 reports that output
   verbatim; the clusters were not hand-adjusted, only annotated).
4. **Downstream detection**: an attribute whose value is predicted (|r| >= ~0.85) by an
   attribute from a *mechanically prior* group (composition/runtime choices precede UX and
   performance symptoms) is recorded as a consequence of the deeper choice, not as its own
   dimension. This is why the REQ-DIM-01 candidates "UX continuity", "performance
   efficiency", and "operational complexity" do **not** appear as dimensions: they resolved
   into consequence surfaces (section 3.2).
5. **Residual audit**: attributes whose maximum |r| against every other attribute stays
   below 0.60, and near-uniform attributes, are listed in section 4 rather than forced
   into a dimension.

Result: 12 architectural dimensions (REQ-DIM-01 expects 8-15), one non-architectural
implementation-selection lens (section 4.3), and an explicit residue.

Largest single finding: one mega-bundle (about 45 attributes spanning the isolation,
security, contracts, ux, and performance groups, pairwise |r| 0.85-1.00) is driven by a
single underlying choice, the runtime boundary class. It is split below into
`dimension.runtime-realm` and `dimension.trust-ceiling` because the per-cell conditions
(not the compact values) show they can separate; see 2.2.

Causal chains follow the REQ-DIM-02 form:
**choice -> consequence (attribute ids) -> condition under which that trade is attractive.**

---

## 2. The dimensions

### 2.1 `dimension.runtime-realm` : execution boundary class

**Definition.** Where a participant's JavaScript executes relative to the host: the same
realm, a framework-simulated realm, a separate browser document, or a document the user
navigates to serially. This is the single strongest factor in the matrix.

**Scale (ordered by boundary strength):**

| Pole id | Meaning | Units |
|---|---|---|
| `realm.serial-documents` | Participants never co-reside; each navigation is one participant's own document | cloudflare-workers-microfrontends, nextjs-multi-zones, reverse-proxy-route-composition, server-rendered-templates |
| `realm.shared` | One JS realm, one visible document | bit, commercetools-frontend, edge-side-composition, entando, import-map-architectures, islands-architecture, modular-monolith, module-federation, monorepo-package-composition, native-federation, opencomponents, picard-js, piral, plain-spa-routing, podium, server-side-fragment-composition, single-spa, web-components-composition |
| `realm.virtualized` | Framework-interposed synthetic globals and/or hidden-iframe realms projected into the shared document | qiankun (Proxy window, same realm), micro-app-jd (Proxy fake window; optional iframe mode), wujie (hidden same-origin iframe realm + shadow-DOM projection), web-fragments (reframing) |
| `realm.separate-document` | Co-resident visible browser documents (iframes) | hyperfrontend, iframe-composition, luigi (iframe mode; its web-component mode sits at `realm.shared`, see `operations.mode-forked-operations`) |

**Explains (attribute ids).** `runtime.shared-js-realm`,
`runtime.primordials-blast-radius`, `runtime.patched-globals-layer`,
`isolation.document-boundary`, `isolation.js.virtualized-global`,
`isolation.dom.virtualized`, `isolation.css.outbound`, `isolation.css.inbound`,
`isolation.lifecycle.reclaim`, `isolation.recovery.in-page`,
`isolation.failure.post-mount-exception`, `contracts.sync-calls`,
`contracts.serialized-boundary`, `contracts.frame-messaging`,
`performance.per-unit-document-boot`, `performance.sandbox-execution-tax`,
`performance.per-message-serialization-cost`, `security.isolation-escape-hatches`,
`operations.stack-traces-cross-boundary`, `ux.natural-layout-flow`,
`ux.overlay-viewport-escape`, `ux.host-overlay-protocol`, `ux.body-portal-compat`,
`ux.cross-boundary-focus-mgmt`, `ux.screenreader-continuity`,
`ux.frame-history-pollution`; partially `runtime.side-by-side-versions`,
`runtime.global-registration-collision`, `framework.same-framework-major-coexistence`
(shared with `dimension.dependency-economy`).

Correlation evidence: `runtime.shared-js-realm` ~ `runtime.primordials-blast-radius`
r=+1.00; `isolation.document-boundary` ~ `performance.per-message-serialization-cost`
r=+1.00, ~ `ux.natural-layout-flow` r=-1.00; `composition.kind.html-entry` ~
`runtime.patched-globals-layer` r=+1.00.

**Causal chains (REQ-DIM-02).**

- Shared realm -> synchronous calls and live object references, one accessibility tree,
  natural layout flow, portal-compatible component libraries, zero per-message cost
  (`contracts.sync-calls`, `ux.screenreader-continuity`, `ux.natural-layout-flow`,
  `ux.body-portal-compat`) -> attractive when all participants are one organization's
  trusted, actively maintained code and seamless UX dominates.
- Shared realm -> one participant's built-in mutations, unhandled exceptions, and leaked
  timers reach everyone; teardown is best-effort (`runtime.primordials-blast-radius`,
  `isolation.failure.post-mount-exception`=n, `isolation.lifecycle.reclaim`=n) ->
  acceptable only while cross-team code quality and coordination hold; the cost grows with
  team count and cadence independence.
- Virtualized realm -> shared-document UX with simulated global/DOM/CSS confinement for
  *cooperating* teams, and unmodified-page rehosting via HTML entry -> the framework must
  maintain sandbox fidelity against the browser (documented escape hatches, execution tax,
  patched-path-only teardown: `security.isolation-escape-hatches`,
  `performance.sandbox-execution-tax`, qiankun/micro-app-jd conditions in
  `../matrix/columns/`) -> attractive for multi-team legacy rehosting inside one org;
  never a security boundary (see 2.2).
- Separate document -> browser-enforced CSS both ways, exception and crash containment,
  full reclaim on teardown, fresh-context recovery in page
  (`isolation.css.outbound`/`.inbound`, `isolation.recovery.in-page`) -> pay per-unit
  document boot, serialized messaging, and the UX seam (overlay clipping unless a
  host-overlay protocol exists, focus/a11y discontinuity, frame history pollution:
  `ux.overlay-viewport-escape`, `ux.host-overlay-protocol`, `ux.frame-history-pollution`)
  -> attractive when containment or trust requirements outweigh seam engineering.
- Serial documents -> realm questions never arise at all; the boundary cost is moved
  entirely into navigation (see `dimension.composition-granularity`).

### 2.2 `dimension.trust-ceiling` : maximum supportable distrust

**Definition.** The most adversarial participant relationship the mechanism can support
under its own stated trust model plus the browser boundary class in use. Distinct from
2.1: the compact matrix correlates them near 1.0 (only frame-based units reach the top),
but the per-cell conditions show a document boundary alone is **not** a trust boundary
(a same-origin unsandboxed frame holds host-origin authority: hyperfrontend and luigi
column conditions on `isolation.origin.host-authority`, `security.host-dom-reach`).
Keeping both dimensions preserves that distinction (REQ-MATRIX-05: never convert
"isolated" into "secure" without defining the boundary).

**Scale.**

| Pole id | Meaning | Units |
|---|---|---|
| `trust.cooperative` | One security principal; any participant compromise is page compromise | all `realm.shared` and `realm.serial-documents` units |
| `trust.interference-damped` | Accidental collisions damped by virtualization; malice out of scope | qiankun, micro-app-jd, wujie, web-fragments |
| `trust.distinct-principal` | Browser-enforced principal separation reachable (cross-origin + sandbox, conditionally process isolation) | hyperfrontend (c), iframe-composition (c), luigi iframe mode (c); reverse-proxy-route-composition conditionally at page granularity |

**Explains.** `security.cross-origin-boundary`, `security.sandbox-attribute-applicable`,
`security.per-participant-csp`, `security.capability-narrowing`,
`security.host-dom-reach`, `security.host-js-state-reach`,
`security.untrusted-third-party-viable`, `security.embedding-authorization`,
`security.channel-origin-pinning`, `isolation.origin.host-authority`,
`isolation.storage.partition`, `isolation.navigation.top-level-guard`,
`isolation.resource.main-thread`, `isolation.process.crash`,
`isolation.security.malicious-participant`, `performance.process-memory-overhead`,
`ownership.external-participant`; partially `ownership.participant-bytes-verbatim`
(rewriting composers execute transformed bytes: qiankun, micro-app-jd, wujie,
server-side rewriting tiers).

**Causal chains.**

- Adopting the browser origin boundary -> SOP denies host DOM/JS state reach, sandbox and
  per-participant CSP become applicable, storage partitions, and on process-isolating
  engines crash/Spectre containment appears (`security.host-dom-reach`=n conditions,
  `isolation.process.crash` conditions) -> participants owned by other organizations
  become composable as distinct principals (`ownership.external-participant`) ->
  attractive for third-party vendor, acquisition, plugin-marketplace, and white-label
  topologies ([topology.md](topology.md)); overhead without benefit for one team's code.
- Staying same-origin behind a frame -> document containment without authority separation
  -> a boundary against accidents, not adversaries -> attractive when the boundary is
  organizational rather than adversarial; must never be sold as security.
- The matrix-wide floor: `security.untrusted-third-party-viable` is No for 27 of 30
  units. Only two units even conditionally support genuinely untrusted code. This makes
  the attribute a hard-constraint eliminator of extreme power (REQ-Q-02) despite its near
  uniformity (section 4.1).

### 2.3 `dimension.integration-time` : when participants meet

**Definition.** The lifecycle phase at which independently owned code is joined: in a
consumer's build, or after each side has shipped. REQ-DIM-01's "integration time
(build -> deploy -> runtime)" survives the evidence intact and is the second strongest
factor.

**Scale.** `time.build-fused` (host build consumes participant source/artifacts) ->
`time.deploy-decoupled` (participants ship separately; composition resolves at request or
load) -> `time.runtime-live` (participant set or version can change inside a running
document: `runtime.late-participant-registration`, `runtime.loaded-version-hot-swap`).

**Units.** Build-fused: bit, commercetools-frontend, islands-architecture,
modular-monolith, monorepo-package-composition, plain-spa-routing,
server-rendered-templates. All 23 others are deploy-decoupled; the runtime-live extreme is
reached by entando, hyperfrontend, iframe-composition, luigi, micro-app-jd, qiankun,
wujie, web-fragments, and conditionally the loader-based units (single-spa, module
federation 2.0 `registerRemotes`, import-map-architectures).

**Explains.** `buildtime.host-build-consumes-participants`,
`composition.phase.deploy-unit-per-participant`, `deployment.host-rebuild-required`,
`contracts.drift-surface`, `ownership.deploy-schedule-ownership`,
`ownership.single-team-endorsed`, `operations.deploy-time-contract-verification`,
`runtime.late-participant-registration`, `runtime.loaded-version-hot-swap`,
`performance.per-unit-http-cacheable`; partially `contracts.types-shared`,
`framework.per-team-framework-autonomy`, `migration.exit.participants-standalone`.

Correlation evidence: `buildtime.host-build-consumes-participants` ~
`composition.phase.deploy-unit-per-participant` r=-0.98, ~
`ownership.deploy-schedule-ownership` r=-0.98, ~ `deployment.host-rebuild-required`
r=+0.95, ~ `contracts.drift-surface` r=-0.91.

**Causal chains.**

- Build fusion -> whole-graph types, deploy-time contract verification, atomic releases,
  and version drift is structurally impossible (`contracts.drift-surface`=n,
  `operations.deploy-time-contract-verification`) -> attractive for a single coordinated
  team on one release train (`ownership.single-team-endorsed` correlates +0.87), which is
  exactly the REQ-Q-04 "maybe you do not need microfrontends" region.
- Build fusion -> every participant change rides the host pipeline; no team owns its own
  deploy schedule (`deployment.host-rebuild-required`=y,
  `ownership.deploy-schedule-ownership`=n) -> increasingly damaging as team count,
  cadence independence, or organizational distrust grow.
- Deploy decoupling -> independent cadence and per-unit cacheable artifacts -> version
  drift becomes structurally possible, creating the entire demand that
  `dimension.contract-explicitness` answers -> the two dimensions must be read together
  (section 3.3).

### 2.4 `dimension.assembly-locus` : where composition executes

**Definition.** Which tier physically assembles the composed experience: a consumer's
build output, a server/edge tier on the request path, or client-side JS in the browser.

**Scale and units.**

| Pole id | Units |
|---|---|
| `locus.consumer-build` | bit, commercetools-frontend, islands-architecture (build+server), modular-monolith, monorepo-package-composition, plain-spa-routing, server-rendered-templates |
| `locus.request-path` | cloudflare-workers-microfrontends, edge-side-composition, nextjs-multi-zones, opencomponents (server-client mode), podium, reverse-proxy-route-composition, server-side-fragment-composition, web-fragments (gateway piercing) |
| `locus.client-runtime` | entando, hyperfrontend, iframe-composition, import-map-architectures, luigi, micro-app-jd, module-federation, native-federation, picard-js, piral, qiankun, single-spa, web-components-composition, wujie |

Dual-locus units are flagged, not forced (REQ-FAM-03): opencomponents (both modes),
web-fragments (pierced SSR + client mount), module-federation (Modern.js SSR path,
conditional), islands-architecture (build-time prerender + selective client boot).

**Explains.** `composition.exec.client-composed`, `ssr.composed-page`,
`ssr.fragment-granularity`, `ssr.streaming-assembly`, `ssr.no-js-first-paint`,
`ssr.crawler-indexable`, `ssr.static-prerender`, `ssr.edge-composition`,
`ssr.static-hosting-sufficient`, `ssr.html-fragment-contract`, `ssr.dev-prod-parity`,
`contracts.http-request-contract`, `contracts.server-context-propagation`,
`deployment.participants-static-artifacts`, `performance.request-time-server-fanout`,
`performance.client-composition-runtime`, `performance.pre-render-orchestration-fetch`,
`performance.sequential-waterfall-default`, `performance.default-content-caching`,
`ux.composed-first-paint`, `ux.mount-layout-shift-risk`, `isolation.server.process`,
`ownership.runtime-operational-ownership`, `framework.composition-tier-stack-mandated`;
partially `deployment.strategy-service-in-path` (see 3.4),
`migration.host.new-infra-tier-required`, `operations.cross-journey-correlation-diy`.

Correlation evidence: `contracts.http-request-contract` ~
`deployment.strategy-service-in-path` r=+0.91, ~ `deployment.participants-static-artifacts`
r=-0.90; `ssr.crawler-indexable` ~ `ux.composed-first-paint` r=+0.83;
`performance.client-composition-runtime` ~ `performance.sequential-waterfall-default`
r=+0.92; `isolation.server.process` ~ `ownership.runtime-operational-ownership` r=+0.83.

**Causal chains.**

- Request-path assembly -> composed first paint, crawlable no-JS content, per-fragment
  HTTP caching, streaming (`ux.composed-first-paint`, `ssr.crawler-indexable`,
  `ssr.streaming-assembly`) -> attractive for content/commerce surfaces, SEO, and low-JS
  budgets.
- Request-path assembly -> a composer service and participant services live on the
  production request path; teams operate origins with on-call surfaces; request-time
  fanout (`deployment.strategy-service-in-path`, `performance.request-time-server-fanout`,
  `ownership.runtime-operational-ownership`) -> acceptable to organizations that already
  run server estates; a hard mismatch for static-hosting shops
  (`ssr.static-hosting-sufficient`=n).
- Client assembly -> production delivery can be static files and CDNs
  (`ssr.static-hosting-sufficient`) -> the page pays a composition runtime, an
  orchestration fetch before first unit render, a discovery waterfall, and loading-state
  design (`performance.pre-render-orchestration-fetch`,
  `performance.sequential-waterfall-default`, `ux.mount-layout-shift-risk`) -> attractive
  for authenticated app-like surfaces where SEO and first-paint composition matter less.

### 2.5 `dimension.composition-granularity` : page-partition vs region composition

**Definition.** Whether the unit of composition is a whole navigation (URL-partitioned
applications) or a region inside one live page (concurrent co-resident participants).

**Poles.** `granularity.page`: cloudflare-workers-microfrontends, nextjs-multi-zones,
reverse-proxy-route-composition, server-rendered-templates
(`runtime.concurrent-participants`=n). `granularity.region`: all others (qiankun
conditional on `singular:false`).

**Explains.** `composition.kind.http-route-partition`, `runtime.concurrent-participants`,
`runtime.multi-router-participants`, `ux.persistent-shared-chrome`,
`ux.cross-boundary-soft-nav` (jointly with 2.4), `ux.unit-keepalive`,
`ux.cross-boundary-prefetch`, `ux.cross-doc-view-transitions`, `ux.deep-link-inner-route`
(partially), `deployment.single-domain-required` (partially),
`buildtime.asset-prefix-coordination` (partially).

**Causal chains.**

- Page partition -> participants need near-zero adaptation (floor level 1 in
  [migration.md](migration.md)), zero co-residence concerns: realm, CSS, dependency, and
  namespace questions of 2.1/2.2/2.7 simply never arise -> every boundary crossing is a
  full document load; shared chrome cannot persist and is duplicated per participant
  (`ux.cross-boundary-soft-nav`=n, `ux.persistent-shared-chrome`=n) -> attractive when
  team boundaries align with rarely-crossed journey seams (portal home vs checkout).
- Region composition -> one screen can mix outputs of multiple teams and chrome stays
  mounted -> activates the entire question load of dimensions 2.1, 2.2, and 2.7 ->
  attractive for dashboards, consoles, and marketplaces where the product itself is the
  mixture.
- Persistent chrome requires a persistent client document: it fails at the page pole
  *and* on request-path assemblies whose navigations reload the document (podium,
  server-side-fragment-composition score n on `ux.persistent-shared-chrome` despite
  region-granular fragments). Chains 2.4 and 2.5 jointly explain the `ux` continuity
  attributes; neither alone does.

### 2.6 `dimension.adaptation-floor` : modification demanded before participation

**Definition.** The minimum level on the [migration.md](migration.md) section-2 scale a
unit demands, in two facets: of an existing participant
(`migration.participant.min-level`) and of the composing host as one-time adoption work
(`migration.host.min-level`). The compact TSV shows these rows as `c` because they carry
scale ids, not y/n; per-unit values live in `../matrix/columns/<unit>.json`.

**Positions (participant floor / host floor, from the column files):**

| Band | Units |
|---|---|
| Participant level 1 (config/serving only) | cloudflare-workers-microfrontends, edge-side-composition, iframe-composition, micro-app-jd, nextjs-multi-zones, picard-js, reverse-proxy-route-composition, web-fragments, wujie, bit (adoption bridge), luigi (embed-only), import-map-architectures (if already ESM) |
| Participant level 2 (adapter around unchanged app) | opencomponents, podium, server-side-fragment-composition, web-components-composition |
| Participant level 3 (bundler change) | module-federation, zephyr-cloud, import-map-architectures (typical) |
| Participant level 4 (bootstrap/lifecycle edit) | entando, hyperfrontend, native-federation, piral, qiankun, single-spa |
| Participant level 6+ (extraction/framework work) | modular-monolith, monorepo-package-composition, plain-spa-routing, server-rendered-templates (feature extraction into the composed codebase), commercetools-frontend (level 7) |
| Host inversion (host floor >= level 6) | piral (major refactor: shell takeover), commercetools-frontend and entando (rewrite: the platform is the host) |

**Explains.** `migration.participant.min-level`, `migration.host.min-level`,
`migration.source-modification-required`,
`migration.participant.bootstrap-change-required`,
`migration.participant.internals-refactor-required`,
`migration.participant.deployment-change-required`,
`migration.participant.extraction-required`, `migration.participant.rewrite-required`,
`migration.participant.thirdparty-unmodified-viable`,
`migration.participant.legacy-no-build-viable`, `migration.strangler.incremental`,
`migration.host.new-infra-tier-required`, `migration.host.shell-takeover-required`,
`migration.exit.participants-standalone`, `buildtime.participant-tooling-required`,
`buildtime.host-integrates-buildless`, `framework.foreign-artifact-no-rebuild`,
`framework.html-document-entry`, `composition.kind.lifecycle-contract`; partially
`framework.participant-framework-agnostic`, `framework.zero-framework-participant`
(agnosticism is mostly a consequence of a low floor plus a non-fused integration time).

Correlation evidence: `framework.foreign-artifact-no-rebuild` ~
`migration.participant.thirdparty-unmodified-viable` r=+0.87;
`migration.host.shell-takeover-required` ~ `ownership.nested-host-seat` r=-0.89.

**Causal chains.**

- Consuming what already ships (deployed HTML pages, fragment endpoints, URLs) -> floor
  levels 1-2; third-party and no-build legacy participation become viable
  (`migration.participant.thirdparty-unmodified-viable`,
  `migration.participant.legacy-no-build-viable`) -> attractive for acquisitions, frozen
  legacy, vendor apps, and any owner who will change nothing
  ([topology.md](topology.md); REQ-MIG-02).
- Demanding a lifecycle/SDK contract (floor level 4) -> the host gains orchestration:
  mount/unmount control, props/context push, buses (`contracts.host-push-updates`,
  `contracts.builtin-messaging`) -> the price is editing every participant's entry code
  -> attractive when participants are actively maintained in-house; eliminating when any
  participant is unmodifiable (REQ-Q-02 hard constraint).
- Host inversion (shell takeover or platform rewrite) -> adoption is a program, not a
  task, and strangler paths start with an upfront cutover (piral condition:
  pilet-by-pilet only *after* the shell owns the root) -> attractive greenfield or when
  the platform is itself the product being bought.

### 2.7 `dimension.dependency-economy` : how shared libraries are handled

**Definition.** Whether a library used by several participants ships once or many times,
and who has to agree on versions for that to work.

**Poles.** `deps.duplicated` (each unit carries its own copies; no machinery): iframe,
hyperfrontend, luigi, qiankun, micro-app-jd, wujie, web-fragments, podium,
server-side-fragment-composition, edge-side-composition, opencomponents, entando,
web-components-composition, and all `granularity.page` units. `deps.negotiated` (runtime
or importmap negotiation across independently built units): module-federation,
native-federation, import-map-architectures, picard-js, piral, single-spa (scoped import
maps, conditional). `deps.single-copy-by-build` (one resolution in one build): bit,
commercetools-frontend, islands-architecture, modular-monolith,
monorepo-package-composition, plain-spa-routing, server-rendered-templates.

**Explains.** `performance.shared-dependency-dedup`,
`performance.duplicate-framework-same-page`,
`performance.dedup-failure-on-version-skew`, `runtime.shared-dep-negotiation`,
`runtime.dep-conflict-surfaces-runtime`, `buildtime.share-metadata-emitted`,
`buildtime.shared-dep-change-rebuilds-center`, `coordination.shared-dependency-governance`,
`ownership.uncoordinated-upgrades`, `composition.kind.js-module-graph` (the enabling
seam), `framework.esm-artifact-required` (format precondition of importmap negotiation);
partially `runtime.side-by-side-versions`, `framework.same-framework-major-coexistence`
(jointly with 2.1: realm separation makes coexistence trivial; negotiation makes it
conditional).

Correlation evidence: `composition.kind.js-module-graph` ~
`performance.shared-dependency-dedup` r=+0.94, ~
`performance.duplicate-framework-same-page` r=-0.89;
`buildtime.shared-dep-change-rebuilds-center` ~ `ownership.uncoordinated-upgrades`
r=-0.88; `contracts.types-shared` ~ `ownership.uncoordinated-upgrades` r=-0.85.

**Causal chains.**

- Negotiated sharing -> one download and one instance of shared libraries per page
  (`performance.shared-dependency-dedup`) -> standing cross-team version governance
  before and after builds, conflicts that first surface at runtime, and silent
  duplicate-copy fallbacks under skew (`coordination.shared-dependency-governance`,
  `runtime.dep-conflict-surfaces-runtime`, `performance.dedup-failure-on-version-skew`;
  module-federation condition: the semver gate covers shared deps only, never the exposed
  API) -> attractive when payload budgets matter, participants are numerous per page, and
  the org can run upgrade trains.
- Duplication by default -> teams upgrade whenever they want, forever; incompatible
  majors coexist (`ownership.uncoordinated-upgrades`,
  `framework.same-framework-major-coexistence`) -> N framework copies on co-displayed
  pages (`performance.duplicate-framework-same-page`) -> attractive when autonomy or
  distrust dominates and co-displayed unit count stays small.
- Single copy by build -> no duplication and no negotiation machinery at all -> any
  shared-dependency change rebuilds the world
  (`buildtime.shared-dep-change-rebuilds-center`) -> the same trade as 2.3's build pole;
  these poles travel together.

### 2.8 `dimension.roster-authority` : who admits and wires participants

**Definition.** Whether the mapping of participants onto the composed experience lives in
host code, in one centrally owned map/config, or behind a registry/feed that teams
publish into.

**Poles.** `roster.host-authored` (wiring is host code; no shared map artifact):
iframe-composition, hyperfrontend, micro-app-jd, wujie, web-components-composition, bit.
`roster.central-map` (one owned config/pointer artifact: import map, root config, routing
table, layout): cloudflare-workers-microfrontends, commercetools-frontend,
edge-side-composition, import-map-architectures, luigi, module-federation (classic),
native-federation, nextjs-multi-zones, podium, qiankun (`registerMicroApps`),
reverse-proxy-route-composition, server-side-fragment-composition, single-spa,
web-fragments. `roster.registry-mediated` (publish/discovery admits without a central
owner): opencomponents, piral, zephyr-cloud, entando (platform UI; also the only
mainstream `ownership.non-developer-composition`=y unit besides commercetools).

**Explains.** `runtime.central-routing-map`, `deployment.new-participant-host-change`,
`deployment.golive-central-pointer`, `deployment.runtime-discovery-first-party`,
`ownership.onboarding-without-central-owner`, `ownership.platform-team-role-required`,
`ownership.non-developer-composition`, `runtime.global-registration-collision` (namespace
governance is roster governance); partially `runtime.late-participant-registration`.

**Causal chains.**

- Central map -> one accountable inventory, atomic routing changes, rollback by repoint
  -> a standing platform-owner role, serialized writes, and go-live gated on someone
  else's pointer update (`ownership.platform-team-role-required`,
  `deployment.golive-central-pointer`) -> attractive at moderate scale with a real
  platform team ([topology.md](topology.md) platform+product); a bottleneck otherwise.
- Registry mediation -> teams onboard by publishing; discovery and inventory come
  first-party (`ownership.onboarding-without-central-owner`,
  `operations.deploy-inventory-firstparty`) -> the registry/feed is a service in the
  availability and code-trust path (`security.delivery-intermediary-trust`) ->
  attractive for plugin-ecosystem and marketplace topologies with many independent
  publishers.
- Host authorship -> no shared artifact and no governance overhead -> every roster change
  is a host code change and deploy (`deployment.new-participant-host-change`=y) ->
  attractive when the roster is small and stable; scales badly in participant count.

### 2.9 `dimension.release-actuation` : how a new version reaches users

**Definition.** The mechanics that make a participant deploy become live for consumers:
overwriting a mutable well-known URL, versus publishing immutable versions and switching
a pointer.

**Poles.** `actuation.mutable-url` (deploy is release; consumers track a URL):
hyperfrontend, iframe-composition, luigi, micro-app-jd, qiankun, wujie, web-fragments,
module-federation (default), native-federation, single-spa (conventional).
`actuation.pointer-switch` (immutable retained versions + repointable reference): bit,
import-map-architectures (versioned URLs + map), opencomponents, zephyr-cloud,
edge-side-composition (pinned fragment URLs), piral (feed decides, conditional).
Build-fused units inherit their package manager's semantics and sit outside this
dimension's live tradeoff.

**Explains.** `deployment.consumer-version-pin`, `deployment.per-user-version-targeting`,
`deployment.immutable-version-retention`, `deployment.cache-busting-operator-burden`,
`governance.rollback` (shared with 2.12); partially `deployment.golive-central-pointer`
(shared with 2.8), `operations.version-skew-machinery`.

**Causal chains.**

- Immutable versions + pointer -> pinning, instant rollback by repoint, per-user/preview
  targeting, no TTL races (`governance.rollback`, `deployment.per-user-version-targeting`)
  -> requires retention infrastructure and pointer governance -> attractive for
  regulated, high-blast-radius, or many-consumer release engineering.
- Mutable URL -> the simplest possible pipeline: deploying is releasing -> operator-managed
  cache busting, skew windows during rollout, and no first-party rollback
  (`deployment.cache-busting-operator-burden`=y) -> acceptable while blast radius and
  consumer count stay small; the first production incident usually reopens this choice.

### 2.10 `dimension.contract-explicitness` : how the boundary interface is declared

**Definition.** Whether the host-participant interface is implicit (code-level imports,
bare URLs, conventions) or declared in a machine-readable, versioned, checked form.

**Scale.** `contract.implicit` -> `contract.descriptor` (machine-readable manifest) ->
`contract.gated` (version stamped at build and mechanically checked when the sides meet,
drift surfaced explicitly).

**Units.** Gated: hyperfrontend (descriptor + version + connect gate + explicit drift
error; the only unit scoring y on all four), bit (build-time), luigi (Client handshake),
opencomponents (registry semver resolution + parameter validation, conditional),
module-federation and native-federation (conditional: the gate covers shared-dependency
semver only, never the exposed API shape; see the module-federation column conditions).
Descriptor-only: commercetools-frontend, entando, piral, podium, zephyr-cloud.
Implicit: iframe-composition, import-map-architectures, micro-app-jd, qiankun, single-spa
(c), web-components-composition, wujie, and the route-partition and baseline units.

**Explains.** `contracts.formal-descriptor`, `contracts.contract-versioned`,
`contracts.connect-compat-gate`, `contracts.drift-explicit`,
`contracts.schema-validated-payloads`, `operations.version-skew-machinery`,
`operations.owner-attribution-builtin` (partially), `contracts.types-shared` (partially,
with 2.3).

**Causal chains.**

- Deploy decoupling (2.3) makes drift structurally possible; gate machinery converts a
  silent late failure in application code into an explicit early refusal at
  connect/load (`contracts.drift-explicit`) -> attractive precisely as cadence
  independence and the number of independent parties grow; ceremony overhead when one
  team ships both sides on one train.
- Partial gates mislead: a dependency-semver gate without an API-shape check
  (module-federation conditions) protects against the rarer failure and not the common
  one; the engine must never read `contracts.connect-compat-gate`=c as "contract safe"
  (REQ-MATRIX-05).
- Schema-validated payloads at the message/request boundary
  (`contracts.schema-validated-payloads`: commercetools, opencomponents, hyperfrontend
  conditional) -> runtime protection paid per message
  (`performance.per-message-serialization-cost` where a serialized boundary exists).

### 2.11 `dimension.orchestration-thickness` : how much runtime the strategy ships

**Definition.** The amount of strategy-owned machinery a composed page carries: from
browser primitives plus conventions, through a loader/lifecycle library, to a managed
platform surface with buses, fallback UI, and dev tooling.

**Poles.** `orchestration.primitive` (nothing strategy-owned on the page):
iframe-composition, import-map-architectures, reverse-proxy-route-composition,
nextjs-multi-zones, cloudflare-workers-microfrontends, web-components-composition,
edge-side-composition, server-side-fragment-composition (thin client), and the build-time
baselines. `orchestration.library` (loader/lifecycle runtime, adopter-assembled):
single-spa, module-federation, native-federation, picard-js, podium (client hydrator),
web-fragments, micro-app-jd, wujie. `orchestration.platform` (lifecycle + comms + UI +
tooling as a product): piral, luigi, entando, qiankun, hyperfrontend,
commercetools-frontend, opencomponents (registry + client), zephyr-cloud (tooling tier).

**Explains.** `runtime.shared-runtime-library`, `performance.client-composition-runtime`,
`framework.client-library-required`, `contracts.builtin-messaging`,
`contracts.builtin-shared-state`, `contracts.host-push-updates`, `ux.builtin-loading-ui`,
`ux.builtin-error-fallback-ui`, `isolation.failure.lifecycle-quarantine`,
`isolation.failure.load-fallback`, `operations.first-party-debug-tooling`,
`operations.local-composed-dev-firstparty`, `operations.composed-test-utilities`,
`operations.standalone-participant-dev`, `framework.official-adapters-exist`,
`framework.version-floor-imposed`; partially `operations.owner-attribution-builtin`,
`framework.multi-framework-demonstrated`.

**Causal chains.**

- Thick runtime -> shipped answers to lifecycle failure, communication, loading and error
  UX, local composed dev (`isolation.failure.lifecycle-quarantine`,
  `contracts.builtin-messaging`, `operations.local-composed-dev-firstparty`) -> every
  participant becomes version-coupled to the runtime (`runtime.shared-runtime-library`),
  a tooling/framework floor appears (`framework.version-floor-imposed`), and the runtime
  itself is a shared upgrade train -> attractive when teams want a paved road and accept
  the strategy as a long-lived dependency.
- Primitive composition -> nothing to co-version; the mechanism's lifetime is the
  browser's (`buildtime.host-integrates-buildless`) -> every operational concern is
  adopter-built: fallback UI, correlation, messaging, inventory
  (`operations.cross-journey-correlation-diy`, `ux.builtin-error-fallback-ui`=n) ->
  attractive to platform-averse organizations and decade-scale horizons; the DIY cost
  recurs per adopter.

### 2.12 `dimension.delivery-governance` : who operates the delivery machinery

**Definition.** Whether participant code reaches pages unmediated from team origins,
through mediation infrastructure the adopter self-hosts, or through a vendor-operated
control plane. This is the dimension where commercial editions attach; per REQ-ENT-01 it
must select implementations and editions, never families.

**Poles.** `delivery.unmediated`: iframe-composition, import-map-architectures,
module-federation, native-federation, single-spa, qiankun, wujie, micro-app-jd,
hyperfrontend, luigi, web-components-composition, and the baselines.
`delivery.self-hosted-mediation` (adopter-run registry/feed/composer): opencomponents,
piral (OSS feed), entando, podium (layout tier), server-side-fragment-composition,
edge-side-composition. `delivery.vendor-control-plane` (SaaS in the metadata or delivery
path): zephyr-cloud, cloudflare-workers-microfrontends, commercetools-frontend; piral
and bit conditionally (cloud tiers).

**Explains.** `hosting.operator`, `hosting.control-plane`, `registry.deployable-feature`,
`governance.rollback` (with 2.9), `governance.usage-monitoring`, `governance.rbac`,
`security.delivery-intermediary-trust`, `deployment.vendor-hosting-required`,
`unit.editions.commercial-tier`, `unit.editions.oss-self-sufficient`,
`operations.deploy-inventory-firstparty` (partially),
`operations.composition-tier-local-parity` (negative pole), `unit.license.osi-core`
(correlate: r=-0.87 against vendor hosting).

Correlation evidence: `unit.editions.commercial-tier` ~ `governance.rbac` r=+0.89, ~
`hosting.operator` r=+0.85; `hosting.control-plane` ~ `deployment.vendor-hosting-required`
r=-0.85.

**Causal chains.**

- Vendor control plane -> governance capabilities appear almost only here: rollback,
  usage visibility, RBAC, per-user targeting (`governance.*`,
  `deployment.per-user-version-targeting`) -> vendor code-execution trust in the delivery
  path, hosting lock-in, and sponsor-concentration risk
  (`security.delivery-intermediary-trust`, `deployment.vendor-hosting-required`;
  zephyr-cloud viability conditions) -> attractive when operational capacity is scarce
  and vendor risk is tolerable; these are edition facts
  ([enterprise-layer.md](enterprise-layer.md)), not family facts.
- Self-hosted mediation -> governance without a vendor -> the adopter operates a service
  that sits in the availability path and must be trusted with code
  (`deployment.strategy-service-in-path`, `security.delivery-intermediary-trust`).
- Unmediated delivery -> no intermediary trust, maximum longevity -> no first-party
  inventory, rollback, or monitoring anywhere; those needs become explicit gaps
  (REQ-GAP-01/02 records, not lowered bars).

---

## 3. Structural findings the dimensions must carry

### 3.1 Nesting between 2.1 and 2.2

No unit in the matrix reaches `trust.distinct-principal` without `realm.separate-document`
(or page granularity). The reverse is false: a same-origin frame is a document boundary
with no principal separation (hyperfrontend, luigi conditions). The engine should treat
trust-ceiling as gated on realm class, never derivable from it.

### 3.2 Downstream surfaces, not dimensions

The `ux` and `performance` groups dissolve almost entirely into consequences, confirming
the matrix's own design ("performance causes, not fast/slow", REQ-MATRIX-04):

- UX continuity = f(`dimension.composition-granularity`, `dimension.assembly-locus`,
  `dimension.runtime-realm`). Example: `ux.persistent-shared-chrome` requires region
  granularity AND a persistent client document; `ux.natural-layout-flow` is the shared
  document's gift and the iframe's tax.
- Performance profile = f(realm, locus, dependency economy): document boot cost (2.1),
  waterfall and runtime bytes (2.4), duplication vs negotiation (2.7).
- Operational complexity = f(locus, roster, thickness, delivery governance): there is no
  single "ops" axis; four separate choices each add a distinct burden.

The Families stage must not re-promote these surfaces into family definitions; they are
derived rows in each family's consequence table.

### 3.3 The drift hinge

`contracts.drift-surface` is the causal hinge of the model: created by 2.3's
deploy-decoupled pole (r=+0.89 with `composition.phase.deploy-unit-per-participant`),
answered by 2.10's machinery, and eliminated only by returning to the build-fused pole.
Question design (REQ-Q-01) gets high information here: one answer about release trains
positions a team on 2.3 and prices 2.10 simultaneously.

### 3.4 Attributes with two upstream causes

`deployment.strategy-service-in-path` is true for two unrelated reasons: a composer on
the request path (2.4) or a discovery/registry service (2.8/2.12). Decision rules must
distinguish them; "no services" as a constraint eliminates different unit sets depending
on which cause applies. Same pattern: `governance.rollback` (2.9 actuation vs 2.12
platform), `migration.host.new-infra-tier-required` (2.4 vs 2.12).

### 3.5 Mode-forked units

`operations.mode-forked-operations`=y for luigi (iframe vs web-component),
micro-app-jd (with-sandbox vs iframe), qiankun (v2 vs v3, sandbox modes), wujie (normal
vs degrade), web-fragments (pierced vs client-mounted), piral, picard-js, opencomponents
(server vs client), edge-side-composition, reverse-proxy-route-composition,
hyperfrontend and iframe-composition (same-origin vs cross-origin posture). These units
occupy *different positions per mode* on 2.1/2.2/2.4. Families must score configurations,
not brands (REQ-FAM-03); the compact cell alone under-describes them.

---

## 4. Derivation honesty: what did not reduce

### 4.1 Near-uniform attributes kept as hard-constraint guards

Low variance is not low value; these are eliminators or inclusion guards (REQ-Q-02):

- `unit.availability.installable-today` (30x y): the inventory's own inclusion criterion
  (REQ-AVAIL-01); keep as a guard for future refreshes.
- `ownership.code-boundary-ownership` (30x y): every strategy grants code-level
  ownership; the attribute exists to prove ownership rhetoric differentiates nothing.
- `security.untrusted-third-party-viable` (27x n): the landscape's sharpest eliminator;
  see 2.2.
- `security.artifact-integrity-verification` (19x n, rest c/?/NA): a landscape-wide
  absence; feed REQ-GAP-02 as a gap record, not a dimension.
- `ssr.rsc-federation` (no unqualified y anywhere): same treatment.
- `performance.process-memory-overhead` (NA except document-boundary units): a
  conditional cost note attached to 2.1's separate-document pole.
- `migration.participant.min-level`, `migration.host.min-level` (30x c): scale rows by
  design (REQ-MATRIX-03), consumed via 2.6.
- `ux.screenreader-continuity` (25x y): uniform except at 2.1's separate-document pole;
  kept as the a11y guard for that pole.

### 4.2 Residuals: attributes no dimension claims

Kept as unit-level facts; the engine may cite them, but no abstraction stands on them:

- `ownership.upstream-contract-lifetime` (picard-js, zephyr-cloud; qiankun c): inherited
  lifetime risk; feeds implementation selection, not taxonomy.
- `composition.kind.inherits-underlying` (zephyr-cloud): meta-attribute marking
  orchestration-around-a-primitive; instruction to Families (REQ-FAM-03), not a position.
- `ownership.nested-host-seat` (12x ?): too unknown to reduce; flagged for research
  (REQ-ORCH-09).
- `security.composition-injection-surface` (edge-side y): an ESI-specific hazard flag.
- `security.channel-confidentiality` (hyperfrontend c, all else n/NA): a single-unit
  differentiator; recording it as a dimension would violate REQ-ORCH-07, so it stays a
  cell.
- `ux.token-theming-mechanism`, `ux.deep-link-inner-route`, `ux.keepalive-scroll-restoration`:
  implementation-specific capabilities cutting across poles.
- `ssr.dual-mode-render`, `ssr.hydration-orchestration`, `ssr.server-loadable-artifact`:
  partially explained by 2.4 but with idiosyncratic exceptions (islands, piral v3,
  opencomponents); left as facts.
- `deployment.cross-origin-cors-required`, `buildtime.asset-prefix-coordination`,
  `deployment.single-domain-required`: serving-mechanics details; partially follow
  2.4/2.5 but are consumed directly as operational facts.
- `framework.adapters-track-current-majors`, `framework.official-adapters-exist`:
  ecosystem-maturity facts (lens, 4.3, plus 2.11).
- `migration.path.from-incumbent-format`: a migration-origin fact, not a position.

### 4.3 The implementation-selection lens (not an architectural dimension)

`unit.availability.*`, `unit.maintenance.*`, `unit.license.osi-core`,
`unit.editions.*`, `operations.single-sponsor-concentration`,
`migration.forced-remigration-pending`, `migration.permanent-viability`: these
differentiate units strongly (e.g. dormant qiankun v2 vs shipped v3 RC; picard-js
dormancy; zephyr-cloud funding) but describe *stewardship of an implementation*, not
architecture. REQ-AVAIL-03 and REQ-ENT-01 require them kept as independent selection
factors; folding them into architectural dimensions would let maturity distort the
taxonomy. They apply at REQ-Q-09's second level (which implementation), never the first
(which strategy).

Coverage tally: of 220 attributes, roughly 165 load on the 12 dimensions (each dimension
section lists its ids; dual-loading flagged in 3.4), 17 form the lens above, 8 are
uniform guards (4.1), and the remainder are residuals (4.2).

---

## 5. Provisional unit clusters (input to the Families stage)

Name-free groupings (REQ-FAM-01 naming happens at the Families stage). Membership below is
the unmodified output of the agglomerative clustering (section 1, step 3); annotations
record the dimension positions that bind each cluster and the honest internal spread
(REQ-FAM-04: no pretended differences, no pretended sameness).

### `cluster.c0` : build-fused single-artifact composition

Members: modular-monolith, plain-spa-routing, monorepo-package-composition,
islands-architecture, server-rendered-templates, bit, commercetools-frontend.
Binding positions: `time.build-fused`, `deps.single-copy-by-build`,
`locus.consumer-build`, drift impossible, deploy autonomy none, participant floor >= 6
for existing external apps.
Internal spread: bit and commercetools-frontend add registry/platform layers
(2.8 registry, 2.12 mediation) on top of build fusion; islands-architecture adds
request/build-time rendering with per-region hydration; the other four are the REQ-Q-04
"no microfrontends" baselines.

### `cluster.c1` : URL-partitioned whole-page routing

Members: cloudflare-workers-microfrontends, nextjs-multi-zones,
reverse-proxy-route-composition.
Binding positions: `granularity.page`, `realm.serial-documents`, `locus.request-path`
(routing tier), participant floor 1, `trust.cooperative` per page (conditionally higher:
separate documents never co-reside).
Internal spread: cloudflare-workers adds a vendor control plane (2.12);
nextjs-multi-zones binds the stack (`framework.composition-tier-stack-mandated`).

### `cluster.c2` : server/edge fragment assembly

Members: edge-side-composition, podium, server-side-fragment-composition, opencomponents.
Binding positions: `locus.request-path` at fragment granularity, contract =
HTTP fragment endpoint (`contracts.http-request-contract`), composed first paint,
participants operated as services, floor 1-2, `realm.shared` on the client,
`deps.duplicated`.
Internal spread: opencomponents adds registry mediation and immutable versioning
(2.8/2.9); edge-side-composition carries the injection-surface hazard.

### `cluster.c3` : platform-owned widget composition

Members: entando.
Binding positions: `roster.registry-mediated` with non-developer composition, host floor
= rewrite (the platform is the host), `orchestration.platform`,
`delivery.self-hosted-mediation`, `realm.shared` custom-element seam.
Note: singleton cluster; nearest neighbors (podium 0.75, opencomponents 0.74) differ on
the host-inversion and platform-surface positions. commercetools-frontend (in c0) is its
closest conceptual sibling on 2.6/2.12; the Families stage should test whether a
"platform-owns-the-host" family spans them.

### `cluster.c4` : co-resident document embedding

Members: hyperfrontend, iframe-composition, luigi.
Binding positions: `realm.separate-document`, `trust.distinct-principal` reachable
(conditions: cross-origin + sandbox), serialized/frame messaging, `deps.duplicated`,
`ssr.static-hosting-sufficient`, floor 1-4.
Internal spread: orchestration thickness runs the full scale (iframe-composition
primitive, luigi and hyperfrontend platform-thick); hyperfrontend uniquely pairs the
boundary with a gated contract (2.10); luigi mode-forks into a shared-realm variant.

### `cluster.c5` : client-side shared-realm module/lifecycle composition

Members: import-map-architectures, module-federation, native-federation, picard-js,
single-spa, piral, web-components-composition.
Binding positions: `realm.shared`, `locus.client-runtime`, `time.deploy-decoupled`,
`deps.negotiated` (except web-components-composition), central map or feed roster,
participant floor 3-4.
Internal spread: piral (and dormant picard-js) add feed mediation, shell takeover, and
platform thickness; module-federation/native-federation/import-map-architectures are thin
module layers; single-spa is lifecycle orchestration over any loader;
web-components-composition is the primitive end (no runtime, custom-element seam, no
negotiation) and the Families stage may split it out.

### `cluster.c6` : virtualized rehosting of deployed pages

Members: micro-app-jd, qiankun, wujie, web-fragments.
Binding positions: `realm.virtualized` (patched globals / hidden realms / reframing),
HTML-entry or fragment consumption of already-deployed apps, low participant floor
(1-4), `deps.duplicated`, `trust.interference-damped`, mode-forked operations.
Internal spread: web-fragments is dual-positioned (gateway piercing puts it in c2's locus
for SSR; its client reframing is this cluster's technique); qiankun's adoptable v2 line
vs v3 RC is a lens fact (4.3) that must not blur the position.

### `cluster.c7` : delivery control plane over an inherited composition boundary

Members: zephyr-cloud.
Binding positions: architecture inherited from c5 (`composition.kind.inherits-underlying`);
distinctive only on 2.8/2.9/2.12 (registry roster, pointer-switch actuation, vendor
control plane).
Note for Families: this is the REQ-FAM-03 orchestration-around-a-primitive case; it must
map to a c5 family *plus* a delivery-governance overlay, never to a family of its own
defined by the vendor surface (REQ-ENT-01).

---

Next stage (Families, deliverable 4): name vendor-neutral families from these clusters,
splitting where the internal-spread notes and mode forks (3.5) demand configurations, and
testing the c3/c0 platform-host hypothesis and the c5 web-components split. Every family
definition should cite its binding dimension poles by the `dimension.*`/pole ids above.
