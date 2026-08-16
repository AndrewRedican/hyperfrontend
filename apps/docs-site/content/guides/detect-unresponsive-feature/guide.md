# Detect and handle an unresponsive feature

By the end of this guide your host notices a failing feature within seconds, tells the visitor something honest about it, measures how well the connection is performing, and recovers cleanly when the feature returns.

That is worth doing because an embedded feature is someone else's runtime living in your page. It can hang, crash, lose its renderer process, or sit in a background tab where the browser throttles its timers to a crawl, and none of that announces itself. Two signals answer two different questions: the SDK's watchdog says whether the feature's frame is alive, and your own contract events say whether it is doing its job. Either can be healthy while the other is not, so a host that cares watches both.

The code examples come from the [heartbeat demo](https://demo-heartbeat-production.up.railway.app/host/), whose host keeps the two signals in separate panels.

## 1. Open the session

<!-- snippet: create-shell -->

The watchdog starts judging when the session opens, whether you reached it through [`createShell`](/docs/libraries/features/host#api-createShell) or a generated shell package.

## 2. Stamp the product traffic you observe

Product silence is judged from timestamps you record yourself.

<!-- snippet: product-beats -->

Derive any displayed rate from the events you actually received, never from the feature's configured target.

## 3. Subscribe to the SDK's judgement

<!-- snippet: sdk-status -->

Each transition hands you a [`HeartbeatStatus`](/docs/libraries/features/host#api-HeartbeatStatus) snapshot. Give each of its four [states](/docs/libraries/features/host#api-HeartbeatState) a different move:

- `healthy`: clear whatever warning you raised.
- `unobservable`: say "can't judge right now", never "offline", because [throttled timers](https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API) make silence meaningless.
- `suspect`: decide per product. Report it verbatim when connection state is the product; do not demote a working embed on suspicion alone.
- `gone`: drop the session-scoped state you inferred from beats.

## 4. Judge product silence separately

Product silence is yours to define. Decide it from two inputs: the feature's own admission through a contract event, and silence measured against the last cadence you observed.

<!-- snippet: product-silence -->

<!-- TODO(asset): short capture of the live host page while holding the heart to flatline: ECG going flat, skull materialising, FLATLINE flag on, and the Connection panel still reading healthy with zero missed beats -->

## 5. Measure the round trip

Measure latency on top of the state to learn how well the connection is performing, not just whether it is up. Send a probe on an interval and have the feature echo the send time back, so the difference covers the whole path.

<!-- snippet: ping-declaration -->

Declaring [`respondsWith`](/docs/libraries/features/host#api-ActionDescription) names the reply action so the contract validates the pairing. What resolves the host's [`request`](/docs/libraries/features/host#api-ShellHandle) is the feature registering a handler for the probe.

<!-- snippet: latency-probe -->

Skip the probe while the session is closed, and handle rejection: requests reject when the channel closes before the reply arrives.

## 6. Reset your judgement when the session closes

A session that closes takes your product judgement with it, so reset everything you inferred from beats. Mid-session closes are often reloads; the SDK adopts the new document and traffic resumes, so stale judgement must not bleed into the new session.

<!-- snippet: reset-on-close -->

A `suspect` feature that resumes beating needs no reset at all. The next beat ends the episode and the watchdog re-arms.

<!-- snippet: close-and-reopen -->

## Check it worked

Your host must walk these transitions without you touching the feature's code:

- Stop the feature's product traffic while leaving the frame alive. Your product-silence flag raises; the SDK state stays `healthy` with zero missed beats.
- Switch to another tab for a few seconds and come back. The state goes `unobservable`, then `healthy`.
- Close, then reopen. The state walks to `gone` and back to `healthy`.

## Limits

- `suspect` needs visible silence, and returning to visibility grants a fresh miss budget, because throttled beats need time to resume. A feature that died while the visitor was on another tab reports `unobservable`, then `healthy` for up to about three seconds after they return, and only then `suspect`. Wait for actual traffic before you call it recovered.
- The watchdog runs a fixed cadence of one beat a second against a budget of three. For a different silence budget, run your own deadline over product events, and set an [`onUnresponsive`](/docs/libraries/features/host#api-UnresponsivePolicy) policy to choose what the shell does when the budget trips.
- A same-origin feature shares the host's thread, so a busy spin freezes the host page with it and no watchdog anywhere gets to run. `suspect` earns its keep with cross-origin features, which browsers typically isolate into their own processes.
