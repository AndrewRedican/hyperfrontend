# Network Protocol - Browser Platform (`src/browser/`)

> **This is a platform-specific entry point.** Primary documentation is in [`src/lib/`](../lib/README.md).

## Overview

The `browser/` directory provides browser-specific implementations that:

1. Import shared logic from `lib/`
2. Inject browser-native dependencies (Web Crypto API)
3. Export ready-to-use factories for browser environments

## Entry Points

| Path               | Description                                            |
| ------------------ | ------------------------------------------------------ |
| `browser/v1`       | v1 protocol with Web Crypto encryption                 |
| `browser/channel`  | Channel factory pre-wired with browser sender/receiver |
| `browser/data`     | Data factory with browser crypto                       |
| `browser/packet`   | Packet encryption/decryption with Web Crypto           |
| `browser/sender`   | Sender factory with browser packet processing          |
| `browser/receiver` | Receiver factory with browser packet processing        |

## Usage

```typescript
// Import from browser-specific entry points
import { createProtocol } from '@hyperfrontend/network-protocol/browser/v1'
import { createChannel } from '@hyperfrontend/network-protocol/browser/channel'
import { createLogger } from '@hyperfrontend/logging'

const logger = createLogger({ level: 'info' })
const protocolProvider = createProtocol(logger, 60)

// Use postMessage for transport
const channel = createChannel(
  'my-channel',
  (packet) => otherWindow.postMessage(packet, '*'),
  (packet) => handleMessage(packet),
  protocolProvider
)
```

## Integration Tests

Browser integration tests use Jest with JSDOM and Web Crypto polyfills.

## Documentation

For detailed documentation on each module, see the library core:

| Topic                | Link                                     |
| -------------------- | ---------------------------------------- |
| Module Documentation | [lib/README.md](../lib/README.md)        |
| Architecture Guide   | [ARCHITECTURE.md](../../ARCHITECTURE.md) |
| Package Overview     | [README.md](../../README.md)             |

## Differences from Node.js

| Aspect      | Browser                           | Node.js                      |
| ----------- | --------------------------------- | ---------------------------- |
| Crypto      | Web Crypto API (`crypto.subtle`)  | Node.js `crypto` module      |
| Transport   | `postMessage`, `MessageChannel`   | IPC, sockets, `process.send` |
| Test Runner | Jest with `jest.setup.browser.ts` | Jest with `jest.setup.ts`    |
| Test Suffix | `*.browser.spec.ts`               | `*.spec.ts`                  |

## See Also

- [Node.js Platform](../node/README.md) - Node.js counterpart
- [Library Core](../lib/README.md) - Shared implementation
