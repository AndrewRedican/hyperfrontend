# Non-MFE Baselines

Single dossier covering the four simpler-architecture units required by REQ-Q-04 (the
framework must be able to recommend less architecture). Each unit follows the template
structure; matrix groups that do not mechanically apply to a baseline are marked NA rather
than deleted. Statuses below confirm the inventory's provisional "active" for all four
units; no correction needed.

- Unit type: architectural-strategy (all four units)
- Status (Aug 2026): active (all four); these are practiced defaults, not projects that can
  die; 2026 practitioner writing treats the modular monolith as the explicit default until
  an organizational problem is proven [E2][E4][E5]
- Availability: available (no vendor, no version; realized with commodity tooling)
- Version / release cadence: NA (strategies, not products); supporting tooling cited per unit
- Official links: NA as strategies; canonical writings cited in Sources
- Researched: 2026-08-28

Shared decision context (anchors the "recommend instead" logic):

- 2026 practitioner consensus runs monolith-first: "you shouldn't start a new project with
  microservices, even if you're sure your application will be big enough to make it
  worthwhile" (Fowler; the same premium argument is applied to frontend splits by 2025-2026
  MFE retrospectives). [E1][E2] common-pattern
- MFEs are repeatedly framed as paying for team autonomy and independent releases with
  runtime overhead and coordination complexity; the published guidance is to use them only
  when independent deployment is a hard requirement. [E3][E10][E11] common-pattern
- MFE adoption is repeatedly conditioned on affordable platform investment (a platform
  squad, sophisticated CI/CD, governance); absent that, improving monolith boundaries is
  reported as higher ROI. [E2][E10][E11] common-pattern
- Industry consolidation evidence: 2025-2026 coverage reports a significant share of
  companies consolidating microservices back toward modular monoliths (a 42% figure
  attributed to CNCF 2025 survey data; treat the exact number as secondary-source).
  [E4] community-convention

---

## Unit 1: Modular monolith

### What it is

One deployable frontend application whose codebase is partitioned into explicit modules
with enforced boundaries: each module owns a domain slice (routes, components, state,
services), exposes a deliberate public API, and is forbidden from reaching into another
module's internals. Enforcement is static: lint rules or module-boundary tooling (for
example Nx `enforce-module-boundaries` tags, dependency-cruiser, ESLint import
restrictions) fail the build on violations, and path-based ownership (CODEOWNERS) routes
review to the owning team [E7]. Everything compiles into a single artifact through one
build; there is exactly one runtime, one framework instance, one release.

### Composition mechanics

- Composition boundary: JS module graph with statically enforced import rules; ownership
  boundary is the repository path, not a deployable
- Integration phase: build only; integration cannot happen after the host ships
- Execution model: shared JS realm, shared DOM, shared document, single bundle graph

### MFE-motivating problems it already solves

- Team code ownership and blast-radius review control (module boundaries + CODEOWNERS)
- Domain isolation of source dependencies (public-API-only imports, enforced statically)
- Parallel feature development inside one repo without stepping on other teams' internals
- Per-route payload control via lazy routes (identical mechanics to Unit 4)

### What it cannot solve

- Independent deployment: any change ships the whole artifact on one release train
- Runtime autonomy: one crash domain, one framework version, one dependency graph
- Incompatible stacks: no second framework or second major version can coexist as a peer
- External ownership: a third party cannot ship code into the app after release

### Findings by matrix group

#### Build-time coupling
- All modules build in one compiler invocation with one dependency graph; a broken module
  breaks the whole build. Value: Yes (fully coupled). [E5] inference
- Module boundaries are enforceable at build time by lint/graph tooling without any runtime
  machinery. Value: Yes. [E2][E5] officially-supported

#### Runtime coupling
- All modules share one realm, one store ecosystem, one framework instance; there is no
  runtime seam between them. Value: Yes (fully coupled). inference

#### Isolation and failure containment
- No runtime failure containment between modules: an unhandled error in one module can take
  down the shared app shell. Value: No (with boundary defined as: source-level isolation
  only, zero runtime isolation). inference

#### Framework requirements
- One framework and one version for the whole application. Value: Yes (single-stack
  requirement). inference
- Cannot host incompatible stacks or staggered framework-major migrations as peers.
  Value: No. inference

#### Ownership topology fit
- Team-per-domain code ownership is fully expressible: path-scoped modules plus CODEOWNERS
  auto-request and (via branch protection) require the owning team's review. Value: Yes.
  [E7] officially-supported
