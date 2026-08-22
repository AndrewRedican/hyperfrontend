# Pearl trace

Part of [Phase 4](README.md) · Guardrails: [plan index](../README.md) · Depends on: the
outline `path` from [phase 1](../phase-1-lib-consolidation/03-predicted-path.md), live
via the [phase 3 repack](../phase-3-instance-model/06-repack-pipeline.md)

## Goal

Replace the dashed direction ray with dots the fish actually swims through: the
fish-side predicted advancement drawn as a consumable pearl chain.

## Files

- `apps/demos/koi-pond/host/src/scene/interactions.ts`
- Specs: `apps/demos/koi-pond/host/src/scene/__tests__/` (extend)

## Design

- **Source**: the `path` field on each outline (at most 20 `Vec2`s, the fish's own
  prediction). No host-side prediction; the host draws what the fish says.
- **Look (locked)**: white pearls, 5 to 6px maximum diameter, up to 10 live at once
  (hard cap 20 points consumed from the wire), opacity ramping from 0.8 at the nose to
  0.1 at the horizon.
- **Pearls are world-stationary.** Once a pearl is placed, its position never changes:
  no sliding, no interpolation toward newer predictions, no per-tick re-snap. The
  trace's apparent motion is entirely the churn of its endpoints: consumed at the nose,
  minted at the horizon. The effect is the fish visibly swimming through fixed
  waypoints it predicted, which only reads as truth because the prediction is held to
  the accuracy bar in
  [phase 1, predicted path](../phase-1-lib-consolidation/03-predicted-path.md).
- **Steady state**: each fresh path emission agrees with the pearls already drawn
  (same maneuver, integrated the same way), so the painter's only work is the
  endpoint walk: drop pearls the nose has reached, append new ones from the fresh
  path's tail as arc-length budget opens.
- **Replan invalidation**: when the fish commits a new maneuver mid-trace (an obstacle
  appeared along the predicted path, an escape fired, a depth change was granted), the
  drawn suffix is no longer true and must not linger. On every fresh path, run an
  arc-length-aligned divergence test against the drawn pearls: find the first pearl
  deviating from the new path by more than a small tolerance (a few pixels), keep the
  still-accurate prefix, remove the stale suffix, and redraw it from the new path in
  the same tick. Detection is purely geometric on the host side; no wire signal is
  needed, and a well-behaved steady state never trips the tolerance.
- Depth and curvature read through the trace naturally (a diving fish's path
  foreshortens; an escaping fish's path bends hard); no extra encoding.

## Specs

- Window walk: for a synthetic path and advancing nose positions, the drawn set churns
  as specified (nearest consumed, horizon appended), never exceeding 10.
- Stationarity: a pearl's world position is identical from the tick it is drawn to the
  tick it is removed, across intervening path emissions that agree with it.
- Replan: feed a path sequence that diverges at a known arc length; the prefix before
  the divergence survives untouched, the suffix is replaced with pearls on the new
  path in the same tick, and no stale pearl outlives the emission that contradicted it.
- Tolerance calm: paths that agree within the tolerance cause zero redraws (no
  shimmering suffix in steady state).
- Opacity ramp endpoints and monotonicity.
- Graceful absence: outlines without `path` (a not-yet-repacked fish, or any future
  producer omitting it) draw no trace and no error.

## Documentation impact

- None shipped here.

## Verification

```bash
npx nx test demo-koi-pond
npx nx lint demo-koi-pond --fix
npx nx typecheck demo-koi-pond
npx nx format:write --projects=demo-koi-pond
```
