# Dependencies

> **Document**: 12-dependencies.md
> **Library**: `@hyperfrontend/project-scope`
> **Feature**: Dependency management and bundling

---

## Overview

The library follows a **minimal dependencies** philosophy:

1. **Zero runtime dependencies** (external to bundle)
2. **All internal deps bundled** into output
3. **@nx/devkit as optional peer** dependency
4. **Node.js built-ins only** as true externals

---

## Dependency Categories

### Node.js Built-in Modules (External)

These are NOT bundled - they're Node.js built-ins:

| Module         | Usage                              |
| -------------- | ---------------------------------- |
| `node:fs`      | Synchronous file system operations |
| `node:path`    | Path manipulation                  |
| `node:os`      | Platform detection                 |
| `node:process` | Environment variables, cwd         |
| `node:util`    | parseArgs for CLI                  |
| `node:buffer`  | Buffer handling                    |
| `node:crypto`  | Hashing for cache keys             |

```typescript
// Always use node: prefix for clarity
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join, resolve, relative, normalize } from 'node:path'
import { platform, homedir } from 'node:os'
```

---

### Internal @hyperfrontend Dependencies (Bundled)

These are workspace packages that get **bundled into the output**.

| Package                         | Purpose                              | Version   |
| ------------------------------- | ------------------------------------ | --------- |
| `@hyperfrontend/function-utils` | `createRunOnceFunction`, memoization | workspace |
| `@hyperfrontend/json-utils`     | JSON parsing utilities               | workspace |
| `@hyperfrontend/data-utils`     | Data manipulation                    | workspace |
| `@hyperfrontend/logging`        | Logging system                       | workspace |

**Usage in project.json:**

```json
{
  "targets": {
    "build": {
      "options": {
        "bundleWorkspaceDeps": true
      }
    }
  }
}
```

**Why bundle?**

- Single file output (no transitive dependencies)
- Consistent behavior across environments
- No version conflicts with user's dependencies
- Smaller `node_modules` for consumers

---

### Optional Peer Dependencies

| Package      | Purpose                        | When Used                        |
| ------------ | ------------------------------ | -------------------------------- |
| `@nx/devkit` | NX Tree/generators integration | When running inside NX workspace |

**package.json configuration:**

```json
{
  "peerDependencies": {
    "@nx/devkit": ">=18.0.0"
  },
  "peerDependenciesMeta": {
    "@nx/devkit": {
      "optional": true
    }
  }
}
```

**Runtime detection:**

```typescript
// nx/devkit-loader.ts
export function isDevkitAvailable(): boolean {
  try {
    require.resolve('@nx/devkit')
    return true
  } catch {
    return false
  }
}
```

---

### Development Dependencies

Installed in workspace root or project-level:

| Package       | Purpose                              | Version |
| ------------- | ------------------------------------ | ------- |
| `typescript`  | TypeScript compilation               | ^5.9.3  |
| `@types/node` | Node.js type definitions             | ^20.0.0 |
| `jest`        | Testing framework                    | ^30.2.0 |
| `@nx/jest`    | NX Jest executor                     | ^22.3.3 |
| `rollup`      | Bundler (via @hyperfrontend/package) | ^4.0.0  |

---

## Import Patterns

### Internal Dependencies

```typescript
// Import from bundled @hyperfrontend packages
import { createRunOnceFunction } from '@hyperfrontend/function-utils'
import { safeJsonParse } from '@hyperfrontend/json-utils'
import { createLogger } from '@hyperfrontend/logging'

// These imports are resolved and bundled at build time
```

### Node.js Built-ins

```typescript
// Always use node: prefix
import { readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { platform } from 'node:os'

// Never use require() for built-ins in source code
// ❌ const fs = require('fs')
// ✓ import { readFileSync } from 'node:fs'
```

### Optional Peer Dependencies

```typescript
// Dynamic import with fallback
export function getTree(root: string, nxTree?: unknown): Tree {
  // If NX tree provided, wrap it
  if (nxTree && isCompatibleTree(nxTree)) {
    return wrapNxTree(nxTree)
  }

  // Try to load @nx/devkit
  try {
    const devkit = require('@nx/devkit')
    // Use devkit utilities if available
    return new DevkitBackedTree(root, devkit)
  } catch {
    // Fallback to standalone implementation
    return new FsTree(root)
  }
}
```

