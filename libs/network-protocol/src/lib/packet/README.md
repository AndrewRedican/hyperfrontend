# Packet

**Navigation**: [↑ lib/](../README.md) · [data](../data/README.md) · [security](../security/README.md) · [queue](../queue/README.md)

---

## Purpose

The Packet module defines the core data structures and transformations for message packaging in the network protocol. It provides a type hierarchy representing packets at different stages of the security pipeline (unencrypted, encrypted, serialized, obfuscated).

---

## Packet Type Hierarchy

Packets transform through four distinct stages as they flow through the security pipeline:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         PACKET TRANSFORMATION FLOW                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  OUTBOUND (Sender)                        INBOUND (Receiver)                 │
│  ─────────────────                        ──────────────────                 │
│                                                                              │
│  UnencryptedPacket<T>                     UnencryptedPacket<T>               │
│  ├─ origin: string                        ↑                                  │
│  ├─ target: string                        │ decrypt                          │
│  └─ data: Data<T>                         │                                  │
│          │                                │                                  │
│          │ encrypt                        │                                  │
│          ▼                                │                                  │
│  UnserializedEncryptedPacket       UnserializedEncryptedPacket               │
│  ├─ origin: string                        ↑                                  │
│  ├─ target: string                        │ deserialize                      │
│  └─ data: Uint8Array                      │                                  │
│          │                                │                                  │
│          │ serialize                      │                                  │
│          ▼                                │                                  │
│  SerializedEncryptedPacket         SerializedEncryptedPacket                 │
│  ├─ origin: string                        ↑                                  │
│  ├─ target: string                        │ deobfuscate                      │
│  └─ data: string (base64)                 │                                  │
│          │                                │                                  │
│          │ obfuscate                      │                                  │
│          ▼                                │                                  │
│  ObfuscatedPacket                  ObfuscatedPacket                          │
│  └─ Uint8Array (raw bytes)                                                   │
│                                                                              │
│          │                                ↑                                  │
│          └──────── Transport Layer ───────┘                                  │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Key Interfaces

### `PacketBase`

Base interface for all packet types with routing information.

```typescript
interface PacketBase {
  origin: string // Identifies the sender (e.g., 'https://app.example.com')
  target: string // Identifies the recipient (e.g., 'https://widget.example.com')
}
```

### `UnencryptedPacket<T>`

Packet with plaintext data - the entry point for outbound messages.

```typescript
interface UnencryptedPacket<T = any> extends PacketBase {
  data: Data<T> // Structured message payload
}
```

### `UnserializedEncryptedPacket`

Packet with encrypted binary data (after encryption, before serialization).

```typescript
interface UnserializedEncryptedPacket extends PacketBase {
  data: Uint8Array // Encrypted binary data
}
```

### `SerializedEncryptedPacket`

Packet with encrypted data as a base64 string (after serialization, before obfuscation).

```typescript
interface SerializedEncryptedPacket extends PacketBase {
  data: string // Base64-encoded encrypted data
}
```

### `ObfuscatedPacket`

Final wire format - fully obfuscated binary with no visible structure.

```typescript
type ObfuscatedPacket = Uint8Array // Opaque binary blob
```

---

## Transformation Function Types

### Low-Level Transformers (with password)

These require explicit password parameters and are the building blocks:

```typescript
// Encryption/Decryption (password-based)
type PacketEncrypter = <T>(packet: UnencryptedPacket<T>, password: string) => Promise<UnserializedEncryptedPacket>
type PacketDecrypter = <T>(packet: UnserializedEncryptedPacket, password: string) => Promise<UnencryptedPacket<T>>

// Obfuscation/Deobfuscation (password-based)
type PacketObfuscater = (packet: SerializedEncryptedPacket, password: string) => Promise<ObfuscatedPacket>
type PacketDeobfuscater = (packet: ObfuscatedPacket, password: string) => Promise<SerializedEncryptedPacket>
```

### High-Level Transformers (password captured)

These have the password/key provider already bound and are used by queues:

```typescript
// Encryption/Decryption (key-captured)
type PacketEncryption<T = any> = (packet: UnencryptedPacket<T>) => Promise<UnserializedEncryptedPacket>
type PacketDecryption<T = any> = (packet: UnserializedEncryptedPacket) => Promise<UnencryptedPacket<T>>

// Serialization/Deserialization (synchronous)
type PacketSerialization = (packet: UnserializedEncryptedPacket) => SerializedEncryptedPacket
type PacketDeserialization = (packet: SerializedEncryptedPacket) => UnserializedEncryptedPacket

// Obfuscation/Deobfuscation (time-based password)
type PacketObfuscation = (packet: SerializedEncryptedPacket) => Promise<ObfuscatedPacket>
type PacketDeobfuscation = (packet: ObfuscatedPacket) => Promise<SerializedEncryptedPacket>
```

