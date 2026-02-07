# Build System Progress Report

**Date**: February 7, 2026
**Branch**: `build-and-badges`
**Status**: Architecture Revision in Progress

---

## Executive Summary

This document establishes the **first-principles rationale** for our build system, grounded in industry standards from popular open-source libraries (date-fns, zod, rxjs, axios, three.js).

**Core Principle**: Minimize consumer friction. Complexity should be absorbed by the build system, not pushed onto consumers.

---

## Part 1: JavaScript Module Systems (First Principles)

### The Four Module Formats

| Format   | Syntax                      | Environment        | Use Case                          |
| -------- | --------------------------- | ------------------ | --------------------------------- |
| **ESM**  | `import/export`             | Modern everywhere  | Modern bundlers, tree-shaking     |
| **CJS**  | `require/module.exports`    | Node.js            | Node.js apps, legacy bundlers     |
| **UMD**  | Auto-detects CJS/AMD/global | Universal          | CDN fallback with bundler compat  |
| **IIFE** | `(function(){})()` + global | Browser (no build) | `<script>` tag, zero-config usage |

### Key Industry Patterns (What Works)

**Pattern 1: Conditional Exports (date-fns, zod, rxjs)**

Bundlers automatically resolve the correct format based on how code is imported:

```json
{
  "exports": {
    ".": {
      "types": "./index.d.ts",
      "import": "./index.js",
      "require": "./index.cjs"
    }
  }
}
```

Consumer just writes `import { x } from 'package'` — the bundler picks ESM or CJS.

**Pattern 2: CDN-Ready Bundles (axios, three.js)**

Separate files for browser script-tag usage:

```json
{
  "unpkg": "dist/package.umd.min.js",
  "jsdelivr": "dist/package.umd.min.js"
}
```

**Pattern 3: Secondary Entry Points (rxjs, date-fns)**

Sub-modules for tree-shaking granularity:

```json
{
  "exports": {
    ".": { "import": "./index.js", "require": "./index.cjs" },
    "./operators": { "import": "./operators/index.js", "require": "./operators/index.cjs" }
  }
}
```

---

## Part 2: Requirements Analysis

### Confirmed Requirements (from stakeholder input)

| Requirement                     | Priority | Notes                                              |
| ------------------------------- | -------- | -------------------------------------------------- |
| Support all 4 formats           | Must     | ESM, CJS, UMD, IIFE                                |
| Support Node 14+, broad browser | Must     | Maximum compatibility                              |
| Tree-shaking support            | Must     | Critical for consumer bundle sizes                 |
| Auto-resolve ESM/CJS            | Must     | Use conditional exports (industry standard)        |
| Self-contained bundles          | Must     | Both external-deps AND bundled versions            |
| Explicit subpaths available     | Should   | Optional override for consumers with special needs |
| Both minified + unminified      | Should   | Both `.js` and `.min.js` for UMD/IIFE              |
| Global var: Hyperfrontend\*     | Should   | e.g., `HyperfrontendNexus`, `HyperfrontendUtils`   |

### Consumer Profiles

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                         CONSUMER PROFILE MATRIX                                  │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  1. INTERNAL MONOREPO APPS                                                      │
│     └── Consumption: TypeScript source (tsconfig paths)                         │
│     └── Build: Vite, Webpack, or direct TS compilation                         │
│     └── Format: ESM preferred, resolved by bundler                             │
│                                                                                  │
│  2. EXTERNAL NPM CONSUMERS (Modern)                                             │
│     └── Consumption: npm install @hyperfrontend/utils                          │
│     └── Build: Vite, esbuild, Webpack 5+, Rollup                               │
│     └── Format: ESM (auto-resolved), tree-shaking enabled                      │
│                                                                                  │
│  3. EXTERNAL NPM CONSUMERS (Legacy)                                             │
│     └── Consumption: npm install @hyperfrontend/utils                          │
│     └── Build: Webpack 4, older Node.js apps                                   │
│     └── Format: CJS (auto-resolved)                                            │
│                                                                                  │
│  4. CDN / VANILLA JS                                                            │
│     └── Consumption: <script src="unpkg.com/@hyperfrontend/nexus">             │
│     └── Build: None (direct browser execution)                                 │
│     └── Format: UMD or IIFE (self-contained, all deps bundled)                 │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## Part 3: Revised Architecture

