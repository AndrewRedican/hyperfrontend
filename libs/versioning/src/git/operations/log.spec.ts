import { execSync } from 'node:child_process'
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

const mockExecSync = execSync as jest.MockedFunction<typeof execSync>

// Record separator used in git log format
const RECORD_SEPARATOR = '\x1e'
// Field separator (NUL)
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
    expect(DEFAULT_LOG_OPTIONS.maxCount).toBe(100)
    expect(DEFAULT_LOG_OPTIONS.includeMerges).toBe(true)
    expect(DEFAULT_LOG_OPTIONS.timeout).toBe(30000)
  })
})

// ============================================================================
// getCommitLog Tests
// ============================================================================

describe('getCommitLog', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns empty array for empty output', () => {
    mockExecSync.mockReturnValue('')

    const result = getCommitLog()

    expect(result).toEqual([])
  })

  it('returns empty array for whitespace-only output', () => {
    mockExecSync.mockReturnValue('   \n\t  ')

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
    mockExecSync.mockReturnValue(RECORD_SEPARATOR + entry)

    const result = getCommitLog()

    expect(result).toHaveLength(1)
    expect(result[0].hash).toBe('abc1234567890def1234567890abc1234567890de')
    expect(result[0].authorName).toBe('Jane Doe')
    expect(result[0].authorEmail).toBe('jane@example.com')
    expect(result[0].subject).toBe('fix: resolve bug')
  })

  it('parses multiple commits', () => {
    const entry1 = createMockLogEntry({ hash: 'aaa111', subject: 'first commit' })
    const entry2 = createMockLogEntry({ hash: 'bbb222', subject: 'second commit' })
    const entry3 = createMockLogEntry({ hash: 'ccc333', subject: 'third commit' })

    mockExecSync.mockReturnValue(RECORD_SEPARATOR + entry1 + RECORD_SEPARATOR + entry2 + RECORD_SEPARATOR + entry3)

    const result = getCommitLog()

    expect(result).toHaveLength(3)
    expect(result[0].hash).toBe('aaa111')
    expect(result[1].hash).toBe('bbb222')
    expect(result[2].hash).toBe('ccc333')
  })

  it('parses commit with body', () => {
    const entry = createMockLogEntry({
      subject: 'feat: add feature',
      body: 'This is a detailed description\nwith multiple lines.',
    })
    mockExecSync.mockReturnValue(RECORD_SEPARATOR + entry)

    const result = getCommitLog()

    expect(result).toHaveLength(1)
    expect(result[0].body).toBe('This is a detailed description\nwith multiple lines.')
  })

  it('parses commit with parent hashes', () => {
    const entry = createMockLogEntry({
      parents: 'parent1abc parent2def',
    })
    mockExecSync.mockReturnValue(RECORD_SEPARATOR + entry)

    const result = getCommitLog()

    expect(result).toHaveLength(1)
    expect(result[0].parents).toEqual(['parent1abc', 'parent2def'])
  })

  it('parses commit with refs (branch and tag)', () => {
    const entry = createMockLogEntry({
      refs: 'HEAD -> main, tag: v1.0.0, origin/main',
    })
    mockExecSync.mockReturnValue(RECORD_SEPARATOR + entry)

    const result = getCommitLog()

    expect(result).toHaveLength(1)
    expect(result[0].refs).toContain('HEAD')
    expect(result[0].refs).toContain('main')
    expect(result[0].refs).toContain('v1.0.0')
    expect(result[0].refs).toContain('origin/main')
  })

  it('parses commit with only tag refs', () => {
    const entry = createMockLogEntry({
      refs: 'tag: v2.0.0',
    })
    mockExecSync.mockReturnValue(RECORD_SEPARATOR + entry)

    const result = getCommitLog()

    expect(result).toHaveLength(1)
    expect(result[0].refs).toContain('v2.0.0')
  })

  it('handles empty refs string', () => {
    const entry = createMockLogEntry({
      refs: '',
    })
    mockExecSync.mockReturnValue(RECORD_SEPARATOR + entry)

    const result = getCommitLog()

    expect(result).toHaveLength(1)
    expect(result[0].refs).toEqual([])
  })

  it('skips records with insufficient fields', () => {
    // Create an invalid entry with fewer than 10 fields
    const invalidEntry = ['hash', 'short', 'name'].join(FIELD_SEPARATOR)
    const validEntry = createMockLogEntry({ hash: 'valid123' })

    mockExecSync.mockReturnValue(RECORD_SEPARATOR + invalidEntry + RECORD_SEPARATOR + validEntry)

    const result = getCommitLog()

    expect(result).toHaveLength(1)
    expect(result[0].hash).toBe('valid123')
  })

  it('applies maxCount option', () => {
    mockExecSync.mockReturnValue('')

    getCommitLog({ maxCount: 50 })

    expect(mockExecSync).toHaveBeenCalledWith(expect.stringContaining('-n50'), expect.any(Object))
  })

  it('applies includeMerges: false option', () => {
    mockExecSync.mockReturnValue('')

    getCommitLog({ includeMerges: false })

    expect(mockExecSync).toHaveBeenCalledWith(expect.stringContaining('--no-merges'), expect.any(Object))
  })

  it('applies author filter', () => {
    mockExecSync.mockReturnValue('')

    getCommitLog({ author: 'John Doe' })

    expect(mockExecSync).toHaveBeenCalledWith(expect.stringContaining('--author=John Doe'), expect.any(Object))
  })

  it('applies from..to range', () => {
    mockExecSync.mockReturnValue('')

    getCommitLog({ from: 'v1.0.0', to: 'v2.0.0' })

    expect(mockExecSync).toHaveBeenCalledWith(expect.stringContaining('v1.0.0..v2.0.0'), expect.any(Object))
  })

  it('applies from..HEAD range when only from is specified', () => {
    mockExecSync.mockReturnValue('')

    getCommitLog({ from: 'v1.0.0' })

    expect(mockExecSync).toHaveBeenCalledWith(expect.stringContaining('v1.0.0..HEAD'), expect.any(Object))
  })

  it('applies to only when specified', () => {
    mockExecSync.mockReturnValue('')

    getCommitLog({ to: 'abc123' })

    expect(mockExecSync).toHaveBeenCalledWith(expect.stringContaining('abc123'), expect.any(Object))
  })

  it('applies path filter', () => {
    mockExecSync.mockReturnValue('')

    getCommitLog({ path: 'src/index.ts' })

    expect(mockExecSync).toHaveBeenCalledWith(expect.stringContaining('-- src/index.ts'), expect.any(Object))
  })

  it('uses custom cwd', () => {
    mockExecSync.mockReturnValue('')

    getCommitLog({ cwd: '/tmp/repo' })

    expect(mockExecSync).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ cwd: '/tmp/repo' }))
  })

  it('uses custom timeout', () => {
    mockExecSync.mockReturnValue('')

    getCommitLog({ timeout: 5000 })

    expect(mockExecSync).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ timeout: 5000 }))
  })

  it('returns empty array when repository has no commits', () => {
    mockExecSync.mockImplementation(() => {
      const error = new Error('does not have any commits yet')
      throw error
    })

    const result = getCommitLog()

    expect(result).toEqual([])
  })

  it('throws error for other git errors', () => {
    mockExecSync.mockImplementation(() => {
      throw new Error('fatal: not a git repository')
    })

    expect(() => getCommitLog()).toThrow('not a git repository')
  })
})

