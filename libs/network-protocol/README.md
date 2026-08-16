# @hyperfrontend/network-protocol

<p align="center">
  <a href="https://github.com/AndrewRedican/hyperfrontend/actions/workflows/ci-lib-network-protocol.yml">
    <img src="https://img.shields.io/github/actions/workflow/status/AndrewRedican/hyperfrontend/ci-lib-network-protocol.yml?style=flat-square&logo=github&label=build" alt="Build">
  </a>
  <a href="https://codecov.io/gh/AndrewRedican/hyperfrontend/flags?flags%5B0%5D=network-protocol">
    <img src="https://codecov.io/gh/AndrewRedican/hyperfrontend/graph/badge.svg?flag=network-protocol" alt="Coverage">
  </a>
  <a href="https://www.npmjs.com/package/@hyperfrontend/network-protocol">
    <img src="https://img.shields.io/npm/v/@hyperfrontend/network-protocol?style=flat-square" alt="npm version">
  </a>
  <a href="https://bundlephobia.com/package/@hyperfrontend/network-protocol">
    <img src="https://img.shields.io/bundlephobia/min/%40hyperfrontend%2Fnetwork-protocol?style=flat-square" alt="npm bundle size">
  </a>
</p>
<p align="center">
  <!-- ALL-CONTRIBUTORS-BADGE:START - Do not remove or modify this section -->
  <a href="#contributors">
    <img src="https://img.shields.io/github/all-contributors/AndrewRedican/hyperfrontend?color=ee8449&style=flat-square" alt="All Contributors">
  </a>
  <!-- ALL-CONTRIBUTORS-BADGE:END -->
  <a href="https://github.com/AndrewRedican/hyperfrontend/blob/main/LICENSE.md">
    <img src="https://img.shields.io/badge/license-MIT-blue?style=flat-square" alt="License">
  </a>
  <a href="https://www.npmjs.com/package/@hyperfrontend/network-protocol">
    <img src="https://img.shields.io/npm/dm/@hyperfrontend/network-protocol?style=flat-square" alt="npm downloads">
  </a>
  <a href="https://github.com/AndrewRedican/hyperfrontend">
    <img src="https://img.shields.io/github/stars/AndrewRedican/hyperfrontend?style=flat-square" alt="GitHub stars">
  </a>
  <img src="https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen?style=flat-square&logo=node.js" alt="Node Version">
  <img src="https://img.shields.io/badge/tree%20shakeable-%E2%9C%93-success?style=flat-square" alt="Tree Shakeable">
</p>

Production-grade network protocol for secure, real-time cross-window and cross-process communication with built-in encryption, obfuscation, routing, and message queueing.

