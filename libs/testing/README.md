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

Jest-style describe, it, expect and jest on Node's built-in test runner, with module mocks, fake timers, an optional DOM and a coverage gate.

• 👉 See [**documentation**](https://www.hyperfrontend.dev/docs/libraries/testing/)
• 👉 See [**guides & tutorials**](https://www.hyperfrontend.dev/docs/guides/?package=%40hyperfrontend%2Ftesting)

## What is @hyperfrontend/testing?

[`@hyperfrontend/testing`](https://www.hyperfrontend.dev/docs/libraries/testing/) is a thin layer over Node's built-in test runner. It supplies the four things a suite written in the Jest idiom needs and `node:test` does not have: a [`describe`](https://www.hyperfrontend.dev/docs/libraries/testing/#api-describe) and [`it`](https://www.hyperfrontend.dev/docs/libraries/testing/#api-it) carrying Jest's modifiers, an [`expect`](https://www.hyperfrontend.dev/docs/libraries/testing/#api-expect) with Jest's matcher names, a [`jest`](https://www.hyperfrontend.dev/docs/libraries/testing/#api-jest) namespace for mock functions, spies and fake timers, and a loader that honours [`jest.mock`](https://www.hyperfrontend.dev/docs/libraries/testing/#api-JestApi) under native ES modules. Everything Node already provides, the runner, the lifecycle hooks, the assertion error, the coverage collector, is used as it is.

It is not [Jest](https://jestjs.io/) and does not try to be. The matcher set is closed, there are no snapshots, no watch mode and no HTML coverage report, and the places where behaviour differs are listed in the [architecture guide](https://www.hyperfrontend.dev/docs/libraries/testing/architecture/) rather than papered over. What it offers is the familiar shape of a Jest spec on a runtime that ships with Node, with no test framework installed.

### Key Features

- **[Jest-style describe and it](https://www.hyperfrontend.dev/docs/libraries/testing/#api-it)** - `.each`, `.only`, `.skip`, `.todo`, `.concurrent` and `.failing`, the [`done`](https://www.hyperfrontend.dev/docs/libraries/testing/#api-TestBody) callback and a trailing timeout, mapped onto `node:test`
- **[The expect you already know](https://www.hyperfrontend.dev/docs/libraries/testing/#api-expect)** - Twenty-eight matchers with Jest's semantics, `.not`, `.resolves` and `.rejects`, asymmetric matchers, and [`expect.assertions`](https://www.hyperfrontend.dev/docs/libraries/testing/#api-expect) verified once the test settles
- **[Mock functions and spies](https://www.hyperfrontend.dev/docs/libraries/testing/#api-JestApi)** - [`jest.fn`](https://www.hyperfrontend.dev/docs/libraries/testing/#api-JestApi) and [`jest.spyOn`](https://www.hyperfrontend.dev/docs/libraries/testing/#api-JestApi) record calls, results and `this`, queue once-only values, and restore on demand
- **[jest.mock under native ES modules](https://www.hyperfrontend.dev/docs/libraries/testing/hooks/)** - The preload reads [`jest.mock`](https://www.hyperfrontend.dev/docs/libraries/testing/#api-JestApi) out of a spec before its imports link, so factories, partial mocks, automocks and [`jest.requireActual`](https://www.hyperfrontend.dev/docs/libraries/testing/#api-JestApi) work without a transpiler
- **[Fake timers on Node's clock](https://www.hyperfrontend.dev/docs/libraries/testing/#api-JestApi)** - [`jest.useFakeTimers`](https://www.hyperfrontend.dev/docs/libraries/testing/#api-JestApi) drives Node's own fake clock, with the cascade-draining [`runAllTimers`](https://www.hyperfrontend.dev/docs/libraries/testing/#api-JestApi), [`clearAllTimers`](https://www.hyperfrontend.dev/docs/libraries/testing/#api-JestApi) and [`setSystemTime`](https://www.hyperfrontend.dev/docs/libraries/testing/#api-JestApi) filled in where Node has no primitive
- **[Optional DOM](https://www.hyperfrontend.dev/docs/libraries/testing/dom/)** - One preload copies a jsdom window onto the global for browser-facing suites; jsdom is an optional peer dependency and nothing else is installed
- **[Config-driven runner](https://www.hyperfrontend.dev/docs/libraries/testing/runner/)** - A `test.config.ts` declares environments, setup files, specifier redirects, timeouts and coverage, and [`runProjectTests`](https://www.hyperfrontend.dev/docs/libraries/testing/runner/#api-runProjectTests) runs one `node --test` per environment
- **[Coverage that cannot look away](https://www.hyperfrontend.dev/docs/libraries/testing/coverage/)** - Per-environment lcov reports are merged per file, thresholds are judged on the merged totals, and a source file no test loaded fails the run instead of vanishing from the report
- **Zero runtime dependencies** - Only Node built-ins at runtime, so the package adds nothing to a consumer's dependency tree beyond itself
- **TypeScript specs as written** - Specs, configuration and setup files run through Node's own type stripping; extensionless specifiers and tsconfig path aliases resolve, and JSON imports need no attribute

### Architecture Highlights

Nothing is injected into the global scope: a spec imports what it uses. The package's entries agree with each other however they are bundled, because the loader, the mock registry and the module generation meet on `globalThis` under registered symbols. The [architecture guide](https://www.hyperfrontend.dev/docs/libraries/testing/architecture/) covers the preload, the mock registry, the DOM preload, the runner and coverage pipeline, and the full table of behavioural differences from Jest with the reason for each.

## Why Use @hyperfrontend/testing?

### Fewer dependencies, same habits

Node ships a test runner, an assertion module, a module mocking facility, fake timers and a coverage collector. What it does not ship is the shape of a Jest spec, and that shape is what most teams have in their fingers. This package supplies the shape and nothing else, so the install is one package with no runtime dependencies instead of a framework, a transformer and a reporter.

### A migration, not a rewrite

Suites written against Jest keep their [`describe`](https://www.hyperfrontend.dev/docs/libraries/testing/#api-describe) blocks, matchers, mock functions and [`jest.mock`](https://www.hyperfrontend.dev/docs/libraries/testing/#api-JestApi) declarations as written. The lifecycle hooks come from `node:test`, the configuration file changes shape, and the differences that remain are listed in [Migrate a Jest suite to Node's test runner](https://www.hyperfrontend.dev/docs/guides/migrate-from-jest-to-node-test/) rather than discovered one failing test at a time.

### Coverage you can trust

Node's coverage omits files no test loaded and counts a re-evaluated module once per evaluation. The runner merges the lcov records per file, judges thresholds on the merged totals, and fails a run that left an included source file unmeasured, so a full-coverage gate guarantees what it says.

### With thanks to Jest

Jest set the vocabulary this package speaks. `expect(value).toEqual(...)`, `jest.fn()` and `jest.mock('./module')` read the way they do because Jest made them read that way for a decade of JavaScript developers, and the familiarity that gives a new team member is Jest's achievement, not this package's. Jest remains the fuller tool, with snapshots, a watch mode, custom matchers, an interactive runner and an ecosystem of reporters and environments. This package is for the case where Node's built-ins are enough and the familiar syntax is what you want to keep.

### Who it is for

Teams moving suites written against Jest onto Node's built-in runner, and anyone who wants Jest-style assertions and mocks with no test framework installed. A project that depends on snapshot testing, custom matchers, watch mode or an HTML coverage report should keep Jest, or choose a framework that provides them. The migration this package came out of, 11,900 tests across 934 spec files, is written up in [I Replaced Jest With 1,200 Lines of Code. I'd Do It Again.](https://www.hyperfrontend.dev/articles/i-replaced-jest-with-1200-lines-of-code/)

## Installation

```bash
npm install --save-dev @hyperfrontend/testing
```

The package needs Node.js 22.18 or later: the preload installs synchronous module hooks and loads TypeScript specs through Node's own type stripping, neither of which older releases provide. It declares no runtime dependencies.

A DOM is opt-in. Install jsdom alongside the package when a suite needs `document`; only the [`/dom`](https://www.hyperfrontend.dev/docs/libraries/testing/dom/) entry imports it.

```bash
npm install --save-dev jsdom
```

## Quick Start

### A spec

```typescript
import { afterEach, beforeEach, before as beforeAll, after as afterAll } from 'node:test'
import { describe, expect, it, jest } from '@hyperfrontend/testing'
import { createCart } from './cart'

jest.mock('./pricing', () => ({
  priceOf: (sku: string) => (sku === 'tea' ? 3 : 5),
}))

describe('cart', () => {
  let cart: ReturnType<typeof createCart>

  beforeEach(() => {
    cart = createCart()
  })

  it('totals the priced lines', () => {
    cart.add('tea', 2)
    expect(cart.total()).toBe(6)
  })

  it.each([
    ['tea', 3],
    ['coffee', 5],
  ])('prices %s at %d', (sku: string, price: number) => {
    cart.add(sku, 1)
    expect(cart.total()).toBe(price)
  })

  it('notifies subscribers once per change', () => {
    const onChange = jest.fn()
    cart.subscribe(onChange)
    cart.add('tea', 1)
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ total: 3 }))
  })
})
```

Lifecycle hooks come straight from `node:test`, which already has them; Node's [`before`](https://nodejs.org/api/test.html#beforefn-options) and [`after`](https://nodejs.org/api/test.html#afterfn-options) play the parts Jest gives beforeAll and afterAll. Take [`describe`](https://www.hyperfrontend.dev/docs/libraries/testing/#api-describe) and [`it`](https://www.hyperfrontend.dev/docs/libraries/testing/#api-it) from this package even in files that use no modifier: it is the package's [`it`](https://www.hyperfrontend.dev/docs/libraries/testing/#api-it) that checks [`expect.assertions`](https://www.hyperfrontend.dev/docs/libraries/testing/#api-expect) once the body settles. Nothing is global: [`expect`](https://www.hyperfrontend.dev/docs/libraries/testing/#api-expect) and [`jest`](https://www.hyperfrontend.dev/docs/libraries/testing/#api-jest) are imports too.

### Running with node --test

```bash
node --import @hyperfrontend/testing/hooks --test 'src/**/*.spec.ts'
```

The [`/hooks`](https://www.hyperfrontend.dev/docs/libraries/testing/hooks/) preload is what makes the spec above loadable: it resolves extensionless and aliased specifiers and reads the [`jest.mock`](https://www.hyperfrontend.dev/docs/libraries/testing/#api-JestApi) calls out of each spec before its imports link. Add the [`/dom`](https://www.hyperfrontend.dev/docs/libraries/testing/dom/) preload after it when a suite needs a browser-shaped global, and `--test-only` when a suite relies on `.only`.

### Running from a configuration

A `test.config.ts` takes the place of a Jest configuration, and a short script drives it. [`runProjectTests`](https://www.hyperfrontend.dev/docs/libraries/testing/runner/#api-runProjectTests) runs one `node --test` per environment, merges the coverage reports and judges them; the script decides what to print and what the exit code is.

```typescript
import type { TestConfig } from '@hyperfrontend/testing/runner'

const config: TestConfig = {
  environments: [{ name: 'node', testMatch: ['src/**/*.spec.ts'] }],
  coverageInclude: ['src/**/*.ts'],
  coverageThresholds: { lines: 100, branches: 95, functions: 100 },
}

export default config
```

```typescript
import { runProjectTests } from '@hyperfrontend/testing/runner'
import config from './test.config.ts'

const outcome = runProjectTests(config, {
  workspaceRoot: import.meta.dirname,
  projectRoot: import.meta.dirname,
  coverageDir: `${import.meta.dirname}/coverage`,
})

for (const row of outcome.coverageTable) console.log(row)
for (const failure of outcome.failures) console.error(failure)
process.exitCode = outcome.success ? 0 : 1
```

Every field, including a second environment with a DOM and setup files, is on the [`/runner`](https://www.hyperfrontend.dev/docs/libraries/testing/runner/) page, and [Configure and run TypeScript tests on Node's test runner](https://www.hyperfrontend.dev/docs/guides/run-typescript-tests-on-node-test/) walks through a full setup.

## API Overview

The root entry is the spec surface. [`describe`](https://www.hyperfrontend.dev/docs/libraries/testing/#api-describe) and [`it`](https://www.hyperfrontend.dev/docs/libraries/testing/#api-it) wrap their `node:test` namesakes and add the modifiers Node lacks. [`expect`](https://www.hyperfrontend.dev/docs/libraries/testing/#api-expect) carries the twenty-eight matchers listed on [`Assertions`](https://www.hyperfrontend.dev/docs/libraries/testing/#api-Assertions), each reachable through `.not`, `.resolves` and `.rejects`, with the asymmetric matchers and the assertion counters as statics. A failed matcher throws Node's own [`AssertionError`](https://nodejs.org/api/assert.html#class-assertassertionerror), and the comparison behind the matchers is exported as [`equals`](https://www.hyperfrontend.dev/docs/libraries/testing/#api-equals) and [`matchesSubset`](https://www.hyperfrontend.dev/docs/libraries/testing/#api-matchesSubset).

[`jest`](https://www.hyperfrontend.dev/docs/libraries/testing/#api-jest) is one object with three jobs: mock functions and spies, whose surface is [`MockFn`](https://www.hyperfrontend.dev/docs/libraries/testing/#api-MockFn); the fake clock; and the module controls [`jest.mock`](https://www.hyperfrontend.dev/docs/libraries/testing/#api-JestApi), [`jest.doMock`](https://www.hyperfrontend.dev/docs/libraries/testing/#api-JestApi), [`jest.requireActual`](https://www.hyperfrontend.dev/docs/libraries/testing/#api-JestApi) and [`jest.resetModules`](https://www.hyperfrontend.dev/docs/libraries/testing/#api-JestApi). Every member is listed on [`JestApi`](https://www.hyperfrontend.dev/docs/libraries/testing/#api-JestApi).

The other entries are the machinery around a run. The root entry never re-exports the two that act the moment they are imported.

| Entry                                                                         | What it is                                                                                                                                                                                                      |
| ----------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`/hooks`](https://www.hyperfrontend.dev/docs/libraries/testing/hooks/)       | The `node --import` preload: path aliases, extensionless specifiers, specifier redirects and [`jest.mock`](https://www.hyperfrontend.dev/docs/libraries/testing/#api-JestApi) replacements                      |
| [`/dom`](https://www.hyperfrontend.dev/docs/libraries/testing/dom/)           | The preload that copies a jsdom window onto the global                                                                                                                                                          |
| [`/reporter`](https://www.hyperfrontend.dev/docs/libraries/testing/reporter/) | Node's spec reporter with the per-evaluation coverage summary held back                                                                                                                                         |
| [`/runner`](https://www.hyperfrontend.dev/docs/libraries/testing/runner/)     | [`runProjectTests`](https://www.hyperfrontend.dev/docs/libraries/testing/runner/#api-runProjectTests) and the [`TestConfig`](https://www.hyperfrontend.dev/docs/libraries/testing/runner/#api-TestConfig) types |
| [`/coverage`](https://www.hyperfrontend.dev/docs/libraries/testing/coverage/) | The lcov merge, the threshold gate, the per-file table and the completeness check                                                                                                                               |

Every option, type and signature is in the [API reference](https://www.hyperfrontend.dev/docs/libraries/testing/#api-reference).

## Limitations

- Snapshot matchers, custom matchers, watch mode and every part of the Jest object not listed on [`JestApi`](https://www.hyperfrontend.dev/docs/libraries/testing/#api-JestApi) are not provided. A spec that needs them is a spec to keep on Jest.
- Coverage is V8 through Node's collector. There is no statements metric and no HTML report, branch percentages read lower than istanbul's, and `/* node:coverage ignore next N */` replaces `/* istanbul ignore */`.
- [`it.only`](https://www.hyperfrontend.dev/docs/libraries/testing/#api-ItApi) is honoured only under `--test-only`, which [`runProjectTests`](https://www.hyperfrontend.dev/docs/libraries/testing/runner/#api-runProjectTests) does not pass; a focused run is a hand-run `node --test --test-only`.
- [`jest.mock`](https://www.hyperfrontend.dev/docs/libraries/testing/#api-JestApi) is read out of files named as specs (`.spec` or `.test` before the extension) and out of declared setup files, never out of a helper a spec imports.
- Fake timers cover `setTimeout`, `setInterval`, [`setImmediate`](https://nodejs.org/api/timers.html#setimmediatecallback-args) and `Date`; `process.nextTick`, `queueMicrotask` and `performance` stay real.

The full table of behavioural differences, with the reason for each, is in [Where behaviour differs from Jest](https://www.hyperfrontend.dev/docs/libraries/testing/architecture/#where-behaviour-differs-from-jest).

## Compatibility

[`@hyperfrontend/testing`](https://www.hyperfrontend.dev/docs/libraries/testing/) runs on Node.js 22.18 or later and nowhere else. The [`/hooks`](https://www.hyperfrontend.dev/docs/libraries/testing/hooks/) entry installs synchronous module hooks through `module.registerHooks`, which arrived in Node 22.15, and specs are loaded through type stripping, which Node 22.18 was the first release to enable without a flag; the runner selects spec files with `fs.globSync` from Node 22. There is no Node 18 or 20 support, and none is planned: the primitives the package is built on do not exist there.

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

Each entry ships both formats. No browser bundle is published: the package drives Node's test runner, so an IIFE or UMD build would have nothing to run against.

### Peer Dependencies

| Package | Version   | Type     |
| ------- | --------- | -------- |
| jsdom   | >= 26.0.0 | Optional |

Only the [`/dom`](https://www.hyperfrontend.dev/docs/libraries/testing/dom/) entry imports jsdom. A project that never preloads it never needs it installed.

## Part of hyperfrontend

This library is part of the [hyperfrontend](https://github.com/AndrewRedican/hyperfrontend) monorepo.

**📖 [Full documentation](https://www.hyperfrontend.dev/docs/libraries/testing)**

- Runs the test suites of every other hyperfrontend library, and its own, through the same runner and gate it publishes

## License

[MIT](https://github.com/AndrewRedican/hyperfrontend/blob/main/LICENSE.md)
