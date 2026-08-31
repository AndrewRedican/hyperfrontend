import { describe, expect, it } from '@hyperfrontend/testing'
import { createConventionalCommit } from '../../models/conventional'
import { subjectEmptyRule } from './subject-empty'

describe('subjectEmptyRule', () => {
  it('passes when the subject is non-empty', () => {
    const commit = createConventionalCommit('feat', 'add x')
    expect(subjectEmptyRule.check(commit, { level: 'error' })).toEqual([])
  })

  it('fails when the subject is empty', () => {
    const commit = createConventionalCommit('feat', '')
    expect(subjectEmptyRule.check(commit, { level: 'error' })).toEqual(['subject must not be empty'])
  })

  it('fails when the subject is whitespace-only', () => {
    const commit = createConventionalCommit('feat', '   ')
    expect(subjectEmptyRule.check(commit, { level: 'error' })).toEqual(['subject must not be empty'])
  })
})
