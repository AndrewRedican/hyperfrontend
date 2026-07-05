# @hyperfrontend/features — Showcase Plan Index

Navigation point and decision ledger for the **showcase** plan family: the demo applications, the issue-capture process, the demo generator, and the v2 release loop that turn `@hyperfrontend/features` from "sound on paper" into **abundant, varied, polished proof in the wild**.

**Status**: Active — `@hyperfrontend/features` v1 is published. This family builds the proof and feeds the v2.

This index is intentionally compact. Each linked document is a focused, independently-reasoned plan. Run focused planning sessions (`grill-me`, `implementation-plans`) against the individual files, not this index. The narrative rationale — north star, thesis, journeys, sequencing — lives in [00-strategy.md](00-strategy.md).

---

## What we are building

Not just examples. A deliberate body of **proof** that `@hyperfrontend/features` lets independent web apps — often in **different frameworks** — coordinate **messages _and_ visuals** so seamlessly the seams disappear. The demos are consumed exactly as an external consumer would consume the published package, and every rough edge they surface is captured and fed into a fast follow-up release.

Two tiers of proof:

- **Self-hosting gallery** — a showcase that is itself a hyperfrontend host, mounting demos as live features (breadth).
- **Flagship composed app** — one ambitious host that composes many features into a single product (the "into something larger" centerpiece).

---

## The thesis (what every demo ultimately proves)

> Independent apps, in different frameworks, coordinating **messages and visuals** seamlessly.

Each demo has its own specific intent, but all serve that thesis. Boundary-_respecting_ demos (payments, auth, enterprise widgets) prove safe isolation + contract messaging; boundary-_dissolving_ demos (koi pond, colourcopia) prove the seams can vanish entirely.

---

## Recommended reading / execution order

D = discovery-heavy · E = execution-heavy · ⭐ = special, prominent handling

| #   | Plan                                                                     | Type | Depends on | Scope                                                                                                                |
| --- | ------------------------------------------------------------------------ | ---- | ---------- | -------------------------------------------------------------------------------------------------------------------- |
| 00  | [Strategy](00-strategy.md)                                               | —    | —          | North star, thesis, journeys, sequencing rationale, the two discoveries                                              |
| 01  | [Findings capture skill](../../.claude/skills/demo-findings/SKILL.md)    | D+E  | —          | The `demo-findings` skill — file every demo friction before working around it. **Must precede Demo 1.** _Delivered._ |
| 02  | [Demo catalog](catalog.md)                                               | D    | 01         | The curated, prioritized, mapped backlog — 50 + 17 + trio reconciled into one. _Delivered._                          |
| 04  | ⭐ [Demo 1 — Clock (weed-clearer)](04-demo-1-clock.md)                   | D+E  | 01         | Full consumer path + blank-prototype extraction + first findings                                                     |
| 05  | [Plugin system implementation](05-plugin-system.md)                      | E    | 04         | The phantom `ExperiencePlugin` → real; keystone for spectacle demos                                                  |
| 06  | ⭐ [Demo 2 + Nx demo generator](06-demo-2-and-generator.md)              | D+E  | 04         | Second demo as the generator's first test case; repeatability & QoL                                                  |
| 07  | [Legacy distillation](07-legacy-distillation.md)                         | D    | 01         | Extract-then-delete the untracked `_/`; runs parallel                                                                |
| 08  | [Breadth — boundary-respecting batch](08-breadth-boundary-respecting.md) | E    | 06         | Enterprise/gallery features (some warranting real backends)                                                          |
| 09  | [Breadth — pattern batch](09-breadth-pattern.md)                         | E    | 06         | Russian-doll nesting, cross-framework, many:many topologies                                                          |
| 10  | [Breadth — spectacle / plugin batch](10-breadth-spectacle-plugin.md)     | E    | 05, 06     | Koi pond, colourcopia, drag default handling, clock spectacle                                                        |
| 11  | [Flagship composed app](11-flagship-composed-app.md)                     | E    | 08–10      | The composed centerpiece (e.g. fake desktop/OS)                                                                      |
| 12  | [Gallery / docs-site integration](12-gallery-docs-integration.md)        | E    | 04, 08–11  | Self-hosting gallery in the docs site; live embeds, per-demo pages                                                   |
| 13  | [v2 release](13-v2-release.md)                                           | D+E  | all        | Triage registry → v2 changes → publish → docs refresh                                                                |
| 14  | [Clock luxury refit + showcase surfaces](14-clock-luxury-refit.md)       | E    | 04         | Haute-horlogerie clock redesign, poster/showcase reinstatement, Railway publish pattern                              |

> **03 is vacant.** Deployment/CI is no longer a standalone plan — it's folded into [00-strategy.md](00-strategy.md#deployment-and-the-origin-boundary-layer) (decisions settled; only per-demo execution remains). The slot is left empty rather than renumbering 04–13.

**Parallelism**: 07 runs alongside 04–06; the three breadth batches (08–10) parallelize once 05 + 06 land.

---

## Locked decisions (compact ledger)

Resolved in the initial grill session. Detail in [00-strategy.md](00-strategy.md).

