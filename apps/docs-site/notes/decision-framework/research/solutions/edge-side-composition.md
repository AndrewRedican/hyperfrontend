# Edge-side composition

- Unit type: architectural-strategy
- Status (Aug 2026): active, niche; ESI remains shipped and documented on Varnish, Akamai, and Fastly (Akamai's Property Manager behavior is marked "Deprecated" in its latest rule format), while imperative edge-worker assembly is where the vendor investment now goes (Fastly Compute ESI libraries, Cloudflare fragments/VMFE) [E1][E2][E3][E5][E9][E10]
- Availability: available (ESI: self-hosted Varnish or CDN contract; edge workers: per-vendor serverless runtimes)
- Version / release cadence: NA for the strategy; the ESI language froze as a 1.0 W3C Note in 2001 and never advanced [E13]
- Official links: no single owner; per-implementation links under Sources
- Researched: 2026-08-28

Companion dossier: the flagship 2026 vendor implementation of this family is
[cloudflare-workers-microfrontends.md](cloudflare-workers-microfrontends.md). The origin-side
sibling family is server-side-fragment-composition.md; the Tailor lineage that seeded both is
chronicled in [graveyard-illustrations.md](graveyard-illustrations.md).

## What it is

Assembly of a page from independently owned fragments at the CDN/edge layer, between origin and browser, so that fragments with different cache lifetimes and different owning teams combine into one HTML response near the user. Two generations coexist. Declarative: origin responses carry ESI markup (`<esi:include src="...">` and relatives), and a proxy cache or CDN edge node interprets the tags at request time, fetching each fragment (each independently cacheable with its own TTL) and splicing the results into the stream [E1][E2][E5]. Imperative: a programmable edge function (Cloudflare Worker, Fastly Compute program, Akamai EdgeWorker) runs developer code at the PoP that fetches fragment services and stitches their streams itself, either via an ESI-interpreting library or bespoke logic [E3][E4][E9]. In both generations the browser receives one ordinary document; all composition work executes on infrastructure the CDN vendor (or a self-hosted Varnish operator) controls.

## Composition mechanics

- Composition boundary: HTML fragment addressed by URL; the inter-team contract is "an HTTP endpoint returning an HTML snippet plus cache headers", with no JS module graph, lifecycle, or manifest [E1][E2]
- Integration phase: runtime, per request (or per cache fill) at the edge; fragments deploy at any time after the page template ships, and the composed output changes as soon as caches revalidate [E1]
- Execution model: server-composed single document; fragment producers run as separate services; in the browser everything shares one document and one JS realm, so any client-side isolation or hydration is entirely DIY

## Findings by matrix group

### Build-time coupling

- Fragments and page templates share no build artifacts; the only coupling is fragment URLs embedded in templates (declarative) or in edge-function code (imperative). Value: Yes (no build coupling). [E1][E2] framework-guarantee
- Imperative edge assembly couples the composition logic to one vendor's worker runtime and APIs at build time of the edge function itself. Value: Conditional (vendor-portable only by rewrite). [E3][E9] inference

### Runtime coupling

- Composed-page latency is bounded by the slowest uncached fragment fetch; fragments are on the critical path unless cached at the edge. Value: Yes. [E1] inference
- Per-fragment caching with independent TTLs is the family's headline property: a long-lived page shell can embed a short-lived or uncacheable personalized fragment, and downstream cacheability of the composed page computes as the lowest value across fragments (Akamai's documented rule). Value: Yes. [E5][E6] officially-supported
- Fragment fetches originate at the edge PoP; if the fragment origin is far away and the fragment is uncached, the edge-to-origin haul is paid inside the user's request. Value: Yes. inference

### Isolation and failure containment

- Fragment producers are separate services on separate infrastructure; a fragment service crash cannot crash the edge or other fragments' services. Value: Yes, with boundary defined as: server-side process/host isolation only. [E1] inference
- Failure containment at composition time is implementation-dependent: the full ESI spec has `esi:try/attempt/except` and Fastly's Compute libraries implement it, but Varnish's subset has no conditional or fallback constructs (a fragment must return 200/204 or delivery fails), and Fastly VCL is similarly minimal. Value: Conditional (full-spec processors only). [E1][E2][E3] officially-supported (where present) / framework-guarantee (Varnish limits)
- In the browser all fragments share one document, one origin, one JS scope; the strategy provides zero client-side isolation. Value: No. [E1] inference

