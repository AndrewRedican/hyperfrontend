# Build System TODO

**Last Updated**: February 8, 2026

---

## Current State

All 14 libraries build successfully with ESM + CJS dual output. The build executor auto-discovers entry points, generates proper `exports` in package.json, and handles external dependencies correctly.

---

## Phase 2: Package.json Enhancements

### 2.1 Add `sideEffects` field

- [ ] Add `"sideEffects": false` to generated package.json for tree-shaking optimization

---

## Phase 3: UMD/IIFE Bundled Builds

Add self-contained bundle generation for CDN distribution (lib-nexus, lib-network-protocol).

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

### 4.1 Per-library build badges ✅

Implemented two-tier badge strategy:

- **Root README**: Badge links to `ci-main.yml` for overall project health
- **Library READMEs**: Each links to its own `ci-lib-<name>.yml` workflow

Added 15 new workflow files:

- `_lib-ci.yml` — reusable workflow template
- `ci-lib-*.yml` — per-library workflow callers (14 libraries)

### 4.2 Update workflows

- [ ] Add artifact upload step to ci-main.yml
- [ ] Add bundle build step for CDN-targeted libraries

---

## Known Issues

### Circular Dependencies in lib-network-protocol

The `queue/creators` barrel file has circular imports (visible as Rollup warnings during build):

```
queue/creators/index.ts ↔ create-*-queue.ts files
```

**Pattern**: Each `create-*-queue.ts` imports `createQueue` from `../creators` (the barrel), while the barrel re-exports from those files.

**Runtime impact**: None. JavaScript's module registry resolves this correctly because by the time the functions execute, all exports are defined.

**Tree-shaking impact**: Minimal. These are factory functions typically used together.

---

## Phase 5: Code Quality

### 5.1 Fix circular dependencies in lib-network-protocol

- [ ] In each `create-*-queue.ts` file, change `import { createQueue } from '../creators'` to `import { createQueue } from './create-queue'`

**Files to update:**

- `libs/network-protocol/src/lib/queue/creators/create-deobfuscation-queue.ts`
- `libs/network-protocol/src/lib/queue/creators/create-deserialization-queue.ts`
- `libs/network-protocol/src/lib/queue/creators/create-encryption-queue.ts`
- `libs/network-protocol/src/lib/queue/creators/create-obfuscation-queue.ts`
- `libs/network-protocol/src/lib/queue/creators/create-serialization-queue.ts`
- `libs/network-protocol/src/lib/queue/creators/create-decryption-queue.ts`

---

## Validation Checklist

- [x] `nx run-many -t=typecheck --all` succeeds
- [x] `nx run-many -t=build --all` succeeds
- [ ] ESM imports work: `import { x } from '@hyperfrontend/utils'`
- [ ] CJS requires work: `const { x } = require('@hyperfrontend/utils')`
- [ ] UMD loads in browser and exposes global (for nexus, network-protocol)

---

## Quick Reference

**Executor location**: `tools/package/src/executors/build/`

**Key files**:

- `lib/build-unified.ts` - Rollup configuration
- `executor.ts` - External dependency detection
- `lib/package-json.ts` - Package.json generation
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
