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
| Frontend apps           | `apps/frontend/`                     |
| Backend apps            | `apps/backend/`                      |
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
const Status = freeze(<const>{ Active: 'active', Inactive: 'inactive' })
type Status = (typeof Status)[keyof typeof Status]
```

### Type Assertions — `.ts` files only (not `.tsx`)

```typescript
// ❌
const el = document.getElementById('app') as HTMLDivElement
// ✅
const el = <HTMLDivElement>document.getElementById('app')
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

### Assertions — one per test, use Jest APIs, consolidate with asymmetric matchers

**One assertion per test.** Each `it` block should express a single observable fact. Multiple `expect` calls are only acceptable when asserting over a collection or validating tightly coupled state that cannot be expressed as a single matcher.

Use built-in Jest matchers (`expect`, `toBe`, `toEqual`, `toThrow`, `toHaveBeenCalledWith`, etc.). Do **not** introduce raw assertion libraries or custom matchers unless they already exist in the file.

Consolidate multiple property checks into a single `toEqual` with asymmetric matchers:

```typescript
// ❌
expect(result.projects).toHaveLength(1)
expect(result.projects[0].name).toBe('lib-a')
// ✅
expect(result.projects).toEqual([expect.objectContaining({ name: 'lib-a' })])

// ❌
expect(workspace.projectList[0].name).toBe('a-project')
expect(workspace.projectList[1].name).toBe('m-project')
// ✅
expect(workspace.projectList).toEqual(
  expect.arrayContaining([expect.objectContaining({ name: 'a-project' }), expect.objectContaining({ name: 'm-project' })])
)

// ❌
expect(result).toHaveLength(2)
expect(result[0].relativePath).toBe('libs/lib-a/CHANGELOG.md')
expect(result[0].path).toBe('/workspace/libs/lib-a/CHANGELOG.md')
// ✅
expect(result).toEqual(
  expect.arrayContaining([
    expect.objectContaining({
      relativePath: 'libs/lib-a/CHANGELOG.md',
      path: '/workspace/libs/lib-a/CHANGELOG.md',
    }),
  ])
)
```

### Branching — no unnecessary or unreachable code

Do not add branches that cannot be reached, and avoid defensive branching that adds complexity without observable behaviour. Every new branch **requires** a corresponding unit test; if the test cannot be written, the branch should not exist.

---

## New Library Checklist

- [ ] `project.json` → `name` starts with `lib-`, has `description` and `tags`
- [ ] `project.json` → targets: `build`, `publish`, `version`, `version-check`
- [ ] `project.json` → IIFE/UMD outputs include both `entry` and `globalName`
- [ ] `package.json` → required fields present (see `lib-pkg-fields` rule doc)
- [ ] `package.json` → exports use `.js` only (no `.ts` paths)
- [ ] `package.json` → includes `"./package.json": "./package.json"` export
- [ ] `package.json` → no `"main"` field
- [ ] `tsconfig.base.json` → path alias per export, grouped by package
- [ ] `README.md` → title, badges block, description, all required sections in order
- [ ] Root `README.md` → library listed in **Main Packages** or **Internal Packages**
- [ ] CI workflow file added
- [ ] `LIBRARY_COMPATIBILITY.md` updated
- [ ] E2E project created alongside the library
- [ ] `index.ts` barrel only at declared export paths

---

## Checklist (All Code Changes)

- [ ] Imports ordered: type → node: → external → @hyperfrontend/ → relative → ./
- [ ] Named imports only (no `* as`)
- [ ] No enums — use `freeze(<const>{...})` + type derivation
- [ ] No direct built-in calls — use `@hyperfrontend/immutable-api-utils`
- [ ] No `execSync` — use `execFileSync`
- [ ] Sync fs only — reuse `tools/eslint-rules/src/utils/fs.ts`
- [ ] JSDoc on all exported members (`@param`, `@returns`)
- [ ] Member docs as JSDoc above, not trailing `//`
- [ ] Comments use categorized prefixes; no plain `//`, no `TODO`, no `====` blocks
- [ ] Single-use consts inlined (non-exported, non-complex)
- [ ] Angle-bracket assertions in `.ts` (not `as`)
- [ ] No non-null assertion (`!`) — use narrowing, optional chaining, or explicit checks
- [ ] Type imports separated from value imports
- [ ] File ≤400 lines (≤700 for tests) when multi-function; split if needed, colocate helpers
- [ ] Reused logic extracted only when it deduplicates existing code immediately
- [ ] Test names assertive (no "should")
- [ ] One assertion per test; multiple `expect` calls only for collections or tightly coupled state
- [ ] Spec assertions use Jest asymmetric matchers (`objectContaining`, `arrayContaining`, etc.) — no redundant property-by-property checks
- [ ] No unreachable or unexercised branches
- [ ] Validated: `test` → `lint --fix` → `typecheck` → `format:write` (targeted)
