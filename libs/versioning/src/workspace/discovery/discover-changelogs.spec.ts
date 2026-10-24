import type { Tree } from '@hyperfrontend/project-scope/vfs'
import { beforeEach } from 'node:test'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { fromEntries } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { exists } from '@hyperfrontend/project-scope/core/fs'
import { normalizeToNative } from '@hyperfrontend/project-scope/core/path'
import { findFiles } from '@hyperfrontend/project-scope/project/traversal'
import { createMemoryTree } from '@hyperfrontend/project-scope/vfs'
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

const existsMock = jest.mocked(exists)
const findFilesMock = jest.mocked(findFiles)

/**
 * Builds an in-memory tree holding an empty file at each given root-relative path.
 *
 * @param paths - Root-relative paths of the files the tree holds
 * @returns Tree rooted at `/workspace` holding the files
 */
function treeWithFiles(paths: readonly string[]): Tree {
  return createMemoryTree(fromEntries(paths.map((path) => [path, ''])))
}

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
    existsMock.mockImplementation((path: string) => {
      return path === normalizeToNative('/workspace/libs/my-lib/CHANGELOG.md')
    })

    const result = findProjectChangelog('/workspace/libs/my-lib')

    expect(result).toBe(normalizeToNative('/workspace/libs/my-lib/CHANGELOG.md'))
  })

  it('finds Changelog.md as fallback', () => {
    existsMock.mockImplementation((path: string) => {
      return path === normalizeToNative('/workspace/libs/my-lib/Changelog.md')
    })

    const result = findProjectChangelog('/workspace/libs/my-lib')

    expect(result).toBe(normalizeToNative('/workspace/libs/my-lib/Changelog.md'))
  })

  it('finds HISTORY.md as fallback', () => {
    existsMock.mockImplementation((path: string) => {
      return path === normalizeToNative('/workspace/libs/my-lib/HISTORY.md')
    })

    const result = findProjectChangelog('/workspace/libs/my-lib')

    expect(result).toBe(normalizeToNative('/workspace/libs/my-lib/HISTORY.md'))
  })

  it('returns null when no changelog exists', () => {
    existsMock.mockReturnValue(false)

    const result = findProjectChangelog('/workspace/libs/my-lib')

    expect(result).toBeNull()
  })

  it('returns first matching changelog in priority order', () => {
    existsMock.mockImplementation((path: string) => {
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
    existsMock.mockImplementation((path: string) => {
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
    existsMock.mockImplementation((path: string) => {
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
    findFilesMock.mockReturnValue(['libs/lib-a/CHANGELOG.md', 'libs/lib-b/changelog.md'])

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
    findFilesMock.mockReturnValue(['packages/my-package/CHANGELOG.md'])

    const result = discoverAllChangelogs('/workspace')

    expect(result?.[0]).toEqual(expect.objectContaining({ projectPath: normalizeToNative('/workspace/packages/my-package') }))
  })

  it('returns empty array when no changelogs found', () => {
    findFilesMock.mockReturnValue([])

    const result = discoverAllChangelogs('/workspace')

    expect(result).toEqual([])
  })

  it('uses custom patterns', () => {
    findFilesMock.mockReturnValue([])

    discoverAllChangelogs('/workspace', ['apps/**/CHANGELOG.md'])

    expect(findFilesMock).toHaveBeenCalledWith(
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
  it('finds CHANGELOG.md in tree when it exists', () => {
    const tree = treeWithFiles(['libs/my-lib/CHANGELOG.md'])

    const result = findProjectChangelogInTree(tree, '/workspace/libs/my-lib')

    expect(result).toBe(normalizeToNative('/workspace/libs/my-lib/CHANGELOG.md'))
  })

  it('queries the tree with the root-relative changelog path', () => {
    const tree = treeWithFiles(['libs/my-lib/CHANGELOG.md'])
    const isFile = jest.spyOn(tree, 'isFile')

    findProjectChangelogInTree(tree, '/workspace/libs/my-lib')

    expect(isFile).toHaveBeenCalledWith('libs/my-lib/CHANGELOG.md')
  })

  it('finds Changelog.md as fallback in tree', () => {
    const tree = treeWithFiles(['libs/my-lib/Changelog.md'])

    const result = findProjectChangelogInTree(tree, '/workspace/libs/my-lib')

    expect(result).toBe(normalizeToNative('/workspace/libs/my-lib/Changelog.md'))
  })

  it('returns null when no changelog exists in tree', () => {
    const tree = treeWithFiles([])

    const result = findProjectChangelogInTree(tree, '/workspace/libs/my-lib')

    expect(result).toBeNull()
  })

  it('handles relative project paths', () => {
    const tree = treeWithFiles(['libs/my-lib/CHANGELOG.md'])

    const result = findProjectChangelogInTree(tree, 'libs/my-lib')

    expect(result).toBe(normalizeToNative('libs/my-lib/CHANGELOG.md'))
  })

  it('finds changelog created in tree but not on disk', () => {
    const tree = treeWithFiles(['libs/new-package/CHANGELOG.md'])

    const result = findProjectChangelogInTree(tree, '/workspace/libs/new-package')

    expect(result).toBe(normalizeToNative('/workspace/libs/new-package/CHANGELOG.md'))
  })
})

describe('findChangelogsInTree', () => {
  it('finds changelogs for multiple packages in tree', () => {
    const tree = treeWithFiles(['libs/lib-a/CHANGELOG.md', 'libs/lib-b/CHANGELOG.md'])

    const packages = [
      { path: '/workspace/libs/lib-a', name: 'lib-a' },
      { path: '/workspace/libs/lib-b', name: 'lib-b' },
    ]

    const result = findChangelogsInTree(tree, packages)

    expect(result).toEqual(
      createMap([
        ['/workspace/libs/lib-a', normalizeToNative('/workspace/libs/lib-a/CHANGELOG.md')],
        ['/workspace/libs/lib-b', normalizeToNative('/workspace/libs/lib-b/CHANGELOG.md')],
      ])
    )
  })

  it('skips packages without changelog in tree', () => {
    const tree = treeWithFiles(['libs/lib-a/CHANGELOG.md'])

    const packages = [
      { path: '/workspace/libs/lib-a', name: 'lib-a' },
      { path: '/workspace/libs/lib-b', name: 'lib-b' },
    ]

    const result = findChangelogsInTree(tree, packages)

    expect([...result.keys()]).toEqual(['/workspace/libs/lib-a'])
  })

  it('returns empty map for empty package list', () => {
    const tree = treeWithFiles([])

    const result = findChangelogsInTree(tree, [])

    expect(result.size).toBe(0)
  })

  it('finds changelogs created in tree during multi-phase flow', () => {
    const tree = treeWithFiles(['libs/existing/CHANGELOG.md', 'libs/new-package/CHANGELOG.md'])

    const packages = [
      { path: '/workspace/libs/existing', name: 'existing' },
      { path: '/workspace/libs/new-package', name: 'new-package' },
    ]

    const result = findChangelogsInTree(tree, packages)

    expect([...result.keys()]).toEqual(['/workspace/libs/existing', '/workspace/libs/new-package'])
  })
})
