import type { Schema } from '../../types/schema'
import type { ValidationContext } from '../context'
import { describe, expect, it } from '@hyperfrontend/testing'
import { validateNumberBounds } from './number-bounds'

describe('validateNumberBounds', () => {
  const ctx = { errors: [] } as ValidationContext

  it('returns true if no constraints', () => {
    expect(validateNumberBounds(5, {}, ctx)).toBe(true)
  })

  it('fails below minimum', () => {
    const schema: Schema = { minimum: 3 }
    expect(validateNumberBounds(2, schema, ctx)).toBe(false)
  })

  it('fails above maximum', () => {
    const schema: Schema = { maximum: 3 }
    expect(validateNumberBounds(4, schema, ctx)).toBe(false)
  })

  it('respects exclusiveMinimum', () => {
    const schema: Schema = { minimum: 3, exclusiveMinimum: true }
    expect(validateNumberBounds(3, schema, ctx)).toBe(false)
    expect(validateNumberBounds(4, schema, ctx)).toBe(true)
  })

  it('respects exclusiveMaximum', () => {
    const schema: Schema = { maximum: 3, exclusiveMaximum: true }
    expect(validateNumberBounds(3, schema, ctx)).toBe(false)
    expect(validateNumberBounds(2, schema, ctx)).toBe(true)
  })

  it('validates multipleOf', () => {
    const schema: Schema = { multipleOf: 2 }
    expect(validateNumberBounds(4, schema, ctx)).toBe(true)
    expect(validateNumberBounds(5, schema, ctx)).toBe(false)
  })
})
