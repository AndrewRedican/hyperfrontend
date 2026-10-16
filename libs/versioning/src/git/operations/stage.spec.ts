import type { MockedFunction } from '@hyperfrontend/testing'
import { execFileSync } from 'node:child_process'
import { beforeEach } from 'node:test'
import { describe, expect, it, jest } from '@hyperfrontend/testing'
import { stage, unstage, stageAll, hasStagedChanges, hasUnstagedChanges, discardChanges, discardAllChanges } from './stage'

jest.mock('node:child_process')

const mockExecFileSync = execFileSync as MockedFunction<typeof execFileSync>

describe('stage', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns true when staging succeeds', () => {
    mockExecFileSync.mockReturnValue('')

    const result = stage(['package.json', 'src/index.ts'])

    expect(result).toBe(true)
  })

  it('runs git add with the given files', () => {
    mockExecFileSync.mockReturnValue('')

    stage(['package.json', 'src/index.ts'])

    expect(mockExecFileSync).toHaveBeenCalledWith(
      'git',
      expect.arrayContaining(['add', 'package.json', 'src/index.ts']),
      expect.any(Object)
    )
  })

  it('stages all files with -A flag', () => {
    mockExecFileSync.mockReturnValue('')

    stage(['.'], { all: true })

    expect(mockExecFileSync).toHaveBeenCalledWith('git', expect.arrayContaining(['add', '-A']), expect.any(Object))
  })

  it('stages with update flag', () => {
    mockExecFileSync.mockReturnValue('')

    stage(['.'], { update: true })

    expect(mockExecFileSync).toHaveBeenCalledWith('git', expect.arrayContaining(['add', '-u']), expect.any(Object))
  })

  it('stages with force flag', () => {
    mockExecFileSync.mockReturnValue('')

    stage(['ignored-file.txt'], { force: true })

    expect(mockExecFileSync).toHaveBeenCalledWith('git', expect.arrayContaining(['add', '-f']), expect.any(Object))
  })

  it('returns false when staging fails', () => {
    mockExecFileSync.mockImplementation(() => {
      throw new Error('File not found')
    })

    const result = stage(['nonexistent.txt'])

    expect(result).toBe(false)
  })

  it('uses custom options', () => {
    mockExecFileSync.mockReturnValue('')

    stage(['file.txt'], { cwd: '/custom', timeout: 5000 })

    expect(mockExecFileSync).toHaveBeenCalledWith('git', expect.any(Array), expect.objectContaining({ cwd: '/custom', timeout: 5000 }))
  })
})

describe('unstage', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns true when unstaging succeeds', () => {
    mockExecFileSync.mockReturnValue('')

    const result = unstage(['package.json'])

    expect(result).toBe(true)
  })

  it('runs git reset HEAD with the given files', () => {
    mockExecFileSync.mockReturnValue('')

    unstage(['package.json'])

    expect(mockExecFileSync).toHaveBeenCalledWith(
      'git',
      expect.arrayContaining(['reset', 'HEAD', '--', 'package.json']),
      expect.any(Object)
    )
  })

  it('returns false when unstaging fails', () => {
    mockExecFileSync.mockImplementation(() => {
      throw new Error('Not in a git repository')
    })

    const result = unstage(['file.txt'])

    expect(result).toBe(false)
  })

  it('uses custom options', () => {
    mockExecFileSync.mockReturnValue('')

    unstage(['file.txt'], { cwd: '/custom', timeout: 5000 })

    expect(mockExecFileSync).toHaveBeenCalledWith('git', expect.any(Array), expect.objectContaining({ cwd: '/custom', timeout: 5000 }))
  })
})

describe('stageAll', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns true when staging all files succeeds', () => {
    mockExecFileSync.mockReturnValue('')

    const result = stageAll()

    expect(result).toBe(true)
  })

  it('runs git add -A', () => {
    mockExecFileSync.mockReturnValue('')

    stageAll()

    expect(mockExecFileSync).toHaveBeenCalledWith('git', expect.arrayContaining(['add', '-A']), expect.any(Object))
  })

  it('uses custom options', () => {
    mockExecFileSync.mockReturnValue('')

    stageAll({ cwd: '/custom' })

    expect(mockExecFileSync).toHaveBeenCalledWith('git', expect.any(Array), expect.objectContaining({ cwd: '/custom' }))
  })
})

describe('hasStagedChanges', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns true when there are staged changes', () => {
    mockExecFileSync.mockImplementation(() => {
      throw new Error('Exit code 1')
    })

    const result = hasStagedChanges()

    expect(result).toBe(true)
  })

  it('probes the index with git diff --cached --quiet', () => {
    mockExecFileSync.mockImplementation(() => {
      throw new Error('Exit code 1')
    })

    hasStagedChanges()

    expect(mockExecFileSync).toHaveBeenCalledWith('git', ['diff', '--cached', '--quiet'], expect.any(Object))
  })

  it('returns false when there are no staged changes', () => {
    mockExecFileSync.mockReturnValue('')

    const result = hasStagedChanges()

    expect(result).toBe(false)
  })

  it('uses custom options', () => {
    mockExecFileSync.mockReturnValue('')

    hasStagedChanges({ cwd: '/custom', timeout: 5000 })

    expect(mockExecFileSync).toHaveBeenCalledWith('git', expect.any(Array), expect.objectContaining({ cwd: '/custom', timeout: 5000 }))
  })
})

