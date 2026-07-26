# @hyperfrontend/nexus

<p align="center">
  <a href="https://github.com/AndrewRedican/hyperfrontend/actions/workflows/ci-lib-nexus.yml">
    <img src="https://img.shields.io/github/actions/workflow/status/AndrewRedican/hyperfrontend/ci-lib-nexus.yml?style=flat-square&logo=github&label=build" alt="Build">
  </a>
  <a href="https://codecov.io/gh/AndrewRedican/hyperfrontend/flags?flags%5B0%5D=nexus">
    <img src="https://codecov.io/gh/AndrewRedican/hyperfrontend/graph/badge.svg?flag=nexus" alt="Coverage">
  </a>
  <a href="https://www.npmjs.com/package/@hyperfrontend/nexus">
    <img src="https://img.shields.io/npm/v/@hyperfrontend/nexus?style=flat-square" alt="npm version">
  </a>
  <a href="https://bundlephobia.com/package/@hyperfrontend/nexus">
    <img src="https://img.shields.io/bundlephobia/min/%40hyperfrontend%2Fnexus?style=flat-square" alt="npm bundle size">
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
  <a href="https://www.npmjs.com/package/@hyperfrontend/nexus">
    <img src="https://img.shields.io/npm/dm/@hyperfrontend/nexus?style=flat-square" alt="npm downloads">
  </a>
  <a href="https://github.com/AndrewRedican/hyperfrontend">
    <img src="https://img.shields.io/github/stars/AndrewRedican/hyperfrontend?style=flat-square" alt="GitHub stars">
  </a>
  <img src="https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen?style=flat-square&logo=node.js" alt="Node Version">
  <img src="https://img.shields.io/badge/tree%20shakeable-%E2%9C%93-success?style=flat-square" alt="Tree Shakeable">
</p>

Secure cross-window communication library for micro-frontends with contract-validated messaging, origin-based security policies, and connection lifecycle management.

