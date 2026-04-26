# Node Module

Node.js-optimized implementations of the `@hyperfrontend/string-utils` encoding API, built directly on `Buffer`.

## Overview

This entry point exposes the same UTF-8 and base64 helpers as the browser submodule, but defers all encoding work to `Buffer.from(...)` and `buffer.toString(...)`. Routing through `Buffer` avoids the binary-string round-trips that browsers need (`TextEncoder` → `btoa` → `atob` → `TextDecoder`) and produces fewer intermediate allocations on the server.

URL-safe base64 transformation is shared with the browser submodule and uses loop-based character substitution rather than regex, keeping behavior linear in input length.

## Usage

```typescript
import { toBase64, fromBase64, utf8StringToUint8Array, base64ToUint8Array } from '@hyperfrontend/string-utils/node'

// UTF-8 safe base64
toBase64('こんにちは') // => '44GT44KT44Gr44Gh44Gv'

// URL-safe base64 without padding (suitable for JWT-style payloads)
toBase64('{"userId":123}', true, false) // => 'eyJ1c2VySWQiOjEyM30'

// Round-trip through bytes for crypto workflows
const bytes = utf8StringToUint8Array('Hello')
const sameBytes = base64ToUint8Array(toBase64('Hello'))
```

Use this entry point in Node.js processes (and any runtime that ships a `Buffer` global). Browser, Web Worker, and edge-runtime consumers should import from `@hyperfrontend/string-utils/browser` so bundlers can drop the `Buffer` paths entirely.
