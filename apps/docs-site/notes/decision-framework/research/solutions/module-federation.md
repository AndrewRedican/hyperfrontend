# Module Federation

- Unit type: framework
- Status (Aug 2026): active; MF 2.0 declared stable 2026-02-10 by the ByteDance Web Infra team with Zack Jackson, npm releases continuing through August 2026 [E2][E3][E6]. Inventory's provisional "active" status is CONFIRMED, no correction needed. Sub-edition statuses diverge: nextjs-mf is maintenance/EOL-bound (~end 2026) [E4], @originjs/vite-plugin-federation is effectively abandoned [E7].
- Availability: available (core, webpack, Rspack, official Vite plugin); deprecated (nextjs-mf, @originjs/vite-plugin-federation as paths forward)
- Version / release cadence at research time: @module-federation/enhanced 2.9.0 on npm (Aug 2026), repo tag v2.8.2 on 2026-08-06; frequent minor/patch releases [E6]. Webpack v1 API remains built into webpack 5 core [E12].
- Official links: docs https://module-federation.io, repo https://github.com/module-federation/core
- Researched: 2026-08-28

## What it is

Module Federation lets separately built and deployed webpack/Rspack/Vite bundles load each other's JS modules at runtime inside one page and one JS realm. A "remote" build emits a container entry (remoteEntry.js or a manifest) exposing named modules; a "host" resolves those containers at runtime and imports exposed modules as if they were local, while a shared-scope negotiation deduplicates common dependencies (react, etc.) by semver range. v1 is the ModuleFederationPlugin baked into webpack 5 (2020). MF 2.0 (2024, stable Feb 2026) decouples a standalone federation runtime from the bundler, adding a manifest protocol, a runtime plugin system, generated-and-fetched TypeScript types, Chrome DevTools support, and Node.js container loading for SSR [E1][E2][E3]. It composes client-side module graphs; it is not a rendering, routing, or isolation layer.

## Composition mechanics

- Composition boundary: JS module graph. Participants exchange ES/webpack modules through container entries plus a negotiated shared-dependency scope; no DOM or document boundary is created [E1][E12].
- Integration phase: build-time contract (exposes/shared config baked into each bundle) with runtime resolution; remotes can be redeployed after the host ships, and MF 2.0 runtime APIs (registerRemotes/loadRemote) allow registering remotes with no build-time reference at all [E1][E8].
- Execution model: shared JS realm, shared DOM, shared document by default. MF 2.0 also loads containers in Node processes for SSR [E3]. No sandboxing; an official sandbox is listed only as a future high-level capability [E1].

## Findings by matrix group

### Build-time coupling

- Host and remotes must each be built by an MF-capable bundler plugin (webpack 5, Rspack, official Vite plugin, Rsbuild; Rollup/Rolldown/Metro listed by MF 2.0 stable coverage): Yes [E3][E6][E9]. officially-supported
- Host can be built without knowing remote URLs (runtime registration / manifest fetch): Yes, in MF 2.0 via runtime APIs and manifest discovery [E1][E8]. officially-supported
- Bundler-heterogeneous federation (e.g. Rspack remote consumed by Vite host) is possible through the shared MF 2.0 runtime protocol: Conditional (both sides must speak the MF 2.0 runtime/manifest protocol; v1 webpack containers and 2.0 interop needs the enhanced plugin) [E3][E8]. officially-supported
- Shared-dependency version ranges are declared per build and enforced only at runtime negotiation, so builds compile successfully against combinations that later fail or duplicate at runtime: Yes [E12]. framework-guarantee
- d.ts sharing: MF 2.0 auto-generates types for exposed modules and hosts fetch/consume them for editor hints ("dynamic type prompt"): Yes [E1][E3]. officially-supported
- Independent builds per team (no shared monorepo or shared lockfile required): Yes; common-pattern, though shared-scope correctness in practice pushes teams toward coordinated dependency ranges [E12]. inference

### Runtime coupling

