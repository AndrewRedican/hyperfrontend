# Floor and interactions DPR cap

Part of [Phase 2](README.md) · Guardrails: [plan index](../README.md) · Evidence:
[recon §4](../recon.md#4-a-container-derived-card-world)

## Goal

Cap the two 2D canvases at device pixel ratio 2. The WebGL surfaces already cap
(`fitPondRenderer` hard-caps at 2), but the floor canvas paints at raw
`window.devicePixelRatio` and the interactions canvas follows the same pattern: on a dpr
2.8125 phone the floor alone is about 2.6MB of canvas for a 288px card, and proportionally
worse expanded.

## Files

- `apps/demos/koi-pond/host/src/scene/pond.ts` (the remeasure call sites that size both
  canvases, around the floor sizing at `pond.ts:318-325`)
- `apps/demos/koi-pond/host/src/scene/floor.ts`
- `apps/demos/koi-pond/host/src/scene/interactions.ts`
- Specs: `apps/demos/koi-pond/host/src/scene/__tests__/` (extend)

## Design

- One named constant (cap 2), applied wherever a 2D canvas derives its backing size from
  `devicePixelRatio`; drawing transforms scale accordingly so CSS-space rendering code is
  untouched.
- This is a straight capability cap, not degradation logic: no tiering, no UA checks; the
  same rule the GL surfaces already live by.

## Specs

- At simulated dpr 2.8125 the backing store computes as CSS size times 2; at dpr 1.5 it
  stays 1.5.
- A remeasure after a dpr change (zoom, monitor move) re-derives correctly.

## Documentation impact

- None shipped.

## Verification

```bash
npx nx test demo-koi-pond
npx nx lint demo-koi-pond --fix
npx nx typecheck demo-koi-pond
npx nx format:write --projects=demo-koi-pond
```