- Ownership stops at the repo: it does not extend to deploy schedules or runtime operation;
  all teams share one release train. Value: No (deploy-time ownership). inference

#### Migration requirements
- Boundary mistakes are cheap to correct because moving a line inside one codebase is a
  refactor, not a redeployment topology change; this is the core monolith-first argument.
  Value: Yes (low boundary-error cost). [E1] common-pattern
- A disciplined modular monolith is the recommended staging ground for a later MFE or
  service extraction (boundaries already drawn). Value: Yes. [E2][E5] common-pattern
- Without enforcement discipline it degrades into a big ball of mud; the strategy is
  conditional on tooling-enforced boundaries. Value: Conditional (requires static boundary
  enforcement in CI). [E4][E5] community-convention

#### Deployment
- Independent deployment per module: No. The artifact is atomic; every team ships on the
  same release. framework-guarantee (of the model)
- Rollback is whole-app and therefore simple and total. Value: Yes (atomic rollback).
  inference

#### Contracts and communication
- Inter-module contracts are compile-time TypeScript APIs; breakage is caught by the
  compiler, not at runtime. Value: Yes (static contracts). inference

#### UX implications
- Single app shell, single router, single design-system instance: no seam-related UX cost
  (no nested loading states from remote fetches, no duplicate framework payloads).
  Value: Yes. inference

#### Performance causes
- No composition overhead exists to pay: one bundle graph, shared vendor chunks, no runtime
  loader. Value: Yes (zero composition tax). [E3] inference

#### Security and trust
- All code is first-party and reviewed through one pipeline; there is no runtime ingestion
  of third-party code to sandbox. Value: NA (no cross-trust boundary exists). inference

#### SSR and delivery
- SSR is whatever the single app's framework provides; no fragment-composition SSR problem
  exists. Value: Yes (unimpaired). inference

#### Operational model
- One pipeline, one monitoring surface, no version-skew matrix between fragments.
  Value: Yes (minimal operational surface). [E11] inference

### Findings that let the engine recommend it INSTEAD of MFEs (REQ-Q-04)

- If the user's motivating problem is code ownership, review boundaries, or "teams keep
  breaking each other's code", the modular monolith already solves it without any runtime
  composition cost. Value: Yes. [E2][E7] common-pattern
- If independent deployment is NOT a hard requirement (a shared release train is
  acceptable), the primary published justification for MFEs is absent. Value: Yes.
  [E3] common-pattern
- If no platform team or platform budget exists, published guidance says MFE overhead will
  dominate; prefer this baseline. Value: Yes. [E2][E10][E11] common-pattern
- If the team count is small (sources cluster around 1-2 frontend teams / under ~20
  developers), MFEs are consistently described as overhead. Value: Conditional (thresholds
  vary by source; treat as a strong-preference signal, not a hard constraint).
  [E5][E10][E11] community-convention

---

## Unit 2: Monorepo package composition

### What it is

Multiple first-class packages in one repository, composed at build time by one or more
consuming applications. Each package has its own build, tests, lint, version identity, and
owners; workspace tooling (Nx, Turborepo, pnpm/yarn workspaces) computes the dependency
graph, runs tasks only for affected packages, and caches results. The consuming app imports
packages like any dependency; the bundler statically links everything into the app's
artifact. It differs from Unit 1 by giving each unit its own toolchain lifecycle and
publishability, not just an import boundary.

### Composition mechanics

