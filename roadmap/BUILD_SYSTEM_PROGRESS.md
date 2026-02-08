# Build System Architecture

**Date**: February 8, 2026

---

## Overview

The build system produces multi-format outputs for all library packages using the custom `@hyperfrontend/package:build` executor.

**Core Principle**: Minimize consumer friction. Complexity is absorbed by the build system, not pushed onto consumers.

---

## Output Formats

| Format   | File Extension | Use Case                          | Status     |
| -------- | -------------- | --------------------------------- | ---------- |
| **ESM**  | `.esm.js`      | Modern bundlers, tree-shaking     | ✅ Working |
| **CJS**  | `.cjs.js`      | Node.js apps, legacy bundlers     | ✅ Working |
| **UMD**  | `.umd.js`      | CDN with bundler compatibility    | Planned    |
| **IIFE** | `.iife.js`     | `<script>` tag, zero-config usage | Planned    |

---

## Output Structure

### Current (All Libraries)

```
dist/libs/<package>/
├── index.esm.js      → ESM (primary)
├── index.cjs.js      → CJS (fallback)
├── index.d.ts        → TypeScript declarations
├── <feature>/        → Secondary entry points (if applicable)
│   ├── index.esm.js
│   ├── index.cjs.js
│   └── index.d.ts
└── package.json      → With conditional exports
```

### Planned: CDN-Ready Bundle (nexus, network-protocol)

```
dist/libs/<package>/
├── ...               → Standard ESM/CJS output
└── bundle/           → Self-contained (all deps inlined)
    ├── index.umd.js
    ├── index.umd.min.js
    ├── index.iife.js
    └── index.iife.min.js
```

---

## Package.json Exports

Consumers write `import { x } from '@hyperfrontend/utils'` — bundlers auto-resolve ESM or CJS.

### Current Output

```json
{
  "name": "@hyperfrontend/utils",
  "main": "./index.cjs.js",
  "module": "./index.esm.js",
  "types": "./index.d.ts",
  "sideEffects": false,
  "exports": {
    ".": {
      "types": "./index.d.ts",
      "import": "./index.esm.js",
      "require": "./index.cjs.js"
    },
    "./package.json": "./package.json"
  }
}
```

### CDN-Ready Target (nexus, network-protocol)

```json
{
  "name": "@hyperfrontend/nexus",
  "main": "./index.cjs.js",
  "module": "./index.esm.js",
  "types": "./index.d.ts",
  "sideEffects": false,
  "unpkg": "./bundle/index.umd.min.js",
  "jsdelivr": "./bundle/index.umd.min.js",
  "exports": {
    ".": {
      "types": "./index.d.ts",
      "import": "./index.esm.js",
      "require": "./index.cjs.js"
    },
    "./bundle": {
      "import": "./bundle/index.umd.min.js",
      "require": "./bundle/index.umd.min.js"
    },
    "./package.json": "./package.json"
  }
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

All 14 libraries build successfully with ESM + CJS output.

| Library                    | Entry Pattern | ESM+CJS | UMD+IIFE |
| -------------------------- | ------------- | ------- | -------- |
| lib-data-utils             | hybrid        | ✅      | —        |
| lib-function-utils         | root          | ✅      | —        |
| lib-immutable-api-utils    | root          | ✅      | —        |
| lib-random-generator-utils | root          | ✅      | —        |
| lib-time-utils             | root          | ✅      | —        |
| lib-web-worker             | root          | ✅      | —        |
| lib-string-utils           | platform      | ✅      | —        |
| lib-list-utils             | root          | ✅      | —        |
| lib-logging                | root          | ✅      | —        |
| lib-ui-utils               | hybrid        | ✅      | —        |
| lib-cryptography           | hybrid        | ✅      | —        |
| lib-state-machine          | feature       | ✅      | —        |
| lib-network-protocol       | complex       | ✅      | Planned  |
| lib-nexus                  | complex       | ✅      | Planned  |

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
- ✅ Inherits repository, bugs, homepage, author from root package.json
- ✅ Copies CHANGELOG.md to dist
- ✅ Copies FUNDING.md to dist (if package has funding config)
- ❌ UMD/IIFE bundled outputs
- ❌ Minification
- ❌ Global variable configuration

---

## Publish Executor

**Location**: `tools/package/src/executors/publish/`

Publishes built library packages to npm registry.

### Capabilities

- ✅ Validates project is a library
- ✅ Dry-run mode for preview
- ✅ Custom registry support (Verdaccio, private registries)
- ✅ NPM dist-tag support
- ✅ Scope access control (public/restricted)
- ✅ 2FA OTP support

### Usage

```bash
# Publish a library
npx nx publish lib-nexus

# Dry run (no actual publish)
npx nx publish lib-nexus --dryRun

# Publish to local Verdaccio for testing
npx nx publish lib-nexus --registry=http://localhost:4873
```

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
- [DEPLOYMENT_PUBLISHING.md](./DEPLOYMENT_PUBLISHING.md) - Publishing workflow
- [VERDACCIO_TESTING.md](./VERDACCIO_TESTING.md) - Local npm testing
- [MASTER_CONTEXT.md](./MASTER_CONTEXT.md) - Project overview
