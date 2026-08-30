# Cloudflare Workers Microfrontends

- Unit type: platform-capability
- Status (Aug 2026): emerging; shipped as an official changelog entry 2026-01-01 with the template merged 2026-01-06 and a deep-dive blog 2026-01-30; roughly seven months of production availability at research time [E1][E2][E3]
- Availability: available (template deployable from the Cloudflare dashboard; router source in cloudflare/templates) [E1][E3]
- Version / release cadence at research time: no versioned product; capability tracks the Workers platform release train (e.g. auxiliary-Workers support for Vite-plugin frameworks landed 2026-01-20) [E5]
- Official links: changelog https://developers.cloudflare.com/changelog/2026-01-01-microfrontends/, blog https://blog.cloudflare.com/vertical-microfrontends/, template https://github.com/cloudflare/templates (microfrontend-template, PR #877)
- Researched: 2026-08-28

Companion dossier: the vendor-neutral strategy family this implements is covered in
[edge-side-composition.md](edge-side-composition.md). The horizontal (same-page) complement,
also Cloudflare-sponsored, is covered in web-fragments.md.

## What it is

Cloudflare's platform-native recipe for path-partitioned ("vertical") microfrontends: a single "router" Worker receives all traffic for the origin, matches the URL path against a configuration mapping paths to service bindings (e.g. `{"binding": "DOCS", "path": "/docs"}`), strips the matched prefix, and forwards the request over a service binding to the Worker that owns that vertical; each vertical is an independently deployed Worker running any framework with a Workers adapter (Astro, Remix, Next.js) or a static site on Workers Static Assets [E1][E2]. The router post-processes responses with HTMLRewriter: relative asset URLs, redirects, and cookie paths are rewritten to the vertical's mount path so each app can be authored as if it lived at `/` [E1][E2]. Two opt-in UX features are injected the same way: Speculation Rules prefetching of sibling verticals (`"preload": true`) and View Transitions styling of cross-vertical navigations (`"smoothTransitions": true`) [E2]. Composition is per-request at the edge; the browser sees one origin and performs ordinary document navigations between verticals.

## Composition mechanics

- Composition boundary: HTTP route (URL path prefix); participants exchange whole HTTP responses, never a shared JS module graph [E1][E2]
- Integration phase: runtime (request time at the edge); a vertical deploys, updates, and re-versions after the router ships; adding or removing a vertical requires a router config change and router redeploy [E2] (inference from the binding/path config model)
- Execution model: server-routed, server-rewritten; each vertical renders its own full document in its own Worker isolate; in the browser, verticals are separate documents visited by MPA navigation, and within one vertical's page everything shares one document and one JS realm [E1][E2]

## Findings by matrix group

### Build-time coupling

- Verticals share no build step, bundler, or artifact; each is an independently built and deployed Worker. Value: Yes (no build coupling). [E1][E2] framework-guarantee
- The router carries a static registry of binding/path pairs; onboarding a vertical is a config-plus-redeploy of the router, not a build of the verticals. Value: Yes (central registration, no shared build). [E2][E3] framework-guarantee
- No shared-dependency dedup mechanism exists across verticals; each ships its own framework runtime. Value: No (no dependency sharing). [E1][E2] inference

### Runtime coupling

- The router Worker sits on the critical path of every request to the origin. Value: Yes (single logical chokepoint). [E2] framework-guarantee
- Router-to-vertical calls travel over service bindings, Cloudflare's private Worker-to-Worker invocation that never exits to a public URL. Value: Yes. [E1][E2] framework-guarantee
- Behavior when a bound vertical errors or is unreachable (fallback content, error page, retry) is not documented in the changelog, blog, or template PR. Value: Unknown. [E1][E2][E3] inference
- Verticals deploy independently of each other and of the router (until the route map itself changes). Value: Yes. [E1] framework-guarantee

### Isolation and failure containment

- Server side, each vertical runs in its own Worker (separate isolate, separate deployment, separate limits); one vertical's crash cannot take down another vertical's handler. Value: Yes, with boundary defined as: server-side isolate/deployment isolation only. [E1][E2] framework-guarantee
- Browser side, all verticals share one origin; cookies, storage, and any injected script scope are origin-wide, so the platform adds no client isolation between teams' code. Value: No (no client isolation). [E2] inference
- Between verticals the browser performs full document navigations, so a vertical's client-side failure is naturally scoped to its own pages. Value: Conditional (containment by page boundary, not by sandbox). [E2] inference

### Framework requirements

