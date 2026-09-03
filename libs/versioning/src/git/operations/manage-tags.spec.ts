import type { MockedFunction } from '@hyperfrontend/testing'
import { execFileSync } from 'node:child_process'
import { beforeEach } from 'node:test'
import { describe, expect, it, jest } from '@hyperfrontend/testing'
import { createTag, deleteTag, pushTag } from './manage-tags'

jest.mock('node:child_process')

const mockExecFileSync = execFileSync as MockedFunction<typeof execFileSync>

describe('createTag', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('creates a lightweight tag', () => {
    mockExecFileSync.mockReturnValueOnce('')
    mockExecFileSync.mockReturnValueOnce('abc123def456789012345678901234567890abcd')
    mockExecFileSync.mockImplementationOnce(() => {
      throw new Error('Not annotated')
    })

    const tag = createTag('v1.0.0')

    expect(tag.name).toBe('v1.0.0')
    expect(tag.type).toBe('lightweight')
    expect(mockExecFileSync).toHaveBeenCalledWith('git', expect.arrayContaining(['tag', 'v1.0.0']), expect.any(Object))
  })

  it('creates an annotated tag with message', () => {
    mockExecFileSync.mockReturnValueOnce('')
    mockExecFileSync.mockReturnValueOnce('abc123def456789012345678901234567890abcd')
    mockExecFileSync.mockReturnValueOnce(
      'object abc123\ntype commit\ntag v1.0.0\ntagger Test <test@test.com> 1678900000 +0000\n\nRelease 1.0.0'
    )

    const tag = createTag('v1.0.0', { message: 'Release 1.0.0' })

    expect(tag.type).toBe('annotated')
    expect(mockExecFileSync).toHaveBeenCalledWith('git', expect.arrayContaining(['tag', '-a', 'v1.0.0', '-m']), expect.any(Object))
  })

  it('creates tag with force option', () => {
    mockExecFileSync.mockReturnValueOnce('')
    mockExecFileSync.mockReturnValueOnce('abc123')
    mockExecFileSync.mockImplementationOnce(() => {
      throw new Error('Not annotated')
    })

    createTag('v1.0.0', { force: true })

    expect(mockExecFileSync).toHaveBeenCalledWith('git', expect.arrayContaining(['tag', '-f']), expect.any(Object))
  })

  it('creates tag at specific target', () => {
    mockExecFileSync.mockReturnValueOnce('')
    mockExecFileSync.mockReturnValueOnce('abc123')
    mockExecFileSync.mockImplementationOnce(() => {
      throw new Error('Not annotated')
    })

    createTag('v1.0.0', { target: 'HEAD~1' })

    expect(mockExecFileSync).toHaveBeenCalledWith('git', expect.arrayContaining(['HEAD~1']), expect.any(Object))
  })

  it('throws when tag creation fails', () => {
    mockExecFileSync.mockImplementation(() => {
      throw new Error('Tag already exists')
    })

    expect(() => createTag('v1.0.0')).toThrow('Failed to create tag')
  })

  it('throws when created tag cannot be retrieved', () => {
    mockExecFileSync.mockReturnValueOnce('')
    mockExecFileSync.mockImplementation(() => {
      throw new Error('Tag not found')
    })

    expect(() => createTag('v1.0.0')).toThrow('Failed to retrieve created tag')
  })

  it('uses custom cwd and timeout', () => {
    mockExecFileSync.mockReturnValueOnce('')
    mockExecFileSync.mockReturnValueOnce('abc123')
    mockExecFileSync.mockImplementationOnce(() => {
      throw new Error('Not annotated')
    })

    createTag('v1.0.0', { cwd: '/custom', timeout: 5000 })

    expect(mockExecFileSync).toHaveBeenCalledWith('git', expect.any(Array), expect.objectContaining({ cwd: '/custom', timeout: 5000 }))
  })
})

describe('deleteTag', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('deletes existing tag and returns true', () => {
    mockExecFileSync.mockReturnValue('')

    const result = deleteTag('v1.0.0')

    expect(result).toBe(true)
    expect(mockExecFileSync).toHaveBeenCalledWith('git', expect.arrayContaining(['tag', '-d', 'v1.0.0']), expect.any(Object))
  })

  it('returns false when tag does not exist', () => {
    mockExecFileSync.mockImplementation(() => {
      throw new Error('Tag not found')
    })

    const result = deleteTag('nonexistent')

    expect(result).toBe(false)
  })

  it('uses custom options', () => {
    mockExecFileSync.mockReturnValue('')

    deleteTag('v1.0.0', { cwd: '/custom', timeout: 5000 })

    expect(mockExecFileSync).toHaveBeenCalledWith('git', expect.any(Array), expect.objectContaining({ cwd: '/custom', timeout: 5000 }))
  })
})

describe('pushTag', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('pushes tag to origin by default', () => {
    mockExecFileSync.mockReturnValue('')

    const result = pushTag('v1.0.0')

    expect(result).toBe(true)
    expect(mockExecFileSync).toHaveBeenCalledWith('git', expect.arrayContaining(['push', 'origin', 'v1.0.0']), expect.any(Object))
  })

  it('pushes tag to custom remote', () => {
    mockExecFileSync.mockReturnValue('')

    const result = pushTag('v1.0.0', 'upstream')

    expect(result).toBe(true)
    expect(mockExecFileSync).toHaveBeenCalledWith('git', expect.arrayContaining(['push', 'upstream', 'v1.0.0']), expect.any(Object))
  })

  it('returns false when push fails', () => {
    mockExecFileSync.mockImplementation(() => {
      throw new Error('Network error')
    })

    const result = pushTag('v1.0.0')

    expect(result).toBe(false)
  })

  it('uses extended timeout for network operation', () => {
    mockExecFileSync.mockReturnValue('')

    pushTag('v1.0.0', 'origin', { timeout: 10000 })

    expect(mockExecFileSync).toHaveBeenCalledWith('git', expect.any(Array), expect.objectContaining({ timeout: 30000 }))
  })

  it('uses custom options', () => {
    mockExecFileSync.mockReturnValue('')

    pushTag('v1.0.0', 'origin', { cwd: '/custom' })

    expect(mockExecFileSync).toHaveBeenCalledWith('git', expect.any(Array), expect.objectContaining({ cwd: '/custom' }))
  })
})