---

## Factory Functions

### Packet Creators

#### `createUnencryptedPacket`

Creates a validated, frozen unencrypted packet.

```typescript
import { createUnencryptedPacket } from '@hyperfrontend/network-protocol/lib/packet'

const packet = createUnencryptedPacket(
  'https://sender.example.com', // origin
  'https://receiver.example.com', // target
  data // Data<T> object
)
// Returns frozen UnencryptedPacket<T>
```

#### `createPacketBase`

Creates the base routing structure for packets.

```typescript
import { createPacketBase } from '@hyperfrontend/network-protocol/lib/packet'

const base = createPacketBase(origin, target)
// Returns { origin, target }
```

### Serialization Factories

#### `createSerializedEncryptedPacketCreator`

Creates a serialization function with injected base64 encoder.

```typescript
import { uint8ArrayToBase64 } from '@hyperfrontend/string-utils/browser'
import { createSerializedEncryptedPacketCreator } from '@hyperfrontend/network-protocol/lib/packet'

const serialize = createSerializedEncryptedPacketCreator(uint8ArrayToBase64)
const serialized = serialize(unserializedEncryptedPacket)
// Returns SerializedEncryptedPacket with base64 data
```

#### `createDeserializedEncryptedPacketCreator`

Creates a deserialization function with injected base64 decoder.

```typescript
import { base64ToUint8Array } from '@hyperfrontend/string-utils/browser'
import { createDeserializedEncryptedPacketCreator } from '@hyperfrontend/network-protocol/lib/packet'

const deserialize = createDeserializedEncryptedPacketCreator(base64ToUint8Array)
const deserialized = deserialize(serializedEncryptedPacket)
// Returns UnserializedEncryptedPacket with Uint8Array data
```

### Encryption Factories

Located in `packet/security/encryption/`:

#### `createPacketEncrypter`

Creates a packet encrypter with injected data encryption.

```typescript
import { createDataEncrypter } from '@hyperfrontend/network-protocol/lib/data/security'
import { encrypt } from '@hyperfrontend/cryptography/browser'
import { createPacketEncrypter } from '@hyperfrontend/network-protocol/lib/packet/security/encryption'

const encryptData = createDataEncrypter(encrypt)
const encryptPacket = createPacketEncrypter(encryptData)
const encrypted = await encryptPacket(unencryptedPacket, 'password')
```

#### `createPacketDecrypter`

Creates a packet decrypter with injected data decryption.

```typescript
import { createDataDecrypter } from '@hyperfrontend/network-protocol/lib/data/security'
import { decrypt } from '@hyperfrontend/cryptography/browser'
import { createPacketDecrypter } from '@hyperfrontend/network-protocol/lib/packet/security/encryption'

const decryptData = createDataDecrypter(decrypt)
const decryptPacket = createPacketDecrypter(decryptData)
const decrypted = await decryptPacket(encryptedPacket, 'password')
```

### Obfuscation Factories

Located in `packet/security/obfuscation/`:

#### `createPacketObfuscator`

Creates an obfuscator with injected obfuscation implementation.

```typescript
import { obfuscate } from '@hyperfrontend/cryptography/browser'
import { createPacketObfuscator } from '@hyperfrontend/network-protocol/lib/packet/security/obfuscation'

const obfuscatePacket = createPacketObfuscator(obfuscate)
const obfuscated = await obfuscatePacket(serializedPacket, 'time-password')
```

#### `createPacketDeobfuscator`

Creates a deobfuscator with injected deobfuscation implementation.

```typescript
import { deobfuscate } from '@hyperfrontend/cryptography/browser'
import { createPacketDeobfuscator } from '@hyperfrontend/network-protocol/lib/packet/security/obfuscation'

const deobfuscatePacket = createPacketDeobfuscator(deobfuscate)
const deobfuscated = await deobfuscatePacket(obfuscatedPacket, 'time-password')
```

---

## Password Strategy

### Encryption Password

Encryption uses a **dynamic key** that can change between messages:

- Captured from incoming packets via `packet.data.key`
- Allows key exchange/rotation during communication
- Managed by the Protocol's `PacketEncryption` wrapper

### Obfuscation Password

Obfuscation uses a **time-based password**:

