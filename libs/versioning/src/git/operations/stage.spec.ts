import { execSync } from 'node:child_process'
import { stage, unstage, stageAll, hasStagedChanges, hasUnstagedChanges } from './stage'

jest.mock('node:child_process')

const mockExecSync = execSync as jest.MockedFunction<typeof execSync>

describe('stage', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('stages files', () => {
    mockExecSync.mockReturnValue('')

    const result = stage(['package.json', 'src/index.ts'])

    expect(result).toBe(true)
    expect(mockExecSync).toHaveBeenCalledWith(expect.stringContaining('git add package.json src/index.ts'), expect.any(Object))
  })

  it('stages all files with -A flag', () => {
    mockExecSync.mockReturnValue('')

    stage(['.'], { all: true })

    expect(mockExecSync).toHaveBeenCalledWith(expect.stringContaining('git add -A'), expect.any(Object))
  })

  it('stages with update flag', () => {
    mockExecSync.mockReturnValue('')

    stage(['.'], { update: true })

    expect(mockExecSync).toHaveBeenCalledWith(expect.stringContaining('git add -u'), expect.any(Object))
  })

  it('stages with force flag', () => {
    mockExecSync.mockReturnValue('')

    stage(['ignored-file.txt'], { force: true })

    expect(mockExecSync).toHaveBeenCalledWith(expect.stringContaining('git add -f'), expect.any(Object))
  })

  it('returns false when staging fails', () => {
    mockExecSync.mockImplementation(() => {
      throw new Error('File not found')
    })

    const result = stage(['nonexistent.txt'])

    expect(result).toBe(false)
  })

  it('uses custom options', () => {
    mockExecSync.mockReturnValue('')

    stage(['file.txt'], { cwd: '/custom', timeout: 5000 })

    expect(mockExecSync).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ cwd: '/custom', timeout: 5000 }))
  })
})

describe('unstage', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('unstages files', () => {
    mockExecSync.mockReturnValue('')

    const result = unstage(['package.json'])

    expect(result).toBe(true)
    expect(mockExecSync).toHaveBeenCalledWith(expect.stringContaining('git reset HEAD -- package.json'), expect.any(Object))
  })

  it('returns false when unstaging fails', () => {
    mockExecSync.mockImplementation(() => {
      throw new Error('Not in a git repository')
    })

    const result = unstage(['file.txt'])

    expect(result).toBe(false)
  })

  it('uses custom options', () => {
    mockExecSync.mockReturnValue('')

    unstage(['file.txt'], { cwd: '/custom', timeout: 5000 })

    expect(mockExecSync).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ cwd: '/custom', timeout: 5000 }))
  })
})

describe('stageAll', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('stages all files', () => {
    mockExecSync.mockReturnValue('')

    const result = stageAll()

    expect(result).toBe(true)
    expect(mockExecSync).toHaveBeenCalledWith(expect.stringContaining('git add -A'), expect.any(Object))
  })

  it('uses custom options', () => {
    mockExecSync.mockReturnValue('')

    stageAll({ cwd: '/custom' })

    expect(mockExecSync).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ cwd: '/custom' }))
  })
})

describe('hasStagedChanges', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns true when there are staged changes', () => {
    mockExecSync.mockImplementation(() => {
      throw new Error('Exit code 1')
    })

    const result = hasStagedChanges()

    expect(result).toBe(true)
    expect(mockExecSync).toHaveBeenCalledWith('git diff --cached --quiet', expect.any(Object))
  })

  it('returns false when there are no staged changes', () => {
    mockExecSync.mockReturnValue('')

    const result = hasStagedChanges()

    expect(result).toBe(false)
  })

  it('uses custom options', () => {
    mockExecSync.mockReturnValue('')

    hasStagedChanges({ cwd: '/custom', timeout: 5000 })

    expect(mockExecSync).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ cwd: '/custom', timeout: 5000 }))
  })
})

describe('hasUnstagedChanges', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns true when there are unstaged changes', () => {
    mockExecSync.mockImplementation(() => {
      throw new Error('Exit code 1')
    })

    const result = hasUnstagedChanges()

    expect(result).toBe(true)
    expect(mockExecSync).toHaveBeenCalledWith('git diff --quiet', expect.any(Object))
  })

  it('returns false when there are no unstaged changes', () => {
    mockExecSync.mockReturnValue('')

    const result = hasUnstagedChanges()

    expect(result).toBe(false)
  })

  it('uses custom options', () => {
    mockExecSync.mockReturnValue('')

    hasUnstagedChanges({ cwd: '/custom', timeout: 5000 })

    expect(mockExecSync).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ cwd: '/custom', timeout: 5000 }))
  })
})
