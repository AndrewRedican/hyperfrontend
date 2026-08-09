# @hyperfrontend/features — Showcase Plan Index

Navigation point and decision ledger for the **showcase** plan family: the demo applications, the issue-capture process, the demo generator, and the release loop that turn `@hyperfrontend/features` from "sound on paper" into **abundant, varied, polished proof in the wild**.

**Status**: Active — the package is published (0.5.x) with three demos in the gallery: clock, heartbeat, and the koi pond (the visual-thesis flagship, seven framework fish over a host pond). Next up: the generator, then the breadth batches.

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

Each demo has its own specific intent, but all serve that thesis. Boundary-_respecting_ demos (payments, auth, enterprise widgets) prove safe isolation + contract messaging; boundary-_dissolving_ demos prove the seams can vanish entirely — the shipped koi pond carries that half today, and colourcopia extends it.

---

## Outstanding plans

D = discovery-heavy · E = execution-heavy · ⭐ = special, prominent handling

| #   | Plan                                                                        | Type | Depends on | Scope                                                                       |
| --- | --------------------------------------------------------------------------- | ---- | ---------- | --------------------------------------------------------------------------- |
| 00  | [Strategy](00-strategy.md)                                                  | —    | —          | North star, thesis, journeys, sequencing rationale                          |
| 05  | [Plugin system — notional remainder](05-plugin-system.md)                   | D    | —          | Plugin taxonomy + showcase-internal debug/inspection plugin (exploratory)   |
| 06  | [Nx demo generator](06-demo-2-and-generator.md)                             | D+E  | —          | Internal generator; proven when it can reproduce the heartbeat demo's shape |
| 07  | [Legacy distillation](07-legacy-distillation.md)                            | D    | —          | Extract-then-delete the untracked `_/` legacy subtrees; runs parallel       |
| 08  | [Breadth — boundary-respecting batch](08-breadth-boundary-respecting.md)    | E    | 06         | Enterprise/gallery features (some warranting real backends)                 |
| 09  | [Breadth — pattern batch](09-breadth-pattern.md)                            | E    | 06         | Russian-doll nesting, cross-framework, many:many topologies                 |
| 10  | [Breadth — spectacle batch](10-breadth-spectacle-plugin.md)                 | E    | 06         | Colourcopia, drag default handling, terminal, voice                         |
| 11  | [Flagship composed app](11-flagship-composed-app.md)                        | E    | 08–10      | The composed centerpiece (e.g. fake desktop/OS)                             |
| 12  | [Gallery / docs-site integration — residue](12-gallery-docs-integration.md) | E    | 08–11      | Per-demo how-to guides; register future demos as they land                  |
| 13  | [v2 release — residue](13-v2-release.md)                                    | E    | —          | Docs refresh; verify live embeds after the next main-merge redeploy         |

> **Numbering convention.** Plans that complete are removed and their numbers are never reused (01, 02, 04, 14, and 15 — the koi pond — are gone this way; 03 was folded into [00-strategy.md](00-strategy.md#deployment-and-the-origin-boundary-layer)).

**Parallelism**: 07 runs alongside anything; the breadth batches (08–10) parallelize once 06 lands.

---

## Locked decisions (compact ledger)

Detail in [00-strategy.md](00-strategy.md).

| Topic               | Decision                                                                                                                                                                                                                              |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| North star          | **Proof in the wild** — visibility (deploy/embed) is load-bearing, not an afterthought                                                                                                                                                |
| Audience            | **Author's portfolio** — breadth, range, craft, the "many packages compose into something larger" story                                                                                                                               |
| Proof shape         | **Both tiers**: self-hosting gallery + flagship composed app; _all_ ideas notionally                                                                                                                                                  |
| Realism             | **Mock unless it merits real** — auth / payments-class demos warrant real (small Railway backend) services                                                                                                                            |
| Thesis              | Independent apps, different frameworks, coordinating **messages AND visuals** seamlessly                                                                                                                                              |
| Visual coordination | **Consumer-owned choreography** — the SDK hands over elements/modes; coordination logic lives in demo code, never in a host-side positioning API                                                                                      |
| Demo unit           | A **complete composition** — ≥1 host + ≥1 hostee — with varied topologies (1:1, 1:many, many:1, many:many, Russian-doll)                                                                                                              |
| Issue capture       | **In-repo registry, house style** + a `demo-findings` skill encoding the process                                                                                                                                                      |
| Legacy `_/`         | **Extract-then-delete** — commit keepers first (it is untracked), then delete the legacy subtrees                                                                                                                                     |
| Frameworks          | **Broad but incremental** — React, Vue, Vanilla, Svelte, Solid, Preact, and Lit are live (the last four arrived with the koi pond); Angular deferred                                                                                  |
| Deployment          | **Railway GitHub integration** — services deploy on merge to `main` after CI passes; service configuration lives in the Railway dashboard, deliberately not in-repo. Per-service origin; registration via the static gallery manifest |
| Generator           | **Internal** workspace-only tool in `tools/`; never leaks into the published package                                                                                                                                                  |

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

- **Findings capture** → the [demo-findings skill](../../.claude/skills/demo-findings/SKILL.md) — template, categories, severity, and graduation rules for the friction log feeding the next release. Registry: [findings/README.md](findings/README.md).
- **Demo backlog** → [catalog.md](catalog.md) — the curated, prioritized, mapped demo list.
- **Blank prototype** → [blank-prototype.md](blank-prototype.md) — the feature-only demo skeleton (seed for the [06](06-demo-2-and-generator.md) generator).
