# Runtime loop

Part of [Phase 1](README.md) · Guardrails: [plan index](../README.md) · Depends on:
[01-motion-port.md](01-motion-port.md), [04-contract-0-8-0.md](04-contract-0-8-0.md) ·
Evidence: [recon §1](../recon.md#1-duplication-across-the-eight-fish-apps),
[recon §4](../recon.md#4-a-container-derived-card-world)

## Goal

Port the fish runtime loop into the lib as
`createKoiRuntime({ framework, root, link, rendererFactory, motionFactory? })` and give it
the three new behaviors: `resting`, outline `path` emission, and release-GL-on-hidden.

## Files

- New: `apps/demos/koi-pond/lib/src/runtime/koi-runtime.ts` (plus index export)
- Source of the port: `apps/demos/koi-pond/fish-vanilla/src/runtime/koi-runtime.ts`
  (367 loc; 7 of 8 copies within 2 to 7 stripped lines)
- Specs: `apps/demos/koi-pond/lib/src/runtime/__tests__/koi-runtime.spec.ts` (new)

## Design

- **Parameterization.** The one real per-app datum is the `FRAMEWORK` string: it becomes
  the `framework` argument. `rendererFactory` and `motionFactory` are already injectable in
  the per-app copies; keep those seams so lit can wrap the runtime in its
  `ReactiveController` and every app supplies its renderer. Canonicalize the naming drift
  (`ENTRY_DEPTH` wins over `OPENING_DEPTH` and the bare literal).
- **Hosted signal.** The per-app copies detect standalone with a `window.parent === window`
  check inside `originRelation()`. The lib runtime must not inherit that sniff: accept the
  hosted fact as an input (the glue module reads it from the SDK handle once
  [phase 2, item 1](../phase-2-isolated-improvements/01-lib-features-hosted.md) ships) and
  keep the runtime free of window-shape guessing.
- **`resting`.** On `pause {paused:true, resting:true}`: hold position, keep the scull
  animation, suppress the held silhouette, the identity card, and the inspector timers
  (the card 500ms and memory 10s timers never start). Plain `paused` without `resting`
  keeps today's held-inspection behavior exactly.
- **Path emission.** Attach `predictPath` output (at most 20 points) to the outgoing
  outline every outline tick. Always emitted: it is 20 `Vec2`s at 10Hz on a schema-less
  hot path, and the host overlay decides whether to use it. The call shape follows
  whichever signature [03-predicted-path.md](03-predicted-path.md) settles on, which is
  likely `motion.predictPath(n, dtStep)` rather than a free function over `motion.state`.
- **Release-GL-on-hidden.** On `sleep {paused:true}`, dispose the renderer (freeing the
  WebGL context and drawing buffers) after the loop stops; on wake, rebuild the renderer
  before resuming. Rebuild is staggered by a small per-instance delay derived from the
  identity's `instance` ordinal so a many-fish wake does not create every context in one
  frame.

## Specs

- Resting holds position across simulated frames, keeps scull output, and never starts the
  inspector timers; plain pause still traces the held silhouette.
- Sleep disposes the renderer exactly once; wake rebuilds it and resumes the loop; a
  sleep/wake/sleep flurry never double-disposes or leaks.
- Outline carries a path of at most 20 points every emission.
- The runtime never touches `window.parent` (assert via a spec-level seam or lint-visible
  absence; the hosted fact arrives as an argument).

## Documentation impact

- JSDoc on `createKoiRuntime` and its options in the house style, present-state; the
  `resting` and sleep semantics are documented as contract facts, not as changes.
- No README, guide, or skill changes here.

## Verification

```bash
npx nx test demo-koi-lib
npx nx lint demo-koi-lib --fix
npx nx typecheck demo-koi-lib
npx nx format:write --projects=demo-koi-lib
```