- All participants execute in one JS realm with one global scope by default: Yes [E1][E12]. framework-guarantee
- Shared-scope negotiation picks one copy of a dependency per share scope when semver ranges are compatible: Yes [E12]. framework-guarantee
- When ranges are incompatible, the fallback silently loads a second copy of the dependency (e.g. two React trees), unless singleton: true forces one copy and emits a version-mismatch warning/error instead: Yes; this is the documented duplicate-React and version-skew mechanism [E12]. framework-guarantee
- singleton: true creates a hidden runtime contract: any remote whose required range excludes the host-provided version breaks or warns at runtime, not at build time: Yes [E12]. framework-guarantee
- MF 2.0 runtime is decoupled from bundlers and exposes programmatic APIs (loadRemote, registerRemotes, preloadRemote, registerPlugins): Yes [E3][E8]. officially-supported
- Runtime plugin system allows intercepting resolution/loading lifecycle (retry, fallback, custom fetch, monitoring): Yes [E1][E6]. officially-supported
- A crashing remote module takes down whatever consumed it in-realm unless the host wraps loading in its own error boundary or a retry/fallback runtime plugin: Yes [E1][E12]. inference (from shared-realm execution; mitigations are possible-extension, not defaults)

### Isolation and failure containment

- JS isolation between participants: No (shared realm; globals, prototypes, and singletons are shared and mutable across all federated code) [E1][E12]. framework-guarantee
- CSS/DOM isolation: No by default; NA to MF itself (teams layer Shadow DOM or CSS scoping conventions on top) [E12]. community-convention
- Failure containment on remote fetch failure: Conditional (host-authored error boundaries, offline fallbacks via runtime plugins such as the retry plugin; nothing is contained by default) [E6]. possible-extension
- Official sandbox: No as of Aug 2026; listed as a future high-level capability only [E1]. officially-supported (as roadmap statement)

### Framework requirements

- UI-framework agnostic at the module level (any JS module can be exposed): Yes [E12]. framework-guarantee
- React: primary ecosystem path; bridge-react provides cross-version mounting helpers; duplicate-tree/hooks breakage when React fails singleton negotiation is the canonical hazard: Yes (hazard) [E6][E12]. framework-guarantee
- Next.js: nextjs-mf is in maintenance mode, EOL ~end 2026 (CI tests removed, no active development, community PRs merged only); Pages Router only; App Router NEVER supported; Next 16 support not promised; maintainer explicitly advises against Next.js for federation and Vercel confirms no native MF support: Yes (all per maintainers) [E4][E5][E11]. officially-supported
- Angular: webpack-based @angular-architects/module-federation still exists but Nx dropped Angular webpack-MF support; the maintained MF paths for Angular are Rspack/Rsbuild-based MF (official module-federation.io Angular guide; Nx rspack executors; experimental @ng-rsbuild/plugin-angular builder), while Nx and Angular Architects recommend Native Federation (a separate unit) as the default Angular path: Conditional [E10][E13]. officially-supported
- Vite: @module-federation/vite is the official plugin tracking the MF 2.0 runtime (approx 1.15.x, active); @originjs/vite-plugin-federation is superseded (no commits since 2025-05, 200+ open issues, open deprecation proposal pointing to the official plugin, own runtime not protocol-compatible with MF 2.0 manifest features): Yes [E7][E8]. officially-supported
- Rspack: first-class MF support maintained jointly with the MF team; Rspack docs recommend MF v1.5/v2.0 and state v1.0 is no longer iterated; module-federation.io positions Rspack as the preferred fast path: Yes [E9][E1]. officially-supported
- Server frameworks (Modern.js v3 plugin, Rspress, Storybook integrations): Yes [E2][E3]. officially-supported

### Ownership topology fit

