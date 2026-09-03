import { describe, expect, it } from '@hyperfrontend/testing'
import { validateCommitMessage } from '../validate-message'
import { CONVENTIONAL_TYPES, conventionalPreset } from './conventional'

describe('conventionalPreset', () => {
  it('accepts a well-formed conventional commit', () => {
    expect(validateCommitMessage('feat: add login', conventionalPreset)).toEqual({
      valid: true,
      warnings: [],
      errors: [],
    })
  })

  it('warns on past-tense subjects', () => {
    const result = validateCommitMessage('feat: added login', conventionalPreset)
    expect(result).toEqual(
      expect.objectContaining({
        valid: true,
        warnings: [expect.objectContaining({ ruleName: 'imperative-mood' })],
      })
    )
  })

  it('warns when the header exceeds 72 characters', () => {
    const longSubject = 'a'.repeat(100)
    const result = validateCommitMessage(`feat: ${longSubject}`, conventionalPreset)
    expect(result).toEqual(
      expect.objectContaining({
        valid: true,
        warnings: [expect.objectContaining({ ruleName: 'header-max-length' })],
      })
    )
  })

  it('errors on an unknown type', () => {
    const result = validateCommitMessage('wip: draft', conventionalPreset)
    expect(result).toEqual(
      expect.objectContaining({
        valid: false,
        errors: [expect.objectContaining({ ruleName: 'type-enum' })],
      })
    )
  })

  it('errors on an empty subject', () => {
    const result = validateCommitMessage('feat: ', conventionalPreset)
    expect(result).toEqual(
      expect.objectContaining({
        valid: false,
        errors: [expect.objectContaining({ ruleName: 'subject-empty' })],
      })
    )
  })

  it('exposes the conventional type list', () => {
    expect(CONVENTIONAL_TYPES).toEqual(
      expect.arrayContaining(['feat', 'fix', 'docs', 'style', 'refactor', 'perf', 'test', 'build', 'ci', 'chore', 'revert'])
    )
  })
})
