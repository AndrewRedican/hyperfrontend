# @hyperfrontend/function-utils

<p align="center">
  <a href="https://github.com/AndrewRedican/hyperfrontend/actions/workflows/ci-lib-function-utils.yml">
    <img src="https://img.shields.io/github/actions/workflow/status/AndrewRedican/hyperfrontend/ci-lib-function-utils.yml?style=flat-square&logo=github&label=build" alt="Build">
  </a>
  <a href="https://codecov.io/gh/AndrewRedican/hyperfrontend/flags?flags%5B0%5D=function-utils">
    <img src="https://codecov.io/gh/AndrewRedican/hyperfrontend/graph/badge.svg?flag=function-utils" alt="Coverage">
  </a>
  <a href="https://www.npmjs.com/package/@hyperfrontend/function-utils">
    <img src="https://img.shields.io/npm/v/@hyperfrontend/function-utils?style=flat-square" alt="npm version">
  </a>
  <a href="https://bundlephobia.com/package/@hyperfrontend/function-utils">
    <img src="https://img.shields.io/bundlephobia/min/%40hyperfrontend%2Ffunction-utils?style=flat-square" alt="npm bundle size">
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
  <a href="https://www.npmjs.com/package/@hyperfrontend/function-utils">
    <img src="https://img.shields.io/npm/dm/@hyperfrontend/function-utils?style=flat-square" alt="npm downloads">
  </a>
  <a href="https://github.com/AndrewRedican/hyperfrontend">
    <img src="https://img.shields.io/github/stars/AndrewRedican/hyperfrontend?style=flat-square" alt="GitHub stars">
  </a>
  <img src="https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen?style=flat-square&logo=node.js" alt="Node Version">
  <img src="https://img.shields.io/badge/tree%20shakeable-%E2%9C%93-success?style=flat-square" alt="Tree Shakeable">
</p>

<!-- hf:media start id="banner" scene="banner-function-utils" asset="banner" alt="@hyperfrontend/function-utils" -->
<!-- hf:media end -->

<p align="center">
  <a href="https://www.hyperfrontend.dev/docs/libraries/utils/function/">
    <img width="640" height="360" src="https://www.hyperfrontend.dev/media/function-utils-lanes/hero.gif" alt="Four vertical lanes, each with a send box in the middle, and the same three numbered tokens dropped into all four at once while an online switch in the margin goes off for the second call: the bare lane throws and dies, the run-once lane sends its first token through and bypasses the rest with the cached 1, the conditional lane stops the second token at a shut gate and passes the third, and the error-ignoring lane absorbs the throw behind a shield and carries on">
  </a>
</p>
<p align="center">
  <sub>One function, three calls, three wrappers. The second call fails while the switch is off, and what each lane does about it is the whole library.</sub>
</p>

Higher-order function utilities for behavioral modification and composition.

