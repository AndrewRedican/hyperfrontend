# 06 — Demo 2 + Nx Demo Generator ⭐

The second special demo. Emphasis flips from "clear weeds" to **repeatability**: a second demo built as the **first test case** of an internal Nx demo generator, consolidating the blank prototype into automation so demos 08+ get cheap, clean, and consistent.

**Depends on** 04 _(delivered; plan removed)_ · **Type** D+E · **Status**: Pending — not yet elaborated. Demo 2 itself (heartbeat, `apps/demos/heartbeat`) was built **by hand** on 2026-08-03, so the generator's first test case flips to reproducing it: the generator is proven when it can scaffold the heartbeat demo's shape from the blank prototype.

See [00-strategy.md](00-strategy.md) (journey J3, "Special handling") and the [index](README.md).

## Scope (to elaborate)

- **Demo 2**: a different topology from the clock — e.g. an omni-bar/navbar controlling several embedded features (1:many), or a short Russian-doll chain — chosen to stress what the generator must parameterize.
- **The generator** (`tools/`, workspace-only): scaffolds a demo **composition** — host + N hostees, chosen frameworks, contract, `feature.config.*`, deploy + gallery-registration wiring — from the blank prototype captured in [blank-prototype.md](blank-prototype.md).
- **Supporting machinery**: conventions, lint rules, broad-framework templates (React/Vue/Vanilla first; more added just-in-time), validation checks (a scaffolded demo passes the quad gate out of the box).
- Demo 2 is built **by** the generator, proving it.

## Carried decisions

- Generator is **internal** and workspace-only; never leaks into the published `@hyperfrontend/features` (whose `src/nx/` adapter stays vendor-agnostic) (invariant #7).
- Frameworks broad but incremental.

## Open questions

- Generator home: a new `tools/` project vs inside `tools/workspace`.
- Template framework set for v1 of the generator.
- What the generator validates vs leaves to the author.
