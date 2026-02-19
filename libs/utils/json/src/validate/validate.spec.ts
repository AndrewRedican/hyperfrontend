import { validate } from './validate'
import type { Schema } from '../types'

describe('validate', () => {
  describe('type keyword', () => {
    it('validates string type', () => {
      const schema: Schema = { type: 'string' }
      expect(validate('hello', schema).valid).toBe(true)
      expect(validate(123, schema).valid).toBe(false)
      expect(validate(null, schema).valid).toBe(false)
    })

    it('validates number type', () => {
      const schema: Schema = { type: 'number' }
      expect(validate(123, schema).valid).toBe(true)
      expect(validate(1.5, schema).valid).toBe(true)
      expect(validate('123', schema).valid).toBe(false)
    })

    it('validates integer type', () => {
      const schema: Schema = { type: 'integer' }
      expect(validate(123, schema).valid).toBe(true)
      expect(validate(1.5, schema).valid).toBe(false)
      expect(validate('123', schema).valid).toBe(false)
    })

    it('validates boolean type', () => {
      const schema: Schema = { type: 'boolean' }
      expect(validate(true, schema).valid).toBe(true)
      expect(validate(false, schema).valid).toBe(true)
      expect(validate('true', schema).valid).toBe(false)
    })

    it('validates array type', () => {
      const schema: Schema = { type: 'array' }
      expect(validate([], schema).valid).toBe(true)
      expect(validate([1, 2, 3], schema).valid).toBe(true)
      expect(validate({}, schema).valid).toBe(false)
    })

    it('validates object type', () => {
      const schema: Schema = { type: 'object' }
      expect(validate({}, schema).valid).toBe(true)
      expect(validate({ a: 1 }, schema).valid).toBe(true)
      expect(validate([], schema).valid).toBe(false)
    })

    it('validates null type', () => {
      const schema: Schema = { type: 'null' }
      expect(validate(null, schema).valid).toBe(true)
      expect(validate(undefined, schema).valid).toBe(false)
      expect(validate('null', schema).valid).toBe(false)
    })

    it('validates union types', () => {
      const schema: Schema = { type: ['string', 'number'] }
      expect(validate('hello', schema).valid).toBe(true)
      expect(validate(123, schema).valid).toBe(true)
      expect(validate(true, schema).valid).toBe(false)
    })
  })

  describe('object keywords', () => {
    it('validates properties', () => {
      const schema: Schema = {
        type: 'object',
        properties: {
          name: { type: 'string' },
          age: { type: 'integer' },
        },
      }
      expect(validate({ name: 'Alice', age: 30 }, schema).valid).toBe(true)
      expect(validate({ name: 123, age: 30 }, schema).valid).toBe(false)
    })

    it('validates required properties', () => {
      const schema: Schema = {
        type: 'object',
        properties: {
          name: { type: 'string' },
        },
        required: ['name'],
      }
      expect(validate({ name: 'Alice' }, schema).valid).toBe(true)
      expect(validate({}, schema).valid).toBe(false)
    })

    it('validates additionalProperties: false', () => {
      const schema: Schema = {
        type: 'object',
        properties: {
          name: { type: 'string' },
        },
        additionalProperties: false,
      }
      expect(validate({ name: 'Alice' }, schema).valid).toBe(true)
      expect(validate({ name: 'Alice', extra: true }, schema).valid).toBe(false)
    })

    it('validates additionalProperties with schema', () => {
      const schema: Schema = {
        type: 'object',
        properties: {
          name: { type: 'string' },
        },
        additionalProperties: { type: 'number' },
      }
      expect(validate({ name: 'Alice', age: 30 }, schema).valid).toBe(true)
      expect(validate({ name: 'Alice', age: 'thirty' }, schema).valid).toBe(false)
    })

    it('validates minProperties and maxProperties', () => {
      const schema: Schema = { type: 'object', minProperties: 1, maxProperties: 2 }
      expect(validate({}, schema).valid).toBe(false)
      expect(validate({ a: 1 }, schema).valid).toBe(true)
      expect(validate({ a: 1, b: 2 }, schema).valid).toBe(true)
      expect(validate({ a: 1, b: 2, c: 3 }, schema).valid).toBe(false)
    })
  })

  describe('array keywords', () => {
    it('validates items with single schema', () => {
      const schema: Schema = {
        type: 'array',
        items: { type: 'string' },
      }
      expect(validate(['a', 'b', 'c'], schema).valid).toBe(true)
      expect(validate(['a', 1, 'c'], schema).valid).toBe(false)
    })

    it('validates tuple items', () => {
      const schema: Schema = {
        type: 'array',
        items: [{ type: 'string' }, { type: 'number' }],
      }
      expect(validate(['a', 1], schema).valid).toBe(true)
      expect(validate([1, 'a'], schema).valid).toBe(false)
    })

    it('validates minItems and maxItems', () => {
      const schema: Schema = { type: 'array', minItems: 1, maxItems: 3 }
      expect(validate([], schema).valid).toBe(false)
      expect(validate([1], schema).valid).toBe(true)
      expect(validate([1, 2, 3], schema).valid).toBe(true)
      expect(validate([1, 2, 3, 4], schema).valid).toBe(false)
    })

    it('validates uniqueItems', () => {
      const schema: Schema = { type: 'array', uniqueItems: true }
      expect(validate([1, 2, 3], schema).valid).toBe(true)
      expect(validate([1, 2, 1], schema).valid).toBe(false)
      expect(validate([{ a: 1 }, { a: 2 }], schema).valid).toBe(true)
      expect(validate([{ a: 1 }, { a: 1 }], schema).valid).toBe(false)
    })
  })

  describe('string keywords', () => {
    it('validates minLength and maxLength', () => {
      const schema: Schema = { type: 'string', minLength: 2, maxLength: 5 }
      expect(validate('a', schema).valid).toBe(false)
      expect(validate('ab', schema).valid).toBe(true)
      expect(validate('abcde', schema).valid).toBe(true)
      expect(validate('abcdef', schema).valid).toBe(false)
    })

    it('validates pattern', () => {
      const schema: Schema = { type: 'string', pattern: '^[a-z]+$' }
      expect(validate('hello', schema).valid).toBe(true)
      expect(validate('Hello', schema).valid).toBe(false)
      expect(validate('hello123', schema).valid).toBe(false)
    })
  })

  describe('number keywords', () => {
    it('validates minimum and maximum', () => {
      const schema: Schema = { type: 'number', minimum: 0, maximum: 100 }
      expect(validate(-1, schema).valid).toBe(false)
      expect(validate(0, schema).valid).toBe(true)
      expect(validate(50, schema).valid).toBe(true)
      expect(validate(100, schema).valid).toBe(true)
      expect(validate(101, schema).valid).toBe(false)
    })

    it('validates exclusive minimum and maximum', () => {
      const schema: Schema = { type: 'number', minimum: 0, exclusiveMinimum: true, maximum: 100, exclusiveMaximum: true }
      expect(validate(0, schema).valid).toBe(false)
      expect(validate(0.1, schema).valid).toBe(true)
      expect(validate(99.9, schema).valid).toBe(true)
      expect(validate(100, schema).valid).toBe(false)
    })

    it('validates multipleOf', () => {
      const schema: Schema = { type: 'number', multipleOf: 5 }
      expect(validate(10, schema).valid).toBe(true)
      expect(validate(15, schema).valid).toBe(true)
      expect(validate(12, schema).valid).toBe(false)
    })
  })

  describe('enum keyword', () => {
    it('validates enum values', () => {
      const schema: Schema = { enum: ['red', 'green', 'blue'] }
      expect(validate('red', schema).valid).toBe(true)
      expect(validate('green', schema).valid).toBe(true)
      expect(validate('yellow', schema).valid).toBe(false)
    })

    it('validates enum with mixed types', () => {
      const schema: Schema = { enum: [1, 'one', null] }
      expect(validate(1, schema).valid).toBe(true)
      expect(validate('one', schema).valid).toBe(true)
      expect(validate(null, schema).valid).toBe(true)
      expect(validate(2, schema).valid).toBe(false)
    })
  })

  describe('composition keywords', () => {
    it('validates allOf', () => {
      const schema: Schema = {
        allOf: [
          { type: 'object', properties: { a: { type: 'string' } }, required: ['a'] },
          { type: 'object', properties: { b: { type: 'number' } }, required: ['b'] },
        ],
      }
      expect(validate({ a: 'hello', b: 123 }, schema).valid).toBe(true)
      expect(validate({ a: 'hello' }, schema).valid).toBe(false)
      expect(validate({ b: 123 }, schema).valid).toBe(false)
    })

    it('validates anyOf', () => {
      const schema: Schema = {
        anyOf: [{ type: 'string' }, { type: 'number' }],
      }
      expect(validate('hello', schema).valid).toBe(true)
      expect(validate(123, schema).valid).toBe(true)
      expect(validate(true, schema).valid).toBe(false)
    })

    it('validates oneOf', () => {
      const schema: Schema = {
        oneOf: [
          { type: 'number', multipleOf: 3 },
          { type: 'number', multipleOf: 5 },
        ],
      }
      expect(validate(9, schema).valid).toBe(true) // Multiple of 3 only
      expect(validate(10, schema).valid).toBe(true) // Multiple of 5 only
      expect(validate(15, schema).valid).toBe(false) // Multiple of both
      expect(validate(7, schema).valid).toBe(false) // Neither
    })

    it('validates not', () => {
      const schema: Schema = { not: { type: 'string' } }
      expect(validate(123, schema).valid).toBe(true)
      expect(validate('hello', schema).valid).toBe(false)
    })
  })

  describe('$ref keyword', () => {
    it('resolves $ref to definitions', () => {
      const schema: Schema = {
        definitions: {
          address: {
            type: 'object',
            properties: { city: { type: 'string' } },
            required: ['city'],
          },
        },
        type: 'object',
        properties: {
          home: { $ref: '#/definitions/address' },
        },
      }
      expect(validate({ home: { city: 'London' } }, schema).valid).toBe(true)
      expect(validate({ home: {} }, schema).valid).toBe(false)
    })

    it('resolves $ref to root', () => {
      const schema: Schema = {
        type: 'object',
        properties: {
          child: { $ref: '#' },
        },
      }
      expect(validate({ child: { child: {} } }, schema).valid).toBe(true)
    })
  })

  describe('format keyword', () => {
    it('validates email format', () => {
      const schema: Schema = { type: 'string', format: 'email' }
      expect(validate('test@example.com', schema).valid).toBe(true)
      expect(validate('invalid', schema).valid).toBe(false)
    })

    it('validates uri format', () => {
      const schema: Schema = { type: 'string', format: 'uri' }
      expect(validate('https://example.com', schema).valid).toBe(true)
      expect(validate('not a uri', schema).valid).toBe(false)
    })

    it('validates date-time format', () => {
      const schema: Schema = { type: 'string', format: 'date-time' }
      expect(validate('2024-01-15T10:30:00Z', schema).valid).toBe(true)
      expect(validate('not a date', schema).valid).toBe(false)
    })

    it('allows unknown formats', () => {
      const schema: Schema = { type: 'string', format: 'custom-format' }
      expect(validate('anything', schema).valid).toBe(true)
    })
  })

  describe('error collection', () => {
    it('collects all errors by default', () => {
      const schema: Schema = {
        type: 'object',
        properties: {
          a: { type: 'string' },
          b: { type: 'string' },
        },
      }
      const result = validate({ a: 1, b: 2 }, schema)
      expect(result.valid).toBe(false)
      expect(result.errors.length).toBe(2)
    })

    it('stops at first error when collectAllErrors is false', () => {
      const schema: Schema = {
        type: 'object',
        properties: {
          a: { type: 'string' },
          b: { type: 'string' },
        },
      }
      const result = validate({ a: 1, b: 2 }, schema, { collectAllErrors: false })
      expect(result.valid).toBe(false)
      expect(result.errors.length).toBe(1)
    })
  })
})
