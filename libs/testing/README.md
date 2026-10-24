# @hyperfrontend/testing

<p align="center">
  <a href="https://github.com/AndrewRedican/hyperfrontend/actions/workflows/ci-lib-testing.yml">
    <img src="https://img.shields.io/github/actions/workflow/status/AndrewRedican/hyperfrontend/ci-lib-testing.yml?style=flat-square&logo=github&label=build" alt="Build">
  </a>
  <a href="https://codecov.io/gh/AndrewRedican/hyperfrontend/flags?flags%5B0%5D=testing">
    <img src="https://codecov.io/gh/AndrewRedican/hyperfrontend/graph/badge.svg?flag=testing" alt="Coverage">
  </a>
  <a href="https://www.npmjs.com/package/@hyperfrontend/testing">
    <img src="https://img.shields.io/npm/v/@hyperfrontend/testing?style=flat-square" alt="npm version">
  </a>
  <a href="https://bundlephobia.com/package/@hyperfrontend/testing">
    <img src="https://img.shields.io/bundlephobia/min/%40hyperfrontend%2Ftesting?style=flat-square" alt="npm bundle size">
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
  <a href="https://www.npmjs.com/package/@hyperfrontend/testing">
    <img src="https://img.shields.io/npm/dm/@hyperfrontend/testing?style=flat-square" alt="npm downloads">
  </a>
  <a href="https://github.com/AndrewRedican/hyperfrontend">
    <img src="https://img.shields.io/github/stars/AndrewRedican/hyperfrontend?style=flat-square" alt="GitHub stars">
  </a>
  <img src="https://img.shields.io/badge/node-%3E%3D22.18.0-brightgreen?style=flat-square&logo=node.js" alt="Node Version">
  <img src="https://img.shields.io/badge/tree%20shakeable-%E2%9C%93-success?style=flat-square" alt="Tree Shakeable">
</p>

<p align="center">
  <a href="https://www.hyperfrontend.dev/docs/libraries/testing/">
    <img width="640" height="360" src="https://www.hyperfrontend.dev/media/testing-bridge/hero.gif" alt="A Jest-style spec, cart.spec.ts, types itself onto a sheet line by line, each call opening with its package chip; as each line lands a wire draws across to the Node primitive it rests on, describe and it to node:test, expect to node:assert with a count rising to 2, jest.mock to module.registerHooks and jest.useFakeTimers to mock.timers, each label lighting as its wire arrives; the verdict returns along the test's wire as a green check, the runner's coverage figure counts up to line 100.00, branch 95.65 and funcs 100.00, and a tick lands beside it">
  </a>
</p>

A lightweight Jest-like testing library built on native Node capabilities.

