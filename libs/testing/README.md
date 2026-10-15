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

It is not Jest and does not try to be. The matcher set is closed, there are no snapshots, no watch mode and no HTML coverage report, and the places where behaviour differs are listed in this document rather than papered over. What it offers is the familiar shape of a Jest spec on a runtime that ships with Node, with no test framework installed.

### Key Features

- **[Jest-style describe and it](https://www.hyperfrontend.dev/docs/libraries/testing/#api-it)** - The modifiers Jest users reach for, `.each`, `.only`, `.skip`, `.todo`, `.concurrent` and `.failing`, plus the [`done`](https://www.hyperfrontend.dev/docs/libraries/testing/#api-TestBody) callback and a trailing timeout, mapped onto `node:test`
- **[The expect you already know](https://www.hyperfrontend.dev/docs/libraries/testing/#api-expect)** - Twenty-eight matcher names with Jest's semantics, `.not`, `.resolves` and `.rejects`, asymmetric matchers, and [`expect.assertions`](https://www.hyperfrontend.dev/docs/libraries/testing/#api-expect) verified once the test settles
- **[Mock functions and spies](https://www.hyperfrontend.dev/docs/libraries/testing/#api-JestApi)** - [`jest.fn`](https://www.hyperfrontend.dev/docs/libraries/testing/#api-JestApi) and [`jest.spyOn`](https://www.hyperfrontend.dev/docs/libraries/testing/#api-JestApi) record calls, results and `this`, queue once-only values, and restore on demand
- **[jest.mock under native ES modules](https://www.hyperfrontend.dev/docs/libraries/testing/hooks/)** - The preload reads [`jest.mock`](https://www.hyperfrontend.dev/docs/libraries/testing/#api-JestApi) out of a spec before its imports link, so factories, partial mocks, automocks and [`jest.requireActual`](https://www.hyperfrontend.dev/docs/libraries/testing/#api-JestApi) work without a transpiler
- **[Fake timers on Node's clock](https://www.hyperfrontend.dev/docs/libraries/testing/#api-JestApi)** - [`jest.useFakeTimers`](https://www.hyperfrontend.dev/docs/libraries/testing/#api-JestApi) drives Node's own fake clock, with the cascade-draining [`runAllTimers`](https://www.hyperfrontend.dev/docs/libraries/testing/#api-JestApi), [`clearAllTimers`](https://www.hyperfrontend.dev/docs/libraries/testing/#api-JestApi) and [`setSystemTime`](https://www.hyperfrontend.dev/docs/libraries/testing/#api-JestApi) filled in where Node has no primitive
- **[Optional DOM](https://www.hyperfrontend.dev/docs/libraries/testing/dom/)** - One preload copies a jsdom window onto the global for browser-facing suites; jsdom is an optional peer dependency and nothing else is installed
- **[Config-driven runner](https://www.hyperfrontend.dev/docs/libraries/testing/runner/)** - A `test.config.ts` declares environments, setup files, specifier redirects, timeouts and coverage, and [`runProjectTests`](https://www.hyperfrontend.dev/docs/libraries/testing/runner/#api-runProjectTests) runs one `node --test` per environment
- **[Coverage that cannot look away](https://www.hyperfrontend.dev/docs/libraries/testing/coverage/)** - Per-environment lcov reports are merged per file, thresholds are judged on the merged totals, and a source file no test loaded fails the run instead of vanishing from the report
- **Zero runtime dependencies** - Only Node built-ins at runtime, so the package adds nothing to a consumer's dependency tree beyond itself
- **TypeScript specs as written** - Specs, configuration and setup files run through Node's own type stripping, extensionless specifiers and tsconfig path aliases resolve, and JSON imports need no attribute

### Architecture Highlights

Nothing is injected into the global scope: a spec imports what it uses. The loader, the mock registry and the module generation meet on `globalThis` under registered symbols, so the package's entries agree with each other however they are bundled. Depth belongs to the [architecture guide](https://www.hyperfrontend.dev/docs/libraries/testing/architecture/), which covers the preload, the mock registry, the DOM preload, the runner and coverage pipeline, and the full table of behavioural differences from Jest with the reason for each.

## Why Use @hyperfrontend/testing?

### Fewer dependencies, same habits

Node ships a test runner, an assertion module, a module mocking facility, fake timers and a coverage collector. What it does not ship is the shape of a Jest spec, and that shape is what most teams have in their fingers. This package supplies the shape and nothing else, so the install is one package with no runtime dependencies instead of a framework, a transformer and a reporter.

### A migration, not a rewrite

Suites written against Jest keep their [`describe`](https://www.hyperfrontend.dev/docs/libraries/testing/#api-describe) blocks, matchers, mock functions and [`jest.mock`](https://www.hyperfrontend.dev/docs/libraries/testing/#api-JestApi) declarations as written. The lifecycle hooks come from `node:test`, the configuration file changes shape, and the differences that remain are listed in [Migrating from Jest](#migrating-from-jest) rather than discovered one failing test at a time.

### Coverage you can trust

Node's coverage omits files no test loaded and counts a re-evaluated module once per evaluation. The runner merges the lcov records per file, judges thresholds on the merged totals, and fails a run that left an included source file unmeasured, so a full-coverage gate guarantees what it says.

### With thanks to Jest

Jest set the vocabulary this package speaks. `expect(value).toEqual(...)`, `jest.fn()` and `jest.mock('./module')` read the way they do because Jest made them read that way for a decade of JavaScript developers, and the familiarity that gives a new team member is Jest's achievement, not this package's. Jest remains the fuller tool, with snapshots, a watch mode, custom matchers, an interactive runner and an ecosystem of reporters and environments. This package is for the case where Node's built-ins are enough and the familiar syntax is what you want to keep.

### Who it is for

Teams moving suites written against Jest onto Node's built-in runner, and anyone who wants Jest-style assertions and mocks with no test framework installed. A project that depends on snapshot testing, [`expect.extend`](https://jestjs.io/docs/expect#expectextendmatchers), watch mode or an HTML coverage report should keep Jest, or choose a framework that provides them.

## Installation

```bash
npm install --save-dev @hyperfrontend/testing
```

The package needs Node.js 22.18 or later: the preload installs synchronous module hooks and loads TypeScript specs through Node's own type stripping, neither of which older releases provide. It declares no runtime dependencies.

A DOM is opt-in. Install jsdom alongside the package when a suite needs `document`; the [`/dom`](https://www.hyperfrontend.dev/docs/libraries/testing/dom/) entry imports it, and nothing else does.

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

Lifecycle hooks come straight from `node:test`, which already has them; its [`before`](https://nodejs.org/api/test.html#beforefn-options) and [`after`](https://nodejs.org/api/test.html#afterfn-options) are what Jest calls [`beforeAll`](https://jestjs.io/docs/api#beforeallfn-timeout) and [`afterAll`](https://jestjs.io/docs/api#afterallfn-timeout). Take [`describe`](https://www.hyperfrontend.dev/docs/libraries/testing/#api-describe) and [`it`](https://www.hyperfrontend.dev/docs/libraries/testing/#api-it) from this package even in files that use no modifier: it is the package's [`it`](https://www.hyperfrontend.dev/docs/libraries/testing/#api-it) that resets the assertion counter and checks [`expect.assertions`](https://www.hyperfrontend.dev/docs/libraries/testing/#api-expect) once the body settles, and a spec running on Node's own [`it`](https://nodejs.org/api/test.html#itname-options-fn) would declare a count nobody verifies. Nothing is global: [`expect`](https://www.hyperfrontend.dev/docs/libraries/testing/#api-expect) and [`jest`](https://www.hyperfrontend.dev/docs/libraries/testing/#api-jest) are imports too.

### Running with node --test

```bash
node --import @hyperfrontend/testing/hooks --test 'src/**/*.spec.ts'
```

The [`/hooks`](https://www.hyperfrontend.dev/docs/libraries/testing/hooks/) preload is what makes the spec above loadable: it resolves extensionless and aliased specifiers, applies specifier redirects, and reads the [`jest.mock`](https://www.hyperfrontend.dev/docs/libraries/testing/#api-JestApi) calls out of each spec before its imports link. Add the [`/dom`](https://www.hyperfrontend.dev/docs/libraries/testing/dom/) preload after it when a suite needs a browser-shaped global, and `--test-only` when a suite relies on `.only`:

```bash
node --import @hyperfrontend/testing/hooks \
  --import @hyperfrontend/testing/dom \
  --test 'src/**/*.browser.spec.ts'
```

### Running from a configuration

A `test.config.ts` takes the place of a Jest configuration. Each environment is its own `node --test` run, selecting its own files and loading its own setup modules; the coverage settings apply to the project as a whole:

```typescript
import type { TestConfig } from '@hyperfrontend/testing/runner'

const config: TestConfig = {
  environments: [
    {
      name: 'node',
      testMatch: ['src/**/*.spec.ts'],
      testIgnore: ['**/*.browser.spec.ts'],
    },
    {
      name: 'browser',
      testMatch: ['src/**/*.browser.spec.ts'],
      dom: true,
      setupFiles: ['test.setup.ts'],
    },
  ],
  coverageInclude: ['src/**/*.ts'],
  coverageExclude: ['src/**/index.ts'],
  coverageThresholds: { lines: 100, branches: 95, functions: 100 },
  moduleNameMapper: { '^@app/(.*)$': '<rootDir>/src/$1' },
  testTimeout: 10_000,
}

export default config
```

A short script drives it. [`runProjectTests`](https://www.hyperfrontend.dev/docs/libraries/testing/runner/#api-runProjectTests) spawns the runs, merges the reports and judges them; the script decides what to print and what the exit code is:

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

```bash
node run-tests.ts
```

The run leaves `lcov.<environment>.info` per environment and a merged lcov.info in the coverage directory, with paths relative to the workspace root so a coverage service can match them to the repository. A package script, a task runner target or a CI step can each be the driver; the package ships no command line of its own.

## API Overview

The root entry is the spec surface. [`describe`](https://www.hyperfrontend.dev/docs/libraries/testing/#api-describe) and [`it`](https://www.hyperfrontend.dev/docs/libraries/testing/#api-it) wrap their `node:test` namesakes and add what Node lacks: [`.each`](https://www.hyperfrontend.dev/docs/libraries/testing/#api-ItApi) over an array of rows (an array row is spread across the parameters, anything else arrives as one argument, and the title takes `%s`, `%d`, `%i`, `%f`, `%j`, `%o`, `%p`, `%#` and `%%`), [`.only`](https://www.hyperfrontend.dev/docs/libraries/testing/#api-ItApi) and [`.skip`](https://www.hyperfrontend.dev/docs/libraries/testing/#api-ItApi) on both, and [`.todo`](https://www.hyperfrontend.dev/docs/libraries/testing/#api-ItApi), [`.concurrent`](https://www.hyperfrontend.dev/docs/libraries/testing/#api-ItApi) and [`.failing`](https://www.hyperfrontend.dev/docs/libraries/testing/#api-ItApi) on [`it`](https://www.hyperfrontend.dev/docs/libraries/testing/#api-it). A body may take the [`done`](https://www.hyperfrontend.dev/docs/libraries/testing/#api-TestBody) callback; a trailing number is the per-test timeout in milliseconds.

[`expect`](https://www.hyperfrontend.dev/docs/libraries/testing/#api-expect) carries a closed set of matchers, small enough to list. Equality and identity: [`toBe`](https://www.hyperfrontend.dev/docs/libraries/testing/#api-Assertions), [`toEqual`](https://www.hyperfrontend.dev/docs/libraries/testing/#api-Assertions), [`toStrictEqual`](https://www.hyperfrontend.dev/docs/libraries/testing/#api-Assertions), [`toMatchObject`](https://www.hyperfrontend.dev/docs/libraries/testing/#api-Assertions). Presence and type: [`toBeDefined`](https://www.hyperfrontend.dev/docs/libraries/testing/#api-Assertions), [`toBeUndefined`](https://www.hyperfrontend.dev/docs/libraries/testing/#api-Assertions), [`toBeNull`](https://www.hyperfrontend.dev/docs/libraries/testing/#api-Assertions), [`toBeNaN`](https://www.hyperfrontend.dev/docs/libraries/testing/#api-Assertions), [`toBeTruthy`](https://www.hyperfrontend.dev/docs/libraries/testing/#api-Assertions), [`toBeFalsy`](https://www.hyperfrontend.dev/docs/libraries/testing/#api-Assertions), [`toBeInstanceOf`](https://www.hyperfrontend.dev/docs/libraries/testing/#api-Assertions). Numbers: [`toBeGreaterThan`](https://www.hyperfrontend.dev/docs/libraries/testing/#api-Assertions), [`toBeGreaterThanOrEqual`](https://www.hyperfrontend.dev/docs/libraries/testing/#api-Assertions), [`toBeLessThan`](https://www.hyperfrontend.dev/docs/libraries/testing/#api-Assertions), [`toBeLessThanOrEqual`](https://www.hyperfrontend.dev/docs/libraries/testing/#api-Assertions), [`toBeCloseTo`](https://www.hyperfrontend.dev/docs/libraries/testing/#api-Assertions).

Collections and strings: [`toHaveLength`](https://www.hyperfrontend.dev/docs/libraries/testing/#api-Assertions), [`toContain`](https://www.hyperfrontend.dev/docs/libraries/testing/#api-Assertions), [`toContainEqual`](https://www.hyperfrontend.dev/docs/libraries/testing/#api-Assertions), [`toMatch`](https://www.hyperfrontend.dev/docs/libraries/testing/#api-Assertions), [`toHaveProperty`](https://www.hyperfrontend.dev/docs/libraries/testing/#api-Assertions). Mocks: [`toHaveBeenCalled`](https://www.hyperfrontend.dev/docs/libraries/testing/#api-Assertions), [`toHaveBeenCalledTimes`](https://www.hyperfrontend.dev/docs/libraries/testing/#api-Assertions), [`toHaveBeenCalledWith`](https://www.hyperfrontend.dev/docs/libraries/testing/#api-Assertions), [`toHaveBeenLastCalledWith`](https://www.hyperfrontend.dev/docs/libraries/testing/#api-Assertions), [`toHaveBeenNthCalledWith`](https://www.hyperfrontend.dev/docs/libraries/testing/#api-Assertions). Errors: [`toThrow`](https://www.hyperfrontend.dev/docs/libraries/testing/#api-Assertions) and its alias [`toThrowError`](https://www.hyperfrontend.dev/docs/libraries/testing/#api-Assertions), accepting a message fragment, a pattern, an error class, an error whose message must match, or an object shape.

Every matcher is reachable through `.not`, and through `.resolves` and `.rejects`, which await the subject first and return promises. The statics are the asymmetric matchers [`expect.any`](https://www.hyperfrontend.dev/docs/libraries/testing/#api-expect), [`expect.anything`](https://www.hyperfrontend.dev/docs/libraries/testing/#api-expect), [`expect.objectContaining`](https://www.hyperfrontend.dev/docs/libraries/testing/#api-expect), [`expect.arrayContaining`](https://www.hyperfrontend.dev/docs/libraries/testing/#api-expect), [`expect.stringContaining`](https://www.hyperfrontend.dev/docs/libraries/testing/#api-expect), [`expect.stringMatching`](https://www.hyperfrontend.dev/docs/libraries/testing/#api-expect) and [`expect.closeTo`](https://www.hyperfrontend.dev/docs/libraries/testing/#api-expect), their negations under [`expect.not`](https://www.hyperfrontend.dev/docs/libraries/testing/#api-expect), and the counters [`expect.assertions`](https://www.hyperfrontend.dev/docs/libraries/testing/#api-expect) and [`expect.hasAssertions`](https://www.hyperfrontend.dev/docs/libraries/testing/#api-expect).

A failed matcher throws Node's own [`AssertionError`](https://nodejs.org/api/assert.html#class-assertassertionerror) with its actual, expected and operator fields filled in, so reporters and editors treat it like any `node:assert` failure. The comparison behind the matchers is exported as [`equals`](https://www.hyperfrontend.dev/docs/libraries/testing/#api-equals) and [`matchesSubset`](https://www.hyperfrontend.dev/docs/libraries/testing/#api-matchesSubset) for code that needs the same answer outside an assertion.

[`jest`](https://www.hyperfrontend.dev/docs/libraries/testing/#api-jest) is one object with three jobs. Mocks: [`jest.fn`](https://www.hyperfrontend.dev/docs/libraries/testing/#api-JestApi) returns a [`MockFn`](https://www.hyperfrontend.dev/docs/libraries/testing/#api-MockFn) whose [`mock`](https://www.hyperfrontend.dev/docs/libraries/testing/#api-MockState) record holds [`calls`](https://www.hyperfrontend.dev/docs/libraries/testing/#api-MockState), [`results`](https://www.hyperfrontend.dev/docs/libraries/testing/#api-MockState), [`instances`](https://www.hyperfrontend.dev/docs/libraries/testing/#api-MockState), [`lastCall`](https://www.hyperfrontend.dev/docs/libraries/testing/#api-MockState) and [`invocationCallOrder`](https://www.hyperfrontend.dev/docs/libraries/testing/#api-MockState), and which takes [`mockImplementation`](https://www.hyperfrontend.dev/docs/libraries/testing/#api-MockFn), [`mockReturnValue`](https://www.hyperfrontend.dev/docs/libraries/testing/#api-MockFn), [`mockResolvedValue`](https://www.hyperfrontend.dev/docs/libraries/testing/#api-MockFn), [`mockRejectedValue`](https://www.hyperfrontend.dev/docs/libraries/testing/#api-MockFn), each with a once-only variant, plus [`mockReturnThis`](https://www.hyperfrontend.dev/docs/libraries/testing/#api-MockFn), [`mockName`](https://www.hyperfrontend.dev/docs/libraries/testing/#api-MockFn), [`mockClear`](https://www.hyperfrontend.dev/docs/libraries/testing/#api-MockFn), [`mockReset`](https://www.hyperfrontend.dev/docs/libraries/testing/#api-MockFn) and [`mockRestore`](https://www.hyperfrontend.dev/docs/libraries/testing/#api-MockFn); [`jest.spyOn`](https://www.hyperfrontend.dev/docs/libraries/testing/#api-JestApi) replaces a method, or a getter or setter, with a mock that calls through until restored; [`jest.mocked`](https://www.hyperfrontend.dev/docs/libraries/testing/#api-JestApi) narrows a value for the type checker; and [`clearAllMocks`](https://www.hyperfrontend.dev/docs/libraries/testing/#api-JestApi), [`resetAllMocks`](https://www.hyperfrontend.dev/docs/libraries/testing/#api-JestApi) and [`restoreAllMocks`](https://www.hyperfrontend.dev/docs/libraries/testing/#api-JestApi) reach every mock created in the process.

Timers: [`useFakeTimers`](https://www.hyperfrontend.dev/docs/libraries/testing/#api-JestApi) installs Node's fake clock over `setTimeout`, `setInterval`, [`setImmediate`](https://nodejs.org/api/timers.html#setimmediatecallback-args) and `Date`, taking [`doNotFake`](https://www.hyperfrontend.dev/docs/libraries/testing/#api-FakeTimerOptions) and [`now`](https://www.hyperfrontend.dev/docs/libraries/testing/#api-FakeTimerOptions); [`advanceTimersByTime`](https://www.hyperfrontend.dev/docs/libraries/testing/#api-JestApi), [`advanceTimersByTimeAsync`](https://www.hyperfrontend.dev/docs/libraries/testing/#api-JestApi), [`runAllTimers`](https://www.hyperfrontend.dev/docs/libraries/testing/#api-JestApi), [`runOnlyPendingTimers`](https://www.hyperfrontend.dev/docs/libraries/testing/#api-JestApi), [`clearAllTimers`](https://www.hyperfrontend.dev/docs/libraries/testing/#api-JestApi), [`setSystemTime`](https://www.hyperfrontend.dev/docs/libraries/testing/#api-JestApi) and [`useRealTimers`](https://www.hyperfrontend.dev/docs/libraries/testing/#api-JestApi) drive it. Modules: [`jest.mock`](https://www.hyperfrontend.dev/docs/libraries/testing/#api-JestApi) and [`jest.unmock`](https://www.hyperfrontend.dev/docs/libraries/testing/#api-JestApi) are read out of the spec's source by the preload and have no runtime work left to do, [`jest.doMock`](https://www.hyperfrontend.dev/docs/libraries/testing/#api-JestApi) registers a replacement for modules imported after it, [`jest.requireActual`](https://www.hyperfrontend.dev/docs/libraries/testing/#api-JestApi) and [`jest.requireMock`](https://www.hyperfrontend.dev/docs/libraries/testing/#api-JestApi) read the real module and the factory's product, and [`jest.resetModules`](https://www.hyperfrontend.dev/docs/libraries/testing/#api-JestApi) makes later dynamic imports evaluate their target again.

The other entries are the machinery around a run, and the root entry never re-exports the two that act on import. [`/hooks`](https://www.hyperfrontend.dev/docs/libraries/testing/hooks/) is the `node --import` preload that installs the resolution hooks. [`/dom`](https://www.hyperfrontend.dev/docs/libraries/testing/dom/) is the preload that installs the jsdom window. [`/reporter`](https://www.hyperfrontend.dev/docs/libraries/testing/reporter/) is Node's spec reporter minus the per-evaluation coverage summary. [`/runner`](https://www.hyperfrontend.dev/docs/libraries/testing/runner/) holds [`runProjectTests`](https://www.hyperfrontend.dev/docs/libraries/testing/runner/#api-runProjectTests), the pieces it is built from ([`buildRunPlan`](https://www.hyperfrontend.dev/docs/libraries/testing/runner/#api-buildRunPlan), [`withDefaults`](https://www.hyperfrontend.dev/docs/libraries/testing/runner/#api-withDefaults), [`BASELINE_COVERAGE_EXCLUDE`](https://www.hyperfrontend.dev/docs/libraries/testing/runner/#api-BASELINE_COVERAGE_EXCLUDE)) and the configuration types [`TestConfig`](https://www.hyperfrontend.dev/docs/libraries/testing/runner/#api-TestConfig), [`TestEnvironment`](https://www.hyperfrontend.dev/docs/libraries/testing/runner/#api-TestEnvironment), [`CoverageThresholds`](https://www.hyperfrontend.dev/docs/libraries/testing/runner/#api-CoverageThresholds), [`RunContext`](https://www.hyperfrontend.dev/docs/libraries/testing/runner/#api-RunContext) and [`RunOutcome`](https://www.hyperfrontend.dev/docs/libraries/testing/runner/#api-RunOutcome).

[`/coverage`](https://www.hyperfrontend.dev/docs/libraries/testing/coverage/) holds the lcov merge ([`mergeLcov`](https://www.hyperfrontend.dev/docs/libraries/testing/coverage/#api-mergeLcov), [`renderLcov`](https://www.hyperfrontend.dev/docs/libraries/testing/coverage/#api-renderLcov)), the arithmetic ([`fileTotals`](https://www.hyperfrontend.dev/docs/libraries/testing/coverage/#api-fileTotals), [`overallTotals`](https://www.hyperfrontend.dev/docs/libraries/testing/coverage/#api-overallTotals), [`percentOf`](https://www.hyperfrontend.dev/docs/libraries/testing/coverage/#api-percentOf), [`uncoveredRanges`](https://www.hyperfrontend.dev/docs/libraries/testing/coverage/#api-uncoveredRanges)), the gate ([`findThresholdShortfalls`](https://www.hyperfrontend.dev/docs/libraries/testing/coverage/#api-findThresholdShortfalls), [`renderCoverageTable`](https://www.hyperfrontend.dev/docs/libraries/testing/coverage/#api-renderCoverageTable)) and the completeness check ([`findUnmeasuredFiles`](https://www.hyperfrontend.dev/docs/libraries/testing/coverage/#api-findUnmeasuredFiles)).

Every option, type and signature is in the [API reference](https://www.hyperfrontend.dev/docs/libraries/testing/#api-reference).

## Migrating from Jest

### What stays

[`describe`](https://www.hyperfrontend.dev/docs/libraries/testing/#api-describe) and [`it`](https://www.hyperfrontend.dev/docs/libraries/testing/#api-it) with `.each`, `.only`, `.skip`, `.todo`, `.concurrent` and `.failing`; [`expect`](https://www.hyperfrontend.dev/docs/libraries/testing/#api-expect) with the matchers listed above, the asymmetric matchers, `.not`, `.resolves`, `.rejects`, [`expect.assertions`](https://www.hyperfrontend.dev/docs/libraries/testing/#api-expect) and [`expect.hasAssertions`](https://www.hyperfrontend.dev/docs/libraries/testing/#api-expect); [`jest.fn`](https://www.hyperfrontend.dev/docs/libraries/testing/#api-JestApi), [`jest.spyOn`](https://www.hyperfrontend.dev/docs/libraries/testing/#api-JestApi), [`jest.mocked`](https://www.hyperfrontend.dev/docs/libraries/testing/#api-JestApi) and the three `*AllMocks` resets; the fake timer controls; [`jest.mock`](https://www.hyperfrontend.dev/docs/libraries/testing/#api-JestApi), [`jest.unmock`](https://www.hyperfrontend.dev/docs/libraries/testing/#api-JestApi), [`jest.doMock`](https://www.hyperfrontend.dev/docs/libraries/testing/#api-JestApi), [`jest.requireActual`](https://www.hyperfrontend.dev/docs/libraries/testing/#api-JestApi), [`jest.requireMock`](https://www.hyperfrontend.dev/docs/libraries/testing/#api-JestApi) and [`jest.resetModules`](https://www.hyperfrontend.dev/docs/libraries/testing/#api-JestApi); [`moduleNameMapper`](https://www.hyperfrontend.dev/docs/libraries/testing/runner/#api-TestConfig) and [`setupFiles`](https://www.hyperfrontend.dev/docs/libraries/testing/runner/#api-TestEnvironment) in the configuration.

### What changes

- **Imports.** Nothing is global. [`describe`](https://www.hyperfrontend.dev/docs/libraries/testing/#api-describe), [`it`](https://www.hyperfrontend.dev/docs/libraries/testing/#api-it), [`expect`](https://www.hyperfrontend.dev/docs/libraries/testing/#api-expect) and [`jest`](https://www.hyperfrontend.dev/docs/libraries/testing/#api-jest) are imported from the package; there is no [`test`](https://jestjs.io/docs/api#testname-fn-timeout) alias, so import [`it`](https://www.hyperfrontend.dev/docs/libraries/testing/#api-it) under that name if a suite uses it. The hooks come from `node:test`, with [`before`](https://nodejs.org/api/test.html#beforefn-options) and [`after`](https://nodejs.org/api/test.html#afterfn-options) standing in for [`beforeAll`](https://jestjs.io/docs/api#beforeallfn-timeout) and [`afterAll`](https://jestjs.io/docs/api#afterallfn-timeout), and a hook timeout is passed as `{ timeout }` rather than a trailing number.
- **Configuration.** A `test.config.ts` exporting a [`TestConfig`](https://www.hyperfrontend.dev/docs/libraries/testing/runner/#api-TestConfig) replaces the Jest configuration. Environments select files by glob instead of by docblock, a DOM is a per-environment flag, and [`setupFilesAfterEnv`](https://jestjs.io/docs/configuration#setupfilesafterenv-array) becomes [`setupFiles`](https://www.hyperfrontend.dev/docs/libraries/testing/runner/#api-TestEnvironment). The default timeout is 30 seconds and there is no [`jest.setTimeout`](https://jestjs.io/docs/jest-object#jestsettimeouttimeout); set [`testTimeout`](https://www.hyperfrontend.dev/docs/libraries/testing/runner/#api-TestConfig) or pass a trailing timeout to one test.
- **Coverage.** The provider is V8 through Node's collector, not istanbul. There is no statements metric, so a statements threshold is carried by [`lines`](https://www.hyperfrontend.dev/docs/libraries/testing/runner/#api-CoverageThresholds); branch percentages read lower because V8 counts the untaken side of default parameters and optional chaining; `/* istanbul ignore */` does nothing and `/* node:coverage ignore next N */` is the replacement; there is no HTML report, only the per-file table and the lcov files.
- **Not provided.** Snapshot matchers, [`expect.extend`](https://jestjs.io/docs/expect#expectextendmatchers) and custom matchers, watch mode, [`jest.isolateModules`](https://jestjs.io/docs/jest-object#jestisolatemodulesfn), [`jest.retryTimes`](https://jestjs.io/docs/jest-object#jestretrytimesnumretries-options) and the rest of the [`jest`](https://www.hyperfrontend.dev/docs/libraries/testing/#api-jest) surface not listed above. A spec that needs them is a spec to keep on Jest.

### Behavioural differences

The places where the same call cannot behave exactly as it did under Jest, and what it does instead.

| Concern                                                                                         | What this package does                                                                                                                                                                                                                                                                           |
| ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Coverage provider                                                                               | V8 through Node's collector, not istanbul. `/* istanbul ignore */` has no effect; use `/* node:coverage ignore next N */`. Branch percentages read lower because V8 counts default parameters and optional chaining.                                                                             |
| Files no test loaded                                                                            | Node omits them from the report. The completeness check fails the run and names each one, which is what a full-coverage threshold is meant to guarantee.                                                                                                                                         |
| Re-evaluated modules                                                                            | Node measures each evaluation as a file of its own, so a suite calling [`jest.resetModules`](https://www.hyperfrontend.dev/docs/libraries/testing/#api-JestApi) would be judged once per generation. The gate merges the records per file and judges the thresholds itself.                      |
| statements                                                                                      | Node has no such metric. Carry a statements threshold as [`lines`](https://www.hyperfrontend.dev/docs/libraries/testing/runner/#api-CoverageThresholds).                                                                                                                                         |
| [`it.todo`](https://www.hyperfrontend.dev/docs/libraries/testing/#api-ItApi)                    | Any body is ignored, as under Jest. `node:test` on its own would run it.                                                                                                                                                                                                                         |
| [`it.only`](https://www.hyperfrontend.dev/docs/libraries/testing/#api-ItApi)                    | Honoured only when Node runs with `--test-only`; without the flag every test runs. [`runProjectTests`](https://www.hyperfrontend.dev/docs/libraries/testing/runner/#api-runProjectTests) does not pass it.                                                                                       |
| [`expect.assertions`](https://www.hyperfrontend.dev/docs/libraries/testing/#api-expect)         | Verified when a body returns or its promise settles. A body that takes the [`done`](https://www.hyperfrontend.dev/docs/libraries/testing/#api-TestBody) callback is not checked.                                                                                                                 |
| Fake timers                                                                                     | Only `setTimeout`, `setInterval`, [`setImmediate`](https://nodejs.org/api/timers.html#setimmediatecallback-args) and `Date` are faked. `process.nextTick`, `queueMicrotask`, `requestAnimationFrame` and `performance` stay real.                                                                |
| [`runAllTimers`](https://www.hyperfrontend.dev/docs/libraries/testing/#api-JestApi)             | Node's own drain runs only the queue as it stood when called. The queue is re-run until no timeout is outstanding, which is what Jest does, and abandoned after a thousand passes. [`runOnlyPendingTimers`](https://www.hyperfrontend.dev/docs/libraries/testing/#api-JestApi) is the same call. |
| [`clearAllTimers`](https://www.hyperfrontend.dev/docs/libraries/testing/#api-JestApi)           | Node has no primitive, so the clock is torn down and rebuilt at the same instant.                                                                                                                                                                                                                |
| [`advanceTimersByTimeAsync`](https://www.hyperfrontend.dev/docs/libraries/testing/#api-JestApi) | Advances the clock, then yields one microtask turn so promise callbacks the timers scheduled settle before the caller asserts.                                                                                                                                                                   |
| Timer delays                                                                                    | A delay below one millisecond is raised to one, as the real schedulers do. A spy on the scheduler still records what the caller passed.                                                                                                                                                          |
| Partial mocks                                                                                   | A factory naming only some exports leaves the rest reachable and real. Under Jest they were undefined, but under ES modules importing an undefined name is a link error that stops the whole file.                                                                                               |
| Automocks                                                                                       | [`jest.mock`](https://www.hyperfrontend.dev/docs/libraries/testing/#api-JestApi) with no factory replaces every export with a fresh [`jest.fn`](https://www.hyperfrontend.dev/docs/libraries/testing/#api-JestApi). The module is loaded once to learn its export names.                         |
| Namespace spies                                                                                 | [`jest.spyOn`](https://www.hyperfrontend.dev/docs/libraries/testing/#api-JestApi) on an ES module namespace cannot work: the namespace is sealed and importers bind the name at link time. Declare a replacement whose factory wraps the function instead.                                       |
| [`jest.doMock`](https://www.hyperfrontend.dev/docs/libraries/testing/#api-JestApi)              | Reaches modules imported after it, never ones already linked. Call [`jest.resetModules`](https://www.hyperfrontend.dev/docs/libraries/testing/#api-JestApi) first, then declare the replacement, then import dynamically.                                                                        |
| Where [`jest.mock`](https://www.hyperfrontend.dev/docs/libraries/testing/#api-JestApi) is read  | Out of files recognised by name, `.spec` or `.test` before `.ts`, `.tsx`, `.mts`, `.cts`, `.js`, `.jsx`, `.mjs` or `.cjs`, and out of declared setup files. A declaration in a helper module a spec imports is not read.                                                                         |
| [`each`](https://www.hyperfrontend.dev/docs/libraries/testing/#api-ItApi) tables                | The array form only. The tagged template form is not supported.                                                                                                                                                                                                                                  |
| Decorators                                                                                      | Node's type stripping does not parse them. A decorated class in a spec applies its decorator explicitly, the way the compiler would.                                                                                                                                                             |
| Test counting                                                                                   | A test that stubs `process.stdout.write` across an `await` makes `node:test` drop the preceding test from its counts. The exit code is unaffected, so the verdict stays correct.                                                                                                                 |
| HTML report                                                                                     | None. A run produces the per-file table, lcov.info with the merged records, and `lcov.<environment>.info` with each environment's raw report.                                                                                                                                                    |

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
