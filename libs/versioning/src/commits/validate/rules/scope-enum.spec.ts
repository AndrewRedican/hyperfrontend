import { describe, expect, it } from '@hyperfrontend/testing'
import { createConventionalCommit } from '../../models/conventional'
import { scopeEnumRule } from './scope-enum'

describe('scopeEnumRule', () => {
  it('passes when every scope is in the allow-list', () => {
    const commit = createConventionalCommit('feat', 'add x', { scope: ['auth', 'api'] })
    expect(scopeEnumRule.check(commit, { level: 'error', options: { scopes: ['auth', 'api', 'ui'] } })).toEqual([])
  })

  it('fails for each scope outside the allow-list', () => {
    const commit = createConventionalCommit('feat', 'add x', { scope: ['auth', 'mystery'] })
    expect(scopeEnumRule.check(commit, { level: 'error', options: { scopes: ['auth'] } })).toEqual([
      'scope must be one of [auth] but found "mystery"',
    ])
  })

  it('passes when the commit has no scopes', () => {
    const commit = createConventionalCommit('feat', 'add x')
    expect(scopeEnumRule.check(commit, { level: 'error', options: { scopes: ['auth'] } })).toEqual([])
  })

  it('is disabled when the configured scope list is empty', () => {
    const commit = createConventionalCommit('feat', 'x', { scope: ['anything'] })
    expect(scopeEnumRule.check(commit, { level: 'error', options: { scopes: [] } })).toEqual([])
  })

  it('is disabled when options are missing', () => {
    const commit = createConventionalCommit('feat', 'x', { scope: ['anything'] })
    expect(scopeEnumRule.check(commit, { level: 'error' })).toEqual([])
  })
})
