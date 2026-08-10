# F-011 — a host with seven open features receives ~9 messages a second in total, and silently drops the rest

| Field        | Value         |
| ------------ | ------------- |
| Category     | api-friction  |
| Severity     | high          |
| Surfaced by  | demo-koi-pond |
| Status       | open          |
| Disposition  | —             |
| Graduated to | —             |

## What happened

The koi pond runs seven features at once, each reporting a compact position snapshot ten times a
second on a schema-less action. With one feature open that works exactly as written. With seven,
**87% of the messages never arrive**, and nothing anywhere reports a problem.

Measured on both sides of the boundary — a counter at the `feature.send()` call and a counter in
the host's `shell.on(...)` handler — on an idle four-core machine, same origin, `protocol: 'v1'`:

| Open features | Feature emits | Host receives | Delivered |
| ------------- | ------------- | ------------- | --------- |
| 1             | 9.6 /s        | 9.4 /s        | 98%       |
| 7             | 9.1 /s        | 0.8 /s        | 9%        |

Seven channels each delivering ~1/s is ~8/s in total — almost exactly what a _single_ channel
delivers on its own. The host behaves as though it has one fixed message budget that every
feature then divides between them.

Ruled out, each by measurement rather than reasoning:

- **Machine load.** Load average was 0.6–1.9 on four cores for every figure above. An earlier run
  under load average 3.7 gave the same ratios.
- **The host's main thread.** Host `requestAnimationFrame` only fell 51 → 41 fps going from one
  feature to seven, and a zero-delay `setTimeout` still resolved in 22.6 ms (21.5 ms with one).
  The event loop is healthy; it is simply not being handed the messages.
- **The feature's own loop.** The sending frame ran at 40–50 fps throughout and its send counter
  confirmed 9.1–9.6 calls a second in every configuration.
- **Contention with host-to-feature traffic.** The host was also sending each feature a relay
  every 120 ms. Slowing that to 2000 ms — a sixteenfold cut in outbound volume — moved inbound
  delivery only from 1.2 /s to 1.6 /s.
- **Delay rather than loss.** Sampling over 20 s instead of 5 s made it _worse_ (0.8 /s), so the
  messages are not queued and delivered late. They are gone.

## Why it's friction (consumer lens)

A consumer builds one feature, measures it, and sees a clean 10 Hz channel. They add a second and
a third. Nothing errors, nothing warns, no `error` event fires, and `isOpen` stays `true` on every
shell — the app just gets progressively wronger. In this demo the visible symptom was that hover
identity stopped working: the host was hit-testing against position reports that were, by then,
360 px stale.

The failure mode is the difficult kind: silent, load-dependent, and invisible in the
single-feature case every consumer starts from. There is also no backpressure signal to code
against — nothing tells a feature "you are sending faster than this host can receive", so a
consumer cannot even adapt their cadence deliberately.

Composing many features on one page is the product's whole proposition, so the ceiling being
roughly _one feature's worth of throughput shared between all of them_ is a limit worth either
lifting or documenting loudly.

## Root cause (source dive, adversarially verified 2026-08-08)

Not consumer-visible; recorded for triage. Every claim below was re-derived from source by
independent verification passes.

**The budget is PBKDF2.** Under `protocol: 'v1'` every packet is obfuscated by AES-GCM-encrypting
it with a time-window password and a **fresh random 16-byte salt per message**
(`libs/cryptography/src/lib/encrypt/create-encrypt.ts:34-46`); the key for that salt is derived
with **PBKDF2 at 100,000 iterations** (`libs/cryptography/src/lib/generate-key/create-key-generator.ts:37-49`).
Random per-message salt makes key reuse impossible by construction, so that is one full derivation
per send. On receive, deobfuscation tries up to three window passwords (current/previous/next,
1-minute windows), and a wrong password fails only **after** paying the full derivation
(`libs/network-protocol/src/lib/packet/security/obfuscation/time-interval-obfuscation-factory.ts:66-84`,
`libs/cryptography/src/lib/decrypt/create-decrypt.ts:31-35`) — one derivation per packet in the
common case, three for a stale or clock-skewed one. The inner dynamic-key layer is pass-through in
the features SDK (the envelope always carries `key: ''`, which routes to
`serializeWithoutEncryption` — `libs/nexus/src/security/transport/secure-transport.ts:113-125`,
`libs/network-protocol/src/lib/packet/security/encryption/dynamic-encryption-key.ts:38-51`), so
obfuscation is the _entire_ crypto cost. At tens of milliseconds per derivation, a machine-wide
budget of roughly the measured ~9 messages/s falls out; every channel shares it.

