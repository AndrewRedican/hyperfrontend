import { validateEnum } from './enum'
import type { Schema } from '../../types'
import type { ValidationContext } from '../context'

describe('validateEnum', () => {
  const ctx = <ValidationContext>{ errors: [] }

  it('returns true if no enum', () => {
    expect(validateEnum(1, {}, ctx)).toBe(true)
  })

  it('returns true if value in enum', () => {
    const schema: Schema = { enum: [1, 2, 3] }
    expect(validateEnum(2, schema, ctx)).toBe(true)
  })

  it('returns false if value not in enum', () => {
    const schema: Schema = { enum: [1, 2, 3] }
    expect(validateEnum(4, schema, ctx)).toBe(false)
  })

  it('handles deep equality for objects', () => {
    const schema: Schema = { enum: [{ a: 1 }, { a: 2 }] }
    expect(validateEnum({ a: 1 }, schema, ctx)).toBe(true)
    expect(validateEnum({ a: 3 }, schema, ctx)).toBe(false)
  })
})
