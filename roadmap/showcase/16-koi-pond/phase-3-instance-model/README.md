# Phase 3: Core (instance model, dynamic shoal, card profile, fish migration)

The structural heart of the plan: the host stops assuming "one session per framework,
eight forever" and becomes instance-based; the fish adopt the consolidated lib; the whole
family repacks on contract 0.8.0.

Depends on [phase 1](../phase-1-lib-consolidation.md) (shipped: lib primitives, contract)
and [phase 2](../phase-2-isolated-improvements/README.md) (published `hosted` signal,
device tier). Decisions and guardrails: [plan index](../README.md). Evidence:
[recon §3](../recon.md#3-eight-fish-assumptions-in-the-host) and
[recon §4](../recon.md#4-a-container-derived-card-world).

## Sub-plans, in execution order

| #   | Sub-plan                                           | Depends on                       |
| --- | -------------------------------------------------- | -------------------------------- |
| 01  | [Instance-ID refactor](01-instance-id-refactor.md) | phase 1                          |
| 02  | [Dynamic shoal machinery](02-dynamic-shoal.md)     | 01, phase 2 item 05              |
| 03  | [Deferred boot](03-deferred-boot.md)               | 01, phase 2 item 01 **released** |
| 04  | [Card profile](04-card-profile.md)                 | 01, 03                           |
| 05  | [Fish migration](05-fish-migration.md)             | phase 1 complete                 |
| 06  | [Repack pipeline](06-repack-pipeline.md)           | all of the above                 |

05 can proceed in parallel with 01 through 04 (different projects), but 06 is strictly
last: the 0.8.0 contract only goes live when host and all eight fish repack together.

## Doctrine coherence

The moment 05 lands, the pond README's standing doctrine sentence ("never a simulation
engine") is false. Phases 3, 4, and 5 therefore land on `main` in the same release cycle;
the doctrine rewrite ships in
[phase 5](../phase-5-integration/03-doctrine-rewrites.md). Do not merge phase 3 to `main`
in a cycle that will not also carry phase 5.

## Phase gate

```bash
npx nx run-many -t test build lint typecheck -p demo-koi-lib demo-koi-pond demo-koi-fish-vanilla demo-koi-fish-react demo-koi-fish-vue demo-koi-fish-svelte demo-koi-fish-solid demo-koi-fish-preact demo-koi-fish-lit demo-koi-fish-angular
npx nx run-many -t build -p demo-koi-lib demo-koi-pond demo-koi-fish-vanilla demo-koi-fish-react demo-koi-fish-vue demo-koi-fish-svelte demo-koi-fish-solid demo-koi-fish-preact demo-koi-fish-lit demo-koi-fish-angular
npx http-server dist/apps/demos/koi-pond/site -p 4288
```

Browser checks against the composed build (SwiftShader recipe in the koi skill):

- Standalone opens the hour-anchored trio instantly (no fallback wait: `hosted` is false).
- Add koi to the tier cap; the refusal at cap+1 is visible and diagnosed.
- Duplicates of one framework show distinct phenotypes, same species and palette.
- Remove tears down the layer and its WebGL context.
- The kill-probe heal cycle stays green per instance.
- Hide/show releases and rebuilds contexts (staggered, no context storm).
- Simulated card boot opens one resting fish, no held chrome, surface depth, wake ripples.
- A staged head-on pair breaks right and clears without oscillation; hard turns visibly
  brake (the retune arriving through the repack).

## Documentation impact (phase rollup)

No shipped prose changes in this phase by design; every doctrine and guide consequence is
deliberately batched into phase 5 so it ships against the final shape. The one exception:
guide extraction markers inside host files being refactored must stay intact and
extraction-green ([phase 1, guide markers](../phase-1-lib-consolidation.md#guide-extraction-markers)
lists them).
