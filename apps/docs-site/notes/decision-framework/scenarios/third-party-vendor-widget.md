# Scenario: third-party-vendor-widget

Status: TRACED (2026-08-29).

## 1. Situation

We are a regional bank running our own online banking portal, built and released by a single
in-house web team of twenty engineers. We have signed with an outside company whose
financial-planning tool our customers keep asking for, and the contract goes live in four
months. The vendor offers exactly two ways to use their product: a hosted page at a web
address, or a script we can include; they ship updates from their own servers whenever they
choose, and feature requests take months through account management. We cannot see their
code, we will never be allowed to change it, and we have no say in when they release. Our
security office has one non-negotiable requirement: nothing the vendor ships may be able to
read our customers' session or account data beyond the specific fields we deliberately hand
over, and they will audit whatever we build. Our operations team has a second one: if the
vendor's tool breaks or slows down, the rest of the portal must keep working. Marketing would
love the tool to match our brand and feel like part of the portal, but everyone accepts that
comes second to the security requirement. This arrangement is indefinite, there is no plan
for the relationship to change, and our own team is free to build whatever plumbing is needed
on our side.

## 2. Normalized inputs

Re-normalized 2026-08-29 against the canonical ids of
[constraints.md](../model/constraints.md), [questions.md](../model/questions.md),
[topology.md](../model/topology.md), and [migration.md](../model/migration.md). Changes: each
input now names its constraint binding, class, and derivation route; the operations
requirement is split into `constraint.fault-containment` and
`constraint.main-thread-protection` (the Situation names slowdown explicitly); the four-month
go-live is reclassified from hard-constraint to the governing horizon per
`engine.rule.horizon-select` (a deadline selects the horizon, it is not a constraint id);
values otherwise unchanged.

| Input | Canonical binding | Class / marking |
|---|---|---|
| Topology label | `topology.third-party-vendor` | label (informational; facts govern) |
| `ownership.external-participant` = yes | premise of `derive.external-principal` | observed fact, `state.current` |
| `ownership.host-unmodifiable-participant` = yes | premise of `derive.unmodifiable-participant-floor` | observed fact, `state.current` |
| `ownership.no-cross-deployment-control` = yes | premise of `derive.no-cross-deploy-control` | observed fact, `state.current` |
| `migration.appetite`(participant:vendor-tool) = `migration.no-modification-possible` (9) | `constraint.participant-modification-ceiling`(vendor-tool, maxLevel=`migration.integration-adapter`, payableBy=host) via `derive.unmodifiable-participant-floor` | `class.hard-constraint` (entailed) |
| Integration surface limited to what the vendor exposes (hosted URL or script tag) | satisfies the admission condition of migration.md section 7 (third-party row): the vendor already ships an embeddable surface, so the level-1 serving condition holds without asking the vendor for anything | observed fact |
| `migration.appetite`, host side, up to `migration.moderate-refactor` (5) | `constraint.host-modification-ceiling`(host, maxLevel=5) via `question.migration.host-ceiling` | `class.hard-constraint` (stated ceiling, migration.md section 5) |
| Vendor code must not read session/account data beyond deliberately granted fields; auditable | `constraint.distinct-principal` via `question.trust.malicious-participant` (confirms `derive.external-principal`) | `class.hard-constraint` |
| Vendor failure or slowdown must not break the rest of the portal | `constraint.fault-containment` + `constraint.main-thread-protection` via `question.failure.containment` and its follow-up | `class.hard-constraint` |
| Vendor's independent deploys must not break the portal | `constraint.independent-deploy` via `derive.no-cross-deploy-control` | `class.hard-constraint` (entailed) |
| Go-live in four months | `engine.rule.horizon-select`: governing horizon `migration.horizon.first-integration`; echoed as a report risk line | horizon selection, not a constraint |
| Brand-matched, native-feeling presentation, subordinate to security | `constraint.seamless-ux` via `question.ux.seam-tolerance` | `class.strong-preference` (never eliminates; REQ-Q-02) |

State septet: `state.target` equals `state.current` on every dimension (the arrangement is
indefinite); all transition fields `not-applicable` per
[state-transition.md](../model/state-transition.md) section 2. This scenario exercises pure
current-state fit (`rule.conway-default` only; `predicate.target-credible` is never
consulted).

## 3. Guardrail expectations

Sanity checks only; no predicted winner.

