# @hyperfrontend/function-utils

Higher-order function utilities for behavioral modification and composition.

## What is @hyperfrontend/function-utils?

`@hyperfrontend/function-utils` provides lightweight functional wrappers that modify the execution behavior of functions without changing their signatures. The library focuses on common patterns like single-execution guarantees, conditional execution, error suppression, and no-op placeholders—all implemented as composable higher-order functions.

Each utility maintains the original function's type signature through generic constraints, ensuring type safety while adding behavioral modifications. The implementations use closure-based state management to track execution context (like memoized results or call counts) without external dependencies or complex class hierarchies.

### Key Features

- **Run-once enforcement** - Memoize first result and prevent subsequent executions (lazy initialization, singleton setup)
- **Conditional execution** - Guard function calls behind runtime predicates without inline conditionals
- **Error suppression** - Silent exception handling for void functions where failures are acceptable
- **No-op placeholder** - Type-safe no-operation function for default parameters and optional callbacks
- **Full type preservation** - Generic constraints maintain original function signatures through transformations
- **Zero dependencies** - Self-contained higher-order functions with no external dependencies
- **Minimal overhead** - Simple closure-based implementations with negligible performance impact
- **TypeScript native** - Complete type inference with comprehensive JSDoc documentation

### Architecture Highlights

All utilities are implemented as factory functions that create and return wrapper functions. State management (execution flags, cached results) occurs in private closure scope, making the wrappers themselves stateless from the caller's perspective. This functional approach avoids prototype chains and class overhead while maintaining thread-safe (non-concurrent) state encapsulation.

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

The `@hyperfrontend/logging` library uses `createErrorIgnoringFunction()` and `createConditionalExecutionFunction()` extensively to prevent logging failures from crashing applications and to implement log level filtering. These utilities enable the logger to be resilient and configurable without defensive try-catch blocks throughout the logging implementation.

### 5. Type-Safe No-Op for Optional Callbacks

Default parameters and optional callback patterns often require placeholder no-op functions. Using `() => {}` loses type information and creates subtle bugs when functions expect specific signatures. The `noop` utility provides a type-safe placeholder that accepts any arguments and returns void, working correctly as a default for any callback pattern.

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

**Higher-Order Functions:**

- **`createRunOnceFunction<T>(func)`** - Wraps function to execute only once, memoizing and returning first result for all subsequent calls
  - **Parameters:** `func` - Function to wrap (any signature)
  - **Returns:** Wrapped function with same signature that executes once
  - **Use cases:** Lazy initialization, singleton setup, one-time DOM manipulation

- **`createConditionalExecutionFunction<T>(func, conditionFunc)`** - Wraps function to execute only when condition returns true
  - **Parameters:**
    - `func` - Function to wrap (any signature)
    - `conditionFunc` - Predicate function returning boolean
  - **Returns:** Wrapped function that executes conditionally, returns `void` if condition is false
  - **Use cases:** Feature flags, environment guards, permission checks, log level filtering

- **`createErrorIgnoringFunction<T>(func)`** - Wraps void function to silently catch and suppress all exceptions
  - **Parameters:** `func` - Void function to wrap (must return void)
  - **Returns:** Wrapped function that never throws
  - **Use cases:** Analytics tracking, debug logging, cache updates, experimental features
  - **Note:** Only for void functions where failures are acceptable

**Utility Functions:**

- **`noop(...args)`** - No-operation function that accepts any arguments and does nothing
  - **Parameters:** `...args` - Any arguments (ignored)
  - **Returns:** `void`
  - **Use cases:** Default callback parameters, placeholder functions, event handler stubs

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

## License

MIT
