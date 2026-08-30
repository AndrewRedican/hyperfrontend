# Comparison-Matrix Attribute Catalogue

Consolidated attribute catalogue for the microfrontend decision framework's comparison
matrix, derived from the 29 evidence dossiers (research snapshot 2026-08, generated
2026-08-28, schema 0.1.0). This document is the human-readable companion to
`attributes.json`.

Per REQ-MATRIX-02, every attribute is a closed question scored per unit with the value
vocabulary: **Yes / No / Conditional / NA / Unknown**, where a Conditional cell carries
its **condition**, and every non-NA cell carries **evidence** (dossier citation), a
**claim type** (browser-guarantee, framework-guarantee, vendor-claim, community-convention,
common-pattern, possible-extension), a **confidence** level, and a **verifiedAt** date.
Per REQ-MATRIX-03, normalization rows (the two `migration.*.min-level` scale attributes)
layer over mechanical atoms and take a scale-level id instead of the Yes/No vocabulary;
they are flagged in their notes. Attributes whose original wording was not mechanically
decidable have been tightened and carry a "Decidability:" note in `attributes.json`.

Six canonical guidance ids survive verbatim: `runtime.shared-js-realm`,
`isolation.document-boundary`, `deployment.host-rebuild-required`,
`migration.source-modification-required`, `ownership.external-participant`,
`coordination.shared-dependency-governance` (the last lives in the Operational model
group; its canonical prefix is preserved over the group prefix). The REQ-ENT ids
`hosting.operator`, `hosting.control-plane`, `registry.deployable-feature`,
`governance.rollback`, `governance.usage-monitoring`, and `governance.rbac` are likewise
reused verbatim inside the Unit identity group.

Groups are ordered from unit identity, through composition mechanics and coupling,
to isolation, security, framework, contracts, delivery, UX, performance, and finally
deployment, migration, ownership, and operations. 220 attributes across 15 groups;
58 near-duplicates were merged and 17 ids renamed (see the appendix).

## Unit identity, availability, and editions (`unit`, 20 attributes)

- `unit.type.adoptable-implementation`: Is the unit a concrete adoptable implementation (product, framework, library, or platform capability) rather than an architectural strategy?
- `unit.availability.installable-today`: Can at least one edition of the unit be obtained and run in production today (REQ-AVAIL-01 available or available-immature)?
- `unit.availability.stable-line-shipped`: Is the unit's currently recommended release line a stable, non-beta, non-RC release at 1.0 or higher, with semver commitments currently in effect?
- `unit.availability.single-current-line`: Does the unit have exactly one unambiguous current release line, with no dormant stable tag alongside an unshipped successor?
- `unit.availability.planned-capability-claims`: Does the unit advertise an edition or capability set whose availability is announced-planned or future-roadmap only?
- `unit.maintenance.release-within-12mo`: Did the unit's currently recommended line ship a release in the 12 months before 2026-08-28?
- `unit.maintenance.commit-within-6mo`: Did the unit's repository receive non-trivial commits, or its current line a release, in the 6 months before 2026-08-28?
- `unit.maintenance.multi-maintainer`: Did more than one person land substantive commits on the unit in the trailing 12 months (bus factor above one)?
- `unit.maintenance.org-steward`: Does an organization currently employ or sponsor the unit's maintainers (corporate or foundation stewardship, not an individual project)?
- `unit.maintenance.adoption-outside-sponsor`: Are production adopters outside the sponsoring organization documented?
- `unit.maintenance.adoption-scale-10k`: Does the unit's core package sustain at least 10k weekly npm downloads (or equivalent documented adoption)?
- `unit.license.osi-core`: Is the unit's core composition capability licensed under an OSI-approved open-source license?
- `unit.editions.commercial-tier`: Does a first-party commercial edition, tier, hosted service, or paid support offering attach to the unit today?
- `unit.editions.oss-self-sufficient`: Can the community or OSS edition perform the unit's core composition function in production without the commercial tier?
- `hosting.operator`: Is a vendor-managed hosting option (vendor operates hosting.artifacts, hosting.applications, or hosting.runtime-delivery) available for the unit today?
- `hosting.control-plane`: Can the unit's control plane (metadata, configuration, version records, wiring, promotion, rollback routing) run entirely on adopter-controlled infrastructure, with no routine dependency on a vendor SaaS?
- `registry.deployable-feature`: Does the unit ship or offer a registry of deployable runtime artifacts with version history and metadata (beyond npm-style code packages)?
- `governance.rollback`: Does the unit provide first-party rollback to a prior participant version by repointing a reference to a retained artifact, without rebuilding or redeploying the participant?
- `governance.usage-monitoring`: Does the unit provide first-party visibility into which consuming applications use which feature or version?
- `governance.rbac`: Does the unit provide organization-wide roles and permissions over its platform surface today?

## Composition mechanics (`composition`, 10 attributes)

