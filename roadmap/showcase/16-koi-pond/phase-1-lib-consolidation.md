# Phase 1: Foundation (shipped)

Phase 1 grew `demo-koi-lib` into the single home of the shared koi simulation. All eleven
sub-plans shipped by 2026-08-22 and their documents were collapsed into this record; what
remains here is only the residue that phases 2 to 4 build against. Everything landed
additive to the lib: the eight fish apps held their local copies until the
[phase 3 migration](phase-3-instance-model.md#the-migration-shape), and the doctrine
consequences of that adoption are tracked in
[phase 3, doctrine coherence](phase-3-instance-model.md#doctrine-coherence).

## What shipped

| Delivered                                           | Where it lives (`apps/demos/koi-pond/lib/src/`)            |
| --------------------------------------------------- | ---------------------------------------------------------- |
| Motion brain `createKoiMotion` + retuned manoeuvres | `motion/koi-motion.ts`, `motion/manoeuvre.ts`              |
| Shared integrator + predicted path                  | `motion/predict.ts` (`stepFlight`, `predictFlight`)        |
| Contract 0.8.0 + wire plumbing `wireKoiContract`    | `contract/koi-fish.contract.ts`, `contract/wire.ts`        |
| Runtime loop `createKoiRuntime`                     | `runtime/koi-runtime.ts` (+ `runtime/browsing-context.ts`) |
| Variant seeds `koiVariantSeed`                      | `model/traits.ts`                                          |
| Frame-derived world + instance-aware entry          | `geometry/virtual-pond.ts`                                 |
| Three.js stage `createKoiStage`                     | `three/koi-stage.ts`                                       |
| Card anchor `cardAnchor`/`cardTransform`            | `model/card-anchor.ts`                                     |
| Shared fish chrome stylesheet                       | `styles/fish.css`                                          |
| Guide extraction markers moved with the wire port   | `contract/wire.ts` (`neighbors-handler` region)            |

The lib's specs carry every behaviour obligation the fish apps deliberately do not test;
the parity and retune suites are mutation-proven.

## Predicted path

Facts the [phase 4 pearl trace](phase-4-chrome-and-overlay/03-pearl-trace.md) is built
against:

- The path is `motion.predictPath(steps, dtStep)` on `KoiMotion`: curved predicted
  advancement (position samples), never a direction ray. At most 20 points
  (`KOI_PATH_MAX_POINTS`), the producer enforces the cap.
- **Accuracy is the contract.** `predictPath` integrates with the same stepping math as
  the brain's own advance (`stepFlight` in `motion/predict.ts` is the one integrator both
  call); absent a new decision, the realized trajectory passes within tolerance of every
  predicted point. The realized-trajectory parity spec is mutation-proven.
- The prediction deliberately ignores future decisions: it shows what the currently wound
  manoeuvre does. When the brain commits a new decision mid-horizon, the next emitted
  path simply disagrees with the previous one from the divergence point on; the overlay
  detects that geometrically and redraws the stale suffix. No extra signal is emitted.

## Contract 0.8.0

`KOI_CONTRACT_VERSION` reads 0.8.0 in the lib. Both sides must agree on major and minor
below 1.0.0, so the bump went live when host and fish repacked together in the
[phase 3 repack](phase-3-instance-model.md#the-repack). The additions:

- `pause` carries `resting?: boolean`. With `paused: true, resting: true` the fish holds
  position and sculls, and suppresses the held-inspection chrome entirely (no held
  silhouette, no identity card, no inspector timers). Plain `paused` keeps the
  held-inspection behaviour exactly. The card host sends it in the
  [phase 3 card profile](phase-3-instance-model.md#card-and-full-profiles).
- `identity` carries a required `instance: number`: 0 for the canonical fish of a
  framework, 1..n for duplicates. The host-chosen `seed` remains the authority the fish
  obeys; the host derives it per instance via `koiVariantSeed(framework, instance)`.
- `outline` optionally carries `path?: Vec2[]`, capped at 20 points by the producer, not
  by wire validation; the outline stays a schema-less hot path by design.

`wireKoiContract` (`contract/wire.ts`) is deliberately SDK-free: it types against the
structural `FeatureLink`, so the lib gains no `@hyperfrontend/features` dependency.

## Runtime

`createKoiRuntime` (`runtime/koi-runtime.ts`) is the shared fish loop. Facts later phases
lean on:

- **Hosted-ness is an argument.** The runtime never touches `window.parent` (spec-guarded);
  the glue module supplies the hosted fact. The
  [phase 2 `hosted` signal](phase-2-isolated-improvements.md#the-hosted-signal) is
  its intended source, and the [phase 3 migration](phase-3-instance-model.md#the-migration-shape)
  feeds it from the SDK handle; no per-app `window.parent` sniff survives.
- `resting` holds position, keeps the scull, and never starts the inspector timers.
- The outgoing outline carries the predicted path every emission.
- Release-GL-on-hidden: `sleep {paused: true}` disposes the renderer after the loop
  stops; wake rebuilds it, staggered by a per-instance delay derived from the identity's
  `instance` ordinal so a many-fish wake never creates every GL context in one frame.

## Frame-derived world

`describePondForFrame(width, height, reducedMotion)` (`geometry/virtual-pond.ts`) derives
the world from the frame's own container instead of the device screen:

- It bypasses `MIN_POND`, so a 288px container yields a 288-scale world instead of an
  800x600 world seen through a 288px window. `MIN_FISH_LENGTH` (130) stays the governing
  floor (the card koi spanning roughly half the card edge is the intended look);
  `MAX_POND` still applies. Above `MIN_POND` it equals `describePond` exactly.
- It is a sibling entry point, not a flag: the eight fish standalone fallbacks keep
  `describePond` untouched. Only the host's call site changed, in the
  [phase 3 card profile](phase-3-instance-model.md#card-and-full-profiles).
- `entryStation(pond, seed, instance)` is instance-aware: ordinal 0 stations are
  byte-identical to the canonical ones; duplicates jitter by the variant seed so twins
  never spawn stacked, respecting the existing separation relaxation.

## Guide extraction markers

The guides pipeline live-extracts marked regions from demo sources, declared in
`apps/docs-site/content/guides/compose-independent-features/meta.json` `snippetSources`
and parsed by `apps/docs-site/scripts/generate-guides.ts` (region syntax
`ref: [guide:slug/region]`). The `neighbors-handler` region moved into
`lib/src/contract/wire.ts` with the wire port and the guide prose describes the shared
plumbing; `npx nx run docs-site:build` is the authoritative extraction gate.

Current inventory:

- `apps/demos/koi-pond/fish-vanilla/feature.config.ts`: `fish-config`
- `apps/demos/koi-pond/fish-vanilla/koi-fish.contract.ts`: `shared-contract`
- `apps/demos/koi-pond/lib/src/contract/wire.ts`: `neighbors-handler`
- `apps/demos/koi-pond/host/src/hyperfrontend.feature.ts`: `outer-boundary`
- `apps/demos/koi-pond/host/src/scene/koi-sessions.ts`: `shell-factories`, `open-shoal`
- `apps/demos/koi-pond/host/src/scene/pond.ts`: `survive-close`, `retry-open`,
  `relay-fanout`

The host-file markers sit inside files the
[phase 3 instance refactor](phase-3-instance-model.md#the-instance-model) rewrote; they
stayed intact and extraction-green through it, and the whole set is re-verified against
the final shape in [phase 5](phase-5-integration/02-guides-verification.md).
