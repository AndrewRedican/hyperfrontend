# Detect and handle an unresponsive feature

An embedded feature is someone else's runtime living in your page. It can hang, crash, lose its renderer process, or sit in a background tab where the browser throttles its timers to a crawl, and none of that announces itself. Unless the host watches for life, the first one to notice is the visitor staring at a dead panel.

The feature side emits a liveness beat once a second, as control traffic under the reserved `__hf:` prefix, and a host-side watchdog turns silence into a four-state judgement you can subscribe to. Wire that judgement into honest UI, measure the round trip on top of it, and judge product silence yourself, because liveness says the frame is running, not that the feature is doing its job.

The code below is the [heartbeat demo](https://demo-heartbeat-production.up.railway.app/host/): a React feature whose every contraction crosses the boundary as a contract `beat` event, and a framework-free vanilla-TS host that draws the rhythm while keeping SDK liveness in a separate Connection panel.

## Two heartbeats, two questions

| Layer                             | Cadence                      | Where the host sees it | The question it answers                    |
| --------------------------------- | ---------------------------- | ---------------------- | ------------------------------------------ |
| SDK liveness (`__hf:beat`)        | Fixed 1 s, not configurable  | `shell.on('status')`   | Is the feature frame alive and responsive? |
| Product events (`beat`, `rhythm`) | ~72 bpm, visitor-disturbable | Contract handlers      | What is the feature actually doing?        |

Control traffic under `__hf:` never reaches contract handlers, so the two can never be mistaken for one another however similar the words are. They can also disagree: hold the demo's heart for three seconds and the rhythm flatlines while the Connection panel does not move. A host that cares about both has to watch both.

## Open the session

<!-- snippet: create-shell -->

Nothing here is liveness-specific. The feature starts beating on its own, and the watchdog starts judging when the session opens. A generated shell package exposes the same `status` and lifecycle events, so everything below applies unchanged.

## Record the product traffic you observe

Most of this handler paints demo furniture. The line that matters is `lastBeatAt = receivedAt`: product silence is judged from timestamps you record yourself, and the SDK will not record them for you.

<!-- snippet: product-beats -->

The displayed rate comes from `rolling`, a window over beats the host actually received, never from the configured target. A stopped feature decays that number honestly instead of asserting a rate nobody is producing.

## Subscribe to the SDK's judgement

`status` fires on every liveness transition, carrying a snapshot object, `{ state, missedBeats, lastBeatAt }`, not a bare state string.

<!-- snippet: sdk-status -->

The four states, with the exact names the SDK reports:

- `healthy`: beats are arriving within the expected budget.
- `unobservable`: the host page or the feature page is hidden. Hidden tabs get their timers throttled, so silence stops being evidence and the watchdog pauses instead of guessing. Honest UI for this state says "can't judge right now", not "offline".
- `suspect`: both pages are visible and the miss budget is exhausted, which takes about three seconds of real silence.
- `gone`: the session is closed or destroyed, or has not opened yet.

What you do on `suspect` is a product decision. The demo reports it verbatim because the panel is the product; the docs-site gallery, hosting the same feature, refuses to demote an embed on `suspect` while product traffic still proves life.

## Judge product silence separately

The SDK cannot know how much product silence is normal for your feature. The demo's host decides that itself, twice a second, from two inputs: the feature's own admission (a `rhythm` event with `state: 'flatline'`) or silence past three expected beat intervals, measured against the last pacing rate it observed.

<!-- snippet: product-silence -->

<!-- TODO(asset): short capture of the live host page while holding the heart to flatline: ECG going flat, skull materialising, FLATLINE flag on, and the Connection panel still reading healthy with zero missed beats -->

## Measure the round trip

A state machine says alive or not, never how well. Every two seconds the host sends `ping` and the feature answers `pong`, echoing `sentAt`, so the difference covers the whole path back. The contract's `respondsWith` is what lets the host use `request` and await the reply:

<!-- snippet: ping-declaration -->

<!-- snippet: latency-probe -->

The probe skips quietly while the session is closed, and a rejected request blanks the readout rather than leaking an unhandled rejection; requests reject when the channel closes before the reply arrives.

## Recover when it comes back

A `suspect` feature that resumes beating recovers on its own. The next beat ends the episode, `status` fires `healthy` again, and the watchdog re-arms. Nothing to reset on your side.

A session that closes takes your product judgement with it, so reset everything you inferred from beats:

<!-- snippet: reset-on-close -->

Mid-session closes are often reloads, the feature having redeployed or refreshed itself; the SDK adopts the new document and product traffic resumes, which is why stale judgement must not bleed into the new session.

Close and reopen walk the full circle:

<!-- snippet: close-and-reopen -->

`close()` ends the session politely and the panel drops to `gone`; `open()` on the same shell remounts, and the panel climbs back to `healthy`.

## Check it worked

On the [live host page](https://demo-heartbeat-production.up.railway.app/host/):

- Hold the heart (pointer or Space) for three seconds. The ECG flatlines while the Connection panel keeps reading `healthy` with zero missed beats. Release, and `RECOVERING` shows while the measured rate climbs back.
- Switch to another tab for a few seconds and come back. The event log shows `sdk liveness: unobservable`, then `healthy`.
- Watch the latency tile refresh every two seconds.
- Press Close, then Reopen. The state walks to `gone` and back to `healthy`.

Your own host must walk the same transitions without you touching the feature's code.

## The limits, honestly

- `suspect` needs visible silence, and returning to visibility grants a fresh miss budget, because throttled beats need time to resume. A feature that died while the visitor was on another tab reports `unobservable`, then `healthy` for up to about three seconds after they return, and only then `suspect`, so wait for actual traffic before you call it recovered.
- The cadence is fixed at one beat a second with a budget of three, and `features` 0.7.0 gives you no way to tune the watchdog; a different silence budget means running your own deadline over product events.
- A same-origin feature shares the host's thread, so a busy spin freezes the host page with it and no watchdog anywhere gets to run. `suspect` earns its keep with cross-origin features, which browsers typically isolate into their own processes.

**Related:** [embed a feature someone else shipped](/docs/guides/embed-a-shipped-feature) · [host SDK reference](/docs/libraries/features/host)
