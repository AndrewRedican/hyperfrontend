# @hyperfrontend/package

This repository's executors and generators on top of [`@hyperfrontend/workspace`](../../libs/workspace/README.md): the build with the README the registry shows, the version flow with the compatibility document, and the generators that register a library across the repository. The `typecheck`, `test`, `publish` and `e2e` executors are the workspace package's own.

## Executors

| Executor      | Description                                                       | Docs                                                         |
| ------------- | ----------------------------------------------------------------- | ------------------------------------------------------------ |
| `build`       | The workspace package's build, then the README the registry shows | [README](../../libs/workspace/src/executors/build/README.md) |
| `version`     | Zero-dependency conventional commits versioning (npm as source)   | [README](./src/executors/version/README.md)                  |
| `version:all` | Batch versioning for all affected libraries                       | -                                                            |

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

After the build of a project with a `publish` target, the output README is rewritten for the registry: the title becomes the package banner and the marked regions become committed visuals.

**Full documentation of the options:** [libs/workspace/src/executors/build/README.md](../../libs/workspace/src/executors/build/README.md)

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
npx hf run hyperfrontend:version:all --dryRun

# Run batch versioning (typically done by lefthook)
npx hf run hyperfrontend:version:all

# Release a change to the package artifact that no commit type would release,
# such as a readme: a forced patch, calculated from each published version
npx hf run hyperfrontend:version:all \
  --releaseAs=patch --libraries=lib-logging,lib-nexus
```

A forced bump is for a change that lives in the package artifact rather than its code. The version identifies the artifact, and the readme is part of it, but a `docs` commit never bumps on its own; naming the libraries and the bump is what says the change is worth shipping. The changelog entry then lists every commit attributed to the package since its last release, `docs` and `chore` included, so it says what changed rather than that nothing did.

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

A library is also released, by a patch, when a releasable commit changes code it ships or the toolchain that builds it. See [the version executor](src/executors/version/README.md#changes-that-reach-a-library-indirectly).

## Development

```bash
# Check and test the plugin
npx hf run-many -t typecheck,test -p tool-package

# Try it on a library
npx hf run lib-logging:build
```
