# data

Node.js-side data envelope factory and validators; the schema hash comes from Node's `crypto` module.

A `Data<T>` is the envelope that wraps every application message inside a packet (`pid`, `id`, `sequence`, `message`, `schema`, `schemaHash`). This entry point binds the runtime-agnostic `lib/data` factory to `createHash` from `@hyperfrontend/cryptography/node`, so `createData(pid, sequence, message)` generates a JSON Schema for the message and hashes it with SHA-256 via `node:crypto`. The serialization helpers (`serializeData`, `deserializeData`, `asJSONString`, `parseJSONString`, `isJSONString`), `getSchema`, and the validators (`isValidId`, `isValidPid`, `isValidSequence`, `isValidMessage`, `isValidSchema`, `isValidSchemaHash`, `isValidUnencryptedData`) are re-exported. Function signatures match `/browser/data` so envelopes are interchangeable across runtimes; pick the adapter that matches the process and the rest of the code stays identical.
