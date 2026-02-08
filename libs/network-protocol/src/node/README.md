# Network Protocol - Node.js Platform (`src/node/`)

> **This is a platform-specific entry point.** Primary documentation is in [`src/lib/`](../lib/README.md).

## Overview

The `node/` directory provides Node.js-specific implementations that:

1. Import shared logic from `lib/`
2. Inject Node.js-native dependencies (Node crypto module)
3. Export ready-to-use factories for Node.js environments

## Entry Points

| Path            | Description                                         |
| --------------- | --------------------------------------------------- |
| `node/v1`       | v1 protocol with Node crypto encryption             |
| `node/channel`  | Channel factory pre-wired with node sender/receiver |
| `node/data`     | Data factory with node crypto                       |
| `node/packet`   | Packet encryption/decryption with Node crypto       |
| `node/sender`   | Sender factory with node packet processing          |
| `node/receiver` | Receiver factory with node packet processing        |

## Usage

```typescript
// Import from node-specific entry points
import { createProtocol } from '@hyperfrontend/network-protocol/node/v1'
import { createChannel } from '@hyperfrontend/network-protocol/node/channel'
import { createLogger } from '@hyperfrontend/logging'

const logger = createLogger({ level: 'info' })
const protocolProvider = createProtocol(logger, 60)

// Use IPC for transport (e.g., child_process)
const channel = createChannel(
  'ipc-channel',
  (packet) => process.send?.(packet),
  (packet) => handleMessage(packet),
  protocolProvider
)
```

## Integration Tests

Node.js integration tests use Jest with native Node.js crypto:

| File                                                     | Description                          |
| -------------------------------------------------------- | ------------------------------------ |
| [`v1/v1.integration.spec.ts`](v1/v1.integration.spec.ts) | Primary v1 protocol integration test |

## Documentation

For detailed documentation on each module, see the library core:

| Topic                | Link                                     |
| -------------------- | ---------------------------------------- |
| Module Documentation | [lib/README.md](../lib/README.md)        |
| Architecture Guide   | [ARCHITECTURE.md](../../ARCHITECTURE.md) |
| Package Overview     | [README.md](../../README.md)             |

## Differences from Browser

| Aspect      | Node.js                      | Browser                           |
| ----------- | ---------------------------- | --------------------------------- |
| Crypto      | Node.js `crypto` module      | Web Crypto API (`crypto.subtle`)  |
| Transport   | IPC, sockets, `process.send` | `postMessage`, `MessageChannel`   |
| Test Runner | Jest with `jest.setup.ts`    | Jest with `jest.setup.browser.ts` |
| Test Suffix | `*.spec.ts`                  | `*.browser.spec.ts`               |

## See Also

- [Browser Platform](../browser/README.md) - Browser counterpart
- [Library Core](../lib/README.md) - Shared implementation
