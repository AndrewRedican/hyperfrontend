# Architectural Families

Status: DERIVED v1 (2026-08-29). Deliverable 4 (families, clustered honestly) and the
model half of deliverable 13 (vendor-neutral strategy catalogue) per MASTER.md section 16.
Per decision D-004 (2026-08-28), family dossiers live as full sections inside this file
rather than as separate per-strategy files; split them out only if this file becomes
unnavigable.

Inputs: the provisional clusters in [taxonomy.md](taxonomy.md) section 5 seed the
families; this file owns the final cut (REQ-FAM-04). Strategy verdicts from the second
discovery sweep are honored or explicitly overridden in section 1. Evidence base:
[../matrix/matrix-compact.tsv](../matrix/matrix-compact.tsv) (220 attributes x 30 units),
[../matrix/attributes.md](../matrix/attributes.md), per-cell conditions in
`../matrix/columns/<unit>.json`, dossiers in [../research/solutions/](../research/solutions/).
Dimension and pole ids cited throughout are defined in [taxonomy.md](taxonomy.md) section 2;
migration level ids in [migration.md](migration.md) section 2.

Discipline:

- Names describe what the architecture does, never who implemented it (REQ-FAM-01); the
  universe is defined by the landscape, not relative to any single unit (REQ-ORCH-07).
- Every family section ends with its representative implementations; delete every such
  list and the landscape explanation must remain coherent (REQ-KEYTEST-01).
- Multi-mode and layer units are mapped honestly in section 6, never forced into one
  bucket (REQ-FAM-03).
- Non-MFE baselines form their own family-like group of honest alternatives (section 5,
  REQ-Q-04).

---

## 1. From provisional clusters to families: the final cut

The taxonomy's eight clusters (c0-c7) were mechanical output. The decisions below apply
the two REQ-FAM-04 tests: merge groupings that differ only by branding or substrate, and
split groupings that hide a materially different composition boundary (a boundary is
materially different when the participant-facing contract changes, not when thickness,
tier, or tooling changes).

- **FC-1** (c1 kept): URL-partitioned whole-page routing becomes `family.route-partition`
  unchanged. The vendor control plane on one member is an edition fact (REQ-ENT-01), not
  a family difference.
- **FC-2** (c2 merged wider, sweep-2 overridden): sweep 2 provisionally split
  "server-side fragment composition" and "edge-side composition" into two families by
  assembly tier (origin vs edge). Final cut: one family,
  `family.server-fragment-assembly`. The participant contract is identical (an HTTP
  endpoint returning HTML: `contracts.http-request-contract`,
  `ssr.html-fragment-contract`); origin layout service, cache-tier include processing,
  and programmable edge worker are assembly-tier variants inside
  `locus.request-path`, recorded per variant, not per family.
- **FC-3** (c5 split three ways): cluster c5 hid three different participant contracts.
  (a) `web-components-composition` is split out as `family.custom-element-composition`:
  its seam is a DOM tag, it ships no strategy runtime, and it does not negotiate
  dependencies (the split the taxonomy itself flagged). (b) `single-spa` and `piral` are
  split out as `family.lifecycle-orchestration`: their seam is a mount/unmount function
  contract (`composition.kind.lifecycle-contract`), not a module import. (c) The
  remainder merges across brand lines into `family.module-graph-federation`:
  module-federation, native-federation, and import-map-architectures share one boundary
  (`composition.kind.js-module-graph` with negotiated dependencies); vendored container
  runtime vs native import maps is substrate and orchestration thickness, exactly the
  "more different than they really are" branding split REQ-FAM-04 forbids.
- **FC-4** (c6 kept): `family.virtualized-rehosting`. web-fragments stays dual-mapped
  (section 6): gateway piercing belongs to FC-2's family, client reframing here.
- **FC-5** (c4 kept): `family.document-embedding`. Its internal spread (primitive
  iframe practice vs platform-thick implementations) is orchestration thickness
  (`dimension.orchestration-thickness`), not a boundary difference; no split.
- **FC-6** (c3 hypothesis tested and REJECTED): the taxonomy asked whether a
  "platform-owns-the-host" family spans entando and commercetools-frontend. It does not.
  They disagree on integration phase (`time.runtime-live` vs `time.build-fused`),
  assembly locus (`locus.client-runtime` vs `locus.consumer-build`), and dependency
  economy (`deps.duplicated` vs `deps.single-copy-by-build`); all they share is host
  inversion (`dimension.adaptation-floor` host pole) and platform mediation
  (`dimension.delivery-governance`), which are overlays on a family, not a boundary.
  Entando maps into `family.custom-element-composition`; commercetools-frontend maps
  into `family.package-composition`; both carry explicit overlay notes.
- **FC-7** (c0 resolved): the build-fused cluster becomes the honest-alternatives group
  (section 5): four baseline entries plus `family.islands` as a boundary entry, with bit
  and commercetools-frontend mapped as implementations rather than strategies.
- **FC-8** (c7 dissolved): zephyr-cloud is a delivery-governance layer over an inherited
  boundary (`composition.kind.inherits-underlying`); it maps to
  `family.module-graph-federation` plus an ops overlay and is not a family (section 6).
- **FC-9** (picard-js re-placed): clustered into c5 mechanically, but it loads other
  families' artifact formats under one orchestrator without owning a boundary of its
  own; classified as an interop orchestration layer (section 6), cross-referenced from
  `family.lifecycle-orchestration`.

Result: seven microfrontend families, five family-like honest alternatives, and a layer
and alias register.

---

## 2. Summary table

| Family id | Composition boundary | Integration phase | Execution model | Member units |
|---|---|---|---|---|
| `family.route-partition` | URL path prefix; routing table | `time.deploy-decoupled` | `realm.serial-documents`, `granularity.page`, `locus.request-path` (routing only) | reverse-proxy-route-composition, nextjs-multi-zones, cloudflare-workers-microfrontends |
| `family.server-fragment-assembly` | HTTP endpoint returning HTML fragments | `time.deploy-decoupled` | `locus.request-path`, `granularity.region`, client `realm.shared` | server-side-fragment-composition, edge-side-composition, podium, opencomponents, web-fragments (pierced mode) |
| `family.custom-element-composition` | DOM custom-element interface (tag, attributes/properties, events) | `time.deploy-decoupled` (also usable fused) | `realm.shared`, `locus.client-runtime`, `granularity.region`, `orchestration.primitive` | web-components-composition, entando |
| `family.module-graph-federation` | JS module import with negotiated shared dependencies | `time.deploy-decoupled`, conditionally `time.runtime-live` | `realm.shared`, `locus.client-runtime`, `granularity.region` | module-federation, native-federation, import-map-architectures |
| `family.lifecycle-orchestration` | Mount/unmount lifecycle function contract | `time.deploy-decoupled`, conditionally `time.runtime-live` | `realm.shared`, `locus.client-runtime`, `granularity.region` | single-spa, piral |
| `family.virtualized-rehosting` | Deployed HTML entry plus a simulated-realm sandbox contract | `time.deploy-decoupled`, `time.runtime-live` | `realm.virtualized`, `locus.client-runtime`, `granularity.region` | qiankun, micro-app-jd, wujie, web-fragments (client mode) |
| `family.document-embedding` | Browsing-context boundary; embed URL plus message protocol | `time.deploy-decoupled`, `time.runtime-live` | `realm.separate-document`, `locus.client-runtime`, `granularity.region` | iframe-composition, luigi (iframe mode), hyperfrontend |
| `family.modular-monolith` (baseline) | Enforced source module boundary | `time.build-fused` | single artifact, `locus.consumer-build` | modular-monolith |
| `family.package-composition` (baseline) | Versioned workspace/registry package | `time.build-fused` | single artifact, `locus.consumer-build` | monorepo-package-composition, bit, commercetools-frontend |
| `family.spa-routing` (baseline) | Lazy route chunk inside one SPA | `time.build-fused` | one SPA, `realm.shared`, `locus.consumer-build` | plain-spa-routing |
| `family.server-templates` (baseline) | Server template/partial include | `time.build-fused` | server-rendered MPA | server-rendered-templates |
| `family.islands` (boundary entry) | Independently hydrated region of a single-build page | `time.build-fused` (render may defer to request time) | server-rendered shell, per-island client boot | islands-architecture |

Layers and aliases (not families, section 6): zephyr-cloud, picard-js, toolchain-branded
wrappers; mode-forked units mapped per configuration.

---

## 3. Microfrontend families

### 3.1 `family.route-partition` : URL route partitioning

- **Id**: `family.route-partition`
- **Canonical name**: URL route partitioning
- **Plain-English name**: Several independently deployed applications share one domain;
  each owns a set of URLs, and a router in front decides which application serves each
  navigation.
- **Definition**: Independently deployed frontend applications are mapped onto disjoint
  URL path prefixes of a single origin. A routing tier (reverse proxy, CDN
  configuration, platform router) forwards each top-level navigation to the owning
  application, which serves a complete document. Composition happens *between* pages;
  no page ever contains two participants (`composition.kind.http-route-partition`,
  `runtime.concurrent-participants`=n).
- **Composition boundary**: The URL path prefix. The contract is a routing table plus
  shared-origin conventions (cookie scope, asset prefixes, design tokens by agreement).
