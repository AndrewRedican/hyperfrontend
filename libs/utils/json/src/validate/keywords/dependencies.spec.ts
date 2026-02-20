import { validateDependencies } from './dependencies'
import type { Schema } from '../../types'
import type { ValidationContext } from '../context'

type MockContext = { errors: unknown[]; validate: (v: unknown, s: Schema, ctx?: unknown) => boolean; shouldContinue?: () => boolean }

describe('validateDependencies', () => {
  const ctx: MockContext = { errors: [], validate: () => true }

  it('returns true if no dependencies', () => {
    expect(validateDependencies({}, {}, <ValidationContext>ctx)).toBe(true)
  })

  it('passes property dependencies when all required present', () => {
    const schema: Schema = { dependencies: { foo: ['bar'] } }
    expect(validateDependencies({ foo: 1, bar: 2 }, schema, <ValidationContext>ctx)).toBe(true)
  })

  it('fails property dependencies when missing required', () => {
    const schema: Schema = { dependencies: { foo: ['bar'] } }
    expect(validateDependencies({ foo: 1 }, schema, <ValidationContext>ctx)).toBe(false)
  })

  it('passes schema dependencies when valid', () => {
    const schema: Schema = { dependencies: { foo: { type: 'object' } } }
    ctx.validate = () => true
    expect(validateDependencies({ foo: 1 }, schema, <ValidationContext>ctx)).toBe(true)
  })

  it('fails schema dependencies when invalid', () => {
    const schema: Schema = { dependencies: { foo: { type: 'object' } } }
    ctx.validate = () => false
    expect(validateDependencies({ foo: 1 }, schema, <ValidationContext>ctx)).toBe(false)
  })
})
