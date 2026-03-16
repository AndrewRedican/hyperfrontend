import { execSync } from 'node:child_process'
import { getHead, getCurrentBranch, hasUntrackedFiles } from './head-info'

jest.mock('node:child_process')

const mockExecSync = execSync as jest.MockedFunction<typeof execSync>

describe('getHead', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns HEAD commit hash', () => {
    mockExecSync.mockReturnValue('abc123def456789012345678901234567890abcd\n')

    const result = getHead()

    expect(result).toBe('abc123def456789012345678901234567890abcd')
    expect(mockExecSync).toHaveBeenCalledWith('git rev-parse HEAD', expect.any(Object))
  })

  it('returns null when not in a git repository', () => {
    mockExecSync.mockImplementation(() => {
      throw new Error('Not a git repository')
    })

    const result = getHead()

    expect(result).toBeNull()
  })

  it('uses custom options', () => {
    mockExecSync.mockReturnValue('abc123\n')

    getHead({ cwd: '/custom', timeout: 5000 })

    expect(mockExecSync).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ cwd: '/custom', timeout: 5000 }))
  })
})

describe('getCurrentBranch', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns current branch name', () => {
    mockExecSync.mockReturnValue('main\n')

    const result = getCurrentBranch()

    expect(result).toBe('main')
    expect(mockExecSync).toHaveBeenCalledWith('git symbolic-ref --short HEAD', expect.any(Object))
  })

  it('returns feature branch name', () => {
    mockExecSync.mockReturnValue('feature/add-tests\n')

    const result = getCurrentBranch()

    expect(result).toBe('feature/add-tests')
  })

  it('returns null when detached HEAD', () => {
    mockExecSync.mockImplementation(() => {
      throw new Error('Not a symbolic ref')
    })

    const result = getCurrentBranch()

    expect(result).toBeNull()
  })

  it('returns null for empty result', () => {
    mockExecSync.mockReturnValue('')

    const result = getCurrentBranch()

    expect(result).toBeNull()
  })

  it('uses custom options', () => {
    mockExecSync.mockReturnValue('main\n')

    getCurrentBranch({ cwd: '/custom', timeout: 5000 })

    expect(mockExecSync).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ cwd: '/custom', timeout: 5000 }))
  })
})

describe('hasUntrackedFiles', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns true when there are untracked files', () => {
    mockExecSync.mockReturnValue('new-file.txt\nanother-file.ts\n')

    const result = hasUntrackedFiles()

    expect(result).toBe(true)
    expect(mockExecSync).toHaveBeenCalledWith('git ls-files --others --exclude-standard', expect.any(Object))
  })

  it('returns false when there are no untracked files', () => {
    mockExecSync.mockReturnValue('')

    const result = hasUntrackedFiles()

    expect(result).toBe(false)
  })

  it('returns false on error', () => {
    mockExecSync.mockImplementation(() => {
      throw new Error('Not a git repository')
    })

    const result = hasUntrackedFiles()

    expect(result).toBe(false)
  })

  it('uses custom options', () => {
    mockExecSync.mockReturnValue('')

    hasUntrackedFiles({ cwd: '/custom', timeout: 5000 })

    expect(mockExecSync).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ cwd: '/custom', timeout: 5000 }))
  })
})
