# Zephyr Cloud

- Unit type: product
- Status (Aug 2026): active; plugin releases within 24h of research date (zephyr-rspack-plugin 1.2.4 published 2026-08-27 [E4]) and actively expanding docs/provider list
- Availability: available (managed PaaS generally available; BYOC available for a documented provider subset; SSR worker runtime marked beta, Cloudflare-managed only [E9])
- Version / release cadence at research time: bundler plugins at 1.x (e.g. zephyr-rspack-plugin 1.2.4, 2026-08-27), frequent releases incl. canary/next dist-tags [E4]; the SaaS control plane itself is unversioned from the consumer's perspective
- Official links: docs https://docs.zephyr-cloud.io, plugins repo https://github.com/ZephyrCloudIO/zephyr-packages, site https://zephyr-cloud.io
- Researched: 2026-08-28

Layer discipline (REQ-ENT-01): Zephyr is the ops/control-plane LAYER over a federation composition layer, over a bundler layer. It does not itself define a composition boundary; it deploys, versions, resolves, and observes artifacts produced by an underlying mechanism (chiefly Module Federation). Each finding below is tagged with the layer it belongs to: [ops] control plane, [comp] composition mechanism it depends on or configures, [bundler] build-tool integration. Zephyr must not be placed in the architecture taxonomy as a composition approach; it attaches to one.

## What it is

Zephyr Cloud is a commercial deploy/versioning/orchestration platform for micro-frontends, delivered as bundler plugins plus a managed control plane and edge-serving data plane. A plugin (one line, e.g. `withZephyr()`) attaches to the bundler's hooks in "silent observation" mode: it authenticates, watches the build, then post-build extracts an asset manifest with SHA-256 content hashes and Module Federation host/remote/shared-dependency relationships, and uploads only changed content [E2]. Every build becomes an immutable, content-addressed snapshot with its own preview URL on a global edge network; environments are KV pointers from hostname to snapshot ID, so promotion and rollback are atomic pointer swaps [E1][E2]. A dashboard, browser extension, and MCP integration manage versions, tags, environments, and per-environment overrides of which remote version a host resolves at runtime [E8][E1]. Company founded August 2023 (Atlanta; CEO Zack Chapple, CTO Dmitriy Shekhovtsov); $3.5M seed led by True Ventures announced 2024-09-10 [E6].

Correction to task brief: the $3.5M seed was announced September 2024, not 2023; 2023 is the founding year [E6]. Inventory status "product / active" confirmed correct; no inventory correction needed.

## Composition mechanics

- Composition boundary: none of its own; inherits the boundary of the underlying mechanism, primarily Module Federation's shared JS module graph [E1][E10]. Docs state MFE support is "based on Module Federation," other MFE architectures "possibly already working or planned" [E1]. Static sites and non-federated apps also deploy through it (Astro, Nitro guides exist) but then it is plain hosting, not composition [E9].
- Integration phase: build-time capture, deploy-time versioning, runtime resolution. Critically, remote resolution is late-bound: the generated runtime config resolves remote URLs per environment at load time, so a remote can be re-versioned after the host ships without rebuilding the host [E2][E8]. [ops]
- Execution model: inherited from Module Federation: shared realm, shared DOM, shared document. Zephyr adds nothing to isolation. [comp]

## Findings by matrix group

### Build-time coupling

- Requires a Zephyr plugin in every participating app's bundler config: Yes [E3][E5]; officially-supported. [bundler]
- Supported bundlers as first-party plugins: webpack (`zephyr-webpack-plugin`), Rspack (`zephyr-rspack-plugin`), Vite (`vite-plugin-zephyr`), Rollup (`rollup-plugin-zephyr`), Rolldown (`zephyr-rolldown-plugin`), Parcel (`parcel-reporter-zephyr`), Re.Pack/React Native (`zephyr-repack-plugin`), plus Modern.js, Nuxt, Vinext adapters: Yes [E3]; officially-supported. [bundler]
- Plugin modifies the build output or pipeline: No (docs claim hook-attached "silent observation," post-build analysis only) [E2]; framework-guarantee per vendor docs, not independently verified; treat as vendor claim. [bundler]
- Participants must build together / share a repo: No; each app builds and deploys independently, Zephyr tracks cross-app relationships server-side [E1][E2]; officially-supported. [ops]
- Requires package.json name to exactly match the Module Federation config name: Yes [E1]; officially-supported constraint. [comp]
- Requires git metadata present at build time for deployment: Yes ("several git-related details are required") [E1]; officially-supported. [bundler]

