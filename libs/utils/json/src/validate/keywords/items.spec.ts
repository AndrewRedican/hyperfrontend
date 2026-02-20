import { validateItems } from './items'
import type { Schema } from '../../types'
import { ValidationContext } from '../context'

describe('validateItems', () => {
  const ctx = <ValidationContext>(<unknown>{ errors: [], validate: () => true })

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
})
