# Piral

- Unit type: framework
- Status (Aug 2026): active. v1.12.3 released 2026-08-18, steady patch cadence through 2026, ~12k weekly piral-cli downloads, 1.9k stars [E2][E3].
- Availability: available
- Version / release cadence: piral 1.12.3 (2026-08-18); releases roughly monthly (v1.11.1 2026-06-16, v1.11.2 2026-07-02, v1.12.1 2026-07-28, v1.12.2 2026-08-05, v1.12.3 2026-08-18) [E2].
- Official links: docs https://docs.piral.io, site https://piral.io, repo https://github.com/smapiot/piral (vendor: smapiot GmbH)
- Researched: 2026-08-28

## What it is

Piral is an app-shell framework: a thin React-based host application (the "Piral instance") that fetches feature modules called pilets at runtime from a pilet feed service and integrates them into one SPA [E4]. A pilet is an npm package containing a JS library; its root module exports a `setup(api)` function that receives the Pilet API and registers pages, tiles, menu entries, modals, and extension components with the shell [E4]. Pilets are delivered in one of several bundle schemas: v0/v1 (UMD), v2/v3 (SystemJS `System.register`), or `mf` (Module Federation); piral-base loads them at runtime via SystemJS or the MF runtime [E4][E7]. Everything executes in the same browser realm and document; composition is client-side by default. The feed protocol is an open specification with an MIT sample implementation, and smapiot sells a hosted/managed feed (Piral Cloud) on top [E8][E10][E11]. smapiot's newer Picard.js library (see ./picard-js.md) is slated to become the base library for a future Piral v2, replacing piral-base [E12].

## Composition mechanics

- Composition boundary: lifecycle contract (npm-packaged JS bundle exporting `setup`/`teardown`) plus the Pilet API registration surface; participants meet through registered components and named extension slots, not through direct imports [E4][E7].
- Integration phase: shell is built at build time; pilets integrate at runtime. Integration after the host ships is the core design: pilets are published to the feed and picked up on next load without touching the shell [E1][E4].
- Execution model: shared JS realm, shared DOM, single document, client-composed. The v3 pilet schema is additionally designed to evaluate in Node.js for server-side use [E7].

## Findings by matrix group

### Build-time coupling

- Shell and pilets are built separately; a pilet is never compiled into the shell bundle. Yes. [E4] framework-guarantee
- Pilets build against an emulator package of the shell (scaffolded via `npm init pilet --source <shell>`), giving typed API and shared-dependency metadata at build time. Yes. [E6][E13] officially-supported
- Changing the set of centrally shared dependencies requires rebuilding and redeploying the shell (importmap is a build-time construct read by piral-cli). Yes. [E5] framework-guarantee
- Pilets can be added, updated, or removed without rebuilding the shell. Yes. [E1][E4] framework-guarantee

### Runtime coupling

