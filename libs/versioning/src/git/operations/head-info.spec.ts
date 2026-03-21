import { execFileSync } from 'node:child_process'
import { getHead, getCurrentBranch, hasUntrackedFiles } from './head-info'

jest.mock('node:child_process')

const mockExecFileSync = execFileSync as jest.MockedFunction<typeof execFileSync>

describe('getHead', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns HEAD commit hash', () => {
    mockExecFileSync.mockReturnValue('abc123def456789012345678901234567890abcd\n')

    const result = getHead()

    expect(result).toBe('abc123def456789012345678901234567890abcd')
    expect(mockExecFileSync).toHaveBeenCalledWith('git', ['rev-parse', 'HEAD'], expect.any(Object))
  })

  it('returns null when not in a git repository', () => {
    mockExecFileSync.mockImplementation(() => {
      throw new Error('Not a git repository')
    })

    const result = getHead()

    expect(result).toBeNull()
  })

  it('uses custom options', () => {
    mockExecFileSync.mockReturnValue('abc123\n')

    getHead({ cwd: '/custom', timeout: 5000 })

    expect(mockExecFileSync).toHaveBeenCalledWith('git', expect.any(Array), expect.objectContaining({ cwd: '/custom', timeout: 5000 }))
  })
})

describe('getCurrentBranch', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns current branch name', () => {
    mockExecFileSync.mockReturnValue('main\n')

    const result = getCurrentBranch()

    expect(result).toBe('main')
    expect(mockExecFileSync).toHaveBeenCalledWith('git', ['symbolic-ref', '--short', 'HEAD'], expect.any(Object))
  })

  it('returns feature branch name', () => {
    mockExecFileSync.mockReturnValue('feature/add-tests\n')

    const result = getCurrentBranch()

    expect(result).toBe('feature/add-tests')
  })

  it('returns null when detached HEAD', () => {
    mockExecFileSync.mockImplementation(() => {
      throw new Error('Not a symbolic ref')
    })

    const result = getCurrentBranch()

    expect(result).toBeNull()
  })

  it('returns null for empty result', () => {
    mockExecFileSync.mockReturnValue('')

    const result = getCurrentBranch()

    expect(result).toBeNull()
  })

  it('uses custom options', () => {
    mockExecFileSync.mockReturnValue('main\n')

    getCurrentBranch({ cwd: '/custom', timeout: 5000 })

    expect(mockExecFileSync).toHaveBeenCalledWith('git', expect.any(Array), expect.objectContaining({ cwd: '/custom', timeout: 5000 }))
  })
})

describe('hasUntrackedFiles', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns true when there are untracked files', () => {
    mockExecFileSync.mockReturnValue('new-file.txt\nanother-file.ts\n')

    const result = hasUntrackedFiles()

    expect(result).toBe(true)
    expect(mockExecFileSync).toHaveBeenCalledWith('git', ['ls-files', '--others', '--exclude-standard'], expect.any(Object))
  })

  it('returns false when there are no untracked files', () => {
    mockExecFileSync.mockReturnValue('')

    const result = hasUntrackedFiles()

    expect(result).toBe(false)
  })

  it('returns false on error', () => {
    mockExecFileSync.mockImplementation(() => {
      throw new Error('Not a git repository')
    })

    const result = hasUntrackedFiles()

    expect(result).toBe(false)
  })

  it('uses custom options', () => {
    mockExecFileSync.mockReturnValue('')

    hasUntrackedFiles({ cwd: '/custom', timeout: 5000 })

    expect(mockExecFileSync).toHaveBeenCalledWith('git', expect.any(Array), expect.objectContaining({ cwd: '/custom', timeout: 5000 }))
  })
})
