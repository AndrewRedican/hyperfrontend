# Testing Strategy

> **Document**: 09-testing-strategy.md
> **Library**: `@hyperfrontend/project-scope`
> **Feature**: Comprehensive test approach

---

## Overview

Testing strategy encompasses:

1. **Unit tests**: Isolated function/module testing
2. **Integration tests**: Cross-module testing
3. **E2E tests**: Full workflow validation (CJS + ESM)
4. **Fixture-based tests**: Real project structure testing

---

## Testing Framework

**Jest 30.2.0** with configuration aligned to workspace patterns.

```typescript
// libs/project-scope/jest.config.ts
import { getJestProjects } from '@nx/jest'

export default {
  displayName: 'project-scope',
  preset: '../../jest.preset.cjs',
  testEnvironment: 'node',
  transform: {
    '^.+\\.[tj]s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
  },
  moduleFileExtensions: ['ts', 'js', 'json'],
  coverageDirectory: '../../coverage/libs/project-scope',
  collectCoverageFrom: ['src/**/*.ts', '!src/**/*.d.ts', '!src/**/__fixtures__/**', '!src/**/index.ts'],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
}
```

---

## Directory Structure

```
libs/project-scope/
├── src/
│   ├── __fixtures__/          # Shared test fixtures
│   │   ├── minimal-project/   # Minimal valid project
│   │   ├── react-vite/        # React + Vite project
│   │   ├── angular-nx/        # Angular + NX project
│   │   ├── monorepo/          # Multi-project workspace
│   │   ├── legacy-webpack/    # Legacy webpack config
│   │   └── empty/             # Empty directory
│   │
│   ├── core/
│   │   ├── fs/
│   │   │   ├── __tests__/
│   │   │   │   ├── read.spec.ts
│   │   │   │   ├── write.spec.ts
│   │   │   │   ├── stat.spec.ts
│   │   │   │   └── directory.spec.ts
│   │   │   └── index.ts
│   │   │
│   │   ├── path/
│   │   │   ├── __tests__/
│   │   │   │   └── path.spec.ts
│   │   │   └── index.ts
│   │   │
│   │   └── ...
│   │
│   ├── project/
│   │   ├── traversal/
│   │   │   ├── __tests__/
│   │   │   │   ├── walk.spec.ts
│   │   │   │   └── find.spec.ts
│   │   │   └── index.ts
│   │   │
│   │   └── ...
│   │
│   ├── vfs/
│   │   ├── __tests__/
│   │   │   ├── fs-tree.spec.ts
│   │   │   ├── commit.spec.ts
│   │   │   └── diff.spec.ts
│   │   └── index.ts
│   │
│   └── ...
│
└── apps/package-e2e/project-scope/
    ├── src/
    │   ├── cjs.spec.ts         # CommonJS import tests
    │   └── esm.spec.ts         # ESM import tests
    ├── jest.config.ts
    └── project.json
```

---

## Unit Testing Patterns

### Core FS Module Tests

