# @hyperfrontend/data-utils

<p align="center">
  <a href="https://github.com/AndrewRedican/hyperfrontend/actions/workflows/ci-lib-data-utils.yml">
    <img src="https://img.shields.io/github/actions/workflow/status/AndrewRedican/hyperfrontend/ci-lib-data-utils.yml?style=flat-square&logo=github&label=build" alt="Build">
  </a>
  <a href="https://codecov.io/gh/AndrewRedican/hyperfrontend/flags?flags%5B0%5D=data-utils">
    <img src="https://codecov.io/gh/AndrewRedican/hyperfrontend/graph/badge.svg?flag=data-utils" alt="Coverage">
  </a>
  <a href="https://www.npmjs.com/package/@hyperfrontend/data-utils">
    <img src="https://img.shields.io/npm/v/@hyperfrontend/data-utils?style=flat-square" alt="npm version">
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
  <a href="https://www.npmjs.com/package/@hyperfrontend/data-utils">
    <img src="https://img.shields.io/npm/dm/@hyperfrontend/data-utils?style=flat-square" alt="npm downloads">
  </a>
  <a href="https://github.com/AndrewRedican/hyperfrontend">
    <img src="https://img.shields.io/github/stars/AndrewRedican/hyperfrontend?style=flat-square" alt="GitHub stars">
  </a>
  <a href="https://bundlephobia.com/package/@hyperfrontend/data-utils">
    <img src="https://img.shields.io/bundlephobia/minzip/@hyperfrontend/data-utils?style=flat-square" alt="Bundle Size">
  </a>
  <img src="https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen?style=flat-square&logo=node.js" alt="Node Version">
  <img src="https://img.shields.io/badge/tree%20shakeable-%E2%9C%93-success?style=flat-square" alt="Tree Shakeable">
</p>

Comprehensive data structure manipulation with circular reference handling and custom class support.

## What is @hyperfrontend/data-utils?

@hyperfrontend/data-utils provides industrial-strength utilities for inspecting, transforming, and comparing complex JavaScript data structures. Unlike basic utility libraries that fail on circular references or treat custom classes as generic objects, this library handles self-referential structures safely and allows registration of custom classes (Maps, Sets, domain models) with specialized traversal logic.

The library centers around a powerful `traverse()` function that recursively walks any data structure with configurable depth control, executing callbacks at each node. Built on this foundation are specialized utilities: deep equality comparison (`isIdentical`), selective cloning with filtering (`selectiveCopy`), circular reference detection (`hasCircularReference`), path-based searches (`locateKey`, `locateText`), and structural transformations (`renameKey`, `removeKey`, `replaceText`). An enhanced type system via `getType()` distinguishes null, arrays, and custom classes beyond native `typeof`.

### Key Features

- **Circular Reference Detection** - Identify and locate self-referential structures without stack overflow
- **Custom Class Registration** - Teach utilities how to traverse Maps, Sets, or domain-specific classes with custom operators
- **Deep Data Traversal** - Walk nested structures with depth control, callbacks, and early exit support
- **Structural Deep Equality** - Compare objects with circular references using position-aware reference tracking
- **Selective Deep Cloning** - Copy data structures with predicate filtering and circular reference preservation
- **Path-Based Search** - Locate keys or text values anywhere in nested structures with regex support
- **In-Place Transformations** - Rename keys, remove properties, or replace text throughout data trees
- **Enhanced Type Detection** - Distinguish null, arrays, and registered classes beyond standard typeof
- **Zero External Dependencies** - Self-contained implementation with no third-party runtime dependencies
- **Prototype Pollution Protection** - Automatically filters `__proto__` during cloning operations

### Architecture Highlights

Uses a class registration system where custom types (Map, Set, domain models) define traversal operators (getKeys, read, write, remove, instantiate). Reference stacks track visited objects during traversal to detect circular references without WeakMap dependencies. Traversal functions use functional composition with configurable predicates and callbacks, allowing complex operations to be built from simple building blocks.

## Why Use @hyperfrontend/data-utils?

### Handle Real-World Data Structures with Circular References

Production applications frequently encounter circular references in DOM nodes, framework state (React, Vue), ORM models with bidirectional relationships, and graph structures. Standard `JSON.stringify()` throws on circular references, and naive recursive algorithms cause stack overflow. This library detects circular dependencies safely and handles them appropriately - `isIdentical()` compares structures with matching circular patterns, `selectiveCopy()` preserves or breaks cycles as needed, and `hasCircularReference()` validates data before serialization.

### Work with Custom Classes Beyond Plain Objects

