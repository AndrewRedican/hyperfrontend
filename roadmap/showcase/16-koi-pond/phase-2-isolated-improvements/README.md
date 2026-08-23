# Phase 2: Isolated improvements

Five self-contained fixes with no dependency on phase 1 and no dependency on each other.
Each is a complete, independently shippable change. Decisions and guardrails:
[plan index](../README.md).

## Sub-plans

| #   | Sub-plan                                                    | Project(s)    | Why it is here                                                                          |
| --- | ----------------------------------------------------------- | ------------- | --------------------------------------------------------------------------------------- |
| 01  | [SDK `hosted` signal](01-lib-features-hosted.md)            | lib-features  | The one prerequisite the instance model has on the SDK; gates phase 3's deferred boot   |
| 02  | [Visibility reconciliation](02-visibility-polling.md)       | demo-koi-pond | Field evidence of a visible transition no listener saw, leaving a paused pond on screen |
| 03  | [Floor and interactions DPR cap](03-floor-dpr-cap.md)       | demo-koi-pond | The two 2D canvases still paint at raw device pixel ratio                               |
| 04  | [Gallery outer resurrection](04-docs-embed-resurrection.md) | docs-site     | The gallery leaves a dead iframe mounted; mirror of the pond's inner policy             |
| 05  | [Device tier](05-device-tier.md)                            | demo-koi-pond | The shoal cap's classification module, needed by phase 3                                |

## Release-order warning (gates phase 3)

Item 01 changes the **published** `@hyperfrontend/features` package, and every demo
consumes the published package, never workspace source. Land and release 01 before
starting [phase 3, deferred boot](../phase-3-instance-model/03-deferred-boot.md). The
change is a `feat` and must produce a **minor** version bump; the automated changelog
window has under-bumped before, so verify the computed bump before merging the release.

Item 02 carries a second, smaller SDK change on the same package
([the SDK half](02-visibility-polling.md#the-sdk-half-approved-in-scope)): the demo half
cannot clear a watchdog parked at `unobservable`, which is half of the failure it addresses.
It is a `fix` riding this same release and needs no separate bump.

## Phase gate

```bash
npx nx run-many -t test build lint typecheck -p lib-features
npx nx run-many -t test build lint typecheck -p demo-koi-pond
npx nx run-many -t test lint typecheck -p docs-site
```

## Documentation impact (phase rollup)

Item 01 is the only one with a shipped-docs surface, and it is substantial; its sub-plan
enumerates every file. Items 02 through 05 are code plus specs only.
