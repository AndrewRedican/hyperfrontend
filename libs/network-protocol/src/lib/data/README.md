# Data

**Navigation**: [↑ lib/](../README.md) · [packet](../packet/README.md) · [sender](../sender/README.md) · [receiver](../receiver/README.md)

---

## Purpose

The Data module defines the message payload structure with automatic schema generation, unique identification, and encryption key management. Data objects are the content carried within packets.

---

## Key Interfaces

### `Data<T>`

Logical view of data with deserialized message (used after parsing).

```typescript
interface Data<T = unknown> {
  pid: string // Process identifier
  id: string // Unique message identifier (UUID)
  sequence: number // Sequential counter within process
  key: string // Encryption key for replies (UUID)
  message: T // Deserialized message content
  schema: Schema // JSON Schema describing message structure
  schemaHash: string // SHA-256 hash of the schema
}
```

### `SerializedData<T>`

Wire format with JSON-serialized message (used for transmission/encryption).

```typescript
interface SerializedData<T = unknown> {
  pid: string
  id: string
  sequence: number
  key: string
  message: JSONString<T> // JSON string representation
  schema: Schema
  schemaHash: string
}
```

### `JSONString<T>`

Branded type for type-safe JSON strings.

```typescript
type JSONString<T = unknown> = string & {
  readonly __jsonBrand: unique symbol
  readonly __type: T
}
```

---

## Data Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           DATA TRANSFORMATION                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Your Message Object (T)                                                    │
│          │                                                                   │
│          ▼ createData()                                                     │
│                                                                              │
│  SerializedData<T>  ← Wire format (message as JSON string)                  │
│  ├─ pid: string                                                             │
│  ├─ id: string (generated UUID)                                             │
│  ├─ sequence: number                                                        │
│  ├─ key: string (generated encryption key)                                  │
│  ├─ message: JSONString<T> (JSON.stringify of your message)                 │
│  ├─ schema: Schema (auto-generated JSON Schema)                             │
│  └─ schemaHash: string (SHA-256 of schema)                                  │
│          │                                                                   │
│          ▼ deserializeData()                                                │
│                                                                              │
│  Data<T>  ← Logical format (message as object)                              │
│  ├─ ... same fields                                                         │
│  └─ message: T (JSON.parse of message)                                      │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Factory Functions

### `createDataFactory`

Creates a data factory with injected hashing.

**Signature**:

```typescript
function createDataFactory(createHash: (data: string, algorithm: string) => Promise<string>): DataCreater
```

**Parameters**:

| Parameter    | Type                                                   | Description                      |
| ------------ | ------------------------------------------------------ | -------------------------------- |
| `createHash` | `(data: string, algorithm: string) => Promise<string>` | Hash function for schema hashing |

**Returns**: `DataCreater` - An async function that creates `SerializedData<T>` objects.

**Example**:

```typescript
import { createHash } from '@hyperfrontend/cryptography/browser'
import { createDataFactory } from '@hyperfrontend/network-protocol/lib/data/creators'

const createData = createDataFactory(createHash)

const data = await createData(
  'process-123', // pid
  1, // sequence
  { type: 'greeting', content: 'Hello!' } // message
)

// data = {
//   pid: 'process-123',
//   id: 'generated-uuid',
//   sequence: 1,
//   key: 'generated-key-uuid',
//   message: '{"type":"greeting","content":"Hello!"}',
//   schema: { type: 'object', properties: { ... } },
//   schemaHash: 'sha256-hash-of-schema'
// }
```

---

## Helper Functions

### `deserializeData<T>`

Converts `SerializedData<T>` to `Data<T>` by parsing the JSON message.

```typescript
import { deserializeData } from '@hyperfrontend/network-protocol/lib/data'

const data = deserializeData(serializedData)
// data.message is now the parsed object
```

### `serializeData<T>`

Converts `Data<T>` to `SerializedData<T>` by stringifying the message.

```typescript
import { serializeData } from '@hyperfrontend/network-protocol/lib/data'

const serialized = serializeData(data)
// serialized.message is now a JSON string
```

### `asJSONString<T>`

Safely casts a string to `JSONString<T>` for type safety.

```typescript
import { asJSONString } from '@hyperfrontend/network-protocol/lib/data'

const jsonStr = asJSONString<MyType>('{"field":"value"}')
```

