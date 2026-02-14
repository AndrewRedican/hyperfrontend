# @hyperfrontend/network-protocol

<p align="center">
  <a href="https://github.com/AndrewRedican/hyperfrontend/actions/workflows/ci-lib-network-protocol.yml">
    <img src="https://img.shields.io/github/actions/workflow/status/AndrewRedican/hyperfrontend/ci-lib-network-protocol.yml?style=flat-square&logo=github&label=build" alt="Build">
  </a>
  <a href="https://codecov.io/gh/AndrewRedican/hyperfrontend/flags?flags%5B0%5D=network-protocol">
    <img src="https://codecov.io/gh/AndrewRedican/hyperfrontend/graph/badge.svg?flag=network-protocol" alt="Coverage">
  </a>
  <!-- ALL-CONTRIBUTORS-BADGE:START - Do not remove or modify this section -->
  <a href="#contributors">
    <img src="https://img.shields.io/github/all-contributors/AndrewRedican/hyperfrontend?color=ee8449&style=flat-square" alt="All Contributors">
  </a>
  <!-- ALL-CONTRIBUTORS-BADGE:END -->
  <a href="https://github.com/AndrewRedican/hyperfrontend/blob/main/LICENSE.md">
    <img src="https://img.shields.io/badge/license-MIT-blue?style=flat-square" alt="License">
  </a>
  <a href="https://www.npmjs.com/package/@hyperfrontend/network-protocol">
    <img src="https://img.shields.io/npm/v/@hyperfrontend/network-protocol?style=flat-square" alt="npm version">
  </a>
  <a href="https://www.npmjs.com/package/@hyperfrontend/network-protocol">
    <img src="https://img.shields.io/npm/dm/@hyperfrontend/network-protocol?style=flat-square" alt="npm downloads">
  </a>
  <a href="https://github.com/AndrewRedican/hyperfrontend">
    <img src="https://img.shields.io/github/stars/AndrewRedican/hyperfrontend?style=flat-square" alt="GitHub stars">
  </a>
</p>

Production-grade network protocol for secure, real-time cross-window and cross-process communication with built-in encryption, obfuscation, routing, and message queueing.

## What is @hyperfrontend/network-protocol?

@hyperfrontend/network-protocol is a comprehensive isomorphic communication framework that provides secure, reliable message passing between browser windows, iframes, Web Workers, and Node.js processes. It implements a multi-layered security protocol combining dynamic key encryption with time-based password rotation, packet obfuscation, and message queueing to ensure confidential, ordered, and resilient communication.

The library features a sophisticated architecture with separate browser and Node.js implementations sharing the same API surface. Messages flow through dedicated processing queues (encryption → serialization → obfuscation for outbound; deobfuscation → deserialization → decryption for inbound) with configurable stop/resume controls. The routing system uses a topic-based pub/sub pattern with dynamic or cached subscription resolution, enabling flexible message distribution across multiple channels.

### Key Features

- **Multi-layered security protocol** - Combines dynamic key encryption, time-based password rotation, and packet obfuscation
- **Isomorphic design** - Identical APIs for browser (`postMessage`) and Node.js (IPC) with platform-specific implementations
- **Topic-based routing** - Pub/sub message distribution with dynamic subscription resolution and WeakMap-based channel tracking
- **Staged message queues** - Separate queues for each transformation stage (encrypt, serialize, obfuscate, etc.) with independent control
- **Protocol versioning** - Extensible protocol system with v1 implementation and provider-based configuration
- **Structured packet format** - Typed packets with origin/target tracking through all transformation stages
- **Channel management** - Named channels with UUID tracking, lifecycle control (stop/resume), and dedicated inbound/outbound queues
- **Schema validation** - JSON Schema integration for runtime packet validation with `jsonschema` and `to-json-schema`

### Architecture Highlights

