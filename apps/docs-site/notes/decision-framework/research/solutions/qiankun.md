# qiankun

- Unit type: framework
- Status (Aug 2026): active, with a split personality. The stable npm line is dormant (latest `2.10.16`, published 2023-11-15), but the project itself is under heavy active development on the v3 RC line: `3.0.0-rc.20` published 2026-01-06, `3.0.0-rc.21` 2026-02-04, a `2.10.17-beta.0` maintenance beta 2026-06-23, and repo commits through 2026-08-11 (README/docs overhaul for v3, CI release fixes; default branch is `next`). Inventory's provisional "active (verify)" is CONFIRMED, with the correction that "active" describes the v3 RC line and repo, not the stable tag; dependency-health tooling that looks only at the `latest` tag (e.g. Snyk) grades the package "Inactive" while weekly downloads remain ~30k. [E5][E6][E9]
- Availability: available (2.x stable, in maintenance); the rearchitected v3 is available-immature (RC tag only, no stable 3.0 as of Aug 2026). [E4][E5]
- Version / release cadence: `latest` 2.10.16 (Nov 2023); `rc` 3.0.0-rc.21 (Feb 2026); `2.0-beta` 2.10.17-beta.0 (Jun 2026). Cadence on v3 is bursty (Jan/Feb 2026 RCs after a 2024 gap) with continuous repo activity in mid-2026. [E5][E6]
- Official links: docs https://qiankun.umijs.org (v2 docs at https://v2.qiankun.umijs.org), repo https://github.com/umijs/qiankun (MIT, ~16.7k stars)
- Researched: 2026-08-28

## What it is

qiankun is Ant Group's micro-frontend framework built on top of single-spa's lifecycle orchestration, extracted from Ant's internal cloud-products platform (README claims 2000+ online applications inside Ant). It replaces single-spa's "app = JS module" convention with HTML entry: the host registers each sub-app by the URL of its deployed HTML page; qiankun fetches that HTML with `window.fetch`, parses out scripts and styles, and executes the scripts itself inside a JS sandbox. In v2 that sandbox is a Proxy over `window` (with a snapshot-diff fallback for Proxy-less browsers), plus patchers that capture dynamic `<script>`/`<style>` insertion, timers, and window listeners so they can be reclaimed on unmount. Style isolation is opt-in per mode: default dynamic-stylesheet scoping by mount lifetime, `strictStyleIsolation` (Shadow DOM container), or `experimentalStyleIsolation` (runtime selector-prefix rewriting). v3 (RC) rearchitects the same ideas: streamed HTML entry, a Proxy membrane over both `window` and `document`, native ESM execution with injected import maps and Vite dev-server compatibility, and `@scope`-based CSS scoping. [E1][E2][E4][E7][E8]

## Composition mechanics

- Composition boundary: a deployed HTML page per sub-app (HTML entry URL) combined with single-spa's lifecycle contract (the sub-app bundle must expose `bootstrap`/`mount`/`unmount`, via UMD or window assignment in v2). [E1][E3]
- Integration phase: runtime. The host fetches sub-app HTML at activation time; a sub-app redeploys behind its URL without touching the host build. Adding a new sub-app requires a host-side registration change (`registerMicroApps`/`loadMicroApp`). [E1][E2]
- Execution model: shared JS realm, shared document, client-composed. Sub-app code is evaluated in the host page (v2: `(0, eval)` of fetched script text wrapped in `with(window){...}` bound to the proxy window), against a proxied global, not in a separate realm, iframe, or worker. [E7 structure][E8 source]

## Findings by matrix group

