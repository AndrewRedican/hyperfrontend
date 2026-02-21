import type { Schema } from '../../types'
import type { ValidationContext } from '../context'
import { validateArrayBounds } from './array-bounds'

describe('validateArrayBounds', () => {
  const ctx = <ValidationContext>{ errors: [] }

  it('passes when no constraints', () => {
    expect(validateArrayBounds([1, 2, 3], {}, ctx)).toBe(true)
  })

  it('fails when below minItems', () => {
    const schema: Schema = { minItems: 3 }
    expect(validateArrayBounds([1, 2], schema, ctx)).toBe(false)
  })

  it('fails when above maxItems', () => {
    const schema: Schema = { maxItems: 2 }
    expect(validateArrayBounds([1, 2, 3], schema, ctx)).toBe(false)
  })

  it('passes uniqueItems true for unique', () => {
    const schema: Schema = { uniqueItems: true }
    expect(validateArrayBounds([1, 2, 3], schema, ctx)).toBe(true)
  })

  it('fails uniqueItems true for duplicates', () => {
    const schema: Schema = { uniqueItems: true }
    expect(validateArrayBounds([1, 2, 2], schema, ctx)).toBe(false)
  })

  it('handles deep equality for uniqueItems', () => {
    const schema: Schema = { uniqueItems: true }
    expect(validateArrayBounds([[1], [1]], schema, ctx)).toBe(false)
    expect(validateArrayBounds([[1], [2]], schema, ctx)).toBe(true)
  })
})
