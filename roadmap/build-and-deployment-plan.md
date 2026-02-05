# Build and Deployment Action Plan

**A Comprehensive Strategy for Multi-Format Build Outputs and CI/CD**

_Created: February 5, 2026_

---

## Executive Summary

This document outlines the action plan for implementing a robust, maintainable build configuration that:

1. Produces **dual output formats** (ESM + CommonJS) for all library packages
2. Creates **self-contained bundles** for CDN consumption (nexus + generated shells)
3. Integrates **build status badges** into the repository
4. Establishes proper **CI/CD workflows** for affected builds (PRs) and full builds (main)
5. Maintains **clear separation** between libs, plugins, apps, and demos

---

## Table of Contents

1. [Project Inventory and Classification](#project-inventory-and-classification)
2. [Build Output Requirements](#build-output-requirements)
3. [Current State Analysis](#current-state-analysis)
4. [Implementation Strategy](#implementation-strategy)
5. [Build Configurations](#build-configurations)
6. [CI/CD Integration](#cicd-integration)
7. [Badge Integration](#badge-integration)
8. [Implementation Phases](#implementation-phases)
9. [Maintenance Considerations](#maintenance-considerations)

---

## Project Inventory and Classification

### Project Categories

| Category            | Projects                                                                                                                                                                | Build Strategy                        |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| **Foundation**      | `lib-data-utils`, `lib-function-utils`, `lib-immutable-api-utils`, `lib-list-utils`, `lib-string-utils`, `lib-time-utils`, `lib-random-generator-utils`, `lib-ui-utils` | Dual (ESM + CJS)                      |
| **Core**            | `lib-cryptography`, `lib-logging`, `lib-state-machine`, `lib-web-worker`, `lib-network-protocol`                                                                        | Dual (ESM + CJS)                      |
| **Communication**   | `lib-nexus`                                                                                                                                                             | Dual + Self-contained                 |
| **Plugins**         | `plugin-features`                                                                                                                                                       | CJS (or Dual) + Self-contained shells |
| **Plugin E2E**      | `plugin-features-e2e`                                                                                                                                                   | Dev-only (no publish)                 |
| **Apps (Frontend)** | `app-angular`, `app-react`, `app-vue`, `app-svelte`, `app-javascript`                                                                                                   | Excluded (future)                     |
| **Apps (Backend)**  | `app-express`, `app-http`, `app-nest`                                                                                                                                   | Excluded (future)                     |
| **Demos**           | `demo-chess`, `demo-clock`, `demo-events`, `demo-file-share`, `demo-heartbeat`, `demo-views`                                                                            | Excluded (future)                     |
| **Documentation**   | `docs`                                                                                                                                                                  | Hugo build (separate)                 |

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

| Output         | Format   | Purpose                 | Target Consumers                  |
| -------------- | -------- | ----------------------- | --------------------------------- |
| `index.cjs`    | CommonJS | Node.js, older bundlers | Backend, legacy build systems     |
| `index.esm.js` | ESM      | Modern bundlers         | React, Vue, Angular, Svelte, Vite |

**Config approach**: Continue using current `nx.json` targetDefaults with `format: ["cjs", "esm"]`

### Nexus Library Build (Special Case)

| Output             | Format         | Purpose                 | Target Consumers              |
| ------------------ | -------------- | ----------------------- | ----------------------------- |
| `index.cjs`        | CommonJS       | Node.js, older bundlers | Backend, legacy build systems |
| `index.esm.js`     | ESM            | Modern bundlers         | React, Vue, Angular, Svelte   |
| `nexus.umd.js`     | UMD (bundled)  | CDN, vanilla JS         | Legacy apps, `<script>` tag   |
| `nexus.umd.min.js` | UMD (minified) | Production CDN          | Legacy apps (production)      |

**Special requirements**:

- Self-contained: All `@hyperfrontend/*` dependencies bundled
- Global variable: `window.HyperfrontendNexus` or configurable
- No external runtime dependencies

### Feature Plugin Build

| Output         | Format         | Purpose                 | Target Consumers |
| -------------- | -------------- | ----------------------- | ---------------- |
| `index.cjs`    | CommonJS       | Nx executors/generators | Dev tooling      |
| `index.esm.js` | ESM (optional) | Future compatibility    | Modern tooling   |

**Shell generation output** (per generated shell):
| Output | Format | Purpose | Target Consumers |
| ------------------- | ---------------- | ------------------------------------ | ----------------------------------- |
| `shell.cjs` | CommonJS | Node.js, older bundlers | Backend integration |
| `shell.esm.js` | ESM | Modern bundlers | React, Vue, Angular hosts |
| `shell.umd.js` | UMD (bundled) | CDN, vanilla JS | Legacy hosts, `<script>` tag |
| `shell.umd.min.js` | UMD (minified) | Production CDN | Legacy hosts (production) |

---

## Current State Analysis

### What's Already Working

**`nx.json` configuration** (current):

```json
{
  "targetDefaults": {
    "build": {
      "executor": "@nx/rollup:rollup",
      "options": {
        "format": ["cjs", "esm"],
        "external": "none",
        "generateExportsField": true
      }
    }
  },
  "plugins": [
    {
      "plugin": "@nx/rollup/plugin",
      "include": ["libs/**/*", "plugins/**/*"],
      "exclude": ["plugins/*-e2e/**/*"]
    }
  ]
}
```

**Strengths**:

- Dual output (ESM + CJS) already configured
- Rollup is the correct bundler for this use case
- Properly excludes e2e projects
- Caching enabled

**Gaps**:

- No UMD/IIFE output configuration
- No minification step
- No distinction between "bundled" vs "external" deps per project
- Apps and demos not explicitly excluded (but empty, so no issue yet)

### Known Issues & Workarounds

#### Issue: `@types/node` v25 Compatibility with `@rollup/plugin-typescript`

**Symptom**: Build fails with syntax errors in `node_modules/@types/node/web-globals/fetch.d.ts`:

```
TS1005: ',' expected.
TS1160: Unterminated template literal.
```

**Root Cause**: `@types/node` v25 uses TypeScript syntax that `@rollup/plugin-typescript` cannot parse during bundling, even when `skipLibCheck: true` is set in tsconfig.

**Workaround**: Add `skipTypeCheck: true` to each library's `project.json` build options:

```json
{
  "targets": {
    "build": {
      "options": {
        "skipTypeCheck": true
      }
    }
  }
}
```

**Note**: This skips type checking during the Rollup build phase. Type safety is still enforced via:

- IDE type checking (using tsconfig)
- The `lint` target (which runs before build in CI)
- The `test` target (TypeScript compilation for tests)

#### Type Casting Convention

When fixing type errors in source code, use angle bracket syntax for type assertions:

```typescript
// Preferred
<UnknownIterable>read(targetA, key)

// Not preferred
read(targetA, key) as UnknownIterable
```

#### Libraries with Secondary Entry Points

Some libraries (e.g., `lib-string-utils`) expose multiple entry points (`./browser`, `./node`) instead of a single main export. These require a custom Rollup configuration.

**Approach**: Use `@rollup/plugin-babel` with `@babel/preset-typescript` instead of `@rollup/plugin-typescript`. Babel strips types without validating them, completely avoiding the `@types/node` compatibility issues.

**Example** (`libs/utils/string/rollup.config.js`):

```javascript
const { resolve } = require('path')
const { babel } = require('@rollup/plugin-babel')
const nodeResolve = require('@rollup/plugin-node-resolve')

const projectRoot = __dirname
const outputPath = resolve(projectRoot, '../../../dist/libs/utils/string')

const createConfig = (input, outputFile, format) => ({
  input: resolve(projectRoot, input),
  output: {
    file: resolve(outputPath, outputFile),
    format,
    sourcemap: true,
  },
  plugins: [
    nodeResolve({ extensions: ['.ts', '.js'] }),
    babel({
      babelHelpers: 'bundled',
      extensions: ['.ts', '.js'],
      presets: ['@babel/preset-typescript'],
    }),
  ],
})

module.exports = [
  createConfig('src/browser/index.ts', 'browser/index.esm.js', 'esm'),
  createConfig('src/browser/index.ts', 'browser/index.cjs.js', 'cjs'),
  createConfig('src/node/index.ts', 'node/index.esm.js', 'esm'),
  createConfig('src/node/index.ts', 'node/index.cjs.js', 'cjs'),
]
```

**Project.json configuration**:

```json
{
  "targets": {
    "build": {
      "options": {
        "skipTypeCheck": true,
        "rollupConfig": "{projectRoot}/rollup.config.js"
      }
    }
  }
}
```

**Note**: When a custom `rollup.config.js` is detected, Nx switches from `@nx/rollup:rollup` executor to direct `rollup -c` invocation. This is expected behavior.

### Legacy Build Reference

From `_/legacy-shell-application-pattern/connector/scripts/browser.build.js`:

```javascript
// Legacy approach used:
// 1. TypeScript compilation (library output)
// 2. Browserify (bundle for browser with UMD/standalone)
// 3. UglifyJS (minification)

browserify({ standalone: globalVarName, insertGlobals: true }).add(distPath).bundle()

uglifyJs.minify(input).code
```

**Modern equivalent**: Rollup with `output.format: 'umd'` and `@rollup/plugin-terser`

---

## Implementation Strategy

### Approach Options

#### Option A: Project-Level Rollup Configs (Recommended)

Create `rollup.config.js` in projects that need custom builds (nexus, shell templates).

**Pros**:

- Full control per project
- Nx compatible with `@nx/rollup:rollup` executor
- Standard Rollup configuration

**Cons**:

- Some configuration duplication
- Must maintain per-project configs

#### Option B: Custom Nx Executor

Create a custom executor for "bundle + minify" builds.

**Pros**:

- Centralized configuration
- Consistent behavior

**Cons**:

- Higher maintenance burden
- More complex to debug
- Overkill for 2-3 projects

#### Option C: Nx Generator for Build Configs

Use `@hyperfrontend/features` plugin to generate appropriate build configs.

**Pros**:

- Automated configuration
- Ensures consistency for generated shells

**Cons**:

- Adds complexity to plugin
- The plugin itself needs to build first

### Recommended Strategy: Hybrid (A + C)

1. **Standard libs**: Use existing `nx.json` targetDefaults (no change)
2. **Nexus**: Add project-level `rollup.config.js` with multiple outputs
3. **Feature plugin**: Add project-level config or use targetDefaults
4. **Generated shells**: Plugin generates appropriate `rollup.config.js` during scaffolding

---

## Build Configurations

### Standard Library (No Changes Needed)

Current `nx.json` already handles this via `targetDefaults.build`.

### Nexus Library Configuration

**File**: `libs/nexus/rollup.config.js`

```javascript
import { defineConfig } from 'rollup'
import typescript from '@rollup/plugin-typescript'
import resolve from '@rollup/plugin-node-resolve'
import commonjs from '@rollup/plugin-commonjs'
import terser from '@rollup/plugin-terser'

const basePlugins = [resolve({ browser: true }), commonjs(), typescript({ tsconfig: './tsconfig.lib.json' })]

export default defineConfig([
  // Standard ESM output (external deps)
  {
    input: 'src/index.ts',
    output: {
      file: '../../dist/libs/nexus/index.esm.js',
      format: 'esm',
      sourcemap: true,
    },
    external: [
      '@hyperfrontend/data-utils',
      '@hyperfrontend/immutable-api-utils',
      '@hyperfrontend/logging',
      '@hyperfrontend/random-generator-utils',
      '@hyperfrontend/state-machine',
      'jsonschema',
    ],
    plugins: basePlugins,
  },
  // Standard CJS output (external deps)
  {
    input: 'src/index.ts',
    output: {
      file: '../../dist/libs/nexus/index.cjs.js',
      format: 'cjs',
      sourcemap: true,
    },
    external: [
      /* same as above */
    ],
    plugins: basePlugins,
  },
  // Self-contained UMD bundle (all deps bundled)
  {
    input: 'src/index.ts',
    output: {
      file: '../../dist/libs/nexus/nexus.umd.js',
      format: 'umd',
      name: 'HyperfrontendNexus',
      sourcemap: true,
    },
    plugins: basePlugins,
  },
  // Minified UMD bundle
  {
    input: 'src/index.ts',
    output: {
      file: '../../dist/libs/nexus/nexus.umd.min.js',
      format: 'umd',
      name: 'HyperfrontendNexus',
      sourcemap: true,
    },
    plugins: [...basePlugins, terser()],
  },
])
```

**File**: `libs/nexus/project.json` (update)

```json
{
  "targets": {
    "build": {
      "executor": "@nx/rollup:rollup",
      "options": {
        "project": "{projectRoot}/package.json",
        "main": "{projectRoot}/src/index.ts",
        "outputPath": "dist/{projectRoot}",
        "tsConfig": "{projectRoot}/tsconfig.lib.json",
        "rollupConfig": "{projectRoot}/rollup.config.js"
      }
    }
  }
}
```

### Feature Plugin Configuration

For the plugin itself, CJS is sufficient, but dual output is acceptable:

**File**: `plugins/features/project.json` (update)

```json
{
  "targets": {
    "build": {
      "executor": "@nx/rollup:rollup",
      "options": {
        "project": "{projectRoot}/package.json",
        "main": "{projectRoot}/src/index.ts",
        "outputPath": "dist/{projectRoot}",
        "tsConfig": "{projectRoot}/tsconfig.lib.json",
        "format": ["cjs"],
        "assets": ["{projectRoot}/generators.json", "{projectRoot}/executors.json"]
      }
    }
  }
}
```

### Shell Template Configuration

The `@hyperfrontend/features:init` generator should scaffold a `rollup.config.js` similar to nexus for each generated shell project.

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

### Output Locations

| Project          | ESM                               | CJS                                  | UMD                                |
| ---------------- | --------------------------------- | ------------------------------------ | ---------------------------------- |
| lib-nexus        | `dist/libs/nexus/index.esm.js`    | `dist/libs/nexus/index.cjs.js`       | `dist/libs/nexus/nexus.umd.min.js` |
| lib-cryptography | `dist/libs/cryptography/*.esm.js` | `dist/libs/cryptography/*.cjs.js`    | N/A                                |
| plugin-features  | N/A                               | `dist/plugins/features/index.cjs.js` | N/A                                |

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
