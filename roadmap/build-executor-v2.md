# Build Executor V2

**Created:** February 12, 2026
**Status:** Implementation Plan
**Affects:** All library projects, `tools/package`

## Overview

A new build executor (`build-v2`) that replaces the current implicit/auto-detecting approach with explicit, format-centric configuration. All output formats are opt-in, providing full control over what gets built and how.

## Motivation

### Problems with Current Executor (`build`)

1. **Implicit format generation** — ESM/CJS always produced, no way to skip
2. **Bundle requires root entry** — Libraries with platform-only structure cannot produce UMD/IIFE
3. **Peer dependencies not inlined** — CDN bundles fail when peer deps are unavailable
4. **No per-format entry control** — Cannot specify different entry points for ESM vs IIFE
5. **Legacy `bundle` + `globalName` coupling** — IIFE/UMD cannot be configured independently

### Design Principles for V2

| Principle                   | Description                                                  |
| --------------------------- | ------------------------------------------------------------ |
| **Explicit over implicit**  | No output unless explicitly configured                       |
| **Format-centric**          | Top-level keys for each format (`esm`, `cjs`, `iife`, `umd`) |
| **Entry point flexibility** | Each format can target different entry points                |
| **Additive configuration**  | Array support for multiple bundles per format                |

## Output Format Reference

| Format   | Primary Use Case                        | Node.js | Browser |
| -------- | --------------------------------------- | ------- | ------- |
| **ESM**  | Modern bundlers, native browser modules | ✅      | ✅      |
| **CJS**  | Node.js, legacy bundlers                | ✅      | ⚠️      |
| **IIFE** | Browser `<script>` tags, CDN            | ❌      | ✅      |
| **UMD**  | Browser + AMD + CommonJS                | ⚠️      | ✅      |

## Web Worker & Edge Runtime Compatibility

### Using `globalThis` for Universal Crypto Access

To enable Web Worker and edge runtime compatibility, browser platform code should use `globalThis.crypto` instead of `window.crypto`:

```typescript
// ❌ Browser-only (fails in workers)
export const subtle = window.crypto.subtle

// ✅ Universal (browser + workers + edge)
export const subtle = globalThis.crypto.subtle
```

`globalThis.crypto` is available in:

| Environment                              | `globalThis.crypto`     |
| ---------------------------------------- | ----------------------- |
| Browser (main thread)                    | ✅                      |
| Web Workers (dedicated, shared, service) | ✅                      |
| Node.js 19+                              | ✅                      |
| Deno, Bun, Cloudflare Workers            | ✅                      |
| Node.js < 19                             | ❌ (use `./node` entry) |

**Security:** No difference — `globalThis.crypto` returns the exact same Web Crypto API as `window.crypto`.

### Affected Libraries

The following files currently use `window.crypto` and should be updated to `globalThis.crypto`:

- `libs/cryptography/src/lib/subtle/browser.ts`
- `libs/cryptography/src/lib/get-random-values/browser.ts`

This change makes the `./browser` entry universally compatible with workers — no separate `./worker` export needed.

### Jest Setup

The cryptography library's `jest.setup.browser.ts` already polyfills `globalThis.crypto`:

```typescript
// libs/cryptography/jest.setup.browser.ts (already configured)
import { webcrypto } from 'node:crypto'

Object.defineProperty(globalThis, 'crypto', {
  value: webcrypto,
  writable: true,
})
```

No changes needed — tests will work after migrating source files to `globalThis.crypto`.

## Schema Definition

### TypeScript Types

