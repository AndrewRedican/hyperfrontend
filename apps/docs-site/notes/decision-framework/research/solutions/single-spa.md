# single-spa

- Unit type: framework
- Status (Aug 2026): maintenance, bordering inactive. Last stable npm release is 6.0.3; the v7 line has been in beta since 2024 (latest 7.0.0-beta.13, 2024-09-22); last core-team blog post 2024-09-30; a February 2026 community issue asks whether the project is abandoned; Snyk classifies the package "Inactive" (no npm release in 12 months) while weekly downloads remain ~367k. Inventory's provisional "maintenance" status is CONFIRMED, with the added note that dependency-health tooling already grades it inactive.
- Availability: available (stable 6.x). The systemjs-less v7 line is available-immature (beta only, no stable release as of Aug 2026).
- Version / release cadence at research time: stable 6.0.3; 7.0.0-beta.13 (Sept 2024); no releases observed since September 2024.
- Official links: docs https://single-spa.js.org, repo https://github.com/single-spa/single-spa
- Researched: 2026-08-28

## What it is

single-spa is a client-side orchestration router: a root config running in one HTML document registers named "applications", each with a loading function and an activity function over `window.location`, and single-spa mounts and unmounts them as the URL changes. Each application is a JS module exporting `bootstrap`, `mount`, and `unmount` lifecycle functions (promise-returning); single-spa itself renders nothing and owns no DOM. Framework adapters (single-spa-react, -vue, -angular, etc.) generate those lifecycles from a normal framework app. "Parcels" are the same lifecycle contract applied to individual UI chunks mounted manually for cross-framework component sharing. Historically apps are delivered as SystemJS modules resolved through an import map; the v7 direction replaces SystemJS with native ESM but has not shipped stable. It defined the microfrontend app-orchestration category; qiankun and others derive from it.

## Composition mechanics

- Composition boundary: a JS lifecycle contract (module exporting bootstrap/mount/unmount) plus a name and activity function registered in the root config; module resolution boundary is an import map entry.
- Integration phase: runtime. New app versions integrate after the host ships by repointing the import map entry; adding a brand-new app requires a root-config change (registerApplication call) unless the root config reads a dynamic registry.
- Execution model: shared JS realm, shared DOM, shared document, client-composed. No iframes, no workers, no server composition in core.

## Findings by matrix group

### Build-time coupling
- Each application builds independently with its own toolchain and repo. Yes [E1][E4]. framework-guarantee.
- Root config does not import application code at build time; it references module URLs or loading functions resolved at runtime. Yes [E4]. framework-guarantee.
- Shared-dependency dedup (one React on the page) is not enforced by core; it requires import-map externals or an equivalent bundler convention. Conditional (import map + externalized deps convention) [E4][E6]. common-pattern.
- SystemJS is not mandatory; any loading function returning lifecycles works. Yes [E4]. framework-guarantee.

### Runtime coupling
- All applications execute in one shared JS realm and one shared document. Yes [E1][E2]. framework-guarantee.
- single-spa listens to routing events globally (hashchange/popstate) and fires its own window events (`before-routing-event`, `app-change`, etc.); apps share this one routing pipeline. Yes [E5]. framework-guarantee.
- Global CSS and global variables collide unless teams adopt scoping conventions; core provides no CSS isolation. Yes (collision risk) [E1][E2]. common-pattern.
- Multiple framework runtimes (React + Vue + Angular) can be live in the same document simultaneously. Yes [E2][E7]. officially-supported.

