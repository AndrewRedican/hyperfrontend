import { execFileSync } from 'node:child_process'
import { getChangedFilesBetween, getChangedFilesBetweenWithStatus, getCommitWithFiles, DEFAULT_DIFF_OPTIONS } from './diff'
import { getCommit } from './log'

jest.mock('node:child_process')
jest.mock('./log', () => ({
  ...jest.requireActual('./log'),
  getCommit: jest.fn(),
}))

const mockExecFileSync = execFileSync as jest.MockedFunction<typeof execFileSync>
const mockGetCommit = getCommit as jest.MockedFunction<typeof getCommit>

describe('DEFAULT_DIFF_OPTIONS', () => {
  it('has expected default values', () => {
    expect(DEFAULT_DIFF_OPTIONS.timeout).toBe(30000)
  })
})

describe('getChangedFilesBetween', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns empty array for empty output', () => {
    mockExecFileSync.mockReturnValue('')

    const result = getChangedFilesBetween('origin/main')

    expect(result).toEqual([])
  })

  it('returns empty array for whitespace-only output', () => {
    mockExecFileSync.mockReturnValue('   \n\t  ')

    const result = getChangedFilesBetween('origin/main')

    expect(result).toEqual([])
  })

  it('parses single file', () => {
    mockExecFileSync.mockReturnValue('src/index.ts\n')

    const result = getChangedFilesBetween('origin/main')

    expect(result).toEqual(['src/index.ts'])
  })

  it('parses multiple files', () => {
    mockExecFileSync.mockReturnValue('src/index.ts\nlibs/utils/helper.ts\nREADME.md\n')

    const result = getChangedFilesBetween('origin/main')

    expect(result).toEqual(['src/index.ts', 'libs/utils/helper.ts', 'README.md'])
  })

  it('handles files without trailing newline', () => {
    mockExecFileSync.mockReturnValue('src/index.ts\nlibs/utils/helper.ts')

    const result = getChangedFilesBetween('origin/main')

    expect(result).toEqual(['src/index.ts', 'libs/utils/helper.ts'])
  })

  it('calls git diff with correct arguments', () => {
    mockExecFileSync.mockReturnValue('')

    getChangedFilesBetween('origin/main', 'HEAD')

    expect(mockExecFileSync).toHaveBeenCalledWith(
      'git',
      ['diff', '--name-only', 'origin/main...HEAD'],
      expect.objectContaining({
        encoding: 'utf-8',
        timeout: 30000,
      })
    )
  })

  it('uses custom head reference', () => {
    mockExecFileSync.mockReturnValue('')

    getChangedFilesBetween('v1.0.0', 'v2.0.0')

    expect(mockExecFileSync).toHaveBeenCalledWith('git', ['diff', '--name-only', 'v1.0.0...v2.0.0'], expect.anything())
  })

  it('uses custom cwd option', () => {
    mockExecFileSync.mockReturnValue('')

    getChangedFilesBetween('origin/main', 'HEAD', { cwd: '/custom/path' })

    expect(mockExecFileSync).toHaveBeenCalledWith(
      'git',
      expect.anything(),
      expect.objectContaining({
        cwd: '/custom/path',
      })
    )
  })

  it('uses custom timeout option', () => {
    mockExecFileSync.mockReturnValue('')

    getChangedFilesBetween('origin/main', 'HEAD', { timeout: 5000 })

    expect(mockExecFileSync).toHaveBeenCalledWith(
      'git',
      expect.anything(),
      expect.objectContaining({
        timeout: 5000,
      })
    )
  })

  it('returns empty array on git error', () => {
    mockExecFileSync.mockImplementation(() => {
      throw new Error('fatal: bad object')
    })

    const result = getChangedFilesBetween('nonexistent-ref')

    expect(result).toEqual([])
  })
})

