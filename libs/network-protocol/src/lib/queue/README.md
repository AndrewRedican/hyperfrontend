# Queue

## Purpose

The Queue module provides the FIFO processing queue behind each pipeline stage, and the two specialised queues built on it: the seal queue (plaintext packets in, sealed frames out) and the open queue (frames in, plaintext packets out). Strict one-at-a-time processing is what lets a protocol assign a monotonically increasing counter to every frame.

---

## Key Interfaces

### `Queue<T>`

```typescript
interface Queue<T extends object> {
  readonly addMessage: (message: T) => void // Enqueue; starts processing when autoStart is on
  readonly isRunning: () => boolean // Whether the queue is processing
  readonly stop: () => void // Pause processing (messages accumulate)
  readonly resume: () => void // Resume processing accumulated messages
  readonly size: () => number // Number of messages waiting
  readonly currentMessage: () => T | null // The message being processed
}
```

### `MessageHandler<T>`

```typescript
type MessageHandler<T extends object> = (message: T) => Promise<void> | void
```

### `QueueFailureHandler`

Called with the rejected input, why it was rejected, and the error the operation threw when it threw one.

```typescript
type QueueFailureHandler = (raw: unknown, reason: string, cause?: unknown) => void
```

### `QueueOperation`, `QueueCreatorArguments`, `QueueCreatorValidity`

```typescript
type QueueOperation = PacketSealer | PacketOpener

interface QueueCreatorArguments<T = any> {
  label: string
  operation: QueueOperation
  logger: Logger
  onSuccess: (packet: T) => void
  onFail: QueueFailureHandler
}

interface QueueCreatorValidity {
  label: boolean
  operation: boolean
  logger: boolean
  onSuccess: boolean
  onFail: boolean
}
```

### `SealQueueCreater` and `OpenQueueCreater`

```typescript
type SealQueueCreater = (
  label: string,
  seal: PacketSealer,
  logger: Logger,
  onSuccess: (packet: WirePacket) => void,
  onFail: QueueFailureHandler
) => Queue<UnencryptedPacket>

type OpenQueueCreater = (
  label: string,
  open: PacketOpener,
  logger: Logger,
  onSuccess: (packet: UnencryptedPacket) => void,
  onFail: QueueFailureHandler
) => Queue<WirePacket>
```

---

## Queue Types

| Queue Creator     | Input               | Output              | Used by                              |
| ----------------- | ------------------- | ------------------- | ------------------------------------ |
| `createSealQueue` | `UnencryptedPacket` | `WirePacket`        | [`sender/`](../sender/README.md)     |
| `createOpenQueue` | `WirePacket`        | `UnencryptedPacket` | [`receiver/`](../receiver/README.md) |

---

## Factory Functions

### `createQueue<T>`

**Location**: `@hyperfrontend/network-protocol/queue`

```typescript
function createQueue<T extends Record<string, any>>(processMessage: MessageHandler<T>, autoStart = true): Queue<T>
```

Messages are processed strictly one at a time in arrival order; the next one starts only after the handler's promise settles. The backing store is an array with a moving head, so a pull is constant time; once 1024 pulled slots sit at the front the array is compacted.

```typescript
import { createQueue } from '@hyperfrontend/network-protocol/queue'

const queue = createQueue<{ id: string }>(async (message) => {
  await handle(message)
})
queue.addMessage({ id: '1' }) // starts processing at once
```

Throws `processMessage must be a function` and `autoStart must be a boolean` at creation; `addMessage` throws a `TypeError` (`Message must be a non-null object`) for anything that is not an object.

### `createSealQueue`

```typescript
import { createSealQueue } from '@hyperfrontend/network-protocol/queue'

const sealing = createSealQueue(
  'comms sender',
  protocol.seal,
  logger,
  (frame) => transport.post(frame),
  (packet, reason, cause) => report(reason, cause)
)
sealing.addMessage(unencryptedPacket)
```

Each packet is checked with `isValidUnencryptedPacket`, sealed, and the result checked with `isValidWirePacket` before `onSuccess`.

### `createOpenQueue`

```typescript
import { createOpenQueue } from '@hyperfrontend/network-protocol/queue'

const opening = createOpenQueue(
  'comms receiver',
  protocol.open,
  logger,
  (packet) => deliver(packet),
  (frame, reason, cause) => report(reason, cause)
)
opening.addMessage(frame)
```

Each frame is checked with `isValidWirePacket`, opened, and the result checked with `isValidUnencryptedPacket` before `onSuccess`.

---

## Lifecycle Management

```typescript
queue.stop()
queue.isRunning() // false once the current message settles

queue.addMessage(a) // accumulates while stopped
queue.addMessage(b)
queue.size() // 2

queue.resume() // processes a, then b
```

`currentMessage()` returns the message in flight, or `null` between messages.

---

## Error Handling

A rejected input never blocks the queue: the stage logs it, calls `onFail`, and moves on to the next message.

| Queue | `reason`                                                                 | `cause`                    |
| ----- | ------------------------------------------------------------------------ | -------------------------- |
| seal  | `Invalid packet ignored`                                                 | none                       |
| seal  | the message of the error `seal` threw (a `ProtocolError`)                | the thrown error           |
| seal  | `Sealed packet is not valid`                                             | none                       |
| open  | `Invalid frame ignored`                                                  | none                       |
| open  | the message of the error `open` threw (replay, forgery, malformed frame) | the thrown `ProtocolError` |
| open  | `Opened packet is not valid`                                             | none                       |
| both  | `An unexpected error occurred. <error>`                                  | the thrown error           |

The sender and receiver translate these calls into `PacketDrop` reports for the channel's `onDrop`.

### Validation Errors

The specialised creators validate their arguments and throw `Cannot create seal queue without ...` or `Cannot create open queue without ...` followed by `a label`, `seal function` / `open function`, `a logger`, `a success callback function`, or `a failed callback function`.

---

## Relationship to Other Modules

- **Depends on**: [`packet/`](../packet/README.md) (packet types and validations), `@hyperfrontend/logging`
- **Used by**: [`sender/`](../sender/README.md), [`receiver/`](../receiver/README.md)

---

## See Also

- **[Library Index](../README.md)** - All modules
- **[Architecture Guide](../../../ARCHITECTURE.md#queue)** - Queue architecture
- **[Queue Entry](../../queue/README.md)** - The `@hyperfrontend/network-protocol/queue` entry

### Related Modules

| Module                             | Relationship                          |
| ---------------------------------- | ------------------------------------- |
| [sender/](../sender/README.md)     | Wraps the seal queue                  |
| [receiver/](../receiver/README.md) | Wraps the open queue                  |
| [packet/](../packet/README.md)     | Packet types processed in queues      |
| [protocol/](../protocol/README.md) | Supplies the seal and open operations |
