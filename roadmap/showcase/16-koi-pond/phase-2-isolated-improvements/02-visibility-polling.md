# Visibility polling

Part of [Phase 2](README.md) · Guardrails: [plan index](../README.md)

## Goal

Stop trusting visibility **edges**. Device evidence (S24 Ultra, Chrome 151) showed
`visibilitychange` firing `hidden` twice with no `visible` between, so every event-driven
visibility consumer in the pond can latch the wrong state: fish stay asleep, deferred
resurrection grace never re-runs, the scene sits paused while fully visible.

## Files

- `apps/demos/koi-pond/host/src/scene/pond.ts` (visibility consumers: the sleep/wake
  sends and the resurrection defer/rerun wiring)
- Possibly a small `host/src/runtime/visibility.ts` helper if the reconciliation wants a
  seam for specs
- Specs: `apps/demos/koi-pond/host/src/scene/__tests__/` (extend)

## Design

- Keep the `visibilitychange` listener for responsiveness, but reconcile against
  `document.visibilityState` from two additional sources: a coarse interval (a few
  seconds) and the frame loop (a running rAF loop is itself proof of visibility).
- On any disagreement between latched state and `document.visibilityState`, correct the
  latch, run the transition handlers exactly as if the missed edge had fired (wake sends,
  resurrection grace re-run), and record `visibility-reconciled` through the existing
  `onDiagnostic` hook so the vitals overlay logs every occurrence.
- Reconciliation must be idempotent: correcting to the state already held does nothing.

## SDK twin

The features SDK has the same class of exposure wherever it trusts visibility edges. File
the SDK-side finding via `demo-findings` when this lands (it is a distinct finding from
F-020; the koi-side fix here is the demo workaround, and the finding records the SDK gap
per the findings invariant). Registry: [findings/README.md](../../findings/README.md).

## Specs

- A missed `visible` edge (state flips without an event) is corrected by the poll: wake
  sends fire, the diagnostic is recorded.
- A missed `hidden` edge is corrected symmetrically.
- No reconciliation churn when events and state agree (diagnostic not spammed).
- Fake timers per the house pattern (jest.mock of the built-in-copy module, never a raw
  global override).

## Documentation impact

- None shipped; code comments state the why in one line (edges can be missed; state is
  the truth), without citing the device investigation.

## Verification

```bash
npx nx test demo-koi-pond
npx nx lint demo-koi-pond --fix
npx nx typecheck demo-koi-pond
npx nx format:write --projects=demo-koi-pond
```