Generic utility libraries treat all objects identically, failing to traverse Maps, Sets, or custom data structures correctly. If your application uses `Map` for caching, `Set` for unique collections, or domain classes (User, Order, Graph nodes), generic utilities miss their internal state. Register custom classes once with `registerIterableClass()`, defining how to read keys, access values, and create instances - then every utility (`traverse`, `isIdentical`, `selectiveCopy`) automatically handles your custom types.

### Deep Equality Without Manual Implementation

Implementing reliable deep equality is deceptively complex - must handle primitives, nested objects, arrays, functions, dates, circular references, and custom classes. Testing frameworks often provide basic deep equality that fails on edge cases. This library's `isIdentical()` handles all JavaScript types correctly, compares functions by string representation, tracks circular reference positions (not just existence), and works with registered custom classes. Replace brittle manual comparisons with battle-tested equality checking.

### Surgical Data Transformations Without Manual Recursion

Common operations like "rename all 'id' keys to '\_id'" or "remove all null values from nested config" require recursive tree walking with careful state management. Manual implementations are error-prone (stack overflow, circular references, prototype pollution). Functions like `renameKey()`, `removeKey()`, and `replaceText()` handle recursion, depth control, and edge cases automatically. Transform deeply nested API responses, sanitize user data, or migrate data structures without writing custom traversal logic.

### Type-Safe Data Inspection for Runtime Validation

Runtime type validation requires distinguishing null from objects, arrays from plain objects, and custom classes from generic objects - but `typeof null === 'object'` and `typeof []  === 'object'`. The `getType()` function returns precise types ('null', 'array', 'CustomClassName') and integrates with class registration. Use it to build robust runtime validators, safely access properties, or implement multi-method dispatch based on actual runtime types.

## Installation

```bash
npm install @hyperfrontend/data-utils
```

## Quick Start

### Enhanced Type Detection

```typescript
import { getType } from '@hyperfrontend/data-utils'

getType(null) // 'null' (not 'object')
getType([1, 2, 3]) // 'array' (not 'object')
getType(new Map()) // 'object' (unless registered)

// After registering custom class
class User {}
registerClassTypes(User)
getType(new User()) // 'User'
```

### Deep Equality with Circular References

```typescript
import { isIdentical } from '@hyperfrontend/data-utils'

const obj1 = { a: 1, b: { c: 2 } }
const obj2 = { a: 1, b: { c: 2 } }
isIdentical(obj1, obj2) // true (deep equality)

// Handles circular references
const circular1 = { name: 'node' }
circular1.self = circular1
const circular2 = { name: 'node' }
circular2.self = circular2
isIdentical(circular1, circular2) // true (circular patterns match)
```

### Traverse Data Structures

```typescript
import { traverse } from '@hyperfrontend/data-utils'

const data = { user: { name: 'Alice', age: 30 }, settings: { theme: 'dark' } }

// Collect all string values
const strings = []
traverse(
  data,
  (key, value, path, state) => {
    if (typeof value === 'string') state.strings.push(value)
  },
  { depth: [0, '*'] },
  { strings }
)
// strings: ['Alice', 'dark']

// Search with depth limits
traverse(data, callback, { depth: [0, 2] }, state) // Only 2 levels deep
```

### Selective Deep Cloning

```typescript
import { selectiveCopy } from '@hyperfrontend/data-utils'

const data = {
  user: { id: 1, name: 'Alice', password: 'secret' },
  settings: { theme: 'dark' },
}

// Clone without sensitive fields
const sanitized = selectiveCopy(data, {
  includeKey: (value, path, key) => key !== 'password',
})
// sanitized: { user: { id: 1, name: 'Alice' }, settings: { theme: 'dark' } }

// Clone only specific paths
const partial = selectiveCopy(data, {
  includeKey: (value, path) => path[0] === 'user',
})
// partial: { user: { id: 1, name: 'Alice', password: 'secret' } }
```

### Detect and Locate Circular References

```typescript
import { hasCircularReference, locateCircularReference } from '@hyperfrontend/data-utils'

const obj = { a: 1 }
obj.self = obj

hasCircularReference(obj) // true

const locations = locateCircularReference(obj)
// locations: [{ startPath: ['self'], destinationPath: [] }]
// Meaning: path ['self'] references the root object
```

### Search for Keys and Values

```typescript
import { locateKey, locateText } from '@hyperfrontend/data-utils'

const data = {
  user: { userId: 1, name: 'Alice' },
  admin: { userId: 2, name: 'Bob' },
}

// Find all paths containing 'userId'
locateKey(data, 'userId')
// [['user', 'userId'], ['admin', 'userId']]

// Find keys matching pattern
locateKey(data, /user/i)
// [['user'], ['user', 'userId'], ['admin', 'userId']]

// Find values containing text
locateText(data, 'Alice')
// [['user', 'name']]
```

