import type { Schema } from '../../types/schema'
import type { ValidationContext } from '../context'
import { describe, expect, it } from '@hyperfrontend/testing'
import { validateAllOf } from './composition'

describe('validateAllOf', () => {
  const ctx = { errors: [], validate: (v, s) => v === s } as unknown as ValidationContext

  it('returns true if no allOf', () => {
    expect(validateAllOf(1, {}, ctx)).toBe(true)
    expect(validateAllOf(1, { allOf: [] }, ctx)).toBe(true)
  })

  it('returns true if all schemas match', () => {
    const schema: Schema = { allOf: [1, 1] as Schema[] }
    expect(validateAllOf(1, schema, ctx)).toBe(true)
  })

  it('returns false if any schema fails', () => {
    const schema: Schema = { allOf: [1, 2] as Schema[] }
    expect(validateAllOf(1, schema, ctx)).toBe(false)
  })
})
