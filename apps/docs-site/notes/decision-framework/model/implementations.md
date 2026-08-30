# Implementation Catalogue

Status: DERIVED v1 (2026-08-29). Deliverable 14 (implementation catalogue, products
mapped to strategies) per MASTER.md section 16. Requirements served: REQ-ENT-02,
REQ-AVAIL-01, REQ-KEYTEST-01, plus the REQ-Q-09 duty to state how same-family
implementations differ.

Inputs: [families.md](families.md) (family ids and final cut),
[../research/landscape-inventory.md](../research/landscape-inventory.md),
[../research/solutions/toolchain-branded-wrappers.md](../research/solutions/toolchain-branded-wrappers.md),
the `unit.*` rows of [../matrix/matrix-compact.tsv](../matrix/matrix-compact.tsv)
(definitions in [../matrix/attributes.md](../matrix/attributes.md), per-cell nuance in
`../matrix/columns/<unit>.json`), and the per-unit dossiers in
[../research/solutions/](../research/solutions/). Edition and capability-attachment
vocabulary comes from [enterprise-layer.md](enterprise-layer.md) (REQ-ENT-01,
REQ-ENT-02).

Discipline:

- Families select on architecture; implementations and editions select on availability,
  maturity, editions, and operations (REQ-ENT-01). Nothing in this file may feed back
  into family definitions.
- Every entry is one unit of comparison; the universe is the landscape's, not any
  vendor's (REQ-ORCH-07). HyperFrontend is catalogued in the same shape as every
  competitor.
- All snapshot claims are as of 2026-08-28 (research snapshot); maturity facts cite
  `unit.*` matrix cells rather than restating dossier prose.

---

## 1. How to read this catalogue

### 1.1 Availability states (REQ-AVAIL-01)

Seven states, applied per unit and, where lines diverge, per release line or edition:

| State id | Meaning |
|---|---|
| `avail.available` | Obtainable and production-runnable today on a stable line |
| `avail.available-immature` | Obtainable and runnable today, but pre-1.0, beta/RC, or otherwise limited |
| `avail.announced-planned` | Publicly announced, nothing obtainable |
| `avail.future-roadmap` | Roadmap or talk-level direction only, no announcement of a deliverable |
| `avail.deprecated` | Still obtainable but formally end-of-life or superseded |
| `avail.inactive` | Obtainable artifacts persist but maintenance has effectively stopped |
| `avail.unavailable` | Not obtainable at all |

The matrix grounds these states: `unit.availability.installable-today` (y for all 30
units, so nothing in the comparison set is `avail.unavailable` as a whole unit),
`unit.availability.stable-line-shipped`, `unit.availability.single-current-line`, and
`unit.availability.planned-capability-claims`. Two states currently have no whole-unit
occupant: `avail.unavailable` (nothing scored), and `avail.future-roadmap`, which is
exercised only at capability level (module-federation's official sandbox is listed as a
future capability; web-fragments' dependency reuse and ShadowRealm adoption exist in
maintainer talks only; per-cell notes in the column files). Planned capabilities are
never scored as existing (REQ-AVAIL-01); where a planned capability fits a need that a
shipping product satisfies today, both are shown (REQ-AVAIL-02).

### 1.2 Edition and attachment vocabulary (REQ-ENT-02)

Editions are explicit records (`impl.<unit>.<edition>`); every capability attaches at
exactly one level per [enterprise-layer.md](enterprise-layer.md) section 2:
`attach.family` (inherited by all implementations of the family),
`attach.implementation` (all editions), `attach.edition` (one edition only). Two guard
rules repeat here because this file is where they bite: never mark an implementation
generally as having an edition-only capability, and never downgrade a community
edition's architectural fit for lacking managed services. Edition facts cite
`unit.editions.commercial-tier` and `unit.editions.oss-self-sufficient`.

### 1.3 Scope

The catalogue covers the 19 matrix units with `unit.type.adoptable-implementation`=y,
the two layer products, and the three graveyard illustrations (REQ-SCOPE-03). The 11
vendor-neutral strategy and baseline units (iframe-composition,
web-components-composition, server-side-fragment-composition, edge-side-composition,
reverse-proxy-route-composition, import-map-architectures, islands-architecture,
modular-monolith, monorepo-package-composition, plain-spa-routing,
server-rendered-templates) are family substance, catalogued in
[families.md](families.md), not here; where a strategy unit carries commercial
attachments (CDN ESI contracts on edge-side-composition, Vercel's productization of
reverse-proxy routing), those are recorded in its dossier and surface here only through
the branded units that realize them.

Entry fields: unit type and family id(s); availability (state per line/edition);
maturity and maintenance risk (from `unit.maintenance.*` and `unit.license.*` cells;
`?` cells are honest unknowns, `c` cells conditional with the condition named);
editions with attachment level; "differs from same-family neighbors primarily in"
(REQ-Q-09); dossier link.

---

## 2. Catalogue by family

### 2.1 `family.route-partition`

Members differ primarily in stack mandate, control plane, and pricing: the
vendor-neutral practice (reverse-proxy-route-composition, in families.md) needs any
HTTP proxy and no vendor; the two branded members below add a mandated stack and a
vendor control plane respectively.

#### `impl.nextjs-multi-zones` : Next.js Multi-Zones + Vercel Microfrontends

- **Unit type**: platform-capability. **Family**: `family.route-partition`.
- **Availability**: `avail.available` (both the OSS Multi-Zones pattern and the
  commercial Vercel platform tier; platform GA 2025-10-31, `@vercel/microfrontends`
  2.4.0).
- **Maturity/maintenance risk**: low. Active docs and package cadence
  (`unit.maintenance.release-within-12mo`=y, `commit-within-6mo`=y), Vercel-stewarded
  (`org-steward`=y, `multi-maintainer`=y), adoption above threshold
  (`adoption-scale-10k`=y, `adoption-outside-sponsor`=y). License split:
  `unit.license.osi-core`=c (routing mechanics MIT; skew fallbacks, in-network routing,
  preview routing are proprietary platform features).
