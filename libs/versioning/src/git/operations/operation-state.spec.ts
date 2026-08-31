import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { getOperationState, isOperationInProgress, DEFAULT_OPERATION_STATE_OPTIONS } from './operation-state'

jest.mock('node:child_process')
jest.mock('node:fs')

const mockExecFileSync = execFileSync as jest.MockedFunction<typeof execFileSync>
const mockExistsSync = existsSync as jest.MockedFunction<typeof existsSync>

describe('getOperationState', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('rebase-interactive detection', () => {
    it('returns rebase-interactive when rebase-merge exists', () => {
      mockExecFileSync.mockReturnValue('.git\n')
      mockExistsSync.mockImplementation((path) => {
        return String(path).includes('rebase-merge')
      })

      const state = getOperationState()

      expect(state).toEqual(
        expect.objectContaining({
          inProgress: true,
          reason: 'rebase-interactive',
          details: { rebaseMerge: true, rebaseApply: false, mergeHead: false },
        })
      )
    })
  })

  describe('rebase-apply detection', () => {
    it('returns rebase-apply when rebase-apply exists', () => {
      mockExecFileSync.mockReturnValue('.git\n')
      mockExistsSync.mockImplementation((path) => {
        return String(path).includes('rebase-apply')
      })

      const state = getOperationState()

      expect(state).toEqual(
        expect.objectContaining({
          inProgress: true,
          reason: 'rebase-apply',
          details: { rebaseMerge: false, rebaseApply: true, mergeHead: false },
        })
      )
    })
  })

  describe('merge-in-progress detection', () => {
    it('returns merge-in-progress when MERGE_HEAD exists', () => {
      mockExecFileSync.mockReturnValue('.git\n')
      mockExistsSync.mockImplementation((path) => {
        return String(path).includes('MERGE_HEAD')
      })

      const state = getOperationState()

      expect(state).toEqual(
        expect.objectContaining({
          inProgress: true,
          reason: 'merge-in-progress',
          details: { rebaseMerge: false, rebaseApply: false, mergeHead: true },
        })
      )
    })
  })

  describe('stable state', () => {
    it('returns stable state when no operation files exist', () => {
      mockExecFileSync.mockReturnValue('.git\n')
      mockExistsSync.mockReturnValue(false)

      const state = getOperationState()

      expect(state).toEqual(
        expect.objectContaining({
          inProgress: false,
          reason: null,
          details: { rebaseMerge: false, rebaseApply: false, mergeHead: false },
        })
      )
    })
  })

  describe('exit-early pattern', () => {
    it('returns first detected reason (rebase-interactive) when multiple states exist', () => {
      mockExecFileSync.mockReturnValue('.git\n')
      mockExistsSync.mockReturnValue(true)

      const state = getOperationState()

      expect(state).toEqual(
        expect.objectContaining({
          inProgress: true,
          reason: 'rebase-interactive',
          details: { rebaseMerge: true, rebaseApply: true, mergeHead: true },
        })
      )
    })

    it('returns rebase-apply when rebase-merge does not exist but rebase-apply does', () => {
      mockExecFileSync.mockReturnValue('.git\n')
      mockExistsSync.mockImplementation((path) => {
        const pathStr = String(path)
        return pathStr.includes('rebase-apply') || pathStr.includes('MERGE_HEAD')
      })

      const state = getOperationState()

      expect(state).toEqual(expect.objectContaining({ inProgress: true, reason: 'rebase-apply' }))
    })
  })

  describe('error handling', () => {
    it('returns stable state when git command fails', () => {
      mockExecFileSync.mockImplementation(() => {
        throw new Error('Not a git repository')
      })

      const state = getOperationState()

      expect(state).toEqual(
        expect.objectContaining({
          inProgress: false,
          reason: null,
          details: { rebaseMerge: false, rebaseApply: false, mergeHead: false },
        })
      )
    })

    it('returns stable state when git is not installed', () => {
      mockExecFileSync.mockImplementation(() => {
        const error = new Error('ENOENT') as NodeJS.ErrnoException
        error.code = 'ENOENT'
        throw error
      })

      const state = getOperationState()

      expect(state).toEqual(expect.objectContaining({ inProgress: false, reason: null }))
    })
  })

  describe('worktree support', () => {
    it('uses git dir path from rev-parse for worktree', () => {
      mockExecFileSync.mockReturnValue('/path/to/main/.git/worktrees/feature\n')
      mockExistsSync.mockImplementation((path) => {
        return String(path).includes('/path/to/main/.git/worktrees/feature/rebase-merge')
      })

      const state = getOperationState({ cwd: '/path/to/worktree' })

      expect(state).toEqual(expect.objectContaining({ inProgress: true, reason: 'rebase-interactive' }))
    })
  })

  describe('options', () => {
    it('uses custom cwd', () => {
      mockExecFileSync.mockReturnValue('.git\n')
      mockExistsSync.mockReturnValue(false)

      getOperationState({ cwd: '/custom/path' })

      expect(mockExecFileSync).toHaveBeenCalledWith('git', ['rev-parse', '--git-dir'], expect.objectContaining({ cwd: '/custom/path' }))
    })

    it('uses custom timeout', () => {
      mockExecFileSync.mockReturnValue('.git\n')
      mockExistsSync.mockReturnValue(false)

      getOperationState({ timeout: 5000 })

      expect(mockExecFileSync).toHaveBeenCalledWith('git', ['rev-parse', '--git-dir'], expect.objectContaining({ timeout: 5000 }))
    })

    it('uses default timeout from DEFAULT_OPERATION_STATE_OPTIONS', () => {
      mockExecFileSync.mockReturnValue('.git\n')
      mockExistsSync.mockReturnValue(false)

      getOperationState()

      expect(mockExecFileSync).toHaveBeenCalledWith(
        'git',
        ['rev-parse', '--git-dir'],
        expect.objectContaining({ timeout: DEFAULT_OPERATION_STATE_OPTIONS.timeout })
      )
    })
  })
})

describe('isOperationInProgress', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns true when operation is in progress', () => {
    mockExecFileSync.mockReturnValue('.git\n')
    mockExistsSync.mockImplementation((path) => {
      return String(path).includes('MERGE_HEAD')
    })

    const result = isOperationInProgress()

    expect(result).toBe(true)
  })

  it('returns false when no operation is in progress', () => {
    mockExecFileSync.mockReturnValue('.git\n')
    mockExistsSync.mockReturnValue(false)

    const result = isOperationInProgress()

    expect(result).toBe(false)
  })

  it('returns false on error', () => {
    mockExecFileSync.mockImplementation(() => {
      throw new Error('Not a git repository')
    })

    const result = isOperationInProgress()

    expect(result).toBe(false)
  })

  it('passes options through to getOperationState', () => {
    mockExecFileSync.mockReturnValue('.git\n')
    mockExistsSync.mockReturnValue(false)

    isOperationInProgress({ cwd: '/test', timeout: 1000 })

    expect(mockExecFileSync).toHaveBeenCalledWith(
      'git',
      ['rev-parse', '--git-dir'],
      expect.objectContaining({ cwd: '/test', timeout: 1000 })
    )
  })
})
