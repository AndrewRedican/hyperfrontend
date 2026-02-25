import type { Schema } from '../../types/schema'
import type { ValidationContext } from '../context'
import { validateDependencies } from './dependencies'

describe('validateDependencies', () => {
  const ctx = <ValidationContext>(<unknown>{ errors: [], validate: () => true })

  it('returns true if no dependencies', () => {
    expect(validateDependencies({}, {}, ctx)).toBe(true)
  })

  it('passes property dependencies when all required present', () => {
    const schema: Schema = { dependencies: { foo: ['bar'] } }
    expect(validateDependencies({ foo: 1, bar: 2 }, schema, ctx)).toBe(true)
  })

  it('fails property dependencies when missing required', () => {
    const schema: Schema = { dependencies: { foo: ['bar'] } }
    expect(validateDependencies({ foo: 1 }, schema, ctx)).toBe(false)
  })

  it('passes schema dependencies when valid', () => {
    const schema: Schema = { dependencies: { foo: { type: 'object' } } }
    // @ts-expect-error readonly context
    ctx.validate = () => true
    expect(validateDependencies({ foo: 1 }, schema, ctx)).toBe(true)
  })

  it('fails schema dependencies when invalid', () => {
    const schema: Schema = { dependencies: { foo: { type: 'object' } } }
    // @ts-expect-error readonly context
    ctx.validate = () => false
    expect(validateDependencies({ foo: 1 }, schema, ctx)).toBe(false)
  })
})
