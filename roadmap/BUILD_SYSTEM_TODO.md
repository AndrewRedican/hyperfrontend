# Build System TODO

**Last Updated**: February 7, 2026

---

## Phase 1: Unblock Dependent Libraries (Critical Path) ✅

The TS6059 rootDir error blocked libraries with `@hyperfrontend/*` dependencies. This has been fixed.

### 1.1 Mark internal deps as external in Rollup config ✅

- [x] Update `build-unified.ts` to add `@hyperfrontend/*` to external
- [x] Clear TypeScript paths to prevent source resolution
- [x] Verify lib-list-utils builds successfully

### 1.2 Add build target to remaining libraries ✅

- [x] lib-logging - add `"build": {}` to project.json targets
- [x] lib-ui-utils - add `"build": {}` to project.json targets
- [x] lib-cryptography - add `"build": {}` to project.json targets
- [x] lib-state-machine - add `"build": {}` to project.json targets
- [x] lib-network-protocol - add `"build": {}` to project.json targets
- [x] lib-nexus - add `"build": {}` to project.json targets

### 1.3 Build all libraries in dependency order ✅

- [x] lib-logging - builds successfully
- [x] lib-ui-utils - builds successfully
- [x] lib-cryptography - builds successfully
- [x] lib-state-machine - builds successfully
- [x] lib-nexus - builds successfully
- [ ] lib-network-protocol - **FAILS** (pre-existing TypeScript errors in source code)

### 1.4 Fix JSON Import Support ✅

- [x] Added `@rollup/plugin-json` to Rollup config in `build-unified.ts`
- [x] Added `@rollup/plugin-commonjs` for CJS interop

### 1.5 Suppress Build Warnings ✅

- [x] Fixed TS5069 declarationMap warning by setting `declarationMap: isRootEntry`
- [x] Suppressed TS2307 external module warnings via `onwarn` handler
- [x] Suppressed empty chunk warnings for barrel files via `onwarn` handler

### 1.6 External Dependencies ✅

- [x] All package.json dependencies (not just `@hyperfrontend/*`) are now marked as external for library builds

---

## Phase 1.7: Fix lib-network-protocol Source Errors 🚨

The build system works but lib-network-protocol has TypeScript errors in the source code:

**Files with errors:**

- `mocks.ts` - Type signature mismatches for Packet encryption/decryption types
- `create-decrypter.ts` - Generic type issue with DataDecrypter
- `is-valid-message.ts` - Missing export `Options` from `@hyperfrontend/data-utils`
- `static-encryption-key.ts` - Wrong number of arguments passed
- `dynamic-obfuscation-key.ts` - Wrong number of arguments passed

**Also has circular dependencies:**

- `queue/creators/index.ts` ↔ various `create-*-queue.ts` files

---

## Phase 2: Package.json Generation

Update the executor to produce industry-standard package.json exports.

### 2.1 Update output file naming

- [ ] Change `index.esm.js` → `index.js`
- [ ] Change `index.cjs.js` → `index.cjs`
- [ ] Update `package-json.ts` to reflect new paths

### 2.2 Add conditional exports structure

- [ ] Add `"type": "module"` field
- [ ] Add `"sideEffects": false` field
- [ ] Generate proper `exports` object with types/import/require

---

## Phase 3: UMD/IIFE Bundled Builds

Add self-contained bundle generation for CDN distribution.

### 3.1 Add bundle build capability

- [ ] Create `buildBundledOutput()` function in executor
- [ ] Configure Rollup for UMD + IIFE formats
- [ ] Inline all dependencies (including `@hyperfrontend/*`)

### 3.2 Add minification

- [ ] Add `@rollup/plugin-terser` dependency (if not present)
- [ ] Generate `.min.js` variants

### 3.3 Configure global variable names

- [ ] Add globalName option to executor schema
- [ ] Apply `Hyperfrontend*` naming convention

### 3.4 Output to bundle/ directory

- [ ] Create `bundle/` subdirectory in dist output
- [ ] Add `unpkg` and `jsdelivr` fields to package.json

---

## Phase 4: CI/CD Integration

### 4.1 Add build badge to README.md

- [ ] Add shields.io badge for ci-main.yml workflow

### 4.2 Update workflows

- [ ] Add artifact upload step to ci-main.yml
- [ ] Add bundle build step for CDN-targeted libraries

---

## Validation Checklist

Before completing:

- [ ] `nx run-many -t=build --all` succeeds (blocked by lib-network-protocol source errors)
- [ ] All expected outputs exist in `dist/`
- [ ] ESM imports work: `import { x } from '@hyperfrontend/utils'`
- [ ] CJS requires work: `const { x } = require('@hyperfrontend/utils')`
- [ ] UMD loads in browser and exposes global (for nexus)

---

## Quick Reference

**Blocked libraries** (source code TypeScript errors):

- lib-network-protocol

**Building successfully**:

- lib-logging
- lib-ui-utils
- lib-cryptography
- lib-state-machine
- lib-nexus
- lib-list-utils
- lib-data-utils
- lib-string-utils
- lib-function-utils
- lib-time-utils
- lib-random-generator-utils

**Executor location**: `tools/package/src/executors/build/`

**Key files modified**:

- `lib/build-unified.ts` - Rollup configuration (json, commonjs plugins, onwarn handler)
- `executor.ts` - External dependency detection (all deps, not just @hyperfrontend/\*)
- `lib/package-json.ts` - Package.json generation
