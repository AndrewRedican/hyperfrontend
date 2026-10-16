import type { Schema } from '../../types/schema'
import type { ValidationContext } from '../context'
import { describe, expect, it } from '@hyperfrontend/testing'
import { validateType } from './type'

describe('validateType', () => {
  const ctx = { errors: [] } as ValidationContext

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

  it.each(['abc', 123])('passes for type array when %p has one of the listed types', (value: unknown) => {
    const schema: Schema = { type: ['string', 'number'] }
    expect(validateType(value, schema, ctx)).toBe(true)
  })

  it('fails for type array when the value has none of the listed types', () => {
    const schema: Schema = { type: ['string', 'number'] }
    expect(validateType(true, schema, ctx)).toBe(false)
  })

  it('passes integer for number', () => {
    const schema: Schema = { type: 'number' }
    expect(validateType(5, schema, ctx)).toBe(true)
  })

  it('passes a fractional value for number', () => {
    const schema: Schema = { type: 'number' }
    expect(validateType(5.5, schema, ctx)).toBe(true)
  })
})
