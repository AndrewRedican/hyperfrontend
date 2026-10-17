import type { Tree } from '@hyperfrontend/project-scope/vfs'
import { posix } from 'node:path'
import { beforeEach } from 'node:test'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { exists } from '@hyperfrontend/project-scope/core/fs'
import { normalizeToNative } from '@hyperfrontend/project-scope/core/path'
import { readPackageJson } from '@hyperfrontend/project-scope/project/package'
import { findWorkspaceRoot } from '@hyperfrontend/project-scope/project/root'
import { findFiles, findFilesInTree } from '@hyperfrontend/project-scope/project/traversal'
import { describe, expect, it, jest } from '@hyperfrontend/testing'
import { discoverPackages, discoverProject, discoverProjectByName } from './packages'

jest.mock('@hyperfrontend/project-scope/project/package', () => ({
  readPackageJson: jest.fn(),
}))

jest.mock('@hyperfrontend/project-scope/project/root', () => ({
  findWorkspaceRoot: jest.fn(),
}))

jest.mock('@hyperfrontend/project-scope/project/traversal', () => ({
  findFiles: jest.fn(),
  findFilesInTree: jest.fn(),
}))

jest.mock('@hyperfrontend/project-scope/core/fs', () => ({
  exists: jest.fn(),
}))

const projectScope = jest.mocked({ readPackageJson, findWorkspaceRoot, findFiles, findFilesInTree, exists })

beforeEach(() => {
  jest.clearAllMocks()
})

describe('discoverProject', () => {
  it('discovers a project by path', () => {
    projectScope.readPackageJson.mockReturnValue({
      name: 'my-package',
      version: '1.0.0',
    })

    const project = discoverProject('/workspace/libs/my-package')

    expect(project).toEqual(expect.objectContaining({ name: 'my-package', version: '1.0.0', path: '/workspace/libs/my-package' }))
  })

  it('sets packageJsonPath correctly', () => {
    projectScope.readPackageJson.mockReturnValue({
      name: 'my-package',
      version: '1.0.0',
    })

    const project = discoverProject('/workspace/libs/my-package')

    expect(project?.packageJsonPath).toBe(normalizeToNative('/workspace/libs/my-package/package.json'))
  })

  it('preserves packageJson object', () => {
    const packageJson = {
      name: 'my-package',
      version: '1.0.0',
      dependencies: { lodash: '^4.0.0' },
    }
    projectScope.readPackageJson.mockReturnValue(packageJson)

    const project = discoverProject('/workspace/libs/my-package')

    expect(project?.packageJson).toEqual(packageJson)
  })

  it('sets changelogPath to null', () => {
    projectScope.readPackageJson.mockReturnValue({
      name: 'my-package',
      version: '1.0.0',
    })

    const project = discoverProject('/workspace/libs/my-package')

    expect(project?.changelogPath).toBeNull()
  })

  it('accepts package.json path directly', () => {
    projectScope.readPackageJson.mockReturnValue({
      name: 'my-package',
      version: '2.0.0',
    })

    const project = discoverProject('/workspace/libs/my-package/package.json')

    expect(project).toEqual(expect.objectContaining({ name: 'my-package', path: '/workspace/libs/my-package' }))
  })

  it('returns null when package.json cannot be read', () => {
    projectScope.readPackageJson.mockImplementation(() => {
      throw new Error('File not found')
    })

    const project = discoverProject('/workspace/libs/missing')

    expect(project).toBeNull()
  })

  it('returns null when package has no name', () => {
    projectScope.readPackageJson.mockReturnValue({
      version: '1.0.0',
    })

    const project = discoverProject('/workspace/libs/nameless')

    expect(project).toBeNull()
  })

  it('uses 0.0.0 as default version', () => {
    projectScope.readPackageJson.mockReturnValue({
      name: 'no-version-pkg',
    })

    const project = discoverProject('/workspace/libs/no-version')

    expect(project?.version).toBe('0.0.0')
  })
})

