# wujie (Tencent)

- Unit type: framework
- Status (Aug 2026): active. A v2 line shipped in June 2026 (2.0.0 on 2026-06-01, 2.1.0 on 2026-06-15) after a quiet year on 1.x; commits on master through mid-June 2026. **Correction to inventory:** the provisional "maintenance (verify)" is wrong; the 2024-era abandonment concern (a popular open issue asked whether wujie would keep iterating) was answered by the v2 releases. Status = active, though cadence is bursty rather than continuous.
- Availability: available
- Version / release cadence: wujie 2.1.0 (npm `latest`, published 2026-06-15). 1.x closed at 1.0.29 (2025-07-20). Companion packages `wujie-vue2`, `wujie-vue3`, `wujie-react`. ~5k GitHub stars, ~419 open issues, ~145 npm dependents; community forks (wujie-x) appeared in early 2026 during the quiet period. License MIT.
- Official links: docs https://wujie-micro.github.io/doc/ , repo https://github.com/Tencent/wujie
- Researched: 2026-08-28

## What it is

wujie is a runtime micro-frontend framework that splits each child application across two browser primitives: its JavaScript executes inside a hidden, **same-origin** iframe (a real separate JS realm), while its DOM renders inside a Web Component with a shadow root placed in the host document. The framework welds the two halves together by patching the iframe's `document` (query methods, `head`, `body`, event registration) so the child's DOM operations land in the shadow root, and by virtualizing `location`/`history` so the child believes it is running at its own URL. The host fetches the child's HTML entry, injects its scripts into the iframe realm and its styles into the shadow root; children can run unmodified (no lifecycle exports required in the default mode). The result is iframe-grade global-namespace isolation without iframe rendering problems, at the deliberate cost of removing the iframe's origin security boundary.

## Composition mechanics

