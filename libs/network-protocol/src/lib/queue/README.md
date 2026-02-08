# Queue

**Navigation**: [↑ lib/](../README.md) · [sender](../sender/README.md) · [receiver](../receiver/README.md) · [packet](../packet/README.md)

---

## Purpose

The Queue module provides FIFO (First-In-First-Out) message processing queues with async operation support, backpressure management, and stop/resume lifecycle controls. Queues are the fundamental building blocks for the sender and receiver pipelines.

---

## Key Interfaces

### `Queue<T>`

The main queue interface for processing messages.

```typescript
interface Queue<T extends object> {
  addMessage: (message: T) => void // Add a message to the queue
  isRunning: () => boolean // Check if the queue is processing
  stop: () => void // Pause processing (messages accumulate)
  resume: () => void // Resume processing accumulated messages
  size: () => number // Get current queue depth
  currentMessage: () => T | null // Get the message currently being processed
}
```

### `MessageHandler<T>`

The async processing function type used internally by queues.

```typescript
type MessageHandler<T extends object> = (message: T) => Promise<void> | void
```

---

## Queue Types

Each queue type is specialized for a specific transformation step in the packet pipeline:

### Outbound Queues (Sender)

| Queue Creator              | Input Type                    | Output Type                   | Purpose                |
| -------------------------- | ----------------------------- | ----------------------------- | ---------------------- |
| `createEncryptionQueue`    | `UnencryptedPacket`           | `UnserializedEncryptedPacket` | Encrypt plaintext data |
| `createSerializationQueue` | `UnserializedEncryptedPacket` | `SerializedEncryptedPacket`   | Binary → Base64 string |
| `createObfuscationQueue`   | `SerializedEncryptedPacket`   | `ObfuscatedPacket`            | Time-based obfuscation |

### Inbound Queues (Receiver)

| Queue Creator                | Input Type                    | Output Type                   | Purpose                |
| ---------------------------- | ----------------------------- | ----------------------------- | ---------------------- |
| `createDeobfuscationQueue`   | `ObfuscatedPacket`            | `SerializedEncryptedPacket`   | Remove obfuscation     |
| `createDeserializationQueue` | `SerializedEncryptedPacket`   | `UnserializedEncryptedPacket` | Base64 string → Binary |
| `createDecryptionQueue`      | `UnserializedEncryptedPacket` | `UnencryptedPacket`           | Decrypt to plaintext   |

---

## Queue Pipeline

Queues are chained together to form processing pipelines where the `onSuccess` callback of one queue feeds the `addMessage` of the next:

### Outbound Pipeline (Sender)

```
┌─────────────────────┐     ┌───────────────────────┐     ┌─────────────────────┐
│  Encryption Queue   │ ──▶ │  Serialization Queue  │ ──▶ │  Obfuscation Queue  │ ──▶ Transport
│                     │     │                       │     │                     │
│ UnencryptedPacket   │     │ UnserializedEncrypted │     │ SerializedEncrypted │
│        ↓            │     │         ↓             │     │         ↓           │
│ UnserializedEncrypt │     │ SerializedEncrypted   │     │ ObfuscatedPacket    │
└─────────────────────┘     └───────────────────────┘     └─────────────────────┘
```

### Inbound Pipeline (Receiver)

```
            ┌───────────────────────┐     ┌─────────────────────────┐     ┌───────────────────┐
Transport ──▶ │  Deobfuscation Queue  │ ──▶ │  Deserialization Queue  │ ──▶ │  Decryption Queue │
            │                       │     │                         │     │                   │
            │ ObfuscatedPacket      │     │ SerializedEncrypted     │     │ UnserializedEncr. │
            │        ↓              │     │         ↓               │     │        ↓          │
            │ SerializedEncrypted   │     │ UnserializedEncrypted   │     │ UnencryptedPacket │
            └───────────────────────┘     └─────────────────────────┘     └───────────────────┘
```

---

## Factory Functions

### `createQueue<T>`

The base queue factory that all specialized queues use internally.

**Signature**:

```typescript
function createQueue<T extends Record<string, any>>(
  processMessage: MessageHandler<T>,
  autoStart?: boolean // default: true
): Queue<T>
```

**Example**:

```typescript
import { createQueue } from '@hyperfrontend/network-protocol/lib/queue'

// Create a simple message queue
const queue = createQueue<{ id: string; payload: string }>(
  async (message) => {
    console.log(`Processing: ${message.id}`)
    await someAsyncOperation(message)
  },
  true // autoStart
)

queue.addMessage({ id: '1', payload: 'hello' }) // Immediately starts processing
```

