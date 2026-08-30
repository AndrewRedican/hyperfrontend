# HyperFrontend Positioning (emergent)

Status: DERIVED v1 (2026-08-29). Deliverable 12 (MASTER.md section 16), Phase 9.
Requirements served: REQ-MISSION-01 (never a funnel), REQ-ORCH-07 (the landscape is never
defined relative to this unit), REQ-ENT-01/02 (three layers, editions explicit),
REQ-AVAIL-01/02/03 (availability honesty and the pair-with-today duty), REQ-TRUST-01
(all seven outcomes must remain expressible), REQ-Q-07 (counterfactuals).

Research snapshot: August 2026. Every unit claim below resolves to a matrix row in
[../matrix/matrix-compact.tsv](../matrix/matrix-compact.tsv) (220 attributes x 30 units),
a per-cell condition in `../matrix/columns/<unit>.json`, or a dossier section.

Inputs, linked and not restated (REQ-OPS-03): family definitions and the deletable
implementation lists in [../model/families.md](../model/families.md); dimension poles in
[../model/taxonomy.md](../model/taxonomy.md); constraint ids, hard forms, and elimination
verification in [../model/constraints.md](../model/constraints.md); edition and
availability records in [../model/implementations.md](../model/implementations.md) 2.7;
the operating-model firewall in [../model/enterprise-layer.md](../model/enterprise-layer.md);
the project's own argued position and its concessions in
[../research/hyperfrontend-thesis.md](../research/hyperfrontend-thesis.md); gap records and
relaxation offers in [market-gaps.md](market-gaps.md); how any of this reaches a reader in
[../ux/report-design.md](../ux/report-design.md).

Scope note: "hyperfrontend" here is the matrix unit, which is one member of
`family.document-embedding` beside `iframe-composition` (the vendor-neutral practice) and
`luigi` in its iframe mode (families.md 3.7). Delete this file and the landscape model is
unchanged; that is the REQ-KEYTEST-01 property this document must not break.

---

## 1. Method note (`pos.method.*`)

### 1.1 How every claim below was produced (`pos.method.derivation`)

Four mechanical steps, reproducible against the TSV by anyone who disagrees with the
conclusions:

1. **Family membership first.** The unit's family is fixed in families.md 3.7 by
   composition boundary, not by capability count. Everything the family gives, it gives to
   `iframe-composition` and `luigi` too; nothing in this file may claim a family-level
   property as a product differentiator.
2. **Constraint bindings second.** Each region below starts from a *combination of hard
   constraints* (constraints.md section 2 ids), never from a feature. The hard form of each
   constraint already names what it retains and eliminates, with the deciding attribute ids.
3. **Cell-level intersection third.** The surviving unit set is computed from the matrix
   rows those constraints bind. The result is a set, not a winner: co-survivors are listed
   in every region, including the regions where the co-survivor is the browser primitive
   that needs no product at all.
4. **Lens facts last and separately.** Maturity, stewardship, adoption, and licence
   (taxonomy.md 4.3, constraints.md 2.13) are reported beside architectural fit and never
   folded into it (REQ-AVAIL-03). They break ties; they never create or reverse one.

### 1.2 What this document is not allowed to do (`pos.method.guards`)

- `pos.method.guard.no-reversal`: positioning may not readmit a unit that a hard constraint
  eliminated. An architecturally impossible option never wins on operational or editorial
  merit (REQ-Q-02, enterprise-layer.md section 1).
- `pos.method.guard.no-planned-credit`: no HyperFrontend Enterprise capability may be
  scored, recommended, or implied as existing (REQ-AVAIL-01). Section 6 is the only place
  Enterprise appears, and every entry there carries `avail.announced-planned`.
- `pos.method.guard.honest-ties`: where a competing unit survives the same constraints, it
  is named in the same sentence. A region with exactly one survivor is stated as such only
  when the matrix says so.
- `pos.method.guard.own-column`: the weaknesses ledger (section 5) is built from the unit's
  own column, including `?` cells, and may not be softened by prose (REQ-MATRIX-05).

### 1.3 The revision rule (`pos.method.revisable`)

This positioning is an output of the dataset, never an input to it. It is falsified by:
a cell edit in `../matrix/columns/hyperfrontend.json` or in any co-survivor's column; a new
unit entering the inventory; a family recut in families.md; or a constraint whose hard form
changes in constraints.md. When any of those happen, the affected `pos.*` id is rewritten
or deleted, and the change is dated under the refresh cadence in
[../maintenance/versioning-strategy.md](../maintenance/versioning-strategy.md). Section 7
lists the specific cells whose flip would move each claim, so the revision is mechanical
rather than editorial.

---

## 2. Where HyperFrontend Community is unusually well suited (`pos.fit.*`)

Five constraint combinations. Each names its bindings, the matrix rows that decide them,
the family section that states the same thing at family level, and every co-surviving unit.

