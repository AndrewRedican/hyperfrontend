# Project Module

The `project` module provides utilities for analyzing project structure, finding configuration files, reading package.json, discovering project roots, and traversing file trees.

## Capabilities

### Configuration Detection

Find and analyze configuration files in a project.

```typescript
import { detectConfigs, findConfigFile } from '@hyperfrontend/project-scope'

// Detect all configuration files
const configs = detectConfigs('./my-project')
for (const config of configs) {
  console.log(`${config.type}: ${config.path}`)
}
// Output:
// typescript: tsconfig.json
// eslint: eslint.config.js
// jest: jest.config.ts
// prettier: .prettierrc

// Detect specific config types
const tsConfigs = detectConfigs('./my-project', ['typescript', 'eslint'])

// Find specific config file
const eslintConfig = findConfigFile('./my-project', 'eslint')
// Returns: './my-project/eslint.config.js'
```

#### Supported Config Types

| Type         | Example Files                                     |
| ------------ | ------------------------------------------------- |
| `typescript` | `tsconfig.json`, `tsconfig.*.json`                |
| `eslint`     | `.eslintrc`, `eslint.config.js`, `.eslintrc.json` |
| `prettier`   | `.prettierrc`, `prettier.config.js`               |
| `jest`       | `jest.config.ts`, `jest.config.js`                |
| `vitest`     | `vitest.config.ts`                                |
| `babel`      | `babel.config.js`, `.babelrc`                     |
| `webpack`    | `webpack.config.js`                               |
| `vite`       | `vite.config.ts`                                  |
| `rollup`     | `rollup.config.js`                                |
| `nx`         | `nx.json`, `project.json`                         |
| `docker`     | `Dockerfile`, `docker-compose.yml`                |
| `env`        | `.env`, `.env.*`                                  |

### Package.json Utilities

Read and analyze package.json files.

```typescript
import {
  readPackageJson,
  readPackageJsonIfExists,
  findNearestPackageJson,
  getDependencyVersion,
  hasDependency,
} from '@hyperfrontend/project-scope'

// Read package.json
const pkg = readPackageJson('./my-project')
console.log(pkg.name, pkg.version)
console.log(pkg.dependencies)
console.log(pkg.scripts)

// Safe reading (returns null if not found)
const pkg2 = readPackageJsonIfExists('./maybe-project')

// Find nearest package.json from any path
const pkgPath = findNearestPackageJson('./src/utils/deep/file.ts')
// Returns: './src/package.json' or '../package.json'

// Check dependencies
if (hasDependency(pkg, 'react')) {
  const version = getDependencyVersion(pkg, 'react')
  console.log('React version:', version) // '^18.2.0'
}
```

### Root Detection

Find project and workspace roots from any path.

```typescript
import { findProjectRoot, findWorkspaceRoot } from '@hyperfrontend/project-scope'

// Find project root (nearest package.json with source files)
const projectRoot = findProjectRoot('./libs/my-lib/src/utils/helper.ts')
// Returns: './libs/my-lib'

// Find workspace/monorepo root
const workspaceRoot = findWorkspaceRoot('./libs/my-lib')
// Returns: './' (root with nx.json, turbo.json, etc.)
```

#### Root Markers

**Project root markers:**

- `package.json` (with `src/` directory or entry files)
- `project.json` (NX project)

**Workspace root markers:**

- `nx.json`
- `turbo.json`
- `lerna.json`
- `pnpm-workspace.yaml`
- `rush.json`
- `package.json` with `workspaces` field

### File Traversal

Search and walk through project files.

```typescript
import { findFiles, walkDirectory, walkTree } from '@hyperfrontend/project-scope'

// Find files by glob pattern
const tsFiles = findFiles('./src', '**/*.ts')
const configFiles = findFiles('./', ['*.json', '*.yaml'])

// With options
const limited = findFiles('./src', '**/*.ts', {
  maxResults: 10,
  absolutePaths: true,
  maxDepth: 5,
})

// Walk directory with callback
walkDirectory('./src', (entry) => {
  if (entry.isFile && entry.name.endsWith('.ts')) {
    console.log('Found:', entry.relativePath)
  }
  // Return 'skip' to skip directory, 'stop' to stop walking
})

// Walk virtual file system tree
walkTree(tree, tree.root, (entry) => {
  console.log(entry.path, entry.isFile ? 'file' : 'directory')
})
```

## Architecture

```
project/
├── config/                # Configuration detection
│   ├── detect.ts         # Config file detection
│   ├── patterns.ts       # Config file patterns
│   └── parse.ts          # Config parsing
├── package/               # package.json utilities
│   ├── read.ts           # Read and parse package.json
│   └── dependencies.ts   # Dependency analysis
├── root/                  # Root detection
│   └── detect.ts         # Project/workspace root finding
├── traversal/             # File traversal
│   ├── search.ts         # Glob-based file search
│   └── walk.ts           # Directory walking
└── index.ts              # Public exports
```

## Interfaces

### PackageJson

```typescript
interface PackageJson {
  name?: string
  version?: string
  description?: string
  main?: string
  module?: string
  browser?: string
  types?: string
  bin?: string | Record<string, string>
  scripts?: Record<string, string>
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
  peerDependencies?: Record<string, string>
  optionalDependencies?: Record<string, string>
  workspaces?: string[] | { packages: string[] }
  exports?: Record<string, unknown>
  engines?: Record<string, string>
  [key: string]: unknown
}
```

### DetectedConfig

```typescript
interface DetectedConfig {
  /** Config type (e.g., 'typescript', 'eslint') */
  type: ConfigType
  /** File path relative to root */
  path: string
  /** Pattern that matched */
  matchedPattern: string
  /** Pattern info */
  info: ConfigPatternInfo
}
```

### DirectoryEntry

```typescript
interface DirectoryEntry {
  /** File/directory name */
  name: string
  /** Full path */
  path: string
  /** Relative path from start */
  relativePath: string
  /** Is a file */
  isFile: boolean
  /** Is a directory */
  isDirectory: boolean
  /** Traversal depth */
  depth: number
}
```

## Design Principles

1. **Caching**: All detection functions cache results appropriately
2. **Safe operations**: `*IfExists` variants return null instead of throwing
3. **Flexible patterns**: Support for multiple glob patterns
4. **Depth control**: Configurable traversal depth limits
5. **Cross-platform**: Works on Windows, macOS, and Linux
