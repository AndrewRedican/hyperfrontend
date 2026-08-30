# Plain iframe composition

- Unit type: architectural-strategy
- Status (Aug 2026): active; a perennial browser platform capability, maintained by every engine vendor as part of the web platform itself, with active 2024-2026 platform investment (storage partitioning, WebKit site isolation, Firefox Android Fission)
- Availability: available
- Version / release cadence at research time: NA for the strategy itself (evergreen browsers). Representative implementation versions as of Aug 2026: Luigi Core 2.29.0 / Client 2.31.0 / Container 1.7.10 [E6]; wujie 2.1.0 [E7]; @hyperfrontend/features 0.8.0 [E10]
- Official links: no single owner. Platform specs: WHATWG HTML (iframe, browsing contexts), MDN iframe reference [E4], MDN same-origin policy [E5]. Representative frameworks: https://luigi-project.io [E6], https://github.com/Tencent/wujie [E7], HyperFrontend repo (this workspace) [E10]
- Researched: 2026-08-28
- Inventory note: the inventory row for `iframe-composition` (active) is confirmed. Side correction for the `wujie` row: "maintenance (verify)" understates it; wujie shows renewed active maintenance in 2025-2026 (v2.x rewritten iframe sandbox, v2.1.0 released June 2026, issue flow through Aug 2026) [E7].

## What it is

Each participant is a complete, independently served HTML document embedded in the host page through an `<iframe>` element. The browser, not a framework, draws the composition boundary: every frame gets its own document, window, JS realm, event loop position, CSS cascade, and (cross-site, in isolating engines) its own OS process. Integration is a URL; the host composes at runtime by pointing a frame at an address, and participants communicate exclusively through browser messaging primitives (`postMessage`, `MessageChannel`). Orchestration frameworks layered on this strategy (Luigi, HyperFrontend, and partially wujie) do not add isolation; they add the contract layer the platform leaves undefined: handshake and lifecycle, routing and history sync, resize and presentation protocols, health detection, and permission declaration. Representative implementations, listed but not privileged: raw iframes (no library), Luigi (SAP; Core/Client/Container over postMessage), HyperFrontend (@hyperfrontend/features; handshake, heartbeat, host-measured presentation), and wujie (partial member: it uses an iframe only as a JS realm while injecting DOM into the host document, so it inherits the realm split but not the security boundary).

## Composition mechanics

- Composition boundary: the document. Each participant is a separate browsing context with its own origin, realm, and session-history entry stream; the DOM tree, style scope, and script scope never merge.
- Integration phase: runtime, by URL. Integration after the host ships is inherent; deploying a new frame version requires no host rebuild, redeploy, or registry update beyond serving new content at the URL. Claim: browser-guarantee.
- Execution model: separate document, separate JS realm, separate module graph per frame. Cross-site frames additionally run in separate OS processes where site isolation is active (see Isolation). Nothing is server-composed; the host shell may itself be SSR'd, but frames always resolve client-side.

## Findings by matrix group

### Build-time coupling

- Participants require no shared build, bundler, plugin, or toolchain; any stack that emits a URL-addressable document composes. Value: Yes. Claim: browser-guarantee. [E4]
- No dependency or framework version alignment between host and frames is required; realms cannot collide on globals or prototypes. Value: Yes. Claim: browser-guarantee. [E5]
- Shared-dependency deduplication across frames at build time is impossible; each frame ships and boots its own runtime (HTTP/bytecode caches can dedupe transfer and compile of identical URLs, not execution or heap). Value: No (no dedup). Claim: browser-guarantee (mechanics) + inference (cache mitigation).

### Runtime coupling

- Host and frame share no JS realm: separate globals, prototype chains, module registries, error boundaries. Value: Yes. Claim: browser-guarantee. [E5]
- Same-origin, non-sandboxed frames can synchronously reach each other's DOM and JS (`contentWindow`, `parent`, `frames`), so the realm split is organizational, not defensive, when origins match. Value: Conditional (isolation holds only cross-origin). Claim: browser-guarantee. [E5]
- Cross-origin frames expose only the restricted cross-origin window surface (postMessage, frame traversal, location setter, closed/length); all other access throws. Value: Yes. Claim: browser-guarantee. [E5]

### Isolation and failure containment

