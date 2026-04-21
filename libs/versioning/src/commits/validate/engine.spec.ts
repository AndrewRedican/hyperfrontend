import type { Rule } from './models/rule'
import type { Ruleset } from './models/ruleset'
import { createConventionalCommit } from '../models/conventional'
import { BUILT_IN_RULES, validateCommit, validateCommitWithRules } from './engine'

describe('validateCommit', () => {
  it('returns valid when no rules fire', () => {
    const commit = createConventionalCommit('feat', 'add login')
    const ruleset: Ruleset = { 'type-enum': ['error', { types: ['feat', 'fix'] }] }
    expect(validateCommit(commit, ruleset)).toEqual({ valid: true, warnings: [], errors: [] })
  })

  it('collects error-level violations and marks invalid', () => {
    const commit = createConventionalCommit('wip', 'add x')
    const ruleset: Ruleset = { 'type-enum': ['error', { types: ['feat', 'fix'] }] }
    expect(validateCommit(commit, ruleset)).toEqual({
      valid: false,
      warnings: [],
      errors: [expect.objectContaining({ level: 'error', ruleName: 'type-enum' })],
    })
  })

  it('collects warn-level violations without invalidating', () => {
    const commit = createConventionalCommit('feat', 'added login')
    const ruleset: Ruleset = { 'imperative-mood': ['warn'] }
    expect(validateCommit(commit, ruleset)).toEqual({
      valid: true,
      warnings: [expect.objectContaining({ level: 'warn', ruleName: 'imperative-mood' })],
      errors: [],
    })
  })

  it('skips rules configured as off', () => {
    const commit = createConventionalCommit('wip', 'anything')
    const ruleset: Ruleset = { 'type-enum': ['off', { types: ['feat'] }] }
    expect(validateCommit(commit, ruleset)).toEqual({ valid: true, warnings: [], errors: [] })
  })

  it('ignores unknown rule names in the ruleset', () => {
    const commit = createConventionalCommit('feat', 'add login')
    const ruleset: Ruleset = { 'unknown-rule': ['error', {}] }
    expect(validateCommit(commit, ruleset)).toEqual({ valid: true, warnings: [], errors: [] })
  })

  it('aggregates warnings and errors from multiple rules', () => {
    const commit = createConventionalCommit('feat', 'added ' + 'x'.repeat(100))
    const ruleset: Ruleset = {
      'imperative-mood': ['warn'],
      'header-max-length': ['warn', { maxLength: 72 }],
      'subject-empty': ['error'],
      'type-enum': ['error', { types: ['feat', 'fix'] }],
    }
    const result = validateCommit(commit, ruleset)
    expect(result).toEqual({
      valid: true,
      warnings: expect.arrayContaining([
        expect.objectContaining({ ruleName: 'imperative-mood' }),
        expect.objectContaining({ ruleName: 'header-max-length' }),
      ]),
      errors: [],
    })
  })
})

describe('validateCommitWithRules', () => {
  it('runs caller-supplied rules alongside a config map', () => {
    const alwaysFailsRule: Rule = {
      name: 'always-fails',
      check() {
        return ['nope']
      },
    }
    const commit = createConventionalCommit('feat', 'x')
    const result = validateCommitWithRules(commit, { 'always-fails': ['error'] }, { 'always-fails': alwaysFailsRule })
    expect(result.errors).toEqual([{ level: 'error', ruleName: 'always-fails', message: 'nope' }])
  })
})

describe('BUILT_IN_RULES', () => {
  it('exposes every shipped rule by name', () => {
    expect(BUILT_IN_RULES).toEqual(
      expect.objectContaining({
        'type-enum': expect.any(Object),
        'scope-enum': expect.any(Object),
        'subject-case': expect.any(Object),
        'subject-empty': expect.any(Object),
        'header-max-length': expect.any(Object),
        'imperative-mood': expect.any(Object),
      })
    )
  })
})
