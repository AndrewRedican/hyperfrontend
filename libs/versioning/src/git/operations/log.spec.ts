import type { MockedFunction } from '@hyperfrontend/testing'
import { execFileSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { beforeEach } from 'node:test'
import { describe, expect, it, jest } from '@hyperfrontend/testing'
import {
  getCommitLog,
  getCommitsBetween,
  getCommitsSince,
  getCommit,
  commitExists,
  commitReachableFromHead,
  escapeGitRef,
  escapeGitPath,
  escapeGitArg,
  DEFAULT_LOG_OPTIONS,
} from './log'

jest.mock('node:child_process')

const mockExecFileSync = execFileSync as MockedFunction<typeof execFileSync>

const REPO_PATH = join(tmpdir(), 'repo')
const RECORD_SEPARATOR = '\x1e'
const FIELD_SEPARATOR = '\x00'

/**
 * Creates a mock git log entry.
 * Fields match the parseCommitLog destructuring order:
 * [hash, authorName, authorEmail, authorDate, committerName, committerEmail, commitDate, subject, body, parentsStr, refsStr]
 * Note: The git log format includes %h (shortHash) but the parser expects it to be skipped.
 * This mock matches the parser's expectation, not the actual git output format.
 *
 * @param data - Mock commit data
 * @param data.hash - Full 40-character SHA-1 commit hash
 * @param data.authorName - Name of the person who authored the commit
 * @param data.authorEmail - Email address of the commit author
 * @param data.authorDate - When the changes were authored (ISO 8601)
 * @param data.committerName - Name of the person who committed the changes
 * @param data.committerEmail - Email address of the committer
 * @param data.commitDate - When the commit was made (ISO 8601)
 * @param data.subject - First line of the commit message
 * @param data.body - Remaining lines of the commit message
 * @param data.parents - Space-separated parent commit hashes
 * @param data.refs - Comma-separated reference names (branches, tags)
 * @returns Formatted mock log entry string with NUL-separated fields
 */
function createMockLogEntry(data: {
  hash?: string
  authorName?: string
  authorEmail?: string
  authorDate?: string
  committerName?: string
  committerEmail?: string
  commitDate?: string
  subject?: string
  body?: string
  parents?: string
  refs?: string
}): string {
  return [
    data.hash ?? 'abc1234567890def1234567890abc1234567890de',
    data.authorName ?? 'John Doe',
    data.authorEmail ?? 'john@example.com',
    data.authorDate ?? '2026-03-12T10:00:00Z',
    data.committerName ?? 'John Doe',
    data.committerEmail ?? 'john@example.com',
    data.commitDate ?? '2026-03-12T10:00:00Z',
    data.subject ?? 'feat: test commit',
    data.body ?? '',
    data.parents ?? '',
    data.refs ?? '',
  ].join(FIELD_SEPARATOR)
}

describe('DEFAULT_LOG_OPTIONS', () => {
  it('has expected default values', () => {
    expect(DEFAULT_LOG_OPTIONS).toEqual({ maxCount: 100, includeMerges: true, timeout: 30000 })
  })
})

describe('getCommitLog', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns empty array for empty output', () => {
    mockExecFileSync.mockReturnValue('')

    const result = getCommitLog()

    expect(result).toEqual([])
  })

  it('returns empty array for whitespace-only output', () => {
    mockExecFileSync.mockReturnValue('   \n\t  ')

    const result = getCommitLog()

    expect(result).toEqual([])
  })

  it('parses a single commit', () => {
    const entry = createMockLogEntry({
      hash: 'abc1234567890def1234567890abc1234567890de',
      authorName: 'Jane Doe',
      authorEmail: 'jane@example.com',
      subject: 'fix: resolve bug',
    })
    mockExecFileSync.mockReturnValue(RECORD_SEPARATOR + entry)

    const result = getCommitLog()

    expect(result).toEqual([
      expect.objectContaining({
        hash: 'abc1234567890def1234567890abc1234567890de',
        authorName: 'Jane Doe',
        authorEmail: 'jane@example.com',
        subject: 'fix: resolve bug',
      }),
    ])
  })

  it('parses multiple commits', () => {
    const entry1 = createMockLogEntry({ hash: 'aaa111', subject: 'first commit' })
    const entry2 = createMockLogEntry({ hash: 'bbb222', subject: 'second commit' })
    const entry3 = createMockLogEntry({ hash: 'ccc333', subject: 'third commit' })

    mockExecFileSync.mockReturnValue(RECORD_SEPARATOR + entry1 + RECORD_SEPARATOR + entry2 + RECORD_SEPARATOR + entry3)

    const result = getCommitLog()

    expect(result.map((commit) => commit.hash)).toEqual(['aaa111', 'bbb222', 'ccc333'])
  })

  it('parses commit with body', () => {
    const entry = createMockLogEntry({
      subject: 'feat: add feature',
      body: 'This is a detailed description\nwith multiple lines.',
    })
    mockExecFileSync.mockReturnValue(RECORD_SEPARATOR + entry)

    const result = getCommitLog()

    expect(result).toEqual([expect.objectContaining({ body: 'This is a detailed description\nwith multiple lines.' })])
  })

  it('parses commit with parent hashes', () => {
    const entry = createMockLogEntry({
      parents: 'parent1abc parent2def',
    })
    mockExecFileSync.mockReturnValue(RECORD_SEPARATOR + entry)

    const result = getCommitLog()

    expect(result).toEqual([expect.objectContaining({ parents: ['parent1abc', 'parent2def'] })])
  })

  it('parses commit with refs (branch and tag)', () => {
    const entry = createMockLogEntry({
      refs: 'HEAD -> main, tag: v1.0.0, origin/main',
    })
    mockExecFileSync.mockReturnValue(RECORD_SEPARATOR + entry)

    const result = getCommitLog()

    expect(result).toEqual([expect.objectContaining({ refs: ['HEAD', 'main', 'v1.0.0', 'origin/main'] })])
  })

  it('parses commit with only tag refs', () => {
    const entry = createMockLogEntry({
      refs: 'tag: v2.0.0',
    })
    mockExecFileSync.mockReturnValue(RECORD_SEPARATOR + entry)

    const result = getCommitLog()

    expect(result).toEqual([expect.objectContaining({ refs: ['v2.0.0'] })])
  })

  it('handles empty refs string', () => {
    const entry = createMockLogEntry({
      refs: '',
    })
    mockExecFileSync.mockReturnValue(RECORD_SEPARATOR + entry)

    const result = getCommitLog()

    expect(result).toEqual([expect.objectContaining({ refs: [] })])
  })

  it('skips records with insufficient fields', () => {
    const invalidEntry = ['hash', 'short', 'name'].join(FIELD_SEPARATOR)
    const validEntry = createMockLogEntry({ hash: 'valid123' })

    mockExecFileSync.mockReturnValue(RECORD_SEPARATOR + invalidEntry + RECORD_SEPARATOR + validEntry)

    const result = getCommitLog()

    expect(result).toEqual([expect.objectContaining({ hash: 'valid123' })])
  })

  it('applies maxCount option', () => {
    mockExecFileSync.mockReturnValue('')

    getCommitLog({ maxCount: 50 })

    expect(mockExecFileSync).toHaveBeenCalledWith('git', expect.arrayContaining(['-n50']), expect.any(Object))
  })

  it('applies includeMerges: false option', () => {
    mockExecFileSync.mockReturnValue('')

    getCommitLog({ includeMerges: false })

    expect(mockExecFileSync).toHaveBeenCalledWith('git', expect.arrayContaining(['--no-merges']), expect.any(Object))
  })

  it('applies author filter', () => {
    mockExecFileSync.mockReturnValue('')

    getCommitLog({ author: 'John Doe' })

    expect(mockExecFileSync).toHaveBeenCalledWith('git', expect.arrayContaining(['--author=John Doe']), expect.any(Object))
  })

  it('applies from..to range', () => {
    mockExecFileSync.mockReturnValue('')

    getCommitLog({ from: 'v1.0.0', to: 'v2.0.0' })

    expect(mockExecFileSync).toHaveBeenCalledWith('git', expect.arrayContaining(['v1.0.0..v2.0.0']), expect.any(Object))
  })

  it('applies from..HEAD range when only from is specified', () => {
    mockExecFileSync.mockReturnValue('')

    getCommitLog({ from: 'v1.0.0' })

    expect(mockExecFileSync).toHaveBeenCalledWith('git', expect.arrayContaining(['v1.0.0..HEAD']), expect.any(Object))
  })

  it('applies to only when specified', () => {
    mockExecFileSync.mockReturnValue('')

    getCommitLog({ to: 'abc123' })

    expect(mockExecFileSync).toHaveBeenCalledWith('git', expect.arrayContaining(['abc123']), expect.any(Object))
  })

  it('applies path filter', () => {
    mockExecFileSync.mockReturnValue('')

    getCommitLog({ path: 'src/index.ts' })

    expect(mockExecFileSync).toHaveBeenCalledWith('git', expect.arrayContaining(['--', 'src/index.ts']), expect.any(Object))
  })

  it('uses custom cwd', () => {
    mockExecFileSync.mockReturnValue('')

    getCommitLog({ cwd: REPO_PATH })

    expect(mockExecFileSync).toHaveBeenCalledWith('git', expect.any(Array), expect.objectContaining({ cwd: REPO_PATH }))
  })

  it('uses custom timeout', () => {
    mockExecFileSync.mockReturnValue('')

    getCommitLog({ timeout: 5000 })

    expect(mockExecFileSync).toHaveBeenCalledWith('git', expect.any(Array), expect.objectContaining({ timeout: 5000 }))
  })

  it('returns empty array when repository has no commits', () => {
    mockExecFileSync.mockImplementation(() => {
      const error = new Error('does not have any commits yet')
      throw error
    })

    const result = getCommitLog()

    expect(result).toEqual([])
  })

  it('throws error for other git errors', () => {
    mockExecFileSync.mockImplementation(() => {
      throw new Error('fatal: not a git repository')
    })

    expect(() => getCommitLog()).toThrow('not a git repository')
  })
})