### ❌ REJECTED: Output Categories as Subpaths

The previous plan proposed:

```
import { x } from '@hyperfrontend/utils/esm'
import { x } from '@hyperfrontend/utils/commonjs'
import { x } from '@hyperfrontend/utils/bundled'
```

**Why this is wrong:**

1. **Antipattern**: No major library does this. It pushes format choice onto consumers.
2. **Breaks tooling**: Bundlers won't auto-resolve; consumers must know their environment.
3. **Unnecessary**: Conditional exports solve this automatically.

### ✅ APPROVED: Industry-Standard Conditional Exports

Consumers write:

```typescript
import { x } from '@hyperfrontend/utils' // ESM or CJS auto-resolved
```

The package.json handles format selection:

```json
{
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js",
      "require": "./dist/index.cjs"
    }
  }
}
```

### Output Structure (Revised)

```
dist/libs/<package>/
├── index.js              → ESM (external deps) - primary for modern bundlers
├── index.cjs             → CJS (external deps) - fallback for Node.js/legacy
├── index.d.ts            → TypeScript declarations
├── index.d.cts           → CTS declarations (for strict CJS consumers)
│
├── <feature>/            → Secondary entry points (if applicable)
│   ├── index.js
│   ├── index.cjs
│   └── index.d.ts
│
├── bundle/               → Self-contained builds (all deps inlined)
│   ├── index.umd.js      → UMD format (unminified)
│   ├── index.umd.min.js  → UMD format (minified, production)
│   ├── index.iife.js     → IIFE format (unminified)
│   └── index.iife.min.js → IIFE format (minified, production)
│
└── package.json
```

### Package.json Exports (Revised)

```json
{
  "name": "@hyperfrontend/utils",
  "version": "1.0.0",
  "type": "module",

  "main": "./index.cjs",
  "module": "./index.js",
  "types": "./index.d.ts",

  "exports": {
    ".": {
      "types": "./index.d.ts",
      "import": "./index.js",
      "require": "./index.cjs"
    },
    "./package.json": "./package.json"
  },

  "unpkg": "./bundle/index.umd.min.js",
  "jsdelivr": "./bundle/index.umd.min.js",

  "sideEffects": false
}
```

### For Libraries with Secondary Entry Points

```json
{
  "exports": {
    ".": {
      "types": "./index.d.ts",
      "import": "./index.js",
      "require": "./index.cjs"
    },
    "./browser": {
      "types": "./browser/index.d.ts",
      "import": "./browser/index.js",
      "require": "./browser/index.cjs"
    },
    "./node": {
      "types": "./node/index.d.ts",
      "import": "./node/index.js",
      "require": "./node/index.cjs"
    },
    "./package.json": "./package.json"
  }
}
```

---

## Part 4: Build Strategy

### Layer 1: Standard Library Build (ESM + CJS)

**For**: All libraries
**Output**: `index.js` (ESM) + `index.cjs` (CJS) + `index.d.ts`
**Dependencies**: External (consumers provide)
**Tree-shaking**: ✅ Yes (preserveModules or careful chunking)

### Layer 2: Bundled Browser Build (UMD + IIFE)

**For**: `lib-nexus` and any lib needing CDN deployment
**Output**: `bundle/index.umd.js`, `bundle/index.umd.min.js`, `bundle/index.iife.js`, `bundle/index.iife.min.js`
**Dependencies**: Inlined (self-contained)
**Global variable**: `window.HyperfrontendNexus`, `window.HyperfrontendUtils`, etc.

### Build Matrix

| Library              | ESM+CJS | UMD+IIFE | Global Variable              | Notes               |
| -------------------- | ------- | -------- | ---------------------------- | ------------------- |
| lib-data-utils       | ✅      | Optional | HyperfrontendDataUtils       | Foundation lib      |
| lib-function-utils   | ✅      | Optional | HyperfrontendFunctionUtils   | Foundation lib      |
| lib-string-utils     | ✅      | Optional | HyperfrontendStringUtils     | Platform split      |
| lib-cryptography     | ✅      | Optional | HyperfrontendCryptography    | Core lib            |
| lib-state-machine    | ✅      | Optional | HyperfrontendStateMachine    | Many sub-entries    |
| lib-network-protocol | ✅      | ✅       | HyperfrontendNetworkProtocol | Communication layer |
| lib-nexus            | ✅      | ✅       | HyperfrontendNexus           | Primary CDN target  |
| plugins/features     | ✅      | No       | N/A                          | Dev tooling only    |

