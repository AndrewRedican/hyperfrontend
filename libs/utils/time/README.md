# @hyperfrontend/time-utils

<p align="center">
  <a href="https://github.com/AndrewRedican/hyperfrontend/actions/workflows/ci-lib-time-utils.yml">
    <img src="https://img.shields.io/github/actions/workflow/status/AndrewRedican/hyperfrontend/ci-lib-time-utils.yml?style=flat-square&logo=github&label=build" alt="Build">
  </a>
  <a href="https://codecov.io/gh/AndrewRedican/hyperfrontend/flags?flags%5B0%5D=time-utils">
    <img src="https://codecov.io/gh/AndrewRedican/hyperfrontend/graph/badge.svg?flag=time-utils" alt="Coverage">
  </a>
  <a href="https://www.npmjs.com/package/@hyperfrontend/time-utils">
    <img src="https://img.shields.io/npm/v/@hyperfrontend/time-utils?style=flat-square" alt="npm version">
  </a>
  <a href="https://bundlephobia.com/package/@hyperfrontend/time-utils">
    <img src="https://img.shields.io/bundlephobia/min/%40hyperfrontend%2Ftime-utils?style=flat-square" alt="npm bundle size">
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
  <a href="https://www.npmjs.com/package/@hyperfrontend/time-utils">
    <img src="https://img.shields.io/npm/dm/@hyperfrontend/time-utils?style=flat-square" alt="npm downloads">
  </a>
  <a href="https://github.com/AndrewRedican/hyperfrontend">
    <img src="https://img.shields.io/github/stars/AndrewRedican/hyperfrontend?style=flat-square" alt="GitHub stars">
  </a>
  <img src="https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen?style=flat-square&logo=node.js" alt="Node Version">
  <img src="https://img.shields.io/badge/tree%20shakeable-%E2%9C%93-success?style=flat-square" alt="Tree Shakeable">
</p>

Functional time utilities for async operations, intervals, and time normalization.

## What is @hyperfrontend/time-utils?

`@hyperfrontend/time-utils` provides composable, testable utilities for working with time-based operations in JavaScript. The library focuses on enhancing the control and flexibility of standard timing APIs (`setTimeout`, `setInterval`) while adding specialized utilities for async workflows and time window calculations.

Unlike the native timing APIs which offer limited lifecycle control, this library wraps them in functional interfaces that support pausing, resuming, resetting, and subscription management. All utilities return immutable objects with frozen APIs, preventing accidental mutation while maintaining predictable behavior.

### Key Features

- **Controllable timers** - Pause, resume, and reset `setTimeout` operations with tracked remaining time
- **Multi-subscriber clocks** - Observable interval loops supporting multiple callbacks with unified start/stop control
- **Promise-based delays** - Async/await compatible `sleep()` utility for sequential code flows
- **Time window normalization** - Bucket timestamps into fixed intervals (e.g., 5-minute windows for aggregation)
- **Functional cleanup** - All repeating operations return cleanup functions for straightforward teardown
- **Immutable APIs** - All returned objects are frozen, preventing accidental state modifications
- **Zero dependencies** - Self-contained timing utilities with no external dependencies
- **TypeScript native** - Full type definitions with comprehensive JSDoc documentation

### Architecture Highlights

All timing abstractions maintain internal state privately while exposing frozen API objects, following the revealing module pattern. Timer implementations track elapsed time explicitly to enable pause/resume functionality, while clock implementations manage subscriber arrays with simple filter-based unsubscription. The library avoids classes and prototypes in favor of factory functions that return object literals.

## Why Use @hyperfrontend/time-utils?

### 1. Pause/Resume Capabilities Native APIs Lack

JavaScript's `setTimeout` and `setInterval` cannot be paused—once started, they either complete or get cancelled. This creates problems for features like user-initiated pauses in games, animations during background tabs, or request throttling. `createTimer()` tracks elapsed time internally, enabling pause/resume without restarting from the beginning or losing progress.

**Example:** A countdown timer in a game needs to pause when the user switches tabs. With `setTimeout`, you'd need to calculate remaining time manually and create a new timeout. With `createTimer`, just call `timer.pause()`.

### 2. Multi-Subscriber Interval Management

Native `setInterval` requires creating separate intervals for each callback that needs to run at the same frequency, leading to drift and coordination issues. `createClock()` lets multiple callbacks subscribe to a single interval loop, ensuring they all fire synchronously at exact intervals. Perfect for real-time dashboards, clocks, or animation frames.

**Example:** A dashboard with 5 widgets updating every second would require 5 separate `setInterval` calls, potentially drifting apart. A single clock can notify all widgets simultaneously from one interval.

### 3. Async/Await Integration for Sequential Delays

Writing readable sequential code with delays requires nested callbacks or promise chains with `setTimeout`. `sleep()` provides a clean async/await compatible delay utility that works naturally with modern async functions. This is essential for testing, retry logic, rate limiting, and animation sequences.

**Example:** Retry logic becomes `await sleep(1000); retry()` instead of `setTimeout(() => retry(), 1000)`, maintaining the sequential flow of async functions.

### 4. Time Window Normalization for Aggregation