- **Editions** (`unit.editions.commercial-tier`=y, `oss-self-sufficient`=y):
  - `impl.nextjs-multi-zones.oss`: Multi-Zones rewrites/assetPrefix plus the MIT
    `@vercel/microfrontends` package; self-hostable with any proxy;
    `avail.available`.
  - `impl.nextjs-multi-zones.vercel-platform`: commercial (per routed request plus per
    project). Edge routing, skew-protection fallbacks, preview routing, observability,
    toolbar attach at `attach.edition`; the routing boundary itself is
    `attach.family`.
- **Differs from same-family neighbors primarily in**: stack mandate (zones are
  first-class for Next.js, generalized to SvelteKit/React Router/Vite via the platform
  tier), a vendor-operated routing control plane versus self-managed proxy config, and
  being the only priced member of the family.
- **Dossier**: [../research/solutions/nextjs-multi-zones.md](../research/solutions/nextjs-multi-zones.md)

#### `impl.cloudflare-workers-microfrontends` : Cloudflare Workers microfrontends

- **Unit type**: platform-capability. **Family**: `family.route-partition` (router
  worker plus service bindings; edge-fragment usage is recorded under the
  edge-side-composition strategy dossier).
- **Availability**: `avail.available-immature`: shipped 2026-01, roughly seven months
  of production availability; unversioned capability with no semver line of its own
  (`unit.availability.stable-line-shipped`=n), though the underlying Workers platform
  is GA.
- **Maturity/maintenance risk**: moderate, dominated by youth. Active
  (`release-within-12mo`=y, `commit-within-6mo`=y, `org-steward`=y,
  `multi-maintainer`=y) but no external production case studies yet
  (`adoption-outside-sponsor`=?, `adoption-scale-10k`=c: platform adoption broad,
  capability uptake unevidenced). `unit.license.osi-core`=c: the router template is
  OSS; composition runs only on the proprietary Workers service.
- **Editions**: no edition split (`commercial-tier`=y through the hosting relationship
  itself; `oss-self-sufficient`=n). The capability rides Workers plans; the commercial
  coupling attaches at `attach.implementation` because the composition function cannot
  run off-platform.
- **Differs from same-family neighbors primarily in**: assembly substrate (a
  programmable edge worker rather than proxy config), the hosting lock (family
  mechanics tied to one vendor's runtime), and maturity (youngest member of the
  family).
- **Dossier**: [../research/solutions/cloudflare-workers-microfrontends.md](../research/solutions/cloudflare-workers-microfrontends.md)

### 2.2 `family.server-fragment-assembly`

Members differ primarily in assembly-tier variant (origin layout service, cache-tier
includes, edge worker), roster mediation (host-authored config versus a registry), and
actuation (mutable URLs versus immutable versions behind a pointer).

#### `impl.podium` : Podium (FINN.no)

- **Unit type**: library. **Family**: `family.server-fragment-assembly` (origin layout
  service lineage).
- **Availability**: `avail.available` (v5 line, `@podium/layout` 5.4.7 2026-07;
  `stable-line-shipped`=y, `single-current-line`=y). Some satellite packages stale or
  deprecated (dossier).
- **Maturity/maintenance risk**: moderate. Steady core cadence
  (`release-within-12mo`=y, `commit-within-6mo`=y), FINN.no-stewarded
  (`org-steward`=y), but bus factor unverified (`multi-maintainer`=?), no documented
  adopters outside the sponsor (`adoption-outside-sponsor`=?), and adoption below
  threshold (`adoption-scale-10k`=n). Single-sponsor OSS: the graveyard's
  sponsorship-shape lesson applies as risk color.
- **Editions**: none (`commercial-tier`=n, `oss-self-sufficient`=y; MIT).
- **Differs from same-family neighbors primarily in**: being the cleanest branded
  origin-layout-service realization (podlet/layout HTTP contract with context
  propagation), no registry tier, and conventional mutable-URL actuation.
- **Dossier**: [../research/solutions/podium.md](../research/solutions/podium.md)

#### `impl.opencomponents` : OpenComponents (OpenTable)

- **Unit type**: framework. **Family**: `family.server-fragment-assembly`
  (registry-mediated; client mode moves rendering into the browser while keeping the
  registry contract, one family, two operational profiles per families.md 6.3).
- **Availability**: `avail.available` with a stability caveat: `oc` 0.50.x after
  roughly 12 years, never 1.0, so semver commitments are weak by convention
  (`stable-line-shipped`=n while `single-current-line`=y and cadence is frequent).
- **Maturity/maintenance risk**: moderate. Active (`release-within-12mo`=y,
  `commit-within-6mo`=y, `org-steward`=y, `adoption-scale-10k`=y at 10.8k weekly,
  barely over threshold) but effectively single-maintainer (`multi-maintainer`=n) and
  only OpenTable production use evidenced (`adoption-outside-sponsor`=?).
- **Editions**: none (`commercial-tier`=n, `oss-self-sufficient`=y; MIT).
- **Differs from same-family neighbors primarily in**: registry mediation with
  immutable component versions and pointer-switch actuation
  (`roster.registry-mediated`, `actuation.pointer-switch`), and the optional
  client-side rendering profile; the trade is operating a registry service the other
  members do not need.
- **Dossier**: [../research/solutions/opencomponents.md](../research/solutions/opencomponents.md)

#### `impl.web-fragments` : Web Fragments (Cloudflare-sponsored)

- **Unit type**: framework. **Families**: dual-mapped by design (families.md 6.3):
  pierced-gateway mode is `family.server-fragment-assembly`; client reframing mode is
  `family.virtualized-rehosting` (hidden same-origin iframe realms whose DOM is
  projected; participant bytes transformed).
- **Availability**: `avail.available-immature`: explicitly "in beta", 0.8.2, and the
  cadence has stalled (last release 2025-11, last commit 2026-03, docs-only).
  Dependency reuse and ShadowRealm adoption are `avail.future-roadmap` (maintainer
  talks only; `planned-capability-claims`=y).
- **Maturity/maintenance risk**: elevated. `release-within-12mo`=y but
  `commit-within-6mo`=c (only a docs commit), `org-steward`=c (Cloudflare sponsorship
  stated, activity stalled), `multi-maintainer`=?, `adoption-outside-sponsor`=?
  (only sponsor-internal production use documented) against `adoption-scale-10k`=y
  (12.9k weekly). Most architecturally novel entrant, weakest continuity evidence.
