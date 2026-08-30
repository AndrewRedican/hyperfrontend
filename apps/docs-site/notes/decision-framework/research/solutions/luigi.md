# Luigi (SAP)

- Unit type: framework
- Status (Aug 2026): active; core releases roughly monthly through mid-2026 (v2.31.0 Jun 2026) and container releases through Aug 2026 [E8]
- Availability: available
- Version / release cadence at research time: core v2.31.0 (2026-06-12); the inventory's "v2.29.0 (Mar 2026)" is stale, superseded by v2.30.0 (2026-06-01) and v2.31.0; separately versioned `@luigi-project/container` at v1.7.11 (2026-08-13) [E8]. Inventory status "active" confirmed; version cell needs correction.
- Official links: docs https://docs.luigi-project.io, repo https://github.com/SAP/luigi (Apache-2.0) [E10]
- Researched: 2026-08-28

## What it is

Luigi is SAP's enterprise micro frontend shell framework. A host application runs Luigi Core, which owns the top-level document, renders the navigation chrome (top nav, left nav, modals, alerts), and mounts each micro frontend in an iframe addressed by a `viewUrl` in a centrally configured navigation tree [E1][E2]. Micro frontends embed the Luigi Client library and talk to Core exclusively over `window.postMessage`: navigation requests, context updates, UX operations, dirty-state, and token delivery all cross that channel [E1][E7][E3]. A second, weaker-isolation mode loads micro frontends as web components into the host document (single nodes or "compound" grid views with an event bus) [E4]. A separate `@luigi-project/container` web component lets any non-Luigi application embed individual Luigi-compatible micro frontends (iframe or web component) without adopting the full Core shell [E9].

## Composition mechanics

- Composition boundary: separate document per micro frontend (iframe addressed by URL); alternatively a custom-element module contract in web-component mode (ES module with default-exported `HTMLElement` class) [E2][E4]
- Integration phase: runtime; a micro frontend is integrated by adding a navigation node with a `viewUrl` to Core configuration, which can itself be fetched at runtime, so integration after the host ships is possible without rebuilding participants [E2] (claim type: framework-guarantee for URL-based loading; inference for config-service patterns)
- Execution model: iframe mode is separate document, separate JS realm, client-side composed by the Core shell; web-component/compound mode is same document, same JS realm, shadow DOM attachment [E2][E4]

## Findings by matrix group

### Build-time coupling

- Host and micro frontends share no build step; integration is by URL at runtime. Yes [E2] framework-guarantee
- Participants need no shared bundler, no module federation, and no shared framework version across iframes. Yes [E1][E2] framework-guarantee
- Iframe participants adopt the `@luigi-project/client` npm library (or its bundle) to use any shell service. Conditional: a plain page can be iframed with no client, but then the node must disable `loadingIndicator` and the page gets no routing sync, context, or UX APIs [E2][E7] officially-supported
- Web-component participants must be authored to Luigi's module contract (default export class; `selfRegistered`/`tagName` variants exist). Yes [E2][E4] framework-guarantee
- Central navigation configuration in Core must list every participant (nodes, viewGroups, permissions), creating a shared-config coupling point. Yes [E2] framework-guarantee

### Runtime coupling

- All cross-boundary calls go through the Core/Client postMessage protocol; there are no direct JS references between iframe participants. Yes [E1][E7] framework-guarantee
- Web-component mode shares the host JS realm and global scope with Core and with sibling web components. Yes [E4] framework-guarantee
- Compound views wire sibling web components through a Core-managed event bus (`eventListeners` with `source`, `name`, `action`, optional `dataConverter`), not direct references. Yes [E2][E4] framework-guarantee
- A non-Luigi host can consume a single Luigi micro frontend via `luigi-container` / `luigi-compound-container` custom elements (attributes: `viewurl`, `context`, `webcomponent`, `auth-data`; events surface via standard `addEventListener`). Yes [E9] officially-supported

### Isolation and failure containment

- Iframe mode gives each participant its own document and JS realm; a participant's runtime exception cannot corrupt shell JS state. Yes [E2] browser-guarantee (realm/document separation; not process/crash isolation, which is browser-scheduling dependent: Unknown)
- Iframe style isolation is total (no CSS leakage either direction). Yes browser-guarantee
- Core applies default iframe `sandbox` rules and lets integrators extend them via `customSandboxRules`; feature access is gated via `allowRules` (e.g. `microphone`, `camera`); an `iframeCreationInterceptor(iframe, viewGroup, navigationNode, microFrontendType)` allows arbitrary pre-insertion mutation. Yes [E5] officially-supported
- Web-component mode has no hard isolation: shadow DOM scopes styles only; JS is same-realm, so a faulty web component can break the shell. Yes (as a limitation) [E4] framework-guarantee (style scoping) + inference (failure blast radius)
- Storage/origin isolation between participants depends on whether micro frontends are served from distinct origins; Luigi does not require distinct origins. Conditional (distinct origins chosen by the adopter) [E2] inference

