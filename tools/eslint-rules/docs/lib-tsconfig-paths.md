# lib-tsconfig-paths

Require that library entry points are mapped in tsconfig.base.json paths.

## Rule Details

This rule ensures that every library's main and secondary entry points (as defined in their `package.json` exports field) have corresponding path mappings in `tsconfig.base.json`'s `compilerOptions.paths`. It also verifies that:

- Path mappings for the same package are co-located and organized
- Path mappings point to files that actually exist
- Path mappings belong to known library packages

### Why?

- **Developer Experience**: TypeScript path aliases enable clean imports like `@hyperfrontend/my-lib/utils` instead of relative paths
- **Consistency**: Ensures all library entry points are importable the same way
- **Organization**: Keeps tsconfig.base.json paths organized by grouping each package's mappings together
- **Completeness**: Prevents forgetting to add path mappings when creating new entry points
- **Cleanliness**: Detects and removes stale path mappings that point to non-existent files or unknown packages

## How It Works

The rule scans the configured `libraryDirectories` for library-type projects (those with `projectType: "library"` in `project.json`). For each library, it reads the `package.json` exports and verifies that each export has a corresponding path mapping.

**Path Mapping Pattern:**

| package.json export                               | tsconfig path alias       | Source path                          |
| ------------------------------------------------- | ------------------------- | ------------------------------------ |
| `".": "./src/index.js"`                           | `@scope/pkg`              | `libs/pkg/src/index.ts`              |
| `"./utils": "./src/utils/index.js"`               | `@scope/pkg/utils`        | `libs/pkg/src/utils/index.ts`        |
| `"./core/helpers": "./src/core/helpers/index.js"` | `@scope/pkg/core/helpers` | `libs/pkg/src/core/helpers/index.ts` |

### Manual Path Mappings

Path mappings that don't correspond to a library's `exports` field are preserved as long as the source file exists. This allows:

- **Nx plugins**: Plugins that use `generators`/`executors` fields instead of `exports`
- **Legacy packages**: Packages that predate the `exports` convention
- **Custom mappings**: Any valid path where the file exists

Only mappings pointing to non-existent files are flagged for removal.

## Examples

### ❌ Incorrect

Library `package.json`:

```json
{
  "name": "@hyperfrontend/my-lib",
  "exports": {
    ".": "./src/index.js",
    "./utils": "./src/utils/index.js"
  }
}
```

Missing from `tsconfig.base.json` paths:

```json
{
  "compilerOptions": {
    "paths": {
      "@hyperfrontend/my-lib": ["libs/my-lib/src/index.ts"]
      // Missing: "@hyperfrontend/my-lib/utils"
    }
  }
}
```

### ✅ Correct

```json
{
  "compilerOptions": {
    "paths": {
      "@hyperfrontend/my-lib": ["libs/my-lib/src/index.ts"],
      "@hyperfrontend/my-lib/utils": ["libs/my-lib/src/utils/index.ts"]
    }
  }
}
```

### Path Organization

Paths for the same package should be co-located:

#### ❌ Incorrect (scattered)

```json
{
  "paths": {
    "@hyperfrontend/lib-a": ["libs/lib-a/src/index.ts"],
    "@hyperfrontend/lib-b": ["libs/lib-b/src/index.ts"],
    "@hyperfrontend/lib-a/utils": ["libs/lib-a/src/utils/index.ts"]
  }
}
```

#### ✅ Correct (grouped)

```json
{
  "paths": {
    "@hyperfrontend/lib-a": ["libs/lib-a/src/index.ts"],
    "@hyperfrontend/lib-a/utils": ["libs/lib-a/src/utils/index.ts"],
    "@hyperfrontend/lib-b": ["libs/lib-b/src/index.ts"]
  }
}
```

### Orphan Paths

The rule detects stale path mappings where the source file no longer exists:

#### ❌ Incorrect (orphan paths)

```json
{
  "paths": {
    "@hyperfrontend/my-lib": ["libs/my-lib/src/index.ts"],
    "@hyperfrontend/my-lib/deleted": ["libs/my-lib/src/deleted/index.ts"], // File doesn't exist
    "@hyperfrontend/unknown-pkg": ["libs/unknown/src/index.ts"] // File doesn't exist
  }
}
```

Note: A path mapping for an "unknown" package (one without `exports` in `package.json`) is preserved if the source file exists. This supports Nx plugins and other packages that don't use the `exports` convention.

## Autofix

This rule provides automatic fixing:

1. **Missing mappings**: Adds the missing path mapping in the correct position to keep paths co-located by package
2. **Path organization**: Reorganizes scattered paths to group them by package, maintaining alphabetical order
3. **Orphan paths**: Removes path mappings that point to non-existent files
4. **Stale unknown packages**: Removes path mappings for entries that don't match any library AND where the file doesn't exist

## Options

### `libraryDirectories` (required)

An array of directory paths (relative to workspace root) to scan for library-type projects. Each directory is recursively searched for projects with `projectType: "library"` in their `project.json`.

### `excludePatterns` (optional)

An array of directory path segments to exclude from scanning. Any path containing one of these segments will be skipped. This is useful for excluding test fixtures or other non-library directories.

### Example Configuration

```javascript
// eslint.config.cjs
module.exports = [
  {
    files: ['tsconfig.base.json'],
    rules: {
      '@hyperfrontend/lib-tsconfig-paths': [
        'error',
        {
          libraryDirectories: ['libs', 'plugins', 'tools'],
          excludePatterns: ['__fixtures__', 'node_modules'],
        },
      ],
    },
  },
]
```

With this configuration:

- Libraries in `libs/`, `plugins/`, and `tools/` directories are scanned
- Directories containing `__fixtures__` or `node_modules` in their path are skipped
- All discovered library entry points must have corresponding tsconfig path mappings

## When Not To Use It

- If you have a non-standard tsconfig setup
- If you intentionally want some entry points to not have path aliases

## Related Rules

- [lib-pkg-exports-exist](./lib-pkg-exports-exist.md) - Validates that export paths point to existing files
- [lib-pkg-bundle-entry](./lib-pkg-bundle-entry.md) - Validates bundle entry point configuration