- **Editions**: none (`commercial-tier`=n, `oss-self-sufficient`=y; MIT; the gateway
  explicitly runs on non-Cloudflare runtimes).
- **Differs from same-family neighbors primarily in**: dual locus (the only member
  spanning request-path piercing and client-side reframing), realm treatment in client
  mode (simulated confinement, unlike every pure fragment member), and maturity (beta
  versus decade-old neighbors).
- **Dossier**: [../research/solutions/web-fragments.md](../research/solutions/web-fragments.md)

### 2.3 `family.custom-element-composition`

The family's substance is the vendor-neutral practice (web-components-composition,
families.md 3.3). Its one platform-thick branded member differs from the practice
primarily in host inversion, registry-mediated roster, and non-developer composition:
platform overlays, not boundary changes (families.md FC-6).

#### `impl.entando` : Entando

- **Unit type**: product (open-core platform). **Family**:
  `family.custom-element-composition` plus a platform overlay (registry roster, App
  Builder composition, Kubernetes operator).
- **Availability**: `avail.available`, with the split the dossier documents: security
  and maintenance cadence current (7.5.2 2026-08-13) while feature development has been
  frozen since 7.3 (Jun 2024) and the App Builder UI is untouched since 2025-03.
- **Maturity/maintenance risk**: elevated on vendor viability. Actively patched
  (`release-within-12mo`=y, `commit-within-6mo`=y, `org-steward`=y) but
  `multi-maintainer`=? (author counts unchecked), `adoption-outside-sponsor`=?, and
  the vendor is small (~26 employees, Series B 2021, ~$3.6M ARR 2025; risk color, not
  fact). A stalled feature line on a platform you must wholesale-adopt is a real
  selection factor.
- **Editions** (`commercial-tier`=y, `oss-self-sufficient`=y):
  - `impl.entando.oss`: open-core platform code (entando / entando-k8s orgs);
    `avail.available`.
  - `impl.entando.commercial`: subscription support, curated Hub ecosystem, EOSL
    commitments at `attach.edition`. Which capabilities are commercial-only is
    Unknown (dossier); the matrix must not guess.
- **Differs from same-family neighbors primarily in**: who composes (non-developer App
  Builder versus host markup), roster authority (curated Hub registry versus
  host-authored tags), and the operational floor (Kubernetes operator and Java App
  Engine versus static hosting).
- **Dossier**: [../research/solutions/commercial-platform-illustrations.md](../research/solutions/commercial-platform-illustrations.md) (Entando section)

### 2.4 `family.module-graph-federation`

Members differ primarily in substrate (vendored container runtime versus native ESM
plus import maps), toolchain floor, SSR paths, and ecosystem size; the shared
governance burden (`coordination.shared-dependency-governance`) is family-level and no
member escapes it. The vendor-neutral import-map practice is in families.md; the
toolchain brands that resolve here are in section 3.

#### `impl.module-federation` : Module Federation (MF 1.x/2.0)

- **Unit type**: framework. **Family**: `family.module-graph-federation` (vendored
  container-runtime end).
- **Availability**: `avail.available` on the canonical line
  (`@module-federation/enhanced` 2.9.x across webpack and Rspack; official Vite
  plugin; MF 2.0 declared stable 2026-02). Divergent sub-editions
  (`single-current-line`=c): `impl.module-federation.nextjs-mf` is
  `avail.deprecated` (maintenance mode, EOL expected around end of 2026, App Router
  never supported); `impl.module-federation.originjs-vite` is `avail.inactive`
  (abandoned, open deprecation proposal). The official sandbox is
  `avail.future-roadmap` (`planned-capability-claims`=y).
- **Maturity/maintenance risk**: low on the core. `stable-line-shipped`=y,
  `release-within-12mo`=y, `commit-within-6mo`=y, `multi-maintainer`=y,
  `org-steward`=y (ByteDance Web Infra plus Zack Jackson), `adoption-scale-10k`=y,
  `adoption-outside-sponsor`=y; the largest ecosystem of any region-granular member in
  the landscape. The risk axis is per-adapter, not core: wrapper health is independent
  of mechanism health (toolchain-branded-wrappers implication 3).
- **Editions**: no commercial tier (`commercial-tier`=n, `oss-self-sufficient`=y;
  MIT). Per-bundler adapters are edition-like records, listed above where their
  availability diverges. Zephyr Cloud is a third-party layer, not an edition (2.9).
- **Differs from same-family neighbors primarily in**: an emitted container runtime
  and share-scope negotiation machinery (versus native browser resolution), a
  bundler-integration floor (`migration.bundler-change` realized through specific
  toolchains), conditional SSR and Node-runtime consumption paths, and ecosystem
  breadth.
- **Dossier**: [../research/solutions/module-federation.md](../research/solutions/module-federation.md)

#### `impl.native-federation` : Native Federation (Angular Architects)

- **Unit type**: library. **Family**: `family.module-graph-federation` (native
  ESM/import-map end; MF-compatible mental model).
- **Availability**: `avail.available` on the main line (adapter 22.1.1 tracking
  Angular 22.1, core 4.4.1, orchestrator 4.6.0, all 2026-08);
  `stable-line-shipped`=c because the v4 bridge for Angular 20/21 is beta with
  breaking changes and the v4 esbuild adapter is under construction: those pieces are
  `avail.available-immature`.
- **Maturity/maintenance risk**: moderate. Very fresh cadence
  (`release-within-12mo`=y, `commit-within-6mo`=y, `multi-maintainer`=y,
  `adoption-scale-10k`=y) but `org-steward`=c: the steward is the lead maintainer's
  own consultancy, not an independent sponsor, and `adoption-outside-sponsor`=?
  (implied by Nx's referral, not documented). Mid-restructure (new GitHub org, v4
  rework) is transition risk.
- **Editions**: none (`commercial-tier`=n, `oss-self-sufficient`=y; MIT; the
  consultancy business gates nothing).