• 👉 See [**documentation**](https://www.hyperfrontend.dev/docs/libraries/utils/function/)
• 👉 See [**guides & tutorials**](https://www.hyperfrontend.dev/docs/guides/?package=%40hyperfrontend%2Ffunction-utils)

## What is @hyperfrontend/function-utils?

[`@hyperfrontend/function-utils`](https://www.hyperfrontend.dev/docs/libraries/utils/function/) provides lightweight functional wrappers that modify the execution behavior of functions without changing their signatures. The library focuses on common patterns like single-execution guarantees, conditional execution, error suppression, and no-op placeholders, all implemented as composable higher-order functions.

Each utility maintains the original function's type signature through generic constraints, ensuring type safety while adding behavioral modifications. The implementations use closure-based state management to track execution context (like memoized results or call counts) without external dependencies or complex class hierarchies.

### Key Features

- **[Run-once enforcement](https://www.hyperfrontend.dev/docs/libraries/utils/function/#api-createRunOnceFunction)** - Memoize first result and prevent subsequent executions (lazy initialization, singleton setup)
- **[Conditional execution](https://www.hyperfrontend.dev/docs/libraries/utils/function/#api-createConditionalExecutionFunction)** - Guard function calls behind runtime predicates without inline conditionals
- **[Error suppression](https://www.hyperfrontend.dev/docs/libraries/utils/function/#api-createErrorIgnoringFunction)** - Silent exception handling for void functions where failures are acceptable
- **[No-op placeholder](https://www.hyperfrontend.dev/docs/libraries/utils/function/#api-noop)** - Type-safe no-operation function for default parameters and optional callbacks
- **Full type preservation** - Generic constraints maintain original function signatures through transformations
- **Zero dependencies** - Self-contained higher-order functions with no external dependencies
- **Minimal overhead** - Simple closure-based implementations with negligible performance impact
- **TypeScript native** - Complete type inference with comprehensive JSDoc documentation

## Why Use @hyperfrontend/function-utils?

### 1. Declarative Run-Once Logic Without Manual Guards

Initialization and setup functions often need single-execution guarantees (database connections, singleton initialization, one-time DOM setup). Manual implementation requires scattered boolean flags and conditional checks throughout the codebase. `createRunOnceFunction()` encapsulates this pattern in a reusable wrapper that memoizes the first result and prevents re-execution.

**Example pain point solved:** Instead of writing `if (initialized) return cachedValue; initialized = true; cachedValue = expensiveSetup(); return cachedValue` repeatedly, wrap the function once and call it freely.

### 2. Separation of Business Logic from Execution Conditions

Mixing business logic with execution conditions (feature flags, permission checks, environment guards) creates coupling and reduces testability. `createConditionalExecutionFunction()` separates the condition from the action, enabling independent testing of the function logic and the condition predicate.

**Example:** Logging functions that should only execute in development environments can be wrapped once with an `isDevelopment()` condition rather than checking the environment at every call site.

### 3. Intentional Error Suppression for Non-Critical Operations

Some operations (analytics tracking, debug logging, experimental features) should never crash the application if they fail. `createErrorIgnoringFunction()` explicitly documents error suppression intent through the wrapper, making it clear that failures are expected and acceptable, unlike bare try-catch blocks scattered through code.

**Example:** Analytics tracking that fails due to network issues shouldn't crash the app. Wrapping the tracking function makes the error suppression explicit and centralized.

### 4. Foundation for Logger Error Handling

The [`@hyperfrontend/logging`](https://www.hyperfrontend.dev/docs/libraries/logging/) library uses `createErrorIgnoringFunction()` and `createConditionalExecutionFunction()` extensively to prevent logging failures from crashing applications and to implement log level filtering. These utilities enable the logger to be resilient and configurable without defensive try-catch blocks throughout the logging implementation.

### 5. Type-Safe No-Op for Optional Callbacks

Default parameters and optional callback patterns often require placeholder no-op functions. Using `() => {}` loses type information and creates subtle bugs when functions expect specific signatures. The [`noop`](https://www.hyperfrontend.dev/docs/libraries/utils/function/#api-noop) utility provides a type-safe placeholder that accepts any arguments and returns void, working correctly as a default for any callback pattern.

## Installation

```bash
npm install @hyperfrontend/function-utils
```

## Quick Start

**Run-once initialization:**

```typescript
import { createRunOnceFunction } from '@hyperfrontend/function-utils'

// Expensive setup function
function initializeDatabase() {
  console.log('Connecting to database...')
  return { connection: 'db-handle' }
}

// Wrap to ensure single execution
const getDatabase = createRunOnceFunction(initializeDatabase)

// First call executes and caches result
const db1 = getDatabase() // Logs "Connecting..."
// Subsequent calls return cached result
const db2 = getDatabase() // No log, returns cached connection
console.log(db1 === db2) // true
```

**Conditional execution:**

```typescript
import { createConditionalExecutionFunction } from '@hyperfrontend/function-utils'

// Business logic function
function trackAnalytics(event: string, data: object) {
  console.log('Tracking:', event, data)
  // ... send to analytics service
}

// Wrap with feature flag condition
const isDevelopment = () => process.env.NODE_ENV === 'development'
const trackInDev = createConditionalExecutionFunction(trackAnalytics, isDevelopment)

// Only executes in development
trackInDev('user_click', { button: 'submit' }) // Executes in dev, skipped in prod
```

**Error suppression:**

```typescript
import { createErrorIgnoringFunction } from '@hyperfrontend/function-utils'

// Non-critical operation that might fail
function updateLocalCache(key: string, value: any): void {
  localStorage.setItem(key, JSON.stringify(value)) // May throw in incognito
}

// Wrap to prevent crashes
const safeUpdateCache = createErrorIgnoringFunction(updateLocalCache)

// App continues even if localStorage fails
safeUpdateCache('user-prefs', { theme: 'dark' }) // Never throws
```

**No-op placeholder:**

```typescript
import { noop } from '@hyperfrontend/function-utils'

// Function with optional callback
function fetchData(url: string, onSuccess = noop, onError = noop) {
  fetch(url)
    .then((response) => response.json())
    .then(onSuccess)
    .catch(onError)
}

// Caller can omit callbacks safely
fetchData('/api/data') // Uses noop for both callbacks
```

**Composing multiple wrappers:**

```typescript
import { createRunOnceFunction, createConditionalExecutionFunction } from '@hyperfrontend/function-utils'

// Only execute expensive setup once, and only in production
const isProduction = () => process.env.NODE_ENV === 'production'

const setupAnalytics = createRunOnceFunction(
  createConditionalExecutionFunction(() => {
    console.log('Initializing analytics...')
    return { initialized: true }
  }, isProduction)
)

// First call in production initializes, subsequent calls return cached result
// In development, all calls skip execution
```

## API Overview

The surface is three higher-order wrappers and one placeholder, and nothing else: no configuration objects, no registry, no state shared between two wrappers. Each
wrapper takes a function and gives back a function you call exactly the way you called the original, because its parameters are typed `Parameters<T>` and its result is
derived from `ReturnType<T>`. What a wrapper changes is when, or whether, the underlying call happens.

Start with [`createRunOnceFunction`](https://www.hyperfrontend.dev/docs/libraries/utils/function/#api-createRunOnceFunction): it invokes the wrapped function on the
first call, stores that result and returns the stored one for every call after, ignoring their arguments entirely. [`createConditionalExecutionFunction`](https://www.hyperfrontend.dev/docs/libraries/utils/function/#api-createConditionalExecutionFunction)
takes a second argument, a no-argument predicate that is re-read on every call, and calls through only while it returns true; it is the piece behind log-level filtering
and environment guards. [`createErrorIgnoringFunction`](https://www.hyperfrontend.dev/docs/libraries/utils/function/#api-createErrorIgnoringFunction) puts the call
inside a `try` with an empty `catch`, for work you would rather lose than crash on: analytics beacons, cache writes, debug output.

One typing detail decides between them. Run-once returns `ReturnType<T>`, and error-ignoring is constrained to functions that already return void, so it returns `void`
too and quietly discards anything a wrapped function hands back. The conditional wrapper is the only one that widens the return type, to `ReturnType<T> | void`: when
its predicate is false it never calls through, and the caller receives `undefined`, so a skipped call is a value you can branch on rather than something to infer.

[`noop`](https://www.hyperfrontend.dev/docs/libraries/utils/function/#api-noop) wraps nothing. It takes any arguments and returns nothing, as a typed default for an
optional callback parameter.

Full signatures, generic constraints and per-function examples are in the [API reference](https://www.hyperfrontend.dev/docs/libraries/utils/function/#api-reference).

## Type Safety

All utilities preserve type information through generic constraints:

```typescript
// Original function type is preserved
function add(a: number, b: number): number {
  return a + b
}

const addOnce = createRunOnceFunction(add)
// Type: (a: number, b: number) => number ✓

const result: number = addOnce(2, 3) // Type safe ✓
```

## Compatibility

<!-- hf:media start id="runtimes" scene="runtimes-function-utils" asset="runtimes" docs="#compatibility" alt="Runs in Node.js 18 or later, evergreen browsers and web workers" -->

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
<script src="https://unpkg.com/@hyperfrontend/function-utils"></script>

<!-- jsDelivr -->
<script src="https://cdn.jsdelivr.net/npm/@hyperfrontend/function-utils"></script>

<script>
  const { createRunOnceFunction, noop } = HyperfrontendFunctionUtils
  const { createErrorIgnoringFunction } = HyperfrontendFunctionUtils
</script>
```

**Global variable:** [`HyperfrontendFunctionUtils`](https://www.hyperfrontend.dev/docs/libraries/utils/function/)

### Dependencies

None: zero external dependencies.

## Part of hyperfrontend

This library is part of the [hyperfrontend](https://github.com/AndrewRedican/hyperfrontend) monorepo.

**📖 [Full documentation](https://www.hyperfrontend.dev/docs/libraries/utils/function)**

- Used by [@hyperfrontend/logging](https://github.com/AndrewRedican/hyperfrontend/tree/main/libs/logging) for error suppression and conditional execution

## License

[MIT](https://github.com/AndrewRedican/hyperfrontend/blob/main/LICENSE.md)
