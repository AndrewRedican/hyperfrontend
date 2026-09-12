# data

Browser-side data envelope factory and validators; the schema hash comes from the Web Crypto API.

## Overview

A `Data<T>` is the envelope that wraps every application message inside a packet (`pid`, `id`, `sequence`, `message`, `schema`, `schemaHash`). This entry point binds the runtime-agnostic `lib/data` factory to `createHash` from `@hyperfrontend/cryptography/browser`, so `createData` generates a JSON Schema for the message and hashes it with SHA-256 via `crypto.subtle`.

## Usage

```typescript
import { createData, deserializeData } from '@hyperfrontend/network-protocol/browser/data'

const serialized = await createData(pid, 1, {
  type: 'greeting',
  content: 'hello',
})
const data = deserializeData(serialized)

channel.send(localId, peerId, data)
```

## Notes

- `createData(pid, sequence, message)` returns `SerializedData<T>` (the message as a JSON string) with a generated `id`; `pid` must be a UUID v4 and `sequence` a number greater than zero.
- `createData` derives a stable `schemaHash` from the inferred JSON Schema so receivers can detect message-shape changes.
- Serialization helpers (`serializeData`, `deserializeData`, `asJSONString`, `parseJSONString`, `isJSONString`) and `getSchema` are re-exported for callers that need to manipulate the envelope outside the pipeline.
- Validation helpers (`isValidId`, `isValidPid`, `isValidSequence`, `isValidMessage`, `isValidSchema`, `isValidSchemaHash`, `isValidUnencryptedData`) are exposed for upstream guards.
- The Node counterpart lives at `/node/data` and uses Node's `crypto` module instead.