The protocol implements a functional pipeline architecture where each transformation stage (encryption, serialization, obfuscation) operates independently through dedicated queues. Packets progress through typed transformations: `UnencryptedPacket<T>` → `UnserializedEncryptedPacket` → `SerializedEncryptedPacket` → `ObfuscatedPacket` (and reverse for inbound). Platform-specific implementations inject dependencies (crypto functions, transport mechanisms) through factory patterns, maintaining pure business logic in the shared lib layer. The v1 protocol uses time-based password generation from `@hyperfrontend/cryptography` for dynamic encryption keys and obfuscation passwords, refreshing at configurable intervals.

## Why Use @hyperfrontend/network-protocol?

### Defense-in-Depth Security for Sensitive Communication

Traditional `postMessage` or IPC communication sends data in plaintext or with minimal protection, exposing sensitive information to browser extensions, debugging tools, and man-in-the-middle attacks. This library implements defense-in-depth with three security layers: (1) encryption with dynamic, time-rotating keys preventing replay attacks, (2) packet obfuscation making ciphertext unrecognizable as encrypted data, and (3) origin/target validation at protocol level. For applications handling authentication tokens, PII, or proprietary business logic in distributed architectures, this provides production-grade confidentiality without external dependencies on TLS or VPNs.

### Reliable Message Delivery in Complex Distributed Systems

Micro-frontends, Web Worker architectures, and cross-window communication suffer from message loss and ordering issues when using raw transport mechanisms. The queue-based architecture guarantees message ordering within channels while providing independent stop/resume controls for backpressure management. Validation failures, encryption errors, and routing mismatches are logged and handled without crashing the communication pipeline. This resilience is critical for financial dashboards, real-time collaboration tools, and multi-window trading platforms where message loss causes data inconsistency or user-visible errors.

### Isomorphic Architecture Simplifies Full-Stack Development

Building communication systems that work in both browser and Node.js typically requires maintaining separate implementations with different APIs and security models. This library provides identical APIs for both platforms through modular exports (`@hyperfrontend/network-protocol/browser/v1` and `@hyperfrontend/network-protocol/node/v1`), with platform-specific crypto and transport injection. Development teams write channel logic, routing rules, and protocol configurations once, then deploy to browser-to-browser (iframes, popups), browser-to-worker, or Node.js IPC scenarios without code changes. This eliminates cross-platform bugs and accelerates development of Electron apps, server-side rendering systems, or hybrid browser/Node.js architectures.

### Modular Security and Transport for Flexible Integration

The protocol uses dependency injection for all security and transport operations, allowing custom encryption algorithms, obfuscation strategies, or transport mechanisms without modifying core protocol logic. Teams can swap AES-GCM for ChaCha20, implement custom key rotation schedules, or integrate hardware security modules through the `ProtocolProvider` interface. Secondary entry points (`/channel`, `/routing`, `/security`, `/queue`) enable tree-shaking unused features while composing custom protocols. This modularity is essential for environments with regulatory requirements (HIPAA, GDPR), legacy system integration, or specialized security hardware.

### Production-Ready Observability and Error Handling

Communication failures in distributed systems are notoriously difficult to debug without proper instrumentation. Every queue, channel, and protocol operation integrates with `@hyperfrontend/logging` for structured logging with configurable levels and transports. Validation errors include detailed failure reasons via JSON Schema validators. Queue operations track success/failure callbacks enabling metrics collection and dead letter queue patterns. For operations teams managing micro-frontend platforms or multi-process applications, this observability is the difference between hours of debugging and immediate root cause identification.

## Installation

```bash
npm install @hyperfrontend/network-protocol
```

**Note:** This package has several internal dependencies from the @hyperfrontend ecosystem:

- `@hyperfrontend/cryptography` - Encryption and time-based password generation
- `@hyperfrontend/logging` - Structured logging
- `@hyperfrontend/data-utils` - Data transformation utilities
- Plus additional utility libraries for string, list, time, and random operations

## Quick Start

### Browser: Secure Cross-Window Communication