- Composition boundary: package manifest (name, exports, version) inside a workspace graph
- Integration phase: build (the consuming app's build); integration cannot happen after the
  consuming app ships
- Execution model: shared JS realm, shared DOM, single document; packages dissolve into the
  app bundle

### MFE-motivating problems it already solves

- Independent work: per-package tasks, tests, and CI (affected-graph execution) let teams
  iterate without running or even building the rest of the repo
- Team ownership: package = ownership unit; CODEOWNERS per package path [E7]
- Reuse across multiple apps in the same repo (design systems, shared domain logic)
- Versioned contracts between teams (semver on internal packages, publishable externally)

### What it cannot solve

- Independent deployment: a package change reaches users only when every consuming app
  rebuilds and redeploys
- Runtime autonomy: packages share the app's realm, framework instance, and crash domain
- Incompatible stacks inside one app artifact (a React app cannot statically link an
  Angular package as a peer UI)
- External/after-ship ownership: third parties cannot inject code at runtime

### Findings by matrix group

#### Build-time coupling
- Consumers and packages are compiled together (or against each other's build outputs) in
  one workspace graph; a breaking package change breaks consumers at build time, before
  deploy. Value: Yes (coupled, by design). inference
- Affected-graph tooling scopes CI to changed packages, giving most of the "independent
  pipelines" experience without independent artifacts. Value: Yes. [E3][E9] officially-supported

#### Runtime coupling
- At runtime the packages are indistinguishable from the app's own code: one realm, one
  framework copy, shared vendor chunks. Value: Yes (fully coupled). inference

#### Isolation and failure containment
- No runtime containment between packages. Value: No (boundary: build-time and review-time
  isolation only). inference

#### Framework requirements
- Packages targeting different frameworks can coexist in the repo, but any single consuming
  app must resolve to one coherent framework graph. Value: Conditional (repo-level polyglot
  yes; app-level polyglot no). inference

#### Ownership topology fit
- Team-per-package ownership with per-package review gates, versioning, and publishing
  rights. Value: Yes. [E7][E9] common-pattern
- Cross-organization ownership is expressible only via published package registries, and
  consumption remains build-time: the external team's update still waits on the consumer's
  next release. Value: Conditional (external authorship possible; external deployment
  impossible). inference

#### Migration requirements
- The published on-ramp to MFEs: isolate domains as packages first, then extract one
  non-critical domain as a remote to validate the architecture. Value: Yes (forward-
  compatible with MFE adoption). [E2][E11] common-pattern

#### Deployment
- Independent deployment per package: No. Reaching production requires each consumer's
  rebuild and redeploy; simultaneous atomic delivery of a shared change across all
  consumers in the repo is the model's strength and its ceiling. framework-guarantee (of
  the model)
- A monorepo may contain several independently deployed apps; that gives per-APP deploy
  independence, not per-feature-within-an-app independence (the MFE ask). Value:
  Conditional (only at whole-app granularity). [E9] inference

#### Contracts and communication
- Contracts are typed package APIs, checked by the compiler across the workspace graph on
  every change; no runtime contract negotiation exists or is needed. Value: Yes (static).
  inference

#### UX implications
- None beyond Unit 1: the user sees one app. Value: NA. inference

#### Performance causes
- Zero runtime composition tax; shared dependencies dedupe in the consumer's bundle rather
  than duplicating per fragment. Value: Yes. [E3] inference

#### Security and trust
- Same trust domain as the consuming app; no runtime code ingestion. Value: NA (no
  cross-trust boundary). inference

#### SSR and delivery
- Unimpaired: packages participate in the consumer's SSR like any module. Value: Yes.
  inference

#### Operational model
- One deploy surface per app; workspace tooling (task graph, remote cache) is the only
  platform investment, and it is commodity. Value: Yes. [E3][E9] common-pattern

### Findings that let the engine recommend it INSTEAD of MFEs (REQ-Q-04)

- If the motivating problem is "teams need to work independently" (build, test, review,
  version in parallel), package composition delivers that at zero runtime cost; only the
  deployment moment stays shared. Value: Yes. [E2][E3][E9] common-pattern
- If reuse across apps (design system, shared widgets) is the motivation, packages are the
  purpose-built answer; MFE runtime sharing is not required. Value: Yes. [E3] common-pattern
- If acceptable release cadence is "every consumer redeploys within its normal cycle"
  rather than "the owning team ships to production alone", the deployment argument for MFEs
  is absent. Value: Yes. [E3] inference

---

## Unit 3: Server-rendered templates

### What it is

The pre-SPA default that still describes most of the web: a server-side application (any
stack: Rails, Django, Laravel, Spring MVC, PHP/WordPress, Go templates) renders full HTML
documents per request from a template hierarchy (layouts, partials/includes), and
navigation is full-page loads. JavaScript is optional per-page progressive enhancement.
W3Techs measures React on 6.1%, Vue on 0.6%, and Angular on 0.2% of all websites as of
2026-08-28, supporting the inference that the large majority of the web is not a
client-rendered SPA [E6].

### Composition mechanics

- Composition boundary: template/partial include within one server codebase; per-request
  HTML document
- Integration phase: build/deploy of the one server app; request-time template assembly is
  internal, not a cross-deployable seam
- Execution model: server-composed single document; minimal or page-scoped client JS; each
  navigation is a fresh document (a natural per-page failure and memory boundary)

### MFE-motivating problems it already solves

- Per-page payload discipline by construction (each page ships only its own assets)
- Team ownership via template/controller path ownership and CODEOWNERS [E7]
- Fast first paint and SEO without any hydration machinery
- A page-level seam: because every navigation is a full document, different pages can later
  be served by different apps behind a proxy without the user noticing

### What it cannot solve

- Independent deployment of parts of one app (single deployable, like Unit 1)
- Rich cross-view client state and app-like interaction continuity
- Runtime autonomy or polyglot client frameworks within a page
- External runtime ownership of page regions

### Findings by matrix group

#### Build-time coupling
- All templates and controllers build and deploy as one server application. Value: Yes
  (fully coupled). inference

#### Runtime coupling
- Pages are runtime-decoupled from each other by the full-page navigation model: no shared
  client state survives navigation, so one page's JS cannot corrupt another's. Value: Yes
  (per-page decoupling, uniquely among the four baselines). browser-guarantee

#### Isolation and failure containment
- A JS failure is contained to the current page and cleared by the next navigation; server
  errors are contained per request. Value: Yes (boundary: page/request granularity, not
  intra-page). browser-guarantee / inference

#### Framework requirements
- No client framework required at all; any page may independently adopt one as
  enhancement. Value: Yes (framework-optional). common-pattern

#### Ownership topology fit
- Template-path ownership works like module ownership (Unit 1); the shared layout is the
  central chokepoint. Value: Yes (code ownership), No (deploy ownership). [E7] inference

#### Migration requirements
- Honest content-site baseline: for content-shaped products this is the destination, not a
  waypoint. Value: Yes. [E6] inference
- The full-document page seam is the natural on-ramp to reverse-proxy route composition
  (put a proxy in front, peel routes to separate apps); no client rewrite required.
  Value: Yes (cheap escape hatch toward MFE-adjacent shapes). common-pattern

#### Deployment
- Independent deployment of page groups within the one app: No (atomic deployable).
  framework-guarantee (of the model)

#### Contracts and communication
- Inter-page communication is URL, cookies, and server session; there is no client
  inter-fragment contract to design. Value: NA (no client contract surface). inference

#### UX implications
- Full-page navigation costs app-like continuity (persistent players, live widgets,
  instant transitions); this is the main capability ceiling. Value: No (no persistent
  client shell). inference

#### Performance causes
- No hydration, no client router, no duplicate framework payloads; per-page cost is
  whatever that page includes. Value: Yes (structurally lean). [E6] inference

#### Security and trust
- Single first-party trust domain; composition of third-party content happens server-side
  under the owner's review. Value: NA (no runtime cross-trust boundary). inference

#### SSR and delivery
- SSR is the native mode, not a feature to add; no fragment-streaming or
  hydration-coordination problem exists. Value: Yes. inference

#### Operational model
- One server app to run and observe. Value: Yes (minimal). inference

### Findings that let the engine recommend it INSTEAD of MFEs (REQ-Q-04)

- If the product is content-shaped (pages, forms, documents; no persistent app shell
  requirement), server templates meet the requirements with the least architecture; the
  majority of the web operates this way. Value: Yes. [E6] inference
- If the user's isolation ask is "one broken page must not break the others", full-page
  navigation already provides that boundary for free. Value: Yes. browser-guarantee
- If future team-scale pressure is plausible, the page seam plus a reverse proxy reaches
  route-level independence later without adopting an MFE framework now. Value: Yes.
  common-pattern

---

## Unit 4: Plain SPA routing

### What it is

A single-page application using its router's built-in lazy loading as the only
decomposition mechanism: each route (or route subtree) is a dynamically imported chunk that
the bundler code-splits and the router fetches on first navigation. This is first-party,
documented behavior in every major ecosystem: React `lazy()` + `Suspense` around route
components, Angular `loadChildren`/`loadComponent` accepting a dynamic `import()`, Vue
Router route components declared as `() => import(...)` [E8][E9b]. It is the null
hypothesis for "we need to split the frontend into independent pieces": the pieces exist,
load independently, and can be owned independently, inside one deployable.

### Composition mechanics

- Composition boundary: route-level dynamic import chunk within one app's bundle graph
- Integration phase: build (chunking) plus lazy fetch at runtime; the set of chunks is
  fixed at build time and cannot grow after the host ships
- Execution model: shared JS realm, shared DOM, shared document, one framework instance;
  chunks are loading units, not isolation units

### MFE-motivating problems it already solves

- Code splitting and payload scaling: users download only visited routes' code, with
  official framework support and no extra infrastructure [E8][E9b]
- Feature-level lazy boundaries (route subtrees map naturally to team domains)
- Combined with Unit 1/Unit 2 boundaries and CODEOWNERS, per-route team ownership [E7]
- App-like UX (persistent shell, client transitions) that Unit 3 gives up

### What it cannot solve

- Independent deployment: every chunk is produced by the same build; shipping one route's
  fix ships a new whole-app build
- Runtime autonomy: chunks share realm, framework copy, and crash domain
- Incompatible stacks: all routes must use the app's framework and version
- External ownership: no third party can contribute a route after release

### Findings by matrix group

#### Build-time coupling
- All route chunks come from one build with one dependency graph and consistent shared
  chunks; cross-route type checking is whole-program. Value: Yes (fully coupled).
  [E8][E9b] framework-guarantee

#### Runtime coupling
- Route chunks execute in the shared realm against the single framework instance; lazy
  loading changes WHEN code arrives, not what it is coupled to. Value: Yes (fully
  coupled). inference

#### Isolation and failure containment
- Route-level error boundaries (for example Suspense/error boundaries around lazy routes)
  contain render errors per route, but global state, listeners, and the shell remain one
  crash domain. Value: Conditional (render-error containment only, if boundaries are
  written). [E8] officially-supported

#### Framework requirements
- Exactly one framework and version across all routes. Value: Yes (single-stack).
  framework-guarantee

#### Ownership topology fit
- Route subtree = ownable directory; identical review mechanics to Unit 1. Value: Yes
  (code ownership), No (deploy ownership). [E7] inference

#### Migration requirements
- Route boundaries are the units most MFE frameworks federate; an app already split by
  lazy routes maps almost one-to-one onto route-level MFE composition later. Value: Yes
  (forward-compatible seams). [E3] inference

#### Deployment
- Independent deployment per route: No; the chunk set is an artifact of one build.
  framework-guarantee
- Deploy cadence pain (teams queueing on one release train) is therefore untouched by this
  baseline; it is the one MFE motivation this unit cannot even partially absorb. Value:
  No. [E3] inference

#### Contracts and communication
- Cross-route communication is ordinary in-app state; no serialized contract needed.
  Value: NA (no contract surface). inference

#### UX implications
- Persistent shell and client-side transitions preserved; lazy boundaries add per-route
  loading states the team controls. Value: Yes. [E8] officially-supported

#### Performance causes
- Achieves the payload-scaling benefit usually claimed for MFEs without duplicate framework
  downloads or a runtime loader; shared vendor chunks are deduped by the single bundler.
  Value: Yes. [E8][E9b] framework-guarantee

#### Security and trust
- Single trust domain. Value: NA. inference

#### SSR and delivery
- Route-level splitting integrates with the framework's own SSR story (with documented
  caveats, for example React.lazy's historical server limitations addressed by
  streaming/loadable patterns). Value: Conditional (framework-specific SSR handling).
  [E8] officially-supported

