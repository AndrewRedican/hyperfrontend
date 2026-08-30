# The HyperFrontend Floor

Status: DERIVED v1 (2026-08-29). Companion to
[hyperfrontend-positioning.md](hyperfrontend-positioning.md); consumed by the decision tool
to answer one question: *what exactly would have to be true, or become true, for
hyperfrontend to be usable here?*

Research snapshot: August 2026. Every row resolves to a cell in
[../matrix/columns/hyperfrontend.json](../matrix/columns/hyperfrontend.json) (verifiedAt
2026-08-28), a line in [../research/solutions/hyperfrontend.md](../research/solutions/hyperfrontend.md),
a principle id in [../research/hyperfrontend-thesis.md](../research/hyperfrontend-thesis.md),
a family field in [../model/families.md](../model/families.md) 3.7, or a constraint form in
[../model/constraints.md](../model/constraints.md) section 2.

Rules this file obeys:

- `floor.rule.no-marketing`: every entry is a requirement, a cost, or an absence. Nothing
  here argues for adoption. A requirement the reader cannot meet is a clean exclusion, and
  saying so is the point of the file.
- `floor.rule.cell-backed`: no requirement is asserted without a cell, dossier line, or
  browser mechanic behind it. Where the evidence is inference from browser mechanics rather
  than a scored cell, the row says so.
- `floor.rule.posture-not-product`: several cells are Conditional on deployment posture
  (cross-origin vs same-origin, sandbox applied vs not, crypto protocol). The posture
  decides the claim, not the product (families.md 6.3). Rows carry their condition text
  verbatim and never drop it.
- `floor.rule.no-planned-credit`: HyperFrontend Enterprise is `avail.announced-planned` in
  full. No planned capability relaxes any requirement below (REQ-AVAIL-01).
- `floor.rule.floor-is-not-zero`: the project's own argument is that this is the *smallest*
  contract that still buys browser-enforced isolation, and that the smallest is not nothing
  (thesis P5). Section 1 is the "not nothing".

Scope note: sections 1 to 4 describe `hyperfrontend` the matrix unit. Where a requirement
belongs to `family.document-embedding` as a whole (and therefore also to
`iframe-composition` and to `luigi` in iframe mode), the row says so, because a reader
blocked by a family-level requirement is blocked by the browser, not by this project.

---

## 1. Participant-side requirements (`floor.participant.*`)

What must be true of the app that wants to be composed. Twelve requirements. The first six
are the ones a reader most often discovers too late.

### `floor.participant.independent-url`

- **Requirement**: the feature must already be, or must become, a separately deployed web
  app reachable at its own URL.
- **Technical detail**: the composed unit is a live document fetched by the browser, not a
  JS artifact, an HTML fragment, or a build output the host consumes. A feature living
  inside a monolith must be extracted first; there is no in-place wrapping of a code path.
  Static files on any host are sufficient, and the built-in `hf serve` is optional, so this
  is an extraction and serving requirement, not a platform requirement.
