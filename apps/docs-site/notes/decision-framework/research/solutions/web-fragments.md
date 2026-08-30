# Web Fragments

- Unit type: framework
- Status (Aug 2026): emerging; pre-1.0 beta with real sponsor-internal production use, but release cadence stalled (last npm release 0.8.2 on 2025-11-06, last repo commit 2026-03-09, docs-only) [E7][E8]
- Availability: available-immature (npm `web-fragments`, MIT, explicitly "in beta") [E1][E7]
- Version / release cadence: `web-fragments` 0.8.2 (2025-11-06); 5 releases Jun-Nov 2025, none since; companion `reframed` npm package frozen at 0.1.4 (2025-02) with the reframing code now inside `web-fragments` [E7][E8]
- Official links: docs https://web-fragments.dev, repo https://github.com/web-fragments/web-fragments (Cloudflare-sponsored, led by Igor Minar) [E1][E2]
- Researched: 2026-08-28

Inventory correction note: the inventory's "emerging" status stands, but should carry the qualifier "activity slowed in 2026": no release in ~10 months and no code commits since March 2026, against 570 total commits and active 2025 development [E7][E8].

## What it is

Web Fragments composes independently developed and deployed "fragments" (each an ordinary HTTP endpoint serving its own HTML, scripts, and assets: "component as a service") into one host SPA page. A server-side fragment gateway (lightweight middleware for Node.js and for Web Fetch API runtimes such as Cloudflare Workers or Netlify) routes all browser requests on a single origin to either the legacy app shell or the registered fragment endpoints, and can "pierce" a fragment's server-rendered HTML directly into the initial HTML stream before the shell boots [E4][E1]. In the browser, a `<web-fragment>` custom element hosts the fragment's DOM inside the shadow root of a `<web-fragment-host>`, while the fragment's JavaScript is loaded and evaluated in a dedicated hidden same-origin iframe whose DOM and JS APIs are monkey-patched ("reframing") so the code believes it is the top-level document and its DOM operations are redirected into that shadow root [E3][E6]. The result is one shared DOM document, navigation, and history with per-fragment JavaScript contexts; the project pitches this as Docker-style "containerization of web frontends" [E1].

## Composition mechanics

- Composition boundary: HTTP route + HTML fragment endpoint on the server; custom element (`<web-fragment fragment-id [src]>`) plus a per-fragment hidden iframe JS context on the client [E3][E4][E5]
- Integration phase: runtime (browser + gateway request time); fragments are registered with the gateway (`registerFragment`: fragmentId, routePatterns, endpoint, piercingClassNames, prePiercingStyles) and can be deployed and updated after the host ships; adding a new fragment requires a gateway configuration change [E4]
- Execution model: separate JS global scope per fragment (hidden same-origin iframe realm), shared DOM document, shared browser navigation and history for bound fragments, independent location/history for unbound fragments; SSR at each fragment endpoint with optional streamed piercing into the shell response [E1][E5][E6]

## Findings by matrix group

### Build-time coupling

- Host and fragments share no build tooling, bundler, or module graph; each fragment is an independently built HTTP endpoint: Yes [E1][E4]; framework-guarantee
- No shared dependency/version coordination is required between host and fragments (no Module Federation-style shared scope): Yes [E1][E6]; framework-guarantee
- Dependency reuse across fragments (shared vendor code): No today; described as roadmap ("dependency reuse", ShadowRealm adoption) in maintainer talks: [E11]; possible-extension
- Fragments can be developed and tested standalone as ordinary web apps at their own endpoint: Yes [E3][E4]; officially-supported

### Runtime coupling

- All participants are served from a single origin through the fragment gateway; the gateway "enables web fragments and the application containing them to live on a single origin": Yes (required model) [E4]; framework-guarantee
- Bound fragments share `window.location` and history with the host; navigation from either side is "reflected in both contexts": Yes [E5]; framework-guarantee
- Unbound fragments (`src` attribute) keep their own location and history independent of the app and other fragments: Yes [E5]; framework-guarantee
- The reframing monkey-patch layer sits between fragment code and the real browser APIs at runtime; fragments depend on the fidelity of this virtualization (a known bug class, e.g. `document.currentScript` mis-set): Yes [E6][E8]; framework-guarantee (with beta-fidelity caveat)

### Isolation and failure containment