- **Differs from same-family neighbors primarily in**: substrate (browser-native ESM
  and import maps, no vendored container runtime), an esbuild-era Angular alignment
  (`framework.esm-artifact-required` posture), and community-scale stewardship versus
  module-federation's corporate co-maintenance.
- **Dossier**: [../research/solutions/native-federation.md](../research/solutions/native-federation.md)

### 2.5 `family.lifecycle-orchestration`

Members differ primarily in orchestration thickness (library versus platform), roster
mediation (central config versus feed service), and maintenance state; the seam (the
lifecycle contract) and the level-4 participant floor are identical.

#### `impl.single-spa` : single-spa

- **Unit type**: framework. **Family**: `family.lifecycle-orchestration` (library
  end).
- **Availability**: `avail.available` on the stable 6.x line (6.0.3, semver); the
  systemjs-less v7 line is `avail.available-immature` (beta only since 2024-09).
  `single-current-line`=n: a dormant stable tag sits alongside an unshipped
  successor.
- **Maturity/maintenance risk**: high, and the family's cautionary tale. No release in
  12 months (`release-within-12mo`=n, `commit-within-6mo`=n), no org steward
  (`org-steward`=n), single-maintainer profile (`multi-maintainer`=n), a 2026-02
  community abandonment issue, dependency-health tooling already grading it inactive;
  against that, `adoption-scale-10k`=y (~367k weekly) and `adoption-outside-sponsor`=y.
  Massive installed base on a stalling project: adoption and liveness are separate
  axes, exactly the graveyard's lesson 5.
- **Editions**: none (`commercial-tier`=n, `oss-self-sufficient`=y; MIT).
- **Differs from same-family neighbors primarily in**: thickness (loader plus
  lifecycle, everything else adopter-built), no feed/registry tier, and maintenance
  state (its neighbor is actively shipped; single-spa is maintenance bordering
  inactive).
- **Dossier**: [../research/solutions/single-spa.md](../research/solutions/single-spa.md)

#### `impl.piral` : Piral (smapiot)

- **Unit type**: framework. **Family**: `family.lifecycle-orchestration` (platform
  end: pilet SDK, feed service, shell takeover).
- **Availability**: `avail.available` (1.12.3, 2026-08, monthly cadence). The
  announced Picard-based Piral v2 is `avail.announced-planned` only
  (`planned-capability-claims`=y, `single-current-line`=c): all shipping capability is
  v1.
- **Maturity/maintenance risk**: low-moderate. Active (`release-within-12mo`=y,
  `commit-within-6mo`=y, `org-steward`=y with a commercial backer,
  `adoption-scale-10k`=y at ~12k weekly) but `multi-maintainer`=? and
  `adoption-outside-sponsor`=? (downloads imply outside use; no documented adopters).
  The unshipped v2 successor resting on a dormant base library (picard-js, 2.9) is a
  roadmap-risk note, not a current-line defect.
- **Editions** (`commercial-tier`=y, `oss-self-sufficient`=y):
  - `impl.piral.oss`: the whole framework, CLI, pilet and Feed API specs, sample feed
    service; MIT; `avail.available`. Composition mechanics are fully OSS.
  - `impl.piral.cloud`: smapiot Piral Cloud hosted/managed feed service (free SaaS and
    marketplace tiers; Docker Pro EUR 3,500/year self-hosted). Centralized feature
    flags, rule management, configuration management, user management, analytics, app
    shell hosting attach at `attach.edition`; the open Feed API spec means a team can
    rebuild these (possible-extension), they just do not ship in the OSS sample.
- **Differs from same-family neighbors primarily in**: platform thickness (feed
  service and registry-mediated roster versus central config), a commercial edition
  seam, and active maintenance.
- **Dossier**: [../research/solutions/piral.md](../research/solutions/piral.md)

### 2.6 `family.virtualized-rehosting`

Members differ primarily in sandbox mechanism (proxy window, container element with
patched globals, hidden same-origin iframe realm, reframed iframe), participant
adaptation floor (HTML entry at level 1 versus lifecycle bootstrap at level 4), and
release-line health. All share the family ceiling: interference damping, never a
security boundary (REQ-MATRIX-05). web-fragments' client reframing mode belongs here;
its catalogue entry is in 2.2.

#### `impl.qiankun` : qiankun (Ant Group)

- **Unit type**: framework. **Family**: `family.virtualized-rehosting` (proxy-window
  sandbox over the single-spa lifecycle lineage; participant floor level 4).
- **Availability**: split personality. The 2.x stable line is `avail.available` but
  dormant (2.10.16, Nov 2023; `stable-line-shipped`=c); the rearchitected v3 is
  `avail.available-immature` (RC only for 3+ years, rc.21 2026-02;
  `single-current-line`=n). v3's advertised capability set (native ESM, document
  membrane, @scope CSS) is README-advertised but ships only as RC
  (`planned-capability-claims`=c).
- **Maturity/maintenance risk**: moderate with a fork in it. Repo active through
  2026-08 (`commit-within-6mo`=y, `release-within-12mo`=c: yes on the RC line, no on
  `latest`), `org-steward`=y, `adoption-scale-10k`=y (~30k weekly),
  `adoption-outside-sponsor`=y, `multi-maintainer`=?. An adopter must choose between a
  dormant stable and an unshipped successor; that choice is the risk.
- **Editions**: none (`commercial-tier`=n, `oss-self-sufficient`=y; MIT).
- **Differs from same-family neighbors primarily in**: lifecycle lineage (the only
  member requiring the bootstrap edit), the proxy-window sandbox family v2 versus the
  v3 membrane rearchitecture (an implementation-lens choice), and the largest adoption
  in the family.
- **Dossier**: [../research/solutions/qiankun.md](../research/solutions/qiankun.md)

#### `impl.micro-app-jd` : micro-app (JD.com)

- **Unit type**: framework. **Family**: `family.virtualized-rehosting` (custom-element
  container, proxy fake window; optional iframe mode borrows document-embedding
  mechanics without its trust conditions, families.md 6.3; participant floor level 1).
- **Availability**: `avail.available-immature`: the only current line is itself a
  perpetual release candidate (npm latest 1.0.0-rc.32; no stable 1.0.0 has ever
  shipped; rc suffix for 3+ years; `stable-line-shipped`=n,
  `single-current-line`=n).