### Framework requirements

- Fragment producers are framework-agnostic by construction: anything that emits HTML over HTTP participates. Value: Yes. [E1][E2] framework-guarantee
- Client-side interactivity (hydration, script coordination, duplicate-dependency management across fragments) is entirely outside the strategy; teams hand-roll it or layer another framework on top. Value: No (nothing provided). inference

### Ownership topology fit

- Fits fragment-team-plus-page-owner topologies: teams own fragment services; someone owns page templates (declarative) or edge-function code (imperative); and, distinctively, someone must own the CDN/edge configuration, which in most organizations is a platform or infrastructure team rather than a product team. Value: Yes (three-party ownership). common-pattern
- The edge configuration owner is a deployment gatekeeper for composition changes in a way client-side families avoid. Value: Yes. inference

### Migration requirements

- Incremental adoption in front of a legacy origin is natural: put the processor in front, carve fragments out one at a time; Varnish's `<esi:remove>` + `<!--esi -->` pair even lets one markup serve both ESI-processed and unprocessed paths. Value: Yes. [E1] officially-supported
- Prerequisite: control over a CDN/proxy tier that supports the capability (a Varnish deployment, an Akamai/Fastly contract, or a worker-capable CDN); teams without that control cannot adopt at all. Value: Conditional. inference

### Deployment

- Fragments deploy independently, any time, with no coordination beyond keeping URLs and markup contracts stable. Value: Yes. [E1] framework-guarantee
- Composition logic deploys through vendor-specific channels (VCL loads, Property Manager activations, worker deploys) with vendor-specific rollout and rollback semantics. Value: Yes (vendor-coupled control plane). [E2][E5] inference
- Portability across vendors is poor in practice because ESI dialects diverged: Varnish implements three constructs (`esi:include`, `esi:remove`, `<!--esi -->`) with no variables or conditionals; Fastly VCL is a similar minimal subset with per-request directive limits; Akamai implements the full 1.0 language plus extensions; AWS CloudFront implements none. The "standard" is not portable. Value: No (portability by dialect intersection only). [E1][E2][E5][E8] framework-guarantee per vendor, inference on the aggregate

### Contracts and communication

- The inter-team contract is minimal and stable: fragment URL + HTML output + cache headers; request context flows to fragments via forwarded headers (e.g. Fastly copies original client headers onto ESI subrequests). Value: Yes (thin contract). [E2] framework-guarantee
- Parent and fragment requests cannot share state beyond the forwarded request data; there is no context bus or event system in the strategy. Value: No. [E2] framework-guarantee (Fastly-documented) generalized as inference
- Client-side inter-fragment communication: nothing provided; shared-document DIY. Value: No. inference

### UX implications

- Output is a single streamed HTML document: fast first paint, no client-side composition flicker, no loader waterfall; this remains the family's strongest UX argument. Value: Yes. [E1][E9] common-pattern
- Navigation model is MPA; the strategy has no client router, so SPA-feel requires an additional client layer or (in the Cloudflare vertical variant) View Transitions smoothing. Value: No (MPA by default). inference

### Performance causes

- Composition executes geographically near the user with cached fragments served from the PoP: the family's core latency property and the reason it exists. Value: Yes. [E1][E9] framework-guarantee
- Cloudflare's fragments architecture composes over service bindings with streaming, eliminating public-network hops between composing Workers and enabling early interactivity of finished fragments. Value: Yes (that implementation). [E9] officially-supported
- Cost sits at the edge: ESI parsing adds processing (Akamai warns against enabling it on non-ESI content), and Varnish must un-gzip and re-gzip part-wise, reducing compression efficiency. Value: Yes (measurable overhead, vendor-documented). [E1][E5] officially-supported
- Serverless edge limits bound what assembly is possible: Lambda@Edge cannot read response bodies in response events at all and caps generated responses at 40 KB (viewer) / 1 MB (origin), which is why CloudFront has no credible fragment-assembly story. Value: Yes (platform limits shape feasibility). [E8] framework-guarantee

### Security and trust

