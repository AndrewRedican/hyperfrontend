# Next.js Multi-Zones (+ @vercel/microfrontends)

- Unit type: platform-capability
- Status (Aug 2026): active; Multi-Zones guide is current in Next.js 16.x docs (last updated 2026-06-01) and Vercel Microfrontends reached GA 2025-10-31 with @vercel/microfrontends 2.4.0 published 2026-07-07 [E1][E5][E8]. Inventory's provisional "active" is confirmed; no correction needed.
- Availability: available (OSS Multi-Zones pattern); the Vercel Microfrontends platform layer is available as a paid product tier [E2][E8]
- Version / release cadence: Next.js 16.3.3 docs at research time; @vercel/microfrontends 2.4.0 (npm latest, modified 2026-07-07); Vercel platform features iterate via changelog (GA 2025-10-31, previews-across-repos and routing improvements through 2026) [E1][E5][E8]
- Official links: docs https://nextjs.org/docs/app/guides/multi-zones and https://vercel.com/docs/microfrontends; repo https://github.com/vercel/microfrontends (MIT)
- Researched: 2026-08-28

## What it is

Multi-Zones splits one domain into multiple independent Next.js applications ("zones"), each owning a disjoint set of URL paths. Every zone is a normal, separately built and deployed app; a router in front (Next.js `rewrites` in a default app, any HTTP proxy, or Vercel's network) sends each request to the zone that owns its path, and each non-default zone sets `assetPrefix` so its static assets do not collide with other zones [E1]. Navigation within a zone is a normal client-side soft navigation; crossing a zone boundary is a full-document hard navigation that unloads the current app and loads the next one [E1]. @vercel/microfrontends adds a central `microfrontends.json` routing contract, a local dev proxy, a cross-zone `Link` with prefetch/prerender, flag-gated routing middleware, and test utilities; the Vercel platform adds in-network routing, deployment-skew fallbacks, preview routing, and observability routing on top [E2][E3][E4][E6].

## Composition mechanics

- Composition boundary: HTTP route (URL path). Participants are whole applications behind a shared domain; the unit of composition is the page/document, never a fragment [E1].
- Integration phase: deploy/runtime at the HTTP routing layer. A new zone can be added after other zones ship by changing routing config (`rewrites` or `microfrontends.json`) and deploying; no participating app rebuilds [E1][E4].
- Execution model: separate documents. Exactly one zone's code runs in the browser at a time; there is no shared JS realm, no shared DOM, and no same-page co-existence of two zones. Server-side, each zone is its own full SSR/SSG app [E1].

## Findings by matrix group

### Build-time coupling

- Zones build and version independently; no shared build, no shared webpack/turbopack graph. Yes [E1] framework-guarantee.
- No cross-zone dependency version constraints; each zone bundles its own framework copy. Yes [E1] framework-guarantee.
- Non-default zones must configure a unique `assetPrefix` (Next.js 15+ needs no extra asset rewrite; older versions do). Yes [E1] framework-guarantee. `withMicrofrontends` auto-generates an obfuscated prefix hash [E4] officially-supported.
- Code sharing across zones happens via ordinary npm packages or a monorepo, outside the composition mechanism. Conditional (team convention, not enforced) [E1] common-pattern.
- `microfrontends.json` is a build-time input for every project in a Vercel microfrontends group; in a polyrepo, an app that cannot find it fails its build (pull via `vercel microfrontends pull` or `VC_MICROFRONTENDS_CONFIG`). Conditional (Vercel platform users only) [E2] framework-guarantee.

### Runtime coupling

- Zero shared runtime between zones; no shared singletons, no shared React instance, no runtime contract to keep compatible. Yes [E1] framework-guarantee.
- URL paths must be globally unique across zones; two zones serving the same path is a routing conflict, and overlapping path expressions are rejected by Vercel's config [E1][E4] framework-guarantee.
- Cross-zone links must be plain `<a>` tags (or the @vercel/microfrontends `Link`); `next/link` prefetch/soft-nav breaks across zones. Yes [E1][E3] framework-guarantee.
- Flag-gated dynamic routing (route a path to a zone only when a flag is on) exists via `runMicrofrontendsMiddleware`. Conditional (Next.js only, Vercel platform) [E4] officially-supported.

### Isolation and failure containment

- Application-code isolation between zones is complete per document: a broken zone breaks only its own routes; other zones keep serving. Yes [E1] inference (follows mechanically from separate apps behind a router).
- Same-page failure containment: NA; two zones never share a page, so the question of one widget crashing another does not arise [E1].
- Security isolation between zones: No; all zones share one origin, so cookies, storage, and DOM access are common to whichever zone's scripts are running. The boundary is organizational, not browser-enforced [E1] inference (boundary: same-origin scripts, no realm/document partition between teams' code once served).
- Routing-layer misconfiguration is a shared failure domain (the default app or `microfrontends.json` owns the map). Yes [E1][E4] inference.

