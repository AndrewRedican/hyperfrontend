# The HyperFrontend Architectural Thesis (extracted for a neutral decision framework)

Research snapshot: August 2026. All claims cite repo files; ecosystem claims are dated.

Primary sources read in full:

- `apps/docs-site/content/articles/microfrontends-from-first-principles.md` (the canonical rationale; the features library's own ARCHITECTURE.md names it as such)
- `libs/features/ARCHITECTURE.md`
- `libs/features/README.md`
- `apps/docs-site/content/guides/compose-independent-features/guide.md`
- `apps/docs-site/content/guides/embed-a-shipped-feature/guide.md`
- `apps/docs-site/content/guides/detect-unresponsive-feature/guide.md`

The framework should treat these as one party's argued position, not settled fact. The article itself invites challenge and states its own disqualifying conditions, which makes it unusually usable for a neutral framework.

---

## 1. Underlying principles (extracted, not repeated)

These are the decision-relevant principles beneath the HyperFrontend position. Each is phrased so a neutral framework can test it against a team's situation, including deciding it does not apply.

### P1. Boundary size must match the independence required

An app boundary drawn around a visual seam is pure overhead; a component boundary forced to carry app-shaped independence recreates lockstep coupling. Design system < shared component < app-shaped boundary; pick the smallest boundary that preserves the independence you need. An "app" is anything that must be owned, shipped, and trusted on its own terms (ownership, release cycle, runtime assumptions, backend relationship, permissions, failure modes). (`microfrontends-from-first-principles.md`, "When the seam is app-shaped")

### P2. Composition approaches sort along two axes: when composition happens, and how much isolation survives it

Shared package, build-time integration, module federation, web components, and single-spa-style runtimes all compose into one document and one JavaScript realm; their separation depends on module scopes, conventions, tooling, review, and trust. The iframe alone occupies runtime composition + browser-enforced document isolation. This difference is in kind, not degree. (article, "The usual alternatives" and "What only the iframe gives you")

### P3. Enforced isolation vs promised isolation

In a shared realm, separation holds "until someone is in a hurry." A document boundary is enforced by the browser on every page load: the other team's global cannot become your bug, their CSS refactor cannot become your incident, their framework migration is not your migration. The article calls this "independence that survives contact." (article, "What only the iframe gives you")

### P4. Cohesion-first vs isolation-first is a bet about coordination cost

Uniformity is not a state you reach, it is a subscription you pay. Cohesion-first bets the subscription stays affordable (true for one team, one stack, one release train). The bet degrades as teams multiply: shared-dependency CVEs put every consumer under simultaneous upgrade pressure, framework majors arrive on the framework's timeline, shared package ownership bottlenecks. Isolation-first spends upfront (a protocol and tooling that are a product with an owner) and amortizes; coordination costs recur and grow with team count. Shape of spending, not existence, is the difference. (article, "The smallest shared contract")

### P5. Every integration approach is a contract, and every clause shrinks who can sign

Requiring the host's framework, compatible bundlers, shared dependency versions, or deploy coordination excludes hosts. Some hosts get no vote at all: low-code platforms, CMS pages, portal products, aged admin shells have no build step to join; their entire integration menu is a script tag or an iframe. A host you do not control is a host you cannot negotiate with; there, enforced isolation stops being a preference and becomes the only safe posture. The iframe's transport contract ("both sides run in a browser, both sides speak browser primitives") is claimed as the floor, and the floor is not zero: the embedded side must be an independently hosted, deployable web app with its own URL. (article, "The smallest shared contract")

### P6. The iframe's honest ledger: two genuine omissions, the rest out of jurisdiction

Charge the primitive for content-driven sizing and an application-level readiness/failure signal. Product cohesion, shared state, auth topology, theming, routing agreements, telemetry are agreements between two applications; no tag can sign a contract on your behalf. The remaining integration gaps (readiness, failure, resize, navigation, completion, dirty state, errors) are the actual size of the problem any runtime-isolated design must solve. (article, "The complaint list" and "Collecting the complaints")

### P7. Meaning lives in a written, versioned, schema-enforced contract, not in a channel

postMessage is a pipe, not a product contract. Silent drift (a renamed message type) produces no error, only deafness. Therefore: record every message's name, direction, payload shape; version the contract; bake the version into the artifact each side bundles; check compatibility during the opening exchange so incompatible pairs fail explicitly at first contact instead of going quietly deaf weeks later. Schemas are enforced on send (fail in your room, your stack trace) and on receive (reject at the border). (article, "The contract" and "Contract versioning")

### P8. One contract artifact, two perspectives, is a trade, not a law

The host inverts the feature's contract (emits ↔ accepts) rather than hand-maintaining a mirror. The article explicitly notes two separately owned contracts with a compatibility check work fine where every participant has CI and a central platform team; the single artifact reduces the agreement required from hosts with no build. (article, "The contract")

### P9. Control traffic rides the product channel under the product rules

Lifecycle, sizing, health, and teardown messages use the same contract, schemas, and transport as product messages ("No privileged side channel. If the contract cannot express its own control protocol, it is probably incomplete."). In the implementation this is the reserved `__hf:` prefix, filtered before consumer handlers run. (article, "Requests and responses"; `libs/features/ARCHITECTURE.md`, "The Control Plane")

### P10. Lifecycle over a memoryless channel requires a handshake, buffering, deadlines, and instance identity

`load` answers a browser question, not an application question; messages sent before a listener attaches are gone. Hence: buffer outbound until proven counterpart, a symmetric idempotent three-message handshake (request → accept → open, either side may start, simultaneous starts collapse into one session), fresh instance IDs per boot so a reloaded frame's stale messages self-identify, and every wait has a deadline (a handshake without a deadline is a hang with good intentions). (article, "The session lifecycle" and "Deadlines")

### P11. Liveness is a judgement with more than two values

Browsers throttle and freeze hidden pages, so silence is sometimes weak evidence. Four states: healthy, unobservable, suspect, gone. Only suspect invites recovery, and proportionately (degrade, offer reload, force only when justified); a watchdog that reloads healthy apps is causing the outage it exists to detect. Teardown plans for both the polite form (propose, flush unsaved work, confirm) and the impolite one (tab close, crash, power loss); only one asks permission. (article, "The heartbeat and its four states"; `libs/features/ARCHITECTURE.md` Data Flow)

### P12. Capability flows from the host; price in the misbehaviour of trusted code

Same-origin policy governs cross-realm access, not what the embedded page may do to the browser around it (popups, top navigation, camera, downloads). `sandbox` and `allow` are written by the host; the hostee cannot grant itself capability. The question is not only "do I trust this team" but "whose misbehaviour am I pricing in": a trusted feature can still ship a compromised transitive dependency. Different threat models (installed dependency vs marketplace plugin) justify different default postures over the same tag. (article, "What may the box do?")

### P13. Trust model precision: origins authenticate rooms, not speakers

Origin + source pinning binds a conversation to a specific window at a specific origin. It does not authorize embedding (that is `frame-ancestors` plus server-side auth) and cannot distinguish the application from any other script running in the same page (analytics, tag managers, compromised deps share the window). HyperFrontend's stated threat model trusts scripts already running in both pages; in-page adversaries need CSP, Trusted Types, SRI, or authority isolated in a separate origin, offered as documented defence-in-depth, not a cure. (article, "Trust" and "Further security considerations")

### P14. Geometry authority stays with the page owner

The common hand-rolled pattern (child announces its height, host applies it) quietly moves geometry authority across the wall, unbounded. HyperFrontend inverts it: the host measures its own container and reports exact pixels; the hostee sizes its document to match and never announces geometry. Content-driven growth is still expressible, as ordinary product data the host may act on. Which presentations a feature supports is contract-declared; which one it gets is the host's call. (article, "Content-driven sizing"; `libs/features/ARCHITECTURE.md` principle 7)

### P15. If a host cannot write the glue, the glue must arrive already written (Conway's Law applied)

The full wrapper (contract, schemas, pinning, queues, handshake, instance IDs, health, teardown, sizing, display modes, error surface) is glue somebody writes per feature per host. Where a central platform team has authority over all hosts, a host-side SDK works. Where no such authority exists (external hosts, buildless hosts, acquired stacks, one-maintainer legacy shells), the feature team ships the integration: one dependency-bundled package, consumable as an npm import or a script tag, that collapses the host's job from implementing the boundary to declaring where the feature belongs. That package is the "shell". (article, "The shell")

### P16. Migration, acquisition, and vendor integration want a contract that does not require synchronized technical choices

The boundary doubles as a migration boundary: legacy keeps running while its replacement grows beside it; acquisitions arrive with foreign stacks; nobody schedules the big-bang rewrite that already slipped once. (article, "The smallest shared contract")

### P17. Failure containment is structural, not aspirational

Independent sessions share no bundle, no state, no channel; one feature's failure domain is one layer of the page. The composing guide's acceptance test is literally "kill one feature at the network level, page keeps working." Observability cost is the honest flip side: stack traces do not cross; what crosses are relationship failures (timeouts, rejected messages, incompatible contracts, liveness suspicion); cross-app debugging needs correlation IDs and a responsive team on the other side. (guides/compose-independent-features/guide.md §8; article, "Observability")

---

## 2. Why HyperFrontend chooses iframe/document isolation with an orchestration contract on top (neutral statement)

The design starts from the observation that among mainstream browser composition options, only the document boundary gives isolation that is enforced by the browser rather than promised by participants (P2, P3), and that this boundary carries the smallest viable integration contract, so it remains signable by hosts that cannot join a build, share dependencies, or attend a coordination meeting (P5). It accepts the iframe's known costs as either (a) two real omissions in the primitive that a protocol can supply (readiness/failure, sizing), or (b) integration agreements no primitive could have shipped anyway (P6). The remaining work, turning containment into cooperation, is then done once, deliberately, as a versioned contract + handshake + lifecycle + capability protocol (P7-P14), and packaged so the feature team pays for it rather than every host (P15). The bet is economic: isolation-first spending is upfront and amortized; cohesion-first spending is a recurring coordination subscription that grows with team count and stack variance (P4). The article presents this as one defensible design among several, explicitly flags the forks where other systems may reasonably choose differently, and lists its load-bearing claims as challengeable (article, "One design among several" and "The bill, and who paid it").

---

## 3. When strong isolation is genuinely useful, and when it is unnecessary overhead

The source material states both sides itself; the framework can quote it against HyperFrontend where warranted.

**Genuinely useful (per the article's own criteria):**

- Many teams with drifting stacks, uncorrelated dependency lifecycles, uneven modernization (article, "The bill, and who paid it")
- Hosts you cannot negotiate with: external customers' sites, low-code/CMS/portal hosts with no build step, aged admin shells (article, "The smallest shared contract")
- Legacy migration where old and new must run side by side without a synchronized rewrite (P16)
- Acquisitions importing whole foreign frontend estates (P16)
- Plugin/marketplace surfaces and embeddable widgets, where the embedded party is semi-trusted or untrusted and capability containment matters (article, "When embedding makes sense"; P12)
- Separate ownership with genuinely independent release cadence, backend relationships, permissions, and failure modes (P1's "app-shaped" test)
- Failure containment as a product requirement: one dead feature must cost one region of the page (P17)

**Unnecessary overhead (the article and README concede these explicitly):**

- One team, one stack, one release train, on a host you fully control: "you probably do not need it... Shared dependencies are leverage in that world. Module federation and related approaches are good at what they are built to do." (article, "The bill, and who paid it"; also "take the cohesion road with this article's blessing")
- Visual or behavioural seams: a design system or shared component ages better than an app boundary (P1)
- Same-origin embedding with rich integration needs: "importing the code may be the better answer anyway" (article, "Origins")
- Internal single-known-host features do not even need the dynamic host discovery machinery; hardcoding the host origin is called "the simplest correct choice" (article, "Trust")
- Costs that never go away even when the pattern fits: a second full document's memory and startup per feature; an independently hosted URL to build, serve, and keep alive; observability split across team boundaries; auth topology made explicit; routing/history and cross-boundary a11y still need design (article, "Collecting the complaints"); per-message crypto (v1) collapses under many concurrent chatty channels (guides/compose-independent-features/guide.md §6); same-origin features share the host's thread so the watchdog cannot even run (guides/detect-unresponsive-feature/guide.md, Limits)

A neutral framework can therefore recommend against HyperFrontend, on HyperFrontend's own published criteria, whenever the coordination subscription is affordable (small org, one stack, controlled host) or the seam is not app-shaped.

---

## 4. What HyperFrontend actually is, mechanically (~15 factual bullets, each markable Yes/No/Conditional later)

Snapshot: August 2026, features package line 0.8.x per repo memory; all statements from `libs/features/ARCHITECTURE.md` and `libs/features/README.md` unless noted.

1. **Layering:** `@hyperfrontend/features` is the batteries-included layer over `@hyperfrontend/nexus` (cross-window messaging protocol: origin filtering, security policy, contract validation, transport), which sits over `@hyperfrontend/network-protocol` (envelope) and `@hyperfrontend/cryptography` (primitives). (ARCHITECTURE.md header; article, "Further security considerations")
2. **Two SDK surfaces:** hosts call `createShell()` (`/host` subpath), feature apps call `createFeature()` (`/hostee` subpath); independent subpath entry points so consumers pull only what they use. (ARCHITECTURE.md, System Overview and principle 2)
3. **Contract as sole coupling:** a `FeatureContract` of `emitted`/`accepted` action descriptions; unknown inbound types dropped and logged; only `accepted` entries flagged `required: true` gate the connection, so adding actions is backward compatible. (ARCHITECTURE.md principle 3; README.md)
4. **Contract versioning:** optional semver `version`; each side presents its version in the handshake; different major (or different minor below 1.0.0) is denied before the channel opens; unversioned peers always pass. (README.md)
5. **Schema validation both ways:** `send` validates against the sender's own `emitted` schema and throws before the wire; inbound validates against the receiver's `accepted` schema; invalid payloads dropped and surfaced as `error {reason: 'invalid-payload'}`; schema-less actions pass through (validation is per-message cost, so hot paths may skip schemas). (README.md; guides/compose-independent-features/guide.md §2)
6. **Handshake:** symmetric three-frame REQUEST → ACCEPT → OPEN; either side may initiate; simultaneous attempts tie-break by broker id; frames replay idempotently on a retry cadence; all gates (contract validity, required actions, security policy, version compatibility) run inside it; refusal emits a local machine-readable `error` and a DENY/CANCEL; security-policy refusals deliberately do not name the gate to the refused party. (ARCHITECTURE.md, "The opening handshake")
7. **Queuing and deadlines:** sends before open queue and flush on open (leaving encrypted if a security transport attached); `openTimeoutMs`/`readyTimeoutMs` default 10 s; timeout tears the mount down and emits `error {reason: 'open-timeout'}` / rejects `ready()`. (ARCHITECTURE.md, Data Flow)
8. **Heartbeat/watchdog:** hostee pulses `__hf:beat` at 1/s plus `__hf:visibility` reports; host counts misses (budget 3) only while both pages are visible; four states healthy/unobservable/suspect/gone surfaced as `status` events; `UnresponsivePolicy` runs once per suspect episode; a recovering beat re-arms. Cadence and budget are fixed, not configurable. (ARCHITECTURE.md; guides/detect-unresponsive-feature/guide.md, Limits)
9. **Presentation model:** feature declares supported display modes (embedded, dialog, popup, standalone) and per-mode defaults in `feature.config.*`; shell is built from exactly the declared mounts (undeclared mode = compile error, runtime throw, absent from bundle); host picks the mode per open and is sole geometry authority (`__hf:present` with initial px, `__hf:viewport` for changes); dialog mode = transparent full-viewport pane, feature draws box + backdrop, `__hf:dismiss` crosses as a signal for host policy; frames stay hidden until the session opens. (ARCHITECTURE.md principle 7 and Display Modes)
10. **Control plane:** all SDK traffic rides the one channel under a reserved `__hf:` prefix, validated by the same contract machinery, filtered before consumer handlers; correlated request/response envelopes with 30 s default deadlines; pending requests reject when the session ends, including across peer reload. (ARCHITECTURE.md, The Control Plane)
11. **Peer reload survival:** a self-reloading feature ends its session; the mount survives (frame, observers, subscriptions kept), `__hf:present` is re-announced to the new document, which handshakes on the same channel; consumer sees `close {reason: 'peer-reload'}` then a fresh `open`. (ARCHITECTURE.md, Data Flow)
12. **Teardown:** polite `close()` proposes, counterpart gets a `closing` flush window (with `setDirty`/`isDirty` unsaved-work signalling), acknowledges, single `close` fires each side, deadline-bounded; `destroy()` is immediate. (ARCHITECTURE.md)
13. **Generated shells:** `hf build` emits a self-contained shell package (contract inlined, direct deps bundled, zero declared runtime dependencies, ESM + CJS, npm-packed tarball) exporting `createFeatureShell`; hosts install one package and never need `@hyperfrontend/features` directly; consumable via npm or script tag; `metadata.json` (FeatureDescriptor) restates identity, version, URL, contract, modes, protocol, permissions for review without unpacking. Baked values (URL, default mode, dimensions, permissions, protocol) are host-overridable defaults; contract and mode set are not. (ARCHITECTURE.md, Shell Generation; article, "The shell")
14. **Security envelope:** `protocol: 'none'` (local default) | `'v1'` | `'v2' + sharedKey`; negotiated during the handshake; handshake frames stay plaintext, product messages travel encrypted; a counterpart that omits the protocol downgrades to plaintext with no runtime signal (compare pins at build time); production builds opt in explicitly (`hf build --ci --allow-open` makes an open channel an acknowledged decision). v1 pays per-message key derivation and can silently drop under many concurrent chatty channels. (ARCHITECTURE.md principle 5; README.md; guides/compose-independent-features/guide.md §6)
15. **Capability model:** feature declares needed Permissions-Policy features (baked into the shell, disclosed in metadata); host applies/replaces them as the frame's `allow`; `sandbox` is host-decreed and never baked; the SDK manages the hazardous tokens (always `allow-scripts`, `allow-same-origin` only for cross-origin URLs), so a sandbox-shedding same-origin frame cannot be expressed; no raw token strings. (ARCHITECTURE.md principle 6)
16. **Tooling/serve story:** `hf` CLI (`init` scaffolds hostee glue, `build`, `dev` with an in-browser debug UI showing display-mode/resize/message-log/security, `serve` production static server with compression, conditional requests, header rules); optional Nx adapter (`/nx/*`) with zero `@nx/devkit` dependency; pure generators over a VFS, I/O only in the CLI. (ARCHITECTURE.md, Module Composition and principle 1, 8)
17. **License/dependency posture:** MIT, described as dependency-free; framework-agnostic (any framework, any build tool); Node >= 18; proven by the koi pond demo compositing eight framework apps (React, Vue, Svelte, Solid, Preact, Lit, Angular, vanilla TS) into one scene. (article, "The bill, and who paid it"; README.md)

---

## 5. Claims needing evidence labels for the comparison matrix

Each is asserted in the sources but should carry an evidence label (measured / demonstrated / argued / vendor-claim) rather than pass as fact:

1. **"23.6% of 6,028 respondents used microfrontends" (State of Frontend, 3rd ed., 2024).** Third-party survey, self-selected respondents; the article cites it accurately but adoption numbers of this kind need a survey-methodology caveat. (article intro; snapshot August 2026: no newer edition cited in repo)
2. **"Coordination costs recur and grow with team count; isolation platform cost amortizes."** The core economic bet. Argued from mechanism (CVE fan-out, framework major cadence, ownership bottlenecks), not measured in the repo. Label: argued. (article, "The smallest shared contract")
3. **"The iframe's contract is the floor" (smallest contract that still buys enforced isolation).** Reasoned claim; competing floors exist (script-tag embeds without isolation, web components for buildless hosts that accept a shared realm). Label: argued. (article)
4. **"The handshake establishes enough shared state to release queued messages" and "origin + window pinning suffice under the stated trust model."** Explicitly listed by the article itself as load-bearing, challengeable claims. No formal verification cited. Label: argued, self-flagged. (article, "The bill, and who paid it")
5. **"The four-state health model distinguishes silence from failure well enough to guide recovery."** Self-flagged load-bearing claim; the detect-unresponsive guide documents real gaps (fixed 1s/3-miss cadence, up-to-3s blind window after tab return, same-origin features freeze the watchdog entirely). Label: demonstrated with documented limits. (guides/detect-unresponsive-feature/guide.md)
6. **"Shipping glue with the feature beats a central host SDK where no platform authority exists."** Organizational claim, context-dependent by the article's own admission. Label: argued/conditional. (article, "The shell")
7. **"Zero runtime dependencies / no transitive install burden" for generated shells.** Verifiable mechanically per shell; true by construction per ARCHITECTURE.md principle 4, but a matrix should label it vendor-claim-verifiable rather than assumed.
8. **"Works with any framework and build tool."** Demonstrated for 8 frameworks by the koi pond demo (README.md); "any" is extrapolation. Label: demonstrated-for-8, claimed-for-all.
9. **Per-feature memory/startup cost of a full document.** Acknowledged but never quantified anywhere in the sources; the matrix needs numbers (heap per frame, boot time) from measurement, not the article. Label: acknowledged, unquantified.
10. **v1 envelope collapse under concurrent chatty channels ("dropping messages silently instead of erroring").** Stated from koi-pond experience; a real measured failure mode but with no published thresholds. Label: observed, unquantified. (guides/compose-independent-features/guide.md §6)
11. **Silent plaintext downgrade when one side omits the protocol.** Documented honestly, but it is a security-relevant sharp edge the matrix must not soften: "no runtime signal reports it." Label: documented limitation. (guides/embed-a-shipped-feature/guide.md §8)
12. **In-page script adversaries are outside the core trust model; crypto layers are defence-in-depth ("v2 real / v1 deterrence").** The article and security docs state this; a matrix comparing "security" across approaches must scope what is and is not defended. Label: scoped claim. (article, "Further security considerations"; docs-site `/docs/core-concepts/security`, source at `apps/docs-site/src/app/docs/core-concepts/security/`)
13. **"Independence that survives contact" / enforced vs promised isolation.** True for realm/DOM/CSS isolation; the framework should note what the document boundary does not isolate (shared browser process budgets, network, cookies/storage policy interplay, top-level navigation absent sandboxing) so the guarantee is not overstated. Label: true-with-scope. (article)

---

## Pointers for the rest of the framework

- Positioning vs module federation: the article's sibling piece is referenced as `related: hyperfrontend-vs-module-federation` in the article frontmatter (`apps/docs-site/content/articles/microfrontends-from-first-principles.md`, line 11); worth mining for the head-to-head matrix row.
- The five boundaries (origin, trust, contract, lifecycle, capability) are HyperFrontend's decomposition of the problem and, with attribution, make a serviceable neutral checklist: any microfrontend approach can be scored on how each boundary is handled (browser-enforced / convention / unaddressed). The article itself says five "is not a law of nature," only where pressing stopped producing new cracks.
- Decision heuristic already latent in the sources: (1) Is the seam app-shaped? If no, stop (design system / shared component). (2) Can you negotiate with every host? If yes and one stack/one release train, cohesion-first tools win. (3) If no (buildless hosts, external hosts, acquisitions, migrations), enforced isolation plus a shipped-glue shell is the HyperFrontend position; price in the second-document cost, the observability split, and the serve-your-own-URL obligation.
