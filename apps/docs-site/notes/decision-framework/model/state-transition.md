# Current-State vs Future-State Model (Conway's Law Layer)

Status: REFINED v1 (2026-08-29, Phase 6 gate). Credibility thresholds and the buy-in
minimum subset are calibrated against the six scenario fixtures; the worked example and
dimension list are reconciled with the derived siblings. See the changelog in section 12.

Source authority: [MASTER.md](../MASTER.md) section 7 (REQ-STATE-01..12); transcript messages
[7] and [9] of the source conversation.
Related artifacts (link, do not restate): [topology.md](topology.md)
(topology catalogue), [migration.md](migration.md) (migration-appetite scale used as the unit
for `transition.cost`), [questions.md](questions.md) (question model; its section 4 adopts
the seeds below), [constraints.md](constraints.md) (section 5 binds the credibility
predicate as engine rules), [decision-engine.md](decision-engine.md) (pipeline that consumes
this model), [enterprise-layer.md](enterprise-layer.md) (edition selection referenced by
ordering step 8).

---

## 1. Purpose

The framework never recommends an architecture for the organization the user wishes they had.
It models the organization that exists, the organization the user says they want, and the
credibility of the path between them, then reasons about all three explicitly (REQ-STATE-01,
REQ-STATE-02). This document defines the data shapes and engine semantics for that layer.

Design stance (REQ-STATE-11): Conway's Law is a design input, not an inconvenience.
Architecture adapts to organizational reality unless the user demonstrates both willingness
and capacity to change that reality.

---

## 2. The per-dimension state septet (REQ-STATE-01)

For every relevant dimension the model records seven values. Stable identifiers:

| Id | Name | Meaning |
|----|------|---------|
| `state.current` | Current state | The observed value of the dimension today. A fact, with provenance per REQ-DATA-05. |
| `state.target` | Desired future state | The value the organization says it wants. An aspiration until corroborated; never silently promoted to a fact (REQ-STATE-04). |
| `transition.willingness` | Willingness to change | Whether the organization wants to pay for the change at all. Asked separately from desirability of the outcome (REQ-STATE-03). |
| `transition.cost` | Cost of change | What must be paid to move from `state.current` to `state.target`. Expressed on the migration-appetite scale in [migration.md](migration.md) for code dimensions, and in organizational terms (reorg, re-platforming, governance work) for org dimensions. |
| `transition.authority` | Authority to change | Who can actually authorize the change, and whether the people answering the questionnaire hold or have engaged that authority. |
| `transition.confidence` | Confidence the change happens | Position on the 8-level organizational-change confidence scale (section 3). |
| `transition.horizon` | Time horizon | When the target state is expected to be real. Compared against the decision horizon; a target beyond the decision horizon is treated as absent. |

Notes:

- The septet applies per dimension, not once globally: a team may be `operating-in-target`
  for deployment independence while merely `theoretically-possible` for team topology.
- Guidance [9] also names funding in its conceptual sketch; this model folds funding into the
  buy-in signal `buyin.budget` (section 4) rather than adding an eighth septet member, since
  funded-but-unwilling and willing-but-unfunded both resolve through the confidence scale and
  the signal checklist. DECIDED at the Phase 6 gate: no promotion to an eighth member
  (section 11, resolution 2).
- Which dimensions are "relevant" is owned by [taxonomy.md](taxonomy.md) (twelve derived
  dimensions, sections 2.1-2.12) together with [topology.md](topology.md) section 3
  (ownership facts). The guidance-[9] list reconciles as follows (section 11,
  resolution 3): team boundaries and ownership are the topology.md ownership checklist;
  repositories are `ownership.multi-repo`-class facts; deployment model maps to
  `dimension.integration-time` and `dimension.release-actuation`; frameworks map to
  `dimension.adaptation-floor` and `dimension.dependency-economy`; operational
  capabilities are the implementation-selection lens (taxonomy.md 4.3); governance model
  maps to `dimension.roster-authority` and `dimension.delivery-governance`.
- When `state.target` equals `state.current` (or the user declines to name a target), the
  transition fields are `not-applicable` and the dimension participates only in current-state
  fit.

Conceptual record shape (schema authority stays with
[schema-proposal.md](schema-proposal.md)):