- Nothing may require the vendor to change, adopt, or coordinate anything; admissible
  integration work is host-side only, at `migration.integration-adapter` depth or below
  ([migration.md](../model/migration.md) sections 2 and 3).
- A strategy whose security story reduces to convention or vendor good behavior does not
  satisfy the security hard constraint; the trace must name the boundary it relies on and
  must never convert "isolated" into "secure" without defining that boundary (REQ-MATRIX-05;
  [topology.md](../model/topology.md) section 2.6 trust notes).
- The visual-integration preference ranks and never eliminates or overrides: it cannot
  outweigh either hard constraint (REQ-Q-02), even though it directly trades against boundary
  strength.
- No transition reasoning applies: a recommendation depending on any future organizational or
  vendor change is out of bounds; `recommendation.best-after-transition` should not be
  emitted.

REQ-TRUST-01 outcome classes allowed (ids per [README.md](README.md)): `trust.hf-community`,
`trust.other-oss`, `trust.commercial`, `trust.no-match`, `trust.change-assumptions`, and
`trust.no-mfe` (a plain-iframe baseline is a fully legitimate outcome here per REQ-Q-04);
`trust.hfe-future` only under the REQ-AVAIL-02 pairing.

## 4. Trace

Hand-traced 2026-08-29 through the [decision-engine.md](../model/decision-engine.md) pipeline
(E1 to E17), with cells quoted from
[matrix-compact.tsv](../matrix/matrix-compact.tsv) and per-cell conditions from
`matrix/columns/<unit>.json` (version.research 2026.08.0). Subjects: `host` (the portal),
`participant:vendor-tool`.

### 4.1 E1 `engine.step.intake`

The section 2 table is the intake record: rank 1 fills the ownership facts; the security
office's requirement answers `question.trust.malicious-participant` at its hard level; the
operations requirement answers `question.failure.containment` hard and raises
`constraint.main-thread-protection` through its follow-up; the host ceiling answers
`question.migration.host-ceiling`; the brand preference answers `question.ux.seam-tolerance`
at `class.strong-preference` (the desirability facet ceiling caps it there regardless;
REQ-Q-02). The level-9 appetite is a fact consumed by E3 (R3 derivation-first: no rank-4
battery is spent on the vendor class). The four-month deadline selects
`migration.horizon.first-integration` and produces a report risk line only.

### 4.2 E2 `engine.step.topology-infer`

`ownership.external-participant` + `ownership.host-unmodifiable-participant` +
`ownership.no-cross-deployment-control` infer `topology.third-party-vendor` for the
host/vendor-tool boundary; `question.topology.confirm` confirmed (the label row is
informational; facts govern). Priors (constraints.md 2.15, third-party-vendor row): all four
hard tendencies arrive as explicit answers or entailed derivations in 4.3; the single
preference tendency (`constraint.seamless-ux`) is already answered, so no
`prior-unconfirmed` binding remains open.

### 4.3 E3 `engine.step.derive`

Fired:

- `derive.unmodifiable-participant-floor` (entailed; both `any` premises present:
  `ownership.host-unmodifiable-participant`=y and appetite level 9): binds
  `constraint.participant-modification-ceiling`(vendor-tool,
  maxLevel=`migration.integration-adapter`, payableBy=host) at `class.hard-constraint`.
- `derive.external-principal` (confirm mode; the confirming question is answered hard by the
  security requirement): sustains `constraint.distinct-principal`(vendor-tool) hard.
- `derive.no-cross-deploy-control` (entailed): `constraint.independent-deploy` hard; both
  far-side modification ceilings near zero (already covered by the explicit ceilings).

Not fired (premises absent): `derive.single-coordinated-team` (external participant
present), `derive.broken-governance`, `derive.plugin-admission` (participants known),
`derive.white-label-fit` (the user is the host), `derive.b2b-chain`,
`derive.legacy-untouchable`, `derive.mixed-majors-present` (no coexistence estate fact; the
vendor stack sits behind the boundary), `derive.static-estate`, `derive.seo-surface`
(authenticated banking surface), `derive.regulated-release` (the audit covers the
integration, not release/rollback obligations; `question.guard.verbatim-bytes` never armed,
and moot since no rewriting tier survives E6), `derive.many-party-drift` (two deploying
parties), `derive.payload-budget`.

### 4.4 E4 `engine.step.compose`

