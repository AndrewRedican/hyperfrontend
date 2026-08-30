# Market Gaps: unsatisfiable constraint combinations

Status: DERIVED v1 (2026-08-29). Deliverable of REQ-GAP-01 and REQ-GAP-02 (MASTER.md
section 9), Phase 9, cross-referenced from the deliverables register as the availability
and market-gaps artifact. Requirements served: REQ-GAP-01 (support "nothing fits" and never
lower the bar), REQ-GAP-02 (gap records as first-class objects with classification),
REQ-GAP-03 (relaxation path), REQ-AVAIL-01/02 (planned capabilities never count; pair with
what ships), REQ-TRUST-01 (`outcome.no-strong-match` must be reachable),
REQ-LEAD-01/02/03/04 (opt-in interest rules).

Research snapshot: August 2026. Every "closest candidate" and "what it misses" statement
below was verified against [../matrix/matrix-compact.tsv](../matrix/matrix-compact.tsv)
and the per-cell conditions in `../matrix/columns/<unit>.json` on 2026-08-29.

Inputs, linked and not restated: the six proven seeds and the exclusions that prove them in
[../model/constraints.md](../model/constraints.md) sections 4 and 6.3; the record shape in
[../model/schema-proposal.md](../model/schema-proposal.md) 3.20; the emitting engine steps
in [../model/decision-engine.md](../model/decision-engine.md) E14 to E16; family evidence in
[../model/families.md](../model/families.md); near-uniform guard attributes in
[../model/taxonomy.md](../model/taxonomy.md) 4.1; presentation and lead rules in
[../ux/report-design.md](../ux/report-design.md); positioning consequences in
[hyperfrontend-positioning.md](hyperfrontend-positioning.md).

A gap is a finding about the landscape, not a backlog. Nothing in this file is a
commitment, a plan, or a roadmap item, and the classification enum is deliberately closed
so it cannot be read as routing (schema-proposal.md 3.20).

---

## 1. The gap record shape (`gap.shape`)

Authority for the shape is [../model/schema-proposal.md](../model/schema-proposal.md) 3.20
(`GapRecord`). Fields, with the discipline this file adds:

| Field | Content | Discipline |
|---|---|---|
| `gapId` | Stable dotted id, `gap.<slug>` | Never reused, never renamed; a closed gap keeps its id with a closure date |
| `constraints` | The jointly-bound hard constraints, by `constraint.*` id and class | Only `class.hard-constraint` entries; a gap that dissolves at strong-preference class says so in the note rather than existing at two classes |
| `discoveredFrom` | `rel.*` relation ids, scenario fixture ids, or assessment references | Must point at something re-runnable: a relation whose `basis` cites attributes, or a traced fixture |
| `currentCandidates` | Units or configurations that come closest, possibly empty | Empty means empty; a partial holder goes here only with the exact cells it misses stated beside it |
| `unmetCapabilities` | Attribute ids and capability atoms that fail | Attribute ids from [../matrix/attributes.md](../matrix/attributes.md), never prose |
| `classification` | `gap.class.expandable`, `gap.class.better-positioned-family`, or `gap.class.inherently-contradictory` | Closed enum; the justification lives in `classificationNote` |
| `classificationNote` | Why that class, and what would change it | Where this file revises the seed's wording, the revision is stated explicitly |
| `dates` | `researchedAt`, `verifiedAt`, `lastReviewed` | All 2026-08-29 for v1; refresh cadence per [../maintenance/versioning-strategy.md](../maintenance/versioning-strategy.md) |

Two conventions this file adds on top of the schema, both reported and neither stored as a
routing flag:

- **Expansion surface** (`gap.surface.*`): analysis of who could plausibly close the gap:
  `gap.surface.community-plausible`, `gap.surface.enterprise-plausible`,
  `gap.surface.other-family`, `gap.surface.browser-primitive`, `gap.surface.none`. This is
  the REQ-GAP-02 question "could Community expand, could Enterprise, is another family
  better positioned, or is it contradictory" answered explicitly, and it is analysis only.