- **Integration phase**: `time.deploy-decoupled`. Participants meet only through the
  routing map; no build ever sees another team's code.
- **Execution model**: `realm.serial-documents`, `granularity.page`,
  `locus.request-path` (routing only; the tier forwards, it does not assemble markup).
- **Ownership assumptions**: Each team owns its application, serving stack, and deploy
  schedule end to end (`ownership.deploy-schedule-ownership`). A small central owner
  maintains the routing map (`roster.central-map`); adding a participant is a map
  change, not a host rebuild.
- **Coordination assumptions**: Near-zero day to day. Coordination reduces to origin
  conventions (session/auth cookies, URL namespace treaty, visual consistency by
  shared assets). No shared-dependency governance exists because dependencies never
  co-reside.
- **Isolation characteristics**: Participants never co-reside, so realm, CSS,
  dependency, and namespace interference cannot occur; every co-residence question of
  `dimension.runtime-realm` is vacuous. Within one page trust equals the served
  application (`trust.cooperative` per page); across pages, documents are serially
  separate, and reverse-proxy variants conditionally reach principal separation at page
  granularity (taxonomy 2.2).
- **Deployment characteristics**: A routing tier sits in the request path; participants
  deploy independently behind it; go-live for routing changes is gated on the map owner
  (`deployment.golive-central-pointer` where the map is centralized). Cross-boundary
  prefetch/soft-nav polish is implementation-specific.
- **Migration requirements**: Participant floor `migration.trivial-adaptation`
  (level 1: serving configuration, asset prefix, cookie scope). Host floor: standing up
  or reusing the routing tier (`migration.host.new-infra-tier-required` where none
  exists). The natural strangler on-ramp: `migration.strangler.incremental` (REQ-MIG-02).
- **Major advantages**: Lowest adaptation demand in the landscape; the most common
  real-world microfrontend per sweep 2 (often unnamed); mixed and frozen stacks
  participate unmodified; blast radius per navigation, not per page region.
- **Inherent costs**: Every boundary crossing is a full document load
  (`ux.cross-boundary-soft-nav`=n); shared chrome cannot persist and is duplicated per
  participant (`ux.persistent-shared-chrome`=n); visual/version consistency is by
  convention only; cross-app state travels via cookies, storage, or URLs.
- **Hard limitations**: Cannot place two teams' output on one screen; a product whose
  screens are inherently mixtures is out of scope by construction.
- **Works-well situations**: Team boundaries aligned with rarely-crossed journey seams
  (marketing site vs app, portal home vs checkout); incremental migrations off a
  monolith; estates of heterogeneous or frozen stacks.
- **Works-poorly situations**: Dashboards, consoles, and marketplaces where one screen
  mixes owners; products needing persistent chrome or frequent cross-boundary hops;
  teams expecting SPA-feel transitions across boundaries.
- **Related families**: `family.server-fragment-assembly` (distinguished by composition
  granularity: whole navigation vs region of one page);
  `family.document-embedding` (distinguished by whether participant documents co-reside
  in one page or appear serially); `family.spa-routing` (distinguished by integration
  phase: many deployables vs one build).
- **Representative implementations** (deletable, REQ-KEYTEST-01):
  reverse-proxy-route-composition (nginx/CDN practice), nextjs-multi-zones
  (stack-mandated: `framework.composition-tier-stack-mandated`),
  cloudflare-workers-microfrontends (vendor control plane; edition facts per
  REQ-ENT-01), the "Vercel Microfrontends" brand (alias, section 6).

### 3.2 `family.server-fragment-assembly` : request-path fragment assembly

- **Id**: `family.server-fragment-assembly`
- **Canonical name**: Request-path fragment assembly
- **Plain-English name**: A composer on the request path builds each page by fetching
  HTML pieces from separately deployed fragment services and stitching them together
  before the browser sees the page.
- **Definition**: Participants are services that answer HTTP requests with HTML
  fragments (plus asset references). A composition tier on the request path (an origin
  layout service, a cache tier processing include directives, or a programmable edge
  worker) fans out to fragment services, assembles one document, and streams it to the
  browser. The browser receives an already-composed page.
- **Composition boundary**: The HTTP fragment endpoint (`contracts.http-request-contract`,
  `ssr.html-fragment-contract`): request in (with propagated context,
  `contracts.server-context-propagation`), HTML out.
- **Integration phase**: `time.deploy-decoupled`; each request re-resolves the
  composition, so a fragment deploy is live on the next request.
- **Execution model**: `locus.request-path`, `granularity.region`. Client side, the
  delivered page is one shared document and realm (`realm.shared`). Assembly-tier
  variants inside the family (FC-2): origin layout service, cache/CDN include
  processing, programmable edge worker; the participant contract is identical across
  them, while debugging, caching, and lock-in profiles differ per variant.
- **Ownership assumptions**: Teams own and *operate* fragment services with on-call
  surfaces (`ownership.runtime-operational-ownership`); the composer is centrally
  owned. This family assumes an organization that already runs server estates.
- **Coordination assumptions**: Fragment contract conventions (context propagation,
  asset handling, timeout/fallback behavior); client-side CSS and global discipline,
  since delivered fragments share one document; no shared-dependency machinery
  (`deps.duplicated`).
- **Isolation characteristics**: Strong on the server: fragment services are separate
  processes (`isolation.server.process`); one service crashing degrades its region if
  the composer has fallbacks. Weak in the browser: fragments share realm, CSS space,
  and globals once delivered (`trust.cooperative`). The ESI variant carries a
  composition-injection hazard (`security.composition-injection-surface`).
- **Deployment characteristics**: Composer and fragments are services in the production
  path (`deployment.strategy-service-in-path`); static hosting is insufficient
  (`ssr.static-hosting-sufficient`=n); per-fragment HTTP caching is first-class
  (`performance.default-content-caching`); streaming assembly available
  (`ssr.streaming-assembly`).
- **Migration requirements**: Participant floor `migration.trivial-adaptation` to
  `migration.integration-adapter` (levels 1-2: expose a fragment endpoint around an
  unchanged application). Host floor: a new composition tier
  (`migration.host.new-infra-tier-required`).
- **Major advantages**: Composed first paint and crawlable no-JS content
  (`ux.composed-first-paint`, `ssr.crawler-indexable`); the lowest client-JS budget of
  any region-granular family; per-fragment caching; genuine team independence at the
  service level.
- **Inherent costs**: Request-time server fanout on the critical path
  (`performance.request-time-server-fanout`); an estate of services to operate;
  navigations typically reload the document, so persistent chrome is lost
  (`ux.persistent-shared-chrome`=n on the classic members); client-side interactivity
  coordination is adopter-built.
- **Hard limitations**: No client-side isolation between fragments; a hard mismatch for
  static-hosting organizations; dev/prod parity requires running the composer locally
  (`ssr.dev-prod-parity` burden).
- **Works-well situations**: Content and commerce surfaces, SEO-critical pages,
  organizations with real server operations capacity, multi-team pages with modest
  client interactivity.
- **Works-poorly situations**: Static-hosting shops; heavily interactive app-like
  products wanting client-side soft navigation; organizations without platform/ops
  investment.
- **Related families**: `family.route-partition` (distinguished by granularity: region
  vs whole navigation); `family.islands` (distinguished by whether fragments are
  independently owned and deployed); `family.custom-element-composition` (distinguished
  by assembly locus: request path vs client runtime);
  `family.module-graph-federation` (distinguished by the boundary contract: HTTP/HTML
  endpoint vs JS module import).
- **Representative implementations** (deletable, REQ-KEYTEST-01): podium (origin layout
  service lineage), server-side-fragment-composition (SSI and the Tailor lineage),
  edge-side-composition (ESI and worker-based assembly), opencomponents
  (registry-mediated with immutable versions: `roster.registry-mediated`,
  `actuation.pointer-switch`), web-fragments in pierced-gateway mode (dual-mapped,
  section 6).

### 3.3 `family.custom-element-composition` : custom-element composition

- **Id**: `family.custom-element-composition`
- **Canonical name**: Custom-element composition
- **Plain-English name**: Each piece ships as an HTML tag; the host builds a page by
  placing tags, and the browser does the rest.
- **Definition**: Participants are packaged as web components: custom elements
  (optionally with shadow DOM style scoping) that encapsulate an application or widget.
  The host document composes by placing elements; attributes, properties, and DOM
  events form the contract. The seam is a browser standard, so no strategy-owned
  runtime is required on the page.
- **Composition boundary**: The DOM custom-element interface: tag name, attributes and
  properties in, DOM events out; style scoping at the shadow root.
- **Integration phase**: `time.deploy-decoupled` in its microfrontend form (element
  bundles loaded from team-owned URLs); the same seam is also usable build-fused, which
  is then `family.package-composition` wearing a web-component API.
- **Execution model**: `realm.shared`, `locus.client-runtime`, `granularity.region`,
  `orchestration.primitive` (nothing strategy-owned ships with the page). Declarative
  shadow DOM additionally enables server-rendered fragments of this family.
- **Ownership assumptions**: Teams own element bundles and their serving; the roster is
  host-authored (`roster.host-authored`): wiring is host markup/code unless a platform
  overlay adds a registry (see entando below).