### Build-time coupling
- Sub-apps build independently with their own repos and toolchains; the host consumes only a deployed HTML URL. Yes [E1]. framework-guarantee.
- v2 sub-apps must change their build: UMD (or window-assigned) lifecycle exports, runtime `publicPath` handling (`public-path.js`), and CORS headers on all assets. Yes [E1][E3]. framework-guarantee.
- v2 sub-apps built as native ESM (e.g. stock Vite output) are not executable by the v2 sandbox; the community `vite-plugin-qiankun` wrappers exist outside the project. Conditional (v2: community plugin; v3: native ESM officially supported in RC) [E3][E4]. officially-supported for v3 direction, community-convention for v2.
- Shared-dependency dedup across host and sub-apps is not provided by the framework; each sub-app ships its own runtime unless teams add externals conventions. No built-in dedup [E1][E2]. inference from documented model (no dedup mechanism appears in docs or API).

### Runtime coupling
- All sub-apps and the host run in one JS realm and one document; the sandbox interposes a Proxy view of `window` (v2) rather than a separate realm. Yes [E7][E8]. framework-guarantee (mechanism), inference (realm consequence).
- Shared built-in prototypes: a sub-app that mutates `Array.prototype`, `fetch`, etc. through captured references affects everyone; the membrane does not virtualize primordials. Yes (shared) [E8]. inference from same-realm eval execution.
- Routing: `registerMicroApps` binds activation to the single browser URL, so at most one router-owning app can be active per URL; the FAQ states no more than one router-dependent app can display at a time. Yes [E3]. framework-guarantee.
- Multiple simultaneous micro-apps are supported via `loadMicroApp` with the Proxy sandbox (`singular: false`); the snapshot sandbox cannot isolate simultaneous apps. Conditional (Proxy-capable browser) [E2][E3]. framework-guarantee.

### Isolation and failure containment
- JS side-effect containment (globals, timers, window listeners, dynamically appended scripts/styles are recorded and reclaimed on unmount): Yes, for code paths routed through the proxied `window` and the patched insertion points [E2][E7]. framework-guarantee.
- What the sandbox does NOT guarantee, item by item:
  - Realm separation: No. Sub-app code executes via `eval` in the host realm; "sandbox" here means a proxied global object plus patchers, not an isolated execution context [E8]. inference from source.
  - `document` isolation in v2: No. Only dynamic `<script>`/`<style>` head/body insertion is patched (`patchers/dynamicAppend`); the DOM, `document`, and every other host API remain shared, so any sub-app can read or mutate any other app's DOM [E7]. inference from source structure, consistent with v3 marketing of a new document membrane [E4].
  - Direct-window escape: official FAQ acknowledges isolation "may miss" when code accesses the real window directly (e.g. references captured before sandboxing, `top`/`parent`, constructors reachable from shared objects) [E3]. officially-acknowledged limitation.
  - `excludeAssetFilter`: an explicit, documented escape hatch; assets released by it "will escape the sandbox, and the resulting side effects need to be handled by you" [E3]. framework-guarantee (of non-guarantee).
  - Security boundary: No. The sandbox is cooperative hygiene against accidental collisions between trusted teams, not containment of untrusted code (boundary definition: same origin, same realm, shared DOM and primordials) [E3][E8]. inference.
