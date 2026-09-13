# @hyperfrontend/string-utils

<p align="center">
  <a href="https://github.com/AndrewRedican/hyperfrontend/actions/workflows/ci-lib-string-utils.yml">
    <img src="https://img.shields.io/github/actions/workflow/status/AndrewRedican/hyperfrontend/ci-lib-string-utils.yml?style=flat-square&logo=github&label=build" alt="Build">
  </a>
  <a href="https://codecov.io/gh/AndrewRedican/hyperfrontend/flags?flags%5B0%5D=string-utils">
    <img src="https://codecov.io/gh/AndrewRedican/hyperfrontend/graph/badge.svg?flag=string-utils" alt="Coverage">
  </a>
  <a href="https://www.npmjs.com/package/@hyperfrontend/string-utils">
    <img src="https://img.shields.io/npm/v/@hyperfrontend/string-utils?style=flat-square" alt="npm version">
  </a>
  <a href="https://bundlephobia.com/package/@hyperfrontend/string-utils">
    <img src="https://img.shields.io/bundlephobia/min/%40hyperfrontend%2Fstring-utils?style=flat-square" alt="npm bundle size">
  </a>
</p>
<p align="center">
  <!-- ALL-CONTRIBUTORS-BADGE:START - Do not remove or modify this section -->
  <a href="#contributors">
    <img src="https://img.shields.io/github/all-contributors/AndrewRedican/hyperfrontend?color=ee8449&style=flat-square" alt="All Contributors">
  </a>
  <!-- ALL-CONTRIBUTORS-BADGE:END -->
  <a href="https://github.com/AndrewRedican/hyperfrontend/blob/main/LICENSE.md">
    <img src="https://img.shields.io/badge/license-MIT-blue?style=flat-square" alt="License">
  </a>
  <a href="https://www.npmjs.com/package/@hyperfrontend/string-utils">
    <img src="https://img.shields.io/npm/dm/@hyperfrontend/string-utils?style=flat-square" alt="npm downloads">
  </a>
  <a href="https://github.com/AndrewRedican/hyperfrontend">
    <img src="https://img.shields.io/github/stars/AndrewRedican/hyperfrontend?style=flat-square" alt="GitHub stars">
  </a>
  <img src="https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen?style=flat-square&logo=node.js" alt="Node Version">
  <img src="https://img.shields.io/badge/tree%20shakeable-%E2%9C%93-success?style=flat-square" alt="Tree Shakeable">
</p>

<!-- hf:media start id="banner" scene="banner-string-utils" asset="banner" alt="@hyperfrontend/string-utils" -->
<!-- hf:media end -->

<p align="center">
  <a href="https://www.hyperfrontend.dev/docs/libraries/utils/string/">
    <img width="640" height="360" src="https://www.hyperfrontend.dev/media/string-utils-base64/hero.gif" alt="The word café as four character tiles; each drops its UTF-8 bytes beneath it, é dropping two; the bytes regroup in threes and rise into the eight Base64 tiles Y2Fmw6k=; then btoa's reading collapses é into a single wrong byte and a struck-through wrong tail 6Q== appears under the correct row; finally fromBase64 folds everything back into café">
  </a>
</p>
<p align="center">
  <sub>One value crossing representations: text, its UTF-8 bytes, Base64, and back. The struck-through tail is the dangerous one: btoa read é as one byte, nothing threw, so nothing was caught.</sub>
</p>

Isomorphic string encoding utilities with unified APIs for browser and Node.js environments.

