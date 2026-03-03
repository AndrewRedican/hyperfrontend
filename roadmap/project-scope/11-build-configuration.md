# Build Configuration

> **Document**: 11-build-configuration.md
> **Library**: `@hyperfrontend/project-scope`
> **Feature**: Build pipeline and output formats

---

## Overview

Build configuration follows hyperfrontend workspace conventions:

- **Bundler**: Uses `@hyperfrontend/package:build` executor (Rollup-based)
- **Output formats**: CJS and ESM (no IIFE/UMD)
- **Dependencies**: All bundled (no external except peer deps)
- **TypeScript**: Generate declaration files

---

## Project Configuration

### project.json

```json
{
  "$schema": "../../node_modules/nx/schemas/project-schema.json",
  "name": "project-scope",
  "sourceRoot": "libs/project-scope/src",
  "projectType": "library",
  "targets": {
    "build": {
      "executor": "@hyperfrontend/package:build",
      "outputs": ["{options.outputPath}"],
      "options": {
        "outputPath": "dist/libs/project-scope",
        "tsConfig": "libs/project-scope/tsconfig.lib.json",
        "entryPoints": ["libs/project-scope/src/index.ts", "libs/project-scope/src/cli/index.ts"],
        "packageJson": "libs/project-scope/package.json",
        "rollupConfig": "libs/project-scope/rollup.config.cjs",
        "bundleWorkspaceDeps": true,
        "assets": ["libs/project-scope/README.md", "libs/project-scope/CHANGELOG.md"]
      }
    },
    "test": {
      "executor": "@nx/jest:jest",
      "outputs": ["{workspaceRoot}/coverage/{projectRoot}"],
      "options": {
        "jestConfig": "libs/project-scope/jest.config.ts",
        "passWithNoTests": false
      }
    },
    "lint": {
      "executor": "@nx/eslint:lint",
      "outputs": ["{options.outputFile}"],
      "options": {
        "lintFilePatterns": ["libs/project-scope/**/*.ts"]
      }
    }
  },
  "tags": ["scope:libs", "type:library"]
}
```

---

## Rollup Configuration

```javascript
// libs/project-scope/rollup.config.cjs
const { createRollupConfig } = require('@hyperfrontend/package/rollup')

module.exports = createRollupConfig({
  // Main library entry
  input: {
    index: 'src/index.ts',
    cli: 'src/cli/index.ts',
  },

  // Output both CJS and ESM
  output: [
    {
      dir: 'dist',
      format: 'cjs',
      entryFileNames: '[name].cjs',
      chunkFileNames: 'chunks/[name]-[hash].cjs',
      sourcemap: true,
      exports: 'named',
      // Banner for CLI
      banner: (chunk) => {
        if (chunk.name === 'cli') {
          return '#!/usr/bin/env node\n'
        }
        return ''
      },
    },
    {
      dir: 'dist',
      format: 'es',
      entryFileNames: '[name].mjs',
      chunkFileNames: 'chunks/[name]-[hash].mjs',
      sourcemap: true,
    },
  ],

  // Bundle all dependencies
  external: [
    // Only Node.js built-ins are external
    /^node:/,
    // Optional peer dependency
    '@nx/devkit',
  ],

  // Plugins
  plugins: {
    // TypeScript
    typescript: {
      tsconfig: 'tsconfig.lib.json',
      declaration: true,
      declarationDir: 'dist/types',
    },

    // Node resolve for dependencies
    nodeResolve: {
      preferBuiltins: true,
    },

    // CommonJS interop
    commonjs: {
      include: /node_modules/,
    },

    // Bundle JSON files
    json: true,

    // Minification (optional, for production)
    // terser: process.env.NODE_ENV === 'production',
  },

  // Tree-shaking
  treeshake: {
    moduleSideEffects: false,
    propertyReadSideEffects: false,
    tryCatchDeoptimization: false,
  },
})
```

---

## TypeScript Configuration

### tsconfig.lib.json

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "outDir": "./dist/types",
    "declaration": true,
    "declarationMap": true,
    "emitDeclarationOnly": true,
    "rootDir": "./src",
    "types": ["node"]
  },
  "include": ["src/**/*.ts"],
  "exclude": ["src/**/*.spec.ts", "src/**/*.test.ts", "src/**/__tests__/**", "src/**/__fixtures__/**"]
}
```

### tsconfig.json

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "bundler",
    "lib": ["ES2022"],
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "exactOptionalPropertyTypes": true,
    "noUncheckedIndexedAccess": true
  },
  "include": ["src/**/*.ts"],
  "references": [{ "path": "./tsconfig.lib.json" }, { "path": "./tsconfig.spec.json" }]
}
```

