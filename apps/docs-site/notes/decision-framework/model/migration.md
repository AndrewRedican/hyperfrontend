# Migration / Refactoring Model

Status: REFINED v1 (2026-08-29, Phase 6 gate).
This is deliverable 9 (MASTER.md section 16). The scale originated in the guidance
(transcript [4] "Migration appetite", which said "Do not assume this exact scale.
Research and refine it"); it has now been recalibrated against the recorded modification
floors of all 30 matrix units (the `migration.participant.min-level` and
`migration.host.min-level` cells of `../matrix/columns/<unit>.json`; section 2
recalibration). See the changelog in section 10. Siblings: [topology.md](topology.md) (who owns what),
[state-transition.md](state-transition.md) (when change happens and what it costs),
[constraints.md](constraints.md) (how eliminating answers behave).

---

## 1. Purpose and modeling stance

Migration appetite is the cost an organization is prepared to pay **before integration can
happen** (REQ-MIG-01). The same scale is used twice, and the distinction is load-bearing:

- **`migration.required-level`**: a fact about a *solution + participant pair*. The deepest
  modification a given strategy or implementation demands of an application before it can
  participate. Recorded per solution in Phase 2 dossiers, grounded in the matrix's atomic
  "Migration requirements" attributes ([4]: must source change, must bootstrap change, must
  the bundler change, can a third-party app participate without rebuilding, etc.). The
  transcript's example stable id `migration.source-modification-required` is one such atomic
  matrix attribute; the scale is a normalization layered over those atoms, never a
  replacement for them (REQ-MATRIX-03).
- **`migration.appetite`**: a fact about an *organization + participant pair*. The deepest
  modification the owning organization can and will accept for that application, elicited by
  the question seeds in section 7.

**Viability rule (`migration.rule.viability`)**: a candidate is viable for a participant only
if `migration.required-level` is at or below `migration.appetite` for that participant. An
answer at the floor of the scale eliminates; it never merely lowers a score (REQ-Q-02,
section 5). Appetite above the required level is not a bonus and must not inflate ranking
(REQ-Q-06): willingness to rewrite does not make a rewrite-demanding option better than one
that needs nothing.

Appetite is bounded by capability, not just willingness. An organization cannot "accept a
bundler change" on an application whose build no longer runs, whose source it lacks, or
which it has no authority to redeploy. The mechanical preconditions ladder each level
assumes is made explicit per level below; the willingness/authority/funding split itself
lives in the state septet ([state-transition.md](state-transition.md) section 2), not here.

---

## 2. The migration-appetite scale (REQ-MIG-01) : CALIBRATED (Phase 6)

Ordered levels. Each level names the deepest participant modification involved; accepting a
level implies accepting everything above it in the table (a team that accepts a bootstrap
change also accepts an adapter). The two poles are special: the top level has no existing
code to protect, the bottom level protects all of it.

| Order | Id | Mechanical definition (what must change in the participant) |
|---|---|---|
| 0 | `migration.greenfield` | Nothing exists yet; the participant is written from scratch against whatever the strategy requires. |
| 1 | `migration.trivial-adaptation` | Configuration, metadata, or packaging changes only; no application source is edited. |
| 2 | `migration.integration-adapter` | New wrapper/adapter code is added around the unchanged application; existing source is not edited. |
| 3 | `migration.bundler-change` | The application's build toolchain is changed or reconfigured at the plugin level; runtime source is untouched. |
| 4 | `migration.bootstrap-change` | The application's entry/startup code is edited (exports, lifecycle hooks, mount/unmount); the body of the app is untouched. |
| 5 | `migration.moderate-refactor` | Application internals are edited in bounded areas (routing, global state access, DOM assumptions, styling scope). |
| 6 | `migration.major-refactor` | Application structure is reorganized (module boundaries, component extraction, ownership of shared services) while the framework stays. |
| 7 | `migration.framework-migration` | The application is ported to a different UI framework or major version; business logic largely survives. |
| 8 | `migration.rewrite` | The application is reimplemented from scratch; only requirements and knowledge survive. |
| 9 | `migration.no-modification-possible` | Practically nothing may change: no source access, no build access, or no authority/capacity to alter the running artifact. |

Reading it as appetite: levels 0-8 are increasing amounts of modification the organization
will accept; level 9 is the zero-appetite floor. Reading it as requirement: a solution's
`migration.required-level` is the highest-numbered level in 1-8 it forces (a solution never
"requires" greenfield or level 9; those are circumstances, not demands). Matrix
confirmation (Phase 6): observed required floors span levels 1-7 on the participant side
and 1-8 on the host side across all 30 units; no unit demands level 0 or 9 (recalibration
subsection below).

### Per-level notes and example integration work

- **`migration.greenfield`** : No prior investment; every strategy is mechanically reachable
  and the decision is driven by the other seven concern areas (REQ-MISSION-03), especially
  topology and operational cost. Example work: writing a new remote against a host contract;
  scaffolding a plugin against a published SDK. Preconditions: none.
- **`migration.trivial-adaptation`** : Example work: adding CORS/frame-ancestors headers so
  an already-deployed app can be embedded; publishing an existing bundle to a registry;
  adding a manifest or import-map entry. Preconditions: deploy authority over the
  participant's serving infrastructure.
- **`migration.integration-adapter`** : Example work: writing a thin lifecycle wrapper that
  mounts an untouched SPA; a Web Component shim around an existing widget; a small shell
  page that boots the legacy app inside a boundary. The adapter is new code owned by the
  integrating team, which is what makes this level available even when the participant's
  owners will not act (see host-side costs, section 3). Preconditions: the artifact is
  loadable/addressable; source access not required.
- **`migration.bundler-change`** : Example work: adding a federation plugin to the
  participant's build; swapping bundlers because the required plugin only exists for one;
  emitting an additional ESM entry. Preconditions: source access, a reproducible build, and
  an owning team able to re-release.
- **`migration.bootstrap-change`** : Example work: refactoring the entry point to export
  mount/unmount lifecycle functions; deferring boot until a host signal; parameterizing the
  mount node instead of assuming `#root`. Preconditions: same as level 3 plus willingness to
  edit source.
- **`migration.moderate-refactor`** : Example work: namespacing global CSS; removing
  assumptions of exclusive ownership of `history`/URL; isolating singletons so two instances
  can coexist; adopting a shared design-token layer. Preconditions: active maintainers with
  budgeted time.
- **`migration.major-refactor`** : Example work: carving a monolith's feature area into an
  independently buildable unit; extracting shared services behind explicit contracts;
  splitting a repo. Preconditions: sustained funded effort and architectural authority.
- **`migration.framework-migration`** : Example work: AngularJS to modern-framework port
  performed *so that* the app can join a shared-runtime composition; aligning framework
  major versions across participants when the strategy cannot host both. Preconditions:
  multi-quarter funding; this is a project, not a task.
- **`migration.rewrite`** : Example work: reimplementing the participant natively inside the
  host. If the appetite genuinely reaches this level, "do not use microfrontends" and
  simpler architectures re-enter the candidate set (REQ-Q-04) and must be surfaced.
- **`migration.no-modification-possible`** : Not "work at level 9" but the absence of any:
  third-party vendor apps, abandoned-but-critical legacy, acquisitions during a code-freeze
  window. Only solutions whose `migration.required-level` is 1-2 *executed entirely on the
  host side* remain viable. This is the canonical eliminating answer (section 5).

### Phase-6 recalibration: observed floors and flag resolutions

The evidence: every one of the 30 matrix columns records `migration.participant.min-level`
and `migration.host.min-level` as conditional cells whose condition text names positions
on this scale (the two normalization rows of REQ-MATRIX-03;
[../matrix/attributes.md](../matrix/attributes.md)). Observed distribution (per-cell
conditions in `../matrix/columns/<unit>.json`; band listing in
[taxonomy.md](taxonomy.md) 2.6):

- **Participant floors**: level 1 for 9 units outright
  (cloudflare-workers-microfrontends, edge-side-composition, iframe-composition,
  micro-app-jd, nextjs-multi-zones, picard-js, reverse-proxy-route-composition,
  web-fragments, wujie) plus 3 conditional level-1 postures (the bit adoption bridge,
  luigi embed-only, import-map-architectures when the app already ships suitable ESM);
  level 2 for 4 (opencomponents, podium, server-side-fragment-composition,
  web-components-composition); level 3 for the typical cases of 3 (module-federation,
  zephyr-cloud, import-map-architectures); level 4 for 6 (entando, hyperfrontend,
  native-federation, piral, qiankun, single-spa); level 6 for the 4 build-fused
  baselines (modular-monolith, monorepo-package-composition, plain-spa-routing,
  server-rendered-templates; islands-architecture spans 1-2 for in-place tag wrapping
  vs 7 for a SPA inverting into a server-first meta-framework); level 7 for
  commercetools-frontend.
- **Host floors**: levels 1-4 across most units; level 6 (shell takeover) and level 8
  (platform-as-host rewrite) for the host-inversion band (taxonomy.md 2.6).
- **Unoccupied as floors**: levels 5 and 8 on the participant side (8 appears only on
  the host side and the islands meta-framework path); levels 0 and 9 nowhere,
  confirming they are circumstances, not demands.

Flag resolutions (the three v0 provisional flags):

1. **Levels 3/4 ordering: KEPT; no bundler-change split.** The elimination bands are
   monotone under the current order: maxLevel<3 removes exactly the floor-3 units and
   maxLevel<4 additionally removes exactly the floor-4 units (constraints.md 2.6;
   taxonomy.md 2.6 band table), and no dossier recorded a floor-3 unit whose bundler
   work exceeded a floor-4 unit's bootstrap edit as an admission cost. The
   config-vs-toolchain spread inside level 3 is real but carried per cell as conditions
   (import-map-architectures: level 3 typical, level 1 if already ESM; bit: level 1
   bridge vs level 3 env-owned build), so no sub-level ids are needed. Order and ids
   unchanged.
2. **Missing candidate levels: NONE ADDED.** Both candidates were realized as atomic
   matrix attributes rather than scale positions: deployment-architecture demands are
   `migration.participant.deployment-change-required` and tooling/dependency-policy
   demands are `buildtime.participant-tooling-required` (attributes.md migration group,
   17 attributes); they are axes that justify a level, not levels. No min-level cell
   needed a value between existing levels. Level 5 stays despite being unoccupied as a
   floor: it is a real appetite position, and
   `migration.participant.internals-refactor-required` records when a solution pushes
   into it conditionally.
3. **Monotonicity: SCALAR KEPT.** All 60 min-level cells are single scale positions;
   conditional variants name alternative single positions (postures), never
   non-comparable change-kind sets. The R1 level-probe bisection of
   question-graph.md 4.2 presupposes the ordered scalar and passed the worst-path gate.
   The regulated-artifact counter-case ("any touch triggers recertification") is
   modeled as a stated ceiling plus `constraint.verbatim-participant-bytes`
   (`derive.regulated-release`; constraints.md 2.2 and section 3), not as a change-kind
   set. Scalar retained per REQ-METHOD-01 until a dossier shows an actual refusal
   inversion.

---

## 3. Participant-side vs host-side cost (REQ-MIG-02)

The guidance treats migration cost on both sides of the boundary; the scale applies to each
side independently.

- **`migration.side.participant`**: what must change in the application joining the
  composition. This is the default reading of the scale above.
- **`migration.side.host`**: what must change in the composing application when a
  participant is added or updated. The same levels apply mechanically: a host that must be
  rebuilt and redeployed for every new participant is paying a recurring level-3/4 cost;
  a host that discovers participants at runtime pays level 1 or 0. The novice-facing
  question "can the host be rebuilt and redeployed whenever a new application is added?"
  (REQ-AUD-01) is a host-side appetite probe.

Who *can* pay is an ownership fact, not an appetite fact: the ownership-situation checklist
(`ownership.*`, [topology.md](topology.md) section 3) determines which side's appetite is
even askable. `ownership.host-unmodifiable-participant` caps the participant side at level 2
work performed by the host team (adapters) or level 9; `ownership.participant-unmodifiable-host`
caps the host side symmetrically (white-label: the participant must fit whatever the
customer's host already does); `ownership.no-cross-deployment-control` means neither side
can demand the other pay anything, so both required-levels must independently be near zero.
Adapter work (level 2) is unique in being payable by *either* side, which is why it is a
pivotal level for third-party and acquisition topologies.

Recurring vs one-time matters when comparing: a one-time participant bootstrap change is
`cost.adopt`; a host rebuild per participant addition is `cost.operate`
([state-transition.md](state-transition.md) section 6). The dossier must record not just the
level but which side pays and whether the payment repeats.

---

## 4. Relationship to the cost triple (REQ-STATE-08)

The scale is the **unit of the code-change component of `cost.adopt`**: "how much must
change before the first successful integration" is answered per participant as a migration
level plus which side pays. [state-transition.md](state-transition.md) section 6 defines the
triple; this file only fixes the mapping:

- `cost.adopt` : sum over participants of their `migration.required-level` work (plus
  non-code adoption costs owned by state-transition).
- `cost.operate` : *recurring* migration-shaped work (host rebuild per addition, lockstep
  version upgrades) counts here, not in adopt; a strategy that is cheap to enter but forces
  coordinated re-releases forever must not look cheap.
- `cost.evolve` : the migration level of *leaving* or *converging* (section 6). A strategy
  adopted at level 2 whose exit is level 7 has low adopt cost and high evolve cost; the
  model must keep those visible separately (REQ-AVAIL-03 posture: never collapse into one
  number).

---

## 5. Hard-constraint behavior (REQ-Q-02)

`migration.no-modification-possible` is the **canonical eliminating answer**: the
transcript's own example of a hard constraint is "We cannot modify the acquired
application's source code." When appetite for a participant is level 9, every solution whose
`migration.required-level` involves any participant-side change is *excluded*, not
down-ranked, regardless of how well it scores elsewhere. The constraint model
([constraints.md](constraints.md)) owns the general hard/preference machinery; this file
contributes the mapping:

- Appetite level 9, or any stated ceiling ("we could add a wrapper but will not touch the
  build"): **hard constraint** on `migration.required-level` per participant.
- "We would rather not change the bundler but could": **strong preference**; ranks, never
  eliminates.
- Counterfactual duty (REQ-Q-07): when elimination happens here, the report must say which
  appetite increase would readmit which candidates ("if a bootstrap change became
  acceptable for the checkout app, strategies X and Y return"). This is also the seed of
  the constraint-relaxation path when nothing fits (REQ-GAP-03).

---

## 6. Horizon: first integration vs eventual convergence (REQ-STATE-07)

Appetite is horizon-dependent. Model it at two horizons, never as one number:

- **`migration.horizon.first-integration`**: what the organization will pay *now* to get the
  first working composition. Acquisitions and legacy modernization typically sit at levels
  1-2 here.
- **`migration.horizon.convergence`**: what the organization will pay *over the stated time
  horizon* toward the target architecture; often several levels deeper (a funded three-year
  convergence can carry level 7).

A transition architecture is precisely a candidate whose required level fits the
first-integration appetite while leaving the convergence path open (low `cost.evolve`), and
it may legitimately become permanent ([4] matrix question "can it remain viable permanently
rather than merely as migration scaffolding?"; [state-transition.md](state-transition.md)
section 5). The convergence appetite is only credible at confidence levels that
[state-transition.md](state-transition.md) section 3 marks as committed; an aspirational
convergence appetite must not relax the first-integration constraint (REQ-STATE-02). The
robustness test applies: the recommendation should survive the convergence appetite never
being spent ("what happens if the transition never occurs?", REQ-STATE-09).

---

## 7. Per-topology appetite priors : CONFIRMED (Phase 6)

Defaults only, in the sense of [topology.md](topology.md) section 1: each prior is a
starting hypothesis the engine must confirm with a real question (section 8) before acting
on it; a prior never eliminates. Levels refer to the participant side unless noted;
horizons per section 6. Phase-6 check: each row was compared against the observed floors
(section 2 recalibration) and the constraint-side defaults of constraints.md 2.15; no row
needed a level change, and two rationales were sharpened (third-party-vendor,
platform-product).

| Topology | First-integration prior | Convergence prior | Rationale sketch |
|---|---|---|---|
| `topology.coordinated-team` | 4-6 | same | One org, synchronized releases: refactors are schedulable. |
| `topology.independent-teams` | 3-4 per team | 5 | Teams accept self-contained changes; cross-team synchronized refactors are expensive. |
| `topology.platform-product` | 4 | 5-6 | Platform can mandate bootstrap/lifecycle adoption as the price of entry; matches the observed floor-4 cluster (taxonomy.md 2.6). |
| `topology.acquisition` | 1-2 | 5-7 (only if funded) | Coexistence needed before convergence; day-one appetite near zero, later appetite depends on committed convergence plans. |
| `topology.legacy-modernization` | asymmetric: legacy 1-2, new code 0 | legacy may reach 8 (planned disappearance) | The whole point is not paying the legacy's refactor cost up front. |
| `topology.third-party-vendor` | 9 typical, 2 host-side | 9 | Vendor will not change for one customer; adapters are the host's only lever. Sharpened at Phase 6: at appetite 9, admissible units are those with `migration.participant.thirdparty-unmodified-viable`=y; even embed-only document embedding demands level-1 serving headers, payable only where the vendor already ships an embeddable surface. |
| `topology.plugin-ecosystem` | participants 0 (built to contract); host 1 per addition | host contract effectively frozen | Unknown future participants must join without host redeploys. |
| `topology.white-label` | host side 9 (customer-owned); participant 1-4 | participant carries all evolution | The product must fit hosts it cannot change. |
| `topology.fragmentation` | 3-4 per team; any level requiring cross-team synchronization effectively unavailable | unstable | Per-team appetite may exist, but coordinated-change levels are unreachable in practice. |
| `topology.b2b-distribution` | near zero on both far sides | near zero | Vendor cannot modify customer surfaces; customers cannot modify the vendor product. |

Phase-6 check performed against the dossier-derived matrix floors; the two asymmetric rows
are additionally corroborated by fixture inputs
(scenarios/legacy-angular-modernization.md, guardrail "split appetite honored";
scenarios/b2b2c-embedded-product.md, customer-side level-1 hard ceiling). No prior misled.
Phase 8 hand traces re-test every row end to end; where a trace faults a prior, fix the
prior or the scale, never add a vendor special case (REQ-ORCH-11).

---

## 8. Question seeds (REQ-AUD-01)

Phrased in the user's circumstances; the engine maps answers onto levels, sides, and
horizons. Final wording and graph position belong to [questions.md](questions.md) /
[question-graph.md](question-graph.md); these are seeds with their target concept noted.

Capability preconditions (asked before any appetite question is meaningful):

- "Do you have the source code for this application, and the legal right to change it?"
  (levels 3+ reachable at all)
- "Can you build and deploy this application today, end to end?" (a broken build caps
  appetite at level 2 regardless of willingness)
- "Is there a team that still actively works on this application, or is it in
  maintenance-only mode?" (levels 5+ need active maintainers)

Appetite, participant side:

- "Could you change settings, headers, or how this application is packaged, without
  touching its code?" (level 1)
- "Could your own team write a small piece of glue code around this application, even if
  the team that owns it changes nothing?" (level 2; also probes which side pays)
- "If joining required changing how this application is built (its build tool or its
  plugins), is that something the owning team could and would do?" (level 3)
- "Could the owning team change how the application starts up: what runs first when it
  loads?" (level 4)
- "How much time has the owning team actually budgeted for integration work: days, weeks,
  or quarters?" (separates 1-4 from 5-8; budget is a buy-in signal per
  [state-transition.md](state-transition.md) section 4)
- "If this application could never be changed at all, does it still need to appear inside
  the combined product?" (level 9 detector; hard constraint if yes)

Appetite, host side:

- "When a new application is added to the combined product, is it acceptable to rebuild and
  redeploy the main application, every time?" (host-side recurring cost; the guidance's own
  example question)
- "Who is allowed to change the main application that users land on: your team, another
  team, or a customer?" (ownership gate for host-side levels; `ownership.*` mapping)

Horizon:

- "Is this integration meant to be temporary while something is replaced, or is it the
  long-term shape?" (selects which horizon's appetite governs; REQ-STATE-09 overlap, asked
  once, shared with the trajectory seeds in [state-transition.md](state-transition.md)
  section 7)
