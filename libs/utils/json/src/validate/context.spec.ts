import type { SchemaValidator } from './context'
import type { Schema } from '../types'
import { createValidationContext, pushPath, addError, shouldContinue } from './context'

const mockValidator: SchemaValidator = () => true

describe('createValidationContext', () => {
  it('creates context with empty path', () => {
    const schema: Schema = { type: 'string' }
    const ctx = createValidationContext(schema, mockValidator)

    expect(ctx.path).toBe('')
  })

  it('creates context with empty errors array', () => {
    const schema: Schema = { type: 'string' }
    const ctx = createValidationContext(schema, mockValidator)

    expect(ctx.errors).toEqual([])
  })

  it('stores root schema reference', () => {
    const schema: Schema = { type: 'string' }
    const ctx = createValidationContext(schema, mockValidator)

    expect(ctx.rootSchema).toBe(schema)
  })

  it('pre-populates definitions from root schema', () => {
    const schema: Schema = {
      definitions: {
        address: { type: 'object' },
        name: { type: 'string' },
      },
    }
    const ctx = createValidationContext(schema, mockValidator)

    expect(ctx.definitions.has('#/definitions/address')).toBe(true)
    expect(ctx.definitions.has('#/definitions/name')).toBe(true)
  })

  it('defaults collectAllErrors to true', () => {
    const schema: Schema = { type: 'string' }
    const ctx = createValidationContext(schema, mockValidator)

    expect(ctx.collectAllErrors).toBe(true)
  })

  it('respects collectAllErrors parameter', () => {
    const schema: Schema = { type: 'string' }
    const ctx = createValidationContext(schema, mockValidator, false)

    expect(ctx.collectAllErrors).toBe(false)
  })

  it('stores the validator function', () => {
    const schema: Schema = { type: 'string' }
    const ctx = createValidationContext(schema, mockValidator)

    expect(ctx.validate).toBe(mockValidator)
  })
})

describe('pushPath', () => {
  it('appends string segment to path', () => {
    const schema: Schema = { type: 'object' }
    const ctx = createValidationContext(schema, mockValidator)
    const childCtx = pushPath(ctx, 'property')

    expect(childCtx.path).toBe('/property')
  })

  it('appends numeric index to path', () => {
    const schema: Schema = { type: 'array' }
    const ctx = createValidationContext(schema, mockValidator)
    const childCtx = pushPath(ctx, 0)

    expect(childCtx.path).toBe('/0')
  })

  it('builds nested paths correctly', () => {
    const schema: Schema = { type: 'object' }
    let ctx = createValidationContext(schema, mockValidator)
    ctx = pushPath(ctx, 'users')
    ctx = pushPath(ctx, 0)
    ctx = pushPath(ctx, 'name')

    expect(ctx.path).toBe('/users/0/name')
  })

  it('escapes tildes in segment names', () => {
    const schema: Schema = { type: 'object' }
    const ctx = createValidationContext(schema, mockValidator)
    const childCtx = pushPath(ctx, 'some~key')

    expect(childCtx.path).toBe('/some~0key')
  })

  it('escapes slashes in segment names', () => {
    const schema: Schema = { type: 'object' }
    const ctx = createValidationContext(schema, mockValidator)
    const childCtx = pushPath(ctx, 'a/b')

    expect(childCtx.path).toBe('/a~1b')
  })

  it('preserves shared references to rootSchema and definitions', () => {
    const schema: Schema = {
      definitions: { test: { type: 'string' } },
    }
    const ctx = createValidationContext(schema, mockValidator)
    const childCtx = pushPath(ctx, 'prop')

    expect(childCtx.rootSchema).toBe(ctx.rootSchema)
    expect(childCtx.definitions).toBe(ctx.definitions)
  })

  it('preserves the validator function', () => {
    const schema: Schema = { type: 'object' }
    const ctx = createValidationContext(schema, mockValidator)
    const childCtx = pushPath(ctx, 'prop')

    expect(childCtx.validate).toBe(mockValidator)
  })
})

describe('addError', () => {
  it('adds error with message to context', () => {
    const schema: Schema = { type: 'string' }
    const ctx = createValidationContext(schema, mockValidator)
    addError(ctx, 'Invalid value')

    expect(ctx.errors).toHaveLength(1)
    expect(ctx.errors[0].message).toBe('Invalid value')
  })

  it('adds error with current path', () => {
    const schema: Schema = { type: 'object' }
    let ctx = createValidationContext(schema, mockValidator)
    ctx = pushPath(ctx, 'field')
    addError(ctx, 'Error message')

    expect(ctx.errors[0].path).toBe('/field')
  })

  it('uses root path for empty path', () => {
    const schema: Schema = { type: 'string' }
    const ctx = createValidationContext(schema, mockValidator)
    addError(ctx, 'Error message')

    expect(ctx.errors[0].path).toBe('/')
  })

  it('includes instance value when provided', () => {
    const schema: Schema = { type: 'string' }
    const ctx = createValidationContext(schema, mockValidator)
    addError(ctx, 'Invalid', 123)

    expect(ctx.errors[0].instance).toBe(123)
  })

  it('includes error code when provided', () => {
    const schema: Schema = { type: 'string' }
    const ctx = createValidationContext(schema, mockValidator)
    addError(ctx, 'Invalid', undefined, 'type')

    expect(ctx.errors[0].code).toBe('type')
  })

  it('includes params when provided', () => {
    const schema: Schema = { type: 'string' }
    const ctx = createValidationContext(schema, mockValidator)
    addError(ctx, 'Invalid', undefined, 'minLength', { limit: 5 })

    expect(ctx.errors[0].params).toEqual({ limit: 5 })
  })
})

describe('shouldContinue', () => {
  it('returns true when collectAllErrors is true', () => {
    const schema: Schema = { type: 'string' }
    const ctx = createValidationContext(schema, mockValidator, true)
    addError(ctx, 'Error')

    expect(shouldContinue(ctx)).toBe(true)
  })

  it('returns true when collectAllErrors is false and no errors', () => {
    const schema: Schema = { type: 'string' }
    const ctx = createValidationContext(schema, mockValidator, false)

    expect(shouldContinue(ctx)).toBe(true)
  })

  it('returns false when collectAllErrors is false and has errors', () => {
    const schema: Schema = { type: 'string' }
    const ctx = createValidationContext(schema, mockValidator, false)
    addError(ctx, 'Error')

    expect(shouldContinue(ctx)).toBe(false)
  })
})
