# Build and Deployment Action Plan

**A Comprehensive Strategy for Multi-Format Build Outputs and CI/CD**

_Created: February 5, 2026_
_Revised: February 7, 2026 - First-principles architecture revision_

---

## Executive Summary

This document outlines the action plan for implementing a robust, maintainable build configuration that:

1. Produces **four output formats** (ESM, CJS, UMD, IIFE) for library packages
2. Uses **conditional exports** for automatic format resolution (industry standard)
3. Creates **self-contained bundles** for CDN consumption
4. Supports **tree-shaking** for optimal consumer bundle sizes
5. Minimizes **consumer friction** — complexity absorbed by build system, not pushed to consumers
6. Integrates **build status badges** and proper **CI/CD workflows**

### Key Design Decisions

| Decision                                            | Rationale                                                                                            |
| --------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| **Conditional exports over subpath formats**        | Industry standard (date-fns, zod, rxjs). Consumers write `import from 'pkg'`, bundlers auto-resolve. |
| **ESM as primary, CJS as fallback**                 | Modern bundlers prefer ESM; CJS needed for legacy Node.js compatibility.                             |
| **UMD + IIFE for CDN**                              | Self-contained bundles for `<script>` tag usage. Both minified and unminified.                       |
| **External deps for ESM/CJS, bundled for UMD/IIFE** | Standard approach — let consumer bundlers handle deps for npm; bundle everything for CDN.            |
| **Global names: `Hyperfrontend*`**                  | Consistent, discoverable pattern: `HyperfrontendNexus`, `HyperfrontendUtils`, etc.                   |

---

## Table of Contents