- Fragments execute nothing at the edge in the declarative model, but ESI injection is a real, vendor-acknowledged risk class: user-supplied content containing ESI tags gets interpreted by the edge with the site's authority (Akamai ships a `detect_injection` option). Value: Conditional (safe only with injection defenses), with boundary defined as: the edge processor trusts all markup in origin responses. [E7] officially-supported (option) + inference (risk generalization)
- In the browser, all fragments share one origin and one document; inter-team trust is total on the client. Value: No (no client trust boundary). inference
- Imperative edge workers run arbitrary code in the vendor's sandbox; isolation between tenants is the vendor's guarantee, not the strategy's. Value: NA (delegated to platform). inference

### SSR and delivery

- The family is server-rendering by definition: composed HTML is the delivery format; there is no CSR fallback inside the strategy. Value: Yes. [E1] framework-guarantee
- Streaming composition (flush page shell while fragments resolve) is implementation-dependent: present in Cloudflare's fragments architecture and Fastly's streaming ESI executor; classic Varnish ESI assembles from cache/fetches per include. Value: Conditional. [E3][E9] officially-supported

### Operational model

- Local development and testing are the family's weakest operational point: the composition step lives in infrastructure (Varnish, CDN PoP, worker runtime) that developer laptops do not naturally run, so dev/prod parity requires deliberate tooling (containerized Varnish, vendor-local simulators). Value: No (poor by default). common-pattern / inference
- Debugging spans origin logs, edge logs, and vendor-specific tracing; no shared observability story exists across the family. Value: No. inference
- Vendor status check (Aug 2026): Varnish ESI stable and documented through v7/trunk [E1]; Fastly VCL ESI available but acknowledged by Fastly as limited, with Compute libraries as the invested path [E2][E3][E4]; Akamai ESI functional and documented but the Property Manager behavior carries "Deprecated" status in the newest rule format [E5][E6]; CloudFront: none [E8]. Values: per-vendor as stated. officially-supported

## Why this family is the least populated (honest assessment)

