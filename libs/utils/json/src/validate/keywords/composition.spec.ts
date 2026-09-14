import type { Schema } from '../../types/schema'
import type { PatternSafetyChecker } from '../../types/validation'
import type { ValidationContext } from '../context'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { describe, expect, it, jest } from '@hyperfrontend/testing'
import { createValidationContext } from '../context'
import { validateAllOf, validateAnyOf, validateNot, validateOneOf } from './composition'

describe('validateAllOf', () => {
  const ctx = { errors: [], validate: (v, s) => v === s } as unknown as ValidationContext

  it('returns true if no allOf', () => {
    expect(validateAllOf(1, {}, ctx)).toBe(true)
    expect(validateAllOf(1, { allOf: [] }, ctx)).toBe(true)
  })

  it('returns true if all schemas match', () => {
    const schema: Schema = { allOf: [1, 1] as Schema[] }
    expect(validateAllOf(1, schema, ctx)).toBe(true)
  })

  it('returns false if any schema fails', () => {
    const schema: Schema = { allOf: [1, 2] as Schema[] }
    expect(validateAllOf(1, schema, ctx)).toBe(false)
  })
})

describe('composition branch contexts', () => {
  const checker: PatternSafetyChecker = () => ({ safe: true })
  const branchSchema: Schema = { type: 'string', pattern: '^x$' }

  const createParent = (verdict: boolean) => {
    const validate = jest.fn().mockReturnValue(verdict)
    const parent = {
      ...createValidationContext({}, validate, true, true, checker),
      path: '/field',
      visitedRefs: createSet(['#']),
    }
    return { parent, validate }
  }

  const inheritedFrom = (parent: ValidationContext) =>
    expect.objectContaining({
      path: parent.path,
      strictPatterns: true,
      patternSafetyChecker: checker,
      visitedRefs: parent.visitedRefs,
      collectAllErrors: false,
    })

  it('anyOf validates each branch with the parent pattern guards and position', () => {
    const { parent, validate } = createParent(true)
    validateAnyOf('x', { anyOf: [branchSchema] }, parent)

    expect(validate).toHaveBeenCalledWith('x', branchSchema, inheritedFrom(parent))
  })

  it('oneOf validates each branch with the parent pattern guards and position', () => {
    const { parent, validate } = createParent(true)
    validateOneOf('x', { oneOf: [branchSchema] }, parent)

    expect(validate).toHaveBeenCalledWith('x', branchSchema, inheritedFrom(parent))
  })

  it('not validates its branch with the parent pattern guards and position', () => {
    const { parent, validate } = createParent(false)
    validateNot('x', { not: branchSchema }, parent)

    expect(validate).toHaveBeenCalledWith('x', branchSchema, inheritedFrom(parent))
  })

  it('keeps branch errors out of the parent error list', () => {
    const { parent, validate } = createParent(false)
    validate.mockImplementation((_instance: unknown, _schema: Schema, ctx: ValidationContext) => {
      ctx.errors.push({ message: 'branch failure', path: ctx.path })
      return false
    })
    validateAnyOf('x', { anyOf: [branchSchema] }, parent)

    expect(parent.errors).toEqual([expect.objectContaining({ code: 'anyOf' })])
  })
})
