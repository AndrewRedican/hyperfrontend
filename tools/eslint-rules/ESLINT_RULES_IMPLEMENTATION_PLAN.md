# ESLint Rules Implementation Plan

> Requirements specification for custom ESLint rules in the hyperfrontend monorepo.

---

## Table of Contents

1. [Overview](#overview)
2. [Implementation Workflow](#implementation-workflow)
3. [Implementation Progress](#implementation-progress)
4. [Rule Categories](#rule-categories)
5. [TypeScript Code Rules](#typescript-code-rules)
6. [Test File Rules](#test-file-rules)
7. [JSON File Rules](#json-file-rules)
8. [File Structure](#file-structure)
9. [Configuration in eslint.base.config.cjs](#configuration-in-eslintbaseconfigcjs)
10. [Error Message Guidelines](#error-message-guidelines)
11. [Testing Strategy](#testing-strategy)
12. [Dependencies](#dependencies)

---

## Overview

This document specifies 12 ESLint rules organized into three categories.

All rules are:

- Implemented in `tools/eslint-rules/src/`
- Consumed from `/eslint.base.config.cjs`
- Tested with `@typescript-eslint/rule-tester`

### Existing Patterns

The workspace has an established pattern for custom ESLint rules:

- **Location**: `tools/eslint-rules/src/`
- **Rule Creator**: `ESLintUtils.RuleCreator` from `@typescript-eslint/utils`
- **Testing**: `@typescript-eslint/rule-tester` with temporary project fixtures
- **Utilities**: `tools/eslint-rules/src/utils/` for shared helpers

---

## Implementation Workflow

Each rule must be implemented systematically using this workflow:

1. **Implementation**: Create the rule file in `tools/eslint-rules/src/rules/`
2. **Export**: Add the rule export to `tools/eslint-rules/src/index.ts`
3. **Configuration**: Add the rule to `eslint.base.config.cjs`
4. **Test**: Create test file with comprehensive test cases
5. **Validation**: Run `npx CI=1 nx run-many -t=lint --skip-nx-cache=true` to verify

Rules must be implemented one at a time, completing all steps before moving to the next rule.

---

## Implementation Progress

| #   | Rule Name                        | Status      | Notes                                           |
| --- | -------------------------------- | ----------- | ----------------------------------------------- |
| 1   | `require-node-protocol`          | ✅ Complete | Implemented with auto-fix                       |
| 2   | `no-namespace-import`            | ✅ Complete | Exceptions: test files, JSON imports, type-only |
| 3   | `no-mixed-type-import`           | ✅ Complete | Implemented with auto-fix                       |
| 4   | `import-order`                   | ✅ Complete | Implemented with auto-fix                       |
| 5   | `prefer-angle-bracket-assertion` | ✅ Complete | Excludes .tsx files                             |
| 6   | `no-enum`                        | ⏳ Pending  |                                                 |
| 7   | `assertive-test-names`           | ⏳ Pending  |                                                 |
| 8   | `lib-pkg-fields`                 | ⏳ Pending  |                                                 |
| 9   | `lib-pkg-secondary-export`       | ⏳ Pending  |                                                 |
| 10  | `lib-pkg-bundle-entry`           | ⏳ Pending  |                                                 |
| 11  | `lib-project-metadata`           | ⏳ Pending  |                                                 |
| 12  | `lib-project-bundle-config`      | ⏳ Pending  |                                                 |

### Code Coverage Requirements

All new rules must have full test coverage before proceeding to the next rule. Run:

```bash
npx nx run eslint-rules:test
```

Ensure coverage thresholds are met:

- **Statements**: 100%
- **Branches**: 97%
- **Functions**: 100%
- **Lines**: 100%

---

## Rule Categories

### Category A: TypeScript Code Rules

| #   | Rule Name                        | Description                                              | Fixable |
| --- | -------------------------------- | -------------------------------------------------------- | ------- |
| 1   | `require-node-protocol`          | Require `node:` prefix for Node.js built-in imports      | ✅ Yes  |
| 2   | `no-namespace-import`            | Prohibit `import * as` syntax                            | ❌ No   |
| 3   | `no-mixed-type-import`           | Prohibit mixing types and values in single import        | ✅ Yes  |
| 4   | `import-order`                   | Enforce import ordering (type-first, by source category) | ✅ Yes  |
| 5   | `prefer-angle-bracket-assertion` | Prefer `<T>value` over `value as T`                      | ❌ No   |
| 6   | `no-enum`                        | Prohibit `enum` keyword                                  | ❌ No   |

**ESLint Config Block**:

```javascript
{
  files: ['**/*.ts'],
  ignores: ['**/jest.config.ts', '**/jest.setup.ts', '**/jest.setup.browser.ts'],
  plugins: { workspace: eslintRules },
  rules: {
    'workspace/require-node-protocol': 'error',
    'workspace/no-namespace-import': 'error',
    'workspace/no-mixed-type-import': 'error',
    'workspace/import-order': 'error',
    'workspace/no-enum': 'error',
  },
}
```

**Additional config for `prefer-angle-bracket-assertion`** (excludes `.tsx`):

```javascript
{
  files: ['**/*.ts'],
  ignores: ['**/jest.config.ts', '**/jest.setup.ts', '**/jest.setup.browser.ts', '**/*.tsx'],
  plugins: { workspace: eslintRules },
  rules: {
    'workspace/prefer-angle-bracket-assertion': 'error',
  },
}
```

### Category B: Test File Rules

| #   | Rule Name              | Description                                     | Fixable |
| --- | ---------------------- | ----------------------------------------------- | ------- |
| 7   | `assertive-test-names` | Prohibit the word "should" in test descriptions | ❌ No   |

**ESLint Config Block**:

```javascript
{
  files: ['**/*.spec.ts'],
  ignores: ['**/jest.config.ts', '**/jest.setup.ts', '**/jest.setup.browser.ts'],
  plugins: { workspace: eslintRules },
  rules: {
    'workspace/assertive-test-names': 'error',
  },
}
```

### Category C: JSON File Rules (Publishable Libraries)

These rules apply to **publishable library projects** only (projects with `projectType: "library"` and both `build` and `publish` targets in `project.json`).

| #   | Rule Name                   | Target         | Description                                                                 |
| --- | --------------------------- | -------------- | --------------------------------------------------------------------------- |
| 8   | `lib-pkg-fields`            | `package.json` | Required fields: name, description, license, sideEffects, engines, keywords |
| 9   | `lib-pkg-secondary-export`  | `package.json` | Require at least one secondary export                                       |
| 10  | `lib-pkg-bundle-entry`      | `package.json` | Bundle entry path must exist in exports                                     |
| 11  | `lib-project-metadata`      | `project.json` | Required fields: tags, name (lib- prefix), description                      |
| 12  | `lib-project-bundle-config` | `project.json` | Bundled outputs (IIFE/UMD) require entry and globalName                     |

**ESLint Config Block for package.json**:

```javascript
{
  files: ['libs/**/package.json'],
  plugins: { workspace: eslintRules },
  languageOptions: { parser: require('jsonc-eslint-parser') },
  rules: {
    'workspace/lib-pkg-fields': 'error',
    'workspace/lib-pkg-secondary-export': 'error',
    'workspace/lib-pkg-bundle-entry': 'error',
  },
}
```

**ESLint Config Block for project.json**:

```javascript
{
  files: ['libs/**/project.json'],
  plugins: { workspace: eslintRules },
  languageOptions: { parser: require('jsonc-eslint-parser') },
  rules: {
    'workspace/lib-project-metadata': 'error',
    'workspace/lib-project-bundle-config': 'error',
  },
}
```

---

## TypeScript Code Rules

### Rule 1: `require-node-protocol`

**Purpose**: Require the `node:` protocol prefix for all Node.js built-in module imports.

**Focus**: This rule is exclusively about the import source string format—whether it uses the `node:` prefix. It does not concern itself with import syntax (named vs namespace) or import structure.

**Examples**:

```typescript
// ❌ Invalid - missing node: prefix
import { readFile } from 'fs'
import { join } from 'path'
import { Buffer } from 'buffer'

// ✅ Valid - has node: prefix
import { readFile } from 'node:fs'
import { join } from 'node:path'
import { Buffer } from 'node:buffer'
```

**Implementation**:

- **AST Node**: `ImportDeclaration`
- **Check**: `source.value` is a Node.js built-in without `node:` prefix
- **Node.js built-ins**: `fs`, `path`, `os`, `url`, `util`, `events`, `stream`, `buffer`, `crypto`, `http`, `https`, `net`, `dns`, `tls`, `child_process`, `cluster`, `dgram`, `readline`, `repl`, `vm`, `zlib`, `assert`, `async_hooks`, `console`, `constants`, `diagnostics_channel`, `domain`, `inspector`, `module`, `perf_hooks`, `process`, `punycode`, `querystring`, `string_decoder`, `timers`, `trace_events`, `tty`, `v8`, `wasi`, `worker_threads`
- **Auto-fix**: Prepend `node:` to the import source

**File**: `src/rules/require-node-protocol.ts`

---

### Rule 2: `no-namespace-import`

**Purpose**: Prohibit the `import * as` namespace import syntax.

**Focus**: This rule is exclusively about prohibiting the namespace import syntax (`import * as name from`). It does not concern itself with the import source (node modules, external packages, etc.) or import ordering.

**Rationale**: Namespace imports can prevent tree-shaking and obscure which specific exports are actually used. Named imports make dependencies explicit.

**Examples**:

```typescript
// ❌ Invalid - namespace import syntax
import * as utils from './utils'
import * as path from 'node:path'
import * as lodash from 'lodash'

// ✅ Valid - named imports
import { format, parse } from './utils'
import { join, resolve } from 'node:path'
import { debounce } from 'lodash'
```

**Implementation**:

- **AST Node**: `ImportDeclaration` with `ImportNamespaceSpecifier`
- **Check**: Any `import * as` syntax triggers an error
- **No exceptions**: All namespace imports are prohibited

**File**: `src/rules/no-namespace-import.ts`

---

### Rule 3: `no-mixed-type-import`

**Purpose**: Prohibit mixing type imports and value imports in a single import statement.

**Rationale**: Separating type-only imports from value imports improves clarity and allows TypeScript to optimize type-only imports during compilation.

**Examples**:

```typescript
// ❌ Invalid - mixed type and value imports
import { type User, createUser, type Config, initConfig } from './module'
import { type Handler, handle } from './handler'

// ✅ Valid - separated imports
import type { User, Config } from './module'
import { createUser, initConfig } from './module'

import type { Handler } from './handler'
import { handle } from './handler'
```

**Implementation**:

- **AST Node**: `ImportDeclaration`
- **Check**: Import has both `importKind: 'type'` and `importKind: 'value'` specifiers
- **Auto-fix**: Split into two import statements

**File**: `src/rules/no-mixed-type-import.ts`

---

### Rule 4: `import-order`

**Purpose**: Enforce a specific ordering for import declarations.

**Order Requirements**:

1. **Type imports first** (`import type`), then **value imports**
2. Within each group, order by source category:
   1. Node.js built-in modules (`node:*`)
   2. External packages (not `@hyperfrontend/*`)
   3. Hyperfrontend packages (`@hyperfrontend/*`)
   4. Relative imports by depth (furthest first: `../../../` → `../../` → `../`)
   5. Current directory imports (`./`)

**Examples**:

```typescript
// ✅ Valid order
// Type imports first, ordered by source category
import type { Stats } from 'node:fs'
import type { Express } from 'express'
import type { Channel } from '@hyperfrontend/nexus'
import type { BaseConfig } from '../../config'
import type { Helper } from '../helpers'
import type { LocalType } from './types'

// Value imports, same category order
import { readFile } from 'node:fs'
import express from 'express'
import { createChannel } from '@hyperfrontend/nexus'
import { baseConfig } from '../../config'
import { helper } from '../helpers'
import { localFunc } from './local'
```

**Implementation**:

- **AST Node**: `Program` to analyze all `ImportDeclaration` nodes
- **Auto-fix**: Reorder import statements
- **Helper functions**:
  - `getImportCategory(source: string): number` - returns priority
  - `isTypeOnlyImport(node: ImportDeclaration): boolean`
  - `getRelativeDepth(source: string): number` - count `../` segments

**File**: `src/rules/import-order.ts`

---

### Rule 5: `prefer-angle-bracket-assertion`

**Purpose**: Enforce angle bracket syntax (`<T>value`) over `as` syntax (`value as T`) for type assertions.

**Rationale**: Consistency in type assertion syntax across the codebase.

**Examples**:

```typescript
// ❌ Invalid - uses 'as' keyword
const user = data as User
const config = {} as Readonly<Config>
const value = something as unknown as number

// ✅ Valid - uses angle brackets
const user = <User>data
const config = <Readonly<Config>>{}
const value = <number>(<unknown>something)
```

**Implementation**:

- **AST Node**: `TSAsExpression`
- **Not auto-fixable**: Complex expressions may require parentheses or restructuring; manual review preferred

**Note**: This rule is excluded from `.tsx` files to avoid JSX ambiguity.

**File**: `src/rules/prefer-angle-bracket-assertion.ts`

---

### Rule 6: `no-enum`

**Purpose**: Prohibit the `enum` keyword.

**Rationale**: Enums generate unpredictable runtime code. Prefer frozen const objects which are immutable, tree-shakeable, and predictable.

**Examples**:

```typescript
// ❌ Invalid - enum keyword
enum Status {
  Active = 'active',
  Inactive = 'inactive',
}

enum Direction {
  Up,
  Down,
  Left,
  Right,
}

// ✅ Valid - const with freeze pattern
import { freeze } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'

const Status = freeze(<const>{
  Active: 'active',
  Inactive: 'inactive',
})

const Direction = freeze(<const>{
  Up: 0,
  Down: 1,
  Left: 2,
  Right: 3,
})
```

**Implementation**:

- **AST Node**: `TSEnumDeclaration`
- **Not auto-fixable**: Requires semantic understanding and import management

**File**: `src/rules/no-enum.ts`

---

## Test File Rules

### Rule 7: `assertive-test-names`

**Purpose**: Prohibit the word "should" in test descriptions.

**Rationale**: Test names should be assertive statements of fact, not tentative "should" phrases.

**Examples**:

```typescript
// ❌ Invalid - contains "should"
it('should return the correct value', () => {})
it('should handle errors gracefully', () => {})
test('should not throw an exception', () => {})

// ✅ Valid - assertive language
it('returns the correct value', () => {})
it('handles errors gracefully', () => {})
it('does not throw an exception', () => {})
it('triggers callback on success', () => {})
test('rejects invalid input with TypeError', () => {})
```

**Implementation**:

- **AST Node**: `CallExpression` where callee is `it`, `test`, `fit`, `xit`, `describe`, `fdescribe`, `xdescribe`
- **Check**: First string argument contains the word "should" (case-insensitive, word boundary: `/\bshould\b/i`)
- **Not auto-fixable**: Requires human judgment to rewrite

**File**: `src/rules/assertive-test-names.ts`

---

## JSON File Rules

### Scope: Publishable Library Projects

All JSON rules in this section apply only to **publishable library projects**. A publishable library is identified by:

- `project.json` with `"projectType": "library"`
- `project.json` with both `build` and `publish` targets

The existing utility `isPublishableLibrary()` in `src/utils/nx-project.ts` already implements this check.

---

### Rule 8: `lib-pkg-fields`

**Purpose**: Require essential fields in library `package.json` files.

**Required Fields**:

| Field         | Type    | Example                        |
| ------------- | ------- | ------------------------------ |
| `name`        | string  | `"@hyperfrontend/my-lib"`      |
| `description` | string  | `"Description of the library"` |
| `license`     | string  | `"MIT"`                        |
| `sideEffects` | boolean | `false`                        |
| `engines`     | object  | `{ "node": ">=18.0.0" }`       |
| `keywords`    | array   | `["keyword1", "keyword2"]`     |

**Implementation**:

- **Target**: `package.json` in publishable library projects
- **Check**: Each required field exists and has a valid non-empty value
- **Separate message ID for each missing field**

**File**: `src/rules/lib-pkg-fields.ts`

---

### Rule 9: `lib-pkg-secondary-export`

**Purpose**: Require at least one secondary export beyond the main entry.

**Rationale**: Libraries should expose well-defined secondary entry points for tree-shaking and modular consumption.

**Examples**:

```json
// ❌ Invalid - only main export
{
  "exports": {
    ".": "./src/index.js"
  }
}

// ✅ Valid - has secondary export
{
  "exports": {
    ".": "./src/index.js",
    "./browser": "./src/browser/index.js"
  }
}
```

**Implementation**:

- **Target**: `package.json` in publishable library projects
- **Check**: `exports` object has more than one key

**File**: `src/rules/lib-pkg-secondary-export.ts`

---

### Rule 10: `lib-pkg-bundle-entry`

**Purpose**: When `project.json` specifies bundled output entries (IIFE/UMD), those entries must exist in `package.json` exports.

**Rationale**: Bundled outputs reference entry points that must be properly declared in the package exports.

**Examples**:

```json
// project.json specifies entry "./browser"
{
  "targets": {
    "build": {
      "options": {
        "iife": { "entry": "./browser" },
        "umd": { "entry": "./browser" }
      }
    }
  }
}

// ❌ Invalid package.json - missing ./browser export
{
  "exports": {
    ".": "./src/index.js"
  }
}

// ✅ Valid package.json
{
  "exports": {
    ".": "./src/index.js",
    "./browser": "./src/browser/index.js"
  }
}
```

**Implementation**:

- **Target**: `package.json` in publishable library projects with bundled outputs
- **Cross-file check**: Read `project.json` to find IIFE/UMD entry values, verify they exist in `package.json` exports

**File**: `src/rules/lib-pkg-bundle-entry.ts`

---

### Rule 11: `lib-project-metadata`

**Purpose**: Require essential metadata in library `project.json` files.

**Required Fields**:

| Field         | Requirement                    |
| ------------- | ------------------------------ |
| `tags`        | Non-empty array of tag strings |
| `name`        | Must start with `lib-` prefix  |
| `description` | Non-empty string               |

**Name Convention**:

- `lib-cryptography` → `@hyperfrontend/cryptography`
- `lib-logging` → `@hyperfrontend/logging`
- `lib-immutable-api-utils` → `@hyperfrontend/immutable-api-utils`

**Examples**:

```json
// ❌ Invalid
{
  "name": "cryptography",
  "projectType": "library"
}

// ✅ Valid
{
  "name": "lib-cryptography",
  "description": "Cryptography utilities for browser and Node.js environments.",
  "projectType": "library",
  "tags": ["type:util", "scope:public"]
}
```

**Implementation**:

- **Target**: `project.json` in publishable library projects
- **Separate message ID for each validation failure**

**File**: `src/rules/lib-project-metadata.ts`

---

### Rule 12: `lib-project-bundle-config`

**Purpose**: For bundled outputs (IIFE/UMD), require `entry` and `globalName` fields.

**Rationale**: Bundled outputs must specify their entry point and global variable name for proper browser/script-tag consumption.

**Examples**:

```json
// ❌ Invalid - missing entry and globalName
{
  "targets": {
    "build": {
      "options": {
        "iife": {},
        "umd": {}
      }
    }
  }
}

// ✅ Valid
{
  "targets": {
    "build": {
      "options": {
        "iife": {
          "entry": ".",
          "globalName": "HyperfrontendMyLib"
        },
        "umd": {
          "entry": ".",
          "globalName": "HyperfrontendMyLib"
        }
      }
    }
  }
}
```

**Implementation**:

- **Target**: `project.json` in publishable library projects
- **Condition**: Build target has `iife` or `umd` configuration
- **Check**: Each bundled output has non-empty `entry` and `globalName` strings

**File**: `src/rules/lib-project-bundle-config.ts`

---

## File Structure

```
tools/eslint-rules/
├── src/
│   ├── index.ts                           # Rule exports
│   ├── rules/
│   │   ├── # Existing rules
│   │   ├── no-unsafe-builtin-methods.ts
│   │   ├── no-unsafe-builtin-methods.spec.ts
│   │   ├── no-unwanted-barrel-files.ts
│   │   ├── no-unwanted-barrel-files.spec.ts
│   │   │
│   │   ├── # TypeScript rules
│   │   ├── require-node-protocol.ts
│   │   ├── require-node-protocol.spec.ts
│   │   ├── no-namespace-import.ts
│   │   ├── no-namespace-import.spec.ts
│   │   ├── no-mixed-type-import.ts
│   │   ├── no-mixed-type-import.spec.ts
│   │   ├── import-order.ts
│   │   ├── import-order.spec.ts
│   │   ├── prefer-angle-bracket-assertion.ts
│   │   ├── prefer-angle-bracket-assertion.spec.ts
│   │   ├── no-enum.ts
│   │   ├── no-enum.spec.ts
│   │   │
│   │   ├── # Test file rules
│   │   ├── assertive-test-names.ts
│   │   ├── assertive-test-names.spec.ts
│   │   │
│   │   ├── # JSON rules
│   │   ├── lib-pkg-fields.ts
│   │   ├── lib-pkg-fields.spec.ts
│   │   ├── lib-pkg-secondary-export.ts
│   │   ├── lib-pkg-secondary-export.spec.ts
│   │   ├── lib-pkg-bundle-entry.ts
│   │   ├── lib-pkg-bundle-entry.spec.ts
│   │   ├── lib-project-metadata.ts
│   │   ├── lib-project-metadata.spec.ts
│   │   ├── lib-project-bundle-config.ts
│   │   └── lib-project-bundle-config.spec.ts
│   │
│   └── utils/
│       ├── nx-project.ts                  # Existing
│       ├── node-builtins.ts               # Node.js built-in module list
│       ├── import-analysis.ts             # Import categorization helpers
│       └── json-file-context.ts           # JSON rule utilities
│
├── README.md
├── eslint.config.cjs
├── jest.config.ts
├── package.json
├── project.json
├── tsconfig.json
├── tsconfig.lib.json
└── tsconfig.spec.json
```

---

## Configuration in eslint.base.config.cjs

All rules are consumed from `/eslint.base.config.cjs`:

```javascript
const nx = require('@nx/eslint-plugin')
const pluginJest = require('eslint-plugin-jest')
const pluginJsdoc = require('eslint-plugin-jsdoc')
const eslintRules = require('./tools/eslint-rules/src/index.ts')

module.exports = [
  // ... existing configs ...

  // TypeScript code rules (all .ts files)
  {
    files: ['**/*.ts'],
    ignores: ['**/jest.config.ts', '**/jest.setup.ts', '**/jest.setup.browser.ts'],
    plugins: {
      workspace: eslintRules,
    },
    rules: {
      'workspace/require-node-protocol': 'error',
      'workspace/no-namespace-import': 'error',
      'workspace/no-mixed-type-import': 'error',
      'workspace/import-order': 'error',
      'workspace/no-enum': 'error',
    },
  },

  // Angle bracket assertion rule (excludes .tsx)
  {
    files: ['**/*.ts'],
    ignores: ['**/jest.config.ts', '**/jest.setup.ts', '**/jest.setup.browser.ts', '**/*.tsx'],
    plugins: {
      workspace: eslintRules,
    },
    rules: {
      'workspace/prefer-angle-bracket-assertion': 'error',
    },
  },

  // Test file rules
  {
    files: ['**/*.spec.ts'],
    ignores: ['**/jest.config.ts', '**/jest.setup.ts', '**/jest.setup.browser.ts'],
    plugins: {
      workspace: eslintRules,
    },
    rules: {
      'workspace/assertive-test-names': 'error',
    },
  },

  // Publishable library package.json rules
  {
    files: ['libs/**/package.json'],
    plugins: {
      workspace: eslintRules,
    },
    languageOptions: {
      parser: require('jsonc-eslint-parser'),
    },
    rules: {
      'workspace/lib-pkg-fields': 'error',
      'workspace/lib-pkg-secondary-export': 'error',
      'workspace/lib-pkg-bundle-entry': 'error',
    },
  },

  // Publishable library project.json rules
  {
    files: ['libs/**/project.json'],
    plugins: {
      workspace: eslintRules,
    },
    languageOptions: {
      parser: require('jsonc-eslint-parser'),
    },
    rules: {
      'workspace/lib-project-metadata': 'error',
      'workspace/lib-project-bundle-config': 'error',
    },
  },
]
```

---

## Error Message Guidelines

All rule error messages must be:

1. **Clear about what is wrong**: State the specific violation
2. **Explain why it matters**: Brief rationale
3. **Provide actionable fixes**: Tell the developer how to resolve it

### Message Template Examples

**Good error messages**:

```
// require-node-protocol
"Import from 'fs' must use 'node:fs' prefix. Node.js built-in modules require the node: protocol for clarity and to avoid npm package name collisions."

// no-namespace-import
"Namespace import 'import * as X' is not allowed. Use named imports 'import { ... }' to enable tree-shaking and make dependencies explicit."

// no-mixed-type-import
"Mixed type and value imports are not allowed. Split into separate statements:
  import type { TypeA, TypeB } from '...'
  import { valueA, valueB } from '...'"

// no-enum
"The 'enum' keyword is not allowed. Use a frozen const object instead:
  import { freeze } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
  const MyEnum = freeze(<const>{ Key: 'value' })"

// assertive-test-names
"Test description contains 'should'. Use assertive language instead:
  ❌ 'should return the value'
  ✅ 'returns the value'"

// lib-pkg-fields (missing license)
"Publishable library package.json is missing required field 'license'. Add: \"license\": \"MIT\""

// lib-project-bundle-config (missing globalName)
"Bundled output 'iife' is missing required field 'globalName'. Bundled outputs must specify a global variable name for browser consumption."
```

---

## Testing Strategy

### Test Pattern

Follow the existing pattern using `@typescript-eslint/rule-tester`:

```typescript
import type { InvalidTestCase, ValidTestCase } from '@typescript-eslint/rule-tester'
import { RuleTester } from '@typescript-eslint/rule-tester'
import rule from './my-rule'

type TestOptions = readonly []
type MessageIds = 'myMessageId'

const ruleTester = new RuleTester({
  languageOptions: {
    parserOptions: {
      projectService: false,
    },
  },
})

ruleTester.run('my-rule', rule, {
  valid: [
    // Valid test cases
  ],
  invalid: [
    // Invalid test cases with expected errors
  ],
})
```

### Coverage Requirements

Maintain existing coverage thresholds:

- **Branches**: 97%
- **Functions**: 100%
- **Lines**: 100%
- **Statements**: 100%

### Test Categories per Rule

Each rule must include tests for:

1. **Valid cases** - code that should pass
2. **Invalid cases** - code that should trigger errors
3. **Edge cases** - boundary conditions
4. **Exemptions** - cases that should be skipped (non-publishable projects, etc.)
5. **Auto-fix verification** (for fixable rules)

---

## Dependencies

### Existing Dependencies (already available)

- `@typescript-eslint/utils` - Rule creation utilities
- `@typescript-eslint/rule-tester` - Testing framework
- `jsonc-eslint-parser` - JSON file parsing
- `eslint` - ESLint core

### No New Dependencies Required

All functionality can be implemented with existing dependencies.

---

## Rule Summary

| #   | Rule Name                        | Scope                    | Fixable |
| --- | -------------------------------- | ------------------------ | ------- |
| 1   | `require-node-protocol`          | `**/*.ts`                | ✅      |
| 2   | `no-namespace-import`            | `**/*.ts`                | ❌      |
| 3   | `no-mixed-type-import`           | `**/*.ts`                | ✅      |
| 4   | `import-order`                   | `**/*.ts`                | ✅      |
| 5   | `prefer-angle-bracket-assertion` | `**/*.ts` (excl. `.tsx`) | ❌      |
| 6   | `no-enum`                        | `**/*.ts`                | ❌      |
| 7   | `assertive-test-names`           | `**/*.spec.ts`           | ❌      |
| 8   | `lib-pkg-fields`                 | `libs/**/package.json`   | ❌      |
| 9   | `lib-pkg-secondary-export`       | `libs/**/package.json`   | ❌      |
| 10  | `lib-pkg-bundle-entry`           | `libs/**/package.json`   | ❌      |
| 11  | `lib-project-metadata`           | `libs/**/project.json`   | ❌      |
| 12  | `lib-project-bundle-config`      | `libs/**/project.json`   | ❌      |

---

_Requirements specification for hyperfrontend ESLint rules_
