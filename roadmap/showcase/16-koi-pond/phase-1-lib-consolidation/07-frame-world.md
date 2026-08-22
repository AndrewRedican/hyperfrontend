# Frame-derived world

Part of [Phase 1](README.md) · Guardrails: [plan index](../README.md) · Depends on:
[06-variant-seeds.md](06-variant-seeds.md) · Evidence:
[recon §4](../recon.md#4-a-container-derived-card-world)

## Goal

A pond world derived from the frame's own container instead of the device screen:
`describePondForFrame(width, height, reducedMotion)`, plus instance-aware entry stations so
duplicates never spawn stacked.

## Files

- `apps/demos/koi-pond/lib/src/geometry/virtual-pond.ts`
- `apps/demos/koi-pond/lib/src/geometry/__tests__/virtual-pond.spec.ts` (extend)

## Design

- **`describePondForFrame`.** Same derivation as `describePond` but bypassing `MIN_POND`,
  so a 288px container yields a 288-scale world instead of an 800x600 world seen through a
  288px window (recon §4: with `MIN_POND` intact the card shows about 17 percent of the
  pond and is empty water most of the time). `MIN_FISH_LENGTH` (130) becomes the governing
  floor and is deliberately kept: the card koi spanning roughly half the card edge is the
  intended look. `MAX_POND` still applies. Implement as a sibling entry point, not a flag
  on `describePond`, so the eight fish standalone fallbacks keep their exact behavior
  (hosted fish adopt the announced pond wholesale; only the host's call site changes, in
  [phase 3](../phase-3-instance-model/04-card-profile.md)).
- **Instance-aware entry.** `entryStation` computes all eight phantom entries
  deterministically today and reads the own slot. Give it an instance dimension: for
  ordinal 0 behavior is unchanged; for duplicates, jitter the station by the variant seed
  so two twins of the same framework enter from visibly different points and never spawn
  stacked. Jitter respects the existing separation relaxation.

## Specs

- `describePondForFrame(288, 288, false)`: world is 288-scale (not `MIN_POND`), fish length
  floors at 130, margins derive from fish length as today.
- `describePondForFrame` equals `describePond` for dimensions above `MIN_POND` (the bypass
  only changes the clamped regime).
- Entry jitter: duplicates of one framework produce stations separated by at least the
  existing separation target across a seeded sample of ordinals; ordinal 0 stations are
  byte-identical to today's.

## Documentation impact

- JSDoc on `describePondForFrame` and the instance parameter, present-state; state the
  clamp difference from `describePond` as a property of each function, not as a change.
- No README, guide, or skill changes here.

## Verification

```bash
npx nx test demo-koi-lib
npx nx lint demo-koi-lib --fix
npx nx typecheck demo-koi-lib
npx nx format:write --projects=demo-koi-lib
```