describe('discoverProjectByName', () => {
  it('finds project by name in workspace', () => {
    projectScope.findWorkspaceRoot.mockReturnValue('/workspace')
    projectScope.findFiles.mockReturnValue(['libs/my-lib/package.json'])
    projectScope.readPackageJson.mockReturnValue({
      name: 'my-lib',
      version: '1.0.0',
    })
    projectScope.exists.mockReturnValue(false)

    const project = discoverProjectByName('my-lib')

    expect(project).toEqual(expect.objectContaining({ name: 'my-lib' }))
  })

  it('returns null when project not found', () => {
    projectScope.findWorkspaceRoot.mockReturnValue('/workspace')
    projectScope.findFiles.mockReturnValue([])

    const project = discoverProjectByName('nonexistent')

    expect(project).toBeNull()
  })

  it('throws when workspace root cannot be found', () => {
    projectScope.findWorkspaceRoot.mockReturnValue(null)

    expect(() => discoverProjectByName('my-lib')).toThrow(/workspace root/i)
  })

  it('finds the project when custom options are given', () => {
    projectScope.findWorkspaceRoot.mockReturnValue('/workspace')
    projectScope.findFiles.mockReturnValue(['custom/my-lib/package.json'])
    projectScope.readPackageJson.mockReturnValue({
      name: 'my-lib',
      version: '1.0.0',
    })
    projectScope.exists.mockReturnValue(false)

    const project = discoverProjectByName('my-lib', {
      patterns: ['custom/*/package.json'],
      exclude: ['**/ignored/**'],
    })

    expect(project).toEqual(expect.objectContaining({ name: 'my-lib' }))
  })

  it('passes custom options to discoverPackages', () => {
    projectScope.findWorkspaceRoot.mockReturnValue('/workspace')
    projectScope.findFiles.mockReturnValue(['custom/my-lib/package.json'])
    projectScope.readPackageJson.mockReturnValue({
      name: 'my-lib',
      version: '1.0.0',
    })
    projectScope.exists.mockReturnValue(false)

    discoverProjectByName('my-lib', {
      patterns: ['custom/*/package.json'],
      exclude: ['**/ignored/**'],
    })

    expect(projectScope.findFiles).toHaveBeenCalledWith('/workspace', ['custom/*/package.json'], expect.any(Object))
  })
})

