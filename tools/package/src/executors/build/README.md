# Build Executor

Format-centric build executor for hyperfrontend library packages. All output formats are opt-in — nothing is built unless explicitly configured.

## Usage

```json
{
  "build": {
    "executor": "@hyperfrontend/package:build",
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
```

## Output Formats

| Format   | Use Case                          | Node.js | Browser |
| -------- | --------------------------------- | ------- | ------- |
| **ESM**  | Modern bundlers, native modules   | ✅      | ✅      |
| **CJS**  | Node.js, legacy bundlers          | ✅      | ⚠️      |
| **IIFE** | Browser `<script>` tags, CDN      | ❌      | ✅      |
| **UMD**  | Universal (Browser + AMD + CJS)   | ⚠️      | ✅      |

## Configuration Options

### Global Options

| Option       | Type                       | Default                              | Description                     |
| ------------ | -------------------------- | ------------------------------------ | ------------------------------- |
| `outputPath` | `string`                   | `dist/{projectRoot}`                 | Output directory                |
| `tsConfig`   | `string`                   | `{projectRoot}/tsconfig.lib.json`    | Path to tsconfig                |
| `assets`     | `(string \| AssetConfig)[]`| Default package files                | Additional assets to copy       |
| `external`   | `string[]`                 | Auto-detected from package.json      | Global externals for all formats|

### ESM/CJS Config

| Option      | Type                 | Default      | Description                          |
| ----------- | -------------------- | ------------ | ------------------------------------ |
| `entry`     | `string \| string[]` | All detected | Entry point pattern(s)               |
| `exclude`   | `string \| string[]` | —            | Entry points to exclude              |
| `sourcemap` | `boolean`            | `true`       | Generate sourcemaps                  |
| `external`  | `string[]`           | —            | Additional externals for this format |

### IIFE/UMD Config

| Option       | Type                     | Default      | Description                                                  |
| ------------ | ------------------------ | ------------ | ------------------------------------------------------------ |
| `entry`      | `string \| string[]`     | (required)   | Entry point pattern(s)                                       |
| `globalName` | `string`                 | (required)   | Global variable name for browser                             |
| `minify`     | `boolean`                | `true`       | Generate minified version                                    |
| `output`     | `string`                 | `bundle`     | Output subdirectory                                          |
| `sourcemap`  | `boolean`                | `true`       | Generate sourcemaps                                          |
| `external`   | `string[]`               | —            | Dependencies to keep external (inline by default)            |
| `globals`    | `Record<string, string>` | —            | Global names for each external (required if external is set) |
| `amdId`      | `string` (UMD only)      | package name | AMD module ID                                                |

## Entry Point Patterns

Entry points support exact paths, globs, and arrays:

```json
// Exact path
"entry": "."

// Platform-specific
"entry": "./browser"

// Glob pattern
"entry": "./browser/*"

// Multiple entries
"entry": ["./browser/v1", "./browser/v2"]
```

## IIFE/UMD Dependency Handling

**Default behavior:** All dependencies are inlined into the bundle. This creates self-contained bundles ideal for CDN usage.

**To keep dependencies external:** Specify both `external` and `globals`:

```json
"iife": {
  "entry": ".",
  "globalName": "MyLib",
  "external": ["lodash"],
  "globals": { "lodash": "_" }
}
```

Build **fails** if `external` has entries without corresponding `globals`.

## Examples

### Simple Library (Root Entry)

```json
{
  "esm": {},
  "cjs": {},
  "iife": { "entry": ".", "globalName": "HyperfrontendLogging" },
  "umd": { "entry": ".", "globalName": "HyperfrontendLogging" }
}
```

### Platform-Specific Entry

```json
{
  "esm": {},
  "cjs": {},
  "iife": { "entry": "./browser", "globalName": "HyperfrontendCrypto" },
  "umd": { "entry": "./browser", "globalName": "HyperfrontendCrypto" }
}
```

### Multiple Bundles

```json
{
  "esm": {},
  "cjs": {},
  "iife": [
    { "entry": "./browser/v1", "globalName": "HyperfrontendProtocolV1", "output": "bundle/v1" },
    { "entry": "./browser/v2", "globalName": "HyperfrontendProtocolV2", "output": "bundle/v2" }
  ],
  "umd": [
    { "entry": "./browser/v1", "globalName": "HyperfrontendProtocolV1", "output": "bundle/v1" },
    { "entry": "./browser/v2", "globalName": "HyperfrontendProtocolV2", "output": "bundle/v2" }
  ]
}
```

## File Structure

```
lib/
├── assets.ts            # Asset copying utilities
├── config-cjs.ts        # CJS Rollup config generator
├── config-esm.ts        # ESM Rollup config generator
├── config-iife.ts       # IIFE Rollup config generator
├── config-umd.ts        # UMD Rollup config generator
├── declarations.ts      # TypeScript declaration generation
├── entry-resolver.ts    # Glob/exact path entry resolution
├── externals.ts         # External dependency detection & validation
├── index.ts             # Re-exports all lib modules
├── package-json.ts      # Exports field generation
├── paths.ts             # Path resolution utilities
├── rollup-plugins.ts    # Shared Rollup plugin factories
└── types.ts             # TypeScript types
```

## Build Output

Output is written to `dist/{projectRoot}/` with structure:

```
dist/libs/my-lib/
├── esm/                 # ESM modules
├── cjs/                 # CommonJS modules
├── bundle/              # IIFE/UMD bundles (configurable)
│   ├── my-lib.iife.js
│   ├── my-lib.iife.min.js
│   ├── my-lib.umd.js
│   └── my-lib.umd.min.js
├── types/               # TypeScript declarations
├── package.json         # Generated with exports field
├── README.md
└── LICENSE.md
```

## Notes

- ESM/CJS auto-detect entry points from package.json `exports` field
- External dependencies auto-detected from `dependencies` + `peerDependencies`
- TypeScript declarations generated via `tsc` directly (not Rollup plugin)
- Package.json `exports` field regenerated based on built formats
