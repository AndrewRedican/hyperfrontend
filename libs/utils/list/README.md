# @hyperfrontend/list-utils

<p align="center">
  <a href="https://github.com/AndrewRedican/hyperfrontend/actions/workflows/ci-lib-list-utils.yml">
    <img src="https://img.shields.io/github/actions/workflow/status/AndrewRedican/hyperfrontend/ci-lib-list-utils.yml?style=flat-square&logo=github&label=build" alt="Build">
  </a>
  <a href="https://codecov.io/gh/AndrewRedican/hyperfrontend/flags?flags%5B0%5D=list-utils">
    <img src="https://codecov.io/gh/AndrewRedican/hyperfrontend/graph/badge.svg?flag=list-utils" alt="Coverage">
  </a>
  <a href="https://www.npmjs.com/package/@hyperfrontend/list-utils">
    <img src="https://img.shields.io/npm/v/@hyperfrontend/list-utils?style=flat-square" alt="npm version">
  </a>
  <a href="https://bundlephobia.com/package/@hyperfrontend/list-utils">
    <img src="https://img.shields.io/bundlephobia/min/%40hyperfrontend%2Flist-utils?style=flat-square" alt="npm bundle size">
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
  <a href="https://www.npmjs.com/package/@hyperfrontend/list-utils">
    <img src="https://img.shields.io/npm/dm/@hyperfrontend/list-utils?style=flat-square" alt="npm downloads">
  </a>
  <a href="https://github.com/AndrewRedican/hyperfrontend">
    <img src="https://img.shields.io/github/stars/AndrewRedican/hyperfrontend?style=flat-square" alt="GitHub stars">
  </a>
  <img src="https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen?style=flat-square&logo=node.js" alt="Node Version">
  <img src="https://img.shields.io/badge/tree%20shakeable-%E2%9C%93-success?style=flat-square" alt="Tree Shakeable">
</p>

<!-- hf:media start id="banner" scene="banner-list-utils" asset="banner" alt="@hyperfrontend/list-utils" -->
<!-- hf:media end -->

<p align="center">
  <a href="https://www.hyperfrontend.dev/docs/libraries/utils/list/">
    <img width="640" height="360" src="https://www.hyperfrontend.dev/media/list-utils-order/hero.gif" alt="A tube open at both ends and a cup open only at the top, with the same three numbered discs dropped into each; three pulls take the discs out, the tube from its bottom and the cup from its top, and the exit rows read 1 2 3 under the tube and 3 2 1 beside the cup">
  </a>
</p>
<p align="center">
  <sub>The same three objects into both list kinds. Only the order they come back out differs; and because entries are held by reference, an object that merely looks like a member never was one.</sub>
</p>

Purpose-built collection utilities for queue management, filtering, and iteration patterns.

