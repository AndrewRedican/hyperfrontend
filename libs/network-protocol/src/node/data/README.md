# data

Node.js-side data payload factory and encrypt/decrypt helpers built on Node's `crypto` module.

A `Data<T>` is the structured envelope that wraps every application message inside a packet (`pid`, `id`, `sequence`, `key`, `message`, `schema`, `schemaHash`). This entry point binds the runtime-agnostic `lib/data` factory to `@hyperfrontend/cryptography/node`, so `createData` hashes via `node:crypto` and `encryptData` / `decryptData` use AES-GCM via `webcrypto.subtle`. Function signatures match `/browser/data` so envelopes are interchangeable across runtimes; pick the adapter that matches the process and the rest of the code stays identical.
