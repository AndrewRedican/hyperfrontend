import { createGitCommit, getShortHash, isSameCommit, isMergeCommit, isRootCommit, extractScope, extractType } from './commit'

describe('createGitCommit', () => {
  it('creates a commit with required fields', () => {
    const commit = createGitCommit({
      hash: 'abc1234567890def1234567890abc1234567890de',
      authorName: 'John Doe',
      authorEmail: 'john@example.com',
      authorDate: '2026-03-12T10:00:00Z',
      subject: 'feat: add new feature',
    })

    expect(commit.hash).toBe('abc1234567890def1234567890abc1234567890de')
    expect(commit.shortHash).toBe('abc1234')
    expect(commit.authorName).toBe('John Doe')
    expect(commit.authorEmail).toBe('john@example.com')
    expect(commit.authorDate).toBe('2026-03-12T10:00:00Z')
    expect(commit.subject).toBe('feat: add new feature')
    expect(commit.body).toBe('')
    expect(commit.message).toBe('feat: add new feature')
    expect(commit.parents).toEqual([])
    expect(commit.refs).toEqual([])
  })

  it('creates a commit with optional fields', () => {
    const commit = createGitCommit({
      hash: 'abc1234567890def1234567890abc1234567890de',
      authorName: 'John Doe',
      authorEmail: 'john@example.com',
      authorDate: '2026-03-12T10:00:00Z',
      subject: 'feat: add new feature',
      committerName: 'Jane Doe',
      committerEmail: 'jane@example.com',
      commitDate: '2026-03-12T11:00:00Z',
      body: 'This is the commit body.',
      parents: ['parent1', 'parent2'],
      refs: ['HEAD', 'main'],
    })

    expect(commit.committerName).toBe('Jane Doe')
    expect(commit.committerEmail).toBe('jane@example.com')
    expect(commit.commitDate).toBe('2026-03-12T11:00:00Z')
    expect(commit.body).toBe('This is the commit body.')
    expect(commit.message).toBe('feat: add new feature\n\nThis is the commit body.')
    expect(commit.parents).toEqual(['parent1', 'parent2'])
    expect(commit.refs).toEqual(['HEAD', 'main'])
  })

  it('defaults committer to author', () => {
    const commit = createGitCommit({
      hash: 'abc1234567890def1234567890abc1234567890de',
      authorName: 'John Doe',
      authorEmail: 'john@example.com',
      authorDate: '2026-03-12T10:00:00Z',
      subject: 'test',
    })

    expect(commit.committerName).toBe('John Doe')
    expect(commit.committerEmail).toBe('john@example.com')
    expect(commit.commitDate).toBe('2026-03-12T10:00:00Z')
  })
})

describe('getShortHash', () => {
  it('returns first 7 characters', () => {
    expect(getShortHash('abc1234567890')).toBe('abc1234')
  })

  it('handles short hashes', () => {
    expect(getShortHash('abc')).toBe('abc')
  })
})

describe('isSameCommit', () => {
  it('returns true for same hash', () => {
    const a = createGitCommit({
      hash: 'abc1234567890def1234567890abc1234567890de',
      authorName: 'A',
      authorEmail: 'a@a.com',
      authorDate: '2026-01-01',
      subject: 'A',
    })
    const b = createGitCommit({
      hash: 'abc1234567890def1234567890abc1234567890de',
      authorName: 'B',
      authorEmail: 'b@b.com',
      authorDate: '2026-01-01',
      subject: 'B',
    })

    expect(isSameCommit(a, b)).toBe(true)
  })

  it('returns false for different hash', () => {
    const a = createGitCommit({
      hash: 'aaa1234567890def1234567890abc1234567890de',
      authorName: 'A',
      authorEmail: 'a@a.com',
      authorDate: '2026-01-01',
      subject: 'A',
    })
    const b = createGitCommit({
      hash: 'bbb1234567890def1234567890abc1234567890de',
      authorName: 'A',
      authorEmail: 'a@a.com',
      authorDate: '2026-01-01',
      subject: 'A',
    })

    expect(isSameCommit(a, b)).toBe(false)
  })
})

describe('isMergeCommit', () => {
  it('returns true for multiple parents', () => {
    const commit = createGitCommit({
      hash: 'abc123',
      authorName: 'A',
      authorEmail: 'a@a.com',
      authorDate: '2026-01-01',
      subject: 'Merge',
      parents: ['parent1', 'parent2'],
    })

    expect(isMergeCommit(commit)).toBe(true)
  })

  it('returns false for single parent', () => {
    const commit = createGitCommit({
      hash: 'abc123',
      authorName: 'A',
      authorEmail: 'a@a.com',
      authorDate: '2026-01-01',
      subject: 'Regular',
      parents: ['parent1'],
    })

    expect(isMergeCommit(commit)).toBe(false)
  })
})

describe('isRootCommit', () => {
  it('returns true for no parents', () => {
    const commit = createGitCommit({
      hash: 'abc123',
      authorName: 'A',
      authorEmail: 'a@a.com',
      authorDate: '2026-01-01',
      subject: 'Initial',
      parents: [],
    })

    expect(isRootCommit(commit)).toBe(true)
  })

  it('returns false for parents', () => {
    const commit = createGitCommit({
      hash: 'abc123',
      authorName: 'A',
      authorEmail: 'a@a.com',
      authorDate: '2026-01-01',
      subject: 'Regular',
      parents: ['parent1'],
    })

    expect(isRootCommit(commit)).toBe(false)
  })
})

describe('extractScope', () => {
  it('extracts scope from conventional commit', () => {
    expect(extractScope('feat(lib-versioning): add git support')).toBe('lib-versioning')
    expect(extractScope('fix(core): bug fix')).toBe('core')
  })

  it('returns undefined for no scope', () => {
    expect(extractScope('fix: resolve issue')).toBeUndefined()
    expect(extractScope('random message')).toBeUndefined()
  })

  it('handles breaking change marker', () => {
    expect(extractScope('feat(api)!: breaking change')).toBe('api')
  })

  it('returns undefined for empty scope parentheses', () => {
    expect(extractScope('feat(): message')).toBeUndefined()
  })

  it('returns undefined for unclosed parenthesis', () => {
    expect(extractScope('feat(unclosed')).toBeUndefined()
  })
})

describe('extractType', () => {
  it('extracts type from conventional commit', () => {
    expect(extractType('feat(lib): add feature')).toBe('feat')
    expect(extractType('fix: resolve issue')).toBe('fix')
    expect(extractType('chore!: breaking')).toBe('chore')
  })

  it('returns undefined for non-conventional', () => {
    expect(extractType('random message')).toBeUndefined()
    expect(extractType('123: number prefix')).toBeUndefined()
  })

  it('returns undefined when subject is just the type', () => {
    expect(extractType('feat')).toBeUndefined()
  })
})
