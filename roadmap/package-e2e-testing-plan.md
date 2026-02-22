# Package E2E Testing Plan

Testing library build outputs (CJS, ESM, IIFE, UMD) to ensure publishable packages work correctly in real-world consumption scenarios.

---

## Problem Statement

Currently, publishable libraries under `libs/` have build targets that produce multiple output formats:

- **ESM** — `index.esm.js` for modern bundlers and native ES modules
- **CJS** — `index.cjs.js` for Node.js CommonJS consumers
- **IIFE** — `bundle/index.iife.js` for direct browser `<script>` inclusion
- **UMD** — `bundle/index.umd.js` for universal consumption (AMD, CommonJS, global)

However, there is no automated verification that these outputs:

1. Are importable/requireable without runtime errors
2. Export the expected symbols and types
3. Work correctly across different runtime environments (Node.js, browser)
4. Have correct `package.json` exports field mappings

---

## Solution Overview

Create dedicated E2E test projects under `apps/package-e2e/` that consume built library outputs via npm pack + tarball install. Each E2E project manages its own dependencies independently (following the `docs-site` pattern).

### Package Linking Strategy: npm pack + install tarball

Run `npm pack` on dist, then install the tarball:

```bash
cd dist/libs/nexus && npm pack
cd apps/package-e2e/nexus && npm install ../../../dist/libs/nexus/hyperfrontend-nexus-0.1.0.tgz
```

**Benefits:**

- Most accurate simulation of real npm install
- Tests exact artifact that would be published
- Catches `.npmignore` and `files` field issues

### Directory Structure

```
apps/
└── package-e2e/
    ├── cryptography/           # Tests for @hyperfrontend/cryptography
    │   ├── package.json        # Local dependencies, tarball install
    │   ├── project.json        # Nx project config
    │   ├── tsconfig.json       # Own TypeScript config (no base paths)
    │   ├── jest.config.cjs.ts
    │   ├── jest.config.esm.ts
    │   ├── jest.config.browser.ts
    │   └── src/
    │       ├── cjs.spec.ts     # Test CommonJS require()
    │       ├── esm.spec.ts     # Test ES module import
    │       ├── iife.spec.ts    # Test IIFE bundle (jsdom)
    │       └── umd.spec.ts     # Test UMD bundle
    ├── nexus/
    │   └── ...
    ├── logging/
    │   └── ...
    └── shared/                 # Shared test utilities
        └── helpers.ts
```

---

## TypeScript Configuration

Each E2E project uses its own `tsconfig.json` that does **not** extend the base config:

```jsonc
// apps/package-e2e/nexus/tsconfig.json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": false,
    "noEmit": true,
    // NO baseUrl or paths - use node_modules resolution
    "types": ["node", "jest"],
  },
  "include": ["src/**/*.ts"],
}
```

**Key points:**

- No `extends` from `tsconfig.base.json`
- No `paths` mapping — relies on `node_modules` resolution
- Uses `NodeNext` module resolution for accurate CJS/ESM handling
- Tarball-installed packages resolve through standard node resolution

---

## Jest Configuration

### CJS Test Configuration

```typescript
// apps/package-e2e/nexus/jest.config.cjs.ts
import type { Config } from 'jest'

const config: Config = {
  displayName: 'package-e2e-nexus-cjs',
  testEnvironment: 'node',
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json' }],
  },
  testMatch: ['<rootDir>/src/cjs.spec.ts'],
  moduleNameMapper: {}, // No mappings - use real node_modules
}

export default config
```

### ESM Test Configuration

For ESM tests, use Node.js with `--experimental-vm-modules`:

```typescript
// apps/package-e2e/nexus/jest.config.esm.ts
import type { Config } from 'jest'

const config: Config = {
  displayName: 'package-e2e-nexus-esm',
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.ts'],
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        tsconfig: '<rootDir>/tsconfig.json',
        useESM: true,
      },
    ],
  },
  testMatch: ['<rootDir>/src/esm.spec.ts'],
}

export default config
```

### Browser Bundle Tests (IIFE/UMD)

