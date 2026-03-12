import { execSync } from 'node:child_process'
import { createTag, deleteTag, pushTag } from './manage-tags'

jest.mock('node:child_process')

const mockExecSync = execSync as jest.MockedFunction<typeof execSync>

describe('createTag', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('creates a lightweight tag', () => {
    // Create tag command
    mockExecSync.mockReturnValueOnce('')
    // Get tag details (rev-list)
    mockExecSync.mockReturnValueOnce('abc123def456789012345678901234567890abcd')
    // cat-file (fails for lightweight)
    mockExecSync.mockImplementationOnce(() => {
      throw new Error('Not annotated')
    })

    const tag = createTag('v1.0.0')

    expect(tag.name).toBe('v1.0.0')
    expect(tag.type).toBe('lightweight')
    expect(mockExecSync).toHaveBeenCalledWith(expect.stringContaining('git tag v1.0.0'), expect.any(Object))
  })

  it('creates an annotated tag with message', () => {
    mockExecSync.mockReturnValueOnce('')
    mockExecSync.mockReturnValueOnce('abc123def456789012345678901234567890abcd')
    mockExecSync.mockReturnValueOnce(
      'object abc123\ntype commit\ntag v1.0.0\ntagger Test <test@test.com> 1678900000 +0000\n\nRelease 1.0.0'
    )

    const tag = createTag('v1.0.0', { message: 'Release 1.0.0' })

    expect(tag.type).toBe('annotated')
    expect(mockExecSync).toHaveBeenCalledWith(expect.stringMatching(/git tag -a v1\.0\.0 -m/), expect.any(Object))
  })

  it('creates tag with force option', () => {
    mockExecSync.mockReturnValueOnce('')
    mockExecSync.mockReturnValueOnce('abc123')
    mockExecSync.mockImplementationOnce(() => {
      throw new Error('Not annotated')
    })

    createTag('v1.0.0', { force: true })

    expect(mockExecSync).toHaveBeenCalledWith(expect.stringContaining('git tag -f'), expect.any(Object))
  })

  it('creates tag at specific target', () => {
    mockExecSync.mockReturnValueOnce('')
    mockExecSync.mockReturnValueOnce('abc123')
    mockExecSync.mockImplementationOnce(() => {
      throw new Error('Not annotated')
    })

    createTag('v1.0.0', { target: 'HEAD~1' })

    expect(mockExecSync).toHaveBeenCalledWith(expect.stringContaining('HEAD~1'), expect.any(Object))
  })

  it('throws when tag creation fails', () => {
    mockExecSync.mockImplementation(() => {
      throw new Error('Tag already exists')
    })

    expect(() => createTag('v1.0.0')).toThrow('Failed to create tag')
  })

  it('throws when created tag cannot be retrieved', () => {
    // Create succeeds
    mockExecSync.mockReturnValueOnce('')
    // But retrieval fails
    mockExecSync.mockImplementation(() => {
      throw new Error('Tag not found')
    })

    expect(() => createTag('v1.0.0')).toThrow('Failed to retrieve created tag')
  })

  it('uses custom cwd and timeout', () => {
    mockExecSync.mockReturnValueOnce('')
    mockExecSync.mockReturnValueOnce('abc123')
    mockExecSync.mockImplementationOnce(() => {
      throw new Error('Not annotated')
    })

    createTag('v1.0.0', { cwd: '/custom', timeout: 5000 })

    expect(mockExecSync).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ cwd: '/custom', timeout: 5000 }))
  })
})

describe('deleteTag', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('deletes existing tag and returns true', () => {
    mockExecSync.mockReturnValue('')

    const result = deleteTag('v1.0.0')

    expect(result).toBe(true)
    expect(mockExecSync).toHaveBeenCalledWith(expect.stringContaining('git tag -d v1.0.0'), expect.any(Object))
  })

  it('returns false when tag does not exist', () => {
    mockExecSync.mockImplementation(() => {
      throw new Error('Tag not found')
    })

    const result = deleteTag('nonexistent')

    expect(result).toBe(false)
  })

  it('uses custom options', () => {
    mockExecSync.mockReturnValue('')

    deleteTag('v1.0.0', { cwd: '/custom', timeout: 5000 })

    expect(mockExecSync).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ cwd: '/custom', timeout: 5000 }))
  })
})

describe('pushTag', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('pushes tag to origin by default', () => {
    mockExecSync.mockReturnValue('')

    const result = pushTag('v1.0.0')

    expect(result).toBe(true)
    expect(mockExecSync).toHaveBeenCalledWith(expect.stringContaining('git push origin v1.0.0'), expect.any(Object))
  })

  it('pushes tag to custom remote', () => {
    mockExecSync.mockReturnValue('')

    const result = pushTag('v1.0.0', 'upstream')

    expect(result).toBe(true)
    expect(mockExecSync).toHaveBeenCalledWith(expect.stringContaining('git push upstream v1.0.0'), expect.any(Object))
  })

  it('returns false when push fails', () => {
    mockExecSync.mockImplementation(() => {
      throw new Error('Network error')
    })

    const result = pushTag('v1.0.0')

    expect(result).toBe(false)
  })

  it('uses extended timeout for network operation', () => {
    mockExecSync.mockReturnValue('')

    pushTag('v1.0.0', 'origin', { timeout: 10000 })

    expect(mockExecSync).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ timeout: 30000 }) // 3x the base timeout
    )
  })

  it('uses custom options', () => {
    mockExecSync.mockReturnValue('')

    pushTag('v1.0.0', 'origin', { cwd: '/custom' })

    expect(mockExecSync).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ cwd: '/custom' }))
  })
})
