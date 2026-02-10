# @hyperfrontend/state-machine

<p align="center">
  <a href="https://github.com/AndrewRedican/hyperfrontend/actions/workflows/ci-lib-state-machine.yml">
    <img src="https://img.shields.io/github/actions/workflow/status/AndrewRedican/hyperfrontend/ci-lib-state-machine.yml?style=flat-square&logo=github&label=build" alt="Build">
  </a>
  <a href="https://codecov.io/gh/AndrewRedican/hyperfrontend/flags?flags%5B0%5D=state-machine">
    <img src="https://codecov.io/gh/AndrewRedican/hyperfrontend/graph/badge.svg?flag=state-machine" alt="Coverage">
  </a>
  <!-- ALL-CONTRIBUTORS-BADGE:START - Do not remove or modify this section -->
  <a href="#contributors">
    <img src="https://img.shields.io/github/all-contributors/AndrewRedican/hyperfrontend?color=ee8449&style=flat-square" alt="All Contributors">
  </a>
  <!-- ALL-CONTRIBUTORS-BADGE:END -->
  <a href="https://github.com/AndrewRedican/hyperfrontend/blob/main/LICENSE.md">
    <img src="https://img.shields.io/badge/license-MIT-blue?style=flat-square" alt="License">
  </a>
  <a href="https://www.npmjs.com/package/@hyperfrontend/state-machine">
    <img src="https://img.shields.io/npm/v/@hyperfrontend/state-machine?style=flat-square" alt="npm version">
  </a>
  <a href="https://www.npmjs.com/package/@hyperfrontend/state-machine">
    <img src="https://img.shields.io/npm/dm/@hyperfrontend/state-machine?style=flat-square" alt="npm downloads">
  </a>
  <a href="https://github.com/AndrewRedican/hyperfrontend">
    <img src="https://img.shields.io/github/stars/AndrewRedican/hyperfrontend?style=flat-square" alt="GitHub stars">
  </a>
</p>

Lightweight, functional state management library with Redux-inspired actions/reducers, async operation orchestration, and lifecycle-aware component abstractions for predictable application state.

## What is @hyperfrontend/state-machine?

@hyperfrontend/state-machine is a composable state management framework that combines Redux-style action/reducer patterns with specialized abstractions for asynchronous operations and component lifecycles. It provides a minimal `Store` implementation with subscribe/dispatch APIs, a pre-built reducer for process state (start, pause, cancel, success, fail), and higher-level abstractions like `AsyncOperation` for automatic state transitions and `LifecycleAwareComponent` for initialization/activation workflows.

The library emphasizes explicit state modeling through a core `State` interface (inProgress, success, fail, halt) with derived state computation (notStarted, done, paused, cancelled, retrying, restarting). The event system dispatches actions through the store and notifies listeners when derived states activate, enabling decoupled state observation. Modular exports (`/actions`, `/reducer`, `/store`, `/async-operation`, `/lifecycle-aware-component`) allow selective imports for tree-shaking and custom composition.

### Key Features

- **Redux-inspired architecture** - Central store with immutable state, action dispatching, and pure reducers
- **Pre-built process reducer** - Ready-to-use reducer for START/PAUSE/CANCEL/SUCCESS/FAIL action types
- **Derived state computation** - Automatic computation of notStarted, done, paused, cancelled, retrying, restarting from core state
- **Event-driven notifications** - Observer pattern with event handlers triggered when specific derived states activate
- **Async operation wrapper** - `AsyncOperation` class that automatically dispatches actions for promise lifecycles
- **Coordinated async processes** - `CoordinatedAsyncProcess` for managing multiple async operations with startAll/cancelAll/pauseAll
- **Lifecycle-aware components** - Abstract class with initializing/ready/starting/stopping/active state tracking and callbacks
- **Modular exports** - Tree-shakeable secondary entry points for actions, reducers, selectors, events, and async operations
- **Zero external dependencies** - Only depends on `@hyperfrontend/data-utils` for internal utilities

### Architecture Highlights

The library uses a functional core with imperative shell pattern. The `rootReducer` is a pure function mapping (state, action) → new state using a handler lookup table. The `Store` class wraps the reducer with subscription management using a `Set<Listener>` for efficient add/remove operations. Derived state computation happens through selector functions that transform core state into boolean flags, with the `Events` class comparing previous/current derived states to trigger event handlers only when specific flags activate. The `LifecycleAwareComponent` uses protected setter methods (setInitializing, setReady, etc.) that invoke callback stacks only when state actually changes, preventing duplicate notifications. All state updates are immutable using object spread (`{ ...state, inProgress: true }`).

