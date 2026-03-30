import { createTempWorkspaceManager } from '../testing'
import {
  findNxWorkspaceRoot,
  findProjectRoot,
  findRootDirectory,
  findTypeScriptWorkspaceRoot,
  findUpwardWhere,
  findWorkspaceRoot,
  findWorkspaceRootByMarker,
  isWithinWorkspace,
} from './workspace'

const manager = createTempWorkspaceManager()

afterAll(() => {
  manager.cleanupAll()
})

describe('findProjectRoot', () => {
  it('finds project root with project.json', () => {
    const workspace = manager.create({
      projectJson: { projectType: 'library' },
    })

    const result = findProjectRoot(workspace.getPath('src'))

    expect(result).toBe(workspace.root)
  })
})

describe('findWorkspaceRoot', () => {
  it('finds workspace root with nx.json', () => {
    const workspace = manager.create({
      files: {
        'nx.json': '{}',
        'libs/my-lib/src/index.ts': 'export {}',
      },
    })

    const result = findWorkspaceRoot(workspace.getPath('libs/my-lib/src'))

    expect(result).toBe(workspace.root)
  })
})

describe('findWorkspaceRootByMarker', () => {
  it('finds root with custom marker', () => {
    const workspace = manager.create({
      files: {
        'tsconfig.base.json': '{}',
        'libs/my-lib/src/index.ts': 'export {}',
      },
    })

    const result = findWorkspaceRootByMarker(workspace.getPath('libs/my-lib'), 'tsconfig.base.json')

    expect(result).toBe(workspace.root)
  })

  it('returns null when marker not found', () => {
    const workspace = manager.create({
      files: {
        'libs/my-lib/src/index.ts': 'export {}',
      },
    })

    const result = findWorkspaceRootByMarker(workspace.getPath('libs/my-lib'), 'nonexistent.json')

    expect(result).toBeNull()
  })
})

describe('findTypeScriptWorkspaceRoot', () => {
  it('finds root with tsconfig.base.json', () => {
    const workspace = manager.create({
      files: {
        'tsconfig.base.json': '{}',
        'src/index.ts': 'export {}',
      },
    })

    const result = findTypeScriptWorkspaceRoot(workspace.getPath('src'))

    expect(result).toBe(workspace.root)
  })
})

describe('findNxWorkspaceRoot', () => {
  it('finds root with nx.json', () => {
    const workspace = manager.create({
      files: {
        'nx.json': '{}',
        'src/index.ts': 'export {}',
      },
    })

    const result = findNxWorkspaceRoot(workspace.getPath('src'))

    expect(result).toBe(workspace.root)
  })
})

describe('isWithinWorkspace', () => {
  it('returns true for paths within workspace', () => {
    expect(isWithinWorkspace('/workspace/libs/my-lib', '/workspace')).toBe(true)
  })

  it('returns false for paths outside workspace', () => {
    expect(isWithinWorkspace('/other/path', '/workspace')).toBe(false)
  })
})

describe('findRootDirectory', () => {
  it('finds root with specified markers', () => {
    const workspace = manager.create({
      files: {
        'custom-marker.json': '{}',
        'libs/my-lib/src/index.ts': 'export {}',
      },
    })

    const result = findRootDirectory(workspace.getPath('libs/my-lib'), ['custom-marker.json'])

    expect(result).toBe(workspace.root)
  })
})

describe('findUpwardWhere', () => {
  it('finds directory matching predicate', () => {
    const workspace = manager.create({
      files: {
        'marker-file.txt': 'marker',
        'libs/my-lib/src/index.ts': 'export {}',
      },
    })

    const result = findUpwardWhere(workspace.getPath('libs/my-lib/src'), (dir) => {
      try {
        const fs = require('node:fs')
        return fs.existsSync(require('node:path').join(dir, 'marker-file.txt'))
      } catch {
        return false
      }
    })

    expect(result).toBe(workspace.root)
  })
})