```ts
{
  dimension: "ownership.deployment",
  state: { current: "...", target: "..." },
  transition: {
    willingness: "...",
    cost: "...",
    authority: "...",
    confidence: "transition.confidence.planned-unapproved",
    horizon: "..."
  }
}
```

---

## 3. Organizational-change confidence scale (REQ-STATE-04)

Eight ordered levels. The ordinal is part of the identity so the engine can compare; wording
may evolve, ids may not (REQ-DATA-06).

| Ordinal | Id | Meaning |
|---------|----|---------|
| 0 | `transition.confidence.impossible` | No change possible (regulatory, contractual, structural). |
| 1 | `transition.confidence.undesirable` | Change is possible but the organization does not want it. |
| 2 | `transition.confidence.theoretical` | Change is theoretically possible; nobody is pursuing it. |
| 3 | `transition.confidence.planned-unapproved` | A plan exists but has not been approved. |
| 4 | `transition.confidence.leadership-approved` | Leadership has approved the change. |
| 5 | `transition.confidence.teams-committed` | The affected teams have committed to the change. |
| 6 | `transition.confidence.transitioning` | The change is actively underway. |
| 7 | `transition.confidence.operating-in-target` | The organization already operates in the target model; `state.target` is effectively `state.current`. |

### Engine semantics: what counts as a credible target state

A dimension's target state is **credible** (eligible to drive `recommendation.best-after-transition`,
section 5) when ALL of:

1. `transition.confidence` ordinal >= 5 (`teams-committed`); OR ordinal == 4
   (`leadership-approved`) AND the buy-in checklist (section 4) meets its minimum subset.