```typescript
// tools/package/src/executors/build-v2/lib/types.ts

/** Entry point specification for a format */
export interface FormatEntryConfig {
  /**
   * Entry point pattern(s).
   * - Exact: "./browser/v2" or "."
   * - Glob: "./browser/*"
   * - Multiple: ["./browser/v1", "./browser/v2"]
   * - Omit to use all detected entry points
   */
  entry?: string | string[]

  /** Exclude entry points matching these patterns */
  exclude?: string | string[]
}

/** ESM configuration */
export interface ESMConfig extends FormatEntryConfig {
  /** Generate sourcemaps. Defaults to true */
  sourcemap?: boolean

  /** External dependencies (in addition to auto-detected) */
  external?: string[]
}

/** CJS configuration */
export interface CJSConfig extends FormatEntryConfig {
  /** Generate sourcemaps. Defaults to true */
  sourcemap?: boolean

  /** External dependencies (in addition to auto-detected) */
  external?: string[]
}

/** IIFE configuration */
export interface IIFEConfig extends FormatEntryConfig {
  /** Global variable name (required) */
  globalName: string

  /** Generate minified version. Defaults to true */
  minify?: boolean

  /** Inline peer dependencies. Defaults to true */
  inlinePeerDependencies?: boolean

  /** Output subdirectory. Defaults to 'bundle' */
  output?: string
}

/** UMD configuration */
export interface UMDConfig extends FormatEntryConfig {
  /** Global variable name (required) */
  globalName: string

  /** Generate minified version. Defaults to true */
  minify?: boolean

  /** Inline peer dependencies. Defaults to true */
  inlinePeerDependencies?: boolean

  /** AMD module ID. Defaults to package name */
  amdId?: string

  /** Output subdirectory. Defaults to 'bundle' */
  output?: string
}

/** Build executor V2 options */
export interface BuildV2ExecutorOptions {
  /** Output directory. Defaults to dist/{projectRoot} */
  outputPath?: string

  /** Path to tsconfig. Defaults to {projectRoot}/tsconfig.lib.json */
  tsConfig?: string

  /** Additional assets to copy */
  assets?: (string | AssetConfig)[]

  /** Global externals for all formats */
  external?: string[]

  /** ESM output. Omit to skip. */
  esm?: ESMConfig | ESMConfig[]

  /** CJS output. Omit to skip. */
  cjs?: CJSConfig | CJSConfig[]

  /** IIFE bundle. Omit to skip. */
  iife?: IIFEConfig | IIFEConfig[]

  /** UMD bundle. Omit to skip. */
  umd?: UMDConfig | UMDConfig[]
}
```

### JSON Schema

