# Detect and handle an unresponsive feature

An embedded feature is someone else's runtime living in your page. It can hang, crash, lose its renderer process, or spend ten minutes in a background tab where the browser throttles its timers to a crawl. None of these announce themselves. Unless the host actively watches for life, the first one to notice a dead feature is the visitor staring at it.

The features SDK does the watching for you. Under every open session the feature side emits a liveness beat once a second, as control traffic under the reserved `__hf:` prefix, and a host-side watchdog turns silence into a four-state judgement you can subscribe to. This guide wires that judgement into honest UI, adds a measured round-trip probe on top, and marks the line the SDK will not cross for you: liveness says the frame is running, not that the feature is doing its job.

The worked implementation is the [heartbeat demo](https://demo-heartbeat-production.up.railway.app/host/), also embedded in the [demo gallery](/demos). A React feature renders an anatomical heart whose every contraction crosses the boundary as a contract `beat` event; a framework-free vanilla-TS host page draws the rhythm as an ECG, measures latency, and keeps the SDK's liveness in a separate Connection panel so the two layers stay distinguishable.

## Two heartbeats, two questions

The demo has two things that are both called a heartbeat, and the point of the demo is that they never touch:

| Layer                             | Cadence                      | Where the host sees it | The question it answers                    |
| --------------------------------- | ---------------------------- | ---------------------- | ------------------------------------------ |
| SDK liveness (`__hf:beat`)        | Fixed 1 s, not configurable  | `shell.on('status')`   | Is the feature frame alive and responsive? |
| Product events (`beat`, `rhythm`) | ~72 bpm, visitor-disturbable | Contract handlers      | What is the feature actually doing?        |

Control traffic under `__hf:` never reaches contract handlers, and contracts cannot declare `__hf:*` types, so the cardiac rhythm could not ride the transport heartbeat even if it wanted to. The separation cuts the other way too. Hold the demo's heart for three seconds and the rhythm flatlines: the ECG goes flat, a skull materialises over the heart, and the Connection panel does not move. The frame is perfectly healthy while its rhythm is dramatically dead. One layer answers "is it running?", the other "is it working?", and a host that cares about both has to watch both.

## Open the session

This host calls `createShell` from `@hyperfrontend/features/host` directly against the feature page URL; there is no generated shell in between. If your feature arrived as a shell package (the route [Embed a feature someone else shipped](/docs/guides/embed-a-shipped-feature) walks), everything below still applies, because a generated handle exposes the same `status` and lifecycle events.

<!-- snippet: create-shell -->

There is nothing liveness-specific to configure. The feature side starts beating on its own, and the watchdog starts judging when the session opens.

## Record the product traffic you observe

Every contraction arrives as a `beat` event. Most of this handler feeds the demo's furniture (a rolling bpm window, the ECG canvas, the toast and skull overlay painter, approval-gated audio), but the line that matters for detection is `lastBeatAt = receivedAt`: the host stamps every observation, because product silence is judged from timestamps you record yourself. The SDK will not do this half for you.

<!-- snippet: product-beats -->

Note the readout discipline. The displayed rate comes from `rolling`, a window over beats the host actually received, never from the configured target. If the feature stops, the number the visitor sees decays honestly instead of asserting a rate nobody is producing.

## Subscribe to the SDK's judgement

`status` fires on every liveness transition. The payload is a snapshot object, `{ state, missedBeats, lastBeatAt }`, not a bare state string. The demo pours it, unmodified, into the Connection panel:

<!-- snippet: sdk-status -->

The four states, with the exact names the SDK reports:

- `healthy`: beats are arriving within the expected budget.
- `unobservable`: the host page or the feature page is hidden. Hidden tabs get their timers throttled, so silence stops being evidence; the watchdog pauses instead of guessing. Honest UI for this state says "can't judge right now", not "offline".
- `suspect`: both pages are visible and the miss budget is exhausted, which takes about three seconds of real silence. The feature is probably unhealthy.
- `gone`: the session is closed or destroyed, or has not opened yet.

The full semantics live in the [host SDK reference](/docs/libraries/features/host) and in the [watchdog source](https://github.com/AndrewRedican/hyperfrontend/blob/main/libs/features/src/host/heartbeat.ts). What you do on `suspect` is a product decision, not an SDK one. The demo reports it verbatim because the panel is the product; the docs-site gallery, hosting the same feature, deliberately refuses to demote an embed on `suspect` while product traffic still proves life. When both layers go silent at once, that is when you warn or degrade.

## Judge product silence separately

The SDK cannot know how much product silence is normal for your feature. Only you know its rhythm, and the demo's host makes that judgement itself, twice a second, from two inputs: the feature's own admission (a `rhythm` event with `state: 'flatline'`) or too much silence measured against the last pacing rate it observed. The silence budget is three expected beat intervals; the pure judgement is `isFlatline` in [ecg.ts](https://github.com/AndrewRedican/hyperfrontend/blob/main/apps/demos/heartbeat/src/host/ecg.ts).

<!-- snippet: product-silence -->

The flags stay honest through the whole episode: `FLATLINE` while the rhythm is out, `RECOVERING` while it climbs back, nothing once it settles. And through all of it the Connection panel keeps reading `healthy` with zero missed beats. That contrast is the lesson: a silent feature and a dead feature look identical at the product layer, and opposite at the SDK layer, so an honest host reads both before it tells the user anything.

<!-- TODO(asset): short capture of the live host page while holding the heart to flatline: ECG going flat, skull materialising, FLATLINE flag on, and the Connection panel still reading healthy with zero missed beats -->

## Measure the round trip

A state machine says alive or not; it does not say how well. The demo adds a number. Every two seconds the host sends `ping` and the feature answers `pong`, echoing `sentAt`, so the difference is a full round trip through the SDK, the security envelope, the frame boundary, and the feature's own handler. The contract declares the correlation with `respondsWith`:

<!-- snippet: ping-declaration -->

which lets the host use `request` and receive the reply as a resolved promise. Plain `pong` listeners still observe the event.

<!-- snippet: latency-probe -->

Two details worth stealing: the probe skips quietly while the session is closed instead of erroring, and a rejected request paints the readout blank rather than leaking an unhandled rejection (requests reject when the channel closes before the reply arrives).

## Recover when it comes back

Recovery has three shapes here.

A `suspect` feature that resumes beating recovers on its own. The next beat ends the episode, the watchdog transitions back to `healthy`, and `status` fires again. There is nothing to reset on your side; the same handler that painted the suspicion paints the recovery, and the watchdog re-arms for the next episode.

A session that closes takes your product judgement with it. The demo resets everything it inferred from beats, because a host must stop judging a rhythm it no longer observes:

<!-- snippet: reset-on-close -->

Without that reset, closing mid-flatline would pin the skull and the `FLATLINE` flag over a frame that is no longer there. Mid-session closes are also often reloads (the feature redeployed or refreshed itself); the SDK re-adopts the new document and product traffic resumes, which is exactly why stale judgement must not bleed into the new session.

The third shape is deliberate. The demo's Close and Reopen buttons walk the full circle:

<!-- snippet: close-and-reopen -->

`close()` ends the session politely and the panel drops to `gone`; `open()` on the same shell remounts, and the panel climbs back to `healthy` as the new session opens.

## Check it worked

Open the [live host page](https://demo-heartbeat-production.up.railway.app/host/) and run the episodes yourself:

- Hold the heart (pointer or Space) for three seconds. The ECG flatlines and the skull appears while the Connection panel keeps reading `healthy`. Release, and `RECOVERING` shows while the measured rate climbs back.
- Switch to another tab for a few seconds and come back. The event log shows `sdk liveness: unobservable`, then `healthy`.
- Watch the latency tile refresh every two seconds.
- Press Close, then Reopen. The state walks to `gone` and back to `healthy`.

Your own host proves itself the same way: the status panel (or whatever you map the states to) must move through these transitions without you touching the feature's code.

## The limits, honestly

- `suspect` needs visible silence, and returning to visibility grants a fresh miss budget, because throttled beats need time to resume before silence means anything again. A feature that died while the visitor was on another tab therefore reports `unobservable`, then `healthy` for up to about three seconds after they return, and only then `suspect`. Do not celebrate on the `unobservable` to `healthy` transition alone; wait for actual traffic.
- The cadence is fixed: one beat a second, a budget of three. You cannot tune the watchdog in `features` 0.7.0. If your product needs a different silence budget, run your own deadline over product events, the way the [gallery host does](/docs/guides/embed-a-shipped-feature).
- A same-origin feature shares the host's thread. If it wedges the main loop with a busy spin, the host page freezes with it and no watchdog anywhere gets to run. The `suspect` state earns its keep with cross-origin features, which browsers typically isolate into their own processes.
- A beating frame is not a working product. The liveness beat comes from the feature's SDK runtime, so product logic can be wedged while the state reads `healthy`. That is not a gap to fix; it is the reason this guide made you watch both layers.

## Where to go next

- The general embedding recipe, including a proof-of-life deadline on a generated shell and a fallback UI for dead origins: [Embed a feature someone else shipped](/docs/guides/embed-a-shipped-feature).
- The full host handle surface, `status` and lifecycle payloads included: [host SDK reference](/docs/libraries/features/host) and the wider [features reference](/docs/libraries/features).
- Why liveness lives in the SDK while geometry and presentation belong to the host: [features architecture](/docs/libraries/features/architecture).
- The demo itself, both heartbeats documented side by side: [heartbeat README](https://github.com/AndrewRedican/hyperfrontend/blob/main/apps/demos/heartbeat/README.md).
