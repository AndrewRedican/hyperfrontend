# @hyperfrontend/state-machine

<p align="center">
  <a href="https://github.com/AndrewRedican/hyperfrontend/actions/workflows/ci-lib-state-machine.yml">
    <img src="https://img.shields.io/github/actions/workflow/status/AndrewRedican/hyperfrontend/ci-lib-state-machine.yml?style=flat-square&logo=github&label=build" alt="Build">
  </a>
  <a href="https://codecov.io/gh/AndrewRedican/hyperfrontend/flags?flags%5B0%5D=state-machine">
    <img src="https://codecov.io/gh/AndrewRedican/hyperfrontend/graph/badge.svg?flag=state-machine" alt="Coverage">
  </a>
  <a href="https://www.npmjs.com/package/@hyperfrontend/state-machine">
    <img src="https://img.shields.io/npm/v/@hyperfrontend/state-machine?style=flat-square" alt="npm version">
  </a>
  <a href="https://bundlephobia.com/package/@hyperfrontend/state-machine">
    <img src="https://img.shields.io/bundlephobia/min/%40hyperfrontend%2Fstate-machine?style=flat-square" alt="npm bundle size">
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
  <a href="https://www.npmjs.com/package/@hyperfrontend/state-machine">
    <img src="https://img.shields.io/npm/dm/@hyperfrontend/state-machine?style=flat-square" alt="npm downloads">
  </a>
  <a href="https://github.com/AndrewRedican/hyperfrontend">
    <img src="https://img.shields.io/github/stars/AndrewRedican/hyperfrontend?style=flat-square" alt="GitHub stars">
  </a>
  <img src="https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen?style=flat-square&logo=node.js" alt="Node Version">
  <img src="https://img.shields.io/badge/tree%20shakeable-%E2%9C%93-success?style=flat-square" alt="Tree Shakeable">
</p>

<p align="center">
  <a href="https://www.hyperfrontend.dev/docs/libraries/state-machine/">
    <img width="640" src="https://www.hyperfrontend.dev/media/state-machine-derived/hero.gif" alt="Code on the left dispatches start, fail, start, success, start into a store while the panel on the right repaints the four booleans and names the derived states they add up to: notStarted, inProgress, failed, retrying, restarting">
  </a>
</p>
<p align="center">
  <sub>The same start() dispatched three times. START keeps the previous outcome, so the second call lands in retrying and the third in restarting.</sub>
</p>

Lightweight, functional state management library with Redux-inspired actions/reducers, async operation orchestration, and lifecycle-aware component abstractions for predictable application state.

