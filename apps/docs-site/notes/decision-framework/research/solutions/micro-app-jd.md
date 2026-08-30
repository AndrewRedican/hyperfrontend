# micro-app (JD.com)

- Unit type: framework
- Status (Aug 2026): active, slow cadence. Last release v1.0.0-rc.32 and last master push both 2026-06-25; 5 releases in the trailing 12 months [E2][E3]. INVENTORY CORRECTION: "active (verify)" confirmed active, but the 1.x line is a perpetual release candidate: the npm `latest` dist-tag points at `1.0.0-rc.32`; no stable `1.0.0` has ever shipped. Record status as "active (1.0 still RC as of Aug 2026)".
- Availability: available-immature (1.x usable and widely deployed in CN, but the current line has carried an rc suffix for 3+ years; API surface still shifting between rc's) [E2][E3]
- Version / release cadence at research time: `@micro-zoe/micro-app` 1.0.0-rc.32 (2026-06-25); recent cadence rc.28 2025-12, rc.29 2026-01, rc.30 2026-04, rc.31 2026-06, rc.32 2026-06 [E2]. Weekly npm downloads ~4.1k (vs qiankun ~70k, wujie ~5.6k, week ending 2026-08-27) [E4]. Repo ~6.25k stars, 329 open issues, MIT [E3].
- Official links: docs https://jd-opensource.github.io/micro-app/ (source markdown in repo `docs/zh-cn/`, 1.x docs are Chinese-only; `docs/en-us` covers 0.x plus changelog); repo https://github.com/jd-opensource/micro-app (npm scope still `@micro-zoe/micro-app` from the pre-rename org)
- Researched: 2026-08-28

## What it is

micro-app is JD Retail's micro-frontend framework built around a custom element: the host drops `<micro-app name='x' url='https://child/index.html'>` anywhere in its component tree, and the framework fetches the child's HTML entry, rewrites its resources, and renders the child inside that element in the host's document [E1][E5]. It is "webcomponent-like": the container is a real custom element, but isolation is simulated by the framework (patched DOM APIs, prefixed CSS, a JS sandbox), not by native shadow-DOM or iframe boundaries by default [E1][E6][E7][E8]. Two switchable JS sandboxes exist: the default `with` sandbox (Proxy-wrapped fake window/document, code executed under `with`) and an opt-in `iframe` sandbox that runs child JS inside a hidden same-origin iframe while the DOM still renders into the `<micro-app>` element in the host document [E6][E9][E10]. A virtual router with five modes (`search` default, `native`, `native-scope`, `pure`, `state`) decouples child routing from the browser URL [E11]. Data flows through a framework event/data center (attribute-bound `data`, `setData`/`dispatch`, listeners, global channel) [E12]. Compared with qiankun, activation is component-driven (render the tag) rather than route-registration-driven, and children need not export single-spa-style lifecycles; compared with wujie, the iframe JS context is an optional fallback rather than the core execution model [E1][E6].

## Composition mechanics

- Composition boundary: custom element (`<micro-app>`) wrapping an HTML-entry child app; each child is identified by a mandatory unique `name` and fetched from `url` pointing at its index.html [E5]
- Integration phase: runtime. Children are fetched, rewritten, and executed in the browser after the host ships; no build-time coupling between host and child is required [E1][E5]
- Execution model: shared document, shared DOM. Default (`with` sandbox): shared JS realm behind a Proxy-based fake window. `iframe` sandbox mode: separate same-origin realm (hidden iframe supplies window/document/location/history context) while patched element APIs redirect rendering into the host-document container [E6][E9][E10]. Never server-composed.

## Findings by matrix group

### Build-time coupling

- Host and child build independently; integration is a URL on a tag. Value: Yes [E1][E5]. Claim type: framework-guarantee.
- Child needs no special export format to mount; a plain HTML-entry app works. Value: Yes [E1]. Claim type: officially-supported.
- Clean unmount/remount and keep-alive memory hygiene expect the child to opt into micro-app's UMD mode (registering mount/unmount hooks). Value: Conditional (only for state-preserving remount and memory optimization) [E6][E13]. Claim type: officially-supported.
- Child bundler config changes are commonly required: top-level `var`/`function` declarations do not leak to `window` inside the sandbox, so webpack DllPlugin output, script-injected globals, and Module Federation remotes must set `library.type: 'window'` or be patched via the plugin system. Value: Conditional (whenever child code relies on implicit global leakage) [E6]. Claim type: officially-supported.

### Runtime coupling

- Child code executes against framework-patched window/document/location/history; correctness depends on the fidelity of those patches (the docs maintain a catalog of known mismatches and per-framework workarounds). Value: Yes [E6][E9][E11]. Claim type: framework-guarantee (mechanism) plus inference (fidelity risk, from the size of the documented workaround surface).
- Vite/ESM children are the stated reason the iframe sandbox exists; the default `with` sandbox cannot reliably handle them. Value: Conditional (Vite children should use `iframe` mode) [E9]. Claim type: officially-supported.
- Browser floor: CustomElements (polyfillable) and Proxy (not polyfillable); no IE, iOS 10+, Android 5+. Value: Yes (hard requirement) [E1]. Claim type: framework-guarantee.
- Multiple children can render simultaneously on one page (unique `name` each); host framework is unrestricted (React/Vue/Angular/vanilla all documented). Value: Yes [E1][E5]. Claim type: officially-supported.

### Isolation and failure containment

- JS isolation, default mode: simulated realm via Proxy fake-window in the shared realm; global-variable pollution is prevented for cooperating code. Value: Conditional (cooperative isolation; boundary is the sandbox proxy, deliberately escapable) [E6][E10]. Claim type: framework-guarantee.
- JS isolation, iframe mode: genuine separate JS realm (same-origin hidden iframe supplies the global object); DOM still shared with host document. Value: Conditional (enable per-app with the `iframe` attribute; iframe src must point at the host origin, needing an `iframeSrc`/empty.html or `window.stop()` workaround to avoid double-loading host resources) [E9][E6][E10]. Claim type: framework-guarantee.
- Escape hatches are official API: `window.rawWindow`/`window.rawDocument` hand the child the real host globals, and `removeDomScope(true)` unbinds element scoping [E6][E8]. So isolation is robustness, not security: a malicious or buggy-on-purpose child reaches the host trivially. Value: No (not a security/trust boundary; boundary defined as: protects against accidental interference only) [E6][E8]. Claim type: framework-guarantee (the escape APIs) plus inference (the security conclusion).
- Style isolation: on by default; child CSS is rewritten with a `micro-app[name=xxx]` prefix. Host styles still leak INTO the child; the docs recommend naming conventions/CSS Modules for that direction. Disable levels: global, per-app, per-file, per-line (comment directives). Value: Conditional (one-directional; child-to-host contained, host-to-child not) [E7]. Claim type: framework-guarantee.
- Element isolation: patched DOM query/mutation APIs confine the child to its `<micro-app>` subtree (shadow-DOM-like, e.g. duplicate `#root` ids resolve locally); the host can still reach into the child by design; scope unbinding is asynchronous and has documented misinsertion pitfalls. Value: Conditional (child confined; host not; async unbind edge cases) [E8]. Claim type: framework-guarantee.
- Shadow-DOM rendering mode: present in 0.x docs; the section is commented out of the 1.x docs (React compatibility cited), though sandbox source still types containers as `HTMLElement | ShadowRoot`. Value: Unknown (de-emphasized/undocumented in 1.x) [E7][E10]. Claim type: inference.
- Failure containment: a child render error fires the container's `error` lifecycle event; but in default mode child JS runs in the host realm, so an unhandled child exception is not architecturally contained. Value: Conditional (render-failure signaling yes; crash containment no in `with` mode; iframe mode contains realm-level faults but not shared-DOM corruption) [E13][E6]. Claim type: framework-guarantee (error lifecycle) plus inference (containment limits).

### Framework requirements

- Host: any framework or none. Value: Yes [E1]. Claim type: officially-supported.
- Child: any framework; per-framework guides exist (React, Vue, Angular, Vite, Next.js, Nuxt.js), each with framework-specific caveats. React needs a JSX pragma polyfill just to listen to the container's custom events. Value: Yes (with per-framework workaround lists) [E1][E13]. Claim type: officially-supported.

### Ownership topology fit

- Teams own independently deployed apps and expose only a URL; host teams own placement and data wiring. Component-style embedding means any team's page can host any other team's app without central route registration. Value: Yes [E1][E5]. Claim type: inference (from mechanics).
- Cross-cutting constraints still centralize: sandbox mode choice, global `start()` config, plugin-based code patching, and route-mode selection live in the host. Value: Yes [E5][E9][E11]. Claim type: inference.

### Migration requirements

- Embedding an existing SPA: often near-zero child changes (fetchable index.html, CORS on assets), but the documented workaround surface (global leakage, MF library type, Vue refresh loops, router base) means "zero-modification" is marketing, not a guarantee. Value: Conditional (child must tolerate the sandboxed environment) [E1][E6][E13]. Claim type: common-pattern.
- Migration away: children remain standalone HTML-entry apps and keep working outside the container; framework-specific investment is limited to optional UMD hooks and data-API usage. Value: Yes (low lock-in for children; host rewiring required) [E1][E12]. Claim type: inference.

### Deployment

- Children deploy independently at their own URLs; host picks up new versions on next load; cross-origin hosting requires CORS on child assets. Value: Yes [E1][E5]. Claim type: framework-guarantee.
- No coordinated release step between host and child is imposed by the framework (contract drift is the teams' problem). Value: Yes [E5]. Claim type: inference.

### Contracts and communication

- Framework-provided data channel: host-to-child via `data` attribute or `setData(name, data)`; child-to-host via `window.microApp.dispatch`; listener APIs (`addDataListener`, `datachange` event), plus a global broadcast channel for cross-app communication. Sends are async and batched per frame; listener return values feed sender callbacks. Value: Yes [E12]. Claim type: framework-guarantee.
- Communication data is cached beyond child unmount unless `clear-data`/`destroy`/`clearData()` is used (stale-state hazard). Value: Yes [E12][E5]. Claim type: framework-guarantee.
- Contract typing/versioning: none; payloads are untyped objects keyed by app name. Value: No [E12]. Claim type: inference.
- Routing contract: five router modes govern how child route state maps to the browser URL (query-param `search` default; `native` shares the real URL; `native-scope` scopes domain to child; `pure` keeps the URL untouched; `state` uses history.state); cross-app navigation APIs (`router.push` by app name), navigation guards, and default-page selection are built in. Value: Yes [E11]. Claim type: framework-guarantee.
- Deep-linking: Conditional (mode-dependent: `search`/`native`/`state` reflect child state in the URL; `pure` deliberately does not) [E11]. Claim type: framework-guarantee.

### UX implications

- Keep-alive: per-app attribute; unmount pushes the app to background instead of destroying it; distinct lifecycle (`afterhidden`/`beforeshow`/`aftershow`) plus an `appstate-change` event inside the child. App-level only: in-child page/component state needs the child framework's own keep-alive; scroll position is explicitly NOT restored. Priority below `destroy`. Value: Conditional (app-level state retention only) [E14][E5]. Claim type: framework-guarantee.
- Single-document UX: shared session, focus, and history context; no iframe scroll/focus seams in default mode (the hidden iframe in iframe mode is context-only, not a rendering surface). Value: Yes [E6][E9][E10]. Claim type: framework-guarantee.

### Performance causes

- Prefetch API and resource-level caching of static assets and data at child init (kept after unmount to speed re-render; deliberate one-time memory cost documented, with a leak checklist: use UMD mode, avoid `destroy`, avoid churning `name`). Value: Yes [E1][E6]. Claim type: framework-guarantee.
- `fiber` mode chunks child JS execution to reduce main-thread blocking during mount. Value: Yes [E5]. Claim type: officially-supported.
- Default script extraction runs child JS from the background (original script tags replaced by comments); `inline` mode restores in-place scripts for debugging at a stated small perf cost. Value: Yes [E5]. Claim type: framework-guarantee.
- All composition costs are client-side (fetch + rewrite + sandboxed eval per child). Value: Yes [E1]. Claim type: inference.

### Security and trust

- Not a trust boundary in any mode: same document, official escape hatches (`rawWindow`, `removeDomScope`), and same-origin iframe context in iframe mode. Suitable only for first-party/trusted children; boundary defined as: no protection against a malicious child. Value: No (not secure against hostile code) [E6][E8][E9]. Claim type: inference (from framework-guaranteed escape APIs).
- Cross-origin child loading requires CORS; child code is fetched and evaluated in (or against) the host context. Value: Yes [E1]. Claim type: framework-guarantee.

### SSR and delivery

- An `ssr` attribute adapts loading for SSR children (URL treated per-request rather than static entry). Value: Conditional (child SSR supported as an embedded app; the composition itself remains client-side) [E5]. Claim type: officially-supported.
- Host-level SSR/streaming composition of children: No (no server-composition story) [E1][E5]. Claim type: inference.
- Next.js/Nuxt.js guides exist for both host and child roles. Value: Yes [E13]. Claim type: officially-supported.

### Operational model

- Single npm dependency in the host (`@micro-zoe/micro-app`), `microApp.start()` global init, per-tag config attributes; global config plus plugin system (code-rewriting loaders per app) for fleet-level policy. Value: Yes [E5][E6]. Claim type: framework-guarantee.
- Dev tooling: dedicated Chrome devtools extension (micro-app-chrome-plugin, supports 0.8 and 1.0) [E15]. Claim type: officially-supported.
- Governance/bus-factor: single-vendor (JD Retail), CN-centric community; 1.x docs Chinese-only; English docs lag at 0.x. Value: Yes (risk) [E1][E3]. Claim type: inference.
- Version churn hazard: living on an rc tag means minor upgrades are nominally pre-release; changelogs are per-rc. Value: Yes [E2][E3]. Claim type: inference.

## Contrast: qiankun and wujie (mechanical, not evaluative)

- Activation model: qiankun registers apps centrally against router `activeRule`s (single-spa lineage: URL decides what mounts, apps export bootstrap/mount/unmount). micro-app activates wherever a `<micro-app>` element renders; no central registration, no required lifecycle exports; the host component tree, not the URL, is the composition driver [E1][E5][E16]. Claim type: framework-guarantee (both sides).
- JS context: wujie ALWAYS executes child JS in a same-origin iframe and renders into shadow DOM (context split is the architecture). micro-app's default is an in-realm Proxy/`with` sandbox; the iframe context is a per-app fallback switch, and rendering targets a light-DOM custom element with prefix-rewritten CSS rather than shadow DOM [E6][E9][E7][E17]. Claim type: framework-guarantee (both sides).
- Practical consequence: micro-app spans both camps in one API (choose `with` for maximum compatibility with legacy bundles, `iframe` for Vite/ESM and stronger realm separation), at the cost of two distinct bug surfaces; qiankun and wujie each commit to one model [E9][E16][E17]. Claim type: inference.
- Adoption signal: qiankun ~70k weekly downloads vs wujie ~5.6k vs micro-app ~4.1k (week ending 2026-08-27); micro-app is the smallest of the three on npm despite comparable GitHub visibility [E4]. Claim type: framework-guarantee (measured).

## Editions and commercial layer

None. MIT, no commercial edition, no hosted service; ecosystem extras (Chrome plugin, MCP server) are also open source under jd-opensource [E3][E15].

## Family mapping (provisional)

- Primary: client-side runtime composition / sandboxed app-container family (with qiankun, wujie, Garfish, icestark).
- Secondary: web-component-container subfamily (custom-element boundary, component-driven activation); in `iframe` sandbox mode it converges on wujie's iframe-context-plus-shared-DOM split, so it plausibly sits in both the "simulated sandbox" and "iframe-context" families depending on configuration (multi-family honesty per REQ-FAM-03).

## Ambiguities and decomposition candidates

- "Isolation" conflates at least four separable matrix attributes here: JS-global isolation (mode-dependent), style isolation (one-directional), element/DOM isolation (child-confining only, async unbind caveats), and security isolation (absent in all modes). Split before scoring.
- "1.x stable" is ambiguous: production-marketed but perpetually rc-tagged; matrix should carry separate "maturity of API contract" and "maintenance activity" attributes.
- "Zero child modification" needs decomposition into: fetchable-entry requirement, CORS requirement, global-leakage tolerance, and optional UMD-mode adoption; each is independently true/false per child.
- "Keep-alive" should split into app-level state retention (Yes) vs page/scroll-level restoration (No).
- Sandbox mode choice (`with` vs `iframe`) changes several matrix answers (realm separation, Vite support, resource double-load pitfall); consider scoring micro-app as two configurations or footnoting mode per row.

## Sources

- [E1] https://github.com/jd-opensource/micro-app README (accessed 2026-08-28) - positioning, webcomponent-like rendering, feature list, CustomElements+Proxy floor, framework-agnostic claims, prefetch
- [E2] https://registry.npmjs.org/@micro-zoe/micro-app (accessed 2026-08-28) - dist-tags (`latest: 1.0.0-rc.32`), release timeline rc.23 through rc.32 (2025-03 to 2026-06-25)
- [E3] https://api.github.com/repos/jd-opensource/micro-app and /releases (accessed 2026-08-28) - pushed_at 2026-06-25, 6,253 stars, 329 open issues, MIT, not archived, release tags v1.0.0-rc.28..rc.32
- [E4] https://api.npmjs.org/downloads/point/last-week/ for @micro-zoe/micro-app, qiankun, wujie (accessed 2026-08-28) - 4,061 / 70,276 / 5,582 weekly downloads
- [E5] docs/zh-cn/configure.md at master (raw.githubusercontent.com, accessed 2026-08-28) - name/url semantics, iframe, inline, destroy, clear-data, disable-sandbox (and what it forfeits), ssr, keep-alive, default-page, router-mode, fiber, globalAssets, exclude/ignore
- [E6] docs/zh-cn/sandbox.md at master (accessed 2026-08-28) - two sandbox modes, with default and iframe fallback, rawWindow/rawDocument escape, top-level-variable non-leakage and DllPlugin/MF workarounds, iframeSrc same-origin workaround, memory/caching behavior
- [E7] docs/zh-cn/scopecss.md at master (accessed 2026-08-28) - default prefix-based style isolation, host-to-child leakage caveat, four disable levels, shadowDOM section commented out in 1.x
- [E8] docs/zh-cn/dom-scope.md at master (accessed 2026-08-28) - shadow-DOM-like element isolation, host access to child elements permitted, removeDomScope and async unbind caveat
- [E9] docs/zh-cn/sandbox.md + configure.md `iframe` entry (accessed 2026-08-28) - iframe sandbox as switchable mode, Vite as the trigger case, same-origin iframe src constraint
- [E10] https://github.com/jd-opensource/micro-app/tree/master/src/sandbox (with/ and iframe/ implementations; iframe/index.ts IframeSandbox class, container typed HTMLElement | ShadowRoot, patched window/document/element modules) (accessed 2026-08-28) - source confirmation of the two sandboxes and host-document rendering in iframe mode
- [E11] docs/zh-cn/router.md at master (accessed 2026-08-28) - virtual route system, five router modes, navigation APIs, guards, default-page, encode/decode, cross-app navigation
- [E12] docs/zh-cn/data.md at master (accessed 2026-08-28) - data attribute, setData/dispatch, listeners, async batched sends, callback returns, clearData/clear-data, global data channel
- [E13] docs/zh-cn/keep-alive.md and docs/zh-cn/framework/*.md at master (accessed 2026-08-28) - keep-alive lifecycle and limits, React JSX custom-event polyfill, per-framework guides, error lifecycle
- [E14] docs/zh-cn/keep-alive.md at master (accessed 2026-08-28) - appstate-change event, app-level-only retention, no scroll restore, destroy precedence
- [E15] https://github.com/jd-opensource/micro-app-chrome-plugin (accessed 2026-08-28) - devtools extension compatible with MicroApp 1.0 and 0.8
- [E16] https://qiankun.umijs.org/ (qiankun docs: registerMicroApps/activeRule, single-spa-based lifecycle exports; consulted for contrast, accessed 2026-08-28)
- [E17] https://github.com/Tencent/wujie (wujie README: iframe JS execution + shadow-DOM rendering split; consulted for contrast, accessed 2026-08-28)
