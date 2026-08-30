# Organizational Topology Model

Status: REFINED v1 (2026-08-29, Phase 6 gate). Family implications, section 4 dominance
verification, and the section 5 resolutions are grounded in the comparison matrix and the
derived sibling models; see the changelog in section 6.

Source authority: [MASTER.md](../MASTER.md) section 6 (REQ-ORG-01, REQ-ORG-02, REQ-MIG-02);
transcript messages [4] ("Organizational topology matters", "Ownership topology") and [9]
("Consumer subscriptions and entitlement") of the source conversation.
Related artifacts (link, do not restate):
[migration.md](migration.md) (migration-appetite scale referenced by every "modification"
pressure below), [state-transition.md](state-transition.md) (current vs target topology,
transition credibility), [questions.md](questions.md) / [question-graph.md](question-graph.md)
(the question model and graph that own section 4's mechanics; section 4 summarizes),
[families.md](families.md) (owner of the family ids cited in every "family implications"
entry), [constraints.md](constraints.md) (hard/preference semantics per REQ-Q-02; every
elimination cited below is cell-verified there),
[../matrix/attributes.md](../matrix/attributes.md) and
[../matrix/matrix-compact.tsv](../matrix/matrix-compact.tsv) (attribute ids and cells).

---

## 1. Purpose and modeling stance

Topology captures who owns, coordinates, trusts, and deploys the applications being composed
(REQ-ORG-01). It is one of the eight concern areas of REQ-MISSION-03 and the concern area
where Conway's Law enters the model most directly (REQ-STATE-11).

Two-layer stance (keeps facts separate from derived labels per REQ-DATA-04):

1. **Ownership facts** are the atomic, observable answers of section 3 (`ownership.*`). The
   decision engine consumes these directly; they carry provenance and current/target state
   (REQ-STATE-01).
2. **Topology labels** (`topology.*`) are named clusters over those facts. They exist for
   communication, scenario fixtures (REQ-TEST-01), priors in the question graph (section 4),
   and report prose (REQ-REPORT-03). A recommendation must never depend on the label alone
   when the underlying facts contradict it; explicit answers override topology priors.

Consequently the "architectural pressures" listed per topology are **defaults**: which
properties *tend to become* hard constraints versus preferences (REQ-Q-02) when an
organization matches that topology. The engine confirms each one with a real question before
treating it as hard.

A single organization can exhibit several topologies at once (an acquisition inside a
platform + product structure that also embeds a third-party vendor widget). The model treats
topology as a per-boundary property, not a global one: each host/participant relationship in
the user's situation gets its own topology assessment.

Topology is also stateful: `state.current` and `state.target` may name different topologies
(fragmentation today, platform + product as the approved goal). The credibility of that
transition is owned by [state-transition.md](state-transition.md); this document only defines
the vocabulary both states draw from.

---

## 2. Topology catalogue (REQ-ORG-01)

Entry template: stable id; definition; ownership / coordination / trust characteristics;
architectural pressures (hard-constraint tendencies vs preference tendencies); follow-up
questions unlocked; family implications. The family implications were filled at the Phase 6
gate from the matrix and [families.md](families.md); they are stated as engine-confirmable
defaults in the section 1 sense (pressures and priors; the engine confirms before acting),
never as verdicts. No solution brands appear here by design; families are cited by id, and
member-level nuance stays in [implementations.md](implementations.md).

### 2.1 `topology.coordinated-team` : highly coordinated product team

- **Definition**: one organization, one repository (or tightly linked repos), compatible
  frameworks, synchronized releases. [4]
- **Ownership**: single team, or multiple teams behaving as one (`ownership.single-team`,
  `ownership.multi-team-single-repo`).
- **Coordination**: cheap and routine; shared dependency governance works; a coordinated
  release train is normal, not exceptional.
- **Trust**: full mutual trust; a participant failure is "our bug", not a foreign fault.
- **Pressures, hard-constraint tendencies**: essentially none created by the topology itself.
  Any hard constraints present come from other concern areas (runtime, legacy, platform).
- **Pressures, preference tendencies**: UX continuity, performance efficiency, and low
  operational complexity dominate; deployment autonomy, framework independence, and strong
  runtime isolation are at most weak preferences, and paying for them is unjustified overhead
  (REQ-THESIS-02 cuts both ways).
- **Signature consequence**: this is the topology where "do not use microfrontends" is most
  often the correct outcome (REQ-Q-04); simpler architectures (modular monolith, packages,
  monorepo, SPA routing) usually satisfy every actual constraint.
- **Follow-ups unlocked**: is the coordinated state expected to persist (trajectory question,
  REQ-STATE-09)? Is a split into independent teams an approved goal or an aspiration?
- **Family implications** (verified: constraints.md 2.15 and 3, question-graph.md 2.2):
  this topology's facts fire `derive.single-coordinated-team`, which re-classes the four
  autonomy eliminators (`constraint.independent-deploy`, `constraint.no-version-governance`,
  `constraint.framework-major-coexistence`, `constraint.runtime-roster-change`) to
  irrelevant and admits the whole baseline group (`family.modular-monolith`,
  `family.package-composition`, `family.spa-routing`, `family.server-templates`,
  `family.islands`) as first-class candidates. Once a release train is confirmed
  acceptable, `dominance.fused-baselines-over-mfe` applies (matrix:
  `performance.shared-dependency-dedup`=y and `contracts.drift-surface`=n for every
  baseline unit), and no MFE family offers any remaining advantage: the default outcome is
  a baseline, reached after two questions (REQ-Q-04). MFE families re-enter only when
  another concern area binds hard (e.g. `derive.mixed-majors-present`).

### 2.2 `topology.independent-teams` : independent product teams

- **Definition**: separate ownership and separate release cadences under common
  organizational governance. [4]
- **Ownership**: multiple teams, usually multiple repositories
  (`ownership.multi-repo`, `ownership.independent-releases`).
- **Coordination**: possible but expensive; governance can mandate contracts and shared
  platform decisions, but day-to-day release synchronization is explicitly not wanted.
- **Trust**: high on intent (same company, shared goals), deliberately decoupled on cadence.
- **Pressures, hard-constraint tendencies**: deployment autonomy (adding or updating one
  team's application must not force rebuilding or redeploying the others'); release-cadence
  independence.
- **Pressures, preference tendencies**: reduced dependency coupling (coordinated upgrades are
  possible but each one spends governance budget); framework independence is often a
  preference rather than hard (governance could standardize, at a cost); UX continuity
  usually remains a strong preference because the composed product is one brand.
- **Migration posture**: participants can typically be modified to adopt an integration
  contract; moderate positions on the [migration.md](migration.md) scale are acceptable.
- **Follow-ups unlocked**: can governance actually enforce a shared contract
  (`coordination.shared-dependency-governance`)? If not, re-test against
  `topology.fragmentation`.
- **Family implications** (verified: constraints.md 2.3, 2.15): the hard
  `constraint.independent-deploy` tendency eliminates all five baseline families
  (`deployment.host-rebuild-required`=y cells) and retains all seven MFE families; the
  topology alone discriminates no further. The engine then splits on granularity and
  governance: page-seam products collapse to `family.route-partition` under
  `dominance.route-partition-over-coresident-runtimes`; single-screen products with a
  confirmed upgrade train fit `family.module-graph-federation` or
  `family.lifecycle-orchestration` (standing `coordination.shared-dependency-governance`
  is the price, constraints.md 2.7); a failed rank-6 confirmation re-tests against
  `topology.fragmentation`; server-operating organizations with SEO surfaces reach
  `family.server-fragment-assembly` (constraints.md 2.4). Fixture:
  scenarios/independent-teams-different-frameworks.md.

### 2.3 `topology.platform-product` : platform + product teams

- **Definition**: a platform team defines and operates the contracts and host surface while
  product teams build and release independently against them. [4]
- **Ownership**: asymmetric; the platform team owns the host and the contract, product teams
  own participants (`ownership.multi-repo`, `ownership.independent-releases`).
- **Coordination**: mediated through the platform contract instead of team-to-team
  negotiation; the platform team is the chokepoint and the enabler.
- **Trust**: institutional; product teams trust the platform to stay stable, the platform
  trusts product teams to stay within the contract.
- **Pressures, hard-constraint tendencies**: a stable, versioned host contract; contract
  compatibility checking and deprecation discipline (contract governance dimension,
  REQ-ENT-09, applies in community form here, not just enterprise); participant onboarding
  without host redesign.
- **Pressures, preference tendencies**: the platform may legitimately *require* participant
  modification (lifecycle adoption, integration SDKs) because it holds the authority; so
  migration appetite is a negotiated preference, not a hard limit. Operational tooling
  (registries, promotion, rollback) becomes a strong preference as participant count grows
  (bridges to [enterprise-layer.md](enterprise-layer.md), REQ-ENT-03, without requiring it).
- **Follow-ups unlocked**: how many participants, at what growth rate? Who is on call for the
  composed whole (operational independence concern area)? Does the platform team have staffing
  authority to maintain the contract (buy-in signals, REQ-STATE-05)?
- **Family implications** (verified: constraints.md 2.15, 2.9, 2.3): the hard tendencies
  (`constraint.explicit-drift-surfacing`, `constraint.no-host-change-per-participant`)
  discriminate *within* families more than between them: they favor the registry-mediated
  and gated-contract implementations of `family.lifecycle-orchestration`,
  `family.server-fragment-assembly`, `family.document-embedding`, and
  `family.custom-element-composition` (implementation scope; taxonomy.md 2.8, 2.10). The
  platform's authority to mandate participant adoption makes the floor-4 families
  reachable (migration.md section 7 prior: first-integration level 4, matching the
  observed floor-4 cluster of taxonomy.md 2.6), which no external-facing topology can
  assume. Family selection stays driven by the granularity/trust/delivery answers; this
  topology mainly re-classes operational tooling (`constraint.instant-rollback`,
  `constraint.paved-road`) to strong preference. Fixture:
  scenarios/coordinated-greenfield-platform.md.

### 2.4 `topology.acquisition` : acquisition

- **Definition**: two companies' applications must coexist rapidly despite incompatible
  technology. [4]
- **Ownership**: an acquired company owns one application
  (`ownership.acquired-participant`); its codebase, conventions, infrastructure, and often
  its identity provider arrive as given.
- **Coordination**: minimal at integration time; the acquired team may be mid-reorg,
  demotivated, or contractually constrained; coordination capacity grows only after
  organizational convergence.
- **Trust**: organizationally "same company" but technically foreign: separate auth domains,
  separate security review histories, separate operational practices. Treat the boundary as
  semi-trusted until convergence is real.
- **Pressures, hard-constraint tendencies**: framework independence (incompatible stacks must
  coexist); coexistence of incompatible dependency versions without coordination; little or
  no modification of the acquired application before integration (low end of the
  [migration.md](migration.md) scale, `ownership.host-unmodifiable-participant` is common);
  integration must precede architectural convergence; time-to-integration is itself a
  constraint.
- **Pressures, preference tendencies**: UX continuity is desired but routinely compromised at
  first; long-term convergence may later relax the hard constraints (this is the canonical
  transition-architecture case, REQ-STATE-07: the integration architecture may be a bridge or
  may legitimately become permanent).
- **Follow-ups unlocked**: is the acquired application planned to converge, be rewritten, or
  live indefinitely (REQ-STATE-09 "legacy disappearance" and "what if the transition never
  occurs?")? Identity unification timeline (identity dimension, REQ-ENT-06)?
- **Family implications** (verified: constraints.md 2.6 bands and 3
  `derive.unmodifiable-participant-floor`): the entailed maxLevel<=2 ceiling retains, for
  the acquired participant, `family.route-partition` (floor 1),
  `family.server-fragment-assembly` (floors 1-2), embed-only
  `family.document-embedding` (floor 1), and the HTML-entry members of
  `family.virtualized-rehosting` (floor 1;
  `migration.participant.thirdparty-unmodified-viable`=y and
  `migration.participant.legacy-no-build-viable`=y cells). It eliminates
  `family.module-graph-federation` (floor 3), `family.lifecycle-orchestration` (floor 4;
  `dominance.html-entry-at-low-ceiling` also prunes the bootstrap-lineage virtualized
  member), and the baselines below level 6. Where the semi-trusted boundary escalates to
  `constraint.distinct-principal`, only `family.document-embedding` at the cross-origin
  posture remains (constraints.md 2.2). Fixture: scenarios/acquisition-no-rewrite.md.

### 2.5 `topology.legacy-modernization` : legacy modernization

- **Definition**: new functionality must coexist with an existing application whose rewrite
  may take years, and may never finish. [4]
- **Ownership**: usually one organization owning both old and new; the constraint is the
  artifact, not the org chart. Sometimes the legacy system's original team no longer exists.
- **Coordination**: the new-code team can coordinate with itself; the legacy side cannot
  absorb much change (skills, risk, test coverage, or budget forbid it).
- **Trust**: full organizational trust; low *technical* confidence in the legacy side
  (fragility, global-scope pollution, outdated dependencies).
- **Pressures, hard-constraint tendencies**: the legacy application integrates substantially
  unchanged (progressive carving, not big-bang; near the "practically no modification"
  end of [migration.md](migration.md) for the legacy participant only); old and new
  frameworks (often ancient and current versions of the *same* framework) coexist;
  protection of the new code from legacy global-scope and CSS leakage.
- **Pressures, preference tendencies**: navigation, session, and visual continuity across the
  old/new seam are strong preferences and often escalate to hard for user-facing products;
  the ability to move the boundary incrementally (strangler-style) is a strong preference;
  eventual removability of the integration layer matters (cost to evolve, REQ-STATE-08).
- **Signature asymmetry**: migration appetite is *split*: near-zero for the legacy
  participant, potentially high for the new code. The model must record appetite per
  participant, not per organization (feeds [migration.md](migration.md), REQ-MIG-01).
- **Follow-ups unlocked**: is the rewrite funded and approved or aspirational (REQ-STATE-04,
  REQ-STATE-05)? Which direction does composition run (new inside old, old inside new, or
  side by side under a shell)?
- **Family implications** (verified: constraints.md 2.6, 2.1, 2.7): the split appetite
  applies the acquisition-retained set (2.4) to the legacy participant only.
  `migration.participant.legacy-no-build-viable`=y singles out the HTML-entry members of
  `family.virtualized-rehosting` and embed-only `family.document-embedding` as the two
  families that swallow a no-build legacy application whole, while
  `family.route-partition` carries the strangler seam at page granularity
  (`migration.strangler.incremental`). The hard `constraint.css-containment` and
  `constraint.framework-major-coexistence` tendencies retain exactly
  `family.document-embedding` and `family.virtualized-rehosting`
  (`framework.same-framework-major-coexistence`=y cells) plus, vacuously,
  `family.route-partition`; shared-realm families survive only for the new-code side.
  Fixture: scenarios/legacy-angular-modernization.md.

### 2.6 `topology.third-party-vendor` : third-party vendor

- **Definition**: the consuming organization has little or no control over the participant's
  source code. [4]
- **Ownership**: an external vendor owns one application (`ownership.external-participant`,
  `ownership.host-unmodifiable-participant`, `ownership.no-cross-deployment-control`).
- **Coordination**: contractual and slow (support tickets, roadmaps), not engineering-level;
  the vendor ships on its own schedule and may change internals without notice.
- **Trust**: a genuine trust boundary. Even a well-intentioned vendor is a distinct security
  principal; its code should not be able to read host state, credentials, or DOM beyond what
  is deliberately granted, and its failures must not take the host down.
- **Pressures, hard-constraint tendencies**: zero participant modification ("practically no
  modification possible" on [migration.md](migration.md)); integration via whatever surface
  the vendor exposes (URL, script tag, published artifact); failure containment (rendering
  failure, exception propagation, resource exhaustion stay inside the boundary); a security
  boundary in the browser sense, with the distinction between "isolated" and "secure" made
  explicit per REQ-MATRIX-05; independent vendor deployment must not break the host.
- **Pressures, preference tendencies**: seamless visual integration is a preference that
  directly trades against boundary strength; cross-boundary communication richness is
  bounded by what the vendor supports.
- **Follow-ups unlocked**: what does the vendor actually expose (arbitrary URL? embeddable
  bundle? documented events)? Are vendor credentials involved (identity dimension,
  REQ-ENT-06)? Is this one vendor or a pattern of many (if many, re-test against
  `topology.plugin-ecosystem` and `topology.b2b-distribution` from the consumer side)?
- **Family implications** (verified: constraints.md 2.2; taxonomy.md 2.2): hard
  `constraint.distinct-principal` (confirmed from `derive.external-principal`) retains
  only `family.document-embedding` at the cross-origin plus sandbox posture
  (`security.untrusted-third-party-viable` and
  `isolation.security.malicious-participant` are conditional only there) and,
  conditionally, `family.route-partition` at page granularity;
  `dominance.browser-boundary-over-simulated-realm` prunes every
  `family.virtualized-rehosting` question (never a security boundary, REQ-MATRIX-05).
  The level-9 appetite further limits admission to units with
  `migration.participant.thirdparty-unmodified-viable`=y (host-side work alone; see the
  sharpened prior in migration.md section 7). Fixture:
  scenarios/third-party-vendor-widget.md.

### 2.7 `topology.plugin-ecosystem` : plugin ecosystem

- **Definition**: unknown future participants must integrate against a stable host contract.
  [4]
- **Ownership**: the host organization owns the contract and the runtime; an open-ended set
  of internal or external authors owns participants
  (`ownership.no-cross-deployment-control`, frequently `ownership.external-participant`).
- **Coordination**: one-to-many and anonymous; the host cannot negotiate with participants it
  has not met yet. All coordination is frozen into the published contract and its versioning
  policy.
- **Trust**: lowest of the internal topologies; participants may be buggy, abandoned,
  compromised, or adversarial. The host must assume hostile input at the boundary.
- **Pressures, hard-constraint tendencies**: a stable, versioned, documented host contract
  with an explicit compatibility policy (contract governance, REQ-ENT-09); participant
  addition and update at runtime without host rebuild or redeploy
  (`deployment.host-rebuild-required` must be No for the ecosystem to scale); failure
  containment per participant; a capability/permission model deciding what a plugin may see
  and do; crash and misbehavior recovery that keeps the rest of the product usable.
- **Pressures, preference tendencies**: plugin-author experience (adapter simplicity, testing
  affordances) is a strong preference because it determines ecosystem growth; per-plugin
  review/registry/rollback tooling grows from preference toward requirement with scale
  (community-level need; enterprise editions of it stay in
  [enterprise-layer.md](enterprise-layer.md), REQ-ENT-08).
- **Follow-ups unlocked**: are plugin authors inside or outside the organization (trust
  calibration)? Expected participant count? Is there a review gate before a plugin reaches
  users?
- **Family implications** (verified: constraints.md 2.3, 2.1, and 3
  `derive.plugin-admission`): hard `constraint.runtime-roster-change` retains the
  `time.runtime-live` units: `family.document-embedding` and
  `family.virtualized-rehosting` fully, the loader-based members of
  `family.module-graph-federation` and `family.lifecycle-orchestration` conditionally.
  Hard `constraint.fault-containment` then removes the shared-realm families and keeps
  `family.virtualized-rehosting` only per configuration; external plugin authors
  escalate to `constraint.distinct-principal`, leaving `family.document-embedding`
  alone. Ownerless onboarding (`ownership.onboarding-without-central-owner`) selects
  registry-mediated implementations inside surviving families (implementation scope)
  and carries the standing `gap.governed-ownerless-onboarding` warning against
  `constraint.no-delivery-intermediary` (constraints.md 6.3). Fixture:
  scenarios/plugin-marketplace.md.

### 2.8 `topology.white-label` : white-label / embedded software

- **Definition**: a product must run inside environments controlled by customers. [4]
- **Ownership**: inverted relative to 2.6: here the *user of the framework* is the
  participant. The customer owns the host page/application and its deployment; the vendor
  owns only the embedded product (`ownership.participant-unmodifiable-host`,
  `ownership.no-cross-deployment-control`).
- **Coordination**: near zero, multiplied by every customer; the vendor cannot assume any
  particular host framework, CSP, bundler, or upgrade cadence, and cannot ask thousands of
  customers to coordinate a change.
- **Trust**: bidirectionally cautious. The customer treats the embed as third-party code; the
  vendor treats every host environment as unknown and possibly hostile to its assumptions
  (aggressive global CSS, prototype pollution, ad blockers, strict CSPs).
- **Pressures, hard-constraint tendencies**: participant self-containment (no leaking styles
  or globals out, no breaking when the host leaks them in); minimal, explicitly documented
  host requirements (ideally "one tag / one URL"); the vendor must be able to update the
  embedded product without any customer action, while never breaking the embedding contract;
  theming/branding hooks (white-label means the customer's brand, so the embed must be
  configurable without forking).
- **Pressures, preference tendencies**: depth of visual and navigational integration into the
  customer's page is a per-customer preference spectrum (from clearly-bounded widget to
  indistinguishable native section); richness of host/embed communication is a preference
  bounded by what every supported host can provide.
- **Follow-ups unlocked**: how many distinct host environments? Does the embed need customer
  data or credentials at runtime (if yes, this topology usually co-occurs with
  `topology.b2b-distribution`)? What is the least capable host that must be supported?
- **Family implications** (verified: constraints.md 2.1, 2.6, and 3
  `derive.white-label-fit`): the hard host ceiling (maxLevel=1) plus
  `constraint.participant-self-containment` retains the units scoring y on
  `ownership.participant-unmodifiable-host`: in family terms,
  `family.document-embedding` (one embed URL) and `family.custom-element-composition`
  (one tag), plus the registry-served client profile of
  `family.server-fragment-assembly`. It eliminates every host-inversion implementation
  (`migration.host.shell-takeover-required`=y) and, via the strong
  `constraint.no-strategy-runtime` tendency, every strategy that asks the customer's
  page to adopt a runtime. Between the two retained families the per-customer
  depth-of-integration preference decides: the browsing-context boundary survives
  hostile host environments in both directions, while the custom element buys native
  flow at `trust.cooperative` only (families.md 3.3, 3.7). Exercised as the final hop
  of scenarios/b2b2c-embedded-product.md.

### 2.9 `topology.fragmentation` : organizational fragmentation

- **Definition**: teams technically belong to one company but cannot reliably coordinate
  releases or dependency changes. [4]
- **Ownership**: nominally shared, effectively siloed (`ownership.distrusted-cadence`,
  `ownership.uncoordinated-upgrades`; often `ownership.multi-repo` with no working
  governance).
- **Coordination**: theoretically available, practically absent; the org chart promises
  coordination the delivery system cannot cash. This is the topology users are least likely
  to self-report honestly, which is why section 3 diagnoses it from facts instead of asking
  for the label (REQ-AUD-01).
- **Trust**: interpersonal trust may be fine; *process* trust is broken. Team A cannot rely
  on team B upgrading a shared dependency, honoring a release freeze, or fixing a breaking
  change promptly.
- **Pressures, hard-constraint tendencies**: no strategy may depend on coordinated dependency
  upgrades or synchronized releases (`coordination.shared-dependency-governance` is
  unavailable as a fact, whatever policy says); tolerance of long-term version skew between
  participants; blast-radius limitation so one team's regression does not page every team.
- **Pressures, preference tendencies**: everything that reduces cross-team surface area;
  operational simplicity per team over global optimality.
- **Signature caution**: architecture can contain fragmentation but cannot cure it. If the
  user's *target* state is a healthier topology, the recommendation must follow the
  current-state-first posture and the confidence scale of
  [state-transition.md](state-transition.md) (REQ-STATE-02, REQ-STATE-04) rather than
  assuming the reorg succeeds. Never recommend restructuring the organization to satisfy a
  preferred technology (REQ-STATE-11).
- **Follow-ups unlocked**: is fragmentation acknowledged and being addressed (transition
  credibility), or denied? Which pairs of teams actually must integrate?
- **Family implications** (verified: constraints.md 2.7, 2.3, and 3
  `derive.broken-governance`): the entailed `constraint.no-version-governance`
  eliminates `family.module-graph-federation` and `family.lifecycle-orchestration`
  (every member requires standing governance:
  `coordination.shared-dependency-governance`=y cells); the hard
  `constraint.independent-deploy` tendency eliminates the baselines. What remains is
  exactly the `deps.duplicated` region (taxonomy.md 2.7): `family.route-partition`
  (the lowest cross-team surface when page seams are acceptable),
  `family.document-embedding`, per-configuration `family.virtualized-rehosting`,
  `family.server-fragment-assembly` (server estates only), and
  `family.custom-element-composition` until the blast-radius tendency binds
  `constraint.fault-containment` hard, which removes it (constraints.md 2.1).

### 2.10 `topology.b2b-distribution` : B2B / B2B2C distribution (REQ-ORG-02)

- **Definition**: features are built by a vendor, adopted by business customers, and consumed
  by those customers' own consumers; frontend functionality is *distributed as a product*
  down a chain rather than composed inside one organization. [9]
- **The chain** (from guidance [9], normalized):

  ```text
  platform vendor
      -> customer (a business adopting the platform)
      -> customer publishes a feature/plugin
      -> customer's consumers subscribe
      -> consumer receives credentials/entitlement
      -> feature is embedded into the consumer's environment
  ```

  Note the chain composes earlier topologies at each hop: vendor-to-customer resembles
  `topology.third-party-vendor` (from the customer's seat) or `topology.plugin-ecosystem`
  (from the vendor's seat), and the final hop resembles `topology.white-label`. What makes
  this a distinct tenth entry is that *commerce and identity travel with the code*: every
  boundary carries entitlement, not just integration.
- **Ownership**: three or more independent legal entities per composed page
  (`ownership.external-participant` at two removes; `ownership.no-cross-deployment-control`
  everywhere; the middle party is simultaneously participant-owner and host-owner).
- **Coordination**: contractual at every hop, engineering-level at none; upgrades,
  deprecations, and breaking changes must be governed like a public product API.
- **Trust**: layered security boundaries with different principals at each hop; consumers
  are independently authenticated, and a participant must prove entitlement, not merely
  load.
- **Credentials / entitlement / embedding characteristics** (question seeds from [9], to be
  refined into [questions.md](questions.md)): are features consumed only internally or by
  external customers; are consumers independently authenticated; are features sold as
  products or add-ons; do consumers require API keys or credentials; are entitlements
  subscription-based; do credentials need rotation/revocation; is per-customer usage
  metering required; does each consumer need an admin dashboard; must the management UI
  itself be embeddable.
- **Pressures, hard-constraint tendencies**: everything hard in 2.6 and 2.8 simultaneously;
  plus credential issuance/rotation/revocation as an integration-time concern (identity
  dimension, REQ-ENT-06); entitlement checking at feature load; version distribution across
  customers the vendor cannot force-upgrade; multi-tenant blast-radius containment.
- **Pressures, preference tendencies**: usage metering, per-customer admin, embeddable
  management surfaces (these select *editions and operating models*, not families;
  REQ-ENT-01/REQ-ENT-03 keep them out of the architectural taxonomy).
- **Category question, RESOLVED at the Phase 6 gate** (was tracked as an open
  question; guidance [9] left it to research): "**distributed frontend
  product platform**" is *not* a separate architectural or topology category; it is fully
  expressible as this topology plus the enterprise capability layer. Evidence: the
  families.md final cut found no composition boundary unique to the distribution chain
  (FC-6 tested and REJECTED the one candidate, a platform-owns-the-host family: host
  inversion and platform mediation are overlays on existing families, not boundaries;
  FC-8 dissolved the delivery-governance candidate into a layer);
  [implementations.md](implementations.md) records every commerce, identity, and
  marketplace surface at `attach.edition`/`attach.implementation`, never as a boundary;
  and no matrix property is unique to the category: every hard pressure below binds
  attributes already owned by 2.6, 2.7, and 2.8, while the entitlement atoms live in
  [enterprise-layer.md](enterprise-layer.md) at `scope.edition` (REQ-ENT-01, REQ-ENT-03).
  The phrase remains available as report prose for "b2b-distribution plus the enterprise
  overlay"; it is never a selection axis. The scenarios/b2b2c-embedded-product.md
  guardrail that expects the trace to surface this question is satisfied by citing this
  resolution.
- **Family implications** (verified: constraints.md 3 `derive.b2b-chain`, 2.2, 2.1):
  per-hop application of 2.6 (from the customer's seat), 2.7 (from the vendor's seat),
  and 2.8 (the embedding hop). The intersection of the hop-wise hard sets retains, at
  family level, only `family.document-embedding` at the cross-origin posture: the only
  family whose units score conditionally viable on
  `security.untrusted-third-party-viable` *and* y on
  `ownership.participant-unmodifiable-host` simultaneously;
  `family.custom-element-composition` survives per customer only where that customer
  waives the security boundary. Every credential, entitlement, metering, and admin
  pressure binds at `scope.edition` (`constraint.operability.*`, constraints.md 2.14)
  and never moves family selection (REQ-ENT-03). Fixture:
  scenarios/b2b2c-embedded-product.md.

---

## 3. Ownership-situation checklist (REQ-MIG-02)

The atomic facts. Each is a yes/no/conditional observation about the user's situation
(REQ-MATRIX-02 value discipline applies when these become engine data), phrased in
circumstances a non-expert can answer (REQ-AUD-01). Topology labels are inferred from
combinations; the mapping column lists the topologies each fact is *evidence for*, not a
deterministic assignment.

| Id | Situation (from [4]) | Primary topology evidence | Also consistent with |
|----|----------------------|---------------------------|----------------------|
| `ownership.single-team` | One team owns everything | `topology.coordinated-team` | `topology.legacy-modernization` (one team, old + new artifacts) |
| `ownership.multi-team-single-repo` | Multiple teams share one repository | `topology.coordinated-team` | `topology.independent-teams` (early form) |
| `ownership.multi-repo` | Multiple teams own separate repositories | `topology.independent-teams` | `topology.platform-product`, `topology.fragmentation` |
| `ownership.independent-releases` | Teams release independently | `topology.independent-teams`, `topology.platform-product` | all external topologies |
| `ownership.distrusted-cadence` | Teams do not trust each other's release cadence | `topology.fragmentation` | `topology.third-party-vendor` (trust formalized by contract) |
| `ownership.uncoordinated-upgrades` | Teams cannot coordinate dependency upgrades | `topology.fragmentation` | `topology.acquisition`, `topology.b2b-distribution` |
| `ownership.acquired-participant` | An acquired company owns one application | `topology.acquisition` | later: `topology.independent-teams` (post-convergence) |
| `ownership.external-participant` | An external vendor owns one application | `topology.third-party-vendor` | `topology.plugin-ecosystem`, `topology.b2b-distribution` |
| `ownership.host-unmodifiable-participant` | The host team cannot modify the participant | `topology.third-party-vendor`, `topology.acquisition` | `topology.legacy-modernization`, `topology.plugin-ecosystem` |
| `ownership.participant-unmodifiable-host` | The participant team cannot modify the host | `topology.white-label` | `topology.plugin-ecosystem` (author's seat), `topology.b2b-distribution` |
| `ownership.no-cross-deployment-control` | Neither party controls the other's deployment | `topology.plugin-ecosystem`, `topology.b2b-distribution` | `topology.third-party-vendor`, `topology.white-label` |

Notes:

- Ids follow the `ownership.*` convention shown in guidance [6] (which itself uses
  `ownership.external-participant` as an example of a stable identifier, REQ-DATA-06).
- The two modification facts (`ownership.host-unmodifiable-participant`,
  `ownership.participant-unmodifiable-host`) are the hinge between this model and
  [migration.md](migration.md): they set which party's migration-appetite scale position is
  even negotiable (REQ-MIG-01). Appetite is recorded per participant, not per organization
  (see 2.5).
- Every fact takes the current/target state pair of
  [state-transition.md](state-transition.md) (REQ-STATE-01): "multi-repo today, monorepo
  approved for Q3" is two answers, not one.
- Checklist combinations that match no catalogued topology are signal, not noise: record
  them as open questions rather than forcing the nearest label (same honesty rule as
  REQ-FAM-04).

---

## 4. Topology in the question graph (REQ-Q-01)

Topology is asked early because it has among the highest information gain of any concern
area: a small number of ownership facts eliminates large regions of the solution space
before any technical question is posed. Verified eliminations (each is now grounded in a
`derive.*` rule of constraints.md section 3, whose elimination set is cell-verified in
constraints.md section 2; the v0 wording was checked against those rules and held):

- `ownership.host-unmodifiable-participant` = yes eliminates every strategy that requires
  participants to adopt lifecycle hooks, change bundlers, or expose specific module formats;
  it simultaneously makes low-migration integration surfaces near-mandatory
  (`derive.unmodifiable-participant-floor`, entailed; band verification constraints.md 2.6).
- `ownership.no-cross-deployment-control` = yes eliminates strategies that couple
  integration to a shared build or a coordinated deploy
  (`derive.no-cross-deploy-control`, entailed).
- `ownership.single-team` = yes with no external participants makes "you probably do not
  need microfrontends" a live candidate outcome immediately (REQ-Q-04, REQ-TRUST-01;
  `derive.single-coordinated-team`, realized as the two-question exit of questions.md 3.2).
- `ownership.distrusted-cadence` or `ownership.uncoordinated-upgrades` = yes eliminates
  strategies whose correctness depends on synchronized dependency versions
  (`derive.broken-governance`, entailed).

Graph mechanics (details owned by [question-graph.md](question-graph.md)):

- The graph never asks "which topology are you?"; it asks the section 3 facts in plain
  circumstances and *infers* the topology (REQ-AUD-01, REQ-Q-05). The inferred label is then
  shown to the user for confirmation, which is itself a cheap high-gain question: a rejected
  inference reveals a mismodeled situation early. Realized as the
  `question.topology.confirm` node (question-graph.md 1.1).
- The inferred topology activates topology-conditional follow-ups ("Follow-ups unlocked" in
  each catalogue entry) and suppresses irrelevant branches (REQ-Q-03): acquisition unlocks
  convergence-trajectory questions; plugin ecosystem unlocks contract-stability and
  review-gate questions; B2B distribution unlocks the credentials/entitlement block, which
  in turn feeds edition selection late in the ordering (REQ-STATE-12 step 8) without ever
  influencing family selection (REQ-ENT-03).
- Topology answers are predominantly *facts about the present*, so they sit at the "what
  exists today" front of the REQ-STATE-12 decision ordering, ahead of desired outcomes and
  preference questions.
- Dominance pruning (REQ-Q-08), verified at the Phase 6 gate: the catalogue pressures
  ground the row-verified dominance rules of question-graph.md 2.2, whose ids this
  document now adopts: `dominance.fused-baselines-over-mfe` (2.1),
  `dominance.route-partition-over-coresident-runtimes` (page-seam products),
  `dominance.browser-boundary-over-simulated-realm` (the 2.6/2.10 trust pressure), and
  `dominance.fusion-subsumes-drift-and-dedup` (the train branch), plus two narrower
  rules (`dominance.static-subsumes-infra-tier`, `dominance.html-entry-at-low-ceiling`).
  The v0 guess here (a build-time-ergonomics equivalence class under zero participant
  modification plus no cross-deployment control) did not survive verification as its own
  rule: its content is covered by `derive.no-cross-deploy-control` (both ceilings
  entailed near zero, so no discriminating question is spent) together with
  `dominance.html-entry-at-low-ceiling` at implementation scope.

---

## 5. Phase-6 gate resolutions (formerly the open questions)

1. **Family implications: FILLED.** Every marker in section 2 is grounded in the matrix
   through the verification chain of constraints.md section 2 (REQ-MATRIX-01 satisfied:
   no implication rests on intuition; each entry cites its constraint sections,
   `derive.*`/`dominance.*` rule ids, and the attribute ids whose cells decide).
2. **"Distributed frontend product platform": RESOLVED** in 2.10: a topology plus the
   enterprise capability layer, not a category; no matrix property is unique to it
   (families.md FC-6/FC-8; implementations.md attachment records; enterprise-layer.md
   edition scope).
3. **Checklist-to-topology inference: VALIDATED against the fixture briefs.** Eight of
   the ten catalogue entries have a dedicated scenario
   (should-not-use-microfrontends maps to 2.1, independent-teams-different-frameworks
   to 2.2, coordinated-greenfield-platform to 2.3, acquisition-no-rewrite to 2.4,
   legacy-angular-modernization to 2.5, third-party-vendor-widget to 2.6,
   plugin-marketplace to 2.7, b2b2c-embedded-product to 2.10); each brief's normalized
   inputs use the section 3 fact ids with the topology label marked informational,
   exactly the section 1 stance. 2.8 and 2.9 are exercised inside the b2b2c and
   independent-teams fixtures rather than by dedicated briefs. Full hand traces are
   Phase 8 work (scenarios/README.md), not a Phase 6 blocker.
4. **Per-boundary topology: STAYS A MODELING CONVENTION.** It is realized by the
   `subject` field of the constraint binding record (constraints.md 1.4) and by the R1
   ownership-class batching of question-graph.md 4.2; no first-class schema object is
   needed in [schema-proposal.md](schema-proposal.md).
5. **Fragmentation severity: STAYS BOOLEAN-BY-BOUNDARY.** Severity emerges from *which*
   boundaries fail the section 3 facts (the per-boundary stance of section 1), and
   `derive.broken-governance` binds per fact-holding boundary; a scalar severity would
   add no elimination power (REQ-METHOD-01: keep the simpler model until evidence
   forces the richer one).

---

## 6. Changelog (Phase 6 gate, 2026-08-29)

- Status raised PROVISIONAL v0 to REFINED v1.
- All ten "family implications: TBD Phase 6" markers filled with matrix-verified
  defaults citing family ids, attribute ids, `derive.*`/`dominance.*` rule ids, and the
  constraints.md sections that quote the deciding cells; the document stays
  constraint-side (pressures and priors; the engine confirms).
- 2.10's open research question resolved: "distributed frontend product platform" is
  `topology.b2b-distribution` plus the enterprise capability layer, never a new
  category or family (families.md FC-6 and FC-8; implementations.md attachment records;
  enterprise-layer.md `scope.edition`).
- Section 4's illustrative eliminations re-labeled verified and tied to their
  `derive.*` rules; the v0 dominance-pruning guess replaced by the six verified
  `dominance.*` rule ids adopted from question-graph.md 2.2; the inference-confirmation
  step tied to the `question.topology.confirm` node.
- Section 5 converted from open questions to resolutions (per-boundary schema decision,
  fragmentation severity decision, fixture-based inference validation).
- No ids changed, none removed; catalogue entries and section numbering stable.