| Constraint | Subject | Class | Params | Slot | Origin |
|---|---|---|---|---|---|
| `constraint.distinct-principal` | participant:vendor-tool | hard | | current | answer:question.trust.malicious-participant; derive.external-principal |
| `constraint.fault-containment` | participant:vendor-tool | hard | | current | answer:question.failure.containment |
| `constraint.main-thread-protection` | participant:vendor-tool | hard | | current | answer:question.failure.containment follow-up |
| `constraint.independent-deploy` | global | hard | | current | derive.no-cross-deploy-control |
| `constraint.participant-modification-ceiling` | participant:vendor-tool | hard | maxLevel=2, payableBy=host | current | derive.unmodifiable-participant-floor |
| `constraint.host-modification-ceiling` | host | hard | maxLevel=5 | current | answer:question.migration.host-ceiling |
| `constraint.seamless-ux` | global | strong-preference | | current | answer:question.ux.seam-tolerance |

Target slot: empty. No dimension has a target differing from current;
`rule.no-target-satisfies-hard` and `rule.aspiration-warning` have nothing to act on.

### 4.5 E5 `engine.step.relations`

- `rel.requires`: `constraint.distinct-principal` (hard) presupposes
  `constraint.fault-containment` (already hard) and `constraint.css-containment` (satisfied
  by construction on the retained browser-boundary pole; families.md 3.7).
- `rel.relaxes`: `constraint.distinct-principal` re-classes
  `constraint.interference-damping` to `class.irrelevant-by-default`; its follow-ups are
  pruned.
- `edge.warns` armed (each shown at ask time as a tradeoff acknowledgment, never a live
  choice, per E5 semantics): a hard escalation of rank 10 (`gap.secure-seamlessness`), a
  hard rank 12 (`gap.untrusted-dedup`), a hard rank 15 (`rel.excludes`
  distinct-principal vs sync-calls: no unit is untrusted-viable with `contracts.sync-calls`=y).
- No gap seeds queued: no `to` side of any exclusion is bound hard.

### 4.6 E6 `engine.step.eliminate-family` (cells quoted from matrix-compact.tsv)

| Eliminated | Violated binding(s) | Deciding cells |
|---|---|---|
| `family.modular-monolith`, `family.package-composition`, `family.spa-routing`, `family.server-templates`, `family.islands` | `constraint.independent-deploy` | `deployment.host-rebuild-required` = y for modular-monolith, monorepo-package-composition, plain-spa-routing, server-rendered-templates, islands-architecture, bit (commercetools-frontend c fails the need); families.md section 5 |
| `family.module-graph-federation` | `constraint.distinct-principal`; also ceiling (floor 3 > 2) and `constraint.fault-containment` | `security.untrusted-third-party-viable` = n for module-federation, native-federation, import-map-architectures; `isolation.failure.post-mount-exception` = n |
| `family.lifecycle-orchestration` | `constraint.distinct-principal`; also ceiling (floor 4 > 2); quarantine is not containment | `security.untrusted-third-party-viable` = n for single-spa, piral; `isolation.lifecycle.reclaim` = n |
| `family.custom-element-composition` | `constraint.distinct-principal`, `constraint.fault-containment` | `security.untrusted-third-party-viable` = n for web-components-composition, entando; `isolation.lifecycle.reclaim` = n |
| `family.virtualized-rehosting` | `constraint.distinct-principal`: never a security boundary (families.md 3.6, REQ-MATRIX-05) | `security.untrusted-third-party-viable` = n for qiankun, micro-app-jd, wujie, web-fragments |
| `family.server-fragment-assembly` | `constraint.distinct-principal` (client side is one shared document) | `security.untrusted-third-party-viable` = n for podium, opencomponents, edge-side-composition, server-side-fragment-composition |

Every `Exclusion` record carries all violated bindings with origins
(`rule.monotone-elimination`).

Retained, per configuration (E6 cell-level semantics; `c` retains only with its condition
attached):

