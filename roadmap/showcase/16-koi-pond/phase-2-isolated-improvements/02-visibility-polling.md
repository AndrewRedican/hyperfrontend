# Visibility reconciliation

Part of [Phase 2](README.md) · Guardrails: [plan index](../README.md) · Evidence: the
device log quoted below (`s24u-recon/device-evidence/`, 2026-08-21, S24 Ultra, Chrome 151,
standalone Railway origin)

This is the locked "visibility polling" perf fix. The poll survives and is the correctness
mechanism; the claim the item was written on, and the design that followed from that claim,
are corrected here.

## The evidence, restated

One vitals session, standalone pond (the pond is the top-level document, not an embed):

```
20:29:18 +0s   pond boot dpr=2.8125 screen=384x832 view=384x693 isolated=true cores=8
20:29:18 +0s   pond agent Mozilla/5.0 (Linux; Android 10; K) ... Chrome/151.0.0.0 Mobile Safari/537.36
...
20:29:27 +9s   vanilla status:unobservable missed 1
20:29:27 +9s   react   status:unobservable missed 1
20:29:27 +9s   vue     status:unobservable missed 0     (all eight, one line each)
20:29:27 +9s   pond page-hidden
20:29:29 +11s  preact buffer 887x887 to 795x795
20:30:54 +96s  pond page-hidden
```

Three things the log establishes on its own:

- **One document, one session.** The elapsed counter runs `+9s` to `+96s` without resetting,
  and neither a `boot` line nor a `previous-session` line sits between them. The overlay
  persists its ring buffer across a page death and prints both markers on the next mount
  (`vitals.ts`, `mountVitals`), so a cross-session splice would be visible. It is not a
  splice.
- **One dispatch, two listeners.** The eight `status:unobservable` lines land in the same
  second as, and immediately before, the pond's own `page-hidden`. The SDK subscribes to
  `visibilitychange` inside `shell.open()` (`openShoal`, `pond.ts:160`), ahead of the pond's
  own listener at `pond.ts:679`, so both are reacting to a single event.
- **The visitor was in the page between the two lines.** The captures are timestamped 21:30
  and 21:31 device local (UTC+1); the 21:31 capture shows the `+96s` line already rendered,
  so the document composited a frame at or after the moment it believed itself hidden.

The one inference that is airtight: `visibilitychange` fires only when the visibility state
changes, so a second `hidden` dispatch requires the state to have returned to `visible` in
between. That transition ran no listener in this document. A delivered dispatch would have
written eight `status:*` lines and a `pond page-visible` line; the log has neither.

What the evidence does **not** establish, and what the previous wording asserted, is that
`visibilitychange` "fired `hidden` twice". Nothing observed a duplicate dispatch. Two hidden
_observations_ separated by an unobserved visible transition is a different and weaker
statement, and it is the only one the log supports. The mechanism behind the unobserved
transition stays open: a dropped dispatch, a document whose task queues were frozen across
the app-switch excursion and discarded the pending event, or a state that changed without
the update steps running. The device pass cannot yet tell them apart, so the fix must not
depend on which one is true.

## The premise to correct: nothing in the pond latches

The previous design said every event-driven visibility consumer in the pond "can latch the
wrong state", and reconciled "latched state" against `document.visibilityState`. No such
latch exists:

- `pond.ts:679-690` reads `document.hidden` fresh inside the handler and acts on that read.
- `resurrection.ts` reads `document.hidden` fresh in both places it cares
  (`fire()` at `:120`, `onVisibilityChange()` at `:130`).

Both are correct at the instant they run. What fails is that they never run again. Three
consequences the design has to be built around:

**The exposure is a missing notification, not a stale mirror.** There is no wrong value to
detect. There is an action already taken on a true premise (`loop.stop()` plus eight
`sleep {paused:true}` sends) that nothing revisits. Reconciliation therefore has to compare
the browser against _what the pond last applied_, which means introducing the mirror the
pond does not have today, deliberately and in one place.

**The two directions are not symmetric.** A missed `hidden` costs almost nothing: the
browser stops serving animation frames to a hidden document whatever the pond believes, so
the loop stalls by itself, and the eight fish are same-page frames that stall with it. The
residue is the fish's own interval timers, an already-documented wart. A missed `visible`
freezes a scene the visitor is looking at, because waking is an action only the host can
take: every fish stays paused until a `sleep {paused:false}` arrives and nothing else in the
pond sends one. This design is built for the visible direction; the hidden direction is
corrected only to keep the mirror honest.