- Cross-origin DOM, JS, and storage access is blocked by the same-origin policy with no framework code involved. Value: Yes. Claim: browser-guarantee. [E5]
- Process isolation is site-keyed, not origin-keyed: the boundary unit is scheme + registrable domain, so `a.example.com` and `b.example.com` frames may share a process even under full site isolation. Value: Yes (site granularity). Claim: browser-guarantee. [E2]
- Cross-site frames run in separate OS processes: Chrome desktop by default since Chrome 67 (2018); Chrome Android partially (login-related sites, >= 2 GB RAM devices, Chrome 77/92); Firefox desktop by default since Firefox 94/95 (late 2021); Firefox Android by default since Firefox 147 (Jan 2026); Safari/WebKit still mid-rollout (RemoteFrame architecture, "step 2 of 3" as of Jan 2025, shipping signals in iOS 26-era WebKit). Value: Conditional (engine and platform). Claim: officially-supported per engine docs. [E2][E3][E8][E9]
- Renderer crash or OOM in a cross-site frame does not take down the host page where process separation applies. Value: Conditional (on process separation actually applying: engine, platform, site-vs-origin). Claim: officially-supported. [E2]
- A tight CPU loop in a frame sharing the host's process (same-site, or non-isolating engine) blocks the host main thread. Value: Yes (no CPU containment without a process boundary). Claim: browser-guarantee (single main thread per process) + inference.
- Spectre-class cross-frame memory reads are mitigated only by the process boundary, not by the realm or origin boundary. Value: Conditional (same condition as process isolation). Claim: officially-supported. [E2]
- The `sandbox` attribute is default-deny: scripts, forms, popups, modals, top navigation, and same-origin status are all off until individually re-granted; omitting `allow-same-origin` forces an opaque origin. Value: Yes. Claim: browser-guarantee. [E4]
- `allow-scripts` + `allow-same-origin` together on a same-origin frame lets the framed document remove its own sandbox; sandboxing same-origin content is therefore not a security boundary. Value: Yes. Claim: browser-guarantee. [E4]
- Powerful features (camera, mic, fullscreen, payment, geolocation) are denied to cross-origin frames unless delegated via the `allow` attribute (Permissions Policy); delegation can only narrow, never widen, the server-sent policy. Value: Yes. Claim: browser-guarantee. [E4]
- What remains shared regardless of any isolation: the viewport and layout (a frame is a box the host sizes and positions), the top-level URL bar and browser chrome, the single system focus, print and find-in-page, and the device's total CPU/GPU/memory budget. Value: Yes (shared). Claim: browser-guarantee.
- Storage partitioning (2026 status): third-party (cross-site embedded) storage is partitioned by default in Chrome, Firefox, and Safari; localStorage, IndexedDB, Cache, service workers, BroadcastChannel, SharedWorker, and Web Locks are keyed by top-level site + an ancestor-chain bit + embedded origin, so an embedded frame does not share state with its own origin opened top-level. Value: Yes. Claim: browser-guarantee. [E1]
- Third-party cookies: blocked by default in Safari and Firefox; retained in Chrome after Google's April 2025 reversal (user-disableable; most Privacy Sandbox replacement APIs were shut down Oct 2025, with CHIPS, FedCM, and Private State Tokens surviving). Partitioned cookies (CHIPS) and the Storage Access API (user-gesture opt-in to unpartitioned access) are the durable embedded-cookie paths. Value: Conditional (engine and user settings). Claim: officially-supported [E1]; 2026 landscape figures from secondary analysis [E9], treat percentages as approximate.
- A temporary opt-out from storage partitioning exists (Chrome deprecation trial `DisableThirdPartyStoragePartitioning3`, extended), for migration only. Value: Conditional (time-limited). Claim: officially-supported. [E1]

### Framework requirements

- Frames may use any UI framework, any version, or none; no lifecycle exports, no shared adapter, no host-known mount contract is required by the platform. Value: Yes. Claim: browser-guarantee.
- Orchestration layers impose their own client library inside the frame (Luigi Client, HyperFrontend feature runtime); raw iframes impose nothing. Value: Conditional (framework choice). Claim: framework-guarantee per respective docs. [E6][E10]

### Ownership topology fit

- Strongest available fit for cross-organization and untrusted-vendor topologies: the boundary is enforced by the browser against the embedded party, not by convention. Value: Yes. Claim: inference from browser-guarantees above.
- Cross-team consistency (design tokens, shared session, shared state) must be re-solved explicitly per frame via duplicated assets or messaging protocols; nothing is inherited across the boundary. Value: Yes (cost). Claim: common-pattern.

### Migration requirements