### `parseJSONString<T>`

Parses a `JSONString<T>` back to its original type.

```typescript
import { parseJSONString } from '@hyperfrontend/network-protocol/lib/data'

const obj = parseJSONString(jsonString)
// obj is typed as T
```

### `isJSONString<T>`

Type guard to check if a value is a `JSONString`.

```typescript
import { isJSONString } from '@hyperfrontend/network-protocol/lib/data'

if (isJSONString(value)) {
  // value is JSONString<unknown>
}
```

---

## Schema Generation

Schemas are automatically generated from your message structure:

```typescript
const message = {
  type: 'greeting',
  count: 42,
  active: true,
  items: ['a', 'b'],
}

const data = await createData('pid', 1, message)

// data.schema = {
//   type: 'object',
//   properties: {
//     type: { type: 'string' },
//     count: { type: 'integer' },
//     active: { type: 'boolean' },
//     items: { type: 'array', items: { type: 'string' } }
//   }
// }
```

The schema hash provides a fingerprint for message structure validation.

---

## Encryption Key Management

Each data object includes a `key` field (auto-generated UUID):

```typescript
const data = await createData('pid', 1, message)
console.log(data.key) // e.g., 'a1b2c3d4-e5f6-...'
```

This key is used for **reply encryption**:

- Sender generates a key and includes it in the message
- Receiver captures this key and uses it to encrypt responses
- This enables dynamic key exchange per message

---

## Encryption/Decryption

### `createDataEncrypter`

Creates an encrypter for `SerializedData`.

```typescript
import { createDataEncrypter } from '@hyperfrontend/network-protocol/lib/data/security'
import { encrypt } from '@hyperfrontend/cryptography/browser'

const encryptData = createDataEncrypter(encrypt)
const encrypted = await encryptData(serializedData, 'password')
// encrypted is Uint8Array
```

### `createDataDecrypter`

Creates a decrypter for encrypted data.

```typescript
import { createDataDecrypter } from '@hyperfrontend/network-protocol/lib/data/security'
import { decrypt } from '@hyperfrontend/cryptography/browser'

const decryptData = createDataDecrypter(decrypt)
const serializedData = await decryptData(encryptedBytes, 'password')
```

---

## Validation

Data creation validates all inputs:

```typescript
// Invalid pid
await createData('', 1, message)
// Error: 'Cannot create data without a valid pid'

// Invalid sequence
await createData('pid', -1, message)
// Error: 'Cannot create data without a valid sequence'

// Circular references
const circular = { self: null }
circular.self = circular
await createData('pid', 1, circular)
// Error: 'Cannot create data with a message with circular references'

// Invalid message
await createData('pid', 1, undefined)
// Error: 'Cannot create data without a valid message'
```

---

## Relationship to Other Modules

- **Depends on**: `@hyperfrontend/cryptography`, `jsonschema`
- **Used by**: [`packet/`](../packet/README.md), [`sender/`](../sender/README.md), [`receiver/`](../receiver/README.md)

---

## Directory Structure

```
data/
├── README.md           ← You are here
├── index.ts            ← Public exports
├── model.ts            ← Data interface definitions
├── data.integration.spec.ts
├── creators/
│   ├── index.ts
│   ├── create-data-factory.ts
│   └── get-schema.ts
├── security/
│   ├── index.ts
│   ├── create-encrypter.ts
│   └── create-decrypter.ts
└── validations/
    ├── index.ts
    ├── is-valid-pid.ts
    ├── is-valid-sequence.ts
    ├── is-valid-message.ts
    └── is-valid-unencrypted-data.ts
```

---

## See Also

- **[Library Index](../README.md)** - All modules
- **[Architecture Guide](../../../ARCHITECTURE.md#data)** - Data architecture
- **[Browser Entry](../../browser/data/)** - Browser-specific data
- **[Node Entry](../../node/data/)** - Node.js-specific data
- **Legacy**: `_/commercial-develop/packages/network-protocol/src/data/`
- **Integration Tests**: [data.integration.spec.ts](data.integration.spec.ts)

### Related Modules

| Module                         | Relationship                         |
| ------------------------------ | ------------------------------------ |
| [packet/](../packet/README.md) | Data is payload of UnencryptedPacket |
