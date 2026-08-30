# Picard.js

- Unit type: library
- Status (Aug 2026): inactive (dormant). Latest release v0.2.3 on 2024-07-14; last repo push 2025-03-10; 48 stars; 27 weekly npm downloads; the FAQ's own roadmap targeted production readiness for September 2024 and no release followed [E1][E2][E3][E5]. CORRECTION to landscape inventory: listed there as "emerging"; the evidence supports "inactive/dormant with a strategic revival path" (it is slated as the base library for a future Piral v2, which has not shipped) [E5]. Recommend inventory status change: emerging -> inactive (strategically alive).
- Availability: available-immature (installable from npm and JSR at 0.2.x, MIT, but pre-1.0 and unmaintained for over a year)
- Version / release cadence: 0.2.3 on npm and JSR (both 2024-07); 6 versions total on JSR; no releases since [E2][E4].
- Official links: docs https://picard.js.org, repo https://github.com/picardjs/picard (org: picardjs; vendor: smapiot)
- Researched: 2026-08-28

## What it is

Picard.js is a micro frontend orchestrator, not a build framework: a single library the host page loads (a CDN script, an ESM import, or a server module) that then loads, mounts, and unmounts micro frontends built in other systems' formats without adopting those systems' bundler configuration [E5][E6]. The host marks mounting regions with web components (`<pi-component name="..." source="..." format="...">`), and per-format adapters resolve the artifact: Module Federation v1 and v2 (remote types `var` and `esm`), Native Federation (via its JSON manifest), SystemJS bundles such as Piral pilets, and plain native ESM; any UI library works if convertible to Picard's lifecycle or to an integrated target such as single-spa [E5][E6][E7]. Micro frontends can also be resolved through a discovery service response following either the Piral Feed Service schema or the MFEWG micro-frontend discovery schema [E6][E8]. The package ships four runtime variants (browser script, client ESM, Node server incl. CJS, Electron/native), and its JSR listing declares browser, Node, and Bun runtime compatibility [E2][E4]. Its stated relationship to Piral (see ./piral.md): not a successor, but the planned base library for Piral v2, replacing piral-base [E5]. Its niche is interop and migration: running a mixed estate of MF/Native-Federation/single-spa/Piral artifacts under one orchestrator while converging formats.

## Composition mechanics

- Composition boundary: custom elements as mounting regions plus a per-format loader/lifecycle-adapter contract; participants are foreign build artifacts (MF containers, NF manifests, SystemJS bundles, ESM modules) untouched by Picard's own tooling [E5][E6][E7].
- Integration phase: runtime on the client, or server-render time in the Node variant; integration after the host ships is the point (sources are URLs/discovery responses, not build inputs). Yes to post-ship integration. [E5][E6] framework-guarantee
- Execution model: shared JS realm, shared DOM, single document on the client; the server variant composes HTML on the server (Node), with hydration/behavior on the client. [E2][E5][E9] officially-supported (server variant existence), inference (same-realm detail, from web-component mounting with no sandbox primitive documented)

## Findings by matrix group

### Build-time coupling

- Host requires no bundler integration: include a script and place web components. Yes. [E5][E6] framework-guarantee
- Micro frontends keep their original toolchains (webpack MF, Angular Native Federation, piral-cli, plain ESM); Picard consumes the emitted artifacts. Yes. [E5][E6][E7] framework-guarantee
- Picard itself imposes no shared build config across participants. Yes. [E5] framework-guarantee

### Runtime coupling

- Central orchestrator mediates load/mount/unmount of all participants. Yes. [E5] framework-guarantee
- Dependency sharing across different formats (e.g., between Module Federation and Native Federation participants). Yes, per official docs/FAQ. [E5][E6] officially-supported
- Version-conflict semantics of that cross-format sharing (who wins, singleton handling): Unknown (not documented in retrieved material). Unknown. inference

### Isolation and failure containment

- Separate JS realm per micro frontend: No; web components are mounting primitives, not sandboxes, and no realm/iframe isolation is documented. [E5][E6] inference
- Failure containment (one micro frontend crashing without taking the page down): docs market "loose coupling with resilience", but the concrete containment mechanism is not documented in retrieved material. Unknown. [E5] inference
- CSS/style isolation: Unknown (shadow DOM usage not confirmed in retrieved material). Unknown.

### Framework requirements

- Host framework: none required (works from PHP-rendered pages to Next.js apps). Yes. [E5] framework-guarantee
- Micro frontend framework: any, if convertible to Picard's lifecycle or an integrated target such as single-spa. Conditional (that convertibility is the condition). [E5] framework-guarantee
- Requires adopting smapiot's Piral stack: No (Piral pilets are just one supported format). [E5][E6] framework-guarantee

### Ownership topology fit

- Teams keep their existing, heterogeneous toolchains and publish artifacts independently; a platform owner runs the orchestrator and discovery wiring. Yes. [E5][E6] inference from design
- Suited to organizations mid-migration between micro frontend systems (the interop niche). Yes. [E5] officially-supported positioning

### Migration requirements

- Adopting Picard in an existing site: add script plus components; no rebuild of the host. Yes. [E5][E6] framework-guarantee
- Migrating between formats (e.g., single-spa to MF, MF to NF) under one roof: Conditional (both formats must be among the supported set; per-format parameters like `remote-name`/`remote-type` needed for MF). [E6][E7] officially-supported
- Migration risk specific to this unit: dormancy. Betting a migration path on a library without releases since 2024-07 is a maturity risk independent of its mechanics. [E1][E2] inference

### Deployment

- Micro frontends referenced directly by URL or resolved via discovery services (Piral Feed Service schema or MFEWG micro-frontend discovery schema). Yes. [E6][E8] officially-supported
- Independent deployment of participants (deploy artifact, update discovery response, no host redeploy). Yes. [E5][E6] framework-guarantee

