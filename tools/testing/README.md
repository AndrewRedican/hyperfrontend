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

Take from `node:test` everything it can serve. Reach for this package only for what it
cannot.

```typescript
import { describe, it, beforeEach, before as beforeAll, after as afterAll } from 'node:test'
import { expect, jest } from '@hyperfrontend/testing'
```

Import `describe` or `it` from here instead when the file needs `.each`, `.failing`,
`.concurrent`, the `done` callback, or `expect.assertions`:

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

## Layout

| Path            | What it holds                                                                                                                                     |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/hooks/`    | The `--import` entry, workspace path aliases, extensionless specifiers, `moduleNameMapper`, and the generation counter behind `jest.resetModules` |
| `src/expect/`   | Structural equality, the matcher table, asymmetric matchers, and the `expect` surface                                                             |
| `src/mock/`     | `jest.fn`, `jest.spyOn`, the reset registries, and the fake clock                                                                                 |
| `src/blocks/`   | `describe` and `it` variants carrying the modifiers `node:test` lacks                                                                             |
| `src/coverage/` | The completeness check                                                                                                                            |
| `src/runner/`   | Per-project configuration, argv construction, and the process the executor spawns                                                                 |

## Behavioural differences from Jest

These are the places the runtime cannot be identical, and what it does instead.

| Concern           | Difference                                                                                                                                                                                  |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Coverage provider | V8, not istanbul. `/* istanbul ignore */` has no effect; use `/* node:coverage ignore next N */`. Branch percentages read lower because V8 counts default parameters and optional chaining. |
| Unloaded files    | Node omits them from the report entirely. The completeness check fails the run instead, restoring what a full-coverage threshold is meant to guarantee.                                     |
| `statements`      | Node has no such metric. A project's former statements threshold is carried by `lines`.                                                                                                     |
| `it.todo`         | Any body is ignored, matching Jest. `node:test` would run it.                                                                                                                               |
| `clearAllTimers`  | Node has no primitive, so the clock is torn down and rebuilt at the same instant.                                                                                                           |
| Module mocking    | Not available here. ES modules evaluate imports before any body runs, so `jest.mock` cannot take effect the way it does under Jest's CommonJS transform.                                    |

## Testing the runtime

Its own suites import `node:test` and `node:assert` directly, never this package's
`expect` or `jest`, so a defect surfaces as a failure rather than being masked by the code
under test.

```bash
nx test tool-testing
```
