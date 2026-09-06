# Browser Platform (`src/browser/`)

> **This is a platform-specific entry point.** Primary documentation is in [`src/lib/`](../lib/README.md).

## Overview

The `browser/` directory provides browser-specific implementations that:

1. Import shared logic from `lib/`
2. Inject browser-native primitives: the Web Crypto API through `@hyperfrontend/cryptography/browser` and the UTF-8 codec from `@hyperfrontend/string-utils/browser`
3. Export ready-to-use factories for browser environments

## Entry Points

| Path               | Description                                                                            |
| ------------------ | -------------------------------------------------------------------------------------- |
| `browser/v3`       | `createProtocol(logger)`: a session keyed from an ephemeral P-256 agreement alone      |
| `browser/v4`       | `createProtocol(logger, sharedKey)`: the same agreement with a pre-shared key mixed in |
| `browser/channel`  | Channel factory and store pre-wired with the browser sender and receiver               |
| `browser/data`     | Data factory whose schema hash comes from Web Crypto                                   |
| `browser/packet`   | Packet types, creators, and validators                                                 |
| `browser/sender`   | Outbound pipeline: packets in, sealed frames out                                       |
| `browser/receiver` | Inbound pipeline: frames in, opened packets out                                        |

## Usage

```typescript
// Import from browser-specific entry points
import { createProtocol } from '@hyperfrontend/network-protocol/browser/v3'
import { createChannel } from '@hyperfrontend/network-protocol/browser/channel'
import { createLogger } from '@hyperfrontend/logging'

const logger = createLogger({ level: 'info' })

// Use postMessage for transport
const channel = createChannel('my-channel', {
  send: (frame) => otherWindow.postMessage(frame, targetOrigin, [frame.buffer]),
  receive: (packet) => handleMessage(packet),
  protocolProvider: createProtocol(logger),
  session: { protocol: 'v3', role: 'initiator', localId, peerId },
})

// The hello exchange keys the session: hello frames go to acceptHello, sealed frames to receive
window.addEventListener('message', ({ origin, data }) => {
  if (origin !== targetOrigin) return
  if (channel.isHello(data)) channel.acceptHello(data)
  else channel.receive(data)
})
otherWindow.postMessage(await channel.hello(), targetOrigin)
```

## Integration Tests

`src/integration-tests/session-envelope.browser.spec.ts` wires two channels in memory through the `connectPair` harness and runs under the browser test environment, which preloads a DOM. It covers `v3` and `v4` delivery in both directions, only sealed bytes on the wire, order across a burst, replay and foreign-session rejection reported as drops, a key mismatch delivering nothing, and a browser-composed side talking to a Node-composed side.

## Documentation

For detailed documentation on each module, see the library core:

| Topic                | Link                                     |
| -------------------- | ---------------------------------------- |
| Module Documentation | [lib/README.md](../lib/README.md)        |
| Architecture Guide   | [ARCHITECTURE.md](../../ARCHITECTURE.md) |
| Package Overview     | [README.md](../../README.md)             |

## Differences from Node.js

| Aspect           | Browser                                      | Node.js                                      |
| ---------------- | -------------------------------------------- | -------------------------------------------- |
| Crypto           | Web Crypto API (`crypto.subtle`)             | Node.js `crypto` module (`webcrypto.subtle`) |
| Text codec       | `@hyperfrontend/string-utils/browser`        | `@hyperfrontend/string-utils/node`           |
| Transport        | `postMessage`, `MessageChannel`              | `worker_threads`, IPC, `process.send`        |
| Test environment | `browser` in `test.config.ts`, DOM preloaded | `node` in `test.config.ts`                   |
| Test suffix      | `*.browser.spec.ts`                          | `*.spec.ts`                                  |

Frames are identical across platforms: a session keyed by a browser-composed side and a Node-composed side interoperates.

## See Also

- [Node.js Platform](../node/README.md) - Node.js counterpart
- [Library Core](../lib/README.md) - Shared implementation
