import type { Schema } from '../../types/schema'
import type { ValidationContext } from '../context'
import { validatePatternProperties } from './pattern-properties'

describe('validatePatternProperties', () => {
  const ctx = <ValidationContext>(<unknown>{ errors: [], validate: () => true, strictPatterns: false, collectAllErrors: true })

  it('returns true if no patternProperties', () => {
    expect(validatePatternProperties({}, {}, ctx)).toBe(true)
  })

  it('validates matching pattern', () => {
    // @ts-expect-error readonly context
    ctx.validate = (v: unknown) => typeof v === 'number'
    const schema: Schema = { patternProperties: { '^a': { type: 'number' } } }
    expect(validatePatternProperties({ a1: 1, b: 'x' }, schema, ctx)).toBe(true)
    expect(validatePatternProperties({ a1: 'x' }, schema, ctx)).toBe(false)
  })

  it('handles invalid regex patterns gracefully', () => {
    const schema: Schema = { patternProperties: { '[invalid': { type: 'number' } } }
    expect(validatePatternProperties({ foo: 1 }, schema, ctx)).toBe(true)
  })

  describe('strictPatterns mode', () => {
    it('reports error for invalid regex when strictPatterns is true', () => {
      const strictCtx = <ValidationContext>(<unknown>{
        errors: [],
        validate: () => true,
        strictPatterns: true,
        collectAllErrors: true,
      })
      const schema: Schema = { patternProperties: { '[invalid': { type: 'number' } } }
      const result = validatePatternProperties({ foo: 1 }, schema, strictCtx)

      expect(result).toBe(false)
      expect(strictCtx.errors.length).toBe(1)
      expect(strictCtx.errors[0].code).toBe('patternProperties')
      expect(strictCtx.errors[0].message).toContain('Invalid regex pattern')
    })

    it('does not report error for invalid regex when strictPatterns is false', () => {
      const nonStrictCtx = <ValidationContext>(<unknown>{
        errors: [],
        validate: () => true,
        strictPatterns: false,
        collectAllErrors: true,
      })
      const schema: Schema = { patternProperties: { '[invalid': { type: 'number' } } }
      const result = validatePatternProperties({ foo: 1 }, schema, nonStrictCtx)

      expect(result).toBe(true)
      expect(nonStrictCtx.errors.length).toBe(0)
    })
  })
})