### Framework requirements

- Micro frontends are framework-agnostic (any framework or none, including SAPUI5/OpenUI5). Yes [E1][E8-adjacent SAP docs] officially-supported
- The host shell must adopt Luigi Core as its outer application frame (Core owns chrome and routing); Core integrates into plain HTML, Angular, React, Vue, or UI5 hosts. Yes [E1] officially-supported
- No shared design system is technically required, though Luigi ships SAP Fundamental/UI5-styled chrome by default. Conditional (visual coherence inside frames is the adopter's job) [E1] inference

### Ownership topology fit

- Fits many autonomous teams shipping independently hosted apps, unified by one platform team owning the Core shell and its navigation config. Yes [E1][E2] common-pattern
- The navigation tree is a central artifact; distributed ownership of it requires adopter-built config aggregation (Luigi supports async config but does not ship a federated config service). Conditional [E2] possible-extension

### Migration requirements

- Existing deployed web apps can be onboarded by URL with zero code change (embed-only, degraded participation). Yes [E2] framework-guarantee
- Full participation requires adding Luigi Client calls (navigation via `linkManager`, dirty-state, context listeners), an incremental per-app change. Yes [E7] officially-supported
- Strangler-style adoption inside an existing non-Luigi app is possible via `@luigi-project/container` without rehosting the whole app under Core. Yes [E9] officially-supported

### Deployment

- Participants deploy independently on their own hosts/CDNs; the shell resolves them by URL at runtime. Yes [E2] framework-guarantee
- Adding a participant after the host ships requires only a config change if the host loads its Luigi config dynamically; a statically bundled config requires a host redeploy. Conditional [E2] inference

### Contracts and communication

- Standardized shell services carried over postMessage: navigation/routing (`linkManager().navigate/openAsModal/openAsDrawer/openAsSplitView`), UX (`uxManager().showAlert/showConfirmationModal/showLoadingIndicator/setDirtyStatus`), context passing (`getContext`, `addContextUpdateListener`, node-level `context` objects), token access (`getToken`), and cross-frame storage (`storageManager`). Yes [E7][E2] framework-guarantee
- Deep-link URL state is a shell contract: `pathSegment` trees, dynamic `:segments`, `nodeParamPrefix` (`~param=`), `useHashRouting` toggle, and modal state in the URL via `showModalPathInUrl`/`modalPathParam`. Yes [E6][E2] officially-supported
- Core can restrict what a participant may do via node-level `clientPermissions` (e.g. `changeCurrentLocale`, `urlParameters` read/write). Yes [E2] officially-supported
- Auth is a shell service: providers `openIdConnect` (`@luigi-project/plugin-auth-oidc`) and `oAuth2ImplicitGrant` (`@luigi-project/plugin-auth-oauth2`) plus custom classes; settings include `authority`, `client_id`, `scope`, `automaticSilentRenew`, `accessTokenExpiringNotificationTime`, `storage` (`localStorage`/`sessionStorage`/`none`); tokens are pushed to frames via the `luigi.auth.tokenIssued` message. Yes [E3] officially-supported
- Versioned wire compatibility between Core and Client across releases: Unknown (no compatibility matrix located in this pass)

### UX implications

- One shell owns global chrome, so modals, alerts, drawers, and split views render at viewport level rather than clipped inside a frame; participants request them, Core draws them. Yes [E7][E1] framework-guarantee
- Iframe swaps on navigation are masked by a configurable `loadingIndicator` (auto-hide by default; must be disabled for client-less pages). Yes [E2] officially-supported
- Compound views compose multiple web components into one screen with a grid renderer (columns, breakpoints, gaps) and lazy loading of children. Yes [E2][E4] officially-supported
- Cross-frame focus/scroll continuity beyond what the client API restores: Unknown

### Performance causes

- Each iframe participant boots its own document and framework copy; no dependency sharing across frames is possible. Yes [E2] browser-guarantee (consequence of document boundary)
- Mitigations are first-class: `viewGroup` reuses one iframe across same-origin nodes, `preloadUrl` + `preloadViewGroups` warm frames in advance, and view-group caching restores state on back-navigation (`noClientCheck` skips the reactivation handshake). Yes [E2] officially-supported
- Web-component/compound mode avoids iframe boot cost by sharing the host realm, trading isolation for weight. Yes [E4] framework-guarantee

### Security and trust

- The isolation boundary is the browser origin plus Luigi's default-plus-`customSandboxRules` sandboxing; within that boundary, cross-origin iframes cannot script the shell. Yes [E5] browser-guarantee (origin isolation) + officially-supported (sandbox config)
- The trust model assumes participants are trusted first-party apps: Core broadcasts issued auth data to frames (`luigi.auth.tokenIssued`; the documented example posts with `'*'` target), so Luigi is not a containment mechanism for hostile micro frontends holding shell tokens. Yes (trusted-participant model) [E3] inference from documented mechanics
- Silent OIDC token renewal depends on third-party cookies; Luigi ships a `thirdPartyCookieCheck` (`thirdPartyCookieScriptLocation`, `thirdPartyCookieErrorHandling`, `disabled`) to detect blocked browsers. Yes [E3][E5] officially-supported
- Web-component participants execute with full shell privileges (same realm). Yes [E4] framework-guarantee

### SSR and delivery

- The composed page is client-side rendered by the Core shell; there is no server-side composition of the assembled view. No (SSR of the composition) [E1][E2] inference from mechanics; no SSR feature located
- Individual iframe participants may themselves be server-rendered apps, invisible to Core. Conditional [E2] inference

### Operational model

- Open source, Apache-2.0, SAP-stewarded on GitHub; ~923 stars, active issues/PRs and commit flow as of Aug 2026. Yes [E10][E8] officially-supported
- Release cadence: core minor releases roughly monthly (v2.28.0 Feb 2026, v2.29.0 Mar 2026, v2.30.0 Jun 2026, v2.31.0 Jun 2026); container patch releases through Aug 2026. Yes [E8] officially-supported
- v2.29.0 (2026-03-19) content, for the record: ESM support for the client, client-api guard for config-changed calls, a11y improvements, modal opener reuse fix. Yes [E8] officially-supported

## Editions and commercial layer

None. Single open-source edition under Apache-2.0; no commercial tier identified. Ecosystem gravity is SAP-internal (UI5 support library, SAP design language defaults), but nothing is license-gated [E8][E10].

## Family mapping (provisional)

- Primary: iframe-composition shell (runtime client-side composition of separate documents behind a central orchestrator).
- Secondary: client-side web-component composition (webcomponent nodes, compound views, `@luigi-project/container`), same-realm, so it genuinely straddles two families.
- Also exhibits: app-shell / platform-chrome strategy (centralized navigation, auth, and UX services as the product surface).

## Ambiguities and decomposition candidates

- "Isolation" must split four ways for the matrix: JS-realm isolation (iframe Yes / WC No), style isolation (iframe Yes / WC shadow-DOM-only), process-crash isolation (browser-dependent, Unknown), and storage-origin isolation (Conditional on adopter's origin layout).
- "Requires Luigi Client" splits into embed-only participation (No client, degraded: no routing sync, context, or UX services) vs full participation (Yes, client library required).
- "Web-component mode" splits into single-node WC, compound view (grid + event bus), and container embedding in a non-Luigi host; their coupling and isolation profiles differ.
- "Independent integration after ship" splits by config delivery: dynamic config fetch (Yes) vs statically bundled config (host redeploy required).
- "Secure isolation" splits into isolation-from-accidents (strong in iframe mode) vs containment-of-malicious-participants (No: token broadcast presumes trust).

## Sources

- [E1] https://docs.luigi-project.io/docs/getting-started (accessed 2026-08-28) - Core/Client split, postMessage, iframe architecture, standardized services, web component support
- [E2] https://raw.githubusercontent.com/SAP/luigi/main/docs/navigation-parameters-reference.md (accessed 2026-08-28) - node params (pathSegment, viewUrl, context, webcomponent, compound), viewGroups/preloadUrl, loadingIndicator, virtualTree, clientPermissions
- [E3] https://raw.githubusercontent.com/SAP/luigi/main/docs/authorization-configuration.md (accessed 2026-08-28) - auth providers, OIDC plugin settings, token storage, tokenIssued postMessage
- [E4] https://raw.githubusercontent.com/SAP/luigi/main/docs/web-component.md (accessed 2026-08-28) - WC module contract, shadow DOM attachment, injected LuigiClient object, compound event bus, same-realm caveat
- [E5] https://raw.githubusercontent.com/SAP/luigi/main/docs/general-settings.md (accessed 2026-08-28) - customSandboxRules, allowRules, iframeCreationInterceptor, thirdPartyCookieCheck
- [E6] https://raw.githubusercontent.com/SAP/luigi/main/docs/navigation-advanced.md (accessed 2026-08-28) - useHashRouting, showModalPathInUrl/modalPathParam, nodeParamPrefix
- [E7] https://docs.luigi-project.io/docs/luigi-client-api (accessed 2026-08-28) - linkManager, uxManager, context, getToken, storageManager, luigiClientInit
- [E8] https://github.com/SAP/luigi/releases (accessed 2026-08-28) - v2.29.0 (2026-03-19) contents via changelog search, v2.30.0/v2.31.0 dates, container v1.7.9-v1.7.11 (Jul-Aug 2026)
- [E9] https://raw.githubusercontent.com/SAP/luigi/main/docs/luigi-container-api.md (accessed 2026-08-28) - luigi-container / luigi-compound-container attributes, events, init
- [E10] https://github.com/SAP/luigi (accessed 2026-08-28) - Apache-2.0 license, activity, ~923 stars
