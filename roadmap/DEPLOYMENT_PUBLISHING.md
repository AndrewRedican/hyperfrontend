# Deployment and Publishing

**Date**: February 8, 2026

---

## Overview

This document describes the deployment infrastructure for publishing hyperfrontend library packages to npm.

---

## Release Strategy

### Semantic Versioning

All libraries use [Semantic Versioning](https://semver.org/) managed by [@jscutlery/semver](https://github.com/jscutlery/semver):

| Commit Type       | Version Bump | Example       |
| ----------------- | ------------ | ------------- |
| `feat:`           | Minor        | 1.0.0 → 1.1.0 |
| `fix:`            | Patch        | 1.0.0 → 1.0.1 |
| `perf:`           | Patch        | 1.0.0 → 1.0.1 |
| `BREAKING CHANGE` | Major        | 1.0.0 → 2.0.0 |

### Independent Versioning

Each library has its own independent version. This allows:

- Individual library releases without affecting others
- Clear tracking of changes per library
- Consumers to pin specific library versions

### Tag Format

Git tags follow the pattern: `{projectName}@{version}`

Examples:

- `lib-nexus@1.2.3`
- `lib-cryptography@2.0.0`
- `lib-data-utils@1.0.1`

---

## CHANGELOG Generation

Each library generates a `CHANGELOG.md` using conventional commit parsing:

```markdown
## [1.2.0](https://github.com/AndrewRedican/hyperfrontend/compare/lib-nexus@1.1.0...lib-nexus@1.2.0) (2026-02-08)

### Features

- **broker:** add message queue auto-flush on connection ([abc1234](https://github.com/AndrewRedican/hyperfrontend/commit/abc1234))

### Bug Fixes

- **channel:** handle edge case in origin validation ([def5678](https://github.com/AndrewRedican/hyperfrontend/commit/def5678))
```

### Commit Grouping

CHANGELOGs group commits into sections:

- **Features** — `feat:` commits
- **Bug Fixes** — `fix:` commits
- **Performance Improvements** — `perf:` commits
- **Breaking Changes** — commits with `BREAKING CHANGE:` footer

### Date Format

All dates use ISO 8601: `YYYY-MM-DD`

---

## Version Commands

```bash
# Version a single library (analyzes commits, bumps version, generates changelog)
npx nx version lib-nexus

# Dry-run to preview version bump and changelog
npx nx version lib-nexus --dryRun --skipStage --skipCommit

# Version all affected libraries
npx nx affected -t=version

# Version with specific release type override
npx nx version lib-nexus --releaseAs=minor
```

> **Note**: The `--skipStage --skipCommit` flags are required for dry-run due to a behavior in @jscutlery/semver where `--dryRun` alone still attempts to stage files.

---

## Publish Commands

```bash
# Publish a single library (requires prior build)
npx nx publish lib-nexus

# Dry-run publish (shows what would happen)
npx nx publish lib-nexus --dryRun

# Publish with beta tag
npx nx publish lib-nexus --tag=beta

# Publish to custom registry (e.g., Verdaccio for testing)
npx nx publish lib-nexus --registry=http://localhost:4873

# Publish all affected libraries
npx nx affected -t=publish
```

---

## CI/CD Integration

### Automatic Releases on Main

When all CI checks pass on `main`, the `release` job:

1. Runs `nx affected -t=version` to version changed libraries
2. Commits version bumps and changelogs
3. Creates git tags
4. Pushes to `main`

### Workflow Overview

```
ci-main.yml:
  setup → format → lint → typecheck → build → test → e2e
                                                      ↓
                                                  ci-status (gate)
                                                      ↓
                                                   release (if success)
```

---

## npm Organization Setup

### @hyperfrontend Scope

All packages publish under the `@hyperfrontend` npm scope:

- `@hyperfrontend/nexus`
- `@hyperfrontend/cryptography`
- `@hyperfrontend/data-utils`
- etc.

### Required Configuration

1. **NPM_TOKEN secret** — Add to GitHub repository secrets
2. **npm login** — `npm login --scope=@hyperfrontend`
3. **Verify access** — `npm access list packages @hyperfrontend`

### First-Time Publish

For new packages, the first publish must use `--access=public`:

```bash
npx nx publish lib-new-package --access=public
```

---

## Publish Executor

**Location**: `tools/package/src/executors/publish/`

### Options

| Option     | Type    | Default     | Description                          |
| ---------- | ------- | ----------- | ------------------------------------ |
| `dryRun`   | boolean | `false`     | Preview without publishing           |
| `registry` | string  | npm default | Custom registry URL                  |
| `tag`      | string  | `latest`    | npm dist-tag                         |
| `access`   | string  | `public`    | Scope access (`public`/`restricted`) |
| `otp`      | string  | —           | 2FA one-time password                |

### Validation

The publish executor:

- Verifies project is a library (`projectType: "library"`)
- Verifies dist directory exists
- Verifies package.json exists in dist

---

## Package Contents

Each published package includes:

| File           | Source    | Description                      |
| -------------- | --------- | -------------------------------- |
| `index.esm.js` | Build     | ESM bundle                       |
| `index.cjs.js` | Build     | CJS bundle                       |
| `index.d.ts`   | Build     | TypeScript declarations          |
| `package.json` | Generated | With exports, repository, author |
| `README.md`    | Library   | Library documentation            |
| `CHANGELOG.md` | Generated | Version history                  |
| `LICENSE.md`   | Root      | MIT license                      |
| `SECURITY.md`  | Root      | Security policy                  |
| `FUNDING.md`   | Root      | If library has funding config    |

---

## Recommended Initial Versions

For the first release after compressing commits, consider starting at `0.1.0`:

- Signals pre-1.0 stability (API may change)
- Allows minor bumps for features
- Major bump to `1.0.0` when stable

To set initial versions:

```bash
# Manually update version in libs/*/package.json to 0.1.0
# Then make a "ribbon-cutting" commit:
git add .
git commit -m "feat: initial release of hyperfrontend libraries"
```

---

## Related Documents

- [BUILD_SYSTEM.md](./BUILD_SYSTEM.md) — Build architecture
- [build-and-deployment-plan.md](./build-and-deployment-plan.md) — CI/CD workflows
- [VERDACCIO_TESTING.md](./VERDACCIO_TESTING.md) — Local npm testing
