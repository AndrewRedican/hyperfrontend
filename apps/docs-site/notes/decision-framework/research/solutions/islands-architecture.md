# Islands architecture

- Unit type: architectural-strategy (vendor-neutral: server-rendered HTML page with independently hydrated interactive "islands"; representatives Astro incl. server islands, Fresh (Deno), 11ty `<is-land>`)
- Status (Aug 2026): active. Mainstream default for content-heavy sites; Astro at 7.2.1 (Aug 2026, monthly cadence), Fresh 2.0 line current (rebuilt on Vite, betas declared release candidates Sept 2025), is-land at v5.0.1 (~Mar 2026) [E4][E5][E6][E8]. Inventory's provisional "active" status confirmed; no correction needed
- Availability: available (multiple stable, independently maintained OSS implementations; the pattern itself needs no vendor)
- Version / release cadence at research time: Astro 7.2.1 (2026-08-11; majors 6.0 Feb 2026, 7.0 Jun 2026); Fresh 2.x (2.0 beta 2025-09-02, described by Deno as effective RCs; stable followed); is-land 5.0.1 [E5][E6][E8]
- Official links: pattern origin https://jasonformat.com/islands-architecture/ ; https://docs.astro.build/en/concepts/islands/ ; https://docs.astro.build/en/guides/server-islands/ ; https://fresh.deno.dev/ ; https://github.com/11ty/is-land
- Researched: 2026-08-28

## What it is

The server renders a full HTML page; regions marked as interactive ("islands") additionally ship a component bundle that hydrates each region independently, with no top-down root component and no whole-page hydration [E1][E2]. Everything outside the islands is static HTML with zero client JS by default. In the canonical implementations the page and all its islands come from one codebase, one build, and one deployment: the island boundary is a hydration and performance boundary, not an ownership or deployment boundary [E1][E9][E10]. Astro's server islands variant additionally defers the server rendering of a marked component: the cached page shell ships immediately with fallback content, and a script fetches the island's HTML from an internal endpoint of the same deployment [E3][E4]. The term was coined by Katie Sylor-Miller (2019) and defined by Jason Miller (2020), who himself distinguishes it from micro-frontends: composition is achieved with HTML inside one app, and the closer analog is progressive enhancement [E1].

Boundary-unit framing for the engine: this unit sits inside the study to mark the edge of the MFE category. It shares the "independent pieces composed into one page" surface with MFE strategies but fails the deployment-independence criterion in its common form, so its usual verdict is a redirect: users whose actual want is performance isolation (less JS, faster pages) should get islands, not an MFE architecture; users whose want is organizational decoupling should not get islands.

## Composition mechanics

- Composition boundary: an HTML placeholder region within one server-rendered document. The island is a component in the app's own module graph, marked at the call site (Astro `client:*` directives, Fresh `islands/` directory convention, an `<is-land>` custom element wrapper) [E2][E6][E8]
- Integration phase: build time (islands are compiled into the same artifact as the pages that embed them). Integration after the host ships: No in the canonical form; a new island requires rebuilding and redeploying the one app. Astro server islands defer render time, not integration: the deferred component is still part of the same build [E3]. Only the is-land loader variant can attach independently produced scripts to a served page at runtime [E8]
- Execution model: server-composed HTML; on the client, all islands share one JS realm, one document, one DOM. Hydration is per-island and parallel, but there is no sandbox and no separate realm [E1][E2]

## Findings by matrix group

### Build-time coupling
- All pages and islands compile in one shared build with one toolchain; islands are imports, not independently versioned artifacts. Yes (single build) [E2][E6]. framework-guarantee
- Multiple UI frameworks can coexist in one page, chosen per island (React, Vue, Svelte, Solid, Preact, Lit in Astro). Conditional (Astro: yes; Fresh: Preact only; is-land: any, brought by the author) [E2][E6][E8]. officially-supported
- Per-island framework choice is a build-time decision by one team in one repo; it is not framework autonomy across teams. Yes [E2][E10]. inference
- is-land decouples the loader from the site generator: any pre-built script or SSR-friendly component (Lit, Svelte, Vue, Preact examples ship with it) can be attached to the tag, including output of a different pipeline. Conditional (is-land variant only) [E8][E11]. officially-supported