describe('getCommitsBetween', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('calls getCommitLog with from and to options', () => {
    mockExecFileSync.mockReturnValue('')

    getCommitsBetween('v1.0.0', 'v2.0.0')

    expect(mockExecFileSync).toHaveBeenCalledWith('git', expect.arrayContaining(['v1.0.0..v2.0.0']), expect.any(Object))
  })

  it('defaults to HEAD when to is not specified', () => {
    mockExecFileSync.mockReturnValue('')

    getCommitsBetween('v1.0.0')

    expect(mockExecFileSync).toHaveBeenCalledWith('git', expect.arrayContaining(['v1.0.0..HEAD']), expect.any(Object))
  })

  it('passes additional options', () => {
    mockExecFileSync.mockReturnValue('')

    getCommitsBetween('v1.0.0', 'v2.0.0', { maxCount: 10 })

    expect(mockExecFileSync).toHaveBeenCalledWith('git', expect.arrayContaining(['-n10']), expect.any(Object))
  })
})

describe('getCommitsSince', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('calls getCommitLog with from option', () => {
    mockExecFileSync.mockReturnValue('')

    getCommitsSince('v1.0.0')

    expect(mockExecFileSync).toHaveBeenCalledWith('git', expect.arrayContaining(['v1.0.0..HEAD']), expect.any(Object))
  })

  it('passes additional options', () => {
    mockExecFileSync.mockReturnValue('')

    getCommitsSince('v1.0.0', { includeMerges: false })

    expect(mockExecFileSync).toHaveBeenCalledWith('git', expect.arrayContaining(['--no-merges']), expect.any(Object))
  })

  it('does not apply the default commit limit, so the range is never truncated', () => {
    mockExecFileSync.mockReturnValue('')

    getCommitsSince('v1.0.0')

    const args = mockExecFileSync.mock.calls[0][1] as string[]
    expect(args.some((arg) => arg.startsWith('-n'))).toBe(false)
  })

  it('honours an explicit commit limit from the caller', () => {
    mockExecFileSync.mockReturnValue('')

    getCommitsSince('v1.0.0', { maxCount: 5 })

    expect(mockExecFileSync).toHaveBeenCalledWith('git', expect.arrayContaining(['-n5']), expect.any(Object))
  })
})