- `composition.kind.js-module-graph`: Do participants meet as modules in one JS module graph (importing and exposing module specifiers)?
- `composition.kind.lifecycle-contract`: Must each participant export a prescribed lifecycle interface (e.g. bootstrap/mount/unmount, setup/teardown) to be composed?
- `composition.kind.custom-element`: Is a custom element tag the mount seam the host places for a participant?
- `composition.kind.html-fragment-endpoint`: Does a participant ship as an HTTP endpoint returning an HTML fragment for insertion into a composed page?
- `composition.kind.html-entry`: Does the mechanism fetch a participant's deployed HTML page (HTML entry URL) and rewrite or execute it inside the host context?
- `composition.kind.http-route-partition`: Are participants whole applications partitioned by URL path or subdomain, with the full page as the unit of composition?
- `composition.kind.build-artifact`: Is the composition boundary a versioned package or build artifact consumed by another build (npm package, component snap)?
- `composition.kind.inherits-underlying`: Does the unit define no composition boundary of its own, inheriting mechanics from an underlying mechanism it wraps?
- `composition.phase.deploy-unit-per-participant`: Is each participant its own independently shippable deploy unit (artifact or service), not merely a render or ownership unit?
- `composition.exec.client-composed`: Does client-side JS in the browser perform the assembly, fetching or mounting participants into the page?

## Build-time coupling (`buildtime`, 8 attributes)

- `buildtime.host-build-consumes-participants`: Does producing the host's deployable artifact require participant source, artifacts, or types as build inputs, so a broken participant breaks the host build?
- `buildtime.host-integrates-buildless`: Can a host adopt the mechanism with no build tooling at all (script tag, static HTML, or pure config), rather than requiring a mechanism-built host?
- `buildtime.participant-tooling-required`: Must each participant's build pipeline adopt mechanism-specific tooling (bundler plugin, adapter, CLI, or output-format configuration) to emit a valid artifact?
- `buildtime.bundler-family-restricted`: Is participation restricted to artifacts produced by a specific list of supported bundlers?
- `buildtime.share-metadata-emitted`: Does each participant's build emit machine-readable shared-dependency metadata (versions, ranges, singleton flags) that is negotiated at composition time?
- `buildtime.shared-dep-change-rebuilds-center`: Does changing the set or versions of centrally shared dependencies require rebuilding and redeploying a central artifact (shell or host)?
- `buildtime.central-input-for-participant-build`: Does building a participant require an input obtained from the host or central platform (shell emulator, roster config file, cloud handshake, git metadata)?
- `buildtime.asset-prefix-coordination`: Must participant builds coordinate unique asset URL prefixes or namespaces to avoid collisions when served behind one origin?

## Runtime coupling (`runtime`, 13 attributes)

- `runtime.shared-js-realm`: Do host and participant code execute in one shared JS realm (same global object and prototype chain) by default?
- `runtime.patched-globals-layer`: Does participant code run against a framework-interposed synthetic or patched global surface (Proxy window, hidden same-origin iframe realm, patched document or location) whose fidelity the framework must maintain?
- `runtime.primordials-blast-radius`: Can one participant's mutation of shared built-ins (Array.prototype, fetch, etc.) affect other participants by default?
- `runtime.concurrent-participants`: Can two or more participants (including ones owned by different teams) be mounted live in the same browser tab and document at the same time?
- `runtime.multi-router-participants`: Can more than one URL- or router-owning participant be active and displayed at the same time?
- `runtime.shared-runtime-library`: Must every participant load, or stay version-compatible with, one strategy runtime (shell, orchestrator, loader) present on the composed page?
- `runtime.central-routing-map`: Does runtime composition depend on one central map, registry, or config binding URL space or the participant roster (a single shared artifact or service that needs one accountable owner and serialized writes)?
- `runtime.shared-dep-negotiation`: Does the strategy provide a runtime mechanism that resolves shared dependency versions across independently built participants?
- `runtime.dep-conflict-surfaces-runtime`: Can a shared-dependency version conflict first manifest at runtime (silent duplicate copy, or singleton mismatch warning or error) rather than at build time?
- `runtime.side-by-side-versions`: Can two participants concurrently use different or conflicting versions of the same shared library in one composed page without interfering with each other?
- `runtime.global-registration-collision`: Do participants occupy a page-global runtime namespace (custom-element tags, globals, import-map specifiers) where a second registration can hard-fail and cross-team naming governance is required?
- `runtime.late-participant-registration`: Can a participant or remote unknown at boot be registered and loaded into an already-running document via a documented API?
- `runtime.loaded-version-hot-swap`: Can the version behind an already-loaded participant or module specifier be replaced within the same live document, without a full page reload?

## Isolation and failure containment (`isolation`, 17 attributes)