- Any framework deployable to Workers qualifies; the launch material demonstrates mixed Astro, Remix, and Next.js verticals in one application. Value: Yes (framework-agnostic within the Workers-adapter universe). [E1] officially-supported
- Full-stack frameworks integrate via the Cloudflare Vite plugin; auxiliary Workers callable over service bindings from the entry Worker are supported for React Router and TanStack Start (requires Vite 7+). Value: Conditional (framework must have a Workers/Vite path). [E5] officially-supported
- Static sites participate as Workers Static Assets with no framework at all. Value: Yes. [E1] officially-supported

### Ownership topology fit

- Team-per-vertical (team owns a path subtree end to end: rendering, assets, APIs of its Worker). Value: Yes (natural fit). [E1][E2] common-pattern
- A platform-ish team owns the router (route map, preload/transition policy, rewriting behavior). Value: Yes (central ownership point exists). [E2] inference
- Horizontal composition (multiple teams on one page) is explicitly out of scope for this capability; Cloudflare points that use case at fragments/Web Fragments. Value: No (vertical only). [E2][E4] officially-supported

### Migration requirements

- Gradual migration is an advertised use: point one path at a new Worker while the rest of the site stays where it is, monolith included. Value: Yes. [E1] officially-supported
- Every participant, router included, must run on Cloudflare Workers; there is no mode where a vertical is hosted on another provider behind the service-binding wiring (a plain `fetch` to an external origin would be a custom router modification, losing the documented model). Value: Conditional (all-in on Workers for the documented path). [E1][E2] inference
- Apps must be authored or adapted to be mount-path-agnostic; the router's rewriting covers relative asset paths, redirects, and cookies, but absolute self-referencing URLs baked into app logic are the app's problem. Value: Conditional. [E2] inference

### Deployment

- Per-vertical deploys are independent; the "Deploy to Cloudflare" template provisions the router with pre-configured routing and bindings to already-deployed Workers. Value: Yes. [E1][E3] framework-guarantee
- Deployment target is exclusively the Cloudflare Workers platform. Value: Yes (single-vendor hosting). [E1] framework-guarantee
- Vendor lock-in, the central tradeoff, decomposes into three distinct mechanisms: (a) proprietary wiring: service bindings and HTMLRewriter are Workers-only APIs, so the router is not portable code; (b) hosting captivity: all verticals must be Workers, so leaving means re-hosting every participant, not just the router; (c) pattern portability: the architecture itself (reverse proxy + prefix strip + response rewriting) is generic and reproducible on any programmable proxy at re-implementation cost. Values: (a) Yes, (b) Yes, (c) Yes. [E1][E2] inference (mechanics are framework-guarantee; the portability judgment is inference)

### Contracts and communication

- The contract between router and vertical is plain HTTP request/response plus the mount-path convention; no manifest, lifecycle, or schema exists. Value: Yes (thin contract). [E2] framework-guarantee
- No cross-vertical state, communication, or shared-context mechanism is provided; the launch material does not address it. Value: No (nothing provided). [E2] inference
- Because all verticals share one origin, standard web substrates (cookies, localStorage, BroadcastChannel) are available for DIY cross-vertical state. Value: Conditional (DIY on shared-origin primitives). browser-guarantee + inference

### UX implications

- One origin, no cross-domain redirects or CORS seams between verticals. Value: Yes. [E2] framework-guarantee
- Navigation between verticals is MPA (full document load), smoothed by opt-in View Transitions injection and Speculation Rules prefetching; it is not SPA-style client routing. Value: Conditional (MPA with progressive smoothing; final fidelity depends on browser support for cross-document View Transitions and Speculation Rules). [E1][E2] officially-supported (injection) + browser-guarantee dependence (support matrix not stated in launch material: Unknown)
- Preloading caches sibling verticals for near-instant navigation when enabled. Value: Conditional (`"preload": true`). [E1][E2] officially-supported

### Performance causes

- The router hop is a service-binding call inside Cloudflare's network, avoiding a public re-entry round trip; Cloudflare positions this as near-zero-cost wiring. Value: Yes (low composition overhead by construction). [E1][E2] officially-supported
- HTMLRewriter operates as a streaming transform, so rewriting does not require buffering whole responses. Value: Yes. [E2] framework-guarantee
- Each vertical brings its own framework payload; nothing dedupes shared libraries across verticals, so cross-vertical navigation re-downloads common dependencies (mitigated by HTTP caching and preload). Value: Yes (duplicated payloads). inference
- Rendering happens at the edge PoP near the user (Workers execution model), which is the family's core latency property; see [edge-side-composition.md](edge-side-composition.md). Value: Yes. [E2] framework-guarantee

