# F-022 — channel destruction is unobservable, so a peer-destroyed feature keeps its reporters running

| Field        | Value             |
| ------------ | ----------------- |
| Category     | api-friction      |
| Severity     | low               |
| Surfaced by  | jest-to-node-test |
| Status       | open              |
| Disposition  | —                 |
| Graduated to | —                 |

## What happened

The hostee starts its heartbeat emitter and visibility reporter on the channel's `open` event
and stopped them only on the channel's `close` event. `close` is not guaranteed to fire: it
comes from `finalizeClose`, which runs when a polite close is acknowledged or when its 2s
deadline (`DEFAULT_CLOSE_TIMEOUT_MS`) expires — but `channel.destroy()` deactivates the channel,
**clears that deadline timer, and fires no event at all**. Receiving the peer's DESTROY action
takes the same path (`handle-destroy.ts` → `channel.destroy(false)`).

The race is easy to hit because a polite close is not delivered synchronously even between
linked windows in one process: the CLOSE action goes through the security envelope, and both v1
and v2 encrypt asynchronously. So this sequence, measured in a single-pair probe:

1. `feature.close()` → CLOSE queued behind a crypto promise, 2s deadline armed, `closing` fires.
2. `shell.destroy()` in the same tick → host sends DESTROY (also deferred), host channel dies.
3. The DESTROY reaches the feature first or the CLOSE reaches a dead host — either way the
   feature's channel is destroyed silently, the deadline is cancelled, `close` never fires, and
   the heartbeat (1000ms) and visibility (2000ms) intervals run forever.

In `security-negotiation.browser.spec.ts` all six opened pairs leaked exactly this way — 12
intervals, total failure of the `afterEach` teardown, not an edge case. With 500ms between the
close and the destroy, the polite close completes and every interval stops: the close protocol
itself is sound when allowed to deliver.

Two earlier readings of this finding did not survive re-measurement: the deadline does exist
and works (it is cancelled, not absent), and "the host is still alive to acknowledge" was true
at call time but false at delivery time.

## What was fixed

- `FeatureHandle.close()` now stops the heartbeat and visibility reporters directly before
  disconnecting the channel (`fix(lib-features)`, 2026-09-01) — the same shape the host side
  already had, where `destroy()` calls `stopMonitor()` without waiting for a channel event. The
  features suite now terminates.
- The `destroy()` docblock in nexus claimed a `'destroy'` event that has never existed in the
  `ChannelEvent` union; corrected (`docs(lib-nexus)`).

## What remains — the actual friction

Nexus channel destruction is invisible to subscribers. Anything a consumer starts on `open` and
stops on `close` silently survives a **peer-initiated** destroy, because the receiving side runs
`channel.destroy(false)` and no event reaches the wiring. The features hostee no longer depends
on this for its own `close()`, but a host that destroys (rather than closes) a still-living
feature frame — a popup whose cleanup did not run, or any future consumer keyed to `close` —
leaks the same way.

What would resolve it: `destroy()` finalising through the close path (a `close` event with a
`reason: 'destroyed'`), or honouring the old docblock with a real `'destroy'` event. Either is a
nexus lifecycle-surface decision and should be taken deliberately, not as a drive-by.
