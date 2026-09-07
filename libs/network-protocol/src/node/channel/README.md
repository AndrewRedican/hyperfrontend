# channel

Node-side channel factories pre-wired with the Node.js sender and receiver implementations.

## Overview

A channel is a named, bidirectional, queue-backed conduit that binds one protocol instance to one negotiated session. This entry point composes the runtime-agnostic channel logic from `lib/channel` with the Node sender (`/node/sender`) and receiver (`/node/receiver`), so `createChannel` needs a label and an options object: the transport callbacks, a `ProtocolProvider` from `/node/v3` or `/node/v4`, the `ProtocolSession`, and an optional `onDrop` handler. The channel exposes the protocol's hello exchange (`hello`, `isHello`, `acceptHello`) so the session can be keyed over the same transport.

## Usage

```typescript
import { createChannel, createChannelStore } from '@hyperfrontend/network-protocol/node/channel'
import { createProtocol } from '@hyperfrontend/network-protocol/node/v3'
import { createLogger } from '@hyperfrontend/logging'

const channel = createChannel('parent-to-worker', {
  send: (frame) => process.send?.(frame),
  receive: (packet) => handle(packet.data.message),
  protocolProvider: createProtocol(createLogger({ level: 'info' })),
  session: { protocol: 'v3', role: 'initiator', localId, peerId },
  onDrop: (drop) => report(drop),
})
process.send?.(await channel.hello())
process.on('message', (data) => (channel.isHello(data) ? channel.acceptHello(data) : channel.receive(data)))

const store = createChannelStore()
store.add(channel)
```

## Notes

- `createChannelStore` produces a registry for managing multiple channels by label or UUID; `store.create(label, options)` creates and registers in one step.
- `channel.outbound` and `channel.inbound` each expose `queue.size`, `stop`, and `resume`; `channel.stop()` and `channel.resume()` act on both.
- Validation helpers (`isValidChannel`, `isValidLabel`, `isValidReceiver`, `isValidSender`, `isValidSession`, `getFirstInvalidProtocolProperty`) are re-exported for upstream guards.
- Works over any Node transport that carries `Uint8Array` frames (IPC, sockets, `process.send`, message ports); the browser counterpart lives at `/browser/channel`.
