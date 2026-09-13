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
  <a href="https://bundlephobia.com/package/@hyperfrontend/data-utils">
    <img src="https://img.shields.io/bundlephobia/min/%40hyperfrontend%2Fdata-utils?style=flat-square" alt="npm bundle size">
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
  <img src="https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen?style=flat-square&logo=node.js" alt="Node Version">
  <img src="https://img.shields.io/badge/tree%20shakeable-%E2%9C%93-success?style=flat-square" alt="Tree Shakeable">
</p>

<!-- hf:media start id="banner" scene="banner-data-utils" asset="banner" alt="@hyperfrontend/data-utils" -->
<!-- hf:media end -->

<p align="center">
  <a href="https://www.hyperfrontend.dev/docs/libraries/utils/data/">
    <img width="640" height="360" src="https://www.hyperfrontend.dev/media/data-utils-circular/hero.gif" alt="Four objects drawn in a row, state, user, cart and line, joined by their forward references, with three back references drawn as arcs; a cursor walks the graph depth first, and each arc that lands on an object already visited lights up and is numbered, until all three are lit and the count beside locateCircularReference reads three">
  </a>
</p>
<p align="center">
  <sub>The graph, walked. Every arc that lands on an object the walk has already visited is a cycle, and the call returns all of them, with where each was found and what it points back to; the exception you would get from JSON.stringify describes only the first.</sub>
</p>

Comprehensive data structure manipulation with circular reference handling and custom class support.

