# Landscape Inventory

Deliverable 1 (REQ-SCOPE-01..04). Snapshot: August 2026. Compiled 2026-08-28 from three
discovery sweeps (branded frameworks; unbranded strategies; lists/community/commercial) plus
internal research. Per-unit dossiers live in [solutions/](solutions/) following
[solutions/TEMPLATE.md](solutions/TEMPLATE.md). Statuses marked "verify" carry lower
confidence and get re-checked during dossier research.

## Included units of comparison

### Branded frameworks, libraries, products

| Unit | Slug (dossier) | Type | Status Aug 2026 | Inclusion rationale |
|------|------|------|--------|-----------|
| HyperFrontend | `hyperfrontend` | framework | active (pre-1.0) | Subject of the framework; treated identically to competitors. Internal evidence: [hyperfrontend-thesis.md](hyperfrontend-thesis.md) |
| Module Federation (v1 legacy + 2.0 across webpack/Rspack/Vite) | `module-federation` | framework | active | Center of gravity for runtime code-sharing MFEs; MF 2.0 stable (ByteDance Web Infra + Zack Jackson); one unit with v1/v2 and per-bundler distinctions noted (incl. nextjs-mf EOL, originjs Vite plugin superseded) |
| Native Federation | `native-federation` | library | active | Bundler-agnostic ESM + import-maps federation; mainstream Angular/esbuild path (Angular Architects) |
| single-spa | `single-spa` | framework | maintenance | Canonical lifecycle/app-orchestration router; defined the category; visibly slowing (ESM beta since 2024, no built-in SSR) |
| qiankun (Ant Group) | `qiankun` | framework | active (verify) | Flagship sandboxed app-orchestration derivative of single-spa; largest CN enterprise adoption |
| micro-app (JD.com) | `micro-app-jd` | framework | active (verify) | Web-component container + sandbox; distinct from qiankun's router model; undercounted in Western lists |
| wujie (Tencent) | `wujie` | framework | maintenance (verify) | iframe JS context + shadow-DOM rendering split; closest technical neighbor to HyperFrontend's thesis; prefigures Web Fragments |
| Piral (+ smapiot feed service; incl. Picard.js) | `piral`, `picard-js` | framework / library | active / emerging | Flagship portal/plugin (pilet + feed) category with commercial backer; Picard.js is smapiot's universal orchestrator interop niche (loads MF/NF/SystemJS/single-spa artifacts) |
| Luigi (SAP) | `luigi` | framework | active (v2.29.0 Mar 2026) | Enterprise iframe-isolation shell (Core/Client over postMessage); main SAP-ecosystem answer |
| Podium (FINN.no) | `podium` | library | active | Cleanest branded representative of server-side runtime composition (podlets/layouts over HTTP) |
| OpenComponents (OpenTable) | `opencomponents` | framework | active | Registry-based independently deployed component delivery; battle-tested since 2014 |
| Bit (bit.dev, Harmony, Bit Cloud) | `bit` | product | active | Component-platform / build-time composition alternative; markets composability as MFE successor; vendor-platform lock-in caveat |
| Web Fragments | `web-fragments` | framework | emerging | Most architecturally novel 2024-2026 entrant: separate JS execution contexts sharing one DOM (fragment piercing); Cloudflare-sponsored, production use |
| Cloudflare Workers Microfrontends | `cloudflare-workers-microfrontends` | platform-capability | emerging (shipped 2026-01) | Platform-native edge composition (router worker, service bindings); researched together with `edge-side-composition` |
| Next.js Multi-Zones (+ @vercel/microfrontends) | `nextjs-multi-zones` | platform-capability | active | Mainstream route-level composition alternative to runtime federation; Vercel-maintained |
| Zephyr Cloud | `zephyr-cloud` | product | active | Main venture-backed MFE deployment/versioning control plane; the commercial ops layer over federation |
| commercetools Frontend (Frontastic) | `commercial-platform-illustrations` | product | active | Category illustration: vertical Frontend-as-a-Service; in some verticals the MFE decision is bought, not architected |
| Entando | `commercial-platform-illustrations` | product | maintenance (verify) | Category illustration: buy-a-Kubernetes-MFE-platform option |

