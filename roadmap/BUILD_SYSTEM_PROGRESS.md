# Build System Progress Report

**Date**: February 6, 2026
**Branch**: `build-and-badges`
**Status**: In Progress

---

## Objective

Implement a robust build configuration that produces **dual output formats** (ESM + CommonJS) for all library packages, with proper TypeScript declarations, as outlined in [build-and-deployment-plan.md](./build-and-deployment-plan.md).

---

## Progress Summary

### Completed

| Task                                           | Status | Notes                                         |
| ---------------------------------------------- | ------ | --------------------------------------------- |
| Standard library builds (lib-data-utils)       | ✅     | Uses default `@nx/rollup:rollup` executor     |
| Isomorphic library builds (lib-string-utils)   | ✅     | Custom `rollup.config.cjs` with Babel         |
| ESM + CJS output for browser/node entry points | ✅     | 4 bundles generated per isomorphic lib        |
| TypeScript declarations for isomorphic libs    | ✅     | Separate tsc step with proper path flattening |
| Asset copying (README, LICENSE, package.json)  | ✅     | Custom Rollup plugin                          |

### Not Started

| Task                                   | Notes                                  |
| -------------------------------------- | -------------------------------------- |
| UMD/IIFE bundles for CDN               | Planned for lib-nexus                  |
| Build badge integration                | Waiting for CI stability               |
| Publish workflow                       | Future phase                           |
| Apply isomorphic pattern to other libs | lib-cryptography, lib-network-protocol |

---

## Architecture Decisions

### Standard Libraries (Single Entry Point)

Libraries with a single `src/index.ts` use the default `@nx/rollup:rollup` executor inherited from `nx.json`:

```
libs/utils/data/
├── src/index.ts          → Single entry point
├── project.json          → { "targets": { "build": {} } }
└── tsconfig.lib.json
```

**project.json** (minimal - inherits from nx.json targetDefaults):

```json
{
  "targets": {
    "build": {}
  }
}
```

**Output**:

```
dist/libs/utils/data/
├── index.cjs.js          → CommonJS
├── index.esm.js          → ESM
├── index.d.ts            → TypeScript declarations
├── package.json          → With exports field
├── README.md
└── LICENSE.md
```

### Isomorphic Libraries (Multiple Entry Points)

Libraries with browser/node-specific implementations require a custom `rollup.config.cjs`:

```
libs/utils/string/
├── src/
│   ├── browser/index.ts  → Browser entry point
│   ├── node/index.ts     → Node entry point
│   └── lib/              → Shared implementation
├── rollup.config.cjs     → Custom config
├── project.json          → Uses nx:run-commands executor
└── tsconfig.lib.json     → Must have noEmit: false
```

**project.json**:

```json
{
  "targets": {
    "build": {
      "executor": "nx:run-commands",
      "options": {
        "cwd": "{projectRoot}",
        "command": "rollup -c rollup.config.cjs"
      },
      "outputs": ["{workspaceRoot}/dist/{projectRoot}"]
    }
  }
}
```

**tsconfig.lib.json** (must override base config's noEmit):

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "outDir": "../../../dist/out-tsc",
    "noEmit": false
  },
  "include": ["src/**/*.ts"],
  "exclude": ["jest.config.ts", "src/**/*.spec.ts", "src/**/*.test.ts"]
}
```

**Output**:

```
dist/libs/utils/string/
├── browser/
│   ├── index.cjs.js
│   ├── index.esm.js
│   └── index.d.ts
├── node/
│   ├── index.cjs.js
│   ├── index.esm.js
│   └── index.d.ts
├── lib/                  → Shared type declarations
│   └── *.d.ts
├── package.json          → With conditional exports
├── README.md
└── LICENSE.md
```

**Generated package.json exports**:

```json
{
  "exports": {
    "./package.json": "./package.json",
    "./browser": {
      "types": "./browser/index.d.ts",
      "import": "./browser/index.esm.js",
      "require": "./browser/index.cjs.js"
    },
    "./node": {
      "types": "./node/index.d.ts",
      "import": "./node/index.esm.js",
      "require": "./node/index.cjs.js"
    }
  }
}
```

---

## Isomorphic Build Strategy

The custom `rollup.config.cjs` uses:

1. **Babel for transpilation** (`@rollup/plugin-babel` with `@babel/preset-typescript`)
   - Strips TypeScript types without full type checking
   - Faster than `@rollup/plugin-typescript`
   - Avoids issues with corrupted type definition files

2. **Separate tsc for declarations**
   - Runs `tsc --emitDeclarationOnly` after bundling
   - Flattens nested output paths (tsc respects rootDir from tsconfig.base.json)
   - Copies declarations to match bundle structure

3. **Post-build asset handling**
   - Copies README.md, LICENSE.md
   - Generates package.json with proper exports field

**Key insight**: The base `tsconfig.base.json` has `noEmit: true` which must be overridden in project-level `tsconfig.lib.json` for declaration generation to work.

---

## Files Changed (This Session)

### New Files

- `libs/utils/string/rollup.config.cjs` - Custom Rollup config for isomorphic build

### Modified Files

- `libs/utils/string/project.json` - Changed to use `nx:run-commands` executor
- `libs/utils/string/tsconfig.lib.json` - Added `noEmit: false` override

---

## Next Steps

1. **Apply pattern to `lib-cryptography`** (has browser/node entry points)

2. **Apply pattern to `lib-network-protocol`** (has multiple secondary entry points)

3. **Consider creating a shared base rollup config** for reuse across isomorphic libs

4. **Build all libraries** and verify outputs

5. **Add build badge** to README once CI is stable

---

## Commands Reference

```bash
# Build single library
npx nx build lib-data-utils
npx nx build lib-string-utils

# Build all libraries
npx nx run-many -t=build --all

# Skip cache for testing
npx nx build lib-string-utils --skip-nx-cache

# Check affected projects
npx nx affected -t=build
```

---

## Related Documents

- [build-and-deployment-plan.md](./build-and-deployment-plan.md) - Master plan
- [MASTER_CONTEXT.md](./MASTER_CONTEXT.md) - Project overview
- [github-workflows-refactoring.md](./github-workflows-refactoring.md) - CI/CD tasks
