# @hyperfrontend/immutable-api-utils

<p align="center">
  <a href="https://github.com/AndrewRedican/hyperfrontend/actions/workflows/ci-main.yml">
    <img src="https://img.shields.io/github/actions/workflow/status/AndrewRedican/hyperfrontend/ci-main.yml?style=flat-square&logo=github&label=build" alt="Build">
  </a>
  <a href="https://codecov.io/gh/AndrewRedican/hyperfrontend/flags?flags%5B0%5D=immutable-api-utils">
    <img src="https://codecov.io/gh/AndrewRedican/hyperfrontend/graph/badge.svg?flag=immutable-api-utils" alt="Coverage">
  </a>
</p>

Decorators and utilities for creating immutable, tamper-proof object APIs.

## What is @hyperfrontend/immutable-api-utils?

@hyperfrontend/immutable-api-utils provides low-level utilities for locking object properties and methods to prevent modification. Using JavaScript's property descriptors (`Object.defineProperty`), it creates truly immutable APIs where neither values nor method bindings can be altered after definition.

The library offers three approaches: a TypeScript decorator (`@locked()`) for class methods, a functional API (`lockedProps()`) for bulk property locking, and descriptor builders (`lockedPropertyDescriptors()`) for granular control. All utilities enforce non-writable, non-configurable descriptors while maintaining correct `this` binding through per-instance caching.

### Key Features

- **`@locked()` decorator** for TypeScript classes—prevents method overwriting and ensures correct `this` binding
- **Bulk property locking** via `lockedProps()` for multiple properties in one call
- **Property descriptor creation** with `lockedPropertyDescriptors()` for custom locking patterns
- **Per-instance binding cache** to avoid repeated `.bind()` calls
- **Zero runtime dependencies** - pure JavaScript property descriptor manipulation

### Architecture Highlights

The `@locked()` decorator uses Symbol-based caching to store bound methods per instance, avoiding the performance cost of repeated `.bind()` calls. Properties are marked `configurable: false` to prevent deletion or descriptor modification, and `writable: false` to block reassignment.

## Why Use @hyperfrontend/immutable-api-utils?

### Prevents Accidental API Tampering in Shared Contexts

When exposing objects to third-party code, plugin systems, or sandboxed environments, you need guarantees that critical methods won't be overwritten. `@locked()` makes methods truly immutable—attempting reassignment throws a TypeError. This protects public APIs from accidental or malicious modification.

### Eliminates `this` Binding Bugs Without Arrow Functions

Arrow functions in class fields break inheritance and bloat bundle sizes due to per-instance function creation. The `@locked()` decorator provides correct `this` binding (like arrow functions) while using efficient prototype methods. Methods are bound once per instance and cached with Symbol keys.

### Simplifies Immutable Object Construction

Building frozen objects with `Object.freeze()` is shallow and doesn't prevent descriptor modification. `lockedProps()` provides deep immutability for specific properties while allowing controlled mutability elsewhere—ideal for partially frozen configs or API surfaces.

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
Object.defineProperty(config, 'apiKey', { writable: true }) // Throws: cannot redefine

// Low-level descriptor creation
const obj = {}
Object.defineProperty(obj, 'version', lockedPropertyDescriptors('1.0.0', true))
// Property is non-writable, non-configurable, but enumerable
```

## API Overview

### Decorator

- **`@locked()`** - TypeScript decorator that makes class methods immutable with correct `this` binding

### Functions

- **`lockedProps(object, pairs)`** - Lock multiple properties on an object with key-value pairs
- **`lockedPropertyDescriptors(value, enumerable?)`** - Create a locked property descriptor for manual use with `Object.defineProperty`

## Use Cases

- **Plugin APIs**: Prevent plugins from modifying core library methods
- **Sandboxed execution**: Expose safe APIs to untrusted code
- **Configuration objects**: Lock critical config values after initialization
- **Public library interfaces**: Protect exported classes from mutation
- **Event emitters**: Prevent handler list manipulation
- **Prototype pollution defense**: Make critical prototypes tamper-proof

## License

MIT
