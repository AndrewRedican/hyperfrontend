# Podium (FINN.no)

- Unit type: library
- Status (Aug 2026): active; core packages on the v5 line with 2026 releases (@podium/layout 5.4.7 published 2026-07-27, @podium/podlet 5.4.2 published 2026-04-27) [E4]
- Availability: available
- Version / release cadence at research time: @podium/layout 5.4.7 (2026-07-27), @podium/podlet 5.4.2 (2026-04-27); steady patch/minor cadence on core; some satellite packages stale or deprecated (@podium/hapi-podlet unsupported, @podium/podlet-server ~1 year without release) [E4][E7]
- Official links: docs https://podium-lib.io, repos https://github.com/podium-lib
- Researched: 2026-08-28

## What it is

Podium is FINN.no's Node.js library pair for origin-side server composition of pages from independently deployed HTTP services. A "podlet" is a fragment server: it serves a JSON manifest (default `/manifest.json`) describing its name, version, content route, fallback route, assets, and proxy targets, plus the HTML fragment itself. A "layout" is a composition server: it registers podlets by manifest URI, and on each incoming page request performs HTTP GETs to each podlet's content endpoint, assembles the returned HTML fragments into a full document, and aggregates the podlets' declared CSS/JS assets into the response [E1][E2]. Request-bound context (locale, device type, mount origin, etc.) is serialized into `podium-*` HTTP headers on every layout-to-podlet request and deserialized by the podlet [E3]. The layout also mounts a transparent proxy under a public pathname so browser traffic (form posts, XHR) can reach each podlet through the layout's origin [E1][E2]. Composition happens at request time on the server; nothing is shared at build time beyond the manifest contract.

## Composition mechanics

