# Build System

**Last Updated**: February 8, 2026

---

## Overview

All 14 libraries build successfully with ESM + CJS dual output. The build executor auto-discovers entry points, generates proper `exports` in package.json, inherits repository metadata from root, and handles external dependencies correctly.

UMD/IIFE bundled builds are implemented for lib-nexus. CDN distribution includes minified variants with `unpkg` and `jsdelivr` fields in package.json.

---

## Output Structure

```
dist/libs/<package>/
├── index.esm.js      → ESM bundle (primary)
├── index.cjs.js      → CJS bundle (fallback)
├── index.d.ts        → TypeScript declarations
├── <feature>/        → Secondary entry points (if applicable)
├── bundle/           → UMD/IIFE bundles (lib-nexus only)
│   ├── index.umd.min.js
│   └── index.iife.min.js
└── package.json      → With conditional exports
```

---

## Custom Executors

| Executor    | Location                                | Description                         |
| ----------- | --------------------------------------- | ----------------------------------- |
| `build`     | `tools/package/src/executors/build`     | Auto-discovers entries, dual output |
| `publish`   | `tools/package/src/executors/publish`   | npm publishing with dry-run         |
| `version`   | `tools/package/src/executors/version`   | Idempotent semver wrapper           |
| `typecheck` | `tools/package/src/executors/typecheck` | TypeScript checking                 |

**Key files**:

- `lib/build-unified.ts` — Rollup configuration
- `lib/package-json.ts` — Package.json generation with metadata inheritance
- `lib/assets.ts` — Asset copying (README, CHANGELOG, LICENSE, FUNDING)

---

## CI/CD Workflows

| Workflow         | Trigger            | Purpose                         |
| ---------------- | ------------------ | ------------------------------- |
| `ci-main.yml`    | Push to main       | Full CI + push version tags     |
| `ci-release.yml` | PR merged to main  | Build affected → publish to npm |
| `ci-lib-*.yml`   | Push affecting lib | Per-library CI badges           |

**ci-release.yml** handles npm publishing automatically when PRs merge to main. Currently in dry-run mode — uncomment the publish step to enable actual publishing.

---

## Pending Tasks

### Enable Actual Publishing

- [ ] Uncomment publish step in `.github/workflows/ci-release.yml` (lines 63-66)

### CDN Bundle for lib-network-protocol

- [ ] Enable bundle build in `libs/network-protocol/project.json`:
  ```json
  "build": {
    "options": {
      "bundle": true,
      "globalName": "HyperfrontendNetworkProtocol"
    }
  }
  ```

---

## Validation Checklist

- [ ] ESM imports work: `import { x } from '@hyperfrontend/utils'`
- [ ] CJS requires work: `const { x } = require('@hyperfrontend/utils')`
- [ ] UMD loads in browser and exposes global (for nexus)
- [ ] Verdaccio local publish test passes

---

## Commands

```bash
# Build
npx nx build lib-nexus

# Version (idempotent - only updates if needed)
npx nx version lib-nexus --skipCommit

# Version with dry-run
npx nx version lib-nexus --dryRun

# Publish
npx nx publish lib-nexus --dryRun

# Affected operations
npx nx affected -t=build
npx nx affected -t=version
npx nx affected -t=publish
```

---

## Related Documents

- [DEPLOYMENT_PUBLISHING.md](./DEPLOYMENT_PUBLISHING.md) — Publishing workflow details
- [VERDACCIO_TESTING.md](./VERDACCIO_TESTING.md) — Local npm testing
