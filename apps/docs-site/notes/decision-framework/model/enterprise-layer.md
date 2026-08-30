# Enterprise Capability Layer

Status: REFINED v1 (2026-08-29, Phase 6 gate). Question wording authority moved to
questions.md section 6; the backchannel comparison is triangulated against matrix rows;
the competitor-equivalents and `commerce.*` placements are decided; the no-leakage guard
is verified against the derived family taxonomy. See the changelog in section 13.

Sources: transcript [7] (product background), transcript [9] (guidance addendum). Requirements:
REQ-ENT-01..11, REQ-AVAIL-01. Related artifacts: [taxonomy](taxonomy.md),
[topology model](topology.md) (owns the B2B/B2B2C topology, REQ-ORG-02),
[questions](questions.md) (section 6 formalizes the seeds below),
[constraints](constraints.md) (2.14 binds the operability constraints),
[schema proposal](schema-proposal.md) (will formalize edition/capability entities).

This document defines how commercial and operational capabilities (the planned
"HyperFrontend Enterprise", and every competitor's commercial tier) enter the decision
framework without contaminating the vendor-neutral architectural model.

---

## 1. The three-layer rule (REQ-ENT-01)

Three layers, never conflated:

| Layer id | Layer | Example content | Answers the question |
|---|---|---|---|
| `layer.strategy` | Architectural strategy (family) | isolated runtime composition, build-time module federation | "Which composition boundary fits our constraints?" |
| `layer.implementation` | Open-source / community implementation | HyperFrontend Community, single-spa, Module Federation runtime | "Which concrete technology realizes that strategy?" |
| `layer.operating-model` | Commercial / enterprise operating model | managed hosting, RBAC, registries, subscription management, support | "Who operates, governs, and pays for the platform around it?" |

Rules derived from this split:

- Capabilities in `layer.operating-model` never define, rename, or subdivide a family in
  the neutral taxonomy. HyperFrontend Community and a future HyperFrontend Enterprise share
  the same composition model; they differ in operational capability, which is a different
  axis entirely.
- The identical discipline applies to competitors: Module Federation does not become a
  different family because Zephyr or Nx Cloud sells tooling around it; Bit's cloud offering
  does not change what Bit's composition primitive is.
- A recommendation may legitimately be decided at layer 3 (two implementations tie
  architecturally; one has the governance capabilities the org requires), but elimination
  at layer 1 can never be reversed by layer-3 features (REQ-Q-02: an architecturally
  impossible option never wins on operational excellence).

## 2. Edition model and capability attachment (REQ-ENT-02)

Implementations may carry multiple editions. Conceptual shape (schema to be finalized in
[schema-proposal.md](schema-proposal.md)):

```jsonc
{
  "implementation": "hyperfrontend",
  "editions": [
    { "id": "hyperfrontend-community", "type": "community", "availability": "available" },
    { "id": "hyperfrontend-enterprise", "type": "commercial", "availability": "planned" }
  ]
}
```

Capability attachment levels:

| Attachment id | Attaches to | Example |
|---|---|---|
| `attach.family` | Architectural family | document-boundary isolation is a property of the family, inherited by every implementation of it |
| `attach.implementation` | Implementation (all editions) | contract handshake versioning in the wire protocol |
| `attach.edition` | One edition only | `governance.rbac` on `hyperfrontend-enterprise` (planned) |

Attachment rules:

- Attach every capability at the highest level at which it is genuinely universal, and no
  higher. Never mark "HyperFrontend" generally as having a capability that only an
  Enterprise edition would provide.
- Never downgrade a community edition's architectural fit for lacking managed services;
  absence of `layer.operating-model` capabilities is a statement about operational burden
  (the org builds or forgoes them), not about architectural suitability.
- Every edition-attached capability also carries an availability status per REQ-AVAIL-01
  (see the guard in section 11). For every planned HyperFrontend Enterprise capability
  named in this document the status is "planned", without exception.

## 3. Enterprise-operability question dimension (REQ-ENT-03, REQ-ENT-07)

A distinct question dimension: how much platform infrastructure the organization wants to
build and operate itself. These questions influence implementation and edition selection
only; they never eliminate or select an architectural family. ADOPTED at the Phase 6
gate: [questions.md](questions.md) section 6 formalizes every seed below verbatim as
`question.edition.operability.<seed-slug>` (the seed id minus its `operability.` /
`governance.` / `contract.` / `identity.` / `commerce.` prefix, e.g.
`question.edition.operability.rbac`,
`question.edition.operability.subscription-entitlement`), each binding
`constraint.operability.<seed-slug>` at `scope.edition`
([constraints.md](constraints.md) 2.14), with dual architect/circumstance phrasings per
REQ-AUD-01. The adopted wording pattern, worked for the `governance.rbac` seed:
Phrasing A: "Do you need organization-wide roles and permissions over the composition
platform (`governance.rbac`)?" Phrasing C: "Does someone in your company have to be able
to control who may publish, approve, or remove pieces, with those rules enforced by the
platform rather than by convention?" Every question in the block carries the firewall
statement ("this narrows how you would operate a choice, never which architecture
fits"); the b2b subset (`consumer-credentials`, `subscription-entitlement`) unlocks only
from `derive.b2b-chain` (constraints.md section 3); per-user/canary targeting joined the
block as `question.edition.targeting` (binding `constraint.per-user-targeting`). Matrix
grounding (REQ-Q-01): the atoms with dedicated matrix rows today are `hosting.operator`,
`hosting.control-plane`, `registry.deployable-feature`, `governance.rollback`,
`governance.usage-monitoring`, and `governance.rbac`, plus the edition rows
`unit.editions.commercial-tier` and `unit.editions.oss-self-sufficient`; the remaining
atoms are dossier-recorded, promotable to rows if an elimination ever needs them.

| Seed id | Question (seed wording) | Capability probed |
|---|---|---|
| `operability.self-host-vs-managed` | Do you want to operate the hosting infrastructure yourself, or consume it as a managed service? | `hosting.*` operator split |
| `operability.managed-feature-deployment` | Do you need managed deployment of independently owned features? | `hosting.applications`, `hosting.runtime-delivery` |
| `operability.private-registry` | Do you need a private registry for deployable frontend artifacts? | `registry.deployable-feature`, `hosting.distribution` |
| `governance.approval-workflow` | Do you need centralized approval before a feature can be consumed? | `governance.approval-workflow`, `governance.artifact-review` |
| `governance.rbac` | Do you need organization-wide roles and permissions over the platform? | `governance.rbac` |
| `governance.audit-log` | Do you need audit logs of platform actions? | `governance.audit-log` |
| `governance.environment-promotion` | Do you need controlled promotion between environments? | `governance.environment-promotion` |
| `governance.rollback` | Do you need one-click rollback to previous feature versions? | `governance.rollback` |
| `governance.usage-visibility` | Do you need usage visibility across consuming applications? | `governance.usage-monitoring` |
| `contract.compatibility-checking` | Do you need formal feature-contract compatibility checking? | `contract.compatibility-checking`, `governance.contract-validation` |
| `contract.central-resolution` | Do you need centralized contract-version resolution? | `contract.runtime-resolution` |
| `identity.enterprise-auth-integration` | Do you need enterprise authentication integration (SSO, IdP)? | `identity.*` (section 6) |
| `identity.consumer-credentials` | Do you need externally issued consumer credentials (API keys for your customers' consumers)? | `identity.consumer-credentials`, `identity.key-issuance` |
| `commerce.subscription-entitlement` | Do you need subscription or entitlement management for consumers of your features? | `commerce.entitlement`, `registry.marketplace` |
| `operability.managed-service-preference` | Would you rather buy these capabilities as a managed service than build them internally? | edition-type preference (community vs commercial) |

The governance capability atoms these probe are independent and atomic (REQ-ENT-07); no
composite `enterpriseReady: true` property may ever exist:

```text
governance.rbac
governance.audit-log
governance.approval-workflow
governance.environment-promotion
governance.artifact-review
governance.policy-enforcement
governance.usage-monitoring
governance.rollback
governance.contract-validation
```

Any of these may be satisfied by an edition capability, a third-party product, or in-house
build; the matrix records each independently with the usual Yes / No / Conditional /
Not applicable / Unknown values (REQ-MATRIX-02).

## 4. Managed hosting decomposition (REQ-ENT-04)

"Managed hosting" is never a single property. Seven atomic capabilities:

| Capability id | What it covers | Distinct because |
|---|---|---|
| `hosting.artifacts` | Storing and serving built feature artifacts (bundles, shells, packages) | An org can host artifacts on any static store while operating everything else itself |
| `hosting.applications` | Running the deployed applications and their feature shells | Live processes and origins, not files; different failure and cost model |
| `hosting.control-plane` | Metadata, configuration, version records, wiring | Can be vendor-managed even when all runtime traffic stays customer-side |
| `hosting.runtime-delivery` | Delivery path to the browser at runtime (CDN, edge, origin serving) | Latency, availability, and data-residency concerns independent of storage |
| `hosting.environment-promotion` | Moving versions through dev / staging / prod | Workflow capability layered on the stores; pairs with `governance.environment-promotion` |
| `hosting.distribution` | Private vs public distribution scope | Access boundary of the artifact store, not its existence |
| `hosting.operator` | Customer-managed vs vendor-managed infrastructure, per capability above | Each of the six preceding atoms can have a different operator |

A product claim of "managed hosting" is decomposed into positions on all seven before it
enters the matrix. The planned HyperFrontend Enterprise hosting of deployed applications
and feature shells (transcript [7]) covers, notionally, all seven with
`hosting.operator = vendor-managed`; availability status: planned.

## 5. Ephemeral mediated backchannel (REQ-ENT-05)

Concept id: `integration.ephemeral-mediated-backchannel`.

Definition: a server-mediated exchange primitive in which one feature publishes a payload
to a mediator and receives a short ticket reference; the counterpart feature redeems the
ticket by retrieval or subscription (WebSocket-style delivery); the payload expires after a
bounded TTL. Only the ticket transits the browser-side channel; the payload itself never
passes through host code, shared browser state, or the composition boundary.

Characteristics (each a checkable matrix attribute, not a bundle):

- temporary payload storage with bounded retention (TTL)
- ticket / reference identifiers as the only browser-visible token
- publish/retrieve semantics; optional subscription delivery
- no requirement to expose the payload through the host
- reduced browser-side coupling between features
- access control on redemption; encryption at rest and in transit
- auditability of publish and redeem events

This is a distinct integration primitive, not "messaging". It is client-initiated like
postMessage, mediated and access-controlled like a queue, and ephemeral like neither.

### Honest comparison (REQ-ENT-05)

| Mechanism | Mediator | Payload lives | Requires both parties live on the same page at the same time | Payload visible to co-resident scripts | Access control / audit | Backend required | What the backchannel adds or gives up vs it |
|---|---|---|---|---|---|---|---|
| `integration.ephemeral-mediated-backchannel` | Vendor/customer service | Server, TTL-bounded | No (within TTL; cross-page and cross-time) | No (ticket only) | Yes, both | Yes | Baseline for this comparison |
| postMessage | None (browser) | In transit only | Yes (both documents present) | Receivable by the target document's scripts; origin checks only | No | No | Adds confidentiality, audit, time-shift; gives up zero-latency, zero-infrastructure delivery |
| DOM events | None (browser) | In transit only | Yes, same document/realm | Yes, any listener | No | No | Adds cross-boundary reach and secrecy; gives up synchronous simplicity |
| Shared state (stores, globals) | None | Browser memory | Yes, shared realm | Yes, fully | No | No | Adds isolation compatibility (works across document boundaries); gives up free reads and reactivity |
| Direct APIs (function calls, shared runtime APIs) | None | Call stack | Yes, shared realm | Yes | No | No | Adds decoupling; gives up type-checked in-process ergonomics and speed |
| Client-side pub/sub (event bus) | In-page broker | Browser memory | Yes (broker's page) | Yes, any subscriber | Rarely | No | Adds server mediation, access control; gives up simplicity and offline operation |
| Message queues (SQS/Rabbit-class) | Durable broker | Server, durable | No | No | Yes | Yes | Backchannel is deliberately NOT durable: no replay, no DLQ, no guaranteed ordering; simpler and bounded instead |
| Server-mediated messaging (WebSocket relay, realtime channels) | Relay service | In transit (usually) | No, but both connected | No | Yes | Yes | Adds store-then-retrieve time-shifting and ticket semantics; overlaps most closely; distinction is TTL storage plus redemption model |
| BFF patterns | App backend | Server, app-defined | No | No | App-defined | Yes | Backchannel needs no per-feature backend development; gives up arbitrary server-side logic, aggregation, and durable persistence |

Triangulation (Phase 6 gate, REQ-MATRIX-05): the browser-side rows are now backed by
matrix evidence rather than guidance alone. `contracts.builtin-messaging` (an in-page
bus/pub-sub of the solution's own) is y for piral (officially-supported: shell event bus
plus shared-data APIs), luigi, entando, hyperfrontend, and the virtualized-rehosting
trio qiankun/micro-app-jd/wujie (framework-guarantee), conditional for
islands-architecture, podium, and server-side-fragment-composition;
`contracts.builtin-shared-state` is y for piral, luigi, qiankun, and micro-app-jd;
`contracts.frame-messaging` (a postMessage boundary) is y for hyperfrontend and luigi;
`performance.per-message-serialization-cost` prices the serialized channels
(hyperfrontend y; luigi conditional by mode). The "payload visible to co-resident
scripts" and "access control / audit" columns hold landscape-wide:
`security.channel-confidentiality` is No or Not-applicable for all 30 units except
hyperfrontend's conditional v2 PSK envelope, and no unit ships channel-level access
control or audit. The server-side rows (message queues, WebSocket relays, BFF patterns)
describe mechanism classes outside the 30-unit comparison set; those cells remain
definitionally derived (claim type: inference), which is exactly why the backchannel row
cites no unit cells.

### What it solves

- Feature-to-feature payload exchange across strong isolation boundaries without routing
  the payload through host code or a shared realm.
- Confidentiality against co-resident scripts: only a ticket exists in the browser, which
  matters exactly in the co-resident-adversary trust model.
- Time-shifted handover within the TTL: the counterpart need not be mounted, or even on
  the same page/session, when the payload is published.
- Payload sizes and shapes impractical to shuttle through postMessage serialization.
- Governed exchange: access control, encryption, and audit on data crossing team or
  organization boundaries (pairs with `governance.audit-log`).

### What it does not solve

- Not durable storage or a system of record: TTL expiry is the contract; anything needing
  replay, history, or guaranteed eventual processing belongs in queues or databases.
- Not low-latency UI coordination: every exchange is a network round trip; frame-rate or
  keystroke-rate synchronization stays on browser-side channels.
- Not availability-free: it introduces a backend dependency and a new failure mode into an
  otherwise client-complete composition; offline or degraded-network operation regresses.
- Not a contract system: parties still need an agreed payload schema and versioning
  (section 8); the mediator moves bytes, it does not reconcile meaning.
- Not an identity system: access control presupposes the identity layer (section 6).
- Not a replacement for the browser-side channel: the ticket itself still travels over
  postMessage or an equivalent, so a coordination channel remains required.

As a planned HyperFrontend Enterprise capability its availability status is planned
(`avail.announced-planned`; the hyperfrontend dossier and its
`unit.availability.planned-capability-claims`=y cell record exactly this). Whether any
other implementation or adjacent product offers an equivalent: RESOLVED at the Phase 6
gate, section 12 resolution 4: no unit in the comparison set ships one today.

## 6. Identity dimension (REQ-ENT-06)

Identity is its own dimension, decomposed; authentication (who is this) and authorization
(what may they do) are never conflated. One atom per concept:

Identity subjects and relationships:

```text
identity.host-authn            how the host authenticates its user
identity.participant-authn     whether a participant authenticates independently
identity.shared-identity       one identity spanning host and participants
identity.propagation           conveying an established identity across the boundary
identity.delegated-authz       host-granted, scoped authority exercised by a participant
identity.service-credentials   service-to-service (non-user) credentials
identity.consumer-credentials  externally issued credentials for downstream consumers
identity.tenant                which customer/tenant context applies
identity.user                  which human is acting
identity.feature               which feature (as a principal) is acting
```

Enterprise coordination needs (candidate platform responsibilities; for planned
HyperFrontend Enterprise, availability status planned):

```text
identity.bootstrap        establishing initial authentication at composition time
identity.token-exchange   swapping one credential for a scoped one
identity.scopes           authorization scope definition and enforcement
identity.tenant-context   propagating tenant context with requests
identity.rotation         secret and key rotation
identity.key-issuance     API-key issuance for consumers
identity.sessions         session lifetime and revocation handling
```

Rule: `identity.*-authn` atoms answer "who"; `identity.delegated-authz`,
`identity.scopes`, and `governance.rbac` answer "may"; a solution can be strong on one and
absent on the other, and the matrix must be able to say so.

## 7. Registry distinctions (REQ-ENT-08)

Three registry concepts that solve different problems; never one merged "registry"
attribute:

| Registry id | Unit published | Consumed by | Resolution time | Core concerns |
|---|---|---|---|---|
| `registry.code-package` | Source/library packages (npm-style) | Build tooling | Build time | Versioning, dependency graphs, immutability |
| `registry.deployable-feature` | Deployable runtime artifacts (features, shells) with metadata, compatibility info, version history | Host platforms at deploy/runtime | Deploy or runtime | Review, approval, install/use tracking, rollback, deprecation, compatibility |
| `registry.marketplace` | Commercial features as products | Purchasing customers and their consumers | Commercial + runtime | Discovery, entitlement, subscription, metering, billing |

The planned HyperFrontend Enterprise registry (transcript [7]: "Artifactory/npm-style"
with review, install, usage monitoring, rollback) is primarily `registry.deployable-feature`
with `registry.marketplace` responsibilities layered on for the consumer-subscription
model; both planned. An npm-compatible registry alone satisfies only
`registry.code-package`; the matrix must not credit it further.

## 8. Contract governance (REQ-ENT-09)

Contract handling is a first-class dimension with atomic capabilities:

```text
contract.definition               how a feature contract is expressed
contract.versioning               how contract versions are identified and evolved
contract.compatibility-checking   static/pre-deploy compatibility verification
contract.negotiation              parties agreeing on a mutually supported version
contract.runtime-resolution       selecting the operative contract version at runtime
contract.schema-validation        validating payloads against the contract
contract.deprecation              retiring contract versions with notice
contract.consumer-compatibility   which consumers a provider version supports
contract.provider-compatibility   which providers a consumer version supports
```

These atoms apply neutrally to every implementation (a handshake protocol, a TypeScript
interface convention, and a schema registry all take positions on them). A notional
HyperFrontend Enterprise "v3 enterprise security protocol" (transcript [7]) is an
edition capability, attached per section 2 with availability planned; it must never cause
a rewrite of the neutral contract dimension, exactly as any competitor's proprietary
contract tooling must not (REQ-ENT-01).

## 9. Admin-surface distinction (REQ-ENT-10)

Management capabilities are delivered through distinct surfaces; a product may offer any
subset:

| Surface id | Meaning | Who renders it | Who hosts it |
|---|---|---|---|
| `admin.managed-ui` | Vendor-operated dashboard | Vendor | Vendor |
| `admin.headless-api` | API only; no UI supplied | Customer builds UI (or none) | Vendor API, customer UI |
| `admin.embeddable-ui` | Vendor-built management feature embedded into the customer's own portal | Vendor-built, customer-embedded | Mixed |
| `admin.customer-owned-ui` | Customer's own UI over the headless API | Customer | Customer |

The planned HyperFrontend Enterprise embeddable management dashboard, itself delivered
through HyperFrontend composition into the customer's admin portal, is a dogfooding case:
record it in the product/positioning model
([hyperfrontend-positioning.md](../positioning/hyperfrontend-positioning.md)) with
availability planned, and keep it out of the neutral decision framework; "the vendor
dogfoods their own composition" is never a question dimension or a scoring input.

## 10. AI Dev Assist (REQ-ENT-11)

Concept id: `dx.ai-dev-assist`. AI/LLM-assisted development (integration guidance, adapter
and contract generation, migration assistance, debugging, compatibility analysis,
configuration generation, documentation lookup, decision-framework traversal) is a
cross-cutting developer-experience capability:

- It attaches at implementation or edition level like any other capability (for
  HyperFrontend it is planned to span Community and Enterprise; availability per edition,
  planned).
- It is never a primary architectural selection criterion; "has AI" eliminates nothing and
  must not appear in family selection, dominance analysis, or hard-constraint logic.
- Architecturally binding rule: any AI assistant consumes the same canonical decision
  framework and evidence model as the manual UI (REQ-LLM-01, REQ-DATA-01); it never gets a
  private methodology, so its presence changes delivery of recommendations, not their
  content.

## 11. Guard: no leakage into the neutral taxonomy (REQ-ENT-01, REQ-AVAIL-01)

Nothing in this document may leak into the neutral family taxonomy. The families in
[families.md](families.md) and the dimensions in [taxonomy.md](taxonomy.md) are defined
exclusively by composition boundary, integration phase, execution model, ownership,
coordination, and isolation characteristics; no `hosting.*`, `governance.*`,
`registry.*`, `commerce.*`, `admin.*`, or `dx.*` atom may name, split, or rank a family,
and no enterprise-operability answer may eliminate one. These atoms act only at
implementation/edition selection, after family selection has already happened on neutral
grounds; the same firewall applies verbatim to competitors' commercial tiers. Furthermore,
every HyperFrontend Enterprise capability referenced here (managed hosting atoms, the
ephemeral mediated backchannel, managed authentication, the governance atoms, the feature
registry and marketplace, the notional v3 protocol, consumer entitlement, the embeddable
admin surface, AI Dev Assist packaging) carries availability status "planned", never
"available"; the framework must never recommend a planned capability as though it exists,
and when a planned capability fits a need that another product satisfies today, both are
shown per REQ-AVAIL-02, with the competitor's availability stated plainly.

VERIFIED at the Phase 6 gate: [families.md](families.md) (DERIVED v1) contains no
operability-derived family and no occurrence of any `hosting.*`, `governance.*`,
`registry.*`, `commerce.*`, `admin.*`, or `dx.*` atom (checked 2026-08-29). The two
pressure cases resolved the right way: zephyr-cloud's commercial control plane was
dissolved (families.md FC-8 and 6.1) into `family.module-graph-federation` plus a
delivery-governance overlay whose vendor surface "selects implementations and editions,
never families", and the platform products map to neutral families with overlay notes
(entando into `family.custom-element-composition`, commercetools-frontend into
`family.package-composition`; families.md FC-7). The operability atoms surface
downstream exactly as designed: `scope.edition` constraints (constraints.md 2.14) and
the implementation-selection lens (taxonomy.md 4.3).

---

## 12. Phase-6 gate resolutions (formerly the open items)

1. **Seed-question wording: ADOPTED from questions.md section 6** (details in section 3).
   The seed ids here remain valid as aliases of `question.edition.operability.<seed-slug>`;
   wording authority is questions.md, whose block was re-derived against the matrix rows
   and passed the REQ-Q-05 anti-steering audit (B1 feature-tour risk defended by the
   firewall statement shown with every question).
2. **Backchannel comparison: TRIANGULATED.** Browser-side rows verified against
   `contracts.*`, `security.*`, and `performance.*` matrix rows (section 5 triangulation
   note); server-side rows describe out-of-set mechanism classes and stay definitionally
   derived, marked as inference.
3. **`commerce.*` placement: FOLDED into the registry/marketplace model (section 7); no
   separate section.** Evidence: the matrix carries no `commerce.*` row and no
   elimination has needed one; commercial-tier existence is the
   `unit.editions.commercial-tier` row; the only decision-relevant entry point is
   `question.edition.operability.subscription-entitlement` binding `commerce.entitlement`
   plus `registry.marketplace`, unlocked solely by `derive.b2b-chain` (constraints.md
   section 3). The atoms `commerce.entitlement`, `commerce.metering`, and
   `commerce.billing` remain named atoms attached to `registry.marketplace` concerns.
4. **Competitor backchannel equivalents: RESOLVED as none-in-set.** No unit in the
   30-column comparison set commercially offers an ephemeral mediated backchannel today
   (server-mediated, ticket-referenced, TTL-bounded feature-to-feature payload
   exchange). Per-unit findings, with claim types:
   - piral: in-page event bus and shared-data APIs (`contracts.builtin-messaging`=y,
     `contracts.builtin-shared-state`=y; officially-supported, dossier E1/E13);
     client-side only, no server mediation; `security.channel-confidentiality`=n
     (inference).
   - bit: cross-feature communication is ordinary in-process imports/function calls in a
     shared realm (`contracts.builtin-messaging`=n; inference from the composition
     model, dossier).
   - zephyr-cloud: delivery/ops layer; inter-MFE runtime communication is explicitly out
     of scope for the layer (dossier: NA; all communication cells na, inference).
   - commercetools-frontend: the closest shipping server-mediated exchange is its hosted
     extension runner, a vendor-operated BFF executing customer-written server code
     (framework-guarantee, dossier E1/E4); it is durable, app-defined, and
     per-customer-coded, so it lands on the BFF-pattern comparison row, not the
     backchannel row (`contracts.builtin-messaging`=n, inference).
   - luigi and entando ship in-page buses of the same class as piral
     (framework-guarantee); the virtualized-rehosting trio likewise (y cells, browser
     memory only).
   Generic realtime/queue services (the WebSocket-relay and SQS-class rows) exist only
   as build-it-yourself adjuncts outside the comparison set. The primitive is therefore
   unoccupied commercially within the landscape; HyperFrontend's version stays
   `avail.announced-planned`, satisfies no binding (REQ-AVAIL-01), and is always shown
   beside shipping alternatives (REQ-AVAIL-02).

## 13. Changelog (Phase 6 gate, 2026-08-29)

- Status raised PROVISIONAL v0 to REFINED v1.
- Section 3: wording authority moved to questions.md section 6 (adopted ids
  `question.edition.operability.<seed-slug>` plus `question.edition.targeting`);
  constraint bindings `constraint.operability.<seed-slug>` (constraints.md 2.14)
  recorded; the matrix-backed subset of atoms named. Seed ids unchanged, now aliases.
- Section 5: triangulation note added citing the `contracts.*`, `security.*`, and
  `performance.*` matrix rows behind the browser-side comparison cells; the closing
  "Unknown until researched" replaced by the section 12 competitor-equivalents
  resolution.
- Section 11: the no-leakage guard converted from a rule awaiting evidence into a
  verified statement against DERIVED v1 families.md (zephyr dissolution FC-8, platform
  overlays FC-7).
- Open items replaced by section 12 resolutions (wording adoption, triangulation,
  `commerce.*` fold, competitor equivalents). No ids changed or removed.