```typescript
// apps/package-e2e/nexus/jest.config.browser.ts
import type { Config } from 'jest'

const config: Config = {
  displayName: 'package-e2e-nexus-browser',
  testEnvironment: 'jsdom',
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json' }],
  },
  testMatch: ['<rootDir>/src/iife.spec.ts', '<rootDir>/src/umd.spec.ts'],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
}

export default config
```

---

## Test Scope & Philosophy

We will **not** retest the entirety or any significant portion of library APIs — that's what near 100% code coverage unit tests are for. Instead, E2E tests confirm:

1. **Import behavior is sound and correct** — the package is importable/requireable
2. **Single functionality validation** — test one representative capability of what is imported

### Functionality to Test Per Library

| Library            | Entry Point(s)                    | Functionality to Validate                            |
| ------------------ | --------------------------------- | ---------------------------------------------------- |
| `nexus`            | `.`                               | `createBroker()` returns valid broker instance       |
| `cryptography`     | `./browser`, `./node`, `./common` | `hash()` returns expected output                     |
| `logging`          | `.`                               | `createLogger()` returns logger with `info()` method |
| `network-protocol` | `./browser/v1`, `./node/v1`, etc. | `createChannel()` returns channel instance           |
| `state-machine`    | `.`                               | `createStore()` returns store with `getState()`      |
| `utils/*`          | Various                           | Primary exported function executes without error     |

---

## Library E2E Test Matrix

Build outputs × platform determines the distinct jest configs required per library.

### Legend

- **ESM-N** = ESM in Node environment
- **CJS-N** = CJS in Node environment
- **IIFE-B** = IIFE bundle in browser (jsdom)
- **UMD-B** = UMD bundle in browser (jsdom)
- **UMD-N** = UMD in Node (CJS simulation)

### Matrix

| Library              | Platform     | ESM-N | CJS-N | IIFE-B | UMD-B | UMD-N | Notes                                        |
| -------------------- | ------------ | :---: | :---: | :----: | :---: | :---: | -------------------------------------------- |
| **nexus**            | browser-only |   ✓   |   ✓   |   ✓    |   ✓   |   -   | Single entry `.`                             |
| **cryptography**     | isomorphic   |   ✓   |   ✓   |   ✓    |   ✓   |   -   | 3 entries: `./browser`, `./node`, `./common` |
| **logging**          | universal    |   ✓   |   ✓   |   ✓    |   ✓   |   ✓   | Single entry `.`                             |
| **network-protocol** | isomorphic   |   ✓   |   ✓   |   ✓    |   ✓   |   -   | Multiple bundles: v1, v2 per platform        |
| **state-machine**    | universal    |   ✓   |   ✓   |   ✓    |   ✓   |   ✓   | Single entry `.`                             |
| **web-worker**       | browser-only |   ✓   |   -   |   -    |   -   |   -   | No build outputs currently                   |

### Utils Sub-Libraries

| Library                                 | Platform     | ESM-N | CJS-N | IIFE-B | UMD-B | Notes                            |
| --------------------------------------- | ------------ | :---: | :---: | :----: | :---: | -------------------------------- |
| `@hyperfrontend/data-utils`             | universal    |   ✓   |   ✓   |   ✓    |   ✓   |                                  |
| `@hyperfrontend/function-utils`         | universal    |   ✓   |   ✓   |   ✓    |   ✓   |                                  |
| `@hyperfrontend/immutable-api-utils`    | universal    |   ✓   |   ✓   |   ✓    |   ✓   |                                  |
| `@hyperfrontend/json-utils`             | universal    |   ✓   |   ✓   |   ✓    |   ✓   |                                  |
| `@hyperfrontend/list-utils`             | universal    |   ✓   |   ✓   |   ✓    |   ✓   |                                  |
| `@hyperfrontend/random-generator-utils` | universal    |   ✓   |   ✓   |   ✓    |   ✓   |                                  |
| `@hyperfrontend/string-utils`           | isomorphic   |   ✓   |   ✓   |   ✓    |   ✓   | 2 entries: `./browser`, `./node` |
| `@hyperfrontend/time-utils`             | universal    |   ✓   |   ✓   |   ✓    |   ✓   |                                  |
| `@hyperfrontend/ui-utils/*`             | browser-only |   ✓   |   -   |   ✓    |   ✓   | Multiple sub-entries             |

---

## Test Implementation Patterns

### CJS Tests

