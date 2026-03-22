import { getExpectedChangelogPath, hasChangelog } from './changelog-path'

jest.mock('@hyperfrontend/project-scope/core/fs', () => ({
  exists: jest.fn(),
}))

describe('getExpectedChangelogPath', () => {
  it('returns path with CHANGELOG.md', () => {
    const path = getExpectedChangelogPath('/workspace/libs/my-lib')
    expect(path).toBe('/workspace/libs/my-lib/CHANGELOG.md')
  })

  it('handles trailing slash', () => {
    const path = getExpectedChangelogPath('/workspace/libs/my-lib/')
    expect(path).toBe('/workspace/libs/my-lib/CHANGELOG.md')
  })

  it('handles relative paths', () => {
    const path = getExpectedChangelogPath('./libs/my-lib')
    expect(path).toBe('libs/my-lib/CHANGELOG.md')
  })

  it('uses custom fileName when provided', () => {
    const path = getExpectedChangelogPath('/workspace/libs/my-lib', 'HISTORY.md')
    expect(path).toBe('/workspace/libs/my-lib/HISTORY.md')
  })

  it('uses DEFAULT_CHANGELOG_FILENAME when no fileName provided', () => {
    const path = getExpectedChangelogPath('/workspace/libs/my-lib')
    expect(path).toBe('/workspace/libs/my-lib/CHANGELOG.md')
  })
})

describe('hasChangelog', () => {
  const projectScopeFs = require('@hyperfrontend/project-scope/core/fs')

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns true when changelog exists', () => {
    projectScopeFs.exists.mockImplementation((path: string) => {
      return path.includes('CHANGELOG.md')
    })

    expect(hasChangelog('/workspace/libs/my-lib')).toBe(true)
  })

  it('returns false when no changelog exists', () => {
    projectScopeFs.exists.mockReturnValue(false)

    expect(hasChangelog('/workspace/libs/my-lib')).toBe(false)
  })
})
