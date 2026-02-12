# Build Executor V2 — Implementation Roadmap

**Created:** February 12, 2026
**Reference:** [build-executor-v2.md](build-executor-v2.md)
**Status:** Not Started

---

## Mission Statement

Replace the implicit, auto-detecting build executor with an explicit, format-centric `build-v2` executor. All output formats (ESM, CJS, IIFE, UMD) are opt-in, providing full control over what gets built and how. This eliminates legacy coupling, enables per-format entry points, and supports peer dependency inlining for CDN bundles.

---

## Implementation Guidelines

> Reference: [build-executor-v2.md — Implementation Guidelines](build-executor-v2.md#implementation-guidelines)

### Code Style

- Use angle brackets for type casting: `<Type>value`, not `value as Type`
- Use functional programming with factory functions. No classes.
- Provide complete JSDoc for all exported functions and types.
- No inline comments unless absolutely necessary to clarify intent.
- No top-level module comment blocks. Rely on JSDoc only.
- Refer to [nx-devkit-api-analysis](./nx-devkit-api-analysis.md) for opportunies to rely on @nx/devkit API

### Imports

- Import types separately: `import type { Foo } from './foo'`
- Use named imports only: `import { foo, bar } from './module'` — never `import * as`
- Prefix Node.js modules: `import { readFileSync } from 'node:fs'`

### Dependencies

- Use only existing project dependencies. No new packages.
- Prefer Node.js built-in modules when possible.
- Use `@nx/devkit` APIs where they provide ergonomic advantages.
- Do not use `fs/promises` or async file write operations — they cause race condition bugs.

### Build Output Functions

- Break down each format (ESM, CJS, IIFE, UMD) into discrete functions.
- Format functions return Rollup configuration objects — they do not invoke Rollup directly.
- A single orchestrator function collects all format configs and executes one Rollup build.

---

## Target File/Folder Structure

```
tools/package/src/executors/build-v2/
├── executor.ts                 # Main executor entry point
├── schema.json                 # JSON Schema for executor options
└── lib/
    ├── index.ts                # Re-exports all lib modules
    ├── types.ts                # TypeScript types (FormatEntryConfig, ESMConfig, etc.)
    ├── assets.ts               # Copied from build v1 (copyAssets, copyDefaultAssets, etc.)
    ├── paths.ts                # Copied from build v1 (resolveOutputPath, resolveTsConfigPath, etc.)
    ├── entry-resolver.ts       # Glob/exact path entry resolution
    ├── externals.ts            # External dependency detection + peer dep inlining
    ├── rollup-plugins.ts       # Shared Rollup plugin factories
    ├── config-esm.ts           # ESM Rollup config generator
    ├── config-cjs.ts           # CJS Rollup config generator
    ├── config-iife.ts          # IIFE Rollup config generator
    ├── config-umd.ts           # UMD Rollup config generator
    ├── declarations.ts         # TypeScript declaration generation
    └── package-json.ts         # Exports field generation for V2
```

---

## Implementation Steps

### Phase 1: Scaffold Structure

#### Step 1.1: Create executor directory structure

Create the folder structure and empty placeholder files.

```bash
mkdir -p tools/package/src/executors/build-v2/lib
touch tools/package/src/executors/build-v2/executor.ts
touch tools/package/src/executors/build-v2/schema.json
touch tools/package/src/executors/build-v2/lib/index.ts
touch tools/package/src/executors/build-v2/lib/types.ts
touch tools/package/src/executors/build-v2/lib/assets.ts
touch tools/package/src/executors/build-v2/lib/paths.ts
touch tools/package/src/executors/build-v2/lib/entry-resolver.ts
touch tools/package/src/executors/build-v2/lib/externals.ts
touch tools/package/src/executors/build-v2/lib/rollup-plugins.ts
touch tools/package/src/executors/build-v2/lib/config-esm.ts
touch tools/package/src/executors/build-v2/lib/config-cjs.ts
touch tools/package/src/executors/build-v2/lib/config-iife.ts
touch tools/package/src/executors/build-v2/lib/config-umd.ts
touch tools/package/src/executors/build-v2/lib/declarations.ts
touch tools/package/src/executors/build-v2/lib/package-json.ts
```

- [ ] **1.1** Create directory structure and empty files

---

#### Step 1.2: Add schema.json

Copy the JSON Schema from [build-executor-v2.md — JSON Schema](build-executor-v2.md#json-schema) into `schema.json`.

- [ ] **1.2** Populate `schema.json` with full JSON Schema

---

#### Step 1.3: Add types.ts

Copy the TypeScript types from [build-executor-v2.md — TypeScript Types](build-executor-v2.md#typescript-types) into `types.ts`.

- [ ] **1.3** Populate `types.ts` with all type definitions

---

#### Step 1.4: Copy assets.ts from build v1

> Reference: [build-executor-v2.md — Reusable Code from Build V1](build-executor-v2.md#reusable-code-from-build-v1)

Copy `tools/package/src/executors/build/lib/assets.ts` to `build-v2/lib/assets.ts`. No modifications needed.

- [ ] **1.4** Copy `assets.ts` from build v1

---

#### Step 1.5: Copy paths.ts from build v1

> Reference: [build-executor-v2.md — Reusable Code from Build V1](build-executor-v2.md#reusable-code-from-build-v1)

Copy `tools/package/src/executors/build/lib/paths.ts` to `build-v2/lib/paths.ts`. No modifications needed.

- [ ] **1.5** Copy `paths.ts` from build v1

---

#### Step 1.6: Register executor in executors.json

Add the `build-v2` entry to `tools/package/executors.json`:

```json
"build-v2": {
  "implementation": "./src/executors/build-v2/executor",
  "schema": "./src/executors/build-v2/schema.json",
  "description": "Format-centric build executor with explicit output configuration."
}
```

- [ ] **1.6** Register `build-v2` in `executors.json`

---

### ✅ Checkpoint 1: Structure Verified

**Verification:**

```bash
# Confirm files exist
ls -la tools/package/src/executors/build-v2/
ls -la tools/package/src/executors/build-v2/lib/

# Confirm executor is registered
cat tools/package/executors.json | grep build-v2
```

- [ ] **Checkpoint 1** — Structure verified

---

### Phase 2: Foundation Modules

#### Step 2.1: Implement lib/index.ts

Create the barrel export file that re-exports all lib modules.

```typescript
// Expected exports (update as modules are implemented):
export * from './types'
export * from './assets'
export * from './paths'
export * from './entry-resolver'
export * from './externals'
export * from './rollup-plugins'
export * from './config-esm'
export * from './config-cjs'
export * from './config-iife'
export * from './config-umd'
export * from './declarations'
export * from './package-json'
```

- [ ] **2.1** Implement `lib/index.ts` barrel export

---

#### Step 2.2: Implement entry-resolver.ts

> Reference: [build-executor-v2.md — Implementation Plan: Step 4](build-executor-v2.md#phase-1-create-build-executor-v2)

**Expected behavior:**

- `resolveEntries(config: FormatEntryConfig, discoveredEntries: EntryPoint[]): EntryPoint[]`
- Support exact paths (`.`, `./browser`, `./browser/v2`)
- Support glob patterns (`./browser/*`)
- Support arrays (`["./browser/v1", "./browser/v2"]`)
- Respect `exclude` patterns
- When `entry` is omitted, return all discovered entries

**Patterns:**

- Use `minimatch` or manual glob matching (prefer existing deps)
- Return filtered `EntryPoint[]` from the discovered set
- Reference `tools/package/src/executors/build/lib/detect.ts` for `discoverEntryPoints()` patterns

- [ ] **2.2** Implement `entry-resolver.ts`

---

#### Step 2.3: Implement externals.ts

> Reference: [build-executor-v2.md — Implementation Plan: Step 5](build-executor-v2.md#phase-1-create-build-executor-v2)

**Expected behavior:**

- `getExternalDependencies(packageJsonPath: string, formatExternal?: string[]): string[]`
  - Read `dependencies` + `peerDependencies` from package.json
  - Merge with format-specific `external` array
  - Return combined external list

- `getPeerDependenciesToInline(packageJsonPath: string): string[]`
  - Read `peerDependencies` from package.json
  - Return list for IIFE/UMD inlining when `inlinePeerDependencies: true`

**Patterns:**

- Reference `tools/package/src/executors/build/executor.ts` for `getExternalDependencies()` pattern

- [ ] **2.3** Implement `externals.ts`

---

#### Step 2.4: Implement rollup-plugins.ts

> Reference: [build-executor-v2.md — Key Patterns to Preserve](build-executor-v2.md#key-patterns-to-preserve)

**Expected behavior:**

- Factory functions that return configured Rollup plugins
- `createNodeResolvePlugin(options?): Plugin`
- `createCommonJsPlugin(): Plugin`
- `createTypescriptPlugin(tsConfigPath: string): Plugin`
- `createJsonPlugin(): Plugin`
- `createTerserPlugin(): Plugin`

**Patterns:**

- Reference `tools/package/src/executors/build/lib/build-unified.ts` for plugin configuration
- Export individual factories for composition in format configs

- [ ] **2.4** Implement `rollup-plugins.ts`

---

### ✅ Checkpoint 2: Foundation Modules

**Verification:**

```bash
# TypeScript compilation check
npx tsc --noEmit -p tools/package/tsconfig.json
```

- [ ] **Checkpoint 2** — Foundation modules compile without errors

---

### Phase 3: Format Config Generators

#### Step 3.1: Implement config-esm.ts

> Reference: [build-executor-v2.md — ESM configuration](build-executor-v2.md#typescript-types)

**Expected behavior:**

- `createESMConfig(entries: EntryPoint[], options: ESMConfig, context: BuildContext): RollupOptions`
- Returns Rollup config for ESM output
- Externalize dependencies (do not bundle)
- Support `sourcemap` option (default: true)
- Output to `dist/{projectRoot}/esm/` or similar

**Patterns:**

- Reference `createOutputConfigs()` in `build-unified.ts` for ESM output config
- Use plugins from `rollup-plugins.ts`

- [ ] **3.1** Implement `config-esm.ts`

---

#### Step 3.2: Implement config-cjs.ts

> Reference: [build-executor-v2.md — CJS configuration](build-executor-v2.md#typescript-types)

**Expected behavior:**

- `createCJSConfig(entries: EntryPoint[], options: CJSConfig, context: BuildContext): RollupOptions`
- Returns Rollup config for CJS output
- Externalize dependencies (do not bundle)
- Support `sourcemap` option (default: true)
- Output to `dist/{projectRoot}/cjs/` or similar

- [ ] **3.2** Implement `config-cjs.ts`

---

#### Step 3.3: Implement config-iife.ts

> Reference: [build-executor-v2.md — IIFE configuration](build-executor-v2.md#typescript-types)

**Expected behavior:**

- `createIIFEConfig(entries: EntryPoint[], options: IIFEConfig, context: BuildContext): RollupOptions`
- Returns Rollup config for IIFE bundle
- `globalName` is required
- Inline peer dependencies when `inlinePeerDependencies: true` (default)
- Generate minified version when `minify: true` (default)
- Output to `dist/{projectRoot}/{output}/` (default: `bundle/`)

**Patterns:**

- Reference `createBundleRollupConfig()` in `build-unified.ts`
- Use `terser` plugin for minification

- [ ] **3.3** Implement `config-iife.ts`

---

#### Step 3.4: Implement config-umd.ts

> Reference: [build-executor-v2.md — UMD configuration](build-executor-v2.md#typescript-types)

**Expected behavior:**

- `createUMDConfig(entries: EntryPoint[], options: UMDConfig, context: BuildContext): RollupOptions`
- Returns Rollup config for UMD bundle
- `globalName` is required
- Support `amdId` option (default: package name)
- Inline peer dependencies when `inlinePeerDependencies: true` (default)
- Generate minified version when `minify: true` (default)
- Output to `dist/{projectRoot}/{output}/` (default: `bundle/`)

- [ ] **3.4** Implement `config-umd.ts`

---

### ✅ Checkpoint 3: Format Configs

**Verification:**

```bash
# TypeScript compilation check
npx tsc --noEmit -p tools/package/tsconfig.json
```

- [ ] **Checkpoint 3** — Format config modules compile without errors

---

### Phase 4: Supporting Modules

#### Step 4.1: Implement declarations.ts

> Reference: [build-executor-v2.md — Key Patterns to Preserve](build-executor-v2.md#key-patterns-to-preserve)

**Expected behavior:**

- `generateDeclarations(tsConfigPath: string, outputPath: string): Promise<void>`
  - Use `tsc` directly for consistent `.d.ts` paths
  - Generate declaration files for all entry points

- `flattenDeclarationPaths(outputPath: string): void`
  - Flatten nested declaration paths for multi-entry libraries

**Patterns:**

- Reference `generateDeclarationsUnified()` in `build-unified.ts`
- Reference `flattenDeclarationPaths()` usage

- [ ] **4.1** Implement `declarations.ts`

---

#### Step 4.2: Implement package-json.ts

> Reference: [build-executor-v2.md — Key Patterns to Preserve](build-executor-v2.md#key-patterns-to-preserve)

**Expected behavior:**

- `generatePackageJson(context: BuildContext, formatConfigs: FormatOutputs): PackageJson`
  - Generate `exports` field based on configured formats
  - Include `main`, `module`, `types` fields as appropriate
  - Copy workspace fields (`repository`, `bugs`, `homepage`, `author`) from root

- `writePackageJson(outputPath: string, packageJson: PackageJson): void`
  - Write synchronously (no async — race condition prevention)

**Patterns:**

- Reference `generateExportsFromDiscovery()` in `package-json.ts` (v1)
- Adapt exports structure for format-specific entries

- [ ] **4.2** Implement `package-json.ts`

---

### ✅ Checkpoint 4: Supporting Modules

**Verification:**

```bash
# TypeScript compilation check
npx tsc --noEmit -p tools/package/tsconfig.json
```

- [ ] **Checkpoint 4** — Supporting modules compile without errors

---

### Phase 5: Main Executor

#### Step 5.1: Implement executor.ts — Scaffolding

Create the executor shell with option parsing and orchestration structure.

**Expected behavior (scaffolding):**

- Parse `BuildV2ExecutorOptions` from context
- Resolve output path and tsconfig path
- Log configuration summary
- Return success placeholder

```typescript
// Scaffold structure:
export default async function runExecutor(options: BuildV2ExecutorOptions, context: ExecutorContext): Promise<{ success: boolean }> {
  // 1. Resolve paths
  // 2. Discover entry points
  // 3. Process each configured format
  // 4. Generate declarations
  // 5. Generate package.json
  // 6. Copy assets
  // 7. Return result
}
```

- [ ] **5.1** Implement `executor.ts` scaffolding

---

#### Step 5.2: Implement executor.ts — Entry Discovery

Integrate entry point discovery and resolution.

- [ ] **5.2** Implement entry discovery in `executor.ts`

---

#### Step 5.3: Implement executor.ts — Format Processing

Implement format iteration and Rollup execution.

**Expected behavior:**

- For each configured format (`esm`, `cjs`, `iife`, `umd`):
  - Normalize to array (single config → `[config]`)
  - Resolve entries using `entry-resolver.ts`
  - Generate Rollup config using format-specific module
  - Collect all configs
- Execute single Rollup build with all configs

- [ ] **5.3** Implement format processing in `executor.ts`

---

#### Step 5.4: Implement executor.ts — Finalization

Complete executor with declarations, package.json, and assets.

- [ ] **5.4** Implement finalization steps in `executor.ts`

---

### ✅ Checkpoint 5: Executor Complete

**Verification:**

```bash
# TypeScript compilation check
npx tsc --noEmit -p tools/package/tsconfig.json

# Test with simple library (dry run)
npx nx build random-generator-utils --dry-run
```

- [ ] **Checkpoint 5** — Executor compiles and dry-run succeeds

---

### Phase 6: Library Migrations

> Reference: [build-executor-v2.md — Phase 2: Migrate Library Projects](build-executor-v2.md#phase-2-migrate-library-projects)

Migrate libraries in order of complexity (simple → complex).

#### Step 6.1: Migrate random-generator-utils

> Reference: [build-executor-v2.md — @hyperfrontend/random-generator-utils](build-executor-v2.md#hyperfrontendrandom-generator-utils)

- [ ] **6.1** Update `libs/utils/random-generator/project.json` to use `build-v2`
- [ ] **6.1a** Run `npx nx build random-generator-utils` and verify output

---

#### Step 6.2: Migrate function-utils

> Reference: [build-executor-v2.md — @hyperfrontend/function-utils](build-executor-v2.md#hyperfrontendfunction-utils)

- [ ] **6.2** Update `libs/utils/function/project.json` to use `build-v2`
- [ ] **6.2a** Run `npx nx build function-utils` and verify output

---

#### Step 6.3: Migrate logging

> Reference: [build-executor-v2.md — @hyperfrontend/logging](build-executor-v2.md#hyperfrontendlogging)

- [ ] **6.3** Update `libs/logging/project.json` to use `build-v2`
- [ ] **6.3a** Run `npx nx build logging` and verify output

---

#### Step 6.4: Migrate string-utils (platform split)

> Reference: [build-executor-v2.md — @hyperfrontend/string-utils](build-executor-v2.md#hyperfrontendstring-utils)

- [ ] **6.4** Update `libs/utils/string/project.json` to use `build-v2`
- [ ] **6.4a** Run `npx nx build string-utils` and verify output

---

#### Step 6.5: Migrate cryptography (hybrid + browser entry)

> Reference: [build-executor-v2.md — @hyperfrontend/cryptography](build-executor-v2.md#hyperfrontendcryptography)

**Pre-requisite:** Update `window.crypto` → `globalThis.crypto` per [Web Worker & Edge Runtime Compatibility](build-executor-v2.md#web-worker--edge-runtime-compatibility).

- [ ] **6.5a** Update `libs/cryptography/src/lib/subtle/browser.ts` to use `globalThis.crypto`
- [ ] **6.5b** Update `libs/cryptography/src/lib/get-random-values/browser.ts` to use `globalThis.crypto`
- [ ] **6.5c** Update `libs/cryptography/project.json` to use `build-v2`
- [ ] **6.5d** Run `npx nx build cryptography` and verify output

---

#### Step 6.6: Migrate state-machine

> Reference: [build-executor-v2.md — @hyperfrontend/state-machine](build-executor-v2.md#hyperfrontendstate-machine)

- [ ] **6.6** Update `libs/state-machine/project.json` to use `build-v2`
- [ ] **6.6a** Run `npx nx build state-machine` and verify output

---

#### Step 6.7: Migrate network-protocol (complex multi-bundle)

> Reference: [build-executor-v2.md — @hyperfrontend/network-protocol](build-executor-v2.md#hyperfrontendnetwork-protocol)

- [ ] **6.7** Update `libs/network-protocol/project.json` to use `build-v2`
- [ ] **6.7a** Run `npx nx build network-protocol` and verify output
- [ ] **6.7b** Verify separate bundles exist at `dist/libs/network-protocol/bundle/v1/` and `bundle/v2/`

---

#### Step 6.8: Migrate nexus (hybrid + inlined peer deps)

> Reference: [build-executor-v2.md — @hyperfrontend/nexus](build-executor-v2.md#hyperfrontendnexus)

- [ ] **6.8** Update `libs/nexus/project.json` to use `build-v2`
- [ ] **6.8a** Run `npx nx build nexus` and verify output
- [ ] **6.8b** Verify peer dependencies are inlined in bundle

---

#### Step 6.9: Migrate remaining utils libraries

> Reference: [build-executor-v2.md — Configuration Summary Table](build-executor-v2.md#configuration-summary-table)

- [ ] **6.9a** Migrate `list-utils`
- [ ] **6.9b** Migrate `data-utils`
- [ ] **6.9c** Migrate `time-utils`
- [ ] **6.9d** Migrate `ui-utils`
- [ ] **6.9e** Migrate `immutable-api-utils`

---

### ✅ Checkpoint 6: All Libraries Migrated

**Verification:**

```bash
# Clean previous builds
rm -rf dist/libs

# Build all libraries
npx nx run-many -t=build

# Verify outputs exist
ls -la dist/libs/*/

# Check bundle outputs
ls -la dist/libs/nexus/bundle/
ls -la dist/libs/network-protocol/bundle/
ls -la dist/libs/cryptography/bundle/
```

- [ ] **Checkpoint 6** — All libraries build successfully with `build-v2`

---

### Phase 7: Verification & Cleanup

#### Step 7.1: Full build verification

> Reference: [build-executor-v2.md — Phase 3: Verification](build-executor-v2.md#phase-3-verification)

```bash
# Clean previous builds
rm -rf dist/libs

# Build all libraries
npx nx run-many -t=build

# Verify outputs exist
ls -la dist/libs/*/
```

- [ ] **7.1** Full build verification passes

---

#### Step 7.2: Publish dry-run

```bash
# Test npm pack for each library
for lib in dist/libs/*/; do
  (cd "$lib" && npm pack --dry-run)
done
```

- [ ] **7.2** npm pack dry-run succeeds for all libraries

---

#### Step 7.3: Deprecate build v1

> Reference: [build-executor-v2.md — Phase 4: Cleanup](build-executor-v2.md#phase-4-cleanup-after-verification)

Update `tools/package/executors.json`:

```json
{
  "build": {
    "description": "[DEPRECATED] Use build-v2. Legacy build executor with implicit configuration."
  }
}
```

- [ ] **7.3** Mark `build` executor as deprecated

---

#### Step 7.4: Update documentation

- [ ] **7.4a** Update `tools/package/README.md` to document `build-v2`
- [ ] **7.4b** Update `ARCHITECTURE.md` if relevant

---

### ✅ Checkpoint 7: Implementation Complete

**Final Verification:**

```bash
# Full workspace build
npx nx run-many -t=build

# Linting
npx nx run-many -t=lint

# Tests
npx nx run-many -t=test
```

- [ ] **Checkpoint 7** — Implementation complete, all checks pass

---

## Progress Tracking

| Phase | Description              | Status      |
| ----- | ------------------------ | ----------- |
| 1     | Scaffold Structure       | Not Started |
| 2     | Foundation Modules       | Not Started |
| 3     | Format Config Generators | Not Started |
| 4     | Supporting Modules       | Not Started |
| 5     | Main Executor            | Not Started |
| 6     | Library Migrations       | Not Started |
| 7     | Verification & Cleanup   | Not Started |

---

## Notes

- No unit test spec files are required for this implementation per the specification.
- Integration and E2E testing is handled via `npx nx run-many` and npm pack verification.
- After all projects are migrated and verified, the `build` executor can be removed in a future release.