- `isolation.document-boundary`: Is each participant's rendered DOM contained in its own browser document (e.g. a visible iframe), rather than injected into a shared visible host document?
- `isolation.js.virtualized-global`: Absent a separate realm, does the framework simulate global isolation (Proxy fake-window or snapshot) that prevents accidental global collisions between cooperating participants?
- `isolation.dom.virtualized`: Is participant DOM access confined to its own subtree only by framework patching or open shadow roots (soft, bypassable confinement)?
- `isolation.css.outbound`: Are a participant's styles prevented from affecting the host or sibling participants by an enforced mechanism (separate document, shadow DOM, or rewriting), rather than resolving in the page-global cascade?
- `isolation.css.inbound`: Are host or global styles prevented from leaking into a participant's rendered DOM?
- `isolation.resource.main-thread`: Does a tight synchronous loop or long task in one participant leave the host UI responsive?
- `isolation.process.crash`: Can a participant run in a separate OS process from the host, so a renderer crash, OOM, or Spectre-class attack inside it leaves the host page alive and contained?
- `isolation.storage.partition`: Is a participant's own storage (cookies, localStorage, IndexedDB, service workers) separated from the host's and siblings'?
- `isolation.origin.host-authority`: Is participant code denied the host origin's authority (credentialed fetch as the host, host cookies and storage)?
- `isolation.navigation.top-level-guard`: Can the host prevent a participant from navigating or manipulating the top-level document and history without an explicit grant?
- `isolation.security.malicious-participant`: Does the isolation boundary contain a deliberately malicious or compromised participant, judged by the vendor's own stated trust model plus the browser boundary class in use, not merely accidental interference?
- `isolation.failure.lifecycle-quarantine`: Does the framework detect a participant failing during load, bootstrap, or mount and quarantine it (fallback UI or siloed broken state) without crashing the composition?
- `isolation.failure.post-mount-exception`: If a participant throws an unhandled exception after mount, do the host and sibling participants keep functioning without host-authored error handlers?
- `isolation.failure.load-fallback`: Is there a built-in per-participant fallback (fallback content and/or timeout) when a participant fails to fetch or load, so only its region degrades?
- `isolation.lifecycle.reclaim`: Does unmounting a participant automatically reclaim its timers, global event listeners, injected scripts and styles, and memory?
- `isolation.recovery.in-page`: Can a failed participant be destroyed and recreated with a fresh execution context without reloading the host document?
- `isolation.server.process`: Are participants' server-side render and logic processes isolated from the composer and from each other (separate services, isolates, or deployments)?

## Security and trust (`security`, 14 attributes)

- `security.cross-origin-boundary`: Can each participant execute behind a browser-enforced cross-origin boundary from the host while composed on the same page?
- `security.sandbox-attribute-applicable`: Can the host meaningfully apply the iframe sandbox attribute (default-deny, selectively re-granted) to a participant?
- `security.per-participant-csp`: Can host and participant be governed by different CSPs simultaneously while composed?
- `security.capability-narrowing`: Can the host grant or deny powerful browser capabilities (camera, popups, top navigation, downloads) per participant?
- `security.host-dom-reach`: Can participant code synchronously read or mutate the host page's live DOM?
- `security.host-js-state-reach`: Can participant code inspect or mutate host JS runtime state (globals, prototypes, in-memory tokens)?
- `security.untrusted-third-party-viable`: Is executing untrusted or semi-trusted third-party participant code a supported use under the strategy's own stated trust model?
- `security.channel-origin-pinning`: Does the framework's messaging layer itself enforce origin and source verification on cross-document messages?
- `security.channel-confidentiality`: Can inter-party message payloads be encrypted against co-resident in-page scripts?
- `security.embedding-authorization`: Can a participant itself restrict, browser-enforced, which hosts may embed or execute it?
- `security.artifact-integrity-verification`: Does a first-party mechanism verify participant code integrity or authenticity before execution (SRI pinning, signing)?
- `security.delivery-intermediary-trust`: Does canonical delivery route participant code through a shared intermediary (feed, registry, router, SaaS control plane, transform CDN, composer) requiring code-execution trust?
- `security.isolation-escape-hatches`: Does the framework document official escape hatches that bypass its own isolation mechanism?
- `security.composition-injection-surface`: Does the composition tier interpret composition directives found in content, creating an injection surface (e.g. ESI tags in user-supplied markup)?

## Framework requirements (`framework`, 15 attributes)

- `framework.host-framework-agnostic`: Can the host or shell application be written in any UI framework, or none?
- `framework.participant-framework-agnostic`: Can a participant be built with any UI framework, subject only to the platform's contract?
- `framework.mixed-frameworks-one-page`: Can participants built with different UI frameworks render simultaneously in one composed page?
- `framework.per-team-framework-autonomy`: Can each team choose its framework without sharing one build pipeline with other participants?
- `framework.same-framework-major-coexistence`: Can two participants run different major versions of the same framework in one composed page without breakage?
- `framework.esm-artifact-required`: Must a participant's build emit standard ES modules to participate?
- `framework.html-document-entry`: Is the participant's integration unit its own deployed HTML page or URL rather than a JS artifact?
- `framework.client-library-required`: Must a participant embed a platform client library or runtime for full (non-degraded) participation?
- `framework.foreign-artifact-no-rebuild`: Can an artifact built for another system, with no knowledge of this platform, participate without being rebuilt?
- `framework.official-adapters-exist`: Do maintained first-party adapters or converters generate the participation contract for three or more major frameworks?
- `framework.adapters-track-current-majors`: Are the framework adapters or integrations verified against current (2025-2026) framework majors?
- `framework.zero-framework-participant`: Can a participant ship with no JS framework at all (static HTML or vanilla JS)?
- `framework.version-floor-imposed`: Does participation impose a minimum framework or tooling version on host or participant?
- `framework.composition-tier-stack-mandated`: Does the composition tier itself require a specific server stack, runtime, or platform?
- `framework.multi-framework-demonstrated`: Does an official reference or demo demonstrate multi-framework composition, beyond a claim?

