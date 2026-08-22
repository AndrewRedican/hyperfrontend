# Variant seeds

Part of [Phase 1](README.md) · Guardrails: [plan index](../README.md)

## Goal

Let duplicates of a framework's koi share its species and palette while differing in
build, markings, and temperament: `koiVariantSeed(framework, instance)`.

## Files

- `apps/demos/koi-pond/lib/src/model/traits.ts`
- `apps/demos/koi-pond/lib/src/model/__tests__/traits.spec.ts` (extend)

## Design

- `koiVariantSeed(framework, 0)` returns exactly `koiSeed(framework)`: instance 0 is the
  canonical fish and must be pixel-identical to today across all eight frameworks.
- For `instance >= 1`, derive a jitter seed from the base seed and the ordinal
  (deterministic arithmetic on the existing seed scheme; any fixed odd multiplier works,
  the requirement is determinism and no collisions across the plausible ordinal range).
- **Channel split:** palette and variety stay bound to the framework's base seed; only the
  phenotype channels (build, markings, temperament) read the variant seed. Twins are the
  same species wearing different bodies. Where a trait derivation currently takes one seed,
  split its inputs rather than re-deriving palette from the variant seed.
- Append-only invariant (guardrail 4): `KOI_FRAMEWORKS` order and every trait band's order
  are untouched; the variant seed is derived, never inserted into any band.

## Specs

- Identity preservation: for every framework, `koiVariantSeed(f, 0)` equals `koiSeed(f)`,
  and a golden snapshot of the derived traits for all eight canonical fish is byte-stable
  against today's values.
- Duplicates differ: for a sample of ordinals, build/markings/temperament differ from the
  canonical fish while variety and palette are identical.
- Determinism: same framework and ordinal, same traits, across processes.

## Documentation impact

- JSDoc on `koiVariantSeed` stating the channel split as a present-state fact.
- No README, guide, or skill changes here.

## Verification

```bash
npx nx test demo-koi-lib
npx nx lint demo-koi-lib --fix
npx nx typecheck demo-koi-lib
npx nx format:write --projects=demo-koi-lib
```