- Independent team ownership of deployable UI slices with runtime composition: Yes; this is the design center [E1][E12]. framework-guarantee
- Requires cross-team governance of shared-dependency versions (ranges, singleton policy, upgrade trains) to avoid skew/duplication: Yes [E12]. inference (mechanically implied by shared-scope semantics; widely reported operationally)
- Suits many-teams-one-page topologies better than one-team-many-apps: Conditional (value is runtime sharing; a single team gains mostly deploy decoupling) [E3]. inference

### Migration requirements

- Incremental adoption from v1 to 2.0 is supported (swap plugin import to @module-federation/enhanced): Yes [E2][E3]. officially-supported
- Existing SPA can adopt MF without rewrite if it is already on a supported bundler: Conditional (bundler-supported; app must tolerate async boundaries for shared/eager semantics) [E12]. officially-supported
- Teams on @originjs/vite-plugin-federation face a migration (different runtime, virtual:__federation__ vs official runtime APIs): Yes [E7][E8]. officially-supported
- Teams on nextjs-mf must migrate off (to non-Next hosts, multi-zones, or other composition) before/at EOL: Yes [E4][E11]. officially-supported

### Deployment

- Independent deploys of remotes without redeploying the host: Yes (host fetches container/manifest at runtime) [E1]. framework-guarantee
- Manifest discovery: MF 2.0 emits mf-manifest.json describing exposes, shared, and assets; hosts and tooling (preload, type fetching, DevTools, Zephyr-style platforms) consume it: Yes [E1][E3]. officially-supported
- Versioned rollout/rollback of remotes: Conditional (nothing first-party; URL/manifest indirection must be built or bought; see zephyr-cloud.md) [E1]. possible-extension
- Cache invalidation is the operator's problem (remoteEntry/manifest URLs must be cache-busted or short-TTL): Yes. community-convention

### Contracts and communication

- The contract surface is the exposed-module names plus their TS types plus shared-dependency ranges; no schema or wire protocol exists between host and remote beyond JS imports: Yes [E1][E12]. framework-guarantee
- Generated d.ts distribution gives compile-time checking of remote APIs in consuming editors/builds: Conditional (types are fetched artifacts; they can lag the deployed remote, so type-checked does not mean runtime-compatible) [E3]. officially-supported (mechanism) / inference (lag caveat)
- Cross-app communication is unconstrained shared-realm JS (shared state libs, events, singletons): Yes; NA for MF-provided messaging (none exists) [E12]. framework-guarantee

### UX implications

- Single-page, seamless composition (no iframes, shared routing possible): Yes [E12]. framework-guarantee
- Loading states appear at every async remote boundary; UX quality depends on host-authored suspense/fallbacks: Yes. common-pattern
- A failed remote with no fallback yields a hole or a crash in the page: Yes [E12]. inference

### Performance causes

- Shared-dependency dedup reduces total bytes versus iframe/duplicate-bundle approaches when negotiation succeeds: Yes [E12]. framework-guarantee
- Request waterfalls: naive v1 loading is sequential (remoteEntry, then shared negotiation, then exposed chunk, then its deps); MF 2.0's manifest plus preloadRemote and shared tree-shaking exist specifically to cut this: Yes (hazard and first-party mitigation both real) [E2][E3][E8]. officially-supported
- Eager shared chunks: shared: { eager: true } inlines shared deps into the initial chunk, fixing "shared module not available for eager consumption" errors at the cost of duplicating those bytes per eager participant; the alternative is an async bootstrap boundary: Yes [E12]. framework-guarantee
- Version skew ships redundant copies: incompatible ranges silently double-load frameworks, so page weight regressions arrive via remote deploys the host never saw: Yes [E12]. framework-guarantee
- Build/asset/render pipeline optimizations (shared tree-shaking, preload) landed in the 2.0 stable line: Yes [E2]. officially-supported

### Security and trust

