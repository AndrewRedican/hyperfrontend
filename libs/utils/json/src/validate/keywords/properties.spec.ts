import type { Schema } from '../../types'
import type { ValidationContext } from '../context'
import { validateProperties, validateRequired, validateAdditionalProperties } from './properties'

describe('validateProperties', () => {
  const ctx = <ValidationContext>(<unknown>{ errors: [], validate: () => true })

  it('returns true if no properties', () => {
    expect(validateProperties({}, {}, ctx)).toBe(true)
  })

  it('validates defined properties', () => {
    // @ts-expect-error readonly context
    ctx.validate = (v: unknown, s: Schema) => typeof v === s.type
    const schema: Schema = { properties: { foo: { type: 'number' } } }
    expect(validateProperties({ foo: 1 }, schema, ctx)).toBe(true)
    expect(validateProperties({ foo: 'a' }, schema, ctx)).toBe(false)
  })
})

describe('validateRequired', () => {
  const ctx = <ValidationContext>(<unknown>{ errors: [], shouldContinue: () => true })

  it('returns true if no required', () => {
    expect(validateRequired({}, {}, ctx)).toBe(true)
  })

  it('fails if missing required property', () => {
    const schema: Schema = { required: ['foo'] }
    expect(validateRequired({}, schema, ctx)).toBe(false)
  })

  it('passes if all required present', () => {
    const schema: Schema = { required: ['foo'] }
    expect(validateRequired({ foo: 1 }, schema, ctx)).toBe(true)
  })
})

describe('validateAdditionalProperties', () => {
  const ctx = <ValidationContext>(<unknown>{ errors: [], validate: () => true })

  it('returns true if no additionalProperties', () => {
    expect(validateAdditionalProperties({ foo: 1 }, {}, ctx)).toBe(true)
  })

  it('fails if additional property not allowed', () => {
    const schema: Schema = { properties: { foo: { type: 'number' } }, additionalProperties: false }
    expect(validateAdditionalProperties({ foo: 1, bar: 2 }, schema, ctx)).toBe(false)
  })

  it('validates additional property with schema', () => {
    // @ts-expect-error readonly context
    ctx.validate = (v: unknown, s: Schema) => typeof v === s.type
    const schema: Schema = { properties: { foo: { type: 'number' } }, additionalProperties: { type: 'string' } }
    expect(validateAdditionalProperties({ foo: 1, bar: 'x' }, schema, ctx)).toBe(true)
    expect(validateAdditionalProperties({ foo: 1, bar: 2 }, schema, ctx)).toBe(false)
  })
})