## Contracts and communication (`contracts`, 15 attributes)

- `contracts.formal-descriptor`: Does a machine-readable artifact (manifest, schema, descriptor) declare the participant's interface to the integration layer, beyond code-level imports or bare URLs?
- `contracts.contract-versioned`: Does the contract artifact or wire protocol carry an explicit version identifier?
- `contracts.connect-compat-gate`: Is a compatibility or contract version stamped into each side's artifact at build and mechanically checked when the pieces first meet (connect, load, or activation), refusing or flagging incompatible pairs before integration completes?
- `contracts.drift-surface`: Can the two sides of the contract be deployed at different times, making version drift structurally possible?
- `contracts.drift-explicit`: When host and participant versions drift incompatibly, does the mechanism itself surface an explicit machine-readable error rather than silently wiring and failing later in application code?
- `contracts.types-shared`: Does the solution provide a supported mechanism to deliver compile-time types for the cross-boundary API to consumers' builds (generated d.ts, typed API package, emulator)?
- `contracts.schema-validated-payloads`: Is data crossing the boundary validated against a declared schema or parameter list by the mechanism itself, at publish, request, or message time?
- `contracts.sync-calls`: Can one participant synchronously invoke another participant's live JS objects (direct import or function call) without going through a message channel?
- `contracts.serialized-boundary`: Is the communication channel restricted to serializable data (structured clone, JSON, HTML), so live object references cannot cross the boundary?
- `contracts.frame-messaging`: Does cross-participant communication cross a window or frame boundary via postMessage (or a wrapper over it)?
- `contracts.builtin-messaging`: Does the solution ship its own cross-participant messaging API (event bus, pub/sub, data channel) beyond raw browser primitives?
- `contracts.builtin-shared-state`: Does the solution provide a shared cross-participant state store with change subscription?
- `contracts.host-push-updates`: Can the host push updated context or data to an already-mounted participant through a solution-provided channel, without remounting it?
- `contracts.http-request-contract`: Is the participant's integration contract an HTTP request/response interface consumed by the composition tier (fragment endpoint, extension API)?
- `contracts.server-context-propagation`: Does the solution define how request context (locale, device, mount origin, auth) is serialized to participants, with built-in forwarding or parsers?

## SSR and delivery (`ssr`, 15 attributes)

