# Toolchain-Branded Microfrontend Wrappers

Research thread: framework/meta-framework/build-tool/monorepo-tool branded MFE solutions, mapped to their underlying composition mechanism. Snapshot date: 2026-08-28. All URLs accessed 2026-08-28.

Claim-type vocabulary: framework-guarantee, browser-guarantee, common-pattern, possible-extension, officially-supported, community-convention, inference.

## Why this layer exists in the framework

Users arrive with a brand ("we use Nx microfrontends", "Angular micro frontends") rather than a mechanism. Almost every brand in this layer is either (a) a wrapper/reseller of Module Federation (webpack/Rspack/Vite implementations plus the tool-agnostic MF runtime), (b) a wrapper of server-side path routing (Next.js Multi-Zones, Vercel Microfrontends), or (c) an ESM + import-maps re-implementation of the MF mental model (Native Federation). The framework must resolve the brand to the underlying family before any comparison is meaningful.

## Brand-alias table

| Brand as users say it | Underlying mechanism | What the wrapper genuinely adds | What it does NOT change |
|---|---|---|---|
| "Nx microfrontends" / "Nx module federation" | Module Federation via webpack or Rspack (`@module-federation/enhanced`); Nx wraps it in `@nx/module-federation` (formerly `withModuleFederation` in `@nx/react` / `@nx/angular`) | Host/remote generators, project-graph awareness, dev-server orchestration (serve changed remotes live, others static; `NX_MF_DEV_REMOTES` task hashing), managed shared-library config, its own MF type support (MF DTS plugin disabled by default), Zephyr deploy recipes | Composition is still MF: same-realm shared-runtime JS. No isolation added; version-skew and singleton constraints of MF apply unchanged |
| "Angular microfrontends" (modern, blessed) | Native Federation: browser-native ES modules + import maps, built on the Angular CLI esbuild ApplicationBuilder (`@angular-architects/native-federation`) | Schematics, MF-compatible API/mental model, esbuild speed, SSR + incremental hydration support, migration path from webpack MF | Same-realm ESM composition; no sandboxing. Shared-dependency versioning discipline still required |
| "Angular module federation" (legacy) | webpack 5 ModuleFederationPlugin via `@angular-architects/module-federation` custom webpack builder | Schematics, helper APIs (`loadRemoteModule`), config generation | Locks the build to webpack; Angular's esbuild builder does not support webpack MF at all |
| "Angular + Rspack MF" | Rspack MF via community builders (`@ng-rsbuild/plugin-nx` / Nx `@nx/angular-rspack` path) | Faster builds while keeping MF proper | Community-maintained, not Angular CLI supported; still MF semantics |
| "React microfrontends" | No first-party mechanism; community norm is MF via the bundler, or single-spa, or web components | Nothing branded by React itself | n/a |
| "Next.js microfrontends" (first-party) | Multi-Zones: multiple independent Next.js apps stitched by path routing (rewrites/assetPrefix); productized as Vercel Microfrontends (`@vercel/microfrontends`, edge routing) | Official docs/guide; Vercel adds `microfrontends.json` config, edge composition/routing, observability, local dev proxy | Page-level composition only: cross-zone navigation is a hard navigation; no runtime module sharing between zones |
| "Next.js module federation" (`nextjs-mf`) | webpack MF adapter for Next.js Pages Router | Historically: MF inside Next.js | EOL: maintenance mode, functional only "until mid to end of 2026"; App Router never supported |
| "Nuxt microfrontends" | No first-party mechanism; experimental async-entry flag aids MF; community uses `@module-federation/vite`; Nuxt steers users to Layers (build-time modularization, not independent deploy) | Layers: modular monolith DX | Layers give no independent deployment; MF-on-Nuxt is community-supported only |
| "Modern.js micro frontends" | MF 2.0 via official plugins `@module-federation/modern-js` / `-v3` (ByteDance co-develops MF) | Framework-integrated MF incl. SSR support, Garfish history | MF semantics unchanged |
| "Rsbuild/Rspack module federation" | Rspack has MF built in (v1-level via `moduleFederation.options`; MF 2.0 via `@module-federation/enhanced/rspack`) | First-party, zero-plugin config path; Rspack team co-maintains MF | MF semantics unchanged |
| "Re.Pack / React Native super app" | MF v2 on Rspack/webpack for React Native (`ModuleFederationV2Plugin`), Hermes bytecode chunks | RN-tailored shared defaults (react/react-native singleton+eager), deep-import fix, preloading, OTA-style runtime delivery | Native-module versions must align across host/remotes; mobile scope boundary for the framework |
| "Vite module federation" | `@module-federation/vite` (official, active, MF runtime); `@originjs/vite-plugin-federation` legacy (stalled, deprecation proposal open) | Official plugin: dev-server support, strict shared enforcement, remote types | MF semantics unchanged; originjs cannot dev-serve remotes reliably |
| "Astro microfrontends" | None branded. Islands/Server Islands are used by the community as a server-composition pattern (fetch + Fragment, import maps) | n/a (community pattern only; roadmap discussion open, no feature) | Astro remains static-first; no MFE product surface |
| "webpack module federation" | The origin: ModuleFederationPlugin ships in webpack 5 core (MF v1); MF 2.0 features arrive via `@module-federation/enhanced` | Built-in, no install | The reference semantics all wrappers inherit |
| "Vercel microfrontends" | Path-based edge routing over independent deployments (Multi-Zones generalized beyond Next.js: SvelteKit, React Router, Vite) | GA Oct 2025; edge composition, domains routing, observability, priced per routed request + per project | Page-level boundary; no shared client runtime between apps unless you add MF yourself |
| "Zephyr" (Nx partner) | Not a composition mechanism: deploy/versioning cloud for MF artifacts across bundlers | Deploy hooks, dependency resolution between MFEs, rollback | Composition semantics come entirely from the MF underneath |