- **Coordination assumptions**: Custom-element *names* are a page-global namespace: one
  definition per name per page (`runtime.global-registration-collision`), so a naming
  treaty is mandatory. Dependency economy is duplication (`deps.duplicated`): each
  element carries its stack; no negotiation machinery exists. The contract is implicit
  (`contract.implicit`) unless teams add their own manifests.
- **Isolation characteristics**: CSS confined both ways at the style level via shadow
  DOM. JavaScript is not isolated at all: one realm, shared globals, shared
  primordials (`runtime.shared-js-realm`, `runtime.primordials-blast-radius`); an
  exception, leaked timer, or patched built-in crosses freely
  (`isolation.failure.post-mount-exception`=n). Trust ceiling `trust.cooperative`.
- **Deployment characteristics**: Static artifacts and CDNs suffice
  (`ssr.static-hosting-sufficient`); mutable-URL actuation is the norm
  (`actuation.mutable-url`); nothing to co-version except the elements themselves
  (`buildtime.host-integrates-buildless`).
- **Migration requirements**: Participant floor `migration.integration-adapter`
  (level 2: wrap the unchanged application in an element definition). Host floor:
  level 1 (place tags, load scripts).
- **Major advantages**: Standards lifetime: the seam outlives every framework and
  vendor; framework-agnostic by construction; natural layout flow, one accessibility
  tree, portal-compatible UX (`ux.natural-layout-flow`, `ux.screenreader-continuity`);
  zero strategy runtime to upgrade.
- **Inherent costs**: Every operational concern is adopter-built: loading and error UI,
  messaging conventions, inventory, correlation
  (`ux.builtin-error-fallback-ui`=n, `operations.cross-journey-correlation-diy`);
  framework copies multiply per co-displayed element
  (`performance.duplicate-framework-same-page`); rich data flows need property/event
  conventions beyond string attributes.
- **Hard limitations**: Never a security or JS-fault boundary; shadow DOM complicates
  global theming, some portal/overlay libraries, and form participation; no built-in
  answer to shared-dependency dedup at scale.
- **Works-well situations**: Design systems as the delivery vehicle; widgets embedded
  into many varied hosts; longevity-first organizations; mixed frameworks with a small
  number of co-displayed units.
- **Works-poorly situations**: Untrusted or third-party code; pages composing many
  units where payload duplication bites; products needing heavy cross-fragment state
  and orchestration without wanting to build it.
- **Related families**: `family.module-graph-federation` (distinguished by the seam:
  DOM tag vs JS module import); `family.virtualized-rehosting` (distinguished by
  whether a framework simulates realm confinement around participants);
  `family.server-fragment-assembly` (distinguished by assembly locus: client vs request
  path); `family.lifecycle-orchestration` (distinguished by lifecycle mediation:
  browser connected/disconnected callbacks vs an orchestrator-driven contract).
- **Representative implementations** (deletable, REQ-KEYTEST-01):
  web-components-composition (the generic practice; authoring tools such as Lit or
  Stencil are libraries, not composition), entando (platform-thick implementation:
  registry-mediated roster, non-developer composition, host inversion; the platform
  overlay is an addition to this family per FC-6, not a family), luigi web-component
  mode (dual-mapped, section 6).

### 3.4 `family.module-graph-federation` : module-graph federation

- **Id**: `family.module-graph-federation`
- **Canonical name**: Module-graph federation
- **Plain-English name**: Independently built and deployed JavaScript bundles import
  each other in the browser and agree at load time on one copy of shared libraries.
- **Definition**: The browser's JS module graph is the composition boundary.
  Independently deployed builds expose modules; consumers import them at runtime; a
  resolution layer (a bundler-emitted container runtime, or an import map over native
  ESM) wires specifiers to deployed URLs and negotiates shared dependencies so common
  libraries load once (`composition.kind.js-module-graph`,
  `runtime.shared-dep-negotiation`).
- **Composition boundary**: The JS module import, plus the shared-dependency share
  scope. The finest-grained boundary in the landscape: a participant can be an
  application, a page, a component, or a single function.
- **Integration phase**: `time.deploy-decoupled`; conditionally `time.runtime-live`
  (late remote registration, map injection).
- **Execution model**: `realm.shared`, `locus.client-runtime`, `granularity.region`,
  `orchestration.library`. Internal spread (FC-3c, not a split): vendored container
  runtime emitted per build vs platform-native import-map resolution; conditional SSR
  paths exist on the runtime end.
- **Ownership assumptions**: Teams own builds and deploy schedules
  (`ownership.deploy-schedule-ownership`); a central map/manifest has an owner
  (`roster.central-map`); shared-dependency stewardship is a standing role, not a
  one-time setup.
- **Coordination assumptions**: The family's defining burden: continuous cross-team
  version governance before and after builds
  (`coordination.shared-dependency-governance`). Conflicts first surface at runtime
  (`runtime.dep-conflict-surfaces-runtime`); under version skew, dedup silently falls
  back to duplicates (`performance.dedup-failure-on-version-skew`). The built-in gate
  covers shared-dependency semver only, never the exposed API shape
  (`contracts.connect-compat-gate`=c conditions; never read as "contract safe",
  REQ-MATRIX-05).
- **Isolation characteristics**: None. One realm, one document: a participant's
  exception, primordial mutation, or leaked interval reaches everyone
  (`isolation.failure.post-mount-exception`=n, `isolation.lifecycle.reclaim`=n).
  Trust ceiling `trust.cooperative`: all participants are one security principal.
- **Deployment characteristics**: Static artifacts and CDNs suffice
  (`ssr.static-hosting-sufficient`, `deployment.participants-static-artifacts`).
  Default actuation is mutable-URL (deploy is release,
  `deployment.cache-busting-operator-burden`); pointer-switch editions exist
  (versioned URLs plus an import map). Deploy decoupling makes contract drift
  structurally possible; this family sits directly on the drift hinge (taxonomy 3.3).
- **Migration requirements**: Participant floor `migration.bundler-change` (level 3):
  the build toolchain must emit federation metadata or ESM with externalized shared
  deps (`framework.esm-artifact-required` on the import-map side). Host floor: shell
  build integration; no new infrastructure tier.
- **Major advantages**: Module-level sharing across independently deployed builds
  (components and functions, not just whole apps); one copy of shared libraries per
  page (`performance.shared-dependency-dedup`); no per-unit document boot; seamless
  single-document UX; the largest tooling ecosystem of any region-granular family.
- **Inherent costs**: Version-skew engineering forever; the resolution machinery is
  co-versioned across all teams (`runtime.shared-runtime-library` on the runtime end);
  teardown is best-effort; a discovery/orchestration fetch precedes first unit render
  (`performance.pre-render-orchestration-fetch`).
- **Hard limitations**: No isolation of any kind; page-wide singletons (router, state,
  framework instance) constrain composition; a toolchain floor exists on the runtime
  end (`framework.version-floor-imposed`); genuinely untrusted code is never viable
  (`security.untrusted-third-party-viable`=n).
- **Works-well situations**: One organization, several trusted high-cadence teams, a
  shared design system, real payload budgets, module-level reuse across applications,
  an org that can run upgrade trains.
- **Works-poorly situations**: Uncoordinated or distrusting organizations; frozen,
  buildless, or third-party participants (the level-3 floor eliminates them, REQ-Q-02);
  compliance-driven isolation requirements.
- **Related families**: `family.lifecycle-orchestration` (distinguished by the seam:
  imported modules vs a mount/unmount contract; frequently combined in practice:
  federation loads, an orchestrator mounts); `family.custom-element-composition`
  (distinguished by the seam: JS import vs DOM tag); `family.package-composition`
  (distinguished by integration phase: load-time resolution vs build-fused resolution
  of the same import graph); `family.virtualized-rehosting` (distinguished by realm
  treatment: raw shared realm vs simulated confinement).
- **Representative implementations** (deletable, REQ-KEYTEST-01): module-federation
  (webpack/Rspack/Vite container runtimes, MF 2.0 runtime), native-federation
  (import-map re-implementation of the same mental model), import-map-architectures
  (native ESM plus import maps; SystemJS in twilight). Brand aliases resolving here:
  Nx microfrontends, Angular microfrontends, Modern.js, Re.Pack (section 6).
  zephyr-cloud attaches here as a delivery layer, never as a member (section 6).

### 3.5 `family.lifecycle-orchestration` : client lifecycle orchestration

- **Id**: `family.lifecycle-orchestration`
- **Canonical name**: Client lifecycle orchestration
- **Plain-English name**: A thin shell in the page decides which applications should be
  active and calls each one's mount and unmount functions as the user moves around.
- **Definition**: Participants implement a lifecycle contract (bootstrap, mount,
  unmount, optionally update/props); a client-side orchestrator registers applications,
  maps them to activity rules (URL patterns, events), loads their bundles, and drives
  transitions. The seam is a set of functions the participant exports, not an import
  graph and not a DOM tag (`composition.kind.lifecycle-contract`).
- **Composition boundary**: The lifecycle function contract plus the registration entry
  (name, loader, activity rule, props).
- **Integration phase**: `time.deploy-decoupled`; conditionally `time.runtime-live`
  (`runtime.late-participant-registration`).