```typescript
// core/fs/__tests__/read.spec.ts
import { join } from 'node:path'
import { mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { readFileContent, readTextFile, readBinaryFile, readJsonFile } from '../read'

describe('core/fs/read', () => {
  const fixturesDir = join(__dirname, '../../__fixtures__/temp-read-tests')

  beforeAll(() => {
    mkdirSync(fixturesDir, { recursive: true })

    // Create test files
    writeFileSync(join(fixturesDir, 'text.txt'), 'Hello, World!')
    writeFileSync(join(fixturesDir, 'utf16.txt'), Buffer.from('Hello', 'utf16le'))
    writeFileSync(join(fixturesDir, 'binary.bin'), Buffer.from([0x00, 0x01, 0x02]))
    writeFileSync(join(fixturesDir, 'config.json'), '{"key": "value"}')
    writeFileSync(join(fixturesDir, 'invalid.json'), 'not json{')
  })

  afterAll(() => {
    rmSync(fixturesDir, { recursive: true, force: true })
  })

  describe('readTextFile', () => {
    it('should read UTF-8 text file', () => {
      const content = readTextFile(join(fixturesDir, 'text.txt'))
      expect(content).toBe('Hello, World!')
    })

    it('should read file with specified encoding', () => {
      const content = readTextFile(join(fixturesDir, 'utf16.txt'), 'utf16le')
      expect(content).toBe('Hello')
    })

    it('should return null for non-existent file', () => {
      const content = readTextFile(join(fixturesDir, 'missing.txt'))
      expect(content).toBeNull()
    })

    it('should return null for directory', () => {
      const content = readTextFile(fixturesDir)
      expect(content).toBeNull()
    })
  })

  describe('readBinaryFile', () => {
    it('should read binary file as Buffer', () => {
      const content = readBinaryFile(join(fixturesDir, 'binary.bin'))
      expect(content).toBeInstanceOf(Buffer)
      expect(content).toEqual(Buffer.from([0x00, 0x01, 0x02]))
    })
  })

  describe('readJsonFile', () => {
    it('should read and parse JSON file', () => {
      const content = readJsonFile<{ key: string }>(join(fixturesDir, 'config.json'))
      expect(content).toEqual({ key: 'value' })
    })

    it('should throw on invalid JSON', () => {
      expect(() => {
        readJsonFile(join(fixturesDir, 'invalid.json'))
      }).toThrow()
    })

    it('should return default value when file missing', () => {
      const content = readJsonFile(join(fixturesDir, 'missing.json'), { default: {} })
      expect(content).toEqual({})
    })
  })
})
```

### VFS Tree Tests

