# channel

Browser-side channel factories pre-wired with the browser sender and receiver implementations.

## Overview

A channel is a named, bidirectional, queue-backed conduit between two endpoints. This entry point composes the runtime-agnostic channel logic from `lib/channel` with the browser-specific sender (`/browser/sender`) and receiver (`/browser/receiver`), so the resulting `createChannel` factory only needs a label, send/receive transport callbacks, and a `ProtocolProvider`.

## Usage

```typescript
import { createChannel, createChannelStore } from '@hyperfrontend/network-protocol/browser/channel'
import { createProtocol } from '@hyperfrontend/network-protocol/browser/v1'
import { createLogger } from '@hyperfrontend/logging'

const protocolProvider = createProtocol(createLogger({ level: 'info' }), 60)

const channel = createChannel(
  'app-to-widget',
  (packet) => otherWindow.postMessage(packet, '*'),
  (handler) => window.addEventListener('message', (event) => handler(event.data)),
  protocolProvider
)

const store = createChannelStore()
store.add(channel)
```

## Notes

- `createChannelStore` produces a registry for managing multiple channels by label or UUID, with stop/resume controls applied across all entries.
- Validation helpers (`isValidChannel`, `isValidLabel`, `isValidReceiver`, `isValidSender`, `getFirstInvalidProtocolProperty`) are re-exported for upstream guards.
- Pair this entry point with `/browser/v1` or `/browser/v2` for end-to-end browser communication; the Node.js counterpart lives at `/node/channel`.