- `ssr.composed-page`: Is a page containing multiple participants assembled from participant output into one HTML document on a server or edge tier before the browser receives it?
- `ssr.fragment-granularity`: Does server-side composition stitch multiple participants into one document (fragment granularity) rather than only routing whole per-participant pages?
- `ssr.streaming-assembly`: Can participant content stream into the delivered or composed document as it arrives, flushing the shell or early fragments before slow participants finish, rather than being fully buffered?
- `ssr.participant-internal`: Can an individual participant use its own framework's SSR for its own document, zone, or fragment endpoint regardless of composition-layer SSR support?
- `ssr.dual-mode-render`: Do server-side and client-side rendering paths both exist for the same participant, with documented selection or failover between them?
- `ssr.no-js-first-paint`: Is participant content visible in the initial render without executing any client-side JavaScript?
- `ssr.hydration-orchestration`: Does the solution ship a runtime that schedules or orchestrates hydration across participants, beyond each participant self-hydrating?
- `ssr.crawler-indexable`: Is participant content present in server-delivered HTML at a crawlable URL, either in the composed page or at the participant's own route?
- `ssr.static-prerender`: Can participant content be prerendered at build time and served as static HTML (SSG), fully or per route or region?
- `ssr.edge-composition`: Can the composition or assembly step itself execute at CDN edge PoPs near the user rather than an origin server?
- `ssr.static-hosting-sufficient`: Can production delivery run entirely from static hosting or CDN with no request-time server compute performing composition?
- `ssr.server-loadable-artifact`: Can the participant's distributed artifact be loaded and evaluated in a server-side JS runtime through first-party means?
- `ssr.rsc-federation`: Are React Server Components or framework-native streaming SSR supported first-party across the participant boundary (host server tree includes a federated participant's server components)?
- `ssr.dev-prod-parity`: Does the development server render participants server-side identically to production builds?
- `ssr.html-fragment-contract`: Is the server-rendered participant format standards-based inert HTML (including declarative shadow DOM) consumable without a JS runtime on the composing tier?

## UX implications (`ux`, 20 attributes)

- `ux.cross-boundary-soft-nav`: Is navigation between two separately deployed units a soft client-side navigation (no full document unload, re-download, and re-parse of the destination's assets)?
- `ux.within-unit-soft-nav`: Can one unit deliver SPA-style soft navigation among its own routes, unimpaired by the strategy?
- `ux.cross-boundary-prefetch`: Does the solution ship prefetch or prerender of cross-boundary destinations to mask hard-navigation latency?
- `ux.cross-doc-view-transitions`: Does the solution inject cross-document View Transitions code at boundary crossings?
- `ux.persistent-shared-chrome`: Can shared chrome (nav, header, media player) stay continuously mounted across all cross-unit transitions?
- `ux.unit-keepalive`: Can a unit retain in-memory app state while hidden or unmounted and have it restored when shown again (documented keep-alive or instance reuse, trading resident memory for faster re-activation)?
- `ux.keepalive-scroll-restoration`: Does the keep-alive restore mechanism also restore scroll position, not just app state?
- `ux.deep-link-inner-route`: Is there a documented mechanism reflecting a unit's internal route or state into a shareable top-level URL and restoring it from that URL?
- `ux.frame-history-pollution`: Can embedded-unit navigations enter top-level session history so Back invisibly navigates an inner unit?
- `ux.overlay-viewport-escape`: Can a unit's overlays (modal, dropdown, toast) cover the full viewport rather than clip to the unit's rectangle?
- `ux.host-overlay-protocol`: Does the solution provide a first-class protocol for host- or shell-drawn overlays requested by a unit?
- `ux.body-portal-compat`: Do component libraries that portal overlays to document.body work unmodified inside a unit?
- `ux.natural-layout-flow`: Does embedded unit content size and scroll as part of the host page flow, with no fixed rectangle needing height-reporting workarounds or inner scrollbars?
- `ux.cross-boundary-focus-mgmt`: Can focus traps, roving focus, and focus restoration across a unit boundary be implemented without explicit cross-boundary messaging?
- `ux.screenreader-continuity`: Does the composed page expose one continuous accessibility tree, so assistive tech traverses all unit content as one document without per-unit labeling workarounds?
- `ux.composed-first-paint`: Does first paint deliver fully composed unit content, with no client-side composition flash or loader waterfall?
- `ux.builtin-loading-ui`: Does the solution ship built-in loading indicators for unit boundaries rather than requiring host-authored ones?
- `ux.builtin-error-fallback-ui`: Does a failed unit render a designated fallback UI in place rather than a blank hole or crash?
- `ux.mount-layout-shift-risk`: Must authors reserve placeholder dimensions to avoid layout shift when unit content arrives after first paint?
- `ux.token-theming-mechanism`: Does the strategy include an enforcing mechanism, not convention or discipline, that propagates design tokens or theming across unit boundaries?

## Performance causes (`performance`, 15 attributes)

- `performance.client-composition-runtime`: Must the page load a client-side composition or orchestration runtime (loader, orchestrator, sandbox library) beyond the units themselves?
- `performance.pre-render-orchestration-fetch`: Must the client complete at least one orchestration fetch (manifest, feed, discovery, registry, remote entry, import-map install) before the first unit can render?
- `performance.sequential-waterfall-default`: Does the default client loading flow discover requests sequentially (each fetch known only after a prior response parses or executes), producing a request waterfall?
- `performance.first-party-preload-levers`: Does the solution ship first-party preload, prefetch, or warm-up mechanisms that cut unit activation latency?
- `performance.duplicate-framework-same-page`: Under default configuration, can two co-displayed units using the same framework each load their own copy of that framework runtime on one page?
- `performance.shared-dependency-dedup`: Does the solution provide a built-in mechanism (runtime negotiation or build-time declaration) so a dependency shared by multiple units is downloaded and instantiated once per page?
- `performance.dedup-failure-on-version-skew`: Can the sharing mechanism silently fall back to loading duplicate copies when units declare incompatible dependency versions?
- `performance.per-unit-document-boot`: Does each unit instance instantiate its own browser document or realm that separately parses HTML/CSS and boots its own JS realm?
- `performance.process-memory-overhead`: Where the engine applies site isolation, do cross-origin units run in separate OS processes carrying measurable per-process memory overhead?
- `performance.sandbox-execution-tax`: Does the isolation mechanism impose continuous execution overhead on unit code (proxy-wrapped globals, runtime selector rewriting, instrumented eval)?
- `performance.per-message-serialization-cost`: Does cross-unit communication pay per-message overhead (structured clone, schema validation, crypto envelope) rather than passing in-realm references?
- `performance.hydration-deferrable-per-unit`: Can each unit's hydration or boot be individually gated on visibility, idle, interaction, or media query, so client JS cost scales with the interactive surface?
- `performance.request-time-server-fanout`: Does serving one page trigger per-unit server-side fetches (composer-to-fragment or registry calls) on the request path?
- `performance.per-unit-http-cacheable`: Is each unit an independently HTTP-cacheable resource, served from its own endpoint or origin with its own cache headers, at CDN or proxy tier where server-rendered?
- `performance.default-content-caching`: Does the shipped composition tier cache unit content (not merely manifests or metadata) without operator configuration?

## Deployment (`deployment`, 13 attributes)

- `deployment.host-rebuild-required`: Does shipping a new version of an already-integrated participant require rebuilding or redeploying the host or composer application before it reaches users?
- `deployment.new-participant-host-change`: Does onboarding a brand-new participant after the host ships require a host, composer, router, or gateway code change, rebuild, or redeploy (rather than a config, registry, or data change)?
- `deployment.golive-central-pointer`: Does a participant release reach users only after a centrally owned pointer or artifact (import map entry, environment pointer, router config, version pin) is updated, rather than the participant's own deploy alone going live?
- `deployment.consumer-version-pin`: Can the host or consumer pin an exact participant version and keep receiving it regardless of newer participant deploys?
- `deployment.per-user-version-targeting`: Can a specific user, session, or preview audience be served a different participant version while production users keep the current one, via a first-party mechanism or documented pattern?
- `deployment.immutable-version-retention`: Does a first-party mechanism keep every published participant version immutable and permanently addressable (duplicate name+version publish rejected, prior versions retained)?
- `deployment.cache-busting-operator-burden`: Does keeping consumers on the intended participant version rely on operator-managed cache-busting or short TTLs of a mutable well-known URL, rather than immutable content-addressed URLs or a versioned pointer?
- `deployment.participants-static-artifacts`: Do participants deploy as static artifacts servable by any static file host or CDN, as opposed to running HTTP services?
- `deployment.strategy-service-in-path`: Must a strategy-specific server or service (registry, feed, gateway, composition proxy, router, layout tier) be deployed and operated in the production request path, beyond static file hosting?
- `deployment.runtime-discovery-first-party`: Does the solution define or ship a first-party runtime discovery artifact or service (manifest, feed, registry, routing map) that the host consults to resolve participants?
- `deployment.single-domain-required`: Must all participants be served to end users under a single public origin or domain (path-split or proxied) for the strategy to function?
- `deployment.cross-origin-cors-required`: When a participant is hosted on a different origin than the host page, must the participant origin serve CORS headers for loading to work?
- `deployment.vendor-hosting-required`: Must participants or their serving infrastructure run on one specific vendor's hosting platform?

## Migration requirements (`migration`, 17 attributes)

- `migration.participant.min-level`: What is the lowest level on the migration scale (model/migration.md section 2, ids 1-8) this unit demands of an existing application before first successful participation?
- `migration.host.min-level`: What is the lowest migration-scale level this unit demands of the composing or host application as one-time adoption work?
- `migration.source-modification-required`: Must any of the participant application's existing source code be edited before it can participate at all?
- `migration.participant.bootstrap-change-required`: Must the participant's entry or startup code change (export mount/unmount lifecycles, defer boot, parameterize the mount node) for full participation?
- `migration.participant.internals-refactor-required`: Must application internals change in bounded areas beyond the entry point (routing base or publicPath, mount-path or URL-prefix assumptions, global or DOM exclusivity, style scoping)?
- `migration.participant.deployment-change-required`: Must the participant change where or how it is hosted or served (mandated platform, registry publish, new serving infrastructure)?
- `migration.participant.extraction-required`: Starting from a feature inside an existing monolith, must that feature first be extracted into an independently built and deployed unit before it can participate (no in-place wrapping)?
- `migration.participant.rewrite-required`: For an existing application, does adoption amount to level 7-8 work: a framework port, architectural inversion, or wholesale platform and workflow migration?
- `migration.participant.thirdparty-unmodified-viable`: Can an already-deployed application whose owners will change nothing (build output, exports, and source all untouched) participate through host-side work alone?
- `migration.participant.legacy-no-build-viable`: Can a decades-old application with no reproducible modern build (server-rendered, jQuery-era) participate without first acquiring one (required level at most 2)?
- `migration.strangler.incremental`: Can adoption proceed one route, region, or feature at a time while the untouched legacy stays in production (strangler-fig), with no big-bang cutover?
- `migration.host.new-infra-tier-required`: Does adoption require standing up or controlling a new infrastructure tier in front of or beside the existing site (proxy or CDN contract, gateway middleware, layout server, component registry)?
- `migration.host.shell-takeover-required`: Must the composing application be re-rooted under the unit's shell or root config (host gives up ownership of its document shell or application root)?
- `migration.exit.participants-standalone`: After adoption, do participants remain standalone runnable and deployable applications outside the composition (bounded exit, low cost.evolve)?
- `migration.path.from-incumbent-format`: Is there an officially documented migration path into this unit from an incumbent composition format (webpack MF, SystemJS/single-spa, a prior major)?
- `migration.forced-remigration-pending`: Does the currently adoptable line carry a known forced breaking migration ahead (announced EOL, breaking next major, format deprecation)?
- `migration.permanent-viability`: Is there documented vendor guidance or multi-year production-adopter evidence supporting the unit as the permanent architecture, rather than solely migration scaffolding?

## Ownership topology fit (`ownership`, 14 attributes)

- `ownership.single-team-endorsed`: Does the unit's own documentation explicitly endorse use by a single coordinated team on one release train, rather than redirecting that case to simpler tooling?
- `ownership.code-boundary-ownership`: Can a team hold enforceable review and ownership authority over its participant's source (separate repo, or path ownership with required review)?
- `ownership.deploy-schedule-ownership`: Does the owning team control when its participant's changes reach production users, independent of any shared release train?
- `ownership.runtime-operational-ownership`: Does the owning team operate its participant as its own running service or origin in production (its own on-call surface)?
- `ownership.external-participant`: Can a participant owned by a separate organization be composed via surfaces it already exposes (URL, script tag, published artifact) while treated as a distinct security principal?
- `ownership.participant-unmodifiable-host`: Can the participant run inside a host page whose owner makes at most one minimal documented change (one tag, URL, or script), adopting no build tool or framework?
- `ownership.distrusted-cadence`: Can a participant deploy on a schedule other teams neither know nor approve, with no first-party mechanism erroring or requiring a freeze, train, or synchronized rollout on the resulting skew?
- `ownership.uncoordinated-upgrades`: Can participants run mutually incompatible versions of shared dependencies (including framework majors) indefinitely, with no cross-team upgrade train ever forced by default configuration?
- `ownership.onboarding-without-central-owner`: Can a new participant team join the composition without any action by the central artifact's owner (e.g. publish-to-registry or feed discovery)?
- `ownership.platform-team-role-required`: Does effective operation require a standing platform-owner role distinct from product teams (shell, router, layout, registry, or CDN and edge-config owner)?
- `ownership.non-developer-composition`: Can non-developers hold page-composition authority (which participants appear where) through a supported UI?
- `ownership.participant-bytes-verbatim`: Is the participant's shipped code guaranteed to execute as shipped, with no host-side rewriting of its HTML, JS, or CSS?
- `ownership.nested-host-seat`: Can a participant simultaneously act as a host composing its own participants (chained ownership)?
- `ownership.upstream-contract-lifetime`: Is the unit's composition boundary another project's contract, so it inherits that project's lifetime (the Ara-on-Hypernova pattern)?

## Operational model (`operations`, 14 attributes)

- `coordination.shared-dependency-governance`: Does avoiding duplicated, conflicting, or broken shared dependencies require standing cross-team version governance (agreed names, ranges, singleton policy, upgrade trains) before and after builds?
- `operations.version-skew-machinery`: Does the unit ship machinery for host-participant version-skew moments (deploy-skew fallback routing, semver renegotiation, manifest polling and refresh, runtime handshake version gate)?
- `operations.stack-traces-cross-boundary`: Do a participant's runtime errors and stack traces surface directly in the host document's error stream (same realm), rather than staying behind the composition boundary?
- `operations.owner-attribution-builtin`: Does the unit ship a mechanism that attributes a runtime failure to the owning participant (per-unit error boundary, liveness state, or per-fragment fallback-serve signal) without adopter-built tagging?
- `operations.cross-journey-correlation-diy`: Does correlating one user journey across the composition boundary require adopter-implemented correlation IDs because no shared runtime context spans the boundary?
- `operations.deploy-inventory-firstparty`: Can an operator enumerate which participant versions are live per environment through a first-party surface (dashboard, registry, manifest, or the map itself)?
- `operations.first-party-debug-tooling`: Does a first-party runtime debugging surface exist for the composition (browser devtools extension or built-in debug UI)?
- `operations.local-composed-dev-firstparty`: Does first-party tooling run the fully composed experience on a developer machine (dev proxy, shell emulator, local registry or dev mode)?
- `operations.composition-tier-local-parity`: Can the production composition mechanism itself execute on a developer laptop without vendor infrastructure or simulators (dev-prod parity of the composition tier)?
- `operations.standalone-participant-dev`: Can a participant be developed and run standalone, without the host or composer running, via a documented mechanism (mocked context defaults, emulator package)?
- `operations.composed-test-utilities`: Does the unit ship first-party utilities for testing the composed system (integration and e2e helpers, routing validation, emulator-backed tests)?
- `operations.deploy-time-contract-verification`: Does anything verify at build or deploy time that a participant still satisfies its consumers' contracts (beyond editor-time type hints)?
- `operations.single-sponsor-concentration`: Is maintenance concentrated in a single company or single dominant individual, such that losing that one sponsor plausibly stalls the project?
- `operations.mode-forked-operations`: Does official documentation define two or more configuration modes or version lines that change this unit's answers to isolation or runtime attributes, requiring it to be scored as distinct configurations?

## Appendix: merged and renamed ids (traceability)

Value scoring recorded against a merged id must be re-attributed to its surviving id.
"(inverted)" means the merged attribute asked the opposite polarity; flip Yes/No when
migrating recorded verdicts (Conditional, NA, Unknown carry over unchanged).

### Renamed (17)

| Old id | New id |
| --- | --- |
| boundary.kind.js-module-graph | composition.kind.js-module-graph |
| boundary.kind.lifecycle-contract | composition.kind.lifecycle-contract |
| boundary.kind.custom-element | composition.kind.custom-element |
| boundary.kind.html-fragment-endpoint | composition.kind.html-fragment-endpoint |
| boundary.kind.html-entry | composition.kind.html-entry |
| boundary.kind.http-route-partition | composition.kind.http-route-partition |
| boundary.kind.build-artifact | composition.kind.build-artifact |
| boundary.kind.inherits-underlying | composition.kind.inherits-underlying |
| boundary.phase.deploy-unit-per-participant | composition.phase.deploy-unit-per-participant |
| boundary.exec.client-composed | composition.exec.client-composed |
| migration.participant.source-modification-required | migration.source-modification-required |
| ownership.serves-single-team | ownership.single-team-endorsed |
| ownership.serves-external-participant | ownership.external-participant |
| ownership.serves-unmodifiable-host | ownership.participant-unmodifiable-host |
| ownership.serves-distrusted-cadence | ownership.distrusted-cadence |
| ownership.serves-uncoordinated-upgrades | ownership.uncoordinated-upgrades |
| operations.shared-dep-governance-required | coordination.shared-dependency-governance |

### Merged (58)

| Merged id | Surviving id |
| --- | --- |
| boundary.kind.separate-document | isolation.document-boundary |
| boundary.phase.post-ship-update | deployment.host-rebuild-required (inverted) |
| boundary.phase.onboard-without-host-deploy | deployment.new-participant-host-change (inverted) |
| boundary.phase.host-build-consumes-participants | buildtime.host-build-consumes-participants |
| boundary.exec.shared-js-realm | runtime.shared-js-realm |
| boundary.exec.synthetic-global | runtime.patched-globals-layer |
| boundary.exec.shared-visible-document | isolation.document-boundary (inverted) |
| boundary.exec.server-composed | ssr.composed-page |
| boundary.exec.concurrent-participants | runtime.concurrent-participants |
| boundary.exec.cross-origin-execution | security.cross-origin-boundary |
| buildtime.unmodified-app-participates | migration.participant.thirdparty-unmodified-viable |
| buildtime.dep-agreement-before-build | coordination.shared-dependency-governance |
| buildtime.dedup-by-build-declaration | performance.shared-dependency-dedup |
| buildtime.onboard-without-host-rebuild | deployment.new-participant-host-change (inverted) |
| buildtime.update-without-consumer-rebuild | deployment.host-rebuild-required (inverted) |
| buildtime.types-delivered-at-build | contracts.types-shared |
| buildtime.contract-version-baked | contracts.connect-compat-gate |
| runtime.shared-dom-document | isolation.document-boundary (inverted) |
| runtime.shared-css-cascade | isolation.css.outbound (inverted) |
| runtime.shared-main-thread | isolation.resource.main-thread (inverted) |
| runtime.participant-route-in-url | ux.deep-link-inner-route |
| runtime.builtin-cross-participant-messaging | contracts.builtin-messaging |
| runtime.sync-cross-participant-access | contracts.sync-calls |
| runtime.shared-service-critical-path | deployment.strategy-service-in-path |
| isolation.js.realm | runtime.shared-js-realm (inverted) |
| isolation.dependency.version-coexistence | runtime.side-by-side-versions |
| isolation.page-granular | runtime.concurrent-participants (inverted) |
| framework.default-version-lockstep | ownership.uncoordinated-upgrades (inverted) |
| framework.lifecycle-exports-required | composition.kind.lifecycle-contract |
| framework.unmodified-app-participates | migration.participant.thirdparty-unmodified-viable |
| framework.build-plugin-required | buildtime.participant-tooling-required |
| ownership.serves-intra-page | runtime.concurrent-participants |
| ownership.central-composition-artifact | runtime.central-routing-map |
| ownership.namespace-governance-required | runtime.global-registration-collision |
| ownership.solution-sponsor-diversity | operations.single-sponsor-concentration (inverted) |
| migration.participant.bundler-change-required | buildtime.participant-tooling-required |
| migration.participant.framework-alignment-forced | ownership.uncoordinated-upgrades (inverted) |
| migration.host.rebuild-per-participant | deployment.new-participant-host-change |
| deployment.rollback-pointer-swap | governance.rollback |
| deployment.version-compat-gate | contracts.connect-compat-gate |
| deployment.control-plane-self-hostable | hosting.control-plane |
| performance.streaming-assembly | ssr.streaming-assembly |
| performance.edge-pop-assembly | ssr.edge-composition |
| performance.boundary-full-page-navigation | ux.cross-boundary-soft-nav (inverted) |
| performance.main-thread-contention | isolation.resource.main-thread (inverted) |
| performance.keepalive-memory-tradeoff | ux.unit-keepalive |
| security.same-realm-execution | runtime.shared-js-realm |
| security.host-origin-authority | isolation.origin.host-authority (inverted) |
| security.process-isolation-available | isolation.process.crash |
| security.main-thread-blocking | isolation.resource.main-thread (inverted) |
| ssr.partial-hydration | performance.hydration-deferrable-per-unit |
| ssr.fragment-http-cacheable | performance.per-unit-http-cacheable |
| operations.central-artifact-owner-required | runtime.central-routing-map |
| operations.selfop-central-service | deployment.strategy-service-in-path |
| operations.vendor-control-plane-dependency | hosting.control-plane (inverted) |
| operations.stable-api-line | unit.availability.stable-line-shipped |
| operations.maintenance-active-6mo | unit.maintenance.commit-within-6mo |
| operations.commercial-support-available | unit.editions.commercial-tier |