## Per-brand findings

### Nx

- TB-01 (officially-supported): Nx ships a dedicated `@nx/module-federation` package (latest major 23.x) with executors, `NxModuleFederationPlugin`, and `NxModuleFederationDevServerPlugin`; it wraps `@module-federation/enhanced` for both webpack and Rspack. Nx migrations move older `withModuleFederation` imports into it. Sources: https://nx.dev/docs/kb/nx-module-federation-plugin, https://www.npmjs.com/package/@nx/module-federation, https://nx.dev/docs/technologies/react/migrations.
- TB-02 (officially-supported): host/remote generators exist for React and Angular, e.g. `nx g @nx/react:host --remotes=... --bundler=rspack`; Angular guides cover dynamic MF via `@nx/angular:webpack-browser`. Sources: https://module-federation.io/practice/monorepos/nx-for-module-federation.html, https://nx.dev/docs/technologies/angular/guides/dynamic-module-federation-with-angular.
- TB-03 (officially-supported): genuine additions are orchestration-level: project-graph-aware builds, dev-server that serves only changed remotes live (task-hash input `NX_MF_DEV_REMOTES`), a managed shared-libraries system for consistent versions, and Nx-provided MF typing (the MF DTS plugin is disabled by default in Nx workspaces). Sources: https://nx.dev/docs/kb/nx-module-federation-plugin, https://nx.dev/blog/next-gen-module-federation-deployment.
- TB-04 (officially-supported): Zephyr partnership is a deploy-time integration (`withZephyr()` added to the rspack config plugins); it changes deployment/rollback, not composition. Source: https://nx.dev/blog/next-gen-module-federation-deployment, https://docs.zephyr-cloud.io/recipes/react-rspack-nx.
- TB-05 (community-convention, reliability caveat): the webpack-to-Rspack MF conversion generators had multiple open high-priority bugs across Nx 21.x (broken converters, fresh-project build failures, runtime `remoteEntryExports` errors). Sources: https://github.com/nrwl/nx/issues/31880, https://github.com/nrwl/nx/issues/31448, https://github.com/nrwl/nx/issues/31114.
- TB-06 (inference): "Nx microfrontends" therefore resolves to family = Module Federation; Nx changes DX and operational cost (scaffolding, dev orchestration, caching, deploy) and nothing about the runtime boundary.

### Angular