- "If the bigger clean-up you are planning never happens, would this way of integrating
  still be acceptable to live with?" (robustness; convergence appetite credibility)

---

## 9. Phase-6 gate resolutions (formerly the open questions)

1. **Level 3/4 ordering: KEPT; bundler-change split DECLINED.** See the section 2
   recalibration, flag 1: elimination bands are monotone under the current order and the
   config-vs-toolchain spread is carried per cell as conditions.
2. **Appetite STAYS A SCALAR per participant + horizon.** No recorded cell forced the
   change-kinds model (section 2 recalibration, flag 3); the regulated-artifact case is
   modeled as a ceiling plus `constraint.verbatim-participant-bytes`.
3. **Recording format CONFIRMED as implemented.** Each matrix column carries the two
   min-level rows (side in the row id, level in the condition text), justified by the
   atomic `migration.*` requirement attributes of the same column (attributes.md
   migration group), which is the REQ-ORCH-08 chain. One-time vs recurring is not part
   of the level cell: recurring host cost lives in the deployment attributes (see
   resolution 5); the section 3 duty to record side and repetition stands.
4. **Priors VALIDATED at Phase-6 depth.** Checked against the observed floors and
   constraints.md 2.15, with the asymmetric rows corroborated by fixture inputs
   (section 7). Full Phase 8 scenario traces remain the standing re-test, not a Phase 6
   blocker.