- **Closure test** (`gap.closes-when`): the cell change that would close the record, so
  closure is a data edit rather than an opinion (mirrors `pos.method.revisable`).

---

## 2. The six proven records

All six were predicted by the constraint model before any of them was written up
(constraints.md 6.3). Each is re-verified below against the matrix.

### 2.1 `gap.secure-seamlessness`

- **constraints**: `constraint.distinct-principal` (hard) + `constraint.seamless-ux` (hard).
- **discoveredFrom**: `rel.excludes.distinct-principal--seamless-ux` (constraints.md
  section 4, basis: "the only retained family loses `ux.natural-layout-flow`");
  scenarios/third-party-vendor-widget.md 4.12 counterfactual 3, where escalating seam
  tolerance to hard empties the space and the engine emits this record rather than
  downgrading the security requirement.
- **currentCandidates**: none satisfy both at hard class. Closest, with exactly what they
  miss: `hyperfrontend` and `iframe-composition` hold the trust side
  (`security.untrusted-third-party-viable`=c at the cross-origin plus sandbox posture) and
  fail the seam side (`ux.natural-layout-flow`=n for both, `ux.body-portal-compat` not
  applicable, `ux.cross-boundary-focus-mgmt`=n for both,
  `ux.screenreader-continuity`=? for hyperfrontend and c for iframe-composition). Every
  unit that holds `ux.natural-layout-flow`=y (22 units) scores
  `security.untrusted-third-party-viable`=n. The intersection is empty by construction, not
  by omission.
- **unmetCapabilities**: `ux.natural-layout-flow`, `ux.body-portal-compat`,
  `ux.cross-boundary-focus-mgmt`, `ux.screenreader-continuity` at the distinct-principal
  posture.
- **classification**: `gap.class.expandable`.
- **classificationNote**: the seed already called the contradiction partial, and the matrix
  agrees in a specific way. The *hard plus hard* form is contradictory under current
  browser primitives: one layout flow requires one document, a principal boundary requires
  more than one. The *engineered* form is reachable and partly occupied:
  `ux.host-overlay-protocol`=y for hyperfrontend, luigi, and piral, and
  `ux.overlay-viewport-escape`=c for hyperfrontend with the condition that contract-declared
  dialog and popup modes provide full-viewport surfaces. So an implementation can keep
  buying back seam quality (overlays, focus handoff, announced route changes) without ever
  reaching `ux.natural-layout-flow`=y. Reported to users as the difference between "this is
  impossible" and "this is an engineering program you would fund" (families.md 3.7 hard
  limitations).
- **Expansion surface**: `gap.surface.community-plausible` for further seam protocol work
  inside `family.document-embedding`; `gap.surface.browser-primitive` for the remainder,
  since only a browser mechanism combining cross-origin isolation with shared layout flow
  would close it fully.
- **gap.closes-when**: any unit scores `ux.natural-layout-flow`=y together with
  `security.untrusted-third-party-viable` at y or c.

### 2.2 `gap.untrusted-dedup`

- **constraints**: `constraint.distinct-principal` (hard) + `constraint.payload-dedup` (hard).
- **discoveredFrom**: `rel.excludes.distinct-principal--payload-dedup` (constraints.md
  section 4; instantiated verbatim as the worked example in schema-proposal.md 4.5).
- **currentCandidates**: empty. The dedup holders (`performance.shared-dependency-dedup`=y:
  bit, import-map-architectures, islands-architecture, modular-monolith, module-federation,
  monorepo-package-composition, native-federation, picard-js, piral, plain-spa-routing;
  conditional for single-spa and web-components-composition) are all `trust.cooperative`;
  the two units that reach a principal boundary both score
  `performance.shared-dependency-dedup`=n and
  `performance.duplicate-framework-same-page`=y.
- **unmetCapabilities**: `performance.shared-dependency-dedup`,
  `performance.duplicate-framework-same-page`.
