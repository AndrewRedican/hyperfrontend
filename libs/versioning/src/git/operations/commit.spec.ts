import { execSync } from 'node:child_process'
import { commit, amendCommit, createEmptyCommit, DEFAULT_COMMIT_OPTIONS } from './commit'

// Mock getCommit from log module
jest.mock('./log', () => ({
  ...jest.requireActual('./log'),
  getCommit: jest.fn(),
}))

import { getCommit } from './log'

jest.mock('node:child_process')

const mockExecSync = execSync as jest.MockedFunction<typeof execSync>
const mockGetCommit = getCommit as jest.MockedFunction<typeof getCommit>

describe('commit', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('creates a simple commit', () => {
    mockExecSync.mockReturnValue('')
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
    expect(mockExecSync).toHaveBeenCalledWith(expect.stringContaining('git commit'), expect.any(Object))
    expect(mockExecSync).toHaveBeenCalledWith(expect.stringContaining('-m'), expect.any(Object))
  })

  it('creates commit with body', () => {
    mockExecSync.mockReturnValue('')
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
    expect(mockExecSync).toHaveBeenCalledWith(expect.stringContaining('Detailed description'), expect.any(Object))
  })

  it('creates commit with allowEmpty option', () => {
    mockExecSync.mockReturnValue('')
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

    expect(mockExecSync).toHaveBeenCalledWith(expect.stringContaining('--allow-empty'), expect.any(Object))
  })

  it('creates commit with amend option', () => {
    mockExecSync.mockReturnValue('')
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

    expect(mockExecSync).toHaveBeenCalledWith(expect.stringContaining('--amend'), expect.any(Object))
  })

  it('creates commit with sign option', () => {
    mockExecSync.mockReturnValue('')
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

    expect(mockExecSync).toHaveBeenCalledWith(expect.stringContaining('-S'), expect.any(Object))
  })

  it('creates commit with noVerify option', () => {
    mockExecSync.mockReturnValue('')
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

    expect(mockExecSync).toHaveBeenCalledWith(expect.stringContaining('--no-verify'), expect.any(Object))
  })

  it('creates commit with custom author', () => {
    mockExecSync.mockReturnValue('')
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

    expect(mockExecSync).toHaveBeenCalledWith(expect.stringContaining('--author='), expect.any(Object))
  })

  it('creates commit with specific files', () => {
    mockExecSync.mockReturnValue('')
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

    expect(mockExecSync).toHaveBeenCalledWith(expect.stringContaining('-- package.json CHANGELOG.md'), expect.any(Object))
  })

  it('throws when message is empty', () => {
    expect(() => commit('')).toThrow('Commit message is required')
  })

  it('throws when commit fails', () => {
    mockExecSync.mockImplementation(() => {
      throw new Error('Nothing to commit')
    })

    expect(() => commit('feat: test')).toThrow('Failed to create commit')
  })

  it('throws when created commit cannot be retrieved', () => {
    mockExecSync.mockReturnValue('')
    mockGetCommit.mockReturnValue(null)

    expect(() => commit('feat: test')).toThrow('Failed to retrieve created commit')
  })

  it('uses custom cwd and timeout', () => {
    mockExecSync.mockReturnValue('')
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

    expect(mockExecSync).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ cwd: '/custom', timeout: 5000 }))
  })

  it('uses default timeout', () => {
    mockExecSync.mockReturnValue('')
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

    expect(mockExecSync).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ timeout: DEFAULT_COMMIT_OPTIONS.timeout }))
  })
})

describe('amendCommit', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('amends the last commit', () => {
    mockExecSync.mockReturnValue('')
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
    expect(mockExecSync).toHaveBeenCalledWith(expect.stringContaining('--amend'), expect.any(Object))
  })
})

describe('createEmptyCommit', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('creates an empty commit', () => {
    mockExecSync.mockReturnValue('')
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
    expect(mockExecSync).toHaveBeenCalledWith(expect.stringContaining('--allow-empty'), expect.any(Object))
  })
})