### tsconfig.spec.json

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "outDir": "./dist/test",
    "types": ["jest", "node"]
  },
  "include": ["src/**/*.spec.ts", "src/**/*.test.ts", "src/**/__tests__/**/*.ts"]
}
```

---

## Package.json

```json
{
  "name": "@hyperfrontend/project-scope",
  "version": "0.0.1",
  "description": "Project structure analysis and intelligent configuration inference",
  "author": "Hyperfrontend",
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "https://github.com/nicholasgalante1997/hyperfrontend.git",
    "directory": "libs/project-scope"
  },
  "keywords": ["project-analysis", "workspace", "monorepo", "nx", "vfs", "tree", "framework-detection"],
  "type": "module",
  "exports": {
    ".": {
      "import": {
        "types": "./dist/types/index.d.ts",
        "default": "./dist/index.mjs"
      },
      "require": {
        "types": "./dist/types/index.d.ts",
        "default": "./dist/index.cjs"
      }
    },
    "./package.json": "./package.json"
  },
  "main": "./dist/index.cjs",
  "module": "./dist/index.mjs",
  "types": "./dist/types/index.d.ts",
  "bin": {
    "project-scope": "./dist/cli.cjs"
  },
  "files": ["dist", "README.md", "CHANGELOG.md"],
  "engines": {
    "node": ">=18.0.0"
  },
  "peerDependencies": {
    "@nx/devkit": ">=18.0.0"
  },
  "peerDependenciesMeta": {
    "@nx/devkit": {
      "optional": true
    }
  },
  "dependencies": {},
  "devDependencies": {
    "@types/node": "^20.0.0"
  },
  "sideEffects": false
}
```

---

## Output Structure

```
dist/libs/project-scope/
├── index.cjs                  # CJS main bundle
├── index.cjs.map              # Source map
├── index.mjs                  # ESM main bundle
├── index.mjs.map              # Source map
├── cli.cjs                    # CLI bundle (with shebang)
├── cli.cjs.map                # Source map
├── cli.mjs                    # CLI ESM bundle
├── cli.mjs.map                # Source map
├── chunks/                    # Shared code chunks
│   ├── core-[hash].cjs
│   ├── core-[hash].mjs
│   ├── vfs-[hash].cjs
│   └── vfs-[hash].mjs
├── types/                     # TypeScript declarations
│   ├── index.d.ts
│   ├── index.d.ts.map
│   ├── core/
│   │   ├── fs/
│   │   │   └── index.d.ts
│   │   └── ...
│   ├── vfs/
│   │   └── index.d.ts
│   └── ...
├── package.json               # Distribution package.json
├── README.md
└── CHANGELOG.md
```

---

## Build Scripts

### NX Commands

```bash
# Build library
nx build project-scope

# Build with watch
nx build project-scope --watch

# Build for production
NODE_ENV=production nx build project-scope

# Build affected libraries
nx affected:build

# Run tests
nx test project-scope

# Run E2E tests
nx e2e project-scope-e2e

# Lint
nx lint project-scope

# Generate docs
nx run project-scope:docs
```

---

## Code Chunking Strategy

Rollup automatically creates chunks for shared code. Key considerations:

1. **Core utilities** → Shared chunk (used by all modules)
2. **VFS module** → Own chunk or inline
3. **Tech detectors** → Lazy-loaded chunks (tree-shaken if unused)
4. **CLI** → Separate entry point with own bundle

### Optimization Settings

```javascript
// rollup.config.cjs (additional)
{
  // Manual chunk assignment (optional)
  manualChunks: (id) => {
    if (id.includes('core/fs') || id.includes('core/path')) {
      return 'core'
    }
    if (id.includes('vfs/')) {
      return 'vfs'
    }
    if (id.includes('tech/') || id.includes('heuristics/')) {
      return 'detection'
    }
    if (id.includes('nx/')) {
      return 'nx'
    }
    return null // Default chunking
  },
}
```

---

## Build Verification

### Post-build Checks

```typescript
// tools/scripts/verify-build.ts
import { existsSync, statSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const distPath = 'dist/libs/project-scope'

const requiredFiles = ['index.cjs', 'index.mjs', 'cli.cjs', 'types/index.d.ts', 'package.json']

function verify(): void {
  console.log('Verifying build output...\n')

  let passed = 0
  let failed = 0

  for (const file of requiredFiles) {
    const filePath = join(distPath, file)

    if (existsSync(filePath)) {
      const stats = statSync(filePath)
      console.log(`✓ ${file} (${(stats.size / 1024).toFixed(1)} KB)`)
      passed++
    } else {
      console.log(`✗ ${file} MISSING`)
      failed++
    }
  }

  // Verify exports
  const packageJson = JSON.parse(readFileSync(join(distPath, 'package.json'), 'utf-8'))

  if (packageJson.exports) {
    console.log('✓ package.json has exports field')
    passed++
  } else {
    console.log('✗ package.json missing exports field')
    failed++
  }

  // Verify CLI shebang
  const cliContent = readFileSync(join(distPath, 'cli.cjs'), 'utf-8')
  if (cliContent.startsWith('#!/usr/bin/env node')) {
    console.log('✓ CLI has shebang')
    passed++
  } else {
    console.log('✗ CLI missing shebang')
    failed++
  }

  console.log(`\nTotal: ${passed} passed, ${failed} failed`)

  if (failed > 0) {
    process.exit(1)
  }
}

verify()
```

---

## Related Documents

- [Dependencies](./12-dependencies.md)
- [CLI Design](./10-cli-design.md)
- [Architecture](./01-architecture.md)