describe('getCommit', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns a commit when found', () => {
    const entry = createMockLogEntry({
      hash: 'abc123def456',
      subject: 'test commit',
    })
    mockExecFileSync.mockReturnValue(RECORD_SEPARATOR + entry)

    const result = getCommit('abc123')

    expect(result).toEqual(expect.objectContaining({ hash: 'abc123def456' }))
  })

  it('returns null when commit not found', () => {
    mockExecFileSync.mockImplementation(() => {
      throw new Error('fatal: bad revision')
    })

    const result = getCommit('nonexistent')

    expect(result).toBeNull()
  })

  it('returns null when log is empty', () => {
    mockExecFileSync.mockReturnValue('')

    const result = getCommit('abc123')

    expect(result).toBeNull()
  })
})

describe('commitExists', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns true when commit exists', () => {
    mockExecFileSync.mockReturnValue('commit')

    const result = commitExists('abc123')

    expect(result).toBe(true)
  })

  it('runs git cat-file -t to look the commit up', () => {
    mockExecFileSync.mockReturnValue('commit')

    commitExists('abc123')

    expect(mockExecFileSync).toHaveBeenCalledWith('git', expect.arrayContaining(['cat-file', '-t']), expect.any(Object))
  })

  it('returns false when commit does not exist', () => {
    mockExecFileSync.mockImplementation(() => {
      throw new Error('fatal: Not a valid object name')
    })

    const result = commitExists('nonexistent')

    expect(result).toBe(false)
  })

  it('uses custom cwd', () => {
    mockExecFileSync.mockReturnValue('commit')

    commitExists('abc123', { cwd: REPO_PATH })

    expect(mockExecFileSync).toHaveBeenCalledWith('git', expect.any(Array), expect.objectContaining({ cwd: REPO_PATH }))
  })

  it('uses custom timeout', () => {
    mockExecFileSync.mockReturnValue('commit')

    commitExists('abc123', { timeout: 1000 })

    expect(mockExecFileSync).toHaveBeenCalledWith('git', expect.any(Array), expect.objectContaining({ timeout: 1000 }))
  })
})