#### Operational model
- One app, one pipeline, one deploy; nothing new to operate. Value: Yes. inference

### Findings that let the engine recommend it INSTEAD of MFEs (REQ-Q-04)

- If the motivating complaint is bundle size or "the app loads everything up front",
  route-level code splitting is the complete, first-party fix; no MFE machinery is
  implicated. Value: Yes. [E8][E9b] framework-guarantee
- If the ask is "independent pieces" without a stated independent-DEPLOYMENT requirement,
  lazy routes plus module boundaries already deliver independent development, loading, and
  ownership. Value: Yes. [E3] common-pattern
- If and only if the answers reveal a hard independent-deployment or polyglot requirement
  does this baseline fail, which is exactly the published threshold for justifying MFEs.
  Value: Yes (clean elimination signal). [E3][E10] common-pattern

---

## Editions and commercial layer

None: all four are strategies realized with commodity or free tooling. Adjacent commercial
touchpoints only: monorepo remote caching services (Nx Cloud, Vercel remote cache) and
boundary-enforcement tooling are optional accelerants, not editions of the strategy.

## Family mapping (provisional)

- These four units form the non-MFE null-hypothesis family the engine must be able to
  select under REQ-Q-04; they are not MFE strategy families.
- Adjacency edges for the recommendation graph: modular monolith and monorepo packages are
  the published staging ground for later MFE extraction [E2][E5]; server templates adjoin
  reverse-proxy route composition (add a proxy, peel routes); plain SPA lazy routes adjoin
  route-level runtime composition (Module Federation remotes, import-map loading) because
  the seams coincide [E3].