5. **No `migration.recurring.*` id family.** Recurring host-side cost is owned by the
   deployment attributes (`deployment.host-rebuild-required`,
   `deployment.new-participant-host-change`), binds through
   `constraint.independent-deploy` and `constraint.no-host-change-per-participant`
   (constraints.md 2.3), and aggregates into `cost.operate`
   ([state-transition.md](state-transition.md) section 6). The annotation form of
   section 3 stands.

---

## 10. Changelog (Phase 6 gate, 2026-08-29)

- Status raised PROVISIONAL v0 to REFINED v1; section 2 re-labeled CALIBRATED.
- The scale was recalibrated against the actual `migration.participant.min-level` and
  `migration.host.min-level` cells of all 30 matrix columns: the observed floor
  distribution is now recorded in section 2, the three provisional flags are resolved
  (3/4 order kept with no split; no new levels, with the two candidates identified as
  atomic attributes instead; scalar appetite kept), and the "solutions never require
  levels 0/9" claim is confirmed empirically (observed range 1-7 participant, 1-8
  host).
- Per-topology priors confirmed against the observed floors, constraints.md 2.15, and
  fixture inputs; the third-party-vendor and platform-product rationales sharpened
  (no level changed).
- Section 9 converted from open questions to resolutions, including declining a
  `migration.recurring.*` id family in favor of the deployment attributes plus
  `cost.operate`.
- Level ids, level order, and section numbering unchanged; no id broken.