2. `transition.authority` is held or engaged by identifiable people (not "someone would have
   to approve this").
3. `transition.horizon` falls within the decision horizon, and the recommendation survives
   the robustness probe: it remains acceptable if the transition takes roughly three times
   longer than stated (guidance [9]).

Canonical compact form (alias `predicate.target-credible`; quoted by consumers):
confidence ordinal >= 5, or 4 plus the buy-in minimum subset; authority held or engaged;
horizon inside the decision horizon surviving the 3x robustness probe.

Engine binding: [constraints.md](constraints.md) section 5 consumes this predicate as
`rule.target-credibility` (credible targets evaluate only in the
`recommendation.best-after-transition` slot and never join the current-state elimination
pass), flanked by `rule.conway-default`, `rule.no-target-satisfies-hard`,
`rule.aspiration-warning` (the section 4 downgrade rule), and
`rule.dual-slot-divergence`. Its parenthetical restatement there matches the compact form
above; verified verbatim-equivalent on 2026-08-29, no drift.

Levels 0-1: the target state is discarded for recommendation purposes; the engine records it
only so the report can explain why it was set aside. Levels 2-3: the target state is retained
as an **aspiration**; anything depending on it is emitted as a warning, never a
recommendation (section 4). Level 7: current and target coincide; no transition reasoning.

Aspirational is never equivalent to existing (REQ-STATE-04): no confidence level below 7 ever
lets a target-state value satisfy a hard constraint in current-state evaluation.

---

## 4. Buy-in signal checklist (REQ-STATE-05)

Before any change-dependent output, the engine looks for explicit signals. Each is a boolean
fact with provenance:

| Id | Signal |
|----|--------|
| `buyin.executive-sponsorship` | A named executive sponsors the change. |
| `buyin.team-agreement` | The affected teams agree, not just their leadership. |
| `buyin.ownership-defined` | Post-change ownership is defined. |
| `buyin.platform-responsibility` | Platform responsibility is assigned. |
| `buyin.budget` | The transition work is funded. |
| `buyin.timeline` | A timeline exists. |
| `buyin.staffing` | People are allocated. |
| `buyin.governance-plan` | A governance plan exists. |
| `buyin.release-process-agreement` | Release-process changes are agreed. |

Calibrated minimum subset for the level-4 credibility path (section 3; Phase 6 gate):
`buyin.budget` AND at least one of `buyin.timeline` / `buyin.staffing`.
`buyin.executive-sponsorship` is entailed at ordinal 4 (`leadership-approved` means a
named authority has approved the change), so it is corroboration there, not a separate
gate. Calibration evidence (REQ-TEST-01, all six fixtures):
legacy-angular-modernization passes the level-4 path with budget + staffing + timeline;
independent-teams-different-frameworks passes it with budget + sponsorship and staffing
scheduled; acquisition-no-rewrite fails (ordinal 3, budget absent);
b2b2c-embedded-product, coordinated-greenfield-platform, and plugin-marketplace pass on
ordinal >= 5 with the signals as corroboration. No fixture required a stricter subset,
and the earlier stricter form misclassified none of the six outcomes but double-counted
sponsorship at ordinal 4.

### Downgrade rule: absence turns recommendations into warnings

When a candidate depends on a non-credible transition, the engine does not suppress it and
does not recommend it. It emits it as a **warning-annotated conditional**, in the
`recommendation.best-after-transition` slot, with status `fit.transition-dependent`
(section 8), listing the exact missing signals. Canonical phrasing pattern (from guidance
[9]):

> This architecture aligns well with your desired future state, but it assumes teams will
> adopt independent ownership and release responsibility. Based on your answers, that
> organizational transition is not yet committed (missing: budget, timeline, staffing). A
> solution compatible with your current operating model is therefore lower risk.

The current-state recommendation is always produced regardless (REQ-STATE-02); the warning
never replaces it.

---

## 5. Dual-output recommendation shape (REQ-STATE-06)

The engine may emit two recommendation slots per assessment:

- `recommendation.best-today`: best fit for `state.current` across all dimensions. Always
  produced. This is the default posture (REQ-STATE-02).
- `recommendation.best-after-transition`: best fit assuming every **credible** target state
  (section 3) is reached. Produced only when at least one dimension has a credible target
  differing from its current state, or when a non-credible aspiration exists (in which case
  it carries the section 4 warning instead of a recommendation).

The two slots may name the same family/implementation; when they differ, the report explains
which transitions cause the divergence and cites the septet records that drive it
(REQ-REPORT-02). Emitting both is always preferable to telling users to undertake a
disruptive transformation merely to qualify for a particular tool (guidance [9]).

### Transition-architecture modeling (REQ-STATE-07)

When the two slots differ, the engine also models the path:

```text
current architecture
      v
transition architecture   (architecture.path.transition)
      v
target architecture
```

Rules:

- A transition architecture is a first-class candidate, evaluated with the same matrix
  evidence as any other; never a hand-waved "then migrate".
- A transition architecture may legitimately become permanent. The model never assumes a
  transitional solution must eventually be removed; the trajectory question
  `question.trajectory.no-transition-outcome` (section 7) tests exactly this. A candidate
  whose transition architecture is also an acceptable permanent architecture scores as
  robust; one that is only tolerable en route is flagged as fragile under transition delay.
- Direction is not assumed: isolated-to-shared and shared-to-isolated convergence are both
  legitimate paths depending on future ownership requirements (guidance [9]).

---

## 6. Adopt / operate / evolve cost triple (REQ-STATE-08)

Every strategy/implementation comparison carries three separated costs; they are never summed
into one number (REQ-Q-06):

| Id | Name | Definition |
|----|------|------------|
| `cost.adopt` | Cost to adopt now | Everything that must change before the first successful integration: code modification (on the [migration.md](migration.md) scale), infrastructure standing up, team process changes, contract work. |
| `cost.operate` | Cost to operate | Coordination, infrastructure, and governance required continuously once adopted: release coordination load, shared-dependency management, platform on-call, version-compatibility policing. |
| `cost.evolve` | Cost to evolve | Difficulty of moving from this choice toward the desired future architecture (or away from this choice entirely): lock-in, reversibility, whether the strategy is a dead end relative to `state.target`. |

`transition.cost` in the septet describes the organization-side cost of an organizational
change; the triple describes the architecture-side cost of a candidate. The engine relates
them: a candidate with low `cost.adopt` against `state.current` and low `cost.evolve` toward
a credible `state.target` dominates one that optimizes either end alone (feeds the dominance
analysis, REQ-Q-08).

---

## 7. Trajectory question seeds (REQ-STATE-09)

Direction-probing questions, phrased neutrally (constraint-describing, never
feature-advertising, REQ-Q-05). ADOPTED at the Phase 6 gate: [questions.md](questions.md)
section 4 adopts the nine ids below verbatim as the trajectory battery, adds a tenth
member `question.trajectory.bounded-exit` (binding `constraint.bounded-exit`,
constraints.md 2.6), and formalizes the future-tense fork as `question.rule.state-fork`;
[question-graph.md](question-graph.md) fixes the unlock conditions (acquisition facts
unlock `legacy-horizon` and `integration-duration`; any credible target unlocks `funding`
and `authority`; `no-transition-outcome` is mandatory before any `fit.transition-dependent`
output is emitted). Desirability and readiness are always separate questions
(REQ-STATE-03).

| Id | Seed phrasing |
|----|---------------|
| `question.trajectory.topology-stability` | Is your current team structure expected to remain stable over the period this decision covers? |
| `question.trajectory.goal-status` | Is independent team ownership an approved organizational goal, or an aspiration that has not been formally decided? |
| `question.trajectory.consolidation` | Is your organization actively consolidating technologies, intentionally allowing diversity, or neither? |
| `question.trajectory.legacy-horizon` | Is the legacy application expected to be retired, and if so, is that retirement planned and funded? |
| `question.trajectory.integration-duration` | Is the acquired or external product being integrated temporarily or indefinitely? |
| `question.trajectory.deployment-ownership-change` | Is the organization prepared to change who owns deployment of the affected applications? |
| `question.trajectory.funding` | Is there funded, scheduled work for the transition you described? |
| `question.trajectory.authority` | Who has the authority to make the organizational changes you described, and have they been involved? |
| `question.trajectory.no-transition-outcome` | If the transition you described never occurs, what should happen to this integration? |

`question.trajectory.no-transition-outcome` is the keystone (guidance [9]): a robust
recommendation should remain acceptable if the assumed transformation takes three times
longer than expected, and this question forces that check into the user's own words.

Paired desirability/readiness example (REQ-STATE-03), now canonical at rank 2 of the
question graph as `question.deploy.independence.value` / `.readiness` (questions.md 3.2):

- Desirability: "Would it be valuable if teams could deploy without coordinating with
  each other?" (can only ever set a preference: `rule.no-target-satisfies-hard`)
- Readiness: "Are the affected teams prepared and authorized to own their release
  process, including being on call for what they ship?" (a fact, checked against the
  section 4 buy-in signals)

