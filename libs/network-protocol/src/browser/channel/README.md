# channel

Browser-side channel factories pre-wired with the browser sender and receiver implementations.

## Overview

A channel is a named, bidirectional, queue-backed conduit that binds one protocol instance to one negotiated session. This entry point composes the runtime-agnostic channel logic from `lib/channel` with the browser sender (`/browser/sender`) and receiver (`/browser/receiver`), so `createChannel` needs a label and an options object: the transport callbacks, a `ProtocolProvider` from `/browser/v3` or `/browser/v4`, the `ProtocolSession`, and an optional `onDrop` handler. The channel exposes the protocol's hello exchange (`hello`, `isHello`, `acceptHello`) so the session can be keyed over the same transport.

## Usage

```typescript
import { createChannel, createChannelStore } from '@hyperfrontend/network-protocol/browser/channel'
import { createProtocol } from '@hyperfrontend/network-protocol/browser/v3'
import { createLogger } from '@hyperfrontend/logging'

const channel = createChannel('app-to-widget', {
  send: (frame) => otherWindow.postMessage(frame, origin, [frame.buffer]),
  receive: (packet) => handle(packet.data.message),
  protocolProvider: createProtocol(createLogger({ level: 'info' })),
  session: { protocol: 'v3', role: 'initiator', localId, peerId },
  onDrop: (drop) => report(drop),
})
otherWindow.postMessage(await channel.hello(), origin)
window.addEventListener('message', ({ data }) => (channel.isHello(data) ? channel.acceptHello(data) : channel.receive(data)))

const store = createChannelStore()
store.add(channel)
```

## Notes

- `createChannelStore` produces a registry for managing multiple channels by label or UUID; `store.create(label, options)` creates and registers in one step.
- `channel.outbound` and `channel.inbound` each expose `queue.size`, `stop`, and `resume`; `channel.stop()` and `channel.resume()` act on both.
- Validation helpers (`isValidChannel`, `isValidLabel`, `isValidReceiver`, `isValidSender`, `isValidSession`, `getFirstInvalidProtocolProperty`) are re-exported for upstream guards.
- The Node.js counterpart lives at `/node/channel`.