---

## Bundling Configuration

### Rollup External Config

```javascript
// rollup.config.cjs
module.exports = {
  external: [
    // Node.js built-ins (ALWAYS external)
    /^node:/,

    // Optional peer dependency (external, not bundled)
    '@nx/devkit',

    // Everything else gets bundled
  ],
}
```

### What Gets Bundled

```
@hyperfrontend/project-scope (source)
├── imports @hyperfrontend/function-utils   → BUNDLED
├── imports @hyperfrontend/json-utils       → BUNDLED
├── imports @hyperfrontend/data-utils       → BUNDLED
├── imports @hyperfrontend/logging          → BUNDLED
├── imports node:fs                         → EXTERNAL (built-in)
├── imports node:path                       → EXTERNAL (built-in)
└── requires @nx/devkit                     → EXTERNAL (optional peer)
```

### Output Bundle Structure

```javascript
// dist/index.mjs (simplified)

// Inlined from @hyperfrontend/function-utils
function createRunOnceFunction(fn) { ... }

// Inlined from @hyperfrontend/json-utils
function safeJsonParse(str) { ... }

// Node.js imports remain as imports
import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

// Library code
export function analyzeProject(path) { ... }
export function createTree(root) { ... }
```

---

## Version Constraints

### Node.js Version

```json
{
  "engines": {
    "node": ">=18.0.0"
  }
}
```

**Why Node.js 18+:**

- Native `node:` prefix support
- `parseArgs` in `node:util`
- Stable `fs/promises` (though we use sync)
- LTS support timeline

### TypeScript Version

Target ES2022 features available in Node.js 18+:

- Top-level await
- `Array.prototype.at()`
- `Object.hasOwn()`
- Private class fields
- Error cause

### @nx/devkit Compatibility

```json
{
  "peerDependencies": {
    "@nx/devkit": ">=18.0.0"
  }
}
```

**API compatibility notes:**

- Tree interface stable since NX 15
- Project graph APIs stable since NX 16
- Generator APIs stable since NX 15

---

## Avoiding Dependency Issues

### No `require()` in Source

```typescript
// ❌ Bad - CommonJS require
const fs = require('fs')

// ✓ Good - ES module import
import { readFileSync } from 'node:fs'
```

### No Dynamic Package Imports (except @nx/devkit)

```typescript
// ❌ Bad - dynamic import of arbitrary packages
const pkg = await import(userProvidedPackageName)

// ✓ Good - only dynamic import for optional peers
try {
  const devkit = require('@nx/devkit')
} catch {
  // Fallback
}
```

### No Prototype Pollution

```typescript
// ❌ Bad - modifying built-in prototypes
Array.prototype.customMethod = function () {}

// ✓ Good - standalone functions
export function arrayCustomMethod<T>(arr: T[]): T[] {}
```

---

## Dependency Audit

### Security Scanning

```bash
# Run npm audit on bundled dependencies
npm audit --production

# Check for known vulnerabilities
npx audit-ci --high

# Verify no unexpected dependencies
npx depcheck
```

### Bundle Size Analysis

```bash
# Analyze bundle size
npx bundlephobia @hyperfrontend/project-scope

# Visualize bundle
npx rollup-plugin-visualizer
```

### Expected Bundle Sizes

| Output      | Target Size                       |
| ----------- | --------------------------------- |
| `index.mjs` | < 100 KB                          |
| `index.cjs` | < 100 KB                          |
| `cli.cjs`   | < 50 KB (excluding shared chunks) |
| Total dist  | < 300 KB                          |

---

## Dependency Declaration in package.json

```json
{
  "name": "@hyperfrontend/project-scope",
  "dependencies": {},
  "devDependencies": {
    "@types/node": "^20.0.0"
  },
  "peerDependencies": {
    "@nx/devkit": ">=18.0.0"
  },
  "peerDependenciesMeta": {
    "@nx/devkit": {
      "optional": true
    }
  },
  "bundledDependencies": []
}
```

**Note:** No `dependencies` field. All workspace deps are bundled, Node.js built-ins don't need declaration, and @nx/devkit is optional peer.

---

## Related Documents

- [Build Configuration](./11-build-configuration.md)
- [Architecture](./01-architecture.md)
- [NX Integration](./08-nx-integration.md)
