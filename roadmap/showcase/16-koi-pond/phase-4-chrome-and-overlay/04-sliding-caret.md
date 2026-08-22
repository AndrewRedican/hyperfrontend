# Sliding caret and grammar removal

Part of [Phase 4](README.md) · Guardrails: [plan index](../README.md) · Depends on:
[02-gradient-cone.md](02-gradient-cone.md), [03-pearl-trace.md](03-pearl-trace.md)

## Goal

The last piece of the monochrome grammar: a double-caret that orbits the head and slides
ahead of every turn, replacing the green/red/yellow intent colors entirely; then delete
the old grammar's code paths.

## Files

- `apps/demos/koi-pond/host/src/scene/interactions.ts`
- Specs: `apps/demos/koi-pond/host/src/scene/__tests__/` (extend)

## Design

- **Caret**: a small canvas-drawn double chevron sitting on a fixed-radius orbit around
  the head center (same anchor as the cone origin), pointing outward along the
  committed heading.
- **Slide**: when the fish commits a new heading (readable from the outline's committed
  intent and the path's initial curvature), the caret slides around the orbit toward
  the new heading, rate-limited so the motion is visible and leads the fish: the caret
  arrives before the body does. No teleporting.
- **Removal**: delete the green/red/yellow ray and chevron code paths outright: the
  intent-color mapping, the dashed ray, the colored chevrons, and their style tokens.
  The overlay's remaining inks are the single monochrome ink at varying alpha. Escapes
  and depth changes read through path curvature and caret speed, by design; do not
  reintroduce a color channel for them.

## Specs

- Caret angle tracks committed heading through a scripted turn with the rate limit
  (never jumps more than the per-frame limit; converges ahead of the body's heading).
- Grammar removal: no code path can produce a non-monochrome stroke (assert the deleted
  exports/branches are gone; a grep-level spec is acceptable for style tokens).
- Overlay-off still renders nothing.

## Documentation impact

- None shipped here; the skill's overlay description is rewritten in
  [phase 5](../phase-5-integration/03-doctrine-rewrites.md) to describe only the
  monochrome grammar.

## Verification

```bash
npx nx test demo-koi-pond
npx nx lint demo-koi-pond --fix
npx nx typecheck demo-koi-pond
npx nx format:write --projects=demo-koi-pond
```