### Security and trust

- Service bindings are not publicly addressable, so verticals need not expose public URLs; the router is the only public surface. Value: Yes. [E2] framework-guarantee
- All teams' code shares one browser origin: any vertical can read origin cookies/storage and affect other verticals' pages it can script into; trust boundary is the organization, not the team. Value: No (no inter-team browser isolation), with boundary defined as: single shared origin. inference
- Router-injected scripts (transitions, speculation rules) execute in every vertical's pages; the router owner can modify all verticals' client behavior. Value: Yes (router is a privileged party). [E2] inference

### SSR and delivery

- Verticals are full server-rendered applications (or static asset Workers); SSR is the native mode, not an add-on. Value: Yes. [E1] framework-guarantee
- Streaming delivery through the router is preserved by HTMLRewriter's streaming design. Value: Yes. [E2] framework-guarantee
- This capability does not compose fragments within one page server-side; for that Cloudflare's lineage is the 2022 fragments architecture and Web Fragments. Value: NA (out of scope). [E2][E4] officially-supported

### Operational model

- Provisioning is dashboard-driven ("Deploy to Cloudflare" button) or wrangler-driven; the template ships with vitest integration tests using @cloudflare/vitest-pool-workers. Value: Yes (first-party operational tooling). [E1][E3] officially-supported
- Observability, limits, and billing are those of the Workers platform; there is no separate microfrontends product surface or SLA. Value: Yes (capability, not product). [E1] inference
- Maturity signal: the entire capability is a template plus platform primitives, roughly seven months old at research time; no published large-scale external case studies were found. Value: Unknown (production track record beyond Cloudflare's own materials). inference

## Editions and commercial layer

No separate edition or SKU: the template is open source (cloudflare/templates), and the capability rides on Workers plans (free and paid tiers with the platform's usage limits). Which specific limits bind a realistic multi-vertical deployment on the free tier was not assessed: Unknown. The commercial coupling is the hosting relationship itself; see the lock-in finding under Deployment.

## Family mapping (provisional)

- Primary: reverse-proxy route composition (the router is a programmable reverse proxy with prefix stripping and response rewriting); closest cross-vendor analog is Next.js Multi-Zones / @vercel/microfrontends (see nextjs-multi-zones.md)
- Secondary: edge-side composition (the proxy is an edge worker executing at PoPs; see [edge-side-composition.md](edge-side-composition.md))
- Not: client-side composition, module federation, or same-page fragment composition (Web Fragments covers Cloudflare's horizontal story; see web-fragments.md)

## Ambiguities and decomposition candidates

- "Vendor lock-in" is three separable matrix attributes: proprietary wiring APIs; hosting captivity of all participants; portability of the architectural pattern at re-implementation cost
- "Smooth transitions" splits into: router injects transition code (Yes, officially-supported) vs cross-document View Transition actually renders (browser-support-dependent, Unknown support matrix in launch material)
- "Failure behavior of a down vertical" is undocumented and must not be scored as failure containment without testing
- "Mixed frameworks" splits into: frameworks with first-class Workers adapters (Yes) vs arbitrary frameworks (Conditional on an adapter existing)

## Sources

- [E1] https://developers.cloudflare.com/changelog/2026-01-01-microfrontends/ (accessed 2026-08-28) - launch scope, router features (preload, View Transitions, rewriting of assets/redirects/cookies), service bindings, supported app types, framework examples
- [E2] https://blog.cloudflare.com/vertical-microfrontends/ (published 2026-01-30, accessed 2026-08-28) - router/binding config format, prefix stripping, HTMLRewriter asset rewriting, `smoothTransitions`/`preload` options, service-binding privacy, explicit absence of cross-MFE state mechanisms
- [E3] https://github.com/cloudflare/templates/pull/877 (merged 2026-01-06, accessed 2026-08-28) - microfrontend-template directory, VMFE naming, vitest integration tests, dashboard deploy metadata
- [E4] https://blog.cloudflare.com/better-micro-frontends/ (published 2022-10-20, accessed 2026-08-28) - Cloudflare's earlier horizontal fragments architecture (streaming SSR fragment tree over service bindings), lineage to Web Fragments
- [E5] https://developers.cloudflare.com/changelog/2026-01-20-auxiliary-workers (accessed 2026-08-28 via search summary) - auxiliary Workers via service bindings for Vite-plugin frameworks (React Router, TanStack Start), Vite 7+
