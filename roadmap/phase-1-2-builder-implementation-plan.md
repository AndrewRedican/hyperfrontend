# `@hyperfrontend/builder` Implementation Plan

**Status:** Approved (Grill Session Complete)
**Date:** 2026-04-27
**Parent:** [features-implementation-plan.md](./features-implementation-plan.md), Phase 1.2

---

## Context

Create `@hyperfrontend/builder`, the publishable vendor-neutral spiritual successor of [tools/package/src/executors/build/](../tools/package/src/executors/build/). It exposes composable primitives plus a single `build()` facade for library bundling (ESM/CJS/IIFE/UMD), JS bin synthesis, and Node SEA cross-platform native binaries; the existing Nx executor in `tools/package` is reduced to a thin facade caller and lib-versioning's hand-rolled `scripts/build-bins.mjs` is deleted in the same migration.

---

## Decisions Locked

| #   | Topic                       | Decision                                                                                                                                                                                                                    |
| --- | --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Scope                       | Library + bin (JS) + Node SEA cross-platform native binaries + features-style shell packages — all in scope                                                                                                                 |
| 2   | API model                   | No separate "library mode" vs "CLI mode" — bins are standard `package.json#bin`. Composable primitives + facades + CLI + native binary                                                                                      |
| 3   | Shell packages              | Treated as libraries with extra inlining + pre-build code-gen seam (generator lives in `@hyperfrontend/features`, not builder)                                                                                              |
| 4   | Opinionation principle      | Composable primitives + opt-in presets, single big-config `build()` runner, presets replaceable                                                                                                                             |
| 5   | Sub-path layout             | Domain-grouped (~12 subpaths), lib-versioning style                                                                                                                                                                         |
| 6   | Workspace dep awareness     | `isWorkspacePackage?: (name: string) => boolean` predicate canonical; `byPrefix(scope)` and `byNames(names[])` factories in `./presets`                                                                                     |
| 7   | Logger source               | Primitives use `logger` from `@hyperfrontend/logging` directly; no DI                                                                                                                                                       |
| 8   | Logger extensions           | `channel`/`timed`/`timedAsync` promoted upstream into `@hyperfrontend/logging` itself                                                                                                                                       |
| 9   | I/O delegation              | Strict `@hyperfrontend/project-scope` delegation; raw `node:fs` only for genuine gaps. **No** `@nx/devkit`, **no** `glob`, **no** `minimatch`. Allowed externals: `rollup` + `@rollup/plugin-*` + `typescript` + `postject` |
| 10  | Memory monitor              | Subpath `@hyperfrontend/builder/memory`, opt-in via config; `recover()` (event-loop yield) is always-on free utility independent of monitoring                                                                              |
| 11  | Default assets              | Builder ships zero default-asset knowledge — generic `copyAssets({ from, to, files[], condition? })` primitive. Wrapper supplies its own asset spec lists                                                                   |
| 12  | Field inheritance           | Configurable: `inheritFieldsFrom?: { from: string; fields: string[] }`. Wrapper passes `{ from: workspaceRoot/package.json, fields: ['repository','bugs','homepage','author'] }`                                            |
| 13  | Output workspace-dep filter | Opt-in flag (`filterWorkspaceDepsFromOutput: boolean`), explicit                                                                                                                                                            |
| 14  | Bin source convention       | Enforced: `src/bin/<name>.ts`. Config supplies `name` only                                                                                                                                                                  |
| 15  | Bin runner export           | Default: `default` export. Override via `runner: 'name'` (preserves lib-versioning's `runCz`/`runCl`)                                                                                                                       |
| 16  | Bin runner contract         | `(io: { argv: string[], cwd: string, stderr: NodeJS.WritableStream, stdout?: NodeJS.WritableStream }) => number \| Promise<number>`                                                                                         |
| 17  | Bin format                  | Per-bin `format: 'cjs' \| 'esm' \| ('cjs' \| 'esm')[]` (required). Both supported per declaration                                                                                                                           |
| 18  | Bin bootstrap footer        | Built-in default footer + per-bin string override (`bootstrap?: string`)                                                                                                                                                    |
| 19  | Bin mechanics               | Always: chmod 0o755 + shebang `#!/usr/bin/env node`. Auto-wire JS bins to `package.json#bin`                                                                                                                                |
| 20  | Node SEA injection          | `postject` is the third allowed external dep (alongside rollup + typescript). Builder calls postject's JS API directly                                                                                                      |
| 21  | Node SEA platform model     | Current-platform-only build. Per-bin `sea?: { platforms: [...] }`. Builder skips with info log if `process.platform`/`arch` not in declared targets. CI matrix orchestrates per-platform runners                            |
| 22  | Native binary wiring        | Native binaries do **not** auto-wire to `package.json#bin` — output to `dist/.../bin/<name>.<platform>-<arch>`; CI/release tooling distributes as separate artifacts                                                        |
| 23  | Wrapper invocation          | Facade-only. ~50 lines. No primitive composition                                                                                                                                                                            |
| 24  | Wrapper lib/                | Delete entire `tools/package/src/executors/build/lib/`. Tiny `wrapper-config.ts` for monorepo constants only                                                                                                                |
| 25  | Wrapper schema              | Minimal/opinionated, mirrors builder's facade config. Monorepo opinions hardcoded                                                                                                                                           |
| 26  | Migration timing            | Atomic in one PR: builder land + wrapper retrofit + lib-versioning migration                                                                                                                                                |
| 27  | Bootstrap                   | Builder dogfoods via wrapper. Phased commits inside the PR                                                                                                                                                                  |
| 28  | Self-build smoke test       | None. Regular CI is sufficient                                                                                                                                                                                              |
| 29  | CI native platforms         | Full common set (per GitHub Actions runner availability): `linux-x64`, `linux-arm64`, `darwin-x64`, `darwin-arm64`, `win32-x64`                                                                                             |
| 30  | CI native trigger           | Main branch only. PR pipeline validates JS bin builds only                                                                                                                                                                  |
| 31  | Native artifact destination | GitHub Releases attached to the auto-tagged versions from the existing ci-main.yml publish flow                                                                                                                             |
| 32  | CI workflow shape           | Reusable `_lib-native.yml` template + per-lib `ci-lib-<name>-native.yml` caller                                                                                                                                             |
| 33  | Test depth                  | 100% coverage on every primitive                                                                                                                                                                                            |
| 34  | Integration tests           | None at builder level. Wrapper's libs continuing to build successfully is the integration coverage                                                                                                                          |
| 35  | Behavioral parity           | Manual diff during the migration PR. No permanent CI parity assertion                                                                                                                                                       |
| 36  | Plan format                 | Per implementation-plans skill                                                                                                                                                                                              |
| 37  | Doc deliverables            | README + JSDoc per skills up-front. ARCHITECTURE.md deferred to release-time on user request                                                                                                                                |

### Minor scaffolding choices (proposed; revisit during PR review)

- **Builder CLI bin name:** single bin `hf-build` declared at `src/bin/hf-build.ts`.
- **Initial preset list:** `byPrefix(scope)`, `byNames(names[])` only. Future presets (`standardLibrary`, `shellPackage`) added when their consumers exist.
- **Runtime config validation:** none. TypeScript types are the contract.

---

## Sub-path Layout

```
@hyperfrontend/builder
├── .                       facade: build(config) runner + key types
├── ./models                all type definitions
├── ./bundle                facade for bundling subdomain
├── ./bundle/entries        entry-point discovery primitives
├── ./bundle/externals      externals resolution primitives
├── ./bundle/rollup         rollup driver primitives + plugin factories
├── ./bundle/declarations   tsc-driven .d.ts emission + flatten
├── ./package               facade for package output subdomain
├── ./package/json          package.json synthesis + exports field generation + inheritance + filter
├── ./package/assets        generic copyAssets primitive
├── ./package/licenses      third-party license collection (opt-in preset)
├── ./bin                   facade for bin output subdomain
├── ./bin/script            JS bin synthesis (shebang, bootstrap, chmod, cjs/esm)
├── ./bin/native            Node SEA native binary per platform (postject)
├── ./presets               byPrefix, byNames, future preset factories
└── ./memory                opt-in memory monitor + thresholds
```

---

## Dependency Surface

Allowed runtime/dev dependencies (hard constraint):

| Dependency                           | Role                                                 |
| ------------------------------------ | ---------------------------------------------------- |
| `@hyperfrontend/logging`             | Logging substrate (extended in Phase 1)              |
| `@hyperfrontend/project-scope`       | File/path/glob/walk substrate                        |
| `@hyperfrontend/immutable-api-utils` | Safe builtins per coding skill                       |
| `@hyperfrontend/json-utils`          | (Optional, only if a future config-validation lands) |
| `rollup`                             | Bundler                                              |
| `@rollup/plugin-commonjs`            | CJS interop for rollup                               |
| `@rollup/plugin-json`                | JSON imports for rollup                              |
| `@rollup/plugin-node-resolve`        | Node resolution for rollup                           |
| `@rollup/plugin-terser`              | Minification for IIFE/UMD                            |
| `@rollup/plugin-typescript`          | TypeScript transpilation in rollup                   |
| `typescript`                         | `tsc` invocation for declaration emission            |
| `postject`                           | Node SEA blob injection (third allowed external)     |
| `node:*` builtins                    | I/O ops not covered by project-scope                 |

**Banned:** `@nx/devkit`, `glob`, `minimatch`, any other external runtime dep.

---

## Phase 1 — Foundation: extend `@hyperfrontend/logging`

Promote `channel`, `timed`, `timedAsync` from the executor's local `BuildLogger` into lib-logging itself. Builder primitives (and any other consumer) get them natively.

**Files to modify:**

- `libs/logging/src/create-logger.ts` — extend `Logger` type with `channel`, `timed`, `timedAsync`; implement them in the factory
- `libs/logging/src/create-logger.spec.ts` — add 100% coverage for the three new methods
- `libs/logging/src/index.ts` — re-export updated types
- `libs/logging/package.json` — bump version (minor: feature addition)
- `libs/logging/README.md` — document new methods per readme-docs skill

**Method signatures:**

```typescript
interface Logger {
  // ... existing methods
  /** Returns a sub-logger that prepends `[prefix]` to every message. */
  channel(prefix: string): Logger
  /** Wraps a sync call with timing. Logs completion or failure with elapsed ms. */
  timed<T>(label: string, fn: () => T): T
  /** Wraps a promise-returning call with timing. Dumps stack trace on error to debug log. */
  timedAsync<T>(label: string, fn: () => Promise<T>): Promise<T>
}
```

**Verification:**

```bash
npx nx test lib-logging
npx nx lint lib-logging --fix
npx nx typecheck lib-logging
npx nx format:write --projects=lib-logging
```

---

## Phase 2 — Scaffold `libs/builder`

Generate the publishable library shell.

**Generator command:**

```bash
nx generate @hyperfrontend/package:library \
  --name=builder \
  --type=util \
  --description="Composable, vendor-neutral build toolkit for TypeScript libraries, JS bins, and Node SEA native binaries." \
  --publishable
```

**Files to verify after generation:**

- `libs/builder/package.json` — name `@hyperfrontend/builder`, version `0.0.0`, license MIT, sideEffects false, engines, keywords, exports map (placeholder)
- `libs/builder/project.json` — name `lib-builder`, tags `['type:util','scope:public']`, build target uses `@hyperfrontend/package:build`, version + version-check + publish targets
- `libs/builder/tsconfig.json`, `tsconfig.lib.json`, `tsconfig.spec.json` — standard
- `libs/builder/eslint.config.cjs`, `jest.config.ts` — standard
- `libs/builder/README.md` — standard sections per readme-docs skill
- `libs/builder/src/index.ts` — `@module` JSDoc header, empty re-exports

**Files to create:**

- `libs/builder/CHANGELOG.md` — initial Keep-a-Changelog skeleton

**Files to modify:**

- `tsconfig.base.json` — add `"@hyperfrontend/builder": ["libs/builder/src/index.ts"]` path

**Add deps to `libs/builder/package.json`:**

```json
{
  "dependencies": {
    "@hyperfrontend/logging": "<current>",
    "@hyperfrontend/project-scope": "<current>",
    "@hyperfrontend/immutable-api-utils": "<current>",
    "rollup": "<current>",
    "@rollup/plugin-commonjs": "<current>",
    "@rollup/plugin-json": "<current>",
    "@rollup/plugin-node-resolve": "<current>",
    "@rollup/plugin-terser": "<current>",
    "@rollup/plugin-typescript": "<current>",
    "typescript": "<current>",
    "postject": "<current>"
  }
}
```

**Verification:**

```bash
npx nx lint lib-builder --fix
npx nx typecheck lib-builder
npx nx format:write --projects=lib-builder
```

---

## Phase 3 — Models and Memory

Type definitions (no implementation logic) plus the opt-in memory monitor with always-on `recover()` utility.

**Files to create:**

- `libs/builder/src/models/index.ts` — `@module` header, re-exports
- `libs/builder/src/models/build-config.ts` — `BuildConfig`, `EsmConfig`, `CjsConfig`, `IifeConfig`, `UmdConfig`, `BinConfig`, `SeaConfig`, `AssetSpec`, `InheritFromSpec`
- `libs/builder/src/models/entry-point.ts` — `EntryPoint`, `EntryPointDiscovery`, `EntryPointCategory`
- `libs/builder/src/models/format-output.ts` — `FormatOutputs`, `IifeOutput`, `UmdOutput`
- `libs/builder/src/models/package-json.ts` — `PackageJson`, `ConditionalExport`, `ExportValue`, `RepositoryField`, `BugsField`, `AuthorField`, `FundingField`
- `libs/builder/src/models/build-context.ts` — `BuildContext` (computed paths + resolved settings, no Nx context)
- `libs/builder/src/models/build-result.ts` — `BuildResult` (success + per-format counts + timing)
- `libs/builder/src/memory/index.ts` — `@module` header
- `libs/builder/src/memory/recover.ts` — always-on `recover()` (yield to event loop, optional GC if `--expose-gc`)
- `libs/builder/src/memory/recover.spec.ts` — 100% coverage
- `libs/builder/src/memory/monitor.ts` — `createMemoryMonitor(opts?)` factory; `MemorySnapshot`, `MemoryMonitorOptions` (warningMB, criticalMB, growthMB)
- `libs/builder/src/memory/monitor.spec.ts` — 100% coverage

**Files to modify:**

- `libs/builder/src/index.ts` — re-export models
- `libs/builder/package.json` — add `./models` and `./memory` exports
- `tsconfig.base.json` — add path mappings for both subpaths

**Verification:**

```bash
npx nx test lib-builder
npx nx lint lib-builder --fix
npx nx typecheck lib-builder
```

---

## Phase 4 — Bundle subdomain

Entry-point discovery, externals resolution (predicate-based), per-format Rollup configuration factories, and tsc-driven declaration generation. Replaces `minimatch` with `matchGlobPattern` from project-scope and `glob` with `walkDirectory`/`findFilesInTree`.

**Files to create:**

- `libs/builder/src/bundle/index.ts` — `@module` header; re-exports a `runBundlePhase(ctx, config)` orchestrator
- `libs/builder/src/bundle/entries/index.ts` — `@module` header
- `libs/builder/src/bundle/entries/discover-entries.ts` — `discoverEntries(projectRoot)` (current `discoverEntryPoints` ported, `node:fs` via project-scope where possible)
- `libs/builder/src/bundle/entries/resolve-entries.ts` — `resolveEntries(config, discovered)` using `matchGlobPattern`
- `libs/builder/src/bundle/entries/by-platform.ts` — `getEntriesByPlatform`, `getSharedEntries`
- `libs/builder/src/bundle/entries/*.spec.ts` — 100% coverage
- `libs/builder/src/bundle/externals/index.ts` — `@module` header
- `libs/builder/src/bundle/externals/resolve-externals.ts` — `resolveExternals({ packageJsonPath, additional, isWorkspacePackage, bundleWorkspaceDeps })`. Returns `string[]`
- `libs/builder/src/bundle/externals/external-fn.ts` — `createExternalFn(externals)`, `createBundleExternalFn(externals?)`
- `libs/builder/src/bundle/externals/validate-globals.ts` — `validateExternalsConfig(externals, globals)` (throws on missing globals)
- `libs/builder/src/bundle/externals/*.spec.ts` — 100% coverage
- `libs/builder/src/bundle/rollup/index.ts` — `@module` header
- `libs/builder/src/bundle/rollup/plugins.ts` — `createNodeResolvePlugin(opts)`, `createBrowserNodeResolvePlugin()`, `createCommonJsPlugin()`, `createTypescriptPlugin(opts)`, `createBundleTypescriptPlugin(opts)`, `createJsonPlugin()`, `createTerserPlugin()`
- `libs/builder/src/bundle/rollup/config-esm.ts` — `createEsmEntryConfig(entry, config, ctx)` + `createEsmConfig(...)`
- `libs/builder/src/bundle/rollup/config-cjs.ts` — same shape for CJS
- `libs/builder/src/bundle/rollup/config-iife.ts` — same shape for IIFE
- `libs/builder/src/bundle/rollup/config-umd.ts` — same shape for UMD
- `libs/builder/src/bundle/rollup/execute.ts` — `executeRollup(config, label)` (creates bundle, writes outputs, closes, clears refs)
- `libs/builder/src/bundle/rollup/*.spec.ts` — 100% coverage
- `libs/builder/src/bundle/declarations/index.ts` — `@module` header
- `libs/builder/src/bundle/declarations/generate-declarations.ts` — `generateDeclarations(ctx, discovery)` (spawns `tsc`)
- `libs/builder/src/bundle/declarations/flatten-paths.ts` — `flattenDeclarationPaths(ctx, discovery)`
- `libs/builder/src/bundle/declarations/*.spec.ts` — 100% coverage

**Files to modify:**

- `libs/builder/src/index.ts` — re-export bundle facade
- `libs/builder/package.json` — add `./bundle`, `./bundle/entries`, `./bundle/externals`, `./bundle/rollup`, `./bundle/declarations` exports
- `tsconfig.base.json` — add path mappings for each subpath

**Project-scope usage notes:**

- Pattern matching: `matchGlobPattern` for entry-pattern matching; verify behavior matches minimatch for the patterns we use (`./browser/*`, `./browser/v1`)
- File walks: `walkDirectory` / `findFilesInTree` for asset glob (used by Phase 5)
- Path ops: `join`, `joinPosix`, `relativePath`, `parsePath` everywhere — never `node:path` directly when project-scope has the equivalent

**Verification:**

```bash
npx nx test lib-builder
npx nx lint lib-builder --fix
npx nx typecheck lib-builder
```

---

## Phase 5 — Package subdomain

`package.json` synthesis (with configurable inheritance + opt-in workspace-dep filter), generic asset copy, and opt-in third-party license collection.

**Files to create:**

- `libs/builder/src/package/index.ts` — `@module` header; orchestrator `runPackagePhase(ctx, config, formatOutputs)`
- `libs/builder/src/package/json/index.ts` — `@module` header
- `libs/builder/src/package/json/read-package-json.ts` — `readProjectPackageJson(projectRoot)` via project-scope's `readJsonFile`
- `libs/builder/src/package/json/inherit-fields.ts` — `inheritFields(target, { from, fields })` (no-op if `from` not provided)
- `libs/builder/src/package/json/filter-deps.ts` — `filterWorkspaceDepsFromOutput(pkg, isWorkspacePackage)` (opt-in caller)
- `libs/builder/src/package/json/generate-exports.ts` — `generateExportsFromFormats(discovery, formatOutputs, srcPkg)` (existing logic, source-exports-first strategy preserved)
- `libs/builder/src/package/json/cdn-paths.ts` — `getCdnPaths(formatOutputs, opts)` (unpkg/jsdelivr resolution)
- `libs/builder/src/package/json/synthesize.ts` — `synthesizePackageJson(srcPkg, ctx, formatOutputs, opts)` — main facade combining all of the above
- `libs/builder/src/package/json/write.ts` — `writeOutputPackageJson(outputPath, packageJson)` via project-scope's `writeJsonFile`
- `libs/builder/src/package/json/*.spec.ts` — 100% coverage
- `libs/builder/src/package/assets/index.ts` — `@module` header
- `libs/builder/src/package/assets/copy-assets.ts` — `copyAssets(specs)` accepting `AssetSpec[]` where `AssetSpec = { from: string, to: string, files?: string[], glob?: string, condition?: (pkg) => boolean }`. Uses project-scope's `walkDirectory`/`findFilesInTree` for glob, `copyFileSync` from `node:fs` for the actual copy
- `libs/builder/src/package/assets/*.spec.ts` — 100% coverage
- `libs/builder/src/package/licenses/index.ts` — `@module` header
- `libs/builder/src/package/licenses/collect.ts` — `collectThirdPartyLicenses(projectRoot, workspaceRoot, externals)` returning `ThirdPartyLicenseEntry[]`. Uses `parseRepositoryUrl` from `@hyperfrontend/versioning/repository/parse` (existing dep, OK)
- `libs/builder/src/package/licenses/generate-content.ts` — `generateThirdPartyLicensesContent(entries)` returning markdown string
- `libs/builder/src/package/licenses/write.ts` — `writeThirdPartyLicensesFile(outputPath, content)`
- `libs/builder/src/package/licenses/*.spec.ts` — 100% coverage

**Note on `@hyperfrontend/versioning`:** the license collector imports `parseRepositoryUrl` from versioning. This becomes a new runtime dep of builder. Add to `libs/builder/package.json`. Versioning currently depends on logging + project-scope + immutable-api-utils + json-utils + questions — no circular import risk.

**Files to modify:**

- `libs/builder/src/index.ts` — re-export package facade
- `libs/builder/package.json` — add subpath exports + new dep on `@hyperfrontend/versioning`
- `tsconfig.base.json` — add path mappings

**Verification:**

```bash
npx nx test lib-builder
npx nx lint lib-builder --fix
npx nx typecheck lib-builder
```

---

## Phase 6 — Bin subdomain (JS)

JS bin synthesis: rollup-bundle the source, prepend shebang, append the bootstrap footer (default or per-bin override), chmod 0o755. Per-bin format `cjs`/`esm`/array supported.

**Files to create:**

- `libs/builder/src/bin/index.ts` — `@module` header; orchestrator `runBinPhase(ctx, bins)`
- `libs/builder/src/bin/script/index.ts` — `@module` header
- `libs/builder/src/bin/script/build-bin.ts` — `buildJsBin(bin, ctx)` — rollup-bundles `src/bin/<name>.ts`, applies shebang + bootstrap footer per format, chmods. Returns `{ name, format, outputPath }[]`
- `libs/builder/src/bin/script/bootstrap-footer.ts` — `defaultBootstrap({ runner, format })` returning the standard footer string
- `libs/builder/src/bin/script/wire-package-bin.ts` — `wireBinFieldInPackageJson(pkg, binOutputs)` mutates `pkg.bin` to map name → relative path
- `libs/builder/src/bin/script/*.spec.ts` — 100% coverage

**Bootstrap footer template (default):**

```javascript
__RUNNER__({ argv: process.argv.slice(2), cwd: process.cwd(), stderr: process.stderr, stdout: process.stdout }).then(
  (code) => {
    process.exit(code)
  },
  (error) => {
    process.stderr.write((error instanceof Error ? error.message : String(error)) + '\n')
    process.exit(1)
  }
)
```

`__RUNNER__` substituted with the runner export name (default: `(await import('...')).default`; if `runner: 'name'` provided, that name).

**Output naming convention:**

- CJS: `dist/.../bin/<name>.cjs.js` (or `<name>.js` if only CJS declared)
- ESM: `dist/.../bin/<name>.mjs`
- `package.json#bin` maps `<name>` → first available output (CJS preferred for compat)

**Files to modify:**

- `libs/builder/src/index.ts` — re-export bin facade
- `libs/builder/package.json` — add `./bin`, `./bin/script` exports
- `tsconfig.base.json` — add path mappings

**Verification:**

```bash
npx nx test lib-builder
npx nx lint lib-builder --fix
npx nx typecheck lib-builder
```

---

## Phase 7 — Bin subdomain (Node SEA)

Node SEA wrapping. Bundles to single CJS, generates SEA config, runs `node --experimental-sea-config`, copies the current-platform Node host binary, injects the blob via postject, signs as needed. Skips silently with info log if `process.platform`/`arch` doesn't match declared targets.

**Files to create:**

- `libs/builder/src/bin/native/index.ts` — `@module` header
- `libs/builder/src/bin/native/build-native.ts` — `buildNativeBin(bin, ctx)` orchestrator
- `libs/builder/src/bin/native/sea-config.ts` — `generateSeaConfig({ mainPath, outputPath })` returns the SEA config JSON
- `libs/builder/src/bin/native/sea-blob.ts` — `generateSeaBlob(seaConfigPath)` — spawns `node --experimental-sea-config <path>`, returns blob path
- `libs/builder/src/bin/native/host-binary.ts` — `resolveHostBinary(platform, arch)` returns path to a usable Node host (default: `process.execPath`; future: per-target downloads)
- `libs/builder/src/bin/native/inject.ts` — `injectBlob(hostBinary, outputBinary, blobPath)` calls postject's JS API
- `libs/builder/src/bin/native/codesign.ts` — `removeCodesign(binary)` (macOS) and `applyCodesign(binary, opts?)` (macOS/Windows). MVP: removes existing macOS signature; re-signing left to release tooling
- `libs/builder/src/bin/native/platform-check.ts` — `currentPlatformMatches(declaredPlatforms)` — returns true if `<process.platform>-<process.arch>` is in the list
- `libs/builder/src/bin/native/*.spec.ts` — 100% coverage. Tests stub postject and node-spawn — actual binary production validated through CI matrix in Phase 12

**SEA config shape produced (per Node docs):**

```json
{
  "main": "<path>/<bin>.cjs.js",
  "output": "<path>/sea-prep.blob",
  "disableExperimentalSEAWarning": true
}
```

**Output naming convention:**

- `dist/.../bin/<name>.<platform>-<arch>` (e.g., `hf-build.linux-x64`, `hf-build.darwin-arm64`)
- Windows: `<name>.<platform>-<arch>.exe`

**Constraint enforcement:**

- If a bin declares `sea` but is not built in CJS, `buildNativeBin` errors with: "SEA requires a CJS bin output; declare format: ['cjs'] or format: 'cjs' on bin <name>".

**Files to modify:**

- `libs/builder/src/index.ts` — re-export native facade
- `libs/builder/package.json` — add `./bin/native` export, add `postject` dep
- `tsconfig.base.json` — add path mapping

**Verification:**

```bash
npx nx test lib-builder
npx nx lint lib-builder --fix
npx nx typecheck lib-builder
```

---

## Phase 8 — Presets and the `build()` Facade

Predicate factories (`byPrefix`, `byNames`) and the single `build(config)` runner that orchestrates bundle → package → bin phases.

**Files to create:**

- `libs/builder/src/presets/index.ts` — `@module` header
- `libs/builder/src/presets/by-prefix.ts` — `byPrefix(scope: string): (name: string) => boolean`
- `libs/builder/src/presets/by-names.ts` — `byNames(names: string[]): (name: string) => boolean`
- `libs/builder/src/presets/*.spec.ts` — 100% coverage
- `libs/builder/src/build.ts` — `build(config: BuildConfig): Promise<BuildResult>` — the facade. Resolves context, optionally creates memory monitor, runs bundle phase, runs package phase, runs bin phase, returns result
- `libs/builder/src/build.spec.ts` — 100% coverage (mock subdomain orchestrators; verify call order, context propagation, error handling, monitor lifecycle)

**Facade orchestration outline:**

```typescript
export async function build(config: BuildConfig): Promise<BuildResult> {
  const ctx = createBuildContext(config)
  const monitor = config.memoryMonitor
    ? createMemoryMonitor(typeof config.memoryMonitor === 'object' ? config.memoryMonitor : undefined)
    : undefined
  monitor?.logDebug('build:start')
  try {
    const formatOutputs = await runBundlePhase(ctx, config, monitor)
    await runPackagePhase(ctx, config, formatOutputs)
    const binOutputs = await runBinPhase(ctx, config.bin ?? [], monitor)
    monitor?.logSummary()
    return { success: true, formatOutputs, binOutputs, durationMs: ctx.elapsed() }
  } catch (error) {
    monitor?.logSummary()
    throw error
  }
}
```

**Files to modify:**

- `libs/builder/src/index.ts` — re-export `build`, key types, and presets
- `libs/builder/package.json` — add `./presets` export; ensure `.` exports `build`
- `tsconfig.base.json` — add path mapping for `./presets`

**Verification:**

```bash
npx nx test lib-builder
npx nx lint lib-builder --fix
npx nx typecheck lib-builder
npx nx build lib-builder    # first dogfood: lib-builder builds itself via the existing wrapper
```

The `nx build lib-builder` step exercises the facade via the wrapper. At this point the wrapper still uses its old inline pipeline; this just confirms `lib-builder`'s own source produces a valid dist. The wrapper retrofit happens in Phase 10.

---

## Phase 9 — Builder's own CLI bin

The `hf-build` CLI: a runner that reads a config file (`builder.config.json` or similar) or accepts CLI flags, and calls `build()`.

**Files to create:**

- `libs/builder/src/bin/hf-build.ts` — exports `runHfBuild(io: { argv, cwd, stderr, stdout? }): Promise<number>`. Parses argv, loads config from `cwd/builder.config.json` (or `--config <path>`), calls `build(config)`, returns 0 on success / 1 on failure
- `libs/builder/src/bin/hf-build.spec.ts` — 100% coverage (mock `build`, verify argv parsing, config loading, exit code mapping, error formatting)

**Files to modify:**

- `libs/builder/project.json` — add bin block to the build target options:

  ```json
  "bin": [
    {
      "name": "hf-build",
      "format": ["cjs"],
      "sea": {
        "platforms": ["linux-x64", "linux-arm64", "darwin-x64", "darwin-arm64", "win32-x64"]
      }
    }
  ]
  ```

  Builder source is the runner export; default-export the function from `src/bin/hf-build.ts`.

- `libs/builder/package.json` — `bin` field will be auto-wired by builder during build to `{ "hf-build": "./bin/hf-build.cjs.js" }`. Source package.json can declare a placeholder; the build overwrites it for the published package.

**Note:** at this point `nx build lib-builder` exercises both the library output and the bin pipeline. The `hf-build.cjs.js` artifact lands at `dist/libs/builder/bin/hf-build.cjs.js` with shebang + chmod. Native binaries only emit on the appropriate CI runner per Phase 12.

**Verification:**

```bash
npx nx test lib-builder
npx nx lint lib-builder --fix
npx nx typecheck lib-builder
npx nx build lib-builder
node dist/libs/builder/bin/hf-build.cjs.js --help    # smoke test
```

---

## Phase 10 — Wrapper retrofit

Replace `tools/package/src/executors/build/executor.ts` and supporting `lib/` with a thin facade caller. The schema mirrors builder's `BuildConfig` minus the monorepo-specific knobs (which are hardcoded in the wrapper).

**Files to delete:**

- `tools/package/src/executors/build/lib/` (entire directory: `assets.ts`, `config-cjs.ts`, `config-esm.ts`, `config-iife.ts`, `config-umd.ts`, `declarations.ts`, `entry-resolver.ts`, `externals.ts`, `index.ts`, `logger.ts`, `package-json.ts`, `paths.ts`, `rollup-plugins.ts`, `types.ts`)

**Files to create:**

- `tools/package/src/executors/build/wrapper-config.ts` — exports the monorepo constants:
  - `WORKSPACE_SCOPE = '@hyperfrontend/'`
  - `INHERITABLE_FIELDS = ['repository', 'bugs', 'homepage', 'author']`
  - `DEFAULT_PROJECT_ASSETS = ['README.md', 'CHANGELOG.md', 'ARCHITECTURE.md']`
  - `DEFAULT_WORKSPACE_ASSETS = ['LICENSE.md', 'SECURITY.md']`
  - `FUNDING_ASSET = 'FUNDING.md'` (conditional on `pkg.funding`)
  - `MEMORY_THRESHOLDS = { warningMB: 512, criticalMB: 768, growthMB: 50 }`

**Files to modify:**

- `tools/package/src/executors/build/executor.ts` — rewrite to ~50 lines:
  1. Resolve `projectRoot`, `workspaceRoot` from Nx `ExecutorContext`
  2. Build a `BuildConfig` object: spread the schema-validated executor options + inject:
     - `isWorkspacePackage: byPrefix(WORKSPACE_SCOPE)`
     - `bundleWorkspaceDeps: per-format from options`
     - `filterWorkspaceDepsFromOutput: true`
     - `inheritFieldsFrom: { from: <workspaceRoot>/package.json, fields: INHERITABLE_FIELDS }`
     - `assets: [{ from: projectRoot, files: DEFAULT_PROJECT_ASSETS }, { from: workspaceRoot, files: DEFAULT_WORKSPACE_ASSETS }, { from: workspaceRoot, files: [FUNDING_ASSET], condition: pkg => Boolean(pkg.funding) }, ...options.assets]`
     - `thirdPartyLicenses: true`
     - `memoryMonitor: MEMORY_THRESHOLDS`
  3. `await build(config)`, return `{ success: true }` or log + `{ success: false }`

- `tools/package/src/executors/build/schema.json` — update to mirror builder's `BuildConfig` minus the monorepo knobs. Add `bin` property (array of bin descriptors per Q12).
- `tools/package/package.json` — replace dev deps: drop `@nx/devkit`, `@hyperfrontend/logging` (still indirect), `@hyperfrontend/versioning` (still indirect), rollup family. Add runtime dep on `@hyperfrontend/builder`. Keep `@nx/devkit` only if Nx executor entry signature requires it (it does for `ExecutorContext` type — keep in devDependencies).
- `tools/package/src/executors/build/README.md` — update to reflect new schema (additions: `bin`; removals: none — the format-centric API is preserved 1:1)

**Behavioral parity check (manual, during PR):**

For each currently-publishable lib (`lib-cryptography`, `lib-data-utils`, `lib-function-utils`, `lib-immutable-api-utils`, `lib-json-utils`, `lib-list-utils`, `lib-logging`, `lib-network-protocol`, `lib-nexus`, `lib-project-scope`, `lib-questions`, `lib-random-generator-utils`, `lib-state-machine`, `lib-string-utils`, `lib-time-utils`, `lib-ui-utils`, `lib-versioning`, `lib-web-worker`):

1. On `main` (pre-PR) baseline: `nx build <project>` → snapshot `dist/libs/<lib>/` tree
2. On the PR branch: `nx build <project>` → diff against snapshot
3. Acceptable differences: ordering of keys in `package.json`, comment whitespace in generated files. Anything else investigated and either fixed or documented.

**Verification:**

```bash
npx nx test tool-package
npx nx lint tool-package --fix
npx nx typecheck tool-package
npx nx build lib-builder       # builder rebuilds via the new wrapper
npx nx build lib-logging       # representative dependent lib still builds correctly
```

---

## Phase 11 — lib-versioning bin migration

Delete the hand-rolled rollup script; declare the cz/cl bins in `project.json` so the wrapper's bin pipeline produces them.

**Files to delete:**

- `libs/versioning/scripts/build-bins.mjs`
- `libs/versioning/scripts/` (if now empty)

**Files to modify:**

- `libs/versioning/project.json` — under build target options:

  ```json
  "bin": [
    { "name": "cz", "runner": "runCz", "format": "cjs" },
    { "name": "cl", "runner": "runCl", "format": "cjs" }
  ]
  ```

  Remove any post-step or chained target that invoked `build-bins.mjs`.

- `libs/versioning/src/bin/cz.ts` — verify it exports `runCz` matching the `(io: { argv, cwd, stderr }) => Promise<number>` contract. (Already does per the existing bootstrap footer.)
- `libs/versioning/src/bin/cl.ts` — same verification for `runCl`.
- `libs/versioning/package.json` — leave `bin` field as is (`{ "cz": "./bin/cz.js", "cl": "./bin/cl.js" }`); builder's auto-wire will overwrite in dist with the same shape.

**Verification:**

```bash
npx nx test lib-versioning
npx nx lint lib-versioning --fix
npx nx typecheck lib-versioning
npx nx build lib-versioning
node dist/libs/versioning/bin/cz.js --help
node dist/libs/versioning/bin/cl.js --help
```

The bin smoke tests confirm the cz/cl behavior matches the prior hand-rolled output.

---

## Phase 12 — CI workflows

Per-library CI workflow + new reusable native template + per-library native caller. Leverages existing patterns from `_lib-ci.yml`.

**Files to create:**

- `.github/workflows/_lib-native.yml` — reusable workflow callable by any lib that produces native bins. Inputs: `project-name`, `bin-name`, `platforms` (JSON array). Matrix runs the build per-platform on the matching runner; uploads each binary as a workflow artifact + (on a release-tag run) attaches to the GitHub Release.

  Runner mapping:
  | Declared platform | GitHub runner |
  | ----------------- | ------------------------ |
  | `linux-x64` | `ubuntu-latest` |
  | `linux-arm64` | `ubuntu-24.04-arm` (or `ubuntu-latest` with QEMU if arm runner unavailable) |
  | `darwin-x64` | `macos-13` |
  | `darwin-arm64` | `macos-latest` |
  | `win32-x64` | `windows-latest` |

- `.github/workflows/ci-lib-builder.yml` — calls `_lib-ci.yml` (typecheck/build/test/coverage). Triggered on PR + main. Created/scaffolded by `make-publishable` generator if available; manual otherwise.
- `.github/workflows/ci-lib-builder-native.yml` — calls `_lib-native.yml` with `project-name: lib-builder`, `bin-name: hf-build`, all five platforms. Triggered on push to `main` only. On a published version tag, the same job re-runs and attaches binaries to the matching GitHub Release.

**Files to modify (per library-ci-workflows skill manual steps):**

- `.github/workflows/ci-libraries.yml` — add path filter for `libs/builder/**` and matrix entry `add_if_changed "${{ steps.filter.outputs.builder }}" "lib-builder" "libs/builder" "builder"`
- `.github/workflows/ci-main.yml` — add `"builder:libs/builder"` entry in the LIBS coverage array
- `.github/workflows/ci-main.yml` — extend the publish/tag flow to also invoke `ci-lib-builder-native.yml` after a successful publish step (so a new version tag triggers the native artifact attach)

**Verification:**

```bash
# Local lint of workflow YAML (if workflow linter is configured)
npx nx lint tool-eslint-rules --fix

# Confirm path filter wires up by pushing a no-op change to libs/builder/ and checking only ci-lib-builder runs
```

---

## Phase 13 — Publishable scaffolding & docs

Standard `make-publishable` follow-up: documentation deliverables (per readme-docs / jsdoc-examples), root README + docs-site entries, library compatibility table, E2E project.

**Files to verify (auto-created or pre-existing):**

- `libs/builder/README.md` — completed per readme-docs skill (title, badges, description, features, install, quickstart, sub-paths, examples, contributing, license sections)
- All exported members in `libs/builder/src/**` carry `@param`, `@returns`, and at least one `@example` block per jsdoc-examples skill
- `libs/builder-e2e/` — E2E project verifying ESM, CJS, IIFE, UMD outputs work (per library-e2e-setup skill); also verifies the JS bin (`hf-build`) is invokable post-install

**Files to modify (per library-generators make-publishable manual steps):**

- `README.md` (root) — add row for `@hyperfrontend/builder` in the Main Packages table
- `apps/docs-site/scripts/generate-docs.ts` — add `'builder'` entry to the LIBRARIES array
- `apps/docs-site/src/lib/content.ts` — add LIBRARIES entry:

  ```typescript
  {
    name: 'Builder',
    packageName: '@hyperfrontend/builder',
    slug: 'builder',
    readmePath: 'libs/builder/README.md',
    entryPoints: ['libs/builder/src/index.ts'],
    category: 'core',
  },
  ```

- `apps/docs-site/src/app/docs/libraries/builder/page.tsx` — page route per the docs-site template
- `LIBRARY_COMPATIBILITY.md` — add a row recording the cross-package dep compatibility (builder depends on logging, project-scope, immutable-api-utils, versioning)

**ARCHITECTURE.md:** deferred to release-time per user request — to be written before the first published release of `@hyperfrontend/builder`, capturing data flow (config → discover → externals → rollup → dts → package.json → assets → bins → SEA), the subpath layout, and the predicate-based extension model.

**Verification:**

```bash
npx nx test lib-builder
npx nx lint lib-builder --fix
npx nx typecheck lib-builder
npx nx test lib-builder-e2e
npx nx lint lib-builder-e2e --fix
npx nx build docs-site
npx nx lint docs-site --fix
```