**The component that does latch is the SDK.** `observePageVisibility`
(`libs/features/src/host/visibility.ts:18-26`) is edge-driven, and its callback writes
`selfHidden` in `createShell` (`libs/features/src/host/lifecycle.ts:317-327`), which gates
`monitor.setObservable` and parks the heartbeat at `unobservable`
(`heartbeat.ts:121-131`). A missed `visible` edge pins that flag for the rest of the
session, which is exactly the second half of the field report: all eight watchdogs parked
at `unobservable` for minutes. Nothing in the demo can clear it. `FeatureShell` exposes
`open`, `close`, `destroy`, `send`, `request`, `handle`, `on`, `isOpen`, `isDirty` and
nothing that re-reads observability, so the only demo-side lever is `open()` on all eight
sessions, which cold-restarts the whole scene. See [the SDK half](#the-sdk-half-approved-in-scope) below: a
pond-only fix restores the animation and the fish and leaves every watchdog blind, so the
next real frame death raises no `error:unresponsive` and resurrection never hears about it.

## Design

### One authority; every other consumer is told

A single `createVisibilityWatch` owns the browser relationship and holds the applied state.
It emits one call, `apply(hidden)`, and only when the value differs from the one already
applied. The pond's response moves into that callback unchanged: `loop.stop()` or
`loop.start()`, the eight `sleep` sends, the diagnostic line.

Resurrection stops listening for itself. It gains an `isHidden()` seam in its options and a
`pageVisible()` method replacing `onVisibilityChange`, and the pond calls it from `apply`.
One party in the pond trusts the browser; everything else is told what that party concluded.
This also removes the second document listener and makes the resurrection specs drive the
policy directly instead of dispatching document events.

### The poll is the correctness backstop

One coarse interval (2s) reads `document.visibilityState` and settles any disagreement in
either direction. Because the failure is a lost notification and not a wrong state, this
alone fixes it. Its throttled reality has to be stated rather than assumed: on a truly
hidden page Chrome aligns timers to one-second wake-ups and drops to roughly one per minute
after five minutes hidden, and a frozen page runs no timers at all. None of that delays a
wake, because a page whose frames and timers are being served is not hidden in the first
place.

### A probe frame buys the latency back

The previous design named the frame loop as a corroborating source: "a running rAF loop is
itself proof of visibility". The proof is sound and the wiring cannot work. `FrameLoop.stop`
cancels its outstanding request (`raf-loop.ts`, `stop()`), so in precisely the state that
needs correcting there is no loop left to observe.

The watch therefore keeps its own probe frame, armed only while it believes the page is
hidden. On a genuinely hidden document that request is never serviced, which is what makes
it free: no callback, no work, no battery, the property the original handler exists to
protect. When it is serviced, the browser is painting this document, so the watch re-reads
the state there and then: a visitor's return wakes the scene on the first painted frame
instead of up to two seconds later.

The state is still what the wake is taken from, even on the probe path. Overruling it (a
sustained run of frames forcing a wake against a `visibilityState` that keeps saying
`hidden`) was designed and dropped: the same inference that makes the field report readable
argues against the case it would cover. A second `hidden` dispatch requires an intervening
transition to `visible`, so the state was right and only the notification was lost; a state
genuinely stuck at `hidden` would have suppressed that second dispatch too. Worse, an
overrule fights the poll it cannot see: the poll reads `hidden` two seconds later, sleeps
the scene, the frames force it awake again, and the pond flaps on a loop, sixteen wire sends
at a time. It would take real evidence of painting under a stuck state (a capture showing
`vitals · hidden` beside a scene that is visibly animating) to justify building the
machinery that contains that.

### Never sleep on silence

Frames stopping is ambiguous: it is equally a hidden page, a blocked main thread, a stalled
GPU process. The pond goes to sleep only on the event or on a poll that reads `'hidden'`,
never because frames stopped arriving.

### Idempotence and diagnostics

`settle(hidden, source)` is the only mutator and returns early when the value already
matches: no `apply`, no diagnostic, no churn. Any number of redundant `hidden` events, poll
agreements, or probe frames produce nothing.

The vitals vocabulary stays `page-hidden` and `page-visible` (the overlay keys row state off
the kind), and gains a detail naming the source: `by event`, `by poll`, `by frame`. A
recovery is then visibly distinct from an ordinary wake in the log, which is what the next
device pass needs to confirm the fix fired at all.

One instrument travels with this item as an explicit exception to phase 4's ownership of the
overlay: the panel's own title reads `vitals · visible` or `vitals · hidden`, refreshed
every probe. The 2026-08-21 analysis asked for the state to be recorded per probe line; the
title carries it without spending a log line every five seconds, and it puts the browser's
own answer into every screen capture beside the log that says what the pond believes. A
capture showing the two disagreeing is the whole diagnosis.
[Phase 4, vitals updates](../phase-4-chrome-and-overlay/05-vitals-updates.md) owns
everything else about the overlay.

### Disposal

The watch exposes `dispose()`: listener removed, interval cleared, probe frame cancelled.
The scene handle has no teardown today and `createResurrection().dispose()` is likewise
unwired, so nothing calls it yet, and its specs cover it. It is not optional all the same:
[phase 3](../phase-3-instance-model/README.md) destroys the card instance to cold-open the
expanded one, and a discarded instance still holding a timer and a probe frame would keep
waking a scene that no longer exists.

## Files

Demo half:

- `apps/demos/koi-pond/host/src/scene/visibility.ts` (new): `createVisibilityWatch`, with
  its platform seams injected the way `FrameLoopHost` does it in `raf-loop.ts`, so specs
  drive frames, polls and events by hand instead of monkey-patching a document.
- `apps/demos/koi-pond/host/src/scene/pond.ts`: the inline listener at `:679-690` becomes
  the watch's `apply`; `createResurrection` receives `isHidden`; `apply(false)` calls
  `resurrection.pageVisible()`.
- `apps/demos/koi-pond/host/src/scene/resurrection.ts`: internal listener and both
  `document.hidden` reads replaced by the injected `isHidden()`; `pageVisible()` exported on
  the handle.
- `apps/demos/koi-pond/host/src/components/vitals.ts`: the panel title carries the browser's
  own answer.
- Specs: `apps/demos/koi-pond/host/src/scene/__tests__/visibility.spec.ts` (new),
  `resurrection.spec.ts` (rewritten off document events onto `pageVisible`).

SDK half:

- `libs/features/src/shared/page-visibility.ts` (new) plus its browser spec; both wrappers
  (`host/visibility.ts`, `hostee/visibility.ts`) reduced to it; `ARCHITECTURE.md` liveness
  paragraph; the hostee visibility and lifecycle browser specs adjusted for change-only
  reports and for the second interval a session now holds.

## Specs

House pattern for this project is vitest with `vi.useFakeTimers()` and injected seams, as in
`resurrection.spec.ts` and `raf-loop.spec.ts`. (The jest built-in-copy mock rule belongs to
`lib-features`, not here; the previous draft prescribed it by mistake.)

- A missed `visible` edge: state flips with no event, the probe frame is delivered, the pond
  wakes, `page-visible by frame` is recorded once.
- The same correction from the poll when no frame is delivered: `page-visible by poll`.
- A frame served while the state still reads `hidden` (the trailing frame on the way out)
  wakes nothing and leaves the probe armed.
- A missed `hidden` edge is corrected by the poll, and no probe frame is ever requested
  while the pond is awake.
- Agreement is silent: redundant events, agreeing polls and repeated probe frames after a
  wake produce no second `apply` and no second diagnostic.
- `dispose()` leaves no listener, no interval and no outstanding frame.
- Resurrection: a deferral raised while hidden re-runs its grace on `pageVisible()`, and
  `isHidden()` is consulted rather than the document.

## The SDK half (approved; in scope)

The pond-side fix restores the frozen scene. It cannot clear a parked watchdog, and the
parked watchdog is the half of the field report that disables resurrection for the rest of
the session. The gap is one function: `observePageVisibility`
(`libs/features/src/host/visibility.ts`) is the single choke point for the host watchdog,
and `createVisibilityReporter` (`libs/features/src/hostee/visibility.ts`) is its feature-side
twin feeding `peerHidden`. Correcting the observer there fixes every host and every feature
built on the SDK at once, including the pond, and is the shape the trust model calls for:
the SDK is the party allowed to know about the runtime, and hosts should not each be
inventing a reconciler.

- One shared module, `libs/features/src/shared/page-visibility.ts`, holds the reconciliation
  (`watchPageVisibility`); both existing modules become thin wrappers, and the host keeps
  its document-less guard so a server-side import stays inert.
- Reports become change-only. They have to: with a poll behind them, reporting on every
  read would put a visibility message on the control channel every two seconds. The hostee
  specs that dispatched a no-op event to count sends are rewritten around a real transition.
- Timers come from `@hyperfrontend/immutable-api-utils/built-in-copy/timers` (the rule
  covers `requestAnimationFrame` and `setInterval` alike), so the spec drives them through a
  `jest.mock` of that module rather than a raw global override.
- Cost to be honest about: the watcher is per subscriber, so a host with eight open
  sessions runs eight polls and, while hidden, eight probe frames over one document. Each is
  a property read; sharing one watcher per document would need refcounted module state in a
  published SDK, which is not worth the teardown-ordering risk at this size.
- It rides the same release train as [item 01](01-lib-features-hosted.md): a `fix` alongside
  that `feat`, absorbed by the minor bump already required there, with no contract change.

## Finding first

Guardrail 7 files the finding **before** the workaround, not when it lands (the previous
draft had this backwards). Filed as
[F-021](../../findings/021-missed-visibility-edge-parks-the-watchdog-for-the-session.md),
distinct from [F-020](../../findings/020-feature-cannot-know-it-is-unhosted.md): a host page
that misses a visibility edge pins the SDK's heartbeat at `unobservable` for the session,
the API offers no way to re-read or reset observability, and the only lever a consumer has
is reopening every session. The SDK half above is what answers it.

## Documentation impact

None shipped by the demo half. Code comments carry the why in single prefixed lines: an
announcement has to be delivered to be heard, and the pond's own loop cannot be the
corroborating evidence because it is stopped. No mention of the device investigation, the
plan, or the trajectory (guardrail 1).

The SDK half: JSDoc on `watchPageVisibility` and both wrappers, plus one paragraph in
`libs/features/ARCHITECTURE.md` under the liveness section stating that both sides read
visibility rather than take it on notice. The `detect-unresponsive-feature` guide needs no
edit: every claim it makes about `unobservable` stays true, since the change only affects
what happens when an announcement never arrives.

## Verification

```bash
npx nx run-many -t test build lint typecheck -p lib-features
npx nx test demo-koi-pond
npx nx lint demo-koi-pond --fix
npx nx typecheck demo-koi-pond
npx nx format:write --projects=demo-koi-pond,lib-features
```

Specs alone cannot show that a real browser recovers, and the missed dispatch cannot be
provoked on demand. The equivalent browser probe simulates it: redefine the
`document.visibilityState` getter and omit the event, the manoeuvre
`s24u-recon/liveness-probe.mjs` already performs with the dispatch left in. Run against
`demo-koi-pond:dev-hosted` (durable copy beside that file as `visibility-probe.mjs`), the
sequence is: announce `hidden`, confirm the scene stops painting (two clipped screenshots
700ms apart are byte-identical, so the water and all eight koi are frozen), pin the state
back to `visible` with nothing dispatched, and confirm the log gains exactly one
`pond page-visible by frame` and the screenshots differ again.

Result on 2026-08-23, Chromium 1228 over SwiftShader:

```
2. baseline: the scene is painting
3. announced hidden: ["00:10:56 +23s pond page-hidden by event"]
4. the scene is stopped and the shoal is asleep
5. flipped to visible with no announcement: [..., "00:10:59 +26s pond page-visible by frame"]
6. the scene is painting again and the shoal is awake
```

The probe covers the demo half only. The pond consumes vendored shells built against the
published SDK, so the SDK half is exercised by its own browser specs until the release
lands and the shells are repacked.

Device acceptance stays with [phase 5](../phase-5-integration/README.md): a capture from the
S24 Ultra showing either a `page-visible` recovery line or no missed edge at all, with the
panel title agreeing with the last line of the log.