```json
{
  "$schema": "http://json-schema.org/schema",
  "type": "object",
  "title": "Build V2 executor schema",
  "description": "Format-centric build executor for hyperfrontend library packages. All output formats are opt-in.",
  "properties": {
    "outputPath": {
      "type": "string",
      "description": "Output directory. Defaults to dist/{projectRoot}."
    },
    "tsConfig": {
      "type": "string",
      "description": "Path to tsconfig. Defaults to {projectRoot}/tsconfig.lib.json."
    },
    "assets": {
      "type": "array",
      "description": "Additional assets to copy.",
      "items": {
        "oneOf": [
          { "type": "string" },
          {
            "type": "object",
            "properties": {
              "input": { "type": "string" },
              "glob": { "type": "string" },
              "output": { "type": "string" }
            },
            "required": ["input", "glob", "output"]
          }
        ]
      }
    },
    "external": {
      "type": "array",
      "description": "Global external dependencies for all formats.",
      "items": { "type": "string" }
    },
    "esm": {
      "oneOf": [{ "$ref": "#/definitions/esmConfig" }, { "type": "array", "items": { "$ref": "#/definitions/esmConfig" } }],
      "description": "ESM output configuration. Omit to skip."
    },
    "cjs": {
      "oneOf": [{ "$ref": "#/definitions/cjsConfig" }, { "type": "array", "items": { "$ref": "#/definitions/cjsConfig" } }],
      "description": "CJS output configuration. Omit to skip."
    },
    "iife": {
      "oneOf": [{ "$ref": "#/definitions/iifeConfig" }, { "type": "array", "items": { "$ref": "#/definitions/iifeConfig" } }],
      "description": "IIFE bundle configuration. Browser-only. Omit to skip."
    },
    "umd": {
      "oneOf": [{ "$ref": "#/definitions/umdConfig" }, { "type": "array", "items": { "$ref": "#/definitions/umdConfig" } }],
      "description": "UMD bundle configuration. Universal format. Omit to skip."
    }
  },
  "definitions": {
    "entryConfig": {
      "type": "object",
      "properties": {
        "entry": {
          "oneOf": [{ "type": "string" }, { "type": "array", "items": { "type": "string" } }],
          "description": "Entry point(s). Exact paths or globs. Omit to use all detected entries."
        },
        "exclude": {
          "oneOf": [{ "type": "string" }, { "type": "array", "items": { "type": "string" } }],
          "description": "Entry points to exclude."
        }
      }
    },
    "esmConfig": {
      "allOf": [
        { "$ref": "#/definitions/entryConfig" },
        {
          "type": "object",
          "properties": {
            "sourcemap": { "type": "boolean", "default": true },
            "external": { "type": "array", "items": { "type": "string" } }
          }
        }
      ]
    },
    "cjsConfig": {
      "allOf": [
        { "$ref": "#/definitions/entryConfig" },
        {
          "type": "object",
          "properties": {
            "sourcemap": { "type": "boolean", "default": true },
            "external": { "type": "array", "items": { "type": "string" } }
          }
        }
      ]
    },
    "iifeConfig": {
      "allOf": [
        { "$ref": "#/definitions/entryConfig" },
        {
          "type": "object",
          "properties": {
            "globalName": { "type": "string" },
            "minify": { "type": "boolean", "default": true },
            "inlinePeerDependencies": { "type": "boolean", "default": true },
            "output": { "type": "string" }
          },
          "required": ["globalName"]
        }
      ]
    },
    "umdConfig": {
      "allOf": [
        { "$ref": "#/definitions/entryConfig" },
        {
          "type": "object",
          "properties": {
            "globalName": { "type": "string" },
            "minify": { "type": "boolean", "default": true },
            "inlinePeerDependencies": { "type": "boolean", "default": true },
            "amdId": { "type": "string" },
            "output": { "type": "string" }
          },
          "required": ["globalName"]
        }
      ]
    }
  }
}
```

## Library Project Configurations

### Note on network-protocol Structure

Unlike most libraries, `network-protocol` cannot use a single browser barrel export because:

1. **v1 and v2 both export `createProtocol`** — naming collision
2. **v1 and v2 re-export overlapping types** from shared lib modules
3. **The API design expects explicit version selection** (`./browser/v1` vs `./browser/v2`)

Therefore, network-protocol uses **multiple IIFE/UMD bundles** — one per protocol version — each with its own global name.

### Configuration by Library

Each library should update its `project.json` to use `build-v2` with explicit format configuration.

---

#### `@hyperfrontend/nexus`

**Structure:** Hybrid (root + features)
**Platforms:** Browser-only
**Bundle:** Yes, with inlined peer dependencies

```json
{
  "targets": {
    "build": {
      "executor": "@hyperfrontend/tools-package:build-v2",
      "options": {
        "esm": {},
        "cjs": {},
        "iife": {
          "entry": ".",
          "globalName": "HyperfrontendNexus",
          "inlinePeerDependencies": true
        },
        "umd": {
          "entry": ".",
          "globalName": "HyperfrontendNexus",
          "inlinePeerDependencies": true
        }
      }
    }
  }
}
```

---

#### `@hyperfrontend/network-protocol`

**Structure:** Complex (platform + feature nested)
**Platforms:** Isomorphic (browser + Node.js)
**Bundle:** Multiple bundles per protocol version (v1, v2)

```json
{
  "targets": {
    "build": {
      "executor": "@hyperfrontend/tools-package:build-v2",
      "options": {
        "esm": {},
        "cjs": {},
        "iife": [
          {
            "entry": "./browser/v1",
            "globalName": "HyperfrontendNetworkProtocolV1",
            "output": "bundle/v1"
          },
          {
            "entry": "./browser/v2",
            "globalName": "HyperfrontendNetworkProtocolV2",
            "output": "bundle/v2"
          }
        ],
        "umd": [
          {
            "entry": "./browser/v1",
            "globalName": "HyperfrontendNetworkProtocolV1",
            "output": "bundle/v1"
          },
          {
            "entry": "./browser/v2",
            "globalName": "HyperfrontendNetworkProtocolV2",
            "output": "bundle/v2"
          }
        ]
      }
    }
  }
}
```

