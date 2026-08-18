# How to base64 text that survives Unicode and URLs

You will encode any string, emoji and accents included, into base64 that round-trips exactly, and into a URL-safe form you can drop into a query parameter without escaping it again.

[`btoa`](https://developer.mozilla.org/en-US/docs/Web/API/Window/btoa) reads a string as Latin-1. Anything above `U+00FF` throws [`InvalidCharacterError`](https://developer.mozilla.org/en-US/docs/Web/API/DOMException#invalidcharactererror), and anything inside Latin-1 is worse: `btoa('café')` returns `'Y2Fm6Q=='`, which a UTF-8 decoder on the other end reads as `'caf�'`. The standard alphabet then adds its own problem, because `+` and `/` are characters a URL escapes behind your back. [`@hyperfrontend/string-utils`](/docs/libraries/utils/string) settles both, with one set of names that behaves identically in the browser and in Node.

## 1. Install it and import the side you run on

```bash
npm install @hyperfrontend/string-utils
```

Import from [`/browser`](/docs/libraries/utils/string/browser) in a page or worker, from [`/node`](/docs/libraries/utils/string/node) in a server or CLI. Both export the same names with the same signatures and produce byte-identical output, so code that has to run in both places changes only its import line.

## 2. Encode and decode text

[`toBase64`](/docs/libraries/utils/string#api-toBase64) encodes through [UTF-8](https://developer.mozilla.org/en-US/docs/Glossary/UTF-8) first, so every code point survives:

```ts
import { toBase64, fromBase64 } from '@hyperfrontend/string-utils/browser'

toBase64('café') // 'Y2Fmw6k='
toBase64('日本語テキスト') // '5pel5pys6Kqe44OG44Kt44K544OI'
toBase64('🐟 koi 🐟') // '8J+QnyBrb2kg8J+Qnw=='

fromBase64('8J+QnyBrb2kg8J+Qnw==') // '🐟 koi 🐟'
```

[`fromBase64`](/docs/libraries/utils/string#api-fromBase64) accepts either alphabet and repairs missing padding, so you can decode a value without knowing which form produced it.

## 3. Make it safe to put in a URL

Pass `true` as the second argument. `+` becomes `-`, `/` becomes `_`, and the trailing `=` is dropped:

```ts
const state = JSON.stringify({ q: 'koi fish', filters: ['size>3', 'colour=orange'], page: 2 })

toBase64(state)
// 'eyJxIjoia29pIGZpc2giLCJmaWx0ZXJzIjpbInNpemU+MyIsImNvbG91cj1vcmFuZ2UiXSwicGFnZSI6Mn0='

toBase64(state, true)
// 'eyJxIjoia29pIGZpc2giLCJmaWx0ZXJzIjpbInNpemU-MyIsImNvbG91cj1vcmFuZ2UiXSwicGFnZSI6Mn0'
```

The URL-safe form passes through [`encodeURIComponent`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/encodeURIComponent) and [`URLSearchParams`](https://developer.mozilla.org/en-US/docs/Web/API/URLSearchParams) untouched; the standard form comes back percent-escaped. Keep the padding with a third argument of `true` when a decoder downstream insists on a length that is a multiple of four.

## 4. Encode bytes rather than text

For a [`Uint8Array`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Uint8Array) you already hold, a ciphertext or a hash, go through the byte-level pair instead. [`uint8ArrayToBase64`](/docs/libraries/utils/string#api-uint8ArrayToBase64) takes the same two flags, and [`base64ToUint8Array`](/docs/libraries/utils/string#api-base64ToUint8Array) reads either alphabet back:

```ts
import { uint8ArrayToBase64, base64ToUint8Array } from '@hyperfrontend/string-utils/browser'

uint8ArrayToBase64(new Uint8Array([0, 1, 2, 250, 251, 255])) // 'AAEC+vv/'
base64ToUint8Array('AAEC+vv/') // Uint8Array(6) [0, 1, 2, 250, 251, 255]
```

[`utf8StringToUint8Array`](/docs/libraries/utils/string#api-utf8StringToUint8Array) and [`uint8ArrayToUtf8String`](/docs/libraries/utils/string#api-uint8ArrayToUtf8String) cross between the two worlds when a payload is text on one side of a boundary and bytes on the other.

## Check it worked

Round-trip a string carrying an emoji, an accent, and an embedded null through `toBase64` and `fromBase64`, and compare with `===`. Encode the same string with `btoa` and watch it throw. Then put the URL-safe form through `URLSearchParams` and read it back: the value that comes out is character for character the one you put in, and decoding it needs no unescaping step.
