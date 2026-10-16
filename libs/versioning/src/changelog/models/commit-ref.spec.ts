import { describe, expect, it } from '@hyperfrontend/testing'
import { createCommitRef, createIssueRef, getShortHash } from './index'

describe('createCommitRef', () => {
  it('creates a commit ref', () => {
    expect(createCommitRef('abc1234567890')).toEqual({ hash: 'abc1234567890', shortHash: 'abc1234' })
  })

  it('includes URL if provided', () => {
    const ref = createCommitRef('abc1234', 'https://github.com/owner/repo/commit/abc1234')
    expect(ref.url).toBe('https://github.com/owner/repo/commit/abc1234')
  })
})

describe('createIssueRef', () => {
  it('creates an issue ref', () => {
    expect(createIssueRef(123)).toEqual({ number: 123, type: 'issue' })
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
    expect(createIssueRef(456, 'pull-request', 'https://github.com/owner/repo/pull/456')).toEqual({
      number: 456,
      type: 'pull-request',
      url: 'https://github.com/owner/repo/pull/456',
    })
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