---

#### `@hyperfrontend/cryptography`

**Structure:** Hybrid (root + platform)
**Platforms:** Isomorphic
**Bundle:** Browser entry only

```json
{
  "targets": {
    "build": {
      "executor": "@hyperfrontend/tools-package:build-v2",
      "options": {
        "esm": {},
        "cjs": {},
        "iife": {
          "entry": "./browser",
          "globalName": "HyperfrontendCryptography"
        },
        "umd": {
          "entry": "./browser",
          "globalName": "HyperfrontendCryptography"
        }
      }
    }
  }
}
```

---

#### `@hyperfrontend/logging`

**Structure:** Root only
**Platforms:** Isomorphic
**Bundle:** Yes

```json
{
  "targets": {
    "build": {
      "executor": "@hyperfrontend/tools-package:build-v2",
      "options": {
        "esm": {},
        "cjs": {},
        "iife": {
          "entry": ".",
          "globalName": "HyperfrontendLogging"
        },
        "umd": {
          "entry": ".",
          "globalName": "HyperfrontendLogging"
        }
      }
    }
  }
}
```

---

#### `@hyperfrontend/state-machine`

**Structure:** Feature (multiple modules)
**Platforms:** Isomorphic
**Bundle:** Yes (browser-friendly state management)

```json
{
  "targets": {
    "build": {
      "executor": "@hyperfrontend/tools-package:build-v2",
      "options": {
        "esm": {},
        "cjs": {},
        "iife": {
          "entry": ".",
          "globalName": "HyperfrontendStateMachine"
        },
        "umd": {
          "entry": ".",
          "globalName": "HyperfrontendStateMachine"
        }
      }
    }
  }
}
```

---

#### `@hyperfrontend/string-utils`

**Structure:** Hybrid (root + platform)
**Platforms:** Isomorphic
**Bundle:** Browser entry only

```json
{
  "targets": {
    "build": {
      "executor": "@hyperfrontend/tools-package:build-v2",
      "options": {
        "esm": {},
        "cjs": {},
        "iife": {
          "entry": "./browser",
          "globalName": "HyperfrontendStringUtils"
        },
        "umd": {
          "entry": "./browser",
          "globalName": "HyperfrontendStringUtils"
        }
      }
    }
  }
}
```

---

#### `@hyperfrontend/random-generator-utils`

**Structure:** Root only
**Platforms:** Isomorphic
**Bundle:** Yes (simple utility)

```json
{
  "targets": {
    "build": {
      "executor": "@hyperfrontend/tools-package:build-v2",
      "options": {
        "esm": {},
        "cjs": {},
        "iife": {
          "entry": ".",
          "globalName": "HyperfrontendRandomGenerator"
        },
        "umd": {
          "entry": ".",
          "globalName": "HyperfrontendRandomGenerator"
        }
      }
    }
  }
}
```

---

#### `@hyperfrontend/function-utils`

**Structure:** Root only
**Platforms:** Isomorphic
**Bundle:** Yes

```json
{
  "targets": {
    "build": {
      "executor": "@hyperfrontend/tools-package:build-v2",
      "options": {
        "esm": {},
        "cjs": {},
        "iife": {
          "entry": ".",
          "globalName": "HyperfrontendFunctionUtils"
        },
        "umd": {
          "entry": ".",
          "globalName": "HyperfrontendFunctionUtils"
        }
      }
    }
  }
}
```

---

#### `@hyperfrontend/list-utils`

**Structure:** Root only
**Platforms:** Isomorphic
**Bundle:** Yes

```json
{
  "targets": {
    "build": {
      "executor": "@hyperfrontend/tools-package:build-v2",
      "options": {
        "esm": {},
        "cjs": {},
        "iife": {
          "entry": ".",
          "globalName": "HyperfrontendListUtils"
        },
        "umd": {
          "entry": ".",
          "globalName": "HyperfrontendListUtils"
        }
      }
    }
  }
}
```