Real-time data aggregation often requires grouping events into time buckets (5-minute windows, hourly intervals, etc.). `normalizeToBaseTimeWindow()` rounds timestamps down to the nearest window boundary, simplifying time-series data grouping for metrics, logs, and analytics.

**Example:** Events at 10:03, 10:07, and 10:12 with a 5-minute window all normalize to 10:00, 10:05, and 10:10 respectively, creating clean bucket keys for aggregation.

### 5. Immutable, Testable Timing Abstractions

Testing code with `setTimeout` and `setInterval` typically requires jest timers or sinon fakes, adding complexity. These utilities use standard timing APIs internally but expose functional interfaces that are easier to mock and test. The frozen return objects prevent accidental mutations that could cause subtle timing bugs.

## Installation

```bash
npm install @hyperfrontend/time-utils
```

## Quick Start

**Pauseable timer:**

```typescript
import { createTimer } from '@hyperfrontend/time-utils'

const timer = createTimer(() => console.log('Done!'), 5000)

timer.resume() // Start the 5-second countdown

// After 3 seconds, user pauses
timer.pause() // Pauses with 2 seconds remaining

// Later, resume from where we left off
timer.resume() // Continues with remaining 2 seconds

// Or reset with a new duration
timer.reset(10000) // Restart with 10 seconds
```

**Multi-subscriber clock:**

```typescript
import { createClock } from '@hyperfrontend/time-utils'

// Create a clock that ticks every second
const clock = createClock(1000)

// Multiple subscribers can listen
clock.subscribe((time) => console.log('Widget 1:', time))
clock.subscribe((time) => console.log('Widget 2:', time))

clock.start() // Both widgets update every second

// Later, stop all updates
clock.stop()

// Unsubscribe specific callbacks
clock.unsubscribe(callback)
```

**Async delays:**

```typescript
import { sleep } from '@hyperfrontend/time-utils'

async function retryWithDelay(fn, attempts = 3) {
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn()
    } catch (error) {
      if (i < attempts - 1) {
        await sleep(1000 * Math.pow(2, i)) // Exponential backoff
      }
    }
  }
  throw new Error('All retries failed')
}
```

**Time window normalization:**

```typescript
import { normalizeToBaseTimeWindow } from '@hyperfrontend/time-utils'

// Group metrics into 5-minute windows
const events = [new Date('2024-01-17T10:03:45Z'), new Date('2024-01-17T10:07:22Z'), new Date('2024-01-17T10:12:03Z')]

const buckets = new Map()
events.forEach((timestamp) => {
  const bucket = normalizeToBaseTimeWindow(timestamp, 5)
  const key = bucket.toISOString()
  buckets.set(key, (buckets.get(key) || 0) + 1)
})

// Results:
// "2024-01-17T10:00:00Z" → 2 events
// "2024-01-17T10:10:00Z" → 1 event
```

**Simple interval with cleanup:**

```typescript
import { setIntervalCallback } from '@hyperfrontend/time-utils'

// Returns a cleanup function
const cleanup = setIntervalCallback(() => {
  console.log('Polling...')
}, 5000)

// Later, stop polling
cleanup()
```

## API Overview

**Timing Abstractions:**

- **`createTimer(callback, delay)`** - Creates a pauseable, resumable timer (enhanced setTimeout)
  - `timer.pause()` - Pauses timer, preserving remaining time
  - `timer.resume()` - Resumes timer from remaining time
  - `timer.reset(newDelay?)` - Restarts timer with optional new duration

- **`createClock(interval?)`** - Creates a multi-subscriber interval loop (default: 1000ms)
  - `clock.start()` - Begins interval loop
  - `clock.stop()` - Stops interval loop
  - `clock.subscribe(callback)` - Adds callback to subscriber list
  - `clock.unsubscribe(callback)` - Removes callback from subscribers
  - `clock.interval` - Read-only interval duration

**Utility Functions:**

- **`sleep(milliseconds)`** - Returns promise that resolves after delay (async/await compatible)
- **`setIntervalCallback(callback, interval)`** - Simple setInterval wrapper returning cleanup function
- **`normalizeToBaseTimeWindow(time, baseTimeWindow)`** - Rounds timestamp down to nearest time window boundary (window in minutes)

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

### CDN Usage

```html
<!-- unpkg -->
<script src="https://unpkg.com/@hyperfrontend/time-utils"></script>

<!-- jsDelivr -->
<script src="https://cdn.jsdelivr.net/npm/@hyperfrontend/time-utils"></script>

<script>
  const { createResumableInterval, sleep } = HyperfrontendTimeUtils
</script>
```

**Global variable:** `HyperfrontendTimeUtils`

### Dependencies

None — zero external dependencies.

## Part of hyperfrontend

This library is part of the [hyperfrontend](https://github.com/AndrewRedican/hyperfrontend) monorepo.

**📖 [Full documentation](https://www.hyperfrontend.dev/docs/libraries/utils/time)**

- Used by [@hyperfrontend/cryptography](https://github.com/AndrewRedican/hyperfrontend/tree/main/libs/cryptography) for time-window password generation

## License

MIT