• 👉 See [**documentation**](https://www.hyperfrontend.dev/docs/libraries/testing/)
• 👉 See [**guides & tutorials**](https://www.hyperfrontend.dev/docs/guides/?package=%40hyperfrontend%2Ftesting)

## What is @hyperfrontend/testing?

[`@hyperfrontend/testing`](https://www.hyperfrontend.dev/docs/libraries/testing/) lets you write tests the way you would for Jest and run them on Node's built-in test runner. It adds only what Node lacks and leaves the rest to Node.

It is not [Jest](https://jestjs.io/), which remains the fuller tool. It is for projects where Node's built-ins are enough and the familiar syntax is worth keeping.

### Key Features

- **[The Jest syntax you know](https://www.hyperfrontend.dev/docs/libraries/testing/#api-expect)** - Describe blocks, matchers, mock functions and spies read the way a Jest suite already does
- **[Module mocks without a transpiler](https://www.hyperfrontend.dev/docs/libraries/testing/hooks/)** - Factories, partial mocks and automocks apply under native ES modules before a spec's imports link
- **[Fake timers on Node's clock](https://www.hyperfrontend.dev/docs/libraries/testing/#api-JestApi)** - Advance time, drain pending timers and set the system time from inside a test
- **[A coverage gate you can trust](https://www.hyperfrontend.dev/docs/libraries/testing/coverage/)** - A source file no test loaded fails the run instead of quietly vanishing from the report
- **[Optional DOM](https://www.hyperfrontend.dev/docs/libraries/testing/dom/)** - One preload gives browser-facing suites a jsdom window; suites that do not need it never install it
- **TypeScript specs as written** - Node's own type stripping runs them, with extensionless imports and tsconfig path aliases resolved
- **[The helpers suites keep rewriting](https://www.hyperfrontend.dev/docs/libraries/testing/#api-createMock)** - Typed object mocks, condition waits, self-cleaning temporary directories, and stand-ins for a terminal, the standard streams and child processes

### Architecture Highlights

Nothing is injected into the global scope: a spec imports what it uses. The [architecture guide](https://www.hyperfrontend.dev/docs/libraries/testing/architecture/) covers the preload, the mock registry and the coverage pipeline.

## Why Use @hyperfrontend/testing?

### Fewer dependencies, same habits

Node already ships a test runner, assertions, module mocking, fake timers and coverage. This package adds the shape of a Jest spec on top: one dev dependency instead of a framework, a transformer and a reporter, with nothing but Node built-ins at runtime.

### A migration, not a rewrite

Jest suites keep their describe blocks, matchers and module mocks as written. [Migrate a Jest suite to Node's test runner](https://www.hyperfrontend.dev/docs/guides/migrate-from-jest-to-node-test/) lists what does change.

## Installation

```bash
npm install --save-dev @hyperfrontend/testing
```

Add jsdom as well only if a suite needs a DOM.

## Quick Start

```typescript
import { beforeEach } from 'node:test'
import { describe, expect, it, jest } from '@hyperfrontend/testing'
import { createCart } from './cart'

jest.mock('./pricing', () => ({ priceOf: () => 3 }))

describe('cart', () => {
  let cart: ReturnType<typeof createCart>

  beforeEach(() => {
    cart = createCart()
  })

  it('totals the priced lines', () => {
    cart.add('tea', 2)
    expect(cart.total()).toBe(6)
  })

  it('notifies subscribers once per change', () => {
    const onChange = jest.fn()
    cart.subscribe(onChange)
    cart.add('tea', 1)
    expect(onChange).toHaveBeenCalledTimes(1)
  })
})
```

```bash
node --import @hyperfrontend/testing/hooks --test 'src/**/*.spec.ts'
```

Lifecycle hooks come straight from `node:test`. The [`/hooks`](https://www.hyperfrontend.dev/docs/libraries/testing/hooks/) preload lets the spec load as TypeScript with its module mock in place.

For several environments, setup files and a coverage gate, declare a `test.config.ts` and run it with [`runProjectTests`](https://www.hyperfrontend.dev/docs/libraries/testing/runner/#api-runProjectTests). [Configure and run TypeScript tests on Node's test runner](https://www.hyperfrontend.dev/docs/guides/run-typescript-tests-on-node-test/) walks through a full setup.

## API Overview

| Entry                                                                             | What it is                                                     |
| --------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| [`@hyperfrontend/testing`](https://www.hyperfrontend.dev/docs/libraries/testing/) | What a spec imports                                            |
| [`/hooks`](https://www.hyperfrontend.dev/docs/libraries/testing/hooks/)           | The `node --import` preload: TypeScript resolution and mocks   |
| [`/dom`](https://www.hyperfrontend.dev/docs/libraries/testing/dom/)               | The preload that puts a jsdom window on the global             |
| [`/fs`](https://www.hyperfrontend.dev/docs/libraries/testing/fs/)                 | Temporary directories and fixture trees written from data      |
| [`/process`](https://www.hyperfrontend.dev/docs/libraries/testing/process/)       | Terminal, standard stream and child process stand-ins          |
| [`/runner`](https://www.hyperfrontend.dev/docs/libraries/testing/runner/)         | The config-driven runner, one `node --test` per environment    |
| [`/coverage`](https://www.hyperfrontend.dev/docs/libraries/testing/coverage/)     | The lcov merge and the threshold gate                          |
| [`/reporter`](https://www.hyperfrontend.dev/docs/libraries/testing/reporter/)     | Node's spec reporter without the per-evaluation coverage noise |

Every matcher, option and signature is in the [API reference](https://www.hyperfrontend.dev/docs/libraries/testing/#api-reference).

## Limitations

- No snapshots, custom matchers or watch mode. A suite that depends on them should stay on Jest.
- Coverage is V8 through Node's collector: no statements metric and no HTML report.

The full list is in [Where behaviour differs from Jest](https://www.hyperfrontend.dev/docs/libraries/testing/architecture/#where-behaviour-differs-from-jest).

## Compatibility

Requires Node.js 22.18 or later. There is no browser build.

<!-- hf:media start id="runtimes" scene="runtimes-testing" asset="runtimes" docs="#compatibility" alt="Runs in Node.js 22.18 or later; not a target for evergreen browsers and web workers" -->

| Environment     | Supported |
| --------------- | :-------: |
| Node.js >= 22   |    ✅     |
| Modern Browsers |    ❌     |
| Web Workers     |    ❌     |

<!-- hf:media end -->

### Output Formats

| Format | File        | Tree-Shakeable |
| ------ | ----------- | :------------: |
| ESM    | `index.mjs` |       ✅       |
| CJS    | `index.cjs` |       ❌       |

### Peer Dependencies

| Package | Version   | Type     |
| ------- | --------- | -------- |
| jsdom   | >= 26.0.0 | Optional |

## Part of hyperfrontend

This library is part of the [hyperfrontend](https://github.com/AndrewRedican/hyperfrontend) monorepo.

**📖 [Full documentation](https://www.hyperfrontend.dev/docs/libraries/testing)**

## License

[MIT](https://github.com/AndrewRedican/hyperfrontend/blob/main/LICENSE.md)