```typescript
// apps/package-e2e/nexus/src/cjs.spec.ts
describe('@hyperfrontend/nexus CJS', () => {
  it('should be requireable', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const nexus = require('@hyperfrontend/nexus')
    expect(nexus).toBeDefined()
  })

  it('should export createBroker', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { createBroker } = require('@hyperfrontend/nexus')
    expect(typeof createBroker).toBe('function')
    const broker = createBroker({ id: 'test' })
    expect(broker).toBeDefined()
  })
})
```

### ESM Tests

```typescript
// apps/package-e2e/nexus/src/esm.spec.ts
describe('@hyperfrontend/nexus ESM', () => {
  it('should be importable', async () => {
    const nexus = await import('@hyperfrontend/nexus')
    expect(nexus).toBeDefined()
  })

  it('should export createBroker', async () => {
    const { createBroker } = await import('@hyperfrontend/nexus')
    expect(typeof createBroker).toBe('function')
    const broker = createBroker({ id: 'test' })
    expect(broker).toBeDefined()
  })
})
```

### IIFE Bundle Tests

```typescript
// apps/package-e2e/nexus/src/iife.spec.ts
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

describe('@hyperfrontend/nexus IIFE bundle', () => {
  const bundlePath = resolve(__dirname, '../../../../dist/libs/nexus/bundle/index.iife.js')

  it('bundle file should exist', () => {
    expect(existsSync(bundlePath)).toBe(true)
  })

  it('should attach to window global and createBroker works', () => {
    const bundleCode = readFileSync(bundlePath, 'utf-8')
    const script = document.createElement('script')
    script.textContent = bundleCode
    document.head.appendChild(script)

    expect((<any>window).HyperfrontendNexus).toBeDefined()
    const broker = (<any>window).HyperfrontendNexus.createBroker({ id: 'test' })
    expect(broker).toBeDefined()
  })
})
```

### UMD Bundle Tests

```typescript
// apps/package-e2e/nexus/src/umd.spec.ts
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

describe('@hyperfrontend/nexus UMD bundle', () => {
  const bundlePath = resolve(__dirname, '../../../../dist/libs/nexus/bundle/index.umd.js')

  it('bundle file should exist', () => {
    expect(existsSync(bundlePath)).toBe(true)
  })

  it('should work as global in browser context', () => {
    const bundleCode = readFileSync(bundlePath, 'utf-8')
    const script = document.createElement('script')
    script.textContent = bundleCode
    document.head.appendChild(script)

    expect((<any>window).HyperfrontendNexus).toBeDefined()
    const broker = (<any>window).HyperfrontendNexus.createBroker({ id: 'test' })
    expect(broker).toBeDefined()
  })
})
```

---

## Nx Project Configuration

### project.json Template

```json
{
  "$schema": "../../../node_modules/nx/schemas/project-schema.json",
  "name": "package-e2e-nexus",
  "description": "E2E tests for @hyperfrontend/nexus package outputs",
  "sourceRoot": "{projectRoot}/src",
  "projectType": "application",
  "tags": ["type:e2e", "scope:internal"],
  "targets": {
    "e2e:cjs": {
      "executor": "@nx/jest:jest",
      "options": {
        "jestConfig": "{projectRoot}/jest.config.cjs.ts"
      }
    },
    "e2e:esm": {
      "executor": "@nx/jest:jest",
      "options": {
        "jestConfig": "{projectRoot}/jest.config.esm.ts"
      }
    },
    "e2e:browser": {
      "executor": "@nx/jest:jest",
      "options": {
        "jestConfig": "{projectRoot}/jest.config.browser.ts"
      }
    },
    "e2e": {
      "executor": "nx:run-commands",
      "dependsOn": ["^build"],
      "options": {
        "commands": ["nx run package-e2e-nexus:e2e:cjs", "nx run package-e2e-nexus:e2e:esm", "nx run package-e2e-nexus:e2e:browser"],
        "parallel": false
      }
    }
  },
  "implicitDependencies": ["lib-nexus"]
}
```

### Dependency Chain

The `implicitDependencies` ensures the library is built before E2E tests run:

```
lib-nexus:build → package-e2e-nexus:e2e
```

---

## E2E Executor Design