- Snapshot fallback (Proxy-less browsers, i.e. IE): window-diff snapshot restore on unmount; requires `singular: true`; no simultaneous-app isolation. Conditional [E3][E7]. framework-guarantee.
- Failure containment inherits single-spa semantics (broken lifecycle quarantines that app); qiankun docs do not add a further crash-containment layer, and after-mount exceptions inside a sub-app propagate in the shared realm. Unknown (containment beyond single-spa's lifecycle siloing) [E1]. inference.

### Framework requirements
- Host framework: none; the host only provides a container DOM element and calls qiankun's API. Yes [E1]. framework-guarantee.
- Sub-app framework: any (React, Vue, Angular, jQuery/JSP-era pages), provided it exports the three lifecycles and mounts into the given container. Yes [E1]. officially-supported.
- Adoption of the lifecycle contract is mandatory for every sub-app; an unmodified deployed SPA cannot participate just by URL despite HTML entry, because its bundle must export lifecycles. Yes (modification required) [E1][E3]. framework-guarantee.

### Ownership topology fit
- Independent team-per-app ownership with independent deploys behind stable URLs. Yes [E1]. officially-supported.
- Host registration (name, entry, container, activeRule) is a central coordination point owned by the shell team. Yes [E1][E2]. framework-guarantee.

### Migration requirements
- Strangler migration of legacy pages: HTML entry lowers the packaging burden versus raw single-spa (no import-map/SystemJS layer), but each legacy app still needs lifecycle exports, publicPath handling, and CORS. Conditional [E1][E3]. common-pattern.
- v2 to v3 is a breaking rearchitecture (new sandbox, ESM model, new style isolation); estates adopting v2 in 2026 face a second migration with v3 still in RC. Yes (pending) [E4][E5]. inference from version state.

### Deployment
- Sub-app independent deployment after host ships: Yes; redeploy behind the registered entry URL, host untouched [E1]. framework-guarantee.
- All sub-app assets must be served with CORS headers because qiankun fetches them with `window.fetch`. Yes [E3]. framework-guarantee.
- Strict CSP without `unsafe-eval` blocks v2's script execution path (`(0, eval)` in import-html-entry). Yes (v2 conflict) [E8]. inference from source; v3 ESM execution path Unknown.

### Contracts and communication
- Props flow to lifecycles via registration/`loadMicroApp` config. Yes [E2]. framework-guarantee.
- `initGlobalState` provides a built-in shared-state pub/sub (`setGlobalState`/`onGlobalStateChange`, first-layer-key writes, auto-unsubscribe on unmount). Yes [E2]. framework-guarantee.
- No typed contract or schema layer; state shape and event semantics are conventions between teams. Yes (untyped) [E2]. inference.

### UX implications
- Client-side transitions, single history, no page reloads; sub-app can render as route content (`registerMicroApps`) or as an embedded widget (`loadMicroApp`). Yes [E1][E2]. framework-guarantee.
- `strictStyleIsolation` (Shadow DOM) breaks component libraries that portal to `document.body` (modals, dropdowns, e.g. antd), since portals render outside the shadow boundary. Yes (documented conflict) [E3]. officially-acknowledged.
- Host-side styles are not scoped away from sub-apps by any mode; docs recommend manual prefixing or library namespace config (antd ConfigProvider). Yes (host leakage unaddressed) [E3]. officially-acknowledged.

### Performance causes
- Prefetch: `prefetch: true` (default) warms other registered apps' static resources after the first app mounts; `'all'` prefetches at `start()`; `string[]` and function forms give roster and timing control. Yes [E2]. framework-guarantee.
- HTML entry costs a runtime fetch-and-parse of the sub-app document plus eval execution per script (v2); v3 streams the entry into the document as it arrives. Yes (cause) [E4][E8]. framework-guarantee (mechanism).
- `experimentalStyleIsolation` rewrites selectors at runtime (prefixing `div[data-qiankun-<name>]`); `@keyframes`, `@font-face`, `@import`, `@page` are not rewritten. Yes (cost + gaps) [E2]. framework-guarantee.
- Per-sub-app framework runtime duplication is the characteristic weight cost, as with single-spa. Yes [E1]. inference (no dedup mechanism).

### Security and trust
- Trust model: all participants are same-origin-executed trusted code; the sandbox does not make sub-apps safe to run if untrusted (see non-guarantees above). No security isolation [E3][E8]. inference with boundary defined.
- Secrets/tokens in host globals are readable by any sub-app via shared realm and DOM. Yes (exposed) [E8]. inference.

### SSR and delivery
- qiankun composes on the client; no server-side composition or SSR of sub-apps into the host response is part of the framework. No (client-only composition) [E1][E2][E4]. inference (no SSR capability appears in docs, API, or v3 README).
- IE 11 support exists in v2 via polyfills plus snapshot sandbox in singular mode. Conditional [E3]. officially-supported (v2). v3 browser floor: Unknown.

### Operational model
- Ant Group backing with the umijs org; bursty release cadence, 426 open issues, and a three-year RC period for v3 are the operational risk signals; the mid-2026 docs/README overhaul and CI work signal renewed investment. Mixed [E5][E6]. inference from observed activity.
- Largest CN enterprise adoption in its category per inventory; README's "2000+ apps inside Ant" is a vendor claim. Reported [E4]. vendor-claim.

## Editions and commercial layer

None. MIT OSS; no commercial edition, hosting, or support tier observed. [E4][E5]

## Family mapping (provisional)

- Client-side app orchestration (single-spa family): direct derivative; primary family.
- Sandboxed runtime container: adds the JS-sandbox + HTML-entry container layer that distinguishes the CN container family (qiankun, micro-app, Garfish) from bare single-spa.
- Runtime widget embedding: `loadMicroApp` also serves the manually-mounted-component family (multi-instance, non-routed).

## Ambiguities and decomposition candidates

- "Style isolation" is four mechanically different properties and must be matrixed separately: (a) dynamic stylesheet lifetime scoping (default, unmount cleanup only), (b) Shadow DOM strict mode (breaks portals), (c) experimental selector-prefix rewriting (at-rule gaps), (d) v3 `@scope` scoping (RC only). None isolates host styles from sub-apps.
- "JS sandbox" conflates accidental-collision hygiene (provided) with security isolation (absent); matrix as two attributes with the realm boundary stated.
- "Active" conflates stable-tag cadence (dormant since 2023) with project development (active v3 RC); matrix status per line.
- "ESM/Vite support" is version-forked: No for v2 core (community plugin), Yes-in-RC for v3.
- "Multiple simultaneous apps" is sandbox-implementation-conditional (Proxy yes, snapshot no).

## Sources

- [E1] https://qiankun.umijs.org/guide/tutorial (accessed 2026-08-28) - registration model, HTML entry, lifecycle exports, framework requirements, UMD/publicPath/CORS setup
- [E2] https://qiankun.umijs.org/api (accessed 2026-08-28) - sandbox option and both style-isolation modes with rewrite example and at-rule gaps, prefetch values, singular, loadMicroApp, initGlobalState
- [E3] https://qiankun.umijs.org/faq (accessed 2026-08-28) - snapshot-vs-Proxy sandbox and IE/singular constraint, direct-window isolation miss, excludeAssetFilter escape, Shadow DOM portal conflicts, CORS requirement, router-app limit
- [E4] https://github.com/umijs/qiankun (accessed 2026-08-28) - v3 README: streamed HTML entry, window+document Proxy membrane, native ESM/import-maps/Vite, @scope styling; v2-as-legacy note; MIT; Ant adoption claim
- [E5] https://registry.npmjs.org/qiankun (accessed 2026-08-28) - dist-tags (latest 2.10.16, rc 3.0.0-rc.21, 2.0-beta 2.10.17-beta.0) and publish timestamps incl. 2026-01-06, 2026-02-04, 2026-06-23
- [E6] https://api.github.com/repos/umijs/qiankun (+ /commits) (accessed 2026-08-28) - pushed_at 2026-08-11, default branch `next`, 16,671 stars, 426 open issues, MIT; Aug 2026 commit subjects
- [E7] https://api.github.com/repos/umijs/qiankun/contents/src/sandbox?ref=2.x (accessed 2026-08-28) - v2 sandbox source layout: proxySandbox.ts, snapshotSandbox.ts, legacy/, patchers (css, dynamicAppend, historyListener, interval, windowListener)
- [E8] https://github.com/kuitos/import-html-entry (src/index.js, src/utils.js, accessed 2026-08-28) - script execution via `(0, eval)` with `with(window){...}` bound to `window.proxy`; same-realm evidence and CSP `unsafe-eval` implication
- [E9] Snyk package page for qiankun via web search snippet (accessed 2026-08-28) - "Inactive" maintenance grade on latest tag, ~30k weekly downloads
