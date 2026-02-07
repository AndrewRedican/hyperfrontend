# Build System Progress Report

**Date**: February 7, 2026
**Branch**: `build-and-badges`
**Status**: In Progress - Architecture defined, implementation pending

---

## Objective

Implement a robust build configuration that produces **multiple output categories** for all library packages, with proper TypeScript declarations, as outlined in [build-and-deployment-plan.md](./build-and-deployment-plan.md).

---

## Architecture Decision: Output Categories as Entry Points

Each package will expose **three base secondary entry points** representing distinct output categories:

### Output Structure

```
dist/libs/<package>/
├── esm/                    → ES Modules (external deps)
│   ├── index.js
│   ├── index.d.ts
│   └── <feature>/          → Feature modules (if applicable)
├── commonjs/               → CommonJS (external deps)
│   ├── index.js
│   ├── index.d.ts
│   └── <feature>/
├── bundled/                → Self-contained (all deps inlined)
│   ├── index.js
│   ├── index.d.ts
│   └── <feature>/
└── package.json            → With exports field
```

### Package.json Exports

```json
{
  "exports": {
    "./package.json": "./package.json",
    "./esm": {
      "types": "./esm/index.d.ts",
      "import": "./esm/index.js"
    },
    "./commonjs": {
      "types": "./commonjs/index.d.ts",
      "require": "./commonjs/index.js"
    },
    "./bundled": {
      "types": "./bundled/index.d.ts",
      "import": "./bundled/index.js",
      "require": "./bundled/index.js"
    }
  }
}
```

### For Libraries with Feature Modules

```json
{
  "exports": {
    "./esm": "./esm/index.js",
    "./esm/feature": "./esm/feature/index.js",
    "./commonjs": "./commonjs/index.js",
    "./commonjs/feature": "./commonjs/feature/index.js",
    "./bundled": "./bundled/index.js",
    "./bundled/feature": "./bundled/feature/index.js"
  }
}
```

### Use Cases

| Entry Point  | Dependencies | Use Case                                                   |
| ------------ | ------------ | ---------------------------------------------------------- |
| `./esm`      | External     | Modern bundlers (Vite, esbuild, Rollup) - they handle deps |
| `./commonjs` | External     | Node.js apps, legacy bundlers                              |
| `./bundled`  | Inlined      | CDN, script tags, no build step environments               |

---

## Future Roadmap

| Enhancement      | Entry Point     | Description                                              |
| ---------------- | --------------- | -------------------------------------------------------- |
| **Minification** | `./bundled.min` | Terser/uglify for production                             |
| **Browserified** | `./browser`     | Browser-specific polyfills, no Node APIs                 |
| **UMD**          | `./umd`         | Universal Module Definition for `<script>` tags          |
| **IIFE**         | `./iife`        | Immediately Invoked Function Expression for global scope |

---

## Build Complexity Dimensions

### 1. Entry Point Patterns (Source Structure)

| Pattern      | Example              | Structure                                    |
| ------------ | -------------------- | -------------------------------------------- |
| **Root**     | lib-data-utils       | Single `src/index.ts`                        |
| **Platform** | lib-string-utils     | `src/browser/index.ts` + `src/node/index.ts` |
| **Feature**  | lib-state-machine    | Multiple `src/<feature>/index.ts` modules    |
| **Hybrid**   | lib-ui-utils         | Root + multiple feature modules              |
| **Complex**  | lib-network-protocol | Platform + feature nesting                   |

### 2. Output Categories (Build Outputs)

| Category   | Format         | Dependencies | Target          |
| ---------- | -------------- | ------------ | --------------- |
| `esm`      | ES2022 modules | External     | Modern bundlers |
| `commonjs` | CJS            | External     | Node.js         |
| `bundled`  | ES2022 modules | Inlined      | CDN/direct use  |

---

## Implementation Status

### Committed & Working

| Library                    | Entry Pattern | Dependencies | Status |
| -------------------------- | ------------- | ------------ | ------ |
| lib-data-utils             | root          | none         | ✅     |
| lib-function-utils         | root          | none         | ✅     |
| lib-immutable-api-utils    | root          | none         | ✅     |
| lib-random-generator-utils | root          | none         | ✅     |
| lib-time-utils             | root          | none         | ✅     |
| lib-web-worker             | root          | none         | ✅     |
| lib-string-utils           | platform      | none         | ✅     |