- **classification**: `gap.class.inherently-contradictory`.
- **classificationNote**: deduplication means one module instance shared across
  participants, which presupposes one realm; a distinct principal is defined by not sharing
  that realm. Nothing in the current browser platform lets two principals share an
  evaluated module graph. Not a product deficiency and not an expansion candidate for
  anyone in the set.
- **Expansion surface**: `gap.surface.browser-primitive` only.
- **gap.closes-when**: a browser mechanism (a shared, integrity-verified module cache
  across origins, or a realm primitive with cross-principal instantiation) makes any unit
  score both cells; the relation is then deleted by data edit and this record closes with
  no engine change (schema-proposal.md 4.5 closing note).

### 2.3 `gap.autonomous-dedup`

- **constraints**: `constraint.independent-deploy` (hard) + `constraint.no-version-governance`
  (hard) + `constraint.payload-dedup` (hard).
- **discoveredFrom**: the three-way exclusion row in constraints.md section 4 ("dedup
  without governance exists only build-fused, which independent-deploy eliminates").
- **currentCandidates**: empty. Verified as a partition: among the ten units with
  `performance.shared-dependency-dedup`=y, those that also score
  `coordination.shared-dependency-governance`=n are exactly the build-fused baselines
  (islands-architecture, modular-monolith, monorepo-package-composition,
  plain-spa-routing), all of which score `deployment.host-rebuild-required`=y and are
  eliminated by `constraint.independent-deploy`. The remaining dedup holders
  (import-map-architectures, module-federation, native-federation, bit, piral) require
  standing governance (`coordination.shared-dependency-governance`=y), and under version
  skew their dedup silently degrades anyway
  (`performance.dedup-failure-on-version-skew`). The nearest partial is `picard-js`
  (`coordination.shared-dependency-governance`=c) which inherits other families' formats
  and therefore inherits their governance burden rather than removing it.
- **unmetCapabilities**: `performance.shared-dependency-dedup` under
  `deployment.host-rebuild-required`=n with `coordination.shared-dependency-governance`=n.
- **classification**: `gap.class.inherently-contradictory`.
- **classificationNote**: dedup is reachable at exactly two dependency-economy poles
  (`deps.negotiated`, which is governance, and `deps.single-copy-by-build`, which is
  fusion; taxonomy.md 2.7). Removing both leaves no mechanism. This is the honest answer to
  the most common request in practitioner discourse: independent deployment, no upgrade
  train, and one copy of the framework. Users asking for it are asking for something the
  landscape does not contain, and the relaxation path (section 4) is the correct response.
- **Expansion surface**: `gap.surface.none` within the current mechanism space; a
  hypothetical version-tolerant runtime sharing layer would be a new dependency-economy
  pole, not a product feature.
- **gap.closes-when**: any unit scores `performance.shared-dependency-dedup`=y with both
  `coordination.shared-dependency-governance`=n and `deployment.host-rebuild-required`=n.

### 2.4 `gap.artifact-integrity`

- **constraints**: `constraint.artifact-integrity` (hard). A gap-trigger constraint: it
  emits its record even when other candidates survive on other constraints
  (constraints.md 2.12, decision-engine.md E14).
- **discoveredFrom**: the near-uniform guard audit in taxonomy.md 4.1
  (`security.artifact-integrity-verification`: 19 No, remainder Conditional, Unknown, or
  Not applicable, no unqualified Yes anywhere); families.md 6.4 records it as a
  landscape-wide absence rather than a family property.
- **currentCandidates**: `import-map-architectures` is the only Conditional, and its
  condition is precise: "import-map integrity key pins SRI per module URL: Chrome 127+,
  Safari 18.4; Firefox support unknown". It misses universal browser support and covers
  only module URLs listed in the map. `entando`, `module-federation`, and
  `native-federation` are Unknown, and module-federation's note states there is no
  first-party mechanism and that CSP and SRI interplay with dynamic chunk URLs is
  operator-managed. `monorepo-package-composition` is Not applicable because packages enter
  through reviewed source rather than runtime ingestion, which is a different answer to a
  different question. Every runtime-composing unit including hyperfrontend scores No.
- **unmetCapabilities**: `security.artifact-integrity-verification`; adjacent atoms
  `security.delivery-intermediary-trust` and `governance.artifact-review`.
- **classification**: `gap.class.expandable`.
- **classificationNote**: a shipping browser primitive exists for one family
  (import-map integrity), and signature or digest verification before execution is
  implementable by any implementation that controls how participant code is fetched. This
  is the clearest genuine expansion area in the whole landscape and it is open to every
  vendor equally, which is why it is recorded as a landscape finding rather than a
  positioning advantage for anyone.
- **Expansion surface**: `gap.surface.community-plausible` (any runtime loader can verify a
  digest before execution), `gap.surface.enterprise-plausible` (signing keys, review, and
  revocation are governance capabilities: `governance.artifact-review`,
  `governance.policy-enforcement`), `gap.surface.browser-primitive` (SRI coverage widening
  beyond import maps).
- **gap.closes-when**: `security.artifact-integrity-verification` reaches y for any
  implementation, or the import-map condition loses its browser-support qualifier.

### 2.5 `gap.rsc-federation`

- **constraints**: `constraint.rsc-federation` (hard); gap-trigger, as above.
- **discoveredFrom**: taxonomy.md 4.1 (`ssr.rsc-federation`: no unqualified Yes anywhere);
  families.md 6.4.
- **currentCandidates**: `monorepo-package-composition` at Conditional, with the condition
  "requires an RSC-capable consumer framework; package exports then join the server tree as
  ordinary compiled modules". It misses the thing the constraint is about: the packages are
  build-fused, so nothing crosses an independently deployed boundary. `picard-js` and
  `piral` are Unknown with nothing documented. The HTML-over-HTTP families score Not
  applicable by construction (opencomponents, web-fragments, luigi, iframe-composition,
  hyperfrontend: there is no cross-boundary render tree, and RSC inside a participant's own
  document is unaffected).
- **unmetCapabilities**: `ssr.rsc-federation`, with `ssr.hydration-orchestration` and
  `ssr.dual-mode-render` as the adjacent machinery.
- **classification**: `gap.class.better-positioned-family`.
- **classificationNote**: two families already satisfy the *underlying need* by different
  means and neither is a microfrontend answer to it. `family.package-composition` gives
  real RSC composition today at the cost of independent deployment;
  `family.server-fragment-assembly` gives composed, streamed markup across independently
  deployed services without RSC semantics at all
  (`ssr.streaming-assembly`, `ssr.composed-page`). If the gap ever closes as stated, the
  plausible expander is `family.module-graph-federation`, because it is the only family
  whose boundary is the module graph the server components live in. For the
  document-boundary families the constraint is definitionally Not applicable, so a user
  binding it hard is telling the framework their boundary choice, not their rendering
  preference: the correct response is to surface that, not to search harder.
- **Expansion surface**: `gap.surface.other-family` primarily; secondarily
  `gap.surface.community-plausible` for module-graph-federation implementations.
- **gap.closes-when**: `ssr.rsc-federation` reaches y or a clean Conditional for any
  deploy-decoupled unit.

### 2.6 `gap.governed-ownerless-onboarding`

- **constraints**: `constraint.no-delivery-intermediary` (hard) +
  `constraint.no-host-change-per-participant` (hard, on the
  `ownership.onboarding-without-central-owner` atom).
- **discoveredFrom**: `rel.excludes.no-delivery-intermediary--no-host-change-per-participant`
  (constraints.md section 4, basis: "every registry unit scores
  `security.delivery-intermediary-trust`=y").
- **currentCandidates**: none hold both cleanly, and the near misses are unusually
  instructive because two units carry the trade *inside their own conditions*.
  `picard-js` scores both atoms Conditional and its two conditions are mutually exclusive:
  "discovery mode: publishing to the feed suffices" against "discovery mode routes code
  resolution through a feed service requiring execution trust; direct source URLs avoid
  intermediaries". Choosing either condition fails the other constraint.
  `import-map-architectures` is the same shape: ownerless onboarding needs a self-serve
  map-write service, and "the map author is always a full code-execution-trust
  intermediary". `luigi` scores `security.delivery-intermediary-trust`=n (participants load
  from their own URLs) but reaches ownerless onboarding only "with adopter-built config
  aggregation", which is the adopter building the missing intermediary. The clean ownerless
  units (`opencomponents`, `piral`, `zephyr-cloud`, all y) score
  `security.delivery-intermediary-trust`=y without qualification.
- **unmetCapabilities**: `ownership.onboarding-without-central-owner` with
  `security.delivery-intermediary-trust`=n; adjacent `deployment.new-participant-host-change`.
- **classification**: `gap.class.expandable`.
- **classificationNote**: this revises the seed's wording. The seed called the combination
  "inherent to registry mediation", which is true of registry mediation as currently
  realized but is not a platform limit. The trust in a registry is trust that it will not
  substitute code; that trust becomes unnecessary when the artifact is verified against a
  publisher key at load time, which is exactly `gap.artifact-integrity`. The two records
  therefore compose: closing artifact integrity converts this one from a trust problem into
  a key-distribution problem, which is ordinary governance work. Recorded as expandable with
  that dependency stated, rather than as contradictory.
- **Expansion surface**: `gap.surface.enterprise-plausible` (registries, signing, and
  admission are `layer.operating-model` capabilities for every vendor, not architecture);
  `gap.surface.community-plausible` only in combination with `gap.artifact-integrity`.
- **gap.closes-when**: any unit scores `ownership.onboarding-without-central-owner`=y with
  `security.delivery-intermediary-trust`=n, without an adopter-built component supplying the
  difference.

---

## 3. Classification summary and the anti-roadmap rule

| Gap | Classification | Expansion surface | Closest current candidate |
|---|---|---|---|
| `gap.secure-seamlessness` | expandable | community, browser primitive | hyperfrontend, iframe-composition (trust side only) |
| `gap.untrusted-dedup` | inherently contradictory | browser primitive | none |
| `gap.autonomous-dedup` | inherently contradictory | none | none |
| `gap.artifact-integrity` | expandable | community, enterprise, browser primitive | import-map-architectures (conditional, browser-version bound) |
| `gap.rsc-federation` | better positioned family | other family, community | monorepo-package-composition (build-fused, so not federation) |
| `gap.governed-ownerless-onboarding` | expandable | enterprise, community with artifact integrity | picard-js and import-map-architectures, both self-excluding per mode |

`gap.rule.not-a-roadmap`: three of the six are expandable and none of the three is
HyperFrontend-specific. The expansion surfaces are open to every implementation in the
landscape, and two of the six are closed to everyone. The framework states gaps because a
user's unsatisfiable combination is itself a finding they need (REQ-GAP-01); it does not
state them to imply a supplier. Where an expansion surface overlaps a
HyperFrontend Enterprise announcement, the availability rules of
[hyperfrontend-positioning.md](hyperfrontend-positioning.md) section 6 apply without
exception: planned satisfies nothing, and the shipping alternative is shown beside it.

---

## 4. Observed absences that are not yet gap records

Kept here so a future refresh can promote them if a hard binding ever proves them
unsatisfiable, and so nobody re-discovers them as new (REQ-ORCH-09). None of these is a
gap record today because no constraint in constraints.md binds them hard.

- **Ephemeral mediated backchannel**: no unit in the 30-column set ships server-mediated,
  ticket-referenced, TTL-bounded payload exchange (enterprise-layer.md 12.4, resolved as
  none-in-set). It is an unoccupied primitive rather than a proven gap, because no
  constraint currently eliminates a candidate for lacking it.
- **Channel-level usage visibility**: `governance.usage-monitoring` has no Yes anywhere
  (bit, piral, zephyr-cloud Conditional).
- **Channel confidentiality**: `security.channel-confidentiality` is No or Not applicable
  for 29 of 30 units and Conditional for one; taxonomy.md 4.2 deliberately keeps it a cell
  rather than a dimension, and it becomes a gap record only if a hard binding is ever
  written for it.
- **Nested host seats**: `ownership.nested-host-seat` is Unknown for 12 units, which is a
  research debt rather than a landscape absence (taxonomy.md 4.2).

---

## 5. How gaps reach the user (`gap.surfacing.*`)

Presentation authority is [../ux/report-design.md](../ux/report-design.md); the rules below
are the gap-specific obligations it depends on.

### 5.1 The no-strong-match outcome (`gap.surfacing.no-match`)

When the hard set empties a candidate space, the engine emits
`status.assessment.no-current-strong-match` plus one or more `GapRecord`s, never a lowered
bar and never a best-of-a-bad-set ranking (REQ-GAP-01, decision-engine.md E14). The report
renders it as the `outcome.no-strong-match` outcome, and the record's own fields become the
content: the jointly-bound constraints, the relations that prove the exclusion, the closest
candidates with exactly what each one misses, and the failing attribute ids. A gap-trigger
constraint (`constraint.artifact-integrity`, `constraint.rsc-federation`) emits its record
even when candidates survive on every other constraint, so a user who needs integrity
verification learns that nobody offers it rather than receiving a recommendation that
quietly ignores the requirement.

### 5.2 The relaxation duty (`gap.surfacing.relaxation`)

Every gap is emitted with an ordered relaxation path generated from the ledger in
constraints.md 6.1, filtered to rows whose constraint is actually bound hard in this
assessment (decision-engine.md E15). Order is fixed by `rule.relaxation-ordering`
(constraints.md 6.2): re-confirm preferences mistaken for hard constraints; then
organizational and governance relaxations subject to the credibility predicate; then
deployment and infrastructure acceptances; then user-experience acceptances; then
adaptation-appetite increases; and only last, a different composition boundary than the
user intended. Each offer names what it reopens and what that costs, quoted from the
reopened family's inherent-costs field, so the user relaxes with the consequences in view.
Implementation and edition-scope relaxations are offered only after every family-scope
offer. This produces `outcome.viable-with-changes` rather than a silent downgrade.

### 5.3 Interest capture, if and only if it is earned (`gap.surfacing.lead`)

Rules restated only where they bind gap handling; full set in report-design.md section 9.

- `lead.rule.result-first`: the complete result, including the gap record, the relaxation
  path, and every export, is produced and shown before any contact ask. An email address is
  never a precondition for seeing, keeping, or exporting anything (REQ-LEAD-02).
- `lead.rule.relevance-gated`: an interest prompt may appear only on an assessment that
  actually reaches `outcome.hfe-future-fit` or surfaces a gap, never as a footer on every
  result (REQ-LEAD-01). A gap classified `gap.class.inherently-contradictory` is a poor
  place for one, since nothing is being promised or planned.
- `lead.rule.no-promised-dates`: allowed copy is of the form "get updates when this becomes
  available" or "tell us whether this is a problem worth solving"; any implied schedule is
  forbidden (REQ-LEAD-01).
- `lead.rule.minimal-fields`: name, email, optional company, role, and free-text context,
  each with an inline reason (REQ-LEAD-03).
- `lead.rule.explicit-attachment`: attaching the gap record, the answers, or the
  recommendation to a submission is a separate unchecked opt-in that states exactly what
  would be sent; the default sends nothing but the form (REQ-LEAD-04). Answers, the local
  label, and the report never leave the browser otherwise (REQ-LOCAL-01/02).
- Neutrality consequence: a gap that another vendor is better placed to close must still be
  reported, with that vendor named from the matrix. `gap.artifact-integrity` and
  `gap.governed-ownerless-onboarding` are the live tests of this rule, since both name
  competitors as the closest current candidates.
