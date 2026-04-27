# common

Runtime-agnostic helpers that work identically in browser and Node.js without touching any platform crypto API.

## Overview

The `common` entry point is reserved for utilities that are pure functions over plain values and therefore have no need to be split per-runtime. Today it exposes a single SHA-256 hash-string validator. Algorithm implementations, key derivation, and the vault live in the platform-specific `/browser` and `/node` entry points because they require a `SubtleCrypto` and secure RNG.

## Usage

```typescript
import { isSHA256Hash } from '@hyperfrontend/cryptography/common'

isSHA256Hash('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855') // true
isSHA256Hash('not-a-hash') // false
```

Use this entry point in code that runs in both environments (shared types, isomorphic validators, framework-agnostic packages) to avoid pulling a platform adapter into the bundle.