CRITICAL precision: isolation is virtualized within one page. Each fragment gets a genuinely separate JavaScript global scope, because a browser iframe always gets its own realm (browser-guarantee), but the iframe is same-origin and hidden inside the same page, and the DOM the fragment touches is the host's document. This is namespace, lifecycle, and fault encapsulation, not browser-enforced cross-origin document isolation.

- Separate JS global scope, module registry, timers, and listeners per fragment: Yes; realm separation is browser-guarantee (iframe browsing context), the routing of that realm's work into the shared DOM is framework-guarantee [E1][E6]
- Destroying a fragment destroys its JS context and "frees up all the resources associated with the application... data memory... loaded code, the module registry, as well as any timers and listeners": Yes [E6]; framework-guarantee (memory-leak containment on unmount)
- Security/trust boundary against a malicious or compromised fragment: No; the backing iframe is same-origin [E6], and same-origin frames may synchronously access each other's windows and documents (browser-guarantee of the same-origin policy), so the monkey-patched "illusion" is cooperative and bypassable by code that reaches for the real globals; inference (from [E6] plus same-origin browser semantics); the docs make no security-boundary claim anywhere reviewed [E1][E2][E6][E12]
- Browser-enforced cross-origin document isolation (separate site, process, storage partition): No; single-origin is the design [E4]; framework-guarantee (of the opposite)
- Main-thread/CPU containment: No; same-origin frames in one page share the event loop, so an infinite loop or long task in any fragment janks or freezes the whole page; inference (browser agent-cluster semantics; not addressed in docs): Unknown whether docs warn about this
- CSS/style containment: Conditional (fragment DOM lives in a `shadowRoot`, giving shadow-DOM style encapsulation; page-global concerns such as viewport, focus, fonts, and top-layer UI remain shared) [E3][E5]; framework-guarantee for the shadow-root part, inference for the shared-global remainder
- Failure containment as marketed ("fate-sharing-free", one team's error cannot bring down the app): Conditional (holds for exceptions, leaked globals, and leaked memory in a fragment's own context; does not hold for main-thread starvation or deliberate host-document tampering) [E2][E10]; framework-guarantee for the first clause, inference for the limits
- Crash recovery: destroying/recreating the fragment element rebuilds a clean context: Yes [E3][E6]; framework-guarantee

### Framework requirements

- Frontend framework requirements on fragments: None; "framework, tooling, and platform agnostic"; any app exposable as an HTTP endpoint qualifies: Yes [E1]; framework-guarantee
- Host/app-shell requirements: an existing SPA of any framework can act as the shell; adoption is per-route/per-element: Yes [E1][E3]; officially-supported
- Same framework version across participants: not required: NA [E1]; framework-guarantee

### Ownership topology fit

- Independent team-per-fragment ownership with separate repos, stacks, and release trains: Yes (the stated purpose: enterprise incremental migration, "decentralization and decomposition of monolithic web frontends") [E1][E10]; officially-supported
- Central coordination point: the gateway's fragment registry (route patterns, endpoints) is shared infrastructure someone must own: Yes [E4]; inference
- Asset namespacing convention `/_fragment/<fragment-id>/` prevents cross-team asset collisions: Yes [E4]; community-convention (documented recommendation)

### Migration requirements

- Incremental adoption inside an existing monolith, one route/page/fragment at a time: Yes; this is the flagship use case, and reportedly how Cloudflare migrates its dashboard [E1][E10][E11]; officially-supported (vendor-reported for the dashboard specifics)
- Requires inserting the gateway middleware in front of the existing app (Node or Web Fetch API server): Yes [E4]; framework-guarantee
- Requires the legacy shell to add `<web-fragment>` elements (and optionally piercing styles) where fragments render: Yes [E3][E4]; framework-guarantee
- Big-bang rewrite required: No [E1][E2]; framework-guarantee

### Deployment

- Fragments deploy independently of the host and of each other ("independently deployable") [E2]: Yes; framework-guarantee
- Gateway runtimes officially provided: Node.js middleware (`web-fragments/gateway/node`) and Web request/response middleware (`web-fragments/gateway`) usable on Cloudflare Workers and Netlify: Yes [E4][E7][E1]; officially-supported
- Cloudflare lock-in: No (sponsorship, not dependency; Node and generic Web runtimes are first-class) [E1][E4][E7]; framework-guarantee
- Integration after host ships: Yes for updating existing fragments (endpoint redeploy); Conditional for adding fragments (gateway re-registration/redeploy) [E4]; inference