```typescript
// vfs/__tests__/fs-tree.spec.ts
import { join } from 'node:path'
import { mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from 'node:fs'
import { FsTree } from '../fs-tree'
import { commitChanges } from '../commit'

describe('FsTree', () => {
  const testRoot = join(__dirname, '../__fixtures__/temp-tree-tests')

  beforeEach(() => {
    rmSync(testRoot, { recursive: true, force: true })
    mkdirSync(testRoot, { recursive: true })

    // Setup initial structure
    mkdirSync(join(testRoot, 'src'))
    writeFileSync(join(testRoot, 'src/index.ts'), 'export const a = 1')
    writeFileSync(join(testRoot, 'package.json'), '{"name": "test"}')
  })

  afterEach(() => {
    rmSync(testRoot, { recursive: true, force: true })
  })

  describe('read', () => {
    it('should read existing file as Buffer', () => {
      const tree = new FsTree(testRoot)
      const content = tree.read('src/index.ts')

      expect(content).toBeInstanceOf(Buffer)
      expect(content?.toString()).toBe('export const a = 1')
    })

    it('should read existing file as string when encoding provided', () => {
      const tree = new FsTree(testRoot)
      const content = tree.read('src/index.ts', 'utf-8')

      expect(typeof content).toBe('string')
      expect(content).toBe('export const a = 1')
    })

    it('should return buffered content after write', () => {
      const tree = new FsTree(testRoot)

      tree.write('src/index.ts', 'export const b = 2')
      const content = tree.read('src/index.ts', 'utf-8')

      expect(content).toBe('export const b = 2')
    })

    it('should return null after delete', () => {
      const tree = new FsTree(testRoot)

      tree.delete('src/index.ts')
      const content = tree.read('src/index.ts')

      expect(content).toBeNull()
    })

    it('should return null for non-existent file', () => {
      const tree = new FsTree(testRoot)
      const content = tree.read('missing.ts')

      expect(content).toBeNull()
    })
  })

  describe('write', () => {
    it('should buffer new file creation', () => {
      const tree = new FsTree(testRoot)

      tree.write('src/new.ts', 'export const c = 3')

      // File should not exist on disk yet
      expect(existsSync(join(testRoot, 'src/new.ts'))).toBe(false)

      // But should be readable from tree
      expect(tree.read('src/new.ts', 'utf-8')).toBe('export const c = 3')

      // And should be in changes
      const changes = tree.listChanges()
      expect(changes).toHaveLength(1)
      expect(changes[0]).toMatchObject({
        path: 'src/new.ts',
        type: 'CREATE',
      })
    })

    it('should buffer file update', () => {
      const tree = new FsTree(testRoot)

      tree.write('src/index.ts', 'export const updated = true')

      const changes = tree.listChanges()
      expect(changes).toHaveLength(1)
      expect(changes[0]).toMatchObject({
        path: 'src/index.ts',
        type: 'UPDATE',
      })
    })
  })

  describe('delete', () => {
    it('should buffer file deletion', () => {
      const tree = new FsTree(testRoot)

      tree.delete('src/index.ts')

      // File should still exist on disk
      expect(existsSync(join(testRoot, 'src/index.ts'))).toBe(true)

      // But tree should report it as non-existent
      expect(tree.exists('src/index.ts')).toBe(false)

      // And should be in changes
      const changes = tree.listChanges()
      expect(changes).toHaveLength(1)
      expect(changes[0]).toMatchObject({
        path: 'src/index.ts',
        type: 'DELETE',
      })
    })

    it('should remove buffered create when deleting new file', () => {
      const tree = new FsTree(testRoot)

      tree.write('src/new.ts', 'content')
      tree.delete('src/new.ts')

      // No changes should remain
      const changes = tree.listChanges()
      expect(changes).toHaveLength(0)
    })
  })

  describe('exists', () => {
    it('should return true for existing file', () => {
      const tree = new FsTree(testRoot)
      expect(tree.exists('src/index.ts')).toBe(true)
    })

    it('should return true for buffered new file', () => {
      const tree = new FsTree(testRoot)
      tree.write('src/new.ts', 'content')
      expect(tree.exists('src/new.ts')).toBe(true)
    })

    it('should return false for deleted file', () => {
      const tree = new FsTree(testRoot)
      tree.delete('src/index.ts')
      expect(tree.exists('src/index.ts')).toBe(false)
    })

    it('should return true for existing directory', () => {
      const tree = new FsTree(testRoot)
      expect(tree.exists('src')).toBe(true)
    })
  })

  describe('children', () => {
    it('should list directory children', () => {
      const tree = new FsTree(testRoot)
      const children = tree.children('.')

      expect(children).toContain('src')
      expect(children).toContain('package.json')
    })

    it('should include buffered new files', () => {
      const tree = new FsTree(testRoot)
      tree.write('newfile.ts', 'content')

      const children = tree.children('.')
      expect(children).toContain('newfile.ts')
    })

    it('should exclude deleted files', () => {
      const tree = new FsTree(testRoot)
      tree.delete('package.json')

      const children = tree.children('.')
      expect(children).not.toContain('package.json')
    })

    it('should include implied directories from deep creates', () => {
      const tree = new FsTree(testRoot)
      tree.write('new/deep/file.ts', 'content')

      const children = tree.children('.')
      expect(children).toContain('new')

      const newChildren = tree.children('new')
      expect(newChildren).toContain('deep')
    })
  })
})

describe('commitChanges', () => {
  const testRoot = join(__dirname, '../__fixtures__/temp-commit-tests')

  beforeEach(() => {
    rmSync(testRoot, { recursive: true, force: true })
    mkdirSync(testRoot, { recursive: true })
    writeFileSync(join(testRoot, 'existing.txt'), 'original')
  })

  afterEach(() => {
    rmSync(testRoot, { recursive: true, force: true })
  })

  it('should create new files on disk', () => {
    const tree = new FsTree(testRoot)
    tree.write('new.txt', 'new content')

    const result = commitChanges(tree)

    expect(result.created).toBe(1)
    expect(existsSync(join(testRoot, 'new.txt'))).toBe(true)
    expect(readFileSync(join(testRoot, 'new.txt'), 'utf-8')).toBe('new content')
  })

  it('should update existing files', () => {
    const tree = new FsTree(testRoot)
    tree.write('existing.txt', 'updated content')

    const result = commitChanges(tree)

    expect(result.updated).toBe(1)
    expect(readFileSync(join(testRoot, 'existing.txt'), 'utf-8')).toBe('updated content')
  })

  it('should delete files', () => {
    const tree = new FsTree(testRoot)
    tree.delete('existing.txt')

    const result = commitChanges(tree)

    expect(result.deleted).toBe(1)
    expect(existsSync(join(testRoot, 'existing.txt'))).toBe(false)
  })

  it('should create parent directories', () => {
    const tree = new FsTree(testRoot)
    tree.write('deep/nested/path/file.txt', 'content')

    commitChanges(tree)

    expect(existsSync(join(testRoot, 'deep/nested/path/file.txt'))).toBe(true)
  })

  it('should not write in dry run mode', () => {
    const tree = new FsTree(testRoot)
    tree.write('new.txt', 'new content')

    const result = commitChanges(tree, { dryRun: true })

    expect(result.created).toBe(1)
    expect(existsSync(join(testRoot, 'new.txt'))).toBe(false)
  })
})
```

