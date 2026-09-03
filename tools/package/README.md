# @hyperfrontend/package

Nx plugin providing executors for building, type-checking, versioning, and publishing hyperfrontend library packages.

## Executors

| Executor      | Description                                                       | Docs                                        |
| ------------- | ----------------------------------------------------------------- | ------------------------------------------- |
| `build`       | Format-centric build with explicit ESM/CJS/IIFE/UMD configuration | [README](./src/executors/build/README.md)   |
| `typecheck`   | TypeScript type checking without emitting files                   | -                                           |
| `version`     | Zero-dependency conventional commits versioning (npm as source)   | [README](./src/executors/version/README.md) |
| `version:all` | Batch versioning for all affected libraries                       | -                                           |
| `publish`     | Publish to npm with dry-run support                               | [README](./src/executors/publish/README.md) |
| `e2e`         | Test package outputs via npm pack + tarball install               | -                                           |

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

Runs `tsc --noEmit` against the library's tsconfig. Zero configuration needed.

### version

Idempotent version executor using `@hyperfrontend/versioning` - a zero-dependency conventional commits versioning library:

- **npm as source of truth** — uses npm registry to determine current version, not git tags
- **Idempotency** — skips if version is already published to npm
- **Recursion prevention** — skips if HEAD is a version commit for this project
- **Documentation support** — `docs` commits trigger MINOR version bumps
- **Dependent updates** — automatically updates version references in dependent packages

**Full documentation:** [src/executors/version/README.md](./src/executors/version/README.md) | [Architecture](./src/executors/version/ARCHITECTURE.md)

### version-batch

Batch versioning executor for all affected libraries. This is the recommended approach for batch operations and is automatically invoked by lefthook on git push.

- **Affected detection** — programmatically detects libraries changed between base and head refs
- **Batch commit** — creates a single commit for all version updates
- **Rollback on failure** — automatically rolls back changes if any library fails
- **Signal handling** — cleans up properly on interruption (Ctrl+C)

**Options:**

| Option      | Description                         | Default       |
| ----------- | ----------------------------------- | ------------- |
| `--base`    | Base git ref for affected detection | `origin/main` |
| `--head`    | Head git ref for affected detection | `HEAD`        |
| `--dryRun`  | Preview without making changes      | `false`       |
| `--verbose` | Enable verbose logging              | `false`       |

**Usage:**

```bash
# Preview batch version changes
npx nx version-batch --dryRun

# Run batch versioning (typically done by lefthook)
npx nx version-batch
```

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
3. Runs each configured format on the node test runner (cjs, esm, browser, nx)
4. Cleans up tarball after testing

**Options:**

| Option           | Description                                                      |
| ---------------- | ---------------------------------------------------------------- |
| `packageDir`     | Path to built package directory (defaults to `dist/libs/{name}`) |
| `testDir`        | Path to E2E test project directory                               |
| `formats`        | Output formats to test (`cjs`, `esm`, `iife`, `umd`)             |
| `skipInstall`    | Skip npm pack and install step                                   |
| `cleanupTarball` | Remove tarball after installation (default: true)                |

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
# Build the plugin
npx nx build package

# Test with a library
npx nx build lib-logging
```
