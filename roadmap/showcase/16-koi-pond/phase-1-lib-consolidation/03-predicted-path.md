# Predicted path

Part of [Phase 1](README.md) · Guardrails: [plan index](../README.md) · Depends on:
[01-motion-port.md](01-motion-port.md)

## Goal

Expose `predictPath(state, n, dtStep)` on the motion module: the koi's predicted
advancement, integrated forward from its current wound state, for the overlay's pearl
trace ([phase 4](../phase-4-chrome-and-overlay/03-pearl-trace.md)). The prediction is
curved advancement (position samples), not a direction ray.

## Files

- `apps/demos/koi-pond/lib/src/motion/koi-motion.ts` (or a sibling `motion/predict.ts` if
  the brain file grows unwieldy; either way exported from the motion index)
- `apps/demos/koi-pond/lib/src/motion/__tests__/predict.spec.ts` (new)

## Design

- Pure function over the current motion state: integrate `turnVelocity`, `speed`, and
  `heading` forward `n` steps of `dtStep` seconds, returning at most 20 `Vec2` points
  (enforce the bound inside the function; the outline contract carries the same cap,
  [04-contract-0-8-0.md](04-contract-0-8-0.md)).
- No allocation churn concerns at the call cadence (20 points at the outline's 10Hz), but
  keep the function allocation-light anyway; it runs inside the fish frame loop.
- The prediction deliberately ignores future decisions: it shows what the currently wound
  maneuver does, which is exactly what makes the pearls "actualize" as the fish swims
  through them.
- **Accuracy is the contract.** The overlay draws these points as world-stationary pearls
  the fish then swims through; that illusion only holds if the fish really arrives where
  it predicted. `predictPath` must therefore integrate with the same stepping math as the
  brain's own advance (share the integrator code path, or prove equivalence in specs):
  absent a new decision, the realized trajectory passes through the predicted points
  within a small tolerance. Cheap approximations that look about right are not acceptable
  here.
- When the brain does commit a new decision mid-horizon, the next emitted path simply
  disagrees with the previous one from the divergence point on; the overlay detects that
  geometrically and redraws the stale suffix
  ([phase 4, pearl trace](../phase-4-chrome-and-overlay/03-pearl-trace.md)). No extra
  signal is emitted for it.

## Specs

- Straight cruise predicts a straight line at cruise spacing.
- A wound turn predicts a curve whose curvature matches the commanded turn rate and whose
  arc length matches speed times horizon.
- The point count clamps at 20 regardless of `n`.
- Determinism: same state, same output.
- **Realized-trajectory parity (mutation-proven)**: predict from a live state, then
  advance the real motion with no new stimuli for the same horizon; the realized
  positions pass within tolerance of every predicted point, across straight, turning,
  and braking states. Perturb the prediction integrator (step order, dt handling) and
  this spec must fail.

## Documentation impact

- JSDoc on `predictPath` in the house style with a titled `@example`. Present-state only.
- No README, guide, or skill changes here.

## Verification

```bash
npx nx test demo-koi-lib
npx nx lint demo-koi-lib --fix
npx nx typecheck demo-koi-lib
npx nx format:write --projects=demo-koi-lib
```