- TB-07 (officially-supported): the official Angular blog (Manfred Steyer post on blog.angular.dev) states that MF's bundler integrations are "currently not supported by the Angular CLI" (besides Vite dev-server usage) and presents Native Federation as the standards-aligned path (ESM + import maps, delegating to the esbuild ApplicationBuilder). Source: https://blog.angular.dev/micro-frontends-with-angular-and-native-federation-7623cfc5f413.
- TB-08 (framework-guarantee): webpack MF and the Angular esbuild ApplicationBuilder are architecturally incompatible; using webpack MF means staying on the webpack builder. Sources: https://dev.to/mhmoud_ashour_5547515422e/native-federation-vs-webpack-module-federation-which-should-you-choose-in-2026-109m, https://www.angulararchitects.io/blog/micro-frontends-with-modern-angular-part-1-standalone-and-esbuild/.
- TB-09 (community-convention): `@angular-architects/native-federation` versions with Angular majors (21.x targets Angular 21.1+; a `-v4` bridge covers 20/21), uses the CLI dev server since 17.1, supports SSR and incremental hydration since 18. It keeps the MF API surface so migration is mostly an import swap. Sources: https://www.npmjs.com/package/@angular-architects/native-federation, https://github.com/angular-architects/module-federation-plugin/blob/main/libs/native-federation/docs/migrate.md.
- TB-10 (community-convention): real MF (webpack or Rspack) remains available only through community packages: `@angular-architects/module-federation` and Rspack/Rsbuild builders (`@ng-rsbuild/plugin-nx`, authored by an Nx team member but not Angular-official). Mixed NF + MF in one shell is documented as a supported combination. Sources: https://www.npmjs.com/package/@angular-architects/module-federation, https://www.angulararchitects.io/blog/combining-native-federation-and-module-federation/, https://www.angulararchitects.io/blog/nx-with-rspack-and-module-federation/.
- TB-11 (inference): "Angular microfrontends" is ambiguous between two families: Native Federation (ESM/import-maps family, currently blessed) and Module Federation (webpack/Rspack family, legacy or performance-driven). The framework must ask which before comparing. Note Native Federation itself is community-owned (`angular-architects`), merely featured on the official blog; Angular ships no first-party MFE feature.

### React

- TB-12 (inference, verified absence): React itself has no first-party microfrontend story; nothing in react.dev's docs or the search landscape attributes an MFE capability to the React project. All "React microfrontends" content resolves to bundler MF, single-spa, iframes, or web components. Community norm as of 2026: MF via Rspack/Rsbuild for new work, webpack for legacy. Sources (absence + norms): https://module-federation.io/, https://medium.com/@soumyanildas/micro-frontend-setup-with-nx-rspack-module-federation-2-0-and-react-698674edb09f.

### Next.js / Vercel