### Vendor-neutral architectural strategies

| Unit | Slug | Status | Inclusion rationale |
|------|------|--------|-----------|
| Plain iframe composition | `iframe-composition` | active | Perennial, strongest platform isolation; the family HyperFrontend belongs to; dossier vendor-neutral |
| Web Components composition | `web-components-composition` | active | Mainstream neutral integration contract; declarative shadow DOM baseline enables SSR fragments; style isolation real, JS isolation absent |
| Server-side fragment composition | `server-side-fragment-composition` | active | Practiced (SSI, fragment services, Tailor lineage, Podium core) |
| Edge-side composition | `edge-side-composition` | active, niche | ESI persists; edge-worker fragment assembly emerging; least-populated family, said honestly |
| Reverse-proxy route composition | `reverse-proxy-route-composition` | active | Most common real-world MFE shape; Vercel made it first-party in 2026; natural migration on-ramp |
| Import-map architectures | `import-map-architectures` | active | Where post-webpack momentum went; native import maps are baseline; SystemJS in polyfill twilight |
| Islands architecture | `islands-architecture` | active | Boundary unit whose usual verdict is a redirect: not technically MFE unless fragments are separately deployed |

### Non-MFE baselines (single dossier `non-mfe-baselines.md`)

Required by REQ-Q-04: the framework must be able to recommend less architecture.

| Unit | Status | Rationale |
|------|--------|-----------|
| Modular monolith | active | Default non-MFE baseline until an organizational problem is proven (2026 practitioner consensus) |
| Monorepo package composition | active | Most of the team-ownership story at zero runtime-composition cost |
| Server-rendered templates | active | Still the majority of the web; honest content-site baseline |
| Plain SPA routing | active | Route-level code splitting already satisfies most independent-pieces asks; null hypothesis |

### Historical category illustrations (single dossier `graveyard-illustrations.md`)

Included ONLY as category illustrations / churn evidence (REQ-SCOPE-03).

| Unit | Status | Why it earns a mention |
|------|--------|------------------------|
| Zalando Tailor / Project Mosaic | deprecated (archived) | Canonical first-generation streaming fragment composition; Zalando's own retirement (heterogeneous-fragment friction) is decision evidence |
| Ara Framework (+ Hypernova) | inactive | The Hypernova-era SSR composition branch; died with Hypernova |
| FrintJS | inactive | Illustrates small-community adoption risk as a decision axis |

## Excluded units (with rationale, REQ-SCOPE-03)

| Unit | Status Aug 2026 | Exclusion rationale |
|------|--------|-----------|
| Garfish (ByteDance) | maintenance (patches ship, ~1.7k weekly downloads) | Category-redundant with qiankun/micro-app; ByteDance energy moved to MF 2.0; cited in narrative as pivot evidence |
| icestark (Alibaba) | maintenance | Tiny adoption outside ICE; nothing categorical beyond qiankun/micro-app |
| EMP (YY/efox) | inactive (no publishes 2-3y) | Thin MF wrapper; graveyard list only |
| Fronts | inactive (0.1.1, ~5y) | Dead; churn evidence only |
| @originjs/vite-plugin-federation | maintenance, superseded | Folded into module-federation dossier as historical Vite path |
| Framework-native federation modes | n/a | Not a family; folded as edition facts into branded dossiers (nextjs-mf EOL ~2026, App Router never supported; @module-federation/vite official; Angular via NF or Rspack MF) |
| Shadow DOM isolation | active | Capability, not composition strategy; folded into web-components dossier |
| Portals API | abandoned (WICG) | Never shipped cross-browser; superseded by View Transitions; recorded to prevent rediscovery |
| Fenced frames | removed (Privacy Sandbox ended Oct 2025; Chrome removal intent Aug 2026) | Never an MFE primitive in practice |
| Mashroom Server | maintenance (unverified) | Niche portal platform; named example in portal family dossier |
| ILC (Namecheap) | maintenance (unverified) | No fresh 2025-2026 signals; named example in server/edge dossiers |
| One-app / Holocron (Amex) | maintenance (unverified) | Enterprise OSS example; named in family dossier |
| Airbnb Hypernova | archived | Named inside the Ara illustration |
| PuzzleJs (Trendyol) + dead-list residue (NUT, Berial, Nuz, Micromono, Compoxure, Cellular JS, Misk Web, Scalecube-js) | dormant | Recorded so later phases do not rediscover them |