• 👉 See [**documentation**](https://www.hyperfrontend.dev/docs/libraries/state-machine/)
• 👉 See [**API reference**](https://www.hyperfrontend.dev/docs/libraries/state-machine/#api-reference)
• 👉 See [**guides & tutorials**](https://www.hyperfrontend.dev/docs/guides/?package=%40hyperfrontend%2Fstate-machine)

## What is @hyperfrontend/state-machine?

Most state libraries let you model anything. This one models one thing well: the lifecycle of an async operation. Four booleans go in (`inProgress`, `success`, `fail`, `halt`) and named states come out, and the interesting ones are the combinations a lone `isLoading` flag throws away. Running after a failure is `retrying`, not another first attempt. Running after a success is `restarting`, which is the state a table is in while it refreshes with the old rows still on screen. Never run at all is `notStarted`, which is usually a different screen from a spinner. Those distinctions come out of the same start, success, and fail dispatches you were going to write anyway.

There is no framework here and no third-party dependency: no provider to mount, no hook, no adapter. `Store` is a subscribe and dispatch container over one reducer. `AsyncOperation` wraps a promise-returning function and dispatches start, success, and fail around it so you can listen for events instead of polling flags. `LifecycleAwareComponent` is a base class for anything with an init step, and it closes the usual startup race: a callback registered after the component is already ready fires immediately rather than waiting for a transition that has been and gone.

Reach for Redux, Zustand, or XState when you want what they bring with them: devtools and time travel, a middleware ecosystem, or real statecharts with guards, hierarchy, and parallel regions. This library has none of that and is not trying to grow it.

At a glance:

```typescript
import { start, success, fail } from '@hyperfrontend/state-machine/actions'
import { derivedState } from '@hyperfrontend/state-machine/selectors'
import { Store } from '@hyperfrontend/state-machine/store'

const store = new Store()
store.subscribe((state) => render(derivedState(state)))

store.dispatch(start()) // inProgress
store.dispatch(fail(new Error('offline'))) // failed, done
store.dispatch(start()) // retrying: running, and the previous attempt failed
store.dispatch(success()) // successful, done
store.dispatch(start()) // restarting: running, with a good result still on screen
```

### Key Features

- **Redux-inspired architecture** - Central store with immutable state, action dispatching, and pure reducers
- **Pre-built process reducer** - Ready-to-use reducer for START/PAUSE/CANCEL/SUCCESS/FAIL action types
- **Derived state computation** - Automatic computation of notStarted, done, paused, cancelled, retrying, restarting from core state
- **Event-driven notifications** - Observer pattern with event handlers triggered when specific derived states activate
- **Async operation wrapper** - `AsyncOperation` class that automatically dispatches actions for promise lifecycles
- **Coordinated async processes** - `CoordinatedAsyncProcess` for managing multiple async operations with startAll/cancelAll/pauseAll
- **Lifecycle-aware components** - Abstract class with initializing/ready/starting/stopping/active state tracking and callbacks
- **Modular exports** - Tree-shakeable secondary entry points for actions, reducers, selectors, events, and async operations
- **No third-party runtime dependencies** - Only two hyperfrontend utility packages, nothing outside the org

### Architecture Highlights

Event handlers are edge-triggered: a handler for `retrying` fires on the transition into that derived state, not on every dispatch that leaves the flag true, so you get one notification per activation. Every dispatch replaces the state object rather than mutating it, so the state a subscriber receives can be compared by reference; `getState()` returns a fresh shallow copy on each call and is not a reference to compare against.

For a detailed technical deep dive, see the [architecture guide](https://www.hyperfrontend.dev/docs/libraries/state-machine/architecture/).

## Why Use @hyperfrontend/state-machine?

### The states you actually need are the ones a loading flag cannot express

`isLoading` plus `error` is two booleans and four combinations, and none of them record what happened last time. It cannot tell a first load from a refresh, so the spinner covers rows you could have kept on screen. It cannot tell a retry from a first attempt, so the error banner vanishes the moment you try again and nobody can see that a second attempt is running. Here those are `restarting` and `retrying`, both falling out of the start and fail dispatches you were already making, and `notStarted` stays distinct from `inProgress`, so an empty screen and a loading screen are different renders.

### Nothing to mount, nothing to adapt

There is no provider, no hook, no framework binding, no third-party package pulled in behind it. `store.subscribe` returns its own unsubscribe, `AsyncOperation` is a class you can hold in a closure, and both work the same in a React effect, a Svelte store, a worker, or a plain script. That matters most in the places a framework store cannot reach: a shared module, an SDK, an embed, a Node process.

### Init races handled by the base class, not by convention

Anything with a startup step has the same bug waiting in it: something subscribes after initialization finished and never hears about it. `LifecycleAwareComponent` fires a freshly registered `onReadyStatusChange` or `onActiveStatusChange` callback right away if the component is already in that state, and its setters skip the notification entirely when a value has not changed, so subscribers get one call per real transition and never miss the one that already happened.

### Coordination that is honest about what it can do

`CoordinatedAsyncProcess` registers several processes and gives you `startAll()`, `pauseAll()`, and `cancelAll()`. Be clear on what cancel means: it marks the operations halted, it does not abort a promise already in flight. If your work needs a real abort, pass an `AbortSignal` into the process yourself and use this for the state around it.

## Installation

```bash
npm install @hyperfrontend/state-machine
```

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
console.log(store.getState())
// { inProgress: true, success: false, fail: false, halt: false }

store.dispatch(success())
console.log(store.getState())
// { inProgress: false, success: true, fail: false, halt: false }

// Cleanup
unsubscribe()
```

### Async Operation with Automatic State Management

```typescript
import { AsyncOperation } from '@hyperfrontend/state-machine/async-operation'

// AsyncProcess is () => Promise<void>, so keep the result outside it
let user: User | null = null

const fetchUser = async () => {
  const response = await fetch('/api/user')
  if (!response.ok) throw new Error(`User request failed: ${response.status}`)
  user = await response.json()
}

const operation = new AsyncOperation(fetchUser)

// start, success, and fail are dispatched for you; you listen instead of polling flags
operation.on('inProgress', () => showSpinner())
operation.on('successful', () => render(user))
operation.on('failed', () => showError())

// second call after a failure lands in retrying, after a success in restarting
operation.on('retrying', () => keepErrorBannerUp())
operation.on('restarting', () => keepStaleRowsVisible())

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

The whole state is four booleans: `inProgress`, `success`, `fail`, and `halt`. A [`Store`](https://www.hyperfrontend.dev/docs/libraries/state-machine/store/#api-Store) holds one copy of them, five action creators (`start`, `pause`, `cancel`, `success`, `fail`) are the only things that move them, and `START` is the handler that carries history forward: it sets `inProgress` and leaves whatever `success` or `fail` was already there. That is the whole trick, and everything else reads those four flags back.

Reading them back is what the selectors do. Ten of them take a state and return a boolean, and [`derivedState`](https://www.hyperfrontend.dev/docs/libraries/state-machine/selectors/#api-derivedState) computes the set in a single call and hands back a named object to render from. `notStarted`, `inProgress`, `done`, `successful`, `failed`, `halted`, `paused`, and `cancelled` are the ones you would expect. The two that pay for the package are [`retrying`](https://www.hyperfrontend.dev/docs/libraries/state-machine/selectors/#api-retrying), true while an attempt runs after a failure, so the error banner can stay up instead of blinking off, and [`restarting`](https://www.hyperfrontend.dev/docs/libraries/state-machine/selectors/#api-restarting), true while a refresh runs with a good result still on screen, so a table can keep its rows. A lone `isLoading` is true at both of those moments and at a first load, and says the same thing at all three.

Two classes do that dispatching for you. [`AsyncOperation`](https://www.hyperfrontend.dev/docs/libraries/state-machine/async-operation/#api-AsyncOperation) takes a `() => Promise<void>`, dispatches start before it and success or fail after it, and lets you listen by derived-state name: `on('retrying', handler)` fires on the transition into that state, once per activation. [`CoordinatedAsyncProcess`](https://www.hyperfrontend.dev/docs/libraries/state-machine/coordinated-async-operation/#api-CoordinatedAsyncProcess) is that wrapper over a set of processes, with `startAll()`, `pauseAll()`, and `cancelAll()`. [`LifecycleAwareComponent`](https://www.hyperfrontend.dev/docs/libraries/state-machine/lifecycle-aware-component/#api-LifecycleAwareComponent) tracks a different lifecycle: the initializing, ready, starting, stopping, and active of a long-lived object, where a callback registered after that state is already true is called straight away rather than waiting for a transition that has been and gone.

Every folder is its own entry point, so an import can take just the surface you need. Reach for `/selectors` and `/models` when something else already owns the state and you only want to read and type it; `/store`, `/actions`, `/reducer`, and `/state` to drive the flags yourself; `/events` and `/state-change` for the edge-triggered dispatcher and the previous-versus-current pair it compares; and `/async-operation`, `/coordinated-async-operation`, or `/lifecycle-aware-component` when you would rather a class did the dispatching. The root entry re-exports all of it, which is the easier start and the one the bundler can still tree-shake.

Every action, selector, event name, and type is in the [API reference](https://www.hyperfrontend.dev/docs/libraries/state-machine/#api-reference).

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
<script src="https://unpkg.com/@hyperfrontend/state-machine"></script>

<!-- jsDelivr -->
<script src="https://cdn.jsdelivr.net/npm/@hyperfrontend/state-machine"></script>

<script>
  const { Store, AsyncOperation } = HyperfrontendStateMachine
  const { start, success, fail } = HyperfrontendStateMachine
</script>
```

**Global variable:** `HyperfrontendStateMachine`

## Part of hyperfrontend

This library is part of the [hyperfrontend](https://github.com/AndrewRedican/hyperfrontend) monorepo.

**📖 [Full documentation](https://www.hyperfrontend.dev/docs/libraries/state-machine)**

## License

[MIT](https://github.com/AndrewRedican/hyperfrontend/blob/main/LICENSE.md)