### Runtime coupling

- Adds its own runtime coupling between participants: No; coupling remains Module Federation's (shared scope, singletons) [E1][E10]; inference from architecture docs. [comp]
- Replaces hardcoded remote URLs with dynamic per-environment resolution: Yes [E2][E8]; officially-supported. [ops]
- Host and remote can be version-resolved independently per environment (host X can pin remote at version Y without redeploying either): Yes [E2][E8]; officially-supported. [ops]

### Isolation and failure containment

- Provides JS/CSS/DOM isolation between participants: No; NA to this layer, inherited entirely from the composition mechanism [E2]; inference. [comp]
- Serving-side blast-radius control: Conditional (immutable snapshots mean a bad deploy is contained to the environment whose pointer moved; instant rollback restores the prior snapshot) [E2]; officially-supported. [ops]
- Atomic deploys (users never see mixed asset versions within one snapshot): Yes per vendor architecture docs (single pointer-swap after replication) [E2]; vendor claim, not independently verified. [ops]

### Framework requirements

- UI framework constraints: No; framework-agnostic, constraint set comes from Module Federation sharing semantics, not Zephyr [E1][E6]; officially-supported. [comp]
- React Native / mobile OTA: Yes via Re.Pack and Metro tutorials; mini-apps load at runtime without app-store updates [E1][E3]; officially-supported. [ops]

### Ownership topology fit

- Independent team deploy cadence: Yes; per-app builds, per-app versioning, org-level subscription with child organizations on Enterprise [E7][E1]; officially-supported. [ops]
- Central platform-team control point: Yes (environments, tags, promotion pipelines, permissions live in one dashboard) [E8]; officially-supported. [ops]
- Nx integration: Yes; documented partnership content since 2024-09-12 (Nx blog), recipe docs for Nx MF apps; the integration is config-level (add `withZephyr()` to the Nx-generated rspack/webpack config), not a dedicated Nx executor per available evidence [E5][E9]; officially-supported for the config path; depth beyond that Unknown. [bundler]

### Migration requirements