- Units 1, 2, and 4 compose freely with each other (a modular monolith in a monorepo with
  lazy routes is the common combined baseline); the engine should treat them as stackable,
  not exclusive. common-pattern

## Ambiguities and decomposition candidates

- "Team ownership" is three separable properties and the baselines split them: code-boundary
  ownership (all four: Yes via paths and CODEOWNERS), deploy-time ownership (all four: No),
  runtime operational ownership (all four: No). The matrix must carry them as three
  attributes or every baseline scores ambiguously against MFEs.
- "Independent work" splits into independent development (packages: Yes), independent
  release/versioning (packages: Yes internally), and independent deployment to production
  (all four: No). Only the third justifies MFEs per the published threshold [E3].
- "Small team" thresholds in sources vary (1-2 teams, under 20 developers, under ~100
  engineers for the backend analogue); needs a defined band per source rather than one
  number, and should enter the engine as a strong preference, not a hard constraint.
- "Platform investment" is qualitative in sources (platform squad, sophisticated CI/CD);
  decompose into: dedicated platform owner exists (Yes/No), MFE-capable CI/CD exists
  (Yes/No), governance/design-system standardization capacity exists (Yes/No).
- "Majority of the web is server-rendered" rests on framework-detection statistics [E6],
  which measure framework absence, not rendering strategy; keep the finding phrased as
  "large majority of websites do not run a client-rendered SPA framework".
