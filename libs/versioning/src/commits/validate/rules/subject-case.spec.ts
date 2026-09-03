import { describe, expect, it } from '@hyperfrontend/testing'
import { createConventionalCommit } from '../../models/conventional'
import { subjectCaseRule } from './subject-case'

describe('subjectCaseRule', () => {
  it('passes when lower-case matches', () => {
    const commit = createConventionalCommit('feat', 'add login flow')
    expect(subjectCaseRule.check(commit, { level: 'error', options: { cases: ['lower-case'] } })).toEqual([])
  })

  it('fails when lower-case is violated', () => {
    const commit = createConventionalCommit('feat', 'Add Login Flow')
    expect(subjectCaseRule.check(commit, { level: 'error', options: { cases: ['lower-case'] } })).toEqual([
      'subject must be one of [lower-case] but was "Add Login Flow"',
    ])
  })

  it('passes when upper-case matches', () => {
    const commit = createConventionalCommit('feat', 'URGENT FIX')
    expect(subjectCaseRule.check(commit, { level: 'error', options: { cases: ['upper-case'] } })).toEqual([])
  })

  it('fails when upper-case is violated', () => {
    const commit = createConventionalCommit('feat', 'Mixed Case')
    expect(subjectCaseRule.check(commit, { level: 'error', options: { cases: ['upper-case'] } })).toEqual([
      'subject must be one of [upper-case] but was "Mixed Case"',
    ])
  })

  it('passes sentence-case when the first alpha char is uppercase', () => {
    const commit = createConventionalCommit('feat', 'Add login flow')
    expect(subjectCaseRule.check(commit, { level: 'error', options: { cases: ['sentence-case'] } })).toEqual([])
  })

  it('fails sentence-case when the first alpha char is lowercase', () => {
    const commit = createConventionalCommit('feat', 'add login flow')
    expect(subjectCaseRule.check(commit, { level: 'error', options: { cases: ['sentence-case'] } })).toEqual([
      'subject must be one of [sentence-case] but was "add login flow"',
    ])
  })

  it('passes kebab-case for hyphenated lowercase tokens', () => {
    const commit = createConventionalCommit('feat', 'add-login-flow')
    expect(subjectCaseRule.check(commit, { level: 'error', options: { cases: ['kebab-case'] } })).toEqual([])
  })

  it('fails kebab-case when the subject contains spaces', () => {
    const commit = createConventionalCommit('feat', 'add login flow')
    expect(subjectCaseRule.check(commit, { level: 'error', options: { cases: ['kebab-case'] } })).toEqual([
      'subject must be one of [kebab-case] but was "add login flow"',
    ])
  })

  it('passes snake-case for underscore-joined lowercase tokens', () => {
    const commit = createConventionalCommit('feat', 'add_login_flow')
    expect(subjectCaseRule.check(commit, { level: 'error', options: { cases: ['snake-case'] } })).toEqual([])
  })

  it('fails snake-case when the subject contains hyphens', () => {
    const commit = createConventionalCommit('feat', 'add-login')
    expect(subjectCaseRule.check(commit, { level: 'error', options: { cases: ['snake-case'] } })).toEqual([
      'subject must be one of [snake-case] but was "add-login"',
    ])
  })

  it('passes start-case when every word begins with uppercase', () => {
    const commit = createConventionalCommit('feat', 'Add Login Flow')
    expect(subjectCaseRule.check(commit, { level: 'error', options: { cases: ['start-case'] } })).toEqual([])
  })

  it('fails start-case when any word begins with lowercase', () => {
    const commit = createConventionalCommit('feat', 'Add login Flow')
    expect(subjectCaseRule.check(commit, { level: 'error', options: { cases: ['start-case'] } })).toEqual([
      'subject must be one of [start-case] but was "Add login Flow"',
    ])
  })

  it('accepts any of the allowed cases', () => {
    const commit = createConventionalCommit('feat', 'add x')
    expect(subjectCaseRule.check(commit, { level: 'error', options: { cases: ['upper-case', 'lower-case'] } })).toEqual([])
  })

  it('is disabled when the case list is empty', () => {
    const commit = createConventionalCommit('feat', 'Whatever')
    expect(subjectCaseRule.check(commit, { level: 'error', options: { cases: [] } })).toEqual([])
  })

  it('is disabled when options are missing', () => {
    const commit = createConventionalCommit('feat', 'Whatever')
    expect(subjectCaseRule.check(commit, { level: 'error' })).toEqual([])
  })

  it('passes when the subject is empty (handled by subject-empty)', () => {
    const commit = createConventionalCommit('feat', '')
    expect(subjectCaseRule.check(commit, { level: 'error', options: { cases: ['lower-case'] } })).toEqual([])
  })

  it('passes sentence-case when subject has no alpha characters', () => {
    const commit = createConventionalCommit('feat', '123 456')
    expect(subjectCaseRule.check(commit, { level: 'error', options: { cases: ['sentence-case'] } })).toEqual([])
  })

  it('accepts digits in kebab-case subjects', () => {
    const commit = createConventionalCommit('feat', 'release-v2-rollout')
    expect(subjectCaseRule.check(commit, { level: 'error', options: { cases: ['kebab-case'] } })).toEqual([])
  })

  it('accepts digits in snake-case subjects', () => {
    const commit = createConventionalCommit('feat', 'release_v2_rollout')
    expect(subjectCaseRule.check(commit, { level: 'error', options: { cases: ['snake-case'] } })).toEqual([])
  })

  it('accepts digit-started words in start-case', () => {
    const commit = createConventionalCommit('feat', '2024 Release')
    expect(subjectCaseRule.check(commit, { level: 'error', options: { cases: ['start-case'] } })).toEqual([])
  })
})
