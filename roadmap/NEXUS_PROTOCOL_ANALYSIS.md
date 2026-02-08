# Nexus Protocol Specification

**Complete Technical Documentation for `@hyperfrontend/nexus`**

_Version: 1.0_
_Last Updated: February 8, 2026_

---

## Executive Summary

The `@hyperfrontend/nexus` library implements a TCP-like connection protocol for secure cross-origin communication via the `postMessage` API. It provides a robust, type-safe mechanism for establishing, managing, and terminating bidirectional communication channels between browser contexts (iframes, windows, web workers).

**Key Features:**

- **TCP-Like Three-Way Handshake**: SYN/SYN-ACK/ACK pattern for reliable connection establishment
- **Full Lifecycle Management**: Complete connection, disconnection, and cancellation flows
- **Process Tracking**: UUID-based tracking of all in-flight connection processes
- **Event-Driven Architecture**: Subscriber notifications for all lifecycle events
- **Security Policies**: Configurable origin filtering and custom security hooks
- **Contract Validation**: Schema-based validation of channel contracts
- **Functional Architecture**: Factory-based design with dependency injection for testability

---

## Table of Contents

1. [Protocol Actions](#protocol-actions)
2. [Connection Flow Diagrams](#connection-flow-diagrams)
3. [Handler Reference](#handler-reference)
4. [Architecture Overview](#architecture-overview)
5. [Channel Handle Interface](#channel-handle-interface)
6. [Event System](#event-system)
7. [Security Model](#security-model)
8. [Source File Reference](#source-file-reference)

---

## Protocol Actions

### Action Types

The Nexus protocol defines 11 action types for managing the full lifecycle of cross-origin channels:

| Action Type                                         | Purpose                                |
| --------------------------------------------------- | -------------------------------------- |
| `[nexus] connection-request`                        | Initiate a connection (SYN)            |
| `[nexus] connection-request-accepted`               | Accept a connection request (SYN-ACK)  |
| `[nexus] connection-opened`                         | Confirm connection establishment (ACK) |
| `[nexus] connection-request-denied`                 | Reject a connection request (RST)      |
| `[nexus] connection-request-cancelled`              | Cancel a pending connection            |
| `[nexus] connection-request-cancelled-acknowledged` | Acknowledge cancellation               |
| `[nexus] connection-closed`                         | Initiate graceful disconnection        |
| `[nexus] connection-closed-acknowledged`            | Acknowledge disconnection              |
| `[nexus] connection-destroyed`                      | Force-destroy a connection             |
| `[nexus] new-message`                               | Transmit data over established channel |
| `[nexus] invalid-request`                           | Report an invalid/malformed action     |

> **Source:** [libs/nexus/src/types/action.ts](libs/nexus/src/types/action.ts)

### Action Payload Structure

All protocol actions share a common payload structure:

```typescript
interface NexusAction {
  type: string // Action type (e.g., '[nexus] connection-request')
  senderId: string // Broker UUID identifying the sender
  processId?: string // Connection process UUID (for tracking in-flight connections)
  contract?: IChannelContract // Channel contract (for REQUEST/ACCEPT)
  data?: unknown // Message payload (for NEW_MESSAGE)
  error?: string // Error description (for DENY/INVALID)
}
```

---

## Connection Flow Diagrams

### Three-Way Handshake (Happy Path)

The protocol follows a TCP-like pattern for reliable connection establishment:

```
┌─────────────────────┐                              ┌─────────────────────┐
│       HOST A        │                              │       HOST B        │
│     (Initiator)     │                              │     (Responder)     │
└─────────┬───────────┘                              └───────────┬─────────┘
          │                                                      │
          │  1. REQUEST_CONNECTION (SYN)                         │
          │  ──────────────────────────────────────────────────▶ │
          │      { processId, senderId, contract }               │
          │                                                      │
          │  2. ACCEPT_CONNECTION (SYN-ACK)                      │
          │  ◀────────────────────────────────────────────────── │
          │      { processId, senderId, contract }               │
          │                                                      │
          │  3. OPEN_CONNECTION (ACK)                            │
          │  ──────────────────────────────────────────────────▶ │
          │      { processId, senderId }                         │
          │                                                      │
          ▼                                                      ▼
    [CHANNEL OPEN]                                        [CHANNEL OPEN]
    Event: 'open'                                         Event: 'open'
```

**Detailed Sequence:**

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

When a connection request is rejected (invalid contract or security policy failure):

```
┌─────────────────────┐                              ┌─────────────────────┐
│       HOST A        │                              │       HOST B        │
│     (Initiator)     │                              │     (Responder)     │
└─────────┬───────────┘                              └───────────┬─────────┘
          │                                                      │
          │  1. REQUEST_CONNECTION                               │
          │  ──────────────────────────────────────────────────▶ │
          │                                                      │
          │  2. DENY_CONNECTION (RST)                            │
          │  ◀────────────────────────────────────────────────── │
          │      { processId, senderId, error }                  │
          │                                                      │
          ▼                                                      │
    Event: 'deny'                                                │
    [NO CONNECTION]                                              │
```

**Detailed Sequence:**

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

### Cancellation Flow

When an initiator cancels a pending connection request:

```
┌─────────────────────┐                              ┌─────────────────────┐
│       HOST A        │                              │       HOST B        │
│     (Initiator)     │                              │     (Responder)     │
└─────────┬───────────┘                              └───────────┬─────────┘
          │                                                      │
          │  1. REQUEST_CONNECTION                               │
          │  ──────────────────────────────────────────────────▶ │
          │                                                      │
          │  2. CANCEL_CONNECTION                                │
          │  ──────────────────────────────────────────────────▶ │
          │      { processId, senderId }                         │
          │                                                      │
          │  3. CANCEL_CONNECTION_ACKNOWLEDGED                   │
          │  ◀────────────────────────────────────────────────── │
          │      { processId, senderId }                         │
          │                                                      │
          ▼                                                      ▼
    Event: 'cancel'                                        Event: 'cancel'
    [NO CONNECTION]                                    [NO CONNECTION]
```

### Close Flow (Graceful Disconnect)

Graceful disconnection of an established channel:

```
┌─────────────────────┐                              ┌─────────────────────┐
│       HOST A        │                              │       HOST B        │
│    (Disconnector)   │                              │      (Partner)      │
└─────────┬───────────┘                              └───────────┬─────────┘
          │                                                      │
    [CHANNEL OPEN]                                        [CHANNEL OPEN]
          │                                                      │
          │  1. CLOSE_CONNECTION                                 │
          │  ──────────────────────────────────────────────────▶ │
          │      { processId, senderId }                         │
          │                                                      │
          │  2. CLOSE_CONNECTION_ACKNOWLEDGED                    │
          │  ◀────────────────────────────────────────────────── │
          │      { processId, senderId }                         │
          │                                                      │
          ▼                                                      ▼
    Event: 'close'                                         Event: 'close'
   [CHANNEL CLOSED]                                    [CHANNEL CLOSED]
```

---

## Handler Reference

Each protocol action is processed by a dedicated handler function. All handlers follow the same signature:

```typescript
function handle*(
  state: BrokerState,
  registry: ChannelRegistry,
  processManager: ProcessManager,
  actions: ActionCreators,
  message: MessageEvent
): void
```

### 1. REQUEST_CONNECTION Handler

**File:** [libs/nexus/src/broker/routing/handle-request.ts](libs/nexus/src/broker/routing/handle-request.ts)

**Responsibilities:**

- Extract `senderId`, `processId`, and `contract` from the incoming action
- Create or retrieve an existing channel for the sender
- Track the process via `processManager.create()`
- Handle re-connection attempts when channel is already active
- Validate the contract schema
- Apply security policy (if configured)
- Check if channel is ready to connect (`isReadyToConnect()`)
- Schedule activation for later if not ready (`scheduleActivation()`)
- Activate the channel and send `ACCEPT_CONNECTION`

```typescript
export function handleRequest(state, registry, processManager, actions, message): void {
  const action = message.data
  const senderId = action.senderId

  if (!isActionWithContract(action)) return

  const processId = action.processId
  const contract = action.contract

  let channel = getById(registry, senderId)
  if (!channel) {
    channel = addChannel(state, registry, processManager, actions, senderId, message.source, {})
  }

  processManager.create(channel)

  if (channel.isActive()) {
    if (senderId === channel.id) {
      channel.sendAction({...acceptConnection...})  // Re-accept on reconnect
    }
    return
  }

  try { validateContractFn(contract) }
  catch {
    channel.sendAction({...denyConnection...})
    processManager.remove(processId)
    return
  }

  if (state.settings.securityPolicy) {
    const allowed = applyPolicy(state.settings.securityPolicy, message)
    if (!allowed) {
      channel.sendAction({...denyConnection...})
      processManager.remove(processId)
      return
    }
  }

  if (!channel.isReadyToConnect()) {
    channel.scheduleActivation(senderId, message.origin, contract, processId)
    return
  }

  channel.activate(message.origin, contract)
  channel.sendAction({...acceptConnection...})
}
```

### 2. ACCEPT_CONNECTION Handler

**File:** [libs/nexus/src/broker/routing/handle-accept.ts](libs/nexus/src/broker/routing/handle-accept.ts)

**Responsibilities:**

- Retrieve channel by process ID
- Skip if channel is already active
- Validate the contract schema
- Apply security policy (cancel if rejected)
- Activate the channel
- Send `OPEN_CONNECTION` to complete the handshake
- Terminate the process
- Notify subscribers with `'open'` event

```typescript
export function handleAccept(state, registry, processManager, actions, message): void {
  const action = message.data

  if (!isActionWithContract(action)) return

  const processId = action.processId
  const contract = action.contract

  const channel = processManager.get(processId)

  if (!channel) return
  if (channel.isActive()) return

  try { validateContract(contract) }
  catch {
    channel.sendAction({...cancelConnection...})
    return
  }

  if (state.settings.securityPolicy) {
    const allowed = applyPolicy(state.settings.securityPolicy, message)
    if (!allowed) {
      channel.sendAction({...cancelConnection...})
      return
    }
  }

  channel.activate(message.origin, contract)
  channel.sendAction({...openConnection...})
  processManager.remove(processId)
  channel.notifyEvent('open', { origin: message.origin, contract })
}
```

### 3. OPEN_CONNECTION Handler

**File:** [libs/nexus/src/broker/routing/handle-open.ts](libs/nexus/src/broker/routing/handle-open.ts)

**Responsibilities:**

- Retrieve channel by process ID
- Terminate the process
- Notify subscribers with `'open'` event (responder side)

```typescript
export function handleOpen(state, registry, processManager, actions, message): void {
  const action = message.data
  const processId = action.processId

  const channel = processManager.get(processId)

  if (!channel) return

  processManager.remove(processId)
  channel.notifyEvent('open', { origin: message.origin })
}
```

### 4. DENY_CONNECTION Handler

**File:** [libs/nexus/src/broker/routing/handle-deny.ts](libs/nexus/src/broker/routing/handle-deny.ts)

**Responsibilities:**

- Retrieve channel by process ID
- Terminate the process
- Notify subscribers with `'deny'` event (including error context)

```typescript
export function handleDeny(state, registry, processManager, actions, message): void {
  const action = message.data
  const processId = action.processId
  const error = action.error

  const channel = processManager.get(processId)

  if (!channel) return

  processManager.remove(processId)
  channel.notifyEvent('deny', { error, origin: message.origin })
}
```

### 5. CANCEL_CONNECTION Handler

**File:** [libs/nexus/src/broker/routing/handle-cancel.ts](libs/nexus/src/broker/routing/handle-cancel.ts)

**Responsibilities:**

- Retrieve channel by sender ID or process ID
- Cancel the channel
- Send `CANCEL_CONNECTION_ACKNOWLEDGED`
- Terminate the process
- Notify subscribers with `'cancel'` event

```typescript
export function handleCancel(state, registry, processManager, actions, message): void {
  const action = message.data
  const senderId = action.senderId
  const processId = action.processId

  const channel = getById(registry, senderId) || processManager.get(processId)

  if (!channel) return

  channel.cancel(false)
  channel.sendAction({...cancelConnectionAcknowledged...})
  processManager.remove(processId)
  channel.notifyEvent('cancel', { notify: true })
}
```

### 6. CANCEL_CONNECTION_ACKNOWLEDGED Handler

**File:** [libs/nexus/src/broker/routing/handle-cancel-acknowledged.ts](libs/nexus/src/broker/routing/handle-cancel-acknowledged.ts)

**Responsibilities:**

- Retrieve channel by process ID
- Terminate the process
- Notify subscribers with `'cancel'` event (initiator side)

```typescript
export function handleCancelAcknowledged(state, registry, processManager, actions, message): void {
  const action = message.data
  const processId = action.processId

  const channel = processManager.get(processId)

  if (!channel) return

  processManager.remove(processId)
  channel.notifyEvent('cancel', { notify: false })
}
```

### 7. CLOSE_CONNECTION Handler

**File:** [libs/nexus/src/broker/routing/handle-close.ts](libs/nexus/src/broker/routing/handle-close.ts)

**Responsibilities:**

- Retrieve channel by sender ID
- Skip if channel is not active
- Disconnect the channel
- Send `CLOSE_CONNECTION_ACKNOWLEDGED`
- Terminate the process
- Notify subscribers with `'close'` event

```typescript
export function handleClose(state, registry, processManager, actions, message): void {
  const action = message.data
  const senderId = action.senderId
  const processId = action.processId

  const channel = getById(registry, senderId)
  if (!channel || !channel.isActive()) return

  channel.disconnect(false)
  channel.sendAction({...closeConnectionAcknowledged...})
  processManager.remove(processId)
  channel.notifyEvent('close', { notify: true })
}
```

### 8. CLOSE_CONNECTION_ACKNOWLEDGED Handler

**File:** [libs/nexus/src/broker/routing/handle-close-acknowledged.ts](libs/nexus/src/broker/routing/handle-close-acknowledged.ts)

**Responsibilities:**

- Retrieve channel by process ID
- Terminate the process
- Notify subscribers with `'close'` event (initiator side)

```typescript
export function handleCloseAcknowledged(state, registry, processManager, actions, message): void {
  const action = message.data
  const processId = action.processId

  const channel = processManager.get(processId)

  if (!channel) return

  processManager.remove(processId)
  channel.notifyEvent('close', { notify: false })
}
```

### 9. NEW_MESSAGE Handler

**File:** [libs/nexus/src/broker/routing/handle-message.ts](libs/nexus/src/broker/routing/handle-message.ts)

**Responsibilities:**

- Retrieve channel by sender ID
- Skip if channel is not active
- Validate the message payload
- Forward message to subscribers via `notifyMessage()`

```typescript
export function handleMessage(state, registry, processManager, actions, message): void {
  const action = message.data
  const senderId = action.senderId

  if (!isActionWithData(action)) return

  const messageData = action.data

  const channel = getById(registry, senderId)
  if (!channel || !channel.isActive()) return

  try { validateAction(messageData) }
  catch {
    if (state.settings.debug) console.info(...)
    return
  }

  channel.notifyMessage(messageData)
}
```

### 10. DESTROY_CONNECTION Handler

**File:** [libs/nexus/src/broker/routing/handle-destroy.ts](libs/nexus/src/broker/routing/handle-destroy.ts)

**Responsibilities:**

- Force-destroy a connection without graceful handshake
- Clean up all associated resources

### 11. INVALID_REQUEST Handler

**File:** [libs/nexus/src/broker/routing/handle-invalid.ts](libs/nexus/src/broker/routing/handle-invalid.ts)

**Responsibilities:**

- Log invalid/malformed requests
- Optionally notify the sender of the error

---

## Architecture Overview

### Design Principles

The Nexus library follows functional programming principles:

| Aspect                   | Implementation                   | Benefit                           |
| ------------------------ | -------------------------------- | --------------------------------- |
| **Architecture**         | Factory functions with closures  | True information hiding           |
| **State Management**     | Immutable state + updateState()  | Predictable state transitions     |
| **Registry**             | Instance-based, scoped           | Multiple brokers possible         |
| **Process Tracking**     | ProcessManager instance          | Clean lifecycle management        |
| **Dependency Injection** | Explicit (passed to factories)   | Excellent testability             |
| **Immutability**         | Object.freeze(), spread patterns | Prevents accidental mutation      |
| **Code Organization**    | Modular subdirectories           | Clear separation of concerns      |
| **Router Pattern**       | Handler registry                 | Extensible, single responsibility |
| **Action Creators**      | Pure factories with DI           | Testable, composable              |

### Core Components

```
libs/nexus/src/
├── broker/           # Message broker (router, handlers)
│   ├── factory.ts    # Broker factory function
│   └── routing/      # Protocol action handlers
├── channel/          # Channel factory and implementation
│   └── factory.ts    # Channel factory function
├── core/             # Core utilities
│   └── processes/    # Process manager
├── types/            # TypeScript type definitions
│   ├── action.ts     # Action types and interfaces
│   └── channel.ts    # Channel handle interface
├── filters/          # Event and message filters
├── schema/           # Contract validation
├── setup/            # Initialization utilities
└── utils/            # Helper functions
```

### Factory-Based Broker

The broker is created via a factory function that encapsulates all state:

```typescript
// libs/nexus/src/broker/factory.ts
export function createBroker(settings: BrokerSettings): Broker {
  const state: BrokerState = {
    id: generateUUID(),
    settings: Object.freeze(settings),
    // ... internal state
  }

  const registry = createRegistry()
  const processManager = createProcessManager()
  const actions = createActionCreators(state.id)
  const router = createRouter(state, registry, processManager, actions)

  return Object.freeze({
    id: state.id,
    addChannel: (target, options) => addChannel(state, registry, processManager, actions, target, options),
    removeChannel: (id) => removeChannel(registry, id),
    getChannel: (id) => getById(registry, id),
    destroy: () => destroyBroker(state, registry, processManager),
  })
}
```

### Process Manager

Tracks in-flight connection processes with UUID-based lookup:

```typescript
interface ProcessManager {
  create(channel: ChannelHandle): string // Returns processId
  get(processId: string): ChannelHandle | undefined
  remove(processId: string): void
}
```

---

## Channel Handle Interface

The `ChannelHandle` interface exposes all methods needed for protocol handlers:

```typescript
interface ChannelHandle {
  readonly id: string
  readonly name: string

  // State queries
  isActive(): boolean
  isReadyToConnect(): boolean

  // Lifecycle operations
  activate(origin: string, contract: IChannelContract): void
  scheduleActivation(senderId: string, origin: string, contract: IChannelContract, processId: string): void
  cancel(notify: boolean): void
  disconnect(notify: boolean): void
  destroy(): void

  // Communication
  sendAction(action: NexusAction): void
  sendMessage(data: unknown): void

  // Event notification
  notifyEvent(event: ChannelEvent, data?: unknown): void
  notifyMessage(message: unknown): void

  // Subscriptions
  onEvent(callback: EventCallback): Unsubscribe
  onMessage(callback: MessageCallback): Unsubscribe
}
```

> **Source:** [libs/nexus/src/types/channel.ts](libs/nexus/src/types/channel.ts)

---

## Event System

### Lifecycle Events

Channels emit the following lifecycle events:

| Event       | Trigger                             | Payload                |
| ----------- | ----------------------------------- | ---------------------- |
| `'open'`    | Connection successfully established | `{ origin, contract }` |
| `'close'`   | Connection gracefully closed        | `{ notify: boolean }`  |
| `'cancel'`  | Pending connection cancelled        | `{ notify: boolean }`  |
| `'deny'`    | Connection request rejected         | `{ error, origin }`    |
| `'destroy'` | Connection force-destroyed          | `{}`                   |

### Event Filters

Utility functions for filtering specific events:

```typescript
import { filterOpen, filterClose, filterCancel, filterDeny } from '@hyperfrontend/nexus/filters'

// Subscribe only to 'open' events
channel.onEvent(
  filterOpen((event) => {
    console.log('Channel opened:', event.origin)
  })
)
```

### Message Filters

Utility functions for filtering messages by type:

```typescript
import { filterByType, composeFilters } from '@hyperfrontend/nexus/filters'

// Filter messages by action type
channel.onMessage(
  filterByType('user:login', (message) => {
    console.log('User login:', message)
  })
)

// Compose multiple filters
channel.onMessage(composeFilters(filterByType('user:*'), filterByType('*:create')))
```

---

## Security Model

### Origin Filtering

Configure allowed/blocked origins at the broker level:

```typescript
const broker = createBroker({
  security: {
    allowedOrigins: ['https://trusted.com', 'https://partner.com'],
    blockedOrigins: ['https://malicious.com'],
  },
})
```

### Security Policy Hook

Implement custom connection approval logic:

```typescript
const broker = createBroker({
  securityPolicy: (message: MessageEvent) => {
    // Custom validation logic
    const origin = message.origin
    const action = message.data

    // Return true to allow, false to deny
    return isAllowedConnection(origin, action.contract)
  },
})
```

### Contract Validation

Channels require valid contracts conforming to the schema:

```typescript
interface IChannelContract {
  name: string // Channel name (required)
  version?: string // Protocol version
  capabilities?: string[] // Supported features
  metadata?: Record<string, unknown> // Custom metadata
}
```

Contract validation occurs at both REQUEST and ACCEPT handlers to ensure both parties agree on the channel configuration.

---

## Source File Reference

### Core Files

| File                                                                   | Description              |
| ---------------------------------------------------------------------- | ------------------------ |
| [libs/nexus/src/broker/factory.ts](libs/nexus/src/broker/factory.ts)   | Broker factory function  |
| [libs/nexus/src/channel/factory.ts](libs/nexus/src/channel/factory.ts) | Channel factory function |
| [libs/nexus/src/types/action.ts](libs/nexus/src/types/action.ts)       | Protocol action types    |
| [libs/nexus/src/types/channel.ts](libs/nexus/src/types/channel.ts)     | Channel handle interface |
| [libs/nexus/src/core/processes/](libs/nexus/src/core/processes/)       | Process manager          |

### Routing Handlers

| File                                                                                         | Handler                        |
| -------------------------------------------------------------------------------------------- | ------------------------------ |
| [handle-request.ts](libs/nexus/src/broker/routing/handle-request.ts)                         | REQUEST_CONNECTION             |
| [handle-accept.ts](libs/nexus/src/broker/routing/handle-accept.ts)                           | ACCEPT_CONNECTION              |
| [handle-open.ts](libs/nexus/src/broker/routing/handle-open.ts)                               | OPEN_CONNECTION                |
| [handle-deny.ts](libs/nexus/src/broker/routing/handle-deny.ts)                               | DENY_CONNECTION                |
| [handle-cancel.ts](libs/nexus/src/broker/routing/handle-cancel.ts)                           | CANCEL_CONNECTION              |
| [handle-cancel-acknowledged.ts](libs/nexus/src/broker/routing/handle-cancel-acknowledged.ts) | CANCEL_CONNECTION_ACKNOWLEDGED |
| [handle-close.ts](libs/nexus/src/broker/routing/handle-close.ts)                             | CLOSE_CONNECTION               |
| [handle-close-acknowledged.ts](libs/nexus/src/broker/routing/handle-close-acknowledged.ts)   | CLOSE_CONNECTION_ACKNOWLEDGED  |
| [handle-message.ts](libs/nexus/src/broker/routing/handle-message.ts)                         | NEW_MESSAGE                    |
| [handle-destroy.ts](libs/nexus/src/broker/routing/handle-destroy.ts)                         | DESTROY_CONNECTION             |
| [handle-invalid.ts](libs/nexus/src/broker/routing/handle-invalid.ts)                         | INVALID_REQUEST                |

### Supporting Files

| File                                                                                             | Description                        |
| ------------------------------------------------------------------------------------------------ | ---------------------------------- |
| [libs/nexus/src/broker/routing/create-router.ts](libs/nexus/src/broker/routing/create-router.ts) | Router factory                     |
| [libs/nexus/src/broker/routing/route-message.ts](libs/nexus/src/broker/routing/route-message.ts) | Message routing logic              |
| [libs/nexus/src/filters/](libs/nexus/src/filters/)                                               | Event and message filter utilities |
| [libs/nexus/src/schema/](libs/nexus/src/schema/)                                                 | Contract validation                |
| [libs/nexus/src/setup/](libs/nexus/src/setup/)                                                   | Initialization utilities           |

---

## Future Considerations

### Recommended Next Steps

1. **Integration Tests**: End-to-end tests simulating full postMessage exchange between brokers
2. **Performance Optimization**: Message batching for high-frequency communication
3. **Observability**: Metrics and logging hooks for production monitoring
4. **Connection Pooling**: Multi-channel scenarios with shared resources

---

_Last updated: February 8, 2026_