### Framework requirements

- Zones do not have to be Next.js: any framework can serve a zone behind the proxy, and Vercel documents routing to externally hosted apps via a rewrite project. Conditional (the routing pattern is framework-neutral; the ergonomics are Next.js-first) [E1][E4] officially-supported.
- @vercel/microfrontends tooling supports Next.js, SvelteKit, React Router, Vite, and React per its repo. Conditional (depth of support varies) [E6] officially-supported.
- Cross-zone prefetch/prerender optimization (`PrefetchCrossZoneLinks` + `Link`) is Next.js-only ("This feature is currently only supported for Next.js"). Conditional [E3] officially-supported.
- App Router compatibility: Yes; the Multi-Zones guide lives under the App Router docs, `PrefetchCrossZoneLinks` has an App Router (`layout.tsx`) integration, and Server Actions work with an explicit `serverActions.allowedOrigins` for the user-facing domain [E1][E3] officially-supported.
- Contrast: Module Federation's Next.js plugin is Pages-Router-only and its maintainers state "Support for Next.js is ending"; Multi-Zones/Vercel Microfrontends is the first-party path for App Router apps [E9] officially-supported (module-federation.io's own notice).

### Ownership topology fit

- Fits teams that own disjoint URL subtrees (marketing vs docs vs dashboard); Vercel's own adoption split exactly this way because "users don't frequently cross between" the areas. Yes [E7] officially-supported.
- Does not fit widget-level or shared-page ownership (multiple teams composing one screen). No [E1] inference (page is the smallest unit).
- Central coordination points remain: the routing map (`microfrontends.json` or the default app's `rewrites`) and, on Vercel, group settings/fallbacks. Yes [E2][E4] framework-guarantee.

### Migration requirements

- Incremental (strangler) migration is an explicitly advertised use case: route one path at a time to a new app, keep the rest on the legacy system, including externally hosted legacy apps behind a rewrite. Yes [E2][E4] officially-supported.
- Flag-controlled rollout of a path to a new zone, with Instant Rollback for routing changes, is supported on Vercel. Conditional (Next.js middleware, Vercel platform) [E4] officially-supported.
- Adopting Multi-Zones from a monolith requires carving the app along URL boundaries and deduplicating shared UI via packages; no runtime shims exist. Yes [E1][E7] inference.

### Deployment

- Independent deploy per zone, in monorepo or polyrepo; Vercel states routing behavior is identical in both layouts. Yes [E1][E2] framework-guarantee.
- Self-hostable: the core Multi-Zones pattern needs only Next.js `rewrites` or "any HTTP proxy"; no Vercel dependency. Yes [E1] framework-guarantee.
- Self-hosted routing via the default app's `rewrites` proxies cross-zone requests through that app (an extra hop); Vercel's network instead resolves `microfrontends.json` "within the same request... not a rewrite that results in a second outbound request", so the no-extra-hop property is platform-only. Conditional [E1][E4] officially-supported.
- Platform-only capabilities on Vercel: deployment-skew handling (per-environment fallback routing when a microfrontend was not built for a commit), preview/branch/deployment-URL routing across the group, cross-repo preview links, toolbar routing overrides, observability routing, Terraform-managed groups [E3][E4] officially-supported.
- Vercel pricing (GA 2025-10-31): 2 microfrontend projects included on Hobby/Pro; additional projects $250/project/month on Pro; $2 per 1M routed requests; Enterprise custom [E2][E8] officially-supported.

### Contracts and communication

- The only enforced inter-zone contract is the routing map (path ownership + asset prefixes); `microfrontends.json` has a published JSON schema and `validateRouting`/middleware test utilities. Yes [E4] officially-supported.
- No cross-zone client-side communication API exists; state crosses zones only via URL, cookies/storage, or backend. No (as a provided capability) [E1] inference (nothing in official docs offers one; docs instead recommend feature flags "for enabling or disabling features in unison across the different zones" [E1]).
- Server Actions across the shared domain require `serverActions.allowedOrigins`. Yes [E1] framework-guarantee.

### UX implications

- Cross-zone navigation is a hard navigation (full document unload/reload); same-zone navigation stays soft. This is the defining UX property, stated verbatim in the docs, which advise that "pages that are frequently visited together should live in the same zone". Yes [E1] framework-guarantee.
- Vercel mitigates with automatic prefetching and prerendering of cross-zone links (`PrefetchCrossZoneLinks` + `Link` from `@vercel/microfrontends/next/client`) "to minimize any user-visible latency"; Vercel's blog notes prerendering has "increased resource usage and limited browser support". Conditional (Next.js only; reduces but does not eliminate the hard navigation) [E3][E7] officially-supported.
- Using the prefetch feature exposes all `microfrontends.json` paths to the client. Yes [E3] officially-supported.
- Persistent client state (in-memory app state, playing media, unsent form state in shared chrome) is lost at every zone crossing. Yes [E1] inference (consequence of document unload).

### Performance causes

- Each zone ships its own framework/runtime bytes; nothing is shared or deduplicated across zones at runtime, so a zone crossing re-downloads or re-parses an entire app (mitigated by HTTP caching of shared-package assets only if URLs happen to match, which asset prefixes make unlikely). Yes [E1] inference.
- Per-zone apps are smaller than the monolith, improving build times and shrinking per-page JS ("reduce the size of each application which improves build times"). Yes [E1] officially-supported.
- Routing cost: zero extra hop on Vercel's network; one proxy hop through the routing app when self-hosted with `rewrites` (Next.js docs recommend `rewrites` "to minimize latency overhead" vs a dynamic proxy). Conditional [E1][E4] officially-supported.

### Security and trust

- All zones are same-origin: no browser-enforced boundary between teams' shipped code; a compromised zone script has full access to the shared origin's cookies/storage/DOM. No isolation between participants [E1] inference (boundary defined: same-origin script trust; contrast with iframe/document isolation strategies).
- On Vercel, Deployment Protection and Firewall are manageable per microfrontend in the group. Conditional (platform) [E3] officially-supported.
- `serverActions.allowedOrigins` is a required hardening step because one user-facing domain fronts multiple apps. Yes [E1] framework-guarantee.

### SSR and delivery

- Full per-zone SSR/SSG/ISR: each zone is a complete Next.js app, so all rendering modes work unchanged inside a zone. Yes [E1] framework-guarantee.
- No fragment-level server composition: the server never stitches output from two zones into one document. No [E1] framework-guarantee.
- On Vercel, routing decisions (app selection and deployment selection) happen in the network before the request reaches any app. Conditional (platform) [E4] officially-supported.

### Operational model

- Local development: `@vercel/microfrontends` ships a local dev proxy (`microfrontends proxy`, configurable origin) so all zones appear on one local domain; it auto-starts under Turborepo, and polyrepo setups run the proxy in whichever repo is being worked on [E2][E6] officially-supported.
- Developers build/test one microfrontend at a time; on Vercel, fallback environments route un-built group members to Preview/Production/custom-environment deployments, with `MICROFRONTENDS_MISSING_FALLBACK_ERROR` when misconfigured [E3] officially-supported.
- Group administration (add/remove projects, delete group, default route, observability routing) is CLI (`vercel microfrontends ...`) and dashboard driven; Terraform resources exist for group and membership [E3] officially-supported.
- Self-hosted operations (skew handling, preview routing, fallbacks) are entirely DIY; no official self-hosted equivalent of the platform routing layer is documented. Unknown (no official guidance found) [E1][E2].
- Vercel positions microfrontends as a last resort for velocity problems: "consider alternatives like monorepos with Turborepo, feature flags, faster compilation with Turbopack" before adopting them [E2] officially-supported.

## Editions and commercial layer

- Next.js Multi-Zones: MIT OSS feature of Next.js; fully self-hostable with any HTTP proxy; no commercial gate [E1].
- @vercel/microfrontends: MIT npm package (2.4.0); the local proxy and config schema are usable anywhere, but middleware, prefetch client-config endpoint, and deployment routing are designed around the Vercel platform [E5][E6].
- Vercel Microfrontends (platform): commercial, GA 2025-10-31; 2 projects included per team (Hobby/Pro), extra projects $250/project/month (Pro), $2/1M routed requests, Enterprise custom. Edge routing, skew fallbacks, preview routing, observability routing, toolbar, firewall integration attach to this paid layer [E2][E8].

## Family mapping (provisional)

- Primary: route-level composition / reverse-proxy route composition (each participant owns URL paths; a router fronts them). Strong overlap with the `reverse-proxy-route-composition` unit; this is that family's first-party Next.js/Vercel productization.
- Not: runtime module federation (no shared module graph), not client-side fragment composition, not server-side fragment composition (no per-page stitching).
- Secondary: incremental-migration/strangler enabler (flag-gated path routing, external-app rewrites) [E2][E4].

## Ambiguities and decomposition candidates

- "Seamless navigation" is not one property: split into (a) hard vs soft navigation at the boundary (hard, guaranteed), (b) availability of prefetch/prerender mitigation (Next.js-only, Vercel tooling), (c) prerender browser support limits, (d) loss of in-memory state at every crossing.
- "Platform independence" splits into (a) OSS routing mechanics (self-hostable, Yes) vs (b) no-extra-hop routing, skew fallbacks, preview routing, observability routing (Vercel-only).
- "Framework agnostic" splits into (a) zone internals (any framework behind the proxy), (b) @vercel/microfrontends tooling support matrix (Next.js full; SvelteKit/React Router/Vite partial), (c) flag-gated routing and prefetch (Next.js middleware/client only).
- "Isolation" splits into (a) document/failure isolation between zones (strong) vs (b) security isolation between teams' code (none; same origin).
- "Cost" splits into per-project platform fees, per-request routing fees, and the self-hosted engineering cost of replicating skew/preview handling.

## Sources

- [E1] https://nextjs.org/docs/app/guides/multi-zones (accessed 2026-08-28) - zone definition, assetPrefix, rewrites routing, hard vs soft navigation, `<a>` linking rule, Server Actions allowedOrigins, code sharing, proxy option; docs version 16.3.3, last updated 2026-06-01
- [E2] https://vercel.com/docs/microfrontends (accessed 2026-08-28) - product overview, when-to-use and alternatives guidance, monorepo/polyrepo parity, pricing and limits table
- [E3] https://vercel.com/docs/microfrontends/managing-microfrontends (accessed 2026-08-28) - hard-navigation statement, PrefetchCrossZoneLinks/Link (Next.js-only), fallback environments, group management CLI/dashboard, Terraform, observability routing
- [E4] https://vercel.com/docs/microfrontends/routing (accessed 2026-08-28) - in-network routing with no second outbound request, microfrontends.json schema and path expressions, auto-generated asset prefix, flag-gated routing middleware, deployment routing table, external app routing
- [E5] npm registry via `npm view @vercel/microfrontends` (accessed 2026-08-28) - version 2.4.0, modified 2026-07-07, repo URL
- [E6] https://github.com/vercel/microfrontends (accessed 2026-08-28) - MIT license, local proxy command and origin flags, framework support list (Next.js, SvelteKit, React Router, Vite, React)
- [E7] https://vercel.com/blog/how-vercel-adopted-microfrontends (accessed 2026-08-28) - Vercel's own vertical route-based split rationale, prefetch/prerender tradeoffs ("increased resource usage and limited browser support")
- [E8] https://vercel.com/changelog/microfrontends-now-generally-available (accessed 2026-08-28) - GA date 2025-10-31, included projects, per-project and per-request pricing
- [E9] https://module-federation.io/integrations/framework/nextjs.html (accessed 2026-08-28) - "Support for Next.js is ending", App Router "Not Supported", Pages Router only; context for Multi-Zones as the first-party App Router path