### Isolation and failure containment
- JS isolation between applications: No (same realm, no sandbox; boundary here means "separate global scope", which single-spa does not provide) [E1][E5]. inference from documented execution model.
- Failure containment: an app that throws or times out in a lifecycle is moved to SKIP_BECAUSE_BROKEN and siloed (never re-run) rather than crashing the router or sibling apps. Conditional (contains lifecycle-phase errors only; errors thrown after mount inside the app's own event handlers are not intercepted) [E5]. framework-guarantee.
- Lifecycle timeouts are configurable (`setMountMaxTime` etc.) with die-on-timeout quarantine. Yes [E5]. framework-guarantee.
- Recovery from broken state is manual via `unloadApplication()` (resets to NOT_LOADED for re-bootstrap). Yes [E5]. framework-guarantee.
- Security isolation between microfrontends: No (same origin, same realm; any app can touch any other app's DOM and globals) [E1][E5]. inference.

### Framework requirements
<!-- canonical decomposition example preserved from guidance -->
- Multiple frameworks coexisting in one page: Yes [E2][E7]. officially-supported.
- Lifecycle adoption required (every participant must export bootstrap/mount/unmount): Yes [E1]. framework-guarantee.
- Arbitrary already-deployed app participates unchanged: No (an app that renders its own HTML document does not satisfy the contract; it must be refactored to export lifecycles and mount into a container it does not own) [E1][E4]. framework-guarantee.
- Official adapters exist for React, Vue, Angular, Svelte, Ember, and others, generating lifecycles from framework components. Yes [E7]. officially-supported.
- Adapter compatibility with 2025-2026 framework majors (React 19, Angular 18/19) is being questioned by the community with no maintainer commitment observed. Unknown [E8]. community-convention.

### Ownership topology fit
- Independent teams own, build, and deploy their own applications end to end. Yes [E1][E4]. officially-supported.
- One central artifact (root config + import map) must be owned by somebody; registering a new app is a coordination point. Yes [E4]. framework-guarantee.
- Cross-team shared UI without merging codebases is served by parcels. Yes [E2]. officially-supported.

### Migration requirements
- Incremental strangler migration of an existing SPA: Conditional (the legacy app must be wrapped to export lifecycles and give up ownership of the document shell) [E1][E4]. officially-supported.
- Per-app migration cost: export lifecycles, remove own HTML entry point, externalize or accept duplicated framework runtime. Yes [E1][E6]. common-pattern.
- SystemJS-based estates face a second migration to the ESM/v7 direction; the promised SystemJS-to-ESM migration guide has not shipped. Unknown (path exists in tooling defaults, guide absent) [E6][E9]. community-convention.

### Deployment
- Independent deployment after the host ships: Conditional (repoint the app's import-map entry to the new artifact URL; the root config itself is untouched) [E4][E6]. common-pattern.
- Deploy-time import-map mutation is an ecosystem pattern (import-map-deployer), not a core capability. Yes [E6]. possible-extension.
- The root config is itself a deployable that changes only when the app roster or layout changes. Yes [E4]. framework-guarantee.

### Contracts and communication
- Registration-time custom props flow into every lifecycle call (tokens, config). Yes [E1]. framework-guarantee.
- Cross-app communication is left to browser primitives (custom events) and shared utility modules; no built-in typed contract or message bus. No built-in bus [E1][E4]. inference.
- Parcels are the official cross-framework component contract (bootstrap optional, mount/unmount required, update optional; `mountParcel` scopes lifetime to the parent app). Yes [E2]. framework-guarantee.
- Routing lifecycle is observable and cancellable via documented window events (`before-routing-event` with `cancelNavigation()`). Yes [E5]. framework-guarantee.

### UX implications
- Transitions between microfrontends are client-side, no full page reload, single browser history. Yes [E4][E5]. framework-guarantee.
- single-spa-layout (official layout engine) adds declarative route-to-DOM placement, loading UIs, and error UIs on top of core. Yes [E3]. officially-supported.
- Without the layout engine, DOM placement and loading states are each app's own responsibility. Yes [E1]. framework-guarantee.

### Performance causes
- Apps load lazily when their activity function first matches; `start()` separates download from mount for startup control. Yes [E1][E4][E5]. framework-guarantee.
- Duplicated framework runtimes on one page are the characteristic weight cost when teams do not share dependencies via import maps. Yes (cause) [E6]. common-pattern.
- SystemJS adds a loader layer the v7 ESM direction is meant to remove; that removal is not stable. Yes (beta only) [E9][E10]. officially-supported (direction), not shipped.

### Security and trust
- All participants are fully trusted code in one origin and one realm; compromise of one microfrontend is compromise of the page (boundary defined as: no realm, storage, or DOM separation between apps). Yes [E1][E5]. inference.
- No permission or capability model in core. No [E5]. inference from documented API surface.

### SSR and delivery
- Built-in SSR: No [E3]. framework-guarantee.
- SSR is achievable as a documented recipe: single-spa-layout's server APIs decide which MFEs a route needs, each MFE renders an HTML stream (dynamic module loading recommended over HTTP fetch), headers merge, browser hydrates. Conditional (per-MFE isomorphic code plus Node in production) [E3]. officially-supported.
- Default delivery is a client-rendered shell document plus JS modules. Yes [E3][E4]. framework-guarantee.

### Operational model
- Pure OSS, no control plane, no registry service, no telemetry; operations reduce to hosting static artifacts and managing the import map. Yes [E4][E6]. inference from documented architecture.
- Maintenance pace as of Aug 2026: core merges stalled since roughly late 2024 (some 7.0-branch activity into 2025), v7 beta unshipped for ~2 years, community Slack invites reported broken, Feb 2026 abandonment issue open. Yes (stalled) [E8][E9][E11]. reputable-analysis + community-convention.
- Installed base remains large (~367k weekly npm downloads), so ecosystem knowledge and Stack Overflow depth persist despite the stall. Yes [E11]. reputable-analysis.

## Editions and commercial layer

None. MIT-licensed OSS, no commercial edition, no hosted service. Ecosystem tools (import-map-deployer, create-single-spa, single-spa-layout) are also OSS under the same org.

## Family mapping (provisional)

- Client-side runtime composition / app-orchestration router: primary family; single-spa is the canonical member.
- Component-level runtime composition: secondary, via parcels.
- Module-sharing families (import maps, module federation): adjacent, not implemented by core; single-spa composes WITH an import map or federation layer rather than providing one. Multi-family honesty: it is an orchestrator that depends on a separate module-delivery family.

## Ambiguities and decomposition candidates

- "Is it maintained?" splits into: core release cadence (stalled); adapter compatibility with current framework majors (unknown); installed base / community depth (large); governance responsiveness (poor signals). These move independently in a matrix.
- "Supports ESM" splits into: apps loadable as modules today via loading functions (yes); systemjs-less core as the blessed path (beta, not stable); documented SystemJS-to-ESM migration route (absent).
- "Independent deployment" splits into: artifact deploy without host rebuild (yes) vs roster change without root-config redeploy (no, unless a dynamic registry is built).
- "Isolation" splits into: JS realm isolation (none); CSS isolation (none, convention); lifecycle failure quarantine (yes, SKIP_BECAUSE_BROKEN); post-mount runtime error containment (no).
- Canonical framework-mixing decomposition (preserved from guidance): "can I mix frameworks" is three findings, multiple frameworks Yes; lifecycle adoption required Yes; arbitrary deployed app unchanged No.

## Sources

- [E1] https://single-spa.js.org/docs/building-applications/ (accessed 2026-08-28) - lifecycle contract: bootstrap/mount/unmount required, promise-returning, unload optional, custom props, activity functions.
- [E2] https://single-spa.js.org/docs/parcels-overview/ (accessed 2026-08-28) - parcels: lifecycles (mount/unmount required, bootstrap/update optional), mountParcel vs mountRootParcel, cross-framework sharing use case, "applications as primary microfrontend type".
- [E3] https://single-spa.js.org/docs/ssr-overview/ (accessed 2026-08-28) - no built-in SSR; five-step recipe (layout/fetch/headers/body/hydrate); single-spa-layout as official layout engine; Node-in-production constraint.
- [E4] https://single-spa.js.org/docs/configuration/ (accessed 2026-08-28) - root config: root HTML + registerApplication (name, loader, activeWhen, props), start(), "you do not have to use SystemJS".
- [E5] https://single-spa.js.org/docs/api/ (accessed 2026-08-28) - SKIP_BECAUSE_BROKEN siloing, lifecycle timeouts, unloadApplication, start() semantics, routing events and cancelNavigation.
- [E6] https://github.com/single-spa/create-single-spa/issues/433 and webpack-config-single-spa changelog via search (accessed 2026-08-28) - ESM default in tooling v5, missing SystemJS-to-ESM migration guide, import-map externals pattern.
- [E7] https://single-spa.js.org/docs/5.x/ecosystem-angular/ and adapter ecosystem docs (accessed 2026-08-28) - official framework adapters exist per framework.
- [E8] https://github.com/single-spa/single-spa/issues/1361 "Why does this project feel abandoned? (Part 2, Checking in for 2026)" (accessed 2026-08-28) - core merges stalled, 7.0-branch activity paused ~Sept 2025, broken Slack invites, adapter-freshness concern.
- [E9] https://github.com/single-spa/single-spa/releases (accessed 2026-08-28) - v7 beta line 7.0.0-beta.4 through beta.13, all 2024; no stable v7; no 2025-2026 releases on page.
- [E10] https://single-spa.js.org/blog/ (accessed 2026-08-28) - last post Sept 30, 2024; core-team notes on native-ESM direction and SystemJS move-away; single-spa@6 module formats.
- [E11] https://security.snyk.io/package/npm/single-spa (accessed 2026-08-28) - package health "Inactive", latest 6.0.3, ~367k weekly downloads.