describe('hasUnstagedChanges', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns true when there are unstaged changes', () => {
    mockExecFileSync.mockImplementation(() => {
      throw new Error('Exit code 1')
    })

    const result = hasUnstagedChanges()

    expect(result).toBe(true)
  })

  it('probes the working tree with git diff --quiet', () => {
    mockExecFileSync.mockImplementation(() => {
      throw new Error('Exit code 1')
    })

    hasUnstagedChanges()

    expect(mockExecFileSync).toHaveBeenCalledWith('git', ['diff', '--quiet'], expect.any(Object))
  })

  it('returns false when there are no unstaged changes', () => {
    mockExecFileSync.mockReturnValue('')

    const result = hasUnstagedChanges()

    expect(result).toBe(false)
  })

  it('uses custom options', () => {
    mockExecFileSync.mockReturnValue('')

    hasUnstagedChanges({ cwd: '/custom', timeout: 5000 })

    expect(mockExecFileSync).toHaveBeenCalledWith('git', expect.any(Array), expect.objectContaining({ cwd: '/custom', timeout: 5000 }))
  })
})

describe('discardChanges', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns true when discarding succeeds', () => {
    mockExecFileSync.mockReturnValue('')

    const result = discardChanges()

    expect(result).toBe(true)
  })

  it('checks out the whole tree when no files specified', () => {
    mockExecFileSync.mockReturnValue('')

    discardChanges()

    expect(mockExecFileSync).toHaveBeenCalledWith('git', ['checkout', '--', '.'], expect.any(Object))
  })

  it('returns true when discarding specific files succeeds', () => {
    mockExecFileSync.mockReturnValue('')

    const result = discardChanges({ files: ['package.json', 'CHANGELOG.md'] })

    expect(result).toBe(true)
  })

  it('checks out only the given files when files provided', () => {
    mockExecFileSync.mockReturnValue('')

    discardChanges({ files: ['package.json', 'CHANGELOG.md'] })

    expect(mockExecFileSync).toHaveBeenCalledWith('git', ['checkout', '--', 'package.json', 'CHANGELOG.md'], expect.any(Object))
  })

  it('returns true when discarding with an empty file list succeeds', () => {
    mockExecFileSync.mockReturnValue('')

    const result = discardChanges({ files: [] })

    expect(result).toBe(true)
  })

  it('checks out the whole tree when the file list is empty', () => {
    mockExecFileSync.mockReturnValue('')

    discardChanges({ files: [] })

    expect(mockExecFileSync).toHaveBeenCalledWith('git', ['checkout', '--', '.'], expect.any(Object))
  })

  it('returns false on error', () => {
    mockExecFileSync.mockImplementation(() => {
      throw new Error('No changes to discard')
    })

    const result = discardChanges()

    expect(result).toBe(false)
  })

  it('uses custom options', () => {
    mockExecFileSync.mockReturnValue('')

    discardChanges({ cwd: '/custom', timeout: 5000 })

    expect(mockExecFileSync).toHaveBeenCalledWith('git', expect.any(Array), expect.objectContaining({ cwd: '/custom', timeout: 5000 }))
  })
})

describe('discardAllChanges', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns true when both discard and unstage succeed', () => {
    mockExecFileSync.mockReturnValue('')

    const result = discardAllChanges()

    expect(result).toBe(true)
  })

  it('checks out and unstages the whole tree', () => {
    mockExecFileSync.mockReturnValue('')

    discardAllChanges()

    expect(mockExecFileSync.mock.calls).toEqual(
      expect.arrayContaining([
        ['git', ['checkout', '--', '.'], expect.any(Object)],
        ['git', ['reset', 'HEAD', '--', '.'], expect.any(Object)],
      ])
    )
  })

  it('returns false if discardChanges fails', () => {
    mockExecFileSync
      .mockImplementationOnce(() => {
        throw new Error('Discard failed')
      })
      .mockReturnValue('')

    const result = discardAllChanges()

    expect(result).toBe(false)
  })

  it('returns false if unstage fails', () => {
    mockExecFileSync.mockReturnValueOnce('').mockImplementationOnce(() => {
      throw new Error('Unstage failed')
    })

    const result = discardAllChanges()

    expect(result).toBe(false)
  })

  it('uses custom options', () => {
    mockExecFileSync.mockReturnValue('')

    discardAllChanges({ cwd: '/custom', timeout: 5000 })

    expect(mockExecFileSync).toHaveBeenCalledWith('git', expect.any(Array), expect.objectContaining({ cwd: '/custom', timeout: 5000 }))
  })
})
