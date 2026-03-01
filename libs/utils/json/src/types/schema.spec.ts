import type { Schema, JsonType } from './schema'

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
    expect(schema).toBeTruthy()
    expect(schema.properties?.foo?.type).toBe('string')
    expect(schema.required?.[0]).toBe('foo')
    expect(schema.additionalProperties).toBe(false)
    expect(schema.patternProperties?.['^f']?.type).toBe('string')
    expect(schema.minProperties).toBe(1)
    expect(schema.maxProperties).toBe(2)
    expect(Array.isArray(schema.dependencies?.foo)).toBe(true)
    expect((<Schema>schema.dependencies?.bar).type).toBe('number')
    expect((<Schema>schema.items).type).toBe('string')
    expect(schema.additionalItems).toBe(false)
    expect(schema.minItems).toBe(1)
    expect(schema.maxItems).toBe(2)
    expect(schema.uniqueItems).toBe(true)
    expect(schema.allOf?.[0].type).toBe('string')
    expect(schema.anyOf?.[0].type).toBe('number')
    expect(schema.oneOf?.[0].type).toBe('boolean')
    expect(schema.not?.type).toBe('null')
    expect(schema.definitions?.foo.type).toBe('string')
  })
})