### Contracts and communication

- Host-fragment contract: fragment id + route patterns + endpoint URL registered at the gateway; element attributes (`fragment-id`, optional `src`) in the shell [E4][E5]: Yes; framework-guarantee
- Shared navigation/history is the primary implicit coordination channel for bound fragments: Yes [E5]; framework-guarantee
- Cross-fragment eventing: the docs navigation lists a "broadcasting events" concept, but reviewed pages did not specify its API or guarantees: Unknown [E2]; officially-supported (existence) / Unknown (semantics)
- Type-safe or versioned inter-fragment API contracts: No built-in mechanism found: Unknown (absence not conclusively verified) [E2][E3]

### UX implications

- Single coherent page: one DOM, one URL bar, shared history; no nested-scrollbar/iframe UX artifacts because visible UI never lives in the iframe: Yes [E1][E6]; framework-guarantee
- Piercing avoids blank placeholders: fragment SSR HTML is inlined "in the initial HTML stream" and later "portaled" under the element, with `prePiercingStyles` to avoid content layout shift: Yes [E3][E4]; framework-guarantee
- Layout-shift risk is acknowledged and mitigated by author-supplied piercing styles: Conditional (author responsibility) [E4]; officially-supported

### Performance causes

- Fragments can render server-side and appear before/independently of shell hydration (eager rendering/piercing): Yes [E3][E4]; framework-guarantee
- Per-fragment cost: one hidden iframe context per fragment (extra realm, duplicated framework runtimes per fragment; no dependency sharing yet): Yes [E6][E11]; inference (context cost) / possible-extension (future sharing)
- All fragment JS still competes for one main thread: Yes; inference (same-origin frame semantics)
- Gateway adds a server hop/proxy on the request path for fragment routes: Yes [E4]; inference

### Security and trust

- Suitable trust model: same-trust-domain teams within one organization (the same-origin, shared-document design assumes non-adversarial fragments): Conditional (boundary defined: all fragments can, in principle, reach the shared document and same-origin storage; nothing browser-enforced separates them) [E4][E6]; inference
- Hosting untrusted third-party code: No (no cross-origin/process boundary, no sandbox attribute mentioned in the model; single origin implies shared cookies/storage/permissions) [E4][E6]; inference
- Origin-scoped browser protections between fragments (storage partitioning, permission separation): No, by design of the single-origin gateway model [E4]; browser-guarantee (of the consequence)

### SSR and delivery

- Per-fragment SSR at each fragment's own endpoint, any server stack: Yes [E1][E4]; framework-guarantee
- Streamed composition of fragment SSR into the shell's initial response (piercing) via the gateway: Yes [E3][E4]; framework-guarantee
- Lineage: evolved from Cloudflare's 2022 "fragment piercing" Workers experiments (Bacon Darwin/Minar) [E9]; officially-supported (historical)

### Operational model

- Governance: open source, MIT, Cloudflare "sponsors the research and development"; Igor Minar-led, 3rd iteration of the idea [E1][E11]; officially-supported
- Production usage: "in beta, but is already being used in production by teams at Cloudflare" [E1] (vendor claim); talks/podcasts report the Cloudflare dashboard migrating route-by-route [E10][E11] (vendor-reported); independent non-sponsor production adopters: Unknown
- Community footprint: ~494 GitHub stars, 570 commits, 42 open issues, 25 open PRs at research time [E1]; officially-supported (observed metrics)
- Maturity risk: pre-1.0, no stable-API commitment, release cadence stalled since Nov 2025, code commits stalled since Mar 2026: Yes (risk present) [E7][E8]; inference from observed cadence
- Public advocacy through late 2025: WeAreDevelopers World Congress talk (Jul 2025), Ryan Carniato livestream (Oct 24, 2025), Señors @ Scale podcast [E10][E11]; officially-supported (events occurred); a claimed Jan 2026 talk was not independently verified: Unknown

## Editions and commercial layer

None. Single MIT open-source package; no commercial edition, hosting product, or paid tier found; Cloudflare's involvement is sponsorship plus dogfooding, and the gateway explicitly runs on non-Cloudflare runtimes [E1][E4][E7].

## Family mapping (provisional)