- **Execution model**: `realm.shared`, `locus.client-runtime`, `granularity.region`.
  Orchestration thickness spans `orchestration.library` (loader plus lifecycle) to
  `orchestration.platform` (feed service, SDK, shell product) without changing the
  boundary.
- **Ownership assumptions**: Teams own application bundles and deploy schedules; the
  root shell and its config are centrally owned (`roster.central-map`); at the platform
  end a feed admits participants by publishing (`roster.registry-mediated`).
- **Coordination assumptions**: All participants co-version against the orchestrator
  runtime and its contract (`runtime.shared-runtime-library`): the shell is a page-wide
  upgrade train. Dependency economy is typically layered on
  `family.module-graph-federation` machinery (share scopes or scoped import maps) and
  inherits its governance burden.
- **Isolation characteristics**: None at the realm level (shared realm, shared
  globals). The lifecycle seam adds *quarantine*, not containment: a failing
  application can be unmounted or fenced at mount/unmount time
  (`isolation.failure.lifecycle-quarantine`), but in-realm damage (mutated globals,
  leaked listeners) still reaches everyone. Trust ceiling `trust.cooperative`.
- **Deployment characteristics**: Static hosting suffices; mutable-URL actuation is
  conventional (`actuation.mutable-url`); the platform end adds feed-mediated
  pointer semantics (conditional `actuation.pointer-switch`).
- **Migration requirements**: Participant floor `migration.bootstrap-change`
  (level 4): every participant's entry code is edited to export the lifecycle. Host
  floor: adopting the shell; at the platform end, shell takeover
  (`migration.host.shell-takeover-required`): the strategy owns the document root
  before incremental adoption can start.
- **Major advantages**: Explicit host control at the seam: orchestrated transitions,
  props/context push (`contracts.host-push-updates`), soft navigation with persistent
  chrome (`ux.persistent-shared-chrome`); the longest multi-framework track record of
  the shared-realm families (`framework.multi-framework-demonstrated`); framework
  mixing without realm tricks.
- **Inherent costs**: Every participant is modified at its entry point; the
  orchestrator is a singleton dependency with a page-wide version; teardown discipline
  is delegated to each application and failures there leak; routing authority must be
  negotiated between shell and participants.
- **Hard limitations**: No isolation; the level-4 floor eliminates unmodifiable
  participants outright (REQ-Q-02); double-router conflicts are conventional, not
  mechanical.
- **Works-well situations**: Consolidating several actively maintained in-house SPAs
  under one URL space with seamless navigation; organizations wanting a paved-road
  shell with orchestrated UX.
- **Works-poorly situations**: Legacy, third-party, or frozen applications whose
  bootstrap cannot change; organizations unable to run a shared-runtime upgrade train.
- **Related families**: `family.module-graph-federation` (distinguished by the seam:
  lifecycle functions vs module imports; commonly stacked together);
  `family.virtualized-rehosting` (distinguished by the adaptation demand: it drops the
  bootstrap edit by consuming deployed HTML entries and simulating confinement);
  `family.custom-element-composition` (distinguished by lifecycle mediation: an
  orchestrator contract vs browser element callbacks).
- **Representative implementations** (deletable, REQ-KEYTEST-01): single-spa (library
  end), piral (platform end: feed service, pilet SDK, shell takeover). qiankun extends
  single-spa but belongs to `family.virtualized-rehosting` (its distinguishing feature
  is the sandbox). picard-js appears near this family in clustering but is an interop
  orchestration layer, not a member (FC-9, section 6).

### 3.6 `family.virtualized-rehosting` : virtualized-realm rehosting

- **Id**: `family.virtualized-rehosting`
- **Canonical name**: Virtualized-realm rehosting
- **Plain-English name**: A framework loads whole, already-deployed applications into
  one page and fakes a private window, DOM scope, and stylesheet for each so they do
  not trample each other by accident.
- **Definition**: The composer consumes applications as they are already deployed
  (typically by HTML entry: fetching the app's own index.html and mounting its scripts
  and styles) and interposes simulated confinement: proxied `window` objects and
  patched globals, scoped or rewritten CSS, and in some members hidden same-origin
  iframe realms whose DOM is projected into the visible document
  (`composition.kind.html-entry`, `runtime.patched-globals-layer`,
  `isolation.js.virtualized-global`, `isolation.dom.virtualized`).
- **Composition boundary**: The application's deployed HTML entry (or fragment) plus
  the framework's sandbox contract. Participant bytes are transformed before execution
  (`ownership.participant-bytes-verbatim`=n).
- **Integration phase**: `time.deploy-decoupled` and `time.runtime-live`: apps register,
  hot-swap, and keepalive inside a running document
  (`runtime.loaded-version-hot-swap`, `ux.unit-keepalive`).
- **Execution model**: `realm.virtualized`, `locus.client-runtime`,
  `granularity.region`; heavily mode-forked (`operations.mode-forked-operations`;
  taxonomy 3.5): sandbox on/off, iframe modes, degrade paths each move the unit's
  effective position, so configurations are scored, not brands (REQ-FAM-03).
- **Ownership assumptions**: One organization; the host team operates the composer;
  participant teams often change nothing (floor 1 members) or only their bootstrap
  (the single-spa lineage member, floor 4).
- **Coordination assumptions**: Cooperating teams under one roof. The framework itself
  carries the ongoing burden: sandbox fidelity is maintained against the browser's
  moving surface, and the framework version is pinned page-wide.
- **Isolation characteristics**: Interference damping, not security
  (`trust.interference-damped`): accidental global, DOM, and CSS collisions are
  absorbed; documented escape hatches remain
  (`security.isolation-escape-hatches`); teardown reclaims patched paths only. A
  virtualized realm must never be sold as a security boundary (REQ-MATRIX-05;
  taxonomy 2.2).
- **Deployment characteristics**: Static hosting suffices; mutable-URL actuation;
  rehosted apps keep their own deploy pipelines untouched.
- **Migration requirements**: Participant floor `migration.trivial-adaptation`
  (level 1) for the HTML-entry members, `migration.bootstrap-change` (level 4) for the
  lifecycle-lineage member; host floor: adopt the composer runtime
  (`migration.host.min-level` low; no new infrastructure tier).
- **Major advantages**: The lowest-friction path to composing an existing estate in one
  page: unmodified deployed apps gain shared-document UX (natural layout, one
  accessibility tree) plus damped interference; keepalive and hot-swap come built in;
  legacy no-build apps can participate
  (`migration.participant.legacy-no-build-viable`).
- **Inherent costs**: A sandbox execution tax on every patched path
  (`performance.sandbox-execution-tax`); debugging through virtualized globals;
  framework duplication per rehosted app (`deps.duplicated`,
  `performance.duplicate-framework-same-page`); permanent browser-compat maintenance
  risk concentrated in the framework.
- **Hard limitations**: Never a boundary against malice; sandbox fidelity gaps are
  inherent and documented per member; guarantees change per mode fork, so an
  architecture decision must name the configuration; stewardship concentration is a
  real selection factor but a lens fact, not an architectural one (taxonomy 4.3).
- **Works-well situations**: Multi-team legacy rehosting inside one organization;
  gradual consolidation of deployed SPAs that nobody may modify; portals mixing old
  and new stacks with shared-document UX expectations.
- **Works-poorly situations**: Any adversarial or third-party trust requirement;
  performance-critical pages sensitive to the sandbox tax; teams that need exact
  browser semantics inside participants.
- **Related families**: `family.document-embedding` (distinguished by who enforces the
  boundary: framework simulation vs the browser); `family.lifecycle-orchestration`
  (distinguished by the adaptation demand: consumed deployed HTML entries vs edited
  bootstraps); `family.server-fragment-assembly` (distinguished by assembly locus; one
  dual-mode member spans both).
- **Representative implementations** (deletable, REQ-KEYTEST-01): qiankun (proxy-window
  sandbox over single-spa; v2 adoptable vs v3 RC is an implementation-lens fact),
  micro-app-jd (proxy fake window; optional iframe mode), wujie (hidden same-origin
  iframe realm with shadow-DOM projection), web-fragments in client reframing mode
  (dual-mapped, section 6).

### 3.7 `family.document-embedding` : separate-document embedding

- **Id**: `family.document-embedding`
- **Canonical name**: Separate-document embedding
- **Plain-English name**: Each piece is its own web page, shown inside the host page in
  a frame; the pieces talk by sending messages.
- **Definition**: Participants are complete, independently served documents co-resident
  in the host viewport through nested browsing contexts (iframes). The browser, not a
  framework, enforces the boundary. Coordination crosses the boundary as serialized
  messages (postMessage or typed protocols built on it)
  (`isolation.document-boundary`, `contracts.frame-messaging`,
  `contracts.serialized-boundary`).
- **Composition boundary**: The browsing-context boundary; the contract is an embed URL
  plus a message protocol (from bare convention to versioned, gated handshakes).
- **Integration phase**: `time.deploy-decoupled` and `time.runtime-live` (participants
  and versions swap inside a running document).
- **Execution model**: `realm.separate-document`, `locus.client-runtime`,
  `granularity.region`. Orchestration thickness spans primitive frames to
  platform-thick shells without changing the boundary (FC-5).
- **Ownership assumptions**: Participant teams are fully autonomous including serving
  and deploy cadence; roster is host-authored (`roster.host-authored`) or platform
  configuration. The only family whose ownership model extends to *other
  organizations* (`ownership.external-participant`).
