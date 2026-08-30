# Native Federation

- Unit type: library
- Status (Aug 2026): active. Releases within the last 3 weeks (adapter 22.1.1 on 2026-08-11, core 4.4.1 on 2026-08-10, orchestrator 4.6.0 on 2026-08-05); project restructured into a dedicated `native-federation` GitHub org for the v4 line, with commits as recent as 2026-08-28 [E1][E7][E9].
- Availability: available
- Version / release cadence: `@angular-architects/native-federation` 22.1.1 (tracks Angular's version numbers; at least one release per Angular major, minors as needed) [E1][E2]. Core `@softarc/native-federation` 4.4.1; orchestrator `@softarc/native-federation-orchestrator` 4.6.0; esbuild adapter `@softarc/native-federation-esbuild` 4.0.0; bridge `@angular-architects/native-federation-v4` 21.2.10 (backport of v4 to Angular 20/21) [E7]. All MIT [E1][E7].
- Official links: site https://native-federation.com/ [E5]; Angular adapter repo https://github.com/native-federation/angular-adapter [E2]; core repo https://github.com/native-federation/native-federation-core [E3]; orchestrator repo https://github.com/native-federation/orchestrator [E4]; legacy v3 codebase https://github.com/angular-architects/module-federation-plugin [E2].
- Researched: 2026-08-28

Inventory correction: the inventory's status ("active") is confirmed. Two refinements: (1) the source of truth moved out of the `angular-architects/module-federation-plugin` monorepo into the `native-federation` GitHub org for v4 (old monorepo still hosts v3) [E2][E9]; (2) "bundler-agnostic" is true of the core adapter API but the only first-party adapters are esbuild-based, and the esbuild adapter repo itself is flagged "currently under construction" for v4 [E3]. Additional strengthening fact: since Nx v23, Nx dropped its own Angular Module Federation support and officially points Angular users at `@angular-architects/native-federation` [E8].

## What it is

Native Federation reimplements the mental model of webpack Module Federation (hosts, remotes, exposed modules, shared dependencies, version negotiation) on top of two web standards: EcmaScript modules and import maps. Each remote is built separately; its build emits plain ESM bundles plus a `remoteEntry.json` metadata file describing exposed modules and shared-dependency versions. At startup the host calls `initFederation`, typically pointing at a `federation.manifest.json` that maps remote names to `remoteEntry.json` URLs; the runtime fetches the metadata, resolves shared dependencies, and composes a browser import map, after which `loadRemoteModule('mfe1', './Component')` is an ordinary dynamic ESM import [E2][E4]. The build side is a bundler-agnostic core (`@softarc/native-federation`) driven through a one-function adapter interface; the maintained higher-level integration is an Angular CLI builder that delegates compilation to Angular's esbuild ApplicationBuilder [E2][E3]. A separate framework-agnostic runtime, the orchestrator, loads NF remotes into any page, including server-rendered non-JS hosts (PHP, Java, Rails) and Node via a `module.register()` loader hook [E4].

## Composition mechanics

- Composition boundary: the JS module graph. Remotes expose ESM modules by specifier ("./Component"); the boundary artifact is `remoteEntry.json` (metadata) plus ESM bundles resolved through a composed import map [E2][E3].
- Integration phase: build (per participant, independent) + runtime (composition). Integration can happen after the host ships: a dynamic host reads the manifest JSON at runtime and the manifest "can be exchanged when deploying the solution" [E2].
- Execution model: shared JS realm, shared DOM, shared document. All participants are ESM modules in one document; from the framework's perspective loading a remote "looks like traditional lazy loading" except the host does not know the remote at compile time [E2]. With the orchestrator, the host document can be server-rendered by any stack while remotes are client-side ESM; a Node entry point additionally resolves federated imports server-side [E4].

## Findings by matrix group

### Build-time coupling

- Host and remotes are built and deployed independently; the host does not need remote source, artifacts, or types at compile time. Value: Yes. [E2][E3] framework-guarantee
- Shared-dependency contract (name, version, singleton, strictVersion, requiredVersion) is baked into each participant's `remoteEntry.json` at its own build time. Value: Yes. [E2][E3] framework-guarantee
- Core build API is bundler-agnostic: any bundler can participate by supplying one `NFBuildAdapter` function and respecting `federationBuilder.externals`. Value: Yes. [E3] framework-guarantee
- First-party maintained adapters cover only esbuild (standalone `@softarc/native-federation-esbuild`, and the Angular builder which delegates to Angular CLI's esbuild ApplicationBuilder); the v4 esbuild adapter is explicitly "currently under construction". Value: Yes (esbuild-only first-party). [E3][E7] framework-guarantee
- Using webpack, Rollup, Vite, etc. as the participant bundler is a possible extension via a custom adapter, not a shipped integration; the Vite plugin referenced by the core README is third-party (`@gioboa/vite-module-federation`). Value: Conditional (you write or adopt a non-first-party adapter). [E3] possible-extension / community-convention
- The Angular adapter's version is coupled 1:1 to Angular majors/minors (22.1.x for Angular 22.1.x, etc.); upgrading Angular implies upgrading the adapter. Value: Yes. [E1][E2] framework-guarantee
- Angular floor: Angular and Angular CLI 16.1 or higher. Value: Yes. [E2] framework-guarantee
- Delegation to Angular's builder is tight enough that Angular CLI internals leak: Angular 22's default chunk-optimization pass re-bundles output after NF computes its import map, breaking singleton resolution at runtime; the documented mitigation is setting `NG_BUILD_OPTIMIZE_CHUNKS=0`. Value: Yes (documented coupling defect + workaround). [E2] framework-guarantee
- Cross-participant TypeScript type sharing for exposed modules is not part of the mechanism; no type-federation feature appears in adapter, core, or orchestrator docs. Value: No (built-in). [E2][E3][E4] inference (from documented API surface; teams share types out of band)

### Runtime coupling

- All participants execute in one shared JS realm and document; shared singletons (for example `@angular/core`) are literally the same module instance across host and remotes. Value: Yes. [E2][E3] framework-guarantee
- Shared-dependency resolution happens when the runtime processes remote entries during `initFederation` (fetch metadata, resolve versions, emit import map), not through webpack-style share-scope containers embedded in each bundle. Value: Yes. [E2][E4] framework-guarantee
- Version-mismatch strategies mirror Module Federation's mental model: fall back to the participant's own copy, reuse a semver-compatible version, or throw (singleton + strictVersion). Value: Yes. [E3] framework-guarantee
- The orchestrator runtime performs "automatic version conflict resolution and sharing based on the module federation mental model" using semver. Value: Yes. [E4][E7] framework-guarantee
- Browser support: the orchestrator uses native import maps by default (no polyfill on modern browsers) with an opt-in `shimMode` for older browsers; the Angular adapter itself ships `es-module-shims` (^2.8.0) as a dependency. Value: Conditional (shim layer engaged depending on browser/runtime). [E1][E3][E4] framework-guarantee
- Adding remotes not listed at `initFederation` time (fully late discovery within a running page) is not documented for the v4 runtime. Value: Unknown. [E2][E4]

### Isolation and failure containment

- No JS, CSS, or DOM isolation between participants: same realm, same document, full mutual visibility. Boundary definition: the only separations are ESM module scope and whatever the application layers on top. Value: No (no isolation). [E2][E3] inference (direct consequence of the documented shared-document ESM model)
- A remote that fails to load surfaces as a rejected dynamic-import promise at the lazy route/component; containment is application-level error handling and fallbacks, not a framework feature. Value: Conditional (host must implement fallbacks; official SSR guidance explicitly recommends component fallbacks). [E2][E6] inference + officially-supported (fallback recommendation)
- A faulting remote can corrupt shared singleton state or the DOM of other participants; nothing in the mechanism prevents it. Value: Yes (blast radius is the whole document). [E2][E3] inference

### Framework requirements

- Core (`@softarc/native-federation`) is framework-agnostic: "can be used with any framework and build tool". Value: Yes. [E3] framework-guarantee (claim) with examples for VanillaJS, React (with watch mode), Vite+Svelte, Vite+Angular via AnalogJS. [E3] common-pattern (author/community demo repos, not maintained product integrations)
- The only first-class, maintained, schematics-and-builder integration is Angular (`ng add`-style init schematics, `ng update` support, I18N support since 19.0.13, locale loading out of the box since 20.0.6). Value: Yes. [E2] framework-guarantee
- Mixed-framework composition is mechanically possible (any ESM module can be exposed/loaded; orchestrator loads remotes into plain HTML pages). Value: Conditional (you own the mounting contract per framework; no cross-framework lifecycle adapter is provided). [E3][E4] possible-extension

### Ownership topology fit

- Independent team deploys: each remote builds and deploys on its own cadence; the host discovers it via the environment-specific manifest without a host rebuild. Value: Yes. [E2] framework-guarantee
- Independence has a semver ceiling under singleton sharing: with `singleton: true, strictVersion: true, requiredVersion: 'auto'` (the generated default), teams must keep shared framework versions compatible or loading errors out; coordinated Angular major upgrades across teams remain necessary in the default configuration. Value: Conditional (bounded by shared-dependency semver policy). [E2][E3] framework-guarantee (the strategies) + inference (the organizational consequence)
- A host that provides libraries its remotes depend on couples them: "the remote can no longer run standalone"; the documented better default is each application sharing what it imports and letting the runtime deduplicate. Value: Yes (documented anti-pattern and remedy). [E3] officially-supported

### Migration requirements

- From webpack Module Federation: same API and schematics as `@angular-architects/module-federation`; official migration guide; switch "by simply changing your import paths". Value: Yes. [E2][E5] officially-supported
- Running Native Federation and Module Federation side by side is officially described (dedicated article). Value: Yes. [E2] officially-supported
- v3 to v4: from Angular 22 the package line migrates to the v4 rework, with an official migration guide; the older codebase stays in the legacy monorepo. Value: Yes. [E2] framework-guarantee
- v4 on older Angular: bridge package `@angular-architects/native-federation-v4` backports v4 to Angular 20 and 21 (latest 21.2.10, `v20-support` dist-tag 20.4.3); npm metadata describes the v4 bridge line as still stabilizing with breaking changes. Value: Conditional (bridge exists; maturity caveat). [E2][E7][E10] officially-supported
- Nx: works inside Nx workspaces ("successfully tested with Angular CLI projects and with Nx projects"; update `project.json` instead of `angular.json`, automatable via the `appbuilder` schematic). Value: Yes. [E2][E8] officially-supported
- Nx first-party generators for Native Federation: none. As of Nx v23, Nx removed its own Angular Module Federation support and directs Angular users to `@angular-architects/native-federation`, recommending manual migration (or AI-assisted rewrite); Nx's new consumer/provider federation generators are React-only. Value: No. [E8] officially-supported (Nx docs position)

### Deployment

- Remote artifacts are static files (ESM bundles + `remoteEntry.json`); any static host/CDN serves them; no federation-specific server component is required for CSR. Value: Yes. [E2][E3][E4] framework-guarantee
- Post-ship integration: the dynamic host reads `federation.manifest.json` at runtime; the manifest is swapped per environment at deploy time. Value: Yes. [E2] framework-guarantee
- Cross-origin remotes require CORS headers on the remote origin (ESM fetches are subject to browser same-origin rules). Value: Conditional (same-origin deployments need nothing). browser-guarantee + [E2] inference (docs use cross-port URLs throughout; CORS itself is a browser rule, not NF-specific)
- Per-environment language/locale routing is manifest-level: "in production, make sure your `federation.manifest.json` points to the right language versions of your remotes". Value: Yes. [E2] officially-supported
- Discovery beyond the flat manifest (registry/feed services) is an ecosystem extension, for example the Piral Cloud discovery service demo for Native Federation. Value: Conditional (third-party service). [E11] possible-extension

### Contracts and communication

- The inter-participant contract is (a) exposed module specifiers plus their exported symbols and (b) shared-dependency semver metadata in `remoteEntry.json`. Nothing validates exposed-module API shape across versions. Value: Yes (contract as described); No (no built-in contract validation). [E2][E3] framework-guarantee + inference (absence)
- No built-in inter-microfrontend messaging/event bus; communication uses platform primitives or shared singleton libraries, as in Module Federation practice. Value: No (built-in). [E2][E3] inference (absence from all three READMEs); shared-singleton-service communication is community-convention
- Shared mappings (sharing workspace libraries) are constrained: "only barrel imports can be shared as a mapped path" because the specifier must be resolvable by a browser import map. Value: Yes. [E3] framework-guarantee

### UX implications

- Single-document SPA composition: remotes appear as lazy routes/components in the host router; navigation and history are the host's, giving seamless in-app UX. Value: Yes. [E2] common-pattern (the documented tutorial pattern)
- Remote code is fetched on first use (lazy loading), so first navigation into a remote pays network cost for its exposed module and any not-yet-loaded shared chunks. Value: Yes. [E2][E4] framework-guarantee
- In MPA/server-rendered hosts, the orchestrator caches remote entries and dependencies in localStorage/sessionStorage so full-page navigations reuse downloads. Value: Yes. [E4] framework-guarantee

### Performance causes

- Shared packages cannot be tree-shaken (documented explicitly); oversharing is mitigated by the runtime loading only needed packages, not by shrinking them. Value: Yes. [E3] framework-guarantee
- Shared dependencies are downloaded once and reused across participants via the import map (the core value proposition). Value: Yes. [E2][E3][E5] framework-guarantee
- Code-splitting of shared dependencies is on by default and configurable globally (`chunks: false`) and per package; `denseChunking` and `denseExternals` shrink `remoteEntry.json` and let unused chunks be skipped in the final import map. Value: Yes. [E2][E3] framework-guarantee
- Build-time caching: already-built shared dependencies are cached (in `node_modules/.cache`; reusing this folder across builds is the documented speed-up). Value: Yes. [E2][E3] framework-guarantee
- The runtime adds a startup phase (fetch manifest + N remote entries, resolve versions, install import map) before the first remote import; es-module-shims adds a shim layer where engaged. Value: Yes. [E1][E4] inference (mechanically entailed by the documented flow)
- Since 22.0.6 the dev server detects linked shared packages and re-bundles them on change (previously required cache clears/restarts). Value: Yes. [E2] framework-guarantee

### Security and trust

- Remote code executes with full privileges of the host document (same realm, same origin context); the mechanism provides no sandboxing, permissioning, or capability boundary. Boundary definition: trust is organizational; loading a remote is equivalent to adding a script to your page. Value: Yes (full-trust model). [E2][E3] inference
- No integrity/signing mechanism for `remoteEntry.json` or remote bundles appears in the documentation. Value: Unknown (not documented; SRI-style hardening not described). [E2][E3][E4]
- A read-only Chrome DevTools panel for inspecting NF applications exists (observability, not security). Value: Yes. [E9] officially-supported

### SSR and delivery

- Angular SSR with (Incremental) Hydration is supported since 18@latest (18.2.3+, design backported from v19; v20 recommended with Angular 19+). Value: Yes. [E2][E6] framework-guarantee
- Scope of SSR: both the shell and the micro frontends are rendered server-side in production builds ("Both -- the micro frontend inside the shell -- is rendered on the server side"), implemented by using import maps on the server via a fork of `node-loader/import-maps`. Value: Yes. [E6] officially-supported
- Dev-server parity gap: `ng serve` "only loads the micro frontend into the shell on the client side"; component fallbacks are recommended to avoid server-side errors during development. Value: Conditional (prod-only server rendering of remotes). [E6] officially-supported
- Non-Angular/Node SSR: the orchestrator's `/node` entry point runs the same pipeline through a Node `module.register()` loader hook so federated `import(...)` resolves server-side; browser hosts can be traditional server-rendered pages (PHP, Java, Rails) with remotes loaded as client ESM. Value: Yes. [E4] framework-guarantee
- Edge/streaming SSR specifics (for example rendering NF remotes in non-Node edge runtimes) are not documented. Value: Unknown. [E4][E6]

### Operational model

- Remote discovery: `federation.manifest.json` (dynamic host) or static config; manifest is environment-swappable; the orchestrator variant reads an inline `<script type="application/json" id="mfe-manifest">` block and exposes `loadRemoteModule` via an `mfe-loader-available` event. The manifest idea is credited to the Nx team. Value: Yes. [E2][E4] framework-guarantee
- Governance: Angular Architects (Manfred Steyer) plus contributors; v4 restructure split the project into org repos (core, angular-adapter, esbuild-adapter, orchestrator, devtools, playground, website), most pushed within days of 2026-08-28; the orchestrator originates from a contributor team (topicusonderwijs lineage) and declares v4 production-stable. Value: Yes (active, small-team OSS). [E4][E9] officially-supported
- Version skew operations: `ng update` supported; adapter versions track Angular's; a playground repo continuously compiles demo apps against new majors for testing. Value: Yes. [E2] officially-supported
- Backward compatibility: the v4 orchestrator loads v3-built remotes ("fully backwards compatible"). Value: Yes. [E4] framework-guarantee

## Editions and commercial layer

None. All packages are MIT [E1][E7]. There is no commercial edition or feature gating; the commercial layer around the project is Angular Architects' consulting/workshop business, referenced from the docs, which does not gate any capability [E2]. Third-party paid services can slot in at the discovery layer (for example Piral Cloud's discovery service demo) but are not part of the project [E11].

## Family mapping (provisional)

- Primary: client-side runtime module federation (same family as webpack/rspack Module Federation; explicitly the same mental model and API surface) [E2][E5].
- Secondary: runtime composition into server-rendered MPA hosts via the orchestrator (remotes as client ESM inside PHP/Java/Rails pages), which reaches into the "islands in a classic web app" family [E4].
- Also plausibly: plugin architecture substrate (loading separately deployed plugins), named as a first-class use case [E3].
- Not: build-time composition, iframe composition, or web-components-contract composition (custom elements can be what a remote exposes, but the boundary NF defines is the ESM module graph).

## Ambiguities and decomposition candidates

- "Bundler-agnostic" must be split: (a) core adapter API is bundler-agnostic: Yes; (b) first-party maintained adapters: esbuild only, v4 adapter under construction; (c) production-grade non-Angular build integrations: community/third-party. Matrix should carry (a)-(c) separately or the single cell misleads.
- "SSR support" must be split: (a) Angular production SSR of shell and remotes: Yes; (b) dev-server SSR parity: No; (c) non-Angular Node SSR via orchestrator loader hook: Yes; (d) edge runtimes: Unknown.
- "Nx integration" must be split: (a) runs inside Nx workspaces: Yes (tested, documented); (b) first-party Nx generators/executors: No (Nx defers Angular federation to this package; Nx's own federation generators are React-only).
- "Team independence" must be split: (a) deploy independence: Yes; (b) framework-major independence under default singleton+strictVersion sharing: No/Conditional.
- "Active" must be split by package line: v4 org packages (active, fast cadence) vs v3 monorepo (maintenance/legacy).
- "Framework-agnostic" must be split: core mechanism (Yes) vs maintained first-class integration (Angular only) vs example-level support (React/Svelte/vanilla demos).

## Sources

- [E1] https://registry.npmjs.org/@angular-architects/native-federation (accessed 2026-08-28) - latest 22.1.1 published 2026-08-11; dist-tags; dependencies (@softarc/native-federation ^4.4.0, @softarc/native-federation-orchestrator ^4.5.2, es-module-shims ^2.8.0, esbuild ^0.28.0); peer @angular/build ~22.1.0; repository moved to native-federation/angular-adapter; MIT license
- [E2] https://github.com/native-federation/angular-adapter README (accessed 2026-08-28) - v4 rework starting Angular 22; version policy tracking Angular; Angular 16.1 floor; Nx tested; ApplicationBuilder delegation since 17.1; manifest/initFederation/loadRemoteModule mechanics; shareAll config; chunks/denseChunking; SSR and I18N statements; NG_BUILD_OPTIMIZE_CHUNKS=0 workaround; custom esbuild plugins; MF migration and side-by-side guides; ng update
- [E3] https://github.com/native-federation/native-federation-core README (@softarc/native-federation, accessed 2026-08-28) - framework/build-tool agnostic claim; NFBuildAdapter interface; esbuild adapter "under construction" warning; fromPackageJson sharing defaults; version-mismatch strategies; no tree-shaking of shared packages; barrel-import constraint for shared mappings; host-provides-deps anti-pattern; orchestrator as the runtime; shim mode; VanillaJS/React/Svelte/Analog examples
- [E4] https://github.com/native-federation/orchestrator README (accessed 2026-08-28) - v4.0 stable claim; framework-agnostic runtime; localStorage/sessionStorage caching for MPA hosts; semver conflict resolution; native import maps by default; Node module.register() loader hook (/node); backward compatibility with v3 remotes; mfe-manifest quickstart
- [E5] https://native-federation.com/ (accessed 2026-08-28) - positioning: ESM + import maps, independent of build tools; same API as Module Federation plugin; Angular CLI and Nx tested; SSR since v18
- [E6] https://www.angulararchitects.io/blog/ssr-and-hydration-with-native-federation-for-angular/ (accessed 2026-08-28) - shell and remotes both server-rendered in production; node-loader/import-maps fork; 18.2.3+ backport, v20 recommended; ng serve renders remotes client-side only; fallback recommendation
- [E7] https://registry.npmjs.org/ metadata for @softarc/native-federation (4.4.1, 2026-08-10), @softarc/native-federation-esbuild (4.0.0, 2026-05-24), @softarc/native-federation-orchestrator (4.6.0, 2026-08-05), @angular-architects/native-federation-v4 (21.2.10 + v20-support 20.4.3, 2026-08-11) (accessed 2026-08-28) - versions, dates, dependency graph, MIT
- [E8] https://nx.dev/docs/kb/consumer-and-provider via web search (accessed 2026-08-28) - Nx v23+: Angular Module Federation in Nx no longer supported; official pointer to @angular-architects/native-federation; no Nx Native Federation generator (manual/AI-assisted migration); @nx/react consumer/provider generators are React-only
- [E9] GitHub API: orgs/native-federation repo listing (accessed 2026-08-28) - org repos (core, angular-adapter, esbuild-adapter, orchestrator, devtools, playground, website) with push dates up to 2026-08-28; devtools = read-only Chrome panel; legacy monorepo angular-architects/module-federation-plugin last pushed 2026-08-07
- [E10] npm search summary for @angular-architects/native-federation-v4 (accessed 2026-08-28) - bridge backport to Angular 20/21; described as beta with breaking changes
- [E11] https://github.com/piral-samples/piral-cloud-native-federation-demo (accessed 2026-08-28, via GitHub search) - third-party discovery-service integration exists for NF remotes
