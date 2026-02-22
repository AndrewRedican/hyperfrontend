import type { Schema } from '../../types'
import type { ValidationContext } from '../context'
import { validateStringBounds } from './string-bounds'

describe('validateStringBounds', () => {
  const ctx = <ValidationContext>{ errors: [], strictPatterns: false }

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

  describe('strictPatterns mode', () => {
    it('reports error for invalid regex pattern when strictPatterns is true', () => {
      const strictCtx = <ValidationContext>{
        errors: [],
        strictPatterns: true,
        collectAllErrors: true,
      }
      const schema: Schema = { pattern: '[' }
      const result = validateStringBounds('abc', schema, strictCtx)

      expect(result).toBe(false)
      expect(strictCtx.errors.length).toBe(1)
      expect(strictCtx.errors[0].code).toBe('pattern')
      expect(strictCtx.errors[0].message).toContain('Invalid regex pattern')
    })

    it('does not report error for invalid regex when strictPatterns is false', () => {
      const nonStrictCtx = <ValidationContext>{
        errors: [],
        strictPatterns: false,
        collectAllErrors: true,
      }
      const schema: Schema = { pattern: '[' }
      const result = validateStringBounds('abc', schema, nonStrictCtx)

      expect(result).toBe(true)
      expect(nonStrictCtx.errors.length).toBe(0)
    })
  })
})