---

#### `@hyperfrontend/data-utils`

**Structure:** Root only
**Platforms:** Isomorphic
**Bundle:** Yes

```json
{
  "targets": {
    "build": {
      "executor": "@hyperfrontend/tools-package:build-v2",
      "options": {
        "esm": {},
        "cjs": {},
        "iife": {
          "entry": ".",
          "globalName": "HyperfrontendDataUtils"
        },
        "umd": {
          "entry": ".",
          "globalName": "HyperfrontendDataUtils"
        }
      }
    }
  }
}
```

---

#### `@hyperfrontend/time-utils`

**Structure:** Root only
**Platforms:** Isomorphic
**Bundle:** Yes

```json
{
  "targets": {
    "build": {
      "executor": "@hyperfrontend/tools-package:build-v2",
      "options": {
        "esm": {},
        "cjs": {},
        "iife": {
          "entry": ".",
          "globalName": "HyperfrontendTimeUtils"
        },
        "umd": {
          "entry": ".",
          "globalName": "HyperfrontendTimeUtils"
        }
      }
    }
  }
}
```

---

#### `@hyperfrontend/ui-utils`

**Structure:** Root only
**Platforms:** Browser-only
**Bundle:** Yes

```json
{
  "targets": {
    "build": {
      "executor": "@hyperfrontend/tools-package:build-v2",
      "options": {
        "esm": {},
        "cjs": {},
        "iife": {
          "entry": ".",
          "globalName": "HyperfrontendUIUtils"
        },
        "umd": {
          "entry": ".",
          "globalName": "HyperfrontendUIUtils"
        }
      }
    }
  }
}
```

---

#### `@hyperfrontend/immutable-api-utils`

**Structure:** Root only
**Platforms:** Isomorphic
**Bundle:** Yes

```json
{
  "targets": {
    "build": {
      "executor": "@hyperfrontend/tools-package:build-v2",
      "options": {
        "esm": {},
        "cjs": {},
        "iife": {
          "entry": ".",
          "globalName": "HyperfrontendImmutableApiUtils"
        },
        "umd": {
          "entry": ".",
          "globalName": "HyperfrontendImmutableApiUtils"
        }
      }
    }
  }
}
```

---

#### `@hyperfrontend/web-worker` (stub)

**Structure:** Stub
**Platforms:** Browser-only
**Bundle:** N/A (no build target yet)

```json
{
  "targets": {
    "typecheck": {}
  }
}
```

---

## Configuration Summary Table

| Library                  | ESM | CJS | IIFE | UMD | Entry for Bundle                                  |
| ------------------------ | --- | --- | ---- | --- | ------------------------------------------------- |
| `nexus`                  | ✅  | ✅  | ✅   | ✅  | `.` (inline peer deps)                            |
| `network-protocol`       | ✅  | ✅  | ✅   | ✅  | `./browser/v1`, `./browser/v2` (separate bundles) |
| `cryptography`           | ✅  | ✅  | ✅   | ✅  | `./browser`                                       |
| `logging`                | ✅  | ✅  | ✅   | ✅  | `.`                                               |
| `state-machine`          | ✅  | ✅  | ✅   | ✅  | `.`                                               |
| `string-utils`           | ✅  | ✅  | ✅   | ✅  | `./browser`                                       |
| `random-generator-utils` | ✅  | ✅  | ✅   | ✅  | `.`                                               |
| `function-utils`         | ✅  | ✅  | ✅   | ✅  | `.`                                               |
| `list-utils`             | ✅  | ✅  | ✅   | ✅  | `.`                                               |
| `data-utils`             | ✅  | ✅  | ✅   | ✅  | `.`                                               |
| `time-utils`             | ✅  | ✅  | ✅   | ✅  | `.`                                               |
| `ui-utils`               | ✅  | ✅  | ✅   | ✅  | `.`                                               |
| `immutable-api-utils`    | ✅  | ✅  | ✅   | ✅  | `.`                                               |

