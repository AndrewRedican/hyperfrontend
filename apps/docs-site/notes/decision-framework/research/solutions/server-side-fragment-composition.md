# Server-side fragment composition

- Unit type: architectural-strategy
- Status (Aug 2026): active; the strategy is practiced with multiple independently maintained implementations (Podium core releases through 2026-07, OpenComponents pushed 2026-08, ILC pushed 2026-08-26) even as individual frameworks in the family die (Tailor archived, One App archived). Inventory status "active" for this family is confirmed.
- Availability: available
- Version / release cadence at research time: NA for the strategy itself. Representative implementations as of Aug 2026: @podium/layout 5.4.7 (2026-07-27) [E2]; `oc` 0.50.63 (2026-08-20) [E3]; ILC 3.0.0 (released 2025-02-06, repo pushed 2026-08-26) [E6]. SSI is evergreen infrastructure shipped in nginx and Apache [E1].
- Official links: no single owner. Primitive: nginx `ngx_http_ssi_module` [E1]. Representative implementations, listed but not privileged: https://podium-lib.io [E2], https://github.com/opencomponents/oc [E3], https://github.com/namecheap/ilc [E5], https://github.com/zalando/tailor (archived; lineage) [E4]. One App / Holocron (American Express) is named for completeness only: repo archived, last push 2024-05-03, final release v6.12.1 on 2024-04-12 [E7].
- Researched: 2026-08-28
- Inventory corrections: (1) the ILC row's "maintenance (unverified), no fresh 2025-2026 signals" is wrong; ILC shipped 3.0.0 on 2025-02-06 and the repo was pushed 2026-08-26 (not archived, 774 stars), so the row should read active (maintained) [E6]. (2) One App's archived status (May 2024) should be recorded in the graveyard residue if not already there [E7].

## What it is

Pages are assembled at the origin, at request time, from fragments that are themselves independently deployed HTTP services: each fragment endpoint returns a piece of HTML (plus references to its own CSS/JS assets), and a composition tier merges those pieces into one document before the browser sees anything. The composition tier ranges from a plain SSI-capable proxy (nginx `<!--#include virtual="..." -->` with upstreams per team) [E1][E8], through library-based layout servers that fetch fragments described by JSON manifests (Podium) [E2], to registry-driven platforms where a central service knows every fragment and template (OpenComponents server mode, ILC) [E3][E5]. The inter-participant contract is HTML over HTTP plus asset references; no shared client runtime is required by the strategy, and each fragment owns the JS that hydrates its own region. The Tailor / Project Mosaic lineage added streaming: fragment responses are flushed into the template in parallel as they arrive rather than after the slowest completes (see graveyard dossier) [E4].

## Composition mechanics

- Composition boundary: an HTTP route that returns an HTML fragment, plus a discovery contract (static proxy config, JSON manifest, or central registry) that tells the composition tier where fragments live and what assets they need [E1][E2][E3][E5].
- Integration phase: runtime, at request time on the server. Fragments can be deployed, updated, and re-versioned after the composing layout ships; the next page request picks up the new fragment output. Claim: framework-guarantee (Podium/OC/ILC) and officially-supported (SSI subrequests) [E1][E2][E3].
- Execution model: server-composed into a single document. On the server, fragments are separate processes/services with no shared memory. In the browser, everything the strategy delivers shares one document, one origin, one JS realm, and one CSS cascade; any client-side isolation (custom elements, shadow DOM) is an add-on convention, not a property of the strategy [E8].

## Findings by matrix group

### Build-time coupling

