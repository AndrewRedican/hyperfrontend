# 06 — Nx Demo Generator ⭐

**Repeatability**: an internal Nx demo generator consolidating the blank prototype into automation so the breadth demos (08+) get cheap, clean, and consistent.

**Type** D+E · **Status**: Pending — not yet elaborated. The generator is proven when it can scaffold the heartbeat demo's shape from the blank prototype.

See [00-strategy.md](00-strategy.md) and the [index](README.md).

## Scope (to elaborate)

- **The generator** (`tools/`, workspace-only): scaffolds a demo **composition** — host + N hostees, chosen frameworks, contract, `feature.config.*`, deploy metadata + gallery-registration wiring — from the skeleton captured in [blank-prototype.md](blank-prototype.md).
- **Supporting machinery**: conventions, lint rules, broad-framework templates (React/Vue/Vanilla first; more added just-in-time), validation checks (a scaffolded demo passes the quad gate out of the box).
- **Prerequisite extraction**: the host-bearing prototype variant must first be extracted from the heartbeat demo (see [blank-prototype.md](blank-prototype.md) "Not in this variant") so the generator can cover demos with their own hosts.
- **Proof**: the generator reproduces the heartbeat demo's shape.

## Carried decisions

- Generator is **internal** and workspace-only; never leaks into the published `@hyperfrontend/features` (whose `src/nx/` adapter stays vendor-agnostic) (invariant #7).
- Frameworks broad but incremental.

## Open questions

- Generator home: a new `tools/` project vs inside `tools/workspace`.
- Template framework set for v1 of the generator.
- What the generator validates vs leaves to the author.
