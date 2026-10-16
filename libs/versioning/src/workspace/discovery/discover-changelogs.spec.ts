import type { Tree } from '@hyperfrontend/project-scope/vfs'
import { beforeEach } from 'node:test'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import * as projectScopeFs from '@hyperfrontend/project-scope/core/fs'
import { normalizeToNative } from '@hyperfrontend/project-scope/core/path'
import * as projectScopeTraversal from '@hyperfrontend/project-scope/project/traversal'
import { describe, expect, it, jest } from '@hyperfrontend/testing'
import {
  CHANGELOG_NAMES,
  findChangelogs,
  findChangelogsInTree,
  findProjectChangelog,
  findProjectChangelogInTree,
  discoverAllChangelogs,
} from './discover-changelogs'

jest.mock('@hyperfrontend/project-scope/core/fs', () => ({
  exists: jest.fn(),
  readDirectory: jest.fn(),
  locateByMarkers: jest.fn(),
}))

jest.mock('@hyperfrontend/project-scope/project/traversal', () => ({
  findFiles: jest.fn(),
}))

describe('CHANGELOG_NAMES', () => {
  it('contains common changelog names', () => {
    expect(CHANGELOG_NAMES).toEqual(expect.arrayContaining(['CHANGELOG.md', 'Changelog.md', 'changelog.md']))
  })

  it('contains alternative names', () => {
    expect(CHANGELOG_NAMES).toEqual(expect.arrayContaining(['HISTORY.md', 'CHANGES.md']))
  })

  it('has CHANGELOG.md first (highest priority)', () => {
    expect(CHANGELOG_NAMES[0]).toBe('CHANGELOG.md')
  })
})

describe('findProjectChangelog', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('finds CHANGELOG.md when it exists', () => {
    projectScopeFs.exists.mockImplementation((path: string) => {
      return path === normalizeToNative('/workspace/libs/my-lib/CHANGELOG.md')
    })

    const result = findProjectChangelog('/workspace/libs/my-lib')

    expect(result).toBe(normalizeToNative('/workspace/libs/my-lib/CHANGELOG.md'))
  })

  it('finds Changelog.md as fallback', () => {
    projectScopeFs.exists.mockImplementation((path: string) => {
      return path === normalizeToNative('/workspace/libs/my-lib/Changelog.md')
    })

    const result = findProjectChangelog('/workspace/libs/my-lib')

    expect(result).toBe(normalizeToNative('/workspace/libs/my-lib/Changelog.md'))
  })

  it('finds HISTORY.md as fallback', () => {
    projectScopeFs.exists.mockImplementation((path: string) => {
      return path === normalizeToNative('/workspace/libs/my-lib/HISTORY.md')
    })

    const result = findProjectChangelog('/workspace/libs/my-lib')

    expect(result).toBe(normalizeToNative('/workspace/libs/my-lib/HISTORY.md'))
  })

  it('returns null when no changelog exists', () => {
    projectScopeFs.exists.mockReturnValue(false)

    const result = findProjectChangelog('/workspace/libs/my-lib')

    expect(result).toBeNull()
  })

  it('returns first matching changelog in priority order', () => {
    projectScopeFs.exists.mockImplementation((path: string) => {
      return path.includes('CHANGELOG.md') || path.includes('changelog.md')
    })

    const result = findProjectChangelog('/workspace/libs/my-lib')

    expect(result).toBe(normalizeToNative('/workspace/libs/my-lib/CHANGELOG.md'))
  })
})

describe('findChangelogs', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('finds changelogs for multiple packages', () => {
    projectScopeFs.exists.mockImplementation((path: string) => {
      return path.includes('CHANGELOG.md')
    })

    const packages = [
      { path: '/workspace/libs/lib-a', name: 'lib-a' },
      { path: '/workspace/libs/lib-b', name: 'lib-b' },
    ]

    const result = findChangelogs('/workspace', packages)

    expect(result).toEqual(
      createMap([
        ['/workspace/libs/lib-a', normalizeToNative('/workspace/libs/lib-a/CHANGELOG.md')],
        ['/workspace/libs/lib-b', normalizeToNative('/workspace/libs/lib-b/CHANGELOG.md')],
      ])
    )
  })

  it('skips packages without changelog', () => {
    projectScopeFs.exists.mockImplementation((path: string) => {
      return path.includes('lib-a')
    })

    const packages = [
      { path: '/workspace/libs/lib-a', name: 'lib-a' },
      { path: '/workspace/libs/lib-b', name: 'lib-b' },
    ]

    const result = findChangelogs('/workspace', packages)

    expect([...result.keys()]).toEqual(['/workspace/libs/lib-a'])
  })

  it('returns empty map for empty package list', () => {
    const result = findChangelogs('/workspace', [])

    expect(result.size).toBe(0)
  })
})

describe('discoverAllChangelogs', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('discovers changelogs using glob patterns', () => {
    projectScopeTraversal.findFiles.mockReturnValue(['libs/lib-a/CHANGELOG.md', 'libs/lib-b/changelog.md'])

    const result = discoverAllChangelogs('/workspace')

    expect(result).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          relativePath: 'libs/lib-a/CHANGELOG.md',
          path: normalizeToNative('/workspace/libs/lib-a/CHANGELOG.md'),
          filename: 'CHANGELOG.md',
        }),
        expect.any(Object),
      ])
    )
  })

  it('extracts project path from changelog path', () => {
    projectScopeTraversal.findFiles.mockReturnValue(['packages/my-package/CHANGELOG.md'])

    const result = discoverAllChangelogs('/workspace')

    expect(result?.[0]).toEqual(expect.objectContaining({ projectPath: normalizeToNative('/workspace/packages/my-package') }))
  })

  it('returns empty array when no changelogs found', () => {
    projectScopeTraversal.findFiles.mockReturnValue([])

    const result = discoverAllChangelogs('/workspace')

    expect(result).toEqual([])
  })

  it('uses custom patterns', () => {
    projectScopeTraversal.findFiles.mockReturnValue([])

    discoverAllChangelogs('/workspace', ['apps/**/CHANGELOG.md'])

    expect(projectScopeTraversal.findFiles).toHaveBeenCalledWith(
      '/workspace',
      ['apps/**/CHANGELOG.md'],
      expect.objectContaining({
        ignorePatterns: ['**/node_modules/**', '**/dist/**'],
        absolutePaths: false,
      })
    )
  })
})

