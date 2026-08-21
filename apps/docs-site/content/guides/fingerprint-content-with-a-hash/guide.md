# How to fingerprint content with a hash

You will turn any piece of text into a short stable id that changes when the text changes, so you can skip work you have already done, key a cache on the content instead of on a filename, or ask the other side whether it already has this exact thing.

The catch is usually that the two sides are different runtimes: the browser reaches for `crypto.subtle` with a `TextEncoder` and a hex loop, the server reaches for `node:crypto`, and the two spellings drift until an id computed in one place stops matching the same content elsewhere. [`@hyperfrontend/cryptography`](/docs/libraries/cryptography) gives both sides one call with one answer.

## 1. Install it and import the side you run on

```bash
npm install @hyperfrontend/cryptography
```

Import from [`/node`](/docs/libraries/cryptography/node) in a server or CLI, from [`/browser`](/docs/libraries/cryptography/browser) in a page or worker. The names and signatures are identical, so only the import line differs.

## 2. Fingerprint the content

[`createHash`](/docs/libraries/cryptography/node#api-createHash) hashes the UTF-8 bytes of a string and resolves to lowercase hex:

```ts
import { createHash } from '@hyperfrontend/cryptography/node'

const fingerprint = await createHash('# Release notes\n\nFixed the thing.\n')
// '7440903b3ad49ee5d6f33b5c47785f197551686853e1a26cee97f0a294e8f6a0'
```

64 characters, because [SHA-256](https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/digest) is the default. Pass a [`HashAlgorithm`](/docs/libraries/cryptography/node#api-HashAlgorithm) as the second argument for `SHA-384` or `SHA-512` when something downstream demands a wider digest; the same string always produces the same digest, in either runtime, forever.

## 3. Let the fingerprint decide whether to do the work

Because identical content produces an identical id, the id is the cache key. Nothing needs a filename, a timestamp, or a version number:

```ts
async function render(source: string): Promise<string> {
  const key = await createHash(source)
  const cached = cache.get(key)
  if (cached) return cached

  const html = await expensiveRender(source)
  cache.set(key, html)
  return html
}
```

The same shape answers the two-sided version of the question: the browser fingerprints the file it is about to upload, the server answers whether it already holds that id, and the upload happens only on a miss. Both sides computed the id the same way, so a match is a match.

## 4. Check a fingerprint that arrived from outside

An id that came in over the wire or out of a database is a string until you say otherwise. [`isSHA256Hash`](/docs/libraries/cryptography/common#api-isSHA256Hash) accepts exactly 64 hex characters, which is enough to keep a malformed value from becoming a cache key or a filename:

```ts
import { isSHA256Hash } from '@hyperfrontend/cryptography/common'

if (!isSHA256Hash(claimed)) return badRequest('not a content id')
```

Shape is all it checks. A fingerprint says two pieces of content are the same, not that either of them is the one you expected: whoever can change the content can also send the id that matches it. When the comparison has to hold up against someone who wants it to lie, the two sides need a shared secret rather than a digest, which is what the [security model](/docs/core-concepts/security) is about.

## Check it worked

Fingerprint the same string twice and get the same 64 characters. Add a single trailing newline and the digest that comes back looks nothing like the first one. Fingerprint the same content in a browser tab and in a Node process and compare the two by eye: identical. Then run your cache twice over unchanged input and confirm the expensive path ran once.
