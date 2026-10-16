import type { Schema } from '../../types/schema'
import type { ValidationContext } from '../context'
import { describe, expect, it } from '@hyperfrontend/testing'
import { validateItems } from './items'

describe('validateItems', () => {
  const ctx = { errors: [], validate: () => true } as unknown as ValidationContext

  it('returns true if no items', () => {
    expect(validateItems([1, 2], {}, ctx)).toBe(true)
  })

  it('passes when every item matches the single items schema', () => {
    // @ts-expect-error readonly context
    ctx.validate = (v: unknown) => typeof v === 'number'
    const schema: Schema = { items: { type: 'number' } }
    expect(validateItems([1, 2], schema, ctx)).toBe(true)
  })

  it('fails when an item violates the single items schema', () => {
    // @ts-expect-error readonly context
    ctx.validate = (v: unknown) => typeof v === 'number'
    const schema: Schema = { items: { type: 'number' } }
    expect(validateItems([1, 'a'], schema, ctx)).toBe(false)
  })

  it('passes when items match their tuple schemas by position', () => {
    // @ts-expect-error readonly context
    ctx.validate = (v: unknown, s: Schema) => typeof v === s.type
    const schema: Schema = { items: [{ type: 'number' }, { type: 'string' }] }
    expect(validateItems([1, 'a'], schema, ctx)).toBe(true)
  })

  it('fails when an item violates its tuple schema', () => {
    // @ts-expect-error readonly context
    ctx.validate = (v: unknown, s: Schema) => typeof v === s.type
    const schema: Schema = { items: [{ type: 'number' }, { type: 'string' }] }
    expect(validateItems([1, 2], schema, ctx)).toBe(false)
  })

  it('validates additionalItems as false', () => {
    const schema: Schema = { items: [{ type: 'number' }], additionalItems: false }
    expect(validateItems([1, 2], schema, ctx)).toBe(false)
  })

  it('passes when the additional item matches the additionalItems schema', () => {
    // @ts-expect-error readonly context
    ctx.validate = (v: unknown, s: Schema) => typeof v === s.type
    const schema: Schema = { items: [{ type: 'number' }], additionalItems: { type: 'string' } }
    expect(validateItems([1, 'a'], schema, ctx)).toBe(true)
  })

  it('fails when the additional item violates the additionalItems schema', () => {
    // @ts-expect-error readonly context
    ctx.validate = (v: unknown, s: Schema) => typeof v === s.type
    const schema: Schema = { items: [{ type: 'number' }], additionalItems: { type: 'string' } }
    expect(validateItems([1, 2], schema, ctx)).toBe(false)
  })

  it('passes when every one of multiple additional items matches the additionalItems schema', () => {
    // @ts-expect-error readonly context
    ctx.validate = (v: unknown, s: Schema) => typeof v === s.type
    const schema: Schema = { items: [{ type: 'number' }], additionalItems: { type: 'string' } }
    expect(validateItems([1, 'a', 'b', 'c'], schema, ctx)).toBe(true)
  })

  it('fails when a later one of multiple additional items violates the additionalItems schema', () => {
    // @ts-expect-error readonly context
    ctx.validate = (v: unknown, s: Schema) => typeof v === s.type
    const schema: Schema = { items: [{ type: 'number' }], additionalItems: { type: 'string' } }
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
