# Detect and handle an unresponsive feature

An embedded feature is someone else's runtime living in your page. It can hang, crash, lose its renderer process, or sit in a background tab where the browser throttles its timers to a crawl, and none of that announces itself.

Two signals answer two different questions. The SDK's liveness watchdog says whether the feature's frame is alive; your own contract events say whether the feature is doing its job. Watch both, because either can be healthy while the other is not.

Every snippet is extracted from the [heartbeat demo](https://demo-heartbeat-production.up.railway.app/host/).

## 1. Open the session

<!-- snippet: create-shell -->

Nothing here is liveness-specific: the watchdog starts judging when the session opens.

## 2. Stamp the product traffic you observe

Product silence is judged from timestamps you record yourself; the SDK will not record them for you.

<!-- snippet: product-beats -->

Derive any displayed rate from the events you actually received, never from the feature's configured target.

## 3. Subscribe to the SDK's judgement

<!-- snippet: sdk-status -->

Handle all four states, and give each one a different move:

- `healthy`: clear whatever warning you raised.
- `unobservable` (either page hidden, so throttled timers make silence meaningless): say "can't judge right now", never "offline".
- `suspect` (both pages visible, miss budget exhausted): decide per product. Report it verbatim when connection state is the product; do not demote a working embed on suspicion alone.
- `gone`: drop the session-scoped state you inferred from beats.

## 4. Judge product silence separately

The SDK cannot know how much product silence is normal for your feature. Decide it from two inputs: the feature's own admission through a contract event, and silence measured against the last cadence you observed.

<!-- snippet: product-silence -->

<!-- TODO(asset): short capture of the live host page while holding the heart to flatline: ECG going flat, skull materialising, FLATLINE flag on, and the Connection panel still reading healthy with zero missed beats -->

## 5. Measure the round trip

A liveness state never says how well. Send a probe on an interval and have the feature echo the send time back, so the difference covers the whole path. Declare the reply action with `respondsWith` so the contract validates the pairing, and register a handler for the probe on the feature side, which is what resolves the host's `request`.

<!-- snippet: ping-declaration -->

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
- The cadence is fixed at one beat a second with a budget of three, and `features` 0.7.0 gives you no way to tune the watchdog. A different silence budget means running your own deadline over product events.
- A same-origin feature shares the host's thread, so a busy spin freezes the host page with it and no watchdog anywhere gets to run. `suspect` earns its keep with cross-origin features, which browsers typically isolate into their own processes.
