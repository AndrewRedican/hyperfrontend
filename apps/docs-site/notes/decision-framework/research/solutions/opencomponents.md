# OpenComponents (OpenTable)

- Unit type: framework
- Status (Aug 2026): active; `oc` 0.50.63 published to npm 2026-08-20 and the monorepo's last push was 2026-08-25, with recent feature work (metadata adapters) landing in 2026 [E7][E9]. Inventory's provisional "active" status is confirmed; no correction needed.
- Availability: available
- Version / release cadence at research time: `oc` 0.50.63 (still 0.x after ~12 years; frequent small releases), `oc-client` (Node consumer client) 4.0.3 (2026-05-20), `oc-template-es6` 2.0.0 [E7]
- Official links: docs https://opencomponents.github.io/ , repo https://github.com/opencomponents/oc
- Researched: 2026-08-28

## What it is

OpenComponents is a registry-centric system for delivering versioned UI components at runtime. A component is a small versioned bundle of a compiled view template plus optional server-side data-provider logic (`server.js`/`server.ts`), published via the `oc` CLI to a self-hosted registry: a Node.js REST service whose artifact storage ("library") lives in S3, Google Cloud Storage, Azure, or a custom storage adapter, with static resources typically fronted by a CDN such as CloudFront [E2][E3][E4]. Consumers integrate over an HTTP + HTML contract: a request to `https://registry/component-name/1.0.0` returns either fully rendered HTML or, with `Accept: application/vnd.oc.unrendered+json`, the compiled template plus view-model data for the consumer to render [E6]. In the browser, `<oc-component href="...">` tags are resolved by the `oc-client` browser script; on the server, Node/PHP/Ruby clients fetch and inline the fragments before the page ships [E5][E6]. Published versions are immutable: republishing an existing name+version is rejected with a "component version already exists" error, so every change is a new version and old versions remain permanently addressable [E8].

## Composition mechanics

- Composition boundary: HTTP endpoint per component version returning an HTML fragment (or template+data JSON). The contract is language-agnostic HTTP + HTML, plus declared parameters in the component's `package.json` [E2][E4][E6].
- Integration phase: runtime. Components are published to the registry after the host ships; consumers using semver ranges or latest pick up new versions with no host redeploy [E2][E6].
- Execution model: server-composed fragments are injected into the host's shared DOM/document; client-rendered components execute in the host page's shared JS realm (no iframe or sandbox). Component server logic executes inside the registry's Node process, a separate service from the host application [E2][E3][E5].

## Findings by matrix group

### Build-time coupling

- Host and components build and release independently; no shared build pipeline or shared module graph. Value: Yes. [E2] framework-guarantee
- Component views are compiled at publish time by the template's compiler; the consumer never compiles component source. Value: Yes. [E4][E6] framework-guarantee
- A template type must be supported/registered on the registry for its components to be compiled and served. Value: Conditional (registry configured with that template). [E3][E4] framework-guarantee
- No dependency-version alignment between host and components is required; component server-side dependencies are resolved inside the registry against a configured whitelist. Value: Yes. [E3] framework-guarantee

### Runtime coupling

- Consumers resolve component versions per request: exact version, semver range (e.g. `~1.0.0`), or empty string for latest. Value: Yes. [E6] framework-guarantee
- Client-side rendering requires including the registry-served `oc-client` browser script on the page. Value: Conditional (client-side mode only). [E4][E5] framework-guarantee
- Server-side consumption requires an OC client library (Node `oc-client`; PHP, Ruby/Rails/Sinatra clients exist) or hand-rolled HTTP calls. Value: Conditional. [E6] officially-supported
- Nested components (components rendering components) are supported via the browser client's lifecycle events. Value: Yes. [E5] officially-supported

### Isolation and failure containment

