import { createTempWorkspaceManager, PUBLISHABLE_LIBRARY_PROJECT_JSON } from '../testing'
import {
  findLibraryDirectories,
  findPublishableLibraryDirectories,
  getAllPublishableLibraries,
  isPublishableLibrary,
  isPublishableLibraryDir,
  isPublishableProjectJson,
  looksLikeLibraryDir,
  readPackageJson,
  readProjectJson,
} from './nx-project'

const manager = createTempWorkspaceManager()

afterAll(() => {
  manager.cleanupAll()
})

describe('isPublishableLibrary', () => {
  it('returns true for publishable library', () => {
    const workspace = manager.create({
      projectJson: PUBLISHABLE_LIBRARY_PROJECT_JSON,
    })

    expect(isPublishableLibrary(workspace.root)).toBe(true)
  })

  it('returns false for library without publish target', () => {
    const workspace = manager.create({
      projectJson: { projectType: 'library', targets: { build: {} } },
    })

    expect(isPublishableLibrary(workspace.root)).toBe(false)
  })

  it('returns false for application', () => {
    const workspace = manager.create({
      projectJson: { projectType: 'application', targets: { build: {}, publish: {} } },
    })

    expect(isPublishableLibrary(workspace.root)).toBe(false)
  })
})

describe('isPublishableLibraryDir', () => {
  it('works as alias for isPublishableLibrary', () => {
    const workspace = manager.create({
      projectJson: PUBLISHABLE_LIBRARY_PROJECT_JSON,
    })

    expect(isPublishableLibraryDir(workspace.root)).toBe(true)
  })
})

describe('isPublishableProjectJson', () => {
  it('returns true for publishable library config', () => {
    expect(
      isPublishableProjectJson({
        projectType: 'library',
        targets: { build: {}, publish: {} },
      })
    ).toBe(true)
  })

  it('returns false for missing publish target', () => {
    expect(
      isPublishableProjectJson({
        projectType: 'library',
        targets: { build: {} },
      })
    ).toBe(false)
  })
})

describe('looksLikeLibraryDir', () => {
  it('returns true for directory with project.json and src', () => {
    const workspace = manager.create({
      projectJson: { projectType: 'library' },
      directories: ['src'],
    })

    expect(looksLikeLibraryDir(workspace.root)).toBe(true)
  })

  it('returns true for directory with project.json and index.ts', () => {
    const workspace = manager.create({
      files: {
        'project.json': JSON.stringify({ projectType: 'library' }),
        'index.ts': 'export {}',
      },
    })

    expect(looksLikeLibraryDir(workspace.root)).toBe(true)
  })

  it('returns true for directory with project.json and main.ts', () => {
    const workspace = manager.create({
      files: {
        'project.json': JSON.stringify({ projectType: 'library' }),
        'main.ts': 'export {}',
      },
    })

    expect(looksLikeLibraryDir(workspace.root)).toBe(true)
  })

  it('returns false for directory without project.json', () => {
    const workspace = manager.create({
      directories: ['src'],
    })

    expect(looksLikeLibraryDir(workspace.root)).toBe(false)
  })

  it('returns false for directory with project.json but no src, index.ts, or main.ts', () => {
    const workspace = manager.create({
      files: {
        'project.json': JSON.stringify({ projectType: 'library' }),
      },
    })

    // Remove the default src directory that createTempWorkspace creates
    const { rmSync } = require('node:fs')
    rmSync(workspace.getPath('src'), { recursive: true, force: true })

    expect(looksLikeLibraryDir(workspace.root)).toBe(false)
  })
})