- `family.document-embedding`, cross-origin + sandbox, embed-only posture:
  iframe-composition practice. Cells: `security.untrusted-third-party-viable` = c (the
  posture, not the product, decides; families.md 6.3); `security.sandbox-attribute-applicable`
  y; `security.per-participant-csp` y; `security.capability-narrowing` y;
  `isolation.storage.partition` y; `isolation.navigation.top-level-guard` y; fault triple
  y/y/y; `isolation.resource.main-thread` / `isolation.process.crash` conditional
  (engine- and origin-dependent process isolation; the condition is attached, never
  promised, REQ-MATRIX-05). Migration: `migration.participant.min-level` condition
  "already-deployed apps embed unchanged; at most serving-config header changes", satisfied
  by the vendor's existing hosted-page/script offer;
  `migration.participant.thirdparty-unmodified-viable` = c with the same condition.
  Per-configuration exclusions inside the family: impl.hyperfrontend (participant floor
  `migration.bootstrap-change`, 4 > 2; `migration.participant.thirdparty-unmodified-viable`
  = n, "full participation needs SDK glue and an hf-generated shell"), impl.luigi
  (`security.untrusted-third-party-viable` = n: its trust model broadcasts host-issued
  tokens to frames).
- `family.route-partition`, page-granularity conditional:
  reverse-proxy-route-composition (`isolation.security.malicious-participant` = c), retained
  per constraints.md 2.2 with the condition that the vendor tool remains its own security
  principal behind the seam; the same unit's `security.untrusted-third-party-viable` = n
  cell ("shared origin makes the domain one trust unit") records that proxying the vendor
  under the portal origin voids the boundary: see Model finding 1. nextjs-multi-zones and
  cloudflare-workers-microfrontends excluded (`isolation.security.malicious-participant` = n).

Engine-answered guards: `constraint.installable-today` and `constraint.code-ownership`
satisfied uniformly; no question spent.

### 4.7 E7 `engine.step.rank-family`

Both survivors carry `status.match.conditional` (each survives only via c cells with named
posture conditions). `engine.rule.candidate-order`:

1. `family.route-partition` (page-granular, own-principal condition): rule 1 tie with the
   other survivor; rule 2 puts it first because it violates no bound strong preference (its
   `constraint.seamless-ux` cells are na: no co-resident region exists to seam).
2. `family.document-embedding` (cross-origin + sandbox embed-only): violates
   `constraint.seamless-ux` at strong (`ux.natural-layout-flow` = n), reported as the
   explicit tradeoff the answer already declared compromisable.

Disclosure duty: this adjacency is contingent twice over, and the report says so: a
single-screen yes at rank 3 (the common answer for an in-portal tool) eliminates
`family.route-partition` entirely (`runtime.concurrent-participants` = n), and its retention
condition is the fragile one (Model finding 1). Under the common rank-3 answer the
embed-only document boundary is the sole survivor. Fit flags for both: `fit.architectural`,
`fit.organizational`, `fit.operational` hold; `fit.transition-dependent` no.

### 4.8 E8 `engine.step.dominance`

Active: `dominance.browser-boundary-over-simulated-realm` (condition:
`constraint.distinct-principal` hard): virtualized-rehosting discrimination, the
interference-damping follow-up, and the css-containment follow-up are suppressed; disclosed
with its condition. `dominance.html-entry-at-low-ceiling` is condition-true (rank-4
maxLevel <= 2) but has no remaining effect (its dominated set is already excluded);
disclosed as active-moot. The four big path-shorteners are inactive.

### 4.9 E9 next-question and emission shape

Askable with nonzero effect: `question.granularity.single-screen` (rank 3: a yes eliminates
`family.route-partition`; unlocks the chrome follow-up), the `constraint.a11y-continuity`
facet of rank 10 (a banking portal plausibly carries a legal mandate; a hard binding would
condition the iframe recommendation on its `ux.screenreader-continuity` = c cell condition).
Suppressed: rank 15 (survivor set does not span serialized and live boundaries; its hard
form is additionally warn-flagged jointly unsatisfiable with rank 5), ranks 6/11/12
(dominance and derivation), rank 7 (no remaining elimination), trajectory battery (no
target; `question.trajectory.no-transition-outcome` not required because no
`fit.transition-dependent` output is pending). argmax: rank 3 (guaranteed 0 ties broken by
expected class: common). The fixture supplies no further answers; emission under
`rule.conditional-output` shape 2 (conditional), naming rank 3 and the a11y facet with their
overturning answers in `unresolvedQuestions.couldStillChange`.

### 4.10 E10 to E12: stage 2 and the availability lens