- Participants require no shared build, bundler, or toolchain; any stack that can serve an HTML fragment over HTTP participates (Podium documents non-Node podlets; OC compiles per-component in its registry; SSI is stack-blind). Value: Yes (no build coupling). Claim: framework-guarantee [E2][E3], officially-supported for SSI [E1].
- No shared client runtime is required by the base strategy; fragments can be static markup with zero JS and the page still works. Value: Yes. Claim: common-pattern (documented as the progressive-enhancement baseline) [E8].
- Isomorphic implementations reintroduce a shared client runtime for post-load navigation: ILC ships single-spa in the browser after the server-composed first load. Value: Conditional (implementation choice, not strategy requirement). Claim: framework-guarantee [E5].
- Shared-dependency deduplication across fragments is not provided; if three fragments each ship their own framework copy, the client downloads and boots all three. Asset-service add-ons (e.g. FINN.no's Eik alongside Podium) are possible extensions, not defaults. Value: No (no dedup). Claim: inference from mechanics + possible-extension [E2].

### Runtime coupling

- Server side: fragments are separate services in separate processes; a fragment crash is an HTTP error to the composer, never a shared-memory fault. Value: Yes (decoupled). Claim: framework-guarantee (mechanics) [E2][E3].
- Browser side: all delivered fragments merge into one document and one JS realm; globals, prototypes, event listeners, and the CSS cascade are shared. Value: Yes (coupled client-side). Claim: browser-guarantee (single-document mechanics) + inference.
- Collision avoidance between fragments' CSS/JS is by convention (prefixing, custom elements, scoped styles), not enforcement. Value: Yes (convention only). Claim: common-pattern [E8].

### Isolation and failure containment

- Boundary definition for this section: "containment" here means server-side fetch-failure containment during composition; it is NOT browser-side script or style isolation, which this strategy does not provide.
- A failed, empty, or timed-out fragment fetch can be replaced by predeclared fallback content while the rest of the page renders: nginx SSI `include ... stub="block"` outputs the named block on empty body or error [E1]; Podium substitutes the podlet's registered fallback by default (`throwable: false`) [E2]; Tailor had per-fragment fallbacks [E4]. Value: Yes. Claim: officially-supported [E1] / framework-guarantee [E2].
- Per-fragment timeouts are standard: Podium defaults to 1000ms per podlet fetch (configurable); Tailor had performance budgets. Value: Yes (configurable). Claim: framework-guarantee [E2][E4].
- Critical-fragment escalation (fail the whole page if a primary fragment fails) is selectable per fragment (Podium `throwable: true`; Tailor `primary` fragments). Value: Conditional (per-fragment flag). Claim: framework-guarantee [E2][E4].
- Browser-side failure containment: a fragment's runtime JS exception, global pollution, or CSS bleed affects the whole page; nothing in the strategy contains it. Value: No. Claim: inference from single-document execution model.
- Silent error masking is a configuration choice: nginx `ssi_silent_errors on` suppresses the inline error string; fallback substitution generally means users can see degraded regions with no signal. Value: Yes (degradation can be silent). Claim: officially-supported [E1] + inference.

### Framework requirements

- Fragment services may use any UI framework, any version, or none; the contract is HTML out of an HTTP endpoint. Value: Yes. Claim: framework-guarantee [E2][E3][E5].
- The composition tier has stack requirements that vary by implementation: SSI needs only an SSI-capable proxy (nginx/Apache) [E1]; Podium's first-class layout client is Node.js (other stacks must reimplement manifest caching, context headers, retries) [E2]; OC requires its registry service [E3]; ILC requires its composer + registry deployables [E5]. Value: Conditional (per implementation). Claim: officially-supported.
- Fragments needing interactivity must ship and boot their own client JS; the strategy imposes no hydration framework. Value: Yes (fragment-owned). Claim: framework-guarantee [E2].

### Ownership topology fit

- Strong fit for many-team single-organization composition where teams own vertical page regions (search, cart, recommendations) and publish them as services; this is the topology SSI-based setups and the Tailor/Mosaic program were built for. Value: Yes. Claim: common-pattern [E4][E8].
- The composition tier is a central chokepoint that needs an owner: templates, routing, registration, timeouts, and fallback policy live there. Value: Yes (central ownership required). Claim: framework-guarantee [E2][E5].
- Untrusted or third-party fragments are out of scope: fragment markup is injected into the shared origin document server-side, so a fragment author can execute arbitrary script in the page; the strategy assumes mutually trusted participants. Value: No (trusted fragments only). Claim: inference from mechanics.
- Scale evidence against heterogeneity: Zalando, the family's flagship sponsor, retired Tailor/Mosaic citing inconsistent UX and collaboration friction from divergent fragment stacks, replacing it with a unified rendering platform serving ~90% of traffic by 2021 (full story in the graveyard dossier). Value: Yes (recorded decision evidence). Claim: officially-supported (sponsor's own engineering posts) [E4].

