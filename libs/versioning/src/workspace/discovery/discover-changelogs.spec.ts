import { CHANGELOG_NAMES, findChangelogs, findProjectChangelog, discoverAllChangelogs } from './discover-changelogs'

jest.mock('@hyperfrontend/project-scope', () => ({
  exists: jest.fn(),
  findFiles: jest.fn(),
}))

describe('CHANGELOG_NAMES', () => {
  it('contains common changelog names', () => {
    expect(CHANGELOG_NAMES).toContain('CHANGELOG.md')
    expect(CHANGELOG_NAMES).toContain('Changelog.md')
    expect(CHANGELOG_NAMES).toContain('changelog.md')
  })

  it('contains alternative names', () => {
    expect(CHANGELOG_NAMES).toContain('HISTORY.md')
    expect(CHANGELOG_NAMES).toContain('CHANGES.md')
  })

  it('has CHANGELOG.md first (highest priority)', () => {
    expect(CHANGELOG_NAMES[0]).toBe('CHANGELOG.md')
  })
})

describe('findProjectChangelog', () => {
  const projectScope = require('@hyperfrontend/project-scope')

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('finds CHANGELOG.md when it exists', () => {
    projectScope.exists.mockImplementation((path: string) => {
      return path === '/workspace/libs/my-lib/CHANGELOG.md'
    })

    const result = findProjectChangelog('/workspace/libs/my-lib')

    expect(result).toBe('/workspace/libs/my-lib/CHANGELOG.md')
  })

  it('finds Changelog.md as fallback', () => {
    projectScope.exists.mockImplementation((path: string) => {
      return path === '/workspace/libs/my-lib/Changelog.md'
    })

    const result = findProjectChangelog('/workspace/libs/my-lib')

    expect(result).toBe('/workspace/libs/my-lib/Changelog.md')
  })

  it('finds HISTORY.md as fallback', () => {
    projectScope.exists.mockImplementation((path: string) => {
      return path === '/workspace/libs/my-lib/HISTORY.md'
    })

    const result = findProjectChangelog('/workspace/libs/my-lib')

    expect(result).toBe('/workspace/libs/my-lib/HISTORY.md')
  })

  it('returns null when no changelog exists', () => {
    projectScope.exists.mockReturnValue(false)

    const result = findProjectChangelog('/workspace/libs/my-lib')

    expect(result).toBeNull()
  })

  it('returns first matching changelog in priority order', () => {
    projectScope.exists.mockImplementation((path: string) => {
      return path.includes('CHANGELOG.md') || path.includes('changelog.md')
    })

    const result = findProjectChangelog('/workspace/libs/my-lib')

    expect(result).toBe('/workspace/libs/my-lib/CHANGELOG.md')
  })
})

describe('findChangelogs', () => {
  const projectScope = require('@hyperfrontend/project-scope')

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('finds changelogs for multiple packages', () => {
    projectScope.exists.mockImplementation((path: string) => {
      return path.includes('CHANGELOG.md')
    })

    const packages = [
      { path: '/workspace/libs/lib-a', name: 'lib-a' },
      { path: '/workspace/libs/lib-b', name: 'lib-b' },
    ]

    const result = findChangelogs('/workspace', packages)

    expect(result.size).toBe(2)
    expect(result.get('/workspace/libs/lib-a')).toBe('/workspace/libs/lib-a/CHANGELOG.md')
    expect(result.get('/workspace/libs/lib-b')).toBe('/workspace/libs/lib-b/CHANGELOG.md')
  })

  it('skips packages without changelog', () => {
    projectScope.exists.mockImplementation((path: string) => {
      return path.includes('lib-a')
    })

    const packages = [
      { path: '/workspace/libs/lib-a', name: 'lib-a' },
      { path: '/workspace/libs/lib-b', name: 'lib-b' },
    ]

    const result = findChangelogs('/workspace', packages)

    expect(result.size).toBe(1)
    expect(result.has('/workspace/libs/lib-a')).toBe(true)
    expect(result.has('/workspace/libs/lib-b')).toBe(false)
  })

  it('returns empty map for empty package list', () => {
    const result = findChangelogs('/workspace', [])

    expect(result.size).toBe(0)
  })
})

describe('discoverAllChangelogs', () => {
  const projectScope = require('@hyperfrontend/project-scope')

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('discovers changelogs using glob patterns', () => {
    projectScope.findFiles.mockReturnValue(['libs/lib-a/CHANGELOG.md', 'libs/lib-b/changelog.md'])

    const result = discoverAllChangelogs('/workspace')

    expect(result).toHaveLength(2)
    expect(result[0].relativePath).toBe('libs/lib-a/CHANGELOG.md')
    expect(result[0].path).toBe('/workspace/libs/lib-a/CHANGELOG.md')
    expect(result[0].filename).toBe('CHANGELOG.md')
  })

  it('extracts project path from changelog path', () => {
    projectScope.findFiles.mockReturnValue(['packages/my-package/CHANGELOG.md'])

    const result = discoverAllChangelogs('/workspace')

    expect(result[0].projectPath).toBe('/workspace/packages/my-package')
  })

  it('returns empty array when no changelogs found', () => {
    projectScope.findFiles.mockReturnValue([])

    const result = discoverAllChangelogs('/workspace')

    expect(result).toEqual([])
  })

  it('uses custom patterns', () => {
    projectScope.findFiles.mockReturnValue([])

    discoverAllChangelogs('/workspace', ['apps/**/CHANGELOG.md'])

    expect(projectScope.findFiles).toHaveBeenCalledWith(
      '/workspace',
      ['apps/**/CHANGELOG.md'],
      expect.objectContaining({
        ignorePatterns: ['**/node_modules/**', '**/dist/**'],
        absolutePaths: false,
      })
    )
  })
})
