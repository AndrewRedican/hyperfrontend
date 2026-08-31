import { describe, expect, it } from '@hyperfrontend/testing'
import { createConventionalCommit } from '../../models/conventional'
import { imperativeMoodRule } from './imperative-mood'

describe('imperativeMoodRule', () => {
  const pastTenseCases: ReadonlyArray<readonly [string, string]> = [
    ['added', 'add'],
    ['updated', 'update'],
    ['fixed', 'fix'],
    ['removed', 'remove'],
    ['changed', 'change'],
    ['modified', 'modify'],
    ['created', 'create'],
    ['deleted', 'delete'],
    ['improved', 'improve'],
    ['refactored', 'refactor'],
    ['implemented', 'implement'],
    ['renamed', 'rename'],
    ['moved', 'move'],
  ]

  for (const [past, imperative] of pastTenseCases) {
    it(`warns when first word is "${past}"`, () => {
      const commit = createConventionalCommit('feat', `${past} something new`)
      expect(imperativeMoodRule.check(commit, { level: 'warn' })).toEqual([
        `subject should use imperative mood: use "${imperative}" instead of "${past}"`,
      ])
    })
  }

  it('matches case-insensitively', () => {
    const commit = createConventionalCommit('feat', 'Added login flow')
    expect(imperativeMoodRule.check(commit, { level: 'warn' })).toEqual([
      'subject should use imperative mood: use "add" instead of "added"',
    ])
  })

  it('does not warn when first word is already imperative', () => {
    const commit = createConventionalCommit('feat', 'add login flow')
    expect(imperativeMoodRule.check(commit, { level: 'warn' })).toEqual([])
  })

  it('does not warn when first word is unknown', () => {
    const commit = createConventionalCommit('feat', 'sprint through tests')
    expect(imperativeMoodRule.check(commit, { level: 'warn' })).toEqual([])
  })

  it('does not warn on empty subject', () => {
    const commit = createConventionalCommit('feat', '')
    expect(imperativeMoodRule.check(commit, { level: 'warn' })).toEqual([])
  })

  it('uses the provided wordlist when passed', () => {
    const commit = createConventionalCommit('feat', 'shipped release')
    expect(imperativeMoodRule.check(commit, { level: 'warn', options: { wordlist: { shipped: 'ship' } } })).toEqual([
      'subject should use imperative mood: use "ship" instead of "shipped"',
    ])
  })

  it('does not warn when the provided wordlist lacks the match', () => {
    const commit = createConventionalCommit('feat', 'added login')
    expect(imperativeMoodRule.check(commit, { level: 'warn', options: { wordlist: {} } })).toEqual([])
  })
})
