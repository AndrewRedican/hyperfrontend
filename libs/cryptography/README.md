# @hyperfrontend/cryptography

<p align="center">
  <a href="https://github.com/AndrewRedican/hyperfrontend/actions/workflows/ci-lib-cryptography.yml">
    <img src="https://img.shields.io/github/actions/workflow/status/AndrewRedican/hyperfrontend/ci-lib-cryptography.yml?style=flat-square&logo=github&label=build" alt="Build">
  </a>
  <a href="https://codecov.io/gh/AndrewRedican/hyperfrontend/flags?flags%5B0%5D=cryptography">
    <img src="https://codecov.io/gh/AndrewRedican/hyperfrontend/graph/badge.svg?flag=cryptography" alt="Coverage">
  </a>
  <a href="https://www.npmjs.com/package/@hyperfrontend/cryptography">
    <img src="https://img.shields.io/npm/v/@hyperfrontend/cryptography?style=flat-square" alt="npm version">
  </a>
  <a href="https://bundlephobia.com/package/@hyperfrontend/cryptography">
    <img src="https://img.shields.io/bundlephobia/min/%40hyperfrontend%2Fcryptography?style=flat-square" alt="npm bundle size">
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
  <a href="https://www.npmjs.com/package/@hyperfrontend/cryptography">
    <img src="https://img.shields.io/npm/dm/@hyperfrontend/cryptography?style=flat-square" alt="npm downloads">
  </a>
  <a href="https://github.com/AndrewRedican/hyperfrontend">
    <img src="https://img.shields.io/github/stars/AndrewRedican/hyperfrontend?style=flat-square" alt="GitHub stars">
  </a>
  <img src="https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen?style=flat-square&logo=node.js" alt="Node Version">
  <img src="https://img.shields.io/badge/tree%20shakeable-%E2%9C%93-success?style=flat-square" alt="Tree Shakeable">
</p>

<!-- hf:media start id="banner" scene="banner-cryptography" asset="banner" alt="@hyperfrontend/cryptography" -->
<!-- hf:media end -->

<p align="center">
  <a href="https://www.hyperfrontend.dev/docs/libraries/cryptography/">
    <img width="640" height="360" src="https://www.hyperfrontend.dev/media/cryptography-envelope/hero.gif" alt="The secret sk_live_9f2c41 sealed into an envelope: random salt and IV blocks grow beside it, its characters scramble into ciphertext, a tag and a padlock close it; the same secret sealed a second time comes out different everywhere; the right key opens the first envelope back to the secret and a wrong key leaves the second one shut with a cross on its lock">
  </a>
</p>

Production-grade cryptographic primitives with isomorphic APIs for browser and Node.js environments.