## Implementation Guidelines

### Code Style

- Use angle brackets for type casting: `<Type>value`, not `value as Type`
- Use functional programming with factory functions. No classes.
- Provide complete JSDoc for all exported functions and types.
- No inline comments unless absolutely necessary to clarify intent.
- No top-level module comment blocks. Rely on JSDoc only.

### Imports

- Import types separately: `import type { Foo } from './foo'`
- Use named imports only: `import { foo, bar } from './module'` — never `import * as`
- Prefix Node.js modules: `import { readFileSync } from 'node:fs'`

### Dependencies

- Use only existing project dependencies. No new packages.
- Prefer Node.js built-in modules when possible.
- Use `@nx/devkit` APIs where they provide ergonomic advantages.
- Do not use `fs/promises` or async file write operations — they cause race condition bugs.

### Build Output Functions

- Break down each format (ESM, CJS, IIFE, UMD) into discrete functions.
- Format functions return Rollup configuration objects — they do not invoke Rollup directly.
- A single orchestrator function collects all format configs and executes one Rollup build.

### Asset Handling

- Copy `assets.ts` from `tools/package/src/executors/build/lib/` to build-v2.

## Reusable Code from Build V1

The existing `build` executor contains utilities that should be **copied over** to V2 or serve as **implementation reference**.

### Copy to V2 (Identical Logic)

| File                                              | Functions                                                                                      | Notes                            |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------------- | -------------------------------- |
| `tools/package/src/executors/build/lib/assets.ts` | `copyAssets()`, `copyDefaultAssets()`, `copyFundingAsset()`, `getDefaultAssetFiles()`          | Copy to `build-v2/lib/assets.ts` |
| `tools/package/src/executors/build/lib/paths.ts`  | `resolveOutputPath()`, `resolveTsConfigPath()`, `joinConfigPath()`, `getRelativeProjectPath()` | Copy to `build-v2/lib/paths.ts`  |

### Reference for V2 Implementation

| File                                                     | Relevant Patterns                                                                                                        | Adaptation for V2                                   |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------- |
| `tools/package/src/executors/build/lib/types.ts`         | `AssetConfig`, `EntryPoint`, `EntryPointDiscovery`                                                                       | Extend with format-specific types                   |
| `tools/package/src/executors/build/lib/detect.ts`        | `discoverEntryPoints()`, recursive scanning, categorization                                                              | Use for auto-discovery when `entry` is omitted      |
| `tools/package/src/executors/build/lib/build-unified.ts` | `createEntryPointRollupConfig()`, `createOutputConfigs()`, `createBundleRollupConfig()`, `generateDeclarationsUnified()` | Split into per-format config generators             |
| `tools/package/src/executors/build/lib/package-json.ts`  | `generateExportsFromDiscovery()`, `readProjectPackageJson()`, `writeOutputPackageJson()`                                 | Adapt exports structure for format-specific entries |
| `tools/package/src/executors/build/executor.ts`          | `getExternalDependencies()`, orchestration flow, error handling                                                          | Reference for executor structure                    |

### Key Patterns to Preserve

1. **External dependency detection** — Read `dependencies` + `peerDependencies` from package.json
2. **Rollup plugin configuration** — `nodeResolve`, `commonjs`, `typescript`, `json`, `terser`
3. **Declaration generation** — Use `tsc` directly for consistent `.d.ts` paths
4. **Declaration flattening** — `flattenDeclarationPaths()` for multi-entry libraries
5. **Workspace field inheritance** — Copy `repository`, `bugs`, `homepage`, `author` from root

## Implementation Plan

### Phase 1: Create Build Executor V2