---

## 8. Recommendation risk categories (REQ-STATE-10)

Every recommendation is classified on four independent flags; they are reported separately,
never blended into a score (REQ-Q-06, and consistent with the independent-factor rule
REQ-AVAIL-03):

| Id | Category | Question it answers |
|----|----------|---------------------|
| `fit.architectural` | Architecturally suitable | Does it satisfy the technical constraints of the systems involved? |
| `fit.organizational` | Organizationally suitable | Does it match how the organization actually owns, staffs, and governs these systems today? |
| `fit.operational` | Operationally achievable | Can this organization realistically run it (infrastructure, skills, governance capacity)? |
| `fit.transition-dependent` | Transition-dependent | Does its suitability depend on organizational or technical changes that have not yet happened? Carries the list of depended-on transitions and their confidence levels. |

Reporting pattern (guidance [9]): "Strategy A is technically preferable in your desired end
state, but currently carries high execution risk because it requires three uncommitted
organizational changes." The count and identity of uncommitted changes come directly from the
septet records, keeping the reasoning traceable (REQ-REPORT-02).

---

## 9. Conway default and decision ordering (REQ-STATE-02, REQ-STATE-11, REQ-STATE-12)

### Principles

1. Current-state fit is the default recommendation posture. The lowest-friction
   recommendation favors solutions that fit current team boundaries, ownership,
   repositories, deployment model, frameworks, operational capabilities, and governance,
   unless the user demonstrates willingness AND capacity to change them (REQ-STATE-02).
2. Never recommend restructuring an organization merely to satisfy the assumptions of a
   preferred microfrontend technology, absent strong independent justification for that
   organizational change (REQ-STATE-11). Technology must not become the reason an
   organization invents artificial team boundaries. Conversely, when the organization
   genuinely needs different ownership boundaries for business reasons, the architecture
   should reflect them.
3. Start from reality, never from a product asking how the user can reorganize to use it
   (guidance [9]; aligns with REQ-TRUST-01 neutrality).

### Decision ordering (`engine.ordering`, REQ-STATE-12)

The engine reasons in this order; it constrains the pipeline in
[decision-engine.md](decision-engine.md) (facts before constraints before candidates,
REQ-ENGINE-02):

