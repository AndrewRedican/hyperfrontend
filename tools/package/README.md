# @hyperfrontend/package

Executors and generators for building, type-checking, versioning, and publishing hyperfrontend library packages, run through the workspace's `hf` command line.

## Executors

| Executor      | Description                                                       | Docs                                        |
| ------------- | ----------------------------------------------------------------- | ------------------------------------------- |
| `build`       | Format-centric build with explicit ESM/CJS/IIFE/UMD configuration | [README](./src/executors/build/README.md)   |
| `typecheck`   | TypeScript type checking without emitting files                   | -                                           |
| `version`     | Zero-dependency conventional commits versioning (npm as source)   | [README](./src/executors/version/README.md) |
| `version:all` | Batch versioning for all affected libraries                       | -                                           |
| `publish`     | Publish to npm with dry-run support                               | [README](./src/executors/publish/README.md) |
| `e2e`         | Test package outputs via npm pack + tarball install               | -                                           |
| `test`        | Run a project's suites on Node's test runner via the test runtime | -                                           |

## Quick Start

```json
{
  "targets": {
    "build": {
      "executor": "@hyperfrontend/package:build",
      "options": {
        "esm": {},
        "cjs": {},
        "iife": { "entry": ".", "globalName": "MyLib" },
        "umd": { "entry": ".", "globalName": "MyLib" }
      }
    },
    "typecheck": {},
    "version": {},
    "publish": {}
  }
}
```

---

## Executor Details

### build

Format-centric build executor. All output formats are opt-in — nothing is built unless configured.

- **ESM/CJS**: Auto-discovers entry points from package.json exports
- **IIFE/UMD**: Requires explicit `entry` and `globalName`; inlines all dependencies by default

**Full documentation:** [src/executors/build/README.md](./src/executors/build/README.md)

### typecheck

Runs `tsc --noEmit` against the library's `tsconfig.lib.json` and, when the project has one, its `tsconfig.spec.json`. Specs run with their types stripped, so this is the only step that type checks them. Zero configuration needed; `tsConfig` and `specTsConfig` override either path.

### version

Idempotent version executor using `@hyperfrontend/versioning` - a zero-dependency conventional commits versioning library:

- **npm as source of truth** — uses npm registry to determine current version, not git tags
- **Idempotency** — skips if version is already published to npm
- **Recursion prevention** — skips if HEAD is a version commit for this project
- **Documentation stays out of the bump**: `docs`, `chore` and `build` commits never release on their own; a forced bump lists them
- **Dependent updates** — automatically updates version references in dependent packages

**Full documentation:** [src/executors/version/README.md](./src/executors/version/README.md) | [Architecture](./src/executors/version/ARCHITECTURE.md)

### version-batch

Batch versioning executor for all affected libraries. This is the recommended approach for batch operations and is automatically invoked by lefthook on git push.

- **Affected detection** — programmatically detects libraries changed between base and head refs
- **Batch commit** — creates a single commit for all version updates
- **Rollback on failure** — automatically rolls back changes if any library fails
- **Signal handling** — cleans up properly on interruption (Ctrl+C)

**Options:**

| Option        | Description                                                                       | Default       |
| ------------- | --------------------------------------------------------------------------------- | ------------- |
| `--base`      | Base git ref for affected detection                                               | `origin/main` |
| `--head`      | Head git ref for affected detection                                               | `HEAD`        |
| `--dryRun`    | Preview without making changes                                                    | `false`       |
| `--verbose`   | Enable verbose logging                                                            | `false`       |
| `--releaseAs` | Force `major`, `minor` or `patch` on the libraries named by `--libraries`         | -             |
| `--libraries` | Project names to version instead of the affected set; required with `--releaseAs` | -             |

**Usage:**

```bash
# Preview batch version changes
npm run hf -- run @hyperfrontend/workspace:version:all --dryRun

# Run batch versioning (typically done by lefthook)
npm run hf -- run @hyperfrontend/workspace:version:all

# Release a change to the package artifact that no commit type would release,
# such as a readme: a forced patch, calculated from each published version
npm run hf -- run @hyperfrontend/workspace:version:all \
  --releaseAs=patch --libraries=lib-logging,lib-nexus
```

A forced bump is for a change that lives in the package artifact rather than its code. The version identifies the artifact, and the readme is part of it, but a `docs` commit never bumps on its own; naming the libraries and the bump is what says the change is worth shipping. The changelog entry then lists every commit attributed to the package since its last release, `docs` and `chore` included, so it says what changed rather than that nothing did.

### publish

Publishes built packages to npm with:

- `--dry-run` mode for testing
- Automatic access control based on package scope
- Idempotent — skips if version already exists on npm
- Reads credentials from `NPM_TOKEN` environment variable

**Full documentation:** [src/executors/publish/README.md](./src/executors/publish/README.md)

### e2e

End-to-end testing for package build outputs. Validates that built packages install and work correctly:

1. Runs `npm pack` in the dist directory to create a tarball
2. Installs the tarball in the E2E test project
3. Runs each configured format on the node test runner (cjs, esm, browser, nx), handing the suites the tarball's path as `HF_E2E_TARBALL` so they can install it into an isolated consumer through `@hyperfrontend/testing/consumer`
4. Cleans up tarball after testing

**Options:**

| Option           | Description                                                      |
| ---------------- | ---------------------------------------------------------------- |
| `packageDir`     | Path to built package directory (defaults to `dist/libs/{name}`) |
| `testDir`        | Path to E2E test project directory                               |
| `formats`        | Output formats to test (`cjs`, `esm`, `iife`, `umd`)             |
| `skipInstall`    | Skip npm pack and install step                                   |
| `cleanupTarball` | Remove tarball after installation (default: true)                |

### test

Runs a project's `test.config.ts` on Node's built-in test runner. The executor starts a Node process with the `@hyperfrontend/testing` preload and `src/executors/test/runner-cli.ts`, which loads the configuration and hands it to the runtime's runner, then prints the coverage table and the reasons a run failed. The runtime is located through the `@hyperfrontend/testing/*` aliases in `tsconfig.base.json`, so the workspace tests every project, the runtime included, on the library's own source, the same way it builds with `@hyperfrontend/builder` from source.

**Options:**

| Option              | Description                                                               |
| ------------------- | ------------------------------------------------------------------------- |
| `testConfig`        | Path to the project's test configuration (defaults to `test.config.ts`)   |
| `coverageDirectory` | Where coverage reports are written (defaults to `coverage/{projectRoot}`) |

---

## Commit Types and Versioning

The version executor uses a custom conventional commits preset:

| Commit Type | Version Impact | Changelog Section        |
| ----------- | -------------- | ------------------------ |
| `feat`      | MINOR          | Features                 |
| `docs`      | MINOR          | Documentation            |
| `fix`       | PATCH          | Bug Fixes                |
| `perf`      | PATCH          | Performance Improvements |
| `build`     | PATCH          | Build System             |
| `refactor`  | None           | (hidden)                 |
| `chore`     | None           | (hidden)                 |

> **Philosophy:** Documentation updates are considered meaningful user-facing changes.

---

## Development

```bash
# Check and test the plugin
npm run hf -- run-many -t typecheck,test -p tool-package

# Try it on a library
npm run hf -- run lib-logging:build
```
