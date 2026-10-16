import type { Schema } from '@hyperfrontend/json-utils'
import { describe, expect, it } from '@hyperfrontend/testing'
import { isValidSchema } from './is-valid-schema'

describe('isValidSchema', () => {
  let schema: Schema

  it('accepts string definition', () => {
    schema = { type: 'string', required: ['type'] }
    expect(isValidSchema(schema)).toBe(true)
  })

  it('accepts number definition', () => {
    schema = { type: 'number', required: ['type'] }
    expect(isValidSchema(schema)).toBe(true)
  })

  it('accepts boolean definition', () => {
    schema = { type: 'boolean', required: ['type'] }
    expect(isValidSchema(schema)).toBe(true)
  })

  it('accepts object definition', () => {
    schema = {
      type: 'object',
      properties: {
        type: {
          type: 'string',
        },
        required: {
          type: 'array',
          ...JSON.parse('{ "const": ["type"] }'),
        },
      },
      required: ['type', 'properties'],
    }
    expect(isValidSchema(schema)).toBe(true)
  })

  it('accepts array definition', () => {
    schema = {
      type: 'array',
      items: {
        type: 'string',
        required: ['type'],
      },
      required: ['type', 'items'],
    }
    expect(isValidSchema(schema)).toBe(true)
  })

  it.each([{}, { type: 'string' }, { required: ['type'] }, { type: 'object', required: ['type'] }, { type: 'array', required: ['type'] }])(
    'accepts the blank or incomplete definition %p',
    (definition) => {
      expect(isValidSchema(definition)).toBe(true)
    }
  )

  it.each([{ type: 5 }, { required: false }])('rejects the incorrect value type for a reserved schema property in %p', (definition) => {
    expect(isValidSchema(definition)).toBe(false)
  })

  it('ignores any non-compliant property that does not conform to schema', () => {
    expect(isValidSchema({ weird: 'unknown' })).toBe(true)
  })

  it('validates a schema with typed properties using jsonschema Validator', () => {
    schema = {
      type: 'object',
      properties: {
        validField: { type: 'string' },
      },
    }
    expect(isValidSchema(schema)).toBe(true)
  })

  it('rejects a schema naming a type that does not exist using jsonschema Validator', () => {
    expect(isValidSchema({ type: 'invalid-type-that-does-not-exist' })).toBe(false)
  })

  it('accepts complex nested schemas', () => {
    schema = {
      type: 'object',
      properties: {
        name: { type: 'string' },
        age: { type: 'number' },
        address: {
          type: 'object',
          properties: {
            street: { type: 'string' },
            city: { type: 'string' },
          },
        },
      },
    }
    expect(isValidSchema(schema)).toBe(true)
  })
})
