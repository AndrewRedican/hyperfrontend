import { validateObjectBounds } from './object-bounds'
import type { Schema } from '../../types'
import type { ValidationContext } from '../context'

describe('validateObjectBounds', () => {
  const ctx = <ValidationContext>{ errors: [] }

  it('returns true if no constraints', () => {
    expect(validateObjectBounds({}, {}, ctx)).toBe(true)
  })

  it('fails below minProperties', () => {
    const schema: Schema = { minProperties: 2 }
    expect(validateObjectBounds({ a: 1 }, schema, ctx)).toBe(false)
  })

  it('fails above maxProperties', () => {
    const schema: Schema = { maxProperties: 1 }
    expect(validateObjectBounds({ a: 1, b: 2 }, schema, ctx)).toBe(false)
  })

  it('passes within bounds', () => {
    const schema: Schema = { minProperties: 1, maxProperties: 2 }
    expect(validateObjectBounds({ a: 1 }, schema, ctx)).toBe(true)
    expect(validateObjectBounds({ a: 1, b: 2 }, schema, ctx)).toBe(true)
  })
})
