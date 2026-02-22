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
  <a href="https://bundlephobia.com/package/@hyperfrontend/list-utils">
    <img src="https://img.shields.io/bundlephobia/minzip/@hyperfrontend/list-utils?style=flat-square" alt="Bundle Size">
  </a>
  <img src="https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen?style=flat-square&logo=node.js" alt="Node Version">
  <img src="https://img.shields.io/badge/tree%20shakeable-%E2%9C%93-success?style=flat-square" alt="Tree Shakeable">
</p>

Purpose-built collection utilities for queue management, filtering, and iteration patterns.

## What is @hyperfrontend/list-utils?

@hyperfrontend/list-utils provides specialized collection utilities focused on common programming patterns that native JavaScript arrays don't handle elegantly. Rather than replicating lodash, this library targets specific use cases: FIFO/LIFO queue management with object reference tracking, cyclical value iteration, and string array sanitization.

The library enforces immutability through frozen interfaces while maintaining high performance. All queue operations (FIFO/LIFO) use native `Set` for O(1) lookups and guaranteed uniqueness, solving the common problem of accidentally adding duplicate items to task queues or event handlers.

### Key Features

- **FIFO and LIFO queues** with type-safe object tracking
- **Value picker** for cyclical iteration (ideal for round-robin patterns)
- **String sanitization** utilities (dedupe, trim, filter empty)
- **Range generation** for loop-free number sequences
- **Map utilities** for common Map operations
- **Zero dependencies** - Self-contained implementation with no third-party runtime dependencies

### Architecture Highlights

Queue implementations return frozen objects to prevent external mutation while using native `Set` internally for optimal performance. Object-only restriction on queues prevents reference comparison issues with primitives.

## Why Use @hyperfrontend/list-utils?

### Prevents Queue Bugs in Event-Driven Systems

Native arrays don't enforce uniqueness, making it easy to accidentally register the same event handler, task, or subscription multiple times. FIFO/LIFO lists automatically reject duplicates based on reference equality, eliminating a common source of memory leaks and duplicate processing in event loops, job queues, and observer patterns.

### Simplifies Round-Robin and Cyclical Patterns

The value picker solves the boilerplate problem of cycling through options (load balancer endpoints, color schemes, retry strategies). No manual index tracking or modulo math—just call `next()`. Particularly useful for testing scenarios where you need predictable value rotation.

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
const nextTask = taskQueue.pull() // Gets task1 (first in)

// Round-robin value picker
const colorPicker = createValuePicker(['red', 'blue', 'green'])
colorPicker.next() // 'red'
colorPicker.next() // 'blue'
colorPicker.next() // 'green'
colorPicker.next() // 'red' (cycles back)

// String sanitization
const userInputs = ['  hello  ', '', 'world', null, 'hello', '   ', 'world']
const cleaned = uniqueStrings(nonEmptyStrings(userInputs)) // ['hello', 'world']
```

## API Overview

### Queue Management

- **`createFifoList<T>()`** - First-in-first-out queue with reference uniqueness
- **`createLifoList<T>()`** - Last-in-first-out stack with reference uniqueness

### Iteration Utilities

- **`createValuePicker(values)`** - Cyclical iterator for round-robin patterns
- **`createRange(start, end)`** - Generate number arrays without loops

### String Utilities

- **`nonEmptyStrings(values)`** - Filter null/undefined/empty/whitespace strings
- **`uniqueStrings(values)`** - Remove duplicates while preserving order

### Map Helpers

- **`getLastKeyInMap(map)`** - Retrieve the last inserted key from a Map

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

**Bundle size:** 1 KB (minified, self-contained)

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

**Global variable:** `HyperfrontendListUtils`

## Part of hyperfrontend

This library is part of the [hyperfrontend](https://github.com/AndrewRedican/hyperfrontend) monorepo. [Full documentation](https://hyperfrontend.dev).

- Used by [@hyperfrontend/network-protocol](https://github.com/AndrewRedican/hyperfrontend/tree/main/libs/network-protocol) for message queue management

## License

MIT
