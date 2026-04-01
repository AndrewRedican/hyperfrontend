import { execFileSync } from 'node:child_process'
import { getTags, getTag, getLatestTag, getTagsForPackage, tagExists, DEFAULT_TAG_OPTIONS } from './query-tags'

jest.mock('node:child_process')

const mockExecFileSync = execFileSync as jest.MockedFunction<typeof execFileSync>

describe('getTags', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns empty array when no tags exist', () => {
    mockExecFileSync.mockReturnValue('')

    const tags = getTags()

    expect(tags).toEqual([])
  })

  it('returns tags from repository', () => {
    mockExecFileSync.mockReturnValueOnce('v1.0.0\nv2.0.0\n')
    mockExecFileSync.mockReturnValueOnce('abc123def456789012345678901234567890abcd')
    mockExecFileSync.mockImplementationOnce(() => {
      throw new Error('Not an annotated tag')
    })
    mockExecFileSync.mockReturnValueOnce('def456abc789012345678901234567890abcdef')
    mockExecFileSync.mockImplementationOnce(() => {
      throw new Error('Not an annotated tag')
    })

    const tags = getTags()

    expect(tags).toHaveLength(2)
    expect(tags[0].name).toBe('v1.0.0')
    expect(tags[0].type).toBe('lightweight')
    expect(tags[1].name).toBe('v2.0.0')
    expect(tags[1].type).toBe('lightweight')
  })

  it('parses annotated tags with metadata', () => {
    mockExecFileSync.mockReturnValueOnce('v1.0.0\n')
    mockExecFileSync.mockReturnValueOnce('abc123def456789012345678901234567890abcd')
    mockExecFileSync.mockReturnValueOnce(
      'object abc123def456789012345678901234567890abcd\n' +
        'type commit\n' +
        'tag v1.0.0\n' +
        'tagger John Doe <john@example.com> 1678900000 +0000\n' +
        '\n' +
        'Release v1.0.0'
    )

    const tags = getTags()

    expect(tags).toHaveLength(1)
    expect(tags[0].name).toBe('v1.0.0')
    expect(tags[0].type).toBe('annotated')
    expect(tags[0].message).toBe('Release v1.0.0')
    expect(tags[0].taggerName).toBe('John Doe')
    expect(tags[0].taggerEmail).toBe('john@example.com')
    expect(tags[0].tagDate).toBeDefined()
  })

  it('filters tags by pattern', () => {
    mockExecFileSync.mockReturnValueOnce('v1.0.0\n')
    mockExecFileSync.mockReturnValueOnce('abc123def456789012345678901234567890abcd')
    mockExecFileSync.mockImplementationOnce(() => {
      throw new Error('Not an annotated tag')
    })

    getTags({ pattern: 'v' })

    expect(mockExecFileSync).toHaveBeenCalledWith('git', expect.arrayContaining(['v*']), expect.any(Object))
  })

  it('limits results with maxCount', () => {
    mockExecFileSync.mockReturnValueOnce('v1.0.0\nv2.0.0\nv3.0.0\n')
    mockExecFileSync.mockReturnValueOnce('abc123')
    mockExecFileSync.mockImplementationOnce(() => {
      throw new Error('Not annotated')
    })

    const tags = getTags({ maxCount: 1 })

    expect(tags).toHaveLength(1)
  })

  it('handles errors gracefully', () => {
    mockExecFileSync.mockImplementation(() => {
      throw new Error('Not a git repository')
    })

    const tags = getTags()

    expect(tags).toEqual([])
  })

  it('uses custom cwd option', () => {
    mockExecFileSync.mockReturnValue('')

    getTags({ cwd: '/custom/path' })

    expect(mockExecFileSync).toHaveBeenCalledWith('git', expect.any(Array), expect.objectContaining({ cwd: '/custom/path' }))
  })

  it('uses custom timeout option', () => {
    mockExecFileSync.mockReturnValue('')

    getTags({ timeout: 5000 })

    expect(mockExecFileSync).toHaveBeenCalledWith('git', expect.any(Array), expect.objectContaining({ timeout: 5000 }))
  })

  it('uses default timeout', () => {
    mockExecFileSync.mockReturnValue('')

    getTags()

    expect(mockExecFileSync).toHaveBeenCalledWith(
      'git',
      expect.any(Array),
      expect.objectContaining({ timeout: DEFAULT_TAG_OPTIONS.timeout })
    )
  })
})

