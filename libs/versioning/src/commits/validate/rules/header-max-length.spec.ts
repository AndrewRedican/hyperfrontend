import { describe, expect, it } from '@hyperfrontend/testing'
import { createConventionalCommit } from '../../models/conventional'
import { headerMaxLengthRule } from './header-max-length'

describe('headerMaxLengthRule', () => {
  it('passes when header is within the limit', () => {
    const commit = createConventionalCommit('feat', 'add login')
    expect(headerMaxLengthRule.check(commit, { level: 'warn', options: { maxLength: 72 } })).toEqual([])
  })

  it('fails when header exceeds the limit', () => {
    const subject = 'x'.repeat(80)
    const commit = createConventionalCommit('feat', subject)
    const result = headerMaxLengthRule.check(commit, { level: 'warn', options: { maxLength: 72 } })
    expect(result).toEqual([expect.stringContaining('header must be ≤ 72 characters but was')])
  })

  it('counts scope, breaking marker, and separator in the header length', () => {
    const commit = createConventionalCommit('feat', 'abc', { scope: ['core', 'api'], breaking: true })
    expect(headerMaxLengthRule.check(commit, { level: 'warn', options: { maxLength: 10 } })).toEqual([
      'header must be ≤ 10 characters but was 20: "feat(core,api)!: abc"',
    ])
  })

  it('is disabled when maxLength is null', () => {
    const commit = createConventionalCommit('feat', 'x'.repeat(200))
    expect(headerMaxLengthRule.check(commit, { level: 'warn', options: { maxLength: null } })).toEqual([])
  })

  it('is disabled when options are missing', () => {
    const commit = createConventionalCommit('feat', 'x'.repeat(200))
    expect(headerMaxLengthRule.check(commit, { level: 'warn' })).toEqual([])
  })

  it('passes at exactly the boundary', () => {
    const subject = 'x'.repeat(66)
    const commit = createConventionalCommit('feat', subject)
    expect(headerMaxLengthRule.check(commit, { level: 'warn', options: { maxLength: 72 } })).toEqual([])
  })
})