- Adoption cost for an existing Module Federation app: low; add plugin to bundler config, matching names, git metadata [E1][E5]; officially-supported.
- Adoption requires moving serving to Zephyr-managed or Zephyr-orchestrated infrastructure: Yes (managed edge or BYOC data plane; the control plane is always Zephyr's SaaS) [E2][E9]; officially-supported. [ops]
- Exit cost: artifacts are standard bundler output, so build layer is portable; the version/rollback/resolution workflow is proprietary and lost on exit; inference. [ops]

### Deployment

- Deploy happens as a side effect of the build (no separate deploy command): Yes [E1][E5]; officially-supported. [ops]
- Immutable versioned deploys with per-version preview URLs: Yes [E1][E2]; officially-supported. [ops]
- Sub-second deploy claims: vendor-marketed ("400ms average" at launch [E6], "sub-second" [E2]); vendor claim, no independent benchmark found; treat as Unknown magnitude, plausible mechanism (differential content-addressed upload + pointer swap). [ops]
- BYO-cloud: Conditional; data plane (workers + storage) in customer accounts with documented guides for AWS, Cloudflare, Akamai, Fastly, Netlify, Kubernetes; Azure appears in marketing but has no docs setup page as of Aug 2026; control plane always remains Zephyr-managed, so BYOC is not self-hosting [E9]; officially-supported with that boundary. [ops]
- SSR serving: Conditional; SSR worker runtime is beta and only on Zephyr's managed Cloudflare integration, not BYOC [E9]; officially-supported statement of a beta limit. [ops]
- CI-independent: Conditional; builds can run anywhere (local or CI) since deploy rides the build, GitHub automation docs exist [E9]; officially-supported. [ops]

### Contracts and communication

- Inter-MFE runtime communication: NA; out of scope for this layer (belongs to the composition/application layers). [comp]
- Version contract between host and remotes: label-based selectors resolve remotes by environment, tag, or version name (e.g. `design-system@stable`) [E8]; officially-supported. [ops]
- Deployment hooks for pipeline integration exist [E8, sidebar]; officially-supported, details Unknown. [ops]

### UX implications

- End-user-visible effect is indirect: faster/safer releases, environment-consistent asset sets; no direct UX surface; inference. [ops]

### Performance causes

- Content-addressed dedup of shared assets across MFE versions reduces transfer and enables perfect caching [E2]; vendor architecture claim. [ops]
- Edge serving via GeoDNS-routed workers with three-tier KV/snapshot/file lookup [E2]; vendor claim. [ops]
- No change to client-side federation loading cost (module graph, shared-scope negotiation unchanged); inference. [comp]

### Security and trust

- All participating builds authenticate to and upload through a third-party SaaS control plane: Yes [E2]; officially-supported; supply-chain trust in Zephyr is mandatory even under BYOC. [ops]
- Runtime version-switching (browser extension, dashboard, MCP) is permission-gated within Zephyr's org model [E1][E8]; officially-supported; granularity Unknown. [ops]
- Isolation between MFEs: No, inherited from Module Federation (shared realm); Zephyr adds no sandbox. [comp]

### SSR and delivery

- Primary model is static/edge-served client assets; SSR is beta, Cloudflare-managed only [E9]; officially-supported. [ops]
- Framework deploy guides exist beyond MFE (Astro, Nitro) [E9]; officially-supported; these are plain hosting uses. [ops]

### Operational model

- Version management: every build is a version; tags are movable pointers to versions; environments serve versions to users; promotion pipelines (dev auto, staging/prod manual) supported [E8]; officially-supported. [ops]
- Rollback: instant, pointer-swap to a retained prior snapshot [E2][E8]; officially-supported. [ops]
- Observability of federated remotes: dashboard (Mission Control) lists remotes, deployed and historical versions; Chrome-based browser extension previews/switches remote versions against a live host and publishes environment updates; Zephyr Devtools plus Module Federation Chrome devtool integration for dependency graphs [E8]; officially-supported. Extension is Chromium-only as of Aug 2026 [E8]. [ops]
- MCP integration lets AI agents inspect deployments, promote, roll back under existing permissions [E1]; officially-supported. [ops]
- Vendor viability: seed-stage ($3.5M, Sept 2024, True Ventures lead; Step Function, Ninja Capital, Night Capital) [E6]; no later round found as of Aug 2026: funding beyond seed Unknown. Control-plane dependency on a seed-stage vendor is a real operational risk dimension for the matrix. [ops]

## Editions and commercial layer

- OSS boundary: bundler plugins and utility packages are open source, Apache-2.0, in ZephyrCloudIO/zephyr-packages [E3]. The control plane, dashboard, edge data plane, and BYOC worker/storage implementations are proprietary SaaS; no evidence of an open backend [E3][E2]. The plugins are useless without the SaaS (they authenticate to the Zephyr API on init [E2]).
- Pricing (Aug 2026, from official docs [E7]): org-level subscriptions, seat-based plus usage-based (each build+deploy counts as one deployment; plans carry a deployment allowance with overage rates). Four tiers: Personal (free), two unnamed middle tiers (names/prices not in fetched docs: Unknown), Enterprise (unlimited scale, dedicated support, child organizations). Concrete dollar amounts: Unknown (not present in fetched documentation).
- Capability-to-edition mapping beyond "Enterprise gets child orgs and dedicated support": Unknown; whether BYOC is Enterprise-only is not stated in fetched docs: Unknown.
- Third-party edition interactions: Netlify integration requires Netlify Pro or Enterprise [E9].

## Family mapping (provisional)

- Primary: operational control plane over the client-side module-federation family (deploy/versioning/orchestration layer, not a composition family of its own); REQ-ENT-01 three-layer placement: layer 3 (ops) over layer 2 (Module Federation) over layer 1 (bundler).
- Secondary: generic edge static-hosting for non-federated apps (Astro/Nitro/static recipes); this is hosting, not micro-frontend composition, and should not pull Zephyr into a composition family.
- Explicit non-membership: not an isolation approach, not a routing/composition framework, not a server-composition system.

## Ambiguities and decomposition candidates

- "Version management" conflates three matrix-able properties: (a) immutable per-build snapshots, (b) movable tag/environment pointers with promotion pipelines, (c) per-environment runtime override of which remote version a host resolves. (c) is the federation-specific differentiator; (a)+(b) are generic deploy hygiene many hosts have.
- "BYO-cloud" conflates data-plane residency (customer cloud: real) with control-plane sovereignty (always Zephyr SaaS: not offered); matrix should score these separately.
- "Observability" conflates deploy-inventory observability (which versions where) with runtime telemetry (errors, performance of remotes); only the former is evidenced; the latter is Unknown despite the seed press naming "observability" as a direction.
- "Rollback" splits into serving rollback (pointer swap: evidenced) vs. compatibility rollback (does anything verify a rolled-back remote still satisfies host contracts: Unknown).
- Deploy-speed claims (400ms/sub-second) are vendor-only; matrix should carry mechanism (differential upload + atomic pointer) as supported and magnitude as Unknown.
- Nx "partnership" splits into marketing collaboration (evidenced, 2024) vs. product-level integration depth (config-level only per evidence; dedicated executor/generator Unknown).

## Sources

- [E1] https://docs.zephyr-cloud.io/ (accessed 2026-08-28) - platform overview, MF-first support, preview URLs, MCP, name-matching and git requirements
- [E2] https://docs.zephyr-cloud.io/reference/architecture (accessed 2026-08-28) - plugin observation model, SHA-256 content addressing, three-tier storage, atomic pointer-swap deploys, runtime remote resolution, BYOC data/control plane split
- [E3] https://github.com/ZephyrCloudIO/zephyr-packages (accessed 2026-08-28) - Apache-2.0 plugin monorepo; webpack/rspack/vite/rollup/rolldown/parcel/repack/modernjs/nuxt/vinext plugin list
- [E4] https://registry.npmjs.org/zephyr-rspack-plugin (accessed 2026-08-28) - latest 1.2.4 published 2026-08-27, Apache-2.0, canary/next channels
- [E5] https://nx.dev/blog/next-gen-module-federation-deployment (accessed 2026-08-28) - Nx partnership post 2024-09-12; withZephyr() in Nx rspack config; Colum Ferry quote
- [E6] https://www.prnewswire.com/news-releases/zephyr-cloud-launches-new-paas-enabling-sub-second-frontend-code-deployment-302242806.html and https://pulse2.com/zephyr-cloud-micro-frontend-deployment-company-secures-3-5-million-seed/ (accessed 2026-08-28) - $3.5M seed announced 2024-09-10, True Ventures lead, founded Aug 2023, 400ms claim, BYOC roadmap
- [E7] https://docs.zephyr-cloud.io/features/subscriptions (accessed 2026-08-28, via search excerpt) - seat+usage pricing, deployment allowances/overage, Personal free tier, Enterprise child orgs
- [E8] https://docs.zephyr-cloud.io/tools/browser-extension, /features/versions, /features/tags-environments, /features/remote-dependencies (accessed 2026-08-28, via search excerpts) - Mission Control, version switching, tags/environments/promotion pipelines, label selectors, Chromium-only extension
- [E9] https://docs.zephyr-cloud.io/cloud (+ /cloud/aws, /cloud/cloudflare, /cloud/akamai, /cloud/netlify), https://developers.netlify.com/guides/micro-frontends-with-zephyr-cloud/ (accessed 2026-08-28) - BYOC provider list (AWS, Cloudflare, Akamai, Fastly, Netlify, Kubernetes; Azure marketing-only), SSR beta Cloudflare-managed-only, Netlify Pro requirement
- [E10] https://module-federation.io/guide/deployment/zephyr (accessed 2026-08-28) - Zephyr as the featured deployment path in official Module Federation docs