```text
1. What system and organization exist today?          (state.current facts)
2. What constraints are genuinely immovable?          (hard constraints, REQ-Q-02)
3. What business/organizational outcomes are desired? (state.target aspirations)
4. Which changes are actually approved and achievable? (confidence scale + buy-in signals)
5. Which architectural families fit the current state?
6. Which of those also support the credible target state?
7. Which implementation satisfies the operational requirements?
8. Community/self-managed or enterprise/managed?      (edition layer, enterprise-layer.md)
9. What would cause this recommendation to change?    (counterfactuals, REQ-Q-07)
```

Steps 5 and 6 are deliberately sequenced: current-state fit filters first; credible-target
support then ranks among survivors. A family that fits only the target state can appear only
in `recommendation.best-after-transition`, subject to the section 4 downgrade rule.

---

## 10. Worked micro-example: acquisition scenario

Illustrative only; the durable fixture is
[../scenarios/acquisition-no-rewrite.md](../scenarios/acquisition-no-rewrite.md)
(REQ-TEST-01) and takes precedence for testing. Family ids below are the adopted
[families.md](families.md) ids (Phase 6); the earlier provisional names
`family.isolated-runtime-composition` and `family.shared-runtime-module-composition`
remain as aliases of `family.document-embedding` and `family.module-graph-federation`
respectively.

Situation: a SaaS company running a coordinated React platform acquires a company whose
product is an AngularJS customer portal with its own team, repo, and release pipeline.
Leadership has voiced "eventually everything on our stack". The portal must appear inside the
host product within two quarters.

### Septet records (three dimensions shown)

| Dimension | `state.current` | `state.target` | `transition.willingness` | `transition.cost` | `transition.authority` | `transition.confidence` | `transition.horizon` |
|-----------|-----------------|----------------|--------------------------|-------------------|------------------------|-------------------------|----------------------|
| Framework stack | React host + AngularJS portal | Single React stack | Moderate (stated, unfunded) | `migration.framework-migration` to `migration.rewrite` (levels 7-8, migration.md section 2) | CTO (voiced intent, no approved plan) | `planned-unapproved` (3) | "18-36 months, maybe" |
| Team topology | Acquired team intact, separate repo/release | Merge into platform org | Low among affected teams | Reorg + release-governance change | VP Eng (not engaged) | `theoretical` (2) | None stated |
| Deployment model | Independent pipelines, uncoordinated cadences | Keep independent | n/a | n/a | n/a | `operating-in-target` (7) | n/a |

### Buy-in checklist

`buyin.executive-sponsorship`: partial (verbal only). `buyin.budget`: absent.
`buyin.timeline`: absent. `buyin.staffing`: absent. Others: absent. Result: the level-4
credibility path fails; no dimension with a differing target is credible.

### Dual output

- `recommendation.best-today`: `family.document-embedding`, embedding the portal
  essentially unchanged behind the browser's document boundary (participant floor
  level 1, families.md 3.7; the acquisition topology prior binds a low
  participant-modification ceiling, framework-major coexistence, and independent deploy
  hard, constraints.md 2.15). `family.virtualized-rehosting` is the adjacent survivor
  (participant floor level 1 via its no-build members, families.md 3.6), separated by
  trust ceiling and `constraint.verbatim-participant-bytes`.
  Flags: `fit.architectural` yes, `fit.organizational` yes (matches independent ownership
  and cadences), `fit.operational` yes, `fit.transition-dependent` no.
  Cost triple: `cost.adopt` low (host-paid `migration.integration-adapter`, level 2);
  `cost.operate` moderate (contract and lifecycle upkeep across the boundary);
  `cost.evolve` low (`migration.exit.participants-standalone`=y for the family's
  members; the boundary can be dissolved incrementally if the rewrite ever completes).
- `recommendation.best-after-transition`: `family.module-graph-federation` (participant
  floor level 3, families.md 3.4) would become attractive once the portal is rewritten
  onto the platform stack and teams merge; today its floor exceeds the acquisition
  ceiling and the AngularJS side fails shared-realm framework coexistence. Emitted as a
  warning, not a recommendation: it depends on two transitions at confidence 3 and 2
  with budget, timeline, and staffing all missing (`rule.aspiration-warning`,
  constraints.md section 5); status `fit.transition-dependent`.

### Transition architecture and robustness

