# How to configure and run TypeScript tests on Node's test runner

You will have a TypeScript project whose specs run with `npm test` on Node's built-in runner, with no transpiler, with coverage judged per project, and with a DOM available to the specs that need one.

Node 22.18 runs a `.ts` file through its own type stripping, but it resolves nothing a TypeScript project writes: an extensionless `./slug`, a `tsconfig` path alias, a `jest.mock` call. [`@hyperfrontend/testing`](/docs/libraries/testing) supplies the preload that resolves those, a runner that reads one configuration file, and a coverage gate that cannot be passed by a file nobody tested. The project built here is small on purpose: a slug helper, one DOM-facing function, and a configuration that runs them in two environments.

## 1. Install the package and declare ES modules

```bash
npm install --save-dev @hyperfrontend/testing jsdom
```

Leave `jsdom` out if nothing needs a DOM; only the [`/dom`](/docs/libraries/testing/dom) preload imports it. Check `node --version` reports 22.18 or later, and put `"type": "module"` in `package.json`. Node loads `.ts` specs as ES modules; a manifest declaring `commonjs`, which `npm init` writes, makes it parse them as CommonJS instead, and the first `import` statement fails. With no `type` field at all Node detects the syntax and prints a warning per file.

## 2. Write a spec that imports from the package

Nothing is injected into the global scope. A spec imports [`describe`](/docs/libraries/testing#api-describe), [`it`](/docs/libraries/testing#api-it) and [`expect`](/docs/libraries/testing#api-expect) from the package, and lifecycle hooks from `node:test` when it needs them.

`src/slug.ts`:

```typescript
export function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}
```

`src/slug.spec.ts`:

```typescript
import { describe, expect, it } from '@hyperfrontend/testing'
import { slugify } from './slug'

describe('slugify', () => {
  it('joins words with single dashes', () => {
    expect(slugify('Node Test  Runner')).toBe('node-test-runner')
  })

  it.each([
    ['  Leading', 'leading'],
    ['Trailing!', 'trailing'],
  ])('trims %p to %p', (title: string, slug: string) => {
    expect(slugify(title)).toBe(slug)
  })
})
```

The import of `./slug` has no extension, which is how the source is written and what the preload in the next step resolves. [`each`](/docs/libraries/testing#api-ItApi) takes an array of rows; an array row is spread across the parameters, and `%p` in the title prints the argument the way the assertion output would.

## 3. Run it by hand

```bash
node --import @hyperfrontend/testing/hooks --test src/slug.spec.ts
```

The [`/hooks`](/docs/libraries/testing/hooks) preload registers the resolution hooks before any spec loads: extensionless and index specifiers, the `paths` of a `tsconfig.base.json` at the working directory, and the [`jest.mock`](/docs/libraries/testing#api-JestApi) declarations it reads out of each spec before the spec's imports link. Node prints three passing tests, one per row of the table plus the plain one.

Quote a glob so the shell leaves it to Node, as in `--test 'src/**/*.spec.ts'`. Add `--test-only` when a spec uses [`it.only`](/docs/libraries/testing#api-ItApi); without the flag Node runs every test.

## 4. Describe the project in test.config.ts

A hand run has no coverage gate and no DOM. Both come from a [`TestConfig`](/docs/libraries/testing/runner#api-TestConfig), which the project exports from `test.config.ts`:

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
  coverageThresholds: { lines: 100, branches: 90, functions: 100 },
  moduleNameMapper: { '^@app/(.*)$': '<rootDir>/src/$1' },
  testTimeout: 10_000,
}

export default config
```

Each [`TestEnvironment`](/docs/libraries/testing/runner#api-TestEnvironment) is its own `node --test` process. The `node` environment ignores the browser specs explicitly, because Node has no way to exclude files from a glob and the runner expands the selection itself when an environment ignores anything. The `browser` environment loads the [`/dom`](/docs/libraries/testing/dom) preload, which copies a jsdom window onto the global before the environment's setup modules run, so a setup module can already touch `document`:

`test.setup.ts`:

```typescript
document.documentElement.lang = 'en'
```

A setup module is also where a [`jest.mock`](/docs/libraries/testing#api-JestApi) declaration that should apply to every spec in the environment goes; the [`/hooks`](/docs/libraries/testing/hooks) page lists what a spec can rely on from one. Coverage settings apply to the project as a whole. [`coverageInclude`](/docs/libraries/testing/runner#api-TestConfig) names every file that must be measured, which is what lets the runner notice a file no test loaded; spec files, declaration files and `test.config.ts` itself are excluded without being listed. [`moduleNameMapper`](/docs/libraries/testing/runner#api-TestConfig) redirects specifiers the way Jest's did, with `<rootDir>` standing for the project root.

The DOM-facing side of the project is one function and one spec, named so the `browser` environment picks it up:

`src/browser/title.ts`:

```typescript
export function setTitle(title: string): void {
  document.title = title
  document.body.dataset['title'] = title
}
```

`src/browser/title.browser.spec.ts`:

```typescript
import { describe, expect, it } from '@hyperfrontend/testing'
import { setTitle } from './title'

describe('setTitle', () => {
  it('writes the title onto the document', () => {
    setTitle('Orders')
    expect(document.title).toBe('Orders')
  })

  it('runs on the document the setup module prepared', () => {
    expect(document.documentElement.lang).toBe('en')
  })
})
```

## 5. Drive it from a script

The runner ships no command line, so the project owns the few lines that call it. [`runProjectTests`](/docs/libraries/testing/runner#api-runProjectTests) takes the configuration and a [`RunContext`](/docs/libraries/testing/runner#api-RunContext), spawns one process per environment, merges the lcov reports per file, checks the thresholds against the merged totals, and returns a [`RunOutcome`](/docs/libraries/testing/runner#api-RunOutcome) without printing anything:

`run-tests.ts`:

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

Add `"test": "node run-tests.ts"` to the scripts in `package.json`. In a monorepo, `workspaceRoot` is the repository root and `projectRoot` the package directory: the merged `coverage/lcov.info` names files relative to the workspace root, which is the form a coverage service matches against the repository, and the `tsconfig.base.json` whose aliases the preload reads is looked for at the workspace root.

## Check it worked

`npm test` prints Node's summary for each environment, then one merged table with every source file at 100 percent lines and functions, and exits with code 0:

```text
file                 | line % | branch % | funcs % | uncovered lines
--------------------------------------------------------------------
src/browser/title.ts | 100.00 |   100.00 |  100.00 |
src/slug.ts          | 100.00 |   100.00 |  100.00 |
--------------------------------------------------------------------
all files            | 100.00 |   100.00 |  100.00 |
```

Then prove the gate is real. Add `src/orphan.ts` exporting a function nothing imports and run again: the run exits with code 1 and prints `no test loaded these files, so coverage never measured them:` followed by `src/orphan.ts`, a file Node's own report would simply have omitted. Delete it, raise `branches` in the configuration above what the table shows, and the run fails again with the percentage and the threshold it missed.
