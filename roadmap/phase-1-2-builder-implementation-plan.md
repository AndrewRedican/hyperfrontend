# `@hyperfrontend/builder` Implementation Plan

**Status:** In Progress — Phases 1–10 complete; Phase 11.5 (self-containment) active; Phase 11 (lib-versioning bin migration) deferred until 11.5 lands
**Date:** 2026-04-27 (last updated: 2026-05-03)
**Parent:** [features-implementation-plan.md](./features-implementation-plan.md), Phase 1.2

---

## Context

Create `@hyperfrontend/builder`, the publishable vendor-neutral spiritual successor of [tools/package/src/executors/build/](../tools/package/src/executors/build/). It exposes composable primitives plus a single `build()` facade for library bundling (ESM/CJS/IIFE/UMD), JS bin synthesis, and Node SEA cross-platform native binaries; the existing Nx executor in `tools/package` is reduced to a thin facade caller and lib-versioning's hand-rolled `scripts/build-bins.mjs` is deleted in the same migration.

---

## Decisions Locked

| #   | Topic                       | Decision                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| --- | --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Scope                       | Library + bin (JS) + Node SEA cross-platform native binaries + features-style shell packages — all in scope                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| 2   | API model                   | No separate "library mode" vs "CLI mode" — bins are standard `package.json#bin`. Composable primitives + facades + CLI + native binary                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 3   | Shell packages              | Treated as libraries with extra inlining + pre-build code-gen seam (generator lives in `@hyperfrontend/features`, not builder)                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| 4   | Opinionation principle      | Composable primitives + opt-in presets, single big-config `build()` runner, presets replaceable                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| 5   | Sub-path layout             | Domain-grouped (~12 subpaths), lib-versioning style                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| 6   | Workspace dep awareness     | `isWorkspacePackage?: (name: string) => boolean` predicate canonical; `byPrefix(scope)` and `byNames(names[])` factories in `./presets`                                                                                                                                                                                                                                                                                                                                                                                                                         |
| 7   | Logger source               | Primitives use `logger` from `@hyperfrontend/logging` directly; no DI                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| 8   | Logger extensions           | `channel`/`timed`/`timedAsync` promoted upstream into `@hyperfrontend/logging` itself                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| 9   | I/O delegation              | Strict `@hyperfrontend/project-scope` delegation; raw `node:fs` only for genuine gaps. **No** `@nx/devkit`, **no** `glob`, **no** `minimatch` — these stay banned (we use Node APIs / our own packages instead). The tools we _do_ leverage rather than reimplement — `rollup` + `@rollup/plugin-*` + `typescript` + `postject` + `rollup-plugin-dts` — are listed in `dependencies` like any normal package the source uses; the build pipeline (JS bundling + d.ts inlining + output dep filter) makes the published artifact self-contained at install time. |
| 10  | Memory monitor              | Subpath `@hyperfrontend/builder/memory`, opt-in via config; `recover()` (event-loop yield) is always-on free utility independent of monitoring                                                                                                                                                                                                                                                                                                                                                                                                                  |
| 11  | Default assets              | Builder ships zero default-asset knowledge — generic `copyAssets({ from, to, files[], condition? })` primitive. Wrapper supplies its own asset spec lists                                                                                                                                                                                                                                                                                                                                                                                                       |
| 12  | Field inheritance           | Configurable: `inheritFieldsFrom?: { from: string; fields: string[] }`. Wrapper passes `{ from: workspaceRoot/package.json, fields: ['repository','bugs','homepage','author'] }`                                                                                                                                                                                                                                                                                                                                                                                |
| 13  | Output workspace-dep filter | Opt-in flag (`filterWorkspaceDepsFromOutput: boolean`), explicit                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| 14  | Bin source convention       | Enforced: `src/bin/<name>.ts`. Config supplies `name` only                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 15  | Bin runner export           | Default: `default` export. Override via `runner: 'name'` (preserves lib-versioning's `runCz`/`runCl`)                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| 16  | Bin runner contract         | `(io: { argv: string[], cwd: string, stderr: NodeJS.WritableStream, stdout?: NodeJS.WritableStream }) => number \| Promise<number>`                                                                                                                                                                                                                                                                                                                                                                                                                             |
| 17  | Bin format                  | Per-bin `format: 'cjs' \| 'esm' \| ('cjs' \| 'esm')[]` (required). Both supported per declaration                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| 18  | Bin bootstrap footer        | Built-in default footer + per-bin string override (`bootstrap?: string`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| 19  | Bin mechanics               | Always: chmod 0o755 + shebang `#!/usr/bin/env node`. Auto-wire JS bins to `package.json#bin`                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 20  | Node SEA injection          | `postject` is one of the bundled-tool deps (alongside rollup + typescript). Builder calls postject's JS API directly                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| 21  | Node SEA platform model     | Current-platform-only build. Per-bin `sea?: { platforms: [...] }`. Builder skips with info log if `process.platform`/`arch` not in declared targets. CI matrix orchestrates per-platform runners                                                                                                                                                                                                                                                                                                                                                                |
| 22  | Native binary wiring        | Native binaries do **not** auto-wire to `package.json#bin` — output to `dist/.../bin/<name>.<platform>-<arch>`; CI/release tooling distributes as separate artifacts                                                                                                                                                                                                                                                                                                                                                                                            |
| 23  | Wrapper invocation          | Facade-only. ~50 lines. No primitive composition                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| 24  | Wrapper lib/                | Delete entire `tools/package/src/executors/build/lib/`. Tiny `wrapper-config.ts` for monorepo constants only                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 25  | Wrapper schema              | Minimal/opinionated, mirrors builder's facade config. Monorepo opinions hardcoded                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| 26  | Migration timing            | Atomic in one PR: builder land + wrapper retrofit + lib-versioning migration                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 27  | Bootstrap                   | Builder dogfoods via wrapper. Phased commits inside the PR                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 28  | Self-build smoke test       | None. Regular CI is sufficient                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| 29  | CI native platforms         | Full common set (per GitHub Actions runner availability): `linux-x64`, `linux-arm64`, `darwin-x64`, `darwin-arm64`, `win32-x64`                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| 30  | CI native trigger           | Main branch only. PR pipeline validates JS bin builds only                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 31  | Native artifact destination | GitHub Releases attached to the auto-tagged versions from the existing ci-main.yml publish flow                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| 32  | CI workflow shape           | Reusable `_lib-native.yml` template + per-lib `ci-lib-<name>-native.yml` caller                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| 33  | Test depth                  | 100% coverage on every primitive                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| 34  | Integration tests           | None at builder level. Wrapper's libs continuing to build successfully is the integration coverage                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| 35  | Behavioral parity           | Manual diff during the migration PR. No permanent CI parity assertion                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| 36  | Plan format                 | Per implementation-plans skill                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| 37  | Doc deliverables            | README + JSDoc per skills up-front. ARCHITECTURE.md deferred to release-time on user request                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |

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

The builder ships **self-contained**: everything it leverages is inlined into the published artifact (both JS and `.d.ts`). The source `package.json` is honest — every package the source code imports lives in `dependencies`. The build pipeline does the work: it inlines all of them into the JS output, runs a d.ts bundling pass that inlines their type references, then strips them from the output `package.json`. Consumers see `dependencies: {}` and install nothing transitively.

| Dependency                           | Section in `libs/builder/package.json` | Role                                                            |
| ------------------------------------ | -------------------------------------- | --------------------------------------------------------------- |
| `@hyperfrontend/logging`             | `dependencies` (bundled, stripped)     | Logging substrate (extended in Phase 1)                         |
| `@hyperfrontend/project-scope`       | `dependencies` (bundled, stripped)     | File/path/glob/walk substrate                                   |
| `@hyperfrontend/immutable-api-utils` | `dependencies` (bundled, stripped)     | Safe builtins per coding skill                                  |
| `@hyperfrontend/versioning`          | `dependencies` (bundled, stripped)     | Used by package-phase license collection                        |
| `rollup`                             | `dependencies` (bundled, stripped)     | Bundler                                                         |
| `@rollup/plugin-commonjs`            | `dependencies` (bundled, stripped)     | CJS interop for rollup                                          |
| `@rollup/plugin-json`                | `dependencies` (bundled, stripped)     | JSON imports for rollup                                         |
| `@rollup/plugin-node-resolve`        | `dependencies` (bundled, stripped)     | Node resolution for rollup                                      |
| `@rollup/plugin-terser`              | `dependencies` (bundled, stripped)     | Minification for IIFE/UMD                                       |
| `@rollup/plugin-typescript`          | `dependencies` (bundled, stripped)     | TypeScript transpilation in rollup                              |
| `rollup-plugin-dts`                  | `dependencies` (bundled, stripped)     | d.ts bundling pass that inlines external type refs (Phase 11.5) |
| `postject`                           | `dependencies` (bundled, stripped)     | Node SEA blob injection                                         |
| `typescript`                         | workspace root `devDependencies`       | `tsc` invocation for declaration emission                       |
| `node:*` builtins                    | n/a                                    | I/O ops not covered by project-scope                            |

**Banned:** `@nx/devkit`, `glob`, `minimatch`, any other external runtime dep — these we do not use, period.

**`@nx/dependency-checks` lint rule:** passes naturally because every imported package is declared in `dependencies`. No `ignoredDependencies` workaround needed.

---

## Completed Phases

| Phase | Title                                       | Status  | Notes                                                                                                                                                            |
| ----- | ------------------------------------------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | Foundation: extend `@hyperfrontend/logging` | ✅ done | `channel` / `timed` / `timedAsync` shipped on `Logger`. 100% coverage on the new methods.                                                                        |
| 2     | Scaffold `libs/builder`                     | ✅ done | Publishable shell at `libs/builder/` with `tsconfig.base.json` path mapping and the dep set above.                                                               |
| 3     | Models and Memory                           | ✅ done | All type definitions in `src/models/`. `recover()` always-on; `createMemoryMonitor()` opt-in with `warningMB` / `criticalMB` / `growthMB`.                       |
| 4     | Bundle subdomain                            | ✅ done | Entries / externals / rollup driver / declarations under `src/bundle/`. Uses project-scope's `matchGlobPattern` and `walkDirectory`; no minimatch/glob.          |
| 5     | Package subdomain                           | ✅ done | `synthesizePackageJson`, `inheritFields`, `filterWorkspaceDepsFromOutput`, `copyAssets`, third-party license collector. Adds dep on `@hyperfrontend/versioning`. |
| 6     | Bin subdomain (JS)                          | ✅ done | `buildJsBin`, `defaultBootstrap`, `wireBinFieldInPackageJson`. CJS preferred over ESM when both formats produced for the same bin name.                          |
| 7     | Bin subdomain (Node SEA)                    | ✅ done | `buildNativeBin` + `sea-config` / `sea-blob` / `host-binary` / `inject` / `codesign` / `platform-check`. SEA requires a CJS bin output.                          |
| 8     | Presets and `build()` Facade                | ✅ done | `byPrefix(scope)` / `byNames(names)` predicates. `build(config)` orchestrates bundle → package → bin and threads the optional memory monitor.                    |
| 9     | Builder's own CLI bin                       | ✅ done | `src/bin/hf-build.ts` + spec (100% coverage). `project.json` declares `hf-build` bin with all five SEA platforms.                                                |
| 10    | Wrapper retrofit                            | ✅ done | `tools/package/src/executors/build/` reduced to `executor.ts` + `schema.json` + `wrapper-config.ts`. Wrapper now thin-calls `build()` and accepts `bin`.         |

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

## Phase 11.5 — Self-containment as a builder feature (`bundleAllDeps` + d.ts inlining)

Today the builder bundles JS for matched packages but emits `.d.ts` files that still contain `import type { … } from '<bundled-pkg>'`. Consumers consuming any subpath whose types reference a bundled package would need to install the bundled package themselves to resolve the type — breaking the self-containment promise. This phase fixes that **as a generalized builder behavior**: any package that gets inlined in JS gets inlined in `.d.ts` too, automatically. No project-level toggle for d.ts behavior; the existing inline predicate is the single source of truth.

**Decisions locked here (extending the table at the top):**

| #   | Topic                                | Decision                                                                                                                                                                                                                                      |
| --- | ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 38  | Bundle-all knob                      | New per-format `bundleAllDeps?: boolean`. When `true`, the externals predicate matches every dep; when `false` (default), behavior is unchanged from today (`bundleWorkspaceDeps` only)                                                       |
| 39  | d.ts self-containment trigger        | Automatic. Whenever any deps are being inlined for JS, the declarations phase runs a d.ts bundling pass with the same external list. Not a separate toggle                                                                                    |
| 40  | d.ts bundler tool                    | `rollup-plugin-dts`. Slots into the existing rollup driver, reuses `tsconfig`, collapses external type imports into local type aliases                                                                                                        |
| 41  | Source/output dependency disposition | Source `package.json` lists every imported package in `dependencies`. The package-phase output filter strips all bundled packages from `dependencies`, regardless of workspace status                                                         |
| 42  | Curated public types module          | New `@hyperfrontend/builder/types` subpath re-exports the rollup / postject types builder surfaces publicly. Internal builder code consumes these re-exports rather than `'rollup'` directly so the d.ts bundler has a single inlining target |

**Outcome:** `dist/libs/builder/` contains zero `from 'rollup'` / `from '@rollup/*'` / `from 'postject'` / `from 'typescript'` references in any `.d.ts`, and zero `dependencies` field in the published `package.json`.

**Files modified:**

- `libs/builder/src/models/build-config.ts` — add `bundleAllDeps?: boolean` to `EsmConfig` and `CjsConfig`. Not added to `IifeConfig` / `UmdConfig`: those formats already default to bundling everything (browsers can't resolve Node-style modules), with `external?: string[]` as the opt-out. d.ts inlining still observes the iife/umd inlined sets when computing the union
- `libs/builder/src/bundle/externals/resolve-externals.ts` — accept `bundleAllDeps`. When `true`, the resulting external list is `peerDependencies` + `additional` only (no `dependencies`); workspace predicate becomes irrelevant
- `libs/builder/src/package/json/filter-deps.ts` — accept the same predicate set as `resolveExternals`. Strip every dep that was bundled (workspace + non-workspace) from output `dependencies`. If the field empties, delete it
- `libs/builder/src/package/json/synthesize.ts` — thread the `bundleAllDeps` decision into `filterWorkspaceDepsFromOutput`'s call
- `libs/builder/src/bundle/declarations/` — after the existing `tsc` pass, run a `rollup-plugin-dts` pass over each entry's emitted `.d.ts`. External list = same list `resolveExternals` produced for the JS phase
- `libs/builder/src/types/` (new) — `index.ts` re-exporting the public-facing rollup / postject types: `RollupOptions`, `OutputOptions`, `RollupLog`, `Plugin`, postject's `inject` signature
- `libs/builder/src/bundle/rollup/*.ts`, `libs/builder/src/bin/script/build-bin.ts`, `libs/builder/src/bin/native/inject.ts` — switch source-side `import type { … } from 'rollup' | 'postject'` to `from '../../types'`. Internal calls to runtime APIs still come from the third-party packages directly; only types route through the curated module
- `libs/builder/package.json` — add `rollup-plugin-dts` to `dependencies` (it's a package builder uses; the pipeline strips it from output for consumers)
- `libs/builder/src/bundle/externals/resolve-externals.spec.ts`, `libs/builder/src/package/json/filter-deps.spec.ts`, plus a new declarations-phase d.ts inlining spec — full coverage on the new branch (Decision #33)

**Wrapper retrofit (continuation of Phase 10):**

- `tools/package/src/executors/build/schema.json` — add `bundleAllDeps` to each format config
- `tools/package/src/executors/build/executor.ts` — passes `bundleAllDeps` straight through, no transformation

**Builder dogfood:**

- `libs/builder/project.json` — `esm.bundleAllDeps: true`, `cjs.bundleAllDeps: true`. The existing `bundleWorkspaceDeps: true` becomes redundant and is removed. `iife` / `umd` are intentionally **not** configured for `lib-builder` itself — the builder is a Node-only tool (uses `node:fs`, `node:path`, child processes, etc.) and is never targeted at browsers

**Verification:**

```bash
npx nx test lib-builder
npx nx lint lib-builder
npx nx typecheck lib-builder
npx nx build lib-builder
grep -rn "from 'rollup'\|from '@rollup\|from 'postject'\|from 'typescript'" dist/libs/builder/ --include="*.d.ts"
# expected output: nothing
node -e "console.log(JSON.stringify(require('./dist/libs/builder/package.json').dependencies))"
# expected output: undefined  (or {})
```

When the grep returns nothing and `dependencies` is absent from the dist `package.json`, builder is self-contained at install time. Any other workspace lib that opts into `bundleAllDeps: true` (or even just `bundleWorkspaceDeps: true` with public type re-exports) gets the same behavior automatically — no project-specific code paths.

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