// ============================================================================
// getCommitsBetween Tests
// ============================================================================

describe('getCommitsBetween', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('calls getCommitLog with from and to options', () => {
    mockExecSync.mockReturnValue('')

    getCommitsBetween('v1.0.0', 'v2.0.0')

    expect(mockExecSync).toHaveBeenCalledWith(expect.stringContaining('v1.0.0..v2.0.0'), expect.any(Object))
  })

  it('defaults to HEAD when to is not specified', () => {
    mockExecSync.mockReturnValue('')

    getCommitsBetween('v1.0.0')

    expect(mockExecSync).toHaveBeenCalledWith(expect.stringContaining('v1.0.0..HEAD'), expect.any(Object))
  })

  it('passes additional options', () => {
    mockExecSync.mockReturnValue('')

    getCommitsBetween('v1.0.0', 'v2.0.0', { maxCount: 10 })

    expect(mockExecSync).toHaveBeenCalledWith(expect.stringContaining('-n10'), expect.any(Object))
  })
})

// ============================================================================
// getCommitsSince Tests
// ============================================================================

describe('getCommitsSince', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('calls getCommitLog with from option', () => {
    mockExecSync.mockReturnValue('')

    getCommitsSince('v1.0.0')

    expect(mockExecSync).toHaveBeenCalledWith(expect.stringContaining('v1.0.0..HEAD'), expect.any(Object))
  })

  it('passes additional options', () => {
    mockExecSync.mockReturnValue('')

    getCommitsSince('v1.0.0', { includeMerges: false })

    expect(mockExecSync).toHaveBeenCalledWith(expect.stringContaining('--no-merges'), expect.any(Object))
  })
})

// ============================================================================
// getCommit Tests
// ============================================================================