### Runtime coupling
- Each island hydrates independently; no outer root must initialize before descendants, and islands boot in any order. Yes [E1][E2]. framework-guarantee
- All islands share `window`, global prototypes, storage, and the URL; nothing prevents one island from mutating state under another. Yes (fully shared realm) [E1]. browser-guarantee
- Cross-island shared state is an officially supported pattern (Astro recommends nano stores; Fresh added shared state between islands in 1.2), which deliberately reintroduces runtime coupling. Conditional (opt-in) [E2][E7]. officially-supported

### Isolation and failure containment
- Performance isolation between page regions is the pattern's core guarantee: a heavy or slow-hydrating island does not block static content or the hydration of other islands. Yes [E1][E2]. framework-guarantee
- A JS error during one island's hydration leaves that island as its server-rendered HTML while other islands proceed; containment holds at hydration granularity only, not for shared-state corruption or a blocked main thread after boot. Conditional [E1]. common-pattern + inference
- JS or security isolation between islands: none; same realm, same document, no resource partitioning. No [E1]. browser-guarantee
- Astro server islands isolate slow dynamic backend rendering from page delivery: the cached shell ships, the slow region streams in later. Yes (latency isolation for server work) [E3]. framework-guarantee

### Framework requirements
- The static majority of the page requires no framework runtime at all; zero client JS is the default. Yes [E1][E2][E6]. framework-guarantee
- An implementation must be adopted whole (Astro, Fresh) except for is-land, which is a single ~20KB-source custom element addable to any server-rendered page. Conditional [E8]. officially-supported
- Fresh mandates Preact for islands; Astro mandates its `.astro` server templating around whichever island frameworks are configured. Yes (implementation lock per app) [E2][E6]. framework-guarantee

### Ownership topology fit
- Designed for one team owning one app; island boundaries are drawn where interactivity lives, not where team ownership lives. Yes [E1][E9][E10]. inference (corroborated by pattern authors and analysis: islands scale performance, MFEs scale development)
- Multi-team use is possible only as monorepo/package composition feeding the single build; deploy cadence, release gating, and rollback remain shared. Conditional (organizational decoupling absent at the delivery layer) [E10]. inference
- Poor fit when the driving requirement is independent team deployment or technology autonomy per team; that requirement redirects to actual MFE strategies. Yes (redirect trigger) [E1][E10]. inference

### Migration requirements
- Natural fit for content-heavy sites and MPAs; adopting it in an existing SPA means inverting to server-first rendering, which is an architectural rewrite, not a wrapper. Conditional (greenfield/MPA cheap, SPA expensive) [E9]. inference
- is-land retrofits incrementally onto any existing server-rendered page (progressive enhancement with `on:visible`/`on:idle`/`on:media` conditions), including pages produced by other stacks (demonstrated with SvelteKit). Yes (is-land variant) [E8][E11]. officially-supported
- Migrating from islands to a true MFE architecture later carries no special affordance; the single build must still be split. Unknown (no documented migration path in either direction). inference

### Deployment
- One build artifact, one deployment unit in the common case: participants are not independently deployable, so the strategy fails the MFE deployment-independence criterion. Yes (fails the criterion; this is the load-bearing boundary finding) [E2][E3][E10]. framework-guarantee + inference
- Astro server islands are rendered by the same deployment through an internal same-origin endpoint (`/_server-islands/<name>`); deferred render time does not create a second deploy unit. Yes [E3]. framework-guarantee
- MFE-adjacent variant: islands or fallback regions filled from separately deployed origins (a fragment service behind the island endpoint, an is-land tag loading a remotely owned bundle, edge-assembled fragments hydrating as islands). Deployment independence then returns, and the resulting system belongs to server-side fragment composition / edge-side composition / web-components-composition, with islands as its hydration discipline. Conditional (requires leaving the canonical single-app form) [E3][E8][E10]. possible-extension
- No registry, manifest, discovery, or version-skew machinery exists or is needed; there is nothing to keep in sync. NA (single deploy unit) [E2]. inference