For a detailed technical deep dive, see [ARCHITECTURE.md](./ARCHITECTURE.md).

## Why Use @hyperfrontend/state-machine?

### Predictable Async Operation State Without Boilerplate

Managing async operation states (loading, success, error) typically requires manual flag updates, error handling, and state synchronization across components. The `AsyncOperation` class wraps any async function and automatically dispatches start/success/fail actions, updating store state without repetitive try-catch blocks or flag management. Event handlers trigger on state transitions (notStarted→inProgress, inProgress→done) rather than requiring manual status checks. For data fetching, form submissions, or long-running computations, this eliminates state management bugs where flags aren't reset or errors aren't caught, reducing async-related defects by centralizing state logic.

### Lifecycle Management for Initialization-Heavy Components

Services, connections, or components with initialization → ready → active lifecycles require tracking multiple boolean flags and coordinating callbacks. The `LifecycleAwareComponent` abstract class provides a standardized pattern with five lifecycle states (initializing, ready, starting, stopping, active) and automatic callback invocation when states change. The callback stack pattern (`callStack`) ensures handlers execute in registration order and prevents duplicate notifications when state doesn't actually change. For WebSocket connections, database pools, or audio/video managers with multi-stage initialization, this eliminates race conditions and state inconsistencies that occur with ad-hoc flag management.

### Coordinated Multi-Process Orchestration

Applications with parallel async operations (bulk uploads, multi-step wizards, resource preloading) need orchestration for starting all processes, cancelling in-flight operations, or pausing work. `CoordinatedAsyncProcess` manages multiple `AsyncOperation` instances with `startAll()`, `cancelAll()`, and `pauseAll()` methods that operate on all registered processes atomically. This is critical for batch operations where partial completion is unacceptable (transaction-like behavior) or resource management where all operations must pause on throttling events. Trading platforms with multiple real-time data streams or ETL pipelines with parallel extract/transform jobs use this pattern to prevent resource exhaustion and ensure consistent operational state.

### Lightweight Alternative to Full Redux Stack

Redux provides powerful state management but introduces significant complexity (action creators, middleware, selector libraries, DevTools integration) for small to medium applications. This library distills Redux's core concepts (store, actions, reducers, subscriptions) into ~200 lines of code with a focused API for process state management. The pre-built reducer handles 90% of async operation state without custom reducers or action types. For applications that need predictable state patterns but don't require Redux's ecosystem (time-travel debugging, middleware composition, community plugins), this provides sufficient structure with minimal learning curve and bundle size.

### Type-Safe State Management with Explicit Contracts

Dynamic state management systems (global objects, event buses) suffer from unclear contracts and runtime errors from missing or misshapen state. This library enforces explicit `State` and `Action` interfaces with TypeScript, making state shape and allowed actions visible at development time. The `Handlers` type maps action types to handler functions with specific action payloads, preventing action type typos. Derived state computation through typed selectors (`StateDeriver`, `StateStatusDeriver`) ensures consistent state interpretation. For teams maintaining large codebases or onboarding new developers, type-enforced contracts prevent entire classes of state management bugs that plague loosely-typed systems.

## Installation

```bash
npm install @hyperfrontend/state-machine
```

**Dependencies:**

- `@hyperfrontend/data-utils` - Internal data utilities

## Quick Start

### Basic Store Usage

```typescript
import { Store } from '@hyperfrontend/state-machine/store'
import { start, success, fail } from '@hyperfrontend/state-machine/actions'

// Create store
const store = new Store()

// Subscribe to state changes
const unsubscribe = store.subscribe((state, action) => {
  console.log('State changed:', state, 'Action:', action.type)
})

// Dispatch actions
store.dispatch(start())
console.log(store.getState()) // { inProgress: true, success: false, fail: false, halt: false }

store.dispatch(success())
console.log(store.getState()) // { inProgress: false, success: true, fail: false, halt: false }

// Cleanup
unsubscribe()
```

### Async Operation with Automatic State Management

```typescript
import { AsyncOperation } from '@hyperfrontend/state-machine/async-operation'

// Define async process
const fetchUserData = async () => {
  const response = await fetch('/api/user')
  if (!response.ok) throw new Error('Failed to fetch')
  return response.json()
}

// Wrap with AsyncOperation
const operation = new AsyncOperation(fetchUserData)

// Listen to lifecycle events
operation.on('inProgress', (event, current, previous) => {
  console.log('Fetching user data...')
})

operation.on('successful', (event, current, previous) => {
  console.log('User data fetched successfully!')
})

operation.on('failed', (event, current, previous) => {
  console.error('Failed to fetch user data')
})

// Start operation (automatically dispatches start/success/fail)
await operation.start()
```