- Primary: client-side runtime composition with virtualized execution contexts (JS-context-per-fragment, shared document); closest technical neighbor is wujie (iframe JS context + shadow-DOM rendering split), which the inventory already notes prefigures this design.
- Secondary: edge/server-side composition (the gateway streams and pierces per-fragment SSR into one response), descending from Cloudflare's 2022 Workers fragments experiments [E9].
- Honest multi-family placement: it is deliberately both; the gateway is load-bearing, so classifying it as purely client-side would understate the server role.

## Ambiguities and decomposition candidates

- "Isolation" is not one attribute; split into: (a) JS global-namespace isolation (Yes), (b) memory/lifecycle reclamation on unmount (Yes, framework claim), (c) security/trust boundary between fragments (No), (d) main-thread/CPU containment (No), (e) style containment (Conditional: shadow root), (f) DOM containment (Conditional: cooperative virtualization, bypassable).
- "Production-proven" splits into: sponsor-internal production use (Yes, vendor claim) vs independent third-party production adoption (Unknown) vs API stability (No, pre-1.0 beta).
- "Platform-agnostic" splits into: gateway runtime support (Node + Web Fetch API runtimes) vs fragment endpoint runtime (any HTTP server) vs client framework support (any).
- "Actively maintained" splits into: sponsor commitment (stated) vs observed release cadence (stalled since 2025-11) vs repo commit activity (stalled since 2026-03).
- "Independent deployment" splits into: fragment redeploys (fully independent) vs fragment onboarding (gateway registry change required).

## Sources

- [E1] https://github.com/web-fragments/web-fragments (accessed 2026-08-28) - README: beta status, Cloudflare production claim, isolation wording ("separate JavaScript context... share the same DOM document, browser navigation and history"), Docker analogy, MIT, sponsor, stars/commits/issues
- [E2] https://web-fragments.dev/ (accessed 2026-08-28) - positioning ("radically new architecture", "truly encapsulated, independently deployable and fate-sharing-free"), docs map incl. broadcasting events
- [E3] https://web-fragments.dev/documentation/glossary/ (accessed 2026-08-28) - definitions: fragment, fragment endpoint, app shell, piercing, portaling, reframing, fate-sharing, web-fragment/web-fragment-host shadow root
- [E4] https://web-fragments.dev/documentation/gateway/ (accessed 2026-08-28) - single-origin model, routing, registerFragment options, Node + Web middleware, prePiercingStyles, `/_fragment/<id>/` convention
- [E5] https://web-fragments.dev/documentation/elements/ (accessed 2026-08-28) - fragment-id/src attributes, bound vs unbound fragments, shared location/history, shadow-root style encapsulation
- [E6] https://web-fragments.dev/documentation/reframing/ (accessed 2026-08-28) - hidden same-origin iframe, monkey-patched DOM/JS APIs, redirection into host shadow DOM, teardown frees memory/timers/listeners/module registry
- [E7] https://registry.npmjs.org/web-fragments (accessed 2026-08-28) - versions/dates (0.8.2 on 2025-11-06), exports map (`.`, `./gateway`, `./gateway/node`), dependency `htmlrewriter` (wf-htmlrewriter); `reframed` package frozen at 0.1.4
- [E8] https://api.github.com/repos/web-fragments/web-fragments (commits, releases; accessed 2026-08-28) - last commit 2026-03-09 (docs), releases through web-fragments@0.8.2; issue #124 (document.currentScript virtualization bug)
- [E9] https://blog.cloudflare.com/better-micro-frontends/ (accessed 2026-08-28) - 2022 precursor: fragment piercing on Workers, streamed server-composed fragments, authors Bacon Darwin/Minar
- [E10] https://www.wearedevelopers.com/en/videos/1587/web-fragments-incremental-micro-frontends-migration-approach-for-enterprise (accessed 2026-08-28 via search) - Jul 2025 talk: virtualization layer pitch, fate-sharing framing
- [E11] https://neciudan.dev/takeaways/webfragments-at-scale-with-natalia-venditto-igor-minar (accessed 2026-08-28 via search) - podcast: Cloudflare dashboard route-by-route migration, dependency-reuse and ShadowRealm roadmap, 3rd-iteration lineage
- [E12] https://web-fragments.dev/architecture/rationale/ (accessed 2026-08-28) - rationale page; confirms isolation wording, contains no security-boundary claim