### Migration requirements

- Existing server-rendered applications adopt incrementally: carve one page region into a fragment endpoint and include it; the rest of the page is untouched (classic strangler-fig at region granularity). Value: Yes. Claim: common-pattern [E1][E8].
- Client-only SPAs without SSR cannot participate as first-class fragments (there is no HTML to return); they degrade to client-mounted placeholders inside the composed page, losing the strategy's first-paint benefit for that region (ILC's demo roster explicitly distinguishes SSR and non-SSR apps). Value: Conditional (fragment must render HTML server-side for full benefit). Claim: framework-guarantee [E5] + inference.
- Moving between implementations inside the family is a contract rewrite (manifest formats, context headers, registry APIs differ) even though the architecture is unchanged. Value: Yes (intra-family lock-in at the contract level). Claim: inference.

### Deployment

- Fragment-level deployment independence: deploying a new fragment-service version changes the composed page on the next request with no composer rebuild or redeploy. Value: Yes. Claim: framework-guarantee [E2][E3].
- Onboarding a NEW fragment differs by discovery model: registry-based implementations add apps/pages through the registry without redeploying the composer (ILC "in a few clicks"; OC registry publish) [E3][E5]; library/config-based ones need a layout code or proxy-config change (Podium registration by manifest URI; SSI upstream blocks) [E1][E2]. Value: Conditional (registry vs static registration). Claim: framework-guarantee.
- Contract versioning where implemented is manifest-driven: Podium podlets carry a `version` field whose change triggers layout-side refresh of cached manifest and fallback. Value: Conditional (implementation). Claim: framework-guarantee [E2].

### Contracts and communication

- The inter-participant contract is HTML over HTTP plus asset references (CSS/JS URLs declared per fragment); request context (locale, device, mount origin) flows on the request as headers or query (Podium serializes `podium-*` headers; SSI passes the subrequest context). Value: Yes. Claim: framework-guarantee [E2], officially-supported [E1].
- Browser-side fragment-to-fragment communication is undefined by the strategy; implementations and teams add pub/sub buses (Podium MessageBus) or DOM events. Value: Conditional (add-on). Claim: framework-guarantee [E2] / common-pattern [E8].
- No type system exists on the wire; the HTML contract is untyped and schema validation of manifests is the implementation's affair. Value: Yes (untyped). Claim: inference.

### UX implications

- First paint carries real content: the browser receives fully composed HTML from the origin, and pages built with progressive enhancement remain functional with JS disabled. Value: Yes. Claim: common-pattern [E8].
- Streaming composition (Tailor lineage) flushes early fragments before slow ones finish; nginx SSI processes proxied includes in parallel by default (`wait` opts into sequential). Value: Yes (parallel/streamed assembly available). Claim: officially-supported [E1] / framework-guarantee [E4].
- Non-streamed page latency is bounded by the slowest fragment within its timeout; timeouts plus fallbacks convert slowness into silently degraded regions rather than slow pages. Value: Yes (tradeoff). Claim: framework-guarantee [E2] + inference.
- Post-load navigation is full page loads unless an implementation layers a client-side router on top (ILC hands off to single-spa after first load). Value: Conditional. Claim: framework-guarantee [E5].

### Performance causes