---

## Integration Tests

### Framework Detection Integration

```typescript
// __tests__/integration/framework-detection.spec.ts
import { join } from 'node:path'
import { mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { analyzeProject } from '../../analyze'
import { identifyFrameworks } from '../../heuristics/framework'

describe('Framework Detection Integration', () => {
  const fixturesBase = join(__dirname, '../__fixtures__')

  describe('React + Vite project', () => {
    const projectDir = join(fixturesBase, 'react-vite')

    beforeAll(() => {
      mkdirSync(projectDir, { recursive: true })

      writeFileSync(
        join(projectDir, 'package.json'),
        JSON.stringify({
          name: 'react-vite-app',
          dependencies: {
            react: '^18.2.0',
            'react-dom': '^18.2.0',
          },
          devDependencies: {
            vite: '^5.0.0',
            '@vitejs/plugin-react': '^4.0.0',
          },
        })
      )

      writeFileSync(
        join(projectDir, 'vite.config.ts'),
        `
        import { defineConfig } from 'vite'
        import react from '@vitejs/plugin-react'
        export default defineConfig({ plugins: [react()] })
      `
      )

      mkdirSync(join(projectDir, 'src'), { recursive: true })
      writeFileSync(
        join(projectDir, 'src/App.tsx'),
        `
        import React from 'react'
        export function App() { return <div>Hello</div> }
      `
      )
    })

    afterAll(() => {
      rmSync(projectDir, { recursive: true, force: true })
    })

    it('should detect React framework', () => {
      const result = identifyFrameworks(projectDir)

      expect(result.stack.frontend).toContain('react')
      expect(result.primary?.id).toBe('react')
    })

    it('should detect Vite build tool', () => {
      const result = identifyFrameworks(projectDir)

      expect(result.stack.build).toContain('vite')
    })

    it('should provide full analysis', () => {
      const analysis = analyzeProject(projectDir)

      expect(analysis.workspaceType).toBe('standalone')
      expect(analysis.projectType).toBe('application')
      expect(analysis.buildTool?.id).toBe('vite')
      expect(analysis.frameworks).toContainEqual(expect.objectContaining({ id: 'react' }))
    })
  })

  describe('NX Monorepo', () => {
    const workspaceDir = join(fixturesBase, 'nx-monorepo')

    beforeAll(() => {
      mkdirSync(workspaceDir, { recursive: true })
      mkdirSync(join(workspaceDir, 'apps/frontend'), { recursive: true })
      mkdirSync(join(workspaceDir, 'libs/shared'), { recursive: true })

      writeFileSync(
        join(workspaceDir, 'package.json'),
        JSON.stringify({
          name: 'nx-workspace',
          private: true,
          devDependencies: {
            nx: '^18.0.0',
          },
        })
      )

      writeFileSync(
        join(workspaceDir, 'nx.json'),
        JSON.stringify({
          workspaceLayout: {
            appsDir: 'apps',
            libsDir: 'libs',
          },
        })
      )

      writeFileSync(
        join(workspaceDir, 'apps/frontend/project.json'),
        JSON.stringify({
          name: 'frontend',
          projectType: 'application',
          targets: {},
        })
      )

      writeFileSync(
        join(workspaceDir, 'libs/shared/project.json'),
        JSON.stringify({
          name: 'shared',
          projectType: 'library',
          targets: {},
        })
      )
    })

    afterAll(() => {
      rmSync(workspaceDir, { recursive: true, force: true })
    })

    it('should detect NX workspace', () => {
      const analysis = analyzeProject(workspaceDir)

      expect(analysis.workspaceType).toBe('nx')
      expect(analysis.monorepoTool?.id).toBe('nx')
    })

    it('should discover projects', () => {
      const analysis = analyzeProject(workspaceDir)

      expect(analysis.projects).toHaveLength(2)
      expect(analysis.projects.map((p) => p.name)).toContain('frontend')
      expect(analysis.projects.map((p) => p.name)).toContain('shared')
    })
  })
})
```

