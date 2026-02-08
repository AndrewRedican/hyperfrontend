# Build and Deployment Plan

_Created: February 5, 2026_
_Revised: February 8, 2026_

---

## Overview

This document outlines the CI/CD integration and deployment strategy for the multi-format build outputs. For technical build architecture details, see [BUILD_SYSTEM_PROGRESS.md](./BUILD_SYSTEM_PROGRESS.md).

---

## Project Categories

| Category          | Projects                                                                     | Build Output                 |
| ----------------- | ---------------------------------------------------------------------------- | ---------------------------- |
| **Foundation**    | lib-data-utils, lib-function-utils, lib-immutable-api-utils, lib-list-utils, | ESM + CJS                    |
|                   | lib-string-utils, lib-time-utils, lib-random-generator-utils, lib-ui-utils   |                              |
| **Core**          | lib-cryptography, lib-logging, lib-state-machine, lib-web-worker             | ESM + CJS                    |
| **Communication** | lib-network-protocol, lib-nexus                                              | ESM + CJS (UMD+IIFE planned) |
| **Plugins**       | plugin-features                                                              | ESM + CJS                    |
| **Apps/Demos**    | All apps and demos                                                           | Excluded (applications)      |
| **Documentation** | docs                                                                         | Hugo build (separate)        |

---

## CI/CD Workflows

### PR Workflow (ci-pr.yml)

```
setup → format → lint → typecheck → test → build → e2e → status
        (affected projects only)
```

### Main Workflow (ci-main.yml)

```
setup → format → lint → typecheck → test → build → coverage upload
        (all projects)
```

### Per-Library Workflows (ci-lib-\*.yml) ✅

Each library has a dedicated workflow that runs on push to `main` when library files change:

```
checkout → setup-monorepo → typecheck → build → test → coverage upload
           (single library, path-filtered)
```

**Architecture**: A reusable workflow template (`_lib-ci.yml`) provides the CI logic, and each library workflow (`ci-lib-<name>.yml`) invokes it with library-specific parameters.

**Libraries with dedicated workflows**:

- lib-cryptography, lib-logging, lib-state-machine, lib-web-worker
- lib-network-protocol, lib-nexus
- lib-data-utils, lib-function-utils, lib-immutable-api-utils
- lib-list-utils, lib-string-utils, lib-time-utils
- lib-random-generator-utils, lib-ui-utils

**Benefits**:

- Per-library build status badges show granular health
- Path-filtered triggers reduce unnecessary CI runs
- Isolated coverage reporting per library via Codecov flags
- Clear ownership and visibility for library maintainers

### Build Strategy by Trigger

| Trigger          | Scope                  | Command                             |
| ---------------- | ---------------------- | ----------------------------------- |
| Pull Request     | Affected projects only | `nx affected -t=build`              |
| Merge to main    | All projects           | `nx run-many -t=build --all`        |
| Library push     | Single library         | `nx build <lib>` (per-lib workflow) |
| Release / Manual | All + CDN bundles      | `nx run-many -t=build,bundle --all` |

### Release Workflow (ci-main.yml) ✅

After all CI checks pass on `main`, the `release` job:

1. Versions affected libraries using @jscutlery/semver
2. Generates/updates CHANGELOG.md for each library
3. Creates git tags: `{projectName}@{version}`
4. Pushes commits and tags to `main`

```
ci-main.yml:
  setup → format → lint → typecheck → build → test → e2e
                                                      ↓
                                                  ci-status (gate)
                                                      ↓
                                                   release (if success)
```

---

## Workflow Updates (Planned)

### 1. Build Artifacts Upload

```yaml
# ci-main.yml
- name: Upload build artifacts
  uses: actions/upload-artifact@v4
  with:
    name: dist-packages
    path: dist/libs/
    retention-days: 30
```

### 2. CDN Bundle Step

```yaml
- name: Build CDN bundles
  run: npx nx run lib-nexus:bundle --parallel=1
```

### 3. Publish Workflow (Future)

```yaml
# .github/workflows/publish.yml
name: publish

on:
  release:
    types: [published]

jobs:
  publish-npm:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: ./.github/actions/setup-monorepo
      - run: npx nx run-many -t=build --all
      - run: npx nx run-many -t=publish --all
        env:
          NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
```

---

## Badge Integration ✅

### Two-Tier Badge Strategy

**Repository root** (`README.md`): Uses `ci-main.yml` for overall project health.

```markdown
<a href="https://github.com/AndrewRedican/hyperfrontend/actions/workflows/ci-main.yml">
  <img src="https://img.shields.io/github/actions/workflow/status/AndrewRedican/hyperfrontend/ci-main.yml?style=flat-square&logo=github&label=build" alt="Build Status">
</a>
```

**Individual libraries** (`libs/*/README.md`): Each uses its own `ci-lib-<name>.yml` workflow.

```markdown
<!-- Example: libs/nexus/README.md -->
<a href="https://github.com/AndrewRedican/hyperfrontend/actions/workflows/ci-lib-nexus.yml">
  <img src="https://img.shields.io/github/actions/workflow/status/AndrewRedican/hyperfrontend/ci-lib-nexus.yml?style=flat-square&logo=github&label=build" alt="Build">
</a>
```

This approach provides accurate per-library health indicators while maintaining a holistic project status at the repository level.

---

## Output Locations

| Project          | ESM                                  | CJS                                  |
| ---------------- | ------------------------------------ | ------------------------------------ |
| lib-nexus        | `dist/libs/nexus/index.esm.js`       | `dist/libs/nexus/index.cjs.js`       |
| lib-cryptography | `dist/libs/cryptography/*.esm.js`    | `dist/libs/cryptography/*.cjs.js`    |
| plugin-features  | `dist/plugins/features/index.esm.js` | `dist/plugins/features/index.cjs.js` |

---

## Build Commands

```bash
# Build all libraries
npx nx run-many -t=build --all

# Build specific library
npx nx build lib-nexus

# Build affected (for PRs)
npx nx affected -t=build

# Build CDN bundles (future)
npx nx run lib-nexus:bundle
```

---

## Version & Publish Commands

```bash
# Version a library (bump + changelog)
npx nx version lib-nexus

# Dry-run version (note: requires extra flags)
npx nx version lib-nexus --dryRun --skipStage --skipCommit

# Publish to npm
npx nx publish lib-nexus

# Dry-run publish
npx nx publish lib-nexus --dryRun

# Publish to local Verdaccio for testing
npx nx publish lib-nexus --registry=http://localhost:4873

# Affected operations
npx nx affected -t=version
npx nx affected -t=publish
```

---

## Related Documents

- [BUILD_SYSTEM_PROGRESS.md](./BUILD_SYSTEM_PROGRESS.md) - Technical architecture
- [BUILD_SYSTEM_TODO.md](./BUILD_SYSTEM_TODO.md) - Implementation tasks
- [DEPLOYMENT_PUBLISHING.md](./DEPLOYMENT_PUBLISHING.md) - Publishing workflow
- [VERDACCIO_TESTING.md](./VERDACCIO_TESTING.md) - Local npm testing
- [github-workflows-refactoring.md](./github-workflows-refactoring.md) - CI/CD details