- **Coordination assumptions**: The mandatory coordination surface is exactly one
  thing: the message protocol and its version. No shared-dependency governance exists
  (`deps.duplicated`). Contract explicitness spans `contract.implicit` (bare URL plus
  ad hoc messages) to `contract.gated` (descriptor, version stamp, connect-time
  compatibility gate, explicit drift error) at the platform end.
- **Isolation characteristics**: The strongest in the landscape and the only
  browser-enforced kind: CSS confined both ways, exception and crash containment, full
  memory reclaim on teardown, fresh-context recovery in the page
  (`isolation.css.outbound`/`.inbound`, `isolation.failure.post-mount-exception`,
  `isolation.lifecycle.reclaim`, `isolation.recovery.in-page`). Trust:
  `trust.distinct-principal` is *reachable, not automatic*: it requires cross-origin
  serving plus sandbox/CSP, conditionally process isolation; a same-origin
  unsandboxed frame holds host-origin authority and is containment against accidents,
  never a security boundary (taxonomy 3.1; REQ-MATRIX-05).
- **Deployment characteristics**: Static hosting suffices; each participant deploys
  independently behind its URL; mutable-URL actuation typical; per-participant CSP and
  storage partitioning become available at the cross-origin posture
  (`security.per-participant-csp`, `isolation.storage.partition`).
- **Migration requirements**: Participant floor `migration.trivial-adaptation`
  (level 1: frame-ancestors/CORS headers) for embed-only participation; SDK-handshake
  postures raise the participant to `migration.bootstrap-change` (level 4). Host
  floor: low (place and manage frames) rising with platform adoption.
- **Major advantages**: The only family where genuinely external or distrusted
  participants are viable (the landscape-wide
  `security.untrusted-third-party-viable`=n eliminator flips conditionally here,
  taxonomy 2.2); browser-guaranteed failure containment and recovery; zero
  co-residence coupling of any kind; the primitive's lifetime is the browser's.
- **Inherent costs**: Per-unit document boot and process memory overhead
  (`performance.per-unit-document-boot`, `performance.process-memory-overhead`);
  serialized messaging with per-message cost
  (`performance.per-message-serialization-cost`); the UX seam: overlays clip at the
  frame edge unless a host-overlay protocol exists, focus and screen-reader
  continuity break at boundaries, frame history pollutes navigation
  (`ux.overlay-viewport-escape`, `ux.host-overlay-protocol`,
  `ux.cross-boundary-focus-mgmt`, `ux.screenreader-continuity`,
  `ux.frame-history-pollution`).
- **Hard limitations**: Natural layout flow is lost (`ux.natural-layout-flow`=n): the
  host must measure and manage geometry; body portals and global overlays require
  explicit protocol engineering; seamlessness is an engineering program, never a
  default; a11y continuity across frames is the pole's standing guard (taxonomy 4.1).
- **Works-well situations**: Third-party and vendor widgets, plugin marketplaces,
  acquisitions and white-label composition, compliance-driven isolation, mixed-trust
  dashboards ([topology.md](topology.md) external-participant topologies).
- **Works-poorly situations**: Seamless consumer UX with dense cross-boundary
  interaction; overlay-heavy design systems without protocol investment;
  memory-constrained pages composing many units.
- **Related families**: `family.virtualized-rehosting` (distinguished by boundary
  enforcement: browser vs framework simulation); `family.route-partition`
  (distinguished by co-residence: documents in one page vs one document per
  navigation); `family.custom-element-composition` (distinguished by boundary depth:
  full browsing context vs style-only scoping).
- **Representative implementations** (deletable, REQ-KEYTEST-01): iframe-composition
  (the primitive practice, `orchestration.primitive`), luigi in iframe mode
  (platform-thick; mode-forked, section 6), hyperfrontend (platform-thick; the
  landscape's only fully gated boundary contract: descriptor, version, connect gate,
  explicit drift error, taxonomy 2.10).

---

## 4. Reading a family section

Field semantics, once: "Composition boundary" is the participant-facing contract;
"Integration phase" cites `dimension.integration-time` poles; "Execution model" cites
`dimension.runtime-realm`, `dimension.composition-granularity`, and
`dimension.assembly-locus` poles; "Isolation characteristics" pairs
`dimension.runtime-realm` with the `dimension.trust-ceiling` honesty rule; "Migration
requirements" uses [migration.md](migration.md) level ids for the participant and host
floors (`dimension.adaptation-floor`). UX and performance statements are downstream
consequences (taxonomy 3.2), cited as attribute ids, never promoted into definitions.

---

## 5. Honest alternatives: the non-MFE baseline group

These four entries (plus one boundary entry) are not microfrontend strategies; they are
the architectures the framework must be able to recommend *instead* (REQ-Q-04,
REQ-MISSION-01). They form one family-like group because they share the positions that
dissolve the entire microfrontend question load: `time.build-fused`,
`locus.consumer-build`, `deps.single-copy-by-build`, drift structurally impossible
(`contracts.drift-surface`=n), whole-graph types and deploy-time verification
(`operations.deploy-time-contract-verification`), and no per-team deploy schedule
(`deployment.host-rebuild-required`=y). The 2026 practitioner consensus treats the first
entry as the default until an organizational problem is proven
([../research/solutions/non-mfe-baselines.md](../research/solutions/non-mfe-baselines.md)).

### 5.1 `family.modular-monolith` : modular monolith

- **Id**: `family.modular-monolith`
- **Canonical name**: Modular monolith
- **Plain-English name**: One application, one deploy, with firm internal walls between
  team-owned modules.
- **Definition**: A single deployable whose internal module boundaries are explicit and
  mechanically enforced (module-boundary lint, dependency rules, fitness functions).
  Ownership is expressed in the codebase, not in the runtime.
- **Composition boundary**: The enforced source module boundary.
- **Integration phase**: `time.build-fused`.
- **Execution model**: Whatever the application is (server-rendered or SPA); one
  artifact, `locus.consumer-build`.
- **Ownership assumptions**: Teams own code areas (`ownership.code-boundary-ownership`),
  never deploy schedules; one release train (`ownership.single-team-endorsed`
  correlates with this pole, taxonomy 2.3).
- **Coordination assumptions**: One version of everything; refactors are atomic across
  the whole graph; coordination cost is the train itself.
- **Isolation characteristics**: Compile-time only; none at runtime. Trust is not a
  concept: it is one program.
- **Deployment characteristics**: One pipeline, atomic releases, whole-app rollback;
  every change rides the same train (`deployment.host-rebuild-required`=y).
- **Migration requirements**: For an existing *separate* application to join:
  `migration.major-refactor` (level 6, feature extraction into the codebase). Within
  the codebase: refactoring, not migration.
- **Major advantages**: Lowest operational cost in the landscape; whole-graph type
  safety; drift impossible; atomic cross-cutting changes; no composition machinery to
  learn, version, or debug.
- **Inherent costs**: Deploy coupling grows with team count and cadence independence;
  boundary discipline requires continuous enforcement or it erodes.
- **Hard limitations**: No independent deployment, by definition; the moment a team
  genuinely needs its own release cadence, this family cannot provide it.
- **Works-well situations**: A single team or few coordinated teams; products where
  atomicity beats autonomy; the proven default starting point.
- **Works-poorly situations**: Many teams with hard cadence independence; organizations
  whose structure cannot share one train (the actual organizational problem
  microfrontends exist to solve).
- **Related families**: `family.package-composition` (distinguished by whether
  boundaries are reified as versioned packages); `family.spa-routing` (distinguished
  by where the walls are: module rules vs route chunks).
- **Representative implementations** (deletable, REQ-KEYTEST-01): module-boundary
  tooling in Nx/turborepo-style workspaces; architectural fitness-function suites.

### 5.2 `family.package-composition` : package-boundary composition

- **Id**: `family.package-composition`
- **Canonical name**: Package-boundary composition
- **Plain-English name**: Teams own packages; one integrated build assembles the
  packages into a single deployable.
- **Definition**: Team ownership is reified as versioned workspace or registry
  packages; a consuming build resolves them into one artifact. Teams own the release
  of a package while deployment stays fused
  (`buildtime.host-build-consumes-participants`).
- **Composition boundary**: The versioned package interface (exports, semver).
- **Integration phase**: `time.build-fused`; package publishing gives review/release
  cadence per team, never deploy cadence.
- **Execution model**: One artifact, `locus.consumer-build`,
  `deps.single-copy-by-build`.
- **Ownership assumptions**: Teams own packages and their versioning; a consuming app
  team (or platform) owns the integrated build and the deploy.
- **Coordination assumptions**: Version bumps propagate through the consumer's
  dependency update flow; shared-dependency changes rebuild the world
  (`buildtime.shared-dep-change-rebuilds-center`); types flow whole-graph
  (`contracts.types-shared`).
- **Isolation characteristics**: None at runtime; package boundaries are build-time
  constructs.
- **Deployment characteristics**: One deployable per consumer; registry-realized
  variants add immutable versions and pointer semantics at the *package* level
  (`actuation.pointer-switch` inherited from the package manager).
- **Migration requirements**: For an existing separate application:
  `migration.major-refactor` (level 6, extraction into packages). Registry adoption
  bridges can be `migration.trivial-adaptation` (level 1) for code that is already
  componentized.