### Contracts and communication
- Server-to-island contract is props serialization at render time; only serializable values cross, enforced by the framework. Yes [E2][E6]. framework-guarantee
- Astro server island props travel encrypted in the request (query string on GET; automatic switch to POST past 2048 bytes, which forfeits HTTP caching). Yes [E3]. framework-guarantee
- Island-to-island communication is undefined by the pattern; DOM events or an opt-in shared store are the conventions. Conditional [E2][E7]. common-pattern
- No cross-team contract versioning problem exists: both sides of every contract ship in the same commit. Yes (contracts are intra-app) [E2]. inference

### UX implications
- Content is visible and readable before any JS executes; interactivity attaches progressively per island. Yes [E1][E2]. framework-guarantee
- One document, one URL, one history, one accessibility tree; no embedding seams. Yes [E1]. browser-guarantee
- Navigation is full-page MPA by default; SPA-feel requires the implementation's optional client router or view transitions. Conditional [E2]. officially-supported
- Server islands introduce a two-phase paint (fallback slot content replaced by fetched HTML), so mismatched fallback dimensions cause layout shift; sizing the fallback is the author's job. Conditional (mitigable) [E3]. framework-guarantee + inference

### Performance causes
- Client JS payload is proportional to the interactive surface, not to the page or app size; static regions cost zero JS. Yes [E1][E2]. framework-guarantee
- Hydration can be gated per island on visibility, idle, or media query (`client:visible`, `on:visible` etc.), deferring cost off the critical path. Yes [E2][E8]. officially-supported
- Reported magnitudes (e.g., 15-30KB for a typical Fresh marketing page vs 150-300KB fully hydrated equivalents) are implementation- and page-dependent. Unknown (magnitude not independently verified) [E6]. community-convention
- Server islands let the static shell be CDN-cached aggressively while only the dynamic region pays per-request render cost. Yes [E3][E4]. framework-guarantee

### Security and trust
- No trust boundary exists between islands; all code is first-party by assumption and shares the realm. Untrusted or third-party code is out of scope for this strategy (isolation would have to come from a different family, e.g. iframes). No (not a security mechanism) [E1]. inference
- Server island props are encrypted specifically so server-side values embedded in island requests are not user-readable in URLs. Yes [E3]. framework-guarantee
- Attack surface is that of a single ordinary web app; no cross-origin composition surface is introduced in the canonical form. Yes [E2]. inference

### SSR and delivery
- SSR/SSG is not an add-on but the substrate: the strategy is defined as server-rendered HTML first. Yes [E1][E2]. framework-guarantee
- Static prerender, on-demand SSR, and hybrid per-route modes are standard in the implementations. Yes [E2][E6]. officially-supported
- Server islands add per-region deferred SSR over a cached shell, with standard HTTP `Cache-Control` on the island responses (GET case). Yes [E3]. framework-guarantee

### Operational model
- Operations are those of one app: one pipeline, one deploy, one thing to monitor and roll back; no orchestration plane, no fragment registry, no cross-team version governance. Yes [E2]. inference
- This operational simplicity is the exact flip side of the failed deployment-independence criterion; the framework engine should present them as one trade, not two findings. Yes. inference

## Editions and commercial layer

None. The strategy is vendor-neutral; the named representatives are OSS (Astro and is-land MIT, Fresh MIT under Deno). Commercial attachments are hosting sponsorships and adapters (Netlify, Cloudflare, Vercel, Deno Deploy), not gated editions; no capability in this dossier is edition-restricted [E4][E5][E6][E8].