- Remote code executes with full host-page privileges (same realm, same cookies/DOM/storage); loading a remote is equivalent to a script include of third-party code: Yes [E12]. framework-guarantee
- Therefore MF is only appropriate where all participants share one trust domain, or where trust is enforced organizationally (registry control, review, SRI/CSP at the ops layer): Yes. inference (boundary defined: no technical isolation exists in-framework; trust must come from deployment governance)
- First-party integrity/signing of remotes: Unknown (no first-party mechanism found in official docs; CSP/SRI interplay with dynamic chunk URLs is operator-managed) [E1]. inference

### SSR and delivery

- Node.js container loading for SSR is part of MF 2.0 (host server loads remote server bundles): Yes [E3]. officially-supported
- Production SSR maturity outside Modern.js is uneven; Modern.js v3 has the first-party plugin, bridge-react ships SSR fixes (stylesheet dedup) as of v2.8.x: Conditional [E2][E6]. officially-supported (Modern.js) / inference (unevenness)
- Next.js SSR federation: No as a forward path (nextjs-mf EOL, App Router never supported, RSC federation only "on our minds" at Vercel) [E4][E11]. officially-supported
- Streaming/RSC federation: No first-party support as of Aug 2026 [E4][E11]. officially-supported (absence stated by both parties)

### Operational model

- First-party hosted platform, registry, or deploy orchestration: No; MF ships build plugins, a runtime, DevTools, and docs only [E1]. officially-supported
- Observability: Chrome DevTools extension for federated graphs exists; runtime plugins can emit custom telemetry: Yes [E1][E3]. officially-supported
- Version governance across many remotes (who is on which shared range, what is deployed where) is tooling the adopter must build or source third-party (see zephyr-cloud.md): Yes. inference
- Maintenance concentration: core development is concentrated in ByteDance Web Infra plus Zack Jackson; edition abandonments (originjs, nextjs-mf) show peripheral plugins can die while core stays healthy: Yes [E3][E4][E7]. inference

## Editions and commercial layer

