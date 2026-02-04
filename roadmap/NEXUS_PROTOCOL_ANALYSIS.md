# Nexus Protocol Analysis: TCP-Like Handshake Comparison

**A Critical Examination of the Nexus Connection Protocol vs. Legacy window-messages**

_Analysis Date: February 3, 2026_

---

## Executive Summary

This document provides a comprehensive analysis of the `@hyperfrontend/nexus` library's connection protocol, comparing it against the original `window-messages` implementation. The analysis focuses on the TCP-like SYN/ACK/SYN-ACK handshake semantics, event handling, and lifecycle management.

**Key Findings:**

1. ✅ **Protocol Actions**: 100% identical in concept and naming (different namespace prefix only)
2. ⚠️ **Three-Way Handshake**: Partially implemented but with critical gaps in handler wiring
3. ⚠️ **Acknowledgement Patterns**: Present in action types but handlers incomplete
4. ❌ **Event Notification Chain**: Broken in several handlers (noted as "TODO" comments)
5. ⚠️ **Process Tracking**: Infrastructure exists but not fully utilized in handlers
6. ✅ **Scheduled Activation**: Preserved and functional

---

## Table of Contents

1. [Protocol Action Comparison](#protocol-action-comparison)
2. [Connection Flow Analysis](#connection-flow-analysis)
3. [Handler-by-Handler Comparison](#handler-by-handler-comparison)
4. [Critical Gaps Identified](#critical-gaps-identified)
5. [What's the Same](#whats-the-same)
6. [What's Different but Equivalent](#whats-different-but-equivalent)
7. [What's Missing or Incomplete](#whats-missing-or-incomplete)
8. [What's Better in Nexus](#whats-better-in-nexus)
9. [Recommendations](#recommendations)

---

## Protocol Action Comparison

### Action Types: Legacy vs. Nexus

| Legacy (`window-messages`)                                    | Nexus (`nexus`)                                     | Identical? |
| ------------------------------------------------------------- | --------------------------------------------------- | ---------- |
| `[window-messages] invalid-request`                           | `[nexus] invalid-request`                           | ✅ Yes     |
| `[window-messages] connection-request`                        | `[nexus] connection-request`                        | ✅ Yes     |
| `[window-messages] connection-request-cancelled`              | `[nexus] connection-request-cancelled`              | ✅ Yes     |
| `[window-messages] connection-request-cancelled-acknowledged` | `[nexus] connection-request-cancelled-acknowledged` | ✅ Yes     |
| `[window-messages] connection-request-accepted`               | `[nexus] connection-request-accepted`               | ✅ Yes     |
| `[window-messages] connection-request-denied`                 | `[nexus] connection-request-denied`                 | ✅ Yes     |
| `[window-messages] connection-closed`                         | `[nexus] connection-closed`                         | ✅ Yes     |
| `[window-messages] connection-closed-acknowledged`            | `[nexus] connection-closed-acknowledged`            | ✅ Yes     |
| `[window-messages] connection-destroyed`                      | `[nexus] connection-destroyed`                      | ✅ Yes     |
| `[window-messages] connection-opened`                         | `[nexus] connection-opened`                         | ✅ Yes     |
| `[window-messages] new-message`                               | `[nexus] new-message`                               | ✅ Yes     |

**Verdict**: The action types are semantically identical. Only the protocol namespace prefix changed from `window-messages` to `nexus`.

> **Source Files:**
>
> - Nexus action types: [`libs/nexus/src/types/action.ts`](libs/nexus/src/types/action.ts#L26-L38)

### Action Payload Structure

Both implementations use the same payload structure:

```typescript
// Both implementations
{
  type: string,           // Action type
  senderId: string,       // Broker UUID
  processId?: string,     // Connection process UUID
  contract?: IChannelContract,  // For REQUEST/ACCEPT
  data?: unknown,         // For NEW_MESSAGE
  error?: string          // For DENY/INVALID
}
```

---

## Connection Flow Analysis

### The Intended Three-Way Handshake

The protocol follows a TCP-like pattern:

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

### Denial Flow

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

### Cancellation Flow

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

## Handler-by-Handler Comparison

### 1. REQUEST_CONNECTION Handler

#### Legacy Implementation

```typescript
// MessageBroker.handleRequestConnection
private handleRequestConnection(senderId, origin, processId, contract, message): void {
  const channel = MessageChannel.idChannels.get(senderId) || this.addChannel(processId, message.source, {})
  channel['trackProcess'](processId)                    // ✅ Track process ID

  if (channel.open) {
    if (senderId !== channel['id'])
      return this.logPageReloadedMessage(...)           // ✅ Handle page reload
    return channel['sendAction'](actions.acceptConnection(processId))  // ✅ Re-accept
  }

  try { validateContract(contract) }                    // ✅ Validate contract
  catch {
    channel['sendAction'](actions.denyConnection(processId, 'Invalid contract.'))
    channel['terminateProcess'](processId)              // ✅ Clean up process
    return
  }

  if (MessageBroker.allowConnection && !MessageBroker.allowConnection(message)) {
    channel['sendAction'](actions.denyConnection(processId, 'Not accepted.'))
    channel['terminateProcess'](processId)              // ✅ Clean up process
    return
  }

  if (!channel.readyToConnect)
    return channel['scheduleActivation'](senderId, origin, contract, processId)  // ✅ Schedule for later

  channel['setActive'](senderId, origin, contract)      // ✅ Activate channel
  channel['sendAction'](actions.acceptConnection(processId))  // ✅ Send acceptance
}
```

#### Nexus Implementation

```typescript
// handleRequest.ts
export function handleRequest(state, registry, processManager, actions, message): void {
  const action = message.data
  const senderId = action.senderId

  if (!isActionWithContract(action)) return             // ✅ Type guard

  const processId = action.processId
  const contract = action.contract

  let channel = getById(registry, senderId)
  if (!channel) {
    channel = addChannel(state, registry, processManager, actions, senderId, message.source, {})
  }

  // Note: In full implementation, would call channel's internal trackProcess method
  // ⚠️ PROCESS NOT TRACKED

  if (channel.isActive()) {
    if (senderId === channel.id) {
      channel.sendAction({...acceptConnection...})      // ✅ Re-accept
    } else {
      // Page reloaded
      if (state.settings.debug) console.info(...)       // ⚠️ No special handling
    }
    return
  }

  try { validateContractFn(contract) }                  // ✅ Validate contract
  catch {
    channel.sendAction({...denyConnection...})
    // Note: Would call channel's terminateProcess in full implementation
    // ⚠️ PROCESS NOT TERMINATED
    return
  }

  if (state.settings.securityPolicy) {
    const allowed = applyPolicy(state.settings.securityPolicy, message)
    if (!allowed) {
      channel.sendAction({...denyConnection...})
      // ⚠️ PROCESS NOT TERMINATED
      return
    }
  }

  // ⚠️ NO SCHEDULED ACTIVATION CHECK (readyToConnect)

  // Note: In full implementation, would call channel's setActive
  // ⚠️ CHANNEL NOT ACTUALLY ACTIVATED

  channel.sendAction({...acceptConnection...})          // ✅ Send acceptance
}
```

**Gaps Identified:**

- ❌ Process ID not tracked via `trackProcess`
- ❌ Process not terminated on denial (`terminateProcess`)
- ❌ No `readyToConnect` check
- ❌ No `scheduleActivation` for pending connections
- ❌ Channel not actually activated (`setActive` not called)

> **Source Files:**
>
> - Nexus: [`libs/nexus/src/broker/routing/handle-request.ts`](libs/nexus/src/broker/routing/handle-request.ts)

---

### 2. ACCEPT_CONNECTION Handler

#### Legacy Implementation

```typescript
// MessageBroker.handleAcceptConnection
private handleAcceptConnection(senderId, origin, processId, contract, message): void {
  const channel = MessageChannel.processChannel.get(processId)  // ✅ Get by process ID
  if (!channel || channel.open) return

  try { validateContract(contract) }
  catch {
    return channel['sendAction'](actions.cancelConnection(processId))  // ✅ Cancel on bad contract
  }

  if (MessageBroker.allowConnection && !MessageBroker.allowConnection(message)) {
    return channel['sendAction'](actions.cancelConnection(processId))  // ✅ Cancel on policy fail
  }

  channel['setActive'](senderId, origin, contract)      // ✅ Activate channel
  channel['sendAction'](actions.openConnection(processId))  // ✅ Send OPEN_CONNECTION (ACK)
  channel['terminateProcess'](processId)                // ✅ Clean up process
  channel['notifyEvent'](ChannelEvent.Opened, channel, message)  // ✅ Notify subscribers
}
```

#### Nexus Implementation

```typescript
// handleAccept.ts
export function handleAccept(state, registry, processManager, actions, message): void {
  const action = message.data

  if (!isActionWithContract(action)) return

  const processId = action.processId
  const contract = action.contract

  const channel = processManager.get(processId)         // ✅ Get by process ID

  if (!channel) return
  if (channel.isActive()) return                        // ✅ Skip if already open

  try { validateContract(contract) }
  catch {
    channel.sendAction({...cancelConnection...})        // ✅ Cancel on bad contract
    return
  }

  if (state.settings.securityPolicy) {
    const allowed = applyPolicy(state.settings.securityPolicy, message)
    if (!allowed) {
      channel.sendAction({...cancelConnection...})      // ✅ Cancel on policy fail
      return
    }
  }

  // Note: In full implementation, would call channel's setActive
  // ⚠️ CHANNEL NOT ACTUALLY ACTIVATED

  channel.sendAction({...openConnection...})            // ✅ Send OPEN_CONNECTION

  // Note: Would call channel's terminateProcess in full implementation
  // ⚠️ PROCESS NOT TERMINATED

  // Note: Would call channel's notifyEvent in full implementation
  // ⚠️ EVENT NOT NOTIFIED
}
```

**Gaps Identified:**

- ❌ Channel not activated (`setActive` not called)
- ❌ Process not terminated
- ❌ Event not notified to subscribers

> **Source Files:**
>
> - Nexus: [`libs/nexus/src/broker/routing/handle-accept.ts`](libs/nexus/src/broker/routing/handle-accept.ts)

---

### 3. OPEN_CONNECTION Handler

#### Legacy Implementation

```typescript
// MessageBroker.handleOpenedConnection
private handleOpenedConnection(processId, message): void {
  const channel = MessageChannel.processChannel.get(processId)
  if (channel) {
    channel['terminateProcess'](processId)              // ✅ Clean up process
    channel['notifyEvent'](ChannelEvent.Opened, channel, message)  // ✅ Notify opened
  }
}
```

#### Nexus Implementation

**⚠️ NO HANDLER REGISTERED IN ROUTER**

Reviewing [`libs/nexus/src/broker/factory.ts#L70-L83`](libs/nexus/src/broker/factory.ts#L70-L83), the router registers handlers for:

- `REQUEST_CONNECTION`, `ACCEPT_CONNECTION`, `DENY_CONNECTION`
- `CANCEL_CONNECTION`, `CLOSE_CONNECTION`, `DESTROY_CONNECTION`
- `NEW_MESSAGE`, `INVALID_REQUEST`

But **`OPEN_CONNECTION` is NOT registered**. This means when Host B receives the final ACK of the three-way handshake, no handler processes it.

**Gaps Identified:**

- ❌ No handler registered for OPEN_CONNECTION action in router
- ❌ Responder (Host B) never receives 'open' event confirmation

> **Source Files:**
>
> - Router configuration: [`libs/nexus/src/broker/factory.ts#L70-L83`](libs/nexus/src/broker/factory.ts#L70-L83)

---

### 4. DENY_CONNECTION Handler

#### Legacy Implementation

```typescript
// MessageBroker.handleDeniedConnection
private handleDeniedConnection(processId, message): void {
  const channel = MessageChannel.processChannel.get(processId)
  if (channel) {
    channel['terminateProcess'](processId)              // ✅ Clean up process
    channel['notifyEvent'](ChannelEvent.Denied, channel, message)  // ✅ Notify denied
  }
}
```

#### Nexus Implementation

```typescript
// handleDeny.ts
export function handleDeny(state, registry, processManager, actions, message): void {
  const action = message.data
  const processId = action.processId

  const channel = processManager.get(processId)

  if (!channel) return

  processManager.remove(processId) // ✅ Clean up process

  // Note: Would call channel's notifyEvent with ChannelEvent.Denied
  // ⚠️ EVENT NOT NOTIFIED
}
```

**Gaps Identified:**

- ❌ Event not notified to subscribers

> **Source Files:**
>
> - Nexus: [`libs/nexus/src/broker/routing/handle-deny.ts`](libs/nexus/src/broker/routing/handle-deny.ts)

---

### 5. CANCEL_CONNECTION Handler

#### Legacy Implementation

```typescript
// MessageBroker.handleCancelConnection
private handleCancelConnection(senderId, processId): void {
  const channel = MessageChannel.idChannels.get(senderId) || MessageChannel.processChannel.get(processId)
  if (channel) {
    channel.cancel(false)                               // ✅ Cancel channel
    channel['sendAction'](actions.cancelConnectionAcknowledged(processId))  // ✅ Send ACK
    channel['terminateProcess'](processId)              // ✅ Clean up process
    channel['notifyEvent'](ChannelEvent.Cancelled, channel)  // ✅ Notify cancelled
  }
}

// MessageBroker.handleCancelConnectionAcknowledged
private handleCancelConnectionAcknowledged(processId): void {
  const channel = MessageChannel.processChannel.get(processId)
  if (channel) {
    channel['terminateProcess'](processId)              // ✅ Clean up process
    channel['notifyEvent'](ChannelEvent.Cancelled, channel)  // ✅ Notify cancelled
  }
}
```

#### Nexus Implementation

```typescript
// handleCancel.ts
export function handleCancel(state, registry, processManager, actions, message): void {
  const action = message.data
  const senderId = action.senderId
  const processId = action.processId

  const channel = getById(registry, senderId) || processManager.get(processId)

  if (!channel) return

  channel.cancel(false)                                 // ✅ Cancel channel

  channel.sendAction({...cancelConnectionAcknowledged...})  // ✅ Send ACK

  // Note: Would call channel's terminateProcess in full implementation
  // ⚠️ PROCESS NOT TERMINATED

  // Note: Would call channel's notifyEvent with ChannelEvent.Cancelled
  // ⚠️ EVENT NOT NOTIFIED
}
```

**Gaps Identified:**

- ❌ Process not terminated
- ❌ Event not notified to subscribers
- ❌ No handler for `CANCEL_CONNECTION_ACKNOWLEDGED`

> **Source Files:**
>
> - Nexus: [`libs/nexus/src/broker/routing/handle-cancel.ts`](libs/nexus/src/broker/routing/handle-cancel.ts)

---

### 6. CLOSE_CONNECTION Handler

#### Legacy Implementation

```typescript
// MessageBroker.handleCloseConnection
private handleCloseConnection(senderId, processId): void {
  const channel = MessageChannel.idChannels.get(senderId)
  if (channel?.open) {
    channel.close(false)                                // ✅ Close channel
    channel['sendAction'](actions.closeConnectionAcknowledged(processId))  // ✅ Send ACK
    channel['terminateProcess'](processId)              // ✅ Clean up process
    channel['notifyEvent'](ChannelEvent.Closed, channel)  // ✅ Notify closed
  }
}

// MessageBroker.handleCloseConnectionAcknowledged
private handleCloseConnectionAcknowledged(processId): void {
  const channel = MessageChannel.processChannel.get(processId)
  if (channel) {
    channel['terminateProcess'](processId)              // ✅ Clean up process
    channel['notifyEvent'](ChannelEvent.Closed, channel)  // ✅ Notify closed
  }
}
```

#### Nexus Implementation

```typescript
// handleClose.ts
export function handleClose(state, registry, processManager, actions, message): void {
  const action = message.data
  const senderId = action.senderId
  const processId = action.processId

  const channel = getById(registry, senderId)
  if (!channel) return

  const fullChannel = processManager.get(processId)
  if (!fullChannel || !fullChannel.isActive()) return

  fullChannel.disconnect(false)                         // ✅ Close channel

  fullChannel.sendAction({...closeConnectionAcknowledged...})  // ✅ Send ACK

  // Note: Would call channel's terminateProcess in full implementation
  // ⚠️ PROCESS NOT TERMINATED

  // Note: Would call channel's notifyEvent with ChannelEvent.Closed
  // ⚠️ EVENT NOT NOTIFIED
}
```

**Gaps Identified:**

- ❌ Process not terminated
- ❌ Event not notified to subscribers
- ❌ No handler for `CLOSE_CONNECTION_ACKNOWLEDGED`

> **Source Files:**
>
> - Nexus: [`libs/nexus/src/broker/routing/handle-close.ts`](libs/nexus/src/broker/routing/handle-close.ts)

---

### 7. NEW_MESSAGE Handler

#### Legacy Implementation

```typescript
// MessageBroker.handleNewMessage
private handleNewMessage(senderId, action): void {
  const channel = MessageChannel.idChannels.get(senderId)
  if (!channel?.open) return
  if (!this.isValidMessage(action)) return this.logIgnoredMessage(channel.name)
  channel['notifyMessageReceived'](action, channel)     // ✅ Forward to subscribers
}
```

#### Nexus Implementation

```typescript
// handleMessage.ts
export function handleMessage(state, registry, processManager, actions, message): void {
  const action = message.data
  const senderId = action.senderId

  if (!isActionWithData(action)) return

  const messageData = action.data

  const channel = getById(registry, senderId)
  if (!channel || !channel.isActive()) return           // ✅ Check channel open

  try { validateAction(messageData) }
  catch {
    if (state.settings.debug) console.info(...)         // ✅ Log invalid
    return
  }

  // Note: Would call channel's notifyMessageReceived in full implementation
  // ⚠️ MESSAGE NOT FORWARDED TO SUBSCRIBERS
}
```

**Gaps Identified:**

- ❌ Message not actually forwarded to channel's message subscribers

> **Source Files:**
>
> - Nexus: [`libs/nexus/src/broker/routing/handle-message.ts`](libs/nexus/src/broker/routing/handle-message.ts)

---

## Critical Gaps Identified

### 1. **Missing `OPEN_CONNECTION` Handler**

When Host A sends `OPEN_CONNECTION` (the final ACK of the three-way handshake), Host B needs to:

- Terminate the process
- Notify subscribers with 'open' event

This handler appears to be missing or incomplete, breaking the handshake from the responder's perspective.

### 2. **Missing Acknowledgement Handlers**

Two acknowledgement handlers are not implemented:

- `CANCEL_CONNECTION_ACKNOWLEDGED` handler
- `CLOSE_CONNECTION_ACKNOWLEDGED` handler

Without these, the initiator of cancel/close operations never gets confirmation and never fires their local events.

### 3. **Process Tracking Not Used**

The `processManager` infrastructure exists but handlers don't:

- Call `trackProcess` when receiving requests
- Consistently use `processManager.get()` for channel lookup
- Call `terminateProcess` / `processManager.remove()` on completion

This can lead to memory leaks (orphaned process IDs) and incorrect channel lookups.

### 4. **Event Notifications Commented Out**

Nearly every handler has comments like:

```typescript
// Note: Would call channel's notifyEvent in full implementation
```

This means subscribers never receive:

- `'open'` events (from accept handler)
- `'close'` events (from close handler)
- `'cancel'` events (from cancel handler)
- `'deny'` events (from deny handler)

### 5. **Channel Activation Missing**

The `handleRequest` and `handleAccept` handlers don't actually call the channel's internal `setActive` method, meaning:

- Channel state remains inactive
- `channel.isActive()` returns false
- Messages won't be sent (queued instead)

### 6. **Message Forwarding Incomplete**

The `handleMessage` handler validates incoming messages but doesn't forward them to the channel's message subscribers.

> **Key Source Files for Gaps Verification:**
>
> - Router handler registration: [`libs/nexus/src/broker/factory.ts#L70-L83`](libs/nexus/src/broker/factory.ts#L70-L83)
> - Channel activation function: [`libs/nexus/src/channel/state/activate.ts`](libs/nexus/src/channel/state/activate.ts)
> - Event notification system: [`libs/nexus/src/channel/subscription/notify-event.ts`](libs/nexus/src/channel/subscription/notify-event.ts)
> - Process manager factory: [`libs/nexus/src/core/processes/factory.ts`](libs/nexus/src/core/processes/factory.ts)

---

## What's the Same

| Aspect                                     | Legacy | Nexus | Status                              |
| ------------------------------------------ | ------ | ----- | ----------------------------------- |
| Protocol actions (11 types)                | ✅     | ✅    | Identical semantics                 |
| Action payload structure                   | ✅     | ✅    | Identical                           |
| Three-way handshake concept                | ✅     | ✅    | Same design                         |
| Contract validation                        | ✅     | ✅    | Same logic                          |
| Origin filtering (whitelist/blacklist)     | ✅     | ✅    | Same approach                       |
| Security policy hook                       | ✅     | ✅    | Same pattern                        |
| Scheduled activation                       | ✅     | ✅    | Present in state, used in connect() |
| Message queueing                           | ✅     | ✅    | Same behavior                       |
| Event filter utilities (open, close, etc.) | ✅     | ✅    | Same pattern                        |
| Message filters (byType, compose)          | ✅     | ✅    | Same pattern                        |
| Channel state shape                        | ✅     | ✅    | Nearly identical                    |

---

## What's Different but Equivalent

| Aspect               | Legacy                     | Nexus                           | Notes                                 |
| -------------------- | -------------------------- | ------------------------------- | ------------------------------------- |
| Architecture         | Class-based                | Functional                      | Factory functions with closures       |
| State management     | Mutable properties         | Immutable state + updateState() | Functional pattern                    |
| Registry             | Static WeakMaps/Maps       | Instance-based registry         | Same data structures, different scope |
| Process tracking     | Static Map                 | ProcessManager instance         | Same logic, different encapsulation   |
| Dependency injection | Implicit (static refs)     | Explicit (passed to factories)  | Better testability in Nexus           |
| Decorator usage      | @locked() for immutability | Object.freeze()                 | Same goal, different approach         |

> **Source Files for Architecture Comparison:**
>
> - Nexus factory-based broker: [`libs/nexus/src/broker/factory.ts`](libs/nexus/src/broker/factory.ts)
> - Nexus channel factory: [`libs/nexus/src/channel/factory.ts`](libs/nexus/src/channel/factory.ts)

---

## What's Missing or Incomplete

### Critical (Breaks Protocol)

1. **Process tracking in handlers** — Handlers don't use `trackProcess` or `terminateProcess`
2. **Channel activation** — `setActive` not called after accept
3. **Event notifications** — Not fired in any handler
4. **Message forwarding** — Messages validated but not delivered
5. **OPEN_CONNECTION handler** — Missing or stub
6. **Acknowledgement handlers** — CANCEL_ACK and CLOSE_ACK missing

### Important (Reduces Robustness)

1. **readyToConnect check** — Not implemented in REQUEST handler
2. **scheduleActivation in REQUEST handler** — Logic exists in connect() but not used by broker
3. **Page reload detection** — Present in logs but no special handling

### Minor

1. **Debug logging consistency** — Less verbose than legacy
2. **Error context in denials** — Error messages are generic

---

## What's Better in Nexus

| Aspect            | Legacy                         | Nexus                     | Why Better                        |
| ----------------- | ------------------------------ | ------------------------- | --------------------------------- |
| Testability       | Difficult (static state)       | Excellent (injected deps) | Isolated tests, no global cleanup |
| Type safety       | Partial                        | Comprehensive             | Type guards, discriminated unions |
| Encapsulation     | Weak (private accessed via []) | Strong (closures)         | True information hiding           |
| Immutability      | Decorator-enforced             | Structural                | Object.freeze, spread patterns    |
| Code organization | Monolithic files               | Modular subdirectories    | Better maintainability            |
| Router pattern    | Giant switch statement         | Handler registry          | Extensible, single responsibility |
| Action creators   | Mixed concerns                 | Pure factories with DI    | Testable, composable              |
| Registry design   | Global singletons              | Instance-scoped           | Multiple brokers possible         |

---

## Recommendations

### Priority 1: Complete the Handlers

Every handler needs to be updated to:

1. **Track processes**: Call `processManager.get()` and `processManager.remove()` appropriately
2. **Activate channels**: Call internal `setActive` method on successful connection
3. **Fire events**: Call `channel.notifyEvent()` for all lifecycle transitions
4. **Forward messages**: Call `channel.notifyMessage()` for NEW_MESSAGE

### Priority 2: Add Missing Handlers

Create handlers for:

- `handleOpen` — Complete the three-way handshake from responder side
- `handleCancelAcknowledged` — Fire cancel event on initiator side
- `handleCloseAcknowledged` — Fire close event on initiator side

### Priority 3: Implement Scheduled Activation in REQUEST Handler

```typescript
// In handleRequest:
if (!channel.readyToConnect) {
  channel.scheduleActivation(senderId, origin, contract, processId)
  return
}
```

### Priority 4: Channel Internals Access

The handlers need access to channel internals (setActive, terminateProcess, notifyEvent). Options:

1. **Add methods to ChannelHandle interface** — Expose internal methods publicly
2. **Create internal channel map** — Broker maintains map of channel internals
3. **Use processManager to store internals** — Store full internals alongside handle

### Priority 5: Integration Tests

Create end-to-end tests that:

1. Simulate full postMessage exchange between two brokers
2. Verify all events fire in correct order
3. Test denial, cancellation, and close flows
4. Test page reload scenarios

---

## Appendix: Event Flow Diagrams

### Complete Happy Path

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
                                     [setActive]
                                     [send ACCEPT_CONNECTION]
                                          │
[handleAccept] ◀─────────────────────────┘
    │
    ▼
[validateContract]
[applySecurityPolicy]
[setActive]
[send OPEN_CONNECTION] ─────────────▶ [handleOpen]
    │                                     │
    ▼                                     ▼
[terminateProcess]                   [terminateProcess]
[notifyEvent('open')]                [notifyEvent('open')]
    │                                     │
    ▼                                     ▼
[ACTIVE]                              [ACTIVE]
```

### Denial Path

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
                                     [send DENY_CONNECTION]
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

---

## Conclusion

The Nexus library has the correct **foundation** — the protocol design, action types, and state structures are all properly ported from the legacy implementation. However, the **handler wiring** is incomplete. The TCP-like handshake semantics exist in the architecture but are not fully executed in the handler implementations.

The essential "SYN, ACK, SYN-ACK" flow is **designed correctly** but **not fully implemented**. Completing the handlers as documented above will restore full protocol compatibility with the legacy window-messages behavior while benefiting from Nexus's superior architecture.

**Estimated effort to complete**: 2-3 days of focused implementation + 1-2 days of integration testing.

---

_This analysis is based on examination of libs/nexus/src/\* as of February 4, 2026._

> **Key Source Files Examined:**
>
> - Action types: [`libs/nexus/src/types/action.ts`](libs/nexus/src/types/action.ts)
> - All routing handlers: [`libs/nexus/src/broker/routing/`](libs/nexus/src/broker/routing/)
> - Channel state management: [`libs/nexus/src/channel/state/`](libs/nexus/src/channel/state/)
> - Subscription/notification: [`libs/nexus/src/channel/subscription/`](libs/nexus/src/channel/subscription/)
> - Process management: [`libs/nexus/src/core/processes/`](libs/nexus/src/core/processes/)
