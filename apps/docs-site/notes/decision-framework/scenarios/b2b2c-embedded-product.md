# Scenario: b2b2c-embedded-product

Status: TRACED (2026-08-29).

## 1. Situation

We are a forty-person company whose entire business is a retirement-planning module that
other businesses put inside their own websites: banks, payroll providers, and HR platforms
buy it and offer it to their own account holders. Today we run a pilot with three customers,
each integrated by hand with a script our two solutions engineers maintain individually per
customer, and it is already unsustainable. Our funded plan, which the whole company is
staffed around, is to reach several hundred customer sites within eighteen months with
self-service setup: a customer signs a contract, gets keys, pastes one snippet, and is live.
Our customers' websites are wildly different (one is a bank with a strict security team, one
builds their site in a drag-and-drop tool) and we can never ask them to rebuild anything or
to coordinate with each other. When we improve the product, every customer site must get the
update automatically, and an update must never break a customer's page; several contracts
make us liable if it does. Each person who opens the module is the customer's account holder,
not ours, yet what they see depends on which package their institution bought from us, so
every load has to check what that institution and that person are entitled to. Customers want
to see usage numbers and manage their keys, and some have asked to put those admin screens
inside their own back-office tools. We charge per seat, so metering who used what is money,
not vanity.

## 2. Normalized inputs

Re-normalized 2026-08-29 against the canonical ids of
[constraints.md](../model/constraints.md), [questions.md](../model/questions.md),
[topology.md](../model/topology.md), [migration.md](../model/migration.md), and
[enterprise-layer.md](../model/enterprise-layer.md). Changes: each input now names its
constraint binding, class, subject, and derivation route; the customer-side ceiling and the
least-capable-host row fuse into one binding whose subject is `host:least-capable-supported`
(the second row supplies the subject per constraints.md 1.4, not a second constraint id);
"an update must never break a customer's page" splits into `constraint.fault-containment`
(hard, family scope) and the auto-escalated `constraint.explicit-drift-surfacing` (strong,
implementation scope, via `derive.many-party-drift`); co-residence is made explicit as
`constraint.single-screen-mixing` (the Situation puts the module inside the customer's own
page); the eighteen-month self-service plan is reclassified from hard-constraint to the
credible `state.target` of the septet plus `engine.rule.horizon-select`, since a scale plan
selects a horizon and a target slot rather than a constraint id; the operability rows take
`constraint.operability.*` ids at `scope.edition`; values otherwise unchanged. This is the
REQ-ORG-02 distribution chain of [topology.md](../model/topology.md) section 2.10; the
final hop co-occurs with `topology.white-label`.

Subjects: `participant:retirement-module` (the vendor product, owned by the framework user),
`host:least-capable-supported` (the weakest customer page that must be supported, a
drag-and-drop builder site).

