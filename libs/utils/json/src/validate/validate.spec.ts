import type { Schema } from '../types/schema'
import { describe, expect, it } from '@hyperfrontend/testing'
import { validate } from './validate'

describe('validate', () => {
  describe('type keyword', () => {
    it('accepts a string for the string type', () => {
      const schema: Schema = { type: 'string' }
      expect(validate('hello', schema).valid).toBe(true)
    })

    it.each([123, null])('rejects %p for the string type', (data: unknown) => {
      const schema: Schema = { type: 'string' }
      expect(validate(data, schema).valid).toBe(false)
    })

    it.each([123, 1.5])('accepts %p for the number type', (data: number) => {
      const schema: Schema = { type: 'number' }
      expect(validate(data, schema).valid).toBe(true)
    })

    it('rejects a numeric string for the number type', () => {
      const schema: Schema = { type: 'number' }
      expect(validate('123', schema).valid).toBe(false)
    })

    it('accepts an integer for the integer type', () => {
      const schema: Schema = { type: 'integer' }
      expect(validate(123, schema).valid).toBe(true)
    })

    it.each([1.5, '123'])('rejects %p for the integer type', (data: unknown) => {
      const schema: Schema = { type: 'integer' }
      expect(validate(data, schema).valid).toBe(false)
    })

    it.each([true, false])('accepts %p for the boolean type', (data: boolean) => {
      const schema: Schema = { type: 'boolean' }
      expect(validate(data, schema).valid).toBe(true)
    })

    it('rejects a boolean-like string for the boolean type', () => {
      const schema: Schema = { type: 'boolean' }
      expect(validate('true', schema).valid).toBe(false)
    })

    it('accepts an empty array for the array type', () => {
      const schema: Schema = { type: 'array' }
      expect(validate([], schema).valid).toBe(true)
    })

    it('accepts a populated array for the array type', () => {
      const schema: Schema = { type: 'array' }
      expect(validate([1, 2, 3], schema).valid).toBe(true)
    })

    it('rejects an object for the array type', () => {
      const schema: Schema = { type: 'array' }
      expect(validate({}, schema).valid).toBe(false)
    })

    it.each([{}, { a: 1 }])('accepts %p for the object type', (data: object) => {
      const schema: Schema = { type: 'object' }
      expect(validate(data, schema).valid).toBe(true)
    })

    it('rejects an array for the object type', () => {
      const schema: Schema = { type: 'object' }
      expect(validate([], schema).valid).toBe(false)
    })

    it('accepts null for the null type', () => {
      const schema: Schema = { type: 'null' }
      expect(validate(null, schema).valid).toBe(true)
    })

    it.each([undefined, 'null'])('rejects %p for the null type', (data: unknown) => {
      const schema: Schema = { type: 'null' }
      expect(validate(data, schema).valid).toBe(false)
    })

    it.each(['hello', 123])('accepts %p for a union of the string and number types', (data: unknown) => {
      const schema: Schema = { type: ['string', 'number'] }
      expect(validate(data, schema).valid).toBe(true)
    })

    it('rejects a boolean for a union of the string and number types', () => {
      const schema: Schema = { type: ['string', 'number'] }
      expect(validate(true, schema).valid).toBe(false)
    })
  })

  describe('object keywords', () => {
    it('accepts an object whose properties match their schemas', () => {
      const schema: Schema = {
        type: 'object',
        properties: {
          name: { type: 'string' },
          age: { type: 'integer' },
        },
      }
      expect(validate({ name: 'Alice', age: 30 }, schema).valid).toBe(true)
    })

    it('rejects an object with a property that violates its schema', () => {
      const schema: Schema = {
        type: 'object',
        properties: {
          name: { type: 'string' },
          age: { type: 'integer' },
        },
      }
      expect(validate({ name: 123, age: 30 }, schema).valid).toBe(false)
    })

    it('accepts an object carrying every required property', () => {
      const schema: Schema = {
        type: 'object',
        properties: {
          name: { type: 'string' },
        },
        required: ['name'],
      }
      expect(validate({ name: 'Alice' }, schema).valid).toBe(true)
    })

    it('rejects an object missing a required property', () => {
      const schema: Schema = {
        type: 'object',
        properties: {
          name: { type: 'string' },
        },
        required: ['name'],
      }
      expect(validate({}, schema).valid).toBe(false)
    })

    it('accepts an object with only declared properties when additionalProperties is false', () => {
      const schema: Schema = {
        type: 'object',
        properties: {
          name: { type: 'string' },
        },
        additionalProperties: false,
      }
      expect(validate({ name: 'Alice' }, schema).valid).toBe(true)
    })

    it('rejects an undeclared property when additionalProperties is false', () => {
      const schema: Schema = {
        type: 'object',
        properties: {
          name: { type: 'string' },
        },
        additionalProperties: false,
      }
      expect(validate({ name: 'Alice', extra: true }, schema).valid).toBe(false)
    })

    it('accepts an undeclared property matching the additionalProperties schema', () => {
      const schema: Schema = {
        type: 'object',
        properties: {
          name: { type: 'string' },
        },
        additionalProperties: { type: 'number' },
      }
      expect(validate({ name: 'Alice', age: 30 }, schema).valid).toBe(true)
    })

    it('rejects an undeclared property violating the additionalProperties schema', () => {
      const schema: Schema = {
        type: 'object',
        properties: {
          name: { type: 'string' },
        },
        additionalProperties: { type: 'number' },
      }
      expect(validate({ name: 'Alice', age: 'thirty' }, schema).valid).toBe(false)
    })

    it('rejects an object with fewer properties than minProperties', () => {
      const schema: Schema = { type: 'object', minProperties: 1, maxProperties: 2 }
      expect(validate({}, schema).valid).toBe(false)
    })

    it.each([{ a: 1 }, { a: 1, b: 2 }])('accepts %p within minProperties and maxProperties', (data: object) => {
      const schema: Schema = { type: 'object', minProperties: 1, maxProperties: 2 }
      expect(validate(data, schema).valid).toBe(true)
    })

    it('rejects an object with more properties than maxProperties', () => {
      const schema: Schema = { type: 'object', minProperties: 1, maxProperties: 2 }
      expect(validate({ a: 1, b: 2, c: 3 }, schema).valid).toBe(false)
    })
  })

  describe('array keywords', () => {
    it('accepts an array whose items all match the single items schema', () => {
      const schema: Schema = {
        type: 'array',
        items: { type: 'string' },
      }
      expect(validate(['a', 'b', 'c'], schema).valid).toBe(true)
    })

    it('rejects an array with an item violating the single items schema', () => {
      const schema: Schema = {
        type: 'array',
        items: { type: 'string' },
      }
      expect(validate(['a', 1, 'c'], schema).valid).toBe(false)
    })

    it('accepts items matching their tuple schemas by position', () => {
      const schema: Schema = {
        type: 'array',
        items: [{ type: 'string' }, { type: 'number' }],
      }
      expect(validate(['a', 1], schema).valid).toBe(true)
    })

    it('rejects items that violate their tuple schemas by position', () => {
      const schema: Schema = {
        type: 'array',
        items: [{ type: 'string' }, { type: 'number' }],
      }
      expect(validate([1, 'a'], schema).valid).toBe(false)
    })

    it('rejects an array shorter than minItems', () => {
      const schema: Schema = { type: 'array', minItems: 1, maxItems: 3 }
      expect(validate([], schema).valid).toBe(false)
    })

    it('accepts an array at minItems', () => {
      const schema: Schema = { type: 'array', minItems: 1, maxItems: 3 }
      expect(validate([1], schema).valid).toBe(true)
    })

    it('accepts an array at maxItems', () => {
      const schema: Schema = { type: 'array', minItems: 1, maxItems: 3 }
      expect(validate([1, 2, 3], schema).valid).toBe(true)
    })

    it('rejects an array longer than maxItems', () => {
      const schema: Schema = { type: 'array', minItems: 1, maxItems: 3 }
      expect(validate([1, 2, 3, 4], schema).valid).toBe(false)
    })

    it('accepts distinct primitive items under uniqueItems', () => {
      const schema: Schema = { type: 'array', uniqueItems: true }
      expect(validate([1, 2, 3], schema).valid).toBe(true)
    })

    it('rejects a repeated primitive item under uniqueItems', () => {
      const schema: Schema = { type: 'array', uniqueItems: true }
      expect(validate([1, 2, 1], schema).valid).toBe(false)
    })

    it('accepts structurally distinct object items under uniqueItems', () => {
      const schema: Schema = { type: 'array', uniqueItems: true }
      expect(validate([{ a: 1 }, { a: 2 }], schema).valid).toBe(true)
    })

    it('rejects deeply equal object items under uniqueItems', () => {
      const schema: Schema = { type: 'array', uniqueItems: true }
      expect(validate([{ a: 1 }, { a: 1 }], schema).valid).toBe(false)
    })
  })

  describe('string keywords', () => {
    it('rejects a string shorter than minLength', () => {
      const schema: Schema = { type: 'string', minLength: 2, maxLength: 5 }
      expect(validate('a', schema).valid).toBe(false)
    })

    it.each(['ab', 'abcde'])('accepts %p within minLength and maxLength', (data: string) => {
      const schema: Schema = { type: 'string', minLength: 2, maxLength: 5 }
      expect(validate(data, schema).valid).toBe(true)
    })

    it('rejects a string longer than maxLength', () => {
      const schema: Schema = { type: 'string', minLength: 2, maxLength: 5 }
      expect(validate('abcdef', schema).valid).toBe(false)
    })

    it('accepts a string matching the pattern', () => {
      const schema: Schema = { type: 'string', pattern: '^[a-z]+$' }
      expect(validate('hello', schema).valid).toBe(true)
    })

    it.each(['Hello', 'hello123'])('rejects %p for not matching the pattern', (data: string) => {
      const schema: Schema = { type: 'string', pattern: '^[a-z]+$' }
      expect(validate(data, schema).valid).toBe(false)
    })
  })

  describe('number keywords', () => {
    it('rejects a number below minimum', () => {
      const schema: Schema = { type: 'number', minimum: 0, maximum: 100 }
      expect(validate(-1, schema).valid).toBe(false)
    })

    it.each([0, 50, 100])('accepts %p within the inclusive minimum and maximum', (data: number) => {
      const schema: Schema = { type: 'number', minimum: 0, maximum: 100 }
      expect(validate(data, schema).valid).toBe(true)
    })

    it('rejects a number above maximum', () => {
      const schema: Schema = { type: 'number', minimum: 0, maximum: 100 }
      expect(validate(101, schema).valid).toBe(false)
    })

    it('rejects a number equal to an exclusive minimum', () => {
      const schema: Schema = { type: 'number', minimum: 0, exclusiveMinimum: true, maximum: 100, exclusiveMaximum: true }
      expect(validate(0, schema).valid).toBe(false)
    })

    it.each([0.1, 99.9])('accepts %p strictly between the exclusive minimum and maximum', (data: number) => {
      const schema: Schema = { type: 'number', minimum: 0, exclusiveMinimum: true, maximum: 100, exclusiveMaximum: true }
      expect(validate(data, schema).valid).toBe(true)
    })

    it('rejects a number equal to an exclusive maximum', () => {
      const schema: Schema = { type: 'number', minimum: 0, exclusiveMinimum: true, maximum: 100, exclusiveMaximum: true }
      expect(validate(100, schema).valid).toBe(false)
    })

    it.each([10, 15])('accepts %p as a multiple of multipleOf', (data: number) => {
      const schema: Schema = { type: 'number', multipleOf: 5 }
      expect(validate(data, schema).valid).toBe(true)
    })

    it('rejects a number that is not a multiple of multipleOf', () => {
      const schema: Schema = { type: 'number', multipleOf: 5 }
      expect(validate(12, schema).valid).toBe(false)
    })
  })

  describe('enum keyword', () => {
    it.each(['red', 'green'])('accepts the enum member %p', (data: string) => {
      const schema: Schema = { enum: ['red', 'green', 'blue'] }
      expect(validate(data, schema).valid).toBe(true)
    })

    it('rejects a value outside the enum', () => {
      const schema: Schema = { enum: ['red', 'green', 'blue'] }
      expect(validate('yellow', schema).valid).toBe(false)
    })

    it.each([1, 'one', null])('accepts the mixed-type enum member %p', (data: unknown) => {
      const schema: Schema = { enum: [1, 'one', null] }
      expect(validate(data, schema).valid).toBe(true)
    })

    it('rejects a value outside a mixed-type enum', () => {
      const schema: Schema = { enum: [1, 'one', null] }
      expect(validate(2, schema).valid).toBe(false)
    })
  })

  describe('composition keywords', () => {
    it('accepts a value satisfying every allOf schema', () => {
      const schema: Schema = {
        allOf: [
          { type: 'object', properties: { a: { type: 'string' } }, required: ['a'] },
          { type: 'object', properties: { b: { type: 'number' } }, required: ['b'] },
        ],
      }
      expect(validate({ a: 'hello', b: 123 }, schema).valid).toBe(true)
    })

    it.each([{ a: 'hello' }, { b: 123 }])('rejects %p for failing one allOf schema', (data: object) => {
      const schema: Schema = {
        allOf: [
          { type: 'object', properties: { a: { type: 'string' } }, required: ['a'] },
          { type: 'object', properties: { b: { type: 'number' } }, required: ['b'] },
        ],
      }
      expect(validate(data, schema).valid).toBe(false)
    })

    it.each(['hello', 123])('accepts %p for matching an anyOf schema', (data: unknown) => {
      const schema: Schema = {
        anyOf: [{ type: 'string' }, { type: 'number' }],
      }
      expect(validate(data, schema).valid).toBe(true)
    })

    it('rejects a value matching no anyOf schema', () => {
      const schema: Schema = {
        anyOf: [{ type: 'string' }, { type: 'number' }],
      }
      expect(validate(true, schema).valid).toBe(false)
    })

    it.each([9, 10])('accepts %p for matching exactly one oneOf schema', (data: number) => {
      const schema: Schema = {
        oneOf: [
          { type: 'number', multipleOf: 3 },
          { type: 'number', multipleOf: 5 },
        ],
      }
      expect(validate(data, schema).valid).toBe(true)
    })

    it('rejects a value matching more than one oneOf schema', () => {
      const schema: Schema = {
        oneOf: [
          { type: 'number', multipleOf: 3 },
          { type: 'number', multipleOf: 5 },
        ],
      }
      expect(validate(15, schema).valid).toBe(false)
    })

    it('rejects a value matching no oneOf schema', () => {
      const schema: Schema = {
        oneOf: [
          { type: 'number', multipleOf: 3 },
          { type: 'number', multipleOf: 5 },
        ],
      }
      expect(validate(7, schema).valid).toBe(false)
    })

    it('accepts a value that does not match the not schema', () => {
      const schema: Schema = { not: { type: 'string' } }
      expect(validate(123, schema).valid).toBe(true)
    })

    it('rejects a value that matches the not schema', () => {
      const schema: Schema = { not: { type: 'string' } }
      expect(validate('hello', schema).valid).toBe(false)
    })
  })

  describe('$ref keyword', () => {
    it('accepts data satisfying the definition a $ref resolves to', () => {
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
    })

    it('rejects data violating the definition a $ref resolves to', () => {
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
    it('accepts a valid email for the email format', () => {
      const schema: Schema = { type: 'string', format: 'email' }
      expect(validate('test@example.com', schema).valid).toBe(true)
    })

    it('rejects an invalid email for the email format', () => {
      const schema: Schema = { type: 'string', format: 'email' }
      expect(validate('invalid', schema).valid).toBe(false)
    })

    it('accepts a valid uri for the uri format', () => {
      const schema: Schema = { type: 'string', format: 'uri' }
      expect(validate('https://example.com', schema).valid).toBe(true)
    })

    it('rejects an invalid uri for the uri format', () => {
      const schema: Schema = { type: 'string', format: 'uri' }
      expect(validate('not a uri', schema).valid).toBe(false)
    })

    it('accepts a valid date-time for the date-time format', () => {
      const schema: Schema = { type: 'string', format: 'date-time' }
      expect(validate('2024-01-15T10:30:00Z', schema).valid).toBe(true)
    })

    it('rejects an invalid date-time for the date-time format', () => {
      const schema: Schema = { type: 'string', format: 'date-time' }
      expect(validate('not a date', schema).valid).toBe(false)
    })

    it('allows unknown formats', () => {
      const schema: Schema = { type: 'string', format: 'custom-format' }
      expect(validate('anything', schema).valid).toBe(true)
    })
  })
})