• 👉 See [**documentation**](https://www.hyperfrontend.dev/docs/libraries/nexus/)

## What is @hyperfrontend/nexus?

Nexus provides a complete infrastructure for building secure, reliable communication between browser windows, iframes, and micro-frontend applications. At its core, Nexus implements a **broker-channel architecture** where a central broker manages multiple channels, each representing a connection to another window or frame.

Unlike raw `postMessage` usage, Nexus enforces **communication contracts**—typed agreements defining which message types each participant can send and receive. This contract-first approach catches integration errors at development time rather than production, making micro-frontend systems significantly more maintainable as they scale.

### Key Features

- **Contract-Validated Messaging** — Define accepted and emitted message types, with optional JSON Schemas carried for consumers to validate payloads against
- **Broker-Channel Architecture** — Central broker manages multiple independent channels to different windows
- **Origin-Based Security** — Whitelist/blacklist filtering plus custom security policy functions
- **Connection Lifecycle Management** — Full state machine for connect, disconnect, cancel, deny, and destroy operations
- **Event Subscription System** — Subscribe to lifecycle events (open, close, cancel, deny, invalid, connect-timeout, security events) and user messages
- **Message Queueing** — Automatically queue messages when channel is not yet active
- **Contract Extension & Merging** — Dynamically extend contracts or merge multiple contracts together
- **Functional API Design** — Factory functions with closure-based encapsulation for clean, testable code

### Architecture Highlights

Nexus uses a **functional programming approach** with factory functions (`createBroker`, `createChannel`) that return handle objects. Internal state is encapsulated via closures, making the system highly testable and avoiding the complexity of class-based inheritance. The routing layer uses a handler registry pattern, allowing protocol actions (REQUEST_CONNECTION, ACCEPT_CONNECTION, etc.) to be processed by dedicated handlers.

For a comprehensive deep dive into the library's internals, see the [Architecture Documentation](https://github.com/AndrewRedican/hyperfrontend/blob/main/libs/nexus/ARCHITECTURE.md).

## Why Use @hyperfrontend/nexus?

### Type-Safe Contracts Prevent Integration Bugs

Micro-frontend architectures often fail at integration points where different teams assume different message formats. Nexus contracts explicitly declare what each window sends and accepts:

```typescript
const contract: IChannelContract = {
  emitted: [
    {
      type: 'USER_UPDATED',
      schema: {
        /* JSON Schema */
      },
    },
    { type: 'NAVIGATION_REQUEST' },
  ],
  accepted: [{ type: 'USER_DATA' }, { type: 'NAVIGATION_COMPLETE' }],
}
```

This makes communication agreements explicit, version-controlled, and enforced at runtime.

### Origin-Based Security Without Boilerplate

Cross-origin messaging is a common attack vector. Nexus provides built-in security through whitelist/blacklist filtering and custom policy functions—eliminating the need to manually check `event.origin` in every message handler:

```typescript
const broker = createBroker({
  name: 'secure-broker',
  contract,
  settings: {
    whitelist: ['https://app1.example.com', 'https://app2.example.com'],
  },
})

// Or use custom logic
broker.setSecurityPolicy((event) => {
  return event.origin.endsWith('.example.com')
})
```

### Hub-and-Spoke Patterns for Complex Topologies

Real micro-frontend systems often have complex communication needs: a shell application coordinating multiple micro-apps, broadcast messages to all participants, or direct messaging between specific windows. Nexus's broker architecture naturally supports these patterns:

```typescript
// Central hub managing multiple spokes
const hub = createBroker({ name: 'shell', contract })

const spokes = [
  hub.addChannel('user-app', userFrame.contentWindow),
  hub.addChannel('cart-app', cartFrame.contentWindow),
  hub.addChannel('checkout-app', checkoutFrame.contentWindow),
]

// Connect all
spokes.forEach((ch) => ch.connect())

// Broadcast to all
spokes.forEach((ch) => ch.send('THEME_CHANGED', { theme: 'dark' }))
```

### Full Lifecycle Control

Connection management in distributed systems is notoriously tricky. Nexus provides explicit lifecycle events and state transitions:

```typescript
const channel = broker.addChannel('partner', partnerWindow)

channel.on((event, data, channelInfo) => {
  switch (event) {
    case 'open':
      /* connection established */ break
    case 'close':
      /* graceful disconnect */ break
    case 'cancel':
      /* connection attempt cancelled */ break
    case 'deny':
      /* connection request denied */ break
    case 'invalid':
      /* protocol violation detected */ break
  }
})

channel.connect()
```

### Message Filtering for Clean Handler Code

Instead of large switch statements, use composable message filters:

```typescript
import { byType, compose } from '@hyperfrontend/nexus'

channel.onMessage(compose(byType('USER_LOGIN', handleLogin), byType('USER_LOGOUT', handleLogout), byType('DATA_SYNC', handleSync)))
```

## Protocol Overview

Nexus implements a **three-way handshake protocol** (REQUEST → ACCEPT → OPEN) for establishing connections, with graceful disconnection, cancellation, denial, and timeout handling. The summaries below map the territory; the [Architecture Documentation](https://github.com/AndrewRedican/hyperfrontend/blob/main/libs/nexus/ARCHITECTURE.md) covers every flow in depth.

### Connection Handshake

Initiation is symmetric: either side may call `connect()` first, and simultaneous requests resolve deterministically via a broker-id tie-break. Pending handshake messages are re-sent every `requestRetryMs` (default 500 ms) until answered, and a handshake unanswered past `connectTimeoutMs` (default 10 000 ms) fires `connect-timeout`, leaving the channel inactive and reconnectable with its queued messages retained. Each side pins the counterpart's origin during the handshake, and inbound messages from any other origin are dropped. See [Protocol Design](https://github.com/AndrewRedican/hyperfrontend/blob/main/libs/nexus/ARCHITECTURE.md#protocol-design).

### Contract Compatibility

Contracts are exchanged during the handshake, but vocabulary differences never gate the connection — only `accepted` entries flagged `required: true` do (each must appear in the counterpart's `emitted` list), so additive contract evolution stays non-breaking in both directions. A contract may also carry an optional `version` string that nexus attaches no semantics to; a `contractCompat` rule in the channel settings can compare the two contracts and deny the pair before it opens — when the responder's rule rejects an incoming request, the `deny` event fires with the rule's reason and `reason: 'incompatible-contract'` on both the denying responder and the denied initiator. See [Contract Compatibility](https://github.com/AndrewRedican/hyperfrontend/blob/main/libs/nexus/ARCHITECTURE.md#contract-compatibility).

### Security Negotiation

Channels can negotiate an encrypted envelope during the handshake: register a security provider on the broker — via `broker.registerProtocol(version, provider)` or the `settings.security.protocols` bag — and opt the channel in with `security: { protocol: ... }`. Both ends attach the security transport before queued messages flush, so product traffic (including sends queued before the handshake) leaves as `Uint8Array` ciphertext while the handshake actions themselves stay plaintext. Negotiation fails open by default — plaintext fallback with a warning — and `mode: 'fail-closed'` denies the connection instead with `reason: 'security-unavailable'`. The transport seam is public: `createSecurityTransport` plus the `SecurityTransport` and `SecurityProvider` types define the boundary a security package implements — `@hyperfrontend/network-protocol` satisfies it directly. See [Security Model](https://github.com/AndrewRedican/hyperfrontend/blob/main/libs/nexus/ARCHITECTURE.md#security-model).

### Disconnection & Cancellation

An active channel closes gracefully through a CLOSE/CLOSE_ACKNOWLEDGED exchange, firing `close` on both sides; a pending connection can be abandoned by either party through CANCEL/CANCEL_ACKNOWLEDGED, firing `cancel`. Denials (DENY_CONNECTION) and protocol violations (INVALID_REQUEST) round out the failure verbs, and every connection attempt ends in exactly one of `open`, `close`, `cancel`, `deny`, or `connect-timeout`. See [Protocol Design](https://github.com/AndrewRedican/hyperfrontend/blob/main/libs/nexus/ARCHITECTURE.md#protocol-design).

### Security Policies

Connection-time access control runs before a channel opens: origin `whitelist`/`blacklist` settings filter every inbound message (a non-empty whitelist takes precedence), and a custom policy function — `broker.setSecurityPolicy((event: MessageEvent) => boolean)` — vets requests during handshake handling, with rejected requests answered by DENY_CONNECTION. See [Security Model](https://github.com/AndrewRedican/hyperfrontend/blob/main/libs/nexus/ARCHITECTURE.md#security-model).

### Logging

All internal output routes through a `Logger` from `@hyperfrontend/logging`. Set verbosity with the `logLevel` setting (`'error' | 'warn' | 'log' | 'info' | 'debug' | 'none'`) or inject a custom logger (Winston, Pino, etc.) via `settings.logger`; channels inherit the broker's logger, exposed as `broker.logger`. See [Logging System](https://github.com/AndrewRedican/hyperfrontend/blob/main/libs/nexus/ARCHITECTURE.md#logging-system).

## Installation

```bash
npm install @hyperfrontend/nexus
```

## Quick Start

```typescript
import { createBroker } from '@hyperfrontend/nexus'

// Define communication contract
const contract = {
  emitted: [{ type: 'PING' }],
  accepted: [{ type: 'PONG' }],
}

// Create broker
const broker = createBroker({
  name: 'main-app',
  contract,
  settings: { logLevel: 'debug' },
})

// Add channel to iframe
const iframe = document.querySelector('iframe')
const channel = broker.addChannel('child-app', iframe.contentWindow)

// Subscribe to messages
channel.onMessage((message) => {
  console.log('Received:', message.type, message.data)
})

// Connect and send
channel.connect()
channel.send('PING', { timestamp: Date.now() })
```

### Using the Default Broker

For quick prototyping, use the pre-configured singleton broker:

```typescript
import { defaultBroker } from '@hyperfrontend/nexus'

const channel = defaultBroker.addChannel('my-channel', targetWindow)
channel.connect()
channel.send('MESSAGE', { hello: 'world' })
```

## API Overview

### Core Factory Functions

| Export                            | Description                                                                   |
| --------------------------------- | ----------------------------------------------------------------------------- |
| `createBroker(config)`            | Creates a message broker that manages multiple channels                       |
| `createChannel(config, deps)`     | Creates a single channel (typically called via broker.addChannel)             |
| `mergeContracts(...contracts)`    | Combines multiple contracts into one, deduplicating action types              |
| `createSecurityTransport(config)` | Wraps a security provider's wire pipeline for one channel (the security seam) |

### Broker Handle

| Property/Method                       | Description                                        |
| ------------------------------------- | -------------------------------------------------- |
| `id`                                  | Unique broker identifier                           |
| `name`                                | Broker name                                        |
| `contract`                            | Current communication contract                     |
| `channels`                            | List of active channels                            |
| `addChannel(name, target, settings?)` | Creates and registers a new channel                |
| `getChannel(ref)`                     | Retrieves channel by name, id, or window reference |
| `removeChannel(ref)`                  | Removes a channel from the broker                  |
| `setSecurityPolicy(fn)`               | Sets custom origin validation function             |
| `extendContract(contract)`            | Extends broker contract (if enabled)               |
| `registerProtocol(version, provider)` | Registers a security provider for negotiation      |
| `unregisterProtocol(version)`         | Removes a registered security provider             |

### Channel Handle

| Property/Method       | Description                        |
| --------------------- | ---------------------------------- |
| `id`                  | Unique channel identifier          |
| `name`                | Channel name                       |
| `isActive()`          | Returns connection status          |
| `connect()`           | Initiates connection handshake     |
| `disconnect(notify?)` | Gracefully closes connection       |
| `cancel(notify?)`     | Cancels pending connection         |
| `destroy(notify?)`    | Forcefully terminates channel      |
| `send(type, data)`    | Sends a user message               |
| `on(handler)`         | Subscribes to lifecycle events     |
| `onMessage(handler)`  | Subscribes to user messages        |
| `toJSON()`            | Returns serializable channel state |

### Lifecycle Events

Events delivered to `channel.on(...)` subscribers:

| Event             | Fired when                                        | Payload                        |
| ----------------- | ------------------------------------------------- | ------------------------------ |
| `open`            | Connection successfully established (both sides)  | `{ origin, contract }`         |
| `close`           | Graceful disconnection completed                  | `{ notify }`                   |
| `cancel`          | Connection attempt cancelled before completion    | `{ notify }`                   |
| `deny`            | Connection request denied by a handshake gate     | `{ error?, reason?, origin? }` |
| `invalid`         | Protocol violation or unexpected-origin drop      | `{ error, action? }`           |
| `connect-timeout` | Handshake deadline expired with no answer         | `{ elapsedMs }`                |
| `security-ready`  | Encrypted security transport attached & confirmed | `{ protocol, active }`         |
| `security-error`  | Security transport operation failed               | `{ message, code, cause? }`    |

### Deny Reasons

The `deny` payload's optional machine-readable `reason`:

| Reason                    | Meaning                                                                                        |
| ------------------------- | ---------------------------------------------------------------------------------------------- |
| `'incompatible-contract'` | A `contractCompat` rule rejected the contract pair                                             |
| `'security-unavailable'`  | A fail-closed channel could not obtain an encrypted transport                                  |
| _(absent)_                | The request failed a base gate: invalid contract, missing required actions, or security policy |

### Filter Utilities

| Export                                                                     | Description                       |
| -------------------------------------------------------------------------- | --------------------------------- |
| `openFilter`, `closeFilter`, `cancelFilter`, `denyFilter`, `invalidFilter` | Event-specific filter creators    |
| `byType(type, handler)`                                                    | Message type filter               |
| `compose(...filters)`                                                      | Combines multiple message filters |

### Types

| Type                 | Description                                                             |
| -------------------- | ----------------------------------------------------------------------- |
| `IChannelContract`   | Contract with accepted and emitted action arrays and optional `version` |
| `IActionDescription` | Action type definition with optional schema and `required` flag         |
| `ContractCompat`     | Channel-settings rule deciding whether two contracts may interoperate   |
| `BrokerHandle`       | Broker instance interface                                               |
| `ChannelHandle`      | Channel instance interface                                              |
| `ChannelEvent`       | Lifecycle and security event types (see Lifecycle Events above)         |
| `IMessage`           | User message with type and optional data                                |
| `SecurityProvider`   | Security implementation a broker registers for negotiation              |
| `SecurityTransport`  | Per-channel encrypted transport attached after negotiation              |

## Compatibility

| Platform                      | Support |
| ----------------------------- | :-----: |
| Browser                       |   ✅    |
| Node.js                       |   ✅    |
| Web Workers                   |   ✅    |
| Deno, Bun, Cloudflare Workers |   ✅    |

### Output Formats

| Format | File                       | Tree-Shakeable |
| ------ | -------------------------- | :------------: |
| ESM    | `index.esm.js`             |       ✅       |
| CJS    | `index.cjs.js`             |       ❌       |
| IIFE   | `bundle/index.iife.min.js` |       ❌       |
| UMD    | `bundle/index.umd.min.js`  |       ❌       |

### CDN Usage

```html
<!-- unpkg -->
<script src="https://unpkg.com/@hyperfrontend/nexus"></script>

<!-- jsDelivr -->
<script src="https://cdn.jsdelivr.net/npm/@hyperfrontend/nexus"></script>

<script>
  const { createBroker, createChannel } = HyperfrontendNexus
</script>
```

**Global variable:** `HyperfrontendNexus`

### Peer Dependencies

| Package                         | Type     |
| ------------------------------- | -------- |
| @hyperfrontend/network-protocol | Optional |

## Part of hyperfrontend

This library is part of the [hyperfrontend](https://github.com/AndrewRedican/hyperfrontend) monorepo.

**📖 [Full documentation](https://www.hyperfrontend.dev/docs/libraries/nexus)**

- Optionally uses [@hyperfrontend/network-protocol](https://github.com/AndrewRedican/hyperfrontend/tree/main/libs/network-protocol) for encrypted messaging

## License

[MIT](https://github.com/AndrewRedican/hyperfrontend/blob/main/LICENSE.md)