---

## Part 5: Implementation Status

### Current State

| Library                    | Entry Pattern | ESM+CJS | UMD+IIFE | Status  |
| -------------------------- | ------------- | ------- | -------- | ------- |
| lib-data-utils             | root          | ✅      | ❌       | Working |
| lib-function-utils         | root          | ✅      | ❌       | Working |
| lib-immutable-api-utils    | root          | ✅      | ❌       | Working |
| lib-random-generator-utils | root          | ✅      | ❌       | Working |
| lib-time-utils             | root          | ✅      | ❌       | Working |
| lib-web-worker             | root          | ✅      | ❌       | Working |
| lib-string-utils           | platform      | ✅      | ❌       | Working |
| lib-list-utils             | root          | ❌      | ❌       | Blocked |
| lib-logging                | root          | ❌      | ❌       | Pending |
| lib-ui-utils               | hybrid        | ❌      | ❌       | Blocked |
| lib-cryptography           | hybrid        | ❌      | ❌       | Pending |
| lib-state-machine          | feature       | ❌      | ❌       | Pending |
| lib-network-protocol       | complex       | ❌      | ❌       | Pending |
| lib-nexus                  | complex       | ❌      | ❌       | Pending |

### Blockers

**TS6059 rootDir Error**: When building libs with internal `@hyperfrontend/*` dependencies, TypeScript follows tsconfig paths to source files outside the project's rootDir.

**Solution**: Mark `@hyperfrontend/*` as external for ESM/CJS builds. For bundled builds, resolve to built `dist/` outputs (requires `dependsOn: ["^build"]`).

---

## Part 6: Custom Build Executor

### Location

```
tools/package/src/executors/build/
├── executor.ts          → Main executor
└── lib/
    ├── types.ts         → Type definitions
    ├── detect.ts        → Entry point discovery
    ├── build-unified.ts → Rollup build orchestration
    ├── package-json.ts  → Exports generation
    ├── paths.ts         → Path resolution utilities
    └── assets.ts        → Asset copying
```

### Current Capabilities

- ✅ Auto-discovers entry points from `src/` structure
- ✅ Generates `exports` field in package.json
- ✅ ESM + CJS dual output
- ✅ TypeScript declarations
- ❌ UMD/IIFE bundled outputs (needs implementation)
- ❌ Minification (needs implementation)
- ❌ Global variable configuration (needs implementation)

### Required Updates

1. **Refactor output structure**: Separate `bundle/` directory for self-contained builds
2. **Add UMD/IIFE build step**: New Rollup configs with all deps inlined
3. **Add minification**: `@rollup/plugin-terser` for `.min.js` outputs
4. **Update package.json generation**: Add `unpkg`, `jsdelivr`, `sideEffects` fields
5. **Configure global names**: Per-library `window.Hyperfrontend*` variables

---

## Part 7: Next Steps

### Phase 1: Fix Package.json Generation (Current Sprint)

1. Update `generatePackageJsonFromDiscovery()` to produce conditional exports
2. Remove `/esm`, `/commonjs`, `/bundled` subpaths
3. Add `type: "module"`, `sideEffects: false`

### Phase 2: Add Bundled Builds

1. Create `buildBundledOutput()` function
2. Configure UMD + IIFE outputs
3. Add minification step
4. Generate `bundle/` directory

### Phase 3: Unblock Remaining Libraries

1. Mark internal deps as external for standard builds
2. Configure dist-resolution for bundled builds
3. Build in dependency order

### Phase 4: CI/CD Integration

1. Add bundle target to workflows
2. Configure artifact uploads
3. Set up CDN publish workflow

---

## Commands Reference

```bash
# Build single library
npx nx build lib-data-utils

# Build all libraries
npx nx run-many -t=build --all

# Skip cache for testing
npx nx build lib-data-utils --skip-nx-cache

# View project dependency graph
npx nx graph
```

---

## Related Documents

- [build-and-deployment-plan.md](./build-and-deployment-plan.md) - Detailed implementation plan
- [MASTER_CONTEXT.md](./MASTER_CONTEXT.md) - Project overview
- [github-workflows-refactoring.md](./github-workflows-refactoring.md) - CI/CD tasks
