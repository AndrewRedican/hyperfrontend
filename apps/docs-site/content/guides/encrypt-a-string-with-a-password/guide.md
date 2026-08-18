# How to encrypt and decrypt a string with a password

You will turn a secret into ciphertext that only the right password reopens, keep it as text a database column will accept, and react correctly when the password is wrong.

Passwords are not keys. Something has to stretch the password into one, invent a fresh salt and initialisation vector for every message, and pack all three where the decrypting side can find them again. [`@hyperfrontend/cryptography`](/docs/libraries/cryptography) does that in one call, with the same signatures in the browser and in Node.

## 1. Install it and import the side you run on

```bash
npm install @hyperfrontend/cryptography
```

Import from [`/node`](/docs/libraries/cryptography/node) in a server or CLI, from [`/browser`](/docs/libraries/cryptography/browser) in a page or worker. The exported names and signatures are identical, so only the import line differs between the two.

## 2. Encrypt the secret

[`encrypt`](/docs/libraries/cryptography#api-encrypt) resolves to the bytes you keep:

```ts
import { encrypt } from '@hyperfrontend/cryptography/node'

const ciphertext = await encrypt('sk_live_9f2c41', process.env.VAULT_PASSWORD)
// Uint8Array(58)
```

Those bytes are a random 16-byte salt, a random 12-byte initialisation vector, and the [AES-GCM](https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/encrypt#aes-gcm) output, concatenated in that order. Keep all of them: the salt is what [derives the key](https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/deriveKey#pbkdf2), through PBKDF2 at 100,000 SHA-256 rounds, so there is nothing else to store alongside. Both random values are new on every call, which is why encrypting the same secret twice gives you two different results.

## 3. Keep it as text

[`Uint8Array`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Uint8Array) is awkward in a database column or a JSON body. Base64 it with [`uint8ArrayToBase64`](/docs/libraries/utils/string#api-uint8ArrayToBase64), which splits by entry point the same way:

```bash
npm install @hyperfrontend/string-utils
```

```ts
import { uint8ArrayToBase64, base64ToUint8Array } from '@hyperfrontend/string-utils/node'

const stored = uint8ArrayToBase64(ciphertext)
// 'bYUgxgzdy+zstFV6mLBQ...'
```

## 4. Decrypt it

[`decrypt`](/docs/libraries/cryptography#api-decrypt) reads the salt and initialisation vector back out of the front of the message, so it needs the ciphertext and the password and nothing else:

```ts
import { decrypt } from '@hyperfrontend/cryptography/node'

const secret = await decrypt(base64ToUint8Array(stored), process.env.VAULT_PASSWORD)
// 'sk_live_9f2c41'
```

## 5. Handle a password that does not fit

A wrong password rejects with a [`DOMException`](https://developer.mozilla.org/en-US/docs/Web/API/DOMException) whose `name` is [`OperationError`](https://developer.mozilla.org/en-US/docs/Web/API/DOMException#operationerror). Branch on that name rather than on the message text, which the runtime writes:

```ts
try {
  return await decrypt(base64ToUint8Array(stored), attempt)
} catch (error) {
  if (error instanceof DOMException && error.name === 'OperationError') return null
  throw error
}
```

Modified ciphertext fails the same way, because AES-GCM authenticates the whole message before decrypting any of it. Report that outcome as "this did not open" and stop there: nothing downstream can tell a wrong password from a corrupted record, and neither can you.

## Check it worked

Encrypt a value, print the base64, and decrypt it in a fresh process: you get the original string back with nothing else carried between the two runs. Encrypt the same value again and the base64 differs. Flip any character of a stored value and decrypting it raises `OperationError` even with the correct password.
