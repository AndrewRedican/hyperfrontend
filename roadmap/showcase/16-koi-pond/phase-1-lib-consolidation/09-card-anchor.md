# Card anchor

Part of [Phase 1](README.md) · Guardrails: [plan index](../README.md) · Evidence:
[recon §1](../recon.md#1-duplication-across-the-eight-fish-apps)

## Goal

Move the identity-card clamp math into the lib as one function and end the live signature
divergence (preact drifted to `PondWindow` where react/angular use `PondEnvironment`).

## Files

- New: `apps/demos/koi-pond/lib/src/model/card-anchor.ts` (exported beside
  `describeKoiCard` in the model index)
- Source of the port: `apps/demos/koi-pond/fish-react/src/koi/card-anchor.ts` (react and
  angular are byte-identical; their `PondEnvironment` signature is canonical)
- Specs: `apps/demos/koi-pond/lib/src/model/__tests__/card-anchor.spec.ts` (new)

## Design

- Input is the structural pose (head position) plus the environment; output is the clamped
  card position. Identical math to the react copy; the four apps that open-code the clamp
  in `placeCard` adopt the function during
  [phase 3 migration](../phase-3-instance-model/05-fish-migration.md).
- Inline the `CardSize` interface question away: export the interface from the lib (solid
  currently inlines it).

## Specs

- Golden clamp cases: center, each edge, each corner, and an oversized card in a small
  environment; byte-stable against today's react output.

## Documentation impact

- JSDoc on `cardAnchor` and `CardSize`, present-state.
- No README, guide, or skill changes here.

## Verification

```bash
npx nx test demo-koi-lib
npx nx lint demo-koi-lib --fix
npx nx typecheck demo-koi-lib
npx nx format:write --projects=demo-koi-lib
```