- **Maturity/maintenance risk**: elevated. Slow active cadence (5 releases in 12
  months; `release-within-12mo`=y, `commit-within-6mo`=y), `org-steward`=y (JD
  open-source), but `multi-maintainer`=?, adoption modest (~4.1k weekly,
  `adoption-scale-10k`=n) though outside the sponsor (`adoption-outside-sponsor`=y).
  API surface still shifts between RCs.
- **Editions**: none (`commercial-tier`=n, `oss-self-sufficient`=y; MIT).
- **Differs from same-family neighbors primarily in**: the tag-shaped mount (a custom
  element rather than an orchestrator call), the level-1 HTML-entry floor (unmodified
  participants), and the never-stabilized release line.
- **Dossier**: [../research/solutions/micro-app-jd.md](../research/solutions/micro-app-jd.md)

#### `impl.wujie` : wujie (Tencent)

- **Unit type**: framework. **Family**: `family.virtualized-rehosting` (hidden
  same-origin iframe JS realm with shadow-DOM projection; participant floor level 1).
- **Availability**: `avail.available` (2.1.0, 2026-06; the v2 line answered the
  2024-2025 abandonment concern; `stable-line-shipped`=y, `single-current-line`=y).
- **Maturity/maintenance risk**: moderate. Bursty-but-real cadence
  (`release-within-12mo`=y, `commit-within-6mo`=y), `org-steward`=y (Tencent), but
  `multi-maintainer`=n, adoption modest (~5.6k weekly, `adoption-scale-10k`=n) with
  outside use (`adoption-outside-sponsor`=y); community forks appeared during the
  quiet period, which cuts both ways (demand exists; continuity worried people).
- **Editions**: none (`commercial-tier`=n, `oss-self-sufficient`=y; MIT).
- **Differs from same-family neighbors primarily in**: sandbox mechanism (a real
  iframe realm for JS with projected DOM, the strongest simulated confinement in the
  family and the closest technical neighbor to document embedding), keepalive
  ergonomics, and a bursty single-maintainer cadence.
- **Dossier**: [../research/solutions/wujie.md](../research/solutions/wujie.md)

### 2.7 `family.document-embedding`

Members differ primarily in orchestration thickness, contract explicitness (implicit
convention, configured navigation, or gated handshake), ecosystem alignment, and
maturity. The browser-enforced boundary and the trust honesty rule (posture, not
product, determines the trust claim; families.md 6.3) are family-level.

#### `impl.luigi` : Luigi (SAP)

- **Unit type**: framework. **Families**: mode-forked (families.md 6.3): iframe mode is
  `family.document-embedding` (primary); web-component mode is
  `family.custom-element-composition` with that family's weaker isolation.
- **Availability**: `avail.available` (core 2.31.0 2026-06, container 1.7.x through
  2026-08; `stable-line-shipped`=y, `single-current-line`=y).
- **Maturity/maintenance risk**: low-moderate. Monthly-ish cadence
  (`release-within-12mo`=y, `commit-within-6mo`=y), `org-steward`=y (SAP),
  `multi-maintainer`=y; the open question is reach: no documented non-SAP production
  adopters (`adoption-outside-sponsor`=?, `adoption-scale-10k`=n), and ecosystem
  gravity is SAP-internal (UI5 support, SAP design defaults), though nothing is
  license-gated.
- **Editions**: none (`commercial-tier`=n, `oss-self-sufficient`=y; Apache-2.0;
  whether SAP support contracts cover it is Unknown).
- **Differs from same-family neighbors primarily in**: platform thickness aimed at
  enterprise shells (navigation model, config-driven composition) with a configured
  rather than gated contract, the dual web-component mode that trades away the
  browser boundary, and corporate-ecosystem alignment.
- **Dossier**: [../research/solutions/luigi.md](../research/solutions/luigi.md)

#### `impl.hyperfrontend` : HyperFrontend

- **Unit type**: framework. **Family**: `family.document-embedding` (platform-thick;
  same-origin versus cross-origin posture moves it between containment-only and
  `trust.distinct-principal`, exactly as for the iframe practice; families.md 6.3).
- **Availability**, per edition and strictly per REQ-AVAIL-01:
  - `impl.hyperfrontend.community`: `avail.available-immature`. The `@hyperfrontend/*`
    packages (features 0.8.0) are installable and runnable today, MIT, but the line is
    pre-1.0 throughout and breaking wire changes are explicitly allowed
    (`stable-line-shipped`=n).
  - `impl.hyperfrontend.enterprise`: `avail.announced-planned`, without exception.
    Nothing is purchasable or hosted today (`unit.editions.commercial-tier`=c records
    exactly this). No Enterprise capability may be scored as existing, recommended as
    though it exists, or allowed to shadow a competitor that satisfies the need today
    (REQ-AVAIL-02).
- **Maturity/maintenance risk**: elevated, stated as plainly as for any competitor.
  Active cadence (`release-within-12mo`=y, `commit-within-6mo`=y) but
  `multi-maintainer`=n, `org-steward`=n (individual project),
  `adoption-outside-sponsor`=? (no documented production adopters), and
  `adoption-scale-10k`=? (no metrics established). By the graveyard's
  sponsorship-shape rule this is the highest-risk stewardship profile in the family.