- OSS core: all capabilities above are MIT/OSS across @module-federation/* packages; no feature gating, no paid tier, no first-party commercial edition [E1][E6].
- Per-bundler editions (fact table):
  - webpack 5 built-in (v1 API): available, legacy semantics, still supported; enhanced plugin recommended for 2.0 features [E12][E2].
  - @module-federation/enhanced (webpack + Rspack, 2.0): active, canonical [E6].
  - Rspack: first-class, co-maintained, positioned as the performance-preferred bundler [E9][E1].
  - @module-federation/vite: official, active, MF 2.0 runtime-native [E8].
  - @originjs/vite-plugin-federation: superseded/abandoned (last commit 2025-05, deprecation proposal open) [E7].
  - nextjs-mf: maintenance mode, EOL ~end 2026, Pages Router only, App Router never supported [E4][E5].
  - Angular: via Rspack/Rsbuild MF (official guide, Nx executors, experimental builder); Nx dropped webpack Angular MF and steers default Angular users to Native Federation (separate dossier unit) [E10][E13].
- Commercial layer: none first-party. Zephyr Cloud is a third-party commercial deploy/versioning/rollback platform built around MF manifests; see [zephyr-cloud.md](zephyr-cloud.md).

## Family mapping (provisional)

- Primary: client-side runtime composition via shared module graph (runtime code-sharing micro-frontends). This is the family's center of gravity implementation.
- Secondary: server-side composition (Node container loading) in a limited, Modern.js-centric form.
- Not: iframe/document isolation, edge/HTML-fragment composition, build-time-only composition (though eager/static usage degenerates toward build-time coupling in practice). Multi-family honesty: an MF deployment where the host pins exact remote URLs and versions at build time behaves closer to a deploy-time monolith than to runtime composition.

## Ambiguities and decomposition candidates

- "Supports Vite" conflates three plugins with different runtimes and maintenance states; matrix should score the official plugin only and carry the originjs migration cost as a separate attribute.
- "SSR support" splits into: Node container loading (Yes), production-framework SSR path (Modern.js Conditional), Next.js SSR (No), RSC/streaming (No).
- "Type safety" splits into: editor-time d.ts hinting (Yes) vs deploy-time contract enforcement (No; types can lag runtime).
- "Isolation" splits into: deploy decoupling (Yes) vs runtime fault/security isolation (No); scoring one word would hide the difference.
- "Performance" splits into: dedup savings (positive), waterfall risk (negative, mitigable), eager duplication (config-dependent), skew-induced double frameworks (governance-dependent).
- "Angular support" splits into: Rspack MF path (Conditional, experimental builders) vs Native Federation (different unit entirely).

## Sources

- [E1] https://module-federation.io (accessed 2026-08-28) - official feature set: manifest, federation runtime, runtime plugin system, dynamic type prompt, Chrome DevTools; Rspack and webpack integration pages; sandbox/SSR framed as future high-level capabilities
- [E2] https://module-federation.io/blog/v2-stable-version (accessed 2026-08-28) - MF 2.0 stable announcement (2026-02-10): shared dependency tree shaking, Modern.js v3 plugin, end-to-end build/load/render optimizations, incremental adoption
- [E3] https://www.infoq.com/news/2026/04/module-federation-2-stable/ (accessed 2026-08-28) - independent analysis of the stable release: decoupled runtime, dynamic TS type hints, Node.js support, bundler coverage (webpack, Rspack, Rollup, Rolldown, Rsbuild, Vite, Metro), ByteDance + Zack Jackson stewardship
- [E4] https://github.com/module-federation/core/issues/3153 (accessed 2026-08-28) - maintainers: nextjs-mf in maintenance mode, EOL ~end 2026, CI tests to be removed, Pages Router only, Next 16 not promised, explicit advice against Next.js for federation
- [E5] https://github.com/module-federation/core/issues/2157 and https://github.com/module-federation/core/issues/1183 (accessed 2026-08-28) - App Router breakage reports confirming it never worked with nextjs-mf
- [E6] https://www.npmjs.com/package/@module-federation/enhanced and https://github.com/module-federation/core/releases (accessed 2026-08-28) - enhanced 2.9.0 current, v2.8.2 tag 2026-08-06 (retry plugin ESM fix, bridge-react SSR stylesheet dedup); exported plugin surface incl. FederationRuntimePlugin, AsyncBoundaryPlugin
- [E7] https://github.com/originjs/vite-plugin-federation (accessed 2026-08-28) - no commits since 2025-05-17, 200+ open issues, open deprecation proposal (#748) recommending the official plugin; last npm publish 1.4.1
- [E8] https://www.npmjs.com/package/@module-federation/vite (accessed 2026-08-28) - official Vite plugin approx 1.15.x, binds to @module-federation/runtime (registerPlugins, preloadRemote, registerRemotes, loadRemote)
- [E9] https://rspack.rs/guide/features/module-federation (accessed 2026-08-28) - Rspack first-class MF support co-developed with the MF team; MF v1.0 no longer iterated, v1.5/v2.0 recommended
- [E10] https://www.angulararchitects.io/blog/nx-with-rspack-and-module-federation/ and https://nx.dev/docs/kb/consumer-and-provider (accessed 2026-08-28) - Nx dropped Angular webpack MF, recommends Native Federation; Rspack/rsbuild MF path via Nx executors and @ng-rsbuild/plugin-angular (experimental)
- [E11] https://github.com/vercel/next.js/discussions/77862 (accessed 2026-08-28) - Vercel: no native MF in Next.js; RSC federation "on our minds," nothing actionable
- [E12] https://webpack.js.org/concepts/module-federation/ and https://webpack.js.org/plugins/module-federation-plugin/ (accessed 2026-08-28) - v1 semantics: container entries, shared scope semver negotiation, singleton warnings, fallback double-loading, eager consumption errors and eager:true tradeoff, async bootstrap pattern
- [E13] https://module-federation.io/practice/frameworks/angular/angular-mfe (accessed 2026-08-28) - official Angular-with-MF guide on the Rspack-era stack