Path: current (separate products) -> `family.document-embedding` with minimal
modification -> optional gradual convergence -> `family.module-graph-federation`. Answer to
`question.trajectory.no-transition-outcome`: the document-embedding composition remains a
perfectly acceptable permanent architecture (REQ-STATE-07; `migration.permanent-viability`
is a matrix attribute for exactly this check), so the today-recommendation is robust even
if the rewrite never happens or takes three times longer than hoped.

### Ordering trace (abridged, per section 9)

Today's reality (1) and the immovable two-quarter embed deadline (2) filter to families
whose participant floors sit at levels 1-2 (`family.document-embedding`,
`family.virtualized-rehosting`; migration.md section 2 recalibration); the stated
React-only outcome (3) fails the approved-and-achievable test (4);
`family.document-embedding` fits current state (5) and does not foreclose the credible
portion of the target (6); implementation and edition selection (7-8) proceed in their own
artifacts; the counterfactual (9): "if the rewrite is funded, staffed, and scheduled,
re-run this assessment; `family.module-graph-federation` becomes a genuine candidate."

---

## 11. Phase-6 gate resolutions (formerly the open questions)

1. **Credibility thresholds and minimum subset: CALIBRATED.** The confidence thresholds
   of section 3 are unchanged (every fixture resolves correctly with ordinal >= 5, or 4
   plus the subset); the minimum subset is recalibrated in section 4 (sponsorship
   entailed at ordinal 4; `buyin.budget` plus one of timeline/staffing required), with
   the six-fixture evidence recorded there.
2. **`buyin.budget` promotion: DECLINED.** Funding stays a buy-in signal, not an eighth
   septet member. Evidence: all six fixtures resolve funding through the confidence
   scale plus the checklist with no ambiguity (acquisition-no-rewrite fails credibility
   on the absent budget signal alone; legacy-angular-modernization and
   independent-teams-different-frameworks pass the level-4 path on its presence), and no
   fixture produced a funded-but-unwilling or willing-but-unfunded state the
   willingness field plus the budget signal could not express. Structurally, funding is
   probed once per transition program by `question.trajectory.funding` (adopted by
   questions.md section 4); an eighth per-dimension septet member would multiply that
   question across every divergent dimension against the question-budget discipline of
   question-graph.md (REQ-Q-03) while adding no distinction the engine can act on.
3. **Dimension list: RECONCILED.** The guidance-[9] provisional list is mapped onto the
   twelve derived taxonomy.md dimensions and the topology.md ownership checklist in
   section 2 (relevance note); no septet field changed.
4. **Horizon vs report versioning (REQ-REPORT-06): DEFINED.** Every stored assessment
   records the septet's `transition.horizon` values with provenance dates; the report
   carries the earliest unexpired horizon as its reassessment date. Opening a stored
   report past that date surfaces a reassessment prompt and downgrades every credibility
   verdict that depended on the elapsed horizon to unconfirmed (the target is treated as
   absent, exactly as section 2 treats a target beyond the decision horizon) until the
   user reconfirms; `recommendation.best-today` remains valid, since it never depended
   on a transition. Storage mechanics stay with the report/engine artifacts; this file
   owns only the trigger semantics.

---

## 12. Changelog (Phase 6 gate, 2026-08-29)

- Status raised PROVISIONAL v0 to REFINED v1.
- Section 3 gained the canonical compact predicate (alias `predicate.target-credible`)
  and the constraints.md section 5 rule bindings; verified the two files state the
  predicate equivalently (no drift found, none fixed).
- Section 4's provisional minimum subset recalibrated against the six scenario fixtures
  (sponsorship entailed at ordinal 4); downgrade rule unchanged.
- Section 7 re-labeled adopted: questions.md section 4 carries the nine trajectory ids
  verbatim plus `question.trajectory.bounded-exit` and `question.rule.state-fork`; the
  paired example now cites the canonical rank-2 ids.
- Section 10 worked example re-grounded in the derived model: provisional family names
  replaced by `family.document-embedding` / `family.module-graph-federation` (old names
  kept as aliases), migration cells restated on the calibrated scale ids, and the
  conclusions re-verified against families.md 3.4/3.6/3.7, constraints.md 2.15 priors,
  and the migration.md floor recalibration (conclusions unchanged; the
  acquisition-no-rewrite fixture takes precedence for testing).
- Open questions replaced by section 11 resolutions. No ids changed or removed; the two
  provisional family names became aliases.
