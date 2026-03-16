import { createCommitRef, createIssueRef, getShortHash } from './index'

describe('createCommitRef', () => {
  it('creates a commit ref', () => {
    const ref = createCommitRef('abc1234567890')
    expect(ref.hash).toBe('abc1234567890')
    expect(ref.shortHash).toBe('abc1234')
  })

  it('includes URL if provided', () => {
    const ref = createCommitRef('abc1234', 'https://github.com/owner/repo/commit/abc1234')
    expect(ref.url).toBe('https://github.com/owner/repo/commit/abc1234')
  })
})

describe('createIssueRef', () => {
  it('creates an issue ref', () => {
    const ref = createIssueRef(123)
    expect(ref.number).toBe(123)
    expect(ref.type).toBe('issue')
  })

  it('creates a PR ref', () => {
    const ref = createIssueRef(123, 'pull-request')
    expect(ref.type).toBe('pull-request')
  })

  it('includes URL if provided', () => {
    const ref = createIssueRef(123, 'issue', 'https://github.com/owner/repo/issues/123')
    expect(ref.url).toBe('https://github.com/owner/repo/issues/123')
  })

  it('creates a PR ref with URL', () => {
    const ref = createIssueRef(456, 'pull-request', 'https://github.com/owner/repo/pull/456')
    expect(ref.number).toBe(456)
    expect(ref.type).toBe('pull-request')
    expect(ref.url).toBe('https://github.com/owner/repo/pull/456')
  })
})

describe('getShortHash', () => {
  it('returns first 7 characters of hash', () => {
    expect(getShortHash('abc1234567890')).toBe('abc1234')
  })

  it('handles short hashes', () => {
    expect(getShortHash('abc')).toBe('abc')
  })

  it('handles exactly 7 character hash', () => {
    expect(getShortHash('abc1234')).toBe('abc1234')
  })
})