## Family mapping (provisional)

- Primary: its own family, and deliberately outside the MFE category in canonical form; closest non-MFE baselines are "server-rendered templates" plus progressive enhancement (Jason Miller's own analog) [E1]
- Overlaps when extended: server-side fragment composition and edge-side composition (separately deployed fragments delivered into island slots), web-components-composition (is-land is itself a custom element; declarative shadow DOM fragments can hydrate as islands) [E3][E8]
- Engine verdict shape: boundary unit whose usual output is a redirect. Requirement "performance isolation / less JS" resolves here; requirement "independent team deployment" resolves to true MFE families; the combined requirement resolves to an MFE family that adopts islands as its hydration discipline (the patterns compose, per practitioner analysis) [E1][E9][E10]

## Ambiguities and decomposition candidates

- "Isolation" must be split for the matrix: performance isolation (Yes), hydration-failure containment (Conditional), JS/realm isolation (No), security/trust isolation (No). A single isolation cell would be wrong in three directions
- "Independently deployed islands" needs decomposition into render unit vs deploy unit: server islands defer the render unit while keeping one deploy unit; only remote-origin fragments split the deploy unit
- "Multi-framework support" splits into per-island framework choice inside one build (Yes for Astro) vs per-team framework autonomy (No); marketing language conflates them
- "Is it an MFE?" decomposes into composition mechanics (independent pieces in one page: Yes) vs deployment independence (No) vs organizational decoupling (No); the unit passes only the first, which is what makes it a boundary case worth keeping in the study

## Sources

- [E1] https://jasonformat.com/islands-architecture/ (accessed 2026-08-28) - pattern definition, per-island independent hydration, no top-down roots, author's own distinction from micro-frontends, progressive-enhancement analog, term coined by Katie Sylor-Miller 2019
- [E2] https://docs.astro.build/en/concepts/islands/ (accessed 2026-08-28) - client islands mechanics, per-island framework choice, `client:*` directives, shared-state via stores, zero-JS default
- [E3] https://docs.astro.build/en/guides/server-islands/ (accessed 2026-08-28) - `server:defer`, same-deployment internal endpoint (`/_server-islands/<name>`), fallback slot, encrypted props, GET caching and 2048-byte POST switch, single build artifact
- [E4] https://astro.build/blog/astro-4120/ (accessed 2026-08-28) - server islands experimental debut (July 2024), now stable core
- [E5] https://astro.build/blog/ incl. what's-new posts (accessed 2026-08-28) - Astro 6.0 (Feb 2026), 7.0 (Jun 2026), 7.2.1 (2026-08-11); active monthly cadence
- [E6] https://deno.com/blog/fresh-and-vite (accessed 2026-08-28) - Fresh 2.0 beta 2025-09-02 declared effective RCs, Vite foundation, islands remain the core model, Preact-only islands
- [E7] https://deno.com/blog/fresh-1.2 (accessed 2026-08-28) - shared state between islands as an official feature, full-time maintainer
- [E8] https://github.com/11ty/is-land and https://www.npmjs.com/package/@11ty/is-land (accessed 2026-08-28) - framework-independent partial-hydration custom element, loading conditions, SSR component examples, v5.0.1 current
- [E9] https://www.patterns.dev/vanilla/islands-architecture/ (accessed 2026-08-28) - neutral pattern write-up: isolated hydration in static HTML, suitability profile
- [E10] https://frontendmastery.com/posts/understanding-micro-frontends/ (accessed 2026-08-28) - reputable analysis distinguishing islands (performance scaling) from micro-frontends (organizational scaling); patterns composable
- [E11] https://www.11ty.dev/docs/plugins/is-land/ (accessed 2026-08-28) - official is-land docs, incremental adoption on any page, condition vocabulary
