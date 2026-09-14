# channel

Node-side channel factories pre-wired with the Node.js sender and receiver implementations.

## Overview

A channel is a named, bidirectional, queue-backed conduit that binds one protocol instance to one negotiated session. This entry point composes the runtime-agnostic channel logic from `lib/channel` with the Node sender ([`/node/sender`](https://www.hyperfrontend.dev/docs/libraries/network-protocol/node/sender/)) and receiver ([`/node/receiver`](https://www.hyperfrontend.dev/docs/libraries/network-protocol/node/receiver/)), so [`createChannel`](https://www.hyperfrontend.dev/docs/libraries/network-protocol/node/channel/#api-createChannel) needs a label and an options object: the transport callbacks, a [`ProtocolProvider`](https://www.hyperfrontend.dev/docs/libraries/network-protocol/node/channel/#api-ProtocolProvider) from [`/node/v3`](https://www.hyperfrontend.dev/docs/libraries/network-protocol/node/v3/) or [`/node/v4`](https://www.hyperfrontend.dev/docs/libraries/network-protocol/node/v4/), the [`ProtocolSession`](https://www.hyperfrontend.dev/docs/libraries/network-protocol/node/channel/#api-ProtocolSession), and an optional [`onDrop`](https://www.hyperfrontend.dev/docs/libraries/network-protocol/node/channel/#api-ChannelOptions-prop-onDrop) handler. The channel exposes the protocol's hello exchange ([`hello`](https://www.hyperfrontend.dev/docs/libraries/network-protocol/node/channel/#api-HelloExchange), [`isHello`](https://www.hyperfrontend.dev/docs/libraries/network-protocol/node/channel/#api-HelloExchange), [`acceptHello`](https://www.hyperfrontend.dev/docs/libraries/network-protocol/node/channel/#api-HelloExchange)) so the session can be keyed over the same transport.

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

- [`createChannelStore`](https://www.hyperfrontend.dev/docs/libraries/network-protocol/node/channel/#api-createChannelStore) produces a registry for managing multiple channels by label or UUID; `store.create(label, options)` creates and registers in one step.
- [`channel.outbound`](https://www.hyperfrontend.dev/docs/libraries/network-protocol/node/channel/#api-Channel-prop-outbound) and [`channel.inbound`](https://www.hyperfrontend.dev/docs/libraries/network-protocol/node/channel/#api-Channel-prop-inbound) each expose [`queue.size`](https://www.hyperfrontend.dev/docs/libraries/network-protocol/queue/#api-Queue-prop-size), [`stop`](https://www.hyperfrontend.dev/docs/libraries/network-protocol/node/channel/#api-StopResumeControl-prop-stop), and [`resume`](https://www.hyperfrontend.dev/docs/libraries/network-protocol/node/channel/#api-StopResumeControl-prop-resume); `channel.stop()` and `channel.resume()` act on both.
- Validation helpers ([`isValidChannel`](https://www.hyperfrontend.dev/docs/libraries/network-protocol/node/channel/#api-isValidChannel), [`isValidLabel`](https://www.hyperfrontend.dev/docs/libraries/network-protocol/node/channel/#api-isValidLabel), [`isValidReceiver`](https://www.hyperfrontend.dev/docs/libraries/network-protocol/node/channel/#api-isValidReceiver), [`isValidSender`](https://www.hyperfrontend.dev/docs/libraries/network-protocol/node/channel/#api-isValidSender), [`isValidSession`](https://www.hyperfrontend.dev/docs/libraries/network-protocol/node/channel/#api-isValidSession), [`getFirstInvalidProtocolProperty`](https://www.hyperfrontend.dev/docs/libraries/network-protocol/node/channel/#api-getFirstInvalidProtocolProperty)) are re-exported for upstream guards.
- Works over any Node transport that carries `Uint8Array` frames (IPC, sockets, `process.send`, message ports); the browser counterpart lives at [`/browser/channel`](https://www.hyperfrontend.dev/docs/libraries/network-protocol/browser/channel/).