- **Evidence**: `migration.participant.extraction-required`=yes ("a feature must be an
  independently hosted app with its own URL; no in-place wrapping");
  `framework.html-document-entry`=yes; `framework.esm-artifact-required`=no ("integration
  unit is a hosted HTML document, not a module artifact");
  `deployment.participants-static-artifacts`=yes; `ssr.static-hosting-sufficient`=yes;
  dossier "Framework requirements" ("the floor is not zero"); thesis P5.

### `floor.participant.operated-origin`

- **Requirement**: some team must own that URL in production, on call, for as long as the
  feature is embedded anywhere.
- **Technical detail**: every feature is its own running origin with its own uptime,
  certificates, cache headers, and incident surface. The host cannot serve it, keep it
  alive, or fail over for it. This is a standing operational obligation, not one-time
  adoption work, and it is the cost the project concedes most plainly.
- **Evidence**: `ownership.runtime-operational-ownership`=yes ("each feature is an
  independently hosted URL its team must serve and keep alive"); dossier "Deployment"
  (operational obligation, self-conceded); thesis section 3 ("costs that never go away even
  when the pattern fits").

### `floor.participant.framable-by-the-host`

- **Requirement**: the feature's server must permit the host page to frame it.
- **Technical detail**: embedding authorization lives entirely in the participant's own
  response headers (`Content-Security-Policy: frame-ancestors`, legacy `X-Frame-Options`)
  plus whatever server-side authorization the feature applies to embedded sessions. The SDK
  neither sets nor checks these; a feature that ships `frame-ancestors 'none'` cannot be
  composed by anyone, and no host-side setting overrides that. Note the asymmetry: CORS is
  *not* required, because frame navigation is not a CORS-governed fetch. Cookies used by the
  feature inside a cross-origin frame are third-party cookies and are subject to the
  browser's partitioning and blocking rules, which is auth-topology work the two
  applications must agree on.
- **Evidence**: `security.embedding-authorization`=conditional ("via participant-set
  frame-ancestors/XFO headers; explicitly out of SDK scope (operator job)");
  `deployment.cross-origin-cors-required`=no ("frame navigation is CORS-exempt");
  `isolation.storage.partition`=conditional ("cross-origin feature frames get partitioned
  third-party storage ... cookie-policy interplay stays shared"); families.md 3.7 migration
  field (participant floor level 1 is exactly "frame-ancestors/CORS headers"); thesis P13.

### `floor.participant.runs-in-its-own-document`

- **Requirement**: the feature must be a complete page that boots on its own, not a fragment
  that expects a surrounding app.
- **Technical detail**: the browser loads the feature's document natively; nothing is
  fetched and re-parsed into the host DOM, and no host-side rewriting happens. The feature
  therefore ships its own HTML shell, its own CSS (host styles never reach it), its own
  fonts, and its own framework copy. Anything it currently inherits from a parent
  application (a theme, a layout wrapper, a global store, an auth context object) must
  become either self-contained or a contract message.
- **Evidence**: `isolation.document-boundary`=yes; `composition.kind.html-entry`=no ("frame
  loads the feature document natively; no fetch-and-rewrite");
  `composition.kind.html-fragment-endpoint`=no; `ssr.html-fragment-contract`=no
  ("participant format is a live app document needing its SDK runtime, not inert fragment
  HTML"); `isolation.css.inbound`=yes; `ownership.participant-bytes-verbatim`=yes;
  `performance.duplicate-framework-same-page`=yes. Family-level requirement (families.md
  3.7 definition).

### `floor.participant.hostee-glue-at-bootstrap`

- **Requirement**: someone with commit access must edit the feature's entry point to start
  the hostee SDK.
- **Technical detail**: the participant adaptation floor is level 4 on the migration scale,
  `migration.bootstrap-change`: the entry/startup file imports and calls the hostee SDK and
  the app gains a `feature.config.*`. Internals, routing, and component code are untouched
  (level 5 and above are explicitly not required), and no rewrite is implied. But the change
  is in the participant's source, which means an unmodifiable third party, an acquired
  estate with no reproducible build, or a vendor who will not ship a per-customer entry
  point is excluded, and no host-side effort substitutes. This is the single most common
  exclusion for this unit: both scenario fixtures traced end to end excluded it here.
- **Evidence**: `migration.participant.min-level`=conditional, condition
  `migration.bootstrap-change` ("hostee SDK glue in entry plus feature.config plus hf build;
  internals otherwise untouched"); `migration.participant.bootstrap-change-required`=yes;
  `migration.source-modification-required`=yes;
  `migration.participant.internals-refactor-required`=no;
  `migration.participant.rewrite-required`=no;
  `migration.participant.thirdparty-unmodified-viable`=no ("full participation needs SDK
  glue and an hf-generated shell"); `framework.client-library-required`=yes;
  `framework.foreign-artifact-no-rebuild`=no; `runtime.shared-runtime-library`=yes;
  positioning `pos.misfit.unmodifiable-participant`.

### `floor.participant.contract-authored-and-versioned`

- **Requirement**: the two sides must write down every message, its direction, and its
  payload shape, and stamp the whole thing with a version.
- **Technical detail**: one `FeatureContract` artifact of `emitted` and `accepted` action
  descriptions is the sole application-level coupling. It is baked into the generated shell
  and presented by both sides during the handshake; incompatible majors (or incompatible
  minors below 1.0.0) are refused before the channel opens, with a machine-readable error.
  Two permissive edges to know: an unversioned peer always passes the gate, and payload
  validation only covers actions that actually declare a schema. The contract is authoring
  work, and keeping it accurate is standing work; the mechanism enforces what is written,
  never what was meant.
- **Evidence**: `contracts.formal-descriptor`=yes; `contracts.contract-versioned`=yes;
  `contracts.connect-compat-gate`=yes ("permissive edge: unversioned peers always pass");
  `contracts.drift-explicit`=yes; `contracts.schema-validated-payloads`=conditional ("only
  actions that declare a schema are validated; schema-less actions pass through");
  `contracts.types-shared`=yes; thesis P7.

### `floor.participant.no-shared-realm-or-dom`

- **Requirement**: the feature must not need the host's JavaScript objects, the host's DOM,
  or a shared store.
- **Technical detail**: there is no shared realm to reach into, by construction. No direct
  calls, no shared globals, no shared state container, no importing a host module. Every
  cross-boundary interaction is an asynchronous serialized message under the contract, with
  structured-clone semantics (live references, class instances, functions, and DOM nodes do
  not cross). A feature currently written against `window.parent` conveniences, or against a
  host-provided singleton, must have those paths replaced before it can participate.
- **Evidence**: `runtime.shared-js-realm`=no; `contracts.sync-calls`=no ("async postMessage
  only; the boundary forbids direct references"); `contracts.serialized-boundary`=yes;
  `contracts.builtin-shared-state`=no ("message passing only; no persistent shared store");
  `security.host-dom-reach`=conditional ("cross-origin frames: no (SOP-blocked)");
  `runtime.global-registration-collision`=no. Family-level requirement (families.md 3.7).

### `floor.participant.hf-toolchain-for-the-shell`

- **Requirement**: the feature team needs Node 18 or newer to run the `hf` CLI and produce
  the shell the host installs.
- **Technical detail**: this is separate from the bootstrap edit. The feature's own build is
  never consumed by the host and any bundler (or none) is fine, but the shell package is
  generated by `hf build` from the feature config, so the CLI has to run somewhere in the
  feature team's pipeline. A version floor is imposed by the tooling even where the app
  itself has no build.
- **Evidence**: `buildtime.participant-tooling-required`=yes ("hf CLI (Node >= 18) generates
  the shell"); `framework.version-floor-imposed`=yes;
  `migration.participant.legacy-no-build-viable`=conditional ("the app's own build is never
  consumed ... but the hostee SDK must run in its pages and hf CLI needs Node >= 18");
  `buildtime.bundler-family-restricted`=no.

### `floor.participant.sizes-to-host-geometry`

- **Requirement**: the feature must render to whatever pixel box the host hands it, and must
  never announce its own size.
- **Technical detail**: geometry authority is inverted relative to the common
  child-announces-height pattern. The host measures its container and sends exact pixels
  (`__hf:present` at open, `__hf:viewport` on change); the feature lays out to match. Content
  that wants to grow must be expressed as ordinary product data the host may act on. The
  feature also declares which display modes it supports (embedded, dialog, popup,
  standalone) in `feature.config.*`; an undeclared mode is a compile error and is absent from
  the generated bundle, and the host picks among the declared ones per open.
- **Evidence**: `ux.natural-layout-flow`=no ("deliberate host geometry authority; child
  content auto-sizing excluded by design"); `ux.host-overlay-protocol`=yes;
  `ux.overlay-viewport-escape`=conditional; thesis P14; dossier "UX implications".

### `floor.participant.own-observability`

- **Requirement**: the feature team must ship its own error reporting, because nothing about
  its failures reaches the host except relationship-level facts.
- **Technical detail**: stack traces do not cross the boundary. What the host receives is
  typed relationship failure: open or ready timeout, rejected message, invalid payload,
  denied handshake, and a four-state liveness judgement (healthy, unobservable, suspect,
  gone). Debugging a cross-boundary user journey requires correlation ids agreed between the
  two applications and a responsive team on the other side. The watchdog itself has fixed
  behaviour the feature cannot tune: 1 beat per second, a 3-miss budget, an approximately
  3 second blind window after a tab returns to visibility, and no coverage at all when the
  feature is same-origin (a busy spin then freezes host and watchdog together).
- **Evidence**: `operations.stack-traces-cross-boundary`=no; `operations.owner-attribution-builtin`=yes;
  `operations.cross-journey-correlation-diy`=yes (self-conceded);
  `isolation.recovery.in-page`=yes ("~3 s visibility blind window, fixed 1/s cadence");
  `isolation.resource.main-thread`=conditional ("a same-origin feature shares the host thread
  and a busy spin freezes host and watchdog"); thesis P17.

### `floor.participant.same-url-deploy-discipline`

- **Requirement**: the feature's URL is the version; deploys behind it must stay
  contract-compatible or the host's sessions start failing the gate.
- **Technical detail**: there is no pointer layer, no immutable retention, and no consumer
  pinning. A host receives whatever is currently deployed behind the URL. Compatible deploys
  are fully uncoordinated (this is the point of the model); contract-breaking deploys are
  refused explicitly at the handshake until every host installs a regenerated shell.
  Rollback means redeploying prior content, and cache-busting the well-known document is the
  operator's job (`hf serve` conditional requests mitigate but do not remove it).
- **Evidence**: `deployment.consumer-version-pin`=no ("the gate refuses incompatibles but
  cannot pin"); `deployment.immutable-version-retention`=no; `governance.rollback`=no
  ("same-URL model: rollback means redeploying prior content");
  `deployment.cache-busting-operator-burden`=yes;
  `ownership.distrusted-cadence`=conditional; `deployment.golive-central-pointer`=no.

### `floor.participant.tracks-a-pre-1.0-wire`

- **Requirement**: the feature team must be able to redeploy on the project's schedule, not
  only its own, for as long as the protocol is pre-1.0.
- **Technical detail**: the whole package line is 0.x and breaking wire changes are
  explicitly permitted and have occurred. Both sides carry the SDK, so a wire break is a
  coordinated redeploy of every participant and every host, which is precisely the
  coordination this architecture exists to avoid paying elsewhere. This is a maturity fact
  reported beside architectural fit, never folded into it (REQ-AVAIL-03), but it is a real
  requirement on the adopter today.
- **Evidence**: `unit.availability.stable-line-shipped`=no ("0.x line throughout; breaking
  wire changes explicitly allowed"); `migration.forced-remigration-pending`=yes ("adopters
  track a fast-moving contract"); `migration.permanent-viability`=conditional;
  positioning `pos.weakness.pre-1.0`.

---

## 2. Host-side requirements (`floor.host.*`)

What must be true of the page doing the composing. Nine requirements. The host floor is
genuinely low, and the matrix records it as level 1 (`migration.trivial-adaptation`) at
medium confidence; the honesty note in `floor.host.place-an-element` explains what that
medium confidence is about.

### `floor.host.place-an-element`

- **Requirement**: the host must be able to put an element on the page and declare that a
  feature belongs there.
- **Technical detail**: the host installs one generated shell package (npm import or a
  script tag) and declares a mount. It does not adopt a framework, hand over its document
  shell, stand up an infrastructure tier, or restructure routing. Onboarding a *new* feature
  is a host change each time (one install plus one mount declaration); there is no ownerless
  admission path. Honesty note: the cell is Conditional at medium confidence on
  `migration.trivial-adaptation`, which the scale defines as configuration, metadata, or
  packaging only. The level-1 reading holds cleanly where placement is genuinely
  configuration (a CMS block, a script tag plus a target element); on a host with a
  build, the mount declaration is a small source change.
- **Evidence**: `migration.host.min-level`=conditional, condition
  `migration.trivial-adaptation`, note "one script tag or npm install plus a mount
  declaration" (confidence: medium); `migration.host.shell-takeover-required`=no;
  `migration.host.new-infra-tier-required`=no;
  `deployment.new-participant-host-change`=yes;
  `ownership.onboarding-without-central-owner`=no; migration.md section 2 (level scale).

### `floor.host.execute-the-shell-runtime`

- **Requirement**: the host page must be allowed to load and run the shell's JavaScript.
- **Technical detail**: composition is done by client-side JS in the host document, so a
  strategy-owned runtime ships on the page. A host whose CSP forbids adding a script (no
  nonce, no hash, no permitted origin for the shell bundle), or which forbids third-party JS
  by policy, cannot integrate at all. Buildless hosts are supported precisely because the
  shell is consumable as a script tag with zero declared runtime dependencies.
- **Evidence**: `composition.exec.client-composed`=yes;
  `performance.client-composition-runtime`=yes ("host loads the shell/nexus runtime");
  `runtime.shared-runtime-library`=yes; `buildtime.host-integrates-buildless`=yes
  ("script-tag consumption of the generated shell"); dossier "Build-time coupling".

### `floor.host.permit-framing-and-decree-capability`

- **Requirement**: the host's own page policy must permit framing the feature's origin, and
  the host must decide the frame's sandbox and permissions.
- **Technical detail**: two directions to check. Outbound, the host's CSP `frame-src`
  (and any embedder isolation policy such as COEP) must allow the feature origin. Inbound,
  `sandbox` is host-decreed and never baked into the shell, and the feature's declared
  Permissions-Policy needs are applied (or replaced, or narrowed) by the host as the frame's
  `allow`. The SDK manages the hazardous tokens so a sandbox-shedding same-origin frame
  cannot be expressed, and delegation only narrows. The consequence is that the host, not
  the feature, is the party who decides how strong the boundary actually is.
- **Evidence**: `security.sandbox-attribute-applicable`=yes ("host-decreed; SDK blocks the
  allow-scripts plus allow-same-origin self-unsandbox combo");
  `security.capability-narrowing`=yes ("feature-declared Permissions-Policy needs,
  host-applied; delegation only narrows");
  `isolation.navigation.top-level-guard`=conditional ("only when the host applies its
  decreed sandbox"); `security.per-participant-csp`=yes; thesis P12. The outbound
  `frame-src` half is browser mechanics, not a scored cell.

### `floor.host.tolerate-a-second-document`

- **Requirement**: the host must be able to afford a full extra document per feature on the
  page.
- **Technical detail**: each feature costs a document boot (HTML, assets, framework copy,
  app start) and, at the cross-origin posture on site-isolating engines, per-process memory.
  Nothing is deduplicated across features: no shared vendor chunk, no shared framework
  instance, no cross-feature dependency negotiation. Reveal is gated on a sequential chain
  (host JS mounts the frame, frame HTML loads, assets load, handshake completes), and no
  first-party preload or prefetch levers ship. The honest state of this cost is that its
  existence is acknowledged and its magnitude has never been measured anywhere in the
  sources, which is why the memory constraint may price this unit but may not eliminate it.
- **Evidence**: `performance.per-unit-document-boot`=yes ("acknowledged per-feature document
  cost; magnitude unquantified in sources"); `performance.process-memory-overhead`=conditional;
  `performance.duplicate-framework-same-page`=yes; `performance.shared-dependency-dedup`=no;
  `performance.sequential-waterfall-default`=yes;
  `performance.first-party-preload-levers`=no; `ux.cross-boundary-soft-nav`=conditional
  ("the destination feature boots a full frame document (its assets re-download and
  re-parse)"); constraints.md 2.12 (`constraint.memory-budget` may not eliminate).

### `floor.host.own-geometry`

- **Requirement**: the host must decide how big each feature is, and keep deciding as the
  page changes.
- **Technical detail**: the mirror of `floor.participant.sizes-to-host-geometry`. The host
  measures its own container and reports exact pixels at open and on every change; it never
  receives a height request it is expected to apply. The host also chooses the display mode
  per open from the modes the contract declares. Practically this means the host owns
  responsive behaviour for the region, and a design that wants the feature to grow with its
  content must model that growth as product data.
- **Evidence**: `ux.natural-layout-flow`=no; `ux.host-overlay-protocol`=yes ("contract-declared
  dialog and popup modes; dismiss crosses as a signal under host policy");
  `ux.mount-layout-shift-risk`=no ("host geometry authority plus baked default dimensions
  size the region before content arrives"); thesis P14.

### `floor.host.accept-async-messaging`

- **Requirement**: the host must be willing to talk to the feature by sending messages and
  waiting, never by calling it.
- **Technical detail**: no synchronous call, no shared object, no shared store. Requests are
  correlated envelopes with deadlines (30 s default), and pending requests reject when the
  session ends, including across a peer reload. Every message pays structured-clone plus
  (where a schema is declared) validation cost, and the v1 crypto envelope additionally pays
  per-message key derivation and has been observed to drop messages silently under many
  concurrent chatty channels. Host code that assumes a return value in the same tick has to
  be restructured.
- **Evidence**: `contracts.sync-calls`=no; `contracts.serialized-boundary`=yes;
  `contracts.builtin-messaging`=yes; `contracts.host-push-updates`=yes;
  `performance.per-message-serialization-cost`=yes ("structured clone plus schema
  validation; v1 crypto envelope silently drops messages under chatty concurrent
  channels"); `contracts.builtin-shared-state`=no.

### `floor.host.author-its-own-failure-and-loading-ui`

- **Requirement**: the host must write whatever the user sees when a feature is slow, dead,
  or refused.
- **Technical detail**: the SDK supplies machine-readable outcomes (open-timeout,
  invalid-payload, denied handshake, the four liveness states, close reasons) and hides
  frames until the session opens so there is no half-loaded flash. It supplies no spinner,
  no skeleton, and no visible error state. It also supplies no visible policy: the
  `UnresponsivePolicy` decides *what to do* about a suspect feature (degrade, offer reload,
  force), and the host writes it. The documented acceptance test for a composed page is that
  killing one feature at the network level leaves the page working, which is a test of
  host-authored fallback as much as of the boundary.
- **Evidence**: `ux.builtin-error-fallback-ui`=no ("machine-readable errors surface; visible
  fallback UI is host-authored"); `ux.builtin-loading-ui`=conditional ("frames hidden until
  the session opens masks half-loaded flash; no spinner or indicator shipped");
  `isolation.failure.load-fallback`=yes; `isolation.failure.lifecycle-quarantine`=yes;
  dossier "Isolation and failure containment".

### `floor.host.own-the-cross-boundary-agreements`

- **Requirement**: the host and the feature must agree, application to application, on
  everything the boundary does not carry.
- **Technical detail**: theming and design tokens, auth topology and session propagation,
  routing and deep links into a feature, browser history, focus order across the seam, and
  screen-reader continuity are all outside the mechanism. Some are declared out of
  jurisdiction on principle (theming, auth, product cohesion), some are acknowledged
  unsolved (focus management, deep linking), one is unassessed (screen-reader continuity),
  and one is an active liability (framed navigations enter top-level history with no
  shipped mitigation). Every one of them is engineering the two teams must fund.
- **Evidence**: `ux.token-theming-mechanism`=no ("theming explicitly out of jurisdiction");
  `ux.deep-link-inner-route`=no ("self-acknowledged gap"); `ux.cross-boundary-focus-mgmt`=no
  ("acknowledged unsolved"); `ux.screenreader-continuity`=unknown ("cross-frame
  accessibility is an acknowledged gap; tree continuity unassessed");
  `ux.frame-history-pollution`=yes; thesis P6.

### `floor.host.reinstall-on-contract-break`

- **Requirement**: the host must be able to install a new shell version when a feature
  changes its contract in a breaking way.
- **Technical detail**: while the contract holds, feature deploys reach users with no host
  action at all, which is the model's central benefit. When a contract's major changes, the
  handshake gate refuses the session (explicitly, with a machine-readable error) until the
  host installs the regenerated shell. A host that can never be changed again after first
  integration is therefore viable only for the lifetime of the current contract major, and
  the pre-1.0 wire situation makes that lifetime shorter than it will eventually be.
- **Evidence**: `deployment.host-rebuild-required`=conditional ("no while the contract
  holds; contract-changing updates require the host to install a regenerated shell");
  `ownership.distrusted-cadence`=conditional; `operations.version-skew-machinery`=yes;
  `migration.forced-remigration-pending`=yes.

---

## 3. What hyperfrontend explicitly does not require

Each row is an absence with its matrix evidence, and where the absence has a price, the
price is named in the same row (`floor.rule.no-marketing`).

| Id | Not required | Evidence | Price of the absence |
|---|---|---|---|
| `floor.not.shared-bundler` | No shared bundler, build tool, or toolchain between host and participant, and no shared build at all. A broken feature build never breaks the host build. | `buildtime.bundler-family-restricted`=no ("feature app builds with any toolchain or none; hf only packages the shell"); `buildtime.host-build-consumes-participants`=no; `buildtime.asset-prefix-coordination`=no | The feature side still needs the `hf` CLI on Node >= 18 (`floor.participant.hf-toolchain-for-the-shell`). |
| `floor.not.shared-framework` | No shared framework, no shared framework version, and no alignment of majors. Different frameworks and incompatible majors of the same framework coexist on one page. | `framework.host-framework-agnostic`=yes; `framework.participant-framework-agnostic`=conditional ("demonstrated for 8 frameworks (koi pond); any-framework beyond those is vendor extrapolation"); `framework.mixed-frameworks-one-page`=yes; `framework.same-framework-major-coexistence`=yes; `runtime.side-by-side-versions`=yes; `framework.zero-framework-participant`=yes | Every frame carries its own copy (`performance.duplicate-framework-same-page`=yes). Universality is demonstrated for 8, claimed for all. |
| `floor.not.host-rebuild-per-update` | No host rebuild or redeploy to ship a new version of an already-integrated feature. The feature's own deploy behind its URL goes live directly. | `deployment.host-rebuild-required`=conditional ("no while the contract holds"); `deployment.golive-central-pointer`=no; `ownership.uncoordinated-upgrades`=yes; `ownership.deploy-schedule-ownership`=yes | Contract-breaking updates do require a host install (`floor.host.reinstall-on-contract-break`); the host cannot pin a version it liked (`deployment.consumer-version-pin`=no). |
| `floor.not.dependency-negotiation` | No shared-dependency layer of any kind: no negotiation, no share metadata, no singleton resolution, no version-skew fallback, no standing upgrade governance. | `runtime.shared-dep-negotiation`=no; `buildtime.share-metadata-emitted`=no ("no shared-dependency layer exists by design"); `runtime.dep-conflict-surfaces-runtime`=na; `buildtime.shared-dep-change-rebuilds-center`=na; `coordination.shared-dependency-governance`=no; `performance.dedup-failure-on-version-skew`=na | Zero deduplication (`performance.shared-dependency-dedup`=no). This is the same cell that makes the unit unusable under a strict payload budget. |
| `floor.not.host-build-step` | No build step in the host. Script-tag integration is a supported path, and the shell declares zero runtime dependencies, so no transitive install lands on the host. | `buildtime.host-integrates-buildless`=yes; `buildtime.central-input-for-participant-build`=no ("SDK only; no shell emulator, roster, or cloud handshake"); dossier "Build-time coupling" (zero declared runtime dependencies, vendor-claim-verifiable per shell) | The host still executes strategy-owned JS on its page (`floor.host.execute-the-shell-runtime`). |
| `floor.not.source-access` | No source access in either direction. The host never reads or rewrites the feature's code; the feature never sees the host's. Review happens against the shell's `metadata.json` descriptor (identity, version, URL, contract, modes, protocol, permissions) without unpacking. | `ownership.participant-bytes-verbatim`=yes ("frame loads the feature document as served; no host-side rewriting"); `runtime.shared-js-realm`=no; `security.host-dom-reach`=conditional ("cross-origin frames: no (SOP-blocked)"); `contracts.formal-descriptor`=yes; `ownership.code-boundary-ownership`=yes | Nothing verifies the participant's bytes before they execute: `security.artifact-integrity-verification`=no, a landscape-wide absence (`gap.artifact-integrity`). |
| `floor.not.single-domain` | No requirement that everything be served from one origin, and no CORS headers needed for the frame document itself. | `deployment.single-domain-required`=no; `deployment.cross-origin-cors-required`=no ("frame navigation is CORS-exempt") | Cross-origin is not merely allowed, it is the posture that makes the trust cells hold (section 5.3). |
| `floor.not.vendor-infrastructure` | No vendor hosting, no registry, no discovery service, no control plane, no composition tier in the request path. Static hosting suffices; `hf serve` is optional. | `deployment.vendor-hosting-required`=no; `deployment.strategy-service-in-path`=no; `deployment.runtime-discovery-first-party`=no; `registry.deployable-feature`=no ("no registry ships today (planned Enterprise)"); `hosting.control-plane`=yes (adopter-hosted); `ssr.static-hosting-sufficient`=yes | No registry also means no ownerless onboarding and no first-party deploy inventory (`ownership.onboarding-without-central-owner`=no, `operations.deploy-inventory-firstparty`=no). |
| `floor.not.platform-team` | No standing platform-owner role and no centrally owned roster artifact. Mounts are per host; the feature team ships the glue. | `ownership.platform-team-role-required`=no; `runtime.central-routing-map`=no | Each embedding host does its own install and mount, so the work is distributed rather than removed. |
| `floor.not.participant-internals-work` | No refactor of the participant's internals, no rewrite, and no change to where or how it is hosted. | `migration.participant.internals-refactor-required`=no ("the app otherwise stays itself"); `migration.participant.rewrite-required`=no; `migration.participant.deployment-change-required`=no | The app must already be, or become, independently hosted (`floor.participant.independent-url`). |

---

## 4. Hard incompatibilities (`floor.blocker.*`)

Circumstances under which willingness, budget, and effort do not produce viability. Each
row carries a **kind**, because the honest answers differ: `browser-inherent` means the
browser primitive forbids it and no product in this family can fix it; `family-inherent`
means it follows from the composition boundary itself; `authority-bound` means it is
possible in principle but requires a decision inside someone else's organization.

### `floor.blocker.composed-ssr`

- **Kind**: family-inherent.
- **Statement**: the composed page cannot be server-rendered as one document, because
  composition happens in the browser after the host document has already been delivered.
- **Technical detail**: there is no server or edge tier in this model to assemble anything.
  A feature may server-render its own document internally, but that document is still
  fetched and booted client-side inside the frame, and its content is never part of the
  host document's HTML, so it is not crawlable as host content, cannot paint before JS
  runs, and cannot be statically prerendered into the composed page. Frames additionally
  stay hidden until the session opens, which trades first-paint time for the absence of a
  half-loaded flash.
- **Evidence**: `ssr.composed-page`=no; `ssr.streaming-assembly`=na ("client-composed;
  nothing assembles server-side"); `ssr.edge-composition`=na; `ssr.hydration-orchestration`=na;
  `ux.composed-first-paint`=no; `ssr.crawler-indexable`=no; `ssr.no-js-first-paint`=no;
  `ssr.static-prerender`=no; `ssr.participant-internal`=conditional;
  `composition.exec.client-composed`=yes; positioning `pos.misfit.composed-page-ssr`.

### `floor.blocker.seamless-dom-interleaving`

- **Kind**: browser-inherent (with a partial, contract-declared workaround for overlays).
- **Statement**: content on the two sides cannot interleave as one DOM, because the
  browsing-context boundary that provides the isolation is exactly the thing a shared
  layout, focus ring, or accessibility tree would have to cross.
- **Technical detail**: a feature occupies a rectangle the host sizes. It does not
  participate in the host's layout flow, cannot portal into the host's body, cannot be
  interleaved element-by-element with host markup, and does not share a focus order or an
  accessibility tree. What *is* engineerable is overlays: contract-declared dialog and popup
  modes give the feature a transparent full-viewport surface with a host-policy dismiss
  signal, so a modal can escape the frame rectangle. Interleaving cannot be engineered on
  either side. Constraint form: a hard `constraint.seamless-ux` eliminates the entire family
  and a hard `constraint.a11y-continuity` leaves this unit's cell unresolved, which is a
  finding, not a pass.
- **Evidence**: `ux.natural-layout-flow`=no; `ux.body-portal-compat`=na ("portals stay inside
  the frame document"); `ux.cross-boundary-focus-mgmt`=no; `ux.screenreader-continuity`=unknown;
  `ux.frame-history-pollution`=yes; `ux.overlay-viewport-escape`=conditional;
  `ux.host-overlay-protocol`=yes; families.md 3.7 hard limitations; constraints.md 2.1;
  `gap.secure-seamlessness`.

### `floor.blocker.malicious-co-resident-script`

- **Kind**: browser-inherent.
- **Statement**: a malicious script already running inside the host page cannot be defended
  against, because origin pinning authenticates a window at an origin and every script in
  that page shares the window.
- **Technical detail**: the channel is pinned to a specific window at a specific origin,
  which is exactly the right protection against a wrong-frame or wrong-origin speaker. It
  cannot distinguish the host application from analytics, a tag manager, or a compromised
  transitive dependency running in the same page. The project states this explicitly:
  co-resident in-page scripts are outside the core trust model. The crypto envelope is defence-in-depth over that gap, not a fix: handshake
  frames stay plaintext, v1 is characterized as deterrence-grade, v2 requires a pre-shared
  key, and a counterpart that simply omits the protocol downgrades the channel to plaintext
  with no runtime signal (the only gate is a build-time pin comparison). Real defences
  against in-page adversaries live outside this mechanism: CSP, Trusted Types, SRI, or
  moving the authority to a separate origin.
- **Evidence**: `security.channel-origin-pinning`=yes ("pins window-at-origin; authenticates
  rooms, not speakers within a page"); `isolation.security.malicious-participant`=conditional
  ("in-page co-resident scripts are outside the trust model");
  `security.untrusted-third-party-viable`=conditional (same condition);
  `security.channel-confidentiality`=conditional ("v1 is deterrence-grade; handshake frames
  stay plaintext; silent runtime plaintext downgrade, gated only at build (--allow-open)");
  thesis P13 and claim 12; positioning `pos.weakness.silent-plaintext-downgrade`.
- **Related but different**: a malicious *participant* is a different question, and there
  the answer is Conditional rather than No: cross-origin plus host-decreed sandbox contains
  it, with Spectre-class attacks needing cross-site process isolation.

### `floor.blocker.sync-cross-boundary-calls`

- **Kind**: browser-inherent.
- **Statement**: one side cannot synchronously call the other's live objects, because
  separate documents (and often separate processes) share no call stack and the only
  cross-context primitive is an asynchronous serialized message.
- **Technical detail**: no promise-free call, no shared memory object graph, no passing a
  function or a class instance or a DOM node across. Request and response is modeled as
  correlated envelopes with deadlines, and every value crossing is structured-cloned. This
  is not a missing feature that a thicker SDK could add. The landscape confirms it: no unit
  anywhere in the matrix scores both viable-for-untrusted-code and synchronous calls, and
  the constraint pair is recorded as a standing exclusion.
- **Evidence**: `contracts.sync-calls`=no; `contracts.serialized-boundary`=yes;
  `contracts.builtin-shared-state`=no; constraints.md 2.1 hard form; constraints.md section
  4 `rel.excludes` (`constraint.distinct-principal` x `constraint.sync-boundary-calls`);
  positioning `pos.misfit.sync-boundary-calls`.

### `floor.blocker.shared-library-dedup`

- **Kind**: family-inherent.
- **Statement**: a library used by several features cannot be shipped once for the page,
  because deduplication requires a shared realm and the absence of a shared realm is the
  whole mechanism.
- **Technical detail**: each frame downloads, parses, and holds its own copy of everything.
  There is no negotiation layer to add, and adding one would mean re-entering the shared
  realm the boundary exists to avoid. Mitigations are all indirect: fewer co-displayed
  features, smaller or framework-free features, per-origin HTTP caching. The framework
  itself records this as an inherent trade, not a roadmap item.
- **Evidence**: `performance.shared-dependency-dedup`=no;
  `performance.duplicate-framework-same-page`=yes; `performance.per-unit-document-boot`=yes;
  `gap.untrusted-dedup` ("inherent under current browser primitives (dedup requires a shared
  realm)"); constraints.md 2.7 and section 4.

### `floor.blocker.unmodifiable-participant`

- **Kind**: authority-bound (not physics; the change is small, but it is in someone else's
  repository).
- **Statement**: an app whose entry point nobody will edit cannot participate, no matter
  how much the host side is willing to do.
- **Technical detail**: full participation needs the hostee SDK in the participant's
  bootstrap plus an `hf`-generated shell. There is no embed-only posture that accepts an
  unmodified deployed URL, no host-side adapter that fakes the hostee side, and no proxy
  mode. The blocking party is whoever owns the participant's source: a vendor who will not
  ship a per-customer entry point, an acquired estate with no reproducible build, a
  contractor-built app with no maintainer. If that decision changes, the requirement is one
  import plus a config file, so this blocker can dissolve overnight in a way the other four
  cannot.
- **Evidence**: `migration.participant.thirdparty-unmodified-viable`=no;
  `migration.participant.min-level`=conditional (`migration.bootstrap-change`);
  `framework.foreign-artifact-no-rebuild`=no; `buildtime.participant-tooling-required`=yes;
  positioning `pos.misfit.unmodifiable-participant` and
  `pos.counterfactual.unmodified-participant-posture`; both traced fixtures excluded the
  unit here.

---

## 5. What would have to change (`floor.change.*`)

For every constraint in [../model/constraints.md](../model/constraints.md) whose hard form
eliminates `family.document-embedding` (5.1) or eliminates the `hyperfrontend` unit while
the family survives (5.2), the smallest concrete change that would make it viable. Where the
answer is "nothing you can change", the row says so and names who could change it, if
anyone. Relaxation wording follows the ledger in constraints.md 6.1 and the ordering rule in
6.2 (re-confirm preferences first, organizational changes next, infrastructure, UX,
adaptation appetite, and only last a different composition boundary).

### 5.1 Family-scope eliminators: the reader is blocked by the boundary, not by the product

| Id | Constraint (hard form) | Why it eliminates | Smallest concrete change | Honest verdict |
|---|---|---|---|---|
| `floor.change.seamless-ux` | `constraint.seamless-ux` (constraints.md 2.1) | `ux.natural-layout-flow`=no by design; body portals and global overlays need explicit protocol; the family's stated hard limitation | Re-bind as a strong preference and fund the seam as an engineering program: use the contract-declared dialog and popup modes for anything that must escape the frame rectangle, and treat content-driven growth as product data the host acts on | Partial. Overlays and modals are genuinely reachable. One layout flow, one focus ring, one accessibility tree across the seam is not, at any budget (`floor.blocker.seamless-dom-interleaving`). |
| `floor.change.a11y-continuity` | `constraint.a11y-continuity` (2.1) | binds `ux.screenreader-continuity`, which is `?` for this unit; an unknown is a finding, never a pass | Measure it: an assistive-technology traversal test across a composed page resolves the cell either way, and the measurement is entirely within an adopter's power to run | Nothing you can change if the measurement comes back negative and the requirement is legally mandated: AT tree continuity across browsing contexts is a browser property. Resolving the unknown is still strictly better than carrying it (`pos.counterfactual.a11y-assessed`). |
| `floor.change.sync-calls` | `constraint.sync-boundary-calls` (2.1) | `contracts.sync-calls`=no; the boundary forbids live references | Accept serialized async messaging and restructure the call sites that assume a same-tick return | Nothing you can change about the mechanism. If the requirement is literal synchronous invocation, no member of this family and no unit in the matrix that also contains a distinct principal can serve it. |
| `floor.change.atomic-release` | `constraint.atomic-release` (2.3) | hard form retains only the build-fused pole; `contracts.drift-surface`=yes here by construction | Give up independent deployment and take one release train, which readmits the five baseline families | Nothing you can change while both are hard: the two constraints are definitionally mutually exclusive (`rel.excludes`). This is the `outcome.no-mfe-needed` path, and it is a legitimate answer. |
| `floor.change.composed-first-paint` | `constraint.composed-first-paint` (2.4) | client-runtime composition; `ux.composed-first-paint`=no, `ssr.crawler-indexable`=no | Two real options: (a) accept client composition with designed loading states, or (b) move the SEO-critical, no-JS content into the host's own server-rendered document and let the feature own only the interactive region behind it | Option (b) is a genuine architectural change an adopter can make and is often the honest answer for marketing-adjacent pages. If the *composed* content itself must be crawlable, nothing you can change: there is no server tier in this model to assemble it. |
| `floor.change.payload-dedup` | `constraint.payload-dedup` (2.7) | `performance.shared-dependency-dedup`=no; `performance.duplicate-framework-same-page`=yes | Re-scope the budget from "one copy per page" to "a byte ceiling per feature", reduce the number of co-displayed features, or ship framework-free features (demonstrated: vanilla TS participants) | Nothing you can change if literal deduplication is required. `gap.untrusted-dedup` records this as inherent under current browser primitives. |
| `floor.change.participant-ceiling` | `constraint.participant-modification-ceiling` at maxLevel < 4 (2.6) | the SDK-handshake posture sits at level 4 (`migration.bootstrap-change`) | Obtain authority (or a vendor commitment) to add one import plus a `feature.config` to the participant's entry point; internals, routing, and components stay untouched | Nothing *you* can change when the ceiling is level 9 (no source, no build, no authority). Then the family still serves you through plain `iframe-composition` at the embed-only posture, or the HTML-entry members of `family.virtualized-rehosting` where trust permits. |
| `floor.change.no-host-change-per-participant` | `constraint.no-host-change-per-participant` (2.3) | `deployment.new-participant-host-change`=yes; `ownership.onboarding-without-central-owner`=no | Accept a one-time host change per feature, or batch admissions into scheduled host releases | Nothing first-party today. An adopter-built admission layer is possible but is a real project, and the registry direction is announced-planned only, so it may not be scored or promised (`floor.rule.no-planned-credit`). Registry-mediated units exist today (opencomponents, piral, zephyr-cloud) at the cost of delivery-intermediary trust. |
| `floor.change.main-thread-protection` | `constraint.main-thread-protection` (2.1) | Conditional, not Yes: a same-origin feature shares the host thread, and a busy spin freezes host and watchdog together | Serve the feature from a different origin. This is a deployment-topology decision entirely inside the adopter's control and it flips the condition | Fully changeable, and cheap relative to its effect. Note that process isolation remains engine- and platform-dependent and may never be promised unconditionally. |
| `floor.change.cross-boundary-soft-nav` | `constraint.cross-boundary-soft-nav` (2.5) | Conditional: the host document persists, but switching to another feature boots a full document | Keep the mounted frame alive and hidden instead of destroying it on switch; the live document retains its own state and scroll | Partial and host-authored. There is no first-party keep-alive API, and a genuinely first-visit switch still pays a document boot. |

### 5.2 Unit-scope eliminators: the family survives, this unit does not

These constraints are `scope.implementation` or `scope.edition`. Per REQ-ENT-01 they never
change family selection; they decide whether *this* implementation is the one.

| Id | Constraint (hard form) | Why it eliminates | Smallest concrete change | Honest verdict |
|---|---|---|---|---|
| `floor.change.no-strategy-runtime` | `constraint.no-strategy-runtime` (2.10) | binds `runtime.shared-runtime-library`=no and `framework.version-floor-imposed`=no; this unit is yes on both | None available: the SDK is the product | Nothing you can change. Use `iframe-composition`, the browser primitive, and write the wrapper yourself. The framework must be willing to say so (`pos.tie.vs-iframe-practice`). |
| `floor.change.release-governance` | `constraint.instant-rollback`, `constraint.version-pinning`, `constraint.per-user-targeting` (2.9) | same-URL model: `governance.rollback`=no, `deployment.immutable-version-retention`=no, `deployment.consumer-version-pin`=no, `deployment.per-user-version-targeting`=no | Build an operator-owned pointer layer in front of the feature URL: immutable versioned directories plus a pointer the operator repoints, on any static host | Changeable, by you, at your cost. Nothing first-party ships it, and the planned Enterprise capability may not be counted. Units that ship it today: import-map-architectures, opencomponents, zephyr-cloud. |
| `floor.change.artifact-integrity` | `constraint.artifact-integrity` (2.12) | `security.artifact-integrity-verification`=no | Add SRI and CSP on the feature's own documents as defence-in-depth | Nothing you can change inside the model, and nothing anyone else offers either: this is a landscape-wide absence recorded as `gap.artifact-integrity`, not a deficit of this unit. |
| `floor.change.non-developer-composition` | `constraint.non-developer-composition` (2.8) | `ownership.non-developer-composition`=no | None short of building an admin surface over the mount points yourself | Nothing you can change. A hard binding here is nearly an implementation pick (only entando and commercetools-frontend score yes) and the report must flag it as such. |
| `floor.change.rsc-federation` | `constraint.rsc-federation` (2.12) | `ssr.rsc-federation`=na: no cross-boundary render tree exists | None | Nothing you can change; landscape-wide absence, `gap.rsc-federation`. |
| `floor.change.stewardship` | `constraint.stewardship-durability`, `constraint.stable-line`, `constraint.no-forced-remigration` (2.13) | `unit.maintenance.multi-maintainer`=no; `unit.maintenance.org-steward`=no; `operations.single-sponsor-concentration`=yes; `unit.availability.stable-line-shipped`=no; `migration.forced-remigration-pending`=yes | Nothing on the adopter's side. Only the project can change these, by shipping a 1.0 line, by adding maintainers or a steward, or by accumulating documented adopters | Nothing you can change. These are facts about the project, reported beside architectural fit and never merged into it; on the current data they are the factors most likely to move a reader away from this unit. |

### 5.3 Posture switches inside the adopter's control

Not constraints, but the four decisions that move this unit's Conditional cells, listed here
because a reader asking "what would have to change" is often really asking one of these.

| Id | Decision | Effect | Evidence |
|---|---|---|---|
| `floor.change.posture.cross-origin` | Serve features from a different origin than the host | Flips the whole trust cluster from "containment against accidents" to a real security boundary: host DOM and JS state become unreachable, storage partitions, per-participant CSP applies, the main thread and (engine-dependent) the process separate | `security.host-dom-reach`, `security.host-js-state-reach`, `isolation.origin.host-authority`, `isolation.storage.partition`, `isolation.resource.main-thread`, `isolation.process.crash`, all Conditional on exactly this |
| `floor.change.posture.sandbox` | Apply the host-decreed `sandbox` (and narrow `allow`) rather than leaving the frame unsandboxed | Adds the top-level navigation guard and completes the untrusted-participant posture; the SDK prevents the self-unsandboxing token combination | `isolation.navigation.top-level-guard`=conditional ("only when the host applies its decreed sandbox"); `security.untrusted-third-party-viable`=conditional; `security.sandbox-attribute-applicable`=yes |
| `floor.change.posture.crypto` | Choose the channel protocol deliberately (`none`, `v1`, `v2` with a shared key) and compare pins at build time | v2 with a pre-shared key is real protection; v1 is deterrence-grade and can drop messages under many concurrent chatty channels; omitting the protocol on either side downgrades to plaintext with no runtime signal | `security.channel-confidentiality`=conditional; `performance.per-message-serialization-cost`=yes; `pos.weakness.silent-plaintext-downgrade`, `pos.weakness.v1-envelope-collapse` |
| `floor.change.posture.schemas` | Declare a schema on every action that matters | Validation applies only to actions that declare one; schema-less actions pass through unchecked, and hot paths may skip schemas deliberately for cost | `contracts.schema-validated-payloads`=conditional |

### 5.4 The short answer

If a reader needs one sentence per blocker: composed server rendering, DOM-level
interleaving, defence against scripts already inside the host page, synchronous
cross-boundary calls, and shared-library deduplication are not purchasable at any price in
this family; an unmodifiable participant is purchasable only from whoever owns that
participant's source; everything else on this page is a cost, a posture, or a piece of
engineering somebody has to fund.

---

## 6. Revision rule

This file is an output of the dataset, never an input to it (`floor.rule.cell-backed`). It
is falsified by any cell edit in
[../matrix/columns/hyperfrontend.json](../matrix/columns/hyperfrontend.json), by a change to
a constraint's hard form in [../model/constraints.md](../model/constraints.md), by a recut of
`family.document-embedding` in [../model/families.md](../model/families.md) 3.7, or by a
dossier revision. The counterfactual table in
[hyperfrontend-positioning.md](hyperfrontend-positioning.md) section 7 lists which cell
flips move which claim; the same flips move the rows here, and the ones that would close a
requirement or a blocker are `pos.counterfactual.unmodified-participant-posture`
(closes `floor.blocker.unmodifiable-participant`), `pos.counterfactual.composed-ssr-delivery`
(closes `floor.blocker.composed-ssr`), `pos.counterfactual.a11y-assessed` (resolves
`floor.change.a11y-continuity`), `pos.counterfactual.release-governance` (closes
`floor.change.release-governance`), and `pos.counterfactual.stable-line` plus
`pos.counterfactual.stewardship` (close `floor.change.stewardship` and
`floor.participant.tracks-a-pre-1.0-wire`).