• 👉 See [**documentation**](https://www.hyperfrontend.dev/docs/libraries/utils/list/)
• 👉 See [**guides & tutorials**](https://www.hyperfrontend.dev/docs/guides/?package=%40hyperfrontend%2Flist-utils)

## What is @hyperfrontend/list-utils?

@hyperfrontend/list-utils provides specialized collection utilities focused on common programming patterns that native JavaScript arrays don't handle elegantly. Rather than replicating lodash, this library targets specific use cases: FIFO/LIFO queue management with object reference tracking, cyclical value iteration, and string array sanitization.

The library enforces immutability through frozen interfaces while maintaining high performance. All queue operations (FIFO/LIFO) use native `Set` for O(1) lookups and guaranteed uniqueness, solving the common problem of accidentally adding duplicate items to task queues or event handlers.

### Key Features

- **[FIFO and LIFO queues](https://www.hyperfrontend.dev/docs/libraries/utils/list/#api-createFifoList)** with type-safe object tracking
- **[Value picker](https://www.hyperfrontend.dev/docs/libraries/utils/list/#api-createValuePicker)** for cyclical iteration (ideal for round-robin patterns)
- **[String sanitization](https://www.hyperfrontend.dev/docs/libraries/utils/list/#api-uniqueStrings)** utilities (dedupe, trim, filter empty)
- **[Range generation](https://www.hyperfrontend.dev/docs/libraries/utils/list/#api-createRange)** for loop-free number sequences
- **[Map utilities](https://www.hyperfrontend.dev/docs/libraries/utils/list/#api-getLastKeyInMap)** for common Map operations
- **Zero dependencies** - Self-contained implementation with no third-party runtime dependencies

### Architecture Highlights

Both queue kinds hold object references only: pushing a primitive throws at runtime, not just at compile time. Membership is reference identity, so two structurally identical objects are two separate entries, and `has()` and `remove()` need the same reference you pushed.

## Why Use @hyperfrontend/list-utils?

### Prevents Queue Bugs in Event-Driven Systems

Native arrays don't enforce uniqueness, making it easy to accidentally register the same event handler, task, or subscription multiple times. Both list kinds reject duplicates based on reference equality, eliminating a common source of memory leaks and duplicate processing in event loops, job queues, and observer patterns. A FIFO list throws on a duplicate push; a LIFO list ignores it.

### Simplifies Round-Robin and Cyclical Patterns

The value picker solves the boilerplate problem of cycling through options (load balancer endpoints, color schemes, retry strategies). No manual index tracking or modulo math, just call `next()`. Particularly useful for testing scenarios where you need predictable value rotation.

### Type-Safe String Sanitization

`nonEmptyStrings()` and `uniqueStrings()` handle the tedious work of cleaning user input, configuration arrays, or CSV parsing results. Filters null/undefined/empty/whitespace-only values in one call, with full TypeScript type narrowing.

### Functional Composition Without Dependencies

All utilities return new arrays or frozen objects, never mutate inputs. This makes them safe for use in React hooks dependencies, Redux reducers, or any pure function context. No lodash required for these specific operations.

## Installation

```bash
npm install @hyperfrontend/list-utils
```

## Quick Start

```typescript
import { createFifoList, createValuePicker, nonEmptyStrings, uniqueStrings } from '@hyperfrontend/list-utils'

// FIFO queue for task management
const taskQueue = createFifoList<{ id: string; execute: () => void }>()
taskQueue.push({ id: 'task1', execute: () => console.log('Task 1') })
taskQueue.push({ id: 'task2', execute: () => console.log('Task 2') })
const nextTask = taskQueue.pull() // Gets task1 (first in), or undefined once the queue is drained

// Round-robin value picker
const colorPicker = createValuePicker(['red', 'blue', 'green'])
colorPicker.next() // 'red'
colorPicker.next() // 'blue'
colorPicker.next() // 'green'
colorPicker.next() // 'red' (cycles back)

// String sanitization: blanks are dropped, survivors keep their original padding
const userInputs = ['  hello  ', '', 'world', null, 'hello', '   ', 'world']
const cleaned = uniqueStrings(nonEmptyStrings(userInputs)) // ['  hello  ', 'world', 'hello']
```

## API Overview

Two ordered collections plus a few standalone helpers; the collections are the place to start. [`createFifoList`](https://www.hyperfrontend.dev/docs/libraries/utils/list/#api-createFifoList) and [`createLifoList`](https://www.hyperfrontend.dev/docs/libraries/utils/list/#api-createLifoList) each take no arguments, are generic over an object type, and return a frozen instance with the same fixed method surface: [`push`](https://www.hyperfrontend.dev/docs/libraries/utils/list/#api-FifoList), [`pull`](https://www.hyperfrontend.dev/docs/libraries/utils/list/#api-FifoList), [`map`](https://www.hyperfrontend.dev/docs/libraries/utils/list/#api-FifoList), [`forEach`](https://www.hyperfrontend.dev/docs/libraries/utils/list/#api-FifoList), [`remove`](https://www.hyperfrontend.dev/docs/libraries/utils/list/#api-FifoList), [`has`](https://www.hyperfrontend.dev/docs/libraries/utils/list/#api-FifoList), [`size`](https://www.hyperfrontend.dev/docs/libraries/utils/list/#api-FifoList) and [`clear`](https://www.hyperfrontend.dev/docs/libraries/utils/list/#api-FifoList). Choosing one factory over the other decides which end `pull()` reads from and nothing else about the surrounding code. They diverge on one point, deliberately: pushing an item a FIFO list already holds throws, surfacing a queue that would otherwise take the same job twice, whereas a LIFO list ignores the duplicate and leaves the item where it already was.

Both are backed by a `Set` of the references you pushed, which has two consequences to know before reaching for either. A primitive is rejected at runtime, not only by the type parameter. And membership is reference identity, so two structurally identical objects are two entries, and `has()` and `remove()` want back the exact reference you handed over.

The helpers are independent of the lists and of each other. [`createValuePicker`](https://www.hyperfrontend.dev/docs/libraries/utils/list/#api-createValuePicker) wraps a non-empty string array in a `current()` and `next()` pair that cycles forever, while [`createRange`](https://www.hyperfrontend.dev/docs/libraries/utils/list/#api-createRange) returns an inclusive run of numbers. For string arrays, [`nonEmptyStrings`](https://www.hyperfrontend.dev/docs/libraries/utils/list/#api-nonEmptyStrings) drops null, undefined, empty and whitespace-only entries but returns the survivors exactly as they arrived: it tests `value.trim()`, it does not trim, so padded values come through padded and [`uniqueStrings`](https://www.hyperfrontend.dev/docs/libraries/utils/list/#api-uniqueStrings) then dedupes on exact string equality, which leaves `'  hello  '` and `'hello'` as two distinct results. The last helper, [`getLastKeyInMap`](https://www.hyperfrontend.dev/docs/libraries/utils/list/#api-getLastKeyInMap), reads the most recently inserted key of a `Map`.

Every signature, type parameter and thrown error is in the [API reference](https://www.hyperfrontend.dev/docs/libraries/utils/list/#api-reference).

## Compatibility

<!-- hf:media start id="runtimes" scene="runtimes-list-utils" asset="runtimes" docs="#compatibility" alt="Runs in Node.js 18 or later, evergreen browsers and web workers" -->

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
<script src="https://unpkg.com/@hyperfrontend/list-utils"></script>

<!-- jsDelivr -->
<script src="https://cdn.jsdelivr.net/npm/@hyperfrontend/list-utils"></script>

<script>
  const { createQueue, forEach } = HyperfrontendListUtils
</script>
```

**Global variable:** [`HyperfrontendListUtils`](https://www.hyperfrontend.dev/docs/libraries/utils/list/)

## Part of hyperfrontend

This library is part of the [hyperfrontend](https://github.com/AndrewRedican/hyperfrontend) monorepo.

**📖 [Full documentation](https://www.hyperfrontend.dev/docs/libraries/utils/list)**

- Used by [@hyperfrontend/network-protocol](https://github.com/AndrewRedican/hyperfrontend/tree/main/libs/network-protocol) for message queue management

## License

[MIT](https://github.com/AndrewRedican/hyperfrontend/blob/main/LICENSE.md)
