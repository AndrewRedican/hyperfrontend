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

  it('validates data that satisfies a schema as valid', () => {
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

    const validResult = validate(validData, schema)
    expect(validResult.valid).toBe(true)
  })

  it('validates data missing a required property as invalid', () => {
    const { validate } = require('@hyperfrontend/json-utils')

    const schema = {
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

  it('exports createValidator function', () => {
    const { createValidator } = require('@hyperfrontend/json-utils')
    expect(typeof createValidator).toBe('function')
  })

  it('creates a reusable validator as a function', () => {
    const { createValidator } = require('@hyperfrontend/json-utils')

    const schema = {
      type: 'string',
    }

    const validator = createValidator(schema)
    expect(typeof validator).toBe('function')
  })

  it('creates a reusable validator that accepts data matching its schema', () => {
    const { createValidator } = require('@hyperfrontend/json-utils')

    const schema = {
      type: 'string',
    }

    const validator = createValidator(schema)

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

    expect(schema).toEqual(expect.objectContaining({ type: 'object', properties: expect.anything() }))
  })
})