- Generated from current time window (e.g., 60-minute intervals)
- During deobfuscation, tries current, previous, and next windows
- Handles clock skew between endpoints

---

## Validation Functions

Each packet type has a validation function:

```typescript
import {
  isValidPacketBase,
  isValidUnencryptedPacket,
  isValidUnserializedEncryptedPacket,
  isValidSerializedEncryptedPacket,
  isValidObfuscatedPacket,
} from '@hyperfrontend/network-protocol/lib/packet/validations'

// Validates structure and types
if (isValidUnencryptedPacket(packet)) {
  // packet is UnencryptedPacket
}
```

---

## Error Handling

Each transformation validates inputs and provides descriptive errors:

```typescript
try {
  const encrypted = await encryptPacket(invalidPacket, password)
} catch (error) {
  // Error: 'Cannot encrypt invalid packet'
}

try {
  const serialized = serialize(invalidPacket)
} catch (error) {
  // Error: 'Cannot serialize data of an invalid packet'
}
```

Errors in queue processing are handled via `onFail` callbacks:

```typescript
const encryptionQueue = createEncryptionQueue(
  'channel:encrypt',
  packetEncryption,
  logger,
  (encrypted) => {
    /* success */
  },
  (failed) => {
    logger.error('Encryption failed', failed)
    // Handle: retry, dead-letter, or discard
  }
)
```

---

## Complete Example

```typescript
import { createUnencryptedPacket } from '@hyperfrontend/network-protocol/lib/packet'
import { createData } from '@hyperfrontend/network-protocol/lib/data'

// Create the data payload
const data = createData({
  type: 'greeting',
  content: 'Hello, World!',
})

// Create an unencrypted packet
const packet = createUnencryptedPacket('https://app.example.com', 'https://widget.example.com', data)

console.log(packet)
// {
//   origin: 'https://app.example.com',
//   target: 'https://widget.example.com',
//   data: {
//     pid: 'abc123',
//     id: 'msg-001',
//     sequence: 1,
//     key: null,
//     message: { type: 'greeting', content: 'Hello, World!' },
//     schema: null,
//     schemaHash: null
//   }
// }
```

---

## Relationship to Other Modules

- **Depends on**: [`data/`](../data/README.md) (for the Data interface)
- **Used by**: [`sender/`](../sender/README.md), [`receiver/`](../receiver/README.md), [`queue/`](../queue/README.md), [`security/`](../security/README.md)

---

## Directory Structure

```
packet/
├── README.md                              ← You are here
├── index.ts                               ← Public exports
├── model.ts                               ← Packet interface definitions
├── packet-transformations.integration.spec.ts
├── creators/
│   ├── index.ts
│   ├── create-packet-base.ts
│   ├── create-unencrypted-packet.ts
│   ├── create-serialized-encrypted-packet-creator.ts
│   ├── create-deserialized-encrypted-packet-creator.ts
│   └── mocks.ts
├── security/
│   ├── index.ts
│   ├── encryption/
│   │   ├── index.ts
│   │   ├── create-encrypter.ts
│   │   └── create-decrypter.ts
│   └── obfuscation/
│       ├── index.ts
│       ├── create-obfuscator.ts
│       └── create-deobfuscator.ts
├── utils/
│   └── without-valid-error-message.ts
└── validations/
    ├── index.ts
    ├── is-valid-packet-base.ts
    ├── is-valid-unencrypted-packet.ts
    ├── is-valid-unserialized-encrypted-packet.ts
    ├── is-valid-serialized-encrypted-packet.ts
    └── is-valid-obfuscated-packet.ts
```

---

## See Also

- **[Library Index](../README.md)** - All modules
- **[Architecture Guide](../../../ARCHITECTURE.md#packet-types)** - Packet architecture
- **Legacy**: `_/commercial-develop/packages/network-protocol/src/packet/`
- **Integration Tests**: [packet-transformations.integration.spec.ts](packet-transformations.integration.spec.ts)

### Related Modules

| Module                             | Relationship                               |
| ---------------------------------- | ------------------------------------------ |
| [data/](../data/README.md)         | Provides Data interface for packet payload |
| [security/](../security/README.md) | Encryption/obfuscation suites              |
| [sender/](../sender/README.md)     | Uses packets in outbound pipeline          |
| [receiver/](../receiver/README.md) | Uses packets in inbound pipeline           |
| [queue/](../queue/README.md)       | Processes packets through transformations  |
| [receiver/](../receiver/README.md) | Uses packets in inbound pipeline           |
| [queue/](../queue/README.md)       | Processes packets in queues                |
