import type { Schema } from '../../types/schema'
import type { ValidationContext } from '../context'
import { describe, expect, it } from '@hyperfrontend/testing'
import { validateEnum } from './enum'

describe('validateEnum', () => {
  const ctx = { errors: [] } as ValidationContext

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

  it('returns true for an object deep-equal to an enum member', () => {
    const schema: Schema = { enum: [{ a: 1 }, { a: 2 }] }
    expect(validateEnum({ a: 1 }, schema, ctx)).toBe(true)
  })

  it('returns false for an object deep-equal to no enum member', () => {
    const schema: Schema = { enum: [{ a: 1 }, { a: 2 }] }
    expect(validateEnum({ a: 3 }, schema, ctx)).toBe(false)
  })

  it('returns true for an array deep-equal to an enum member', () => {
    const schema: Schema = {
      enum: [
        [1, 2],
        [3, 4],
      ],
    }
    expect(validateEnum([1, 2], schema, ctx)).toBe(true)
  })

  it('returns false for an array deep-equal to no enum member', () => {
    const schema: Schema = {
      enum: [
        [1, 2],
        [3, 4],
      ],
    }
    expect(validateEnum([1, 3], schema, ctx)).toBe(false)
  })

  it('returns true for null when the enum lists null', () => {
    const schema: Schema = { enum: [null, 'string', 123] }
    expect(validateEnum(null, schema, ctx)).toBe(true)
  })

  it('returns false for undefined when the enum lists null', () => {
    const schema: Schema = { enum: [null, 'string', 123] }
    expect(validateEnum(undefined, schema, ctx)).toBe(false)
  })

  it('returns true for a nested object deep-equal to an enum member', () => {
    const schema: Schema = { enum: [{ a: { b: 1 } }, { a: { b: 2 } }] }
    expect(validateEnum({ a: { b: 1 } }, schema, ctx)).toBe(true)
  })

  it('returns false for a nested object deep-equal to no enum member', () => {
    const schema: Schema = { enum: [{ a: { b: 1 } }, { a: { b: 2 } }] }
    expect(validateEnum({ a: { b: 3 } }, schema, ctx)).toBe(false)
  })

  it('returns true for a value deep-equal to an object member holding an array', () => {
    const schema: Schema = { enum: [{ arr: [1, 2] }, [1, { obj: true }]] }
    expect(validateEnum({ arr: [1, 2] }, schema, ctx)).toBe(true)
  })

  it('returns true for a value deep-equal to an array member holding an object', () => {
    const schema: Schema = { enum: [{ arr: [1, 2] }, [1, { obj: true }]] }
    expect(validateEnum([1, { obj: true }], schema, ctx)).toBe(true)
  })

  it('returns false for an array differing from an array member in a nested object value', () => {
    const schema: Schema = { enum: [{ arr: [1, 2] }, [1, { obj: true }]] }
    expect(validateEnum([1, { obj: false }], schema, ctx)).toBe(false)
  })
})