describe('findLibraryDirectories', () => {
  it('finds library directories', () => {
    const workspace = manager.create({
      files: {
        'libs/lib-a/project.json': JSON.stringify({ projectType: 'library' }),
        'libs/lib-a/src/index.ts': '',
        'libs/lib-b/project.json': JSON.stringify({ projectType: 'library' }),
        'libs/lib-b/src/index.ts': '',
        'apps/app-a/project.json': JSON.stringify({ projectType: 'application' }),
      },
    })

    const result = findLibraryDirectories(workspace.getPath('libs'))

    expect(result).toHaveLength(2)
    expect(result).toContain(workspace.getPath('libs/lib-a'))
    expect(result).toContain(workspace.getPath('libs/lib-b'))
  })

  it('returns empty array when path is not a directory', () => {
    const workspace = manager.create({
      files: {
        'some-file.txt': 'content',
      },
    })

    const result = findLibraryDirectories(workspace.getPath('some-file.txt'))

    expect(result).toEqual([])
  })

  it('returns empty array for non-existent path', () => {
    const result = findLibraryDirectories('/non/existent/path')

    expect(result).toEqual([])
  })

  it('skips hidden directories, node_modules, and dist', () => {
    const workspace = manager.create({
      files: {
        '.hidden/project.json': JSON.stringify({ projectType: 'library' }),
        'node_modules/pkg/project.json': JSON.stringify({ projectType: 'library' }),
        'dist/build/project.json': JSON.stringify({ projectType: 'library' }),
        'libs/valid/project.json': JSON.stringify({ projectType: 'library' }),
      },
    })

    const result = findLibraryDirectories(workspace.root)

    expect(result).toHaveLength(1)
    expect(result[0]).toContain('valid')
  })

  it('recursively searches subdirectories without project.json', () => {
    const workspace = manager.create({
      files: {
        'packages/scope/lib-a/project.json': JSON.stringify({ projectType: 'library' }),
        'packages/scope/lib-b/project.json': JSON.stringify({ projectType: 'library' }),
      },
    })

    const result = findLibraryDirectories(workspace.getPath('packages'))

    expect(result).toHaveLength(2)
    expect(result).toContain(workspace.getPath('packages/scope/lib-a'))
    expect(result).toContain(workspace.getPath('packages/scope/lib-b'))
  })

  it('skips files in the directory', () => {
    const workspace = manager.create({
      files: {
        'libs/README.md': 'readme',
        'libs/lib-a/project.json': JSON.stringify({ projectType: 'library' }),
      },
    })

    const result = findLibraryDirectories(workspace.getPath('libs'))

    expect(result).toHaveLength(1)
    expect(result[0]).toContain('lib-a')
  })
})

describe('findPublishableLibraryDirectories', () => {
  it('finds only publishable libraries', () => {
    const workspace = manager.create({
      files: {
        'libs/pub-lib/project.json': JSON.stringify({
          projectType: 'library',
          targets: { build: {}, publish: {} },
        }),
        'libs/internal-lib/project.json': JSON.stringify({
          projectType: 'library',
          targets: { build: {} },
        }),
      },
    })

    const result = findPublishableLibraryDirectories(workspace.getPath('libs'))

    expect(result).toHaveLength(1)
    expect(result[0]).toContain('pub-lib')
  })
})

describe('getAllPublishableLibraries', () => {
  it('returns publishable library metadata', () => {
    const workspace = manager.create({
      files: {
        'libs/my-lib/project.json': JSON.stringify({
          projectType: 'library',
          targets: { build: {}, publish: {} },
        }),
        'libs/my-lib/package.json': JSON.stringify({
          name: '@test/my-lib',
          version: '1.0.0',
        }),
      },
    })

    const result = getAllPublishableLibraries(workspace.root)

    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('@test/my-lib')
    expect(result[0].packageJson?.version).toBe('1.0.0')
  })

  it('returns empty array when libs directory does not exist', () => {
    const workspace = manager.create()

    const result = getAllPublishableLibraries(workspace.root)

    expect(result).toEqual([])
  })

  it('uses directory name when package.json has no name', () => {
    const workspace = manager.create({
      files: {
        'libs/my-lib/project.json': JSON.stringify({
          projectType: 'library',
          targets: { build: {}, publish: {} },
        }),
        'libs/my-lib/package.json': JSON.stringify({
          version: '1.0.0',
        }),
      },
    })

    const result = getAllPublishableLibraries(workspace.root)

    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('my-lib')
  })

  it('uses directory name when package.json does not exist', () => {
    const workspace = manager.create({
      files: {
        'libs/standalone-lib/project.json': JSON.stringify({
          projectType: 'library',
          targets: { build: {}, publish: {} },
        }),
      },
    })

    const result = getAllPublishableLibraries(workspace.root)

    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('standalone-lib')
    expect(result[0].packageJson).toBeNull()
  })

  it('supports custom libs directory', () => {
    const workspace = manager.create({
      files: {
        'packages/my-lib/project.json': JSON.stringify({
          projectType: 'library',
          targets: { build: {}, publish: {} },
        }),
      },
    })

    const result = getAllPublishableLibraries(workspace.root, 'packages')

    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('my-lib')
  })
})

describe('readProjectJson', () => {
  it('reads project.json', () => {
    const workspace = manager.create({
      projectJson: { projectType: 'library' },
    })

    const result = readProjectJson(workspace.root)

    expect(result?.projectType).toBe('library')
  })

  it('returns null when not found', () => {
    const workspace = manager.create()

    const result = readProjectJson(workspace.root)

    expect(result).toBeNull()
  })
})

describe('readPackageJson', () => {
  it('reads package.json', () => {
    const workspace = manager.create({
      packageJson: { name: 'test' },
    })

    const result = readPackageJson(workspace.root)

    expect(result?.name).toBe('test')
  })

  it('returns null when not found', () => {
    const workspace = manager.create()

    const result = readPackageJson(workspace.root)

    expect(result).toBeNull()
  })
})
