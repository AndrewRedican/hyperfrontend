# @hyperfrontend/cryptography

<p align="center">
  <a href="https://github.com/AndrewRedican/hyperfrontend/actions/workflows/ci-lib-cryptography.yml">
    <img src="https://img.shields.io/github/actions/workflow/status/AndrewRedican/hyperfrontend/ci-lib-cryptography.yml?style=flat-square&logo=github&label=build" alt="Build">
  </a>
  <a href="https://codecov.io/gh/AndrewRedican/hyperfrontend/flags?flags%5B0%5D=cryptography">
    <img src="https://codecov.io/gh/AndrewRedican/hyperfrontend/graph/badge.svg?flag=cryptography" alt="Coverage">
  </a>
  <!-- ALL-CONTRIBUTORS-BADGE:START - Do not remove or modify this section -->
  <a href="#contributors">
    <img src="https://img.shields.io/github/all-contributors/AndrewRedican/hyperfrontend?color=ee8449&style=flat-square" alt="All Contributors">
  </a>
  <!-- ALL-CONTRIBUTORS-BADGE:END -->
  <a href="https://github.com/AndrewRedican/hyperfrontend/blob/main/LICENSE.md">
    <img src="https://img.shields.io/badge/license-MIT-blue?style=flat-square" alt="License">
  </a>
  <a href="https://www.npmjs.com/package/@hyperfrontend/cryptography">
    <img src="https://img.shields.io/npm/v/@hyperfrontend/cryptography?style=flat-square" alt="npm version">
  </a>
  <a href="https://www.npmjs.com/package/@hyperfrontend/cryptography">
    <img src="https://img.shields.io/npm/dm/@hyperfrontend/cryptography?style=flat-square" alt="npm downloads">
  </a>
  <a href="https://github.com/AndrewRedican/hyperfrontend">
    <img src="https://img.shields.io/github/stars/AndrewRedican/hyperfrontend?style=flat-square" alt="GitHub stars">
  </a>
</p>

Production-grade cryptographic primitives with isomorphic APIs for browser and Node.js environments.

## What is @hyperfrontend/cryptography?

@hyperfrontend/cryptography provides a comprehensive suite of cryptographic utilities designed for secure data handling in full-stack JavaScript applications. The library implements industry-standard encryption (AES-GCM), key derivation (PBKDF2), and hashing (SHA-256) with identical APIs across browser and Node.js environments, eliminating platform-specific code branching.

The library features three modular entry points: platform-specific implementations (`/browser`, `/node`) for optimized runtime performance, and a shared entry point (`/common`) for platform-agnostic utilities. Core capabilities include secure password-based encryption/decryption, cryptographic vault storage with single-use modes, time-based password generation for rotating credentials, and cryptographically-secure random value generation.

### Key Features

- **Isomorphic API Design** - Write once, run everywhere with identical function signatures for browser Web Crypto API and Node.js crypto module
- **AES-GCM Encryption** - Industry-standard authenticated encryption with password-derived keys using PBKDF2 (100,000 iterations)
- **Secure Vault Storage** - Password-protected in-memory storage with optional single-use mode for sensitive data
- **Time-Based Passwords** - Generate rotating credentials synchronized to UTC time windows for short-lived authentication
- **Cryptographic Hashing** - SHA-256 hash generation with hexadecimal output and validation utilities
- **Zero External Dependencies** - Self-contained implementation using only platform crypto APIs and internal hyperfrontend utilities
- **Functional Architecture** - Pure functions with dependency injection for testability and composability
- **Secondary Entry Points** - Tree-shakeable imports optimize bundle size (`/browser`, `/node`, `/common`)

### Architecture Highlights

Built on functional composition with dependency injection, allowing complete mocking in tests without module patching. All cryptographic operations use platform-native APIs (Web Crypto API in browsers, Node.js crypto module) wrapped in consistent interfaces. Encryption operations automatically generate unique salt and initialization vectors per operation, eliminating key reuse vulnerabilities.

## Why Use @hyperfrontend/cryptography?

### Eliminate Platform Branching in Isomorphic Applications

Full-stack applications typically require separate cryptography implementations for browser and server environments, leading to code duplication and testing complexity. This library provides identical APIs powered by platform-optimized implementations, allowing shared business logic for encryption workflows across your entire stack. Import from `/browser` or `/node` based on your runtime - the function signatures remain identical.

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

// Time-based rotating passwords (5-minute windows)
const generators = getTimeBasedPasswords(new Date(), 300_000)
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

### Encryption/Decryption

- **`encrypt(message: string, password: string): Promise<Uint8Array>`** - Encrypt message with password-derived AES-GCM key
- **`decrypt(encrypted: Uint8Array, password: string): Promise<string>`** - Decrypt message with password

### Vault Storage

- **`createVault(singleUse?: boolean): Vault`** - Create encrypted in-memory storage
  - `vault.write(label: string, value: string): Promise<void>` - Store encrypted value
  - `vault.read(label: string, password: string): Promise<string | null>` - Retrieve decrypted value
  - `vault.getPassword(): string` - Get vault password
  - `vault.close(): void` - Close vault permanently

### Hashing

- **`createHash(data: string, algorithm?: 'SHA-256' | 'SHA-384' | 'SHA-512'): Promise<string>`** - Generate cryptographic hash (hex string)
- **`isSHA256Hash(hash: unknown): boolean`** - Validate SHA-256 hash format

### Time-Based Passwords

- **`getTimeBasedPassword(currentUtcTime: Date, baseTimeWindow: number, windowOffset?: -1 | 0 | 1): Promise<string>`** - Generate password for specific time window
- **`getTimeBasedPasswords(currentUtcTime: Date, baseTimeWindow: number): TimeBasedPasswordGenerators`** - Create generators for current/previous/next windows

### Key Generation & Random Values

- **`generateKey(password: string, salt: Uint8Array): Promise<CryptoKey>`** - Derive encryption key using PBKDF2
- **`getRandomValues(byteLength: number): Uint8Array`** - Generate cryptographically-secure random bytes

## Compatibility

| Platform                      | Support |
| ----------------------------- | :-----: |
| Browser                       |   ✅    |
| Node.js                       |   ✅    |
| Web Workers                   |   ✅    |
| Deno, Bun, Cloudflare Workers |   ✅    |

### Output Formats

| Format | File                       | Tree-Shakeable |
| ------ | -------------------------- | :------------: |
| ESM    | `index.esm.js`             |       ✅       |
| CJS    | `index.cjs.js`             |       ❌       |
| IIFE   | `bundle/index.iife.min.js` |       ❌       |
| UMD    | `bundle/index.umd.min.js`  |       ❌       |

**Bundle size:** 3 KB (minified, self-contained)

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

**Global variable:** `HyperfrontendCryptography`

### Dependencies

| Package                               | Type     |
| ------------------------------------- | -------- |
| @hyperfrontend/data-utils             | Internal |
| @hyperfrontend/random-generator-utils | Internal |
| @hyperfrontend/string-utils           | Internal |
| @hyperfrontend/time-utils             | Internal |

## Part of hyperfrontend

This library is part of the [hyperfrontend](https://github.com/AndrewRedican/hyperfrontend) monorepo.

- Used by [@hyperfrontend/network-protocol](https://github.com/AndrewRedican/hyperfrontend/tree/main/libs/network-protocol) for secure message encryption
- Looking for cross-window messaging with built-in encryption? See [@hyperfrontend/nexus](https://github.com/AndrewRedican/hyperfrontend/tree/main/libs/nexus)

## License

MIT
