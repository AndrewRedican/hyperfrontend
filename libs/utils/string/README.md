# @hyperfrontend/string-utils

<p align="center">
  <a href="https://github.com/AndrewRedican/hyperfrontend/actions/workflows/ci-lib-string-utils.yml">
    <img src="https://img.shields.io/github/actions/workflow/status/AndrewRedican/hyperfrontend/ci-lib-string-utils.yml?style=flat-square&logo=github&label=build" alt="Build">
  </a>
  <a href="https://codecov.io/gh/AndrewRedican/hyperfrontend/flags?flags%5B0%5D=string-utils">
    <img src="https://codecov.io/gh/AndrewRedican/hyperfrontend/graph/badge.svg?flag=string-utils" alt="Coverage">
  </a>
  <!-- ALL-CONTRIBUTORS-BADGE:START - Do not remove or modify this section -->
  <a href="#contributors">
    <img src="https://img.shields.io/github/all-contributors/AndrewRedican/hyperfrontend?color=ee8449&style=flat-square" alt="All Contributors">
  </a>
  <!-- ALL-CONTRIBUTORS-BADGE:END -->
  <a href="https://github.com/AndrewRedican/hyperfrontend/blob/main/LICENSE.md">
    <img src="https://img.shields.io/badge/license-MIT-blue?style=flat-square" alt="License">
  </a>
  <a href="https://www.npmjs.com/package/@hyperfrontend/string-utils">
    <img src="https://img.shields.io/npm/v/@hyperfrontend/string-utils?style=flat-square" alt="npm version">
  </a>
  <a href="https://www.npmjs.com/package/@hyperfrontend/string-utils">
    <img src="https://img.shields.io/npm/dm/@hyperfrontend/string-utils?style=flat-square" alt="npm downloads">
  </a>
  <a href="https://github.com/AndrewRedican/hyperfrontend">
    <img src="https://img.shields.io/github/stars/AndrewRedican/hyperfrontend?style=flat-square" alt="GitHub stars">
  </a>
</p>

Isomorphic string encoding utilities with unified APIs for browser and Node.js environments.

## What is @hyperfrontend/string-utils?

`@hyperfrontend/string-utils` provides a consistent, cross-platform API for encoding operations that typically differ between browser and Node.js environments. The library specializes in UTF-8 and base64 conversions, offering identical function signatures across platforms while optimizing each implementation for its native environment.

Rather than wrapping platform differences behind abstraction layers, the library exposes **platform-specific entry points** (`/browser` and `/node`) that deliver optimal performance by leveraging `TextEncoder`/`atob`/`btoa` in browsers and `Buffer` in Node.js. This design eliminates runtime environment detection overhead while ensuring tree-shaking efficiency.

### Key Features

- **Unified cross-platform API** - Identical function signatures for browser and Node.js with platform-optimized implementations
- **Zero dependencies** - Self-contained encoding operations with no external dependencies
- **URL-safe base64 support** - Built-in handling of URL-safe encoding with configurable padding removal
- **Binary data conversions** - Seamless transforms between UTF-8 strings, Uint8Arrays, ArrayBuffers, and base64
- **Security-hardened** - ReDoS-resistant implementations without regex-based string operations
- **TypeScript native** - Full type safety with comprehensive JSDoc documentation
- **Modular entry points** - Import only browser or Node.js implementations for optimal bundle sizes

### Architecture Highlights

The library maintains separate browser and Node.js implementations that share identical APIs but optimize for platform-specific capabilities. Browser implementations use `TextEncoder`/`TextDecoder` and `atob`/`btoa`, while Node.js implementations leverage `Buffer` operations. This dual-implementation strategy avoids runtime checks and polyfills, resulting in smaller bundles and better performance.

## Why Use @hyperfrontend/string-utils?

### 1. Eliminates Cross-Platform Encoding Complexity

String encoding operations differ significantly between browsers and Node.js. Browser APIs like `btoa()` don't handle UTF-8 correctly, and Node.js lacks native base64-to-Uint8Array converters. This library provides consistent APIs that "just work" across platforms while handling edge cases like multi-byte UTF-8 characters and binary string conversions.

**Example pain point solved:** `btoa('こんにちは')` throws in browsers because it expects Latin-1 encoding, but `toBase64('こんにちは')` correctly handles UTF-8 encoding in both environments.

### 2. Required Foundation for @hyperfrontend/cryptography

All cryptographic operations in `@hyperfrontend/cryptography` depend on these encoding utilities for converting between text strings and binary data. The library provides the UTF-8 ↔ Uint8Array conversions essential for encryption/decryption workflows, ensuring consistent encoding behavior across Web Crypto API (browser) and Node.js crypto implementations.

### 3. URL-Safe Base64 Without Manual Character Replacement

Many APIs (JWTs, URL query parameters, cloud storage identifiers) require URL-safe base64 encoding where `+` becomes `-` and `/` becomes `_`, with padding characters optionally removed. This library handles these transformations automatically with simple boolean flags, eliminating error-prone manual string replacements.

### 4. Security-Conscious Implementation

String manipulation with regular expressions can expose applications to ReDoS (Regular Expression Denial of Service) attacks. This library explicitly avoids regex operations for padding removal and character replacements, using loop-based approaches that guarantee linear time complexity regardless of input patterns.

### 5. Optimal Tree-Shaking Through Modular Exports

By exposing separate `/browser` and `/node` entry points rather than auto-detecting environments at runtime, the library enables bundlers to eliminate unused code automatically. Frontend builds only include browser implementations, and backend builds only include Node.js implementations—no dead code, no runtime checks.

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

All functions are available from both `/browser` and `/node` entry points with identical signatures:

- **`toBase64(text, urlSafe?, keepPadding?)`** - Encode UTF-8 string to base64
- **`fromBase64(base64)`** - Decode base64 string to UTF-8 (supports standard and URL-safe)
- **`utf8StringToUint8Array(text)`** - Convert UTF-8 string to Uint8Array
- **`uint8ArrayToUtf8String(bytes)`** - Convert Uint8Array to UTF-8 string
- **`arrayBufferToUtf8String(buffer)`** - Convert ArrayBuffer to UTF-8 string
- **`uint8ArrayToBase64(bytes, urlSafe?, keepPadding?)`** - Encode Uint8Array to base64
- **`base64ToUint8Array(base64)`** - Decode base64 string to Uint8Array

Internal utilities (exported but typically not needed):

- **`bytesToBinaryString(bytes)`** - Uint8Array to Latin-1 binary string (for browser btoa interop)
- **`binaryStringToBytes(binaryStr)`** - Latin-1 binary string to Uint8Array (for browser atob interop)
- **`base64ToUrlSafeBase64(base64, options)`** - Transform standard base64 to URL-safe format
- **`urlSafeBase64ToBase64(urlSafeBase64)`** - Transform URL-safe base64 to standard format

## Part of hyperfrontend

This library is part of the [hyperfrontend](https://github.com/AndrewRedican/hyperfrontend) monorepo.

- Used by [@hyperfrontend/cryptography](https://github.com/AndrewRedican/hyperfrontend/tree/main/libs/cryptography) for UTF-8/binary conversions

## License

MIT
