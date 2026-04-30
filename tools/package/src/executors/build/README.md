# Build Executor

Format-centric build executor for hyperfrontend library packages. A thin wrapper over [`@hyperfrontend/builder`](../../../../../libs/builder/README.md) that hardcodes monorepo conventions (workspace scope, default assets, inheritable fields, memory thresholds, third-party license collection).

## Usage

```json
{
  "build": {
    "executor": "@hyperfrontend/package:build",
    "options": {
      "esm": { "bundleWorkspaceDeps": false },
      "cjs": { "bundleWorkspaceDeps": false },
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

| Option       | Type             | Default                              | Description                                                                                                       |
| ------------ | ---------------- | ------------------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| `outputPath` | `string`         | `dist/{projectRoot}`                 | Output directory. `{projectRoot}` placeholder substituted with the project's path relative to the workspace root. |
| `tsConfig`   | `string`         | `{projectRoot}/tsconfig.lib.json`    | Path to tsconfig. Same `{projectRoot}` placeholder support.                                                       |
| `assets`     | `AssetSpec[]`    | (wrapper-supplied defaults)          | Additional asset specs to copy in addition to the wrapper's defaults (README/CHANGELOG/ARCHITECTURE from project, LICENSE/SECURITY from workspace, FUNDING from workspace when configured). |
| `external`   | `string[]`       | Auto-detected from package.json      | Global externals for all formats.                                                                                 |
| `bin`        | `BinConfig[]`    | —                                    | Bin declarations to synthesize. Source convention: `src/bin/<name>.ts`.                                            |

### `AssetSpec`

| Field      | Type                          | Description                                                                                  |
| ---------- | ----------------------------- | -------------------------------------------------------------------------------------------- |
| `from`     | `string`                      | Absolute source directory.                                                                   |
| `to`       | `string`                      | Output subdirectory relative to `outputPath`. Defaults to the dist root.                     |
| `files`    | `string[]`                    | Explicit relative file names to copy.                                                        |
| `glob`     | `string`                      | POSIX-style glob pattern, evaluated relative to `from`.                                      |

### `BinConfig`

| Field       | Type                                                                          | Description                                                                                            |
| ----------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `name`      | `string`                                                                      | Bin name (also the `package.json#bin` key and the source file basename at `src/bin/<name>.ts`).        |
| `format`    | `'cjs' \| 'esm' \| ('cjs' \| 'esm')[]`                                        | Required output format(s).                                                                             |
| `runner`    | `string`                                                                      | Named runner export to bootstrap. Defaults to the file's `default` export.                             |
| `bootstrap` | `string`                                                                      | Override the bootstrap footer template.                                                                |
| `sea`       | `{ platforms: ('linux-x64' \| 'linux-arm64' \| 'darwin-x64' \| 'darwin-arm64' \| 'win32-x64')[] }` | Opt into Node SEA native binary emission. Builder skips silently when the host doesn't match a declared platform. |

### ESM/CJS Config

| Option                | Type                 | Default      | Description                                                                            |
| --------------------- | -------------------- | ------------ | -------------------------------------------------------------------------------------- |
| `entry`               | `string \| string[]` | All detected | Entry point pattern(s).                                                                |
| `exclude`             | `string \| string[]` | —            | Entry points to exclude.                                                               |
| `sourcemap`           | `boolean`            | `true`       | Generate sourcemaps.                                                                   |
| `external`            | `string[]`           | —            | Additional externals for this format.                                                  |
| `bundleWorkspaceDeps` | `boolean`            | —            | Inline workspace (`@hyperfrontend/*`) packages instead of keeping them external.       |

### IIFE/UMD Config

| Option       | Type                     | Default      | Description                                                  |
| ------------ | ------------------------ | ------------ | ------------------------------------------------------------ |
| `entry`      | `string \| string[]`     | (required)   | Entry point pattern(s).                                      |
| `globalName` | `string`                 | (required)   | Global variable name for browser.                            |
| `minify`     | `boolean`                | `true`       | Generate minified version.                                   |
| `output`     | `string`                 | `bundle`     | Output subdirectory.                                         |
| `sourcemap`  | `boolean`                | `true`       | Generate sourcemaps.                                         |
| `external`   | `string[]`               | —            | Dependencies to keep external (inline by default).           |
| `globals`    | `Record<string, string>` | —            | Global names for each external (required if external is set). |
| `amdId`      | `string` (UMD only)      | package name | AMD module ID.                                               |

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
  "esm": { "bundleWorkspaceDeps": false },
  "cjs": { "bundleWorkspaceDeps": false },
  "iife": { "entry": ".", "globalName": "HyperfrontendLogging" },
  "umd": { "entry": ".", "globalName": "HyperfrontendLogging" }
}
```

### Library with Bins (JS + Native)

```json
{
  "esm": { "bundleWorkspaceDeps": true },
  "cjs": { "bundleWorkspaceDeps": true },
  "bin": [
    {
      "name": "hf-build",
      "format": ["cjs"],
      "sea": { "platforms": ["linux-x64", "linux-arm64", "darwin-x64", "darwin-arm64", "win32-x64"] }
    }
  ]
}
```

### Multiple Bundles

```json
{
  "esm": { "bundleWorkspaceDeps": false },
  "cjs": { "bundleWorkspaceDeps": false },
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
├── bin/                 # JS bins (when configured)
├── types/               # TypeScript declarations
├── package.json         # Generated with exports field + bin field auto-wired
├── README.md
└── LICENSE.md
```

## Notes

- ESM/CJS auto-detect entry points from package.json `exports` field.
- External dependencies auto-detected from `dependencies` + `peerDependencies`.
- TypeScript declarations generated via `tsc` directly (not Rollup plugin).
- Package.json `exports` field regenerated based on built formats.
- Workspace packages (matching `@hyperfrontend/*`) are filtered out of the published `dependencies` map by default.
- `repository`, `bugs`, `homepage`, and `author` are inherited from the workspace root `package.json` if absent on the project.
- A `THIRD_PARTY_LICENSES.md` file is emitted automatically when the published `dependencies` map is non-empty.
- Memory monitoring is enabled with conservative defaults (warn at 512MB heap, critical at 768MB, growth warning at 50MB).
