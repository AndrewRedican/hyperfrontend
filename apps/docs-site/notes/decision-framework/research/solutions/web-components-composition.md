# Web Components composition

- Unit type: architectural-strategy (vendor-neutral: browser-standard custom elements + shadow DOM + slots as the integration contract between independently built frontends)
- Status (Aug 2026): active. Platform capabilities are all-browser standards; the SSR piece (declarative shadow DOM) crossed Baseline Widely Available ~2026-08-20, and the registry-versioning gap is actively being closed (scoped registries shipped in 2 of 3 engines, Interop 2026 focus area) [E4][E5][E6]
- Availability: available (core contract: every evergreen browser). One load-bearing sub-capability is available-immature: scoped custom element registries (Safari 26 and Chrome/Edge 146 shipped, Firefox behind a flag, not Baseline) [E5][E6]
- Version / release cadence: NA (living standards: HTML + DOM specs; capabilities ratchet per-browser, tracked via Baseline)
- Official links: spec https://html.spec.whatwg.org/multipage/custom-elements.html, https://dom.spec.whatwg.org/ ; docs https://developer.mozilla.org/en-US/docs/Web/API/Web_components ; interop scoreboard https://custom-elements-everywhere.com/
- Representatives: micro-app (JD) builds its container on a custom element (see `micro-app-jd.md`); Entando sells a Kubernetes platform whose widget contract is custom elements (see `commercial-platform-illustrations.md`); countless in-house design-system/MFE hybrids
- Researched: 2026-08-28

## What it is

Each team compiles its frontend (any framework or none) into a bundle that registers one or more custom elements; the host composes them by emitting tags (`<team-checkout>`) in HTML or DOM, and the browser drives the lifecycle (constructor, `connectedCallback`, `disconnectedCallback`, `attributeChangedCallback`) [E1]. Shadow DOM gives each element real two-way style encapsulation and an internal DOM the host does not accidentally traverse; slots let the host project its own DOM children into the element [E12]. Everything executes in one JS realm and one document: there is no JS isolation, no separate global object, no security boundary. Declarative shadow DOM (`<template shadowrootmode>`) makes the whole contract serializable as plain HTML, so server- or edge-composed fragments render before any JS runs [E3][E4]. On its own this is a component model plus a DOM-level contract; it becomes an MFE strategy only when an organization adds the missing delivery layer (per-team bundle URLs, a loader convention such as import maps or script tags, tag-name governance, and cross-element communication rules), which is precisely the layer that products like micro-app, Entando, Piral, and OpenComponents sell or ship.

## Composition mechanics

- Composition boundary: the custom element tag. The contract surface is DOM-standard: attributes (strings), JS properties (arbitrary values), DOM events, slotted children, CSS custom properties and `::part` for theming, and public methods [E1][E12]
- Integration phase: runtime by default (a script loaded at any time can `define()` a tag and the browser upgrades already-parsed instances in place), and additionally server/edge/build time for markup via declarative shadow DOM fragments. Integration after the host ships: yes, the host emits the tag and loads the bundle URL; no host rebuild required [E1][E3]
- Execution model: shared JS realm, shared document, shared DOM tree. Shadow DOM subdivides the document into encapsulated style/DOM scopes but never into separate realms [E12]

## Findings by matrix group

### Build-time coupling
- Participants require no shared build, bundler, or toolchain: the integration contract is the DOM, and any artifact that calls `customElements.define()` participates. Yes [E1]. browser-guarantee
- No shared framework version coupling across the boundary (host and elements can run different frameworks and different versions of the same framework). Yes [E1][E7]. browser-guarantee
- Shared-dependency deduplication (e.g., one React runtime across five elements) is not provided by the standard; teams either ship duplicate runtimes or coordinate via import maps/externals. Conditional (dedup possible only with explicit cross-team convention) [E1]. common-pattern
- Machine-readable interface description exists as a community format (Custom Elements Manifest, `custom-elements.json`), consumed by IDEs and doc tools; nothing enforces it at runtime. Conditional [E14]. community-convention
- Cross-team TypeScript types for element properties/events must be distributed out of band (npm types package or CEM-generated). Yes (out-of-band). community-convention