1. Create new executor directory:

   ```
   tools/package/src/executors/build-v2/
   ├── executor.ts                 # Main executor entry point
   ├── schema.json                 # JSON Schema (from spec above)
   └── lib/
       ├── index.ts                # Re-exports all lib modules
       ├── types.ts                # TypeScript types (from spec above)
       ├── assets.ts               # Copied from build v1
       ├── paths.ts                # Copied from build v1
       ├── entry-resolver.ts       # Glob/exact path entry resolution
       ├── externals.ts            # External dependency detection + peer dep inlining
       ├── rollup-plugins.ts       # Shared Rollup plugin factories
       ├── config-esm.ts           # ESM Rollup config generator
       ├── config-cjs.ts           # CJS Rollup config generator
       ├── config-iife.ts          # IIFE Rollup config generator
       ├── config-umd.ts           # UMD Rollup config generator
       ├── declarations.ts         # TypeScript declaration generation
       └── package-json.ts         # Exports field generation for V2
   ```

   **Note:** No spec files are required for this implementation.

2. Register executor in `tools/package/executors.json`:

   ```json
   {
     "executors": {
       "build": { ... },
       "build-v2": {
         "implementation": "./src/executors/build-v2/executor",
         "schema": "./src/executors/build-v2/schema.json",
         "description": "Format-centric build executor with explicit output configuration."
       }
     }
   }
   ```

3. Implement core executor logic:
   - Parse format configurations (`esm`, `cjs`, `iife`, `umd`)
   - For each configured format, resolve entry points
   - Execute format-specific build functions
   - Generate package.json with appropriate exports

4. Implement entry point resolution:
   - Support exact paths (`.`, `./browser`)
   - Support glob patterns (`./browser/*`)
   - Support arrays (`["./browser/v1", "./browser/v2"]`)
   - Respect `exclude` patterns

5. Implement peer dependency inlining for IIFE/UMD:
   - Read `peerDependencies` from package.json
   - Resolve from workspace `node_modules`
   - Bundle into output

### Phase 2: Migrate Library Projects

**Order:** Start with simple libraries, progress to complex

1. `random-generator-utils` — Root only, simple test case
2. `function-utils` — Root only, ESM/CJS only
3. `logging` — Root only, ESM/CJS only
4. `string-utils` — Platform split, IIFE with browser entry
5. `cryptography` — Hybrid, IIFE with browser entry
6. `state-machine` — Feature structure
7. `network-protocol` — Complex, browser bundle
8. `nexus` — Hybrid with inlined peer deps

For each library:

1. Update `project.json` to use `build-v2`
2. Run `npx nx build <project>`
3. Verify output structure
4. Run `npx nx run-many -t=build` to ensure no regressions

### Phase 3: Verification

Run full build verification:

```bash
# Clean previous builds
rm -rf dist/libs

# Build all libraries
npx nx run-many -t=build

# Verify outputs exist
ls -la dist/libs/*/

# Check bundle outputs for configured libraries
ls -la dist/libs/nexus/bundle/
ls -la dist/libs/network-protocol/bundle/
```

### Phase 4: Cleanup (After Verification)

**Only proceed after `npx nx run-many -t=build` completes successfully.**

1. Mark `build` executor as deprecated in `executors.json`:

   ```json
   {
     "build": {
       "description": "[DEPRECATED] Use build-v2. Legacy build executor with implicit configuration."
     }
   }
   ```

2. Update documentation to reference `build-v2`

3. Create migration script or generator:

   ```bash
   npx nx g @hyperfrontend/tools-package:migrate-build-v2
   ```

4. After all projects migrated, remove `build` executor (future release)

## Testing Strategy

**Note:** No unit test spec files are required for this implementation.

### Integration Tests

- Build each library configuration pattern
- Verify output file structure
- Verify package.json exports are correct
- Test CDN bundle loading in browser

### E2E Tests

- `npx nx run-many -t=build` succeeds
- Publish dry-run succeeds
- npm pack produces valid tarball

## Related Files

### Existing (Reference)

- `tools/package/src/executors/build/lib/assets.ts` — Copy to V2
- `tools/package/src/executors/build/lib/paths.ts` — Copy to V2
- `tools/package/executors.json` — Executor registry

### New (Build V2)

- `tools/package/src/executors/build-v2/executor.ts`
- `tools/package/src/executors/build-v2/schema.json`
- `tools/package/src/executors/build-v2/lib/` — All lib modules

### Updated (Migration)

- All `libs/*/project.json` files