- A central runtime orchestrator (piral-base loader plus the shell's state container) mediates all pilets. Yes. [E4] framework-guarantee
- Centrally shared dependencies: shell bundles them once, pilets import them as externals via the importmap. Yes. [E5] framework-guarantee
- Distributed shared dependencies: a pilet can ship a dependency unbundled such that other pilets reuse it. Yes. [E5] framework-guarantee
- Optional central shared dependencies (loaded on demand when suffixed `?` in the importmap). Yes. [E5] framework-guarantee
- `mf`-schema pilets participate in Module Federation dependency sharing. Yes. [E7] officially-supported
- Shared singleton version conflicts are resolved by whatever the shell shipped (central) or first-loaded (distributed); no per-pilet version isolation for centrally shared deps. Conditional (holds for centrally shared deps; a pilet may instead bundle its own copy privately). [E5] inference

### Isolation and failure containment

- Separate JS realm per pilet: No (all pilets share one realm and one document). [E4] framework-guarantee
- Error containment per registered component: Yes. piral-core wraps every registered pilet component in a React ErrorBoundary that renders a registered error component and logs `[<pilet>] Exception in component ...` instead of crashing the shell. [E14] framework-guarantee
- CSS isolation: No runtime mechanism; official guidance is per-pilet prefixing (e.g., Tailwind prefix) or PostCSS scoping at build/feed time. [E6] community-convention
- Ownership containment of registrations: a pilet can only unregister its own registrations. Yes. [E4] framework-guarantee
- Memory/CPU containment per pilet: No. NA mechanism exists; same-realm execution. inference

### Framework requirements

- The shell runtime (`piral`/`piral-core`) is React-based (React, React DOM, react-router, Zustand). Yes. [E4] framework-guarantee
- Pilets can render components from other frameworks via converter plugins (`create*` APIs accepting AnyComponent; e.g., piral-vue, piral-svelte ecosystem plugins). Yes. [E4] officially-supported
- A React-free core exists (piral-base: loading/lifecycle only, no UI framework). Yes. [E4] framework-guarantee

### Ownership topology fit

- Distributed teams owning pilets in separate repos, publishing independently to a feed: Yes; this is the designed topology. [E1][E4] framework-guarantee
- Requires a platform-owner role for the shell, its layout, plugin set, and the shared-dependency policy. Yes. [E4][E5] inference
- Cross-team UI composition without direct coupling via named extension slots (`registerExtension` / extension slot pairs). Yes. [E6] framework-guarantee

### Migration requirements

- Incremental adoption inside an existing SPA: Conditional (piral-core/piral-base can be embedded as libraries, but the standard path makes the Piral instance the application root). [E4] possible-extension
- Migrating a monolith: features move into pilets one at a time behind the shell; pilets can own whole route prefixes and act as self-contained sub-apps. Yes. [E6] officially-supported
- Exit cost: pilets are plain npm libraries with a single `setup` touchpoint; components beneath it can be framework-plain, which the docs recommend to keep coupling to that one file. Conditional (low if teams follow that convention). [E6] community-convention
- Mixed-format estates (existing Module Federation remotes): `mf` pilet schema accepts MF-built artifacts. Conditional (artifact must follow the pilet `mf` conventions). [E7] officially-supported. For orchestration of foreign formats without piral-cli at all, smapiot points to Picard.js (./picard-js.md). [E12]

### Deployment

- Independent pilet deployment: `pilet publish` pushes a tarball to a feed; live within the feed's propagation time, no shell involvement. Yes. [E1][E10][E13] framework-guarantee
- Feed service required: Conditional. The shell's `requestPilets` can return any pilet metadata source (static list, own endpoint), but the standard operating model is a feed implementing the open Feed API spec. [E4][E11] officially-supported
- Feed can serve per-user/feature-flagged pilet sets, deciding at request time which modules a user gets. Yes. [E4][E6][E8] framework-guarantee
- Shell deployment is a static SPA deploy (thin layer). Yes. [E4] framework-guarantee

### Contracts and communication

- Typed contract: shell emits a TypeScript declaration of its Pilet API; pilets develop against it via the emulator package. Yes. [E13] officially-supported
- Registration API discipline: every `register*` has an `unregister*`; `show*` APIs return disposer functions. Yes. [E4] framework-guarantee
- Cross-pilet UI contract: extension slots exchange components plus typed data under a shared name, with fallbacks when no provider registered. Yes. [E6] framework-guarantee
- Cross-pilet events/data: shell-provided event bus and shared-data APIs exist in the standard plugin set. Yes. [E1][E13] officially-supported

### UX implications

- Single coherent SPA: one router (react-router), one layout, shell-owned chrome (menu, dashboard, modals) populated by pilets. Yes. [E4][E6] framework-guarantee
- Shell renders loading indicators for lazily loaded pilet components automatically. Yes. [E6] framework-guarantee
- A crashed pilet component degrades to a registered error component in place, not a blank app. Yes. [E14] framework-guarantee

### Performance causes

- At least one feed request before pilets render (cache revalidation is expected even with cached pilets). Yes. [E4] framework-guarantee
- Total JS scales with number and size of active pilets; official guidance: 20-60 pilets unproblematic, 150-200 extreme but acceptable. officially-supported guidance. [E6]
- Centrally shared dependencies ship with the shell bundle up front unless marked optional (`?`). Yes. [E5] framework-guarantee
- Per-pilet code splitting is supported and recommended for large pilets. Yes. [E6] officially-supported
- Pilet size cap in the reference feed: 16 MB per pilet package. Yes (reference implementation default). [E6] officially-supported

### Security and trust

- Pilets execute with full application privilege in the shared realm; there is no security boundary between pilets or toward the shell. Yes (trust model: pilets are first-party, deliberately published code). [E4][E6] inference from same-realm execution plus official guidance
- Official guidance: pilets must never contain sensitive information; feature flags are provisioning, not access control; do not add access restrictions on pilet delivery. officially-supported. [E6]
- Supply chain: pilets enter via feed publish, so feed write access is the effective trust gate. inference. [E10][E11]

### SSR and delivery

- v3 pilet schema is defined to evaluate in Node.js (no direct `document`/`window` at load; styles exported as a `styles` path array instead of embedded). Yes. [E7] officially-supported
- End-to-end server-side rendering of a Piral app: Conditional (requires custom setup; the framework's default is client-side composition). possible-extension. [E4][E7]
- Delivery: shell as static assets; pilets as feed-served JS plus assets, CDN-cacheable. Yes. [E4] framework-guarantee

### Operational model

- CLI: piral-cli scaffolds shells and pilets, runs debug sessions, validates, packs, publishes; bundler is pluggable with maintained first-party plugins for webpack5 (1.12.3), esbuild (1.4.0), vite (1.4.0), parcel2 (1.2.0), rspack (1.2.0), bun (1.1.0), xbuild (1.1.1). Yes. [E9][E13] officially-supported
- Pilet dev loop: `pilet debug` runs the pilet inside the shell emulator locally, incl. request mocking (kras). Yes. [E13] officially-supported
- Feed operations: self-host the MIT sample feed service (repo updated 2026-08-12), implement the open Feed API spec, or buy Piral Cloud. Yes. [E8][E10][E11] officially-supported
- Adoption signal: piral-cli 11,996 and piral-base 13,862 weekly npm downloads (week 2026-08-21 to 2026-08-27). [E3]

## Editions and commercial layer

- OSS (MIT): the whole framework (piral, piral-core, piral-base, plugins), piral-cli and bundler plugins, the pilet and Feed API specifications, and the sample feed service [E1][E10][E11].
- Commercial (smapiot Piral Cloud, the hosted/managed feed service) [E8]:
  - Cloud Basic: free SaaS, up to 2 feeds, 10 micro frontends per feed.
  - Azure Basic / AWS Basic: free marketplace deployments, 1 feed, 20 micro frontends.
  - Docker Pro: EUR 3,500/year self-hosted, unlimited feeds and micro frontends.
  - Commercial-attached capabilities: centralized feature flags, rule management, configuration management, user management, analytics (style/dependency tracking), app shell hosting.
- Edition boundary: composition mechanics are fully OSS; centralized flag/rule/config/analytics management is what the commercial feed adds. Because the Feed API spec is open, a team can rebuild such capabilities itself (possible-extension), but they do not ship in the OSS sample [E8][E10][E11].

## Family mapping (provisional)

- Primary: client-side runtime composition, app-shell-plus-plugin ("portal/pilet") family: central shell, runtime-discovered modules, lifecycle contract.
- Secondary: module federation family via the `mf` pilet schema (MF artifacts as pilets) [E7].
- Adjacent: server-discovery family through the open Feed API spec (the discovery protocol is reusable outside Piral; Picard.js consumes it, see ./picard-js.md) [E11][E12].

## Ambiguities and decomposition candidates

- "Isolation" must split into: realm isolation (No), per-component error containment (Yes), CSS isolation (No; convention only), security/trust boundary between pilets (No).
- "Feed service required" must split into: discovery protocol (open spec), hosted product (commercial), and static/inline pilet loading (possible without a feed).
- "Framework-agnostic" must split into: shell runtime framework (React, fixed for piral/piral-core), pilet component framework (pluggable via converters), loader core (piral-base, framework-free).
- "SSR support" must split into: pilet format evaluable in Node (v3: Yes) vs framework-provided SSR pipeline (Conditional, custom).
- "Independent deployment" must split into: artifact publish independence (Yes) vs shared-dependency policy independence (No; shell-owned importmap).

## Sources

- [E1] https://github.com/smapiot/piral (accessed 2026-08-28) - README architecture claims, activity (1.9k stars, 4,258 commits), MIT
- [E2] GitHub API smapiot/piral releases (accessed 2026-08-28) - v1.12.3 2026-08-18 and prior 2026 cadence; repo pushed_at 2026-08-18
- [E3] npm registry piral@1.12.3 metadata; api.npmjs.org weekly downloads piral-cli 11,996 / piral-base 13,862 for 2026-08-21..27 (accessed 2026-08-28)
- [E4] https://raw.githubusercontent.com/smapiot/piral/develop/docs/concepts/I01-architecture.md (accessed 2026-08-28) - building blocks, SystemJS loading, pilet API, feed loading, state
- [E5] https://raw.githubusercontent.com/smapiot/piral/develop/docs/concepts/I08-importmap.md (accessed 2026-08-28) - three dependency-sharing types, inherit/exclude, optional `?` deps
- [E6] https://raw.githubusercontent.com/smapiot/piral/develop/docs/questions/pilets.md (accessed 2026-08-28) - CSS prefixing, pilet trust guidance, pilet counts, 16 MB limit, extensions, standalone/emulator scaffolding
- [E7] https://raw.githubusercontent.com/smapiot/piral/develop/docs/specs/pilet-specification.md (accessed 2026-08-28) - v0/v1 UMD, v2/v3 SystemJS, `mf` Module Federation schema, v3 Node evaluation and `styles` export
- [E8] https://www.piral.cloud/ (accessed 2026-08-28) - commercial tiers, pricing, feature flags/rules/config/user management/analytics
- [E9] npm registry latest versions of piral-cli-webpack5/-esbuild/-vite/-parcel2/-rspack/-bun/-xbuild (accessed 2026-08-28)
- [E10] GitHub API smapiot/sample-pilet-service (accessed 2026-08-28) - MIT sample feed, pushed 2026-08-12
- [E11] https://github.com/smapiot/piral/tree/develop/docs/specs feed-api-specification.md (accessed 2026-08-28) - open Feed API spec exists
- [E12] https://picard.js.org/guide/faq (accessed 2026-08-28) - Picard.js planned as base library for Piral v2, replacing piral-base
- [E13] piral-cli behavior (scaffolding, debug, publish, emulator) as described across [E1][E4][E6] and the cli-specification.md in [E11]; bundler plugin availability verified in [E9]
- [E14] https://raw.githubusercontent.com/smapiot/piral/develop/src/framework/piral-core/src/components/ErrorBoundary.tsx (accessed 2026-08-28) - per-component ErrorBoundary with registered error components, applied via withApi
