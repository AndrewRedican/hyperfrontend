# F-007 — Under `protocol: 'v1'` the SDK's own heartbeat never arrives: every host reports `suspect` three seconds after open, forever

| Field        | Value                                                                     |
| ------------ | ------------------------------------------------------------------------- |
| Category     | confusing-error                                                           |
| Severity     | high                                                                      |
| Surfaced by  | demo-heartbeat (Connection panel driven by `shell.on('status')` under v1) |
| Status       | open                                                                      |
| Disposition  | —                                                                         |
| Graduated to | —                                                                         |

## What happened

With both sides of a `@hyperfrontend/features@0.4.0` pairing declaring `protocol: 'v1'`, the connection opens and all product traffic flows normally — but the host's liveness watchdog transitions `healthy → suspect` exactly three seconds after open with `missedBeats: 3`, stays `suspect` for the life of the session, and fires the `onUnresponsive` policy (an `error` event under the default `emit`).

The cause is visible in the feature frame's console, once per second:

```
[nexus] host security error: Cannot create a packet without a valid data value
```

The hostee SDK emits its internal liveness beat (`__hf:beat`) with **no payload**. The v1 security envelope routes every outgoing message through the network-protocol packet layer, whose packet constructor rejects an `undefined` data value. So each beat dies in the sender's frame with a logged error, no beat ever reaches the host, and the watchdog's miss budget (3 ticks at 1 s) is exhausted right after open. Data-carrying messages — contract events, requests, dirty/visibility control traffic — envelope and deliver fine, which makes the pairing look perfectly healthy in every way _except_ the layer whose whole job is to say it is healthy.

Measured timeline (embedded host, no interaction; packet errors counted from the console):

| t after open | watchdog state | missedBeats | product events | packet errors |
| ------------ | -------------- | ----------- | -------------- | ------------- |
| 1 s          | healthy        | 0           | flowing        | 1             |
| 2 s          | healthy        | 0           | flowing        | 2             |
| 3 s          | **suspect**    | 3           | flowing        | 3             |
| 8 s          | suspect        | 3           | flowing        | 8             |

## Why it's friction (consumer lens)

- The liveness system silently self-destructs precisely when the consumer follows the security guidance ("production builds must pick `v1` or `v2`"). A perfectly live feature is reported unresponsive, and an `onUnresponsive: 'unmount'` host would tear down healthy features three seconds after every open.
- The failure is misattributed twice over: the console error is labeled a _security error_ in the _feature's_ frame, while the observable symptom (`suspect`, `error` event) appears on the _host's_ side of the boundary — nothing connects the two, and neither mentions the heartbeat.
- Nothing in the consumer's own code is involved: no contract action, no handler, no send. There is no app-level workaround other than abandoning the v1 envelope entirely.

## Proposed fix / improvement

Give the beat a payload (even an empty object) or exempt/handle payload-less control messages in the envelope path, so the reserved control types survive every negotiated protocol. A regression test that opens a v1 pairing and asserts the watchdog stays `healthy` past the miss threshold would have caught this; the same applies to any future payload-less control type.

## Repro / evidence

Both sides on `@hyperfrontend/features@0.4.0`, same-origin pairing:

```typescript
// feature
createFeature({ name: 'demo', contract, protocol: 'v1' })
// host
const shell = createShell({ modes: { embedded: mountEmbedded }, container: '#stage', url, contract, protocol: 'v1' })
shell.on('status', (status) => console.log(status)) // healthy at open, then { state: 'suspect', missedBeats: 3, ... } at ~3 s, never recovers
```

Feature-frame console logs `Cannot create a packet without a valid data value` at 1 Hz (the beat cadence). Switching both sides to `protocol: 'none'` — the only knob available to a consumer — restores `healthy` for the whole session and silences the errors.

Workaround used in demo-heartbeat: the demo pairs with `protocol: 'none'` so its Connection panel can demonstrate the four-state watchdog honestly, and documents the trade in its README.
