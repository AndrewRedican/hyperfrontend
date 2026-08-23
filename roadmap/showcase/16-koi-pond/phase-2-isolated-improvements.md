# Phase 2: Isolated improvements (shipped)

Five self-contained fixes, none dependent on phase 1 or on each other. All five shipped by
2026-08-23 and their documents were collapsed into this record; what remains here is only
the residue phases 3 to 5 build against.

## What shipped

| Delivered                  | Where it lives                                                                    |
| -------------------------- | --------------------------------------------------------------------------------- |
| SDK `hosted` signal        | `libs/features/src/hostee/types.ts`, `hostee/lifecycle.ts`                        |
| Visibility reconciliation  | `libs/features/src/shared/page-visibility.ts`, koi `host/src/scene/visibility.ts` |
| Canvas pixel-ratio cap     | `apps/demos/koi-pond/host/src/scene/pixel-ratio.ts`                               |
| Gallery outer resurrection | `apps/docs-site/src/components/demos/embed-resurrection.ts`                       |
| Device tier                | `apps/demos/koi-pond/host/src/runtime/device-tier.ts`                             |

## Release gate (cleared)

The gate cleared on 2026-08-23: `@hyperfrontend/features` **0.8.0** published carrying
the `hosted` signal and the visibility fix, as a correct minor bump (the changelog
window did not under-bump this time). The pond host and all eight fish pin 0.8.0, and
the [phase 3 repack](phase-3-instance-model.md#the-repack) rebuilt every vendored shell
against it, so the SDK-side fixes reach the inner sessions in the composed build.
[Deferred boot](phase-3-instance-model.md#the-boot-decision) is written against the
released handle.

## The `hosted` signal

`FeatureHandle` carries a readonly `hosted: boolean`, set by the time `createFeature`
returns and readable before any handshake. Facts later phases code against:

- **Synchronous and static.** True when a host window exists (an iframe parent or a window
  opener), false for a top-level document. It promises only that a candidate host exists
  and the channel is armed toward it, never that the host will speak; connection state
  stays with `ready()`, `open`, and the lifecycle events.
- **Vocabulary trap for [phase 5 doctrine](phase-5-integration/03-doctrine-rewrites.md).**
  Never describe `hosted: false` as "standalone" in shipped prose. `DisplayMode.Standalone`
  names a hosted arrangement (a host-opened tab has an opener, so it reads `hosted: true`).
  All four display modes are hosted; `hosted: false` has no display mode, ever. The
  unhosted case is "top-level" or "a direct visit".
- **`displayMode` is the other question.** `hosted` answers whether a host exists;
  `displayMode` stays null until the host's Present announcement and answers how the
  feature was mounted.
- **The sniffs it retires.** `window.parent === window` lives in `originRelation()` in all
  eight fish apps; the lib runtime takes hosted-ness as an argument
  ([phase 1, runtime](phase-1-lib-consolidation.md#runtime)) and the
  [phase 3 migration](phase-3-instance-model.md#the-migration-shape) feeds it from
  this handle; no sniff survives.
- Phase 5's doctrine sweep reads `apps/demos/koi-pond/README.md` and its clock and
  heartbeat neighbours only to confirm no sentence implies a feature cannot know it is
  unhosted; they need no koi-driven changes.

## Visibility reconciliation

The pond and the SDK both read visibility rather than take it on notice: an announcement
has to be delivered to be heard, and a document that misses the return to visible holds a
stopped clock and eight sleeping koi in front of a visitor looking right at them. An event,
a 2s poll, and a probe animation frame armed only while hidden all settle the same state;
silence never puts the pond to sleep.

- **`dispose()` is an obligation, not a courtesy.** `createVisibilityWatch`
  (`host/src/scene/visibility.ts`) releases its listener, poll and probe frame on
  `dispose()`. Nothing calls it yet. The
  [expand choreography](phase-5-integration/01-expand-choreography.md) destroys the card
  instance to cold-open the expanded one, and a discarded instance still holding a
  timer and a probe frame would keep waking a scene that no longer exists.
- **Resurrection no longer listens for itself.** `createResurrection` takes an `isHidden()`
  seam and exposes `pageVisible()`; the pond calls it from the watch's `apply`. The
  [instance refactor](phase-3-instance-model.md#the-instance-model) and the
  [expand choreography](phase-5-integration/01-expand-choreography.md) both touch this
  handle.
- **One overlay instrument shipped early**, as an explicit exception to
  [phase 4's ownership](phase-4-chrome-and-overlay.md#the-vitals-overlay) of the overlay:
  the vitals panel title reads `vitals · visible` or `vitals · hidden`, refreshed every
  probe, so a capture carries the browser's own answer beside the log that says what the
  pond believes. The log vocabulary stays `page-hidden` and `page-visible` with a source
  detail: `by event`, `by poll`, `by frame`.
- **SDK side.** `watchPageVisibility` (`libs/features/src/shared/page-visibility.ts`) is
  the shared reconciler both wrappers reduce to, and its reports are change-only. It ships
  in the release above.
- **Device acceptance stays with [phase 5](phase-5-integration/05-device-acceptance.md)**:
  a capture from the S24 Ultra showing either a `page-visible` recovery line or no missed
  edge at all, with the panel title agreeing with the last line of the log.

## Canvas pixel-ratio cap

`MAX_CANVAS_DPR` is 2 (`host/src/scene/pixel-ratio.ts`), applied by the floor, the
interactions overlay and the 2D surface painter, matching the ceiling the WebGL surfaces
already lived by. A straight capability cap: no tiering, no user-agent checks. The
[card profile](phase-3-instance-model.md#card-and-full-profiles) inherits it with no work.

## Gallery outer resurrection

`createEmbedResurrection` (`apps/docs-site/src/components/demos/embed-resurrection.ts`)
gives the docs-site embed the policy the pond already ran inside itself: on an
`unresponsive` verdict that outlives a 4s grace, destroy the mount (which takes the
browser's crash tile with it), then reopen on a 4/12/36s backoff, 3 attempts per episode,
budget restored after 60s of presence. A held attempt never reopens into a hidden page and
re-reads visibility on every grace.

It sits on the generic embed path, so clock and heartbeat inherit the healing. The
[expand choreography](phase-5-integration/01-expand-choreography.md) applies it to whichever
instance is current: a pending revive for a destroyed instance cancels on the swap.

## Device tier

`readDeviceProfile()` (`host/src/runtime/device-tier.ts`) returns `{tier, cap}` from
`navigator.deviceMemory` and `navigator.hardwareConcurrency`. Capability signals only; no
user-agent sniffing.

- **low, cap 4**: at most 2GB or at most 4 cores.
- **high, cap 12**: at least 8GB and at least 8 cores.
- **middle, cap 8**: everything else, and any device that withholds either signal, so
  Safari and Firefox land here by construction. Unknown means middle, never low.
- Eight frameworks swim in this pond, so duplicates only become reachable above 8: the cap
  is the only mechanism, and no separate duplicate gate exists.

The cap feeds the [dynamic shoal](phase-3-instance-model.md#the-shoal-handle) and the
[shoal panel's](phase-4-chrome-and-overlay.md#the-shoal-panel) refusal state; the tier
name goes into the
[vitals boot record](phase-4-chrome-and-overlay.md#the-vitals-overlay).

## Findings

- **F-020** (a feature cannot know it is unhosted) and **F-021** (a missed visibility edge
  parks every watchdog at `unobservable`) are resolved by the release above and were cleared
  from the registry in [phase 5](phase-5-integration/04-findings.md), which tracks open
  friction only.
- [F-018](../findings/018-no-way-to-revive-a-session-whose-frame-died.md) and
  [F-019](../findings/019-dead-iframe-left-mounted-paints-the-browser-crash-placeholder.md)
  stay open as SDK friction: the gallery resurrection above is the hand-rolled policy they
  ask the SDK to carry, so both are triaged to `api-refinement` against this record rather
  than cleared.