- "Isolation" for Unit 3 is page-granular and for Unit 4 render-error-granular; the matrix
  needs isolation granularity (page / route render / realm / process) as an enum, not a
  boolean.

## Sources

- [E1] https://martinfowler.com/bliki/MonolithFirst.html (accessed 2026-08-28) - monolith-first
  advice; "you shouldn't start a new project with microservices..."; boundary-error cost
  argument
- [E2] https://feature-sliced.design/blog/micro-frontend-architecture (accessed 2026-08-28) -
  2025 retrospective: MFEs justified by organizational scale plus platform ownership
  investment; for 1-2 teams improving monolith boundaries is higher ROI
- [E3] https://nx.dev/docs/kb/micro-frontend-architecture (accessed 2026-08-28) - "Micro
  frontends buy team autonomy and independent releases, and they charge for it in runtime
  overhead and coordination complexity"; use MFEs when independent deployment is a hard
  requirement
- [E4] https://byteiota.com/modular-monolith-42-ditch-microservices-in-2026/ (accessed
  2026-08-28) - consolidation trend reporting (42% figure attributed to CNCF 2025 survey);
  discipline caveat
- [E5] https://www.javacodegeeks.com/2025/12/microservices-vs-modular-monoliths-in-2025-when-each-approach-wins.html
  (accessed 2026-08-28) - decision heuristics (team-size bands, DevOps maturity); hybrid
  modular-monolith-core consensus
- [E6] https://w3techs.com/technologies/overview/javascript_library (accessed 2026-08-28) -
  React 6.1%, Vue 0.6%, Angular 0.2% of all websites
- [E7] https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-code-owners
  (accessed 2026-08-28) - CODEOWNERS maps paths to owners; review auto-request; mandatory
  via branch protection
- [E8] React route-splitting pattern: React `lazy()` + `Suspense` around route components,
  default-export requirement, SSR caveat (react.dev documented API, surveyed via search
  results accessed 2026-08-28 including https://tanstack.com/router/v1/docs/framework/react/guide/code-splitting)
- [E9] https://stevekinney.com/courses/enterprise-ui/monoliths-microfrontends-and-monorepos
  (accessed 2026-08-28) - monorepo vs MFE tradeoff framing; per-app deploy granularity
- [E9b] https://angular.dev/best-practices/performance/lazy-loaded-routes and
  https://router.vuejs.org/guide/advanced/lazy-loading.html (accessed 2026-08-28) - official
  `loadChildren`/`loadComponent` and Vue Router dynamic-import route splitting
- [E10] https://nearform.com/digital-community/when-and-why-to-use-micro-frontend-architecture/
  (accessed 2026-08-28) - MFEs fit when org and release cadence justify integration work;
  overhead for small apps
- [E11] https://dev.to/tahamjp/micro-frontends-in-2025-are-they-still-worth-it-23lp (accessed
  2026-08-28) - avoid signals: 1-2 teams, organizational (not architectural) pain, weak
  DevOps; "multiple repos, pipelines, and deployments are still heavy in 2025"