describe('discoverPackages', () => {
  it('throws when workspace root cannot be found', () => {
    projectScope.findWorkspaceRoot.mockReturnValue(null)

    expect(() => discoverPackages()).toThrow(/workspace root/i)
  })

  it('discovers packages with default options', () => {
    projectScope.findWorkspaceRoot.mockReturnValue('/workspace')
    projectScope.findFiles.mockReturnValue(['libs/lib-a/package.json', 'libs/lib-b/package.json'])
    projectScope.readPackageJson
      .mockReturnValueOnce({ name: 'lib-a', version: '1.0.0' })
      .mockReturnValueOnce({ name: 'lib-b', version: '2.0.0', dependencies: { 'lib-a': '^1.0.0' } })
    projectScope.exists.mockReturnValue(true)

    const result = discoverPackages()

    expect(result).toEqual(
      expect.objectContaining({
        projects: [expect.objectContaining({ name: 'lib-a' }), expect.objectContaining({ name: 'lib-b' })],
        packageNames: createSet(['lib-a', 'lib-b']),
      })
    )
  })

  it('discovers packages with custom workspace root', () => {
    projectScope.findFiles.mockReturnValue(['packages/pkg/package.json'])
    projectScope.readPackageJson.mockReturnValue({ name: 'pkg', version: '1.0.0' })
    projectScope.exists.mockReturnValue(false)

    const result = discoverPackages({ workspaceRoot: '/custom/workspace' })

    expect(result).toEqual(
      expect.objectContaining({ workspaceRoot: '/custom/workspace', projects: [expect.objectContaining({ name: 'pkg' })] })
    )
  })

  it('leaves changelogPath null when includeChangelogs is false', () => {
    projectScope.findWorkspaceRoot.mockReturnValue('/workspace')
    projectScope.findFiles.mockReturnValue(['libs/lib-a/package.json'])
    projectScope.readPackageJson.mockReturnValue({ name: 'lib-a', version: '1.0.0' })
    projectScope.exists.mockReturnValue(true)

    const result = discoverPackages({ includeChangelogs: false })

    expect(result.projects).toEqual([expect.objectContaining({ changelogPath: null })])
  })

  it('skips changelog discovery when includeChangelogs is false', () => {
    projectScope.findWorkspaceRoot.mockReturnValue('/workspace')
    projectScope.findFiles.mockReturnValue(['libs/lib-a/package.json'])
    projectScope.readPackageJson.mockReturnValue({ name: 'lib-a', version: '1.0.0' })
    projectScope.exists.mockReturnValue(true)

    discoverPackages({ includeChangelogs: false })

    expect(projectScope.exists).not.toHaveBeenCalled()
  })

  it('skips dependency tracking when trackDependencies is false', () => {
    projectScope.findWorkspaceRoot.mockReturnValue('/workspace')
    projectScope.findFiles.mockReturnValue(['libs/lib-a/package.json', 'libs/lib-b/package.json'])
    projectScope.readPackageJson
      .mockReturnValueOnce({ name: 'lib-a', version: '1.0.0' })
      .mockReturnValueOnce({ name: 'lib-b', version: '2.0.0', dependencies: { 'lib-a': '^1.0.0' } })
    projectScope.exists.mockReturnValue(false)

    const result = discoverPackages({ trackDependencies: false })

    expect(result.projects).toEqual([
      expect.objectContaining({ name: 'lib-a', internalDependencies: [] }),
      expect.objectContaining({ name: 'lib-b', internalDependencies: [] }),
    ])
  })

  it('skips packages without a name', () => {
    projectScope.findWorkspaceRoot.mockReturnValue('/workspace')
    projectScope.findFiles.mockReturnValue(['libs/lib-a/package.json', 'libs/nameless/package.json'])
    projectScope.readPackageJson.mockReturnValueOnce({ name: 'lib-a', version: '1.0.0' }).mockReturnValueOnce({ version: '1.0.0' })
    projectScope.exists.mockReturnValue(false)

    const result = discoverPackages()

    expect(result.projects).toEqual([expect.objectContaining({ name: 'lib-a' })])
  })

  it('skips packages that fail to parse', () => {
    projectScope.findWorkspaceRoot.mockReturnValue('/workspace')
    projectScope.findFiles.mockReturnValue(['libs/lib-a/package.json', 'libs/broken/package.json'])
    projectScope.readPackageJson.mockReturnValueOnce({ name: 'lib-a', version: '1.0.0' }).mockImplementationOnce(() => {
      throw new Error('Invalid JSON')
    })
    projectScope.exists.mockReturnValue(false)

    const result = discoverPackages()

    expect(result.projects).toEqual([expect.objectContaining({ name: 'lib-a' })])
  })

  it('uses default version 0.0.0 for packages without version', () => {
    projectScope.findWorkspaceRoot.mockReturnValue('/workspace')
    projectScope.findFiles.mockReturnValue(['libs/lib-a/package.json'])
    projectScope.readPackageJson.mockReturnValue({ name: 'lib-a' })
    projectScope.exists.mockReturnValue(false)

    const result = discoverPackages()

    expect(result.projects).toEqual([expect.objectContaining({ version: '0.0.0' })])
  })

  it('applies custom patterns and exclude', () => {
    projectScope.findWorkspaceRoot.mockReturnValue('/workspace')
    projectScope.findFiles.mockReturnValue(['custom/pkg/package.json'])
    projectScope.readPackageJson.mockReturnValue({ name: 'pkg', version: '1.0.0' })
    projectScope.exists.mockReturnValue(false)

    const result = discoverPackages({
      patterns: ['custom/*/package.json'],
      exclude: ['**/ignored/**'],
    })

    expect(result).toEqual(
      expect.objectContaining({
        projects: [expect.objectContaining({ name: 'pkg' })],
        config: expect.objectContaining({ patterns: ['custom/*/package.json'], exclude: ['**/ignored/**'] }),
      })
    )
  })

  it('indexes projects by name in projectMap', () => {
    projectScope.findWorkspaceRoot.mockReturnValue('/workspace')
    projectScope.findFiles.mockReturnValue(['libs/lib-a/package.json', 'libs/lib-b/package.json'])
    projectScope.readPackageJson
      .mockReturnValueOnce({ name: 'lib-a', version: '1.0.0' })
      .mockReturnValueOnce({ name: 'lib-b', version: '2.0.0' })
    projectScope.exists.mockReturnValue(false)

    const result = discoverPackages()

    expect(result.projectMap).toEqual(
      createMap([
        ['lib-a', expect.objectContaining({ name: 'lib-a', version: '1.0.0' })],
        ['lib-b', expect.objectContaining({ name: 'lib-b', version: '2.0.0' })],
      ])
    )
  })

  it('sets changelogPath when changelog exists', () => {
    projectScope.findWorkspaceRoot.mockReturnValue('/workspace')
    projectScope.findFiles.mockReturnValue(['libs/lib-a/package.json'])
    projectScope.readPackageJson.mockReturnValue({ name: 'lib-a', version: '1.0.0' })
    projectScope.exists.mockReturnValue(true)

    const result = discoverPackages({ includeChangelogs: true })

    expect(result.projects).toEqual([expect.objectContaining({ changelogPath: normalizeToNative('/workspace/libs/lib-a/CHANGELOG.md') })])
  })

  it('tracks internalDependencies correctly', () => {
    projectScope.findWorkspaceRoot.mockReturnValue('/workspace')
    projectScope.findFiles.mockReturnValue(['libs/lib-a/package.json', 'libs/lib-b/package.json'])
    projectScope.readPackageJson
      .mockReturnValueOnce({ name: 'lib-a', version: '1.0.0' })
      .mockReturnValueOnce({ name: 'lib-b', version: '2.0.0', dependencies: { 'lib-a': '^1.0.0' } })
    projectScope.exists.mockReturnValue(false)

    const result = discoverPackages({ trackDependencies: true })

    const libB = result.projectMap.get('lib-b')
    expect(libB?.internalDependencies).toContain('lib-a')
  })

  it('tracks internalDependents correctly', () => {
    projectScope.findWorkspaceRoot.mockReturnValue('/workspace')
    projectScope.findFiles.mockReturnValue(['libs/lib-a/package.json', 'libs/lib-b/package.json'])
    projectScope.readPackageJson
      .mockReturnValueOnce({ name: 'lib-a', version: '1.0.0' })
      .mockReturnValueOnce({ name: 'lib-b', version: '2.0.0', dependencies: { 'lib-a': '^1.0.0' } })
    projectScope.exists.mockReturnValue(false)

    const result = discoverPackages({ trackDependencies: true })

    const libA = result.projectMap.get('lib-a')
    expect(libA?.internalDependents).toContain('lib-b')
  })

  it('returns config with all fields', () => {
    projectScope.findWorkspaceRoot.mockReturnValue('/workspace')
    projectScope.findFiles.mockReturnValue([])

    const result = discoverPackages({
      patterns: ['libs/*/package.json'],
      exclude: ['**/test/**'],
      includeChangelogs: true,
      trackDependencies: false,
    })

    expect(result.config).toEqual({
      patterns: ['libs/*/package.json'],
      exclude: ['**/test/**'],
      includeChangelogs: true,
      trackDependencies: false,
    })
  })

  it('uses default config values when options not provided', () => {
    projectScope.findWorkspaceRoot.mockReturnValue('/workspace')
    projectScope.findFiles.mockReturnValue([])

    const result = discoverPackages()

    expect(result.config).toEqual(
      expect.objectContaining({ includeChangelogs: true, trackDependencies: true, patterns: expect.anything(), exclude: expect.anything() })
    )
  })
})

