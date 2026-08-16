# Browser Module

Browser-optimized implementations of the `@hyperfrontend/string-utils` encoding API, built on `TextEncoder` / `TextDecoder` and `atob` / `btoa`.

## Overview

This entry point delivers the same UTF-8 and base64 helpers as the Node submodule, but routes them through the platform's native Web APIs. Multi-byte UTF-8 input is encoded with `TextEncoder` before being handed to `btoa`, sidestepping the Latin-1 limitation that would otherwise make `btoa('こんにちは')` throw. Decoding mirrors the path: `atob` produces a binary string, which is converted to a `Uint8Array` and then decoded with `TextDecoder`.

The built-in references (`btoa`, `atob`, `TextEncoder`, `TextDecoder`) are pulled from `@hyperfrontend/immutable-api-utils` so consumers cannot break the library by overwriting globals.

## Usage

```typescript
import { toBase64, fromBase64, utf8StringToUint8Array, uint8ArrayToBase64 } from '@hyperfrontend/string-utils/browser'

// UTF-8 safe base64 (works for any code point)
toBase64('こんにちは') // => '44GT44KT44Gr44Gh44Gv'

// URL-safe base64 without padding (suitable for tokens / query strings)
toBase64('{"userId":123}', true, false) // => 'eyJ1c2VySWQiOjEyM30'

// Round-trip through bytes for crypto workflows
const bytes = utf8StringToUint8Array('Hello')
const restored = fromBase64(uint8ArrayToBase64(bytes))
```

Use this entry point in browsers, Web Workers, Deno, Bun, and Cloudflare Workers: anywhere the Web Encoding APIs are available. For Node.js processes, import from `@hyperfrontend/string-utils/node` instead so the `Buffer`-based implementations are picked up by the bundler.
