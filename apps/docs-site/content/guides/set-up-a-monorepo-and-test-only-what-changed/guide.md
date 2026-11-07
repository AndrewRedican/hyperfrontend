# Set up a monorepo and test only what changed

You will start from an empty directory, create three TypeScript libraries that depend on one another, and watch `hf affected` run the tests a change reaches and skip the one it does not, with the reason for each.

Everything comes from [`@hyperfrontend/workspace`](/docs/libraries/workspace).

## Create the repository

```bash
mkdir acme && cd acme
git init
npm init -y
npm pkg set name=@acme/monorepo
npm install --save-dev @hyperfrontend/workspace @hyperfrontend/testing \
  @hyperfrontend/linter prettier @types/node
```

The root package's scope becomes the scope of every library you generate, so `@acme/monorepo` gives you `@acme/...` packages. [`@hyperfrontend/testing`](/docs/libraries/testing) runs the specs.

## Make it a workspace

```bash
npx hf generate workspace
```

```text
CREATE .gitignore
CREATE .hfignore
CREATE hf.json
CREATE lint.base.config.ts
CREATE tsconfig.base.json
```

`hf.json` is the file every command reads. Open it: its `targetDefaults` give every project a `typecheck`, `test` and `build` target, each run by an executor of the package such as `@hyperfrontend/workspace:test`. A project only has to name a target to get it.

## Generate three libraries

```bash
npx hf generate library format
npx hf generate library report
npx hf generate library cli
```

Each lands under `libs/` with its own `project.json`, `package.json` and configuration, and an alias in `tsconfig.base.json` so the others can import it as `@acme/<name>`.

## Write the code

`format` formats byte counts. Replace `libs/format/src/index.ts`:

```ts
/** A unit a byte count is shown in. */
export type Unit = 'B' | 'KB' | 'MB' | 'GB'

const UNITS: readonly Unit[] = ['B', 'KB', 'MB', 'GB']

/** Formats a byte count for people to read. */
export function formatBytes(bytes: number): string {
  let value = bytes
  let unit = 0
  while (value >= 1024 && unit < UNITS.length - 1) {
    value /= 1024
    unit += 1
  }
  return `${Math.round(value * 10) / 10} ${UNITS[unit]}`
}
```

and give it a spec, `libs/format/src/index.spec.ts`:

```ts
import { describe, expect, it } from '@hyperfrontend/testing'
import { formatBytes } from './index'

describe('formatBytes', () => {
  it('rounds to one decimal place', () => {
    expect(formatBytes(1536)).toBe('1.5 KB')
  })
})
```

`report` calls `formatBytes`. Replace `libs/report/src/index.ts`:

```ts
import { formatBytes } from '@acme/format'

/** One line of a size report. */
export function reportLine(file: string, bytes: number): string {
  return `${file}: ${formatBytes(bytes)}`
}
```

with its spec, `libs/report/src/index.spec.ts`:

```ts
import { describe, expect, it } from '@hyperfrontend/testing'
import { reportLine } from './index'

describe('reportLine', () => {
  it('names the file and its size', () => {
    expect(reportLine('app.js', 2048)).toBe('app.js: 2 KB')
  })
})
```

`cli` only needs the `Unit` type. Replace `libs/cli/src/index.ts`:

```ts
import type { Unit } from '@acme/format'

/** The unit the command line reports in unless told otherwise. */
export const DEFAULT_UNIT: Unit = 'KB'
```

## Run a task, then many

```bash
npx hf run format:test
```

`run` runs exactly that one task. To build everything, use `run-many`:

```bash
npx hf run-many -t build --all
```

```text
hf run-many: format:build
hf run-many: cli:build
hf run-many: report:build
3 succeeded, 0 failed, 0 skipped
```

`format` builds first. Nothing told it to: the `build` default in `hf.json` says `"dependsOn": ["^build"]`, and the workspace knows from the imports that `report` and `cli` depend on `format`.

## See what the graph knows

```bash
npx hf graph explain report
```

```text
report (lib, libs/report)
depends on
  → project:format
      value production (1 file): libs/report/src/index.ts
```

Every dependency is recorded with its kind (`value`) and the role of the file that made it (`production`). The same command on `cli` shows its import of `format` as `type`. That distinction is what the next step uses.

## Change one library

Commit, so there is something to compare against:

```bash
git add -A && git commit -m "feat: three libraries"
```

Then change how `format` rounds: in `libs/format/src/index.ts`, make it two decimal places.

```ts
return `${Math.round(value * 100) / 100} ${UNITS[unit]}`
```

Ask which tests the change affects, and run them:

```bash
npx hf affected -t test --base=HEAD
```

```text
hf affected: 2 tasks selected from 1 changed files
  succeeded format:test
  succeeded report:test
```

Two of three. Ask why:

```bash
npx hf graph affected --target test --base HEAD --explain
```

```text
test: 2 of 3 tasks selected
  format:test
      changed-input libs/format/src/index.ts: libs/format/src/index.ts is an input of format:test
  report:test
      reachable-from-entry libs/format/src/index.ts: libs/format/src/index.ts reaches report:test
        via file:libs/report/src/index.ts → entry:@acme/format → file:libs/format/src/index.ts
skipped 1 tasks
  cli:test
      kind-irrelevant libs/format/src/index.ts: reachable only through type-only imports, which test does not follow
```

`cli` depends on `format`, yet its test is skipped: it imports `format` for a type alone, and types are stripped before a test runs, so no change in `format` can change what `cli:test` executes. Run the same question for `typecheck` and `cli` is selected, because a type check reads types.

You now have a workspace whose tasks run by name, in dependency order, and only where a change reaches. Every decision [`selectAffected`](/docs/libraries/workspace/graph#api-selectAffected) makes names its rule and the file behind it, so when CI skips or runs a task you can read why.