describe('discoverPackages with VFS tree', () => {
  const createMockTree = (files: Record<string, string>, root = '/workspace') => ({
    root,
    read: jest.fn((path: string, encoding?: string) => {
      const content = files[path]
      if (content === undefined) return null
      return encoding ? content : Buffer.from(content)
    }),
    exists: jest.fn((path: string) => files[path] !== undefined),
    isFile: jest.fn((path: string) => files[path] !== undefined && !path.endsWith(posix.sep)),
    children: jest.fn(),
    write: jest.fn(),
    delete: jest.fn(),
    rename: jest.fn(),
    isDirectory: jest.fn(),
    isSymlink: jest.fn(),
    listChanges: jest.fn(() => []),
    clearChanges: jest.fn(),
    changePermissions: jest.fn(),
    changeFile: jest.fn(),
  })

  it('uses VFS tree for discovery when tree is provided', () => {
    const tree = createMockTree({
      'libs/lib-a/package.json': JSON.stringify({ name: 'lib-a', version: '1.0.0' }),
    })
    projectScope.findFilesInTree.mockReturnValue(['libs/lib-a/package.json'])

    discoverPackages({
      tree: tree as Tree,
      workspaceRoot: '/workspace',
      includeChangelogs: false,
      trackDependencies: false,
    })

    const searches = {
      treeSearches: jest.mocked(projectScope.findFilesInTree).mock.calls,
      diskSearches: jest.mocked(projectScope.findFiles).mock.calls,
    }

    expect(searches).toEqual({
      treeSearches: expect.arrayContaining([[tree, expect.any(Array), expect.any(Object)]]),
      diskSearches: [],
    })
  })

  it('discovers the packages found in the VFS tree', () => {
    const tree = createMockTree({
      'libs/lib-a/package.json': JSON.stringify({ name: 'lib-a', version: '1.0.0' }),
    })
    projectScope.findFilesInTree.mockReturnValue(['libs/lib-a/package.json'])

    const result = discoverPackages({
      tree: tree as Tree,
      workspaceRoot: '/workspace',
      includeChangelogs: false,
      trackDependencies: false,
    })

    expect(result.projects).toEqual([expect.objectContaining({ name: 'lib-a' })])
  })

  it('reads package.json from tree instead of disk', () => {
    const tree = createMockTree({
      'libs/lib-a/package.json': JSON.stringify({ name: 'from-tree', version: '2.0.0' }),
    })
    projectScope.findFilesInTree.mockReturnValue(['libs/lib-a/package.json'])

    discoverPackages({
      tree: tree as Tree,
      workspaceRoot: '/workspace',
      includeChangelogs: false,
      trackDependencies: false,
    })

    const reads = { treeReads: tree.read.mock.calls, diskReads: jest.mocked(projectScope.readPackageJson).mock.calls }

    expect(reads).toEqual({
      treeReads: expect.arrayContaining([['libs/lib-a/package.json', 'utf-8']]),
      diskReads: [],
    })
  })

  it('builds projects from the package.json content in the tree', () => {
    const tree = createMockTree({
      'libs/lib-a/package.json': JSON.stringify({ name: 'from-tree', version: '2.0.0' }),
    })
    projectScope.findFilesInTree.mockReturnValue(['libs/lib-a/package.json'])

    const result = discoverPackages({
      tree: tree as Tree,
      workspaceRoot: '/workspace',
      includeChangelogs: false,
      trackDependencies: false,
    })

    expect(result.projects).toEqual([expect.objectContaining({ name: 'from-tree', version: '2.0.0' })])
  })

  it('uses tree.root as workspace root when not explicitly provided', () => {
    const tree = createMockTree(
      {
        'libs/lib-a/package.json': JSON.stringify({ name: 'lib-a', version: '1.0.0' }),
      },
      '/custom/root'
    )
    projectScope.findFilesInTree.mockReturnValue(['libs/lib-a/package.json'])

    const result = discoverPackages({
      tree: tree as Tree,
      includeChangelogs: false,
      trackDependencies: false,
    })

    expect(result.workspaceRoot).toBe('/custom/root')
  })

  it('discovers packages created in VFS but not on disk', () => {
    const tree = createMockTree({
      'libs/existing/package.json': JSON.stringify({ name: 'existing', version: '1.0.0' }),
      'libs/new-package/package.json': JSON.stringify({ name: 'new-package', version: '0.0.1' }),
    })
    projectScope.findFilesInTree.mockReturnValue(['libs/existing/package.json', 'libs/new-package/package.json'])

    const result = discoverPackages({
      tree: tree as Tree,
      workspaceRoot: '/workspace',
      includeChangelogs: false,
      trackDependencies: false,
    })

    expect(result).toEqual(
      expect.objectContaining({
        projects: [expect.objectContaining({ name: 'existing' }), expect.objectContaining({ name: 'new-package' })],
        packageNames: createSet(['existing', 'new-package']),
      })
    )
  })

  it('skips packages with unreadable content in tree', () => {
    const tree = createMockTree({
      'libs/lib-a/package.json': JSON.stringify({ name: 'lib-a', version: '1.0.0' }),
    })
    tree.read.mockImplementation((path: string, encoding?: string) => {
      if (path === 'libs/broken/package.json') return null
      if (path === 'libs/lib-a/package.json') {
        const content = JSON.stringify({ name: 'lib-a', version: '1.0.0' })
        return encoding ? content : Buffer.from(content)
      }
      return null
    })
    projectScope.findFilesInTree.mockReturnValue(['libs/lib-a/package.json', 'libs/broken/package.json'])

    const result = discoverPackages({
      tree: tree as Tree,
      workspaceRoot: '/workspace',
      includeChangelogs: false,
      trackDependencies: false,
    })

    expect(result.projects).toEqual([expect.objectContaining({ name: 'lib-a' })])
  })

  it('skips packages with invalid JSON in tree', () => {
    const tree = createMockTree({
      'libs/lib-a/package.json': JSON.stringify({ name: 'lib-a', version: '1.0.0' }),
      'libs/invalid/package.json': 'not valid json {{{',
    })
    projectScope.findFilesInTree.mockReturnValue(['libs/lib-a/package.json', 'libs/invalid/package.json'])

    const result = discoverPackages({
      tree: tree as Tree,
      workspaceRoot: '/workspace',
      includeChangelogs: false,
      trackDependencies: false,
    })

    expect(result.projects).toEqual([expect.objectContaining({ name: 'lib-a' })])
  })
})
