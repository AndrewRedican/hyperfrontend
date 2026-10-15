# How to migrate a Jest suite to Node's test runner

You will move a suite written against Jest onto `node:test`, keep its `describe` blocks, matchers, mocks and `jest.mock` declarations as written, and finish with the same test count and at least the same coverage, with Jest, its transformer and their dependency trees uninstalled.

The reason to do it is what leaves the lockfile. Jest brings a framework, a transformer and a reporter stack of its own; Node 22 ships a runner, an assertion module, module hooks, fake timers and a coverage collector. [`@hyperfrontend/testing`](/docs/libraries/testing) adds the Jest-shaped surface on top of those and nothing else, so a project that migrates trades a few hundred transitive packages for one with no runtime dependencies. When the hyperfrontend repository moved its 11,900 tests over, 457 packages left the root lockfile; the account of that migration, including what got worse, is [I Replaced Jest With 1,200 Lines of Code. I'd Do It Again.](/articles/i-replaced-jest-with-1200-lines-of-code)

It is not for every suite. The matcher set is closed, and there are no snapshots, no custom matchers, no watch mode and no HTML coverage report. A suite that leans on any of those should stay on Jest, and the census in the first step tells you which kind of suite you have before you change anything.

## 1. Count what the suite actually uses

The cost of a migration is the behavioural surface the suite depends on, not its line count. Four searches size it:

```bash
grep -rhoE '\.to[A-Z][A-Za-z]+\(' src | sort | uniq -c | sort -rn
grep -rlE 'jest\.mock\(' src | wc -l
grep -rlE 'toMatch(Inline)?Snapshot|expect\.extend' src | wc -l
grep -rhoE 'jest\.[a-zA-Z]+' src | sort | uniq -c | sort -rn
```

Compare the matcher names against [`Assertions`](/docs/libraries/testing#api-Assertions) and the `jest` members against [`JestApi`](/docs/libraries/testing#api-JestApi). A name missing from either list is a test to rewrite before you start; a snapshot or `expect.extend` hit is a reason to stop here. Files calling `jest.mock` are the figure to watch, because module replacement is where the two runtimes differ most; the matcher count rarely matters.

Record the baseline while Jest still runs: the test count from its summary line and the per-file coverage table. Both are what the migration is measured against in the last step.

## 2. Swap the packages

```bash
npm uninstall jest ts-jest @jest/globals @types/jest jest-environment-jsdom
npm install --save-dev @hyperfrontend/testing
```

Keep `jsdom` installed if any suite ran under Jest's jsdom environment; the [`/dom`](/docs/libraries/testing/dom) preload imports it and nothing else does. Node 22.18 or later is required, and the project's `package.json` should declare `"type": "module"`: Node loads `.ts` specs as ES modules through its own type stripping, and a manifest declaring `commonjs` makes it parse them as CommonJS instead, where every `import` fails. Delete `jest.config.*` once the next step has replaced it.

## 3. Rewrite the configuration

A [`TestConfig`](/docs/libraries/testing/runner#api-TestConfig) exported from `test.config.ts` takes the place of the Jest configuration. Most fields have a direct ancestor:

| In `jest.config.ts`                                       | In `test.config.ts`                                                                                                                                                                      |
| --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `testMatch`, `testRegex`                                  | [`testMatch`](/docs/libraries/testing/runner#api-TestEnvironment) on an environment, as globs relative to the project                                                                    |
| `testEnvironment: 'jsdom'`, `@jest-environment` docblocks | a second environment with [`dom`](/docs/libraries/testing/runner#api-TestEnvironment) set, selecting the browser specs by name                                                           |
| `setupFilesAfterEnv`                                      | [`setupFiles`](/docs/libraries/testing/runner#api-TestEnvironment) on the environment                                                                                                    |
| `moduleNameMapper`                                        | [`moduleNameMapper`](/docs/libraries/testing/runner#api-TestConfig), same patterns, `<rootDir>` honoured                                                                                 |
| `testTimeout`                                             | [`testTimeout`](/docs/libraries/testing/runner#api-TestConfig), default 30 seconds                                                                                                       |
| `collectCoverageFrom`                                     | [`coverageInclude`](/docs/libraries/testing/runner#api-TestConfig)                                                                                                                       |
| `coveragePathIgnorePatterns`                              | [`coverageExclude`](/docs/libraries/testing/runner#api-TestConfig); specs, declaration files and the config itself are excluded already                                                  |
| `coverageThreshold.global`                                | [`coverageThresholds`](/docs/libraries/testing/runner#api-CoverageThresholds) for lines, branches and functions; Node has no statements metric, so carry a statements threshold as lines |

The docblock routing goes away because each environment is its own `node --test` process. A suite that mixed Node and DOM specs in one directory selects them by file name, which usually means renaming the DOM specs to `*.browser.spec.ts` and ignoring that pattern in the Node environment:

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
  coverageThresholds: { lines: 95, branches: 90, functions: 95 },
}

export default config
```

The runner has no command line, so a short script drives it. [`runProjectTests`](/docs/libraries/testing/runner#api-runProjectTests) spawns one process per environment, merges the coverage reports and judges them; the script prints the [`RunOutcome`](/docs/libraries/testing/runner#api-RunOutcome) and sets the exit code:

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

Point the `test` script at it: `"test": "node run-tests.ts"`.

## 4. Import what Jest made global

Nothing is global here. Every spec imports [`describe`](/docs/libraries/testing#api-describe), [`it`](/docs/libraries/testing#api-it), [`expect`](/docs/libraries/testing#api-expect) and [`jest`](/docs/libraries/testing#api-jest) from the package, and the lifecycle hooks from `node:test`, whose [`before`](https://nodejs.org/api/test.html#beforefn-options) and [`after`](https://nodejs.org/api/test.html#afterfn-options) can be imported under the names the suite already uses:

```typescript
import { afterEach, beforeEach, before as beforeAll, after as afterAll } from 'node:test'
import { describe, expect, it, jest } from '@hyperfrontend/testing'
```

A suite that calls `test` instead of `it` imports `it as test`. A suite that already imports from `@jest/globals` only changes the specifier:

```bash
grep -rl "from '@jest/globals'" src \
  | xargs sed -i "s#from '@jest/globals'#from '@hyperfrontend/testing'#"
```

Take [`it`](/docs/libraries/testing#api-it) from the package in every file, including ones that use no modifier. It is the package's `it` that checks [`expect.assertions`](/docs/libraries/testing#api-expect) once the body settles; a spec running on Node's own `it` would declare a count nobody verifies.

## 5. Replace what has no equivalent

Everything on [`JestApi`](/docs/libraries/testing#api-JestApi) and [`Assertions`](/docs/libraries/testing#api-Assertions) keeps its Jest semantics. The calls below do not exist, or cannot behave the same way under native ES modules, and each has a replacement:

| In Jest                                             | Do this instead                                                                                                                                                      |
| --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `jest.setTimeout(ms)`                               | `testTimeout` in the configuration, or a trailing number on one `it`                                                                                                 |
| `beforeEach(fn, 10000)`                             | `beforeEach(fn, { timeout: 10000 })`: Node's hooks take an options object and silently accept a bare number                                                          |
| `it.each` as a tagged template                      | the array form of [`each`](/docs/libraries/testing#api-ItApi); the title still takes `%s`, `%p` and `%#`                                                             |
| `jest.spyOn(module, 'fn')` on an imported namespace | [`jest.mock`](/docs/libraries/testing#api-JestApi) with a factory that wraps the function; an ES module namespace is sealed and importers bind the name at link time |
| `jest.isolateModules(fn)`                           | [`jest.resetModules`](/docs/libraries/testing#api-JestApi), then [`jest.doMock`](/docs/libraries/testing#api-JestApi), then a dynamic `import()`, in that order      |
| `/* istanbul ignore next */`                        | delete every one, run, and add `/* node:coverage ignore next N */` only where the V8 report shows a branch no test can take                                          |
| `it.only` in a scripted run                         | a hand run with `node --test --test-only`; the runner does not pass the flag, so every test runs                                                                     |
| `toMatchSnapshot`, `expect.extend`                  | an explicit assertion, or keeping that suite on Jest                                                                                                                 |

Two differences work in the migrating suite's favour. A [`jest.mock`](/docs/libraries/testing#api-JestApi) factory that names only some exports leaves the rest real rather than undefined, because an undefined import would be a link error under ES modules. And [`runAllTimers`](/docs/libraries/testing#api-JestApi) drains timers scheduled by the timers it ran, the way Jest's does, where Node's own drain stops at the queue as it stood. The full table, with the reason for each row, is in [Where behaviour differs from Jest](/docs/libraries/testing/architecture#where-behaviour-differs-from-jest).

## 6. Run it and compare the counts

Run `npm test`. Each environment prints Node's summary, and the merged coverage table follows:

```text
ℹ tests 312
ℹ pass 312
ℹ fail 0
file             | line % | branch % | funcs % | uncovered lines
----------------------------------------------------------------
src/cart.ts      | 100.00 |   100.00 |  100.00 |
...
```

Add the `tests` lines across environments and compare the sum with the Jest baseline. A green run with fewer tests is not a passing migration: a spec that failed to load, a suite whose `describe` never registered, or a test counted under a different name all pass silently. Then compare the table with the old report, file by file. Branch percentages read lower under V8, which counts the untaken side of a default parameter and of optional chaining; interrogate a shortfall before lowering a threshold to meet it, because most of the gap is measurement rather than untested code.

A run also fails when an included source file was never loaded by any test. Jest reported such a file at zero percent, or not at all; here it is listed by path, and the fix is a test or an exclusion, never a lower threshold.

## Check it worked

The test count equals the Jest baseline, environment by environment. Every file in the coverage table is at or above the figure the old report gave it, with statements compared against lines. `npm ls jest` prints nothing. Finally, break one assertion on purpose: the run names the test, prints Node's assertion diff, and exits with code 1, which is the shape every later failure will have.