| Candidate | Config | Availability (independent factor) | Notes |
|---|---|---|---|
| iframe-composition (practice unit; family substance) | cross-origin + sandbox + per-participant CSP, embed-only | n/a (browser primitive; `unit.availability.stable-line-shipped` na, "evergreen browsers") | `migration.permanent-viability` y; all operational concerns (resize protocol, messaging conventions, loading/error UI) are host-built and priced in tradeoffs |
| reverse-proxy-route-composition (practice unit) | page-granular, vendor keeps own origin | n/a | conditional per 4.6; `ux.persistent-shared-chrome` = n and `ux.cross-boundary-soft-nav` = n noted as costs |

Excluded at stage 2 with origin chains: impl.hyperfrontend (ceiling; origin
derive.unmodifiable-participant-floor + `migration.participant.thirdparty-unmodified-viable`
= n), impl.luigi (distinct-principal; token-broadcast cell), impl.nextjs-multi-zones and
impl.cloudflare-workers-microfrontends (malicious-participant = n). No availability
exclusions; no `status.match.future-potential` records (no planned capability fits a need
the browser boundary does not already satisfy, so REQ-AVAIL-02 has nothing to pair).

### 4.11 E13 `engine.step.dual-output`

`slots.bestToday`: the 4.7 ordering with its contingency disclosure. 
`slots.bestAfterTransition`: not produced; no dimension has a credible or aspirational
target differing from current. No transition reasoning appears anywhere in the output
(guardrail 4).

### 4.12 E14 to E16: gaps, relaxation, counterfactuals

`gapRecords`: empty (survivor set non-empty; no gap-trigger constraint bound).
`relaxationOffers`: empty (REQ-GAP-01 not triggered). `counterfactuals`:

1. (source 1, ledger row for `constraint.distinct-principal`) accept accident-damping
   instead of malice containment: `family.virtualized-rehosting` returns (HTML-entry
   members micro-app-jd, wujie, web-fragments client at floors <= 2). The security
   requirement forbids it; emitted with refs so the cost of the boundary is visible.
2. (source 1, ledger row for the participant ceiling) not offerable as a real relaxation:
   level 9 is a circumstance of the vendor relationship (migration.md section 2), and every
   family the ceiling excludes is independently excluded by `constraint.distinct-principal`;
   the row is emitted with this joint block noted (satisfies the per-excluded-family
   symmetry duty together with item 1).
3. (source 3) rank 3 answered yes-hard: `family.route-partition` becomes
   `status.match.incompatible` (`runtime.concurrent-participants` = n). Rank 10 escalated
   hard: `family.document-embedding` becomes incompatible, the space empties, and the
   engine emits `gap.secure-seamlessness` with the relaxation "fund the seam engineering
   (`ux.host-overlay-protocol`)", never a silent downgrade. `constraint.a11y-continuity`
   hard: the iframe candidate is conditioned on its `ux.screenreader-continuity` = c
   per-cell condition and the audit is reported as a compliance work item.
4. (source 2) withdrawing the security requirement dissolves
   `dominance.browser-boundary-over-simulated-realm` and unlocks the suppressed
   discriminators.

### 4.13 E17 emission, outcome class, derivation sample

