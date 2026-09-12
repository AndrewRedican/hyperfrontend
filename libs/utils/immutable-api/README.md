# @hyperfrontend/immutable-api-utils

<p align="center">
  <a href="https://github.com/AndrewRedican/hyperfrontend/actions/workflows/ci-lib-immutable-api-utils.yml">
    <img src="https://img.shields.io/github/actions/workflow/status/AndrewRedican/hyperfrontend/ci-lib-immutable-api-utils.yml?style=flat-square&logo=github&label=build" alt="Build">
  </a>
  <a href="https://codecov.io/gh/AndrewRedican/hyperfrontend/flags?flags%5B0%5D=immutable-api-utils">
    <img src="https://codecov.io/gh/AndrewRedican/hyperfrontend/graph/badge.svg?flag=immutable-api-utils" alt="Coverage">
  </a>
  <a href="https://www.npmjs.com/package/@hyperfrontend/immutable-api-utils">
    <img src="https://img.shields.io/npm/v/@hyperfrontend/immutable-api-utils?style=flat-square" alt="npm version">
  </a>
  <a href="https://bundlephobia.com/package/@hyperfrontend/immutable-api-utils">
    <img src="https://img.shields.io/bundlephobia/min/%40hyperfrontend%2Fimmutable-api-utils?style=flat-square" alt="npm bundle size">
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
  <a href="https://www.npmjs.com/package/@hyperfrontend/immutable-api-utils">
    <img src="https://img.shields.io/npm/dm/@hyperfrontend/immutable-api-utils?style=flat-square" alt="npm downloads">
  </a>
  <a href="https://github.com/AndrewRedican/hyperfrontend">
    <img src="https://img.shields.io/github/stars/AndrewRedican/hyperfrontend?style=flat-square" alt="GitHub stars">
  </a>
  <img src="https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen?style=flat-square&logo=node.js" alt="Node Version">
  <img src="https://img.shields.io/badge/tree%20shakeable-%E2%9C%93-success?style=flat-square" alt="Tree Shakeable">
</p>

<p align="center">
  <a href="https://www.hyperfrontend.dev/docs/libraries/utils/immutable-api/">
    <img width="640" src="https://www.hyperfrontend.dev/media/immutable-api-capture/hero.gif" alt="A main.mjs file typed out on the left, ending in a vendor script that overwrites Object.keys, Object.prototype.hasOwnProperty and JSON.parse; on the right a node run asks each of those three questions twice, the global call returning the tampered answer in red and the captured copy returning the real one in green">
  </a>
</p>
<p align="center">
  <sub>Both columns run in the same process. The copies answer correctly only because their imports were evaluated before the widget that rewrote the globals.</sub>
</p>

Decorators and utilities for creating immutable, tamper-proof object APIs with built-in prototype pollution defense.