### Transform Data In-Place

```typescript
import { renameKey, removeKey, replaceText } from '@hyperfrontend/data-utils'

const data = { user_id: 1, user_name: 'Alice' }

// Rename keys throughout structure
renameKey(data, 'user_id', 'userId')
// { userId: 1, user_name: 'Alice' }

// Remove keys by pattern
removeKey(data, /^user_/)
// { userId: 1 } (removes keys starting with 'user_')

// Replace text in all string values
replaceText(data, 'Alice', 'Bob')
// { userId: 1, user_name: 'Bob' }
```

### Register Custom Classes

```typescript
import { registerIterableClass, registerClassTypes } from '@hyperfrontend/data-utils'

class Graph {
  nodes = new Map()
  addNode(id, value) {
    this.nodes.set(id, value)
  }
}

// Register as traversable type
registerIterableClass(
  Graph,
  (graph) => Array.from(graph.nodes.keys()).map(String), // getKeys
  (graph, key) => graph.nodes.get(key), // read
  (graph, value, key) => graph.nodes.set(key, value), // write
  (graph, key) => graph.nodes.delete(key), // remove
  () => new Graph() // instantiate
)

// Now all utilities work with Graph instances
const g1 = new Graph()
g1.addNode('a', 1)
const g2 = selectiveCopy(g1) // Deep clone works
isIdentical(g1, g2) // true
```

## API Overview

### Type Detection & Comparison

- **`getType(target): DataType | string`** - Enhanced typeof with null/array/class distinction
- **`sameType(a, b): boolean`** - Check if two values have identical types
- **`sameStructure(a, b): boolean | DataType`** - Check if values share structure/type
- **`isIdentical(a, b): boolean`** - Deep equality with circular reference support

### Traversal & Search

- **`traverse(target, callback, options, state): state`** - Recursively walk data structures with callbacks
- **`locateKey(target, pattern, options?): string[][]`** - Find all paths matching key pattern
- **`locateText(target, pattern, options?): string[][]`** - Find all paths containing text value
- **`getValue(target, path): unknown`** - Safely access nested values by path
- **`getDepth(target): number`** - Calculate maximum nesting depth

### Data Manipulation

- **`selectiveCopy(target, options): Partial<T>`** - Deep clone with filtering and circular reference handling
- **`renameKey(target, oldKey, newKey, options?): void`** - Rename keys throughout structure
- **`removeKey(target, pattern, options?): void`** - Remove keys matching pattern
- **`replaceText(target, pattern, replacement, options?): void`** - Replace text in all string values

### Circular Reference Utilities

- **`hasCircularReference(target): boolean`** - Check if structure contains circular references
- **`locateCircularReference(target): CircularReference[]`** - Find all circular reference locations
- **`circularReference(target): CircularReference[]`** - Alias for locateCircularReference

### Class Registration

- **`registerClassTypes(...classes): void`** - Register classes for type detection
- **`registerIterableClass(classRef, getKeys, read, write, remove, instantiate?): void`** - Register custom traversable classes
- **`deregisterClassTypes(...classes): void`** - Remove registered classes
- **`deregisterIterableClass(classRef): void`** - Remove registered iterable class

### Iterable Utilities

- **`isIterable(target): boolean`** - Check if value is iterable (object/array/custom)
- **`isIterableType(type): boolean`** - Check if type string represents iterable
- **`getIterableTypes(): string[]`** - Get all registered iterable type names
- **`getIterableOperators(type): IterableOperators`** - Get traversal operators for type
- **`getKeysFromIterable(target, type): string[]`** - Get all keys from iterable value
- **`getUniqueKeys(...targets): string[]`** - Get all unique keys from multiple iterables

### Validation

- **`containsKeys(target, keys): boolean`** - Check if target contains all specified keys
- **`isMarker(key): boolean`** - Check if key is internal marker (for circular reference tracking)

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

**Bundle size:** 12 KB (minified, self-contained)

### CDN Usage

```html
<!-- unpkg -->
<script src="https://unpkg.com/@hyperfrontend/data-utils"></script>

<!-- jsDelivr -->
<script src="https://cdn.jsdelivr.net/npm/@hyperfrontend/data-utils"></script>

<script>
  const { isEqual, deepClone, getType } = HyperfrontendDataUtils
</script>
```

**Global variable:** `HyperfrontendDataUtils`

### Dependencies

None — zero external dependencies.

## Part of hyperfrontend

This library is part of the [hyperfrontend](https://github.com/AndrewRedican/hyperfrontend) monorepo. [Full documentation](https://hyperfrontend.dev).

## License

MIT