---

## E2E Tests (Package Exports)

### CommonJS Tests

```typescript
// apps/package-e2e/project-scope/src/cjs.spec.ts

describe('@hyperfrontend/project-scope (CommonJS)', () => {
  it('should be importable via require()', () => {
    const projectScope = require('@hyperfrontend/project-scope')

    expect(projectScope).toBeDefined()
    expect(typeof projectScope.analyzeProject).toBe('function')
    expect(typeof projectScope.createTree).toBe('function')
  })

  it('should export all public APIs', () => {
    const projectScope = require('@hyperfrontend/project-scope')

    // VFS exports
    expect(typeof projectScope.createTree).toBe('function')
    expect(typeof projectScope.commitChanges).toBe('function')
    expect(typeof projectScope.dryRun).toBe('function')

    // Analysis exports
    expect(typeof projectScope.analyzeProject).toBe('function')
    expect(typeof projectScope.detectProjectType).toBe('function')
    expect(typeof projectScope.identifyFrameworks).toBe('function')

    // Utility exports
    expect(typeof projectScope.readPackageJson).toBe('function')
    expect(typeof projectScope.findProjectRoot).toBe('function')
    expect(typeof projectScope.walkDirectory).toBe('function')
  })

  it('should create and use Tree', () => {
    const { createTree, commitChanges } = require('@hyperfrontend/project-scope')
    const { mkdtempSync, rmSync } = require('node:fs')
    const { tmpdir } = require('node:os')
    const { join } = require('node:path')

    const tempDir = mkdtempSync(join(tmpdir(), 'project-scope-cjs-'))

    try {
      const tree = createTree(tempDir)

      tree.write('test.txt', 'Hello from CJS')

      expect(tree.exists('test.txt')).toBe(true)
      expect(tree.read('test.txt', 'utf-8')).toBe('Hello from CJS')

      const result = commitChanges(tree)
      expect(result.created).toBe(1)
    } finally {
      rmSync(tempDir, { recursive: true, force: true })
    }
  })
})
```

### ESM Tests

```typescript
// apps/package-e2e/project-scope/src/esm.spec.ts

describe('@hyperfrontend/project-scope (ESM)', () => {
  it('should be importable via import', async () => {
    const projectScope = await import('@hyperfrontend/project-scope')

    expect(projectScope).toBeDefined()
    expect(typeof projectScope.analyzeProject).toBe('function')
    expect(typeof projectScope.createTree).toBe('function')
  })

  it('should support named imports', async () => {
    const { createTree, commitChanges, analyzeProject, identifyFrameworks } = await import('@hyperfrontend/project-scope')

    expect(typeof createTree).toBe('function')
    expect(typeof commitChanges).toBe('function')
    expect(typeof analyzeProject).toBe('function')
    expect(typeof identifyFrameworks).toBe('function')
  })

  it('should create and use Tree', async () => {
    const { createTree, commitChanges } = await import('@hyperfrontend/project-scope')
    const { mkdtempSync, rmSync } = await import('node:fs')
    const { tmpdir } = await import('node:os')
    const { join } = await import('node:path')

    const tempDir = mkdtempSync(join(tmpdir(), 'project-scope-esm-'))

    try {
      const tree = createTree(tempDir)

      tree.write('test.txt', 'Hello from ESM')

      expect(tree.exists('test.txt')).toBe(true)
      expect(tree.read('test.txt', 'utf-8')).toBe('Hello from ESM')

      const result = commitChanges(tree)
      expect(result.created).toBe(1)
    } finally {
      rmSync(tempDir, { recursive: true, force: true })
    }
  })

  it('should analyze real project structure', async () => {
    const { analyzeProject } = await import('@hyperfrontend/project-scope')

    // Analyze this workspace
    const analysis = analyzeProject(process.cwd())

    expect(analysis).toBeDefined()
    expect(analysis.workspaceType).toBeDefined()
  })
})
```

