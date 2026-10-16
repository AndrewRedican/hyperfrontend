---
name: coding
version: 1.0.0
description: Coding conventions for the hyperfrontend Nx monorepo. Use when refactoring, adding features, fixing bugs, or writing any new code across libs/, apps/, tools/, or plugins/.
allowed-tools:
  - Read
  - Write
  - Edit
  - Grep
  - Glob
  - Terminal
---

# Coding Skill

Know all enforced rules **before** generating code. Violations will be caught by lint; fix them preemptively.

## Reference Locations

| What                    | Where                                |
| ----------------------- | ------------------------------------ |
| Shared libs             | `libs/`                              |
| Demos                   | `apps/demos/`                        |
| Docs site               | `apps/docs-site/`                    |
| Package e2e             | `apps/package-e2e/`                  |
| Tooling                 | `tools/`, `plugins/`                 |
| ESLint rule docs        | `tools/eslint-rules/docs/`           |
| Base ESLint config      | `eslint.base.config.cjs`             |
| TS path aliases         | `tsconfig.base.json` → `paths`       |
| Immutable-safe builtins | `@hyperfrontend/immutable-api-utils` |

---

## Validation Workflow

Run in order, targeting only affected projects:

```bash
nx test <project-name>
nx lint <project-name> --fix
nx run <project-name>:typecheck
nx format:write --projects=<project-name>
```

---

## Module Boundary Tags

| Tag                | Can depend on                             |
| ------------------ | ----------------------------------------- |
| `type:core`        | nothing                                   |
| `type:util`        | `type:core`, `type:util`                  |
| `type:feature`     | `type:core`, `type:util`, `type:feature`  |
| `type:protocol`    | `type:core`, `type:util`, `type:protocol` |
| `type:app`         | `type:util`                               |
| `type:demo`        | nothing (npm packages only)               |
| `scope:standalone` | nothing (npm packages only)               |

---

## Import Rules

### Order

```typescript
import type { Foo } from './types' // 1. type imports
import { readFileSync } from 'node:fs' // 2. node: builtins
import express from 'express' // 3. external
import { bar } from '@hyperfrontend/utils/string' // 4. workspace
import { helper } from '../../shared/helper' // 5. relative (deep first)
import { local } from './local' // 6. current dir
```

### Critical Patterns

```typescript
// ❌ namespace import
import * as utils from './utils'
// ✅
import { helper } from './utils'
// exception: import type * as Types from './types'  and JSON files

// ❌ top-level when deeper subpath exists
import { runCli } from '@hyperfrontend/project-scope'
// ✅
import { runCli } from '@hyperfrontend/project-scope/cli'

// ❌ missing node: prefix
import { readFileSync } from 'fs'
// ✅
import { readFileSync } from 'node:fs'

// ❌ mixed type + value
import { SomeType, someValue } from './module'
// ✅
import type { SomeType } from './module'
import { someValue } from './module'
```

`index.ts` only allowed at paths declared in `package.json` `exports`.

---

## TypeScript Patterns

### No Enums

```typescript
// ❌
enum Status {
  Active = 'active',
  Inactive = 'inactive',
}

// ✅
import { freeze } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
const Status = freeze({ Active: 'active', Inactive: 'inactive' } as const)
type Status = (typeof Status)[keyof typeof Status]
```

### Type Assertions — always `as`

Node's TypeScript type stripping rejects `<T>expr`, and the test runner loads `.ts`
sources directly, so angle-bracket assertions are not parseable anywhere.

```typescript
// ❌
const el = <HTMLDivElement>document.getElementById('app')
// ✅
const el = document.getElementById('app') as HTMLDivElement
```

### Inline Single-Use Consts

```typescript
// ❌
const value = 42
console.log(value)
// ✅
console.log(42)
```

Does not apply to: exported constants, multi-use variables.

### No Unsafe Builtins — **NEVER** call directly

```typescript
// ❌
Object.freeze(obj) / Array.isArray(v) / JSON.parse(s) / console.log(x)

// ✅
import { freeze } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { isArray } from '@hyperfrontend/immutable-api-utils/built-in-copy/array'
import { parse, stringify } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'
import { log } from '@hyperfrontend/immutable-api-utils/built-in-copy/console'
```

Covers: `Object`, `Array`, `JSON`, `Promise`, `console`, `Math`, `Date`, `Map`, `Set`, `Reflect`, `Symbol`.

### File I/O — sync only, reuse utils first

```typescript
// ❌
import { readFile } from 'node:fs/promises'
// ✅
import { readFileSync } from 'node:fs'
```

**Check `tools/eslint-rules/src/utils/fs.ts` before reimplementing any file operation.**

### Shell Commands — no execSync

```typescript
// ❌
execSync(`git add ${filePath}`)
// ✅
execFileSync('git', ['add', filePath])
```

### Regex — avoid catastrophic backtracking

