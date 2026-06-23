/**
 * ESM (ES Modules) E2E tests for @hyperfrontend/json-utils
 * Tests that the package is importable and exports work correctly.
 */

import type { Schema } from '@hyperfrontend/json-utils'

describe('@hyperfrontend/json-utils ESM', () => {
  it('should be importable', async () => {
    const jsonUtils = await import('@hyperfrontend/json-utils')
    expect(jsonUtils).toBeDefined()
  })

  it('should export validate function', async () => {
    const { validate } = await import('@hyperfrontend/json-utils')
    expect(typeof validate).toBe('function')
  })

  it('should validate data against a schema', async () => {
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
    const invalidData = { age: 30 }

    const validResult = validate(validData, schema)
    expect(validResult.valid).toBe(true)

    const invalidResult = validate(invalidData, schema)
    expect(invalidResult.valid).toBe(false)
  })

  it('should export createValidator function', async () => {
    const { createValidator } = await import('@hyperfrontend/json-utils')
    expect(typeof createValidator).toBe('function')
  })

  it('should create a reusable validator', async () => {
    const { createValidator } = await import('@hyperfrontend/json-utils')

    const schema: Schema = {
      type: 'string',
    }

    const validator = createValidator(schema)
    expect(typeof validator).toBe('function')

    const result = validator('hello')
    expect(result.valid).toBe(true)
  })

  it('should export toJsonSchema function', async () => {
    const { toJsonSchema } = await import('@hyperfrontend/json-utils')
    expect(typeof toJsonSchema).toBe('function')
  })

  it('should generate JSON schema from data', async () => {
    const { toJsonSchema } = await import('@hyperfrontend/json-utils')

    const data = { name: 'John', age: 30 }
    const schema = toJsonSchema(data)

    expect(schema).toBeDefined()
    expect(schema.type).toBe('object')
    expect(schema.properties).toBeDefined()
  })
})
