/**
 * CJS (CommonJS) E2E tests for @hyperfrontend/json-utils
 * Tests that the package is requireable and exports work correctly.
 */

describe('@hyperfrontend/json-utils CJS', () => {
  it('should be requireable', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const jsonUtils = require('@hyperfrontend/json-utils')
    expect(jsonUtils).toBeDefined()
  })

  it('should export validate function', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { validate } = require('@hyperfrontend/json-utils')
    expect(typeof validate).toBe('function')
  })

  it('should validate data against a schema', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
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

  it('should export createValidator function', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { createValidator } = require('@hyperfrontend/json-utils')
    expect(typeof createValidator).toBe('function')
  })

  it('should create a reusable validator', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { createValidator } = require('@hyperfrontend/json-utils')

    const schema = {
      type: 'string',
    }

    const validator = createValidator(schema)
    expect(typeof validator).toBe('function')

    const result = validator('hello')
    expect(result.valid).toBe(true)
  })

  it('should export toJsonSchema function', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { toJsonSchema } = require('@hyperfrontend/json-utils')
    expect(typeof toJsonSchema).toBe('function')
  })

  it('should generate JSON schema from data', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { toJsonSchema } = require('@hyperfrontend/json-utils')

    const data = { name: 'John', age: 30 }
    const schema = toJsonSchema(data)

    expect(schema).toBeDefined()
    expect(schema.type).toBe('object')
    expect(schema.properties).toBeDefined()
  })
})
