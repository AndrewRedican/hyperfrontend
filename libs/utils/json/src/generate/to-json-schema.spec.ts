import { describe, expect, it } from '@hyperfrontend/testing'
import { validate } from '../validate/validate'
import { toJsonSchema } from './to-json-schema'

describe('toJsonSchema', () => {
  describe('primitive types', () => {
    it('generates schema for string', () => {
      expect(toJsonSchema('hello')).toEqual({ type: 'string' })
    })

    it('generates schema for integer', () => {
      expect(toJsonSchema(42)).toEqual({ type: 'integer' })
    })

    it('generates schema for number', () => {
      expect(toJsonSchema(3.14)).toEqual({ type: 'number' })
    })

    it('generates schema for boolean', () => {
      expect(toJsonSchema(true)).toEqual({ type: 'boolean' })
    })

    it('generates schema for null', () => {
      expect(toJsonSchema(null)).toEqual({ type: 'null' })
    })
  })

  describe('object type', () => {
    it('generates schema for empty object', () => {
      expect(toJsonSchema({})).toEqual({ type: 'object' })
    })

    it('generates schema for object with properties', () => {
      const data = { name: 'Alice', age: 30 }
      const schema = toJsonSchema(data)

      expect(schema).toEqual({
        type: 'object',
        properties: {
          name: { type: 'string' },
          age: { type: 'integer' },
        },
        required: ['name', 'age'],
      })
    })

    it('generates schema for nested objects', () => {
      const data = { user: { name: 'Alice' } }
      const schema = toJsonSchema(data)

      expect(schema).toEqual({
        type: 'object',
        properties: {
          user: {
            type: 'object',
            properties: {
              name: { type: 'string' },
            },
            required: ['name'],
          },
        },
        required: ['user'],
      })
    })

    it('respects includeRequired option', () => {
      const data = { name: 'Alice' }
      const schema = toJsonSchema(data, { includeRequired: false })

      expect(schema).toEqual({
        type: 'object',
        properties: {
          name: { type: 'string' },
        },
      })
    })

    it('respects additionalProperties: false option', () => {
      const data = { name: 'Alice' }
      const schema = toJsonSchema(data, { additionalProperties: false })

      expect(schema).toEqual({
        type: 'object',
        properties: {
          name: { type: 'string' },
        },
        required: ['name'],
        additionalProperties: false,
      })
    })
  })

  describe('array type', () => {
    it('generates schema for empty array', () => {
      expect(toJsonSchema([])).toEqual({ type: 'array' })
    })

    it('generates schema for array with uniform items', () => {
      const schema = toJsonSchema(['a', 'b', 'c'])

      expect(schema).toEqual({
        type: 'array',
        items: { type: 'string' },
      })
    })

    it('handles arrays with mode: all (default)', () => {
      const data = [{ name: 'Alice' }, { name: 'Bob' }]
      const schema = toJsonSchema(data, { arrays: { mode: 'all' } })

      expect(schema).toEqual({
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
          },
          required: ['name'],
        },
      })
    })

    it('handles arrays with mode: first', () => {
      const data = ['first', 123]
      const schema = toJsonSchema(data, { arrays: { mode: 'first' } })

      expect(schema).toEqual({
        type: 'array',
        items: { type: 'string' },
      })
    })

    it('handles arrays with mode: uniform when types are uniform', () => {
      const data = ['a', 'b', 'c']
      const schema = toJsonSchema(data, { arrays: { mode: 'uniform' } })

      expect(schema).toEqual({
        type: 'array',
        items: { type: 'string' },
      })
    })

    it('falls back to merged schema when uniform mode encounters mixed types', () => {
      const data = ['string', 123, true]
      const schema = toJsonSchema(data, { arrays: { mode: 'uniform' } })

      expect(schema.type).toBe('array')
      expect(schema.items).toBeDefined()
    })

    it('differs between first and uniform modes with mixed array', () => {
      const data = ['string', 123, true]

      const firstSchema = toJsonSchema(data, { arrays: { mode: 'first' } })
      const uniformSchema = toJsonSchema(data, { arrays: { mode: 'uniform' } })

      expect(firstSchema).toEqual({
        type: 'array',
        items: { type: 'string' },
      })

      expect(uniformSchema.items).toBeDefined()
    })

    it('handles mixed type arrays', () => {
      const data = ['hello', 123, true]
      const schema = toJsonSchema(data, { arrays: { mode: 'all' } })

      expect(schema.type).toBe('array')
      expect(schema.items).toBeDefined()
    })
  })

  describe('complex scenarios', () => {
    it('generates schema for array of objects with different shapes', () => {
      const data = [
        { name: 'Alice', age: 30 },
        { name: 'Bob', city: 'NYC' },
      ]
      const schema = toJsonSchema(data, { arrays: { mode: 'all' } })

      expect(schema.type).toBe('array')
    })

    it('generates schema that validates the original data', () => {
      const data = {
        users: [
          { name: 'Alice', active: true },
          { name: 'Bob', active: false },
        ],
        count: 2,
      }
      const schema = toJsonSchema(data)

      const result = validate(data, schema)
      expect(result.valid).toBe(true)
    })
  })
})
