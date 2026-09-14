# data

Browser-side data envelope factory and validators; the schema hash comes from the Web Crypto API.

## Overview

A `Data<T>` is the envelope that wraps every application message inside a packet ([`pid`](https://www.hyperfrontend.dev/docs/libraries/network-protocol/browser/data/#api-Data-prop-pid), [`id`](https://www.hyperfrontend.dev/docs/libraries/network-protocol/browser/data/#api-Data-prop-id), [`sequence`](https://www.hyperfrontend.dev/docs/libraries/network-protocol/browser/data/#api-Data-prop-sequence), [`message`](https://www.hyperfrontend.dev/docs/libraries/network-protocol/browser/data/#api-Data-prop-message), [`schema`](https://www.hyperfrontend.dev/docs/libraries/network-protocol/browser/data/#api-Data-prop-schema), [`schemaHash`](https://www.hyperfrontend.dev/docs/libraries/network-protocol/browser/data/#api-Data-prop-schemaHash)). This entry point binds the runtime-agnostic `lib/data` factory to [`createHash`](https://www.hyperfrontend.dev/docs/libraries/cryptography/#api-createHash) from [`@hyperfrontend/cryptography/browser`](https://www.hyperfrontend.dev/docs/libraries/cryptography/browser/), so [`createData`](https://www.hyperfrontend.dev/docs/libraries/network-protocol/browser/data/#api-createData) generates a JSON Schema for the message and hashes it with SHA-256 via `crypto.subtle`.

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

- `createData(pid, sequence, message)` returns `SerializedData<T>` (the message as a JSON string) with a generated [`id`](https://www.hyperfrontend.dev/docs/libraries/network-protocol/browser/data/#api-Data-prop-id); [`pid`](https://www.hyperfrontend.dev/docs/libraries/network-protocol/browser/data/#api-Data-prop-pid) must be a UUID v4 and [`sequence`](https://www.hyperfrontend.dev/docs/libraries/network-protocol/browser/data/#api-Data-prop-sequence) a number greater than zero.
- [`createData`](https://www.hyperfrontend.dev/docs/libraries/network-protocol/browser/data/#api-createData) derives a stable [`schemaHash`](https://www.hyperfrontend.dev/docs/libraries/network-protocol/browser/data/#api-Data-prop-schemaHash) from the inferred JSON Schema so receivers can detect message-shape changes.
- Serialization helpers ([`serializeData`](https://www.hyperfrontend.dev/docs/libraries/network-protocol/browser/data/#api-serializeData), [`deserializeData`](https://www.hyperfrontend.dev/docs/libraries/network-protocol/browser/data/#api-deserializeData), [`asJSONString`](https://www.hyperfrontend.dev/docs/libraries/network-protocol/browser/data/#api-asJSONString), [`parseJSONString`](https://www.hyperfrontend.dev/docs/libraries/network-protocol/browser/data/#api-parseJSONString), [`isJSONString`](https://www.hyperfrontend.dev/docs/libraries/network-protocol/browser/data/#api-isJSONString)) and [`getSchema`](https://www.hyperfrontend.dev/docs/libraries/network-protocol/browser/data/#api-getSchema) are re-exported for callers that need to manipulate the envelope outside the pipeline.
- Validation helpers ([`isValidId`](https://www.hyperfrontend.dev/docs/libraries/network-protocol/browser/data/#api-isValidId), [`isValidPid`](https://www.hyperfrontend.dev/docs/libraries/network-protocol/browser/data/#api-isValidPid), [`isValidSequence`](https://www.hyperfrontend.dev/docs/libraries/network-protocol/browser/data/#api-isValidSequence), [`isValidMessage`](https://www.hyperfrontend.dev/docs/libraries/network-protocol/browser/data/#api-isValidMessage), [`isValidSchema`](https://www.hyperfrontend.dev/docs/libraries/network-protocol/browser/data/#api-isValidSchema), [`isValidSchemaHash`](https://www.hyperfrontend.dev/docs/libraries/network-protocol/browser/data/#api-isValidSchemaHash), [`isValidUnencryptedData`](https://www.hyperfrontend.dev/docs/libraries/network-protocol/browser/data/#api-isValidUnencryptedData)) are exposed for upstream guards.
- The Node counterpart lives at [`/node/data`](https://www.hyperfrontend.dev/docs/libraries/network-protocol/node/data/) and uses Node's `crypto` module instead.