---

### `createEncryptionQueue`

Creates a queue that encrypts plaintext packets.

**Signature**:

```typescript
type EncryptionQueueCreater = (
  label: string,
  packetEncryption: PacketEncryption,
  logger: Logger,
  onSuccess: (packet: UnserializedEncryptedPacket) => void,
  onFail: (raw: unknown) => void
) => Queue<UnencryptedPacket>
```

**Parameters**:

| Parameter          | Type               | Description                                          |
| ------------------ | ------------------ | ---------------------------------------------------- |
| `label`            | `string`           | Identifier for logging (e.g., `'channel-1:encrypt'`) |
| `packetEncryption` | `PacketEncryption` | Async function that encrypts packets                 |
| `logger`           | `Logger`           | Logger instance from `@hyperfrontend/logging`        |
| `onSuccess`        | `function`         | Called with encrypted packet on success              |
| `onFail`           | `function`         | Called with raw input on failure                     |

**Example**:

```typescript
import { createEncryptionQueue } from '@hyperfrontend/network-protocol/lib/queue'
import { createLogger } from '@hyperfrontend/logging'

const logger = createLogger({ level: 'debug' })
const successes: UnserializedEncryptedPacket[] = []
const failures: unknown[] = []

const encryptionQueue = createEncryptionQueue(
  'my-channel:encryption',
  async (packet) => {
    // Platform-specific encryption (injected)
    return await encryptPacket(packet)
  },
  logger,
  (encrypted) => successes.push(encrypted),
  (failed) => failures.push(failed)
)

// Add a packet to encrypt
encryptionQueue.addMessage({
  origin: 'window-a',
  target: 'window-b',
  data: { pid: '...', id: '...', sequence: 1, key: null, message: {...}, schema: null, schemaHash: null }
})
```

---

### `createSerializationQueue`

Creates a queue that serializes binary encrypted data to Base64 strings.

**Signature**:

```typescript
type SerializationQueueCreater = (
  label: string,
  packetSerialization: PacketSerialization,
  logger: Logger,
  onSuccess: (packet: SerializedEncryptedPacket) => void,
  onFail: (raw: unknown) => void
) => Queue<UnserializedEncryptedPacket>
```

---

### `createObfuscationQueue`

Creates a queue that applies time-based obfuscation to serialized packets.

**Signature**:

```typescript
type ObfuscationQueueCreater = (
  label: string,
  packetObfuscation: PacketObfuscation,
  logger: Logger,
  onSuccess: (packet: ObfuscatedPacket) => void,
  onFail: (raw: unknown) => void
) => Queue<SerializedEncryptedPacket>
```

---

### `createDeobfuscationQueue`

Creates a queue that removes time-based obfuscation from incoming packets.

**Signature**:

```typescript
type DeobfuscationQueueCreater = (
  label: string,
  packetDeobfuscation: PacketDeobfuscation,
  logger: Logger,
  onSuccess: (packet: SerializedEncryptedPacket) => void,
  onFail: (raw: unknown) => void
) => Queue<ObfuscatedPacket>
```

---

### `createDeserializationQueue`

Creates a queue that deserializes Base64 strings back to binary data.

**Signature**:

```typescript
type DeserializationQueueCreater = (
  label: string,
  packetDeserialization: PacketDeserialization,
  logger: Logger,
  onSuccess: (packet: UnserializedEncryptedPacket) => void,
  onFail: (raw: unknown) => void
) => Queue<SerializedEncryptedPacket>
```

---

### `createDecryptionQueue`

Creates a queue that decrypts binary encrypted packets back to plaintext.

**Signature**:

```typescript
type DecryptionQueueCreater = (
  label: string,
  packetDecryption: PacketDecryption,
  logger: Logger,
  onSuccess: (packet: UnencryptedPacket) => void,
  onFail: (raw: unknown) => void
) => Queue<UnserializedEncryptedPacket>
```

---

## Queue Chaining Example

This example demonstrates how to chain outbound queues together:

```typescript
import { createEncryptionQueue, createSerializationQueue, createObfuscationQueue } from '@hyperfrontend/network-protocol/lib/queue'
import { createLogger } from '@hyperfrontend/logging'

const logger = createLogger({ level: 'info' })
const failures: unknown[] = []

// Create the chain backwards (from transport to source)

// 3. Obfuscation queue (final step, sends to transport)
const obfuscationQueue = createObfuscationQueue(
  'channel:obfuscate',
  packetObfuscation,
  logger,
  (obfuscated) => transport.send(obfuscated), // Final destination
  (raw) => failures.push(raw)
)

// 2. Serialization queue (feeds obfuscation)
const serializationQueue = createSerializationQueue(
  'channel:serialize',
  packetSerialization,
  logger,
  (serialized) => obfuscationQueue.addMessage(serialized), // Chain to next queue
  (raw) => failures.push(raw)
)

// 1. Encryption queue (entry point)
const encryptionQueue = createEncryptionQueue(
  'channel:encrypt',
  packetEncryption,
  logger,
  (encrypted) => serializationQueue.addMessage(encrypted), // Chain to next queue
  (raw) => failures.push(raw)
)

// Use the chain: add messages to encryption queue
encryptionQueue.addMessage(unencryptedPacket)
```

---

## Lifecycle Management

### Stop/Resume for Backpressure

Queues can be paused to handle backpressure scenarios:

```typescript
const queue = createEncryptionQueue(/* ... */)

// Check queue depth for backpressure
if (queue.size() > 100) {
  console.warn('Queue backpressure detected, pausing upstream')
  upstreamSource.pause()
}

// Pause processing (messages still accumulate)
queue.stop()
console.log(queue.isRunning()) // false

// Messages added while stopped will queue up
queue.addMessage(packet1)
queue.addMessage(packet2)
console.log(queue.size()) // 2

// Resume processing
queue.resume()
// → Processes packet1, then packet2 in FIFO order
```

### Monitoring Queue State

```typescript
// Get current queue depth
const depth = queue.size()

// Check if actively processing
const active = queue.isRunning()

// Get the message currently being processed
const current = queue.currentMessage()
if (current) {
  console.log(`Currently processing: ${current.origin} → ${current.target}`)
}
```

---

## Error Handling

Each specialized queue validates inputs and handles errors gracefully:

1. **Input Validation**: Invalid packets are rejected via `onFail`
2. **Operation Errors**: Encryption/serialization failures call `onFail`
3. **Pipeline Continuity**: Failed messages don't block subsequent messages

```typescript
const encryptionQueue = createEncryptionQueue(
  'my-channel:encrypt',
  packetEncryption,
  logger,
  (encrypted) => nextQueue.addMessage(encrypted),
  (failed) => {
    // Handle failed encryption
    logger.error('Encryption failed for packet', failed)
    metrics.incrementFailureCount()
    // Optionally: retry, dead-letter, or discard
  }
)
```

### Validation Errors

Queue creators validate all parameters at creation time:

```typescript
// These will throw Error:
createEncryptionQueue('', ...)           // Empty label
createEncryptionQueue(label, null, ...)  // Missing operation
createEncryptionQueue(label, op, null, ...) // Missing logger
```

---

## Relationship to Other Modules

- **Depends on**: [`packet/`](../packet/README.md) (for packet types and validations)
- **Used by**: [`sender/`](../sender/README.md), [`receiver/`](../receiver/README.md)

---

## Directory Structure

```
queue/
├── README.md           ← You are here
├── index.ts            ← Public exports
├── model.ts            ← Queue interface definitions
├── queue.integration.spec.ts  ← Integration tests
├── creators/
│   ├── index.ts
│   ├── create-queue.ts
│   ├── create-encryption-queue.ts
│   ├── create-serialization-queue.ts
│   ├── create-obfuscation-queue.ts
│   ├── create-deobfuscation-queue.ts
│   ├── create-deserialization-queue.ts
│   └── create-decryption-queue.ts
├── utils/
│   └── get-validation-error.ts
└── validations/
    └── is-valid-queue-creater-arguments.ts
```

---

## See Also

- **[Library Index](../README.md)** - All modules
- **[Architecture Guide](../../../ARCHITECTURE.md#queue)** - Queue architecture
- **Legacy**: `_/commercial-develop/packages/network-protocol/src/queue/`
- **Integration Tests**: [queue.integration.spec.ts](queue.integration.spec.ts)

### Related Modules

| Module                             | Relationship                      |
| ---------------------------------- | --------------------------------- |
| [sender/](../sender/README.md)     | Uses queues for outbound pipeline |
| [receiver/](../receiver/README.md) | Uses queues for inbound pipeline  |
| [packet/](../packet/README.md)     | Packet types processed in queues  |
