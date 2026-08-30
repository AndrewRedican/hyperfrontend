# HyperFrontend

- Unit type: framework
- Status (Aug 2026): active (pre-1.0); `@hyperfrontend/features` 0.8.0 published, frequent releases across a multi-package line, but no 1.0 and breaking wire changes are explicitly allowed via 0.x semver [E8][E1]. Inventory status "active (pre-1.0)" confirmed, no correction needed.
- Availability: available-immature (Community edition; pre-1.0). "HyperFrontend Enterprise" is announced-planned only (see Editions; REQ-AVAIL-01).
- Version / release cadence: `@hyperfrontend/features` 0.8.0 on `@hyperfrontend/nexus` 2.0.1, `@hyperfrontend/network-protocol` 0.2.1, `@hyperfrontend/cryptography` primitives beneath [E8][E3]. Active monorepo, releases automated per merge; version line is pre-1.0 throughout the features stack.
- Official links: docs https://www.hyperfrontend.dev, repo https://github.com/AndrewRedican/hyperfrontend (this dossier researched entirely from the repository; treat vendor claims accordingly)
- Researched: 2026-08-28

NOTE ON SOURCE POSTURE: HyperFrontend is the subject of this framework. Its canonical rationale is one party's argued position, unusually explicit about its own disqualifying conditions [E1]. This dossier treats it exactly like a competitor, and cites its self-conceded costs against it where warranted.

## What it is

An MIT-licensed SDK, CLI, and dev/production server (`@hyperfrontend/features`) for composing independently owned web apps at runtime across the browser's document boundary. A feature app is a normal, independently hosted web app with its own URL; a host mounts it in an iframe (or popup/tab) and the two sides exchange messages over a contract-validated postMessage channel (`@hyperfrontend/nexus`) [E2][E3]. On top of the raw channel the framework supplies the orchestration the iframe primitive lacks: a three-frame handshake with version and security gates, pre-open queuing with deadlines, a four-state heartbeat watchdog, a host-owned presentation/geometry model, polite flush-then-confirm teardown, and a capability envelope where sandbox/allow are host-decreed [E3]. `hf build` packages a feature into a self-contained "shell" package with zero declared runtime dependencies that a host consumes as an npm install or a script tag, so buildless hosts can integrate [E3][E1].

## Composition mechanics

- Composition boundary: the browser document (iframe or separate window), plus a written, versioned `FeatureContract` (emitted/accepted actions) as the sole application-level coupling [E3].
- Integration phase: runtime. Integration can happen after the host ships: the feature deploys behind its own URL; the host installs one generated shell package (npm or script tag) and mounts it; feature updates that keep the contract require no host action [E3][E1].
- Execution model: separate documents, separate JS realms, separate CSS scopes; cross-origin frames typically get separate OS processes (browser behavior, not a framework guarantee). Composition is entirely client-side; nothing is server-composed [E3][E7].

## Findings by matrix group

### Build-time coupling

- Host and feature need no shared bundler, build step, or toolchain: Yes [E2][E3]. framework-guarantee.
- Host can integrate with no build step at all (script-tag consumption of the generated shell): Yes [E1 P15][E3]. officially-supported.
- No shared dependency versions required across the boundary: Yes [E3 principle 4]. framework-guarantee.
- Generated shell package declares zero runtime dependencies (contract inlined, direct deps bundled): Yes [E3 "Shell Generation"]. framework-guarantee; per the thesis this is vendor-claim-verifiable per shell, not to be assumed [E1 §5.7].
- Contract version is baked into each side's artifact and checked during the handshake, so incompatibility fails at first contact rather than drifting silently: Yes [E2][E7]. framework-guarantee.
- Feature-side build requires the `hf` CLI (Node >= 18) to produce a shell: Yes [E2]. officially-supported.

### Runtime coupling

- Shared JS realm between host and feature: No (separate documents) [E3]. browser-guarantee.
- All communication rides one contract-validated postMessage channel; unknown inbound types are dropped and logged: Yes [E3 principle 3]. framework-guarantee.
- SDK control traffic (present/viewport/beat/visibility/dirty/dismiss/request/response) rides the same channel under a reserved `__hf:` prefix, filtered before consumer handlers; no privileged side channel: Yes [E3 "The Control Plane"]. framework-guarantee.
- Payload schema validation on send (throws sender-side) and on receive (drops + `error {reason: 'invalid-payload'}`): Conditional (only for actions that declare a `schema`; schema-less actions pass through) [E2]. framework-guarantee.
- Correlated request/response with default 30 s deadlines; pending requests reject on session end, including across peer reload: Yes [E3]. framework-guarantee.
- Adding contract actions is backward compatible; only `accepted` entries flagged `required: true` gate the connection: Yes [E2][E3]. framework-guarantee.
- Direct function calls, shared stores, shared globals across the boundary: No (by design; the boundary forbids them) [E7]. browser-guarantee.