describe('commitReachableFromHead', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns true when commit is ancestor of HEAD', () => {
    mockExecFileSync.mockReturnValue('')

    const result = commitReachableFromHead('abc123')

    expect(result).toBe(true)
  })

  it('runs git merge-base --is-ancestor against HEAD', () => {
    mockExecFileSync.mockReturnValue('')

    commitReachableFromHead('abc123')

    expect(mockExecFileSync).toHaveBeenCalledWith('git', ['merge-base', '--is-ancestor', 'abc123', 'HEAD'], expect.any(Object))
  })

  it('returns false when commit is not ancestor of HEAD', () => {
    mockExecFileSync.mockImplementation(() => {
      const error = new Error('exit code 1')
      ;(error as NodeJS.ErrnoException).code = '1'
      throw error
    })

    const result = commitReachableFromHead('orphaned123')

    expect(result).toBe(false)
  })

  it('returns false when commit does not exist', () => {
    mockExecFileSync.mockImplementation(() => {
      throw new Error('fatal: Not a valid object name')
    })

    const result = commitReachableFromHead('nonexistent')

    expect(result).toBe(false)
  })

  it('uses custom cwd', () => {
    mockExecFileSync.mockReturnValue('')

    commitReachableFromHead('abc123', { cwd: REPO_PATH })

    expect(mockExecFileSync).toHaveBeenCalledWith('git', expect.any(Array), expect.objectContaining({ cwd: REPO_PATH }))
  })

  it('uses custom timeout', () => {
    mockExecFileSync.mockReturnValue('')

    commitReachableFromHead('abc123', { timeout: 1000 })

    expect(mockExecFileSync).toHaveBeenCalledWith('git', expect.any(Array), expect.objectContaining({ timeout: 1000 }))
  })

  it('escapes potentially dangerous commit hashes', () => {
    mockExecFileSync.mockReturnValue('')

    commitReachableFromHead('abc123')

    expect(mockExecFileSync).toHaveBeenCalledWith('git', ['merge-base', '--is-ancestor', 'abc123', 'HEAD'], expect.any(Object))
  })
})