### Lifecycle-Aware Component

```typescript
import { LifecycleAwareComponent } from '@hyperfrontend/state-machine/lifecycle-aware-component'

class DatabaseConnection extends LifecycleAwareComponent {
  private connection: any = null

  protected init = async () => {
    this.setInitializing(true)
    this.connection = await createDatabaseConnection()
    this.setInitializing(false)
    this.setReady(true)
    return 'success'
  }

  public start = async () => {
    if (!this.ready) await this.init()
    this.setStarting(true)
    await this.connection.connect()
    this.setStarting(false)
    this.setActive(true)
    return 'success'
  }

  public stop = async () => {
    this.setStopping(true)
    await this.connection.disconnect()
    this.setStopping(false)
    this.setActive(false)
    return 'success'
  }
}

// Usage
const db = new DatabaseConnection()

db.onReadyStatusChange((ready) => {
  console.log(ready ? 'Database ready' : 'Database not ready')
})

db.onActiveStatusChange((active) => {
  console.log(active ? 'Database connected' : 'Database disconnected')
})

await db.start() // Triggers init → ready → starting → active
await db.stop() // Triggers stopping → inactive
```

### Coordinated Async Operations

```typescript
import { CoordinatedAsyncProcess } from '@hyperfrontend/state-machine/coordinated-async-operation'

const coordinator = new CoordinatedAsyncProcess()

coordinator
  .registerProcess(async () => {
    await loadImages()
  })
  .registerProcess(async () => {
    await loadStyles()
  })
  .registerProcess(async () => {
    await loadScripts()
  })

// Start all processes in parallel
await coordinator.startAll()

// Or cancel all if needed
coordinator.cancelAll()
```

## API Overview

### Core Modules

**Store Management:**

- `Store` - Central state container with dispatch/subscribe/getState
- `rootReducer` - Pre-built reducer for process state (START/PAUSE/CANCEL/SUCCESS/FAIL)

**Actions:**

- `start(...args)` - Dispatch START action
- `pause(...args)` - Dispatch PAUSE action
- `cancel(...args)` - Dispatch CANCEL action
- `success(...args)` - Dispatch SUCCESS action
- `fail(error)` - Dispatch FAIL action

**State Types:**

- `State` - Core state shape: `{ inProgress, success, fail, halt }`
- `DerivedState` - Computed state: `{ notStarted, inProgress, done, successful, failed, retrying, restarting, paused, cancelled }`
- `Action` - Base action type with `type` property
- `Event` - Event names for derived state transitions

**Async Operations:**

- `AsyncOperation` - Wraps async functions with automatic action dispatching
- `CoordinatedAsyncProcess` - Manages multiple async operations
- `AsyncProcess` - Type for async functions: `(...args: any[]) => Promise<void>`

**Lifecycle Components:**

- `LifecycleAwareComponent` - Abstract class with lifecycle state tracking
- Lifecycle properties: `initializing`, `ready`, `starting`, `stopping`, `active`
- Lifecycle callbacks: `onInitializingStatusChange`, `onReadyStatusChange`, `onStartStatusChange`, `onStopStatusChange`, `onActiveStatusChange`

**Events:**

- `Events` - Event dispatcher with derived state change detection
- Event types: `notStarted`, `inProgress`, `done`, `successful`, `failed`, `retrying`, `restarting`, `paused`, `cancelled`

**Selectors:**

- Functions for computing derived state from core state
- State status derivers for boolean flag computation

### Modular Exports

- `@hyperfrontend/state-machine/actions` - Action creators
- `@hyperfrontend/state-machine/store` - Store implementation
- `@hyperfrontend/state-machine/reducer` - Root reducer
- `@hyperfrontend/state-machine/state` - State utilities and initial state
- `@hyperfrontend/state-machine/selectors` - State selectors
- `@hyperfrontend/state-machine/events` - Event system
- `@hyperfrontend/state-machine/async-operation` - Async operation wrapper
- `@hyperfrontend/state-machine/coordinated-async-operation` - Multi-process coordination
- `@hyperfrontend/state-machine/lifecycle-aware-component` - Lifecycle component base class
- `@hyperfrontend/state-machine/models` - TypeScript types and interfaces

## Part of hyperfrontend

This library is part of the [hyperfrontend](https://github.com/AndrewRedican/hyperfrontend) monorepo.

## License

MIT