### Runtime coupling
- A tag name can be defined exactly once per global registry; a second `define()` with the same name throws NotSupportedError, and definitions cannot be undefined or replaced. Yes (hard constraint) [E2]. browser-guarantee
- Consequence: two participants shipping different versions of the same element (a shared design-system button, or two copies of themselves) collide in one page unless names are versioned by convention (`ds-button-v2`) or scoped registries are used. Yes (collision by default) [E2][E5]. browser-guarantee + community-convention for the workaround
- Scoped custom element registries (a `CustomElementRegistry` instance attached to a shadow root, so identical tag names can map to different classes per subtree) shipped in Safari 26 (first) and Chrome/Edge 146 (default, ~March 2026); Firefox 150 has it behind a flag; it is an Interop 2026 focus area and not yet Baseline as of Aug 2026. Conditional (needs polyfill for Firefox; `extends`/customized built-ins unsupported in scoped registries) [E5][E6][E9]. browser-guarantee where shipped
- All participants share `window`, global prototypes, timers, storage, and the URL/history; any participant can mutate state under every other participant. Yes (fully shared) [E12]. browser-guarantee
- Elements load and upgrade lazily: emitting an unknown tag is legal, and a later `define()` upgrades existing instances in place, enabling deferred/independent loading. Yes [E1]. browser-guarantee

