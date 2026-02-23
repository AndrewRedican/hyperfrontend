# @hyperfrontend/package

Nx plugin providing executors for building, type-checking, versioning, and publishing hyperfrontend library packages.

## Executors

| Executor    | Description                                                       | Docs                                        |
| ----------- | ----------------------------------------------------------------- | ------------------------------------------- |
| `build`     | Format-centric build with explicit ESM/CJS/IIFE/UMD configuration | [README](./src/executors/build/README.md)   |
| `typecheck` | TypeScript type checking without emitting files                   | -                                           |
| `version`   | Idempotent semver wrapper with docs-aware version bumps           | [README](./src/executors/version/README.md) |
| `publish`   | Publish to npm with dry-run support                               | [README](./src/executors/publish/README.md) |
| `e2e`       | Test package outputs via npm pack + tarball install               | -                                           |

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

Idempotent version executor that wraps `@jscutlery/semver:version` with:

- **Idempotency** — checks if version tag already exists before running
- **Recursion prevention** — skips if HEAD is a version commit for this project (project-specific)
- **Documentation support** — `docs` commits trigger MINOR version bumps
- **Dependent updates** — automatically updates version references in dependent packages

**Full documentation:** [src/executors/version/README.md](./src/executors/version/README.md) | [Architecture](./src/executors/version/ARCHITECTURE.md)

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
3. Runs Jest tests for each configured format (cjs, esm, browser)
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

## Directory Structure

```
src/executors/
├── build/           # Library build executor
│   ├── executor.ts
│   ├── schema.json
│   ├── README.md
│   └── lib/         # Build utilities
├── e2e/             # E2E package testing executor
├── typecheck/       # Type checking executor
├── publish/         # npm publish executor
│   ├── executor.ts
│   ├── schema.json
│   └── README.md
└── version/         # Semver version executor
    ├── executor.ts
    ├── schema.json
    ├── README.md
    └── ARCHITECTURE.md
```

---

## Development

```bash
# Build the plugin
npx nx build package

# Test with a library
npx nx build lib-logging
```
