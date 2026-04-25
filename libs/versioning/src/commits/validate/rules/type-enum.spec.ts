import { createConventionalCommit } from '../../models/conventional'
import { typeEnumRule } from './type-enum'

describe('typeEnumRule', () => {
  it('passes when type is in the allow-list', () => {
    const commit = createConventionalCommit('feat', 'add x')
    expect(typeEnumRule.check(commit, { level: 'error', options: { types: ['feat', 'fix'] } })).toEqual([])
  })

  it('fails when type is not in the allow-list', () => {
    const commit = createConventionalCommit('wip', 'add x')
    expect(typeEnumRule.check(commit, { level: 'error', options: { types: ['feat', 'fix'] } })).toEqual([
      'type must be one of [feat, fix] but was "wip"',
    ])
  })

  it('fails when the commit has an empty type', () => {
    const commit = createConventionalCommit('', 'add x')
    expect(typeEnumRule.check(commit, { level: 'error', options: { types: ['feat'] } })).toEqual([
      'type must be one of [feat] but was empty',
    ])
  })

  it('is disabled when the configured type list is empty', () => {
    const commit = createConventionalCommit('anything', 'x')
    expect(typeEnumRule.check(commit, { level: 'error', options: { types: [] } })).toEqual([])
  })

  it('is disabled when options are missing', () => {
    const commit = createConventionalCommit('anything', 'x')
    expect(typeEnumRule.check(commit, { level: 'error' })).toEqual([])
  })
})