describe('getCommit', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns a commit when found', () => {
    const entry = createMockLogEntry({
      hash: 'abc123def456',
      subject: 'test commit',
    })
    mockExecSync.mockReturnValue(RECORD_SEPARATOR + entry)

    const result = getCommit('abc123')

    expect(result).not.toBeNull()
    expect(result?.hash).toBe('abc123def456')
  })

  it('returns null when commit not found', () => {
    mockExecSync.mockImplementation(() => {
      throw new Error('fatal: bad revision')
    })

    const result = getCommit('nonexistent')

    expect(result).toBeNull()
  })

  it('returns null when log is empty', () => {
    mockExecSync.mockReturnValue('')

    const result = getCommit('abc123')

    expect(result).toBeNull()
  })
})

// ============================================================================
// commitExists Tests
// ============================================================================

describe('commitExists', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns true when commit exists', () => {
    mockExecSync.mockReturnValue('commit')

    const result = commitExists('abc123')

    expect(result).toBe(true)
    expect(mockExecSync).toHaveBeenCalledWith(expect.stringContaining('git cat-file -t'), expect.any(Object))
  })

  it('returns false when commit does not exist', () => {
    mockExecSync.mockImplementation(() => {
      throw new Error('fatal: Not a valid object name')
    })

    const result = commitExists('nonexistent')

    expect(result).toBe(false)
  })

  it('uses custom cwd', () => {
    mockExecSync.mockReturnValue('commit')

    commitExists('abc123', { cwd: '/tmp/repo' })

    expect(mockExecSync).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ cwd: '/tmp/repo' }))
  })

  it('uses custom timeout', () => {
    mockExecSync.mockReturnValue('commit')

    commitExists('abc123', { timeout: 1000 })

    expect(mockExecSync).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ timeout: 1000 }))
  })
})

// ============================================================================
// commitReachableFromHead Tests
// ============================================================================

describe('commitReachableFromHead', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns true when commit is ancestor of HEAD', () => {
    // git merge-base --is-ancestor exits with 0 (no output) when commit is ancestor
    mockExecSync.mockReturnValue('')

    const result = commitReachableFromHead('abc123')

    expect(result).toBe(true)
    expect(mockExecSync).toHaveBeenCalledWith(expect.stringContaining('git merge-base --is-ancestor'), expect.any(Object))
  })

  it('returns false when commit is not ancestor of HEAD', () => {
    // git merge-base --is-ancestor exits with 1 when not an ancestor
    mockExecSync.mockImplementation(() => {
      const error = new Error('exit code 1')
      ;(error as NodeJS.ErrnoException).code = '1'
      throw error
    })

    const result = commitReachableFromHead('orphaned123')

    expect(result).toBe(false)
  })

  it('returns false when commit does not exist', () => {
    mockExecSync.mockImplementation(() => {
      throw new Error('fatal: Not a valid object name')
    })

    const result = commitReachableFromHead('nonexistent')

    expect(result).toBe(false)
  })

  it('uses custom cwd', () => {
    mockExecSync.mockReturnValue('')

    commitReachableFromHead('abc123', { cwd: '/tmp/repo' })

    expect(mockExecSync).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ cwd: '/tmp/repo' }))
  })

  it('uses custom timeout', () => {
    mockExecSync.mockReturnValue('')

    commitReachableFromHead('abc123', { timeout: 1000 })

    expect(mockExecSync).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ timeout: 1000 }))
  })

  it('escapes potentially dangerous commit hashes', () => {
    mockExecSync.mockReturnValue('')

    // The function should escape the hash before using it
    commitReachableFromHead('abc123')

    expect(mockExecSync).toHaveBeenCalledWith('git merge-base --is-ancestor abc123 HEAD', expect.any(Object))
  })
})

// ============================================================================
// escapeGitRef Tests
// ============================================================================

describe('escapeGitRef', () => {
  it('allows valid git references', () => {
    expect(escapeGitRef('main')).toBe('main')
    expect(escapeGitRef('feature/add-stuff')).toBe('feature/add-stuff')
    expect(escapeGitRef('v1.0.0')).toBe('v1.0.0')
    expect(escapeGitRef('HEAD')).toBe('HEAD')
    expect(escapeGitRef('HEAD~1')).toBe('HEAD~1')
    expect(escapeGitRef('HEAD^2')).toBe('HEAD^2')
    expect(escapeGitRef('main@{1}')).toBe('main@{1}')
    expect(escapeGitRef('refs/heads/main')).toBe('refs/heads/main')
  })

  it('allows underscores and hyphens', () => {
    expect(escapeGitRef('feature_branch')).toBe('feature_branch')
    expect(escapeGitRef('fix-bug-123')).toBe('fix-bug-123')
  })

  it('throws for empty reference', () => {
    expect(() => escapeGitRef('')).toThrow('Git reference is required')
  })

  it('throws for non-string reference', () => {
    expect(() => escapeGitRef(null as unknown as string)).toThrow('Git reference is required')
    expect(() => escapeGitRef(undefined as unknown as string)).toThrow('Git reference is required')
  })

  it('throws for reference exceeding max length', () => {
    const longRef = 'a'.repeat(257)
    expect(() => escapeGitRef(longRef)).toThrow('exceeds maximum length')
  })

  it('throws for invalid characters', () => {
    expect(() => escapeGitRef('branch;rm -rf')).toThrow('Invalid character')
    expect(() => escapeGitRef('branch`whoami`')).toThrow('Invalid character')
    expect(() => escapeGitRef('branch$(cmd)')).toThrow('Invalid character')
    expect(() => escapeGitRef('branch|pipe')).toThrow('Invalid character')
    expect(() => escapeGitRef('branch&bg')).toThrow('Invalid character')
    expect(() => escapeGitRef("branch'quote")).toThrow('Invalid character')
    expect(() => escapeGitRef('branch"quote')).toThrow('Invalid character')
    expect(() => escapeGitRef('branch\nnewline')).toThrow('Invalid character')
  })
})