- TB-13 (officially-supported): Multi-Zones is the first-party approach: several Next.js apps each own a set of paths on one domain, stitched by rewrites/assetPrefix; the docs note cross-zone links are hard navigations and zones can even be non-Next.js apps. Source: https://nextjs.org/docs/app/guides/multi-zones.
- TB-14 (officially-supported): Vercel productized this as Vercel Microfrontends (`@vercel/microfrontends`): GA 2025-10-31 after Aug 2025 beta; edge routing driven by `microfrontends.json`; supports Next.js, SvelteKit, React Router, Vite, React; priced (Pro: 50K routed requests/mo included then $2/1M; 2 projects included then $250/mo per extra project). Sources: https://vercel.com/changelog/microfrontends-now-generally-available, https://www.npmjs.com/package/@vercel/microfrontends, https://vercel.com/docs/pricing.
- TB-15 (officially-supported, EOL): `@module-federation/nextjs-mf` is in maintenance mode per the MF core team (issue #3153): Pages Router only (App Router never supported), community PRs merged, expected functional "until mid to end of 2026", i.e. the window is closing at snapshot time. Maintainer guidance: "If you are exploring microfrontends, do not use Next.js"; suggested alternatives Modern.js/Remix/TanStack. Package still publishes (8.8.x) consistent with maintenance-only. Sources: https://github.com/module-federation/core/issues/3153, https://www.npmjs.com/package/@module-federation/nextjs-mf.
- TB-16 (inference): "Next.js microfrontends" resolves to the server-routing family (Multi-Zones/Vercel), not the MF family; a team asking for MF-in-Next is on a dead-end path and the framework should reroute them.

### Vue / Nuxt

- TB-17 (inference, verified absence): neither Vue core nor Nuxt ships a first-party MFE feature. Nuxt's only official surface is an experimental flag generating an async entry point "aiding module federation support". Source: https://nuxt.com/docs/4.x/guide/going-further/experimental-features.
- TB-18 (community-convention): working Nuxt MFE setups use `@module-federation/vite` (production reports exist); the community's steer inside Nuxt discussions is Nuxt Layers, which is build-time modularization (a modular monolith), not independent deployment. Sources: https://github.com/nuxt/nuxt/discussions/18430, https://alexop.dev/posts/nuxt-layers-modular-monolith/, https://github.com/nuxt/rfcs/issues/39.
- TB-19 (possible-extension): `@module-federation/vite` roadmap lists Nuxt SSR support; not shipped as official Nuxt capability at snapshot. Source: https://www.npmjs.com/package/@module-federation/vite.

### Modern.js / Rsbuild / Rspack / Rslib (ByteDance)

- TB-20 (officially-supported): the MF team ships official Modern.js plugins (`@module-federation/modern-js-v3` recommended; `@module-federation/modern-js` for v2.56.1+ with SSR support); ByteDance-internal frameworks based on Modern.js are deeply integrated with MF 2.0. Sources: https://module-federation.io/integrations/framework/modernjs/, https://modernjs.dev/guides/topic-detail/module-federation/introduce.
- TB-21 (officially-supported): Rsbuild has built-in MF (v1-level capabilities via `moduleFederation.options`, no extra plugin; MF 2.0 via the enhanced plugin); Rspack's team co-maintains MF; Rslib documents MF for libraries. Sources: https://rsbuild.rs/guide/advanced/module-federation, https://rslib.rs/guide/advanced/module-federation.
- TB-22 (officially-supported): MF 2.0 reached stable (reported April 2026) with the runtime decoupled from the build tool; support spans webpack, Rspack, Rollup, Rolldown, Rsbuild, Vite, Metro, plus Node runtime support for SSR/BFF consumption. Source: https://www.infoq.com/news/2026/04/module-federation-2-stable/.
- TB-23 (inference): this is the one cluster where the "brand" and the underlying solution are the same organization; the wrapper adds first-party ergonomics but the mechanism is MF itself.

### Re.Pack (Callstack) - scope boundary

- TB-24 (officially-supported): Re.Pack 5 (Rspack-powered Metro replacement) supports MF v2 for React Native via `ModuleFederationV2Plugin`: RN-tailored shared defaults (react/react-native singleton + eager, loaded-first strategy), `reactNativeDeepImports` fix, Hermes bytecode chunking, remote preloading (5.1). Sources: https://re-pack.dev/api/plugins/module-federation-v2, https://re-pack.dev/docs/features/module-federation, https://github.com/callstack/repack.
- TB-25 (common-pattern, constraint): mobile rules still apply: React, React Native, and native-module versions must stay aligned across host and remotes; runtime delivery has app-store and security implications. Source: https://www.callstack.com/blog/mobile-module-federation-with-re-pack-when-runtime-delivery-is-worth-the-complexity.
- TB-26 (inference): out of scope for the web decision matrix except as a note that the MF family extends to native super-apps.

### Vite

- TB-27 (officially-supported): `@module-federation/vite` is the official, actively maintained plugin (1.20.x, publishing continuously), wired to the MF 2.0 runtime, with working dev server, strict shared enforcement, and remote-type consumption. Sources: https://www.npmjs.com/package/@module-federation/vite, https://module-federation.io/integrations/build-tool/vite.html.
- TB-28 (community-convention, decay): `@originjs/vite-plugin-federation` is effectively stalled: last publish ~1 year ago, no commits since 2025-05-17, 200+ open issues, open deprecation proposal (#748); its known structural limits are dev-server federation (build-output only) and best-effort shared dedup. Sources: https://github.com/originjs/vite-plugin-federation, https://www.npmjs.com/package/@originjs/vite-plugin-federation.
- TB-29 (community-convention): a third community plugin (jskits `vite-plugin-federation` 1.0) exists with an originjs compatibility shim; evidence of fragmentation, not a standard. Source: https://github.com/jskits/vite-plugin-federation.

### Astro

- TB-30 (inference, verified absence): Astro ships no MFE-branded capability; the closest official artifact is an open roadmap discussion about SSI/ESI-style multi-server composition. Community articles compose "micro-frontends" from Server Islands (server-fetched fragments) and share deps via import maps, which is really the server-side-composition family, not MF. Sources: https://github.com/withastro/roadmap/discussions/713, https://medium.com/@sergio.a.soria/composing-micro-frontends-with-astros-server-islands-88a02728436c.

### Webpack

- TB-31 (framework-guarantee): ModuleFederationPlugin has shipped inside webpack 5 core since 2020 (MF v1); MF 2.0 features (manifest, DTS, runtime plugins) require `@module-federation/enhanced`, which supersedes the builtin for new work. Sources: https://module-federation.io/, https://module-federation.io/blog/announcement.html.

### Other toolchain brands checked

- TB-32 (inference, verified absence): Turborepo has no MFE-branded feature (Vercel routes that need through Vercel Microfrontends). SvelteKit and Remix/React Router have no first-party MFE story; they appear only as supported targets of `@vercel/microfrontends`. Solid/Qwik: nothing first-party surfaced. Absence claims based on the searches above; not exhaustively fetched.

## Decision-framework implication

1. Brand resolution is mandatory. Every brand above resolves to one of three underlying families before comparison: (a) Module Federation (Nx, Modern.js, Rsbuild/Rspack, Re.Pack, Vite plugins, legacy Angular, dead nextjs-mf), (b) server/edge path routing (Next.js Multi-Zones, Vercel Microfrontends), (c) ESM + import maps (Native Federation; Astro community patterns are a server-composition cousin). Comparing "Nx" against "Module Federation" is a category error: Nx IS Module Federation plus orchestration.
2. Wrappers change DX and operational cost, not isolation semantics (inference, but grounded): every MF wrapper composes same-realm, shared-runtime JavaScript; singleton conflicts, version skew, and global-scope leakage are properties of the mechanism and survive any wrapper. Precisely: a wrapper can add build orchestration, scaffolding, type safety, dev-server behavior, deploy hooks, and shared-dependency policy enforcement; it cannot add process, realm, or DOM isolation without changing the underlying mechanism (e.g. moving to iframes or server routing). Conversely, Multi-Zones/Vercel give hard page boundaries (independent runtimes, hard navigation) and no wrapper on top restores seamless client-side module sharing.
3. Wrapper health is an independent risk axis. The mechanism can be healthy while the wrapper dies (originjs on Vite, nextjs-mf on Next.js) or the wrapper healthy while the mechanism is the legacy path (Angular + webpack MF). The matrix should score brand/wrapper maintenance separately from mechanism maturity.
4. Two brands are priced products, not libraries: Vercel Microfrontends (per routed request + per project) and Zephyr (deploy cloud). Cost enters the operational column only for these.

DECOMP: TB-01..TB-06 (Nx wraps MF; adds graph/dev-orchestration/types/deploy; converter bugs), TB-07..TB-11 (Angular: CLI does not support MF bundler integrations; Native Federation blessed-but-community; Rspack path community), TB-12 (React: no first-party), TB-13..TB-16 (Next.js: Multi-Zones first-party, Vercel product GA+priced, nextjs-mf EOL), TB-17..TB-19 (Nuxt: no first-party, Layers != independent deploy), TB-20..TB-23 (ByteDance: brand == mechanism owner), TB-24..TB-26 (Re.Pack: MF v2 for RN, scope boundary), TB-27..TB-29 (Vite: official plugin active, originjs stalled), TB-30 (Astro: none), TB-31 (webpack MF v1 builtin, enhanced supersedes), TB-32 (absence sweep), implications 1-4 (brand->family resolution mandatory; wrappers move DX/ops, never isolation; wrapper-health axis; priced products).