• 👉 See [**documentation**](https://www.hyperfrontend.dev/docs/libraries/cryptography/)
• 👉 See [**guides & tutorials**](https://www.hyperfrontend.dev/docs/guides/?package=%40hyperfrontend%2Fcryptography)

## What is @hyperfrontend/cryptography?

@hyperfrontend/cryptography provides a comprehensive suite of cryptographic utilities designed for secure data handling in full-stack JavaScript applications. The library implements industry-standard encryption (AES-GCM), key derivation (PBKDF2), and hashing (SHA-256) with identical APIs across browser and Node.js environments, eliminating platform-specific code branching.

The library features three modular entry points: platform-specific implementations ([`/browser`](https://www.hyperfrontend.dev/docs/libraries/cryptography/browser/), [`/node`](https://www.hyperfrontend.dev/docs/libraries/cryptography/node/)) for optimized runtime performance, and a shared entry point ([`/common`](https://www.hyperfrontend.dev/docs/libraries/cryptography/common/)) for platform-agnostic utilities. Core capabilities include secure password-based encryption/decryption, cryptographic vault storage with single-use modes, time-based password generation for rotating credentials, and cryptographically-secure random value generation.

### Key Features

- **Isomorphic API Design** - Write once, run everywhere with identical function signatures for browser Web Crypto API and Node.js crypto module
- **[AES-GCM Encryption](https://www.hyperfrontend.dev/docs/libraries/cryptography/#api-encrypt)** - Industry-standard authenticated encryption with password-derived keys using PBKDF2 (100,000 iterations)
- **[Session Key Agreement](https://www.hyperfrontend.dev/docs/libraries/cryptography/#api-createKeyAgreement)** - Ephemeral P-256 ECDH, HKDF key expansion with usage-restricted keys, and raw AEAD sealing for many messages under one agreed key
- **[Secure Vault Storage](https://www.hyperfrontend.dev/docs/libraries/cryptography/#api-createVault)** - Password-protected in-memory storage with optional single-use mode for sensitive data
- **[Time-Based Passwords](https://www.hyperfrontend.dev/docs/libraries/cryptography/#api-getTimeBasedPassword)** - Generate rotating credentials synchronized to UTC time windows for short-lived authentication
- **[Cryptographic Hashing](https://www.hyperfrontend.dev/docs/libraries/cryptography/#api-createHash)** - SHA-256 hash generation with hexadecimal output and validation utilities
- **Zero External Dependencies** - Self-contained implementation using only platform crypto APIs
- **Functional Architecture** - Pure functions with dependency injection for testability and composability
- **Secondary Entry Points** - Tree-shakeable imports optimize bundle size ([`/browser`](https://www.hyperfrontend.dev/docs/libraries/cryptography/browser/), [`/node`](https://www.hyperfrontend.dev/docs/libraries/cryptography/node/), [`/common`](https://www.hyperfrontend.dev/docs/libraries/cryptography/common/))

### Architecture Highlights

[`encrypt`](https://www.hyperfrontend.dev/docs/libraries/cryptography/#api-encrypt) generates a unique salt and initialization vector per operation, so a secret at rest never reuses a key, and the same plaintext encrypted twice produces two different ciphertexts. The session primitives ([`createKeyAgreement`](https://www.hyperfrontend.dev/docs/libraries/cryptography/#api-createKeyAgreement), [`expandKey`](https://www.hyperfrontend.dev/docs/libraries/cryptography/#api-expandKey), [`seal`](https://www.hyperfrontend.dev/docs/libraries/cryptography/#api-seal), [`open`](https://www.hyperfrontend.dev/docs/libraries/cryptography/#api-open)) hand the key and nonce lifecycle to the caller instead, which is what a message stream needs.

## Why Use @hyperfrontend/cryptography?

### Eliminate Platform Branching in Isomorphic Applications

Full-stack applications typically require separate cryptography implementations for browser and server environments, leading to code duplication and testing complexity. This library provides identical APIs powered by platform-optimized implementations, allowing shared business logic for encryption workflows across your entire stack. Import from [`/browser`](https://www.hyperfrontend.dev/docs/libraries/cryptography/browser/) or [`/node`](https://www.hyperfrontend.dev/docs/libraries/cryptography/node/) based on your runtime - the function signatures remain identical.

### Production-Hardened Encryption Without Configuration Complexity

Implementing secure encryption requires careful selection of algorithms, key derivation parameters, and IV/salt generation strategies. This library encapsulates cryptographic best practices (PBKDF2 with 100,000 iterations, unique salt/IV per operation, AES-GCM authenticated encryption) in simple `encrypt(message, password)` and `decrypt(encrypted, password)` functions. No configuration decisions, no security footguns - just production-grade encryption out of the box.

### Secure Credential Rotation with Time-Based Passwords

APIs requiring short-lived credentials (temporary links, time-boxed access tokens) need synchronized password generation across systems. The `getTimeBasedPasswords()` function generates cryptographically-secure passwords based on UTC time windows, enabling coordinated credential rotation without database round-trips. Generate passwords for current/previous/next windows to handle clock drift gracefully.

### In-Memory Vaults for Sensitive Data Handling

Processing sensitive data (credit cards, API keys, personal information) in memory creates exposure risks during debugging and logging. The `createVault()` API provides encrypted storage with password protection - data is encrypted at rest in memory and requires the vault password for retrieval. Single-use mode automatically closes the vault after first read, preventing accidental data leakage in long-lived processes.

### Dependency-Free Security for Minimal Attack Surface

Third-party cryptography libraries introduce supply chain risks and dependency bloat. This package uses only platform-native crypto APIs (Web Crypto API, Node.js crypto module) plus lightweight internal utilities, eliminating external dependencies. Smaller dependency trees mean fewer audit requirements and reduced attack surface for security-critical applications.

## Installation

```bash
npm install @hyperfrontend/cryptography
```

## Requirements

- **Node.js:** 18.0.0 or higher (19+ recommended for stable Web Crypto API support)
- **npm:** 8.0.0 or higher
- **Browser:** Modern browsers with Web Crypto API support

> **Note:** The [`/node`](https://www.hyperfrontend.dev/docs/libraries/cryptography/node/) entry point uses `webcrypto.subtle` which was experimental in Node.js 18.x. For production use with the Node.js entry point, Node.js 19+ is recommended for stable crypto APIs.

## Quick Start

### Browser Environment

```typescript
import { encrypt, decrypt, createVault, createHash } from '@hyperfrontend/cryptography/browser'

// Encrypt/decrypt data with password
const message = 'Sensitive data'
const password = 'secure-password'
const encrypted = await encrypt(message, password)
const decrypted = await decrypt(encrypted, password)

// Create encrypted in-memory storage
const vault = createVault()
await vault.write('api-key', 'sk-1234567890')
const password = vault.getPassword() // Share password securely
const value = await vault.read('api-key', password) // Returns 'sk-1234567890'

// Generate SHA-256 hash
const hash = await createHash('data-to-hash') // Returns hex string
```

### Node.js Environment

```typescript
import { encrypt, decrypt, createVault, getTimeBasedPasswords } from '@hyperfrontend/cryptography/node'

// Same encryption API as browser
const encrypted = await encrypt('Sensitive data', 'secure-password')
const decrypted = await decrypt(encrypted, 'secure-password')

// Time-based rotating passwords; the window is counted in minutes, so this is a 5-minute window
const generators = getTimeBasedPasswords(new Date(), 5)
const currentPassword = await generators.current()
const previousPassword = await generators.previous() // Handle clock drift
```

### Platform-Agnostic Utilities

```typescript
import { isSHA256Hash } from '@hyperfrontend/cryptography/common'

// Validate hash format (works in browser and Node.js)
isSHA256Hash('abc123') // false - too short
isSHA256Hash('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855') // true
```

## API Overview

Two layers, not nineteen functions, and choosing between them is most of the work. The password layer is one call: [`encrypt`](https://www.hyperfrontend.dev/docs/libraries/cryptography/browser/#api-encrypt) takes a message and a password and returns a `Uint8Array` already carrying a fresh salt and initialization vector alongside the ciphertext and its tag, and [`decrypt`](https://www.hyperfrontend.dev/docs/libraries/cryptography/browser/#api-decrypt) takes that buffer and the same password back to the original string. Key derivation and nonce choice are never yours to get right, and because the salt and IV are new every call, encrypting one secret twice yields two unrelated buffers. [`createVault`](https://www.hyperfrontend.dev/docs/libraries/cryptography/browser/#api-createVault) is that same layer with a lifetime attached, holding labelled values encrypted in memory behind a password it generates, optionally closing after the first read.

The session layer inverts the trade: it hands you the key and the nonce rather than managing them, which is what a stream of messages needs and a lone secret does not. [`createKeyAgreement`](https://www.hyperfrontend.dev/docs/libraries/cryptography/browser/#api-createKeyAgreement) gives each side an ephemeral P-256 keypair whose private half is non-extractable, and its [`deriveSecret`](https://www.hyperfrontend.dev/docs/libraries/cryptography/#api-KeyAgreement) turns the peer's public point into the 32 bytes both sides share; [`stretchPassword`](https://www.hyperfrontend.dev/docs/libraries/cryptography/#api-stretchPassword) is the alternative start when the shared thing is a password rather than a handshake. [`expandKey`](https://www.hyperfrontend.dev/docs/libraries/cryptography/browser/#api-expandKey) splits that secret into per-purpose AES-GCM-256 keys, each restricted to encrypting or to decrypting but not both.

[`seal`](https://www.hyperfrontend.dev/docs/libraries/cryptography/browser/#api-seal) and [`open`](https://www.hyperfrontend.dev/docs/libraries/cryptography/#api-open) then carry individual messages under those keys, taking a 12-byte nonce and an additional-data buffer that is authenticated but not encrypted, so a header can be bound to a payload without being hidden. That control costs you one rule: a nonce must never repeat under a given key, which a per-message counter scoped to a per-session key satisfies by construction. This is the layer [@hyperfrontend/network-protocol](https://www.hyperfrontend.dev/docs/libraries/network-protocol/) builds its envelope on.

Beside both sit the small utilities: SHA-256 hashing with its format guard, raw random bytes, and [`getTimeBasedPasswords`](https://www.hyperfrontend.dev/docs/libraries/cryptography/browser/#api-getTimeBasedPasswords), which derives the same rotating credential on two machines from the clock alone and returns [`current`](https://www.hyperfrontend.dev/docs/libraries/cryptography/#api-TimeBasedPasswordGenerators-prop-current), [`previous`](https://www.hyperfrontend.dev/docs/libraries/cryptography/#api-TimeBasedPasswordGenerators-prop-previous) and [`next`](https://www.hyperfrontend.dev/docs/libraries/cryptography/#api-TimeBasedPasswordGenerators-prop-next) so a receiver tolerates a peer one window out of step; that window is counted in minutes, not milliseconds. As for which entry point to import, [`/browser`](https://www.hyperfrontend.dev/docs/libraries/cryptography/browser/) is backed by the Web Crypto API and [`/node`](https://www.hyperfrontend.dev/docs/libraries/cryptography/node/) by the Node.js `crypto` module, exporting the same names with the same signatures, so the choice is only about the runtime; [`/common`](https://www.hyperfrontend.dev/docs/libraries/cryptography/common/) is the narrow shared slice, currently just [`isSHA256Hash`](https://www.hyperfrontend.dev/docs/libraries/cryptography/#api-isSHA256Hash).

Every signature, option type and thrown error is in the [API reference](https://www.hyperfrontend.dev/docs/libraries/cryptography/#api-reference).

## Compatibility

<!-- hf:media start id="runtimes" scene="runtimes-cryptography" asset="runtimes" docs="#compatibility" alt="Runs in Node.js 18 or later, evergreen browsers and web workers" -->

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
<script src="https://unpkg.com/@hyperfrontend/cryptography"></script>

<!-- jsDelivr -->
<script src="https://cdn.jsdelivr.net/npm/@hyperfrontend/cryptography"></script>

<script>
  const { createHash, encrypt, decrypt } = HyperfrontendCryptography
</script>
```

**Global variable:** [`HyperfrontendCryptography`](https://www.hyperfrontend.dev/docs/libraries/cryptography/browser/)

## Part of hyperfrontend

This library is part of the [hyperfrontend](https://github.com/AndrewRedican/hyperfrontend) monorepo.

**📖 [Full documentation](https://www.hyperfrontend.dev/docs/libraries/cryptography)**

- Used by [@hyperfrontend/network-protocol](https://github.com/AndrewRedican/hyperfrontend/tree/main/libs/network-protocol) for secure message encryption
- Looking for cross-window messaging with built-in encryption? See [@hyperfrontend/nexus](https://github.com/AndrewRedican/hyperfrontend/tree/main/libs/nexus)

## License

[MIT](https://github.com/AndrewRedican/hyperfrontend/blob/main/LICENSE.md)
