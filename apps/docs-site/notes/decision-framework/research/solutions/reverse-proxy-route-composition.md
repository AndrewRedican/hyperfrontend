# Reverse-proxy route composition

- Unit type: architectural-strategy
- Status (Aug 2026): active; the routing tier is commodity infrastructure (nginx, Envoy, cloud gateways, CDN route rules), Next.js documents Multi-Zones as a maintained guide (last updated 2026-06), and Vercel's first-party productization (@vercel/microfrontends) went GA in October 2025 and is priced and operated as a product [E1][E2][E3]
- Availability: available (any HTTP reverse proxy suffices; managed productizations available per vendor)
- Version / release cadence: NA for the strategy; representative implementations version independently (nginx stable line, Next.js 16.x guide, Vercel Microfrontends GA 2025-10) [E1][E2][E3]
- Official links: no single owner; per-implementation links under Sources
- Researched: 2026-08-28

Inventory correction: the landscape inventory's rationale says "Vercel made it first-party in 2026"; the GA announcement is dated late October 2025 (public beta earlier in 2025). Status "active" is confirmed; the productization date should read 2025-10 [E2].

Companion dossiers: the flagship first-party productization is
[nextjs-multi-zones.md](nextjs-multi-zones.md) (Multi-Zones + @vercel/microfrontends); the
edge-programmable variant where a router worker performs the same route dispatch is covered in
[cloudflare-workers-microfrontends.md](cloudflare-workers-microfrontends.md). The non-MFE
endpoint of this spectrum (one server-rendered app behind the same proxy) is in
[non-mfe-baselines.md](non-mfe-baselines.md).

## What it is

Multiple fully independent web applications, each owning a URL subtree (path prefix such as `/blog/*`, `/dashboard/*`) or a subdomain, are presented to users as one site by a routing tier that maps each incoming request to the app that owns its URL. The router can be anything that proxies HTTP: an nginx `location` block with `proxy_pass`, a cloud gateway, CDN route rules, a framework rewrite table (Next.js `rewrites`), or a programmable edge worker [E1][E3]. Nothing ever composes two apps into one page: each app serves complete documents for its routes, and crossing from one app's URL space into another's is an ordinary full-document navigation. Within one app the user gets whatever that app provides (SPA soft navigation, MPA, anything); at every ownership boundary the browser unloads the current document and loads the next app's [E1]. Consistency of look and feel is achieved by shared design-system packages and discipline, not by any composition mechanism [E5][E6].

## Composition mechanics

- Composition boundary: the URL space itself; the inter-team contract is a partition of path prefixes (or subdomains) plus whatever cookies and query parameters cross it; there is no JS module graph, lifecycle contract, or fragment format [E1][E3]
- Integration phase: deploy/runtime; the router maps requests live, so a new app joins by claiming a route prefix in proxy config, long after every other app shipped [E1][E3]
- Execution model: separate documents, never concurrent; exactly one app's JS runs in the tab at a time; on a shared domain all apps share one browser origin (cookies, storage), on subdomains they do not [E1][E4]

## Findings by matrix group

### Build-time coupling

- Apps share no build tooling, artifacts, or dependency graph; the only mandatory shared knowledge is the route partition. Value: Yes (no build coupling). [E1][E5] common-pattern
- Static-asset URL collisions on a shared domain must be prevented by convention, e.g. a unique asset prefix per app (Next.js `assetPrefix` per zone); the strategy has no mechanism, only the convention. Value: Conditional (unique asset prefixes maintained). [E1] officially-supported (Next.js case), inference generalized
- A shared design-system package reintroduces npm-level coupling, but it is optional and consumed at each app's own version and release cadence. Value: Conditional (only if adopted). [E5] common-pattern

### Runtime coupling

- Zero runtime composition coupling: apps never execute in the same document, so no shared-dependency negotiation, version skew at runtime, or global-scope collision between apps can occur. Value: Yes (no runtime coupling). [E1] inference from the execution model
- The routing tier is a shared runtime dependency and single point of failure for the whole site, and adds one proxy hop to every request (Next.js recommends `rewrites` over an in-app proxy "to minimize latency overhead"). Value: Yes (shared router on the critical path). [E1][E3] inference
- No cross-app sharing of framework bundles: each app ships its own copy; the duplication is paid across boundary navigations, never within one page. Value: Yes (per-app bundles). inference

