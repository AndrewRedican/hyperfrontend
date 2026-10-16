import type { Schema, JsonType } from './schema'
import { describe, expect, it } from '@hyperfrontend/testing'

describe('Schema type', () => {
  it('allows all JsonType values', () => {
    const types: JsonType[] = ['string', 'number', 'integer', 'boolean', 'array', 'object', 'null']
    types.forEach((type) => {
      const schema: Schema = { type }
      expect(schema.type).toBe(type)
    })
  })

  it('accepts arrays of types', () => {
    const schema: Schema = { type: ['string', 'number'] }
    expect(Array.isArray(schema.type)).toBe(true)
  })

  it('accepts all documented properties', () => {
    const schema: Schema = {
      id: 'id',
      $schema: 'http://json-schema.org/draft-04/schema#',
      $ref: '#/definitions/foo',
      title: 'title',
      description: 'desc',
      default: 42,
      type: 'number',
      enum: [1, 2],
      minLength: 1,
      maxLength: 2,
      pattern: '^a',
      format: 'email',
      minimum: 0,
      maximum: 10,
      exclusiveMinimum: true,
      exclusiveMaximum: true,
      multipleOf: 2,
      properties: { foo: { type: 'string' } },
      required: ['foo'],
      additionalProperties: false,
      patternProperties: { '^f': { type: 'string' } },
      minProperties: 1,
      maxProperties: 2,
      dependencies: { foo: ['bar'], bar: { type: 'number' } },
      items: { type: 'string' },
      additionalItems: false,
      minItems: 1,
      maxItems: 2,
      uniqueItems: true,
      allOf: [{ type: 'string' }],
      anyOf: [{ type: 'number' }],
      oneOf: [{ type: 'boolean' }],
      not: { type: 'null' },
      definitions: { foo: { type: 'string' } },
    }
    expect(schema).toMatchObject({
      properties: { foo: { type: 'string' } },
      required: ['foo'],
      additionalProperties: false,
      patternProperties: { '^f': { type: 'string' } },
      minProperties: 1,
      maxProperties: 2,
      dependencies: { foo: expect.any(Array), bar: { type: 'number' } },
      items: { type: 'string' },
      additionalItems: false,
      minItems: 1,
      maxItems: 2,
      uniqueItems: true,
      allOf: [{ type: 'string' }],
      anyOf: [{ type: 'number' }],
      oneOf: [{ type: 'boolean' }],
      not: { type: 'null' },
      definitions: { foo: { type: 'string' } },
    })
  })
})