_Note: Currently outputs ESM + CJS side-by-side. Needs migration to new entry point structure._

### Pending (Uncommitted)

| Library              | Entry Pattern             | Dependencies                           | Blocker              |
| -------------------- | ------------------------- | -------------------------------------- | -------------------- |
| lib-list-utils       | root                      | data-utils                             | TS6059 rootDir error |
| lib-logging          | root                      | unknown                                | needs testing        |
| lib-ui-utils         | hybrid (11 entries)       | data, function, list, random-generator | TS6059 rootDir error |
| lib-cryptography     | hybrid (root + platform)  | unknown                                | needs testing        |
| lib-state-machine    | feature (10+ modules)     | unknown                                | needs testing        |
| lib-network-protocol | complex                   | cryptography, others                   | needs testing        |
| lib-nexus            | complex (root + features) | network-protocol, others               | needs testing        |
| plugins/features     | unknown                   | unknown                                | needs testing        |

---

## Current Challenge: TypeScript Path Resolution

### The Problem

When building with `bundled` strategy, TypeScript/Rollup follows `tsconfig.base.json` path mappings to **source files** of dependencies:

```
@hyperfrontend/data-utils → libs/utils/data/src/index.ts
```

This causes TS6059 error because files outside the project's `rootDir` are included.

### Solution with New Architecture

The three-category approach solves this naturally:

| Category   | Dependency Handling | Path Resolution                            |
| ---------- | ------------------- | ------------------------------------------ |
| `esm`      | External            | No resolution needed - consumer provides   |
| `commonjs` | External            | No resolution needed - consumer provides   |
| `bundled`  | Resolve to dist     | Use `dist/` outputs from dependency builds |

For `bundled`, the build must resolve `@hyperfrontend/*` to **built outputs** in `dist/`, not source files. This requires:

1. Dependencies built first (`dependsOn: ["^build"]` ✅ configured)
2. Path alias plugin pointing to `dist/` during bundled build

---

## Nx Configuration

Added to `nx.json` to ensure build order:

```json
"build": {
  "dependsOn": ["^build"],      // Build dependencies first
  "inputs": ["default", "^default"]  // Invalidate cache when deps change
}
```

---

## Custom Build Executor

Located at `@hyperfrontend/package:build`:

```
tools/package/src/executors/build/
├── executor.ts          → Main executor
└── lib/
    ├── detect.ts        → Entry point discovery
    ├── build-unified.ts → Rollup build logic
    ├── package-json.ts  → Export generation
    └── ...
```

**Current Features:**

- Auto-discovers entry points from `src/` structure
- Generates `exports` field in package.json
- ESM + CJS output (legacy approach)
- TypeScript declarations with path flattening

**Needed Updates:**

- [ ] Generate three output categories (`esm/`, `commonjs/`, `bundled/`)
- [ ] External deps for `esm` and `commonjs` builds
- [ ] Resolve to `dist/` for `bundled` builds
- [ ] Update exports generation for new structure

---

## Next Steps

### Immediate (Unblock Builds)

1. **Update executor** to support three output categories
2. **Implement external strategy** for `esm`/`commonjs` builds
3. **Implement bundled strategy** with dist resolution

### Complete Library Builds (in dependency order)

1. lib-list-utils (deps: data-utils)
2. lib-logging
3. lib-ui-utils (deps: data, function, list, random-generator)
4. lib-cryptography
5. lib-state-machine
6. lib-network-protocol (deps: cryptography)
7. lib-nexus (deps: network-protocol)

### Future Enhancements

- [ ] Minified outputs (`./bundled.min`)
- [ ] Browserified builds (`./browser`)
- [ ] UMD format (`./umd`)
- [ ] IIFE format (`./iife`)
- [ ] Build badge integration
- [ ] Publish workflow

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

# View project graph (shows dependencies)
npx nx graph
```

---

## Related Documents

- [build-and-deployment-plan.md](./build-and-deployment-plan.md) - Master plan
- [MASTER_CONTEXT.md](./MASTER_CONTEXT.md) - Project overview
- [github-workflows-refactoring.md](./github-workflows-refactoring.md) - CI/CD tasks
