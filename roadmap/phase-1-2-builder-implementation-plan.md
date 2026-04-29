# `@hyperfrontend/builder` Implementation Plan

**Status:** In Progress — Phases 1–9 complete; Phase 10 next (with carry-over from Phase 9)
**Date:** 2026-04-27 (last updated: 2026-04-29)
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

### Minor scaffolding choices

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

## Completed Phases

| Phase | Title                                       | Status                                | Notes                                                                                                                                                            |
| ----- | ------------------------------------------- | ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | Foundation: extend `@hyperfrontend/logging` | ✅ done                               | `channel` / `timed` / `timedAsync` shipped on `Logger`. 100% coverage on the new methods.                                                                        |
| 2     | Scaffold `libs/builder`                     | ✅ done                               | Publishable shell at `libs/builder/` with `tsconfig.base.json` path mapping and the dep set above.                                                               |
| 3     | Models and Memory                           | ✅ done                               | All type definitions in `src/models/`. `recover()` always-on; `createMemoryMonitor()` opt-in with `warningMB` / `criticalMB` / `growthMB`.                       |
| 4     | Bundle subdomain                            | ✅ done                               | Entries / externals / rollup driver / declarations under `src/bundle/`. Uses project-scope's `matchGlobPattern` and `walkDirectory`; no minimatch/glob.          |
| 5     | Package subdomain                           | ✅ done                               | `synthesizePackageJson`, `inheritFields`, `filterWorkspaceDepsFromOutput`, `copyAssets`, third-party license collector. Adds dep on `@hyperfrontend/versioning`. |
| 6     | Bin subdomain (JS)                          | ✅ done                               | `buildJsBin`, `defaultBootstrap`, `wireBinFieldInPackageJson`. CJS preferred over ESM when both formats produced for the same bin name.                          |
| 7     | Bin subdomain (Node SEA)                    | ✅ done                               | `buildNativeBin` + `sea-config` / `sea-blob` / `host-binary` / `inject` / `codesign` / `platform-check`. SEA requires a CJS bin output.                          |
| 8     | Presets and `build()` Facade                | ✅ done                               | `byPrefix(scope)` / `byNames(names)` predicates. `build(config)` orchestrates bundle → package → bin and threads the optional memory monitor.                    |
| 9     | Builder's own CLI bin                       | ✅ done (with carry-over — see below) | `src/bin/hf-build.ts` + spec (100% coverage). `project.json` declares `hf-build` bin with all five SEA platforms.                                                |

---

## Carry-over from Phase 9 — resolve before / during Phase 10

Two items surfaced when adding the bin block to `libs/builder/project.json` and could not land cleanly inside Phase 9. Pick these up at the start of Phase 10:

### 1. Custom workspace ESLint rules misread nested `name` keys

`workspace/lib-e2e-project-required` ([tools/eslint-rules/src/rules/lib-e2e-project-required.ts](../tools/eslint-rules/src/rules/lib-e2e-project-required.ts)) and `workspace/lib-project-metadata` ([tools/eslint-rules/src/rules/lib-project-metadata.ts](../tools/eslint-rules/src/rules/lib-project-metadata.ts)) both walk every `JSONProperty` and overwrite the tracked top-level `name` whenever they see a key called `name`. The new `"name": "hf-build"` nested inside `targets.build.options.bin[0]` makes them think the project is named `hf-build`, producing:

- `Publishable library 'hf-build' is missing a corresponding e2e project. Expected: apps/package-e2e/hf-build/project.json`
- `Publishable library project.json 'name' must start with 'lib-' prefix`

**Fix:** narrow each rule's visitor to top-level properties (e.g., guard on `node.parent?.parent?.type === 'JSONExpressionStatement'` before reading the value as the project name). Add regression tests with a nested `name` to both spec files. Verify with `npx nx test tool-eslint-rules` and `npx nx lint lib-builder`.

### 2. Wrapper executor schema does not yet accept `bin`

[tools/package/src/executors/build/schema.json](../tools/package/src/executors/build/schema.json) has no `bin` property and the executor itself ([tools/package/src/executors/build/executor.ts](../tools/package/src/executors/build/executor.ts)) does not call into `runBinPhase`. So even with the lint fixed, `npx nx build lib-builder` will not produce `dist/libs/builder/bin/hf-build.cjs.js` until Phase 10 lands. Phase 9's plan acknowledged this — the wrapper retrofit in Phase 10 is what closes the gap. The smoke test from Phase 9 (`node dist/libs/builder/bin/hf-build.cjs.js --help`) becomes runnable then.

---

## Phase 10 — Wrapper retrofit

Replace `tools/package/src/executors/build/executor.ts` and supporting `lib/` with a thin facade caller. The schema mirrors builder's `BuildConfig` minus the monorepo-specific knobs (which are hardcoded in the wrapper).

**Pre-work (carry-over from Phase 9):**

1. Fix the two ESLint rules described above so they only trigger on the top-level `name` property.
2. (Reminder) The `bin` property must be added to `tools/package/src/executors/build/schema.json` as part of this phase — see "Files to modify" below.

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

- `tools/package/src/executors/build/schema.json` — update to mirror builder's `BuildConfig` minus the monorepo knobs. **Add `bin` property** (array of bin descriptors per Decision #14–22). Without this the lint+build pipeline cannot validate the bin block already present in `libs/builder/project.json`.
- `tools/package/package.json` — replace dev deps: drop `@nx/devkit` (keep in devDependencies for `ExecutorContext` type), `@hyperfrontend/logging` (still indirect), `@hyperfrontend/versioning` (still indirect), rollup family. Add runtime dep on `@hyperfrontend/builder`.
- `tools/package/src/executors/build/README.md` — update to reflect new schema (additions: `bin`; removals: none — the format-centric API is preserved 1:1)

**Behavioral parity check (manual, during PR):**

For each currently-publishable lib (`lib-cryptography`, `lib-data-utils`, `lib-function-utils`, `lib-immutable-api-utils`, `lib-json-utils`, `lib-list-utils`, `lib-logging`, `lib-network-protocol`, `lib-nexus`, `lib-project-scope`, `lib-questions`, `lib-random-generator-utils`, `lib-state-machine`, `lib-string-utils`, `lib-time-utils`, `lib-ui-utils`, `lib-versioning`, `lib-web-worker`):

1. On `main` (pre-PR) baseline: `nx build <project>` → snapshot `dist/libs/<lib>/` tree
2. On the PR branch: `nx build <project>` → diff against snapshot
3. Acceptable differences: ordering of keys in `package.json`, comment whitespace in generated files. Anything else investigated and either fixed or documented.

**Verification:**

```bash
npx nx test tool-eslint-rules     # confirm the nested-name regression test added
npx nx test tool-package
npx nx lint tool-package --fix
npx nx lint lib-builder --fix     # should now pass with the rules fixed
npx nx typecheck tool-package
npx nx build lib-builder          # builder rebuilds via the new wrapper, emits hf-build.cjs.js
node dist/libs/builder/bin/hf-build.cjs.js --help    # deferred Phase 9 smoke test
npx nx build lib-logging          # representative dependent lib still builds correctly
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