| Input | Canonical binding | Class / marking |
|---|---|---|
| Topology label | `topology.b2b-distribution` (with `topology.white-label` at the embedding hop) | label (informational; facts govern) |
| `ownership.participant-unmodifiable-host` = yes | premise of `derive.white-label-fit` | observed fact, `state.current` |
| `ownership.no-cross-deployment-control` = yes, at every hop | premise of `derive.no-cross-deploy-control` | observed fact, `state.current` |
| `ownership.external-participant` = yes, from each customer's seat | premise of `derive.external-principal` (confirm) and of `derive.b2b-chain` | observed fact, `state.current` |
| `migration.appetite`, customer (host) side = `migration.trivial-adaptation` (1): keys plus one pasted snippet | `constraint.host-modification-ceiling`(`host:least-capable-supported`, maxLevel=`migration.trivial-adaptation`) via `question.host.negotiability` (rank 14) and `derive.white-label-fit` | `class.hard-constraint` |
| Least-capable supported host defines the floor (drag-and-drop builders included) | not a second constraint: it fixes the subject of the row above to `host:least-capable-supported` and is the fact that makes `buildtime.host-integrates-buildless` the deciding host-side atom (see Model finding 1) | `class.hard-constraint`, realized as the subject rule |
| Vendor updates reach all customer sites automatically, with no customer action | `constraint.independent-deploy` (global) via `question.deploy.independence` and `derive.no-cross-deploy-control` | `class.hard-constraint` (stated and entailed) |
| An update must never break a customer's page (contractual liability) | `constraint.fault-containment`(`participant:retirement-module`) via `question.failure.containment` at its hard level (a stated liability mandate, questions.md 3.9); the version-drift half raises `constraint.explicit-drift-surfacing` through `derive.many-party-drift` | hard (fault containment) plus `class.strong-preference` (drift surfacing, `scope.implementation`) |
| Self-containment in unknown host environments, both directions (strict CSPs, page builders, hostile-to-assumptions pages) | `constraint.participant-self-containment`(`participant:retirement-module`) via `derive.white-label-fit` (confirm), confirmed by this statement | `class.hard-constraint` |
| Module renders inside the customer's own page, beside the customer's content | `constraint.single-screen-mixing` via `question.granularity.single-screen` = yes (product-shape fact, questions.md 3.3) | `class.hard-constraint` |
| Customers cannot be asked to adopt a runtime, build step, or framework | `constraint.no-strategy-runtime` via `derive.white-label-fit` | `class.strong-preference` (the derivation's class; ceiling hard, see Model finding 1) |
| Per-load entitlement check (institution package + end-user identity) | `constraint.operability.subscription-entitlement` (atoms `commerce.entitlement`, `registry.marketplace`), unlocked by `derive.b2b-chain` | `class.hard-constraint`, `scope.edition` |
| Credential issuance, rotation, revocation for customers' consumers | `constraint.operability.consumer-credentials` (atoms `identity.consumer-credentials`, `identity.key-issuance`), unlocked by `derive.b2b-chain` | `class.hard-constraint`, `scope.edition` |
| Self-service onboarding at hundreds-of-customers scale within eighteen months | not a constraint id: the credible `state.target` of the septet below, plus `engine.rule.horizon-select` (the eighteen months is the governing decision horizon, echoed as a report risk line) | target slot plus horizon selection |
| Usage metering per customer (revenue-bearing) | `constraint.operability.usage-visibility` (atom `governance.usage-monitoring`) | `class.strong-preference`, `scope.edition` |
| Key-management and usage dashboards embeddable into customer back-office tools | dashboards route to `constraint.operability.usage-visibility`; the embeddability half (`admin.embeddable-ui`, enterprise-layer.md section 9) has no operability seed and therefore no `constraint.operability.*` id and no question node (Model finding 3) | `class.strong-preference` (REQ-ENT-10), currently unbindable |

Engine-answered guards (questions.md section 7, no question spent):
`constraint.installable-today` and `constraint.code-ownership`, both uniform y.

State septet, recorded on `dimension.adaptation-floor` (host facet) and
`dimension.roster-authority` (onboarding authority), which is how
[state-transition.md](../model/state-transition.md) section 2 maps the brief's
"distribution scale":

| Field | Value |
|---|---|
| `state.current` | three pilot customers, hand-maintained per-customer scripts; each onboarding is a vendor engineer's action |
| `state.target` | several hundred self-service customer sites; onboarding without a central owner |
| `transition.willingness` | total; it is the business |
| `transition.cost` | productizing the embed surface, onboarding, and credentials |
| `transition.authority` | company leadership; the whole company is staffed around it |
| `transition.confidence` | `transition.confidence.transitioning` (6) |
| `transition.horizon` | eighteen months |

Buy-in signals present: `buyin.executive-sponsorship`, `buyin.budget`, `buyin.staffing`,
`buyin.timeline`. Credible per [state-transition.md](../model/state-transition.md) section 3
(`predicate.target-credible`: ordinal 6 >= 5, authority held, horizon inside the decision
horizon).

Participant-side appetite for the vendor's own module is not stated as a ceiling and is not
bound: the module's owner is the framework user, whose willingness is total and whose work is
funded, so the migration.md section 7 white-label prior (participant 1-4, host 9) governs as
a prior only. `question.migration.participant-ceiling` stays in `unresolvedQuestions`.

## 3. Guardrail expectations

Sanity checks only; no predicted winner.

- No admissible strategy may require customers to perform work beyond trivial adaptation, to
  use a particular framework, bundler, or host architecture, or to coordinate upgrades with
  the vendor or each other ([migration.md](../model/migration.md) sections 3 and 7,
  white-label and b2b rows: the product must fit hosts it cannot change).
- Entitlement, credentials, metering, and embeddable admin select editions and operating
  models, never architectural families (REQ-ENT-01, REQ-ENT-03): the family choice in the
  trace must remain explainable with every commercial capability removed (REQ-KEYTEST-01
  posture).
- Availability discipline: no planned capability may be recommended as if it exists
  (REQ-AVAIL-01); a strong future fit must be paired with the best available today
  (REQ-AVAIL-02); and if no offering covers the full chain, the trace must produce a
  first-class gap record rather than lowering the bar (REQ-GAP-01, REQ-GAP-02).
- The open category question, whether "distributed frontend product platform" is its own
  category ([topology.md](../model/topology.md) section 2.10), must surface in the trace as
  an unresolved question, not be silently resolved either way.

REQ-TRUST-01 outcome classes allowed (ids per [README.md](README.md)): `trust.hf-community`,
`trust.other-oss`, `trust.commercial`, `trust.hfe-future` (this scenario is a canonical
candidate for it, with pairing), `trust.no-match` (equally canonical: the full chain may be a
genuine gap), `trust.change-assumptions`. `trust.no-mfe` is excluded: distributing frontend
functionality into pages the vendor does not control is the business itself.

## 4. Trace

Hand-traced 2026-08-29 through the [decision-engine.md](../model/decision-engine.md) pipeline
(E1 to E17), with cells quoted from
[matrix-compact.tsv](../matrix/matrix-compact.tsv) and per-cell conditions from
`matrix/columns/<unit>.json` (version.research 2026.08.0). Subjects:
`participant:retirement-module`, `host:least-capable-supported`.

### 4.1 E1 `engine.step.intake`

The section 2 table is the intake record. Rank 1
(`question.ownership.composition-parties`) fills the three ownership facts from the
participant's seat, which is the seat this fixture is answered from: the user's product is
the embedded party, so rank 14 (`question.host.negotiability`) is reached immediately and
answers the customer-side ceiling at `migration.trivial-adaptation`. The contractual
liability answers `question.failure.containment` at its hard level (questions.md 3.9: a
stated blast-radius or regulatory mandate, not a resilience preference). The
self-containment statement confirms `derive.white-label-fit`'s confirm-mode product.
Rank 3 (`question.granularity.single-screen`) is answered yes from the Situation: the module
renders inside the customer's own page. The eighteen-month plan is not a constraint: per
`engine.rule.horizon-select` it selects the governing decision horizon and produces a report
risk line, and its content routes to the septet through `question.rule.state-fork` (the
answer is future tense: "our funded plan is to reach several hundred customer sites").
Facet ceilings apply to the two edition-scope desirability rows (metering, dashboards):
neither can exceed `class.strong-preference`.

### 4.2 E2 `engine.step.topology-infer`

`ownership.external-participant` + `ownership.participant-unmodifiable-host` +
`ownership.no-cross-deployment-control` (the last at every hop, with three or more legal
entities per composed page) infer `topology.b2b-distribution` for the vendor/customer
boundary with `topology.white-label` at the embedding hop (topology.md 2.10, 2.8);
`question.topology.confirm` confirmed (the brief's label row is informational, facts govern).

Priors armed (constraints.md 2.15, b2b-distribution row: "union of third-party-vendor and
white-label hard tendencies per hop"):

- hard tendencies that arrive as explicit answers or entailed derivations in 4.3:
  `constraint.host-modification-ceiling` (level 1), `constraint.participant-self-containment`,
  `constraint.independent-deploy`, `constraint.fault-containment`;
- hard tendency that stays a `prior-unconfirmed` binding: `constraint.distinct-principal`
  (from `derive.external-principal`, confirm mode). Per `engine.rule.prior-bindings` a
  hard-tendency prior never eliminates before its confirming question arrives, so
  `question.trust.malicious-participant` from the customer's seat is armed and listed in
  `unresolvedQuestions` (question-graph.md 1.3, rank-14 row). Consequence worth stating
  plainly: topology.md 2.10's family implication is written as the intersection of the
  hop-wise hard sets *including* distinct-principal; the engine's own prior discipline means
  the family-stage survivor set here is reached without it, and the two agree anyway (4.6);
- preference tendency: `constraint.seamless-ux`, which topology.md 2.8 records as a
  per-customer depth-of-integration spectrum, enters as a `prior-unconfirmed`
  `class.strong-preference` binding with `question.ux.seam-tolerance` in
  `unresolvedQuestions`;
- preference tendency: the `constraint.operability.*` block at `scope.edition`, activated in
  4.3 by `derive.b2b-chain`.

Category question (guardrail 4): the inference step is where "is a distributed frontend
product platform its own category?" surfaces. topology.md 2.10 records it RESOLVED at the
Phase 6 gate, with evidence: families.md FC-6 tested and rejected the one candidate boundary
(a platform-owns-the-host family), FC-8 dissolved the delivery-governance candidate into a
layer, implementations.md records every commerce, identity, and marketplace surface at
`attach.edition` or `attach.implementation`, and the entitlement atoms live at
`scope.edition`. The trace carries that resolution with its evidence rather than resolving
it silently, and carries its one unverified residue (Model finding 4).

### 4.3 E3 `engine.step.derive`

Fired:

- `derive.white-label-fit` (mixed; premise `ownership.participant-unmodifiable-host`=y):
  `constraint.host-modification-ceiling`(maxLevel=`migration.trivial-adaptation`) hard;
  `constraint.participant-self-containment` hard (confirm mode, confirmed by the explicit
  self-containment statement); `constraint.no-strategy-runtime` at
  `class.strong-preference`.
- `derive.no-cross-deploy-control` (entailed; premise `ownership.no-cross-deployment-control`=y):
  `constraint.independent-deploy` hard. Its far-side ceiling clause binds
  `constraint.host-modification-ceiling` near zero (already bound at level 1) and
  `constraint.participant-modification-ceiling`(`participant:retirement-module`, maxLevel=2,
  payableBy=host) hard *from the customer's seat*: no more than level-2 work may fall on the
  customer to make the module participate. It does not cap work the module's own owner pays
  for; migration.md section 3 ("who can pay is an ownership fact") and the migration.md
  section 7 white-label prior (participant 1-4, host 9) both say so. See Model finding 2:
  the rule as written carries no owner guard and a naive engine would read the ceiling as a
  cap on the participant floor itself.
- `derive.external-principal` (confirm; premise `ownership.external-participant`=y):
  `constraint.distinct-principal`(`participant:retirement-module`) as a `prior-unconfirmed`
  hard binding. Not confirmed by this fixture.
- `derive.b2b-chain` (mixed; premise `topology.b2b-distribution` confirmed): per-hop
  application of the two rules above, and activation of the `constraint.operability.*`
  identity and commerce block at `scope.edition` (`consumer-credentials`,
  `subscription-entitlement`), which is the only route by which those questions unlock
  (question-graph.md 1.3, stage-2b row).
- `derive.many-party-drift` (entailed; >= 3 independently deploying parties, and both
  surviving candidates score `contracts.drift-surface`=y): `constraint.explicit-drift-surfacing`
  at `class.strong-preference`, `scope.implementation`. The party count is not marginal here:
  the target state is several hundred independently deploying customer sites.

Not fired (premises absent): `derive.unmodifiable-participant-floor` as a cap on the vendor's
own module (the premise `ownership.host-unmodifiable-participant`=y does hold at this
boundary, and its product is exactly the payableBy=host ceiling recorded above; it is not a
second, owner-side cap, per Model finding 2), `derive.single-coordinated-team` (external
participants present), `derive.broken-governance`, `derive.plugin-admission` (customers are
contracted, not anonymous authors; participants are known at ship time),
`derive.mixed-majors-present` (no coexistence estate fact: the vendor ships one stack),
`derive.static-estate`, `derive.seo-surface` (the module renders behind an account holder's
authentication), `derive.regulated-release` (the contracts create liability for breakage, not
rollback or audit obligations; `question.guard.verbatim-bytes` never armed),
`derive.legacy-untouchable`, `derive.payload-budget` (no stated budget fact).

### 4.4 E4 `engine.step.compose`

| Constraint | Subject | Class | Params | Slot | Origin |
|---|---|---|---|---|---|
| `constraint.fault-containment` | participant:retirement-module | hard | | current | answer:question.failure.containment |
| `constraint.host-modification-ceiling` | host:least-capable-supported | hard | maxLevel=`migration.trivial-adaptation` | current | answer:question.host.negotiability; derive.white-label-fit; derive.no-cross-deploy-control |
| `constraint.independent-deploy` | global | hard | | current | answer:question.deploy.independence; derive.no-cross-deploy-control |
| `constraint.participant-modification-ceiling` | participant:retirement-module | hard | maxLevel=`migration.integration-adapter`, payableBy=host | current | derive.no-cross-deploy-control |
| `constraint.participant-self-containment` | participant:retirement-module | hard | | current | derive.white-label-fit (confirmed) |
| `constraint.single-screen-mixing` | global | hard | | current | answer:question.granularity.single-screen |
| `constraint.distinct-principal` | participant:retirement-module | hard (prior-unconfirmed) | | current | derive.external-principal via derive.b2b-chain |
| `constraint.explicit-drift-surfacing` | participant:retirement-module | strong-preference | | current | derive.many-party-drift |
| `constraint.no-strategy-runtime` | global | strong-preference | | current | derive.white-label-fit |
| `constraint.seamless-ux` | global | strong-preference (prior-unconfirmed) | | current | topology.white-label prior |
| `constraint.operability.consumer-credentials` | edition | hard | | current | answer:question.edition.operability.consumer-credentials; derive.b2b-chain |
| `constraint.operability.subscription-entitlement` | edition | hard | | current | answer:question.edition.operability.subscription-entitlement; derive.b2b-chain |
| `constraint.operability.usage-visibility` | edition | strong-preference | | current | answer:question.edition.operability.usage-visibility |

Target slot: the septet's `state.target` (self-service onboarding at several hundred customer
sites) passes `predicate.target-credible` (confidence ordinal 6 >= 5; authority held by
company leadership; horizon eighteen months, inside the decision horizon). Per
`rule.target-credibility` it therefore evaluates only in the `bestAfterTransition` pass
(E13), never in the current-state elimination pass, and per `rule.no-target-satisfies-hard`
it satisfies nothing today. `rule.aspiration-warning` has nothing to act on: the target is
credible, so it produces a recommendation rather than a warning.

Note which bindings are current and not target: the host ceiling, self-containment,
independent deploy, fault containment, and the two hard operability bindings all hold at
today's three pilot customers. The transition changes who pays the level-1 host work (a
vendor engineer today, the customer self-serving at target) and the scale of the credential
and entitlement plane, not the level on the migration scale.

### 4.5 E5 `engine.step.relations`

- `rel.excludes` `constraint.fault-containment` (hard) vs `constraint.sync-boundary-calls`
  (hard): the `to` side is unbound, so `edge.warns` is armed on rank 15 and shown at ask
  time. The relation's basis states the pair is jointly satisfiable only by the hidden-realm
  virtualized units (wujie, web-fragments client); both are independently eliminated in 4.6
  by `constraint.participant-self-containment`, so in this assessment the intersection is
  empty and a hard rank-15 answer would empty the space. `gapSeed` queued for E14 against
  that answer, not against the current binding set.
- `rel.excludes` rows keyed on `constraint.distinct-principal` (vs seamless-ux, sync-calls,
  payload-dedup) are pre-armed but inactive: the `from` side is `prior-unconfirmed`, not
  hard. They arm the moment `question.trust.malicious-participant` is answered hard, which
  is why 4.9 selects that question first.
- `rel.relaxes`: none active. `constraint.single-screen-mixing` was affirmed, not negated, so
  the co-residence cluster stays live; `constraint.distinct-principal` is not hard, so
  `constraint.interference-damping` is not re-classed; `constraint.atomic-release` and
  `constraint.static-hosting-only` are unbound.
- `rel.requires` on `constraint.payload-dedup`: neither prerequisite (standing version
  governance, or build fusion) survives, so rank 12's hard form is presented as a tradeoff
  acknowledgment rather than a live choice (question-graph.md 1.3 rank-12 row).
- No gap seeds from the currently bound set: no `to` side of any exclusion is bound hard.

### 4.6 E6 `engine.step.eliminate-family` (cells quoted from matrix-compact.tsv)

| Eliminated | Violated binding(s) | Deciding cells |
|---|---|---|
| `family.modular-monolith`, `family.package-composition`, `family.spa-routing`, `family.server-templates`, `family.islands` | `constraint.independent-deploy`; also `constraint.participant-self-containment` | `deployment.host-rebuild-required` = y for modular-monolith, monorepo-package-composition, plain-spa-routing, server-rendered-templates, islands-architecture, bit (commercetools-frontend c, condition fails the need); `ownership.participant-unmodifiable-host` = n for all six, c for islands-architecture; families.md section 5 "no independent deployment, by definition" |
| `family.route-partition` | `constraint.participant-self-containment`; also `constraint.single-screen-mixing` | `ownership.participant-unmodifiable-host` = na for reverse-proxy-route-composition (na never satisfies a hard requirement, REQ-MATRIX-05) and n for nextjs-multi-zones, cloudflare-workers-microfrontends; `runtime.concurrent-participants` = n/n/n |
| `family.virtualized-rehosting` | `constraint.participant-self-containment` | `ownership.participant-unmodifiable-host` = n for qiankun, micro-app-jd, wujie, web-fragments; the family composes deployed apps into a host it controls, which is the opposite of the white-label seat |
| `family.module-graph-federation` | `constraint.participant-self-containment`, `constraint.fault-containment` | `ownership.participant-unmodifiable-host` = n for module-federation, c for native-federation and import-map-architectures, but `isolation.css.outbound` = n and `runtime.global-registration-collision` = y for all three; fault triple n/n/n |
| `family.lifecycle-orchestration` | `constraint.host-modification-ceiling`, `constraint.participant-self-containment`, `constraint.fault-containment` | `migration.host.shell-takeover-required` = y for single-spa, c for piral; `ownership.participant-unmodifiable-host` = n for both; `isolation.lifecycle.reclaim` = n for both (quarantine is not containment, families.md 3.5) |
| `family.custom-element-composition` | `constraint.participant-self-containment`, `constraint.fault-containment`; entando additionally `constraint.host-modification-ceiling` | web-components-composition scores `ownership.participant-unmodifiable-host` = y and `isolation.css.outbound` = y but `runtime.global-registration-collision` = y ("custom-element names are a page-global namespace, one definition per name per page", families.md 3.3: the naming treaty a vendor cannot negotiate with hundreds of unknown host pages); fault triple c/n/c; entando `migration.host.shell-takeover-required` = y, `ownership.participant-unmodifiable-host` = n |
| `family.server-fragment-assembly` | `constraint.participant-self-containment`, `constraint.fault-containment` | `isolation.css.outbound` = n for opencomponents, podium, edge-side-composition, server-side-fragment-composition (delivered fragments share one document and one CSS space, families.md 3.2); `ownership.participant-unmodifiable-host` = n for podium and web-fragments; fault triple n/n/n for opencomponents, podium, server-side-fragment-composition |

Every `Exclusion` record carries all violated bindings with their origin chains
(`rule.monotone-elimination`).

Discrepancy disclosed at this step (Model finding 5): constraints.md 2.1 states
`constraint.participant-self-containment`'s hard form as "retains units scoring y on
`ownership.participant-unmodifiable-host` (hyperfrontend, iframe-composition, opencomponents,
picard-js, web-components-composition cells)", which reads one of its three bound atoms.
Under E6's re-check-the-cells discipline all three decide, and the other two remove
opencomponents (`isolation.css.outbound` = n), picard-js (`isolation.css.outbound` = ?,
never read as satisfied) and web-components-composition
(`runtime.global-registration-collision` = y) from that list. The trace applies the
all-atoms reading, which is what the engine mechanically does, and records the contradiction
with topology.md 2.8's family implication (which expects custom-element composition and the
fragment client profile to survive the white-label hop). The outcome does not hinge on it:
`constraint.fault-containment` removes both families independently.