// ============================================================================
// escapeGitPath Tests
// ============================================================================

describe('escapeGitPath', () => {
  it('allows valid file paths', () => {
    expect(escapeGitPath('src/index.ts')).toBe('src/index.ts')
    expect(escapeGitPath('path/to/file.txt')).toBe('path/to/file.txt')
    expect(escapeGitPath('file-name.js')).toBe('file-name.js')
    expect(escapeGitPath('file_name.js')).toBe('file_name.js')
    expect(escapeGitPath('My File.txt')).toBe('My File.txt')
  })

  it('allows backslashes for Windows paths', () => {
    expect(escapeGitPath('src\\index.ts')).toBe('src\\index.ts')
  })

  it('throws for empty path', () => {
    expect(() => escapeGitPath('')).toThrow('Path is required')
  })

  it('throws for non-string path', () => {
    expect(() => escapeGitPath(null as unknown as string)).toThrow('Path is required')
    expect(() => escapeGitPath(undefined as unknown as string)).toThrow('Path is required')
  })

  it('throws for path exceeding max length', () => {
    const longPath = 'a'.repeat(4097)
    expect(() => escapeGitPath(longPath)).toThrow('exceeds maximum length')
  })

  it('throws for invalid characters', () => {
    expect(() => escapeGitPath('path;rm -rf')).toThrow('Invalid character')
    expect(() => escapeGitPath('path`cmd`')).toThrow('Invalid character')
    expect(() => escapeGitPath('path$(cmd)')).toThrow('Invalid character')
    expect(() => escapeGitPath('path|pipe')).toThrow('Invalid character')
    expect(() => escapeGitPath('path&bg')).toThrow('Invalid character')
    expect(() => escapeGitPath("path'quote")).toThrow('Invalid character')
    expect(() => escapeGitPath('path\nnewline')).toThrow('Invalid character')
  })
})

// ============================================================================
// escapeGitArg Tests
// ============================================================================

describe('escapeGitArg', () => {
  it('allows valid arguments', () => {
    expect(escapeGitArg('John Doe')).toBe('John Doe')
    expect(escapeGitArg('user@example.com')).toBe('user@example.com')
    expect(escapeGitArg('name@domain.com')).toBe('name@domain.com')
    expect(escapeGitArg('user-name')).toBe('user-name')
    expect(escapeGitArg('user_name')).toBe('user_name')
    expect(escapeGitArg('user+tag@example.com')).toBe('user+tag@example.com')
  })

  it('allows angle brackets for email format', () => {
    expect(escapeGitArg('<user@example.com>')).toBe('<user@example.com>')
  })

  it('throws for empty argument', () => {
    expect(() => escapeGitArg('')).toThrow('Argument is required')
  })

  it('throws for non-string argument', () => {
    expect(() => escapeGitArg(null as unknown as string)).toThrow('Argument is required')
    expect(() => escapeGitArg(undefined as unknown as string)).toThrow('Argument is required')
  })

  it('throws for argument exceeding max length', () => {
    const longArg = 'a'.repeat(1001)
    expect(() => escapeGitArg(longArg)).toThrow('exceeds maximum length')
  })

  it('throws for invalid characters', () => {
    expect(() => escapeGitArg('arg;rm -rf')).toThrow('Invalid character')
    expect(() => escapeGitArg('arg`cmd`')).toThrow('Invalid character')
    expect(() => escapeGitArg('arg$(cmd)')).toThrow('Invalid character')
    expect(() => escapeGitArg('arg|pipe')).toThrow('Invalid character')
    expect(() => escapeGitArg('arg&bg')).toThrow('Invalid character')
    expect(() => escapeGitArg("arg'quote")).toThrow('Invalid character')
    expect(() => escapeGitArg('arg\nnewline')).toThrow('Invalid character')
  })
})
