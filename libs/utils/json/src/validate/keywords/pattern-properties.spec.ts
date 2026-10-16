import type { Schema } from '../../types/schema'
import type { ValidationContext } from '../context'
import { describe, expect, it } from '@hyperfrontend/testing'
import { validatePatternProperties } from './pattern-properties'

describe('validatePatternProperties', () => {
  const ctx = { errors: [], validate: () => true, strictPatterns: false, collectAllErrors: true } as unknown as ValidationContext

  it('returns true if no patternProperties', () => {
    expect(validatePatternProperties({}, {}, ctx)).toBe(true)
  })

  it('passes when properties matching a pattern satisfy its schema', () => {
    // @ts-expect-error readonly context
    ctx.validate = (v: unknown) => typeof v === 'number'
    const schema: Schema = { patternProperties: { '^a': { type: 'number' } } }
    expect(validatePatternProperties({ a1: 1, b: 'x' }, schema, ctx)).toBe(true)
  })

  it('fails when a property matching a pattern violates its schema', () => {
    // @ts-expect-error readonly context
    ctx.validate = (v: unknown) => typeof v === 'number'
    const schema: Schema = { patternProperties: { '^a': { type: 'number' } } }
    expect(validatePatternProperties({ a1: 'x' }, schema, ctx)).toBe(false)
  })

  it('handles invalid regex patterns gracefully', () => {
    const schema: Schema = { patternProperties: { '[invalid': { type: 'number' } } }
    expect(validatePatternProperties({ foo: 1 }, schema, ctx)).toBe(true)
  })

  describe('strictPatterns mode', () => {
    it('fails for invalid regex when strictPatterns is true', () => {
      const strictCtx = {
        errors: [],
        validate: () => true,
        strictPatterns: true,
        collectAllErrors: true,
      } as unknown as ValidationContext
      const schema: Schema = { patternProperties: { '[invalid': { type: 'number' } } }
      const result = validatePatternProperties({ foo: 1 }, schema, strictCtx)

      expect(result).toBe(false)
    })

    it('reports error for invalid regex when strictPatterns is true', () => {
      const strictCtx = {
        errors: [],
        validate: () => true,
        strictPatterns: true,
        collectAllErrors: true,
      } as unknown as ValidationContext
      const schema: Schema = { patternProperties: { '[invalid': { type: 'number' } } }
      validatePatternProperties({ foo: 1 }, schema, strictCtx)

      expect(strictCtx.errors).toEqual([
        expect.objectContaining({ code: 'patternProperties', message: expect.stringContaining('Invalid regex pattern') }),
      ])
    })

    it('passes for invalid regex when strictPatterns is false', () => {
      const nonStrictCtx = {
        errors: [],
        validate: () => true,
        strictPatterns: false,
        collectAllErrors: true,
      } as unknown as ValidationContext
      const schema: Schema = { patternProperties: { '[invalid': { type: 'number' } } }
      const result = validatePatternProperties({ foo: 1 }, schema, nonStrictCtx)

      expect(result).toBe(true)
    })

    it('does not report error for invalid regex when strictPatterns is false', () => {
      const nonStrictCtx = {
        errors: [],
        validate: () => true,
        strictPatterns: false,
        collectAllErrors: true,
      } as unknown as ValidationContext
      const schema: Schema = { patternProperties: { '[invalid': { type: 'number' } } }
      validatePatternProperties({ foo: 1 }, schema, nonStrictCtx)

      expect(nonStrictCtx.errors.length).toBe(0)
    })
  })
})