describe('getTag', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns lightweight tag details', () => {
    mockExecFileSync.mockReturnValueOnce('abc123def456789012345678901234567890abcd')
    mockExecFileSync.mockImplementationOnce(() => {
      throw new Error('Not an annotated tag')
    })

    const tag = getTag('v1.0.0')

    expect(tag).not.toBeNull()
    expect(tag?.name).toBe('v1.0.0')
    expect(tag?.type).toBe('lightweight')
    expect(tag?.commitHash).toBe('abc123def456789012345678901234567890abcd')
  })

  it('returns annotated tag details', () => {
    mockExecFileSync.mockReturnValueOnce('abc123def456789012345678901234567890abcd')
    mockExecFileSync.mockReturnValueOnce(
      'object abc123def456789012345678901234567890abcd\n' +
        'type commit\n' +
        'tag v1.0.0\n' +
        'tagger Jane Doe <jane@example.com> 1678900000 +0000\n' +
        '\n' +
        'Version 1.0.0 release\nWith multiline message'
    )

    const tag = getTag('v1.0.0')

    expect(tag).not.toBeNull()
    expect(tag?.name).toBe('v1.0.0')
    expect(tag?.type).toBe('annotated')
    expect(tag?.message).toBe('Version 1.0.0 release\nWith multiline message')
    expect(tag?.taggerName).toBe('Jane Doe')
    expect(tag?.taggerEmail).toBe('jane@example.com')
  })

  it('returns null for non-existent tag', () => {
    mockExecFileSync.mockImplementation(() => {
      throw new Error('Tag not found')
    })

    const tag = getTag('nonexistent')

    expect(tag).toBeNull()
  })

  it('uses custom options', () => {
    mockExecFileSync.mockReturnValueOnce('abc123')
    mockExecFileSync.mockImplementationOnce(() => {
      throw new Error('Not annotated')
    })

    getTag('v1.0.0', { cwd: '/custom', timeout: 5000 })

    expect(mockExecFileSync).toHaveBeenCalledWith('git', expect.any(Array), expect.objectContaining({ cwd: '/custom', timeout: 5000 }))
  })
})

describe('tagExists', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns true when tag exists', () => {
    mockExecFileSync.mockReturnValue('abc123def456789012345678901234567890abcd')

    const result = tagExists('v1.0.0')

    expect(result).toBe(true)
    expect(mockExecFileSync).toHaveBeenCalledWith('git', expect.arrayContaining(['rev-parse', 'v1.0.0']), expect.any(Object))
  })

  it('returns false when tag does not exist', () => {
    mockExecFileSync.mockImplementation(() => {
      throw new Error('Unknown revision')
    })

    const result = tagExists('nonexistent')

    expect(result).toBe(false)
  })

  it('uses custom options', () => {
    mockExecFileSync.mockReturnValue('abc123')

    tagExists('v1.0.0', { cwd: '/custom', timeout: 5000 })

    expect(mockExecFileSync).toHaveBeenCalledWith('git', expect.any(Array), expect.objectContaining({ cwd: '/custom', timeout: 5000 }))
  })
})

describe('getLatestTag', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns the latest tag', () => {
    mockExecFileSync.mockReturnValueOnce('v2.0.0\n')
    mockExecFileSync.mockReturnValueOnce('abc123')
    mockExecFileSync.mockImplementationOnce(() => {
      throw new Error('Not annotated')
    })

    const tag = getLatestTag()

    expect(tag).not.toBeNull()
    expect(tag?.name).toBe('v2.0.0')
  })

  it('returns null when no tags exist', () => {
    mockExecFileSync.mockReturnValue('')

    const tag = getLatestTag()

    expect(tag).toBeNull()
  })

  it('filters by pattern', () => {
    mockExecFileSync.mockReturnValueOnce('v1.0.0\n')
    mockExecFileSync.mockReturnValueOnce('abc123')
    mockExecFileSync.mockImplementationOnce(() => {
      throw new Error('Not annotated')
    })

    getLatestTag({ pattern: 'v' })

    expect(mockExecFileSync).toHaveBeenCalledWith('git', expect.arrayContaining(['v*']), expect.any(Object))
  })
})