- Composition boundary: an HTML-entry URL per child; at runtime the boundary is a (hidden same-origin iframe realm + shadow-rooted custom element) pair per child instance. Host-side usage is a component (`WujieVue`, `WujieReact`) or an imperative `startApp` call, not route-driven registration.
- Integration phase: runtime. Children are fetched, parsed, and executed in the browser after the host ships; a child can be redeployed with no host rebuild.
- Execution model: separate JS realm per child (real iframe global), but same origin, same agent cluster, same event loop, one shared visible document (children's DOM lives in the host document behind shadow roots). No server composition.

## Findings by matrix group

### Build-time coupling

- Host and children need no shared build, bundler, or dependency graph; integration is by HTML-entry URL. Yes [E1][E2] officially-supported.
- Children can run completely unmodified (no lifecycle exports, no bundler config) in the default "reconstruction" mode. Yes [E8] officially-supported.
- Singleton mode (instance reuse without JS re-execution) requires the child to export `window.__WUJIE_MOUNT` / `window.__WUJIE_UNMOUNT`. Conditional (only for singleton/alive optimization) [E8] officially-supported.
- Shared dependencies are not deduplicated across children; each iframe realm loads its own copies. Yes (duplication) [E2] inference from mechanism (no shared-module facility exists in the API surface [E7]).
- Vite/ESM children are supported. Yes [E1] officially-supported.

### Runtime coupling

- Host and all children share one browser process and one main thread (same-origin frames are in one agent cluster and can script each other synchronously). Yes [E5] browser-guarantee.
- `window.parent` from the child resolves to the real host window and is not patched by the framework. Yes [E5] (source: no parent/top redirection in the iframe patch set) framework-behavior confirmed in source.
- A shared EventBus spans host and every child (decentralized pub/sub, all apps can address all apps). Yes [E2] officially-supported.
- Child route state can be synchronized into the host URL as query params (`sync`, with `prefix` short-path mapping). Conditional (`sync: true`) [E7] officially-supported.

### Isolation and failure containment

Boundary definitions matter here; wujie's own "native isolation" marketing conflates three different boundaries. Split:

- Global-namespace (realm) isolation is browser-enforced: each child gets a genuine separate iframe global (own `window`, `Date`, prototypes, timers), not a Proxy simulation. Yes [E1][E2][E5] browser-guarantee.
- Origin/privilege isolation is absent **by construction**: the framework makes the iframe same-origin with the host (loads it against the host origin, stops loading, rewrites the document) so child code holds full host-origin authority (cookies, storage, fetch-as-host, synchronous DOM access to the host via `window.parent`). No [E5] framework-behavior confirmed in source; the isolation boundary is namespacing, not security.
- CSS isolation is browser-enforced shadow-DOM style scoping in normal mode. Yes [E1][E2] browser-guarantee (style encapsulation only, not a security boundary).
- DOM isolation is framework-virtualized: the child's `document` methods/properties (`querySelector`, `getElementById`, `head`, `body`, event listeners) are patched to route into the shadow root; unpatched access paths hit the iframe's own hidden document instead. Conditional (holds for the patched surface) [E2][E5] framework-guarantee with leak potential.
- `location` is framework-virtualized (`proxyLocation` via Proxy); in degrade mode (no Proxy/WebComponents, IE9+ or `degrade: true`) a second iframe replaces the shadow root, `Object.defineProperty` replaces Proxy, and `window.location.host` can no longer be hijacked (child sees the host's host; must use `$wujie.location`). Conditional [E6] officially-supported.
- Main-thread failure containment: none; a child's infinite loop or heavy synchronous work blocks the host UI (shared event loop). No [E5] browser-guarantee (same agent cluster) + inference.
- Error attribution: uncaught child errors surface on the child iframe's own window, aiding per-app attribution. Yes (as attribution, not containment) inference from the realm split [E5].
- Renderer/process crash containment: none (one page, one process). No; inference.

### Framework requirements

- Children: framework-agnostic; anything that renders into a DOM via standard document APIs (React, Vue, vanilla) works against the proxied document. Yes [E1][E2] officially-supported.
- Zone-based frameworks (Angular) inside the patched-document environment: compatibility not verified this session. Unknown.
- Host: official wrappers for Vue 2, Vue 3, React; any host can use the imperative core (`startApp`/`preloadApp`/`destroyApp`). Yes [E1][E7] officially-supported.

### Ownership topology fit

- Independent team ownership of children with independent release trains: supported, since integration is a runtime URL. Yes [E2] officially-supported.
- The host retains unilateral power over child code at load time: `replace` (code-text transform over the child's HTML/JS/CSS) and `plugins` (loaders, hooks, property overrides) rewrite child code as it is injected. Yes [E7] officially-supported; this is a trust-topology fact: children cannot assume their shipped bytes run verbatim.
- Nested wujie (a child hosting its own wujie children) is supported, including keep-alive nesting. Yes [E1] officially-supported.

### Migration requirements

- Incremental strangler-style adoption: embed a legacy app unmodified in reconstruction mode, then add `__WUJIE_MOUNT`/`__WUJIE_UNMOUNT` later for singleton reuse. Yes [E8] officially-supported.
- Migration away is bounded: children remain standalone-runnable apps (they must load from a URL anyway). Yes; inference from the HTML-entry model [E2].

### Deployment

- Children deploy independently, after the host ships, with no coordination artifact. Yes [E2] officially-supported.
- Child assets are fetched by the host with `fetch()` (customizable via the `fetch` option), so cross-origin child hosts must serve CORS headers; same-origin deployment avoids this. Conditional [E7] officially-supported (option exists) + inference (CORS consequence of host-side fetch).
- `preloadApp` warms resources ahead of activation; `html` option allows supplying pre-fetched entry HTML. Yes [E2][E7] officially-supported.

### Contracts and communication

- Three channels: `props` injection (`$wujie.props`), direct synchronous `window.parent` access (same-origin, so plain function calls), and the global EventBus (`bus.$emit/$on`). Yes [E2] officially-supported.
- No typed contract, schema, versioned handshake, or capability negotiation; all channels are untyped JS values in a shared trust domain. No (none provided) [E2][E7] inference from documented API surface.
- Lifecycle contract (host-observed): `beforeLoad`, `beforeMount`, `afterMount`, `beforeUnmount`, `afterUnmount`, `activated`, `deactivated`, `loadError`. Yes [E7] officially-supported.

### UX implications

- Child UI lives in the host document: shared viewport, natural scrolling, overlays/modals can cover the whole page (unlike a plain iframe, whose rendering is clipped to the frame). Yes [E2] framework-guarantee. Exception: in degrade mode modals are confined to the child's area. Conditional [E6] officially-supported.
- Keep-alive mode (`alive: true`) preserves the rendered component and state across switches (no white screen on return; URL changes stop driving child routes, bus communication required instead). Conditional [E7][E8] officially-supported.
- `fiber: true` (default) executes child JS in `requestIdleCallback` slices so child boot does not freeze host interaction. Yes [E7] officially-supported.
- Route deep-linking/refresh survival via `sync` URL-query serialization. Conditional (`sync: true`) [E7] officially-supported.

### Performance causes

- Per-child cost: one iframe (hidden) + one custom element per instance; iframe realms carry meaningful memory overhead versus Proxy-sandbox or realm-sharing approaches. Yes [E2] inference from mechanism; magnitude Unknown.
- No `with(proxyWindow)` execution tax on every statement (qiankun's cost model); child JS runs at native speed in its own realm. Yes [E2] officially-supported (docs' stated comparison).
- Preload + optional pre-execution, keep-alive reuse, and singleton JS reuse are the framework's activation-latency levers; v2.1.0 added `refreshApp` for full rebuild. Yes [E2][E7][E9] officially-supported.

### Security and trust

- Not a sandbox for untrusted code: same-origin iframe + unpatched `window.parent` means any child can read/write host DOM, storage, and cookies. The framework's isolation claims are about accidental interference (globals, CSS), not adversaries. No (no security boundary) [E5][E6] source-confirmed; do not convert "isolated" into "secure" here; the boundary is fault/namespace isolation inside one trust domain.
- Host-side code rewriting (`replace`, `plugins`, custom `fetch`) means integrity of child code is host-controlled. Yes [E7] officially-supported.
- CSP interaction (which policy governs scripts injected into the rewritten same-origin iframe document): Unknown.
- Contrast with plain cross-origin iframes: those get a browser-enforced origin boundary and clipped rendering; wujie intentionally trades away the former to escape the latter. Yes [E2][E5] inference (stated design trade).

### SSR and delivery

- No server-side composition or SSR streaming story; composition is entirely client-side after host boot. No [E2] inference from documented mechanism (no SSR facility in docs/API surface reviewed).
- Whether a server-rendered child HTML entry hydrates correctly through the proxied document: Unknown.

### Operational model

- Self-hosted OSS library; no platform, registry, or SaaS control plane; child discovery/config is host application code. Yes [E1] officially-supported.
- Governance: single-vendor (Tencent) with one dominant maintainer visible in recent releases; bus-factor risk evidenced by the 2024-2025 stall and the community forks it spawned. Conditional (active now, history of stalls) [E3][E4][E10] community-convention + release data.

## Editions and commercial layer

None. MIT-licensed OSS only; no commercial edition, hosted service, or support tier. [E1][E3]

## Family mapping (provisional)

- Primary: client-side runtime composition, isolated-execution-context family (real separate JS realm per child; the architectural neighbor of isolated-runtime orchestration, and the closest OSS precedent for an iframe-realm + host-rendered-surface split; prefigures Web Fragments' reframe approach).
- Secondary: iframe-composition family (degrade mode literally becomes double-iframe composition).
- Not: build-time integration, module federation, or server-side composition families.
- Multi-family honesty: wujie sits between "shared-realm orchestration" (qiankun/single-spa) and "true iframe isolation"; it is neither, and matrix rows about "iframe isolation" must split origin-boundary from realm-boundary before scoring it.

## Ambiguities and decomposition candidates

- "Native isolation" (marketing) decomposes into: (a) realm/global isolation (browser-enforced, Yes), (b) CSS isolation (browser-enforced scoping, Yes), (c) DOM isolation (framework-virtualized, leaky), (d) origin/privilege isolation (deliberately absent), (e) thread/CPU isolation (absent). Matrix should carry these as separate attributes.
- "Iframe-based" decomposes into "iframe as realm container" (wujie) vs "iframe as rendering + security container" (plain iframes); a single iframe column would score both identically and be wrong.
- "Works with unmodified apps" decomposes by run mode: reconstruction (unmodified), singleton (requires mount/unmount exports), keep-alive (unmodified but route-driving changes).
- "Isolation strength" varies by browser tier: normal mode vs degrade mode have different virtualization fidelity (location hijack lost).
- Angular/zone.js child compatibility and CSP interaction are open Unknowns worth a targeted probe if wujie survives shortlisting.

## Sources

- [E1] https://github.com/Tencent/wujie (accessed 2026-08-28) - README feature list, isolation claims, stars/issues, Vue2/Vue3/React packages, nesting, Vite support, MIT license
- [E2] https://wujie-micro.github.io/doc/guide/ (accessed 2026-08-28) - architecture (iframe execution + WebComponent rendering), document-proxy mechanism, activation modes, communication channels, qiankun/single-spa comparison
- [E3] https://registry.npmjs.org/wujie (accessed 2026-08-28) - version history: 1.0.29 (2025-07-20), 2.0.0 (2026-06-01), 2.0.1/2.0.2 (June 2026), 2.1.0 (2026-06-15, latest); license MIT
- [E4] https://github.com/Tencent/wujie/commits/master (accessed 2026-08-28) - commits through 2026-06-16 (v2.1.0 tag, fixes, docs)
- [E5] https://raw.githubusercontent.com/Tencent/wujie/master/packages/wujie-core/src/iframe.ts (accessed 2026-08-28) - source: same-origin iframe construction with stopped loading, hidden iframe, proxied location, wrapped pushState/replaceState, document properties routed to proxyDocument/shadowRoot, no window.parent/top patching
- [E6] https://wujie-micro.github.io/doc/guide/degrade.html (accessed 2026-08-28) - degrade mode: second iframe replaces WebComponent, Object.defineProperty replaces Proxy, location.host not hijackable, modal confinement
- [E7] https://wujie-micro.github.io/doc/api/startApp.html (accessed 2026-08-28) - startApp options: alive, fiber (default true, requestIdleCallback slicing), degrade, sync/prefix, props, attrs, replace, plugins, fetch, lifecycle hooks
- [E8] https://wujie-micro.github.io/doc/guide/mode.html (accessed 2026-08-28) - three run modes (keep-alive / singleton / reconstruction) and their triggers (alive flag, __WUJIE_MOUNT/__WUJIE_UNMOUNT exports)
- [E9] https://github.com/Tencent/wujie/releases (accessed 2026-08-28) - v2.1.0 notes: inline-handler scoping, CSS dedupe fix, destroy-race memory leak fix, refreshApp API
- [E10] https://www.npmjs.com/package/wujie?activeTab=dependents via web search (accessed 2026-08-28) - ~145 npm dependents; 2024 maintenance-concern issue and early-2026 community forks (wujie-x) as maintenance-history signals
