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

### Build Strategy by Trigger

| Trigger          | Scope                  | Command                             |
| ---------------- | ---------------------- | ----------------------------------- |
| Pull Request     | Affected projects only | `nx affected -t=build`              |
| Merge to main    | All projects           | `nx run-many -t=build --all`        |
| Release / Manual | All + CDN bundles      | `nx run-many -t=build,bundle --all` |

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

## Badge Integration

Add build status badge to README.md:

```markdown
<a href="https://github.com/AndrewRedican/hyperfrontend/actions/workflows/ci-main.yml">
  <img src="https://img.shields.io/github/actions/workflow/status/AndrewRedican/hyperfrontend/ci-main.yml?style=flat-square&logo=github&label=build" alt="Build Status">
</a>
```

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

## Related Documents

- [BUILD_SYSTEM_PROGRESS.md](./BUILD_SYSTEM_PROGRESS.md) - Technical architecture
- [BUILD_SYSTEM_TODO.md](./BUILD_SYSTEM_TODO.md) - Implementation tasks
- [github-workflows-refactoring.md](./github-workflows-refactoring.md) - CI/CD details
