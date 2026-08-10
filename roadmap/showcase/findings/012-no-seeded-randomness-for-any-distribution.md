# F-012 — every distribution draws from `Math.random`, so nothing reproducible can use them

| Field        | Value           |
| ------------ | --------------- |
| Category     | missing-feature |
| Severity     | medium          |
| Surfaced by  | demo-koi-pond   |
| Status       | open            |
| Disposition  | —               |
| Graduated to | —               |

## What happened

The koi pond derives each fish's physical traits, markings and entry position from a stable
per-framework seed, so the React koi looks like _the same fish_ on every load, in every frame, on
every machine. `@hyperfrontend/random-generator-utils` looked like the tool for it — it ships
`randomGaussian`, `randomUniform`, `randomExponential`, `randomPowerLaw`, `randomLogarithmic` —
but every one of them draws from the global `random()` internally and none accepts a seed or a
source. The only deterministic exports are `randomPseudo(seed)` (a stateless `sin(seed) * 10000`
fractional hash) and `randomPseudoTimeBased`.

So the demo could not use the distribution the trait design called for (`randomGaussian` for
trait spreads). Every reproducible value is instead hand-built from `randomPseudo` with manually
decorrelated seed offsets, and gaussian-shaped spreads were approximated or abandoned.

## Why it's friction (consumer lens)

Reproducibility is one of the two headline reasons a consumer reaches for a randomness package
instead of `Math.random` (the other being distributions). This package has each half but not
their combination: distributions that cannot be seeded, and a seedable primitive that is not a
generator (stateless — the consumer must invent their own decorrelation scheme for each
successive draw, and a `sin`-hash has visible structure for sequential seeds). Any use case that
needs "same input, same picture" — procedural art, property-based test fixtures, simulations —
falls into the gap.

## Proposed fix / improvement

1. A seeded generator constructor — e.g. `createRandomGenerator(seed)` returning the full
   distribution API (`uniform`, `gaussian`, `exponential`, …) off a small stateful PRNG
   (mulberry32-class), so one seed yields a reproducible _stream_.
2. Or minimally: every distribution accepts an optional `source: () => number` last parameter
   defaulting to the current behaviour.
3. Document that `randomPseudo` is a stateless hash, not a PRNG, and show the decorrelation
   pattern for consumers who use it as one.

## Repro / evidence

```typescript
import { randomGaussian } from '@hyperfrontend/random-generator-utils'
randomGaussian(0, 1) // no seed parameter exists; two runs never agree
```

`libs/utils/random-generator/src/random-gaussian.ts:30-31` (and the other four distributions)
call the built-in-copy `random()` directly. The demo's workaround is
`apps/demos/koi-pond/lib/src/model/traits.ts` — every trait derived from `randomPseudo` with
hand-offset seeds.
