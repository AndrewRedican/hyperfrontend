# Commercial platform illustrations

Two vertical/commercial products treated as category illustrations rather than full framework dossiers. The shared decision insight: in some verticals the microfrontend decision is bought, not architected. Both sections follow the template but at lighter depth; findings concentrate on the properties that differ from OSS frameworks (managed hosting, governance, lock-in), per the unit brief.

---

# commercetools Frontend (ex-Frontastic)

- Unit type: product
- Status (Aug 2026): active; docs and developer tooling receive ongoing releases, and the platform is being consolidated (individual public libraries retired in favor of maintained scaffolding repos) as part of commercetools Composable Commerce [E5]
- Availability: available (commercial SaaS only; no self-serve OSS edition)
- Version / release cadence: continuous SaaS; Frontend SDK at major version 2; developer-tooling changes shipped via a rolling releases page rather than platform version numbers [E2][E5]
- Official links: docs https://docs.commercetools.com/frontend-development, Studio docs https://docs.commercetools.com/frontend-studio
- Researched: 2026-08-28

## What it is

Frontend-as-a-Service for commerce, acquired by commercetools from Frontastic in Nov 2021. Customers keep a Git repository containing one Next.js/TypeScript application; commercetools hosts the delivery layer (SSR PWA with auto-scaling) and an "API hub" backend-for-frontend whose Node.js extension runner executes customer-written data sources, actions, and dynamic page handlers [E1][E4]. Developers write React "Frontend components" (called tastics in the code base): a React component plus a JSON schema uploaded to the hosted Studio; business users then compose pages by dragging those components into layouts in the Studio page builder, and the resulting page configuration is delivered at runtime without a code deploy [E2][E3][E6]. Modularity is therefore product-level (component registry plus configuration-driven page assembly inside one app), not independently deployed frontends.

## Composition mechanics

- Composition boundary: a component registry entry (schema `tasticType` id mapped to a React component in `tastics/index.tsx`) plus a Studio-owned page configuration record; all components live in one JS module graph in one Next.js app [E2][E3]
- Integration phase: component code integrates at build time (single repo, single build); page assembly integrates at runtime via configuration, so page structure and data changes ship after the host ships, but new component code requires a redeploy of the app [E3]
- Execution model: shared JS realm, shared DOM, shared document; SSR by the hosted Next.js delivery layer; data orchestration server-side in the hosted API hub [E1]

## Findings by matrix group

Lighter treatment: groups where this product behaves like any single Next.js app (build-time coupling, isolation, UX seams) are collapsed into single findings; depth is spent on the properties that differ from OSS frameworks.

### Build-time coupling
- All Frontend components are compiled into one Next.js build; a change to shared code requires rebuilding the single app. Yes (single build artifact) [E1][E3]. claim type: framework-guarantee.
- Page composition changes require no rebuild: "all page changes are independent from code deployments, including changes to the data displayed as well as to the structure of the page". Yes [E3]. claim type: framework-guarantee.

### Runtime coupling
- Components share one React instance, one realm, one document; no isolation boundary between components. Yes (shared everything) [E1][E2]. claim type: framework-guarantee.

### Isolation and failure containment
- Failure containment between components: No (a throwing tastic fails inside the shared React tree; no platform sandbox is documented) [E2]. claim type: inference (from the single-app execution model; no containment feature found in docs).

### Framework requirements
- React/Next.js is required; the platform scaffolds and hosts a Next.js app and components are React components. Yes (React/Next mandatory) [E1][E2]. claim type: framework-guarantee.
- Polyglot frameworks per component: No [E2]. claim type: inference (registry maps ids to React components; no other renderer documented).

### Ownership topology fit
- Team split supported is developer vs business-user (code vs page composition), not team-per-frontend: Studio gives non-developers page assembly, scheduling, and URL structure ownership [E3][E6]. Conditional (fits a single frontend team plus business users; not designed for many independent engineering teams). claim type: framework-guarantee for the role split, inference for the topology limit.

### Migration requirements
- Adopting it means adopting the scaffolded repo structure, the schema format, the Studio, and the hosted API hub; it is a platform migration, not an incremental composition layer over an existing site. Yes (wholesale adoption) [E1][E2]. claim type: inference from documented onboarding (CLI scaffold, prescribed folder layout).

### Deployment
- Delivery hosting is operated by commercetools: "We provide the delivery layer that delivers your website to your customers" with SSR, auto-scaling, fail-safe hosting [E1]. Yes (managed hosting). claim type: framework-guarantee.
- Hosted environments are platform-named (production `*.frontastic.live`, staging `*.frontastic.io`, development `*.frontastic.rocks`) [E4]. Yes. claim type: framework-guarantee.
- Self-hosting the delivery layer: Unknown (not documented either way in the architecture docs) [E1]. claim type: inference (absence of documentation; do not convert to No without a sales-channel source).

