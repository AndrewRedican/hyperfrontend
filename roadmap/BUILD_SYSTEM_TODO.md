# Build System TODO

**Last Updated**: February 7, 2026

---

## Phase 1: Unblock Dependent Libraries (Critical Path) ✅

The TS6059 rootDir error blocked libraries with `@hyperfrontend/*` dependencies. This has been fixed.

### 1.1 Mark internal deps as external in Rollup config ✅

- [x] Update `build-unified.ts` to add `@hyperfrontend/*` to external
- [x] Clear TypeScript paths to prevent source resolution
- [x] Verify lib-list-utils builds successfully

### 1.2 Add build target to remaining libraries

- [ ] lib-logging - add `"build": {}` to project.json targets
- [ ] lib-ui-utils - add `"build": {}` to project.json targets
- [ ] lib-cryptography - add `"build": {}` to project.json targets
- [ ] lib-state-machine - add `"build": {}` to project.json targets
- [ ] lib-network-protocol - add `"build": {}` to project.json targets
- [ ] lib-nexus - add `"build": {}` to project.json targets

### 1.3 Build all libraries in dependency order

- [ ] Run `npx nx run-many -t=build --all`
- [ ] Confirm all libraries produce correct outputs

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

- [ ] `nx run-many -t=build --all` succeeds
- [ ] All expected outputs exist in `dist/`
- [ ] ESM imports work: `import { x } from '@hyperfrontend/utils'`
- [ ] CJS requires work: `const { x } = require('@hyperfrontend/utils')`
- [ ] UMD loads in browser and exposes global (for nexus)

---

## Quick Reference

**Blocked libraries** (need external deps fix):

- lib-list-utils
- lib-ui-utils
- lib-cryptography
- lib-state-machine
- lib-network-protocol
- lib-nexus

**Executor location**: `tools/package/src/executors/build/`

**Key files to modify**:

- `lib/build-unified.ts` - Rollup configuration
- `lib/package-json.ts` - Package.json generation