### Contracts and communication

- Lifecycle contract: Picard's own lifecycle definition, plus single-spa lifecycles as an integrated target. Yes. [E5] framework-guarantee
- Cross-micro-frontend communication primitives (events, shared state) beyond mounting: Unknown in retrieved material. Unknown.

### UX implications

- Composition is component-level (regions inside a page), not route-level only; fits embedding micro frontends into otherwise conventional pages. Yes. [E6] framework-guarantee
- Loading/error UX states per region: Unknown in retrieved material. Unknown.

### Performance causes

- One extra orchestration library on the page; per-format loaders add resolution steps (manifest fetch for NF, container init for MF). Yes (inherent). [E6][E7] inference
- Discovery service round trip before load when discovery is used. Yes. [E8] inference

### Security and trust

- Same-realm execution of foreign-format artifacts: loaded code runs with full page privileges; trust model is deliberate inclusion of known artifacts, not sandboxing. Yes (no security boundary). [E5] inference (boundary defined: no realm/process isolation documented)

### SSR and delivery

- Multi-runtime distribution: browser script (unpkg/jsdelivr entry), client ESM, Node server variant (ESM+CJS), Electron/native variant; JSR declares browser, Node, and Bun compatibility. Yes. [E2][E4] framework-guarantee (verified in package metadata)
- Server-side rendering of Native Federation components: Conditional (the component itself must support SSR). [E7] officially-supported
- SSR for the other formats: Unknown in retrieved material. Unknown.

### Operational model

- Published on npm (picard-js) and JSR (@picard/js); MIT. Yes. [E2][E4] framework-guarantee
- Adoption (Aug 2026): 27 weekly npm downloads; 48 GitHub stars; JSR dependent count 0. Small. [E2][E3][E4] verified metrics
- Maintenance: last push 2025-03-10, last release 2024-07-14, 2 open issues; no maintenance signal in 2026. [E1] verified metrics
- Support/backing: smapiot (same vendor as Piral); no commercial edition of Picard itself. [E5][E10]

## Editions and commercial layer

None. MIT open source only; no Picard-specific commercial product. Adjacent commercial touchpoint: it can consume the Piral Feed Service discovery schema, whose hosted implementation (Piral Cloud) is commercial; see ./piral.md, "Editions and commercial layer" [E8][E10].

## Family mapping (provisional)

- Primary: orchestration/interop layer (meta-orchestrator) spanning several families rather than sitting inside one: client-side runtime composition, module federation (MF v1/v2, Native Federation), lifecycle-orchestration (single-spa integration), and discovery-driven composition (Piral feed, MFEWG schema).
- Multi-family honesty: it implements none of those families' build sides; it only loads their artifacts. Classify as interop capability over the families, not as a competing member. Cross-link: ./piral.md (same vendor; Picard is the planned piral-base replacement for Piral v2) [E5].

## Ambiguities and decomposition candidates

- "Status" must split into: installable-and-usable (Yes, 0.2.x on npm/JSR), actively-maintained (No since 2025-03), strategically-alive (Conditional: named base of unshipped Piral v2).
- "Universal format support" must split per format: MF v1, MF v2 (remote types var/esm), Native Federation, SystemJS/pilet, native ESM, single-spa lifecycle: each its own matrix row.
- "Multi-runtime" must split into: browser script, browser ESM, Node server, Bun (declared on JSR, not separately evidenced), Electron/native.
- "SSR support" must split per format (Native Federation: Conditional on component; others: Unknown).
- "Resilience" claim must split into: load-failure handling vs runtime-crash containment (both currently Unknown mechanically).

## Sources

- [E1] GitHub API picardjs/picard (accessed 2026-08-28) - 48 stars, pushed_at 2025-03-10, 2 open issues, MIT, releases v0.2.3/v0.2.2 2024-07-14
- [E2] npm registry picard-js@0.2.3 metadata (accessed 2026-08-28) - exports map: server (Node ESM/CJS), client/browser ESM, browser script (unpkg/jsdelivr), electron/native variant; author smapiot; MIT
- [E3] api.npmjs.org downloads picard-js: 27 for week 2026-08-21..27 (accessed 2026-08-28)
- [E4] JSR API scope picard, package js (accessed 2026-08-28) - latest 0.2.3, 6 versions, runtimeCompat browser/node/bun, dependentCount 0, not archived, description "next generation micro frontends orchestrator. Framework agnostic, multi-runtime compatible."
- [E5] https://picard.js.org/guide/faq (accessed 2026-08-28) - formats (SystemJS/Piral, MF v1+v2, Native Federation, native ESM), single-spa integration, cross-format dependency sharing, not Piral's successor but base for Piral v2, 2024 roadmap dates
- [E6] https://picard.js.org/ and format guides incl. https://picard.js.org/guide/formats/module-federation (accessed 2026-08-28 via search excerpts) - `<pi-component>` usage, no bundler config, MF parameters remote-name/remote-type (var|esm), discovery-response consumption
- [E7] https://picard.js.org/guide/formats/native-federation (accessed 2026-08-28 via search excerpts) - format `native`, manifest-defined, SSR conditional on component support
- [E8] https://picard.js.org/api/discovery/native-federation-manifest and discovery docs (accessed 2026-08-28 via search excerpts) - discovery via Piral Feed Service schema or MFEWG schema
- [E9] https://picard.js.org/guide/variants/client (accessed 2026-08-28 via search result listing) - client/bundler variant documentation exists
- [E10] https://www.smapiot.com/en/products/ (accessed 2026-08-28 via search result listing) - smapiot product framing of Picard.js as lightweight orchestrator integrating MFs regardless of underlying technology
