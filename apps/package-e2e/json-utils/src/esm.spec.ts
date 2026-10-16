/**
 * ESM (ES Modules) E2E tests for `@hyperfrontend/json-utils`
 * Tests that the package is importable and exports work correctly.
 */

import { describe, it, expect } from '@hyperfrontend/testing'

import type { Schema } from '@hyperfrontend/json-utils'

describe('@hyperfrontend/json-utils ESM', () => {
  it('is importable', async () => {
    const jsonUtils = await import('@hyperfrontend/json-utils')
    expect(jsonUtils).toBeDefined()
  })

  it('exports validate function', async () => {
    const { validate } = await import('@hyperfrontend/json-utils')
    expect(typeof validate).toBe('function')
  })

  it('validates data that satisfies a schema as valid', async () => {
    const { validate } = await import('@hyperfrontend/json-utils')

    const schema: Schema = {
      type: 'object',
      properties: {
        name: { type: 'string' },
        age: { type: 'number' },
      },
      required: ['name'],
    }

    const validData = { name: 'John', age: 30 }

    const validResult = validate(validData, schema)
    expect(validResult.valid).toBe(true)
  })

  it('validates data missing a required property as invalid', async () => {
    const { validate } = await import('@hyperfrontend/json-utils')

    const schema: Schema = {
      type: 'object',
      properties: {
        name: { type: 'string' },
        age: { type: 'number' },
      },
      required: ['name'],
    }

    const invalidData = { age: 30 }

    const invalidResult = validate(invalidData, schema)
    expect(invalidResult.valid).toBe(false)
  })

  it('exports createValidator function', async () => {
    const { createValidator } = await import('@hyperfrontend/json-utils')
    expect(typeof createValidator).toBe('function')
  })

  it('creates a reusable validator as a function', async () => {
    const { createValidator } = await import('@hyperfrontend/json-utils')

    const schema: Schema = {
      type: 'string',
    }

    const validator = createValidator(schema)
    expect(typeof validator).toBe('function')
  })

  it('creates a reusable validator that accepts data matching its schema', async () => {
    const { createValidator } = await import('@hyperfrontend/json-utils')

    const schema: Schema = {
      type: 'string',
    }

    const validator = createValidator(schema)

    const result = validator('hello')
    expect(result.valid).toBe(true)
  })

  it('exports toJsonSchema function', async () => {
    const { toJsonSchema } = await import('@hyperfrontend/json-utils')
    expect(typeof toJsonSchema).toBe('function')
  })

  it('generates JSON schema from data', async () => {
    const { toJsonSchema } = await import('@hyperfrontend/json-utils')

    const data = { name: 'John', age: 30 }
    const schema = toJsonSchema(data)

    expect(schema).toEqual(expect.objectContaining({ type: 'object', properties: expect.anything() }))
  })
})
