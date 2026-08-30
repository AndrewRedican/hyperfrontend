# Import-Map Architectures

- Unit type: architectural-strategy (vendor-neutral; the mechanism is a browser platform capability, the architecture around it is convention)
- Status (Aug 2026): active. Single import maps are Baseline in every evergreen browser; multiple/dynamic import maps completed cross-browser rollout with Firefox 150 (April 2026); the ecosystem's post-webpack momentum (Native Federation v4, single-spa's ESM default, importmap-rails, esm.sh) continues to consolidate on it [E1][E3][E5][E11].
- Availability: available (core mechanism); available-immature for the newest sub-features (multiple maps in Firefox initially pref-gated; `integrity` key support uneven) [E4][E5][E6].
- Version / release cadence: not versioned as a product; tracked as HTML-spec features per browser release. Single map: Chrome 89, Firefox 108, Safari 16.4 (Baseline March 2023) [E1]. Multiple + dynamically inserted maps: Chrome 133 (Feb 2025), Safari 18.4, Firefox 150 (Apr 2026, initially behind a pref) [E3][E4][E5]. Import-map `integrity` key: Chrome 127+ and Safari 18.4 per the Shopify engineering rollout; Firefox support Unknown [E6].
- Official links: WHATWG HTML spec (import maps section) https://html.spec.whatwg.org/multipage/webappapis.html#import-maps; MDN `<script type="importmap">` https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/script/type/importmap
- Researched: 2026-08-28

Inventory correction: the inventory's "active" status and "SystemJS in polyfill twilight" framing are confirmed and can now be stated concretely: systemjs latest release is 6.15.1, published 2024-04-27, i.e. no release in 28 months as of research date, while the successor polyfill es-module-shims released 2.8.4 on 2026-07-26 [E7][E8]. One refinement: "native import maps are baseline" is true only for the single-map feature; the multiple/dynamic-map capability that microfrontend architectures actually lean on became cross-browser only in April 2026 and shipped pref-gated in Firefox, so es-module-shims (>= 2.4.0) remains the practical compatibility floor for that sub-feature [E3][E4][E5].

## What it is

The strategy composes independently built and deployed microfrontends as plain ES modules whose names are resolved in the browser: each participant is published as ESM bundles referencing shared dependencies and each other by bare specifiers ("react", "@org/checkout"), and an import map (a JSON `<script type="importmap">` block in the host document) tells the browser which URL each specifier resolves to. The import map is therefore the composition contract and the deployment lever: releasing a new microfrontend version means writing a new URL into a JSON document, not rebuilding the host. Version divergence is handled by the map's `scopes` section, which resolves the same specifier to different URLs depending on which module is doing the importing. Everything executes as ordinary modules in one shared realm and document; the browser's module map deduplicates by resolved URL, so two scopes pointing at the same file yield one module instance [E1][E2][E12][E13].

## Composition mechanics

- Composition boundary: the JS module graph. Participants meet as ESM specifiers; the boundary artifact is the import map JSON plus each participant's published ESM bundle URLs [E1][E2].
- Integration phase: deploy/runtime. Participants build independently at any time; composition happens when the host document's map is generated (server-side at response time, at deploy time by a map-writer service, or injected dynamically in engines with multiple-map support). Integration after the host ships: Yes, by serving an updated map; the host binary/bundle never changes [E9][E10].
- Execution model: shared JS realm, shared DOM, single document. Import maps only influence specifier-to-URL resolution; execution is indistinguishable from any other ESM page [E1][E2].

## Findings by matrix group

### Build-time coupling

