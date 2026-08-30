# Bit (bit.dev, Harmony, Bit Cloud)

- Unit type: product (OSS toolchain + commercial cloud platform; vendor: Cocycles Ltd, trading as Bit / teambit)
- Status (Aug 2026): active. Repo activity as recent as 2026-08-11; latest tagged CLI v1.13.177 (2026-05-12); bvm updated 2026-08-09; steady release notes through 2026 [E1][E2]
- Availability: available (OSS core); Bit Cloud commercial layer also available, pricing not publicly itemized [E1][E9]
- Version / release cadence: CLI 1.13.x line, frequent small releases (v1.13.5 2025-12-10, v1.13.21 2025-12-31, v1.13.58 2026-02-15, v1.13.177 2026-05-12) [E2]. Note: 2026 repo messaging has pivoted to "AI-powered development workspaces" [E1]
- Official links: docs https://bit.dev/docs, repo https://github.com/teambit/bit, cloud https://bit.cloud
- Researched: 2026-08-28

## What it is

Bit is a component-driven development platform: source code is decomposed into independently versioned "components" (each with its own dependency graph, build pipeline, semver history) that live in team-owned remote "scopes" and are consumed by other workspaces as standard npm-compatible packages. Harmony is Bit's composition framework: full-stack "aspects" (business features with browser and Node.js runtimes) are composed into a shell platform application via a manifest with dependency injection. Composition happens at BUILD time: independently developed pieces are assembled into one deployable application before deployment, not stitched in the browser at runtime. Ripple CI (a Bit Cloud service) builds exported components in the cloud and ripples builds through dependents. Bit explicitly markets this build-time composability as the successor to runtime microfrontends [E3][E4][E12][E16].

## Composition mechanics

- Composition boundary: the component (a versioned unit with its own package, API surface, and build), and at the feature level the Harmony aspect (manifest-composed, DI-wired). Ultimately the boundary is the JS module graph plus a package boundary; not an iframe, custom element, or HTTP route [E3][E16]
- Integration phase: build. A changed component is snapped/tagged, exported to its scope, built by CI, and consumers pick it up by rebuilding the consuming app. Integration after the host ships requires a new host build; there is no first-party post-ship runtime injection (pairing with Module Federation for runtime loading is a documented pattern, not the core model) [E6][E12][E14]
- Execution model: shared JS realm, shared DOM, shared document; the composed platform runs as one application (SPA or full-stack app with a Node runtime for backend aspects) [E3][E16]

## Findings by matrix group

### Build-time coupling
- Participants are assembled into a single application at build time; the deployable unit is the composed app. Yes [E3][E12]. framework-guarantee
- Each component is independently versioned (snap/tag, semver) with its own build pipeline. Yes [E1][E6]. framework-guarantee
- Components are consumed as standard npm-compatible packages, so consumer projects need not run Bit to install outputs. Yes [E7][E8-discussion-4707]. officially-supported
- A change in a shared component reaches users only after every consuming app rebuilds and redeploys. Yes [E12]. inference (direct consequence of build-time integration; vendor frames this as a feature: "safety of monoliths")
- Ripple CI automatically rebuilds dependent components when a dependency is exported (change propagation across the graph). Yes, cloud service [E6]. officially-supported

### Runtime coupling
- Default runtime model is one bundle/one realm; no framework-provided runtime boundary between components. Yes (coupled) [E3][E12]. framework-guarantee
- Post-ship independent deployment of a fragment into an already-shipped host: No by default; Conditional (pair Bit-built components with Webpack Module Federation or UMD loading; documented as a combined pattern where Bit does dev/build/versioning and Module Federation does runtime integration) [E14][E3]. common-pattern
- Existing microfrontends can be stitched into a Harmony platform via index.html or webpack config during gradual adoption. Conditional (adoption bridge, not the target architecture) [E5]. officially-supported