**Why the main thread looked healthy.** Web Crypto runs the derivations on a background pool, so
`requestAnimationFrame` and `setTimeout` stay clean while each channel's deobfuscation queue
`await`s its derivations strictly one message at a time
(`libs/network-protocol/src/lib/queue/creators/create-queue.ts:73-79`).

**Why the messages are gone rather than late.** Inbound queues are unbounded
(`create-queue.ts:37-46`; the backing FIFO has no capacity check). Window passwords are computed at
_dequeue_ time, so queueing delay counts against the ~1–2-minute window tolerance; a packet that
outlives it fails all three passwords — at triple derivation cost — and is then silently discarded:
the deobfuscation queue's `onFail` is a noop
(`libs/network-protocol/src/lib/receiver/creators/create-receiver-factory.ts:25-28`). The failure
never reaches nexus (the `security-error` try/catch covers only the synchronous enqueue), and the
features SDK forwards only `closing`/`deny`/`invalid` to the shell's `error`
(`libs/features/src/shared/channel-wiring.ts:64-69`). Stale packets burning triple budget to
produce nothing starve the fresh packets behind them — a death spiral, which is why the 20 s
sample measured _worse_ than the 5 s one.

**What it is not.** The seven-listener fan-out (hypothesis 1 below, kept for the record) is real
but cheap: each non-owning broker rejects a foreign message with a WeakMap lookup by source window
_before_ any crypto (`libs/nexus/src/broker/routing/route-encrypted-message.ts:49-55`); only the
owning broker ever decrypts. Backpressure plumbing (`stop`/`resume`) exists end-to-end through
queue, receiver, channel, and transport — nothing ever invokes it on queue depth.

## Proposed fix / improvement

1. ~~Seven page-level `message` listeners, O(features²) dispatch~~ — measured and source-verified
   as **not** the bottleneck (see root cause); a routed single listener would tidy, not fix.
2. **Make per-message key derivation cheap.** A deterministic per-(password, window) salt plus a
   small `CryptoKey` cache drops the cost to ~one AES-GCM op per side, and is wire-compatible in
   both directions because the salt already travels in the packet (`create-decrypt.ts:31`).
   Trade-off to decide deliberately: per-message random salt is what forces an eavesdropper to pay
   one PBKDF2 per captured packet; a per-window salt collapses that work factor from O(packets) to
   O(windows), weakening the deterrence economics that are this layer's stated purpose.
   Alternatives in the same budget: fewer iterations for the obfuscation layer specifically, or an
   HKDF chain off one per-window master derivation.
3. **Shed load before paying for it.** Bound the inbound queues, drop over-age packets _before_
   derivation (they can only fail), and wire the existing `stop`/`resume` backpressure hooks to
   queue depth.
4. **Make the drop observable.** Wire the receiver's `onFail` upward — today there is no event to
   forward, because the drop happens a layer below nexus. Silently dropping a contract action a
   feature successfully `send()`-ed is the part that costs a consumer the most time.
5. Document the practical per-host feature count and the aggregate message rate the SDK sustains,
   so a consumer can design a cadence instead of discovering one.

Packaging note for triage: the published `@hyperfrontend/features` bundles all first-party deps,
so a fix in `libs/cryptography`/`libs/network-protocol` reaches every SDK consumer by republishing
**features alone** — no cascade through the intermediate packages is required for shell/SDK users.

## Repro / evidence

```bash
npx nx run-many -t=build -p demo-koi-*
npx http-server dist/apps/demos/koi-pond/site -p 4288      # seven features
# then the same tree with six fish-* directories removed   # one feature
```

Count `feature.send('outline', …)` calls in the feature frame and `shell.on('outline', …)`
invocations in the host over a fixed window, at both feature counts. The full harness used is in
this effort's session scratchpad (`rate.mjs`, `fps.mjs`).

**Workaround in the demo:** the pond drops `protocol: 'v1'` on its seven pond ↔ fish channels
(the single gallery ↔ pond channel keeps v1). Unsecured channels are first-class — `protocol` is
optional and defaults to `'none'` (`libs/features/src/shared/types.ts:349-350`) — and the plain
path does zero crypto, so the collapse does not apply; the seven channels are same-origin
sub-paths of one deploy, so the security envelope was demonstrating nothing there anyway. The
host additionally dead-reckons received outlines forward by heading × speed as presentation
smoothing. Caution discovered while verifying the workaround: the SDK has no fail-closed mode —
`registerSecurity` never sets one — so a `v1` pin is advisory and any counterpart omitting
`protocol` silently downgrades that channel to plaintext with only a console warning.