describe('escapeGitRef', () => {
  it.each(['main', 'feature/add-stuff', 'v1.0.0', 'HEAD', 'HEAD~1', 'HEAD^2', 'main@{1}', 'refs/heads/main'])(
    'allows the valid git reference %p',
    (ref) => {
      expect(escapeGitRef(ref)).toBe(ref)
    }
  )

  it.each(['feature_branch', 'fix-bug-123'])('allows the underscores and hyphens in %p', (ref) => {
    expect(escapeGitRef(ref)).toBe(ref)
  })

  it('throws for empty reference', () => {
    expect(() => escapeGitRef('')).toThrow('Git reference is required')
  })

  it.each([null, undefined])('throws for the non-string reference %p', (ref) => {
    expect(() => escapeGitRef(ref as unknown as string)).toThrow('Git reference is required')
  })

  it('throws for reference exceeding max length', () => {
    const longRef = 'a'.repeat(257)
    expect(() => escapeGitRef(longRef)).toThrow('exceeds maximum length')
  })

  it.each([
    'branch;rm -rf',
    'branch`whoami`',
    'branch$(cmd)',
    'branch|pipe',
    'branch&bg',
    "branch'quote",
    'branch"quote',
    'branch\nnewline',
  ])('throws for the invalid character in %p', (ref) => {
    expect(() => escapeGitRef(ref)).toThrow('Invalid character')
  })
})

describe('escapeGitPath', () => {
  it.each(['src/index.ts', 'path/to/file.txt', 'file-name.js', 'file_name.js', 'My File.txt'])('allows the valid file path %p', (path) => {
    expect(escapeGitPath(path)).toBe(path)
  })

  it('allows backslashes for Windows paths', () => {
    expect(escapeGitPath('src\\index.ts')).toBe('src\\index.ts')
  })

  it('throws for empty path', () => {
    expect(() => escapeGitPath('')).toThrow('Path is required')
  })

  it.each([null, undefined])('throws for the non-string path %p', (path) => {
    expect(() => escapeGitPath(path as unknown as string)).toThrow('Path is required')
  })

  it('throws for path exceeding max length', () => {
    const longPath = 'a'.repeat(4097)
    expect(() => escapeGitPath(longPath)).toThrow('exceeds maximum length')
  })

  it.each(['path;rm -rf', 'path`cmd`', 'path$(cmd)', 'path|pipe', 'path&bg', "path'quote", 'path\nnewline'])(
    'throws for the invalid character in %p',
    (path) => {
      expect(() => escapeGitPath(path)).toThrow('Invalid character')
    }
  )
})

describe('escapeGitArg', () => {
  it.each(['John Doe', 'user@example.com', 'name@domain.com', 'user-name', 'user_name', 'user+tag@example.com'])(
    'allows the valid argument %p',
    (arg) => {
      expect(escapeGitArg(arg)).toBe(arg)
    }
  )

  it('allows angle brackets for email format', () => {
    expect(escapeGitArg('<user@example.com>')).toBe('<user@example.com>')
  })

  it('throws for empty argument', () => {
    expect(() => escapeGitArg('')).toThrow('Argument is required')
  })

  it.each([null, undefined])('throws for the non-string argument %p', (arg) => {
    expect(() => escapeGitArg(arg as unknown as string)).toThrow('Argument is required')
  })

  it('throws for argument exceeding max length', () => {
    const longArg = 'a'.repeat(1001)
    expect(() => escapeGitArg(longArg)).toThrow('exceeds maximum length')
  })

  it.each(['arg;rm -rf', 'arg`cmd`', 'arg$(cmd)', 'arg|pipe', 'arg&bg', "arg'quote", 'arg\nnewline'])(
    'throws for the invalid character in %p',
    (arg) => {
      expect(() => escapeGitArg(arg)).toThrow('Invalid character')
    }
  )
})