describe('getChangedFilesBetweenWithStatus', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns empty array for empty output', () => {
    mockExecFileSync.mockReturnValue('')

    const result = getChangedFilesBetweenWithStatus('origin/main')

    expect(result).toEqual([])
  })

  it('parses added file', () => {
    mockExecFileSync.mockReturnValue('A\tsrc/new-file.ts\n')

    const result = getChangedFilesBetweenWithStatus('origin/main')

    expect(result).toEqual([{ path: 'src/new-file.ts', status: 'added' }])
  })

  it('parses modified file', () => {
    mockExecFileSync.mockReturnValue('M\tsrc/index.ts\n')

    const result = getChangedFilesBetweenWithStatus('origin/main')

    expect(result).toEqual([{ path: 'src/index.ts', status: 'modified' }])
  })

  it('parses deleted file', () => {
    mockExecFileSync.mockReturnValue('D\tsrc/old-file.ts\n')

    const result = getChangedFilesBetweenWithStatus('origin/main')

    expect(result).toEqual([{ path: 'src/old-file.ts', status: 'deleted' }])
  })

  it('parses renamed file', () => {
    mockExecFileSync.mockReturnValue('R100\tsrc/old-name.ts\tsrc/new-name.ts\n')

    const result = getChangedFilesBetweenWithStatus('origin/main')

    expect(result).toEqual([
      {
        path: 'src/new-name.ts',
        status: 'renamed',
        oldPath: 'src/old-name.ts',
      },
    ])
  })

  it('parses copied file', () => {
    mockExecFileSync.mockReturnValue('C100\tsrc/original.ts\tsrc/copy.ts\n')

    const result = getChangedFilesBetweenWithStatus('origin/main')

    expect(result).toEqual([
      {
        path: 'src/copy.ts',
        status: 'copied',
        oldPath: 'src/original.ts',
      },
    ])
  })

  it('parses renamed file with partial similarity', () => {
    mockExecFileSync.mockReturnValue('R095\tsrc/old.ts\tsrc/new.ts\n')

    const result = getChangedFilesBetweenWithStatus('origin/main')

    expect(result).toEqual([
      {
        path: 'src/new.ts',
        status: 'renamed',
        oldPath: 'src/old.ts',
      },
    ])
  })

  it('parses multiple files with different statuses', () => {
    mockExecFileSync.mockReturnValue('A\tsrc/new.ts\nM\tsrc/index.ts\nD\tsrc/old.ts\n')

    const result = getChangedFilesBetweenWithStatus('origin/main')

    expect(result).toEqual([
      { path: 'src/new.ts', status: 'added' },
      { path: 'src/index.ts', status: 'modified' },
      { path: 'src/old.ts', status: 'deleted' },
    ])
  })

  it('calls git diff with correct arguments', () => {
    mockExecFileSync.mockReturnValue('')

    getChangedFilesBetweenWithStatus('origin/main', 'HEAD')

    expect(mockExecFileSync).toHaveBeenCalledWith(
      'git',
      ['diff', '--name-status', '-M', 'origin/main...HEAD'],
      expect.objectContaining({
        encoding: 'utf-8',
        timeout: 30000,
      })
    )
  })

  it('returns empty array on git error', () => {
    mockExecFileSync.mockImplementation(() => {
      throw new Error('fatal: bad object')
    })

    const result = getChangedFilesBetweenWithStatus('nonexistent-ref')

    expect(result).toEqual([])
  })

  it('skips invalid lines', () => {
    mockExecFileSync.mockReturnValue('invalid line\nM\tsrc/valid.ts\n')

    const result = getChangedFilesBetweenWithStatus('origin/main')

    expect(result).toEqual([{ path: 'src/valid.ts', status: 'modified' }])
  })

  it('skips unknown status codes', () => {
    mockExecFileSync.mockReturnValue('X\tsrc/unknown.ts\nM\tsrc/valid.ts\n')

    const result = getChangedFilesBetweenWithStatus('origin/main')

    expect(result).toEqual([{ path: 'src/valid.ts', status: 'modified' }])
  })

  it('handles renamed file without second tab (malformed output)', () => {
    mockExecFileSync.mockReturnValue('R100\tsrc/file.ts\n')

    const result = getChangedFilesBetweenWithStatus('origin/main')

    expect(result).toEqual([{ path: 'src/file.ts', status: 'renamed' }])
  })

  it('handles copied file without second tab (malformed output)', () => {
    mockExecFileSync.mockReturnValue('C100\tsrc/file.ts\n')

    const result = getChangedFilesBetweenWithStatus('origin/main')

    expect(result).toEqual([{ path: 'src/file.ts', status: 'copied' }])
  })

  it('handles empty lines in output', () => {
    mockExecFileSync.mockReturnValue('A\tsrc/new.ts\n\nM\tsrc/index.ts\n')

    const result = getChangedFilesBetweenWithStatus('origin/main')

    expect(result).toEqual([
      { path: 'src/new.ts', status: 'added' },
      { path: 'src/index.ts', status: 'modified' },
    ])
  })
})

