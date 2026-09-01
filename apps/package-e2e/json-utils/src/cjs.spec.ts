/**
 * CJS (CommonJS) E2E tests for `@hyperfrontend/json-utils`
 * Tests that the package is requireable and exports work correctly.
 */

'use strict'

const { describe, it, expect } = require('@hyperfrontend/testing')

describe('@hyperfrontend/json-utils CJS', () => {
  it('is requireable', () => {
    const jsonUtils = require('@hyperfrontend/json-utils')
    expect(jsonUtils).toBeDefined()
  })

  it('exports validate function', () => {
    const { validate } = require('@hyperfrontend/json-utils')
    expect(typeof validate).toBe('function')
  })

  it('validates data against a schema', () => {
    const { validate } = require('@hyperfrontend/json-utils')

    const schema = {
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

  it('exports createValidator function', () => {
    const { createValidator } = require('@hyperfrontend/json-utils')
    expect(typeof createValidator).toBe('function')
  })

  it('creates a reusable validator', () => {
    const { createValidator } = require('@hyperfrontend/json-utils')

    const schema = {
      type: 'string',
    }

    const validator = createValidator(schema)
    expect(typeof validator).toBe('function')

    const result = validator('hello')
    expect(result.valid).toBe(true)
  })

  it('exports toJsonSchema function', () => {
    const { toJsonSchema } = require('@hyperfrontend/json-utils')
    expect(typeof toJsonSchema).toBe('function')
  })

  it('generates JSON schema from data', () => {
    const { toJsonSchema } = require('@hyperfrontend/json-utils')

    const data = { name: 'John', age: 30 }
    const schema = toJsonSchema(data)

    expect(schema).toBeDefined()
    expect(schema.type).toBe('object')
    expect(schema.properties).toBeDefined()
  })
})