• 👉 See [**documentation**](https://www.hyperfrontend.dev/docs/libraries/utils/immutable-api/)
• 👉 See [**guides & tutorials**](https://www.hyperfrontend.dev/docs/guides/?package=%40hyperfrontend%2Fimmutable-api-utils)

## What is @hyperfrontend/immutable-api-utils?

@hyperfrontend/immutable-api-utils provides low-level utilities for locking object properties and methods to prevent modification. Using JavaScript's property descriptors (`Object.defineProperty`), it creates truly immutable APIs where neither values nor method bindings can be altered after definition.

The library offers three approaches: a TypeScript decorator (`@locked()`) for class methods, a functional API (`lockedProps()`) for bulk property locking, and descriptor builders (`lockedPropertyDescriptors()`) for granular control. All utilities enforce non-writable, non-configurable descriptors while maintaining correct `this` binding through per-instance caching.

Additionally, the library provides **safe built-in copies**: pre-captured references to JavaScript built-in methods that mitigate prototype pollution attacks when loaded early.

### Key Features

- **[`@locked()` decorator](https://www.hyperfrontend.dev/docs/libraries/utils/immutable-api/locked/)** for TypeScript classes: prevents method overwriting and ensures correct `this` binding
- **[Bulk property locking](https://www.hyperfrontend.dev/docs/libraries/utils/immutable-api/locked-props/)** via `lockedProps()` for multiple properties in one call
- **[Property descriptor creation](https://www.hyperfrontend.dev/docs/libraries/utils/immutable-api/locked-prop-descriptors/)** with `lockedPropertyDescriptors()` for custom locking patterns
- **[Safe built-in copies](https://www.hyperfrontend.dev/docs/guides/harden-code-against-prototype-pollution/)** via secondary entrypoints: captured at module load time before any pollution can occur
- **Per-instance binding cache** to avoid repeated `.bind()` calls
- **Zero runtime dependencies** - pure JavaScript property descriptor manipulation

### Architecture Highlights

A locked property is defined `writable: false` and `configurable: false`, so it cannot be reassigned, deleted, or redefined afterwards. Reassignment fails silently in sloppy mode and throws a `TypeError` in strict mode, which includes every ES module.

The safe built-in copies are captured at module initialization time. **Important:** This only works if the module loads before any malicious code runs; it mitigates pollution, not prevents it retroactively.

## Why Use @hyperfrontend/immutable-api-utils?

### Prevents Accidental API Tampering in Shared Contexts

When exposing objects to third-party code, plugin systems, or sandboxed environments, you need guarantees that critical methods won't be overwritten. `@locked()` makes methods truly immutable: attempting reassignment throws a TypeError. This protects public APIs from accidental or malicious modification.

### Eliminates `this` Binding Bugs Without Arrow Functions

Arrow functions in class fields break inheritance and bloat bundle sizes due to per-instance function creation. The `@locked()` decorator provides correct `this` binding (like arrow functions) while using efficient prototype methods. Methods are bound once per instance and cached with Symbol keys.

### Simplifies Immutable Object Construction

`Object.freeze()` is all or nothing: every own property goes read-only, including the ones you meant to keep mutable. `lockedProps()` locks only the properties you name, non-writable and non-configurable, so they cannot be reassigned, redefined or deleted while the rest of the object stays ordinary. It is shallow, like `Object.freeze()`: a locked property holding an object still hands out an object you can mutate.

### TypeScript-First with Runtime Enforcement

Unlike TypeScript `readonly` (compile-time only), these utilities enforce immutability at runtime. This catches bugs in JavaScript-land, during deserialization, or when interfacing with dynamically typed code. Type safety and runtime safety in one decorator.

## Installation

```bash
npm install @hyperfrontend/immutable-api-utils
```

## Quick Start

```typescript
import { locked, lockedProps, lockedPropertyDescriptors } from '@hyperfrontend/immutable-api-utils'

// Decorator usage: lock methods in classes
class Counter {
  private count = 0

  @locked()
  increment() {
    this.count++
    return this.count
  }

  @locked()
  getValue() {
    return this.count
  }
}

const counter = new Counter()
counter.increment() // Works: 1
counter.increment = () => 0 // Throws: Cannot overwrite locked method

// Ensure correct `this` binding even when method is extracted
const { increment } = counter
increment() // Still works correctly, `this` remains bound

// Functional API: lock multiple properties
const config = {}
lockedProps(config, [
  ['apiKey', 'secret-key-12345'],
  ['timeout', 5000],
  ['retries', 3],
])

config.apiKey = 'hacked' // Silent fail in non-strict mode, throws in strict mode
// Throws: cannot redefine
Object.defineProperty(config, 'apiKey', { writable: true })

// Low-level descriptor creation
const obj = {}
Object.defineProperty(obj, 'version', lockedPropertyDescriptors('1.0.0', true))
// Property is non-writable, non-configurable, but enumerable
```

## API Overview

Two jobs share one mechanism, the property descriptor. One half locks the properties of an object you own; the other half captures the built-ins before anything else can swap them. Every module under `built-in-copy/` reads its global exactly once, while it is being evaluated, and re-exports what it found as a named binding: `built-in-copy/object` reads `globalThis.Object`, so its [`keys`](https://www.hyperfrontend.dev/docs/libraries/utils/immutable-api/built-in-copy/object/#api-keys) is the function value `Object.keys` held at that instant, and a later write to `Object.keys` lands on the global while the binding goes on answering correctly. [`parse`](https://www.hyperfrontend.dev/docs/libraries/utils/immutable-api/built-in-copy/json/#api-parse) does the same for `JSON.parse`.

The limit is worth stating plainly: this mitigates rather than prevents, and import order decides whether it works at all. A module graph evaluates in source order, so a copy is honest only when its import sits above the code that tampers. Put the untrusted import first and the capture reads an already poisoned global, returning exactly the wrong answer the global would. Treat these as entry-point imports:

```typescript
// these two lines have to be evaluated first
import { keys, hasOwn } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { parse } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'

import './vendor/analytics.js' // whatever this does to Object.keys, keys() is unaffected
```

There are 24 of these subpaths, each named after the global or family of globals it copies, so the one you want is spelled like the thing you were reaching for: `built-in-copy/timers` holds `setTimeout` and `queueMicrotask`, `built-in-copy/console` holds [`log`](https://www.hyperfrontend.dev/docs/libraries/utils/immutable-api/#api-log) and [`warn`](https://www.hyperfrontend.dev/docs/libraries/utils/immutable-api/built-in-copy/console/#api-warn). Members that need a receiver come through as wrappers ([`hasOwn`](https://www.hyperfrontend.dev/docs/libraries/utils/immutable-api/built-in-copy/object/#api-hasOwn) applies the captured `Object.prototype.hasOwnProperty` through a captured `Reflect.apply`), and constructors as `create*` factories such as [`createMap`](https://www.hyperfrontend.dev/docs/libraries/utils/immutable-api/built-in-copy/map/#api-createMap). The package root re-exports frozen namespace objects for many of these globals, which reads nicely but pulls in the whole namespace; named bindings from a subpath are what keep the rest out of your bundle.

Three entries do the locking, and they stack. [`lockedPropertyDescriptors`](https://www.hyperfrontend.dev/docs/libraries/utils/immutable-api/locked-prop-descriptors/#api-lockedPropertyDescriptors) is the primitive: hand it a value and it returns `{ value, writable: false, configurable: false, enumerable }` for you to pass to `Object.defineProperty`. [`lockedProps`](https://www.hyperfrontend.dev/docs/libraries/utils/immutable-api/locked-props/#api-lockedProps) applies that across a list, taking the target object and an array of `[key, value]` pairs, and returns nothing: it mutates the object you handed it. [`locked`](https://www.hyperfrontend.dev/docs/libraries/utils/immutable-api/locked/#api-locked) is the class-method decorator and the odd one out, installing an accessor whose getter binds the method to the instance once and caches it under a symbol, and whose setter throws a `TypeError`.

Every export, on every subpath, is in the [API reference](https://www.hyperfrontend.dev/docs/libraries/utils/immutable-api/#api-reference).

## Use Cases

- **Plugin APIs**: Prevent plugins from modifying core library methods
- **Sandboxed execution**: Expose safe APIs to untrusted code
- **Configuration objects**: Lock critical config values after initialization
- **Public library interfaces**: Protect exported classes from mutation
- **Event emitters**: Prevent handler list manipulation
- **Prototype pollution mitigation**: Safe built-in copies reduce attack surface when loaded early
- **Secure logging**: Use safe `console` copies to prevent tampered log output
- **Safe timers**: Prevent timer functions from being hijacked
- **Cross-origin messaging**: Secure `postMessage` wrappers with captured references

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

Secondary entrypoints (`built-in-copy/*`) are individually tree-shakeable: import only the built-ins you need.

### CDN Usage

```html
<!-- unpkg -->
<script src="https://unpkg.com/@hyperfrontend/immutable-api-utils"></script>

<!-- jsDelivr -->
<script src="https://cdn.jsdelivr.net/npm/@hyperfrontend/immutable-api-utils"></script>

<script>
  const { locked, lockedProps } = HyperfrontendImmutableApiUtils
  const { lockedPropertyDescriptors } = HyperfrontendImmutableApiUtils
</script>
```

**Global variable:** [`HyperfrontendImmutableApiUtils`](https://www.hyperfrontend.dev/docs/libraries/utils/immutable-api/)

### Dependencies

None: zero external dependencies.

## Part of hyperfrontend

This library is part of the [hyperfrontend](https://github.com/AndrewRedican/hyperfrontend) monorepo.

**📖 [Full documentation](https://www.hyperfrontend.dev/docs/libraries/utils/immutable-api)**

## License

[MIT](https://github.com/AndrewRedican/hyperfrontend/blob/main/LICENSE.md)