- Client-rendered component JS runs in the host page's realm and DOM with full page privileges; OC provides no client-side sandboxing. Boundary defined: isolation here means browser-side script containment, which OC does not provide. Value: No. [E2][E5] inference (docs describe shared-page rendering and claim no sandbox)
- Component server logic is process-isolated from the host application because it runs in the registry service; a crash there degrades the fragment, not the host process. Boundary defined: server-side process separation between host app and registry. Value: Yes. [E2][E3] framework-guarantee
- Node client supports timeouts, retries, and fallback markup so a failed component degrades gracefully instead of failing the page. Value: Yes. [E6] framework-guarantee
- Registry restricts which npm packages component server code may `require` via a dependencies whitelist. Value: Yes. [E3] framework-guarantee
- Failure containment for client-rendered components (one component's JS error not breaking others) is not documented as a guarantee. Value: Unknown. [E5] inference

### Framework requirements

- Consumer host is framework-agnostic on both backend (Node, .NET, PHP, Java, Go documented as consumers) and frontend. Value: Yes. [E2] officially-supported
- Component authoring supports multiple UI frameworks via pluggable templates: ES6 (default), React, Vue, Svelte and others; legacy Handlebars and Jade remain supported. Value: Yes. [E4] officially-supported
- Mixing template types across components in one registry is supported (templates are per-component metadata). Value: Yes. [E3][E4] officially-supported

### Ownership topology fit

- Independent teams publish independently to a shared registry; the registry is the discovery surface (HTML discovery UI plus API endpoints, toggleable via `discovery` config). Value: Yes. [E2][E3] framework-guarantee
- Publish governance: optional basic-auth `publishAuth` (single or multiple credentials), custom `publishValidation` hooks against component `package.json`, and `publishRateLimit`. With `publishAuth` undefined, publishing is open. Value: Conditional (must be configured). [E3] framework-guarantee
- Registry plugins can be context-aware (receive component name and version) for permission/audit decisions. Value: Yes. [E3] officially-supported

### Migration requirements

- Incremental adoption: a single `<oc-component>` tag or one server-side client call embeds a component into any existing page; no host rewrite required. Value: Yes. [E4][E5] framework-guarantee
- Adopting OC requires standing up and operating a registry service plus cloud storage before the first component ships. Value: Yes (prerequisite cost). [E3] framework-guarantee

### Deployment

- Publishing a component version is a registry publish, not a host redeploy; consumers on ranges/latest receive it at next request. Value: Yes. [E2][E6] framework-guarantee
- Published versions are immutable: a duplicate name+version publish is rejected ("component version already exists"); changes require a version bump. Value: Yes. [E8] framework-guarantee
- Rollback is achieved by consumers pinning a prior version (all versions remain stored and addressable) or by publishing a new higher version with the old behavior; no registry-side "rollback" command is documented. Value: Conditional (repoint or republish). [E6][E8] inference
- Whether a published version can be deleted from the registry/storage at all is not documented. Value: Unknown. inference
- Static component resources are served from storage behind a configurable CDN path (e.g. CloudFront over S3); the registry API itself is compute you host and scale. Value: Conditional (CDN covers statics, not rendered responses). [E3] framework-guarantee
- Component index defaults to JSON files in storage (`components.json`); an optional metadata adapter mode (e.g. Azure SQL) reserves a metadata row before upload and commits after, treating duplicates/in-progress rows as the version-exists error. Value: Yes. [E8] officially-supported

### Contracts and communication

- Component interface is declared parameters in `package.json` (with types), enforced by the registry, plus the HTTP request/response shape. Value: Yes. [E3][E4] framework-guarantee
- No built-in client-side inter-component communication bus; the browser client exposes rendering lifecycle events, and cross-component messaging is left to the host (custom events etc.). Value: No (not provided). [E5] inference
- Wire contract is versioned implicitly through component semver; breaking parameter changes are managed by publishing a new major version and consumers choosing when to move. Value: Yes. [E6][E8] common-pattern

### UX implications

- Server-rendered consumption inlines HTML before the page ships, so components participate in first paint and are SEO-visible. Value: Conditional (server-side rendering path). [E6] framework-guarantee
- Client-side `<oc-component>` resolution renders after page load (optionally with fallback content in the tag), so layout shift/placeholder states are possible. Value: Conditional (client-side path). [E5] inference

### Performance causes

- Each component is an HTTP request to the registry; a batch POST endpoint aggregates multiple components into one request. Value: Yes. [E6] framework-guarantee
- Unrendered mode (`Accept: application/vnd.oc.unrendered+json`) returns compiled template + data separately, reducing payload and letting consumers cache templates and re-render with fresh data only. Value: Yes. [E6] officially-supported
- Registry treats published data as immutable, so its internal refresh/polling interval can be high ("Given the data is immutable, this should be high and just for robustness"). Value: Yes. [E3] framework-guarantee
- Rendered-mode responses carry full HTML per request, which the docs note increases payload size versus unrendered mode. Value: Yes. [E6] officially-supported

### Security and trust

- Trust model is single-organization: the registry executes publishers' server-side code and consumers execute publishers' client-side code with page privileges; there is no component signing or consumer-side verification documented. Boundary defined: secure against outside tampering only insofar as publish auth and storage access are secured; not secure against a malicious publisher. Value: Conditional. [E3][E8] inference
- Publish path can require basic auth and custom validation; unauthenticated registries accept any publish. Value: Conditional. [E3] framework-guarantee
- Server-side dependency whitelist limits the npm surface component code can reach inside the registry. Value: Yes. [E3] framework-guarantee

### SSR and delivery

- SSR is a first-class mode: Node client fetches rendered HTML (or unrendered template+data) and inlines it; PHP and Ruby/Rails/Sinatra clients exist for non-Node backends. Value: Yes. [E6] framework-guarantee
- Content negotiation selects rendering mode via Accept headers (`application/vnd.oc.unrendered+json` for unrendered). Value: Yes. [E6] framework-guarantee
- Client-side rendering is automatic for `<oc-component>` tags on load, and programmatic via `oc.build()` / `oc.renderUnloadedComponents()`; failed server renders can fail over to client-side rendering per docs' graceful-degradation patterns. Value: Yes. [E5][E6] officially-supported
- Modern ES-module components are auto-detected and rendered by the browser client. Value: Yes. [E5] officially-supported

### Operational model

- Fully self-hosted: you operate the registry (Node service), the storage library (S3/GCS/Azure/custom adapter), optionally a CDN and a metadata database; no SaaS offering exists. Value: Yes. [E3][E8] framework-guarantee
- Node.js requirement: `oc` declares `engines.node >= 18` (registry and CLI). Value: Yes. [E7] framework-guarantee
- ESM status: the `oc` package itself ships CommonJS (`main: ./dist/index.js`, no `"type": "module"` as of 0.50.63); component authoring supports ES modules / ES6 templates as the default. Value: Conditional (ESM for components, CJS distribution for the tool). [E5][E7] framework-guarantee
- Local development mode (`local: true`) serves components from the filesystem with hot reload and publishing disabled; explicitly not for production. Value: Yes. [E3] framework-guarantee
- The tool has never reached 1.0 (0.50.x in 2026) despite production use at OpenTable since 2014; semver stability guarantees for the tool itself are therefore weak by convention. Value: Yes. [E1][E7] inference

## Editions and commercial layer

None. MIT-licensed OSS monorepo (core `oc`, browser client, metadata adapter utilities, Azure SQL metadata adapter); no commercial edition or hosted service [E1][E7].

## Family mapping (provisional)

- Primary: registry-based runtime component delivery ("components as a service"): the registry is the control plane for publish, discovery, versioning, and serving.
- Overlaps: server-side composition (fragments inlined by backend clients, ESI-like in effect); client-side runtime composition (browser client resolving placeholder tags); NOT module-federation-style shared JS graphs and NOT iframe isolation.
- Marked provisional until Phase 4.

## Ambiguities and decomposition candidates

- "Isolation" must split into: (a) server-execution isolation (component logic runs in the registry process, separate from host: Yes) vs (b) client-side script containment (shared realm, no sandbox: No).
- "Rollback support" must split into: (a) immutable retention of every published version (Yes) vs (b) consumer repointing to a prior version (Yes, by pin) vs (c) registry-side unpublish/delete of a version (Unknown).
- "CDN backing" must split into: (a) static assets served via CDN over storage (Yes, configured) vs (b) rendered HTML/API responses (registry compute, not CDN, unless the operator adds their own caching layer).
- "ESM status" must split into: (a) tool distribution format (CJS) vs (b) component authoring model (ES modules default).
- "Version resolution" must split into: (a) exact pin, (b) semver range, (c) latest-on-empty; these have different runtime-coupling implications for the matrix.

## Sources

- [E1] https://github.com/opencomponents/oc (accessed 2026-08-28) - monorepo structure, MIT/OSS, "serverless in the front-end world" positioning, community size
- [E2] https://opencomponents.github.io/docs/intro (accessed 2026-08-28) - architecture layers (component/registry/library/client), HTTP+HTML contract, version immutability statement, polyglot consumers
- [E3] https://opencomponents.github.io/docs/registry/registry-configuration (accessed 2026-08-28) - S3/CloudFront and custom storage adapters, publishAuth/publishValidation/publishRateLimit, dependencies whitelist, discovery controls, plugins, local mode, immutable-data refresh note
- [E4] https://opencomponents.github.io/docs/building/getting-started (accessed 2026-08-28) - template system (ES6 default; React/Vue/Svelte; legacy Handlebars/Jade), server.ts data provider, component structure, `<oc-component>` consumption
- [E5] https://opencomponents.github.io/docs/consumers/rendering-lifecycle (accessed 2026-08-28) - synchronous tag rendering vs programmatic `oc.build()`/`oc.renderUnloadedComponents()`, ES-module auto-detection, nested components
- [E6] https://opencomponents.github.io/docs/consumers/server-side-rendering (accessed 2026-08-28) - rendered vs `application/vnd.oc.unrendered+json` modes, semver ranges and empty-string latest, timeout/retry/fallback, PHP/Ruby clients, batch POST endpoint
- [E7] https://registry.npmjs.org/oc and https://raw.githubusercontent.com/opencomponents/oc/master/packages/oc/package.json (accessed 2026-08-28) - oc 0.50.63 published 2026-08-20, engines node >=18, CJS main, MIT; oc-client 4.0.3; oc-template-es6 2.0.0
- [E8] https://www.npmjs.com/package/oc (accessed 2026-08-28, via search summary) - metadata adapter publish flow (reserve row, upload, commit), duplicate publish rejected as "component version already exists", storage retains version package files
- [E9] https://api.github.com/repos/opencomponents/oc (accessed 2026-08-28) - pushed_at 2026-08-25, not archived