Outcome class: `trust.other-oss`. The strongest current candidates are vendor-neutral
browser practice; no product adoption is required, which is also the sanctioned
plain-iframe-baseline reading the brief allows under `trust.no-mfe` (REQ-Q-04). The engine
vocabulary lands on `trust.other-oss` because the surviving family is an MFE family and
`derive.single-coordinated-team` never fired (decision-engine.md section 7 rows).
impl.hyperfrontend sits in `excludedStrategies` with its origin chain and counterfactual
(REQ-MISSION-01: the sponsor's elimination is not steered around).

```text
Recommendation: family.document-embedding (cross-origin + sandbox, embed-only)  [conditional]
Recommendation: family.route-partition (page-granular, own-principal)           [conditional]

Why:
+ vendor participates unmodified                  (migration.participant.thirdparty-unmodified-viable = c, condition satisfied by the vendor's hosted-page/script offer)
+ boundary contains malice, not just accidents    (security.untrusted-third-party-viable = c at the cross-origin + sandbox posture; per-participant CSP, storage partition, navigation guard cells)
+ survives independent vendor releases            (deployment.host-rebuild-required = n; ownership.deploy-schedule-ownership = y)

Tradeoffs accepted:
~ seam engineering vs one-document flow           (ux.natural-layout-flow = n; constraint.seamless-ux violated at strong, declared compromisable)
~ process isolation engine-dependent              (isolation.process.crash = c; condition attached, never promised)

Derived from:
question.trust.malicious-participant -> "must contain malice"  (constraint.distinct-principal)
ownership.host-unmodifiable-participant -> derive.unmodifiable-participant-floor
  -> constraint.participant-modification-ceiling(vendor-tool, maxLevel=2)
ownership.no-cross-deployment-control -> derive.no-cross-deploy-control
  -> constraint.independent-deploy
```

### 4.14 Guardrail verification (brief section 3)

| Guardrail | Result |
|---|---|
| Nothing requires the vendor to change, adopt, or coordinate anything; host-side work only, at level <= 2 | PASS at E6/E10: every retained configuration is embed-only with host-paid work; the level-1 serving condition is satisfied by the vendor's existing offer, not by a request; SDK postures (impl.hyperfrontend, impl.luigi full-client) excluded per configuration |
| The security story names its boundary; "isolated" is never converted to "secure" | PASS at E6: the retained posture is named (cross-origin serving + sandbox attribute + per-participant CSP + storage partition + navigation guard, cells quoted); `family.virtualized-rehosting` eliminated explicitly as never-a-security-boundary; same-origin unsandboxed framing never credited (posture conditions carried on the candidate) |
| Visual-integration preference ranks and never eliminates or overrides | PASS at E4/E7: bound at `class.strong-preference` (facet ceiling); its only effect is rule-2 ordering and a named tradeoff; escalation to hard is warn-flagged as `gap.secure-seamlessness` (E5), never silently resolved |
| No transition reasoning; `recommendation.best-after-transition` not emitted | PASS at E4/E13: target slot empty; slot not produced; no `fit.transition-dependent` output exists |

### 4.15 Model findings

Neither finding is a guardrail failure; both were surfaced by the trace per REQ-ORCH-08 and
belong to the model, not the fixture (REQ-ORCH-11).

1. **`constraint.distinct-principal` lacks a predicate-composition rule** (layer:
   interpretation codified into taxonomy/logic). constraints.md 2.2 retains
   `family.route-partition` conditionally on the reverse-proxy
   `isolation.security.malicious-participant` = c cell, while the same unit's
   `security.untrusted-third-party-viable` cell is n; under E6's re-check-the-cells
   discipline an all-atoms reading eliminates the family and contradicts constraints.md.
   Proposed fix: give `constraint.distinct-principal` per-granularity deciding-atom
   semantics (which atoms decide at `granularity.page` vs `granularity.region`), mirroring
   `engine.rule.attribution`'s cause-resolution pattern; or re-score the reverse-proxy
   `security.untrusted-third-party-viable` cell as c conditioned on the participant keeping
   its own origin behind the seam. Until fixed, traces must carry the constraints.md 2.2
   reading with this discrepancy disclosed (as 4.6 does).
2. **Admission-condition visibility** (layer: evidence; note, no fix required).
   iframe-composition's `migration.participant.thirdparty-unmodified-viable` = c and
   migration.md section 7's sharpened third-party prior agree here only because this vendor
   already ships an embeddable surface; re-traces must check that condition rather than the
   topology label.

### 4.16 Regression expectations

Stable assertions any engine implementation must reproduce for this fixture:

- Outcome class `trust.other-oss` (browser practice heads; equivalently reportable as the
  sanctioned plain-iframe baseline). Never `trust.hf-community`: impl.hyperfrontend must
  appear in `excludedStrategies` with origin `derive.unmodifiable-participant-floor` and
  the `migration.participant.thirdparty-unmodified-viable` = n cell.
- Eliminated families with rule ids: the five baselines by `constraint.independent-deploy`;
  module-graph-federation, lifecycle-orchestration, custom-element-composition,
  virtualized-rehosting, server-fragment-assembly by `constraint.distinct-principal`
  (with fault/ceiling co-origins as recorded in 4.6).
- Survivors: `family.document-embedding` (cross-origin + sandbox, embed-only;
  iframe-composition practice) conditional; `family.route-partition` page-granular
  conditional, pending rank 3 and Model finding 1's resolution.
- `dominance.browser-boundary-over-simulated-realm` active and disclosed.
- `slots.bestAfterTransition` absent; no transition-dependent output.
- Key counterfactuals: damping relaxation reopens `family.virtualized-rehosting`; a hard
  seamless-ux answer yields `gap.secure-seamlessness` plus relaxation offers, never a
  silent downgrade; a single-screen yes eliminates `family.route-partition`.
