# Build System TODO

**Last Updated**: February 8, 2026

---

## Current State

All 14 libraries build successfully with ESM + CJS dual output. The build executor auto-discovers entry points, generates proper `exports` in package.json, inherits repository metadata from root, and handles external dependencies correctly.

**Recent Updates:**

- ✅ Package.json now inherits `repository`, `bugs`, `homepage`, `author` from root
- ✅ CHANGELOG.md is copied to dist (when present)
- ✅ FUNDING.md is copied to dist (if library has funding config)
- ✅ Publish executor created for npm publishing
- ✅ **Idempotent version executor** created (wraps @jscutlery/semver with tag check)
- ✅ Post-commit hook for automatic versioning
- ✅ CI release workflow for publish-only operations

---

## Phase 2: Package.json Enhancements ✅

### 2.1 Add `sideEffects` field ✅

- [x] Add `"sideEffects": false` to generated package.json for tree-shaking optimization

### 2.2 Inherit metadata fields ✅

- [x] Inherit `repository`, `bugs`, `homepage`, `author` from root package.json
- [x] Copy CHANGELOG.md to dist during build
- [x] Copy FUNDING.md to dist if package has funding config

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

### 4.2 Version and release automation ✅

- [x] Configure @jscutlery/semver for all libraries
- [x] Add `version` target to all library project.json files
- [x] Add release job to ci-main.yml for affected versioning
- [x] Configure tag format: `{projectName}@{version}`

### 4.3 Publish automation

- [x] Create publish executor
- [x] Add `publish` target to all library project.json files
- [ ] Add NPM_TOKEN secret to GitHub repository
- [ ] Add publish job to ci-main.yml (after first manual publish)

### 4.4 Remaining CI tasks

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
- [ ] Verdaccio local publish test passes
- [x] Version command generates CHANGELOG.md correctly

---

## Quick Reference

**Build Executor**: `tools/package/src/executors/build/`
**Publish Executor**: `tools/package/src/executors/publish/`
**Version Executor**: `tools/package/src/executors/version/`

**Key files**:

- `lib/build-unified.ts` - Rollup configuration
- `lib/package-json.ts` - Package.json generation with metadata inheritance
- `lib/assets.ts` - Asset copying (README, CHANGELOG, LICENSE, FUNDING)
- `executor.ts` - Main build executor
- `version/executor.ts` - Idempotent wrapper around @jscutlery/semver:version

**Commands**:

```bash
# Build
npx nx build lib-nexus

# Version (idempotent - only updates if needed)
npx nx version lib-nexus --skipCommit

# Version with dry-run
npx nx version lib-nexus --dryRun

# Publish
npx nx publish lib-nexus --dryRun

# Affected operations
npx nx affected -t=build
npx nx affected -t=version
npx nx affected -t=publish
```

---

## Related Documents

- [BUILD_SYSTEM_PROGRESS.md](./BUILD_SYSTEM_PROGRESS.md) — Architecture overview
- [DEPLOYMENT_PUBLISHING.md](./DEPLOYMENT_PUBLISHING.md) — Publishing workflow
- [VERDACCIO_TESTING.md](./VERDACCIO_TESTING.md) — Local npm testing
- [VERSIONING_AUTOMATION_PLAN.md](./VERSIONING_AUTOMATION_PLAN.md) — Versioning automation details