### Isolation and failure containment

- DOM, CSS, and JS-realm isolation enforced by the browser, not by convention: Yes [E7 P2, P3]. browser-guarantee.
- Process-level isolation: Conditional (cross-origin frames are typically process-isolated; same-origin frames share the host's thread) [E6 Limits]. browser-guarantee (browser-dependent).
- One feature's failure confined to its region of the page; documented acceptance test is "kill one feature at the network level, page keeps working": Yes [E5 §8][E1 P17]. framework-guarantee (demonstrated in guide).
- Liveness judged in four states (healthy/unobservable/suspect/gone); recovery policy runs once per suspect episode: Yes [E3][E6]. framework-guarantee.
- Heartbeat cadence and miss budget are fixed (1 beat/s, budget 3), not configurable; a different silence budget means building your own deadline over product events: Yes (limitation) [E6 Limits]. framework-guarantee.
- Watchdog blind window of up to ~3 s after a tab returns to visibility (a feature that died while hidden stays `unobservable` until then): Yes (documented limitation) [E6 Limits]. framework-guarantee.
- A same-origin feature shares the host's thread; a busy spin freezes the host and no watchdog runs: Yes (documented limitation) [E6 Limits]. browser-guarantee.
- The document boundary does NOT isolate: shared browser process/memory budgets, network contention, cookie/storage policy interplay, top-level navigation absent sandboxing: Yes (scope limit on the isolation claim) [E1 §5.13]. inference (from browser mechanics, acknowledged in thesis).

### Framework requirements

- Host UI framework constraints: No (none; host mounts a frame) [E2]. framework-guarantee.
- Feature UI framework constraints: No; demonstrated for 8 frameworks (React, Vue, Svelte, Solid, Preact, Lit, Angular, vanilla TS) by the koi pond demo; "any framework" beyond those is extrapolation: Conditional (demonstrated-for-8, claimed-for-all) [E2][E1 §5.8]. officially-supported (demonstrated) / vendor-claim (universal).
- Feature must be an independently hosted, deployable web app with its own URL (the floor is not zero): Yes [E1 P5]. framework-guarantee.
- Tooling requires Node >= 18: Yes [E2]. officially-supported.
- Optional Nx adapter with zero `@nx/devkit` dependency; core never imports build-tool internals: Yes [E3 principle 1]. officially-supported.

### Ownership topology fit

- Feature team ships the integration glue (the shell), collapsing the host's job to declaring where the feature belongs; suited to topologies with no central platform authority over hosts: Yes [E1 P15][E3]. framework-guarantee (mechanism) / argued (organizational fit).
- Fits hosts you cannot negotiate with (external customers' sites, low-code/CMS/portal hosts, aged admin shells): Yes [E1 P5, §3]. argued (the vendor's own claim; mechanism supports it).
- Fits one team, one stack, one release train on a fully controlled host: No; the vendor's own article says "you probably do not need it" and blesses cohesion-first tooling there [E1 §3][E7]. officially-supported (self-conceded).
- Single-vendor, effectively single-maintainer project; community adoption signals: Unknown from the repository alone (one primary author across recent history; no adoption metrics in-repo). inference. This is a real longevity/maintenance-risk axis and must not be softened.

### Migration requirements

- Incremental adoption per feature; legacy and replacement run side by side without a synchronized rewrite: Yes [E1 P16]. framework-guarantee (mechanism).
- Requires rewriting existing apps to participate: Conditional (a feature app needs the hostee SDK glue plus `feature.config.*`; `hf init` scaffolds it; the app otherwise stays itself) [E2][E3]. officially-supported.
- Acquired foreign-stack estates integrable without stack alignment: Yes [E1 P16]. argued (mechanism supports; no case study in repo).

### Deployment

- Independent deployment per feature (own URL, own cadence): Yes [E3]. framework-guarantee.
- Feature updates behind the same URL require no host redeploy while the contract holds: Yes [E3 "Shell Generation"]. framework-guarantee.
- Contract-changing updates require the host to install a regenerated shell (or accept handshake denial on incompatible versions): Yes [E2]. framework-guarantee.
- Baked shell values (URL, default mode, dimensions, permissions, protocol) are host-overridable defaults; contract and mode set are not overridable: Yes [E3]. framework-guarantee.
- Production static serving included (`hf serve`: compression, conditional requests, header rules); no external registry, CDN, or control plane required or provided today: Yes [E2][E3]. officially-supported. (Managed hosting/registry exist only as planned Enterprise capabilities, see Editions.)
- Operational obligation: every feature is an independently hosted URL the owning team must build, serve, and keep alive: Yes (cost) [E1 §3]. officially-supported (self-conceded).

### Contracts and communication

- Written, versioned, schema-capable contract artifact as the sole coupling: Yes [E3 principle 3]. framework-guarantee.
- Symmetric, idempotent three-frame handshake (REQUEST/ACCEPT/OPEN), either side may initiate, simultaneous starts collapse via broker-id tie-break; all gates (contract validity, required actions, security policy, version compatibility) run inside it: Yes [E3 "The opening handshake"]. framework-guarantee. The claim that the handshake establishes enough shared state to release queued messages is self-flagged as load-bearing and unverified formally [E1 §5.4]. argued.
- Version gate: different major (or different minor below 1.0.0) denied before the channel opens; unversioned peers always pass: Yes (the always-pass rule is a permissive edge worth noting) [E2]. framework-guarantee.
- Pre-open sends queue and flush on open; default open/ready deadlines 10 s; timeout tears down and surfaces machine-readable errors: Yes [E3 Data Flow]. framework-guarantee.
- Polite teardown with `closing` flush window and dirty-state signalling (`setDirty`/`isDirty`); `destroy()` immediate: Yes [E3]. framework-guarantee.
- Peer reload survival: mount survives, presentation re-announced, consumer sees `close {reason: 'peer-reload'}` then fresh `open`: Yes [E3]. framework-guarantee.
- Silent plaintext downgrade: a counterpart that omits the security protocol falls back to plaintext and no runtime signal reports it; mitigation is a build/deploy-time pin comparison: Yes (documented sharp edge) [E4 §"protocol", line 59][E1 §5.11]. framework-guarantee (of the limitation).

### UX implications

- Geometry authority stays with the host: host measures its container and reports exact pixels (`__hf:present`, `__hf:viewport`); feature sizes its document to match and never announces geometry: Yes [E3 principle 7]. framework-guarantee.
- Child-driven content auto-sizing (the classic iframe resize pattern): No, deliberately excluded; content-driven growth must be modeled as ordinary product data the host may act on: Yes (a real cross-boundary UX limit for content-height embeds) [E1 P14][E3]. framework-guarantee.
- Display modes are contract-declared (embedded, dialog, popup, standalone); undeclared mode is a compile error, runtime throw, and absent from the bundle; host picks per open: Yes [E3 Display Modes]. framework-guarantee.
- Dialog mode: transparent full-viewport pane, feature draws box and backdrop, dismiss crosses as a signal under host policy; frames hidden until session opens (no half-loaded flash): Yes [E3]. framework-guarantee.
- Cross-boundary routing/history integration, deep linking into a feature, and cross-frame accessibility (focus order, screen-reader continuity) are not solved by the framework and still need per-integration design: Yes (acknowledged gap) [E1 P6, §3]. officially-supported (self-conceded).
- Shared product cohesion (theming, auth topology, shared state) is explicitly out of jurisdiction; agreements between two applications: Yes [E1 P6]. officially-supported.

### Performance causes

- Per-feature cost of a second full document (memory, startup, separate framework copy per frame; no cross-feature dependency dedup): Yes, acknowledged in the sources but never quantified; the matrix needs measured heap/boot numbers: Unknown (magnitude) [E1 §5.9]. officially-supported (existence) / Unknown (size).
- v1 security envelope pays per-message key derivation and collapses under many concurrent chatty channels, dropping messages silently instead of erroring; documented mitigation is keeping crypto off high-cadence channels: Yes (observed in the koi pond, thresholds unpublished) [E5 §6, line 55]. officially-supported (documented limitation), unquantified.
- Per-message schema validation is a per-message cost; hot paths may deliberately omit schemas: Yes [E1 §4.5][E2]. framework-guarantee.
- Composition adds no server round trips (fully client-side); each feature's assets load from its own origin (per-origin caching, no shared vendor chunk): Yes [E3]. inference from mechanics.

### Security and trust

- Realm/DOM/CSS isolation browser-enforced on every page load ("enforced vs promised"): Yes, with the scope limits listed under Isolation [E7 P3][E1 §5.13]. browser-guarantee.
- Capability flows from the host: feature declares needed Permissions-Policy features (baked, disclosed in `metadata.json`); host applies/replaces `allow`; `sandbox` host-decreed, never baked; SDK manages hazardous tokens (`allow-scripts` always, `allow-same-origin` only cross-origin) so a sandbox-shedding same-origin frame cannot be expressed; no raw token strings: Yes [E3 principle 6]. framework-guarantee.
- Trust model boundary: origin + source pinning authenticates a window at an origin, not a speaker within the page; in-page co-resident scripts (analytics, tag managers, compromised deps) are OUTSIDE the core trust model; CSP/Trusted Types/SRI offered as defence-in-depth, not cure: Yes (scoped claim; do not credit as generic "secure") [E1 P13, §5.12][E10]. officially-supported (scoped).
- Encrypted envelope opt-in: `none` (local default) / `v1` / `v2 + sharedKey`, negotiated in the handshake; handshake frames stay plaintext; production builds must opt in explicitly (`hf build --ci --allow-open` makes an open channel an acknowledged decision): Yes [E3 principle 5][E2][E5 §6]. framework-guarantee. v2 characterized as real pre-shared-key protection, v1 as deterrence [E1 §5.12]. vendor-claim (no third-party audit in repo).
- Embedding authorization (who may frame the feature) is out of SDK scope: `frame-ancestors` plus server-side auth remain the operator's job: Yes [E1 P13][E10]. officially-supported.
- Silent plaintext downgrade (see Contracts): security-relevant sharp edge, restated here so the matrix cannot miss it [E4]. framework-guarantee (of the limitation).

### SSR and delivery

- Server-side rendering of the composed page: No. Composition is client-side runtime only; no SSR, streaming, or edge-composition facility appears anywhere in the features docs, guides, or rationale (grep across `libs/features/` and the cited guides finds no SSR treatment). inference from absence, consistent with the mechanics [E3][E7].
- Individual feature apps may internally use any stack including SSR frameworks for their own document: Conditional (the framework neither helps nor hinders; the frame still boots client-side inside the host) [E2]. inference.
- First meaningful paint of embedded content requires frame boot + handshake before reveal (frames stay hidden until the session opens): Yes [E3]. framework-guarantee.
- SEO: embedded feature content is not part of the host document; hosts needing indexed composed content are outside this model: Yes [inference from iframe mechanics; not discussed in repo]. inference.

### Operational model

- Observability splits at the boundary: stack traces do not cross; what crosses are relationship failures (timeouts, rejected messages, incompatible contracts, liveness suspicion); cross-app debugging needs correlation IDs and a responsive team on the other side: Yes (honest cost) [E1 P17]. officially-supported.
- Dev-time debug UI (`hf dev`): display-mode, resize, message-log, and security controls in-browser: Yes [E3 Module Composition]. officially-supported.
- Shell `metadata.json` (FeatureDescriptor) restates identity, version, URL, contract, modes, protocol, permissions for review without unpacking; a registry COULD consume it, but no registry exists today: Yes (format) / No (registry) [E3]. framework-guarantee / absence.
- Pre-1.0 maturity: breaking wire changes are permitted and have occurred across the 0.x line; adopters must track a fast-moving contract: Yes (risk) [E8][E1 §4 header]. inference from versioning posture.
- Bus-factor/support: no commercial support offering available today; support surface is the open-source repo: Yes [E9]. inference (Enterprise support is planned only).

## Editions and commercial layer

- HyperFrontend Community: the `@hyperfrontend/*` packages, MIT, available today (availability: available-immature; pre-1.0) [E2][E8].
- HyperFrontend Enterprise: announced-planned ONLY. No Enterprise capability is available as of 2026-08-28, and none may be scored as available (REQ-AVAIL-01). Planned capability areas, per the framework's own enterprise-layer model [E9], all with availability "planned":
  - Managed hosting (decomposed into the seven `hosting.*` atoms; notionally vendor-operated)
  - Ephemeral mediated backchannel (`integration.ephemeral-mediated-backchannel`)
  - Identity dimension (managed/enterprise authentication, token exchange, key issuance, tenant context)
  - Registry (deployable-feature registry with marketplace responsibilities layered on)
  - Contract governance (including a notional "v3 enterprise security protocol")
  - Governance atoms (RBAC, audit log, approval workflow, environment promotion, rollback, usage monitoring, artifact review, policy enforcement, contract validation)
  - Admin surface (embeddable management dashboard)
  - AI Dev Assist (`dx.ai-dev-assist`, planned to span Community and Enterprise)
- Per the edition rules [E9 §2]: never mark HyperFrontend generally as having an Enterprise-only capability; never downgrade Community's architectural fit for lacking managed services.

## Family mapping (provisional)

- Primary family: plain iframe composition (document-boundary isolated runtime composition). HyperFrontend is a branded, contract-orchestrated implementation of that family; the family's isolation properties attach at `attach.family`, the handshake/heartbeat/presentation/shell machinery at `attach.implementation` [E9 §2][E1].
- Secondary/edge: the popup and standalone display modes reach into windowed (non-in-page) composition; not a separate family membership, but the matrix should not assume all modes are iframes [E3 Display Modes].
- Explicit non-membership: not module federation, not import-map architecture, not web-components composition, not server/edge composition; no shared-realm mode exists at all [E3][E7].
- Closest branded neighbors for the head-to-head: Luigi (enterprise iframe shell over postMessage) and wujie (iframe JS context split); noted in the landscape inventory.

## Ambiguities and decomposition candidates

- "Works with any framework" is two attributes: demonstrated-for-8 (koi pond) vs claimed-for-all (extrapolation) [E1 §5.8].
- "Secure" must be split before scoring: (a) browser-enforced realm/DOM/CSS isolation; (b) channel confidentiality vs co-resident scripts (v2 conditional on shared key, v1 deterrence-grade); (c) embedding authorization (out of SDK scope, operator job); (d) downgrade signalling (absent at runtime, present at build time) [E1 §5.11-5.13].
- Per-frame cost needs measurement atoms, not one cell: heap per frame, boot-to-open latency, per-message validation overhead, v1 collapse threshold under concurrent channels; all currently acknowledged-but-unquantified [E1 §5.9-5.10].
- The core economic bet (isolation-first amortizes; coordination subscription grows with team count) is argued from mechanism, not measured; condition it on org size, stack variance, and host controllability rather than scoring it as a property [E1 P4, §5.2].
- Liveness detection splits into: four-state model (yes), configurable cadence (no), visibility blind window (~3 s), same-origin coverage (none) [E6].
- Maintenance risk splits into: maintainer count (effectively one), release cadence (high), adoption/community size (Unknown without external research), commercial backing (planned only).
- SSR splits into: composed-page SSR (No) vs per-feature internal SSR (Conditional, framework-neutral).

## Sources

All refs are repository file paths, read 2026-08-28. No web research performed for this dossier (per task constraints); external-facing claims (npm availability, community size) are marked Unknown where the repo alone cannot establish them.

- [E1] [../hyperfrontend-thesis.md](../hyperfrontend-thesis.md) (accessed 2026-08-28) - extracted principles P1-P17, mechanical bullet list, evidence-label register §5, self-conceded costs §3
- [E2] `libs/features/README.md` (accessed 2026-08-28) - package purpose, entry points, quick start, contract/versioning/schema/protocol behavior, Node >= 18, koi pond demonstration claim
- [E3] `libs/features/ARCHITECTURE.md` (accessed 2026-08-28) - layering over nexus, design principles 1-8, handshake, control plane, display modes, shell generation, session assumptions
- [E4] `apps/docs-site/content/guides/embed-a-shipped-feature/guide.md` (accessed 2026-08-28) - line 59: silent plaintext fallback with no runtime signal; build-time pin comparison
- [E5] `apps/docs-site/content/guides/compose-independent-features/guide.md` (accessed 2026-08-28) - §6 line 55: v1 per-message key derivation and silent collapse under concurrent chatty channels; §8 network-kill acceptance test
- [E6] `apps/docs-site/content/guides/detect-unresponsive-feature/guide.md` (accessed 2026-08-28) - Limits: fixed 1 s/3-miss cadence, ~3 s post-visibility blind window, same-origin watchdog freeze
- [E7] `apps/docs-site/content/articles/microfrontends-from-first-principles.md` (accessed 2026-08-28) - canonical rationale; enforced vs promised isolation, contract-as-floor, self-flagged load-bearing claims
- [E8] `libs/features/package.json` (accessed 2026-08-28) - version 0.8.0, MIT, dependency line (nexus 2.0.1, network-protocol 0.2.1)
- [E9] [../../model/enterprise-layer.md](../../model/enterprise-layer.md) (accessed 2026-08-28) - edition model, planned Enterprise capability areas, availability discipline, attachment rules
- [E10] `apps/docs-site/src/app/docs/core-concepts/security/page.tsx` (accessed 2026-08-28, existence and role verified) - the security model page: trust-model scoping, browser/protocol/operator split