### Isolation and failure containment

- Failure containment between apps is the strongest in the MFE field at page granularity: apps never run concurrently, so a crash, memory leak, or unhandled error in one app cannot affect another app's execution; boundary defined as: non-concurrent separate documents. Value: Yes. browser-guarantee (document navigation semantics) applied as inference
- Security/storage isolation on path-based routing is absent: all apps share one origin, so cookies, localStorage, IndexedDB, and service-worker registrations are common property; an XSS or rogue script in any app reaches every app's origin-scoped state (cookie `Path` explicitly "is not a security measure"). Value: No (single origin, single trust domain). [E4] browser-guarantee
- Subdomain routing restores origin separation (separate storage per app), at the price of explicit `Domain=parent` cookies for anything shared and cross-origin plumbing for shared APIs. Value: Conditional (subdomain topology chosen). [E4] browser-guarantee
- A service worker registered with scope `/` by one app on a shared domain can intercept every app's requests; scope discipline is another convention the strategy does not enforce. Value: Conditional (scope discipline). inference

### Framework requirements

- None: any stack that serves HTTP over a URL subtree participates, including legacy server-rendered monoliths, and each app chooses its framework independently ("Multi-Zones also allows other applications on the domain to use their own choice of framework"). Value: Yes (framework-agnostic by construction). [E1][E5] officially-supported (Vercel), common-pattern generally

### Ownership topology fit

- Fits vertical, route-aligned ownership (marketing site vs dashboard vs docs; "collections of pages unrelated to the other pages"): each team owns pages end to end, including their rendering stack and deploy pipeline. Value: Yes. [E1][E5] common-pattern
- The URL namespace must partition cleanly along team lines; two owners of one prefix is a routing conflict ("URL paths should be unique to a zone"), so this strategy cannot express two teams composing within one page at all. Value: No (no intra-page ownership). [E1] officially-supported
- Someone must own the routing tier (proxy config or managed routing config); route-table changes are the one cross-team coordination point, typically held by a platform team. Value: Yes (router owner required). [E3] inference

### Migration requirements

- The natural strangler on-ramp: place the proxy in front of the legacy app as the default route, carve one prefix at a time to new apps, and use dynamic routing for gradual cutover (Next.js documents proxy-based routing precisely "if you are using a feature flag to decide where a path should be routed such as during a migration"). Value: Yes. [E1] officially-supported (that implementation), common-pattern generally
- Prerequisite: control over the DNS/edge/proxy tier in front of the site; teams that cannot insert a routing layer cannot adopt. Value: Conditional. inference
- The legacy app's URL structure must be prefix-cleanly separable; interleaved URL spaces force rewrites or per-route (not per-prefix) rules first. Value: Conditional (separable URL space). inference

### Deployment

- Each app deploys fully independently on its own cadence and infrastructure; the only stability contract is its route prefix and any shared cookies. Value: Yes. [E1][E2] officially-supported (Vercel: "independently deployable units"), common-pattern generally
- Rollback is per-app and unentangled; the router can also shift a prefix between deployments as a coarse rollback/canary lever. Value: Yes. inference
- The Vercel productization wraps this in a managed control plane: a `microfrontends.json` route manifest read by a shell project, platform-side proxying to per-app deployments, and observability integration. Value: Yes (managed option exists). [E2] officially-supported

### Contracts and communication

- The inter-app contract is the thinnest in the field: URL partition + query parameters + (same-origin or `Domain`-scoped) cookies + server-side persisted state; there is no event bus, props, or shared memory in the strategy. Value: Yes (thin contract). [E1][E5] common-pattern
- In-memory state cannot cross a boundary: the hard navigation unloads the document, so anything not persisted (server session, cookie, storage, URL) is lost at every app switch. This is the defining property and the primary cross-app state limit. Value: No (no in-memory cross-app state). [E1] browser-guarantee
- Shared session on path-based routing is automatic (host cookies flow to every app on the origin); on subdomains it requires `Domain=example.com` cookies, which every subdomain can then read and set, plus a shared auth backend. Value: Conditional (path: automatic; subdomain: parent-domain cookie + shared auth). [E4] browser-guarantee
- Cross-app communication patterns beyond that are the classic minimal-coupling ones (the address bar, custom conventions), as practitioner guidance has recommended since the pattern was named. Value: Yes (URL as the channel). [E5] community-convention