Create an `e2e` executor under `tools/package` plugin to orchestrate npm pack + install + test workflow.

### Schema (tools/package/src/executors/e2e/schema.json)

```json
{
  "$schema": "http://json-schema.org/schema",
  "type": "object",
  "title": "E2E executor schema",
  "description": "Test package build outputs via npm pack + tarball install.",
  "properties": {
    "packageDir": {
      "type": "string",
      "description": "Path to built package directory (e.g., dist/libs/nexus)"
    },
    "testDir": {
      "type": "string",
      "description": "Path to E2E test project directory"
    },
    "formats": {
      "type": "array",
      "items": {
        "type": "string",
        "enum": ["cjs", "esm", "iife", "umd"]
      },
      "description": "Output formats to test"
    },
    "platforms": {
      "type": "array",
      "items": {
        "type": "string",
        "enum": ["node", "browser"]
      },
      "description": "Platforms to test against"
    }
  },
  "required": ["packageDir", "testDir"]
}
```

### Executor Workflow

1. Run `npm pack` in `packageDir` to create tarball
2. Run `npm install <tarball>` in `testDir`
3. Execute jest configs based on `formats` × `platforms`
4. Report results

---

## Action Plan (Sequential Todo List)

### Phase 1: Infrastructure & Validation

1. Create `apps/package-e2e/` directory structure
2. Create `apps/package-e2e/shared/helpers.ts` with bundle loading utilities
3. Implement `logging` E2E project (simplest: single entry, universal platform)
4. Validate isolated tsconfig resolves to node_modules, not source
5. Validate npm pack + tarball install workflow manually
6. Confirm all 4 format tests pass for `logging`

### Phase 2: E2E Executor

7. Create `tools/package/src/executors/e2e/schema.json`
8. Create `tools/package/src/executors/e2e/executor.ts`
9. Register executor in `tools/package/executors.json`
10. Refactor `logging` E2E to use new executor
11. Validate executor runs npm pack + install + tests correctly

### Phase 3: Core Libraries Rollout

12. Implement `nexus` E2E project (browser-focused, single entry)
13. Implement `state-machine` E2E project (universal, single entry)
14. Implement `cryptography` E2E project (isomorphic, multi-entry)
15. Implement `network-protocol` E2E project (isomorphic, multiple bundles)

### Phase 4: Utils Libraries Rollout

16. Implement `data-utils` E2E project
17. Implement `function-utils` E2E project
18. Implement `json-utils` E2E project
19. Implement `list-utils` E2E project
20. Implement `time-utils` E2E project
21. Implement `random-generator-utils` E2E project
22. Implement `string-utils` E2E project (isomorphic)
23. Implement `immutable-api-utils` E2E project
24. Implement `ui-utils` E2E project (browser-only)

### Phase 5: CI Integration & Documentation

25. Add `e2e:all` target to run all package E2E tests
26. Integrate E2E tests into CI workflow (run after build, before publish)
27. Document E2E testing approach in CONTRIBUTING.md
28. Add generator for scaffolding new package E2E projects (optional)

---

## Success Criteria

- [ ] All E2E tests pass when run against fresh build
- [ ] Imports resolve to tarball-installed package, not source
- [ ] CJS require() works in Node.js
- [ ] ESM import works in Node.js
- [ ] IIFE bundle attaches correct global in jsdom
- [ ] UMD bundle works in browser context
- [ ] E2E executor automates npm pack + install + test workflow
- [ ] CI runs full E2E suite before npm publish

---

## Implementation Findings (Phase 1 Complete)

### What Was Implemented

- `apps/package-e2e/logging/` — Full E2E test project for `@hyperfrontend/logging`
- `apps/package-e2e/shared/helpers.ts` — Bundle loading utilities for IIFE/UMD tests
- `tools/package/src/executors/e2e/` — E2E executor (schema + implementation)
- Executor registered in `tools/package/executors.json`

### Test Results Summary

| Format   | Test Result | Notes                                            |
| -------- | ----------- | ------------------------------------------------ |
| **CJS**  | ✅ Pass     | `require('@hyperfrontend/logging')` works        |
| **ESM**  | ✅ Pass     | `import('@hyperfrontend/logging')` works         |
| **IIFE** | ✅ Pass     | `window.HyperfrontendLogging` attaches correctly |
| **UMD**  | ✅ Pass     | Browser global + CJS simulation both work        |

