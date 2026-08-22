# Card profile

Part of [Phase 3](README.md) · Guardrails: [plan index](../README.md) · Depends on:
[03-deferred-boot.md](03-deferred-boot.md) · Evidence:
[recon §4](../recon.md#4-a-container-derived-card-world),
[recon §5](../recon.md#5-footprint)

## Goal

The card scene becomes its own pond profile: one resting koi in a container-derived
world, at about one eighth of today's footprint.

## Files

- `apps/demos/koi-pond/host/src/scene/pond.ts` (profile selection and the world call
  site, `pond.ts:133` today)
- Specs: `apps/demos/koi-pond/host/src/scene/__tests__/` (extend)

## Design

- **World**: `describePondForFrame(containerWidth, containerHeight, reducedMotion)`
  ([phase 1](../phase-1-lib-consolidation/07-frame-world.md)) instead of the
  screen-derived `describePond`. Hosted fish adopt the announced pond wholesale, so no
  fish-side change is involved.
- **Roster**: exactly one instance, `KOI_FRAMEWORKS[hour % 8]` by local hour, ordinal 0
  (the canonical fish). The hourly rotation is decided at boot; a card never swaps fish
  mid-mount.
- **Resting**: send `pause {paused: true, resting: true}` on open; the fish holds
  position and sculls with no held chrome
  ([contract 0.8.0](../phase-1-lib-consolidation/04-contract-0-8-0.md)). This sidesteps
  the small-world roaming pathologies entirely (recon §4: waypoint churn, boundary
  slip-outs leaving the card empty for seconds).
- **Depth**: the live-roster spread ([01](01-instance-id-refactor.md)) puts the solo koi
  at the surface level: full scale, full opacity, wake ripples eligible.
- **Floor**: DPR-capped ([phase 2](../phase-2-isolated-improvements/03-floor-dpr-cap.md)).
- **Curtain**: lifts on the single handshake (the `present.size === sessions.length`
  rule already reads 1 of 1).
- **Expanded and standalone profile**: initial trio `hour % 8`, `+1`, `+2` (mod 8), all
  ordinal 0; the card's fish is always among them, so an expand reads as "the same koi,
  now with company".
- Card chrome: the scene keeps hiding roster/interactions/vitals at card scale (existing
  `data-scene='card'` CSS).

## Specs

- Profile selection: card scene yields one session with the hour-derived framework and a
  frame-derived world; full scene yields the trio with the screen-derived world.
- The resting pause is sent on open (wire spy).
- Trio composition wraps correctly at hours 6 and 7.

## Documentation impact

- None shipped in this sub-plan (phase 5 batches the prose).

## Verification

```bash
npx nx test demo-koi-pond
npx nx lint demo-koi-pond --fix
npx nx typecheck demo-koi-pond
npx nx format:write --projects=demo-koi-pond
```
