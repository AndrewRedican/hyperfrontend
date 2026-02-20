import type { Schema } from '../../types'
import type { ValidationContext } from '../context'
import { validatePatternProperties } from './pattern-properties'

describe('validatePatternProperties', () => {
  const ctx = <ValidationContext>(<unknown>{ errors: [], validate: () => true })

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
})