### Contracts and communication
- The component contract is the JSON schema (declared data needs plus Studio-configurable fields) plus the data-source/action extension API in the API hub [E2][E4]. Yes (formalized, platform-proprietary contract). claim type: framework-guarantee.
- Extension calls are versioned via the `Commercetools-Frontend-Extension-Version` header, giving environment/version pinning between frontend and extensions [E4]. Yes. claim type: framework-guarantee.

### UX implications
- Single-app SSR PWA, so no composition seams at runtime: Yes (seamless by construction) [E1]. claim type: framework-guarantee.

### Performance causes
- Performance profile is that of one hosted SSR Next.js app; no per-fragment loading cost. NA (composition-specific performance causes do not arise) [E1]. claim type: inference.

### Security and trust
- All components run with identical privilege in one origin and one realm; the trust boundary is the organization, not the component. Yes (single trust domain) [E1]. claim type: inference from the execution model.
- Customer extension code runs server-side in the commercetools-operated extension runner, so backend code executes inside the vendor's environment [E4]. Yes. claim type: framework-guarantee.

### SSR and delivery
- SSR: Yes, provided by the managed delivery layer [E1]. claim type: framework-guarantee.

### Operational model
- Managed hosting, managed BFF, managed Studio: the customer operates only a Git repo and CI that uploads builds via the CLI (`frontastic upload`) [E1][E4]. Yes (vendor-operated platform). claim type: framework-guarantee.
- Vendor lock-in decomposition: React component code lives in the customer repo (portable with effort); page configurations, schemas, Studio content, and the extension runtime are platform-bound. Conditional (code semi-portable, composition and operations platform-bound) [E1][E2][E3]. claim type: inference.
- Third-party analysis characterizes the tight commercetools-ecosystem integration as both a strength and a dependency factor [E7]. claim type: community-convention (single analyst source; treat as color, not fact).

## Editions and commercial layer

Commercial only. commercetools Frontend is a paid product line of commercetools Composable Commerce; there is no community/OSS edition of the platform. Formerly-public helper libraries are being discontinued and folded into maintained scaffolding repos, reinforcing the packaged-product posture [E5].

## Family mapping (provisional)

- Primary: vertical Frontend-as-a-Service (bought composition; the platform owns assembly).
- Secondary: server-driven UI / configuration-composed monolith (Studio config assembles a single app at runtime).
- Explicitly not: build-time or runtime module federation; there are no independently deployed frontends.

## Ambiguities and decomposition candidates

- "Is it a microfrontend solution at all" splits into: (a) independent deployability of UI code (No), (b) independent page-composition authority for non-developers (Yes), (c) team-scaled frontend ownership (No). The matrix should carry these separately or the product falsely scores as an MFE framework.
- "Lock-in" splits into: code portability (component source in customer repo), composition portability (Studio config, proprietary), operational portability (hosting/BFF, vendor-run), each with different exit costs.
- "Self-hosting possible" is Unknown and should stay a distinct matrix cell rather than being folded into the deployment row.

---

# Entando

- Unit type: product (open-core platform)
- Status (Aug 2026): maintenance, actively patched. Correction to the inventory: the "visible signals 2021-2023" impression is wrong; releases continued into Aug 2026 (7.5.2 tagged 2026-08-13, 7.5.0 May 2026, 7.4.1 Jul 2026) [E12], but the newest line, 7.5, is self-described as "a maintenance and security release" with no new user-facing features [E9], and the App Builder repo's last commit is Mar 2025 [E13]. So: not inactive, not feature-active; security/maintenance cadence is current.
- Availability: available (OSS core + commercial support/subscription)
- Version / release cadence: 7.5.x line current (7.5.0 May 2026, 7.5.1 Jul 2026, 7.5.2 Aug 2026); 7.3 (Jun 2024) was the last feature release [E8][E9][E12]
- Official links: docs https://developer.entando.com, org repos https://github.com/entando and https://github.com/entando-k8s
- Researched: 2026-08-28

## What it is

An "application composition platform" that packages microfrontends and microservices into bundles and manages them with a Kubernetes operator. Microfrontends are custom elements (web components), generated in React by default but permitted in Angular or custom stacks; they are built into Docker-based bundle images described by an `entando.json` descriptor, alongside microservices and platform components (pages, page templates, fragments, static resources) [E10][E11]. Bundles are published to a Docker registry, surfaced through a curated Hub (public or private), installed into a running Entando instance's Local Hub via operator-managed custom resources, and then composed onto pages in the App Builder UI [E10][E11]. Since 7.3 a mediator library carries broadcast events between microfrontends on a page [E8].

