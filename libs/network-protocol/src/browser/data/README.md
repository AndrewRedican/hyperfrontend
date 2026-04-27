# data

Browser-side data payload factory and encrypt/decrypt helpers built on the Web Crypto API.

## Overview

A `Data<T>` is the structured envelope that wraps every application message inside a packet (`pid`, `id`, `sequence`, `key`, `message`, `schema`, `schemaHash`). This entry point binds the runtime-agnostic `lib/data` factory to `@hyperfrontend/cryptography/browser`, so `createData` hashes via Web Crypto and `encryptData` / `decryptData` use AES-GCM via `crypto.subtle`.

## Usage

```typescript
import { createData, encryptData, decryptData } from '@hyperfrontend/network-protocol/browser/data'

const data = createData({ type: 'greeting', content: 'hello' })

const encrypted = await encryptData(data, password)
const restored = await decryptData(encrypted, password)
```

## Notes

- `createData` derives a stable `schemaHash` from the inferred JSON schema so receivers can detect message-shape changes.
- Serialization helpers (`serializeData`, `deserializeData`, `asJSONString`, `parseJSONString`, `isJSONString`) are re-exported for callers that need to manipulate the payload outside the queue pipeline.
- Validation helpers (`isValidId`, `isValidPid`, `isValidSequence`, `isValidMessage`, `isValidSchema`, `isValidSchemaHash`, `isValidUnencryptedData`, `isValidUnserializedData`, `isValidSerializedData`) are exposed for upstream guards.
- The Node counterpart lives at `/node/data` and uses Node's `crypto` module instead.