describe('getCommitWithFiles', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns null if commit not found', () => {
    mockGetCommit.mockReturnValue(null)

    const result = getCommitWithFiles('nonexistent')

    expect(result).toBeNull()
    expect(mockExecFileSync).not.toHaveBeenCalled()
  })

  it('returns commit with empty files if diff-tree fails', () => {
    mockGetCommit.mockReturnValue({
      hash: 'abc1234567890def1234567890abc1234567890de',
      shortHash: 'abc1234',
      authorName: 'John Doe',
      authorEmail: 'john@example.com',
      authorDate: '2026-03-12T10:00:00Z',
      committerName: 'John Doe',
      committerEmail: 'john@example.com',
      commitDate: '2026-03-12T10:00:00Z',
      subject: 'feat: test commit',
      body: '',
      message: 'feat: test commit',
      parents: [],
      refs: [],
    })
    mockExecFileSync.mockImplementation(() => {
      throw new Error('fatal: bad object')
    })

    const result = getCommitWithFiles('abc1234')

    expect(result).not.toBeNull()
    expect(result?.files).toEqual([])
    expect(result?.hash).toBe('abc1234567890def1234567890abc1234567890de')
  })

  it('returns commit with files', () => {
    mockGetCommit.mockReturnValue({
      hash: 'abc1234567890def1234567890abc1234567890de',
      shortHash: 'abc1234',
      authorName: 'John Doe',
      authorEmail: 'john@example.com',
      authorDate: '2026-03-12T10:00:00Z',
      committerName: 'John Doe',
      committerEmail: 'john@example.com',
      commitDate: '2026-03-12T10:00:00Z',
      subject: 'feat: add feature',
      body: '',
      message: 'feat: add feature',
      parents: [],
      refs: [],
    })
    mockExecFileSync.mockReturnValue('A\tsrc/new.ts\nM\tsrc/index.ts\n')

    const result = getCommitWithFiles('abc1234')

    expect(result).not.toBeNull()
    expect(result?.subject).toBe('feat: add feature')
    expect(result?.files).toEqual([
      { path: 'src/new.ts', status: 'added' },
      { path: 'src/index.ts', status: 'modified' },
    ])
  })

  it('calls git diff-tree with correct arguments', () => {
    mockGetCommit.mockReturnValue({
      hash: 'abc1234567890def1234567890abc1234567890de',
      shortHash: 'abc1234',
      authorName: 'John Doe',
      authorEmail: 'john@example.com',
      authorDate: '2026-03-12T10:00:00Z',
      committerName: 'John Doe',
      committerEmail: 'john@example.com',
      commitDate: '2026-03-12T10:00:00Z',
      subject: 'feat: test',
      body: '',
      message: 'feat: test',
      parents: [],
      refs: [],
    })
    mockExecFileSync.mockReturnValue('')

    getCommitWithFiles('abc1234')

    expect(mockExecFileSync).toHaveBeenCalledWith(
      'git',
      ['diff-tree', '--no-commit-id', '-r', '--name-status', '-M', 'abc1234'],
      expect.objectContaining({
        encoding: 'utf-8',
      })
    )
  })

  it('uses custom cwd option', () => {
    mockGetCommit.mockReturnValue({
      hash: 'abc1234567890def1234567890abc1234567890de',
      shortHash: 'abc1234',
      authorName: 'John Doe',
      authorEmail: 'john@example.com',
      authorDate: '2026-03-12T10:00:00Z',
      committerName: 'John Doe',
      committerEmail: 'john@example.com',
      commitDate: '2026-03-12T10:00:00Z',
      subject: 'feat: test',
      body: '',
      message: 'feat: test',
      parents: [],
      refs: [],
    })
    mockExecFileSync.mockReturnValue('')

    getCommitWithFiles('abc1234', { cwd: '/custom/path' })

    expect(mockGetCommit).toHaveBeenCalledWith('abc1234', expect.objectContaining({ cwd: '/custom/path' }))
    expect(mockExecFileSync).toHaveBeenCalledWith(
      'git',
      expect.anything(),
      expect.objectContaining({
        cwd: '/custom/path',
      })
    )
  })

  it('handles renamed files in commit', () => {
    mockGetCommit.mockReturnValue({
      hash: 'abc1234567890def1234567890abc1234567890de',
      shortHash: 'abc1234',
      authorName: 'John Doe',
      authorEmail: 'john@example.com',
      authorDate: '2026-03-12T10:00:00Z',
      committerName: 'John Doe',
      committerEmail: 'john@example.com',
      commitDate: '2026-03-12T10:00:00Z',
      subject: 'refactor: rename file',
      body: '',
      message: 'refactor: rename file',
      parents: [],
      refs: [],
    })
    mockExecFileSync.mockReturnValue('R100\tsrc/old.ts\tsrc/new.ts\n')

    const result = getCommitWithFiles('abc1234')

    expect(result?.files).toEqual([
      {
        path: 'src/new.ts',
        status: 'renamed',
        oldPath: 'src/old.ts',
      },
    ])
  })
})