• 👉 See [**documentation**](https://www.hyperfrontend.dev/docs/libraries/utils/string/)
• 👉 See [**guides & tutorials**](https://www.hyperfrontend.dev/docs/guides/?package=%40hyperfrontend%2Fstring-utils)

## What is @hyperfrontend/string-utils?

[`@hyperfrontend/string-utils`](https://www.hyperfrontend.dev/docs/libraries/utils/string/) provides a consistent, cross-platform API for encoding operations that typically differ between browser and Node.js environments. The library specializes in UTF-8 and base64 conversions, offering identical function signatures across platforms while optimizing each implementation for its native environment.

Rather than wrapping platform differences behind abstraction layers, the library exposes **platform-specific entry points** ([`/browser`](https://www.hyperfrontend.dev/docs/libraries/utils/string/browser/) and [`/node`](https://www.hyperfrontend.dev/docs/libraries/utils/string/node/)) that deliver optimal performance by leveraging `TextEncoder`/`atob`/`btoa` in browsers and `Buffer` in Node.js. This design eliminates runtime environment detection overhead while ensuring tree-shaking efficiency.

### Key Features

- **Unified cross-platform API** - Identical function signatures for browser and Node.js with platform-optimized implementations
- **Zero dependencies** - Self-contained encoding operations with no external dependencies
- **[URL-safe base64 support](https://www.hyperfrontend.dev/docs/guides/base64-for-unicode-and-urls/)** - Built-in handling of URL-safe encoding with configurable padding removal
- **[Binary data conversions](https://www.hyperfrontend.dev/docs/libraries/utils/string/#api-utf8StringToUint8Array)** - Seamless transforms between UTF-8 strings, Uint8Arrays, ArrayBuffers, and base64
- **Security-hardened** - ReDoS-resistant implementations without regex-based string operations
- **TypeScript native** - Full type safety with comprehensive JSDoc documentation
- **[Modular entry points](https://www.hyperfrontend.dev/docs/libraries/utils/string/browser/)** - Import only browser or Node.js implementations for optimal bundle sizes

## Why Use @hyperfrontend/string-utils?

### 1. Eliminates Cross-Platform Encoding Complexity

String encoding operations differ significantly between browsers and Node.js. Browser APIs like `btoa()` don't handle UTF-8 correctly, and Node.js lacks native base64-to-Uint8Array converters. This library provides consistent APIs that "just work" across platforms while handling edge cases like multi-byte UTF-8 characters and binary string conversions.

**Example pain point solved:** `btoa('こんにちは')` throws in browsers because it expects Latin-1 encoding, but `toBase64('こんにちは')` correctly handles UTF-8 encoding in both environments.

### 2. Required Foundation for @hyperfrontend/cryptography

All cryptographic operations in [`@hyperfrontend/cryptography`](https://www.hyperfrontend.dev/docs/libraries/cryptography/) depend on these encoding utilities for converting between text strings and binary data. The library provides the UTF-8 ↔ Uint8Array conversions essential for encryption/decryption workflows, ensuring consistent encoding behavior across Web Crypto API (browser) and Node.js crypto implementations.

### 3. URL-Safe Base64 Without Manual Character Replacement

Many APIs (JWTs, URL query parameters, cloud storage identifiers) require URL-safe base64 encoding where `+` becomes `-` and `/` becomes `_`, with padding characters optionally removed. This library handles these transformations automatically with simple boolean flags, eliminating error-prone manual string replacements.

### 4. Security-Conscious Implementation

String manipulation with regular expressions can expose applications to ReDoS (Regular Expression Denial of Service) attacks. This library explicitly avoids regex operations for padding removal and character replacements, using loop-based approaches that guarantee linear time complexity regardless of input patterns.

### 5. Optimal Tree-Shaking Through Modular Exports

By exposing separate [`/browser`](https://www.hyperfrontend.dev/docs/libraries/utils/string/browser/) and [`/node`](https://www.hyperfrontend.dev/docs/libraries/utils/string/node/) entry points rather than auto-detecting environments at runtime, the library enables bundlers to eliminate unused code automatically. Frontend builds only include browser implementations, and backend builds only include Node.js implementations: no dead code, no runtime checks.

## Installation

```bash
npm install @hyperfrontend/string-utils
```

## Quick Start

**Browser usage:**

```typescript
import { toBase64, fromBase64, utf8StringToUint8Array } from '@hyperfrontend/string-utils/browser'

// Standard base64 encoding
const encoded = toBase64('Hello, World!')
console.log(encoded) // 'SGVsbG8sIFdvcmxkIQ=='

// URL-safe base64 without padding
const urlSafe = toBase64('Hello, World!', true, false)
console.log(urlSafe) // 'SGVsbG8sIFdvcmxkIQ' (no padding)

// Decoding (handles both standard and URL-safe)
const decoded = fromBase64(urlSafe)
console.log(decoded) // 'Hello, World!'

// UTF-8 to binary for crypto operations
const bytes = utf8StringToUint8Array('こんにちは')
console.log(bytes) // Uint8Array[227, 129, 147, ...]
```

**Node.js usage:**

```typescript
import { toBase64, fromBase64, utf8StringToUint8Array } from '@hyperfrontend/string-utils/node'

// Identical API, optimized Node.js implementation
const encoded = toBase64('Hello, World!')
const bytes = utf8StringToUint8Array('こんにちは')
```

## API Overview

One API surface, two ways in. [`@hyperfrontend/string-utils/browser`](https://www.hyperfrontend.dev/docs/libraries/utils/string/browser/) and [`@hyperfrontend/string-utils/node`](https://www.hyperfrontend.dev/docs/libraries/utils/string/node/) export the same seven functions under the same names, with
the same signatures, producing byte-identical output; which one you import is a question about where your code runs, not about what you need. The split is there so that
`TextEncoder`/`btoa` stays on one side and `Buffer` on the other: a bundler ships exactly one implementation and nothing has to sniff the environment at runtime. The
identifiers below link to the browser entry point, and the node page documents the same seven.

Two of them cover most uses. [`toBase64`](https://www.hyperfrontend.dev/docs/libraries/utils/string/browser/#api-toBase64) takes a UTF-8 string and returns base64;
[`fromBase64`](https://www.hyperfrontend.dev/docs/libraries/utils/string/browser/#api-fromBase64) takes base64 back to a string, accepting standard and URL-safe spellings
without being told which. The options live on the encoding side, as `toBase64(text, urlSafe = false, keepPadding = false)`: [`urlSafe`](https://www.hyperfrontend.dev/docs/libraries/utils/string/#api-toBase64) maps `+` to `-` and `/` to `_`, and
[`keepPadding`](https://www.hyperfrontend.dev/docs/libraries/utils/string/#api-toBase64) is read only inside that branch, so standard base64 always keeps its `=`. This pair is why the package exists at all: `btoa` is a Latin-1 API and [`toBase64`](https://www.hyperfrontend.dev/docs/libraries/utils/string/#api-toBase64)
encodes UTF-8 first, so `'café'` round-trips instead of returning `Y2Fm6Q==`.

The other five are for when the payload is bytes rather than text. [`utf8StringToUint8Array`](https://www.hyperfrontend.dev/docs/libraries/utils/string/browser/#api-utf8StringToUint8Array)
and [`uint8ArrayToUtf8String`](https://www.hyperfrontend.dev/docs/libraries/utils/string/#api-uint8ArrayToUtf8String) are the text-to-bytes pair that [`@hyperfrontend/cryptography`](https://www.hyperfrontend.dev/docs/libraries/cryptography/) is built on;
[`uint8ArrayToBase64`](https://www.hyperfrontend.dev/docs/libraries/utils/string/browser/#api-uint8ArrayToBase64) and
[`base64ToUint8Array`](https://www.hyperfrontend.dev/docs/libraries/utils/string/browser/#api-base64ToUint8Array) are the same base64 hop with a `Uint8Array` on the near
side, the encoder taking the same two flags; and [`arrayBufferToUtf8String`](https://www.hyperfrontend.dev/docs/libraries/utils/string/browser/#api-arrayBufferToUtf8String) decodes
what a `fetch` response or a `FileReader` hands you. All of them are plain synchronous calls: a value in, a value out, no options object and no state.

Every signature, parameter and default is in the API reference for
[browser](https://www.hyperfrontend.dev/docs/libraries/utils/string/browser/#api-reference) and for
[node](https://www.hyperfrontend.dev/docs/libraries/utils/string/node/#api-reference).

## Compatibility

<!-- hf:media start id="runtimes" scene="runtimes-string-utils" asset="runtimes" docs="#compatibility" alt="Runs in Node.js 18 or later, evergreen browsers and web workers" -->

| Environment     | Supported |
| --------------- | :-------: |
| Node.js >= 18   |    ✅     |
| Modern Browsers |    ✅     |
| Web Workers     |    ✅     |

<!-- hf:media end -->

### Output Formats

| Format | File                       | Tree-Shakeable |
| ------ | -------------------------- | :------------: |
| ESM    | `index.esm.js`             |       ✅       |
| CJS    | `index.cjs.js`             |       ❌       |
| IIFE   | `bundle/index.iife.min.js` |       ❌       |
| UMD    | `bundle/index.umd.min.js`  |       ❌       |

### CDN Usage

```html
<!-- unpkg -->
<script src="https://unpkg.com/@hyperfrontend/string-utils"></script>

<!-- jsDelivr -->
<script src="https://cdn.jsdelivr.net/npm/@hyperfrontend/string-utils"></script>

<script>
  const { utf8StringToUint8Array, uint8ArrayToBase64 } = HyperfrontendStringUtils
</script>
```

**Global variable:** [`HyperfrontendStringUtils`](https://www.hyperfrontend.dev/docs/libraries/utils/string/browser/)

### Dependencies

None: zero external dependencies.

## Part of hyperfrontend

This library is part of the [hyperfrontend](https://github.com/AndrewRedican/hyperfrontend) monorepo.

**📖 [Full documentation](https://www.hyperfrontend.dev/docs/libraries/utils/string)**

- Used by [@hyperfrontend/cryptography](https://github.com/AndrewRedican/hyperfrontend/tree/main/libs/cryptography) for UTF-8/binary conversions

## License

[MIT](https://github.com/AndrewRedican/hyperfrontend/blob/main/LICENSE.md)
