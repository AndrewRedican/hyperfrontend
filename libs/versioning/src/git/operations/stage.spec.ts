import { execFileSync } from 'node:child_process'
import { stage, unstage, stageAll, hasStagedChanges, hasUnstagedChanges, discardChanges, discardAllChanges } from './stage'

jest.mock('node:child_process')

const mockExecFileSync = execFileSync as jest.MockedFunction<typeof execFileSync>

describe('stage', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('stages files', () => {
    mockExecFileSync.mockReturnValue('')

    const result = stage(['package.json', 'src/index.ts'])

    expect(result).toBe(true)
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

  it('unstages files', () => {
    mockExecFileSync.mockReturnValue('')

    const result = unstage(['package.json'])

    expect(result).toBe(true)
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

  it('stages all files', () => {
    mockExecFileSync.mockReturnValue('')

    const result = stageAll()

    expect(result).toBe(true)
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

  it('discards all changes when no files specified', () => {
    mockExecFileSync.mockReturnValue('')

    const result = discardChanges()

    expect(result).toBe(true)
    expect(mockExecFileSync).toHaveBeenCalledWith('git', ['checkout', '--', '.'], expect.any(Object))
  })

  it('discards specific files when files provided', () => {
    mockExecFileSync.mockReturnValue('')

    const result = discardChanges({ files: ['package.json', 'CHANGELOG.md'] })

    expect(result).toBe(true)
    expect(mockExecFileSync).toHaveBeenCalledWith('git', ['checkout', '--', 'package.json', 'CHANGELOG.md'], expect.any(Object))
  })

  it('discards files with empty array (all changes)', () => {
    mockExecFileSync.mockReturnValue('')

    const result = discardChanges({ files: [] })

    expect(result).toBe(true)
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

  it('calls discardChanges and unstage', () => {
    mockExecFileSync.mockReturnValue('')

    const result = discardAllChanges()

    expect(result).toBe(true)
    // Should call git checkout -- .
    expect(mockExecFileSync).toHaveBeenCalledWith('git', ['checkout', '--', '.'], expect.any(Object))
    // Should call git reset HEAD -- .
    expect(mockExecFileSync).toHaveBeenCalledWith('git', ['reset', 'HEAD', '--', '.'], expect.any(Object))
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
    mockExecFileSync
      .mockReturnValueOnce('') // discardChanges succeeds
      .mockImplementationOnce(() => {
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
