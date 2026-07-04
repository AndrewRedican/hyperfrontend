# 10 — Breadth: Spectacle / Plugin Batch

The viral, eye-catching demos that prove the **visual** half of the thesis — seamless coordination where the seams vanish. Each uses the plugin seam to capture containers and choreograph them; the consumer owns the choreography.

**Depends on** [05](05-plugin-system.md), [06](06-demo-2-and-generator.md) · **Type** Execution · **Status**: Pending — not yet elaborated.

See [00-strategy.md](00-strategy.md) (journey J5) and the [index](README.md).

## Scope (to elaborate)

- **Koi fish pond** (canonical): SVG fish, each a minimal-framework feature app, swimming on a pond host in another framework; framework-themed colors/behavior; autonomous wandering with coordination — collision-avoidance between fish, host repositioning feature containers on a shared surface.
- **Colourcopia**, **default event/error handling on drag**, **analog/digital clock spectacle**, **fake terminal**, **voice-to-text** — each a focused spectacle of message + visual coordination.
- Each demonstrates the plugin system ([05](05-plugin-system.md)) in anger.

## Carried decisions

- Visual coordination via the formalized plugin seam (locked) — SDK hands over the element; choreography lives in demo code.

## Open questions

- Koi pond exact mechanics: collision model, how the host drives container movement, transparent overlapping iframes, pointer-event handling.
- How much choreography each spectacle demo carries before it's "enough."
