# Dynamic shoal machinery

Part of [Phase 3](README.md) · Guardrails: [plan index](../README.md) · Depends on:
[01-instance-id-refactor.md](01-instance-id-refactor.md),
[phase 2 device tier](../phase-2-isolated-improvements.md#device-tier)

## Goal

Visitors grow and shrink the shoal at runtime: `addKoi(framework)` and
`removeKoi(instanceId)`, bounded by the device-tier cap.

## Files

- `apps/demos/koi-pond/host/src/scene/pond.ts` (the two operations, wired to hooks the
  [phase 4 shoal panel](../phase-4-chrome-and-overlay/01-shoal-panel.md) will drive)
- `apps/demos/koi-pond/host/src/scene/koi-sessions.ts` (`openInstance` from 01)
- Specs: `apps/demos/koi-pond/host/src/scene/__tests__/` (extend)

## Design

- **`addKoi(framework)`**: assign the next free ordinal for that framework, create layer
  and shell via `openInstance`, open. At the tier cap: refuse, emit a diagnostic through
  `onDiagnostic` (vitals logs it), and surface a panel affordance state (buttons disable
  with the tier named; the panel work itself is phase 4, the state lives here).
- **`removeKoi(instanceId)`**: polite close (the SDK closing flow, never a hard destroy
  first), then layer teardown, releasing the ordinal. A freed ordinal is reusable; the
  variant seed is a pure function of (framework, ordinal), so a re-added twin returns
  with the same phenotype. That determinism is a feature (same fish comes back), not a
  bug; do not add randomization.
- **Roster reporting**: the outer shoal report stays `{connected, expected}` where
  `expected` is the current roster size. The outer contract is untouched; the gallery
  already treats the numbers as data.
- Removal of the last instance of a framework leaves the framework addable again;
  removing below one total fish is refused (the pond is never empty).
- Resurrection interplay: a removed instance's pending revive timers cancel; the
  resurrection policy only governs instances the roster still wants.

## Specs

- Add to cap succeeds; cap+1 refuses with the diagnostic and no session side effects.
- Remove cancels pending revives, tears down the layer, frees the ordinal; re-add reuses
  the ordinal and reproduces the phenotype (seed determinism).
- Shoal report tracks the live roster through add/remove churn.
- The last-fish guard refuses.

## Documentation impact

- None shipped in this sub-plan (phase 5 batches the prose).

## Verification

```bash
npx nx test demo-koi-pond
npx nx lint demo-koi-pond --fix
npx nx typecheck demo-koi-pond
npx nx format:write --projects=demo-koi-pond
```