### UX implications

- Hard navigation at every ownership boundary: "navigating from a page in one zone to a page in another zone ... will perform a hard navigation, unloading the resources of the current page and loading the resources of the new page"; scroll position, focus, in-flight UI state, and playing media are lost. Value: Yes (defining property). [E1] officially-supported + browser-guarantee
- Within one app the UX is whatever that app delivers, including full SPA soft navigation; the strategy degrades nothing inside a boundary. Value: Yes. [E1] officially-supported
- Route grouping becomes a UX design decision: "pages that are frequently visited together should live in the same zone to avoid hard navigations". Value: Yes (boundary placement is UX-critical). [E1] officially-supported
- Cross-app links must be plain anchors, not the framework's client-side link component (Next.js: use `<a>`, not `<Link>`, across zones), so link discipline is a per-team obligation. Value: Yes. [E1] officially-supported
- Design-system consistency across apps has no mechanism: nothing prevents header/nav/theme drift between apps; the mitigations are a shared component package, naming/prefix conventions, and review discipline. Value: No (discipline, not mechanism). [E5][E6] common-pattern
- Same-origin cross-document View Transitions can visually smooth boundary crossings in supporting browsers; this is an additive polish layer, not part of the strategy, and support breadth was not verified here. Value: Conditional (browser support). possible-extension, support breadth Unknown

### Performance causes

- Every boundary crossing pays a full page load: HTML round trip through the proxy plus the destination app's full framework download/parse (no cross-app bundle sharing). Value: Yes (cost concentrated at boundaries). [E1] inference
- Within a page there is never more than one framework instance, so per-page JS weight is the app's own; the strategy adds no client runtime at all. Value: Yes (zero client-side composition overhead). inference
- Each app controls its own caching, CDN, and rendering strategy per route subtree, so performance work is fully decentralized. Value: Yes. common-pattern
- The proxy hop is the only strategy-imposed latency; framework-level rewrites are recommended over an extra in-app proxy for exactly this reason. Value: Yes (one hop). [E1] officially-supported

### Security and trust

- Path-based routing makes the whole domain one trust unit: every app must be trusted with every other app's cookies and storage; "isolated" here means failure isolation only, never security isolation. Value: No (no security boundary between apps on one origin). [E4] browser-guarantee
- Subdomain routing yields real origin boundaries between apps, but parent-`Domain` cookies remain readable and settable by all subdomains, so shared-session material is still domain-wide trust. Value: Conditional (subdomains, minus shared cookies). [E4] browser-guarantee
- The routing tier is a natural policy chokepoint: one place to enforce auth, headers, CSP, WAF rules for every app. Value: Yes. [E3] common-pattern
- Framework server-action-style endpoints behind a proxied domain need explicit origin allow-listing (Next.js `serverActions.allowedOrigins` when the user-facing domain fronts multiple apps). Value: Conditional (per-framework configuration). [E1] officially-supported

### SSR and delivery

- SSR is trivially compatible: each app renders and streams its own complete documents; there is no fragment-assembly problem because nothing is ever assembled. Value: Yes. [E1] inference
- Per-subtree delivery strategy freedom: one prefix can be static, another edge-rendered, another a legacy origin, behind the same domain. Value: Yes. [E1][E3] common-pattern
- The managed productization routes at Vercel's edge to independently deployed projects and reports roughly 1 billion routing requests/day across 250+ teams (vendor-reported figures). Value: Yes (production-proven at that vendor). [E2] officially-supported (vendor self-report)

### Operational model