- The host needs no participant source, artifacts, or types at its own build time; it needs only specifier names and a map at serve time. Value: Yes. [E1][E9] browser-guarantee (resolution mechanism) + common-pattern (the architecture built on it)
- Participants can be built by any tool (or none) as long as output is ESM with agreed bare specifiers left external. Value: Yes. [E9][E13] common-pattern
- Sharing dependencies requires each participant's build to externalize the shared specifier (bundler `externals`/`external` config) and all teams to agree on specifier naming. Value: Conditional (per-participant build config + naming convention). [E9][E13][E14] common-pattern
- A fully no-build workflow (author ESM, publish files, map them) is possible and is how importmap-rails and esm.sh position the mechanism; production microfrontend practice still typically bundles one artifact per participant to control waterfalls. Value: Conditional (works; production practice bundles per participant). [E11][E15] officially-supported (Rails default) + common-pattern
- No type sharing or interface checking is part of the mechanism; contracts are out of band. Value: No (built-in). [E1][E2] inference (nothing in the platform surface addresses types)
- Unlike Module Federation, there is no build-time emitted share-scope metadata and no runtime semver negotiation; whoever generates the map decides versions. Native Federation exists precisely to add that negotiation layer on top by generating the map from per-participant metadata at startup. Value: No (negotiation not native); Conditional via Native Federation. [E12][E16] framework-guarantee (NF's layer) + inference (absence in the platform)

### Runtime coupling

- All participants share one realm, one global object, one DOM: shared libraries resolved to the same URL are literally the same module instance. Value: Yes. [E1][E2] browser-guarantee
- Deduplication is by resolved URL: the browser module map loads and instantiates a given URL once per document, even when reached through different scopes. Value: Yes. [E1][E12] browser-guarantee
- Side-by-side versions of the same specifier are supported via `scopes`: the same bare name resolves to different URLs depending on the referrer's URL prefix, producing two independent module instances. Value: Yes. [E1][E12][E13][E14] browser-guarantee (resolution semantics); assigning versions per microfrontend via scope prefixes is common-pattern
- Late/dynamic mapping (adding mappings after modules have started loading, e.g. discovering a new microfrontend at runtime): supported natively where multiple import maps shipped (Chrome 133+, Safari 18.4+, Firefox 150+ pref caveat); polyfillable everywhere with es-module-shims >= 2.4.0. Value: Conditional (engine floor or shim). [E3][E4][E5][E7] browser-guarantee (in shipped engines)
- Remapping an already-resolved specifier is impossible for the life of the document: merge rules drop new mappings for resolved specifiers and earlier mappings win for already-declared keys. Hot-swapping a live module has no native path (reload, or an application-level indirection layer). Value: No. [E1][E2][E3] browser-guarantee
- Import maps only apply to the document they are declared in; workers and iframes need their own resolution story. Value: Yes (per-document). [E1][E2] browser-guarantee

### Isolation and failure containment

- Boundary definition, stated exactly: import maps isolate name resolution (which file a binding resolves to, per scope), not execution. They create bindings, not realms: no isolation of globals, prototypes, DOM, CSS, storage, or timers between participants. Value: No (no runtime isolation). [E1][E2] browser-guarantee (negative: the spec surface is resolution only)
- A participant that fails to fetch or parse surfaces as a rejected `import()` promise (dynamic) or a failed script graph (static); containment is application-level error handling. Value: Conditional (host must implement fallbacks). [E1] browser-guarantee (rejection semantics) + inference (containment burden)
- A module whose top-level evaluation throws is cached as errored in the module map; subsequent imports of the same specifier rethrow without re-executing, so one bad deploy of a shared module poisons every consumer in the document until reload. Value: Yes (document-wide blast radius). [E2] browser-guarantee
- A faulting participant can corrupt shared singletons, globals, and any DOM; nothing in the mechanism prevents it. Value: Yes (blast radius is the whole document). [E1][E2] inference (direct consequence of the shared-realm model)

### Framework requirements

- Framework-agnostic: any framework whose build emits standard ESM participates; no lifecycle contract is imposed by the mechanism itself. Value: Yes. [E1][E9] browser-guarantee (loads any ESM) + inference
- The mechanism provides loading only; mounting/unmounting and routing need a layer above it (single-spa lifecycles, custom elements, or manual bootstrapping). Value: Conditional (bring an orchestration layer). [E9] common-pattern
- Framework-specific ergonomics (Angular CLI integration, semver sharing) come from layers like Native Federation, not from the platform. Value: Conditional. [E16] framework-guarantee (of the layer)

### Ownership topology fit

- Each team builds and publishes its own static ESM artifacts on its own cadence; no shared build infrastructure is required. Value: Yes. [E9][E13] common-pattern (enabled by browser-guarantee resolution)
- The import map itself is a single, document-global, last-writer-wins resource: some owner (host team, map service, or generated manifest) must hold write authority over it, making it a central coordination point even when artifacts are fully independent. Value: Conditional (artifact independence yes; map governance is centralized). [E1][E9][E10] inference (from single-global-map semantics) + common-pattern (import-map-deployer style single-writer services)
- Per-team version divergence is expressible in one map via scopes without cross-team lockstep upgrades. Value: Yes. [E12][E13][E14] browser-guarantee (scopes) + common-pattern

### Migration requirements

- Incremental adoption inside an existing ESM page: add a map, move one dependency or one fragment behind a bare specifier at a time. Value: Yes. [E1][E15] common-pattern
- From SystemJS-based single-spa setups: the ecosystem provides an explicit off-ramp; single-spa's roadmap makes ESM (native import maps) the default over SystemJS, and import-map-overrides supports native, SystemJS, and shim map formats during transition. Value: Yes. [E9][E10] officially-supported
- From webpack Module Federation: no direct converter in the platform; Native Federation is the documented migration path that preserves the MF mental model on import maps. Value: Conditional (via NF). [E16] officially-supported (NF's guide)
- Browser floor: dropping the polyfill entirely requires abandoning pre-2023 browsers; keeping es-module-shims preserves reach at the cost of one script and shim-mode semantics. Value: Conditional. [E7][E17] officially-supported (polyfill docs)

### Deployment

- Participants deploy as static files to any host/CDN; no federation server, no runtime service is required by the mechanism. Value: Yes. [E1][E9] browser-guarantee + common-pattern
- Release and rollback of a participant = rewriting one URL in a JSON map; artifacts at immutable versioned URLs make rollback a map edit, not a redeploy. Value: Yes. [E9][E10][E13] common-pattern
- Native maps must be inline in the document: `src` on `<script type="importmap">` is explicitly disallowed, so the map must be embedded at document-serve time (server template, edge injection) rather than fetched as a separate file; external map files are a polyfill-only feature (es-module-shims). Value: Conditional (inline natively; external via shim). [E1][E7] browser-guarantee (the prohibition) + possible-extension (shim)
- Cross-origin participants require CORS on the module origin (module fetches enforce it). Value: Conditional (same-origin needs nothing). [E1] browser-guarantee
- Per-user/per-session map overrides enable canary and preview deployments without touching production artifacts (import-map-overrides pattern, localStorage-backed). Value: Conditional (tooling layer). [E10] common-pattern
- CSP interaction: because the map is an inline script block, strict CSP needs a nonce/hash for it. Value: Conditional. [E1] inference (from inline-only rule + CSP mechanics)

### Contracts and communication

- The import map is a discovery/wiring contract only; it says where a name lives, nothing about its shape or lifecycle. Value: Yes (wiring only). [E1][E2] browser-guarantee
- Inter-participant communication is unconstrained shared-realm JS: direct imports of each other's modules, custom events, shared stores. The mechanism neither provides nor limits a message contract. Value: NA (out of scope of the mechanism). [E1] inference
- Versioning the contract = versioning specifier names and map generations; no compatibility checking exists at load time (a map can silently wire an incompatible version). Value: No (no checking). [E1][E12] inference

### UX implications

- Loading is standard ESM: streaming, `modulepreload`, and browser caching per module URL all apply; no loader runtime sits between the user and the code in native mode. Value: Yes. [E1][E17] browser-guarantee
- Because dependents reference bare names rather than hashed URLs, updating one dependency's URL does not invalidate the cached files of its dependents; the map absorbs the change (the "cascading cache invalidation" fix argued by Shopify and importmap-rails). Value: Yes. [E6][E15] officially-supported (both vendors' stated rationale)
- Failure UX is whatever the application builds on rejected imports; there is no built-in placeholder/fallback. Value: No (built-in). [E1] inference

### Performance causes

- Unbundled fine-grained graphs cause sequential request waterfalls (each module discovered only after its importer parses); mitigations are `modulepreload`, flattening, or bundling per participant. Value: Yes (cause identified). [E1][E17] browser-guarantee (discovery order) + common-pattern (mitigations)
- Shared dependencies load once per resolved URL regardless of how many participants import them: real network/memory dedup without a negotiation runtime. Value: Yes. [E1][E12] browser-guarantee
- In polyfill/shim mode, es-module-shims rewrites sources (Wasm-based) only for the minority of browsers lacking the needed feature and bypasses processing entirely where native support exists. Value: Conditional (shim overhead only on old engines). [E7][E17] officially-supported (polyfill docs)
- Historically the single map was a render-blocking, must-be-first resource; multiple-map support removes the single large blocking map constraint in current engines. Value: Conditional (engine floor). [E3][E6] browser-guarantee

### Security and trust

- Whoever writes the import map decides what code every specifier resolves to for the whole document: map generation/injection is a full-compromise surface and must be treated with the same trust as serving the HTML itself. Value: Yes (map = code execution authority). [E1][E2] inference (boundary consequence, stated as such)
- The `integrity` key pins SRI hashes to module URLs inside the map, covering static and dynamic imports; shipped in Chrome (127+) and Safari 18.4 via the Shopify-driven effort; Firefox support Unknown. Value: Conditional (engine support). [E1][E6] browser-guarantee (where shipped)
- No sandboxing of participants: any mapped module has full realm and DOM authority; isolation-grade trust boundaries require a different family (iframes/workers). Value: No. [E1][E2] browser-guarantee (negative)
- Third-party transform CDNs (esm.sh style) insert the CDN as a trusted code transformer in the supply chain; esm.sh is self-hostable to bring that trust in-house. Value: Conditional (trust the CDN or self-host). [E11] officially-supported (self-hosting docs) + inference (trust consequence)

### SSR and delivery

- The mechanism is client-side document-scoped resolution; it does not address server-side rendering of participants. SSR of the host shell is unaffected; SSR of microfrontends needs a separate server-side loading story. Value: NA (out of scope) / No (not provided). [E1][E2] inference
- Server-side import-map support exists in Deno natively (deno.json) and in Node only via userland loaders; not part of this strategy's browser guarantee. Value: Conditional (runtime-specific). [E18] officially-supported (Deno) 
- esm.sh-style delivery: on-demand npm/JSR-to-ESM transformation at CDN edge, version pinned in the URL, `?external` to leave named dependencies to the page's import map (the parameter that makes a transform CDN composable with a host-owned map), `?deps` to pin transitive versions. Value: Yes (available, active). [E11] officially-supported
- Import maps must be present in the initial HTML (inline) before affected module loads; late full-map delivery is only possible where multiple-map/dynamic insertion shipped. Value: Conditional. [E1][E3] browser-guarantee

### Operational model

- Map lifecycle tooling is ecosystem, not platform: import-map-deployer (single-spa lineage) for concurrency-safe map writes on deploy, import-map-overrides for developer/QA overrides, JSPM Generator and esm.sh for map generation. Value: Conditional (assemble your own ops from OSS parts). [E9][E10][E11] common-pattern
- Observability of the composition = observing a JSON document and standard network requests; no vendor runtime to instrument or license. Value: Yes. [E1] inference
- SystemJS operational reality Aug 2026: still functions as the legacy loader for existing single-spa estates (in-browser modules with its own `systemjs-importmap` format), but with no release since April 2024 and its own docs deferring native-loader extension to es-module-shims, it is a maintenance dependency, not a forward path. Value: Yes (twilight confirmed). [E7][E8][E9] officially-supported (its own docs' deferral) + inference (release gap)

## Editions and commercial layer

None. The core mechanism is an unversioned, unlicensed browser platform capability. Adjacent OSS is MIT-family (es-module-shims, systemjs, import-map-overrides, import-map-deployer, esm.sh); esm.sh additionally runs a free public CDN with documented self-hosting. No commercial edition gates any capability discussed here [E7][E8][E10][E11].

## Family mapping (provisional)

- Primary: client-side runtime module composition (in-browser module resolution as the composition mechanism). This is the family; native import maps are its platform baseline, SystemJS its legacy loader, es-module-shims its compatibility bridge.
- Implementations/relatives that resolve into this family: Native Federation (build-time metadata + startup map generation on this mechanism, MF mental model retained) [E16]; single-spa's recommended setup (lifecycle orchestration above, this family's loading below) [E9]; importmap-rails (same mechanism used for no-build dependency management rather than MFE) [E15].
- Multi-family honesty: import maps alone are a loading/wiring mechanism, not a complete microfrontend strategy; real systems pair them with an orchestration family (lifecycle managers, custom elements, or route-level composition). Rows in the matrix should score the mechanism's guarantees separately from any orchestration layered above.

## Ambiguities and decomposition candidates

- "Supports independent deployment" splits into: (a) artifact/build independence (Yes, browser-guarantee-backed) and (b) map-write governance (centralized single-writer resource; coordination cost lives here).
- "Version isolation" splits into: (a) binding-level side-by-side versions via scopes (Yes) and (b) runtime/global/prototype isolation (No; bindings not realms). Never let a matrix cell average these.
- "Dynamic remotes" splits into: (a) adding a new specifier after page load (Conditional on multiple-map engines or shim) and (b) remapping an already-resolved specifier (No, permanent for the document's lifetime).
- "No build step" splits into: (a) mechanically possible dev/prod no-build (Yes) and (b) practiced production shape (bundle per participant to control waterfalls).
- "Baseline browser support" splits into: (a) single map (Baseline 2023) and (b) multiple/dynamic maps + integrity key (2025-2026 rollout, Firefox caveats).
- "Secure" must be decomposed into: (a) SRI pinning of module bytes (Conditional, engine support) and (b) execution sandboxing (No); the strategy is only "secure" within boundary (a).

## Sources

- [E1] https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/script/type/importmap (accessed 2026-08-28) - inline-only rule (`src` disallowed), merge semantics (earlier mapping wins, resolved specifiers dropped), scopes, `integrity` key, Baseline dates, polyfill pointer
- [E2] https://html.spec.whatwg.org/multipage/webappapis.html#import-maps (accessed 2026-08-28 via MDN/spec-derived summaries and whatwg/html PR #10528 trail) - normative resolution and module-map semantics; multiple-maps spec change
- [E3] https://developer.chrome.com/release-notes/133 (accessed 2026-08-28) - multiple import maps shipped Chrome 133, deterministic document-order merging, dynamic insertion
- [E4] https://caniuse.com/mdn-html_elements_script_type_importmap_multiple_import_maps (accessed 2026-08-28) - Chrome 133+, Safari 18.4+ support table for multiple maps
- [E5] https://bugzilla.mozilla.org/show_bug.cgi?id=1916277 and https://developer.mozilla.org/en-US/docs/Mozilla/Firefox/Releases/150 (accessed 2026-08-28) - Firefox multiple-import-maps resolved for Firefox 150 (2026-04), initial pref-gating caveat
- [E6] https://shopify.engineering/resilient-import-maps and https://shopify.engineering/shipping-support-for-module-script-integrity-in-chrome-safari (accessed 2026-08-28) - motivation and rollout of multiple maps and import-map integrity (Chrome 127+/Safari 18.4); cache-invalidation rationale
- [E7] https://www.npmjs.com/package/es-module-shims and https://github.com/guybedford/es-module-shims (accessed 2026-08-28) - latest 2.8.4 published 2026-07-26; multiple-map support since 2.4.0; native-bypass polyfill model; external-map shim feature
- [E8] https://www.npmjs.com/package/systemjs and https://github.com/systemjs/systemjs (accessed 2026-08-28) - latest 6.15.1 published 2024-04-27; docs defer native-loader extension to es-module-shims
- [E9] https://single-spa.js.org/docs/recommended-setup/ (accessed 2026-08-28) - in-browser modules + import maps as recommended loading; SystemJS as legacy/polyfill option; ESM-default roadmap
- [E10] https://github.com/single-spa/import-map-overrides (accessed 2026-08-28) - per-user override maps (native default, SystemJS/shim formats supported); npm latest 6.1.0 (2025-07-25)
- [E11] https://github.com/esm-dev/esm.sh (accessed 2026-08-28) - no-build npm/JSR-to-ESM CDN, `?deps`/`?external`/pinned-version URL params, self-hosting (HOSTING.md), active development
- [E12] https://www.angulararchitects.io/en/blog/import-maps-the-next-evolution-step-for-micro-frontends-article/ (accessed 2026-08-28) - scopes for side-by-side versions; URL-keyed dedup across scopes observed in dev tools
- [E13] https://www.mercedes-benz.io/blog/2023-01-05-you-might-not-need-module-federation-orchestrate-your-microfrontends-at-runtime-with-import-maps (accessed 2026-08-28) - practitioner architecture: externals + map orchestration in production
- [E14] https://github.com/single-spa/single-spa/discussions/829 and /discussions/890 (accessed 2026-08-28) - maintainer guidance: scopes for multi-version sharing vs bundling deps per MFE
- [E15] https://github.com/rails/importmap-rails (accessed 2026-08-28) - mainstream no-build adoption of the mechanism (Rails default), cache-stability rationale
- [E16] Sibling dossier native-federation.md (this workspace, researched 2026-08-28) - build-time metadata to startup map generation; MF-model semver negotiation layered on import maps; es-module-shims dependency
- [E17] https://guybedford.com/es-module-shims-production-import-maps (accessed 2026-08-28) - polyfill-mode economics: native bypass for supporting browsers, Wasm rewrite for the remainder
- [E18] https://docs.deno.com/runtime/fundamentals/modules/ (accessed 2026-08-28; background knowledge cross-checked against search results) - Deno's native import-map support server-side