---

## Test Fixtures

### Minimal Project Fixture

```
__fixtures__/minimal-project/
├── package.json          # { "name": "minimal", "version": "1.0.0" }
├── src/
│   └── index.ts         # export const hello = "world"
└── tsconfig.json        # Basic TypeScript config
```

### React + Vite Fixture

```
__fixtures__/react-vite/
├── package.json          # React + Vite deps
├── vite.config.ts        # Vite config with React plugin
├── tsconfig.json         # React TypeScript config
├── index.html            # Vite entry HTML
├── src/
│   ├── main.tsx         # React entry
│   ├── App.tsx          # Main component
│   └── vite-env.d.ts    # Vite types
└── public/
    └── favicon.ico
```

### Monorepo Fixture

```
__fixtures__/monorepo/
├── package.json          # Root package
├── nx.json              # NX config
├── tsconfig.base.json   # Base TSConfig
├── apps/
│   └── web/
│       ├── project.json
│       ├── package.json
│       └── src/
│           └── main.ts
└── libs/
    └── utils/
        ├── project.json
        ├── package.json
        └── src/
            └── index.ts
```

---

## Test Utilities

```typescript
// __tests__/utils/fixtures.ts
import { join } from 'node:path'
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs'

const FIXTURES_BASE = join(__dirname, '../__fixtures__')

/**
 * Create a temporary project fixture.
 */
export function createTempFixture(name: string, structure: FixtureStructure): TempFixture {
  const path = join(FIXTURES_BASE, `temp-${name}-${Date.now()}`)

  mkdirSync(path, { recursive: true })
  createStructure(path, structure)

  return {
    path,
    cleanup: () => rmSync(path, { recursive: true, force: true }),
  }
}

/**
 * Get path to static fixture.
 */
export function getFixturePath(name: string): string {
  const path = join(FIXTURES_BASE, name)

  if (!existsSync(path)) {
    throw new Error(`Fixture not found: ${name}`)
  }

  return path
}

interface TempFixture {
  path: string
  cleanup: () => void
}

interface FixtureStructure {
  [key: string]: string | FixtureStructure
}

function createStructure(basePath: string, structure: FixtureStructure): void {
  for (const [name, content] of Object.entries(structure)) {
    const fullPath = join(basePath, name)

    if (typeof content === 'string') {
      writeFileSync(fullPath, content)
    } else {
      mkdirSync(fullPath, { recursive: true })
      createStructure(fullPath, content)
    }
  }
}
```

---

## CI Configuration

```yaml
# Runs as part of NX affected pipeline

# apps/package-e2e/project-scope/project.json
{
  'name': 'project-scope-e2e',
  'targets':
    {
      'e2e':
        {
          'executor': '@nx/jest:jest',
          'outputs': ['{workspaceRoot}/coverage/{projectRoot}'],
          'options': { 'jestConfig': 'apps/package-e2e/project-scope/jest.config.ts', 'passWithNoTests': false },
        },
    },
  'implicitDependencies': ['project-scope'],
}
```

---

## Related Documents

- [Architecture](./01-architecture.md)
- [Build Configuration](./11-build-configuration.md)
- [Implementation Phases](./13-implementation-phases.md)