## Composition mechanics

- Composition boundary: the bundle (Docker image + descriptor) at the platform level; the custom element at the page level [E10]
- Integration phase: deploy/runtime; bundles are installed into a running platform after the host ships (build → pack → publish → deploy → install) [E10]
- Execution model: shared document, shared DOM, shared JS realm per page; custom elements composed by the App Engine's page model; backends run as separate microservice containers on Kubernetes [E10][E11]

## Findings by matrix group

Lighter treatment: findings concentrate on the properties that differ from OSS composition frameworks.

### Build-time coupling
- Bundles build independently and integrate only through the descriptor and the platform's install pipeline: No shared build [E10]. claim type: framework-guarantee.

### Runtime coupling
- Microfrontends on one page share document/realm as custom elements; cross-MFE communication is broadcast events via the platform mediator library (7.3+) [E8][E10]. Yes (shared realm, event-decoupled). claim type: framework-guarantee for the event mechanism; inference for shared-realm consequences.

### Isolation and failure containment
- No hard isolation between custom elements on a page is documented: Unknown (no sandbox claim found; do not convert shared-document custom elements into "isolated") [E10]. claim type: inference.

### Framework requirements
- Framework per MFE: React generated by default; "react", "angular", or "custom" stacks are first-class in the bundle descriptor, so polyglot is Conditional (any stack that ships a custom element) [E10][E11]. claim type: officially-supported.
- Kubernetes is required: the platform is operator-managed and bundle installation runs through Kubernetes custom resources. Yes [E10][E12]. claim type: framework-guarantee.

### Ownership topology fit
- Designed for parallel teams shipping bundles into a curated catalog, with a distinct curator role assessing and publishing components to a private or public Hub [E11]. Yes (team-per-bundle plus governance roles). claim type: officially-supported (vendor-described model; verify in the field before weighting heavily).

### Migration requirements
- Adoption means adopting the platform: App Engine, App Builder, operator, Hub, bundle format. It is not an incremental layer over an existing site. Yes (wholesale adoption) [E10][E11]. claim type: inference.

### Deployment
- Deployment is operator-mediated: publish bundle image to a registry, then install via Local Hub or App Builder; lifecycle is handled by Kubernetes operators and custom resources [E10]. Yes (platform-managed deploy, self-hosted infrastructure). claim type: framework-guarantee.
- Unlike commercetools Frontend, hosting is the customer's Kubernetes cluster; the "managed" quality is the control plane, not the hosting. Yes [E10][E12]. claim type: inference from documented deployment structure.

### Contracts and communication
- The bundle descriptor (`entando.json`) is the integration contract (component types, stacks, config parameters) [E10]. Yes (formalized, platform-proprietary contract). claim type: framework-guarantee.

### UX implications
- Page composition is App Builder-managed placement of custom elements into page templates; visual coherence is a platform concern (templates, fragments) rather than a per-team CSS treaty [E10][E11]. Conditional. claim type: inference.

### Performance causes
- Unknown; no current official performance guidance was reviewed within budget. claim type: NA.

### Security and trust
- Installing a bundle grants it presence in the shared page document and a workload on the cluster; the governance answer is curation (Hub review, roles), not runtime isolation [E10][E11]. Yes (governance-by-curation). claim type: inference.
- 7.5 exists specifically to remediate CVEs (13+ critical across Apache CXF, Struts, Spring; upgrades to Java 17, Spring 6.2.1, Keycloak 24), which is evidence both of active security response and of a large legacy Java surface to patch [E9]. claim type: officially-supported.

### SSR and delivery
- Pages are served by the App Engine (Java) with client-side custom elements; modern JS-framework SSR of MFEs is not part of the model: No [E10][E12]. claim type: inference (from the architecture; not an explicit vendor statement).

### Operational model
- Customer operates Kubernetes, the App Engine, Keycloak, and the operator stack; vendor supplies releases, EOSL policy, and paid support. Yes (self-hosted platform with commercial support) [E9][E12]. claim type: framework-guarantee.
- Vendor viability signals are mixed: ~26 employees (May 2026), last funding Series B Aug 2021, reported $3.6M ARR (2025) [E14]; a Gartner Emerging Tech Impact Radar mention (Feb 2025 report) [E15]. claim type: community-convention (third-party trackers; treat as risk color, not fact).
- Feature development is paused while maintenance continues: last feature release 7.3 (Jun 2024); 7.4.x and 7.5.x are maintenance/security lines; App Builder UI untouched since Mar 2025 [E8][E9][E12][E13]. Yes. claim type: inference from release history (well-triangulated).

## Editions and commercial layer

