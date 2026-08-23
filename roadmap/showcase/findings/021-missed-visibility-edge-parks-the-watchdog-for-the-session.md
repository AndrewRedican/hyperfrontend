# F-021 — A visibility edge my page never received parks every watchdog at `unobservable`, and nothing I can call resets it

| Field        | Value         |
| ------------ | ------------- |
| Category     | api-friction  |
| Severity     | high          |
| Surfaced by  | demo-koi-pond |
| Status       | open          |
| Disposition  | —             |
| Graduated to | —             |

## What happened

My host page opens eight features and relies on the heartbeat verdicts to notice when a
frame dies. On an Android phone, the page went hidden while the visitor switched apps, and
came back. The return produced no `visibilitychange` in my document: the browser's next
event was another `hidden`, 85 seconds later, with the visitor looking at the page the whole
time in between.

From that moment every session's status stayed `unobservable` for the rest of the session.
The watchdog had been told the page was hidden and had no other way to learn otherwise, so
it never judged another beat, and the one failure I use it for (a frame the OS killed) could
no longer reach me.

## Why it's friction (consumer lens)

The SDK derives observability from `visibilitychange` alone and holds the result in internal
state I cannot see or correct. That makes an event delivery I do not control into a
permanent, silent capability loss, and the API gives me no lever:

- There is no way to re-read or reset observability. `FeatureShell` exposes `open`, `close`,
  `destroy`, `send`, `request`, `handle`, `on`, `isOpen` and `isDirty`, and none of them
  touches the watchdog's view of my page.
- The only workaround is `open()` on every session, which cold-restarts each feature,
  destroys its state and re-runs every handshake. For a scene of eight that is a full
  restart to clear a boolean.
- Nothing reports it. The status stream keeps saying `unobservable`, which is
  indistinguishable from an honestly backgrounded page, so a host cannot even detect the
  condition and work around it.

`unobservable` exists because a hidden page throttles timers and beats, so silence carries
no information there. That premise is testable at runtime rather than assumable from an
event: a page receiving animation frames is a page whose timers are not throttled.

## Proposed fix / improvement

Stop trusting the edge inside the SDK, where every host and every feature benefits at once:

- Reconcile the observed state against `document.visibilityState` on a coarse interval, and
  against a probe animation frame armed while the page is believed hidden. A frame that is
  delivered is direct evidence the page is being rendered and not throttled. On a genuinely
  hidden page the request is never serviced, so the correction costs nothing.
- Failing that, expose any way at all for a host to say "re-read the page state", so a
  consumer who detects the condition can recover without reopening every session.

## Repro / evidence

Not reproducible on demand: it depends on the browser omitting an event. Observed once on a
physical Galaxy S24 Ultra, Chrome 151, Android, on a top-level page (no embedding involved),
captured by the demo's own diagnostics overlay:

```
20:29:27 +9s   vanilla status:unobservable missed 1     (all eight sessions, one line each)
20:29:27 +9s   pond page-hidden
20:29:29 +11s  preact buffer 887x887 to 795x795
20:30:54 +96s  pond page-hidden
```

One document and one session throughout (the elapsed counter never resets and no reload
marker appears between the two lines). `visibilitychange` fires only on a state change, so
the second `hidden` proves the state returned to `visible` in between; no listener in the
document ran for it, since a delivered event would have produced eight status lines and a
`page-visible` line. Screen captures timestamped between the two lines show the visitor
looking at the live page.

The same exposure exists on the feature side: `createVisibilityReporter` announces the
feature page's visibility from the same event, and the host holds that report as
`peerHidden`.
