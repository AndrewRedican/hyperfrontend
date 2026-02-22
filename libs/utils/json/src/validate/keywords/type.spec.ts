import type { Schema } from '../../types'
import type { ValidationContext } from '../context'
import { validateType } from './type'

describe('validateType', () => {
  const ctx = <ValidationContext>{ errors: [] }

  it('returns true if no type', () => {
    expect(validateType('abc', {}, ctx)).toBe(true)
  })

  it('passes for correct type', () => {
    const schema: Schema = { type: 'string' }
    expect(validateType('abc', schema, ctx)).toBe(true)
  })

  it('fails for incorrect type', () => {
    const schema: Schema = { type: 'number' }
    expect(validateType('abc', schema, ctx)).toBe(false)
  })

  it('passes for type array', () => {
    const schema: Schema = { type: ['string', 'number'] }
    expect(validateType('abc', schema, ctx)).toBe(true)
    expect(validateType(123, schema, ctx)).toBe(true)
    expect(validateType(true, schema, ctx)).toBe(false)
  })

  it('passes integer for number', () => {
    const schema: Schema = { type: 'number' }
    expect(validateType(5, schema, ctx)).toBe(true)
    expect(validateType(5.5, schema, ctx)).toBe(true)
  })
})
