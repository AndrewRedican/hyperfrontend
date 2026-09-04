# @hyperfrontend/testing

The workspace's test runtime. It sits on top of Node's built-in test runner and supplies
the four things `node:test` does not: module resolution the workspace's sources rely on,
a Jest-compatible `expect`, a Jest-compatible `jest` namespace, and a coverage gate that
notices files no test ever loaded.

Private to the repository. Never published.

## Why it exists

The suites here were written against Jest, and there are roughly 11,400 of them. Porting
18,000 assertions to `node:assert` would have rewritten the corpus rather than migrated
it, so the assertion and mocking surfaces are reimplemented instead. Everything Node can
serve directly is still taken from `node:test`.

The package deliberately depends on **no workspace library**. Every library's specs
import it, so a dependency the other way would close a cycle in the Nx graph, and the
runtime must stay unobservable to code that mocks the `built-in-copy` modules. That is
why `no-unsafe-builtin-methods` and `no-direct-console` are disabled here and nowhere
else.

## What a spec imports

Hooks come from `node:test`, which serves them directly. `describe`, `it`, `expect` and
`jest` come from here.

```typescript
import { beforeEach, afterEach, before as beforeAll, after as afterAll } from 'node:test'
import { describe, expect, it, jest } from '@hyperfrontend/testing'
```

`describe` and `it` are taken from this package everywhere rather than only in the files
that need `.each`, `.failing`, `.concurrent` or the `done` callback. `expect.assertions`
is the reason: it is the shim's `it` that resets the counter and checks it once the body
settles, so a spec running on `node:test`'s own `it` would declare an assertion count that
is never verified. That failure is silent, which makes it the wrong thing to leave to a
per-file judgement.

```typescript
import { it } from '@hyperfrontend/testing'

it.each([1, 2, 3])('doubles %d', (value: number) => {
  expect(double(value)).toBe(value * 2)
})
```

## What a project configures

Each project carries a `test.config.ts` in place of its old `jest.config.ts`:

```typescript
import type { TestConfig } from '@hyperfrontend/testing'

const config: TestConfig = {
  environments: [{ name: 'node', testMatch: ['src/**/*.spec.ts'] }],
  coverageInclude: ['src/**/*.ts'],
  coverageThresholds: { lines: 100, branches: 100, functions: 100 },
}

export default config
```

`nx test <project>` runs it through the `@hyperfrontend/package:test` executor.

### A project that needs a DOM

Node has no environment concept, so a DOM is a preload. An environment declaring `dom`
gets a jsdom window copied onto the global before its suites run, and before its own setup
modules, which may therefore assume `document` exists.

```typescript
environments: [{ name: 'browser', testMatch: ['src/**/*.spec.ts'], dom: true, setupFiles: ['test.setup.ts'] }]
```

Only what jsdom owns is copied. The realm's own intrinsics stay, so `instanceof` keeps
agreeing with itself across the process; the timer functions stay Node's, because those are
what the fake clock replaces; and `crypto`, `URL` and `URLSearchParams` stay Node's, which
is what gives a browser suite a working `crypto.subtle` without any further override.

### A project that mocks a module for every spec

A module named in `setupFiles` may declare `jest.mock`, and the replacement applies to every
spec in the environment. This is what a Jest `setupFilesAfterEach` module did. A spec
declaring its own replacement for the same module is read later and wins.

## Layout

| Path               | What it holds                                                                                                                                     |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/hooks/`       | The `--import` entry, workspace path aliases, extensionless specifiers, `moduleNameMapper`, and the generation counter behind `jest.resetModules` |
| `src/expect/`      | Structural equality, the matcher table, asymmetric matchers, and the `expect` surface                                                             |
| `src/mock/`        | `jest.fn`, `jest.spyOn`, the reset registries, and the fake clock                                                                                 |
| `src/blocks/`      | `describe` and `it` variants carrying the modifiers `node:test` lacks                                                                             |
| `src/coverage/`    | The lcov merge, the threshold gate, and the completeness check                                                                                    |
| `src/environment/` | The jsdom preload an environment declaring `dom` loads                                                                                            |
| `src/runner/`      | Per-project configuration, argv construction, and the process the executor spawns                                                                 |

## Behavioural differences from Jest

These are the places the runtime cannot be identical, and what it does instead.

| Concern            | Difference                                                                                                                                                                                                                                                                                                                         |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Coverage provider  | V8, not istanbul. `/* istanbul ignore */` has no effect; use `/* node:coverage ignore next N */`. Branch percentages read lower because V8 counts default parameters and optional chaining.                                                                                                                                        |
| Unloaded files     | Node omits them from the report entirely. The completeness check fails the run instead, restoring what a full-coverage threshold is meant to guarantee.                                                                                                                                                                            |
| Re-evaluated files | Node measures each evaluation of a module as a file of its own, so a suite calling `jest.resetModules` would be judged once per generation. The gate reads the lcov report, merges the records for a file, and checks the thresholds itself.                                                                                       |
| `statements`       | Node has no such metric. A project's former statements threshold is carried by `lines`.                                                                                                                                                                                                                                            |
| `it.todo`          | Any body is ignored, matching Jest. `node:test` would run it.                                                                                                                                                                                                                                                                      |
| `clearAllTimers`   | Node has no primitive, so the clock is torn down and rebuilt at the same instant.                                                                                                                                                                                                                                                  |
| `runAllTimers`     | Node's `runAll` drains only the queue as it stood when it was called, so a timer scheduled by a timer stays pending. The queue is re-run until no timeout is outstanding, which is what Jest does, and abandoned after a thousand passes.                                                                                          |
| Timer delays       | A delay below one millisecond is raised to one, as the real schedulers do. Node's fake clock keeps the number it was given, and a negative delay then asks the clock to run backwards while a zero-period interval never leaves a tick.                                                                                            |
| Partial mocks      | A factory that names only some exports leaves the rest reachable and real. Under Jest they were undefined, but under ES modules importing an undefined name is a link error that stops the whole file.                                                                                                                             |
| Namespace spies    | `jest.spyOn(namespace, 'name')` cannot work: an ES module namespace is sealed, and importers bind the name at link time. Declare a replacement whose factory wraps the function instead.                                                                                                                                           |
| Counting           | A test that stubs `process.stdout.write` across an `await` makes `node:test` drop the preceding test from its counts. The exit code is unaffected, so the verdict stays correct.                                                                                                                                                   |
| Decorators         | Neither of Node's TypeScript modes parses them. A decorated class in a spec applies its decorator explicitly, the way the compiler would.                                                                                                                                                                                          |
| HTML report        | Node has no HTML coverage reporter. The per-file table on stdout and `lcov.info` are what a run produces. Each environment's raw report lands beside it as `lcov.<environment>.info`; `lcov.info` is the merged report the gate judged, with paths from the workspace root so a coverage service can match them to the repository. |

## Testing the runtime

Its own suites import `node:test` and `node:assert` directly, never this package's
`expect` or `jest`, so a defect surfaces as a failure rather than being masked by the code
under test.

```bash
nx test tool-testing
```
