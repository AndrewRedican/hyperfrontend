import { getExpectedChangelogPath, hasChangelog } from './changelog-path'

jest.mock('@hyperfrontend/project-scope', () => ({
  exists: jest.fn(),
  findFiles: jest.fn(),
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
  const projectScope = require('@hyperfrontend/project-scope')

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns true when changelog exists', () => {
    projectScope.exists.mockImplementation((path: string) => {
      return path.includes('CHANGELOG.md')
    })

    expect(hasChangelog('/workspace/libs/my-lib')).toBe(true)
  })

  it('returns false when no changelog exists', () => {
    projectScope.exists.mockReturnValue(false)

    expect(hasChangelog('/workspace/libs/my-lib')).toBe(false)
  })
})