1. [First Principles: JS Module Systems](#first-principles-js-module-systems)
2. [Project Inventory and Classification](#project-inventory-and-classification)
3. [Build Output Requirements](#build-output-requirements)
4. [Package.json Exports Strategy](#packagejson-exports-strategy)
5. [Current State Analysis](#current-state-analysis)
6. [Implementation Strategy](#implementation-strategy)
7. [Build Configurations](#build-configurations)
8. [CI/CD Integration](#cicd-integration)
9. [Badge Integration](#badge-integration)
10. [Implementation Phases](#implementation-phases)
11. [Maintenance Considerations](#maintenance-considerations)

---

## First Principles: JS Module Systems

### The Four Module Formats

| Format   | Syntax                            | Environment                            | When to Use                          |
| -------- | --------------------------------- | -------------------------------------- | ------------------------------------ |
| **ESM**  | `import/export`                   | Modern Node.js, all modern bundlers    | Primary format for npm distribution  |
| **CJS**  | `require/module.exports`          | Node.js (all versions), older bundlers | Fallback for legacy environments     |
| **UMD**  | Auto-detect (CJS, AMD, or global) | Universal                              | CDN distribution with bundler compat |
| **IIFE** | Self-invoking function + global   | Browser only                           | `<script>` tags, zero build step     |

### Industry Patterns (What Popular Libraries Do)

**date-fns** — Flat structure with conditional exports:

```json
{
  "exports": {
    ".": {
      "import": { "types": "./index.d.ts", "default": "./index.js" },
      "require": { "types": "./index.d.cts", "default": "./index.cjs" }
    }
  }
}
```

**zod** — Same pattern with TypeScript source reference:

```json
{
  "exports": {
    ".": {
      "types": "./index.d.cts",
      "import": "./index.js",
      "require": "./index.cjs"
    }
  }
}
```

**rxjs** — Multi-format with ES version targets:

```json
{
  "exports": {
    ".": {
      "types": "./dist/types/index.d.ts",
      "node": "./dist/cjs/index.js",
      "require": "./dist/cjs/index.js",
      "es2015": "./dist/esm/index.js",
      "default": "./dist/esm5/index.js"
    }
  }
}
```

**axios** — Platform-specific with CDN support:

```json
{
  "exports": { ".": { "browser": {...}, "default": {...} } },
  "unpkg": "dist/axios.min.js",
  "jsdelivr": "dist/axios.min.js"
}
```

### Key Insight

**NO popular library uses subpath-based format selection** like `/esm` or `/cjs`. Conditional exports handle this transparently. Consumers just write:

```javascript
import { something } from 'package-name'
```

The bundler/runtime automatically picks ESM or CJS based on context.

---

## Project Inventory and Classification

### Project Categories

| Category            | Projects                                                                                                                                                                | Build Strategy                      |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| **Foundation**      | `lib-data-utils`, `lib-function-utils`, `lib-immutable-api-utils`, `lib-list-utils`, `lib-string-utils`, `lib-time-utils`, `lib-random-generator-utils`, `lib-ui-utils` | ESM + CJS (conditional exports)     |
| **Core**            | `lib-cryptography`, `lib-logging`, `lib-state-machine`, `lib-web-worker`, `lib-network-protocol`                                                                        | ESM + CJS (conditional exports)     |
| **Communication**   | `lib-nexus`                                                                                                                                                             | ESM + CJS + UMD + IIFE (full suite) |
| **Plugins**         | `plugin-features`                                                                                                                                                       | ESM + CJS (for Nx executor compat)  |
| **Plugin E2E**      | `plugin-features-e2e`                                                                                                                                                   | Dev-only (no publish)               |
| **Apps (Frontend)** | `app-angular`, `app-react`, `app-vue`, `app-svelte`, `app-javascript`                                                                                                   | Excluded (future)                   |
| **Apps (Backend)**  | `app-express`, `app-http`, `app-nest`                                                                                                                                   | Excluded (future)                   |
| **Demos**           | `demo-chess`, `demo-clock`, `demo-events`, `demo-file-share`, `demo-heartbeat`, `demo-views`                                                                            | Excluded (future)                   |
| **Documentation**   | `docs`                                                                                                                                                                  | Hugo build (separate)               |

### Consumer Profiles

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                         CONSUMER PROFILE MATRIX                                  │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  MODERN FRAMEWORKS (React, Vue, Angular, Svelte)                                │
│  ├── Source: npm (or private Artifactory)                                       │
│  ├── Format: ESM (primary), CJS (fallback)                                      │
│  ├── Features: Tree-shaking, code-splitting, dead-code elimination             │
│  └── Build Step: Yes (Webpack, Vite, Rollup, esbuild)                          │
│                                                                                  │
│  LEGACY / VANILLA JS                                                            │
│  ├── Source: CDN (jsdelivr, unpkg, or internal host)                           │
│  ├── Format: UMD/IIFE (self-contained bundle)                                  │
│  ├── Features: Global variable exposure, zero-config                           │
│  └── Build Step: No (direct `<script>` tag)                                    │
│                                                                                  │
│  BACKEND CONSUMERS (Node.js)                                                    │
│  ├── Source: npm (or private registry)                                         │
│  ├── Format: CJS (primary), ESM (if needed)                                    │
│  ├── Features: Feature registry, backchannel communication                     │
│  └── Use Case: Server-side coordination, not window-to-window                  │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## Build Output Requirements

### Standard Library Build (All `lib-*` except nexus)

**Output structure:**

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

**Dependencies**: External (consumers provide them)
**Tree-shaking**: ✅ Enabled

### Nexus Library Build (CDN-Ready)

**Output structure:**

```
dist/libs/nexus/
├── index.js              → ESM (external deps)
├── index.cjs             → CJS (external deps)
├── index.d.ts            → TypeScript declarations
├── bundle/               → Self-contained (all deps inlined)
│   ├── nexus.umd.js      → UMD unminified
│   ├── nexus.umd.min.js  → UMD minified (production)
│   ├── nexus.iife.js     → IIFE unminified
│   └── nexus.iife.min.js → IIFE minified (production)
└── package.json
```

**Special requirements:**

- Self-contained: All `@hyperfrontend/*` dependencies bundled
- Global variable: `window.HyperfrontendNexus`
- No external runtime dependencies for bundle/ outputs

### Feature Plugin Build

**Output structure:**

```
dist/plugins/features/
├── index.js          → ESM
├── index.cjs         → CJS (required for Nx executors)
├── index.d.ts
├── generators.json
├── executors.json
└── package.json
```

---

## Package.json Exports Strategy

### Standard Library (Recommended Pattern)

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

  "sideEffects": false
}
```

**Consumer usage:**

```typescript
// ESM (auto-resolved)
import { something } from '@hyperfrontend/utils'

// CJS (auto-resolved)
const { something } = require('@hyperfrontend/utils')
```

### Library with Secondary Entry Points

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

**Consumer usage:**

```typescript
import { browserThing } from '@hyperfrontend/string-utils/browser'
import { nodeThing } from '@hyperfrontend/string-utils/node'
```

### CDN-Ready Library (nexus)

```json
{
  "name": "@hyperfrontend/nexus",
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

  "unpkg": "./bundle/nexus.umd.min.js",
  "jsdelivr": "./bundle/nexus.umd.min.js",

  "sideEffects": false
}
```

**Consumer usage:**

```html
<!-- CDN (UMD) -->
<script src="https://unpkg.com/@hyperfrontend/nexus"></script>
<script>
  const broker = HyperfrontendNexus.createBroker()
</script>

<!-- CDN (IIFE) -->
<script src="https://cdn.example.com/nexus.iife.min.js"></script>
<script>
  const broker = HyperfrontendNexus.createBroker()
</script>
```

---

## Current State Analysis

### What's Already Working

The current custom executor at `@hyperfrontend/package:build` successfully:

- Auto-discovers entry points from `src/` structure
- Generates ESM + CJS dual outputs
- Produces TypeScript declarations
- Handles multiple entry point patterns (root, platform, feature, hybrid)

### What Needs to Change

| Current State          | Required Change                                 | Rationale                                                        |
| ---------------------- | ----------------------------------------------- | ---------------------------------------------------------------- |
| Output: `index.esm.js` | Change to: `index.js`                           | Industry convention: ESM files use `.js` with `"type": "module"` |
| Output: `index.cjs.js` | Change to: `index.cjs`                          | Cleaner naming, matches date-fns/zod pattern                     |
| No bundled outputs     | Add: `bundle/` directory                        | CDN distribution requires self-contained builds                  |
| No minification        | Add: terser plugin                              | Production bundles should be minified                            |
| Basic exports          | Add: conditional exports                        | Enable auto-resolution by bundlers                               |
| Missing fields         | Add: `type`, `sideEffects`, `unpkg`, `jsdelivr` | Required for proper package metadata                             |

### Known Issue: TS6059 rootDir Error

**Symptom**: When building libs with `@hyperfrontend/*` dependencies, TypeScript follows tsconfig paths to source files outside the project's rootDir.

**Root Cause**: tsconfig paths point to source (e.g., `libs/utils/data/src/index.ts`) not dist.

**Solution (ESM/CJS builds)**: Mark all `@hyperfrontend/*` as external. Consumers provide them.

**Solution (Bundled builds)**:

1. Ensure deps are built first (`dependsOn: ["^build"]`)
2. Use alias plugin to resolve `@hyperfrontend/*` to `dist/` outputs

---

## Implementation Strategy

### Custom Nx Executor

The `@hyperfrontend/package:build` executor at `tools/package/` is the centralized build system for all library packages. This executor:

- Provides consistent build logic across all libraries
- Auto-discovers entry points from `src/` structure and adapts to different library patterns
- Serves as the single location for implementing build features (ESM, CJS, UMD, IIFE, minification)
- Generates proper `package.json` exports for each library

All build enhancements (bundled outputs, minification, global variable configuration) are implemented within this executor.

### Build Layers

```
Layer 1: Standard Build (all libs)
├── ESM output (index.js)
├── CJS output (index.cjs)
├── TypeScript declarations (index.d.ts)
└── Dependencies: EXTERNAL

Layer 2: Bundled Build (nexus + CDN-targeted libs)
├── UMD unminified (bundle/lib.umd.js)
├── UMD minified (bundle/lib.umd.min.js)
├── IIFE unminified (bundle/lib.iife.js)
├── IIFE minified (bundle/lib.iife.min.js)
└── Dependencies: INLINED
```

---

## Build Configurations

### Custom Executor Updates Required

**File**: `tools/package/src/executors/build/lib/build-unified.ts`

Update `createOutputConfigs()` to generate:

- `index.js` (ESM) instead of `index.esm.js`
- `index.cjs` (CJS) instead of `index.cjs.js`

Add new function `createBundledConfigs()` for UMD/IIFE:

```typescript
export function createBundledConfigs(outputPath: string, globalName: string): OutputOptions[] {
  const bundlePath = join(outputPath, 'bundle')
  return [
    { file: join(bundlePath, 'index.umd.js'), format: 'umd', name: globalName },
    { file: join(bundlePath, 'index.umd.min.js'), format: 'umd', name: globalName, plugins: [terser()] },
    { file: join(bundlePath, 'index.iife.js'), format: 'iife', name: globalName },
    { file: join(bundlePath, 'index.iife.min.js'), format: 'iife', name: globalName, plugins: [terser()] },
  ]
}
```

**File**: `tools/package/src/executors/build/lib/package-json.ts`

Update `generatePackageJsonFromDiscovery()` to produce:

```typescript
const distPkg = {
  ...srcPkg,
  type: 'module',
  main: './index.cjs',
  module: './index.js',
  types: './index.d.ts',
  exports: {
    '.': {
      types: './index.d.ts',
      import: './index.js',
      require: './index.cjs',
    },
    './package.json': './package.json',
    // ... secondary entry points
  },
  sideEffects: false,
  // Add if bundled outputs exist:
  unpkg: './bundle/index.umd.min.js',
  jsdelivr: './bundle/index.umd.min.js',
}
```

### Global Variable Naming

| Library              | Global Variable                 |
| -------------------- | ------------------------------- |
| lib-nexus            | `HyperfrontendNexus`            |
| lib-network-protocol | `HyperfrontendNetworkProtocol`  |
| lib-cryptography     | `HyperfrontendCryptography`     |
| lib-data-utils       | `HyperfrontendDataUtils`        |
| ...                  | `Hyperfrontend<PascalCaseName>` |

**Convention**: `Hyperfrontend` + PascalCase library name (without `lib-` prefix)

---

## CI/CD Integration

### Current Workflow Structure

```
┌──────────────────────────────────────────────────────────────────┐
│                    EXISTING CI/CD STRUCTURE                       │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│  PR Workflow (ci-pr.yml)                                         │
│  ├── setup: Calculate affected projects                          │
│  ├── format: Check formatting (affected)                         │
│  ├── lint: Run linting (affected)                                │
│  ├── build: Build projects (affected) ←── uses `--projects=`     │
│  ├── test: Run tests (affected)                                  │
│  ├── e2e: Run E2E tests (affected)                               │
│  └── status: Report CI status                                    │
│                                                                   │
│  Main Workflow (ci-main.yml)                                     │
│  ├── setup: Initialize environment                               │
│  ├── format: Check formatting (all) ←── uses `--all`             │
│  ├── lint: Run linting (all)                                     │
│  ├── build: Build projects (all)                                 │
│  ├── test: Run tests (all) + upload coverage                     │
│  └── (coverage upload steps for each lib)                        │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
```

### Build Strategy by Trigger

| Trigger          | Build Scope            | Command                                    |
| ---------------- | ---------------------- | ------------------------------------------ |
| Pull Request     | Affected projects only | `nx run-many -t=build --projects=affected` |
| Merge to main    | All projects           | `nx run-many -t=build --all`               |
| Manual / Release | All + CDN bundles      | `nx run-many -t=build,bundle --all`        |

### Proposed Workflow Updates

#### 1. Add Bundle Target (New CI Step)

For projects requiring UMD bundles, add a `bundle` target:

```yaml
# ci-main.yml additions
jobs:
  build:
    steps:
      # ... existing build step ...

      - name: Build CDN bundles
        run: |
          echo "Building self-contained bundles for CDN..."
          npx nx run lib-nexus:bundle --parallel=1
```

#### 2. Build Artifacts Upload

```yaml
build:
  steps:
    # ... after build ...

    - name: Upload build artifacts
      uses: actions/upload-artifact@v4
      with:
        name: dist-packages
        path: dist/libs/
        retention-days: 30
```

#### 3. Publish Workflow (Future)

A dedicated publish workflow for npm and CDN:

```yaml
# .github/workflows/publish.yml
name: publish

on:
  release:
    types: [published]

jobs:
  publish-npm:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: ./.github/actions/setup-monorepo

      - name: Build all packages
        run: npx nx run-many -t=build --all

      - name: Publish to npm
        run: |
          npx nx run-many -t=publish --all
        env:
          NPM_TOKEN: ${{ secrets.NPM_TOKEN }}

  upload-cdn:
    runs-on: ubuntu-latest
    needs: publish-npm
    steps:
      - name: Upload CDN bundles
        run: |
          # Upload nexus.umd.min.js to CDN
          # Upload shell bundles to CDN
```

---

## Badge Integration

### Recommended Badges

Add the following badges to `README.md`:

```markdown
<p align="center">
  <!-- Build Status -->
  <a href="https://github.com/AndrewRedican/hyperfrontend/actions/workflows/ci-main.yml">
    <img src="https://img.shields.io/github/actions/workflow/status/AndrewRedican/hyperfrontend/ci-main.yml?style=flat-square&logo=github&label=build" alt="Build Status">
  </a>
  <!-- Existing badges... -->
  <a href="https://codecov.io/gh/AndrewRedican/hyperfrontend">
    <img src="https://img.shields.io/codecov/c/github/AndrewRedican/hyperfrontend?style=flat-square&logo=codecov" alt="Coverage">
  </a>
  <!-- ... -->
</p>
```

### Badge Placement

The build badge should appear first in the badge row, as it indicates overall project health.

### Badge URL Pattern

```
https://img.shields.io/github/actions/workflow/status/{owner}/{repo}/{workflow-file}?branch={branch}&style={style}&logo={logo}&label={label}

Example:
https://img.shields.io/github/actions/workflow/status/AndrewRedican/hyperfrontend/ci-main.yml?branch=main&style=flat-square&logo=github&label=build
```

---

## Implementation Phases

### Phase 1: Foundation (Immediate)

**Goal**: Establish build infrastructure without breaking existing functionality

| Task                                    | Priority | Effort | Notes                                                                 |
| --------------------------------------- | -------- | ------ | --------------------------------------------------------------------- |
| 1.1 Add build badge to README.md        | High     | Low    | Simple markdown addition                                              |
| 1.2 Install Rollup plugins              | High     | Low    | `@rollup/plugin-terser`, `@rollup/plugin-node-resolve` if not present |
| 1.3 Create nexus `rollup.config.js`     | High     | Medium | Multi-output config                                                   |
| 1.4 Update nexus `project.json`         | High     | Low    | Reference custom config                                               |
| 1.5 Test dual + UMD build locally       | High     | Medium | Verify all outputs                                                    |
| 1.6 Update nexus `package.json` exports | Medium   | Low    | Add UMD entry points                                                  |

### Phase 2: CI/CD Enhancement

**Goal**: Ensure build artifacts are properly created and validated

| Task                            | Priority | Effort | Notes                            |
| ------------------------------- | -------- | ------ | -------------------------------- |
| 2.1 Add bundle target to nexus  | High     | Low    | Separate UMD build step          |
| 2.2 Update ci-main.yml          | High     | Medium | Add artifact upload              |
| 2.3 Verify affected builds work | High     | Medium | Test with PR workflow            |
| 2.4 Add build output validation | Medium   | Medium | Size checks, export verification |

### Phase 3: Plugin Build Configuration

**Goal**: Configure feature plugin for proper distribution

| Task                                    | Priority | Effort | Notes                  |
| --------------------------------------- | -------- | ------ | ---------------------- |
| 3.1 Update plugin-features build config | Medium   | Low    | CJS output             |
| 3.2 Add shell template rollup config    | Medium   | High   | Generator modification |
| 3.3 Test generated shell builds         | Medium   | High   | End-to-end validation  |

### Phase 4: Publication Pipeline (Future)

**Goal**: Automate npm and CDN publishing

| Task                        | Priority | Effort | Notes               |
| --------------------------- | -------- | ------ | ------------------- |
| 4.1 Create publish workflow | Low      | High   | npm with provenance |
| 4.2 CDN upload automation   | Low      | High   | jsdelivr or custom  |
| 4.3 Version management      | Low      | Medium | semver integration  |

---

## Maintenance Considerations

### Configuration Hierarchy

```
nx.json (workspace defaults)
    ↓
project.json (project overrides)
    ↓
rollup.config.js (custom builds)
```

**Principle**: Only add project-level configs when deviating from defaults.

### Project Tags for Build Classification

Consider adding tags to classify projects:

```json
// libs/nexus/project.json
{
  "tags": ["type:lib", "build:dual", "build:cdn"]
}

// libs/data-utils/project.json
{
  "tags": ["type:lib", "build:dual"]
}

// apps/demos/clock/project.json
{
  "tags": ["type:demo", "build:excluded"]
}
```

This enables selective builds:

```bash
# Build only CDN-enabled projects
npx nx run-many -t=bundle --projects=tag:build:cdn
```

### Dependency Graph Awareness

The build order is automatically managed by Nx based on the `@hyperfrontend/*` dependencies:

```
Foundation Utils (no deps) → Core Libs → Nexus → Feature Plugin
```

Ensure `nx.json` has proper `dependsOn` configuration for build targets.

### Documentation Updates

When implementing:

1. Update each library's README with build output documentation
2. Add CDN usage examples to nexus README
3. Document shell generation build outputs in features plugin

### Validation Checklist

Before merging build configuration changes:

- [ ] `nx run-many -t=build --all` succeeds
- [ ] All expected output formats exist in `dist/`
- [ ] ESM imports work: `import { createBroker } from '@hyperfrontend/nexus'`
- [ ] CJS requires work: `const { createBroker } = require('@hyperfrontend/nexus')`
- [ ] UMD loads in browser: `<script src="nexus.umd.min.js">` exposes global
- [ ] Bundle sizes are reasonable (track over time)
- [ ] No runtime errors in browser or Node.js

---

## Dependencies Required

### Dev Dependencies to Add

```bash
npm install -D @rollup/plugin-terser @rollup/plugin-node-resolve @rollup/plugin-commonjs
```

**Note**: Check if these are already transitively available via `@nx/rollup`.

### Existing Dependencies (Already Present)

- `rollup: 4.55.2`
- `@nx/rollup: 22.3.3`
- `typescript: 5.9.3`

---

## Quick Reference

### Build Commands

```bash
# Build all libraries (dual output)
npx nx run-many -t=build --all

# Build specific library
npx nx build lib-nexus

# Build only affected (for PRs)
npx nx affected -t=build

# Build with verbose output
npx nx build lib-nexus --verbose
```

### Output Locations (Revised)

| Project          | ESM                              | CJS                               | UMD (if applicable)           |
| ---------------- | -------------------------------- | --------------------------------- | ----------------------------- |
| lib-nexus        | `dist/libs/nexus/index.js`       | `dist/libs/nexus/index.cjs`       | `dist/libs/nexus/bundle/*.js` |
| lib-cryptography | `dist/libs/cryptography/*.js`    | `dist/libs/cryptography/*.cjs`    | N/A                           |
| plugin-features  | `dist/plugins/features/index.js` | `dist/plugins/features/index.cjs` | N/A                           |

---

## Related Documents

- [MASTER_CONTEXT.md](./MASTER_CONTEXT.md) — Project overview and architecture
- [github-workflows-refactoring.md](./github-workflows-refactoring.md) — CI/CD tasks
- [libs/network-protocol/ARCHITECTURE.md](../libs/network-protocol/ARCHITECTURE.md) — Security layer details
- [\_/legacy-shell-application-pattern/connector/](../_/legacy-shell-application-pattern/connector/) — Legacy build reference

---

## Appendix: Alternative Approaches Considered

### Browserify + UglifyJS (Legacy)

The original connector used Browserify for bundling and UglifyJS for minification. This was replaced because:

- Browserify is less maintained than Rollup
- Rollup produces smaller bundles with better tree-shaking
- Nx has first-class Rollup support
- Single tool (Rollup + plugins) replaces two tools

### esbuild

Considered for bundling due to speed, but:

- Less control over output formats
- Rollup already in use, no need to add another bundler
- Nx plugin ecosystem favors Rollup

### Webpack

Overkill for library bundling. Better suited for application builds, which are currently excluded.

---

_This document should be updated as implementation progresses. Track completion in the Implementation Phases section._
