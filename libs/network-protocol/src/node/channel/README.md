# channel

Node-side channel factories pre-wired with the Node.js sender and receiver implementations.

## Overview

A channel is a named, bidirectional, queue-backed conduit between two endpoints. This entry point composes the runtime-agnostic channel logic from `lib/channel` with the Node-specific sender (`/node/sender`) and receiver (`/node/receiver`), so the resulting `createChannel` factory only needs a label, send/receive transport callbacks, and a `ProtocolProvider`.

## Usage

```typescript
import { createChannel, createChannelStore } from '@hyperfrontend/network-protocol/node/channel'
import { createProtocol } from '@hyperfrontend/network-protocol/node/v1'
import { createLogger } from '@hyperfrontend/logging'

const protocolProvider = createProtocol(createLogger({ level: 'info' }), 60)

const channel = createChannel(
  'parent-to-worker',
  (packet) => process.send?.(packet),
  (handler) => process.on('message', handler),
  protocolProvider
)

const store = createChannelStore()
store.add(channel)
```

## Notes

- `createChannelStore` produces a registry for managing multiple channels by label or UUID, with stop/resume controls applied across all entries.
- Validation helpers (`isValidChannel`, `isValidLabel`, `isValidReceiver`, `isValidSender`, `getFirstInvalidProtocolProperty`) are re-exported for upstream guards.
- Works over any Node transport (IPC, sockets, `process.send`, message ports); the browser counterpart lives at `/browser/channel`.