describe('findProjectChangelogInTree', () => {
  const createMockTree = (existingPaths: string[], root = '/workspace') => ({
    root,
    exists: jest.fn((path: string) => existingPaths.includes(path)),
    read: jest.fn(),
    write: jest.fn(),
    delete: jest.fn(),
    rename: jest.fn(),
    isFile: jest.fn((path: string) => existingPaths.includes(path)),
    isDirectory: jest.fn(),
    isSymlink: jest.fn(),
    children: jest.fn(),
    listChanges: jest.fn(() => []),
    clearChanges: jest.fn(),
    changePermissions: jest.fn(),
    changeFile: jest.fn(),
  })

  it('finds CHANGELOG.md in tree when it exists', () => {
    const tree = createMockTree(['libs/my-lib/CHANGELOG.md'])

    const result = findProjectChangelogInTree(tree as Tree, '/workspace/libs/my-lib')

    expect(result).toBe(normalizeToNative('/workspace/libs/my-lib/CHANGELOG.md'))
  })

  it('queries the tree with the root-relative changelog path', () => {
    const tree = createMockTree(['libs/my-lib/CHANGELOG.md'])

    findProjectChangelogInTree(tree as Tree, '/workspace/libs/my-lib')

    expect(tree.isFile).toHaveBeenCalledWith('libs/my-lib/CHANGELOG.md')
  })

  it('finds Changelog.md as fallback in tree', () => {
    const tree = createMockTree(['libs/my-lib/Changelog.md'])

    const result = findProjectChangelogInTree(tree as Tree, '/workspace/libs/my-lib')

    expect(result).toBe(normalizeToNative('/workspace/libs/my-lib/Changelog.md'))
  })

  it('returns null when no changelog exists in tree', () => {
    const tree = createMockTree([])

    const result = findProjectChangelogInTree(tree as Tree, '/workspace/libs/my-lib')

    expect(result).toBeNull()
  })

  it('handles relative project paths', () => {
    const tree = createMockTree(['libs/my-lib/CHANGELOG.md'])

    const result = findProjectChangelogInTree(tree as Tree, 'libs/my-lib')

    expect(result).toBe(normalizeToNative('libs/my-lib/CHANGELOG.md'))
  })

  it('finds changelog created in tree but not on disk', () => {
    const tree = createMockTree(['libs/new-package/CHANGELOG.md'])

    const result = findProjectChangelogInTree(tree as Tree, '/workspace/libs/new-package')

    expect(result).toBe(normalizeToNative('/workspace/libs/new-package/CHANGELOG.md'))
  })
})

describe('findChangelogsInTree', () => {
  const createMockTree = (existingPaths: string[], root = '/workspace') => ({
    root,
    exists: jest.fn((path: string) => existingPaths.includes(path)),
    read: jest.fn(),
    write: jest.fn(),
    delete: jest.fn(),
    rename: jest.fn(),
    isFile: jest.fn((path: string) => existingPaths.includes(path)),
    isDirectory: jest.fn(),
    isSymlink: jest.fn(),
    children: jest.fn(),
    listChanges: jest.fn(() => []),
    clearChanges: jest.fn(),
    changePermissions: jest.fn(),
    changeFile: jest.fn(),
  })

  it('finds changelogs for multiple packages in tree', () => {
    const tree = createMockTree(['libs/lib-a/CHANGELOG.md', 'libs/lib-b/CHANGELOG.md'])

    const packages = [
      { path: '/workspace/libs/lib-a', name: 'lib-a' },
      { path: '/workspace/libs/lib-b', name: 'lib-b' },
    ]

    const result = findChangelogsInTree(tree as Tree, packages)

    expect(result).toEqual(
      createMap([
        ['/workspace/libs/lib-a', normalizeToNative('/workspace/libs/lib-a/CHANGELOG.md')],
        ['/workspace/libs/lib-b', normalizeToNative('/workspace/libs/lib-b/CHANGELOG.md')],
      ])
    )
  })

  it('skips packages without changelog in tree', () => {
    const tree = createMockTree(['libs/lib-a/CHANGELOG.md'])

    const packages = [
      { path: '/workspace/libs/lib-a', name: 'lib-a' },
      { path: '/workspace/libs/lib-b', name: 'lib-b' },
    ]

    const result = findChangelogsInTree(tree as Tree, packages)

    expect([...result.keys()]).toEqual(['/workspace/libs/lib-a'])
  })

  it('returns empty map for empty package list', () => {
    const tree = createMockTree([])

    const result = findChangelogsInTree(tree as Tree, [])

    expect(result.size).toBe(0)
  })

  it('finds changelogs created in tree during multi-phase flow', () => {
    const tree = createMockTree(['libs/existing/CHANGELOG.md', 'libs/new-package/CHANGELOG.md'])

    const packages = [
      { path: '/workspace/libs/existing', name: 'existing' },
      { path: '/workspace/libs/new-package', name: 'new-package' },
    ]

    const result = findChangelogsInTree(tree as Tree, packages)

    expect([...result.keys()]).toEqual(['/workspace/libs/existing', '/workspace/libs/new-package'])
  })
})