Open-core: the platform code is open source across the entando and entando-k8s GitHub orgs [E12][E13]; the commercial layer is subscription support, the curated Hub ecosystem, and lifecycle/EOSL commitments [E11][E16]. Which specific capabilities are commercial-only was not resolved within budget: Unknown.

## Family mapping (provisional)

- Primary: platform-managed web-components composition (buy-a-platform variant of the custom-elements family).
- Secondary: portal/CMS-composed pages (App Engine page model resembles a CMS with MFE widgets).
- Adjacent: Kubernetes-native app composition (bundles also carry microservices, so it is more than a frontend solution).

## Ambiguities and decomposition candidates

- "Active vs maintenance" splits into: security patch cadence (current through Aug 2026), feature velocity (stalled since 7.3, Jun 2024), and vendor viability (small team, aging funding). A single status word hides the divergence.
- "Managed platform" splits into managed control plane (yes, operator + Hub) vs managed hosting (no, customer Kubernetes); commercetools Frontend is the mirror image, so the matrix needs both columns to compare the two.
- "Governance" splits into curation-time governance (Hub roles) vs runtime containment (none documented); scoring one as the other would overstate isolation.

## Sources

- [E1] https://docs.commercetools.com/frontend-development/architecture-and-stack (accessed 2026-08-28) - stack (Next.js/TypeScript), hosted delivery layer quote, API hub as BFF, Studio role
- [E2] https://docs.commercetools.com/frontend-development/frontend-components and https://docs.commercetools.com/frontend-development/creating-a-frontend-component (accessed 2026-08-28) - tastic anatomy, JSON schema, tasticType, registration in tastics/index.tsx, prescribed folder layout
- [E3] https://docs.commercetools.com/frontend-getting-started/development-concepts (accessed 2026-08-28) - developer vs business-user roles, page changes independent of code deployments
- [E4] https://docs.commercetools.com/frontend-development/extensions and https://docs.commercetools.com/frontend-development/cli (accessed 2026-08-28) - extension runner in the API hub, hosted environment naming (frontastic.live/.io/.rocks), extension version header, frontastic upload
- [E5] https://docs.commercetools.com/frontend-development/releases (accessed 2026-08-28) - rolling developer-tooling releases; discontinuation of individual public libraries in favor of scaffolding repos
- [E6] https://docs.commercetools.com/frontend-getting-started/studio-guide (accessed 2026-08-28) - Studio page builder drag-and-drop, no-code page composition
- [E7] https://www.commerceworm.com/articles/commercetools-guide (accessed 2026-08-28) - third-party analysis: ecosystem integration as strength and dependency factor
- [E8] https://developer.entando.com/v7.3/docs/releases/ (accessed 2026-08-28) - 7.3 feature release (multitenancy, App Builder, mediator library for broadcast events), version list including 7.5
- [E9] https://developer.entando.com/v7.5/docs/releases/ (accessed 2026-08-28) - 7.5 self-described maintenance and security release, no new user-facing features, CVE remediation, Java 17/Keycloak 24
- [E10] https://developer.entando.com/v7.3/docs/curate/bundle-details.html (accessed 2026-08-28) - bundle as smallest building block, MFEs as custom elements in Docker-based bundles, react/angular/custom stacks, entando.json descriptor, build-pack-publish-deploy-install via operators and custom resources, Local Hub
- [E11] https://developer.entando.com/v7.3/docs/ (accessed 2026-08-28) - ACP framing, Create/Curate/Compose/Consume, curator role and Hub, App Builder composition
- [E12] GitHub API, entando/app-engine releases (accessed 2026-08-28) - v7.5.2 published 2026-08-13, v7.5.1 2026-07-09, v7.4.1 2026-07-22, v7.5.0 2026-05-06; latest commit 2026-08-26
- [E13] GitHub API, entando/entando-de-app releases and entando/app-builder commits (accessed 2026-08-28) - de-app v6.6.1 2025-11-11; app-builder last commit 2025-03-14
- [E14] https://tracxn.com/d/companies/entando/__oF6LC-5rn9NLYO_zg8eciFBaxnp1IvOom9mzdQvfvHQ and https://getlatka.com/companies/entando.com (accessed 2026-08-28) - ~26 employees May 2026, Series B Aug 2021, $14.4M total funding, reported $3.6M ARR
- [E15] https://entando.com/entando-insights/press-release/entando-named-in-gartners-emerging-tech-impact-radar/ (accessed 2026-08-28) - Gartner Emerging Tech Impact Radar: Cloud-Native Platforms (Feb 2025) mention
- [E16] https://entando.com/platform-overview-document/ (accessed 2026-08-28) - commercial platform positioning, customer portal and EOSL links
