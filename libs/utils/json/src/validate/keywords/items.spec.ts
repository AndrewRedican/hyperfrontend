import type { Schema } from '../../types/schema'
import type { ValidationContext } from '../context'
import { validateItems } from './items'

describe('validateItems', () => {
  const ctx = { errors: [], validate: () => true } as unknown as ValidationContext

  it('returns true if no items', () => {
    expect(validateItems([1, 2], {}, ctx)).toBe(true)
  })

  it('validates all items against single schema', () => {
    // @ts-expect-error readonly context
    ctx.validate = (v: unknown) => typeof v === 'number'
    const schema: Schema = { items: { type: 'number' } }
    expect(validateItems([1, 2], schema, ctx)).toBe(true)
    expect(validateItems([1, 'a'], schema, ctx)).toBe(false)
  })

  it('validates tuple schemas', () => {
    // @ts-expect-error readonly context
    ctx.validate = (v: unknown, s: Schema) => typeof v === s.type
    const schema: Schema = { items: [{ type: 'number' }, { type: 'string' }] }
    expect(validateItems([1, 'a'], schema, ctx)).toBe(true)
    expect(validateItems([1, 2], schema, ctx)).toBe(false)
  })

  it('validates additionalItems as false', () => {
    const schema: Schema = { items: [{ type: 'number' }], additionalItems: false }
    expect(validateItems([1, 2], schema, ctx)).toBe(false)
  })

  it('validates additionalItems as schema', () => {
    // @ts-expect-error readonly context
    ctx.validate = (v: unknown, s: Schema) => typeof v === s.type
    const schema: Schema = { items: [{ type: 'number' }], additionalItems: { type: 'string' } }
    expect(validateItems([1, 'a'], schema, ctx)).toBe(true)
    expect(validateItems([1, 2], schema, ctx)).toBe(false)
  })

  it('validates multiple additional items against additionalItems schema', () => {
    // @ts-expect-error readonly context
    ctx.validate = (v: unknown, s: Schema) => typeof v === s.type
    const schema: Schema = { items: [{ type: 'number' }], additionalItems: { type: 'string' } }
    expect(validateItems([1, 'a', 'b', 'c'], schema, ctx)).toBe(true)
    expect(validateItems([1, 'a', 123], schema, ctx)).toBe(false)
  })

  it('allows additional items when additionalItems is true', () => {
    const schema: Schema = { items: [{ type: 'number' }], additionalItems: true }
    expect(validateItems([1, 'anything', 123, null], schema, ctx)).toBe(true)
  })

  it('allows additional items when additionalItems is undefined', () => {
    // @ts-expect-error readonly context
    ctx.validate = () => true
    const schema: Schema = { items: [{ type: 'number' }] }
    expect(validateItems([1, 'extra', 123], schema, ctx)).toBe(true)
  })
})