- **Major advantages**: Most of the ownership story with none of the runtime
  composition cost; per-team review and release rhythm; full type safety and testing
  across the graph; commodity tooling.
- **Inherent costs**: The consumer's build and deploy remain the bottleneck; a package
  release means nothing until every consumer upgrades and redeploys; version-bump
  fatigue at scale.
- **Hard limitations**: No independent deployment; no runtime autonomy of any kind;
  registry outages sit in the build path for registry-realized variants.
- **Works-well situations**: Multiple teams on one product accepting one train;
  design-system and shared-library delivery; organizations wanting ownership clarity
  before (or instead of) runtime independence.
- **Works-poorly situations**: Hard independent-deploy requirements; participants that
  must ship without a coordinating consumer build.
- **Related families**: `family.module-graph-federation` (distinguished by integration
  phase: build-fused vs load-time resolution of the same import graph);
  `family.modular-monolith` (distinguished by boundary reification: packages vs source
  rules).
- **Representative implementations** (deletable, REQ-KEYTEST-01):
  monorepo-package-composition (workspace practice), bit (registry-realized,
  component-level, with a cloud edition; `roster.registry-mediated` at the package
  level), commercetools-frontend (vendor-platform realization: platform-owned host
  build and delivery, host inversion, participant floor level 7; the platform surface
  is an overlay per FC-6, edition facts per REQ-ENT-01).

### 5.3 `family.spa-routing` : route-chunked single application

- **Id**: `family.spa-routing`
- **Canonical name**: Route-chunked single application
- **Plain-English name**: One single-page app whose routes are lazy-loaded chunks.
- **Definition**: A single SPA with client routing and route-level code splitting; each
  area loads on demand from one build (`composition.kind` none: this is the null
  composition case with performance ergonomics).
- **Composition boundary**: The lazy route chunk (an internal build artifact, not a
  contract).
- **Integration phase**: `time.build-fused`.
- **Execution model**: One document, one realm (`realm.shared`), one build,
  `locus.consumer-build`.
- **Ownership assumptions**: One team, or code-area ownership inside one app.
- **Coordination assumptions**: One lockfile, one router, one release.
- **Isolation characteristics**: None; chunks are lazy, not bounded.
- **Deployment characteristics**: Static hosting; atomic deploys; instant whole-app
  rollback via the hosting layer.
- **Migration requirements**: Joining means merging codebases:
  `migration.major-refactor` (level 6) or above for an existing separate app.
- **Major advantages**: Satisfies most "we want independent pieces" asks with zero
  architecture: on-demand loading, area ownership, soft navigation, persistent chrome,
  all free.
- **Inherent costs**: All coupling costs of one SPA: one framework version, one
  router, one release train.
- **Hard limitations**: Nothing deploys independently; scale limit is organizational,
  not technical.
- **Works-well situations**: Single-team products; the honest answer to
  performance-motivated "microfrontend" asks.
- **Works-poorly situations**: Genuine multi-team cadence independence.
- **Related families**: `family.route-partition` (distinguished by integration phase:
  one build vs independently deployed apps per URL area);
  `family.modular-monolith` (distinguished by rendering model: SPA vs any).
- **Representative implementations** (deletable, REQ-KEYTEST-01): plain-spa-routing
  (router-level lazy loading in any mainstream SPA stack).

### 5.4 `family.server-templates` : server-rendered template monolith

- **Id**: `family.server-templates`
- **Canonical name**: Server-rendered template monolith
- **Plain-English name**: A classic server-rendered application assembling pages from
  templates and partials.
- **Definition**: One server application renders complete documents from templates;
  reusable partials/includes compose the page inside one codebase and one deploy.
- **Composition boundary**: The template/partial include (internal, not a contract).
- **Integration phase**: `time.build-fused` (template and code ship together).
- **Execution model**: Server-rendered MPA; each navigation is a fresh document from
  one application.
- **Ownership assumptions**: One application team or code-area ownership.
- **Coordination assumptions**: One codebase, one framework, one release.
- **Isolation characteristics**: None between page areas; between *pages*, the MPA
  reload gives natural teardown.
- **Deployment characteristics**: One server deployable (plus assets); atomic releases.
- **Migration requirements**: Joining means extraction into the codebase:
  `migration.major-refactor` (level 6) or `migration.framework-migration` (level 7)
  for foreign stacks.
- **Major advantages**: Still the majority of the web; composed first paint, SEO, and
  low JS budgets by default; boring, proven operations.
- **Inherent costs**: One train; rich client interactivity needs progressive
  enhancement or embedded islands.
- **Hard limitations**: No independent deployment; no client-side application
  continuity across navigations.
- **Works-well situations**: Content sites, form-driven products, small teams.
- **Works-poorly situations**: Multi-team cadence independence; app-like UX
  requirements.
- **Related families**: `family.server-fragment-assembly` (distinguished by fragment
  ownership: same codebase partials vs independently deployed services);
  `family.islands` (distinguished by client hydration of regions).
- **Representative implementations** (deletable, REQ-KEYTEST-01):
  server-rendered-templates (Rails/Django/Laravel-style practice, single Next-style
  apps used monolithically).

### 5.5 `family.islands` : islands architecture (boundary entry)

- **Id**: `family.islands`
- **Canonical name**: Islands architecture
- **Plain-English name**: A mostly static server-rendered page where a few interactive
  regions each boot their own bit of JavaScript.
- **Definition**: A single build renders a mostly static document; designated islands
  hydrate independently on the client (optionally deferred or server-rendered per
  island at request time). Independent *hydration*, not independent *deployment*.
- **Composition boundary**: The island: an independently hydrated region of a
  single-build page.
- **Integration phase**: `time.build-fused` (one build, one deploy); island rendering
  may defer to request time without changing ownership.
- **Execution model**: Server-rendered shell plus per-island client boot; one realm.
- **Ownership assumptions**: One team, one build, one deploy. This is the honesty
  clause (sweep 2): islands are not microfrontends; nothing is independently owned or
  shipped.
- **Coordination assumptions**: None beyond one codebase.
- **Isolation characteristics**: Islands fail independently at hydration, share
  everything else.
- **Deployment characteristics**: Static or hybrid hosting; one pipeline.
- **Migration requirements**: Joining means adopting the island framework and build:
  level 6 extraction for existing apps.
- **Major advantages**: Solves the adjacent problem most teams actually have
  (independently hydrated components on one fast page) with none of the MFE costs.
- **Inherent costs**: One train; island frameworks impose their stack.
- **Hard limitations**: Not an MFE strategy while fragments come from one build; it
  becomes one only when islands are served by separately owned and deployed services,
  which is `family.server-fragment-assembly` wearing islands ergonomics.
- **Works-well situations**: Content-heavy sites with sparse interactivity; the
  standard redirect for "we think we need microfrontends" performance asks.
- **Works-poorly situations**: Actual multi-team independent-deployment requirements.
- **Related families**: `family.server-fragment-assembly` (distinguished by fragment
  ownership: single build vs independently deployed services);
  `family.server-templates` (distinguished by per-region client hydration).
- **Representative implementations** (deletable, REQ-KEYTEST-01): islands-architecture
  (Astro client/server islands, Fresh, is-land lineage).

---

## 6. Layers, aliases, and multi-family units (REQ-FAM-03)

Not everything in the matrix is a family or a family member. Forcing these units into
one bucket would misstate the landscape; each carries an explicit placement note.

### 6.1 Layers: orchestration around a boundary someone else owns

- **zephyr-cloud** (ops/delivery layer, from cluster c7, FC-8): a deploy, versioning,
  and resolution control plane over an inherited composition boundary
  (`composition.kind.inherits-underlying`), chiefly
  `family.module-graph-federation`. Its distinctive positions are entirely on
  `dimension.roster-authority`, `dimension.release-actuation`
  (`actuation.pointer-switch`), and `dimension.delivery-governance`
  (`delivery.vendor-control-plane`). Placement: `family.module-graph-federation` plus
  a delivery-governance overlay; the vendor surface selects implementations and
  editions, never families (REQ-ENT-01;
  [enterprise-layer.md](enterprise-layer.md)).
- **picard-js** (interop orchestration layer, FC-9): a single client/server library
  that loads and mounts artifacts in *other families' formats* (federation
  containers, import-map manifests, SystemJS bundles, plain ESM) under one lifecycle,
  via custom-element mounting regions. It owns no boundary of its own; its value is
  running a mixed estate during format convergence. Placement: a layer spanning
  `family.module-graph-federation` and `family.lifecycle-orchestration`; its dormancy
  and inherited-lifetime risk (`ownership.upstream-contract-lifetime`) are
  implementation-lens facts (taxonomy 4.3).

### 6.2 Aliases: toolchain and platform brands users arrive with

Users name brands, not mechanisms; the framework resolves the brand to a family before
any comparison
([../research/solutions/toolchain-branded-wrappers.md](../research/solutions/toolchain-branded-wrappers.md)).