- Self-hosted flavor adds exactly one tier to operate (the proxy) plus its config lifecycle; managed flavors (Vercel, CDN route rules) outsource it for platform fees and lock-in. Value: Conditional (self-host vs managed). [E2][E3] common-pattern
- Observability is per-app plus router logs; correlating a user journey across a boundary requires shared correlation discipline (IDs in cookies/URLs), since no shared runtime carries context. Value: Conditional (correlation discipline). inference
- "Most common real-world MFE shape": widely asserted in practitioner literature and consistent with the pattern's near-zero adoption cost on existing infrastructure, and single-vendor scale data supports breadth, but no neutral measurement exists; treated as consensus, not measurement. Value: Yes as community consensus, Unknown as measured share. [E2][E5][E6] community-convention + inference

## Editions and commercial layer

The strategy itself has no owner and no editions: any reverse proxy implements it at no licensing cost [E3]. Commercial layers attach at the routing tier: Vercel Microfrontends is the first-party productization (GA 2025-10, per-project pricing effective immediately for new projects and 2025-11-30 for existing ones, observability integration) [E2]; details in [nextjs-multi-zones.md](nextjs-multi-zones.md). Cloudflare's router-worker approach rides standard Workers pricing; details in [cloudflare-workers-microfrontends.md](cloudflare-workers-microfrontends.md). CDN route rules on Akamai/Fastly/CloudFront implement the same shape inside existing CDN contracts (common-pattern; not individually verified here).

## Family mapping (provisional)

This unit IS the route-level composition family; representatives are any reverse proxy (nginx, Envoy, cloud gateways, CDN route rules), Next.js Multi-Zones with @vercel/microfrontends as its productization, and the Cloudflare router worker when used purely for route dispatch. Multi-family honesty: when the router is a programmable edge worker that also stitches fragments, the unit shades into edge-side composition (see cloudflare-workers-microfrontends.md); when only one app sits behind the proxy, it collapses into the server-rendered-template or plain-SPA baselines (see non-mfe-baselines.md). It composes with every other family: any single route subtree may internally use federation, islands, or iframes without the router knowing.

## Ambiguities and decomposition candidates

- "Seamless UX" is not one property here: split into within-app navigation feel (soft, app-controlled), cross-boundary navigation cost (hard, always), and boundary-transition polish (View Transitions availability, Unknown breadth).
- "Shared session" splits by topology: path-based (automatic same-origin cookies) vs subdomain-based (parent-Domain cookie + shared auth backend + subdomain-wide cookie trust).
- "Isolation" must be split before matrixing: failure/runtime isolation (strong: non-concurrent documents) vs security/storage isolation (absent on a shared origin, partial on subdomains).
- "Design consistency" splits into: shared-package version skew across apps, duplicated chrome drift, and absence of any enforcing mechanism.
- "Migration on-ramp" splits into: ability to front the legacy app with a proxy (infrastructure control) and prefix-separability of the legacy URL space.
- "Operational cost" splits into self-hosted proxy ownership vs managed routing platform fees/lock-in.
- "Most common shape" splits into community consensus (supportable) vs measured market share (Unknown).

## Sources

- [E1] https://nextjs.org/docs/app/guides/multi-zones (accessed 2026-08-28) - hard vs soft navigation, assetPrefix, any-HTTP-proxy routing, unique-path rule, `<a>` vs `<Link>`, feature-flag migration proxy, serverActions.allowedOrigins; guide lastUpdated 2026-06-01
- [E2] https://vercel.com/changelog/microfrontends-now-generally-available (accessed 2026-08-28 via search) - GA late Oct 2025, pricing dates, ~1B routing requests/day, 250+ teams, microfrontends.json shell routing
- [E3] https://nginx.org/en/docs/http/ngx_http_proxy_module.html (accessed 2026-08-28) - proxy_pass per-location URI-prefix mapping to upstreams
- [E4] https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Set-Cookie (accessed 2026-08-28) - Domain attribute subdomain scoping, host-only default, Path is not a security measure
- [E5] https://martinfowler.com/articles/micro-frontends.html (accessed 2026-08-28) - nginx URL-matched routing to independent apps, global CSS consistency problem, minimal cross-app coupling via URL/custom events
- [E6] https://micro-frontends.org/ (accessed 2026-08-28) - links-cause-page-reload framing, team prefixes convention, isolation-over-consistency stance
