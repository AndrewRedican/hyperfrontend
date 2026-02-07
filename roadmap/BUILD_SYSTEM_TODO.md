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
- [x] lib-network-protocol - builds successfully

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

## Phase 1.7: Fix lib-network-protocol Source Errors ✅

The TypeScript errors in lib-network-protocol source code have been fixed.

**Validation status:**

| Check                                      | Status     |
| ------------------------------------------ | ---------- |
| `npx nx format:check lib-network-protocol` | ✅ SUCCESS |
| `npx nx lint lib-network-protocol`         | ✅ SUCCESS |
| `npx nx test lib-network-protocol`         | ✅ SUCCESS |
| `npx nx build lib-network-protocol`        | ✅ SUCCESS |

**Files fixed:**

- `channel/mocks.ts` - Fixed imports to use proper protocol-compatible functions
- `packet/creators/mocks.ts` - Restored 2-arg helper functions, keep 1-arg protocol functions separate
- `create-decrypter.ts` - Made returned function generic to match DataDecrypter type
- `is-valid-message.ts` - Changed `Options` import to `DepthConfig` (correct type name)
- `static-encryption-key.ts` - Changed parameter types to `PacketEncrypter`/`PacketDecrypter`
- `dynamic-obfuscation-key.ts` - Changed parameter types to `PacketObfuscater`/`PacketDeobfuscater`

**Circular dependencies (Rollup warnings - not blocking):**

- `queue/creators/index.ts` ↔ `create-deobfuscation-queue.ts`
- `queue/creators/index.ts` ↔ `create-deserialization-queue.ts`
- `queue/creators/index.ts` ↔ `create-encryption-queue.ts`
- `queue/creators/index.ts` ↔ `create-obfuscation-queue.ts`
- `queue/creators/index.ts` ↔ `create-serialization-queue.ts`
- `queue/creators/index.ts` ↔ `create-decryption-queue.ts`

---

## Phase 1.8: Add Typecheck Target ✅

Added `typecheck` target as a fast pre-build validation to catch TypeScript errors early.

### Why?

- Build runs Rollup which is slow → typecheck is faster feedback loop
- CI can run `typecheck` before `build` to fail fast
- Catches type errors without producing artifacts
- Complements lint (ESLint catches style/rules, tsc catches type errors)

### Implementation

Created a custom `@hyperfrontend/package:typecheck` executor in `tools/package/src/executors/typecheck/`.

**nx.json target default:**

```json
"typecheck": {
  "cache": true,
  "inputs": ["default", "^default"],
  "executor": "@hyperfrontend/package:typecheck"
}
```

**project.json usage (simplified):**

```json
"typecheck": {}
```

- [x] Add `typecheck` target to all library project.json files
- [x] Add to CI pipeline: `format:check` → `lint` → `typecheck` → `test` → `build`
- [x] Update `run-checks/action.yml` to support `typecheck` check type

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

- [x] Add typecheck target to all libraries
- [x] `nx run-many -t=typecheck --all` succeeds
- [x] `nx run-many -t=build --all` succeeds
- [ ] All expected outputs exist in `dist/`
- [ ] ESM imports work: `import { x } from '@hyperfrontend/utils'`
- [ ] CJS requires work: `const { x } = require('@hyperfrontend/utils')`
- [ ] UMD loads in browser and exposes global (for nexus)

---

## Quick Reference

**All libraries building successfully**:

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
- lib-network-protocol
- lib-web-worker
- lib-immutable-api-utils

**Executor location**: `tools/package/src/executors/build/`

**Key files modified**:

- `lib/build-unified.ts` - Rollup configuration (json, commonjs plugins, onwarn handler)
- `executor.ts` - External dependency detection (all deps, not just @hyperfrontend/\*)
- `lib/package-json.ts` - Package.json generation