describe('getTagsForPackage', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns tags matching package@version pattern', () => {
    mockExecFileSync.mockReturnValueOnce('@scope/pkg@1.0.0\n@scope/pkg@2.0.0\nother@1.0.0\n')
    mockExecFileSync.mockReturnValueOnce('abc123')
    mockExecFileSync.mockImplementationOnce(() => {
      throw new Error('Not annotated')
    })
    mockExecFileSync.mockReturnValueOnce('def456')
    mockExecFileSync.mockImplementationOnce(() => {
      throw new Error('Not annotated')
    })
    mockExecFileSync.mockReturnValueOnce('ghi789')
    mockExecFileSync.mockImplementationOnce(() => {
      throw new Error('Not annotated')
    })

    const tags = getTagsForPackage('@scope/pkg')

    expect(tags).toHaveLength(2)
    expect(tags[0].name).toBe('@scope/pkg@1.0.0')
    expect(tags[1].name).toBe('@scope/pkg@2.0.0')
  })

  it('returns tags matching package-v pattern', () => {
    mockExecFileSync.mockReturnValueOnce('mypackage-v1.0.0\nmypackage-v2.0.0\n')
    mockExecFileSync.mockReturnValueOnce('abc123')
    mockExecFileSync.mockImplementationOnce(() => {
      throw new Error('Not annotated')
    })
    mockExecFileSync.mockReturnValueOnce('def456')
    mockExecFileSync.mockImplementationOnce(() => {
      throw new Error('Not annotated')
    })

    const tags = getTagsForPackage('mypackage')

    expect(tags).toHaveLength(2)
    expect(tags[0].name).toBe('mypackage-v1.0.0')
    expect(tags[1].name).toBe('mypackage-v2.0.0')
  })

  it('returns empty array when no matching tags', () => {
    mockExecFileSync.mockReturnValueOnce('other-pkg@1.0.0\n')
    mockExecFileSync.mockReturnValueOnce('abc123')
    mockExecFileSync.mockImplementationOnce(() => {
      throw new Error('Not annotated')
    })

    const tags = getTagsForPackage('@scope/mypackage')

    expect(tags).toEqual([])
  })
})

describe('Edge cases and parsing', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('handles annotated tag with no message', () => {
    mockExecFileSync.mockReturnValueOnce('v1.0.0\n')
    mockExecFileSync.mockReturnValueOnce('abc123')
    mockExecFileSync.mockReturnValueOnce('object abc123\ntype commit\ntag v1.0.0\ntagger Test <test@test.com> 1678900000 +0000\n')

    const tags = getTags()

    expect(tags[0].message).toBe('')
  })

  it('handles tags with special characters in names', () => {
    mockExecFileSync.mockReturnValueOnce('@hyperfrontend/lib-versioning@1.0.0\n')
    mockExecFileSync.mockReturnValueOnce('abc123')
    mockExecFileSync.mockImplementationOnce(() => {
      throw new Error('Not annotated')
    })

    const tags = getTags()

    expect(tags[0].name).toBe('@hyperfrontend/lib-versioning@1.0.0')
  })

  it('handles empty tagger info', () => {
    mockExecFileSync.mockReturnValueOnce('v1.0.0\n')
    mockExecFileSync.mockReturnValueOnce('abc123')
    mockExecFileSync.mockReturnValueOnce('object abc123\ntype commit\ntag v1.0.0\n\nMessage only')

    const tags = getTags()

    expect(tags[0].taggerName).toBe('')
    expect(tags[0].taggerEmail).toBe('')
  })

  it('handles malformed tagger line gracefully', () => {
    mockExecFileSync.mockReturnValueOnce('v1.0.0\n')
    mockExecFileSync.mockReturnValueOnce('abc123')
    mockExecFileSync.mockReturnValueOnce('object abc123\ntype commit\ntag v1.0.0\ntagger Invalid Tagger Line\n\nMessage')

    const tags = getTags()

    expect(tags[0].taggerEmail).toBe('')
  })
})