### Runtime Import Behavior

- **CJS require()** — Works correctly, resolves to `index.cjs.js`
- **ESM import** — Works correctly, resolves to `index.esm.js`
- **Functional tests pass** — `createLogger()` returns valid logger instance

---

## Critical Issues Discovered

### Issue 1: Type Declarations Missing from Package Root

**Severity:** HIGH — TypeScript consumers cannot resolve types

**Observed:**

- `package.json` declares: `"types": "./index.d.ts"`
- Actual location: `libs/logging/src/index.d.ts` (nested under `libs/`)
- No `.d.ts` files exist at package root

**Impact:**

- TypeScript users get implicit `any` errors
- IDE autocomplete/intellisense broken
- Workaround required: `noImplicitAny: false` in E2E tsconfig

**Root Cause:**

- Build executor outputs declaration files mirroring workspace source structure
- Declaration paths not flattened to package root

**Recommended Fix:**

- Update `@hyperfrontend/package:build` executor to output declarations at package root
- OR update `types` field in published `package.json` to point to actual path

### Issue 2: Declaration File Path Structure

**Observed structure in tarball:**

```
@hyperfrontend/logging/
├── index.cjs.js          ← Entry point
├── index.esm.js          ← Entry point
├── package.json          ← types: "./index.d.ts" (BROKEN)
├── bundle/               ← IIFE/UMD bundles
└── libs/                 ← Declaration files here instead
    ├── logging/src/
    │   ├── index.d.ts
    │   ├── create-logger.d.ts
    │   └── ...
    └── utils/            ← Bundled deps declarations
        ├── data/src/
        └── function/src/
```

**Expected structure:**

```
@hyperfrontend/logging/
├── index.cjs.js
├── index.esm.js
├── index.d.ts            ← Should be here
├── create-logger.d.ts    ← Should be here
├── package.json
└── bundle/
```

### Issue 3: Jest Config Path Behavior

**Observed:**

- Running Jest from project root with relative config path fails
- Must use absolute paths: `npx jest --config /absolute/path/jest.config.*.ts`
- OR run from E2E project directory: `cd apps/package-e2e/logging && npx jest`

**Impact:** E2E executor needs to either:

- Use absolute paths when invoking Jest
- Change `cwd` to the test project directory before running

### Issue 4: jsdom Global Property Handling

**Observed:**

- IIFE/UMD bundles create non-configurable window properties
- `delete window.HyperfrontendLogging` throws TypeError
- Must use `window.X = undefined` instead of `delete`

**Fixed in:** `apps/package-e2e/logging/jest.setup.ts`

---

## Decision Points Before Proceeding

### Decision A: Fix Build Output Before Continuing?

**Options:**

1. **Fix now** — Update build executor to output declarations correctly, then continue E2E rollout
2. **Defer** — Continue E2E implementation with `noImplicitAny: false` workaround, fix build later
3. **Investigate deeper** — Audit all library build outputs to understand full scope before deciding

**Implication:** If declarations are broken for `logging`, they're likely broken for all libraries.

### Decision B: E2E Test Strictness

**Options:**

1. **Loose** — Use `noImplicitAny: false`, only test runtime behavior
2. **Strict** — Require proper type resolution, test that `types` field works correctly
3. **Hybrid** — Separate tests for runtime vs type resolution

### Decision C: Executor Integration Approach

**Options:**

1. **Use executor** — Invoke via `@hyperfrontend/package:e2e` target
2. **Direct Jest** — Keep running Jest directly from E2E project directories
3. **Hybrid** — Use executor for CI, direct Jest for local dev

---

## Threads to Pull

1. **Audit other library build outputs** — Check if `nexus`, `cryptography`, etc. have same declaration issue
2. **Review build executor declaration generation** — Understand why declarations go under `libs/` instead of root
3. **Test ESM in strict mode** — Verify `NODE_OPTIONS='--experimental-vm-modules'` needed for Jest ESM
4. **Validate exports field accuracy** — Do all sub-paths in `exports` resolve correctly?
5. **Check bundled dependencies** — `libs/utils/` in tarball contains bundled dep declarations — is this intentional?