### Isolation and failure containment
- Style encapsulation via shadow DOM is real and two-way: outer selectors cannot match nodes inside a shadow tree and inner stylesheets cannot leak out. Yes [E12]. browser-guarantee
- Deliberate style channels cross the boundary by design: inherited properties (fonts, color) and CSS custom properties flow in; `::part`/`::slotted` allow targeted outer styling. Yes (theming channel, not a leak) [E12]. browser-guarantee
- JS isolation: none. Single realm, no sandbox, no memory or CPU partitioning; an infinite loop or a patched `Array.prototype` in one element affects all. No [E12]. browser-guarantee
- DOM encapsulation is soft: `mode: "open"` shadow roots are fully scriptable from outside via `.shadowRoot`; `mode: "closed"` hides the reference but is circumventable (e.g., wrapping `attachShadow` before the element's code runs) and is explicitly not a security mechanism. Conditional (convention-strength only) [E12]. browser-guarantee + inference
- Exceptions thrown inside custom element lifecycle callbacks are reported like event-handler errors rather than unwinding the caller, and a throwing constructor marks that element "failed" while sibling elements keep working: containment at callback granularity only. Conditional (does not contain async code, event handlers, or shared-state corruption) [E15]. browser-guarantee
- Vendors that market "isolated" web-component MFEs (micro-app, wujie, qiankun) achieve JS isolation by adding their own Proxy/iframe sandboxes on top; the sandbox is the vendor's, not the standard's. Yes (isolation requires an added layer) [E10]. common-pattern

### Framework requirements
- Authoring: every major framework can compile to custom elements (Lit and Stencil natively; Angular Elements; Vue `defineCustomElement`; Svelte `customElement: true`; Preact; plain classes). Yes [E7]. officially-supported (per framework)
- Consuming: custom-elements-everywhere scores the majors at or near 100%; the historic holdout, React, reached 100% with React 19 (Dec 2024: properties vs attributes handled, custom events bindable). Conditional (React >= 19; React 18 and older need wrapper components) [E7][E8]. officially-supported
- Rich data must cross as JS properties or events, because attributes are string-only; frameworks now manage this, but hand-written host code must know the property-vs-attribute distinction. Yes (contract subtlety) [E1][E7]. browser-guarantee
- Events composed across shadow boundaries require `composed: true`; default custom events stop at the shadow root. Yes [E12]. browser-guarantee
- No framework is required at all on either side; the host can be static HTML. Yes [E1]. browser-guarantee

### Ownership topology fit
- Fits many-teams-ship-widgets-into-host-owned-pages: the contract is small, standard, and framework-neutral, so producing teams and the host team need agree only on tag names, properties, and events. Yes [E1]. common-pattern
- The tag-name namespace is a page-global commons: organizations need naming governance (team prefixes, version suffixes) until scoped registries are Baseline. Yes (governance required) [E2][E5]. inference
- Poor fit as sole mechanism for peer-level "several full apps share one shell with routing/auth" topologies: routing, auth, and inter-app choreography are entirely out of scope and must be built or bought. Conditional (needs an added orchestration layer) [E1]. inference

### Migration requirements
- Strangler-style incremental adoption is natural: wrap a legacy screen or a new-stack feature as an element and drop the tag into any host, including server-rendered legacy pages. Yes [E1][E3]. common-pattern
- No host rewrite required; a host adopts the strategy per-tag. Yes. common-pattern
- Migrating an existing SPA team to produce elements costs a wrapper layer (mount/unmount bridging, property/event plumbing) but no architectural rewrite. Conditional (wrapper effort, framework-dependent). inference

### Deployment
- Independent deployment reduces to publishing a new bundle at a URL the host loads; no central deploy pipeline is implied. Yes [E1]. browser-guarantee (loading) + inference (workflow)
- The strategy defines no discovery, manifest, version-pinning, or rollback mechanism; import maps, versioned CDN URLs, or a product layer (Piral feed, OpenComponents registry, Entando bundles) supply it. Yes (gap by design). inference
- Cache/version skew between host page and element bundles must be managed by URL versioning conventions. Yes. common-pattern

### Contracts and communication
- Parent-child contract is complete and standard: attributes/properties down, composed CustomEvents up, slots for content projection, CSS custom properties and parts for theming. Yes [E1][E12]. browser-guarantee
- Sibling/cross-tree communication is undefined by the standard; common patterns are window-level events, BroadcastChannel, or a shared state module (which reintroduces runtime coupling). Conditional [E1]. common-pattern
- Contract versioning is social, not mechanical: nothing checks that host-supplied properties match what the element expects; CEM plus out-of-band types is the strongest available convention. Yes (unchecked at runtime) [E14]. community-convention

### UX implications
- Single document: one URL, one history, one focus order, one accessibility tree; no iframe seams, no nested scrollbars, natural overlay/z-index behavior. Yes [E12]. browser-guarantee
- Pre-upgrade flash (element markup present before its definition loads) is inherent to lazy loading; `:defined` CSS and declarative shadow DOM fallback content are the standard mitigations. Conditional (mitigable) [E1][E3]. common-pattern
- Cross-element visual consistency (design tokens) flows naturally via inherited custom properties. Yes [E12]. browser-guarantee

### Performance causes
- Zero mandatory runtime library and near-zero boundary-crossing cost: the "framework" is the browser. Yes [E1]. browser-guarantee
- Principal weight cause is organizational: N teams shipping N framework runtimes into one page when dependency sharing is not coordinated. Conditional (governance-dependent) [E7]. inference
- Declarative shadow DOM removes JS from the critical rendering path for server-rendered elements, with claimed Core Web Vitals benefit. Yes (mechanism); magnitude Unknown [E3][E13]. officially-supported (browser-vendor and third-party analysis)
- Shadow DOM style scoping confines selector matching per scope; magnitude of benefit Unknown. inference

### Security and trust
- No security boundary of any kind between participants: all element code runs same-origin with full page privileges, DOM access, cookie/storage access. Yes (trusted-code-only strategy) [E12]. browser-guarantee
- Shadow DOM (including closed mode) is explicitly not a security mechanism. Yes [E12]. browser-guarantee
- Runtime-loaded team bundles are a supply-chain surface identical to any third-party script; CSP and SRI apply normally but SRI conflicts with independent redeploys under a stable URL. Conditional. inference
- If untrusted or semi-trusted participants are required, this strategy must be replaced or wrapped (iframes, vendor sandboxes) for that participant. Yes. inference

### SSR and delivery
- Declarative shadow DOM (`<template shadowrootmode>`) lets servers and edges serialize a fully encapsulated component as plain HTML; Baseline Newly Available Feb 2024 (Chrome/Edge 111, Safari 16.4, Firefox 123) and crossed Baseline Widely Available ~2026-08-20. Yes [E3][E4]. browser-guarantee
- The standard defines only the serialization format; producing it (rendering an element's template server-side) requires per-stack SSR tooling (e.g., Lit SSR), whose maturity varies by framework. Conditional [E3][E13]. officially-supported (per tool)
- DSD fragments are inert HTML, so they compose with any server/edge assembly technique (SSI, ESI, streaming, fragment caching) without a JS runtime on the composing tier. Yes [E3]. inference
- Hydration of server-rendered elements is per-element and independent (each bundle upgrades its own tags), enabling progressive enhancement. Yes [E1][E3]. browser-guarantee

### Operational model
- Nothing to operate centrally: no orchestrator service, no shared runtime to version; operational burden shifts to bundle hosting/CDN, naming governance, and dependency-sharing policy. Yes. inference
- Error attribution in one shared realm requires deliberate per-team tagging (source maps, error boundaries per element); the platform does not attribute failures to owners. Conditional. inference
- Browser-capability drift is the upgrade treadmill: strategy capabilities arrive per-engine (scoped registries now, DSD 2023-2024), so architecture decisions must track Baseline status rather than a package changelog. Yes [E4][E5][E6]. inference

## Editions and commercial layer

None: the strategy is browser standards, no vendor, no license, no editions. Commercial and OSS products layer delivery/governance on top of it: Entando (commercial Kubernetes "Application Composition Platform" whose widgets are custom elements; company operating in 2026, ~26-33 employees, ~$3.6M ARR 2025, no acquisition/shutdown found [E11]), micro-app (JD OSS container element + proxy sandbox, actively released [E10]), plus Piral, OpenComponents, and many in-house systems. Those carry their own dossiers where in scope.

Inventory corrections: micro-app "active (verify)" is confirmed active (1.0.0-rc.32 published ~2026-08-24 on npm under jd-opensource) [E10]. Entando "maintenance (verify)": the company is verifiably operating (active LinkedIn, 2026 analyst profiles) but platform release cadence was not verified here; suggest "active-small (company verified; product cadence unverified)" rather than plain maintenance [E11]. This unit's own inventory row ("style isolation real, JS isolation absent; DSD enables SSR fragments") is confirmed, with the sharpening that DSD is now Widely Available and scoped registries are shipping but not Baseline.

## Family mapping (provisional)

- Primary: client-side runtime DOM composition (the neutral integration contract for it).
- Secondary: server/edge fragment composition, via declarative shadow DOM fragments as the interchange format.
- Substrate role: micro-app, wujie, Entando, and many in-house platforms are implementations or supersets of this family; design-system distribution uses the identical mechanics without being an MFE strategy at all.
- Boundary honesty: by itself it is a component model; it qualifies as an MFE strategy only when paired with independent per-team delivery plus a loader/discovery convention and governance. Multi-family by construction.

## Ambiguities and decomposition candidates

- "Isolation" must split into four matrix attributes: style encapsulation (Yes, real), JS/realm isolation (No), DOM encapsulation (Conditional, convention-strength), security boundary (No).
- "Supports multiple versions side by side" splits into: distinct tag names (Yes, always) vs same tag name (No under global registry; Conditional under scoped registries, which are not Baseline as of Aug 2026).
- "Framework interop" splits into authoring-side (Yes, all majors) vs consuming-side (Conditional by framework version, notably React >= 19).
- "SSR support" splits into serialization format (Yes, standard, Widely Available) vs server render tooling (Conditional, per-stack maturity).
- "Independent deployment" splits into bundle publishing (Yes, trivial) vs discovery/versioning/rollback (No in-strategy; requires convention or product layer).
- "Is it an MFE strategy?" splits into contract layer (Yes) vs delivery/governance layer (absent; must be built or bought): matrix rows should score the contract and the layer separately.

## Sources

- [E1] https://developer.mozilla.org/en-US/docs/Web/API/Web_components/Using_custom_elements (accessed 2026-08-28) - lifecycle callbacks, define/upgrade semantics, lazy definition, attributes vs properties
- [E2] https://developer.mozilla.org/en-US/docs/Web/API/CustomElementRegistry (accessed 2026-08-28) - single global registry, NotSupportedError on duplicate define, no undefine, scoped registry constructor
- [E3] https://web.dev/articles/declarative-shadow-dom (accessed 2026-08-28) - `shadowrootmode`, SSR without JS, hydration/fallback patterns
- [E4] https://web-platform-dx.github.io/web-features-explorer/features/declarative-shadow-dom/ (accessed 2026-08-28) - Baseline Newly Available Feb 2024 (Firefox 123 completing Chrome/Edge 111, Safari 16.4); Widely Available threshold ~2026-08-20
- [E5] https://developer.chrome.com/blog/scoped-registries (accessed 2026-08-28) - scoped custom element registries default in Chrome/Edge 146 (~March 2026), shadow-root-scoped definitions, no customized built-ins in scoped registries
- [E6] https://web-platform-dx.github.io/web-features-explorer/features/scoped-custom-element-registries/ (accessed 2026-08-28) - Safari 26 shipped first, Firefox 150 behind flag, Interop 2026 focus area, Baseline blocked as of Aug 2026
- [E7] https://custom-elements-everywhere.com/ (accessed 2026-08-28) - per-framework consuming scores; majors at/near 100%
- [E8] https://react.dev/blog/2024/12/05/react-19 (accessed 2026-08-28) - React 19 full custom element support (props-as-properties heuristic, custom event listeners), 100% score
- [E9] https://github.com/WICG/webcomponents/blob/gh-pages/proposals/Scoped-Custom-Element-Registries.md (accessed 2026-08-28) - problem statement: global registry collisions in composed pages
- [E10] https://github.com/jd-opensource/micro-app and https://www.npmjs.com/package/@micro-zoe/micro-app (accessed 2026-08-28) - representative: web-component container plus added Proxy sandbox; 1.0.0-rc.32 published ~2026-08-24
- [E11] https://tracxn.com/d/companies/entando/__oF6LC-5rn9NLYO_zg8eciFBaxnp1IvOom9mzdQvfvHQ and https://www.gartner.com/reviews/product/entando-platform (accessed 2026-08-28) - Entando operating in 2026, headcount/revenue signals, no acquisition or shutdown found
- [E12] https://developer.mozilla.org/en-US/docs/Web/API/Web_components/Using_shadow_DOM (accessed 2026-08-28) - two-way style encapsulation, inherited/custom-property flow, open vs closed roots, composed events, not a security mechanism
- [E13] https://www.debugbear.com/blog/declarative-shadow-dom (accessed 2026-08-28, article updated June 2026) - third-party analysis: DSD moves web-component SSR off the JS critical path; no longer experimental
- [E14] https://github.com/webcomponents/custom-elements-manifest (accessed 2026-08-28) - community-standard machine-readable element interface description
- [E15] https://html.spec.whatwg.org/multipage/custom-elements.html (accessed 2026-08-28) - custom element reactions: lifecycle-callback exceptions reported, failed-constructor element state