### Toolchain-branded wrapper layer (single dossier `toolchain-branded-wrappers.md`)

Added 2026-08-28 on user direction: frameworks, meta-frameworks, build tools, and monorepo
tools brand MFE capabilities that are in-house implementations or wrappers/resellers of
underlying solutions (Nx MFE generators over Module Federation; Angular via
@angular-architects/module-federation or Native Federation; Next.js Multi-Zones first-party
vs nextjs-mf third-party; Modern.js/Rsbuild built-in MF; @module-federation/vite; Re.Pack for
React Native). Users arrive knowing the brand, so the decision framework needs a
brand → underlying-strategy alias table plus an honest account of what each wrapper adds
(DX, generators, orchestration) and what it cannot change (the composition boundary).
Supersedes the earlier plan to scatter these purely as edition notes; branded dossiers still
carry their own edition facts.

## Community-signal evidence

[community-signals.md](community-signals.md) mines the Reddit r/typescript discussion of the
HyperFrontend koi pond demo (added 2026-08-28 on user direction): solutions practitioners
mention unprompted, first objections raised against isolation-first composition, and what
convinced or concerned them. Feeds question phrasing (REQ-AUD-01, REQ-Q-05) and the honest
tradeoff lists; claim type: community-convention.

## Status corrections from dossier research (2026-08-28)

Dossier research superseded these provisional sweep statuses; dossiers are authoritative:

- **wujie**: ACTIVE, not maintenance (v2.0.0 2026-06-01, v2.1.0 2026-06-15, commits through
  2026-06-16); cadence bursty with a 2024-2025 stall that spawned forks.
- **single-spa**: maintenance CONFIRMED but bordering inactive (stable stuck at 6.0.3, v7
  beta-only since Sept 2024, Feb 2026 community abandonment issue, ~367k weekly downloads
  persist).
- **qiankun**: active with a line split: stable `latest` 2.10.16 dormant since Nov 2023; v3 RC
  line actively developed (rc.21 Feb 2026, commits through 2026-08-11).
- **Native Federation**: active, mid-restructure (v4 rework, new GitHub org; adapter 22.1.1
  tracks Angular 22.1, released 2026-08-11).
- **Vercel Microfrontends**: GA was 2025-10-31 (not 2026); @vercel/microfrontends 2.4.0 MIT.

## Cross-cutting findings (feed the constraint model, not dossiers)

- **Frontend platform team as survival condition**: 2026 discourse converges on
  MFEs-without-a-platform-team drifting; encode as a gate/constraint in
  [../model/constraints.md](../model/constraints.md) (Phase 5), not as a technology unit.
- **AI-assisted development pressure**: teams consolidating frontend boundaries to ease
  AI-assisted development is a genuinely new 2026 decision input; candidate question seed for
  Phase 5.
- **Ecosystem churn is itself a decision axis**: the size of the graveyard justifies
  longevity/maintenance-risk attributes in the matrix (Phase 3).

## Counts

27 research threads producing 29 research files: 25 dossier threads (27 files, 33 comparison
units; some dossiers bundle light units) plus the toolchain-branded wrapper layer and the
community-signals evidence file (added 2026-08-28); 14 exclusions recorded with rationale.
The "framework-native federation modes" exclusion is partially superseded: per-brand edition
facts stay in branded dossiers, while the brand-alias layer now has its own dossier.
