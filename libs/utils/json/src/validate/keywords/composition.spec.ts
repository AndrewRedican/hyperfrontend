import type { Schema } from '../../types/schema'
import type { ValidationContext } from '../context'
import { validateAllOf } from './composition'

describe('validateAllOf', () => {
  const ctx = <ValidationContext>(<unknown>{ errors: [], validate: (v, s) => v === s })

  it('returns true if no allOf', () => {
    expect(validateAllOf(1, {}, ctx)).toBe(true)
    expect(validateAllOf(1, { allOf: [] }, ctx)).toBe(true)
  })

  it('returns true if all schemas match', () => {
    const schema: Schema = { allOf: <Schema[]>[1, 1] }
    expect(validateAllOf(1, schema, ctx)).toBe(true)
  })

  it('returns false if any schema fails', () => {
    const schema: Schema = { allOf: <Schema[]>[1, 2] }
    expect(validateAllOf(1, schema, ctx)).toBe(false)
  })
})
