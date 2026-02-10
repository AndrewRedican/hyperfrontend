# Nexus Architecture

**Complete Overview of `@hyperfrontend/nexus`**

---

## Overview

`@hyperfrontend/nexus` is a cross-window communication library designed for micro-frontend architectures. It implements a TCP-like connection protocol over the browser's `postMessage` API, providing secure, contract-validated messaging between browser contexts (iframes, windows, and web workers).

### Target Use Cases

1. **Micro-frontend communication** — Shell applications coordinating multiple micro-apps
2. **Iframe integration** — Secure bidirectional messaging with embedded content
3. **Multi-window applications** — Communication between browser windows/tabs
4. **Plugin architectures** — Host-to-plugin communication with contract enforcement

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Design Philosophy](#design-philosophy)
3. [Module Structure](#module-structure)
4. [Core Concepts](#core-concepts)
5. [Protocol Design](#protocol-design)
6. [Handler Reference](#handler-reference)
7. [Event System](#event-system)
8. [Security Model](#security-model)
9. [Internal Dependencies](#internal-dependencies)
10. [Integration Points](#integration-points)
11. [Public API Surface](#public-api-surface)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                      NEXUS ARCHITECTURE                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    BROKER LAYER                          │   │
│  │  - Creates and manages channels                          │   │
│  │  - Routes incoming postMessage events                    │   │
│  │  - Validates contracts and origins                       │   │
│  │  - Applies security policies                             │   │
│  │  - Protocol registry for security providers              │   │
│  └─────────────────────────────────────────────────────────┘   │
│                            │                                    │
│                            ▼                                    │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                   CHANNEL LAYER                          │   │
│  │  - Manages connection lifecycle                          │   │
│  │  - State machine for connection states                   │   │
│  │  - Message queueing and delivery                         │   │
│  │  - Event/message subscriptions                           │   │
│  │  - Security transport integration                        │   │
│  └─────────────────────────────────────────────────────────┘   │
│                            │                                    │
│                            ▼                                    │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                   CORE LAYER                             │   │
│  │  - Action creators (protocol messages)                   │   │
│  │  - Channel registry (O(1) lookups)                       │   │
│  │  - Process manager (connection tracking)                 │   │
│  │  - Validation utilities                                  │   │
│  └─────────────────────────────────────────────────────────┘   │
│                            │                                    │
│                            ▼                                    │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                 SECURITY LAYER (Optional)                │   │
│  │  - Protocol negotiation (v1/v2/none)                     │   │
│  │  - Security transport adapters                           │   │
│  │  - Encryption/obfuscation pipeline                       │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Design Philosophy

The library follows **functional programming principles** with factory-based architecture.

### Key Design Decisions

| Aspect               | Implementation                        | Rationale                                                  |
| -------------------- | ------------------------------------- | ---------------------------------------------------------- |
| **State Management** | Closure-based encapsulation           | True information hiding, prevents external mutation        |
| **Factory Pattern**  | `createBroker()`, `createChannel()`   | Testable, composable, no class inheritance complexity      |
| **Registry**         | Instance-based with WeakMap/Map       | O(1) lookups, memory-efficient, multiple brokers supported |
| **Process Tracking** | UUID-based ProcessManager             | Clean lifecycle management for in-flight connections       |
| **Router Pattern**   | Handler registry keyed by action type | Single responsibility, extensible protocol                 |
| **Immutability**     | `Object.freeze()`, spread patterns    | Predictable state transitions                              |

### Notable Patterns

- **Functional Core, Imperative Shell** — Pure logic in core, side effects at boundaries
- **Handler Registry** — Extensible protocol handling
- **WeakMap for Window References** — Prevents memory leaks
- **Immutable State Updates** — Predictable state transitions

---

## Module Structure

### Directory Layout

```
libs/nexus/src/
├── index.ts                    # Public API exports
├── singleton.ts                # Default broker instance
│
├── broker/                     # Message broker implementation
│   ├── factory.ts              # createBroker() factory
│   ├── types.ts                # Broker interfaces
│   ├── defaults.ts             # Default settings
│   ├── channels/               # Channel management (add, get, list, remove)
│   ├── routing/                # Protocol action handlers (11 handlers)
│   └── security/               # Origin filtering, policy application
│
├── channel/                    # Channel implementation
│   ├── factory.ts              # createChannel() factory
│   ├── types.ts                # Channel internals
│   ├── defaults.ts             # Default channel settings
│   ├── lifecycle/              # connect, disconnect, cancel, destroy
│   ├── messaging/              # send, receive, queue, flush
│   ├── state/                  # State management (activate, deactivate, etc.)
│   └── subscription/           # Event and message subscriptions
│
├── core/                       # Core utilities
│   ├── actions/                # Protocol action creators (11 actions)
│   ├── registry/               # Channel registry (WeakMap/Map based)
│   ├── processes/              # Process manager for connection tracking
│   └── validation/             # Input validation (name, contract, origin)
│
├── types/                      # TypeScript type definitions
│   ├── action.ts               # Protocol action types
│   ├── channel.ts              # Channel handle interface
│   ├── contract.ts             # Channel contract interface
│   ├── events.ts               # Lifecycle event types
│   ├── message.ts              # User message interface
│   ├── security.ts             # Security types (transport, negotiation)
│   └── validation.ts           # Validation result types
│
├── filters/                    # Utility filters
│   ├── events/                 # Event filters (open, close, cancel, deny, invalid)
│   └── messages/               # Message filters (byType, compose)
│
├── schema/                     # JSON Schema validation
│   ├── definitions/            # Schema definitions
│   └── validate/               # Validation functions
│
├── security/                   # Security integration
│   ├── negotiation/            # Protocol negotiation logic
│   ├── registry/               # Protocol provider registry
│   └── transport/              # Security transport adapters
│
├── setup/                      # Initialization utilities
│   └── merge-contracts.ts      # Contract merging
│
├── errors/                     # Custom error classes
│   ├── validation-error.ts
│   ├── connection-error.ts
│   └── contract-error.ts
│
├── constants/                  # Protocol constants
│   ├── action-types.ts         # Protocol action type strings
│   └── event-types.ts          # Lifecycle event constants
│
├── utils/                      # Helper utilities
│
└── integration-tests/          # Browser integration tests
    ├── connection-flow.browser.spec.ts
    ├── multi-channel.browser.spec.ts
    ├── security.browser.spec.ts
    └── ...
```

---

## Core Concepts

### 1. Broker (`BrokerHandle`)

The broker is the central coordinator that:

- Manages multiple channels
- Listens for incoming `postMessage` events
- Routes messages to appropriate handlers
- Enforces security policies

```typescript
interface BrokerHandle {
  readonly id: string
  readonly name: string
  readonly contract: IChannelContract
  readonly channels: ReadonlyArray<ChannelJSON>

  addChannel(name: string, target: Window, settings?: IChannelSettings): ChannelHandle
  getChannel(reference: string | Window): ChannelHandle | null
  removeChannel(reference: string | Window): void
  setSecurityPolicy(policy: SecurityPolicy): BrokerHandle
  extendContract(contract: IChannelContract): BrokerHandle

  // Security protocol management
  registerProtocol(version: 'v1' | 'v2', provider: unknown): BrokerHandle
  unregisterProtocol(version: 'v1' | 'v2'): BrokerHandle
  hasProtocol(version: SecurityProtocolVersion): boolean
  getSupportedProtocols(): SecurityProtocolVersion[]
}
```

### 2. Channel (`ChannelHandle`)

A channel represents a communication endpoint to another window:

```typescript
interface ChannelHandle {
  readonly id: string
  readonly name: string
  readonly target: Window

  // State queries
  isActive(): boolean
  toJSON(): ChannelJSON

  // Lifecycle
  connect(): void
  disconnect(notify?: boolean): void
  cancel(notify?: boolean): void
  destroy(notify?: boolean): void

  // Communication
  send(type: string, data?: unknown): void

  // Subscriptions
  on(handler: EventHandler): () => void
  onMessage(handler: MessageHandler): () => void
}
```

### 3. Contract (`IChannelContract`)

Contracts define the messaging agreement between parties:

```typescript
interface IChannelContract {
  emitted: IActionDescription[] // Message types this party sends
  accepted: IActionDescription[] // Message types this party receives
}

interface IActionDescription {
  type: string // Message type identifier
  description?: string // Human-readable description
  schema?: object // Optional JSON Schema for validation
}
```

### 4. Actions (Protocol Messages)

The protocol defines 11 action types for connection lifecycle:

| Action Type                      | Purpose                     |
| -------------------------------- | --------------------------- |
| `REQUEST_CONNECTION`             | Initiate connection (SYN)   |
| `ACCEPT_CONNECTION`              | Accept connection (SYN-ACK) |
| `OPEN_CONNECTION`                | Confirm connection (ACK)    |
| `DENY_CONNECTION`                | Reject connection (RST)     |
| `CANCEL_CONNECTION`              | Cancel pending connection   |
| `CANCEL_CONNECTION_ACKNOWLEDGED` | Acknowledge cancellation    |
| `CLOSE_CONNECTION`               | Graceful disconnect         |
| `CLOSE_CONNECTION_ACKNOWLEDGED`  | Acknowledge disconnect      |
| `DESTROY_CONNECTION`             | Force disconnect            |
| `NEW_MESSAGE`                    | User data transmission      |
| `INVALID_REQUEST`                | Protocol violation          |

---

## Protocol Design

### Three-Way Handshake

Nexus implements a TCP-like handshake for reliable connection establishment:

```
HOST A (Initiator)                    HOST B (Responder)
       │                                     │
       │  1. REQUEST_CONNECTION (SYN)        │
       │  ─────────────────────────────────▶ │
       │     { processId, senderId, contract }
       │                                     │
       │  2. ACCEPT_CONNECTION (SYN-ACK)     │
       │  ◀───────────────────────────────── │
       │     { processId, senderId, contract }
       │                                     │
       │  3. OPEN_CONNECTION (ACK)           │
       │  ─────────────────────────────────▶ │
       │     { processId, senderId }         │
       │                                     │
       ▼                                     ▼
  [CHANNEL OPEN]                       [CHANNEL OPEN]
    Event: 'open'                        Event: 'open'
```

**Internal Sequence:**

```
Host A (Initiator)                    Host B (Responder)
─────────────────                    ──────────────────
channel.connect()
    │
    ▼
[createProcess]
[send REQUEST_CONNECTION] ──────────▶ [handleRequest]
                                          │
                                          ▼
                                     [addChannel if new]
                                     [trackProcess]
                                     [validateContract]
                                     [applySecurityPolicy]
                                     [activate]
                                     [send ACCEPT_CONNECTION]
                                          │
[handleAccept] ◀─────────────────────────┘
    │
    ▼
[validateContract]
[applySecurityPolicy]
[activate]
[send OPEN_CONNECTION] ─────────────▶ [handleOpen]
    │                                     │
    ▼                                     ▼
[terminateProcess]                   [terminateProcess]
[notifyEvent('open')]                [notifyEvent('open')]
    │                                     │
    ▼                                     ▼
[ACTIVE]                              [ACTIVE]
```

### Denial Flow

When a connection is rejected (invalid contract or security policy failure):

```
Host A (Initiator)                    Host B (Responder)
─────────────────                    ──────────────────
channel.connect()
    │
    ▼
[send REQUEST_CONNECTION] ──────────▶ [handleRequest]
                                          │
                                          ▼
                                     [validateContract FAILS]
                                        — or —
                                     [securityPolicy REJECTS]
                                          │
                                          ▼
                                     [send DENY_CONNECTION]
                                     [terminateProcess]
                                          │
[handleDeny] ◀───────────────────────────┘
    │
    ▼
[terminateProcess]
[notifyEvent('deny')]
    │
    ▼
[CLOSED - never connected]
```

### Graceful Disconnection

```
HOST A (Disconnector)                 HOST B (Partner)
       │                                     │
  [CHANNEL OPEN]                       [CHANNEL OPEN]
       │                                     │
       │  1. CLOSE_CONNECTION                │
       │  ─────────────────────────────────▶ │
       │                                     │
       │  2. CLOSE_CONNECTION_ACKNOWLEDGED   │
       │  ◀───────────────────────────────── │
       │                                     │
       ▼                                     ▼
    Event: 'close'                       Event: 'close'
  [CHANNEL CLOSED]                     [CHANNEL CLOSED]
```

### State Transitions

```
    ┌─────────┐
    │ INITIAL │
    └────┬────┘
         │ connect()
         ▼
    ┌─────────────┐     DENY      ┌────────┐
    │ CONNECTING  │ ────────────▶ │ DENIED │
    └──────┬──────┘               └────────┘
           │ ACCEPT + OPEN
           ▼
    ┌─────────┐     disconnect()  ┌────────┐
    │ ACTIVE  │ ────────────────▶ │ CLOSED │
    └─────────┘                   └────────┘
```

---

## Handler Reference

Each protocol action is processed by a dedicated handler. All handlers receive the broker state, channel registry, process manager, and incoming message.

| Handler                    | File                                                                                                                                      | Responsibilities                                                    |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `handleRequest`            | [handle-request](https://github.com/AndrewRedican/hyperfrontend/blob/main/libs/nexus/src/broker/routing/handle-request.ts)                | Validate contract, apply policy, activate channel, send ACCEPT      |
| `handleAccept`             | [handle-accept](https://github.com/AndrewRedican/hyperfrontend/blob/main/libs/nexus/src/broker/routing/handle-accept.ts)                  | Validate contract, apply policy, activate, send OPEN, notify 'open' |
| `handleOpen`               | [handle-open](https://github.com/AndrewRedican/hyperfrontend/blob/main/libs/nexus/src/broker/routing/handle-open.ts)                      | Terminate process, notify 'open' (responder side)                   |
| `handleDeny`               | [handle-deny](https://github.com/AndrewRedican/hyperfrontend/blob/main/libs/nexus/src/broker/routing/handle-deny.ts)                      | Terminate process, notify 'deny' with error context                 |
| `handleCancel`             | [handle-cancel](https://github.com/AndrewRedican/hyperfrontend/blob/main/libs/nexus/src/broker/routing/handle-cancel.ts)                  | Cancel channel, send CANCEL_ACK, notify 'cancel'                    |
| `handleCancelAcknowledged` | [handle-cancel-ack](https://github.com/AndrewRedican/hyperfrontend/blob/main/libs/nexus/src/broker/routing/handle-cancel-acknowledged.ts) | Terminate process, notify 'cancel' (initiator side)                 |
| `handleClose`              | [handle-close](https://github.com/AndrewRedican/hyperfrontend/blob/main/libs/nexus/src/broker/routing/handle-close.ts)                    | Disconnect channel, send CLOSE_ACK, notify 'close'                  |
| `handleCloseAcknowledged`  | [handle-close-ack](https://github.com/AndrewRedican/hyperfrontend/blob/main/libs/nexus/src/broker/routing/handle-close-acknowledged.ts)   | Terminate process, notify 'close' (initiator side)                  |
| `handleMessage`            | [handle-message](https://github.com/AndrewRedican/hyperfrontend/blob/main/libs/nexus/src/broker/routing/handle-message.ts)                | Validate payload, forward to subscribers via `notifyMessage()`      |
| `handleDestroy`            | [handle-destroy](https://github.com/AndrewRedican/hyperfrontend/blob/main/libs/nexus/src/broker/routing/handle-destroy.ts)                | Force-destroy connection, clean up resources                        |
| `handleInvalid`            | [handle-invalid](https://github.com/AndrewRedican/hyperfrontend/blob/main/libs/nexus/src/broker/routing/handle-invalid.ts)                | Log invalid requests, optionally notify sender                      |

---

## Event System

Channels emit lifecycle events to subscribers. Each event has a specific trigger and payload structure.

### Lifecycle Events

| Event       | Trigger                             | Payload                |
| ----------- | ----------------------------------- | ---------------------- |
| `'open'`    | Connection successfully established | `{ origin, contract }` |
| `'close'`   | Connection gracefully closed        | `{ notify: boolean }`  |
| `'cancel'`  | Pending connection cancelled        | `{ notify: boolean }`  |
| `'deny'`    | Connection request rejected         | `{ error, origin }`    |
| `'destroy'` | Connection force-destroyed          | `{}`                   |

### Security Events

| Event                 | Payload                     | Description                    |
| --------------------- | --------------------------- | ------------------------------ |
| `security-negotiated` | `{ protocol, isPreferred }` | Protocol negotiation completed |
| `security-ready`      | `{ protocol }`              | Security transport is active   |
| `security-error`      | `{ message, code, cause? }` | Security operation failed      |

### Event Subscription

```typescript
// Subscribe to all events
channel.on((event, data) => {
  switch (event) {
    case 'open':
      console.log(`Connected to ${data.origin}`)
      break
    case 'close':
      console.log('Connection closed')
      break
    case 'security-ready':
      console.log(`Secure channel using ${data.protocol}`)
      break
  }
})

// Use filter utilities for specific events
import { openFilter, closeFilter } from '@hyperfrontend/nexus/filters'

channel.on(openFilter((data) => console.log('Opened:', data.origin)))
channel.on(closeFilter((data) => console.log('Closed')))
```

---

## Security Model

Nexus provides a multi-layered security approach:

### Layer 1: Origin Filtering

Basic origin-based access control:

```typescript
const broker = createBroker({
  settings: {
    whitelist: ['https://trusted.com'],
    blacklist: ['https://malicious.com'],
  },
})
```

### Layer 2: Security Policy

Custom programmatic validation:

```typescript
broker.setSecurityPolicy((event: MessageEvent) => {
  return event.origin.endsWith('.mycompany.com')
})
```

### Layer 3: Contract Validation

Schema-based message validation:

```typescript
const contract: IChannelContract = {
  emitted: [
    {
      type: 'USER_DATA',
      schema: {
        type: 'object',
        properties: {
          userId: { type: 'string' },
          email: { type: 'string', format: 'email' },
        },
        required: ['userId'],
      },
    },
  ],
  accepted: [{ type: 'ACK' }],
}
```

### Layer 4: Transport Security (Optional)

End-to-end encryption via `@hyperfrontend/network-protocol`:

| Protocol | Description                                 | Use Case             |
| -------- | ------------------------------------------- | -------------------- |
| `none`   | Passthrough, no encryption                  | Trusted environments |
| `v1`     | Obfuscation-first with dynamic key exchange | Basic protection     |
| `v2`     | Pre-shared key with dynamic key rotation    | High security        |

#### Security Negotiation Flow

During connection handshake, parties negotiate the security protocol:

```
HOST A (Initiator)                    HOST B (Responder)
       │                                     │
       │  REQUEST_CONNECTION + security      │
       │  ─────────────────────────────────▶ │
       │     { supported: ['v2', 'v1'] }     │
       │                                     │
       │  ACCEPT_CONNECTION + security       │
       │  ◀───────────────────────────────── │
       │     { negotiated: 'v2', params }    │
       │                                     │
       │  OPEN_CONNECTION + security         │
       │  ─────────────────────────────────▶ │
       │     { active: true, protocol: 'v2' }│
       │                                     │
       ▼                                     ▼
  [SECURE CHANNEL]                     [SECURE CHANNEL]
```

#### Security Transport Architecture

```
┌────────────────────────────────────────────────────────────────┐
│                          Nexus Channel                          │
├────────────────────────────────────────────────────────────────┤
│                    Security Transport Adapter                   │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │  NoneTransport  │  │ SecureTransport │  │ SecureTransport │ │
│  │    (none)       │  │     (v1)        │  │     (v2)        │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
├────────────────────────────────────────────────────────────────┤
│               network-protocol Provider                         │
│              (encryption/decryption pipeline)                   │
├────────────────────────────────────────────────────────────────┤
│                      postMessage API                            │
└────────────────────────────────────────────────────────────────┘
```

#### Configuration Examples

```typescript
// Register protocol at broker level
broker.registerProtocol('v2', createProtocol(logger, 'shared-key', 60))

// Override per-channel
const channel = broker.addChannel('secure', targetWindow, {
  security: {
    protocol: 'v2',
    sharedKey: 'channel-specific-key',
    refreshRate: 30,
  },
})

// Protocol registry API
broker.hasProtocol('v2') // true
broker.getSupportedProtocols() // ['v2', 'none']
broker.unregisterProtocol('v2') // Remove provider
```

---

## Internal Dependencies

### Hyperfrontend Libraries

```json
{
  "@hyperfrontend/function-utils": "0.0.0",
  "@hyperfrontend/logging": "0.0.0",
  "@hyperfrontend/random-generator-utils": "0.0.0"
}
```

### External Dependencies

```json
{
  "jsonschema": "1.5.0"
}
```

### Optional Integration

- `@hyperfrontend/network-protocol` — For transport-level security (v1/v2 protocols)

---

## Integration Points

### With Other Hyperfrontend Libraries

| Library                                 | Integration                            |
| --------------------------------------- | -------------------------------------- |
| `@hyperfrontend/network-protocol`       | Optional transport security            |
| `@hyperfrontend/logging`                | Logging infrastructure                 |
| `@hyperfrontend/random-generator-utils` | UUID generation                        |
| `@hyperfrontend/function-utils`         | Utility functions                      |
| `@hyperfrontend/state-machine`          | Potential state management enhancement |

### With External Systems

- **Micro-frontend frameworks** — Module federation, single-spa
- **Web workers** — Worker-to-main thread communication
- **Service workers** — Offline-capable messaging
- **Electron** — Main-renderer process communication

---

## Public API Surface

### Exports from `@hyperfrontend/nexus`

```typescript
// Core factories
export { createBroker } from './broker'
export { createChannel } from './channel'
export { mergeContracts } from './setup'
export { broker as defaultBroker, DEFAULT_CONTRACT } from './singleton'

// Broker types
export type { BrokerHandle, BrokerConfig, BrokerSettings, BrokerState, SecurityPolicy }

// Channel types
export type { ChannelHandle, ChannelJSON, IChannelSettings, IChannelConfig }

// Contract types
export type { IChannelContract, IActionDescription }

// Message types
export type { IMessage, MessageEnvelope }

// Event types
export type { ChannelEvent, EventData, OpenEventData, CloseEventData, ... }

// Action types
export type { IAction, ActionType }

// Filter utilities
export { openFilter, closeFilter, cancelFilter, denyFilter, invalidFilter, createEventFilter }
export { byType, compose, createMessageFilter }
export type { MessageFilter, MessagePredicate, MessageHandler, EventHandler }
```
