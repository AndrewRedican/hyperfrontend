import { execFileSync } from 'node:child_process'
import { commit, amendCommit, amendCommitNoEdit, createEmptyCommit, DEFAULT_COMMIT_OPTIONS } from './commit'
import { getCommit } from './log'
jest.mock('./log', () => ({
  ...jest.requireActual('./log'),
  getCommit: jest.fn(),
}))
jest.mock('node:child_process')

const mockExecFileSync = execFileSync as jest.MockedFunction<typeof execFileSync>
const mockGetCommit = getCommit as jest.MockedFunction<typeof getCommit>

describe('commit', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('creates a simple commit', () => {
    mockExecFileSync.mockReturnValue('')
    mockGetCommit.mockReturnValue({
      hash: 'abc123def456789012345678901234567890abcd',
      shortHash: 'abc123d',
      authorName: 'John Doe',
      authorEmail: 'john@example.com',
      authorDate: '2026-03-12T10:00:00Z',
      committerName: 'John Doe',
      committerEmail: 'john@example.com',
      commitDate: '2026-03-12T10:00:00Z',
      subject: 'feat: add new feature',
      body: '',
      message: 'feat: add new feature',
      parents: [],
      refs: [],
    })

    const result = commit('feat: add new feature')

    expect(result.subject).toBe('feat: add new feature')
    expect(mockExecFileSync).toHaveBeenCalledWith('git', expect.arrayContaining(['commit']), expect.any(Object))
    expect(mockExecFileSync).toHaveBeenCalledWith('git', expect.arrayContaining(['-m']), expect.any(Object))
  })

  it('creates commit with body', () => {
    mockExecFileSync.mockReturnValue('')
    mockGetCommit.mockReturnValue({
      hash: 'abc123',
      shortHash: 'abc123d',
      authorName: 'John Doe',
      authorEmail: 'john@example.com',
      authorDate: '2026-03-12T10:00:00Z',
      committerName: 'John Doe',
      committerEmail: 'john@example.com',
      commitDate: '2026-03-12T10:00:00Z',
      subject: 'feat: add feature',
      body: 'Detailed description',
      message: 'feat: add feature\n\nDetailed description',
      parents: [],
      refs: [],
    })

    const result = commit('feat: add feature', { body: 'Detailed description' })

    expect(result).toBeDefined()
    expect(mockExecFileSync).toHaveBeenCalledWith('git', expect.arrayContaining(['-m']), expect.any(Object))
  })

  it('creates commit with allowEmpty option', () => {
    mockExecFileSync.mockReturnValue('')
    mockGetCommit.mockReturnValue({
      hash: 'abc123',
      shortHash: 'abc123d',
      authorName: 'John Doe',
      authorEmail: 'john@example.com',
      authorDate: '2026-03-12T10:00:00Z',
      committerName: 'John Doe',
      committerEmail: 'john@example.com',
      commitDate: '2026-03-12T10:00:00Z',
      subject: 'chore: trigger CI',
      body: '',
      message: 'chore: trigger CI',
      parents: [],
      refs: [],
    })

    commit('chore: trigger CI', { allowEmpty: true })

    expect(mockExecFileSync).toHaveBeenCalledWith('git', expect.arrayContaining(['--allow-empty']), expect.any(Object))
  })

  it('creates commit with amend option', () => {
    mockExecFileSync.mockReturnValue('')
    mockGetCommit.mockReturnValue({
      hash: 'abc123',
      shortHash: 'abc123d',
      authorName: 'John Doe',
      authorEmail: 'john@example.com',
      authorDate: '2026-03-12T10:00:00Z',
      committerName: 'John Doe',
      committerEmail: 'john@example.com',
      commitDate: '2026-03-12T10:00:00Z',
      subject: 'feat: improved feature',
      body: '',
      message: 'feat: improved feature',
      parents: [],
      refs: [],
    })

    commit('feat: improved feature', { amend: true })

    expect(mockExecFileSync).toHaveBeenCalledWith('git', expect.arrayContaining(['--amend']), expect.any(Object))
  })

  it('creates commit with sign option', () => {
    mockExecFileSync.mockReturnValue('')
    mockGetCommit.mockReturnValue({
      hash: 'abc123',
      shortHash: 'abc123d',
      authorName: 'John Doe',
      authorEmail: 'john@example.com',
      authorDate: '2026-03-12T10:00:00Z',
      committerName: 'John Doe',
      committerEmail: 'john@example.com',
      commitDate: '2026-03-12T10:00:00Z',
      subject: 'feat: signed commit',
      body: '',
      message: 'feat: signed commit',
      parents: [],
      refs: [],
    })

    commit('feat: signed commit', { sign: true })

    expect(mockExecFileSync).toHaveBeenCalledWith('git', expect.arrayContaining(['-S']), expect.any(Object))
  })

  it('creates commit with noVerify option', () => {
    mockExecFileSync.mockReturnValue('')
    mockGetCommit.mockReturnValue({
      hash: 'abc123',
      shortHash: 'abc123d',
      authorName: 'John Doe',
      authorEmail: 'john@example.com',
      authorDate: '2026-03-12T10:00:00Z',
      committerName: 'John Doe',
      committerEmail: 'john@example.com',
      commitDate: '2026-03-12T10:00:00Z',
      subject: 'WIP: work in progress',
      body: '',
      message: 'WIP: work in progress',
      parents: [],
      refs: [],
    })

    commit('WIP: work in progress', { noVerify: true })

    expect(mockExecFileSync).toHaveBeenCalledWith('git', expect.arrayContaining(['--no-verify']), expect.any(Object))
  })

  it('creates commit with custom author', () => {
    mockExecFileSync.mockReturnValue('')
    mockGetCommit.mockReturnValue({
      hash: 'abc123',
      shortHash: 'abc123d',
      authorName: 'Bot User',
      authorEmail: 'bot@example.com',
      authorDate: '2026-03-12T10:00:00Z',
      committerName: 'John Doe',
      committerEmail: 'john@example.com',
      commitDate: '2026-03-12T10:00:00Z',
      subject: 'feat: bot commit',
      body: '',
      message: 'feat: bot commit',
      parents: [],
      refs: [],
    })

    commit('feat: bot commit', { author: 'Bot User <bot@example.com>' })

    expect(mockExecFileSync).toHaveBeenCalledWith(
      'git',
      expect.arrayContaining(['--author', 'Bot User <bot@example.com>']),
      expect.any(Object)
    )
  })

  it('creates commit with specific files', () => {
    mockExecFileSync.mockReturnValue('')
    mockGetCommit.mockReturnValue({
      hash: 'abc123',
      shortHash: 'abc123d',
      authorName: 'John Doe',
      authorEmail: 'john@example.com',
      authorDate: '2026-03-12T10:00:00Z',
      committerName: 'John Doe',
      committerEmail: 'john@example.com',
      commitDate: '2026-03-12T10:00:00Z',
      subject: 'chore: update files',
      body: '',
      message: 'chore: update files',
      parents: [],
      refs: [],
    })

    commit('chore: update files', { files: ['package.json', 'CHANGELOG.md'] })

    expect(mockExecFileSync).toHaveBeenCalledWith('git', expect.arrayContaining(['--', 'package.json', 'CHANGELOG.md']), expect.any(Object))
  })

  it('throws when message is empty', () => {
    expect(() => commit('')).toThrow('Commit message is required')
  })

  it('throws when commit fails', () => {
    mockExecFileSync.mockImplementation(() => {
      throw new Error('Nothing to commit')
    })

    expect(() => commit('feat: test')).toThrow('Failed to create commit')
  })

  it('throws when created commit cannot be retrieved', () => {
    mockExecFileSync.mockReturnValue('')
    mockGetCommit.mockReturnValue(null)

    expect(() => commit('feat: test')).toThrow('Failed to retrieve created commit')
  })

  it('uses custom cwd and timeout', () => {
    mockExecFileSync.mockReturnValue('')
    mockGetCommit.mockReturnValue({
      hash: 'abc123',
      shortHash: 'abc123d',
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

    commit('feat: test', { cwd: '/custom', timeout: 5000 })

    expect(mockExecFileSync).toHaveBeenCalledWith('git', expect.any(Array), expect.objectContaining({ cwd: '/custom', timeout: 5000 }))
  })

  it('uses default timeout', () => {
    mockExecFileSync.mockReturnValue('')
    mockGetCommit.mockReturnValue({
      hash: 'abc123',
      shortHash: 'abc123d',
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

    commit('feat: test')

    expect(mockExecFileSync).toHaveBeenCalledWith(
      'git',
      expect.any(Array),
      expect.objectContaining({ timeout: DEFAULT_COMMIT_OPTIONS.timeout })
    )
  })
})

describe('amendCommit', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('amends the last commit', () => {
    mockExecFileSync.mockReturnValue('')
    mockGetCommit.mockReturnValue({
      hash: 'abc123',
      shortHash: 'abc123d',
      authorName: 'John Doe',
      authorEmail: 'john@example.com',
      authorDate: '2026-03-12T10:00:00Z',
      committerName: 'John Doe',
      committerEmail: 'john@example.com',
      commitDate: '2026-03-12T10:00:00Z',
      subject: 'feat: improved message',
      body: '',
      message: 'feat: improved message',
      parents: [],
      refs: [],
    })

    const result = amendCommit('feat: improved message')

    expect(result.subject).toBe('feat: improved message')
    expect(mockExecFileSync).toHaveBeenCalledWith('git', expect.arrayContaining(['--amend']), expect.any(Object))
  })
})

describe('amendCommitNoEdit', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('amends the last commit without changing the message', () => {
    mockExecFileSync.mockReturnValue('')
    mockGetCommit.mockReturnValue({
      hash: 'def456',
      shortHash: 'def456a',
      authorName: 'John Doe',
      authorEmail: 'john@example.com',
      authorDate: '2026-03-12T10:00:00Z',
      committerName: 'John Doe',
      committerEmail: 'john@example.com',
      commitDate: '2026-03-12T10:00:00Z',
      subject: 'feat: original message',
      body: '',
      message: 'feat: original message',
      parents: [],
      refs: [],
    })

    const result = amendCommitNoEdit()

    expect(result.hash).toBe('def456')
    expect(mockExecFileSync).toHaveBeenCalledWith('git', expect.arrayContaining(['--amend']), expect.any(Object))
    expect(mockExecFileSync).toHaveBeenCalledWith('git', expect.arrayContaining(['--no-edit']), expect.any(Object))
    expect(mockExecFileSync).not.toHaveBeenCalledWith('git', expect.arrayContaining(['-m']), expect.any(Object))
  })

  it('uses custom cwd option', () => {
    mockExecFileSync.mockReturnValue('')
    mockGetCommit.mockReturnValue({
      hash: 'abc123',
      shortHash: 'abc123d',
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

    amendCommitNoEdit({ cwd: '/custom/path' })

    expect(mockExecFileSync).toHaveBeenCalledWith('git', expect.any(Array), expect.objectContaining({ cwd: '/custom/path' }))
  })
})

describe('commit with noEdit option', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('allows empty message when noEdit and amend are both true', () => {
    mockExecFileSync.mockReturnValue('')
    mockGetCommit.mockReturnValue({
      hash: 'ghi789',
      shortHash: 'ghi789b',
      authorName: 'John Doe',
      authorEmail: 'john@example.com',
      authorDate: '2026-03-12T10:00:00Z',
      committerName: 'John Doe',
      committerEmail: 'john@example.com',
      commitDate: '2026-03-12T10:00:00Z',
      subject: 'feat: existing message',
      body: '',
      message: 'feat: existing message',
      parents: [],
      refs: [],
    })

    const result = commit('', { amend: true, noEdit: true })

    expect(result.hash).toBe('ghi789')
    expect(mockExecFileSync).toHaveBeenCalledWith('git', expect.arrayContaining(['--amend']), expect.any(Object))
    expect(mockExecFileSync).toHaveBeenCalledWith('git', expect.arrayContaining(['--no-edit']), expect.any(Object))
  })

  it('throws when noEdit is true but amend is false', () => {
    expect(() => commit('', { noEdit: true })).toThrow('Commit message is required')
  })
})

describe('createEmptyCommit', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('creates an empty commit', () => {
    mockExecFileSync.mockReturnValue('')
    mockGetCommit.mockReturnValue({
      hash: 'abc123',
      shortHash: 'abc123d',
      authorName: 'John Doe',
      authorEmail: 'john@example.com',
      authorDate: '2026-03-12T10:00:00Z',
      committerName: 'John Doe',
      committerEmail: 'john@example.com',
      commitDate: '2026-03-12T10:00:00Z',
      subject: 'chore: trigger CI',
      body: '',
      message: 'chore: trigger CI',
      parents: [],
      refs: [],
    })

    const result = createEmptyCommit('chore: trigger CI')

    expect(result.subject).toBe('chore: trigger CI')
    expect(mockExecFileSync).toHaveBeenCalledWith('git', expect.arrayContaining(['--allow-empty']), expect.any(Object))
  })
})
