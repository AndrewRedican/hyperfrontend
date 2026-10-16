import type { Schema } from '../../types/schema'
import type { ValidationContext } from '../context'
import { describe, expect, it } from '@hyperfrontend/testing'
import { validateArrayBounds } from './array-bounds'

describe('validateArrayBounds', () => {
  const ctx = { errors: [] } as ValidationContext

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

  it('fails uniqueItems true for deeply equal items', () => {
    const schema: Schema = { uniqueItems: true }
    expect(validateArrayBounds([[1], [1]], schema, ctx)).toBe(false)
  })

  it('passes uniqueItems true for deeply different items', () => {
    const schema: Schema = { uniqueItems: true }
    expect(validateArrayBounds([[1], [2]], schema, ctx)).toBe(true)
  })
})
