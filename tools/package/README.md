# @hyperfrontend/package

Nx plugin providing executors for building, type-checking, versioning, and publishing hyperfrontend library packages.

## Executors

| Executor    | Description                                                       |
| ----------- | ----------------------------------------------------------------- |
| `build`     | Format-centric build with explicit ESM/CJS/IIFE/UMD configuration |
| `typecheck` | TypeScript type checking without emitting files                   |
| `version`   | Idempotent semver wrapper — skips if tag exists                   |
| `publish`   | Publish to npm with dry-run support                               |

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

## Executor Details

### build

Format-centric build executor. All output formats are opt-in — nothing is built unless configured.

- **ESM/CJS**: Auto-discovers entry points from package.json exports
- **IIFE/UMD**: Requires explicit `entry` and `globalName`; inlines all dependencies by default

See [src/executors/build/README.md](https://github.com/AndrewRedican/hyperfrontend/blob/main/tools/package/src/executors/build/README.md) for full configuration reference.

### typecheck

Runs `tsc --noEmit` against the library's tsconfig. Zero configuration needed.

### version

Wraps `@jscutlery/semver:version` with idempotency — checks if version tag already exists before running. Prevents duplicate version bumps on re-runs.

### publish

Publishes built packages to npm. Supports:

- `--dry-run` for testing
- Automatic access control based on package scope
- Reads credentials from NPM_TOKEN environment variable

## Directory Structure

```
src/executors/
├── build/           # Library build executor
│   ├── executor.ts
│   ├── schema.json
│   ├── README.md
│   └── lib/         # Build utilities
├── typecheck/       # Type checking executor
├── publish/         # npm publish executor
└── version/         # Semver version executor
```

## Development

```bash
# Build the plugin
npx nx build package

# Test with a library
npx nx build lib-logging
```
