import type { Schema } from '../../types'
import type { ValidationContext } from '../context'
import { validateStringBounds } from './string-bounds'

describe('validateStringBounds', () => {
  const ctx = <ValidationContext>{ errors: [] }

  it('returns true if no constraints', () => {
    expect(validateStringBounds('abc', {}, ctx)).toBe(true)
  })

  it('fails below minLength', () => {
    const schema: Schema = { minLength: 3 }
    expect(validateStringBounds('ab', schema, ctx)).toBe(false)
  })

  it('fails above maxLength', () => {
    const schema: Schema = { maxLength: 2 }
    expect(validateStringBounds('abc', schema, ctx)).toBe(false)
  })

  it('fails pattern mismatch', () => {
    const schema: Schema = { pattern: '^a' }
    expect(validateStringBounds('bc', schema, ctx)).toBe(false)
  })

  it('passes pattern match', () => {
    const schema: Schema = { pattern: '^a' }
    expect(validateStringBounds('abc', schema, ctx)).toBe(true)
  })

  it('handles invalid regex pattern gracefully', () => {
    const schema: Schema = { pattern: '[' }
    expect(validateStringBounds('abc', schema, ctx)).toBe(true)
  })
})