```typescript
import { createProtocol } from '@hyperfrontend/network-protocol/browser/v1'
import { createLogger } from '@hyperfrontend/logging'

// Define send/receive functions for your transport (e.g., postMessage)
const send = (packet: Uint8Array) => {
  otherWindow.postMessage(packet, '*')
}

const receive = (handler: (packet: Uint8Array) => void) => {
  window.addEventListener('message', (event) => handler(event.data))
}

// Create protocol with logging and key rotation
const logger = createLogger({ level: 'info' })
const createMyProtocol = createProtocol(logger, 60000) // Rotate keys every 60s

// Create a protocol instance
const protocol = createMyProtocol(send, receive)

// Use the protocol for encrypted communication
const unencryptedData = { origin: 'window-a', target: 'window-b', data: { message: 'Hello' } }
const encryptedPacket = await protocol.packetEncryption(unencryptedData)
const obfuscatedPacket = await protocol.packetObfuscation({ ...encryptedPacket, data: 'serialized' })

protocol.send(obfuscatedPacket)
```

### Node.js: IPC with Encryption

```typescript
import { createProtocol } from '@hyperfrontend/network-protocol/node/v1'
import { createLogger } from '@hyperfrontend/logging'

// Use Node.js IPC mechanisms
const send = (packet: Uint8Array) => {
  process.send!(packet)
}

const receive = (handler: (packet: Uint8Array) => void) => {
  process.on('message', handler)
}

const logger = createLogger({ level: 'debug' })
const createMyProtocol = createProtocol(logger, 30000)
const protocol = createMyProtocol(send, receive)

// Same API as browser version
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

- **[ARCHITECTURE.md](ARCHITECTURE.md)** - In-depth architecture guide with composition diagrams, factory reference table, and "How Do I..." quick reference
- **[src/lib/README.md](src/lib/README.md)** - Module index with links to all subdomain documentation

### Module Documentation

Each module has its own README with purpose, interfaces, factory functions, and usage examples:

| Module        | Description                              | Documentation                        |
| ------------- | ---------------------------------------- | ------------------------------------ |
| **channel/**  | Bidirectional communication channels     | [README](src/lib/channel/README.md)  |
| **packet/**   | Packet type hierarchy & transformations  | [README](src/lib/packet/README.md)   |
| **protocol/** | Protocol composition & v1 implementation | [README](src/lib/protocol/README.md) |
| **security/** | Encryption & obfuscation suites          | [README](src/lib/security/README.md) |
| **queue/**    | FIFO message processing queues           | [README](src/lib/queue/README.md)    |
| **sender/**   | Outbound message pipeline                | [README](src/lib/sender/README.md)   |
| **receiver/** | Inbound message pipeline                 | [README](src/lib/receiver/README.md) |
| **data/**     | Structured message payloads              | [README](src/lib/data/README.md)     |
| **routing/**  | Topic-based message routing              | [README](src/lib/routing/README.md)  |
| **topic/**    | Topic store management                   | [README](src/lib/topic/README.md)    |

### Platform Entry Points

- **[src/browser/README.md](src/browser/README.md)** - Browser platform documentation
- **[src/node/README.md](src/node/README.md)** - Node.js platform documentation

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

**Bundle size:** ~66 KB per version (minified, self-contained)

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

### Dependencies

| Package                               | Type        |
| ------------------------------------- | ----------- |
| @hyperfrontend/cryptography           | Internal    |
| @hyperfrontend/data-utils             | Internal    |
| @hyperfrontend/list-utils             | Internal    |
| @hyperfrontend/logging                | Internal    |
| @hyperfrontend/random-generator-utils | Internal    |
| @hyperfrontend/string-utils           | Internal    |
| @hyperfrontend/time-utils             | Internal    |
| jsonschema                            | Third-party |
| to-json-schema                        | Third-party |

## Part of hyperfrontend

This library is part of the [hyperfrontend](https://github.com/AndrewRedican/hyperfrontend) monorepo.

- Uses [@hyperfrontend/cryptography](https://github.com/AndrewRedican/hyperfrontend/tree/main/libs/cryptography) for encryption and time-based password generation
- For simpler cross-window messaging with contracts, see [@hyperfrontend/nexus](https://github.com/AndrewRedican/hyperfrontend/tree/main/libs/nexus)

## License

MIT