- **Editions** (REQ-ENT-02): capability attachment per
  [enterprise-layer.md](enterprise-layer.md):
  - `attach.family`: browser-enforced document boundary and everything the family
    inherits.
  - `attach.implementation` (all editions): the gated boundary contract: descriptor,
    version stamp, connect-time compatibility gate, explicit drift error (the
    landscape's only fully gated contract per families.md 3.7), handshake, heartbeat
    watchdog, host-owned presentation model, shell packaging for buildless hosts.
  - `attach.edition` on `impl.hyperfrontend.enterprise`, every item
    `avail.announced-planned`: managed hosting (the seven `hosting.*` atoms), the
    ephemeral mediated backchannel, managed identity, deployable-feature registry
    with marketplace responsibilities, contract governance (notional v3 protocol),
    the `governance.*` atoms, embeddable admin surface. `dx.ai-dev-assist` is planned
    to span both editions, availability planned per edition.
  - Guard: Community is never downgraded architecturally for lacking these
    (REQ-ENT-02).
- **Differs from same-family neighbors primarily in**: contract explicitness (gated
  handshake with drift errors versus Luigi's configured navigation and the practice's
  conventions), lifecycle orchestration depth over the raw primitive (four-state
  liveness, flush-then-confirm teardown, host-measured geometry), and maturity plus
  stewardship (pre-1.0 single-maintainer versus Luigi's stable corporate line).
- **Dossier**: [../research/solutions/hyperfrontend.md](../research/solutions/hyperfrontend.md)

### 2.8 `family.package-composition` (baseline group)

Members differ primarily in registry realization, vendor operation of the host build,
and host inversion; the boundary (versioned package, build-fused deploy) is identical
and none provides independent deployment.

#### `impl.bit` : Bit (bit.dev)

- **Unit type**: product. **Family**: `family.package-composition`
  (registry-realized, component-level; `roster.registry-mediated` at the package
  level).
- **Availability**: `avail.available` (CLI 1.13.x, frequent releases,
  `stable-line-shipped`=y; Bit Cloud commercial layer also shipping). Note the 2026
  repo messaging pivot toward AI-powered workspaces (positioning drift, not an
  availability fact).
- **Maturity/maintenance risk**: moderate. Active (`release-within-12mo`=y,
  `commit-within-6mo`=y, `multi-maintainer`=y, `org-steward`=y) but
  `adoption-outside-sponsor`=? (only vendor self-report) and `adoption-scale-10k`=n.
- **Editions** (`commercial-tier`=y, `oss-self-sufficient`=c):
  - `impl.bit.oss`: Apache-2.0 CLI and workspace model, component
    build/version/export, bare scope server; `avail.available`. The conditional:
    self-hosting is bare-bones (no permissions, no registry UI, DIY npm publishing).
  - `impl.bit.cloud`: hosted scopes, Ripple CI, component registry,
    search/discoverability, org management, RBAC, SSO, audit logs, SLAs at
    `attach.edition`. Lock-in shape (dossier inference): consumer-side low (npm
    outputs), producer-side workflow high (object model outside git, cloud-only CI
    and governance).
- **Differs from same-family neighbors primarily in**: component-grain registry
  realization with a commercial cloud as the practical governance tier, versus plain
  workspace practice (no vendor) and commercetools' vendor-operated vertical.
- **Dossier**: [../research/solutions/bit.md](../research/solutions/bit.md)

#### `impl.commercetools-frontend` : commercetools Frontend (ex-Frontastic)

- **Unit type**: product. **Family**: `family.package-composition` (vendor-platform
  realization; platform-owned host build and delivery, host inversion; overlays per
  families.md FC-6, edition facts per REQ-ENT-01). Explicitly not an MFE runtime:
  page assembly is configuration inside one build.
- **Availability**: `avail.available` (commercial SaaS only; continuous delivery,
  `stable-line-shipped`=c: no platform semver, SDK stable at major 2).
- **Maturity/maintenance risk**: low on continuity (commercial vendor, active docs and
  tooling: `release-within-12mo`=y, `commit-within-6mo`=y, `org-steward`=y), but
  opaque (`multi-maintainer`=?: closed source; `adoption-outside-sponsor`=?: paying
  customers implied, none named). The risk axis is lock-in, decomposed in the
  dossier: code semi-portable, composition and operations platform-bound;
  self-hosting Unknown.
- **Editions**: commercial only (`commercial-tier`=y, `oss-self-sufficient`=-, no OSS
  edition exists; `unit.license.osi-core`=n). Single edition; all platform
  capabilities attach at `attach.implementation`.
- **Differs from same-family neighbors primarily in**: who operates the build and
  delivery (the vendor), the business-user composition surface (Studio page builder),
  and the mandated stack (React/Next.js); the buy-not-architect end of the baseline
  group.
- **Dossier**: [../research/solutions/commercial-platform-illustrations.md](../research/solutions/commercial-platform-illustrations.md) (commercetools section)

### 2.9 Layers (not family members; families.md 6.1)

#### `impl.zephyr-cloud` : Zephyr Cloud

- **Unit type**: product (ops/delivery layer). **Placement**:
  `family.module-graph-federation` plus a delivery-governance overlay
  (`composition.kind.inherits-underlying`); never a family member.
- **Availability**: `avail.available` (managed PaaS GA; plugin releases within 24h of
  the snapshot). BYOC available for a provider subset; the SSR worker runtime is
  `avail.available-immature` (beta, Cloudflare-managed only). Non-MF architectures and
  further observability are vendor statements at `avail.announced-planned` or looser
  (`planned-capability-claims`=y).
- **Maturity/maintenance risk**: moderate. Very active (`release-within-12mo`=y,
  `commit-within-6mo`=y, `multi-maintainer`=y, `org-steward`=y,
  `adoption-scale-10k`=y) but venture-backed with no named production adopters
  (`adoption-outside-sponsor`=?), and the structural fact that dominates:
  `oss-self-sufficient`=n. The Apache-2.0 plugins authenticate to the SaaS on init;
  the OSS code alone cannot perform the core function (`unit.license.osi-core`=c).
  Adopting Zephyr adds a vendor control plane to the release path of an otherwise OSS
  family.
- **Editions**: seat-plus-usage subscription tiers (Personal free, two unnamed middle
  tiers, Enterprise); capability-to-tier mapping largely Unknown (dossier). All
  distinctive capability (pointer-switch actuation, versioning, rollback, dependency
  resolution across MFEs) attaches at `attach.implementation` of the layer; the
  composition semantics underneath belong to the inherited family and are untouched.
- **Differs from its family's members primarily in**: not being one. It changes
  `dimension.release-actuation` and `dimension.delivery-governance` positions of a
  federation estate; it never changes the boundary, isolation, or governance burden of
  the family (toolchain-branded-wrappers implication 2).
- **Dossier**: [../research/solutions/zephyr-cloud.md](../research/solutions/zephyr-cloud.md)

#### `impl.picard-js` : Picard.js (smapiot)

- **Unit type**: library (interop orchestration layer). **Placement**: a layer
  spanning `family.module-graph-federation` and `family.lifecycle-orchestration`
  (loads MF containers, import-map manifests, SystemJS bundles, plain ESM under one
  lifecycle; families.md FC-9); owns no boundary.
- **Availability**: `avail.inactive`. Artifacts remain installable (0.2.3 on npm and
  JSR) but the last release was 2024-07, last push 2025-03, 27 weekly downloads, and
  the FAQ's own production-readiness target (Sept 2024) never shipped. Its slated role
  as the base of Piral v2 is `avail.announced-planned`
  (`planned-capability-claims`=y): strategically alive, practically dormant.
- **Maturity/maintenance risk**: maximal short of the graveyard.
  `release-within-12mo`=n, `commit-within-6mo`=n, `multi-maintainer`=n,
  `org-steward`=c (sponsorship stated, not translating into activity),
  `adoption-outside-sponsor`=? with downloads suggesting none.
- **Editions**: none (MIT; the adjacent Piral Cloud commercial surface belongs to
  `impl.piral.cloud`).
- **Value if revived**: running a mixed-format estate during format convergence; until
  then it is churn evidence with a name.
- **Dossier**: [../research/solutions/picard-js.md](../research/solutions/picard-js.md)

### 2.10 Graveyard illustrations (historical; REQ-SCOPE-03)

Not adoptable; catalogued briefly because the removal test and the maintenance-risk
attributes must account for them. Full evidence:
[../research/solutions/graveyard-illustrations.md](../research/solutions/graveyard-illustrations.md).

- **`impl.graveyard.tailor-mosaic`** (Zalando Tailor / Project Mosaic): ancestor of
  `family.server-fragment-assembly`. `avail.deprecated` (archived 2022; npm dead since
  2018). Its sponsor's published retirement rationale (heterogeneous-fragment friction
  landing on UX consistency, collaboration, onboarding) is the family's
  highest-grade negative evidence.
- **`impl.graveyard.ara-hypernova`** (Ara Framework + Airbnb Hypernova): the
  SSR-render-service branch of server-side composition, a lineage with no living OSS
  representative. `avail.inactive` (Hypernova archived 2023; Ara npm dead since
  2020). Lesson: a project whose boundary is another project's service contract
  inherits that project's lifetime (`ownership.upstream-contract-lifetime`).
- **`impl.graveyard.frintjs`** (FrintJS): build-time modular app composition, nearest
  to `family.package-composition` territory. `avail.inactive` (last activity 2018,
  never archived, still presenting as merely "mature"). Lesson: the modal death is a
  silent stall, so liveness is measured from publish/commit dates, never from README
  tone or archive flags; the `unit.maintenance.*` attributes encode exactly this.

---

## 3. Brand-alias resolution (from toolchain-branded-wrappers.md)

Users arrive with brands; the framework resolves each to its underlying family before
any comparison (comparing "Nx" to "Module Federation" is a category error: Nx IS
Module Federation plus orchestration). Wrappers change DX and operational cost, never
isolation semantics: no wrapper adds process, realm, or DOM isolation without changing
the underlying mechanism. Wrapper health is scored separately from mechanism health.

| Alias id | Brand as users say it | Underlying family | What the wrapper adds (never the boundary) | Status caveat |
|---|---|---|---|---|
| `alias.nx-mfe` | "Nx microfrontends" | `family.module-graph-federation` | Host/remote generators, project-graph-aware builds, dev-server orchestration, managed shared-lib config, MF typing, Zephyr deploy recipes | Converter generators carried open high-priority bugs across Nx 21.x |
| `alias.angular-mfe` | "Angular microfrontends" | ambiguous: `family.module-graph-federation` via Native Federation (blessed path) or webpack/Rspack MF (legacy/community); ask which | Schematics, MF-compatible API, esbuild speed, SSR/hydration (NF); helper APIs (webpack MF) | Native Federation is community-owned, featured on the official blog; Angular ships no first-party MFE feature; webpack MF locks the build to webpack |
| `alias.react-mfe` | "React microfrontends" | none first-party; community norm resolves to `family.module-graph-federation`, `family.lifecycle-orchestration`, or `family.custom-element-composition` | Nothing branded by React itself | n/a |
| `alias.nextjs-mfe` | "Next.js microfrontends" / "Vercel Microfrontends" | `family.route-partition` | Edge routing config (`microfrontends.json`), observability, local dev proxy, skew fallbacks | The federated adapter (`nextjs-mf`) is EOL-bound (~end 2026, App Router never supported); teams asking for MF-in-Next are rerouted |
| `alias.nuxt-mfe` | "Nuxt microfrontends" | none first-party; community MF-on-Vite resolves to `family.module-graph-federation`; Nuxt's own steer (Layers) is `family.modular-monolith` | Experimental async-entry flag only | Layers give no independent deployment |
| `alias.modernjs-mfe` | "Modern.js micro frontends" | `family.module-graph-federation` | Framework-integrated MF 2.0 incl. SSR | Brand and mechanism share an owner (ByteDance) |
| `alias.rspack-mf` | "Rsbuild/Rspack/webpack module federation" | `family.module-graph-federation` | First-party or built-in bundler integration | webpack 5 builtin is the v1 reference; enhanced plugin supersedes it for 2.0 |
| `alias.vite-mf` | "Vite module federation" | `family.module-graph-federation` | Official plugin: dev server, strict shared enforcement, remote types | `@originjs/vite-plugin-federation` is stalled with an open deprecation proposal; do not resolve to it |
| `alias.repack` | "Re.Pack / React Native super app" | `family.module-graph-federation` (extended to native) | RN-tailored shared defaults, Hermes bytecode chunks, OTA-style delivery | Scope boundary: out of the web matrix except as a note |
| `alias.astro-mfe` | "Astro microfrontends" | none branded; community Server-Islands patterns are `family.server-fragment-assembly` cousins | n/a | Roadmap discussion open, no feature |
| `alias.zephyr` | "Zephyr" | `family.module-graph-federation` plus delivery overlay | Deploy hooks, versioning, rollback, dependency resolution | Not a composition mechanism; see `impl.zephyr-cloud` |

Verified absences (no first-party MFE story, nothing to resolve): Turborepo, SvelteKit,
Remix/React Router, Solid, Qwik (TB-32).

---

## 4. The removal test (REQ-KEYTEST-01)

### 4.1 What remains when every branded implementation is deleted

Delete every entry in section 2, every alias row in section 3, every
representative-implementations list in families.md, and the branded rows of the
landscape inventory. What remains:

- **Seven microfrontend families** (families.md 3.1-3.7): `family.route-partition`,
  `family.server-fragment-assembly`, `family.custom-element-composition`,
  `family.module-graph-federation`, `family.lifecycle-orchestration`,
  `family.virtualized-rehosting`, `family.document-embedding`, each defined by
  composition boundary, integration phase, execution model, ownership, coordination,
  and isolation characteristics with no brand named.
- **The honest-alternatives group** (families.md 5): `family.modular-monolith`,
  `family.package-composition`, `family.spa-routing`, `family.server-templates`,
  `family.islands`.
- **Eleven vendor-neutral strategy and baseline units** that still carry matrix
  columns: iframe-composition, web-components-composition,
  server-side-fragment-composition, edge-side-composition,
  reverse-proxy-route-composition, import-map-architectures, islands-architecture,
  modular-monolith, monorepo-package-composition, plain-spa-routing,
  server-rendered-templates.
- **The model machinery**: taxonomy dimensions and poles, migration levels, topology
  model, the layer concepts as dimension-derived ideas (a delivery-governance overlay
  over an inherited boundary; an interop orchestration layer), the enterprise
  capability atoms (`hosting.*`, `governance.*`, `identity.*`, `contract.*`,
  `registry.*`) as neutral vocabulary, the seven availability states, and the
  `unit.*` attribute definitions themselves.

### 4.2 Coherence after deletion

The landscape explanation stays coherent. Every family answers the questions a decision
needs answered (what is the participant-facing contract, when do participants
integrate, where does assembly run, who owns what, what must be coordinated, what is
contained when something fails) entirely in terms of boundaries, phases, loci, realms,
and floors; those terms are defined in the taxonomy, not by products. The comparative
structure also survives: families are distinguished from their neighbors by dimension
poles (granularity, locus, realm treatment, enforcement authority), and the
recommendation logic ("your constraints favor X") operates at exactly this level
(REQ-Q-09 level one). The honest-alternatives group needs no brands at all, and eight
of the twelve families keep at least one vendor-neutral practice unit as living matrix
evidence, so the matrix itself remains populated after deletion.

Two families are concept-coherent but evidence-thin after deletion:
`family.lifecycle-orchestration` (members single-spa and piral, both branded) and
`family.virtualized-rehosting` (qiankun, micro-app-jd, wujie, web-fragments, all
branded). Their definitions survive untouched because families.md states their
boundaries, execution models, and migration floors brand-free, with brands confined to
the deletable representative lists. But every matrix column evidencing those two
families is a branded unit, so deleting the brands deletes their empirical base. This
is an honest property of the landscape, not a modeling failure: nobody ships a
vendor-neutral "lifecycle contract practice" the way nginx ships route partitioning.
It is recorded here as a verification duty (re-validation of those families' claims
concentrates entirely on branded evidence), not as a Phase 4 gate failure, because
REQ-KEYTEST-01 tests coherence of the explanation, and the explanation stands.

Two further deletions behave correctly by construction. The alias table (section 3)
empties, because aliases are brands by definition; what survives is the resolution
rule itself (a brand names a family plus a wrapper; resolve before comparing), which
is part of the model, not of any brand. And the graveyard entries vanish, but their
lessons persist as model structure: the `unit.maintenance.*` attribute family,
the sponsorship-shape and measured-liveness rules, and the implementation-lens
placement of stewardship facts (taxonomy 4.3) were derived from the graveyard and no
longer depend on it.

### 4.3 The reverse: implementations re-enter as examples

Adding implementations back changes no definition. Each entry in section 2 re-attaches
to an existing family id as an example with availability, maturity, edition, and
difference facts; the alias table repopulates; families.md's representative lists
refill. A genuinely new implementation follows the same path: a new matrix column, a
new `impl.*` entry, a family assignment, edition records; the framework is not
rewritten (REQ-Q-09). Only an implementation whose boundary matches no family triggers
model work, and then through the REQ-FAM-04 merge/split tests, not through this
catalogue.

### 4.4 Gate verdict

PASS. No Phase 4 gate failure. One recorded observation (4.2): the evidentiary
concentration of `family.lifecycle-orchestration` and `family.virtualized-rehosting`
in branded units, carried forward as a re-verification duty for matrix maintenance.

That duty was discharged on 2026-08-29: both families were re-tested against non-branded
evidence and both verdicts are KEEP AS FAMILY, with no change to any definition, member
list, or downstream binding. Method and evidence are in [families.md](families.md)
section 8; the audit record is
the completeness audit, known gap 2.
The 4.2 observation itself stands as written: the *matrix* still carries no vendor-neutral
column for either family, which is a corpus gap scheduled as additive research-refresh
work, not a coherence failure.

---

## 5. Coverage check

- 19 adoptable units (`unit.type.adoptable-implementation`=y) each appear exactly once
  in sections 2.1-2.8 (web-fragments catalogued once in 2.2 with its dual mapping
  stated), plus 2 layer products in 2.9 and 3 graveyard illustrations in 2.10.
- Every availability claim uses one of the seven REQ-AVAIL-01 states; split lines and
  editions are stated per line; HyperFrontend Enterprise is `avail.announced-planned`
  everywhere it appears.
- Every maturity claim cites `unit.*` cells; conditional and unknown cells surface as
  conditions and honest unknowns, never rounded to yes or no (REQ-MATRIX-05).
- Edition capabilities carry an attachment level per REQ-ENT-02; no entry marks an
  implementation generally with an edition-only capability.

Next stage: constraint model (deliverable 5) consumes the family and implementation
layers; implementation/edition selection stays downstream of family selection
(REQ-ENT-01).
