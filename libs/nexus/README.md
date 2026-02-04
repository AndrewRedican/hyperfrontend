# @hyperfrontend/nexus

Secure cross-window communication library for micro-frontends with contract-validated messaging, origin-based security policies, and connection lifecycle management.

## What is Nexus?

Nexus provides a complete infrastructure for building secure, reliable communication between browser windows, iframes, and micro-frontend applications. At its core, Nexus implements a **broker-channel architecture** where a central broker manages multiple channels, each representing a connection to another window or frame.

Unlike raw `postMessage` usage, Nexus enforces **communication contracts**—typed agreements defining which message types each participant can send and receive. This contract-first approach catches integration errors at development time rather than production, making micro-frontend systems significantly more maintainable as they scale.

### Key Features

- **Contract-Validated Messaging** — Define accepted and emitted message types with optional JSON Schema validation
- **Broker-Channel Architecture** — Central broker manages multiple independent channels to different windows
- **Origin-Based Security** — Whitelist/blacklist filtering plus custom security policy functions
- **Connection Lifecycle Management** — Full state machine for connect, disconnect, cancel, deny, and destroy operations
- **Event Subscription System** — Subscribe to lifecycle events (open, close, cancel, deny, invalid) and user messages
- **Message Queueing** — Automatically queue messages when channel is not yet active
- **Contract Extension & Merging** — Dynamically extend contracts or merge multiple contracts together
- **Functional API Design** — Factory functions with closure-based encapsulation for clean, testable code

### Architecture Highlights

Nexus uses a **functional programming approach** with factory functions (`createBroker`, `createChannel`) that return handle objects. Internal state is encapsulated via closures, making the system highly testable and avoiding the complexity of class-based inheritance. The routing layer uses a handler registry pattern, allowing protocol actions (REQUEST_CONNECTION, ACCEPT_CONNECTION, etc.) to be processed by dedicated handlers.

## Why Use Nexus?

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
broker.setSecurityPolicy((origin, contract) => {
  return origin.endsWith('.example.com')
})
```

### Hub-and-Spoke Patterns for Complex Topologies

Real micro-frontend systems often have complex communication needs: a shell application coordinating multiple micro-apps, broadcast messages to all participants, or direct messaging between specific windows. Nexus's broker architecture naturally supports these patterns:

```typescript
// Central hub managing multiple spokes
const hub = createBroker({ name: 'shell', contract })

const userApp = hub.addChannel('user-app', userFrame.contentWindow)
const cartApp = hub.addChannel('cart-app', cartFrame.contentWindow)
const checkoutApp = hub
  .addChannel('checkout-app', checkoutFrame.contentWindow)

  [
    // Connect all
    (userApp, cartApp, checkoutApp)
  ].forEach((ch) => ch.connect())

// Broadcast to all
hub.channels.forEach((ch) => ch.send('THEME_CHANGED', { theme: 'dark' }))
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

Nexus implements a **three-way handshake protocol** for establishing secure connections, with support for graceful disconnection, cancellation, and error handling.

### Connection Handshake

```
Initiator                    Responder
    |                            |
    |--- REQUEST_CONNECTION ---->|
    |                            | (validates contract & origin)
    |<-- ACCEPT_CONNECTION ------|
    | (validates contract)       |
    |--- OPEN_CONNECTION ------->|
    |                            |
   [Connected]              [Connected]
```

**Protocol Actions**:

1. **REQUEST_CONNECTION** - Initiator sends contract and process ID
2. **ACCEPT_CONNECTION** - Responder validates and replies with own contract
3. **OPEN_CONNECTION** - Initiator confirms, completing handshake

### Disconnection Flow

```
Initiator                    Responder
    |                            |
    |--- CLOSE_CONNECTION ------>|
    |                            | (closes channel)
    |<-- CLOSE_ACKNOWLEDGED -----|
    |                            |
  [Closed]                    [Closed]
```

### Cancellation Flow

Either party can cancel before connection completes:

```
Initiator                    Responder
    |                            |
    |--- CANCEL_CONNECTION ----->|
    |<-- CANCEL_ACKNOWLEDGED ----|
    |                            |
  [Cancelled]              [Cancelled]
```

### Denial & Invalid Messages

- **DENY_CONNECTION** - Responder rejects based on contract/origin validation failure
- **INVALID** - Protocol violation detected (malformed action, unknown type, etc.)

### Lifecycle Events

Channels emit events at key points in the connection lifecycle:

- **open** - Connection successfully established (both sides)
- **close** - Graceful disconnection completed
- **cancel** - Connection attempt cancelled before completion
- **deny** - Connection request rejected by responder
- **invalid** - Protocol violation detected

**Example**:

```typescript
channel.on((event, data, channelInfo) => {
  switch (event) {
    case 'open':
      console.log('Connected to', data.origin)
      break
    case 'close':
      console.log('Disconnected from', data.origin)
      break
    case 'deny':
      console.error('Connection denied:', data.error)
      break
    case 'invalid':
      console.error('Protocol violation:', data.reason)
      break
  }
})
```

### Security Policies

Security is enforced **before** connections are established. Configure at broker level:

```typescript
// Whitelist approach
const broker = createBroker({
  name: 'secure-app',
  contract,
  settings: {
    whitelist: ['https://trusted1.com', 'https://trusted2.com'],
  },
})

// Blacklist approach
const broker = createBroker({
  name: 'public-app',
  contract,
  settings: {
    blacklist: ['https://blocked.com'],
  },
})

// Custom policy function
broker.setSecurityPolicy((origin, contract) => {
  // Custom validation logic
  return origin.endsWith('.mycompany.com') && contract.emitted.length > 0
})
```

Security policies are applied during `REQUEST_CONNECTION` handling. Rejected connections receive a `DENY_CONNECTION` response.

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
  settings: { debug: true },
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
import { broker } from '@hyperfrontend/nexus'

const channel = broker.addChannel('my-channel', targetWindow)
channel.connect()
channel.send('MESSAGE', { hello: 'world' })
```

## API Overview

### Core Factory Functions

| Export                         | Description                                                       |
| ------------------------------ | ----------------------------------------------------------------- |
| `createBroker(config)`         | Creates a message broker that manages multiple channels           |
| `createChannel(config, deps)`  | Creates a single channel (typically called via broker.addChannel) |
| `mergeContracts(...contracts)` | Combines multiple contracts into one, deduplicating action types  |

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

### Filter Utilities

| Export                                       | Description                       |
| -------------------------------------------- | --------------------------------- |
| `open`, `close`, `cancel`, `deny`, `invalid` | Event-specific filter creators    |
| `byType(type, handler)`                      | Message type filter               |
| `compose(...filters)`                        | Combines multiple message filters |

### Types

| Type                 | Description                                               |
| -------------------- | --------------------------------------------------------- |
| `IChannelContract`   | Contract with accepted and emitted action arrays          |
| `IActionDescription` | Action type definition with optional schema               |
| `BrokerHandle`       | Broker instance interface                                 |
| `ChannelHandle`      | Channel instance interface                                |
| `ChannelEvent`       | Lifecycle event types: open, close, cancel, deny, invalid |
| `IMessage`           | User message with type and optional data                  |

## License

MIT