### Isolation and failure containment
- Runtime failure containment between components: No (shared realm and document; an exception in one component's code is an exception in the app). inference from the execution model [E3][E12]
- Dev/build-time isolation: components are built in isolated capsules with their own dependency graphs, catching integration breakage before deploy. Yes [E3][E6]. framework-guarantee (this is build isolation, not runtime isolation; do not convert)

### Framework requirements
- React is the first-class environment; Angular and Vue supported via environments (and via module federation/UMD for MFE-style consumption). Conditional (per-framework env maturity varies; React >> others) [E3]. officially-supported for existence, community signal on maturity: Unknown depth
- Harmony aspects natively target Node.js and browser runtimes, extensible to others. Yes [E16][E4]. framework-guarantee
- Mixing frameworks inside one composed platform at runtime: Unknown (docs show multi-framework component authoring; a single composed app realistically standardizes; no verified multi-framework-in-one-shell reference) 

### Ownership topology fit
- Scopes are team-owned collaboration servers; ownership is encoded in the component ID. Yes [E7]. framework-guarantee
- Lanes provide cross-scope change proposal/review (Bit's PR analog), with `bit lane import` merge-resolve tooling and bi-directional git sync (`bit ci sync`, teambit/bit-git-sync) to mirror lanes onto GitHub branches/PRs. Yes [E2][E15]. officially-supported
- Works in monorepo, polyrepo, or "without repositories at all" (component history lives in Bit's own object store, not git). Yes [E1]. officially-supported

### Migration requirements
- Gradual adoption without rewrite is the documented path: keep 100% of existing code, wrap existing packages, backend APIs, and existing microfrontends into components/aspects incrementally. Conditional (vendor claim; wrapping effort not quantified) [E5]. officially-supported (vendor)
- Full value requires adopting Bit's workspace model, component granularity, and versioning workflow across producing teams. Yes. inference from the model [E3][E7]

### Deployment
- Producer-side: export to scope triggers cloud build (Ripple); components release independently and continuously (vendor cites its own platform: 320+ features, 2000+ components, deploys every ~3 hours) [E6][E10]. officially-supported (vendor self-report)
- Consumer-side: the composed platform deploys as a normal app (any host); Bit does not dictate the app's hosting. Yes [E3]. framework-guarantee
- Ripple CI requires Bit Cloud (secrets configured at bit.cloud org settings; builds run "in the cloud"). Yes cloud-only [E6][E9]. officially-supported

### Contracts and communication
- Contracts are typed package APIs; Harmony wires aspects through a dependency-injection model, and aspects are "API centric", extendable by other aspects (slot/extension pattern). Yes [E4][E16]. framework-guarantee
- Cross-feature communication is ordinary in-process function calls/imports, not message passing across boundaries. Yes. inference from shared-realm model [E3]

### UX implications
- End users see a single cohesive app: one bundle pipeline, no per-fragment loading seams; vendor claims "optimal performance, seamless user experiences" versus runtime MFE stitching [E4]. officially-supported (vendor claim; the mechanical basis, single build, is sound)

### Performance causes
- Eliminates classic runtime-MFE costs (duplicate framework downloads, runtime orchestration) because integration happens before deploy. Yes [E12][E13]. officially-supported (vendor analysis, corroborated by mechanics)
- Build/CI cost shifts to change propagation: wide dependency ripples mean many component rebuilds per shared change (Ripple exists precisely to manage this). Yes. inference [E6]

### Security and trust
- Trust model is supply-chain-like: consuming a component is consuming code into your bundle; no runtime sandbox between components (boundary: same-realm execution, no isolation guarantee). Yes [E3]. inference
- OSS self-hosted scopes have no built-in permissions; maintainers advise a reverse proxy for access control. Yes [E8-issue-6104]. officially-supported (maintainer statement)
- RBAC, SSO/SAML, audit logs are Bit Cloud features. Yes cloud-only [E9]. officially-supported (vendor comparison; deck predates 2026, current edition split not re-verified: treat detail rows as Unknown-leaning)

### SSR and delivery
- Full-stack aspects include Node runtimes, so the composed platform can be a server-rendered or API-serving app; SSR support ultimately comes from the chosen app framework/env, not from Bit itself. Conditional [E16][E3]. inference
- No CDN/edge fragment delivery model of its own (nothing to deliver at runtime; everything is in the build). NA [E12]

### Operational model
- OSS core: CLI, workspace, local/bare scope hosting (`bit init --bare`, Docker recipe in-repo). Yes [E8-discussion-4707]. officially-supported
- Self-hosting is bare-bones: single-scope instructions, multi-scope hosting friction, no team management, no built-in registry; users must wire npm publishing themselves. Yes [E8]. community-convention (multiple GitHub issues/discussions)
- Ripple CI, hosted scopes with search/discoverability, component registry, previews/simulations are Bit Cloud services. Yes [E6][E9]. officially-supported

## Editions and commercial layer

- OSS core (Apache-2.0, teambit/bit): full CLI and workspace model, component build/version/export, bare scope server [E1][E8]
- Bit Cloud (commercial): hosted scopes, Ripple CI, component registry, search/discoverability, org/team management, RBAC, SSO-SAML, audit logs, backups, SLAs, previews [E6][E9]
- Pricing: not publicly itemized on bit.cloud as fetched; third-party listings suggest free personal tier plus subscriptions roughly $12-25/user/month, unverified. Unknown [E11]
- Lock-in shape (labeled inference): consumer-side lock-in is LOW (outputs are standard npm packages); producer-side workflow lock-in is HIGH (component history in Bit's object model rather than git, scope hosting asymmetry, cloud-only CI and governance). Escape valves exist (git-sync tooling, self-hosted bare scopes, npm outputs) but the serious-team feature set steers to the cloud [E8][E9][E15]

## Family mapping (provisional)

- Primary: build-time composition / integrated-platform family ("composable platform", the anti-runtime-MFE position) [E4][E12]
- Secondary: component marketplace/registry platform (design-system and shared-component distribution) [E7]
- Adjacent, not member: runtime microfrontends; Bit participates only as the dev/build/versioning layer paired with Module Federation [E14]
- Positioning note: Bit's own claim is that composability REPLACES microfrontends; mechanically it removes post-ship runtime integration rather than reproducing it, so it is an alternative strategy, not an MFE implementation [E4][E12]

Inventory status check: inventory row says active (provisional); confirmed active as of Aug 2026, no correction needed. Worth noting the 2026 marketing pivot toward AI development workspaces on the repo masthead [E1].

## Ambiguities and decomposition candidates

- "Independent deployment" must split: (a) producer-side independent component release (Yes) vs (b) consumer-visible post-ship deployment without host rebuild (No/Conditional via Module Federation)
- "Vendor lock-in" must split: (a) consumer artifact portability (npm packages, low), (b) producer workflow/history portability (Bit object store + scopes, high), (c) CI portability (Ripple cloud-only vs bit-git-sync on own CI)
- "Multi-framework support" must split per framework environment maturity (React first-class; Angular/Vue envs exist, depth Unknown) and authoring-vs-composed-runtime mixing
- "Composability replaces microfrontends" must split: marketing claim vs mechanical property (absence of runtime integration seam)
- "Isolation" must split: build-time capsule isolation (Yes) vs runtime failure containment (No)
- Edition boundary detail (which governance features are cloud-only in 2026) rests on a pre-2026 vendor deck; needs refresh before matrix scoring

## Sources

- [E1] https://github.com/teambit/bit (accessed 2026-08-28) - Apache-2.0 license, repo description/positioning, Ripple CI default, monorepo/polyrepo/no-repo claim, activity Aug 2026
- [E2] https://github.com/teambit/bit/releases and https://github.com/teambit/bit/tags (accessed 2026-08-28) - v1.13.x cadence through v1.13.177 (2026-05-12), lane tooling, bitmapAutoSync, release notes
- [E3] https://bit.dev/docs/composability/ (accessed 2026-08-28) - build-time composition, aspects, browser+Node runtimes, framework support, app assembly
- [E4] https://bit.dev/blog/meet-harmony-a-practical-solution-for-composability/ (accessed 2026-08-28) - Harmony announcement, manifest composition, MFE-successor positioning
- [E5] https://bit.dev/docs/harmony-platform/gradual-adoption/ (accessed 2026-08-28) - no-rewrite adoption, stitching existing MFEs
- [E6] https://bit.dev/reference/ci/ripple-ci/ (accessed 2026-08-28) - Ripple CI mechanics, cloud org settings, build-on-export
- [E7] https://bit.dev/reference/reference/scope/scope-overview/ and https://bit.dev/reference/reference/scope/running-a-scope-server/ (accessed 2026-08-28) - scopes as team-owned servers, self-hosted bare scopes
- [E8] https://github.com/teambit/bit/issues/1337, /issues/6104, /issues/5308, /discussions/4707 (accessed 2026-08-28) - self-hosting gaps, no OSS permissions (maintainer), multi-scope friction, npm publishing DIY
- [E9] https://www.slideshare.net/slideshow/bitdev-hosting-vs-oss/243352246 (accessed 2026-08-28) - vendor OSS-vs-cloud comparison deck (edition feature split; dated, treat rows as provisional)
- [E10] https://bit.dev/blog/telling-the-bit-story-celebrating-10-years-of-composability/ (accessed 2026-08-28) - vendor scale self-report (320+ features, 2000+ components, ~3h deploy frequency)
- [E11] https://alternativeto.net/software/bit/about and https://www.g2.com/products/bit-bit-cloud/pricing (accessed 2026-08-28) - third-party pricing hints; official pricing not published
- [E12] https://blog.bitsrc.io/micro-frontends-build-time-vs-runtime-integration-9bc771a1a42a (accessed 2026-08-28) - Bit-affiliated build-time vs runtime analysis
- [E13] https://devblogs.microsoft.com/startups/building-micro-frontends-with-components/ (accessed 2026-08-28) - Bit team on build-time integration ("best of both worlds", no iframes)
- [E14] https://bit.dev/blog/mastering-micro-frontends-with-module-federation-and-bit-ljn4ruah/ (accessed 2026-08-28) - Bit + Module Federation pairing pattern
- [E15] https://github.com/teambit (bit-git-sync) (accessed 2026-08-28) - lanes-to-GitHub-PR bi-directional sync via bit ci sync
- [E16] https://bit.dev/docs/harmony-intro/ (accessed 2026-08-28) - Harmony DI framework, full-stack aspects, Node+browser runtimes