Unsafe: `/(a+)+$/`, `/(a|a)+/`, `/([a-zA-Z]+)*$/`. Prefer `startsWith()`, `endsWith()`, `includes()`, `split()`.

### No Non-Null Assertion

```typescript
// ❌
const value = map.get(key)!
// ✅ — type narrowing
const value = map.get(key)
if (value === undefined) throw new Error(`key not found: ${key}`)
// ✅ — optional chaining
const name = user?.profile?.name
```

---

## JSDoc

**Required** on all exported `.ts` members: functions, classes, methods, properties.

- `@param` with description
- `@returns` with description
- No `@deprecated` — use the issue tracker
- No `@todo`
- Entry-point `@module` headers: one or two sentences naming the capability, 200 characters max — see the `library-package-config` skill

Member docs go **above** the member as JSDoc, never as trailing comments:

```typescript
// ❌
interface User { id: string // unique identifier }
// ✅
interface User {
  /** Unique identifier */
  id: string
}
```

---

## Comment Rules

Every `//` comment must use a recognized prefix or be a tooling directive:

| Prefix     |
| ---------- |
| `why:`     |
| `how:`     |
| `context:` |
| `magic:`   |
| `todo:`    |
| `fixme:`   |
| `note:`    |
| `ref:`     |
| `compat:`  |

`compat:` marks code kept only for a runtime below a bound, written as `// compat: node<22 <reason>` so `grep -rn "compat: node<"` lists every shim a raised floor retires.

```typescript
// ❌
// Initialize the counter
// ✅
// why: Counter starts at 0 to match the API's 0-based indexing
```

- No decorative header comments (banners, ASCII art)
- No section dividers (`====` blocks)
- **Never** write `// TODO` / `// to-do` / `/** @todo */` — the lowercase `todo:` prefix is distinct and allowed

---

## File Size

Only applies when a file has **more than one function**:

| File type        | Max lines |
| ---------------- | --------- |
| Implementation   | 400       |
| Test (`.spec.*`) | 700       |

When a file approaches the limit, split into discrete functions. Colocate internal helpers in the same folder as the module they support (e.g. a `utils/` or `shared/` subfolder beside the main file — not `<workspace-root>/libs`).

Before extracting a helper as reusable, confirm it immediately deduplicates existing code. Check local `utils/`, `shared/`, and feature-adjacent folders first. Only promote to a shared location if other code can be deduplicated right now.

---

## Testing

### Names — assertive, no "should"

```typescript
// ❌
it('should return the correct value', ...)
// ✅
it('returns the correct value', ...)
```

### Assertions — one per test body, enforced by `workspace/one-assertion-per-test`

**One assertion per test body.** A unit test describes one behaviour, so its body reaches at most one assertion call: one `expect(...)`, or one call into `node:assert`. The lint rule counts lexically, nested callbacks and same-file helpers included, so a helper that asserts twice, or is called twice, still counts. It never requires an assertion, and it never fixes anything, because which remedy fits is a judgement about the behaviour under test. Decide case by case:

- **Split** when a body checks independent behaviours. Each new test gets a title naming the single behaviour it asserts, and keeps the setup, teardown, async handling and ordering the original relied on.
- **Fold** when several checks jointly express one indivisible behaviour (one result's shape, one call's arguments, one event's payload). Describe the whole shape with a composite or asymmetric matcher: `toEqual`, `toStrictEqual`, `toMatchObject`, `toHaveBeenCalledWith`, `expect.objectContaining`, `expect.arrayContaining`, `expect.stringContaining`, `expect.any`.
- **Iterate** when the behaviour is a property of every element: one `expect` inside a loop or `forEach` is one assertion over a collection.

Never satisfy the rule by weakening a check, deleting one, skipping the test, moving assertions into a helper in another module, or adding a lint suppression. Do not combine unrelated checks into one matcher just to pass; that trades one vague test for one vague assertion.

A fold must still say what failed. Positional booleans do not: `expect([isLetter('a'), isLetter('z')]).toEqual([true, true])` fails as `[true, false]` and names nothing.

- Several inputs through one predicate: `it.each` with one assertion per row, or keep the inputs in the diff with `expect(inputs.filter((input) => !isLetter(input))).toEqual([])`. Filter the inputs, not derived values: `toEqual` ignores `undefined` array items, so `expect([undefined]).toEqual([])` passes; use `toStrictEqual([])` when a filtered value could be `undefined`.
- Several observations of one scenario: key them, `expect({ before, after }).toEqual({ before: false, after: true })`.
- An undefined field inside a fold: `expect.objectContaining({ key: undefined })` demands the key exist; compare a constructed object instead, `expect({ id: r.id, mode: r.mode }).toEqual({ id: 'ts', mode: undefined })`.
- Dropping a check is allowed only for a pure existence check (`toBeDefined`, `not.toBeNull`) on the same value a stronger assertion already reads. An exit code, status or count beside a parsed output is its own fact: fold it, `expect({ exitCode: r.exitCode, entries: JSON.parse(r.output) }).toEqual({ exitCode: 0, entries: [...] })`, or split it.

Use the matchers of `@hyperfrontend/testing` (`expect`, `toBe`, `toEqual`, `toThrow`, `toHaveBeenCalledWith` and the rest). Do **not** introduce raw assertion libraries or custom matchers; `libs/testing`'s own specs use `node:assert/strict` because they test `expect` itself.

```typescript
// ❌ two behaviours in one body: a count and a name
expect(result.projects).toHaveLength(1)
expect(result.projects[0].name).toBe('lib-a')
// ✅ one shape
expect(result.projects).toEqual([expect.objectContaining({ name: 'lib-a' })])

// ❌ two checks that are really one call's contract
expect(spy).toHaveBeenCalledTimes(1)
expect(spy.mock.calls[0][0]).toBe('ready')
// ✅
expect(spy.mock.calls).toEqual([['ready']])

// ❌ two independent behaviours: the exit code and the printed warning
it('runs the command', () => {
  const result = run(['--dry'])
  expect(result.exitCode).toBe(0)
  expect(result.output).toContain('dry run')
})
// ✅ split, each titled for its behaviour
it('exits cleanly on a dry run', () => {
  expect(run(['--dry']).exitCode).toBe(0)
})
it('announces a dry run in its output', () => {
  expect(run(['--dry']).output).toContain('dry run')
})

// ❌ a helper that hides two assertions
function expectValid(result: Result) {
  expect(result.ok).toBe(true)
  expect(result.errors).toEqual([])
}
// ✅ one assertion against the whole result
expect(validate(manifest)).toEqual({ ok: true, errors: [] })
```

Splitting grows spec files. Respect the project's `max-file-lines` limit by moving cohesive groups of tests into sibling spec files named for what they cover; never raise the limit for a migration.

### Branching — no unnecessary or unreachable code

Do not add branches that cannot be reached, and avoid defensive branching that adds complexity without observable behaviour. Every new branch **requires** a corresponding unit test; if the test cannot be written, the branch should not exist.

---

## New Library Checklist

- [ ] `project.json` → `name` starts with `lib-`, has `description` and `tags`
- [ ] `project.json` → targets: `build`, `publish`, `version`, `version-check`
- [ ] `project.json` → IIFE/UMD outputs include both `entry` and `globalName`
- [ ] `project.json` → `metadata.compatibility.environments` declares `node`, `browser`, `webWorker` as `full` / `partial` / `none` (the `library` and `make-publishable` generators ask for this; `lib-project-compatibility` enforces it)
- [ ] `package.json` → required fields present (see `lib-pkg-fields` rule doc)
- [ ] `package.json` → exports use `.js` only (no `.ts` paths)
- [ ] `package.json` → includes `"./package.json": "./package.json"` export
- [ ] `package.json` → no `"main"` field
- [ ] `tsconfig.base.json` → path alias per export, grouped by package
- [ ] `README.md` → title, badges block, description, all required sections in order
- [ ] Root `README.md` → library listed in **Main Packages** or **Internal Packages**
- [ ] CI workflow file added
- [ ] E2E project created alongside the library
- [ ] `index.ts` barrel only at declared export paths

---

## Checklist (All Code Changes)

- [ ] Imports ordered: type → node: → external → @hyperfrontend/ → relative → ./
- [ ] Named imports only (no `* as`)
- [ ] No enums — use `freeze({...} as const)` + type derivation
- [ ] No direct built-in calls — use `@hyperfrontend/immutable-api-utils`
- [ ] No `execSync` — use `execFileSync`
- [ ] Sync fs only — reuse `tools/eslint-rules/src/utils/fs.ts`
- [ ] JSDoc on all exported members (`@param`, `@returns`)
- [ ] Member docs as JSDoc above, not trailing `//`
- [ ] Comments use categorized prefixes; no plain `//`, no `TODO`, no `====` blocks
- [ ] Single-use consts inlined (non-exported, non-complex)
- [ ] Type assertions use `as` (never angle brackets — Node's type stripping rejects them)
- [ ] No non-null assertion (`!`) — use narrowing, optional chaining, or explicit checks
- [ ] Type imports separated from value imports
- [ ] File ≤400 lines (≤700 for tests) when multi-function; split if needed, colocate helpers
- [ ] Reused logic extracted only when it deduplicates existing code immediately
- [ ] Test names assertive (no "should")
- [ ] One assertion per test body (`workspace/one-assertion-per-test`): split independent behaviours into titled tests, fold one indivisible behaviour into one composite or asymmetric matcher; never weaken, delete, skip, suppress or hide assertions in helpers
- [ ] Spec assertions describe whole shapes with asymmetric matchers (`objectContaining`, `arrayContaining`, etc.) — no property-by-property checks
- [ ] No unreachable or unexercised branches
- [ ] Validated: `test` → `lint --fix` → `typecheck` → `format:write` (targeted)
