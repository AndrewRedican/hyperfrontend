# browser

Browser-targeted bindings of the cryptography primitives, wired to the Web Crypto API on `globalThis.crypto`.

## Overview

This entry point composes the runtime-agnostic core ([`createEncrypt`](https://github.com/AndrewRedican/hyperfrontend/blob/main/libs/cryptography/src/lib/encrypt/create-encrypt.ts), [`createValueCreator`](https://github.com/AndrewRedican/hyperfrontend/blob/main/libs/cryptography/src/lib/create-vault/create-value-creator.ts), hashing, key derivation, key agreement, HKDF expansion, AEAD sealing, time-based passwords) with browser implementations of `subtle`, [`getRandomValues`](https://www.hyperfrontend.dev/docs/libraries/cryptography/browser/#api-getRandomValues), and UTF-8 encoding. The exported function signatures are identical to [`/node`](https://www.hyperfrontend.dev/docs/libraries/cryptography/node/), so application code that imports from [`@hyperfrontend/cryptography/browser`](https://www.hyperfrontend.dev/docs/libraries/cryptography/browser/) can be ported between runtimes without changes.

## Usage

```typescript
import { encrypt, decrypt, createVault, createHash } from '@hyperfrontend/cryptography/browser'

const ciphertext = await encrypt('top-secret', 'user-password')
const plaintext = await decrypt(ciphertext, 'user-password')

const vault = createVault(true) // singleUse
await vault.write('token', 'sk-live-...')
const password = vault.getPassword()
const token = await vault.read('token', password) // vault closes after read

const digest = await createHash('payload') // 64-char hex SHA-256
```

## Notes

- `subtle` resolves to `globalThis.crypto.subtle`; a secure context (HTTPS or localhost) is required.
- [`getRandomValues`](https://www.hyperfrontend.dev/docs/libraries/cryptography/browser/#api-getRandomValues) is backed by `crypto.getRandomValues` and throws when called with a zero byte length.
- Algorithm choices (AES-GCM, PBKDF2 with 100,000 iterations, SHA-256 default) live in the shared core and cannot be overridden per call.
