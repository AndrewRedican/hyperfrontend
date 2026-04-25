import type { Ruleset } from './models/ruleset'
import { validateCommitMessage } from './validate-message'

const ruleset: Ruleset = {
  'type-enum': ['error', { types: ['feat', 'fix'] }],
  'subject-empty': ['error'],
  'imperative-mood': ['warn'],
  'header-max-length': ['warn', { maxLength: 72 }],
}

describe('validateCommitMessage', () => {
  it('returns valid for a conforming conventional commit', () => {
    expect(validateCommitMessage('feat: add login', ruleset)).toEqual({
      valid: true,
      warnings: [],
      errors: [],
    })
  })

  it('flags past-tense subjects as warnings', () => {
    const result = validateCommitMessage('feat: added login', ruleset)
    expect(result).toEqual({
      valid: true,
      warnings: [expect.objectContaining({ ruleName: 'imperative-mood' })],
      errors: [],
    })
  })

  it('invalidates a commit with a disallowed type', () => {
    const result = validateCommitMessage('wip: add login', ruleset)
    expect(result).toEqual(
      expect.objectContaining({
        valid: false,
        errors: [expect.objectContaining({ ruleName: 'type-enum' })],
      })
    )
  })

  it('invalidates an empty subject', () => {
    const result = validateCommitMessage('feat: ', ruleset)
    expect(result).toEqual(
      expect.objectContaining({
        valid: false,
        errors: [expect.objectContaining({ ruleName: 'subject-empty' })],
      })
    )
  })

  it('parses and validates messages with body and footers', () => {
    const message = 'feat(auth): add login\n\nDetail body.\n\nRefs: #1'
    expect(validateCommitMessage(message, ruleset)).toEqual({ valid: true, warnings: [], errors: [] })
  })
})