• 👉 See [**documentation**](https://www.hyperfrontend.dev/docs/libraries/network-protocol/)
• 👉 See [**API reference**](https://www.hyperfrontend.dev/docs/libraries/network-protocol/#api-reference)

## What is @hyperfrontend/network-protocol?

You already have a transport: a WebSocket, `postMessage` to another window or a worker, a Node IPC pipe. What you do not have is the envelope to put on it. That is this library. Hand it a function that transmits bytes and a callback for delivered messages, and you get a channel back. Outbound messages are encrypted with a key the two ends exchange, serialized, then obfuscated with a password both sides derive from the current time window. Inbound bytes run the same three steps backwards and arrive as a typed packet with an origin, a target, and a payload that has already been checked for the fields it claims to have.

Every stage is its own FIFO queue that finishes one message before pulling the next, so the async crypto cannot reorder your sends, and either direction can be stopped and resumed. A packet that fails validation or decryption fails inside its stage, gets logged through the logger you passed in, and leaves the rest of the pipeline running.

Most projects should not start here. For typed, contract-checked messages between windows, use [@hyperfrontend/nexus](https://www.hyperfrontend.dev/docs/libraries/nexus/), which attaches this protocol through `registerProtocol` and owns the handshake, the origin policy, and the connection lifecycle. To compose whole applications into a host page, use [@hyperfrontend/features](https://www.hyperfrontend.dev/docs/libraries/features/), which sits above nexus. Come here directly when you own the transport and want the envelope on your own terms.

At a glance:

```typescript
import { logger } from '@hyperfrontend/logging'
import { createChannel } from '@hyperfrontend/network-protocol/browser/channel'
import { createData, deserializeData } from '@hyperfrontend/network-protocol/browser/data'
import { createProtocol } from '@hyperfrontend/network-protocol/browser/v2'

const worker = new Worker('./peer.js')

const channel = createChannel(
  'worker-bridge',
  (bytes) => worker.postMessage(bytes), // your transport, outbound
  (packet) => render(packet.origin, packet.data.message), // decrypted, validated, in order
  createProtocol(logger, 'pre-shared-secret', 5) // 5 minute obfuscation window
)

worker.addEventListener('message', (event) => channel.receive(event.data)) // your transport, inbound

// pid is a UUID v4 naming the conversation, 1 is the step number within it
const data = deserializeData(await createData(crypto.randomUUID(), 1, { type: 'PING' }))
channel.send('page', 'worker', data)
```

### Key Features

- **Multi-layered security protocol** - Combines dynamic key encryption, time-based password rotation, and packet obfuscation
- **Isomorphic design** - Identical APIs for browser (`postMessage`) and Node.js (IPC) with platform-specific implementations
- **Topic-based routing** - Pub/sub message distribution with dynamic subscription resolution and WeakMap-based channel tracking
- **Staged message queues** - Separate queues for each transformation stage (encrypt, serialize, obfuscate, etc.) with independent control
- **Protocol versioning** - Extensible protocol system with v1 implementation and provider-based configuration
- **Structured packet format** - Typed packets with origin/target tracking through all transformation stages
- **Channel management** - Named channels with UUID tracking, lifecycle control (stop/resume), and dedicated inbound/outbound queues
- **Schema validation** - Each message carries a generated JSON Schema and a hash of it, so the receiver can check the shape it was sent

### Architecture Highlights

The protocol implements a functional pipeline architecture where each transformation stage (encryption, serialization, obfuscation) operates independently through dedicated queues. Packets progress through typed transformations: `UnencryptedPacket<T>` → `UnserializedEncryptedPacket` → `SerializedEncryptedPacket` → `ObfuscatedPacket` (and reverse for inbound). Platform-specific implementations inject dependencies (crypto functions, transport mechanisms) through factory patterns, maintaining pure business logic in the shared lib layer. The v1 protocol uses time-based password generation from `@hyperfrontend/cryptography` for dynamic encryption keys and obfuscation passwords, refreshing at configurable intervals.

## Why Use @hyperfrontend/network-protocol?

### You own the transport and do not want to invent the envelope

Raw `postMessage` and IPC give you bytes and nothing else. Everything above them is yours to build: a key exchange, a serialization format, something that stops two overlapping crypto calls from delivering your messages out of order, and a shape check so a malformed payload never reaches a handler. That layer is small enough to write and easy to get subtly wrong. It is the part this library ships, and it is the only part it ships. Your socket, your window, your pipe stays yours.

### Two encryption layers, and you can see both of them

The payload is encrypted with a key the peers exchange in the first packet. The serialized packet is then obfuscated with a password both ends derive from the current time window, so what crosses the wire does not present itself as a recognizable ciphertext envelope. Deobfuscation retries with the previous and next windows, which is what keeps a few seconds of clock drift from dropping traffic. V2 adds a pre-shared key so that even the first packet, the one carrying the exchange key, is encrypted. Whether that trade is worth the key distribution problem depends on your transport, and the V1 versus V2 table below is the short answer.

### Ordering and backpressure come from the queues, not from a promise

Each transformation is its own FIFO queue that awaits one message before pulling the next, so encryption timing cannot shuffle your sends. `channel.stop()` pauses both directions, `channel.resume()` drains them, and `channel.outbound.encryptionQueue.size` tells you how far behind you are. Failures are contained: a packet that will not validate or decrypt fails inside its stage, goes to the logger you injected, and the channel keeps running.

### The same code in a browser and in Node

`/browser/*` and `/node/*` export the same functions with the same signatures. Only the crypto and the transport injection differ, so an Electron main process and its renderer, or a page and a worker, can share channel and routing code and swap one import. Every piece is a factory that takes its dependencies as arguments, so replacing the encryption suite, the obfuscation suite, or the serialization step means passing a different function, not forking the pipeline.

## Installation

```bash
npm install @hyperfrontend/network-protocol
```

## Requirements

- **Node.js:** 18.0.0 or higher (19+ recommended for stable Web Crypto API support)
- **npm:** 8.0.0 or higher
- **Browser:** Modern browsers with Web Crypto API support

> **Note:** The `/node/*` entry points depend on `@hyperfrontend/cryptography` which uses `webcrypto.subtle`. This API was experimental in Node.js 18.x. For production use with Node.js entry points, Node.js 19+ is recommended.

## Quick Start

### Browser: cross-window messages

```typescript
import { logger } from '@hyperfrontend/logging'
import { createChannel } from '@hyperfrontend/network-protocol/browser/channel'
import { createData, deserializeData } from '@hyperfrontend/network-protocol/browser/data'
import { createProtocol } from '@hyperfrontend/network-protocol/browser/v1'

// createProtocol(logger, refreshRate) returns a provider; refreshRate is the obfuscation window in minutes
const protocolProvider = createProtocol(logger, 5)

// the channel owns the pipeline, you own the transport on both sides of it
const channel = createChannel(
  'window-link',
  (bytes) => otherWindow.postMessage(bytes, 'https://app.example.com'),
  (packet) => console.log('from', packet.origin, packet.data.message),
  protocolProvider
)

window.addEventListener('message', (event) => {
  if (event.origin === 'https://app.example.com') channel.receive(event.data)
})

// the pid stays the same across the steps of one conversation, the sequence number counts them
const pid = crypto.randomUUID()
const data = deserializeData(await createData(pid, 1, { greeting: 'Hello' }))
channel.send('window-a', 'window-b', data)

// pause and drain either direction
channel.stop()
channel.resume()
```

### Node.js: the same channel between threads

```typescript
import { Worker } from 'node:worker_threads'
import { logger } from '@hyperfrontend/logging'
import { createChannel } from '@hyperfrontend/network-protocol/node/channel'
import { createData, deserializeData } from '@hyperfrontend/network-protocol/node/data'
import { createProtocol } from '@hyperfrontend/network-protocol/node/v1'

const worker = new Worker('./worker.js')

const channel = createChannel(
  'thread-link',
  (bytes) => worker.postMessage(bytes),
  (packet) => handle(packet.data.message),
  createProtocol(logger, 5)
)

worker.on('message', (bytes: Uint8Array) => channel.receive(bytes))

const data = deserializeData(await createData(crypto.randomUUID(), 1, { job: 'resize', file: 'a.png' }))
channel.send('parent', 'worker', data)
```

## API Overview

### Core Exports

**Modular Entry Points** (tree-shakeable):

- `@hyperfrontend/network-protocol/channel` - Channel creation, management, and stores
- `@hyperfrontend/network-protocol/routing` - Router configuration and topic-based routing
- `@hyperfrontend/network-protocol/security` - Security suites (encryption + obfuscation)
- `@hyperfrontend/network-protocol/queue` - Message queue creation and management
- `@hyperfrontend/network-protocol/topic` - Topic creation and stores

**Platform-Specific Protocols**:

- `@hyperfrontend/network-protocol/browser/v1` - V1 protocol with obfuscation-only handshake
- `@hyperfrontend/network-protocol/browser/v2` - V2 protocol with PSK-encrypted handshake
- `@hyperfrontend/network-protocol/node/v1` - Node.js V1 protocol
- `@hyperfrontend/network-protocol/node/v2` - Node.js V2 protocol

### Protocol Versions

#### V1: Obfuscation-Only Handshake

The V1 protocol (`createObfuscatedHandshakeProtocolFactory`) uses time-based obfuscation only for the initial handshake message. During handshake:

1. **First message**: Sent with obfuscation only (no encryption) - the encryption key is transmitted in the packet payload
2. **Subsequent messages**: Encrypted with dynamically captured keys plus time-based obfuscation

This approach is suitable when the transport layer already provides some level of security or when PSK distribution is not feasible.

```typescript
import { createProtocol } from '@hyperfrontend/network-protocol/browser/v1'
// createProtocol is an alias for createObfuscatedHandshakeProtocolFactory
```

#### V2: PSK-Encrypted Handshake

The V2 protocol (`createPSKHandshakeProtocolFactory`) adds a Pre-Shared Key (PSK) layer for securing the initial handshake:

1. **First message**: Encrypted with the PSK + time-based obfuscation - protects the encryption key during transmission
2. **Subsequent messages**: Encrypted with dynamically captured keys plus time-based obfuscation

This provides defense-in-depth during handshake, protecting the dynamic key exchange from eavesdropping.

```typescript
import { createProtocol } from '@hyperfrontend/network-protocol/browser/v2'
// createProtocol is an alias for createPSKHandshakeProtocolFactory

// Usage requires a shared key known to both parties
const createMyProtocol = createProtocol(logger, 'my-shared-secret', 60000)
```

#### Choosing Between V1 and V2

| Use Case                           | Recommended Protocol  |
| ---------------------------------- | --------------------- |
| TLS-protected transport            | V1 (obfuscation-only) |
| Untrusted transport, can share PSK | V2 (PSK handshake)    |
| Key exchange protection critical   | V2 (PSK handshake)    |
| No PSK distribution mechanism      | V1 (obfuscation-only) |

**Note:** Both protocols use dynamic key encryption for all messages after the handshake. The only difference is how the first message (containing the dynamic encryption key) is protected.

**Additional Modules**:

- `/browser/data`, `/node/data` - Data transformation utilities
- `/browser/packet`, `/node/packet` - Packet operations (encrypt, decrypt, obfuscate, etc.)
- `/browser/sender`, `/node/sender` - Outbound message handling
- `/browser/receiver`, `/node/receiver` - Inbound message handling
- `/browser/channel`, `/node/channel` - Platform-specific channel implementations

### Main Types

- `Protocol<T>` - Complete protocol implementation with encryption, obfuscation, send/receive
- `ProtocolProvider<T>` - Factory function for creating protocol instances
- `Channel<T>` - Named communication channel with queues and routing
- `Router` - Function configuring topic-to-channel subscriptions
- `Topic` - Named message category for routing
- `Packet<T>` - Union of all packet types (obfuscated, encrypted, unencrypted)
- `Queue<T>` - Message queue with processing and backpressure control

## Documentation

### Comprehensive Guides

- **[ARCHITECTURE.md](https://github.com/AndrewRedican/hyperfrontend/blob/main/libs/network-protocol/ARCHITECTURE.md)** - In-depth architecture guide with composition diagrams, factory reference table, and "How Do I..." quick reference
- **[src/lib/README.md](https://github.com/AndrewRedican/hyperfrontend/blob/main/libs/network-protocol/src/lib/README.md)** - Module index with links to all subdomain documentation

### Module Documentation

Each module has its own README with purpose, interfaces, factory functions, and usage examples:

| Module        | Description                              | Documentation                                                                                                       |
| ------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| **channel/**  | Bidirectional communication channels     | [README](https://github.com/AndrewRedican/hyperfrontend/blob/main/libs/network-protocol/src/lib/channel/README.md)  |
| **packet/**   | Packet type hierarchy & transformations  | [README](https://github.com/AndrewRedican/hyperfrontend/blob/main/libs/network-protocol/src/lib/packet/README.md)   |
| **protocol/** | Protocol composition & v1 implementation | [README](https://github.com/AndrewRedican/hyperfrontend/blob/main/libs/network-protocol/src/lib/protocol/README.md) |
| **security/** | Encryption & obfuscation suites          | [README](https://github.com/AndrewRedican/hyperfrontend/blob/main/libs/network-protocol/src/lib/security/README.md) |
| **queue/**    | FIFO message processing queues           | [README](https://github.com/AndrewRedican/hyperfrontend/blob/main/libs/network-protocol/src/lib/queue/README.md)    |
| **sender/**   | Outbound message pipeline                | [README](https://github.com/AndrewRedican/hyperfrontend/blob/main/libs/network-protocol/src/lib/sender/README.md)   |
| **receiver/** | Inbound message pipeline                 | [README](https://github.com/AndrewRedican/hyperfrontend/blob/main/libs/network-protocol/src/lib/receiver/README.md) |
| **data/**     | Structured message payloads              | [README](https://github.com/AndrewRedican/hyperfrontend/blob/main/libs/network-protocol/src/lib/data/README.md)     |
| **routing/**  | Topic-based message routing              | [README](https://github.com/AndrewRedican/hyperfrontend/blob/main/libs/network-protocol/src/lib/routing/README.md)  |
| **topic/**    | Topic store management                   | [README](https://github.com/AndrewRedican/hyperfrontend/blob/main/libs/network-protocol/src/lib/topic/README.md)    |

### Platform Entry Points

- **[src/browser/README.md](https://github.com/AndrewRedican/hyperfrontend/blob/main/libs/network-protocol/src/browser/README.md)** - Browser platform documentation
- **[src/node/README.md](https://github.com/AndrewRedican/hyperfrontend/blob/main/libs/network-protocol/src/node/README.md)** - Node.js platform documentation

### Integration Tests

Living documentation through executable examples:

- `channel/channel.integration.spec.ts` - Channel composition and bidirectional communication
- `packet/packet-transformations.integration.spec.ts` - Full packet type transitions
- `packet/security/encryption.integration.spec.ts` - Real encryption/decryption cycles
- `packet/security/obfuscation.integration.spec.ts` - Time-based obfuscation with clock skew handling
- `sender/sender.integration.spec.ts` - Full outbound queue chain
- `receiver/receiver.integration.spec.ts` - Full inbound queue chain
- `sender-receiver.integration.spec.ts` - Round-trip message flow
- `security/security-suite.integration.spec.ts` - Combined encryption + obfuscation
- `routing/routing.integration.spec.ts` - Topic-based message routing
- `queue/queue.integration.spec.ts` - Queue creation, message flow, stop/resume
- `data/data.integration.spec.ts` - Data creation with real hashing

## Compatibility

| Platform                      | Support |
| ----------------------------- | :-----: |
| Browser                       |   ✅    |
| Node.js                       |   ✅    |
| Web Workers                   |   ✅    |
| Deno, Bun, Cloudflare Workers |   ✅    |

### Output Formats

| Format | File                                                         | Tree-Shakeable |
| ------ | ------------------------------------------------------------ | :------------: |
| ESM    | `*.esm.js`                                                   |       ✅       |
| CJS    | `*.cjs.js`                                                   |       ❌       |
| IIFE   | `bundle/v1/index.iife.min.js`, `bundle/v2/index.iife.min.js` |       ❌       |
| UMD    | `bundle/v1/index.umd.min.js`, `bundle/v2/index.umd.min.js`   |       ❌       |

### CDN Usage

This library provides **separate bundles for each protocol version**:

```html
<!-- Protocol V2 (recommended) -->
<script src="https://unpkg.com/@hyperfrontend/network-protocol/bundle/v2/index.umd.min.js"></script>

<!-- Protocol V1 -->
<script src="https://unpkg.com/@hyperfrontend/network-protocol/bundle/v1/index.umd.min.js"></script>

<script>
  // V2
  const { createProtocol } = HyperfrontendNetworkProtocolV2

  // V1
  const { createProtocol } = HyperfrontendNetworkProtocolV1
</script>
```

**Global variables:** `HyperfrontendNetworkProtocolV1`, `HyperfrontendNetworkProtocolV2`

## Part of hyperfrontend

This library is part of the [hyperfrontend](https://github.com/AndrewRedican/hyperfrontend) monorepo.

**📖 [Full documentation](https://www.hyperfrontend.dev/docs/libraries/network-protocol)**

- Uses [@hyperfrontend/cryptography](https://github.com/AndrewRedican/hyperfrontend/tree/main/libs/cryptography) for encryption and time-based password generation
- For simpler cross-window messaging with contracts, see [@hyperfrontend/nexus](https://github.com/AndrewRedican/hyperfrontend/tree/main/libs/nexus)

## License

[MIT](https://github.com/AndrewRedican/hyperfrontend/blob/main/LICENSE.md)