Retained: `family.document-embedding` only, at the embed-only, cross-origin posture. Cells
for the surviving members:

- **iframe-composition** (practice unit, family substance): `ownership.participant-unmodifiable-host`
  = y ("one iframe tag"); `isolation.css.outbound` = y ("cascades never merge across
  documents"); `isolation.css.inbound` = y; `runtime.global-registration-collision` = n
  ("per-frame namespaces"); fault triple y/y/y ("errors surface on the child window, never
  the host stream" / "removing the frame destroys its document, realm, timers, and
  listeners" / "reload or recreate the frame for a fresh execution context");
  `deployment.host-rebuild-required` = n ("a frame version goes live on its next document
  load with zero host coordination"); `ownership.deploy-schedule-ownership` = y;
  `composition.phase.deploy-unit-per-participant` = y; `migration.host.min-level` = c,
  condition `migration.trivial-adaptation` ("host adds an iframe tag; no build tooling, tier,
  or re-rooting"); `migration.host.shell-takeover-required` = n;
  `runtime.concurrent-participants` = y; `buildtime.host-integrates-buildless` = y;
  `framework.composition-tier-stack-mandated` = n; `framework.version-floor-imposed` = n;
  `runtime.shared-runtime-library` = n. Condition attached to the candidate: the customer's
  page must admit the embed origin in its own CSP, which is the level-1 serving-config item
  the ceiling permits and which some page-builder hosts cannot edit.
- **impl.hyperfrontend**, script-tag posture: `ownership.participant-unmodifiable-host` = y
  ("design center: one script tag or install on an unmodifiable host");
  `isolation.css.outbound` = y; `isolation.css.inbound` = y;
  `runtime.global-registration-collision` = n ("per-frame namespaces; no page-global
  registration surface"); fault triple y/y/y; `migration.host.min-level` = c, condition
  `migration.trivial-adaptation` ("one script tag or npm install plus a mount declaration"),
  retained at the script-tag posture only; `migration.host.shell-takeover-required` = n;
  `framework.composition-tier-stack-mandated` = n. Retained conditionally against
  `constraint.independent-deploy`: `deployment.host-rebuild-required` = c, condition "no
  while the contract holds; contract-changing updates require the host to install a
  regenerated shell". Per the E6 cell-value discipline the `c` retains only with that
  condition printed on the candidate.

Per-configuration exclusion inside the surviving family: **impl.luigi**, on
`constraint.host-modification-ceiling`. Its `migration.host.min-level` = c names two
postures, `migration.integration-adapter` (the luigi-container element in an existing host)
and `migration.bootstrap-change` (Core as the outer application frame); the lower of the two
is level 2, above the bound maxLevel of 1. `migration.host.shell-takeover-required` = c
("full shell: Core must own the outer frame") corroborates. Luigi's
`ownership.participant-unmodifiable-host` = c and `runtime.global-registration-collision` = c
resolve favorably in iframe mode, so the ceiling, not the boundary, is what excludes it.

Engine-answered guards: `constraint.installable-today` and `constraint.code-ownership`
satisfied uniformly; no question spent.

### 4.7 E7 `engine.step.rank-family`

One family survives, so family-level ranking is trivial and the discriminating work happens
at E10. `family.document-embedding` carries `status.match.conditional` at family level
(every member survives only with a posture or cell condition attached) with the four
independent fit flags:

- `fit.architectural`: holds. `because`: browser-enforced containment in both directions
  (`isolation.css.outbound` y, `isolation.css.inbound` y, fault triple y/y/y), per-frame
  namespaces against unknown host globals (`runtime.global-registration-collision` n), and
  `framework.same-framework-major-coexistence` = y, which is what lets one embed run beside
  any customer stack.
- `fit.organizational`: holds. `because`: `ownership.participant-unmodifiable-host` y and
  `ownership.deploy-schedule-ownership` y: the customer changes nothing and the vendor keeps
  its own cadence, which is the entire b2b2c ownership shape (topology.md 2.8, 2.10).
- `fit.operational`: holds with named cost. `because`: `ssr.static-hosting-sufficient` y and
  `migration.host.new-infra-tier-required` n on both members, against
  `performance.per-unit-document-boot` y (a document boot per embed on every customer page)
  and, for the practice unit, an entirely adopter-built operational surface.
- `fit.transition-dependent`: no at family scope. No family-level binding originates in a
  `state.target` slot.

Violated preference bindings, reported as explicit tradeoffs (REQ-REPORT-03):
`constraint.seamless-ux` at strong (`ux.natural-layout-flow` = n for both members;
families.md 3.7 hard limitations), and for one member `constraint.no-strategy-runtime` and
`constraint.explicit-drift-surfacing`, both settled at E10.

### 4.8 E8 `engine.step.dominance`

- `dominance.html-entry-at-low-ceiling`: condition-true (rank-4 bound maxLevel <= 2 for
  `participant:retirement-module`) but with no remaining effect, since its dominated set
  (`family.virtualized-rehosting`) is already excluded. Disclosed as active-moot, with its
  condition, exactly as the third-party-vendor fixture records it.
- `dominance.browser-boundary-over-simulated-realm`: inactive, because its condition
  (`constraint.distinct-principal` bound hard) is only `prior-unconfirmed`. It is disclosed
  as armed: a hard answer to `question.trust.malicious-participant` activates it, and it too
  would be moot here.
- `dominance.fused-baselines-over-mfe`, `dominance.route-partition-over-coresident-runtimes`,
  `dominance.fusion-subsumes-drift-and-dedup`, `dominance.static-subsumes-infra-tier`: all
  inactive (no `derive.single-coordinated-team`, rank 3 answered yes, no atomic-release, no
  static-hosting binding). No question is suppressed by dominance in this assessment, so
  `unresolvedQuestions` carries every still-askable node.

### 4.9 E9 next-question and emission shape

Askable set over S = {`family.document-embedding`} with two surviving configurations:

| Candidate q | guaranteed | expected class | reach |
|---|---|---|---|
| `question.trust.malicious-participant` (rank 5, confirm) | 0 | common (one pilot customer is a bank with a strict security team; the strictest customer sets the posture) | activates one dominance rule and arms three `edge.warns` (ranks 10, 12, 15) |
| `question.ux.seam-tolerance` (rank 10, + the `constraint.a11y-continuity` facet) | 0 | plausible (topology.md 2.8 depth-of-integration spectrum, per customer) | a hard answer empties the space and forces E14 |
| `question.impl.drift-machinery` (stage 2, escalated) | 0 | plausible (the liability language is about breakage, not about a machine-readable refusal) | a hard answer eliminates the practice unit and flips the head of the ordering |
| `question.impl.stewardship-floor` (stage 2) | 0 | plausible | a hard stable-line or stewardship floor eliminates impl.hyperfrontend |
| `question.orchestration.appetite` (rank 16) | 0 | plausible | discriminates thickness inside the family (families.md FC-5) |
| `question.migration.participant-ceiling` (rank 4, own side) | 0 | rare (the work is funded) | a ceiling below level 4 eliminates impl.hyperfrontend |
| `question.trajectory.no-transition-outcome` | 0 | n/a | mandatory before any `fit.transition-dependent` output (question-graph.md 1.3) |

Suppressed as zero-gain (relevance law, question-graph.md 1.4.3): rank 6
(`question.coordination.upgrade-train`: both survivors are `deps.duplicated`), rank 7
(`migration.host.new-infra-tier-required` = n and `ssr.static-hosting-sufficient` = y for
both), rank 11 (`framework.same-framework-major-coexistence` = y for both), rank 12
(prerequisite fails, presented as a tradeoff acknowledgment per 4.5), rank 15 (the survivor
set does not span serialized and live boundaries; additionally warn-flagged), rank 13 (the
roster is host-authored and customers are contracted, not anonymous authors).

argmax by (guaranteed = 0 tie, then expected class, then reach):
`question.trust.malicious-participant`. The fixture supplies no further answers, so emission
is `rule.conditional-output` shape 2 (conditional) for the family and implementation halves,
with every overturning answer named in `unresolvedQuestions.couldStillChange` (4.12). The
edition half additionally carries a `fit.transition-dependent` annotation, so
`question.trajectory.no-transition-outcome` is mandatory before it emits; the fixture does
not answer it, so that annotation is withheld and the question is named. The family-level
`slots.bestToday` emits regardless (REQ-STATE-02), and its robustness under either answer is
a cell fact rather than a supplied one: `migration.permanent-viability` = y for
iframe-composition ("perennial platform capability with multi-decade production evidence").

### 4.10 E10 to E12: stage 2, editions, and the availability lens

Candidate implementations, ordered by `engine.rule.candidate-order`:

1. **iframe-composition** (practice unit; family substance, no `impl.*` record), embed-only
   cross-origin posture. `status.match.viable`: the hard set is satisfied with no cell
   condition standing between it and any hard binding. Violated preferences, each named:
   `constraint.seamless-ux` (`ux.natural-layout-flow` = n, `ux.overlay-viewport-escape` = n,
   `ux.host-overlay-protocol` = n), `constraint.explicit-drift-surfacing`
   (`contracts.formal-descriptor` = n, `contracts.contract-versioned` = n,
   `contracts.connect-compat-gate` = n, `contracts.drift-explicit` = n), and
   `constraint.paved-road` at weak (`contracts.builtin-messaging` = n,
   `ux.builtin-loading-ui` = n, `ux.builtin-error-fallback-ui` = n,
   `operations.local-composed-dev-firstparty` = n). Satisfies
   `constraint.no-strategy-runtime` in full (n/n/y on its three atoms).
2. **impl.hyperfrontend**, script-tag posture. `status.match.conditional`, condition printed:
   "no host action while the boundary contract holds; contract-changing updates require the
   customer to install a regenerated shell" (`deployment.host-rebuild-required` = c) plus
   "script-tag posture only" (`migration.host.min-level` = c). Rule 1 of
   `engine.rule.candidate-order` puts it second: viable outranks conditional, and the
   condition bites on precisely the requirement this fixture makes non-negotiable, that
   vendor updates reach every customer site with no customer action. Violated preferences:
   `constraint.seamless-ux` (`ux.natural-layout-flow` = n, though `ux.host-overlay-protocol`
   = y ships the seam program) and `constraint.no-strategy-runtime`
   (`runtime.shared-runtime-library` = y "every participant carries the SDK",
   `framework.version-floor-imposed` = y "tooling requires Node >= 18"; both fall on the
   vendor's own build, not on the customer's page, where
   `buildtime.host-integrates-buildless` = y). Satisfies
   `constraint.explicit-drift-surfacing` on all four atoms, the only unit in the landscape
   that does (taxonomy.md 2.10), and `constraint.paved-road` largely.

Excluded at stage 2 with origin chains: **impl.luigi**
(`constraint.host-modification-ceiling`; origin answer:question.host.negotiability +
derive.white-label-fit; cells `migration.host.min-level` = c at `migration.integration-adapter`,
`migration.host.shell-takeover-required` = c).

E11 edition stage. The two hard operability bindings are evaluated as "some operable plan
must satisfy it" (REQ-ENT-07): an edition capability, a third-party product, or in-house
build all count, so they price candidates and can eliminate only editions and operating
plans. Result:

- `impl.hyperfrontend.community` carries none of the atoms (`governance.usage-monitoring` =
  n, `governance.rbac` = n, `registry.deployable-feature` = n; the identity and commerce
  atoms have no matrix row at all, see Model finding 6).
- `impl.hyperfrontend.enterprise` carries all of them (managed identity, deployable-feature
  registry with marketplace responsibilities, the `governance.*` atoms, the embeddable admin
  surface: implementations.md 2.7), every one at `avail.announced-planned`. Per E11 and
  REQ-AVAIL-01 a capability at `avail.announced-planned` satisfies NO binding, and
  `unit.editions.commercial-tier` = c states the same at rest ("Enterprise tier is
  announced-planned only; nothing purchasable or hosted exists today").
- `question.edition.operability.managed-service-preference` is unanswered, so no commercial
  edition is selected in any case (E11 selection rule).
- The operable plan for both candidates is therefore in-house build (or third-party products
  outside the comparison set) of the credential, entitlement, and metering plane, priced in
  tradeoffs. No in-set unit ships it: `governance.usage-monitoring` has no y anywhere in the
  matrix (bit, piral, zephyr-cloud conditional), and `registry.deployable-feature` = y only
  for entando, opencomponents, piral, and zephyr-cloud, every one of which sits in a family
  eliminated at 4.6.

E12 availability lens (`engine.rule.availability-lens`: annotations only, never a fit
change, never a re-ordering within a status):

| Candidate | Availability (independent factor) | Notable lens facts |
|---|---|---|
| iframe-composition | n/a (browser primitive; `unit.availability.stable-line-shipped` = na, "evergreen browsers") | `migration.permanent-viability` = y; `unit.editions.commercial-tier` = n; active engine investment 2024 to 2026 |
| impl.hyperfrontend.community | `avail.available-immature` | `unit.availability.stable-line-shipped` = n ("0.x line throughout; breaking wire changes explicitly allowed"), which is the same fact that keeps its `deployment.host-rebuild-required` condition live rather than theoretical; `unit.maintenance.multi-maintainer` = n, `unit.maintenance.org-steward` = n, `unit.maintenance.adoption-outside-sponsor` = ?, `migration.permanent-viability` = c |
| impl.hyperfrontend.enterprise | `avail.announced-planned` | `status.match.future-potential` with REQUIRED `pairedAvailableToday` (below) |
| impl.luigi | `avail.available` | excluded on the ceiling, retained in `excludedStrategies` with the state explained |

The ordering above is decided by status (rule 1), not by the availability annotations:
REQ-AVAIL-03 holds because removing every availability fact leaves the same order.

`status.match.future-potential` record: `impl.hyperfrontend.enterprise` plausibly satisfies
`constraint.operability.consumer-credentials`, `constraint.operability.subscription-entitlement`,
`constraint.operability.usage-visibility`, and the unbindable embeddable-admin preference
through planned capabilities that do not exist today. `pairedAvailableToday` (required, never
shown alone): `family.document-embedding` via the iframe-composition practice plus an
in-house or third-party credential, entitlement, and metering plane, with
`impl.hyperfrontend.community` at `avail.available-immature` as the shipping platform-thick
alternative whose gated contract already ships at `attach.implementation`.

### 4.11 E13 `engine.step.dual-output`

- `slots.bestToday`: the 4.10 ordering, headed by iframe-composition (embed-only,
  cross-origin) at `status.match.viable`, with impl.hyperfrontend conditional second and its
  condition printed. Produced unconditionally (REQ-STATE-02).
- `slots.bestAfterTransition`: produced, because `dimension.adaptation-floor` (host facet)
  and `dimension.roster-authority` both carry a credible target differing from current (4.4).
  The second pass, with the target bindings added, names the same family, the same members,
  the same posture, and the same order: raising the customer population from three to several
  hundred and moving the level-1 host work from a vendor engineer to the customer changes no
  cell in the family-stage evaluation. `rule.dual-slot-divergence` therefore cites the two
  septet records for a divergence confined to `scope.edition`: manual key handling for three
  customers today against an issued, rotated, revocable credential plane with entitlement and
  per-seat metering for several hundred, which is where the `fit.transition-dependent`
  annotation and the future-potential record live. That annotation is gated behind
  `question.trajectory.no-transition-outcome` (4.9).

### 4.12 E14 to E16: gaps, relaxation, counterfactuals

`gapRecords`: empty. The survivor set is non-empty at both stages and no gap-trigger
constraint (`constraint.artifact-integrity`, `constraint.rsc-federation`) is bound. The
operability chain is covered by no shipping offering, and the engine has no trigger that
turns that into a record: see the guardrail 3c FAIL and Model finding 6.
`assessmentStatus` is not `status.assessment.no-current-strong-match`.

`relaxationOffers`: empty (REQ-GAP-01 not triggered). Note for E15: had the space emptied,
the offer set would be short one row, because constraints.md 6.1 has no ledger row for
`constraint.participant-self-containment`, this fixture's widest eliminator (Model
finding 7).

`counterfactuals`:

1. (source 1, ledger row for `constraint.host-modification-ceiling` maxLevel <= 1) allow host
   adoption work: at `migration.integration-adapter` (2) impl.luigi returns to
   `family.document-embedding` (its container posture cell); at level 4 and above the
   host-inversion band returns (piral, entando, commercetools-frontend). The relaxation is
   the business model, not a setting: it means dropping the least-capable customers.
   Refs: relaxation row, luigi `migration.host.min-level` cell, families.md 3.5/3.3 costs.
2. (source 1, ledger row for `constraint.fault-containment`) accept lifecycle quarantine
   instead of containment reopens `family.lifecycle-orchestration`; accept interference
   damping reopens `family.virtualized-rehosting`. Emitted with the joint block noted: both
   families are independently eliminated by `constraint.participant-self-containment`
   (`ownership.participant-unmodifiable-host` = n for every member), so neither relaxation
   readmits anything on its own. This joint block is what makes Model finding 7 load-bearing:
   the missing ledger row is the only one that could readmit a candidate, so the E16 symmetry
   duty ("at least one counterfactual per excluded family whose exclusion came from a single
   hard binding") cannot be discharged for `family.virtualized-rehosting` or
   `family.route-partition`.
3. (source 3, `question.trust.malicious-participant` answered hard) the retained candidates
   are conditioned on the cross-origin plus sandbox posture, which they already hold
   (`security.untrusted-third-party-viable` = c, `security.cross-origin-boundary` = y,
   `security.sandbox-attribute-applicable` = y, `security.per-participant-csp` = y,
   `security.capability-narrowing` = y, `isolation.storage.partition` = y for
   iframe-composition and c for hyperfrontend, `isolation.navigation.top-level-guard` = y and
   c); nothing further is eliminated, `dominance.browser-boundary-over-simulated-realm`
   activates moot, and the three `edge.warns` fire. Notably this is the one hard answer that
   costs the fixture nothing, which is why the recommendation is stable under the bank
   customer's posture.
4. (source 3, `question.ux.seam-tolerance` answered hard) `family.document-embedding` becomes
   `status.match.incompatible` (`ux.natural-layout-flow` = n), the space empties, and the
   engine emits `status.assessment.no-current-strong-match` with the relaxation "fund the
   seam engineering (`ux.host-overlay-protocol`)", never a silent downgrade. With
   `constraint.distinct-principal` also confirmed hard this is exactly
   `gap.secure-seamlessness`; without it, it is the plain seamless-ux row of the ledger.
5. (source 3, `question.impl.drift-machinery` answered hard on all four atoms)
   iframe-composition becomes `status.match.incompatible` and impl.hyperfrontend is the sole
   candidate: the outcome class flips from `trust.hfe-future` to `trust.hf-community`. The
   trace records the tension rather than resolving it: the same fixture binds
   `constraint.independent-deploy` hard, and the only unit satisfying all four drift atoms
   carries `deployment.host-rebuild-required` = c whose condition fails exactly when a
   contract-changing update ships. No unit in the landscape scores unqualified y on both, so
   a hard answer here plus the existing hard independent-deploy binding empties the space.
   Recorded as a new observed absence for market-gaps.md section 4 (Model finding 8).
6. (source 3, `question.impl.stewardship-floor`) a hard `constraint.stable-line` or
   `constraint.stewardship-durability` floor eliminates impl.hyperfrontend
   (`unit.availability.stable-line-shipped` = n, `unit.maintenance.multi-maintainer` = n,
   `unit.maintenance.org-steward` = n) and leaves the browser practice alone.
7. (source 3, `question.migration.participant-ceiling` on the vendor's own module) a stated
   ceiling below `migration.bootstrap-change` (4) eliminates impl.hyperfrontend, whose
   participant floor is level 4 ("hostee SDK glue in entry plus feature.config plus hf
   build"); the migration.md section 7 white-label prior puts the participant band at 1 to 4,
   so the fixture sits at the band edge.
8. (source 3, `question.contracts.sync-calls` answered hard) jointly unsatisfiable with the
   bound `constraint.fault-containment` (`rel.excludes`), and the units that satisfy both are
   already excluded by self-containment, so the space empties and E14 fires.
9. (source 4, credibility) the target is credible, so there is no downgrade to flip. The
   reverse counterfactual is the one worth printing: if the scale-up stalls below
   `transition.confidence.teams-committed`, `slots.bestAfterTransition` disappears, the
   operability plane stays manual at pilot scale, and the family recommendation is unchanged.
   Refs: septet records, `predicate.target-credible`.

### 4.13 E17 emission, outcome class, derivation sample

Outcome class: **`trust.hfe-future`** (report vocabulary `outcome.hfe-future-fit`), with its
mandatory pairing. Derivation chain: the architectural half of the recommendation is decided
entirely by four hard family-scope bindings and lands on vendor-neutral browser practice
inside `family.document-embedding`, which on its own would read `trust.other-oss`; the
operability half (hard consumer credentials, hard subscription entitlement, strong metering,
and the embeddable admin surface) is matched in the whole researched landscape only by
`impl.hyperfrontend.enterprise`, every atom of which is `avail.announced-planned` and
therefore satisfies nothing, producing `status.match.future-potential` with a REQUIRED
`pairedAvailableToday` naming what ships. That is the definition of `trust.hfe-future`
(scenarios README; decision-engine.md section 7). `trust.no-match` is not reached: survivor
sets are non-empty at both stages and the hard architectural set is fully satisfied by the
head candidate. `trust.no-mfe` is unreachable as the brief requires:
`derive.single-coordinated-team` never fires and every baseline is eliminated by
`constraint.independent-deploy` and `constraint.participant-self-containment`.

```text
Recommendation: family.document-embedding (embed-only, cross-origin)          [conditional]
  1. iframe-composition practice                                             [viable]
  2. impl.hyperfrontend, script-tag posture                                   [conditional]
Future potential: impl.hyperfrontend.enterprise                        [future-potential]
  paired available today: the practice above plus an in-house or third-party
  credential, entitlement, and metering plane; impl.hyperfrontend.community
  (avail.available-immature) as the shipping platform-thick alternative

Why:
+ customers integrate with one pasted snippet          (migration.host.min-level = migration.trivial-adaptation; migration.host.shell-takeover-required = n)
+ vendor updates reach every site with no customer act  (deployment.host-rebuild-required = n; ownership.deploy-schedule-ownership = y)
+ the embed survives unknown hostile host pages         (isolation.css.outbound = y; isolation.css.inbound = y; runtime.global-registration-collision = n)
+ a broken update cannot break the customer's page      (isolation.failure.post-mount-exception = y; isolation.lifecycle.reclaim = y; isolation.recovery.in-page = y)

Tradeoffs accepted:
~ seam engineering vs one-document flow                 (ux.natural-layout-flow = n; constraint.seamless-ux violated at strong)
~ drift surfacing is adopter-built on the head candidate (contracts.connect-compat-gate = n; constraint.explicit-drift-surfacing violated at strong)
~ a document boot per embed on every customer page      (performance.per-unit-document-boot = y)
~ the entitlement and metering plane is in-house        (no in-set edition ships it; REQ-ENT-07)

Derived from:
ownership.participant-unmodifiable-host -> derive.white-label-fit
  -> constraint.host-modification-ceiling(host:least-capable-supported, maxLevel=1)
  -> constraint.participant-self-containment
ownership.no-cross-deployment-control -> derive.no-cross-deploy-control
  -> constraint.independent-deploy
question.failure.containment -> "an update must never break a customer's page"
  -> constraint.fault-containment
topology.b2b-distribution -> derive.b2b-chain
  -> constraint.operability.consumer-credentials, constraint.operability.subscription-entitlement (scope.edition)
```

### 4.14 Guardrail verification (brief section 3)

| Guardrail | Result |
|---|---|
| No admissible strategy requires customers to work beyond trivial adaptation, to use a particular framework, bundler, or host architecture, or to coordinate upgrades with the vendor or each other | **PASS** at E6 and E10. Trivial adaptation: every retained configuration has `migration.host.min-level` = `migration.trivial-adaptation` and `migration.host.shell-takeover-required` = n; impl.luigi is excluded at level 2 and the host-inversion band (single-spa, piral, entando, commercetools-frontend) at levels 4 and above. No stack mandate: `framework.composition-tier-stack-mandated` = n and `buildtime.host-integrates-buildless` = y for both retained members (hyperfrontend's `framework.version-floor-imposed` = y is "tooling requires Node >= 18" on the vendor's own build, not on the customer's page). No customer coordination: `deployment.host-rebuild-required` = n for the head candidate; the second candidate is retained only with the condition "contract-changing updates require the host to install a regenerated shell" printed on it, which is the E6 `c` discipline working as designed rather than an admitted violation. |
| Entitlement, credentials, metering, and embeddable admin select editions and operating models, never families; the family choice must remain explainable with every commercial capability removed | **PASS** at `engine.rule.stage-firewall` and E6. Every `constraint.operability.*` binding is `scope.edition` and is refused outside `stage.edition`'s `mayBind`. The family survivor set is produced by exactly four hard bindings (`constraint.independent-deploy`, `constraint.host-modification-ceiling`, `constraint.participant-self-containment`, `constraint.fault-containment`) plus `constraint.single-screen-mixing`, none of them commercial, and every deciding cell in 4.6 is a `deployment.*`, `migration.host.*`, `ownership.*`, `runtime.*`, or `isolation.*` attribute. Delete every edition record, every `impl.*` record, and the whole operability block, and 4.6, 4.7 and the family half of 4.11 are byte-identical (REQ-KEYTEST-01 posture, `engine.rule.no-vendor-branching`). |
| Availability discipline, clause a: no planned capability recommended as if it exists (REQ-AVAIL-01) | **PASS** at E11. Every `impl.hyperfrontend.enterprise` atom is `avail.announced-planned` and satisfies no binding; `unit.editions.commercial-tier` = c records the same at rest; the operable plan for both hard operability bindings is in-house build, stated as a cost. |
| Availability discipline, clause b: a strong future fit paired with the best available today (REQ-AVAIL-02) | **PASS** at E12. `status.match.future-potential` on `impl.hyperfrontend.enterprise` carries a REQUIRED `pairedAvailableToday` naming the iframe-composition practice plus an in-house or third-party credential, entitlement, and metering plane, with `impl.hyperfrontend.community` (`avail.available-immature`) named as the shipping platform-thick alternative. The record is never shown alone. |
| Availability discipline, clause c: if no offering covers the full chain, produce a first-class gap record rather than lowering the bar (REQ-GAP-01, REQ-GAP-02) | **FAIL** at E14. No shipping offering covers the chain (architecture plus consumer credentials plus entitlement plus metering plus embeddable admin): the identity and commerce atoms have no matrix row, `governance.usage-monitoring` has no y anywhere, and every unit scoring `registry.deployable-feature` = y sits in a family eliminated at 4.6. The engine nevertheless emits `gapRecords: []`, because E14's only triggers are an emptied candidate space at family or implementation stage and the two named gap-trigger constraints, while E11's REQ-ENT-07 semantics make an emptied edition space structurally impossible. The bar is not lowered (the requirement is priced as in-house build and the future-potential record names the absence), but the required first-class record is not produced. See Model finding 6. |
| The open category question must surface in the trace, not be silently resolved either way | **PASS** at E2 and E17. The trace surfaces it with topology.md 2.10's Phase-6 resolution and that resolution's evidence (families.md FC-6 and FC-8, implementations.md attachment records, enterprise-layer.md `scope.edition`), which topology.md 2.10 itself declares to be how this guardrail is satisfied, and it surfaces the one pressure the resolution's "no matrix property is unique to the category" claim does not cover (Model finding 4). Wording note, not a behavioral failure: the guardrail asks for "an unresolved question" and the model now holds an evidence-backed resolution; nothing is silent either way, and the guardrail text is a fixture element that may not be edited here (REQ-ORCH-11). |
| REQ-TRUST-01 outcome class within the allowed set; `trust.no-mfe` excluded | **PASS** at E17. `trust.hfe-future` is allowed and is called canonical by the brief. `trust.no-mfe` is structurally unreachable: `derive.single-coordinated-team` cannot fire with external participants present, and all five baselines are eliminated twice over. |

### 4.15 Model findings

Eight findings, one of which (finding 6) is the guardrail 3c failure. None is patched in the
fixture (REQ-ORCH-11); each names its failing layer per REQ-ORCH-08 and its proposed model
fix.

1. **`constraint.no-strategy-runtime` has no per-side deciding-atom semantics** (layer:
   taxonomy). The brief's least-capable-host row needs "the customer's page cannot run a
   build" bound hard, and `buildtime.host-integrates-buildless` is reachable only through
   `constraint.no-strategy-runtime`, whose other two atoms
   (`runtime.shared-runtime-library`, `framework.version-floor-imposed`) describe what the
   composition imposes page-wide and on the vendor's own build. A hard binding would
   eliminate impl.hyperfrontend (`runtime.shared-runtime-library` = y,
   `framework.version-floor-imposed` = y, both vendor-side per the cells' own notes) and
   impl.luigi at pole scope, contradicting topology.md 2.8's family implication, which reads
   the constraint host-side ("every strategy that asks the customer's page to adopt a
   runtime") and keeps it at strong. The trace therefore binds it at strong, as
   `derive.white-label-fit` specifies, and carries the host-side atom through the ceiling.
   Proposed fix: add `buildtime.host-integrates-buildless` to
   `constraint.host-modification-ceiling`'s binds list (it is a host-side adoption-work atom
   and at maxLevel 1 the host demonstrably cannot run a build), or give
   `constraint.no-strategy-runtime` per-side deciding atoms in the pattern of
   `engine.rule.attribution`.
2. **`derive.no-cross-deploy-control` and `derive.unmodifiable-participant-floor` carry no
   owner guard** (layer: logic). Both fire from true premises at this boundary and both
   derive a low `constraint.participant-modification-ceiling` on
   `participant:retirement-module`, which in the white-label and b2b inversion is the
   framework user's own funded product. A naive engine reads the ceiling as a cap on
   `migration.participant.min-level` and eliminates every candidate with a floor above 2,
   including the sponsor's own implementation (floor 4), contradicting migration.md section 7's
   white-label prior (participant 1-4, host 9) and section 3's "who can pay is an ownership
   fact". The `payableBy` param exists on the binding but has no cell-level counterpart:
   `migration.participant.min-level` records a level, not which side pays it, and
   `migration.participant.thirdparty-unmodified-viable` asks the third-party question, which
   is the wrong question when the participant is the user. Proposed fix: state the owner
   guard in the two derive rules (the ceiling binds on the subject the answering party does
   not own), and give E6 a payer-aware predicate over a new
   `migration.participant.host-payable-level` attribute so `payableBy` is checkable rather
   than decorative.
3. **REQ-ENT-10 is unreachable from the question model** (layer: taxonomy).
   enterprise-layer.md section 9 defines four `admin.*` surfaces including
   `admin.embeddable-ui`, and the brief's last input cites REQ-ENT-10 explicitly, but
   enterprise-layer.md section 3's seed table contains no admin seed, so questions.md
   section 6 generates no `question.edition.operability.*` id for it and constraints.md 2.14
   induces no `constraint.operability.*`. enterprise-layer.md section 9 compounds it by
   directing the embeddable dashboard to the positioning model and "out of the neutral
   decision framework". The requirement therefore has no binding target anywhere in the
   pipeline. Proposed fix: add an `operability.admin-surface` seed binding
   `admin.embeddable-ui` and `admin.headless-api`, with the usual `scope.edition` firewall,
   and update the questions.md section 8 coverage table.
4. **topology.md 2.10's category resolution has one unverified pressure** (layer: evidence).
   The resolution rests on "no matrix property is unique to the category: every hard pressure
   binds attributes already owned by 2.6, 2.7, and 2.8". The self-service onboarding pressure
   at host-population scale binds none: `deployment.new-participant-host-change` and
   `ownership.onboarding-without-central-owner` are participant-admission atoms (a host
   admitting participants) and score y and n respectively for iframe-composition and
   hyperfrontend, which is the inverse of the b2b question (a vendor being admitted by an
   unbounded population of hosts). The resolution's conclusion still holds, since the missing
   pressure is a scale property rather than a composition boundary, but its stated evidence
   is incomplete. Proposed fix: record the inversion explicitly in topology.md 2.10 and either
   add a host-population-onboarding attribute or state that the pressure is carried entirely
   by the `host:least-capable-supported` subject rule plus `scope.edition`.
5. **`constraint.participant-self-containment`'s stated retention list reads one of its three
   atoms** (layer: interpretation codified into the constraint text). constraints.md 2.1
   names five retained units from `ownership.participant-unmodifiable-host` alone; the
   constraint's other two bound atoms remove three of them (4.6). The constraint's own prose
   also promises both directions ("neither leak styles/globals outward nor break when a
   hostile host environment leaks inward") while binding only the outbound CSS atom, so the
   inbound half is unverifiable from cells even though `isolation.css.inbound` exists as an
   attribute. Proposed fix: correct the retention list to the all-atoms result, add
   `isolation.css.inbound` to the binds list, and re-check topology.md 2.8's family
   implication against it.
6. **A landscape-wide operability absence cannot become a gap record** (layer: logic, with a
   taxonomy and an evidence contribution). This is the guardrail 3c failure. E14 fires only on
   an emptied family-stage or implementation-stage space or on the two gap-trigger
   constraints, and E11's REQ-ENT-07 rule ("edition capability, third-party product, or
   in-house build all count") makes an emptied edition space impossible by construction, so
   no hard `constraint.operability.*` binding can ever produce a `GapRecord`. constraints.md
   6.3's predicted gap set has no `scope.edition` member and market-gaps.md section 4 keeps
   the matching absences ("channel-level usage visibility", the ephemeral mediated
   backchannel) as observations precisely because "no constraint in constraints.md binds them
   hard", a premise this fixture falsifies for the identity and commerce atoms. The evidence
   half: `identity.consumer-credentials`, `identity.key-issuance`, `commerce.entitlement`, and
   `registry.marketplace` have no matrix rows at all (enterprise-layer.md section 3 records
   them as dossier-only, "promotable to rows if an elimination ever needs them"), so absence
   cannot even be cell-verified. Proposed fix: promote those four atoms to matrix rows; add an
   edition-scope gap trigger stating that when every hard `constraint.operability.*` binding
   is satisfiable only by in-house build across every surviving implementation's editions, E14
   emits a `GapRecord` (candidate id `gap.distribution-operability-chain`) with the unmet
   atoms, while `assessmentStatus` stays out of `status.assessment.no-current-strong-match`
   because the architectural half is satisfied; add the matching relaxation ledger row and a
   market-gaps classification.
7. **The relaxation ledger is not total over hard-capable family-scope constraints** (layer:
   taxonomy). constraints.md 6.1 has no row for `constraint.participant-self-containment`,
   which is `topology.white-label`'s defining hard tendency and this fixture's widest
   eliminator (five families at 4.6). E15 generates offers only from ledger rows and E16
   source 1 only from ledger rows, so the symmetry duty of decision-engine.md section 6 ("at
   least one counterfactual per excluded family whose exclusion came from a single hard
   binding") is undischargeable here for `family.virtualized-rehosting` and
   `family.route-partition`. Rows are also absent for `constraint.css-containment`,
   `constraint.main-thread-protection`, `constraint.a11y-continuity`,
   `constraint.no-host-change-per-participant`, `constraint.no-new-infra-tier`,
   `constraint.cross-boundary-soft-nav`, `constraint.bounded-exit`,
   `constraint.payload-dedup`, and `constraint.no-strategy-runtime`. Proposed fix: add the
   self-containment row (smallest meaningful relaxation: narrow the supported-host set or
   require a per-host integration contract; reopens `family.custom-element-composition` where
   a naming treaty is negotiable per host, and the shared-realm families where the host will
   adopt a runtime), and add a validator check that every `scope.family` constraint whose
   ceiling is hard has a ledger row.
8. **New observed absence: a self-updating gated contract** (layer: evidence; a candidate
   record, not a gap today). `constraint.independent-deploy` hard plus
   `constraint.explicit-drift-surfacing` hard has no occupant: the only unit satisfying all
   four drift atoms (`contracts.formal-descriptor`, `contracts.contract-versioned`,
   `contracts.connect-compat-gate`, `contracts.drift-explicit` all y for hyperfrontend,
   taxonomy.md 2.10) scores `deployment.host-rebuild-required` = c with the condition
   "contract-changing updates require the host to install a regenerated shell", and every
   unit scoring that atom an unqualified n scores all four drift atoms n. Proposed fix: record
   it in market-gaps.md section 4 as an observed absence, promotable if a fixture ever binds
   `constraint.explicit-drift-surfacing` hard alongside `constraint.independent-deploy`.

### 4.16 Regression expectations

Stable assertions any engine implementation must reproduce for this fixture:

- Outcome class `trust.hfe-future` (`outcome.hfe-future-fit`), with a
  `status.match.future-potential` record on `impl.hyperfrontend.enterprise` carrying a
  non-empty `pairedAvailableToday`. Never `trust.hf-community` on this answer set:
  impl.hyperfrontend must appear at `status.match.conditional`, ranked second, with the
  `deployment.host-rebuild-required` = c condition printed. Never `trust.no-mfe`.
- Exactly one surviving family, `family.document-embedding`, at the embed-only cross-origin
  posture.
- Eliminated families with their rule ids: the five baselines by
  `constraint.independent-deploy` (`deployment.host-rebuild-required` = y) and
  `constraint.participant-self-containment`; `family.route-partition` by
  `constraint.participant-self-containment` (`ownership.participant-unmodifiable-host` = na
  or n) and `constraint.single-screen-mixing`; `family.virtualized-rehosting` and
  `family.module-graph-federation` by `constraint.participant-self-containment` (with
  fault-containment as co-origin on the latter); `family.lifecycle-orchestration` by
  `constraint.host-modification-ceiling`, `constraint.participant-self-containment`, and
  `constraint.fault-containment`; `family.custom-element-composition` and
  `family.server-fragment-assembly` by `constraint.participant-self-containment` and
  `constraint.fault-containment`.
- Stage-2 exclusion of `impl.luigi` by `constraint.host-modification-ceiling` with origin
  `derive.white-label-fit` and the `migration.host.min-level` = `migration.integration-adapter`
  cell; never by a trust or isolation binding.
- `constraint.distinct-principal` stays `prior-unconfirmed` and eliminates nothing;
  `question.trust.malicious-participant` is the argmax next question; a hard answer to it
  eliminates nothing that survives.
- `constraint.operability.*` bindings never appear in any family-scope exclusion. Removing
  every `impl.*` and edition record leaves 4.6, 4.7 and the family half of the slots
  unchanged.
- `slots.bestAfterTransition` is produced (credible target, `transition.confidence.transitioning`
  ordinal 6 with all four buy-in signals) and names the same family, members, posture, and
  order as `slots.bestToday`; the divergence `rule.dual-slot-divergence` cites is confined to
  `scope.edition`.
- Key counterfactuals: raising the customer-side ceiling to `migration.integration-adapter`
  readmits impl.luigi; a hard `question.ux.seam-tolerance` answer empties the space and
  yields a gap plus the seam-engineering relaxation, never a silent downgrade; a hard
  `question.impl.drift-machinery` answer eliminates the iframe practice and flips the outcome
  to `trust.hf-community`; a hard stewardship or stable-line floor eliminates
  impl.hyperfrontend.
- Guardrail 3c stays FAIL until an edition-scope gap trigger exists (Model finding 6). A
  re-trace that reports it PASS without that model change has patched the fixture.