The inventory calls this the least-populated family, and that is accurate. Causes, stated plainly: (1) the composition point sits inside vendor-controlled infrastructure, so no portable open-source framework could grow around it the way single-spa or Module Federation grew around the browser and the bundler; every implementation is a CDN feature or a per-vendor worker program. (2) The ESI language froze as a 2001 W3C Note that never became a standard, and the surviving dialects (Varnish's three tags, Fastly's minimal VCL subset, Akamai's full language) diverged enough that "write once" was never true [E1][E2][E5][E13]. (3) The strategy solves server delivery and caching but says nothing about client-side interactivity, which is where the last decade's microfrontend energy went. (4) Developer experience (local dev, testing, debugging at the PoP) lags every other family. The counter-signal is real but recent and single-vendor-heavy: Cloudflare's 2022 fragments architecture, Web Fragments, and the 2026 VMFE template represent the first sustained vendor investment in years [E9][E10], and Fastly has rebuilt ESI as open-source Compute libraries rather than abandoning the idea [E3][E4].

## Named examples

- ESI on Varnish: self-hosted, stable, minimal dialect (`esi:include`, `esi:remove`, `<!--esi -->`), no variables/conditionals [E1]
- ESI on Akamai: the original and fullest implementation (Akamai co-authored the spec); functional but "Deprecated" in the latest Property Manager rule format, with EdgeWorkers as the successor programmable tier [E5][E6][E13]
- ESI on Fastly: minimal VCL subset in production; fuller open-source reimplementations for Fastly Compute (`fastly/esi` streaming Rust executor with `choose`/`try`/`vars`/`foreach`; `@fastly/esi` for JS) [E2][E3][E4]
- Cloudflare fragments architecture (2022) and its descendants Web Fragments (see web-fragments.md) and Workers vertical microfrontends (see [cloudflare-workers-microfrontends.md](cloudflare-workers-microfrontends.md)) [E9][E10]
- ILC (Namecheap): adjacent named example; an origin-side isomorphic layout service (single-spa + TailorX inside) rather than a CDN-edge processor, but the closest living heir of the Tailor fragment-stitching lineage. Status correction: the inventory lists ILC as "maintenance (unverified)"; the repo shows commits as recent as 2026-08-19, so ILC is active as of Aug 2026 [E11]. Zalando Tailor itself is archived (last push 2022-07-26); see [graveyard-illustrations.md](graveyard-illustrations.md) [E12]

## Editions and commercial layer

The strategy has no product of its own; capability attaches to infrastructure contracts. Varnish Cache is free OSS (whether Varnish Enterprise adds ESI capabilities was not assessed: Unknown). Akamai ESI and EdgeWorkers are features of commercial CDN contracts. Fastly VCL ESI ships with the CDN; the Compute ESI libraries are Apache-style OSS but only run on Fastly's billed Compute platform. Cloudflare's implementations ride Workers plans (see companion dossier).

## Family mapping (provisional)

This file IS the family dossier for edge-side composition. Boundary notes: server-side fragment composition (Podium, Tailor lineage, SSI) is the same idea executed at the origin tier rather than the CDN; reverse-proxy route composition is the degenerate case that routes whole pages instead of splicing fragments; Cloudflare VMFE sits in reverse-proxy route composition executed on edge workers and is claimed by both families.

## Ambiguities and decomposition candidates

- "ESI support" must never be scored as one attribute: split into dialect completeness (include-only vs conditionals vs try/fallback), processing tier (proxy cache vs worker library), and per-vendor deprecation status
- "Failure containment" splits into: server process isolation (always Yes) vs composition-time fallback (dialect-dependent) vs client-side containment (always No)
- "Edge composition latency win" splits into: cached-fragment serving at PoP (win) vs uncached fragment origin-haul inside the request (loss); scoring one number hides the cache-hit-ratio dependence
- "Vendor neutrality of the strategy" vs "portability of any given implementation": the strategy is vendor-neutral, every real deployment is vendor-coupled

## Sources

- [E1] https://varnish-cache.org/docs/7.0/users-guide/esi.html (accessed 2026-08-28) - Varnish's three-construct subset, no variables/conditionals, 200/204 fragment requirement, gzip part-wise recompression, XML parsing caveats
- [E2] https://www.fastly.com/documentation/reference/vcl/statements/esi/ (accessed 2026-08-28) - Fastly VCL ESI mechanics, header forwarding to subrequests, directive limits, minimal subset
- [E3] https://github.com/fastly/esi (accessed 2026-08-28) - streaming Rust ESI executor for Fastly Compute with include/choose/try/vars/foreach support
- [E4] https://www.npmjs.com/package/@fastly/esi and https://github.com/fastly/compute-js-esi (accessed 2026-08-28) - JS ESI implementation for Fastly Compute with variables and conditional expressions
- [E5] https://techdocs.akamai.com/property-mgr/reference/deprecated-edge-side-includes (accessed 2026-08-28) - edgeSideIncludes behavior marked Deprecated in v2026-06-09 rule format; parsing-cost guidance; lowest-fragment downstream cacheability
- [E6] https://techdocs.akamai.com/property-mgr/docs/esi-edge-side-includes (accessed 2026-08-28) - active Akamai ESI feature documentation
- [E7] https://techdocs.akamai.com/terraform/v8.1/docs/ga-edge-side-includes (accessed 2026-08-28) - `detect_injection`, `pass_set_cookie`, `pass_client_ip` options
- [E8] https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/lambda-at-edge-function-restrictions.html and https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/lambda-generating-http-responses.html (accessed 2026-08-28) - no response-body access in response events; 40 KB / 1 MB generated-response caps; plus https://repost.aws/questions/QUS08Cjk0sRvifvzpC5kwThQ/cloudfront-esi-lambda-html-body-replace confirming CloudFront has no ESI
- [E9] https://blog.cloudflare.com/better-micro-frontends/ (published 2022-10-20, accessed 2026-08-28) - streaming SSR fragment tree over service bindings, eager per-fragment interactivity
- [E10] https://blog.cloudflare.com/vertical-microfrontends/ and https://developers.cloudflare.com/changelog/2026-01-01-microfrontends/ (accessed 2026-08-28) - 2026 vendor investment in the family
- [E11] https://github.com/namecheap/ilc + GitHub API repos/namecheap/ilc/commits (accessed 2026-08-28) - ILC description (single-spa + TailorX, SSR, registry); latest commit dated 2026-08-19
- [E12] GitHub API repos/zalando/tailor (accessed 2026-08-28) - `"archived": true`, last push 2022-07-26
- [E13] https://en.wikipedia.org/wiki/Edge_Side_Includes and http://www2.akamai.com/devnet/esi.html (accessed 2026-08-28) - ESI 1.0 submitted to W3C in 2001 as a Note (Akamai/Oracle et al.); never advanced to a standard