| Brand as users say it | Resolves to | What the wrapper adds (never the boundary) |
|---|---|---|
| "Nx microfrontends" | `family.module-graph-federation` | Generators, dev-server orchestration, caching, deploy recipes |
| "Angular microfrontends" | `family.module-graph-federation` | Import-map edition (native-federation) or legacy webpack runtime; ask which |
| "Next.js microfrontends" / "Vercel microfrontends" | `family.route-partition` | Edge routing config, observability, local dev proxy; the federated Next.js adapter is EOL and must be rerouted |
| "Vite/Rspack/Modern.js/Re.Pack module federation" | `family.module-graph-federation` | Bundler integration only |
| "Zephyr" | `family.module-graph-federation` + delivery overlay | See 6.1 |

### 6.3 Multi-family and mode-forked units

Mode forks move a unit's position on the dimensions (taxonomy 3.5); the decision engine
scores configurations, never brands.

- **luigi**: iframe mode is `family.document-embedding`; web-component mode is
  `family.custom-element-composition`. One product, two families, different isolation
  guarantees per mode.
- **web-fragments**: pierced-gateway mode is `family.server-fragment-assembly`; client
  reframing mode is `family.virtualized-rehosting`. Dual-locus by design.
- **opencomponents**: server mode is `family.server-fragment-assembly`; client mode
  moves rendering into the browser while keeping the registry contract; one family,
  two operational profiles.
- **micro-app-jd**: default proxy sandbox is `family.virtualized-rehosting`; its
  optional iframe mode borrows `family.document-embedding` mechanics without that
  family's cross-origin trust conditions; the trust ceiling stays
  `trust.interference-damped`.
- **qiankun**: sandbox mode choices (and the v2 vs v3 line) vary confinement strength
  within `family.virtualized-rehosting`; the version-line question is an
  implementation-lens fact.
- **iframe-composition and hyperfrontend**: same-origin vs cross-origin posture moves
  the unit between containment-only and `trust.distinct-principal` *within*
  `family.document-embedding`; the posture, not the product, determines the trust
  claim (taxonomy 3.1).
- **bit and commercetools-frontend**: registry and platform surfaces over
  `family.package-composition` (FC-6, FC-7); host inversion and vendor delivery are
  overlays.
- **entando**: platform surface (registry roster, non-developer composition, host
  inversion) over `family.custom-element-composition` (FC-6).

### 6.4 What is deliberately not here

Editions, pricing tiers, hosting operators, and maintenance/stewardship facts select
implementations, never families (REQ-ENT-01, taxonomy 4.3;
[enterprise-layer.md](enterprise-layer.md)). Landscape-wide absences surfaced while
clustering (artifact integrity verification, RSC federation) are gap records
(REQ-GAP-02), not family properties.

---

## 7. Coverage check

All 30 matrix units are placed exactly once as members or mapped honestly:

- Families: 27 unit placements across 3.1-3.7 and 5.1-5.5 (web-fragments, luigi,
  opencomponents counted at their primary mode, dual modes recorded in 6.3).
- Layers: zephyr-cloud, picard-js (6.1).
- Every family cites its binding dimension poles; every claim traces to attribute ids
  in [../matrix/attributes.md](../matrix/attributes.md) and cells in
  [../matrix/matrix-compact.tsv](../matrix/matrix-compact.tsv) (REQ-FRAME-02,
  REQ-ORCH-08).
- Removal test (REQ-KEYTEST-01): every representative-implementations list is the last
  field of its section and can be deleted wholesale; sections 1-5 mention no brand
  outside those lists except in the explicitly deletable alias and mode tables of
  section 6.

Next stage: implementations mapping (deliverable 14, model/implementations.md) assigns
every unit and edition to these family ids with configuration-level positions.

---

## 8. Branded-evidence re-verification (2026-08-29)

Standing of this section: it is a maintenance record, not part of any family definition.
Every product it names outside the deletable representative lists is a system from
*outside* the landscape, cited only as corroboration that a category exists independently
of the matrix units. Delete section 8 wholesale and sections 1 to 7 are unchanged; that is
the point of running the check as an appendix (REQ-KEYTEST-01).

### 8.1 The duty and the method

[implementations.md](implementations.md) 4.2 and 4.4 recorded a re-verification duty, and
the completeness audit carried it as
known gap 2: `family.lifecycle-orchestration` and `family.virtualized-rehosting` stay
concept-coherent under the removal test, but every matrix column evidencing them is a
branded implementation (single-spa, piral for the first; qiankun, micro-app-jd, wujie,
web-fragments for the second, with picard-js adjacent as a layer). The risk under test:
that each family is an artifact of those products rather than a real architectural
category.

Three questions were asked per family, in order. A "no" to any of them would have forced a
merge or a demotion regardless of how tidy the taxonomy looked afterwards.

1. **Independent occurrence.** Does the composition technique appear in systems that do
   not use, descend from, or imitate the named products (in-house platforms, documented
   patterns, standards work, historical systems)?
2. **Brand-free implementability.** Can the boundary be stated and built from primitives
   alone, with no named product in the recipe?
3. **Separability of the distinguishing property.** Is the property that separates the
   family from its nearest neighbor instantiated *on its own* somewhere, rather than only
   ever bundled with the neighbor's property? A property that never occurs alone is a
   variant marker, not a boundary.

### 8.2 `family.lifecycle-orchestration`: KEEP AS FAMILY

**Verdict: keep, unchanged.** All three questions pass, and the third passes in both
directions against the merge candidate (`family.module-graph-federation`).

Non-branded and non-landscape evidence found:

- **Independently invented in-house orchestrators.** DAZN's client-side "bootstrap"
  orchestrator is a documented in-house platform that uses no microfrontend framework at
  all: each participant exposes lifecycle methods, bootstrap calls them, cleans memory
  before loading the next participant, and splits routing into a global tier (bootstrap)
  and a local tier (inside the participant). The stated design goal is exactly this
  family's boundary: participants "only output standard HTML, JavaScript and CSS files"
  and meet the shell through the lifecycle contract
  ([lucamezzalira.com/2019/04/12/orchestrating-micro-frontends](https://lucamezzalira.com/2019/04/12/orchestrating-micro-frontends/)).
- **Runtime plugin platforms that are not microfrontend products.** Grafana loads
  independently released plugin bundles at runtime (SystemJS fetch of a per-plugin
  `module.js`, an import map registering shared host packages, host-driven instantiation,
  per-plugin declared host version compatibility). That is this family's execution model,
  coordination burden, and drift hinge reproduced by a product that never set out to build
  a microfrontend framework
  ([grafana.com/developers/plugin-tools/key-concepts/plugin-lifecycle](https://grafana.com/developers/plugin-tools/key-concepts/plugin-lifecycle)).
  Kibana's platform is the same contract shape stated in the abstract (`setup`, `start`,
  `stop` per plugin, identical in browser and server, with the host passing a
  lifecycle-specific "contract" object into each phase), though its participants ship
  inside one downloadable artifact, so it evidences the *contract*, not deploy decoupling
  ([elastic.co/docs/extend/kibana/kibana-platform-plugin-api](https://www.elastic.co/docs/extend/kibana/kibana-platform-plugin-api)).
- **Standards and historical precedent for the boundary type.** The portlet specification
  (JSR-168, extended by JSR-286) standardized precisely this seam two decades ago: a
  participant implements `init`, `render`, `processAction`, `processEvent` and `destroy`,
  a container drives them, and compliant participants run on any compliant container. It
  was created to solve the stated problem of "displaying multiple applications on the same
  page"
  ([theserverside.com JSR-286 tutorial](https://www.theserverside.com/tutorial/JSR-286-development-tutorial-An-introduction-to-portlet-programming)).
  The lifecycle-contract boundary is therefore older than the client-side landscape and
  was standardized without any of the matrix units existing.
- **Vendor-neutral machinery for the roster half.** The frontend discovery pattern
  (awslabs, community-designed, explicitly "unopinionated regarding micro-frontend
  approaches") specifies the manifest a shell fetches to learn name, URL, version and
  fallback per participant before loading it, which is this family's
  `roster.central-map` / `roster.registry-mediated` machinery specified brand-free
  ([github.com/awslabs/frontend-discovery](https://github.com/awslabs/frontend-discovery)).
  AWS Prescriptive Guidance describes the same client-side composition tier generically:
  "a team to own and maintain a shell application ... to enable discovery, loading, and
  rendering micro-frontend components at runtime in the browser"
  ([docs.aws.amazon.com prescriptive guidance, composition approaches](https://docs.aws.amazon.com/prescriptive-guidance/latest/micro-frontends-aws/composition-approaches.html)).

Separability against the merge candidate (question 3), which is the decisive test:

- **Lifecycle without a module graph exists.** DAZN's orchestrator fetches and parses each
  participant's HTML and drives lifecycle methods with no module resolution layer; the
  same is true of any UMD or `window`-assignment participant, and of the portlet lineage.
  In the matrix itself, `composition.kind.lifecycle-contract` = y with
  `composition.kind.js-module-graph` = n is an occupied combination (qiankun).
- **A module graph without a lifecycle exists and is the default.** Module federation
  exposes arbitrary modules and prescribes no lifecycle interface
  (`composition.kind.lifecycle-contract` = n).
- The two therefore stack rather than nest, which is what section 3.4 and 3.5 already say
  ("federation loads, an orchestrator mounts"). Two properties that occur separately and
  compose are two boundaries.
- The participant-facing consequence is different and measurable, which is the REQ-FAM-04
  split criterion: the lifecycle seam sets the participant floor at
  `migration.bootstrap-change` (level 4, entry code edited) where module-graph federation
  sets it at `migration.bundler-change` (level 3, toolchain emits metadata). A merge would
  have to claim one floor for both, which no member supports.

What would have changed this verdict: if the lifecycle seam had appeared only ever as a
convention layered on federation or import maps (never alone), it would have been demoted
to a variant of `family.module-graph-federation`. The DAZN, portlet and qiankun cases
refute that, from three unrelated directions.

Not a demotion to a layer either: layers in section 6 own no participant-facing contract
(zephyr inherits an underlying boundary, picard adapts other families' formats). The
lifecycle seam changes what the participant must export, so it is a boundary by the
section 1 test.

### 8.3 `family.virtualized-rehosting`: KEEP AS FAMILY

**Verdict: keep, unchanged**, with one recommended precision to the definition recorded in
8.4 (additive, not a status change).

The distinguishing property under test is simulated realm confinement: proxied or
distorted globals, scoped or rewritten CSS, and in some members a hidden realm whose DOM
is projected into the visible document. Evidence that this is a general architectural
technique rather than a habit of four products:

- **Standards work.** The TC39 ShadowRealm proposal (stage 2.7) standardizes exactly this
  category: same-thread execution against a fresh global and fresh built-ins, described in
  the proposal's own words as "a proper mechanism for virtualization", explicitly
  contrasted with workers and cross-origin iframes. Just as importantly for this
  framework, the proposal states the same honesty rule section 3.6 states: it provides
  integrity protection against inadvertent interference, not availability or
  confidentiality protection, and is "not a full spectrum mechanism against security
  issues". The landscape's `trust.interference-damped` ceiling is therefore not a
  concession invented to excuse these four products; it is the standards body's own
  characterization of the mechanism
  ([tc39/proposal-shadowrealm](https://github.com/tc39/proposal-shadowrealm)).
- **Production platforms outside the landscape, at large scale.** Salesforce shipped
  wrapper-based virtualization in 2016 (Lightning Locker: `SecureWindow`, secure wrappers
  over `window`, `document` and elements, a secure virtual DOM, per-namespace worlds
  letting different components bundle different library versions) and replaced it in 2022
  with Lightning Web Security, described as "a virtualization engine" giving each
  namespace "a virtual browser environment in a sandbox", enforcing safety through
  *distortions* (mutated standard APIs) rather than wrappers. Both carry the same cost
  profile the family records as inherent: a per-access proxy tax
  (`performance.sandbox-execution-tax`) and third-party libraries that break when they
  touch globals, with a documented iframe escape hatch for code that cannot comply
  ([developer.salesforce.com LWS performance](https://developer.salesforce.com/docs/platform/lightning-components-security/guide/lws-performance.html)).
  Figma runs third-party plugin code in-page in a virtualized realm on the main thread,
  first with the Realms shim and frozen primordials, then swapping to a QuickJS VM
  compiled to WebAssembly after sandbox-escape vulnerabilities showed that "the Realms
  shim uses the same JavaScript VM for all code both inside and outside the sandbox". That
  is the family's `security.isolation-escape-hatches` hazard demonstrated on a system with
  no connection to the matrix units
  ([figma.com/blog/an-update-on-plugin-security](https://www.figma.com/blog/an-update-on-plugin-security/)).
- **Realm plus DOM projection is an independent invention.** Shopify's Remote DOM (and
  remote-ui before it) renders a participant's element tree inside a sandbox (hidden
  iframe or web worker) and mirrors it into the host page as real host elements, which is
  structurally the hidden-realm-plus-projection member of this family arrived at from the
  extensibility direction rather than the rehosting direction
  ([shopify.engineering/remote-rendering-ui-extensibility](https://shopify.engineering/remote-rendering-ui-extensibility),
  [github.com/Shopify/remote-dom](https://github.com/Shopify/remote-dom)). AMP's
  WorkerDOM does the same with a worker realm and a virtual DOM replayed onto the real
  one, with third-party embedding as a stated use case
  ([github.com/ampproject/worker-dom](https://github.com/ampproject/worker-dom)).
- **Historical lineage.** Google Caja (2008 to 2016, used by iGoogle, Orkut and Apache
  Shindig for OpenSocial gadgets) rewrote untrusted third-party HTML, CSS and JavaScript
  to run against a tamed container object with a virtualized DOM in the host page, and
  later added Secure EcmaScript with tamper-proofed primordials. Same boundary, same
  trade (rich in-page interactivity in exchange for a simulated environment and
  transformed participant bytes), two decades of it
  ([googlearchive/caja wiki](https://github.com/googlearchive/caja/wiki/CajaModule)).
- **Brand-free implementability.** The recipe is documented as primitives: fetch the
  participant's deployed HTML, parse it, rewrite its public path, execute its scripts with
  a `Proxy` fake window (per-app state pool for concurrency, snapshot restore for the
  single-instance case), patch dynamic script and style insertion, and reclaim the patched
  paths on teardown. The HTML-loading half is even available as a standalone MIT library
  independent of any composer ([import-html-entry](https://www.npmjs.com/package/import-html-entry)),
  and the sandbox half is a widely written-up pattern with known `Proxy` invariant traps
  (`getOwnPropertyDescriptor` configurability, `defineProperty` on the native window,
  `Symbol.unscopables` built with a null prototype). No named product is required to state
  or build the boundary.

Separability against both merge candidates:

- **Against `family.document-embedding`.** The enforcement authority genuinely differs and
  the difference is observable, not rhetorical: even the members that borrow a real iframe
  do so as a *realm donor* and project the participant's DOM into the host document, so
  layout, the accessibility tree and overlay geometry stay shared, which is exactly what a
  browsing-context boundary cannot give. Salesforce's own product line makes the
  distinction explicit by shipping the iframe container as a separate, less capable escape
  hatch alongside the virtualization engine, with the documented costs (clipped to a
  rectangle, no cross-component drag and drop, duplicated library copies) that section 3.7
  records as this landscape's document-embedding costs.
- **Against `family.lifecycle-orchestration`.** Confinement flips two participant-facing
  facts that the lifecycle seam does not touch: the participant floor drops to
  `migration.trivial-adaptation` (the deployed app is consumed as-is) and
  `ownership.participant-bytes-verbatim` flips to n (the composer transforms what it
  runs). Those are contract changes, not thickness.
- **The distinguishing property occurs alone.** Locker, LWS, Figma, Remote DOM, WorkerDOM
  and Caja all virtualize without rehosting a deployed HTML entry, and ShadowRealm
  standardizes the virtualization on its own. So the confinement half is not an artifact
  of the load format.

### 8.4 Findings that are not verdict changes

1. **The 3.6 boundary statement is a conjunction whose halves are separable.** Section 3.6
   and the section 2 summary row state the boundary as "deployed HTML entry plus a
   simulated-realm sandbox contract". The evidence shows HTML entry without confinement
   (DAZN: fetch, parse, append, drive lifecycles, no sandbox, which lands in
   `family.lifecycle-orchestration`) and confinement without HTML entry (every non-landscape
   case in 8.3). The *distinguishing* property is the simulated confinement; the HTML entry
   is the family's characteristic load format, not its differentiator. Recommended edit
   (additive, one clause in 3.6's "Composition boundary" field plus the matching summary
   cell), left to a follow-up rather than applied here because it touches a definition
   field: name the confinement as the differentiator and the HTML entry as the
   characteristic participant format. No family status, member list, dimension pole,
   constraint binding or matrix cell changes.
2. **The evidentiary concentration is real but is a corpus gap, not a model defect.** Both
   families now have documented existence outside their branded members, but the *matrix*
   still has no vendor-neutral practice column for either, which is why the removal test
   emptied them. The durable fix is additive: two practice units alongside the existing
   `iframe-composition`, `web-components-composition` and `reverse-proxy-route-composition`
   entries, provisionally "client lifecycle orchestration practice" (in-house shell driving
   an exported mount/unmount contract) and "sandboxed-realm rehosting practice" (proxy
   window plus HTML entry plus scoped CSS, assembled from primitives). Cost per unit: one
   dossier, one column of 220 attribute verdicts, a matrix rebuild, a coverage-count update
   in section 7 and in implementations.md section 5, and a re-run of the removal test. Not
   done here: adding matrix columns is a research-refresh task
   ([../maintenance/versioning-strategy.md](../maintenance/versioning-strategy.md),
   `cadence.annual-full`), not a verification task.
3. **Neighbor families were re-tested for free and held.** Nothing in the evidence disturbs
   FC-3's split or FC-4's keep decision; no other family's boundary was implicated.

### 8.5 Blast radius

None. Both verdicts are KEEP, so no constraint binding, question, question-graph edge,
decision-engine rule, topology mapping, scenario trace, matrix column, or published
projection changes. The two family ids remain in use unchanged across
[constraints.md](constraints.md), [questions.md](questions.md),
[question-graph.md](question-graph.md), [decision-engine.md](decision-engine.md),
[topology.md](topology.md), the scenario fixtures in
[../scenarios/](../scenarios/), and the docs-site projection. The only follow-ups are the
two additive items in 8.4, neither of which is a prerequisite for anything currently
published.
