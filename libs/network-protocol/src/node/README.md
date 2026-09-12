# Node.js Platform (`src/node/`)

> **This is a platform-specific entry point.** Primary documentation is in [`src/lib/`](../lib/README.md).

## Overview

The `node/` directory provides Node.js-specific implementations that:

1. Import shared logic from `lib/`
2. Inject Node.js-native primitives: the Node.js crypto module through [`@hyperfrontend/cryptography/node`](https://www.hyperfrontend.dev/docs/libraries/cryptography/node/) and the UTF-8 codec from [`@hyperfrontend/string-utils/node`](https://www.hyperfrontend.dev/docs/libraries/utils/string/node/)
3. Export ready-to-use factories for Node.js environments

## Entry Points

| Path            | Description                                                                            |
| --------------- | -------------------------------------------------------------------------------------- |
| `node/v3`       | `createProtocol(logger)`: a session keyed from an ephemeral P-256 agreement alone      |
| `node/v4`       | `createProtocol(logger, sharedKey)`: the same agreement with a pre-shared key mixed in |
| `node/channel`  | Channel factory and store pre-wired with the Node.js sender and receiver               |
| `node/data`     | Data factory whose schema hash comes from the Node.js crypto module                    |
| `node/packet`   | Packet types, creators, and validators                                                 |
| `node/sender`   | Outbound pipeline: packets in, sealed frames out                                       |
| `node/receiver` | Inbound pipeline: frames in, opened packets out                                        |

## Usage

```typescript
// Import from node-specific entry points
import { parentPort } from 'node:worker_threads'
import { createProtocol } from '@hyperfrontend/network-protocol/node/v3'
import { createChannel } from '@hyperfrontend/network-protocol/node/channel'
import { createLogger } from '@hyperfrontend/logging'

const logger = createLogger({ level: 'info' })

// Use a worker_threads port for transport
const channel = createChannel('worker-channel', {
  send: (frame) => parentPort.postMessage(frame, [frame.buffer]),
  receive: (packet) => handleMessage(packet),
  protocolProvider: createProtocol(logger),
  session: { protocol: 'v3', role: 'responder', localId, peerId },
})

// The hello exchange keys the session: hello frames go to acceptHello, sealed frames to receive
parentPort.on('message', (frame: Uint8Array) => (channel.isHello(frame) ? channel.acceptHello(frame) : channel.receive(frame)))
parentPort.postMessage(await channel.hello())
```

## Integration Tests

Node.js unit suites (`*.spec.ts`) run under the `'node'` test environment. The Node.js protocol entries are also exercised end to end by `src/integration-tests/session-envelope.browser.spec.ts`, whose cross-platform cases pair a Node-composed initiator with a browser-composed responder over [`v4`](https://www.hyperfrontend.dev/docs/libraries/network-protocol/#api-V4) and a browser-composed initiator with a Node-composed responder over [`v3`](https://www.hyperfrontend.dev/docs/libraries/network-protocol/#api-V3).

## Documentation

For detailed documentation on each module, see the library core:

| Topic                | Link                                     |
| -------------------- | ---------------------------------------- |
| Module Documentation | [lib/README.md](../lib/README.md)        |
| Architecture Guide   | [ARCHITECTURE.md](../../ARCHITECTURE.md) |
| Package Overview     | [README.md](../../README.md)             |

## Differences from Browser

| Aspect           | Node.js                                                                                               | Browser                                                                                                     |
| ---------------- | ----------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Crypto           | Node.js `crypto` module (`webcrypto.subtle`)                                                          | Web Crypto API (`crypto.subtle`)                                                                            |
| Text codec       | [`@hyperfrontend/string-utils/node`](https://www.hyperfrontend.dev/docs/libraries/utils/string/node/) | [`@hyperfrontend/string-utils/browser`](https://www.hyperfrontend.dev/docs/libraries/utils/string/browser/) |
| Transport        | `worker_threads`, IPC, `process.send`                                                                 | `postMessage`, `MessageChannel`                                                                             |
| Test environment | `'node'` in `test.config.ts`                                                                          | `'browser'` in `test.config.ts`, DOM preloaded                                                              |
| Test suffix      | `*.spec.ts`                                                                                           | `*.browser.spec.ts`                                                                                         |

Frames are identical across platforms: a session keyed by a Node-composed side and a browser-composed side interoperates.

## See Also

- [Browser Platform](../browser/README.md) - Browser counterpart
- [Library Core](../lib/README.md) - Shared implementation