- Composition boundary: HTTP route + JSON manifest contract; participants exchange HTML fragments over HTTP, never a shared JS module graph [E1][E2]
- Integration phase: runtime (request time on the layout server); podlets can be deployed, updated, and re-versioned after the layout ships, with the layout refreshing its cached manifest when the podlet's `version` field changes [E1]
- Execution model: server-composed single document; podlet servers run in separate processes/hosts; in the browser all fragments share one document and one JS realm (any client-side isolation is whatever the fragments' own scripts do or do not do)

## Findings by matrix group

### Build-time coupling

- Layout and podlets share no build step or artifact; the only shared surface is the manifest JSON schema and `podium-*` header convention. Value: Yes (no build coupling). [E1][E2][E3] framework-guarantee
- Podlets can be written in any stack able to serve the manifest and fragment endpoints; the Node.js libraries are a convenience, not a requirement. Value: Yes. [E6] officially-supported
- Core client libraries are Node.js; a non-Node layout must reimplement the client (manifest caching, context serialization, retries). Value: Conditional (Node for first-class support; other stacks reimplement the contract). [E2][E6] inference

### Runtime coupling

- The layout must fetch podlet content over HTTP at page-request time; podlet availability and latency are on the page's critical path. Value: Yes (coupled). [E2] framework-guarantee
- Page latency is bounded by the slowest fetched podlet (subject to the default 1000ms per-podlet timeout). Value: Yes. [E2] inference
- Podlet deploys are independent of layout deploys; the layout detects a new podlet version via the manifest `version` field and refreshes cached manifest and fallback. Value: Yes (independent deploys). [E1] framework-guarantee
- Client-side inter-fragment communication is available via @podium/browser MessageBus (publish/subscribe on channel+topic, peek, bounded log of 10 events), an opt-in extra package. Value: Conditional (requires @podium/browser). [E5] officially-supported

### Isolation and failure containment

- A failed or timed-out podlet fetch is replaced by that podlet's registered fallback content by default (`throwable: false`); the rest of the page renders. Value: Yes (server-side failure containment per fragment). [E1][E2] framework-guarantee
- A podlet can be registered `throwable: true` so its failure propagates and the layout can fail the whole page (for must-have fragments). Value: Conditional (per-registration opt-in). [E2] officially-supported
- Manifest retrieval is retried (default up to 4 attempts, configurable). Value: Yes. [E2] framework-guarantee
- In the browser, fragments share one document and one global scope; Podium provides no client-side JS or CSS isolation (no sandboxing, no shadow DOM mandate). Value: No (no client isolation). [E1][E2] inference
- Server processes are isolated by construction (separate services), so a podlet crash cannot crash the layout process. Value: Yes, with boundary defined as: process/host isolation between servers only, not browser isolation. [E2] inference

### Framework requirements

- No UI framework is prescribed; podlets return HTML strings and may attach any framework's bundle as declared JS assets. Value: Yes (framework-agnostic). [E1][E6] officially-supported
- HTTP-framework connectors exist for Express (built-in style), Fastify (@podium/fastify-podlet, current); the Hapi connector is deprecated. Value: Conditional (connector health varies). [E7] observed-from-registry / community-convention

### Ownership topology fit

- Each team owns a full vertical: podlet server, its fragment, its assets, its proxy'd APIs; a platform-ish team owns the layout(s) and document template. Value: Yes (fits team-per-fragment plus page-owner topology). [E1][E2] common-pattern
- The layout is a central chokepoint: adding/removing a podlet requires a layout code change (registration by manifest URI). Value: Yes (central registration). [E2] framework-guarantee

### Migration requirements

- Existing server-rendered apps can be wrapped as podlets incrementally (serve manifest + fragment); the layout can compose legacy and new fragments on one page. Value: Yes. [E1][E6] common-pattern
- Adopting Podium requires introducing a layout server tier in front of fragment services; there is no build-time or client-only mode. Value: Yes (new tier required). [E2] inference

### Deployment

- Podlets deploy independently at any time; version bump in the manifest triggers layout-side cache refresh of manifest and fallback without redeploying the layout. Value: Yes. [E1] framework-guarantee
- Layouts deploy independently of podlets. Value: Yes. [E2] inference
- Runtime addition of a previously unknown podlet without a layout deploy is not part of the documented model (registration is code). Value: No (as documented); dynamic registration would be a custom extension. [E2] inference

### Contracts and communication

- The manifest is the versioned contract: `name, version, content, fallback, css, js, proxy`. Value: Yes. [E1] framework-guarantee
- Server-to-server context is passed as `podium-*` HTTP headers with built-in parsers: requested-by, debug, locale, device-type, mount-origin, mount-pathname, public-pathname. Value: Yes. [E3] framework-guarantee
- Custom context values can be added by registering additional parsers on the layout and deserializing on the podlet. Value: Yes. [E3] officially-supported
- Browser-side pub/sub between fragments exists only via the separate @podium/browser MessageBus. Value: Conditional (extra package, no server involvement). [E5] officially-supported

### UX implications

- The user receives one server-rendered HTML document; no client-side composition flash or loader waterfall for initial render. Value: Yes. [E2] framework-guarantee
- Fallback substitution on podlet failure means users can silently see stale/degraded fragment content. Value: Yes. [E1][E2] inference
- Client-side interactivity per fragment depends entirely on each podlet's own shipped JS; Podium adds asset loading strategies (`beforeInteractive`, `lazy`, scoped to content/fallback/all) but no hydration runtime of its own. Value: Yes (hydration is podlet-owned). [E1] framework-guarantee

### Performance causes

- Request-time fan-out: N podlet HTTP fetches per page view, mitigated by manifest caching but not content caching by default. Value: Yes (per-request fetch cost). [E2] framework-guarantee
- Default podlet fetch timeout 1000ms; proxy timeout 20000ms; both configurable. Value: Yes. [E2] framework-guarantee
- Asset aggregation is reference-passing (URLs into the document head), so JS/CSS payload discipline is per-team; no dedup/sharing of framework runtimes is provided by core. Value: No (no shared-dependency dedup in core). [E1][E2] inference

### Security and trust

- Trust model is server-side: the layout fetches from podlet URIs it was configured with; all podlets' output is injected into one document, so a podlet can run arbitrary script in the page. Value: No (no inter-fragment browser security boundary); boundary defined as: same-document, same-realm execution. [E1][E2] inference
- The transparent proxy exposes podlet-registered targets (max 4 per podlet, unique names) through the layout's origin; this widens the layout's attack surface to whatever podlets register. Value: Conditional (bounded by the 4-target limit and layout configuration). [E1][E2] inference

### SSR and delivery

- Server-side rendering is the native mode: fragments are produced server-side and composed server-side into the final document. Value: Yes. [E2] framework-guarantee
- Streaming/out-of-order flushing of fragments is not documented in the core fetch API (fetch resolves per podlet, layout assembles). Value: Unknown (not established from consulted docs). [E2] inference
- Client-side-only composition mode does not exist in core Podium. Value: No. [E2] inference

### Operational model

- Two service classes to operate: podlet servers (many, team-owned) and layout servers (few, page-owned), plus optionally an asset server (the companion Eik project from the same teams). Value: Yes. [E2][E6] common-pattern
- Manifest polling/refresh, retries, and timeouts are built into the layout client; no external orchestration infrastructure is required. Value: Yes. [E2] framework-guarantee
- Development mode on podlets provides default context values (overridable via `.defaults()`) so podlets run standalone without a layout. Value: Yes (standalone dev). [E1] officially-supported

## Editions and commercial layer

None. Open-source packages under the podium-lib GitHub org and @podium npm scope; no commercial edition, hosted service, or paid tier was found in docs or registry metadata as of 2026-08-28 [E4][E6]. (Unrelated: podium.com is a different company.)

## Family mapping (provisional)

- Primary: server-side fragment composition (origin-side, layout-server variant); Podium is the cleanest branded representative of that family, consistent with the inventory row.
- Secondary: fragment-service architecture generally (Tailor lineage); the manifest contract is a formalized fragment discovery/versioning protocol.
- Minor overlap: client-side eventing family only via the optional @podium/browser MessageBus; this does not make it a client-side composition solution.

Inventory status check: inventory lists Podium as `active`; confirmed correct as of 2026-08-28 (core releases 2026-04 and 2026-07) [E4]. No correction needed. Nuance worth recording: satellite packages (@podium/hapi-podlet, @podium/podlet-server, @podium/dev-tool) are stale or formally unsupported [E7].

## Ambiguities and decomposition candidates

- "Independent deployment" splits into: (a) podlet deploy without layout deploy (Yes), (b) new-podlet onboarding without layout code change (No), (c) layout deploy without podlet coordination (Yes). These score differently and should be separate matrix rows.
- "Failure isolation" splits into: server-side fetch-failure containment (Yes, fallback) vs browser-side script/style isolation (No). Collapsing them would mislabel Podium as "isolated".
- "Hydration support" splits into: asset delivery with loading strategies (Yes) vs a hydration/orchestration runtime (No, podlet-owned).
- "Streaming SSR" is Unknown and should stay a distinct matrix cell rather than being folded into "SSR: Yes".
- "Framework support" splits into UI-framework agnosticism (Yes) vs HTTP-framework connector health (mixed: Express/Fastify current, Hapi deprecated).

## Sources

- [E1] https://podium-lib.io/docs/api/podlet (accessed 2026-08-28) - manifest fields, version-triggered refresh, fallback, max 4 proxy targets, js/css asset strategies and scopes, dev-mode context defaults
- [E2] https://podium-lib.io/docs/api/layout (accessed 2026-08-28) - client.register by manifest URI, request-time fetch, throwable/fallback behavior, 4 manifest retries, 1000ms/20000ms timeouts, proxy mounting, asset aggregation, HttpIncoming context
- [E3] https://github.com/podium-lib/context (accessed 2026-08-28) - podium-* header serialization, seven built-in parsers, custom parser registration, podlet-side deserialization middleware
- [E4] https://registry.npmjs.org/@podium/layout and https://registry.npmjs.org/@podium/podlet (accessed 2026-08-28) - latest versions 5.4.7 (2026-07-27) and 5.4.2 (2026-04-27)
- [E5] https://github.com/podium-lib/browser (accessed 2026-08-28) - MessageBus publish/subscribe/peek/log API for client-side inter-podlet messaging
- [E6] https://podium-lib.io/ via web search (accessed 2026-08-28) - manifest-based isolation pitch; podlets buildable in any technology stack; Eik asset service from the same FINN.no teams
- [E7] npm/socket.dev registry pages via web search (accessed 2026-08-28) - @podium/hapi-podlet deprecated, @podium/podlet-server stale (~1 year), @podium/fastify-podlet current