• 👉 See [**documentation**](https://www.hyperfrontend.dev/docs/libraries/utils/data/)
• 👉 See [**guides & tutorials**](https://www.hyperfrontend.dev/docs/guides/?package=%40hyperfrontend%2Fdata-utils)

## What is @hyperfrontend/data-utils?

@hyperfrontend/data-utils provides industrial-strength utilities for inspecting, transforming, and comparing complex JavaScript data structures. Unlike basic utility libraries that fail on circular references or treat custom classes as generic objects, this library handles self-referential structures safely and allows registration of custom classes (Maps, Sets, domain models) with specialized traversal logic.

The library centers around a powerful `traverse()` function that recursively walks any data structure with configurable depth control, executing callbacks at each node. Built on this foundation are specialized utilities: deep equality comparison ([`isIdentical`](https://www.hyperfrontend.dev/docs/libraries/utils/data/#api-isIdentical)), selective cloning with filtering ([`selectiveCopy`](https://www.hyperfrontend.dev/docs/libraries/utils/data/#api-selectiveCopy)), circular reference detection ([`hasCircularReference`](https://www.hyperfrontend.dev/docs/libraries/utils/data/#api-hasCircularReference)), path-based searches ([`locateKey`](https://www.hyperfrontend.dev/docs/libraries/utils/data/#api-locateKey), [`locateText`](https://www.hyperfrontend.dev/docs/libraries/utils/data/#api-locateText)), and structural transformations ([`renameKey`](https://www.hyperfrontend.dev/docs/libraries/utils/data/#api-renameKey), [`removeKey`](https://www.hyperfrontend.dev/docs/libraries/utils/data/#api-removeKey), [`replaceText`](https://www.hyperfrontend.dev/docs/libraries/utils/data/#api-replaceText)). An enhanced type system via `getType()` distinguishes null, arrays, and custom classes beyond native `typeof`.

### Key Features

- **[Circular Reference Detection](https://www.hyperfrontend.dev/docs/libraries/utils/data/#api-locateCircularReference)** - Identify and locate self-referential structures without stack overflow
- **[Custom Class Registration](https://www.hyperfrontend.dev/docs/libraries/utils/data/#api-registerIterableClass)** - Teach utilities how to traverse Maps, Sets, or domain-specific classes with custom operators
- **[Deep Data Traversal](https://www.hyperfrontend.dev/docs/libraries/utils/data/#api-traverse)** - Walk nested structures with depth control, callbacks, and early exit support
- **[Structural Deep Equality](https://www.hyperfrontend.dev/docs/libraries/utils/data/#api-isIdentical)** - Compare objects with circular references using position-aware reference tracking
- **[Selective Deep Cloning](https://www.hyperfrontend.dev/docs/libraries/utils/data/#api-selectiveCopy)** - Copy data structures with predicate filtering and circular reference preservation
- **[Path-Based Search](https://www.hyperfrontend.dev/docs/libraries/utils/data/#api-locateKey)** - Locate keys or text values anywhere in nested structures with regex support
- **[In-Place Transformations](https://www.hyperfrontend.dev/docs/libraries/utils/data/#api-renameKey)** - Rename keys, remove properties, or replace text throughout data trees
- **[Enhanced Type Detection](https://www.hyperfrontend.dev/docs/libraries/utils/data/#api-getType)** - Distinguish null, arrays, and registered classes beyond standard typeof
- **Zero External Dependencies** - Self-contained implementation with no third-party runtime dependencies
- **Prototype Pollution Protection** - Automatically filters `__proto__` during cloning operations

### Architecture Highlights

Custom types are taught to the library through [`registerIterableClass`](https://www.hyperfrontend.dev/docs/libraries/utils/data/#api-registerIterableClass), which takes a class plus four operators ([`getKeys`](https://www.hyperfrontend.dev/docs/libraries/utils/data/#api-IterableOperators-prop-getKeys), [`read`](https://www.hyperfrontend.dev/docs/libraries/utils/data/#api-IterableOperators-prop-read), [`write`](https://www.hyperfrontend.dev/docs/libraries/utils/data/#api-IterableOperators-prop-write), [`remove`](https://www.hyperfrontend.dev/docs/libraries/utils/data/#api-IterableOperators-prop-remove)) and an optional [`instantiate`](https://www.hyperfrontend.dev/docs/libraries/utils/data/#api-RegisteredIterableClassEntry-prop-instantiate). Once registered, a class is traversed, compared, and cloned by the same functions that handle plain objects. Circular references are found by tracking the references actually visited, not by capping depth, so a deep but acyclic structure is never mistaken for a loop.

## Why Use @hyperfrontend/data-utils?

### Handle Real-World Data Structures with Circular References

Production applications frequently encounter circular references in DOM nodes, framework state (React, Vue), ORM models with bidirectional relationships, and graph structures. Standard `JSON.stringify()` throws on circular references, and naive recursive algorithms cause stack overflow. This library detects circular dependencies safely and handles them appropriately - `isIdentical()` compares structures with matching circular patterns, `selectiveCopy()` preserves or breaks cycles as needed, and `hasCircularReference()` validates data before serialization.

### Work with Custom Classes Beyond Plain Objects

Generic utility libraries treat all objects identically, failing to traverse Maps, Sets, or custom data structures correctly. If your application uses `Map` for caching, `Set` for unique collections, or domain classes (User, Order, Graph nodes), generic utilities miss their internal state. Register custom classes once with `registerIterableClass()`, defining how to read keys, access values, and create instances - then every utility ([`traverse`](https://www.hyperfrontend.dev/docs/libraries/utils/data/#api-traverse), [`isIdentical`](https://www.hyperfrontend.dev/docs/libraries/utils/data/#api-isIdentical), [`selectiveCopy`](https://www.hyperfrontend.dev/docs/libraries/utils/data/#api-selectiveCopy)) automatically handles your custom types.

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
import { isIdentical, setConfig } from '@hyperfrontend/data-utils'

const obj1 = { a: 1, b: { c: 2 } }
const obj2 = { a: 1, b: { c: 2 } }
isIdentical(obj1, obj2) // true (deep equality)

// Circular references need reference tracking; without it the comparison recurses until the stack overflows
setConfig({ detectCircularReferences: true })

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
const { clone: sanitized, skipped } = selectiveCopy(data, {
  include: (value, path, key) => key !== 'password',
})
// sanitized: { user: { id: 1, name: 'Alice' }, settings: { theme: 'dark' } }
// skipped: [{ target: 'secret', path: ['user', 'password'], key: 'password', dataType: 'string' }]

// Clone only specific paths
const { clone: partial } = selectiveCopy(data, {
  include: (value, path) => path[0] === 'user',
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
// locations: [CircularReference { location: { path: ['self'] }, target: { path: [] } }]
// Meaning: path ['self'] references the root object
// One result by default: pass '*' as the second argument to get every cycle in the graph
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
const { clone: g2 } = selectiveCopy(g1) // Deep clone works, and g2 is a Graph
isIdentical(g1, g2) // true
```

## API Overview

There is one walker. [`traverse`](https://www.hyperfrontend.dev/docs/libraries/utils/data/#api-traverse) recurses through anything iterable and calls your callback at every data point with `(key, value, path, state, parent)`, where [`path`](https://www.hyperfrontend.dev/docs/libraries/utils/data/#api-traverse) is the list of keys that got there and [`state`](https://www.hyperfrontend.dev/docs/libraries/utils/data/#api-traverse) is an object you hand in and get back. Most of the rest of the package is a callback over it: [`locateKey`](https://www.hyperfrontend.dev/docs/libraries/utils/data/#api-locateKey), [`locateText`](https://www.hyperfrontend.dev/docs/libraries/utils/data/#api-locateText), [`renameKey`](https://www.hyperfrontend.dev/docs/libraries/utils/data/#api-renameKey), [`removeKey`](https://www.hyperfrontend.dev/docs/libraries/utils/data/#api-removeKey) and [`replaceText`](https://www.hyperfrontend.dev/docs/libraries/utils/data/#api-replaceText) differ only in what their callback does at each node, and all five return the same `string[][]` of paths they acted on. The factory behind it, [`createTraversal`](https://www.hyperfrontend.dev/docs/libraries/utils/data/#api-createTraversal), is exported too, so a walk with a different admission rule is one call away.

Back references are opt in, because tracking them costs. [`setConfig`](https://www.hyperfrontend.dev/docs/libraries/utils/data/#api-setConfig) with `{ detectCircularReferences: true }` swaps that plain recursion for one that keeps a stack of the references it has already visited, which is what lets [`isIdentical`](https://www.hyperfrontend.dev/docs/libraries/utils/data/#api-isIdentical) compare two self-referential graphs and [`selectiveCopy`](https://www.hyperfrontend.dev/docs/libraries/utils/data/#api-selectiveCopy) rebuild the loops inside its clone. With the flag off both assume an acyclic structure, and a cycle overflows the stack.

Two functions never need the flag, because they set it for the length of their own call: [`hasCircularReference`](https://www.hyperfrontend.dev/docs/libraries/utils/data/#api-hasCircularReference) answers yes or no, and [`locateCircularReference`](https://www.hyperfrontend.dev/docs/libraries/utils/data/#api-locateCircularReference) reports where each cycle was found and what it points back to, one by default and all of them if you pass `'*'`. Note that [`selectiveCopy`](https://www.hyperfrontend.dev/docs/libraries/utils/data/#api-selectiveCopy) resolves to `{ clone, skipped }`, so the data points it left out stay inspectable instead of vanishing.

Out of the box only arrays and plain objects are traversable; everything else is a leaf the walk stops at. [`registerIterableClass`](https://www.hyperfrontend.dev/docs/libraries/utils/data/#api-registerIterableClass) is how that list grows. Give it a class plus four operators ([`getKeys`](https://www.hyperfrontend.dev/docs/libraries/utils/data/#api-IterableOperators-prop-getKeys), [`read`](https://www.hyperfrontend.dev/docs/libraries/utils/data/#api-IterableOperators-prop-read), [`write`](https://www.hyperfrontend.dev/docs/libraries/utils/data/#api-IterableOperators-prop-write), [`remove`](https://www.hyperfrontend.dev/docs/libraries/utils/data/#api-IterableOperators-prop-remove)) and an optional [`instantiate`](https://www.hyperfrontend.dev/docs/libraries/utils/data/#api-RegisteredIterableClassEntry-prop-instantiate), and from that point every function above reads and writes inside its instances exactly as it does a plain object: [`getType`](https://www.hyperfrontend.dev/docs/libraries/utils/data/#api-getType) reports the class name rather than `'object'`, searches descend into it, and [`selectiveCopy`](https://www.hyperfrontend.dev/docs/libraries/utils/data/#api-selectiveCopy) rebuilds a real instance rather than an object literal. One registration is what turns a `Map`, a `Set` or your own domain model into a first-class traversable type.

Every option, callback signature and result type is in the [API reference](https://www.hyperfrontend.dev/docs/libraries/utils/data/#api-reference).

## Compatibility

<!-- hf:media start id="runtimes" scene="runtimes-data-utils" asset="runtimes" docs="#compatibility" alt="Runs in Node.js 18 or later, evergreen browsers and web workers" -->

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
<script src="https://unpkg.com/@hyperfrontend/data-utils"></script>

<!-- jsDelivr -->
<script src="https://cdn.jsdelivr.net/npm/@hyperfrontend/data-utils"></script>

<script>
  const { isIdentical, selectiveCopy, getType } = HyperfrontendDataUtils
</script>
```

**Global variable:** [`HyperfrontendDataUtils`](https://www.hyperfrontend.dev/docs/libraries/utils/data/)

### Dependencies

None: zero external dependencies.

## Part of hyperfrontend

This library is part of the [hyperfrontend](https://github.com/AndrewRedican/hyperfrontend) monorepo.

**📖 [Full documentation](https://www.hyperfrontend.dev/docs/libraries/utils/data)**

## License

[MIT](https://github.com/AndrewRedican/hyperfrontend/blob/main/LICENSE.md)