- Any existing URL-addressable app embeds unchanged provided it does not forbid framing (`X-Frame-Options`, CSP `frame-ancestors`). Value: Conditional (embeddability headers under the participant's control). Claim: browser-guarantee. [E4]
- Legacy stacks (server-rendered, jQuery-era, closed-source vendor apps) are composable without code changes; this is the classic strangler-fig entry point. Value: Yes. Claim: common-pattern.
- A host that needs `crossOriginIsolated` (SharedArrayBuffer, high-resolution timers) can only embed frames that are CORP-compatible or loaded `credentialless`; this constrains which third parties are embeddable. Value: Conditional. Claim: browser-guarantee.

### Deployment

- Independent deploy per participant; a frame version goes live on its next document load with zero host coordination. Value: Yes. Claim: browser-guarantee (mechanics).
- The residual deploy coupling is the message contract between host and frame; the platform provides no versioning for it, so uncoordinated releases can silently break the protocol. Frameworks add handshake and version gates here (e.g. Luigi Core/Client init handshake; HyperFrontend wire handshake with version gate). Value: Yes (residual coupling). Claim: inference; mitigations framework-guarantee. [E6][E10]

### Contracts and communication

- `window.postMessage` with a `targetOrigin` check is the only host<->cross-origin-frame channel: asynchronous, structured-clone serialized, no shared references. Value: Yes. Claim: browser-guarantee. [E5]
- `MessageChannel`/`MessagePort` can be transferred over postMessage to establish private duplex pipes that bypass the shared window surface. Value: Yes. Claim: browser-guarantee.
- Transferable objects (ArrayBuffer, streams, ImageBitmap) move zero-copy; everything else pays serialization per message. Value: Yes. Claim: browser-guarantee.
- `BroadcastChannel` is same-origin only, and additionally partitioned in third-party contexts: a cross-site embedded frame cannot broadcast to its own origin's top-level tabs. Value: Conditional (same-origin and same partition). Claim: browser-guarantee. [E1]
- Shared memory (SharedArrayBuffer) across the host/frame boundary requires `crossOriginIsolated` and a same-agent-cluster relationship; it is effectively unavailable between cross-origin host and frame. Value: No (cross-origin). Claim: browser-guarantee.
- The wire has no type system or schema; message validation, typing, and replay semantics are entirely the application's or framework's job. Value: Yes (gap). Claim: browser-guarantee (absence); framework-guarantee where a framework supplies typed contracts. [E10]
- The host cannot detect frame load failure from iframe events: `error` never fires on iframes and `load` fires even when content fails, so liveness and readiness require an application-level handshake and heartbeat. Value: Yes. Claim: browser-guarantee (event behavior) [E4]; handshake/heartbeat/watchdog protocols are framework-guarantee in Luigi and HyperFrontend, common-pattern for raw iframes. [E6][E10]

### UX implications

- Frame content is clipped to its rectangle; dropdowns, modals, toasts, and tooltips cannot escape. Value: Yes. Claim: browser-guarantee. Host-rendered overlays coordinated over postMessage are the standard workaround. Claim: common-pattern; a first-class overlay/modal protocol is framework-guarantee where provided (Luigi modals; HyperFrontend display modes). [E6][E10]
- No automatic resize-to-content: an iframe does not size to its document. Height-reporting over postMessage (the iframe-resizer pattern) is the established fix. Value: Yes (limitation). Claim: browser-guarantee; workaround common-pattern. An opt-in platform mechanism (`<meta name="responsive-embedded-sizing">` + CSS `frame-sizing` + `Window.requestResize()`) is documented on MDN as of Aug 2026; breadth of engine support: Unknown. Claim: possible-extension. [E4]
- Frame navigations are linearized into the topmost session history, so the browser back button can invisibly navigate a frame instead of the page; frameworks conventionally use `location.replace` or postMessage-synced routing to keep the top URL canonical. Value: Yes (hazard). Claim: browser-guarantee [E4]; routing sync framework-guarantee in Luigi. [E6]
- Deep links to state inside a frame do not exist unless a URL-sync protocol reflects the inner route into the top URL. Value: Yes. Claim: browser-guarantee (absence); sync is framework-guarantee/common-pattern. [E6]
- Sequential focus (Tab) enters and exits frames at their DOM position, but focus traps, roving focus, and focus restoration across the boundary need explicit messaging; the host cannot observe which element inside a cross-origin frame holds focus (only that the iframe itself is `document.activeElement`). Value: Yes (coordination cost). Claim: browser-guarantee.
- Frames need a `title` attribute for assistive-tech labeling; screen readers otherwise traverse frame content normally. Value: Yes. Claim: officially-supported. [E4]
- Visual seamlessness (fonts, theme, background transparency) does not inherit; each frame must be styled to match, with design tokens delivered out of band. Value: Yes (cost). Claim: common-pattern.

### Performance causes

- Per-document cost: every frame parses its own HTML/CSS, builds its own DOM/style/layout trees, and boots its own JS realm and framework runtime; N frames of the same stack pay the runtime N times in heap and execution. Value: Yes. Claim: browser-guarantee (mechanics).
- Per-process cost where site isolation applies: Chrome measured roughly 10-13% total memory overhead isolating all sites on desktop, 3-5% for partial isolation on Android. Value: Yes. Claim: officially-supported. [E2]
- Startup latency: each frame is a full network document fetch plus boot plus handshake; mitigations are `loading="lazy"` (browser-guarantee, JS-enabled only [E4]), preconnect, and deferred mounting (common-pattern; a deferred-boot orchestration is framework territory).
- Messaging overhead: structured clone per message; high-frequency or large payloads should use transferables or be redesigned. Value: Yes. Claim: browser-guarantee.
- Background and offscreen throttling: engines throttle timers and rAF in hidden or offscreen cross-origin frames, which perturbs animations and naive heartbeat protocols; exact policies vary per engine. Value: Conditional. Claim: officially-supported (Chrome); cross-engine specifics Unknown.

### Security and trust

- This is the only mainstream composition strategy in which untrusted third-party code runs behind browser-enforced boundaries (SOP + sandbox + Permissions Policy + partitioned storage + site-keyed processes). Value: Yes. Claim: browser-guarantee. [E1][E2][E4][E5]
- The security boundary requires genuinely cross-origin (for process isolation: cross-site) hosting. Same-origin frames, including wujie-style programmatically created same-origin blank iframes, give realm separation only; co-resident or host scripts can reach in, so such designs are organizational isolation, not a trust boundary. Value: Conditional (boundary = cross-origin; process boundary = cross-site). Claim: browser-guarantee. [E5][E7]
- postMessage receivers must verify `event.origin`; the platform does not do it for you, and omitting the check is a classic cross-frame vulnerability. Value: Yes (application duty). Claim: browser-guarantee (absence) + common-pattern (discipline).
- Each participant controls its own embeddability (frame-ancestors / XFO) and is protected against clickjacking only by setting them. Value: Conditional (per-participant headers). Claim: browser-guarantee. [E4]

### SSR and delivery

- There is no cross-frame server composition: frames always resolve client-side; each participant may SSR or stream its own document independently, and the host shell may itself be SSR'd with iframe tags in the stream. Value: Conditional (per-participant SSR yes; composed SSR no). Claim: inference from mechanics.
- SEO treatment of framed content (attribution to host vs frame URL) is inconsistent across search engines. Value: Unknown. Claim: community-convention.

### Operational model

- Each frame is an independently deployed, monitored origin; errors inside a cross-origin frame are invisible to the host (`window.onerror` does not cross the boundary), so observability needs in-frame reporting plus a host-side liveness protocol. Value: Yes. Claim: browser-guarantee (invisibility); heartbeat/watchdog protocols framework-guarantee where provided. [E10]
- Where orchestration frameworks add value over raw iframes, concretely: handshake/readiness and version gating; heartbeat, teardown, and background-tab watchdog semantics; resize/presentation protocol; overlay and modal escape hatches; routing/history/deep-link sync; context, auth, and permission propagation; typed message contracts. All of these are framework-guarantees layered on browser-guarantees; none strengthen isolation beyond what the browser enforces, and a framework can only weaken the boundary (e.g. by requiring same-origin frames). Claim: framework-guarantee (per framework) + inference (the weakening direction). [E6][E7][E10]

## Editions and commercial layer

None for the strategy itself; iframes are an unowned platform capability. Representative implementations are OSS: Luigi (Apache-2.0, SAP-stewarded, no separate commercial edition found: Unknown whether SAP support contracts cover it) [E6]; wujie (MIT, Tencent) [E7]; HyperFrontend (@hyperfrontend/* packages on npm; commercial layer: none identified at research time) [E10].

## Family mapping (provisional)

- Primary: client-side runtime composition, hard-isolation family (document/process boundary). Raw iframes, Luigi, and HyperFrontend sit fully inside it.
- wujie is multi-family: iframe-as-JS-sandbox plus shadow-DOM injection into the host document; it belongs partly here (realm split) and partly to the DOM-injection/web-component family, and it forfeits this family's security boundary by design (same-origin blank iframe). Prefigures the Web Fragments direction noted in the inventory.
- Adjacent, not members: web-component composition (shared realm), module federation (shared realm and module graph), server-side composition (no client boundary).

## Ambiguities and decomposition candidates

- "Isolation" is not one attribute; matrix should split into: realm isolation (unconditional), DOM isolation (cross-origin only), process isolation (cross-site, engine/platform-conditional), storage isolation (partitioned by default, cookie rules engine-conditional), and failure containment (crash vs CPU vs memory, each with different conditions).
- "Process isolation supported" needs per-engine rows (Chrome desktop / Chrome Android / Firefox desktop / Firefox Android / Safari) because the answer differs materially in Aug 2026, and needs site-vs-origin granularity stated.
- "Performance cost" should split into: per-frame memory, per-process memory overhead, startup latency, messaging overhead, and shared-main-thread contention; they have different causes and different mitigations.
- "UX limitations" should split into: overlay clipping, resize-to-content, history pollution, deep-link absence, and focus coordination; frameworks mitigate different subsets, so a single UX score would hide the difference.
- "Secure for untrusted code" must carry its boundary definition: secure against the embedded party only when cross-origin, against Spectre-class attackers only when cross-site with process isolation active; same-origin variants (wujie) are excluded from the security claim.
- "Framework adds X" findings must stay separate from platform findings in the matrix so that browser-guarantee vs framework-guarantee remains mechanically distinguishable per cell.

## Sources

- [E1] https://privacysandbox.google.com/cookies/storage-partitioning (accessed 2026-08-28) - storage partitioning shipped default in Chrome matching Firefox/Safari; ancestor bit; partitioned APIs (BroadcastChannel, SharedWorker, service workers, Web Locks); DisableThirdPartyStoragePartitioning3 deprecation trial; CHIPS and Storage Access API guidance
- [E2] https://www.chromium.org/Home/chromium-security/site-isolation/ (accessed 2026-08-28) - site-keyed (scheme + registrable domain) process boundary; Chrome 67 desktop default, Android partial since 77/92; 10-13% desktop and 3-5% Android memory overhead; Spectre motivation
- [E3] https://docs.webkit.org/Deep%20Dive/SiteIsolation.html (accessed 2026-08-28) - WebKit RemoteFrame architecture; rollout at "step 2 of 3" as of Jan 2025
- [E4] https://developer.mozilla.org/en-US/docs/Web/HTML/Element/iframe (accessed 2026-08-28) - sandbox default-deny semantics and token list; allow/Permissions Policy delegation; loading=lazy; joint session history linearization; load fires on failure and error never fires; title for AT; responsive-embedded-sizing / frame-sizing / requestResize opt-in sizing
- [E5] https://developer.mozilla.org/en-US/docs/Web/Security/Same-origin_policy (accessed 2026-08-28) - cross-origin access restrictions and the permitted cross-origin window surface
- [E6] https://www.npmjs.com/package/@luigi-project/core , https://www.npmjs.com/package/@luigi-project/client , https://www.npmjs.com/package/@luigi-project/container , https://luigi-project.io/ , https://github.com/luigi-project/luigi/releases (accessed 2026-08-28) - Luigi Core 2.29.0, Client 2.31.0, Container 1.7.10; Core/Client architecture over postMessage; active status
- [E7] https://github.com/Tencent/wujie/releases , https://github.com/Tencent/wujie/blob/master/CHANGELOG.md (accessed 2026-08-28) - v2.1.0 latest; v2.x rewritten same-origin blank iframe JS sandbox with working back/forward; shadow-DOM rendering split; renewed maintenance activity through Aug 2026
- [E8] https://github.com/inspectdev/inspect-issues/issues/241 (accessed 2026-08-28) - iOS 26-era WebKit Frame Target architecture change signaling site isolation rollout
- [E9] https://blog.mozilla.org/security/2021/05/18/introducing-site-isolation-in-firefox/ and 2026 secondary analyses surfaced via search, e.g. https://www.consenteo.com/knowledge-hub/cookies/third_party_cookies_2026_after_google_reversal (accessed 2026-08-28) - Firefox Fission desktop default Firefox 94/95 (late 2021), Android default Firefox 147 (Jan 2026); Chrome third-party cookie reversal (Apr 2025) and Privacy Sandbox API shutdown (Oct 2025); secondary figures treated as approximate
- [E10] HyperFrontend repository (this workspace: libs/features, docs-site; @hyperfrontend/features 0.8.0 published 2026-08-23) (accessed 2026-08-28) - handshake with version gate, four-state heartbeat and watchdog latches, host-measured presentation model, capability declaration; cited as representative implementation, not privileged