| Topic               | Decision                                                                                                                                                                                                         |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| North star          | **Proof in the wild** — visibility (deploy/embed) is load-bearing, not an afterthought                                                                                                                           |
| Audience            | **Author's portfolio** — breadth, range, craft, the "many packages compose into something larger" story                                                                                                          |
| Proof shape         | **Both tiers**: self-hosting gallery + flagship composed app; _all_ ideas notionally                                                                                                                             |
| Realism             | **Mock unless it merits real** — auth / payments-class demos warrant real (small Railway backend) services                                                                                                       |
| Thesis              | Independent apps, different frameworks, coordinating **messages AND visuals** seamlessly                                                                                                                         |
| Visual coordination | **Formalize the plugin seam** (generalized registration) — SDK hands you the element, consumer owns choreography; broader taxonomy + showcase-internal debug plugin are **notional** ([05](05-plugin-system.md)) |
| Demo unit           | A **complete composition** — ≥1 host + ≥1 hostee — with varied topologies (1:1, 1:many, many:1, many:many, Russian-doll)                                                                                         |
| First demo          | **Clock**, boundary-respecting — lowest feature-risk, so it clears the _right_ weeds                                                                                                                             |
| Issue capture       | **In-repo registry, house style** + a `demo-findings` skill encoding the process                                                                                                                                 |
| Legacy `_/`         | **Extract-then-delete** — commit keepers first (it is untracked), then delete 162 MB                                                                                                                             |
| Frameworks          | **Broad but incremental** — start React/Vue/Vanilla; add Svelte/Solid/Web Components just-in-time                                                                                                                |
| Deployment          | **Deploy-as-you-go on Railway, per-service origin** — both boundaries tested deliberately (same-origin + real cross-origin + cross-site); each demo TIP ends in deploy + gallery registration                    |
| Generator           | **Internal** workspace-only tool in `tools/`; never leaks into the published package                                                                                                                             |

---

## Shared invariants (apply across every plan in this family)

1. **Consumer-only usage.** Demos consume the **published** `@hyperfrontend/features` exactly as an external consumer would — via subpath exports (`/host`, `/hostee`). No imports from `libs/features/src`, no workspace shortcuts, no privileged access. This is the whole point; violating it invalidates the proof.
2. **Every friction is a finding.** If building a demo hurts — unclear API, confusing error, missing feature, docs gap, packaging snag, DX papercut — file it via the `demo-findings` skill **before** working around it. The workaround goes in the demo; the friction goes in the registry the skill maintains.
3. **Proof = live.** A demo is not "done" until it is deployed to its own origin and registered in the gallery.
4. **A demo is a composition.** ≥1 host + ≥1 hostee. The topology (who talks to whom, in which direction, nested how deep) is the point, not incidental.
5. **Framework-agnostic, shown not claimed.** Span the palette; introduce each framework just-in-time when a spotlight demo earns it.
6. **Mock unless it merits real.** Fake data/backends by default; real (small Railway backend) services only for auth/payments-class demos where realism _is_ the proof.
7. **The generator is internal.** It lives in `tools/`, may assume the Nx workspace, and must never leak into the published `@hyperfrontend/features` (whose own `src/nx/` adapter stays vendor-agnostic).
8. **Don't author docs ahead of code.** READMEs, ARCHITECTURE, `@example` blocks come after the thing they describe exists.
9. **Know conventions before coding.** Read the `coding` skill and skim `tools/eslint-rules/docs/`; gate every demo with the cache-busted quad check (`typecheck`/`lint`/`test`/`build`).

---

## Registry & distilled material

- **Findings capture** → the [demo-findings skill](../../.claude/skills/demo-findings/SKILL.md) — template, categories, severity, and graduation rules for the friction log feeding v2.
- **Demo backlog** → [catalog.md](catalog.md) — the curated, prioritized, mapped demo list (the demo-catalog-curation discovery; 50 + 17 + trio reconciled).
- **Legacy distilled** → [legacy-distilled/](legacy-distilled/) — Tier-1 keepers + distilled-idea stubs salvaged from `_/` (output of plan 07).
- **Blank prototype** → [blank-prototype.md](blank-prototype.md) — the feature-only demo skeleton extracted from Demo 1 (seed for the [06](06-demo-2-and-generator.md) generator).

---

## Relationship to existing roadmap material

This family **subsumes** the demo/integration/deployment work previously scattered across the repo. As each is assimilated, the old file is removed (per the "remove the old once subsumed" intent):

| Old material                                                                       | Becomes                                                                                        |
| ---------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| [../feature/08-demos.md](../feature/08-demos.md)                                   | [04-demo-1-clock.md](04-demo-1-clock.md) + the breadth batches                                 |
| [../feature/09-docs-site-integration.md](../feature/09-docs-site-integration.md)   | [12-gallery-docs-integration.md](12-gallery-docs-integration.md)                               |
| [../feature/10-deployment.md](../feature/10-deployment.md)                         | [00-strategy.md](00-strategy.md#deployment-and-the-origin-boundary-layer) (deployment section) |
| [../demos-implementation-plan.md](../demos-implementation-plan.md) (50-item table) | [catalog.md](catalog.md) (folded into the curated backlog)                                     |

The package's own history ledger ([../feature/README.md](../feature/README.md)) stays as the record of plans 01–07/11 but points here for demos onward.