- Request-time fan-out: each page view triggers N internal HTTP fetches from composer to fragments; mitigations are parallel fetch, streaming, and caching, not elimination. Value: Yes (per-request cost). Claim: framework-guarantee [E1][E2].
- Per-fragment HTTP caching is structurally natural: each fragment is an HTTP endpoint that can emit its own cache headers and be cached independently at the composition tier or an intermediary (e.g. nginx proxy cache in the location serving an SSI subrequest). Value: Yes (cacheable per fragment). Claim: common-pattern + inference (composition of standard HTTP features).
- Default content caching is NOT universal: Podium caches manifests, not fragment content, by default; whether composed output or fragment bodies are cached is per-deployment configuration. Value: Conditional (implementation and ops). Claim: framework-guarantee [E2].
- Client-side payload duplication (each interactive fragment ships its own framework/runtime) is the strategy's recurring client cost; server assembly does nothing to dedupe it. Value: Yes. Claim: inference.
- ILC's headline "~17ms added latency" for its composer is a vendor claim not independently verified here. Value: Unknown (unverified vendor figure). Claim: framework-guarantee (as a claim) [E5].

### Security and trust

- No security boundary exists between fragments in the browser: all fragment markup and script executes in the page's single origin with full DOM access. Value: No (no inter-fragment security boundary). Claim: inference from single-document mechanics.
- The composition tier performs server-side subrequests to configured targets; include/registration sources must be restricted to trusted internal services (an attacker who controls a fragment URL or its response controls page content at the origin). Value: Yes (trust concentrated in composer config). Claim: inference.
- Centralized ingress is a security convenience: implementations that proxy browser traffic to fragments through the layout origin (Podium's mounted proxy) let auth, headers, and CSP be enforced at one place. Value: Conditional (implementation). Claim: framework-guarantee [E2].

### SSR and delivery

- SSR is intrinsic rather than a feature: the strategy IS server rendering of the composed page; there is no client-composed fallback mode to reason about. Value: Yes. Claim: framework-guarantee (definitional) [E1][E2].
- Hydration seams are fragment-owned: each fragment's declared JS hydrates its own region; the neutral strategy has no cross-fragment hydration orchestrator. Implementations add asset scheduling only (Podium `beforeInteractive` / `lazy` strategies scoped to content/fallback). Value: Conditional (scheduling yes, orchestration no). Claim: framework-guarantee [E2].
- Isomorphic handoff (server-composed first load, client-side routing thereafter) exists only in implementations that ship a client runtime (ILC over single-spa + TailorX). Value: Conditional (implementation extension). Claim: framework-guarantee [E5].
- The delivery contract composes with edge caching and CDNs like any HTML over HTTP; moving assembly itself to the CDN is the adjacent edge-side composition family (ESI), cross-referenced, not covered here. Value: NA (boundary note). Claim: inference.

### Operational model

- Required operational pieces: (1) a composition tier (SSI-capable proxy, layout service, or composer platform); (2) fragment discovery (static proxy/upstream config, manifest URIs, or a registry service); (3) per-fragment observability for latency, error rate, and fallback-serve rate, since fallbacks mask failures from users. Value: Yes (all three needed). Claim: framework-guarantee [E1][E2][E3][E5] + inference (observability need).
- Layout services in the family ship discovery/resilience batteries: manifest polling and refresh, retries (Podium: up to 4 manifest attempts), timeouts, fallback caches. Value: Conditional (implementation). Claim: framework-guarantee [E2].
- Registry-driven platforms (OC, ILC) add a stateful service to operate (the registry) in exchange for composer-redeploy-free onboarding. Value: Yes (extra stateful component). Claim: framework-guarantee [E3][E5].
- Mortality pattern: dedicated composer frameworks in this family die at a high rate (Tailor archived 2022, Ara/Hypernova dormant/archived, One App archived 2024) while the strategy survives, because its primitive (HTML over HTTP + proxy includes) is infrastructure-native and vendor-independent. Value: Yes (framework risk > strategy risk). Claim: officially-supported (archive statuses) [E4][E7] + inference (interpretation).

## Editions and commercial layer

None for the strategy. All named representatives are OSS with no commercial edition: Podium (FINN.no), OpenComponents (OpenTable), ILC (Namecheap), Tailor (Zalando, archived). Commercial hosting of composition tiers exists only as generic infrastructure (any CDN/proxy vendor), not as a productized edition of this family.

## Family mapping (provisional)

- Primary: this dossier defines the server-side fragment composition family itself.
- Member implementations: Podium (see podium.md), OpenComponents server mode (see opencomponents.md), ILC; historical: Tailor / Project Mosaic and Ara/Hypernova (see graveyard-illustrations.md); One App / Holocron named only (archived, React-locked variant of the family's platform end).
- Adjacent families: edge-side composition (same HTML-include contract executed at CDN/edge: ESI, edge workers; see edge-side-composition.md); reverse-proxy route composition (splits at page/route granularity where this family splits within a page; a proxy doing SSI does both); islands architecture (the client-visible result of independently hydrating fragments resembles islands, but islands inside one deployable are not MFE); web-components composition (a common client-side scoping convention layered on these fragments [E8]).

## Ambiguities and decomposition candidates

- "Failure isolation" must split: server-side fetch-failure containment with fallbacks (Yes) vs browser-side script/style containment (No). A single "isolation" cell would mislabel the family.
- "Caching per fragment" must split: fragments are independently HTTP-cacheable endpoints (Yes, structural) vs composition tiers cache fragment content by default (No in Podium; Conditional per implementation/ops).
- "No shared client runtime" must split: required by the strategy (none required) vs present in isomorphic implementations (ILC ships single-spa client-side).
- "Deployment independence" must split: redeploying an existing fragment without touching the composer (Yes) vs onboarding a new fragment without composer change (Conditional: registry-based yes, config/code-registration no).
- "Hydration support" must split: asset delivery/scheduling per fragment (implementation feature) vs a cross-fragment hydration orchestration runtime (absent in the neutral strategy).
- "SSR support" is definitional here and should be phrased as "server-composed delivery" in the matrix to avoid equating it with SSR features of client-composition frameworks.

## Sources

- [E1] https://nginx.org/en/docs/http/ngx_http_ssi_module.html (accessed 2026-08-28) - `include` parameters `virtual`/`file`/`stub`/`wait`/`set`; stub outputs a named block on empty body or error; proxied includes run in parallel by default; `ssi_silent_errors`
- [E2] https://podium-lib.io/docs/api/podlet and https://podium-lib.io/docs/api/layout (accessed 2026-08-28; cross-referenced through the workspace dossier solutions/podium.md, researched same day) - manifest contract (`name, version, content, fallback, css, js, proxy`), version-triggered refresh, `throwable`/fallback behavior, 1000ms default fetch timeout, 4 manifest retries, `podium-*` context headers, asset loading strategies, MessageBus, npm versions/dates
- [E3] https://github.com/opencomponents/oc (accessed 2026-08-28; cross-referenced through the workspace dossier solutions/opencomponents.md, researched same day) - registry-based delivery, server-side rendering mode via registry/`oc-client`, `oc` 0.50.63 published 2026-08-20, repo pushed 2026-08-25
- [E4] https://github.com/zalando/tailor and https://www.mosaic9.org/ plus Zalando engineering retirement posts (accessed 2026-08-28; cross-referenced through the workspace dossier solutions/graveyard-illustrations.md) - streaming parallel fragment composition, performance budgets, fallbacks; repo archived 2022-12-05; Interface Framework replacement rationale and ~90%-of-traffic figure
- [E5] https://github.com/namecheap/ilc README (accessed 2026-08-28) - "Based on single-spa and TailorX"; server-side assembly of SSR apps then client-side handoff; built-in registry for adding apps/pages/config without redeploy; "~17ms of latency" vendor claim; technology-agnostic positioning
- [E6] GitHub REST API repos/namecheap/ilc and its releases (accessed 2026-08-28) - not archived, pushed_at 2026-08-26, 774 stars, release 3.0.0 published 2025-02-06
- [E7] GitHub REST API repos/americanexpress/one-app and its releases (accessed 2026-08-28) - archived: true, last push 2024-05-03, final release v6.12.1 published 2024-04-12
- [E8] https://micro-frontends.org/ (accessed 2026-08-28) - SSI-based server-side composition with nginx upstream-per-team config; custom elements + SSI as "universal web component"; progressive enhancement with JS disabled; alternatives named (ESI, nodesi, compoxure, tailor)