### 2.1 `pos.fit.hostile-co-display` : untrusted or semi-trusted code on a shared screen

- **Constraint combination**: `constraint.distinct-principal` (hard) plus
  `constraint.single-screen-mixing` (hard) plus `constraint.fault-containment` (hard).
- **Matrix rows**: `security.untrusted-third-party-viable` is No for 27 of 30 units and
  reaches Conditional only for hyperfrontend and iframe-composition (taxonomy.md 2.2, the
  landscape's sharpest eliminator); `isolation.security.malicious-participant` c for the
  same two plus reverse-proxy-route-composition (page granularity only, which
  `runtime.concurrent-participants`=n then removes); the fault triple
  (`isolation.failure.post-mount-exception`, `isolation.lifecycle.reclaim`,
  `isolation.recovery.in-page`) is y/y/y for hyperfrontend, iframe-composition,
  web-fragments, and wujie; the posture atoms `security.sandbox-attribute-applicable`,
  `security.per-participant-csp`, `security.capability-narrowing` are y for hyperfrontend
  and iframe-composition only.
- **Family evidence**: families.md 3.7 isolation and major-advantages fields ("the only
  family where genuinely external or distrusted participants are viable").
- **Co-survivors, honestly**: `iframe-composition`. The intersection is exactly two units,
  and one of them is the browser primitive, so this region is a family win before it is a
  product win. Within it the honest split is orchestration thickness
  (`dimension.orchestration-thickness`): both units score `contracts.frame-messaging`=y,
  since the postMessage boundary is the family's, but hyperfrontend adds
  `contracts.builtin-messaging`=y, `isolation.failure.load-fallback`=y with
  `isolation.failure.lifecycle-quarantine`=y (a pairing only hyperfrontend,
  islands-architecture, and opencomponents hold), `security.channel-origin-pinning`=y (the
  only y in the matrix), `ux.host-overlay-protocol`=y, and
  `operations.first-party-debug-tooling`=y. The practice unit scores n on every one of
  those additions and prices them as adopter-built work.
- **Condition attached, never dropped**: the trust claims are Conditional, not Yes. Their
  condition is "cross-origin embedding with sandbox; in-page co-resident scripts are
  explicitly outside the trust model; Spectre-class needs cross-site"
  (`columns/hyperfrontend.json`). A same-origin deployment holds host-origin authority and
  is containment against accidents only (taxonomy.md 3.1). The posture decides the claim,
  not the product (families.md 6.3).
- **Boundary of the region**: this is *authored-for-your-SDK* untrusted code, not arbitrary
  vendor pages. See `pos.misfit.unmodifiable-participant`, which is the same trust story
  with the opposite outcome.

### 2.2 `pos.fit.gated-contract-under-drift` : many independently deploying parties who must be told when they diverge

- **Constraint combination**: `constraint.independent-deploy` (hard) plus
  `constraint.no-version-governance` (hard) plus `constraint.explicit-drift-surfacing`
  (hard on all four atoms), the last auto-escalated by `derive.many-party-drift` when three
  or more parties deploy independently.
- **Matrix rows**: the four gate atoms `contracts.formal-descriptor`,
  `contracts.contract-versioned`, `contracts.connect-compat-gate`,
  `contracts.drift-explicit` are jointly y for hyperfrontend and for no other unit. Partial
  holders are numerous and must never be read as satisfied (REQ-MATRIX-05):
  module-federation, opencomponents, podium, server-side-fragment-composition,
  commercetools-frontend, entando, piral, and zephyr-cloud each hold some subset; luigi
  holds `connect-compat-gate` with `contract-versioned`=?. Governance freedom is separately
  evidenced by `coordination.shared-dependency-governance`=n and
  `performance.shared-dependency-dedup`=n (the same cell that prices this region, see
  `pos.misfit.payload-budget`).
- **Family evidence**: families.md 3.7 coordination-assumptions field, which places
  hyperfrontend at `contract.gated` while the rest of the family spans
  `contract.implicit` to configured; taxonomy.md 2.10 and 3.3 (the drift hinge).
- **Co-survivors, honestly**: none on the hard four-atom form; this is the one region where
  the matrix leaves a single occupant. That is a narrow finding about four attributes, not
  a general superiority claim, and it survives only while the four cells hold.
- **Conditions attached**: the gate runs at the runtime handshake, not at deploy
  (`operations.deploy-time-contract-verification`=c: "build/deploy-time security-protocol
  pin comparison only"), and payload validation covers only actions that declare a schema
  (`contracts.schema-validated-payloads`=c). A user asking for build-time contract
  verification is asking for `constraint.atomic-release`, which eliminates every
  microfrontend family (constraints.md section 4 `rel.excludes`).

### 2.3 `pos.fit.unnegotiable-host` : the host cannot be asked to build, adopt, or coordinate anything

- **Constraint combination**: `constraint.host-modification-ceiling` (maxLevel 1) plus
  `constraint.participant-self-containment` (hard) plus `constraint.independent-deploy`,
  the `topology.white-label` and `topology.b2b-distribution` prior set
  (constraints.md 2.15, `derive.white-label-fit`).
- **Matrix rows**: `ownership.participant-unmodifiable-host`=y for eleven units;
  intersecting `buildtime.host-integrates-buildless`=y leaves hyperfrontend,
  iframe-composition, opencomponents, picard-js, and web-components-composition. Adding
  `constraint.css-containment` at the enforced-both-directions form narrows that set to
  hyperfrontend and iframe-composition: opencomponents scores n on both css atoms,
  picard-js is Unknown on both, and web-components-composition scores
  `isolation.css.inbound`=c (style scoping only). The only other unit in the landscape
  holding both css atoms is reverse-proxy-route-composition, which never enters this set
  and fails `runtime.concurrent-participants` besides. Host floor is `migration.host.min-level` condition
  `migration.trivial-adaptation` for hyperfrontend, with
  `migration.host.new-infra-tier-required`=n and `migration.host.shell-takeover-required`=n.
- **Family evidence**: families.md 3.7 ownership field ("the only family whose ownership
  model extends to other organizations"); thesis P5 and P15 argue the same economics from
  the vendor's side.
- **Co-survivors, honestly**: `iframe-composition` again, plus
  `web-components-composition` and `opencomponents` if the CSS requirement is style-level
  only rather than realm-level. The differentiator here is not isolation but packaging: the
  generated shell is a single installable artifact with zero declared runtime dependencies
  and a `metadata.json` descriptor (implementations.md 2.7 `attach.implementation`), which
  is what collapses the host's job to declaring placement. That is an implementation fact
  inside a family both other units also occupy.
- **Cost that belongs in this region**: `deployment.new-participant-host-change`=y. The host
  installs something per feature. Ownerless onboarding is a different region and
  hyperfrontend does not hold it (`pos.misfit.ownerless-onboarding`).

### 2.4 `pos.fit.contained-modernization` : incompatible framework majors that must coexist without an upgrade train

- **Constraint combination**: `constraint.framework-major-coexistence` (hard) plus
  `constraint.no-version-governance` (hard) plus `constraint.fault-containment` (hard);
  the `topology.legacy-modernization` and `topology.acquisition` priors.
- **Matrix rows**: `framework.same-framework-major-coexistence` with
  `runtime.side-by-side-versions` both y for hyperfrontend, iframe-composition, qiankun,
  web-fragments, wujie; intersecting the fault triple leaves hyperfrontend,
  iframe-composition, web-fragments, wujie. `coordination.shared-dependency-governance`=n
  and `deps.duplicated` hold for all four. `migration.strangler.incremental`=y and
  `migration.exit.participants-standalone`=y for hyperfrontend support the strangler and
  the exit.
- **Family evidence**: families.md 3.6 and 3.7 works-well fields.
- **Co-survivors, honestly**: `wujie` and `web-fragments` (client reframing mode) tie on
  containment and beat hyperfrontend on two cells that matter in this exact region:
  `ux.natural-layout-flow`=y and `migration.participant.thirdparty-unmodified-viable`. If
  the legacy application cannot take an SDK, the virtualized-rehosting units win outright
  and hyperfrontend is eliminated at the participant ceiling; this is precisely what
  happened in the traced acquisition fixture (decision-engine.md 5.6). Hyperfrontend leads
  this region only when the legacy side is still actively maintained enough to add a
  bootstrap import, and when the trust or blast-radius requirement is strong enough to
  reject a simulated realm (taxonomy.md 2.2: virtualized realms are never a security
  boundary).

### 2.5 `pos.fit.host-owned-presentation` : the host must control geometry, display mode, and liveness across the boundary

- **Constraint combination**: `constraint.paved-road` (strong, never hard) plus
  `constraint.seamless-ux` bound as a *preference* rather than a hard constraint, inside a
  region already fixed by `constraint.fault-containment` or `constraint.distinct-principal`.
- **Matrix rows**: `ux.host-overlay-protocol`=y for hyperfrontend, luigi, and piral only;
  `contracts.host-push-updates`=y with `contracts.builtin-messaging`=y for hyperfrontend,
  luigi, micro-app-jd, piral, qiankun, wujie; `ux.overlay-viewport-escape`=c for
  hyperfrontend with the condition "embedded mode clips to the frame rectangle;
  contract-declared dialog/popup modes provide full-viewport surfaces", against n for
  iframe-composition; `operations.local-composed-dev-firstparty`=y and
  `operations.owner-attribution-builtin`=y.
- **Family evidence**: families.md 3.7 inherent-costs field lists exactly the seam this
  region pays down; thesis P14 states the geometry-authority inversion as a design choice,
  not a capability.
- **Co-survivors, honestly**: `luigi` holds the overlay protocol, a built-in bus, shared
  state (`contracts.builtin-shared-state`=y where hyperfrontend is n), built-in loading UI
  (y against hyperfrontend's c), and deep-link-to-inner-route (y against n). Luigi is the
  stronger paved road on several of these cells and is eliminated only where trust matters
  (`security.untrusted-third-party-viable`=n, "its trust model broadcasts host-issued
  tokens to frames", scenarios/third-party-vendor-widget.md) or where its central
  navigation owner is unacceptable (`ownership.platform-team-role-required`=y and
  `runtime.central-routing-map`=y, both n for hyperfrontend).

### 2.6 Regions this unit is entitled to and does not own alone

For completeness, the following are family-level or landscape-common and must not be sold
as positioning: browser-enforced CSS containment, deploy independence
(`composition.phase.deploy-unit-per-participant`=y for all seven microfrontend families),
static hosting sufficiency (18 units), OSI licensing (18 units),
`migration.exit.participants-standalone` (12 units), and code-level ownership
(`ownership.code-boundary-ownership`=y for all 30, kept in the matrix precisely to prove
that ownership rhetoric differentiates nothing; taxonomy.md 4.1).

---

## 3. Where HyperFrontend is poorly suited, or simply unnecessary (`pos.misfit.*`)

Each entry pairs the project's own published concession (thesis section 3, which quotes the
article and README) with the matrix evidence, and names what to use instead.

- **`pos.misfit.single-team-controlled-host`**: one team, one stack, one release train, on
  a host you fully control. The project's own words: "you probably do not need it ...
  Shared dependencies are leverage in that world" and "take the cohesion road with this
  article's blessing" (thesis 3, article "The bill, and who paid it"). Engine behaviour:
  `derive.single-coordinated-team` re-classes `constraint.independent-deploy`,
  `constraint.no-version-governance`, `constraint.framework-major-coexistence`, and
  `constraint.runtime-roster-change` to irrelevant and admits the five baseline families as
  first-class candidates (constraints.md section 3). Use instead: `family.modular-monolith`,
  `family.spa-routing`, `family.package-composition` (families.md section 5). This is
  `outcome.no-mfe-needed` in report-design.md section 9, and it must remain reachable.
- **`pos.misfit.seam-not-app-shaped`**: the boundary is a visual or behavioural seam rather
  than something owned, shipped, and trusted on its own terms (thesis P1). An app-shaped
  contract around a component boundary buys nothing and costs a document. Use instead: a
  design system through `family.custom-element-composition` or
  `family.package-composition`.
- **`pos.misfit.composed-page-ssr`**: composed, crawlable first paint.
  `ssr.composed-page`=n, `ux.composed-first-paint`=n, `ssr.crawler-indexable`=n,
  `ssr.no-js-first-paint`=n, `ssr.static-prerender`=n; `ssr.participant-internal`=c only
  ("a feature may use its own SSR for its own document; the frame still boots client-side
  inside the host"). A hard `constraint.composed-first-paint` eliminates the unit and most
  of the client-runtime landscape. Use instead: `family.server-fragment-assembly` (podium,
  server-side-fragment-composition, edge-side-composition, opencomponents, web-fragments
  pierced mode), `family.islands`, `family.route-partition`, or the server-rendered
  baseline.
- **`pos.misfit.seamless-overlays`**: dense cross-boundary interaction with overlays,
  portals, and continuous focus. `ux.natural-layout-flow`=n by design ("deliberate host
  geometry authority; child content auto-sizing excluded by design"),
  `ux.body-portal-compat` not applicable, `ux.cross-boundary-focus-mgmt`=n,
  `ux.frame-history-pollution`=y, `ux.screenreader-continuity`=? ("cross-frame
  accessibility is an acknowledged gap; tree continuity unassessed"). A hard
  `constraint.seamless-ux` eliminates the whole family (constraints.md 2.1); a hard
  `constraint.a11y-continuity` leaves the unit's cell unresolved, which is a finding, not a
  pass. Use instead: any shared-realm family, or fund the seam and accept it as an
  engineering program (families.md 3.7 hard limitations; `gap.secure-seamlessness` in
  [market-gaps.md](market-gaps.md)).
- **`pos.misfit.unmodifiable-participant`**: the participant is a third-party product, an
  acquired estate with no reproducible build, or anything that cannot take an import.
  `migration.participant.min-level`=c with condition `migration.bootstrap-change` (level 4),
  `migration.participant.thirdparty-unmodified-viable`=n ("full participation needs SDK
  glue and an hf-generated shell"), `migration.participant.legacy-no-build-viable`=c with
  a Node and CLI precondition, `buildtime.participant-tooling-required`=y,
  `framework.version-floor-imposed`=y. Both fixtures traced end to end excluded this unit
  for exactly this reason (decision-engine.md 5.6; scenarios/third-party-vendor-widget.md
  4.10). Use instead: plain `iframe-composition` at the embed-only posture, luigi
  embed-only, or the HTML-entry members of `family.virtualized-rehosting` where trust
  permits.
- **`pos.misfit.payload-budget`**: many co-displayed units under a strict byte budget.
  `performance.shared-dependency-dedup`=n, `performance.duplicate-framework-same-page`=y,
  `performance.per-unit-document-boot`=y, `performance.process-memory-overhead`=c,
  `performance.sequential-waterfall-default`=y, `ux.cross-boundary-soft-nav`=c ("the
  destination feature boots a full frame document"). A hard `constraint.payload-dedup`
  retains only `family.module-graph-federation` and the build-fused baselines.
- **`pos.misfit.sync-boundary-calls`**: participants must call each other's live objects.
  `contracts.sync-calls`=n, `contracts.serialized-boundary`=y,
  `performance.per-message-serialization-cost`=y. Hard form eliminates the family
  (constraints.md 2.1). Note the standing exclusion: distinct principals and synchronous
  calls have no joint occupant anywhere in the matrix.
- **`pos.misfit.ownerless-onboarding`**: participants must onboard themselves without a
  central owner acting. `ownership.onboarding-without-central-owner`=n,
  `deployment.new-participant-host-change`=y. Use instead: registry-mediated units
  (opencomponents, piral, zephyr-cloud y; import-map-architectures, picard-js, luigi
  conditional), accepting the delivery-intermediary trust that comes with them
  (`gap.governed-ownerless-onboarding`).
- **`pos.misfit.regulated-rollback`**: regulated release obligations.
  `governance.rollback`=n, `deployment.immutable-version-retention`=n,
  `deployment.consumer-version-pin`=n, `deployment.per-user-version-targeting`=n,
  `deployment.cache-busting-operator-burden`=y. `derive.regulated-release` binds
  `constraint.instant-rollback` and `constraint.version-pinning` hard at implementation
  scope, which excludes this unit while leaving its family available through
  pointer-switch neighbours. Use instead: import-map-architectures, opencomponents, or
  zephyr-cloud (`governance.rollback`=y), or add an operator-owned pointer layer.
- **`pos.misfit.same-origin-embedding`**: same-origin embedding with rich integration.
  Every trust cell degrades by condition (host DOM and JS state become reachable, storage
  is shared, the main thread is shared so the watchdog itself freezes), and the project's
  own concession is "importing the code may be the better answer anyway" (thesis 3). At
  that point the honest comparison is against `family.package-composition`, not against
  other microfrontend families.

---

## 4. Where it is roughly equivalent, and what decides then (`pos.tie.*`)

Three genuine equivalence zones. In all three the architecture question is settled and the
decision moves to REQ-Q-09's second level, where only implementation-lens facts remain
(taxonomy.md 4.3, constraints.md 2.13).

### 4.1 `pos.tie.vs-iframe-practice`

Identical on every family-level cell: document boundary, CSS both ways, fault triple,
trust conditionals, deploy independence, static hosting, standalone exit. They differ only
on orchestration thickness (`contracts.builtin-messaging`, `ux.host-overlay-protocol`,
`isolation.failure.load-fallback`, `operations.first-party-debug-tooling`,
`operations.local-composed-dev-firstparty`, `operations.version-skew-machinery`: y for
hyperfrontend, n for the practice) and on what the practice does not impose
(`runtime.shared-runtime-library`=n, `framework.version-floor-imposed`=n,
`buildtime.participant-tooling-required`=n, and
`migration.participant.thirdparty-unmodified-viable`=c rather than n).

Deciding factors, none architectural: whether the team wants to own the glue or buy it
(`constraint.paved-road`, which may never be bound hard because do-it-yourself is always
possible and only priced); stewardship durability (`unit.maintenance.multi-maintainer` and
`unit.maintenance.org-steward` are n for hyperfrontend and y for the practice, whose
steward is the browser); and permanence (`migration.permanent-viability`=y for the
practice, c for hyperfrontend). A team that would write the wrapper anyway, or that must
not depend on a pre-1.0 single-maintainer package, should choose the primitive, and the
framework must be willing to say so (`outcome.other-oss-strongest`).

### 4.2 `pos.tie.vs-luigi`

Same family, same iframe posture, similar orchestration thickness. Luigi leads on
`unit.availability.stable-line-shipped`=y, `unit.maintenance.org-steward`=y,
`unit.maintenance.multi-maintainer`=y, `ux.builtin-loading-ui`=y,
`ux.deep-link-inner-route`=y, `contracts.builtin-shared-state`=y, and
`migration.participant.thirdparty-unmodified-viable`=y. Hyperfrontend leads on the four
gate atoms, `security.channel-origin-pinning`, `security.channel-confidentiality`, the
fault triple at y rather than c, `security.untrusted-third-party-viable` (c against n),
`ownership.platform-team-role-required`=n, and `runtime.central-routing-map`=n. Deciding
factors: whether any participant is distrusted; whether a central navigation owner exists;
and how much a stable corporate line is worth against a gated contract.

### 4.3 `pos.tie.vs-virtualized-rehosting`

Where trust is not a requirement but containment is, wujie and web-fragments client mode
tie on the fault triple and win on `ux.natural-layout-flow` and participant adaptation
floor. Deciding factors: whether accident-damping suffices instead of malice containment
(constraints.md 6.1 first row), whether the sandbox execution tax and the framework's
permanent browser-compatibility burden are acceptable (families.md 3.6 inherent costs), and
stewardship concentration on both sides.

### 4.4 `pos.tie.rule.lens-decides-last`

The lens constraints (`constraint.maintenance-activity`,
`constraint.stewardship-durability`, `constraint.adoption-evidence`,
`constraint.stable-line`, `constraint.no-forced-remigration`) apply only inside a family
already selected on neutral grounds, and they are reported as an independent
maturity factor (REQ-AVAIL-03). On the current data they are the factors most likely to
move a reader away from this unit, and the framework must present them at full strength.

---

## 5. Honest weaknesses ledger (`pos.weakness.*`)

Read from the unit's own column on 2026-08-28, including its unknowns. Every row is
reported in the assessment's maturity and operational factors, never used to downgrade
`family.document-embedding` (REQ-ENT-02 guard).

| Id | Weakness | Cells and conditions |
|---|---|---|
| `pos.weakness.pre-1.0` | No stable line; breaking wire changes are permitted and have occurred | `unit.availability.stable-line-shipped`=n; `migration.forced-remigration-pending`=y ("adopters track a fast-moving contract"); `migration.permanent-viability`=c |
| `pos.weakness.single-maintainer` | Highest-risk stewardship profile in its family | `unit.maintenance.multi-maintainer`=n; `unit.maintenance.org-steward`=n; `operations.single-sponsor-concentration`=y (implementations.md 2.7 states this in the same words) |
| `pos.weakness.adoption-unknown` | No documented production adopters and no metrics | `unit.maintenance.adoption-outside-sponsor`=?; `unit.maintenance.adoption-scale-10k`=? (both low confidence, recorded as unknown rather than assumed) |
| `pos.weakness.silent-plaintext-downgrade` | A counterpart that omits the security protocol downgrades the channel with no runtime signal | `security.channel-confidentiality`=c: "silent runtime plaintext downgrade, gated only at build (--allow-open)"; thesis claim 11, documented limitation |
| `pos.weakness.v1-envelope-collapse` | The v1 envelope pays per-message key derivation and can drop messages silently under many concurrent chatty channels | thesis claim 10, observed and unquantified; no published thresholds |
| `pos.weakness.no-composed-ssr` | No composed page, no crawlable first paint, no static prerender of the composition | `ssr.composed-page`=n; `ux.composed-first-paint`=n; `ssr.crawler-indexable`=n; `ssr.static-prerender`=n |
| `pos.weakness.fixed-watchdog-cadence` | Heartbeat cadence and miss budget are fixed, with a blind window after tab return, and a same-origin feature freezes the watchdog entirely | thesis fact 8 and claim 5; `isolation.resource.main-thread`=c: "a same-origin feature shares the host thread and a busy spin freezes host and watchdog" |
| `pos.weakness.per-frame-cost-unquantified` | Per-feature memory and startup cost are acknowledged but never measured | thesis claim 9; `performance.per-unit-document-boot`=y; `performance.process-memory-overhead`=c; `constraint.memory-budget` is therefore a cost note that may not eliminate anything (constraints.md 2.12) |
| `pos.weakness.a11y-unassessed` | Cross-frame accessibility continuity is unknown, in a family where that is the standing guard | `ux.screenreader-continuity`=? against y for 25 units; `ux.cross-boundary-focus-mgmt`=n |
| `pos.weakness.no-release-governance` | No rollback, retention, pinning, or targeting of participant versions | `governance.rollback`=n; `deployment.immutable-version-retention`=n; `deployment.consumer-version-pin`=n; `deployment.per-user-version-targeting`=n |
| `pos.weakness.host-change-per-participant` | Adding a participant is a host change; there is no ownerless admission path | `deployment.new-participant-host-change`=y; `ownership.onboarding-without-central-owner`=n |
| `pos.weakness.adaptation-floor` | The feature side pays a bootstrap change plus tooling and a version floor | `migration.participant.min-level`=c (`migration.bootstrap-change`); `buildtime.participant-tooling-required`=y; `framework.version-floor-imposed`=y; `runtime.shared-runtime-library`=y |
| `pos.weakness.no-artifact-integrity` | Participant code is not integrity-verified before execution | `security.artifact-integrity-verification`=n (a landscape-wide absence, `gap.artifact-integrity`) |
| `pos.weakness.thin-ops-surface` | No first-party deploy inventory and no composed test utilities | `operations.deploy-inventory-firstparty`=n; `operations.composed-test-utilities`=n; `operations.cross-journey-correlation-diy`=y |

`pos.weakness.rule.no-softening`: this table is the same content the report prints under
`report.section.availability` and the maturity factor. Wording may be edited for tone; no
row may be dropped, merged, or restated as a strength while its cell stands.

---

## 6. HyperFrontend Enterprise: announced-planned only (`pos.enterprise.*`)

`impl.hyperfrontend.enterprise` is `avail.announced-planned` without exception
(implementations.md 2.7). Nothing is purchasable or hosted; `unit.editions.commercial-tier`
is Conditional with the condition "Enterprise tier is announced-planned only; nothing
purchasable or hosted exists today". Community is never downgraded architecturally for
lacking any of it (REQ-ENT-02), and none of it may name, split, or rank a family
(enterprise-layer.md section 11, verified against the derived taxonomy).

### 6.1 The REQ-AVAIL-02 duty, spelled out (`pos.enterprise.pairing`)

Whenever a planned capability fits a stated need, the assessment must show, in the same
view, what satisfies that need today, with the alternative's availability stated plainly
and never obscured. The pairing table below is the standing answer; the engine emits it as
`pairedAvailableToday` on any `status.match.future-potential` record (schema 3.21 guard,
decision-engine.md E11/E12).

| Planned Enterprise capability (all `avail.announced-planned`) | What solves it today, from the matrix |
|---|---|
| Managed hosting of apps and shells (seven `hosting.*` atoms, vendor-operated) | Vendor-operated hosting exists today only outside this family: cloudflare-workers-microfrontends, nextjs-multi-zones, bit, commercetools-frontend, piral, zephyr-cloud (`hosting.operator`=y). Inside `family.document-embedding` the honest answer is that no vendor is needed: `ssr.static-hosting-sufficient`=y and `deployment.participants-static-artifacts`=y, so any static host or CDN plus the team's own pipeline satisfies it. |
| Deployable-feature registry with review and admission | entando, opencomponents, piral, zephyr-cloud (`registry.deployable-feature`=y); bit, cloudflare-workers-microfrontends, nextjs-multi-zones, picard-js conditional. Each carries `security.delivery-intermediary-trust`=y, which is the price (`gap.governed-ownerless-onboarding`). |
| One-click rollback and immutable version retention | import-map-architectures, opencomponents, zephyr-cloud (`governance.rollback`=y); module-federation, native-federation, piral, single-spa, picard-js, nextjs-multi-zones, cloudflare-workers-microfrontends, reverse-proxy-route-composition conditional. Or an operator-owned pointer layer over any static host. |
| Usage visibility across consuming applications | No unit scores y. bit, piral, zephyr-cloud are Conditional. Today this is ordinary product analytics or an in-house inventory. |
| Organization-wide RBAC over the composition platform | commercetools-frontend, entando (`governance.rbac`=y); bit, piral, zephyr-cloud, and the routing/edge units conditional. Or the organization's existing identity platform, since every governance atom may be satisfied by a third-party product or in-house build (REQ-ENT-07). |
| Ephemeral mediated backchannel (ticketed, TTL-bounded payload exchange) | No unit in the 30-column set ships one (enterprise-layer.md 12.4, resolved as none-in-set). Today: a WebSocket relay, a queue, or a BFF, all outside the comparison set and all with different durability semantics (enterprise-layer.md section 5 comparison). |
| Managed identity, SSO, consumer credentials, entitlement | Outside the comparison set entirely; satisfied today by an identity provider plus the adopter's own backend. `security.embedding-authorization`=c for hyperfrontend is explicitly an operator job, out of SDK scope. |
| Contract governance and a notional v3 protocol | The shipping subset is already Community: the four gate atoms plus `security.channel-confidentiality`=c. Central resolution and cross-org contract governance have no occupant in the set. |
| AI Dev Assist | Planned to span both editions; a cross-cutting developer-experience capability that REQ-ENT-11 forbids using as an architectural criterion at all. |

### 6.2 Enterprise rules (`pos.enterprise.rule.*`)

- `pos.enterprise.rule.planned-never-scored`: a planned capability satisfies no constraint
  binding, including `constraint.operability.*` bindings at `scope.edition`
  (constraints.md 2.14).
- `pos.enterprise.rule.pair-today`: `status.match.future-potential` is never emitted alone;
  the paired available-today candidate is required (report-design.md section 5).
- `pos.enterprise.rule.no-community-downgrade`: Community's architectural fit is computed
  from architectural cells only; missing managed services never lower it.
- `pos.enterprise.rule.lead-capture-boundary`: the only place an Enterprise interest prompt
  may appear is after a generated result that actually reaches `outcome.hfe-future-fit` or
  exposes a gap, under `lead.rule.result-first`, `lead.rule.relevance-gated`,
  `lead.rule.no-promised-dates`, and `lead.rule.explicit-attachment`
  (report-design.md section 9).
- `pos.enterprise.rule.competitor-symmetry`: every rule above applies identically to
  competitors' commercial tiers and roadmaps (REQ-ENT-01).

---

## 7. What would change this positioning (`pos.counterfactual.*`)

Each counterfactual names the cell or delivery whose change moves the claim, so the
revision is mechanical (REQ-Q-07, `pos.method.revisable`).

| Id | If this happens | Then |
|---|---|---|
| `pos.counterfactual.shared-realm-principal` | Any shared-realm unit reaches `security.untrusted-third-party-viable`=y or c with `isolation.security.malicious-participant` (the ShadowRealm direction recorded as talk-level only for web-fragments, implementations.md 1.1) | `pos.fit.hostile-co-display` loses its exclusivity and `gap.untrusted-dedup` and `gap.secure-seamlessness` both weaken or close; the family's headline advantage becomes a tie |
| `pos.counterfactual.rival-gate` | Any other unit scores y on all four of `contracts.formal-descriptor`, `contracts.contract-versioned`, `contracts.connect-compat-gate`, `contracts.drift-explicit` | `pos.fit.gated-contract-under-drift` becomes a tie decided by lens facts, where this unit currently loses |
| `pos.counterfactual.composed-ssr-delivery` | `ssr.composed-page` or `ssr.static-prerender` flips to y or c for this unit | `pos.misfit.composed-page-ssr` closes and the unit enters SEO-constrained regions it is currently eliminated from |
| `pos.counterfactual.unmodified-participant-posture` | `migration.participant.thirdparty-unmodified-viable` flips from n to c (an embed-only posture that accepts an unmodified deployed URL) | `pos.misfit.unmodifiable-participant` closes, the two traced fixtures change outcome, and `pos.tie.vs-iframe-practice` widens rather than narrows |
| `pos.counterfactual.ownerless-admission` | `ownership.onboarding-without-central-owner` flips to y and `deployment.new-participant-host-change` to n or c (a registry-mediated admission path) | `pos.misfit.ownerless-onboarding` closes and `pos.fit.hostile-co-display` extends to true marketplace admission. This direction is currently Enterprise-planned, so until it ships REQ-AVAIL-02 pairs it with piral, opencomponents, and zephyr-cloud |
| `pos.counterfactual.release-governance` | `governance.rollback`, `deployment.immutable-version-retention`, or `deployment.consumer-version-pin` flips to y | `pos.misfit.regulated-rollback` closes; note that all three are implementation-scope, so nothing about family selection changes |
| `pos.counterfactual.stable-line` | `unit.availability.stable-line-shipped` flips to y and `migration.forced-remigration-pending` to n | `pos.weakness.pre-1.0` closes and `constraint.stable-line` and `constraint.no-forced-remigration` stop eliminating the unit at implementation scope. No architectural claim changes |
| `pos.counterfactual.stewardship` | `unit.maintenance.multi-maintainer` or `unit.maintenance.org-steward` flips to y, or adoption evidence appears | `pos.weakness.single-maintainer` and `pos.weakness.adoption-unknown` change; `pos.tie.vs-iframe-practice` and `pos.tie.vs-luigi` may resolve differently, since those ties are decided by exactly these cells |
| `pos.counterfactual.a11y-assessed` | `ux.screenreader-continuity` resolves from `?` to a value | Either `pos.weakness.a11y-unassessed` closes, or a hard `constraint.a11y-continuity` gains a clean eliminator. Both outcomes are improvements over an unknown |
| `pos.counterfactual.frame-cost-measured` | Per-frame heap and boot time get measured (thesis claim 9) | `constraint.memory-budget` becomes decidable instead of a cost note, which can eliminate this unit on constrained-device requirements |
| `pos.counterfactual.crypto-quantified` | v1 collapse thresholds get published, or v1 is replaced | `pos.weakness.v1-envelope-collapse` becomes a bounded condition rather than an unquantified observation; `security.channel-confidentiality` may move off Conditional |
| `pos.counterfactual.landscape-entry` | A new unit enters the inventory occupying `family.document-embedding` with a stable line and multi-maintainer stewardship | Every region in section 2 must be recomputed; sections 2 and 4 are set operations over the current 30 units and nothing more |

---

## 8. Neutrality check

The seven REQ-TRUST-01 outcomes remain expressible with this positioning in place:
section 3 supplies `outcome.no-mfe-needed`; section 4 supplies
`outcome.other-oss-strongest` (the primitive or luigi) and, through the pairing table,
`outcome.commercial-strongest`; section 6 supplies `outcome.hfe-future-fit` with its
mandatory pairing; [market-gaps.md](market-gaps.md) supplies `outcome.no-strong-match` and
`outcome.viable-with-changes`; section 2 supplies `outcome.hf-community-strongest` in five
bounded regions, two of which are shared with a competing unit and one of which is shared
with the browser primitive. Of the two scenario fixtures traced end to end so far, both
excluded this unit and neither exclusion was patched around
(decision-engine.md 5.6; scenarios/third-party-vendor-widget.md 4.13). That is the
neutrality evidence this file rests on.
