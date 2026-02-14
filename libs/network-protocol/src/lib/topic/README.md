# Topic

**Navigation**: [↑ lib/](../README.md) · [routing](../routing/README.md)

---

## Purpose

The Topic module provides a store for managing named topics used in message routing. Topics are identifiers that channels can subscribe to for receiving relevant messages in a publish-subscribe pattern.

---

## Key Interfaces

### `Topic`

A topic with a name and unique identifier.

```typescript
interface Topic {
  readonly name: string // Human-readable topic name
  readonly id: string // Unique identifier (auto-generated)
}
```

### `TopicStore`

Store for managing topic lifecycle with CRUD operations.

```typescript
interface TopicStore {
  // Creation
  readonly create: (...name: string[]) => void
  readonly add: (...topic: Topic[]) => void

  // Existence checks
  readonly existsByName: (name: string) => boolean
  readonly existsById: (id: string) => boolean

  // Retrieval
  readonly getByName: (name: string) => Topic | null
  readonly getById: (id: string) => Topic | null
  readonly list: Topic[]

  // Removal
  readonly removeByName: (...name: string[]) => void
  readonly removeById: (...id: string[]) => void
  readonly clear: () => void
}
```

---

## Factory Functions

### `createTopicStore`

**Produces**: `TopicStore`

Creates a new topic store instance for managing topics.

```typescript
import { createTopicStore } from '@hyperfrontend/network-protocol/lib/topic'

const topicStore = createTopicStore()
```

---

## Usage Examples

### Basic Topic Management

```typescript
import { createTopicStore } from '@hyperfrontend/network-protocol/lib/topic'

const topicStore = createTopicStore()

// Create multiple topics by name (IDs auto-generated)
topicStore.create('user-events', 'system-events', 'notifications')

// Retrieve topics
const userEvents = topicStore.getByName('user-events')
console.log(userEvents?.id) // Generated unique ID
console.log(userEvents?.name) // 'user-events'

// Check existence
if (topicStore.existsByName('user-events')) {
  // Topic exists
}

// List all topics
const allTopics = topicStore.list
console.log(allTopics.length) // 3
```

### Adding Pre-created Topics

```typescript
// Add topics with custom IDs
const customTopic: Topic = {
  name: 'custom-channel',
  id: 'my-unique-id-12345',
}

topicStore.add(customTopic)

// Retrieve by ID
const retrieved = topicStore.getById('my-unique-id-12345')
```

### Topic Removal

```typescript
// Remove specific topics by name
topicStore.removeByName('user-events', 'system-events')

// Remove by ID
topicStore.removeById('my-unique-id-12345')

// Clear all topics
topicStore.clear()
console.log(topicStore.list.length) // 0
```

---

## Topic Naming Conventions

Recommended patterns for topic names:

| Pattern           | Example          | Use Case                   |
| ----------------- | ---------------- | -------------------------- |
| `entity-action`   | `user-created`   | Entity lifecycle events    |
| `domain-events`   | `payment-events` | Domain-specific events     |
| `system-category` | `system-metrics` | System-level notifications |
| `feature.sub`     | `chat.messages`  | Hierarchical namespacing   |

---

## Integration with Routing

Topics work with the routing module to enable pub-sub messaging:

```typescript
import { createTopicStore } from '@hyperfrontend/network-protocol/lib/topic'
import { createChannelStore } from '@hyperfrontend/network-protocol/lib/channel'

// Create stores
const topicStore = createTopicStore()
const channelStore = createChannelStore()

// Create topics
topicStore.create('user-events', 'system-events')

// Create channels (simplified)
const channel1 = channelStore.create('client-1', send, receive, protocolProvider)
const channel2 = channelStore.create('client-2', send, receive, protocolProvider)

// Define router with subscriptions
const router: Router = (channels, topics) => {
  const subscriptions = new WeakMap<Channel, Topic[]>()

  const userEvents = topics.find((t) => t.name === 'user-events')

  // Subscribe channel1 to user-events
  subscriptions.set(channel1, [userEvents])

  return { isDynamic: false, subscriptions }
}

// Apply routing
const routingOptions = router(
  channelStore.list.map((e) => e.channel),
  topicStore.list
)
```

---

## Relationship to Other Modules

- **Depends on**: None (leaf module)
- **Used by**: [`routing/`](../routing/README.md)

---

## Directory Structure

```
topic/
├── README.md           ← You are here
├── index.ts            ← Public exports
├── model.ts            ← Topic interface definitions
├── topic.integration.spec.ts
├── creators/
│   └── ...
└── validations/
    └── ...
```

---

## See Also

- **[Library Index](../README.md)** - All modules
- **[Architecture Guide](../../../ARCHITECTURE.md#topic)** - Topic architecture

### Related Modules

| Module                           | Relationship                         |
| -------------------------------- | ------------------------------------ |
| [routing/](../routing/README.md) | Uses topics for message distribution |
