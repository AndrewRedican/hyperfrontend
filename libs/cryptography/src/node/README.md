# node

Node.js-targeted bindings of the cryptography primitives, wired to `node:crypto` (`webcrypto.subtle` and `randomBytes`).

## Overview

This entry point composes the runtime-agnostic core (`createEncrypt`, `createValueCreator`, hashing, key derivation, time-based passwords) with Node.js implementations of `subtle`, `getRandomValues`, and UTF-8 encoding. Function signatures match `/browser` so encryption workflows can be shared across the stack: pick the adapter that matches the runtime and the rest of the code stays identical.

## Usage

```typescript
import { encrypt, decrypt, getTimeBasedPasswords } from '@hyperfrontend/cryptography/node'

const ciphertext = await encrypt('Sensitive data', 'secure-password')
const plaintext = await decrypt(ciphertext, 'secure-password')

// Rotating passwords on a 5-minute window, with previous/next for clock-drift tolerance
const generators = getTimeBasedPasswords(new Date(), 300_000)
const current = await generators.current()
const previous = await generators.previous()
```

## Notes

- `subtle` resolves to `webcrypto.subtle`. Node.js 19+ is recommended; on 18.x `webcrypto` is still flagged experimental.
- `getRandomValues` delegates to `randomBytes` and throws when called with a zero byte length.
- The package has zero runtime dependencies beyond `node:crypto` and a small set of internal utility libs.
