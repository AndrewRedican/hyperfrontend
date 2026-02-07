# Build System Architecture

**Date**: February 7, 2026
**Branch**: `build-and-badges`

---

## Overview

The build system produces multi-format outputs for all library packages using the custom `@hyperfrontend/package:build` executor. The design follows industry standards from date-fns, zod, rxjs, and axios.

**Core Principle**: Minimize consumer friction. Complexity is absorbed by the build system, not pushed onto consumers.

---

## Output Formats

| Format   | File Extension | Use Case                          |
| -------- | -------------- | --------------------------------- |
| **ESM**  | `.js`          | Modern bundlers, tree-shaking     |
| **CJS**  | `.cjs`         | Node.js apps, legacy bundlers     |
| **UMD**  | `.umd.js`      | CDN with bundler compatibility    |
| **IIFE** | `.iife.js`     | `<script>` tag, zero-config usage |

---

## Output Structure

### Standard Library

```
dist/libs/<package>/
├── index.js          → ESM (primary)
├── index.cjs         → CJS (fallback)
├── index.d.ts        → TypeScript declarations
├── <feature>/        → Secondary entry points (if applicable)
│   ├── index.js
│   ├── index.cjs
│   └── index.d.ts
└── package.json      → With conditional exports
```

### CDN-Ready Library (nexus, network-protocol)

```
dist/libs/<package>/
├── index.js              → ESM (external deps)
├── index.cjs             → CJS (external deps)
├── index.d.ts            → TypeScript declarations
├── bundle/               → Self-contained (all deps inlined)
│   ├── index.umd.js      → UMD unminified
│   ├── index.umd.min.js  → UMD minified
│   ├── index.iife.js     → IIFE unminified
│   └── index.iife.min.js → IIFE minified
└── package.json
```

---

## Package.json Exports

Consumers write `import { x } from '@hyperfrontend/utils'` — bundlers auto-resolve ESM or CJS.

```json
{
  "name": "@hyperfrontend/utils",
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

---

## Build Matrix

| Library              | ESM+CJS | UMD+IIFE | Global Variable              |
| -------------------- | ------- | -------- | ---------------------------- |
| lib-data-utils       | ✅      | Optional | HyperfrontendDataUtils       |
| lib-function-utils   | ✅      | Optional | HyperfrontendFunctionUtils   |
| lib-string-utils     | ✅      | Optional | HyperfrontendStringUtils     |
| lib-cryptography     | ✅      | Optional | HyperfrontendCryptography    |
| lib-state-machine    | ✅      | Optional | HyperfrontendStateMachine    |
| lib-network-protocol | ✅      | ✅       | HyperfrontendNetworkProtocol |
| lib-nexus            | ✅      | ✅       | HyperfrontendNexus           |
| plugins/features     | ✅      | No       | N/A                          |

**Global Naming Convention**: `Hyperfrontend` + PascalCase library name (without `lib-` prefix)

---

## Implementation Status

| Library                    | Entry Pattern | ESM+CJS | UMD+IIFE | Status  |
| -------------------------- | ------------- | ------- | -------- | ------- |
| lib-data-utils             | root          | ✅      | ❌       | Working |
| lib-function-utils         | root          | ✅      | ❌       | Working |
| lib-immutable-api-utils    | root          | ✅      | ❌       | Working |
| lib-random-generator-utils | root          | ✅      | ❌       | Working |
| lib-time-utils             | root          | ✅      | ❌       | Working |
| lib-web-worker             | root          | ✅      | ❌       | Working |
| lib-string-utils           | platform      | ✅      | ❌       | Working |
| lib-list-utils             | root          | ✅      | ❌       | Working |
| lib-logging                | root          | ❌      | ❌       | Pending |
| lib-ui-utils               | hybrid        | ❌      | ❌       | Pending |
| lib-cryptography           | hybrid        | ❌      | ❌       | Pending |
| lib-state-machine          | feature       | ❌      | ❌       | Pending |
| lib-network-protocol       | complex       | ❌      | ❌       | Pending |
| lib-nexus                  | complex       | ❌      | ❌       | Pending |

### TS6059 rootDir Error (Resolved)

Libraries with internal `@hyperfrontend/*` dependencies previously failed because TypeScript followed tsconfig paths to source files outside the project's rootDir.

**Fix Applied**: The executor now:

1. Auto-detects `@hyperfrontend/*` dependencies from package.json
2. Marks them as external in Rollup config
3. Clears TypeScript `paths` to prevent source resolution

---

## Custom Build Executor

**Location**: `tools/package/src/executors/build/`

```
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
- ❌ UMD/IIFE bundled outputs
- ❌ Minification
- ❌ Global variable configuration

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

- [BUILD_SYSTEM_TODO.md](./BUILD_SYSTEM_TODO.md) - Implementation tasks
- [MASTER_CONTEXT.md](./MASTER_CONTEXT.md) - Project overview
