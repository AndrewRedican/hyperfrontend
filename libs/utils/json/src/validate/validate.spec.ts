import type { Schema } from '../types/schema'
import { validate } from './validate'

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
      expect(validate(9, schema).valid).toBe(true)
      expect(validate(10, schema).valid).toBe(true)
      expect(validate(15, schema).valid).toBe(false)
      expect(validate(7, schema).valid).toBe(false)
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

    describe('early exit paths with collectAllErrors: false', () => {
      it('exits early on type validation failure', () => {
        const schema: Schema = { type: 'string', minLength: 1 }
        const result = validate(123, schema, { collectAllErrors: false })
        expect(result.valid).toBe(false)
        expect(result.errors.length).toBe(1)
        expect(result.errors[0].code).toBe('type')
      })

      it('exits early on enum validation failure', () => {
        const schema: Schema = { enum: ['a', 'b'], minLength: 1 }
        const result = validate('c', schema, { collectAllErrors: false })
        expect(result.valid).toBe(false)
        expect(result.errors.length).toBe(1)
        expect(result.errors[0].code).toBe('enum')
      })

      it('exits early on string bounds validation failure', () => {
        const schema: Schema = { type: 'string', minLength: 5, format: 'email' }
        const result = validate('ab', schema, { collectAllErrors: false })
        expect(result.valid).toBe(false)
        expect(result.errors.length).toBe(1)
        expect(result.errors[0].code).toBe('minLength')
      })

      it('exits early on format validation failure', () => {
        const schema: Schema = { type: 'string', format: 'email' }
        const result = validate('not-an-email', schema, { collectAllErrors: false })
        expect(result.valid).toBe(false)
        expect(result.errors.length).toBe(1)
        expect(result.errors[0].code).toBe('format')
      })

      it('exits early on number bounds validation failure', () => {
        const schema: Schema = { type: 'number', minimum: 10 }
        const result = validate(5, schema, { collectAllErrors: false })
        expect(result.valid).toBe(false)
        expect(result.errors.length).toBe(1)
        expect(result.errors[0].code).toBe('minimum')
      })

      it('exits early on items validation failure', () => {
        const schema: Schema = { type: 'array', items: { type: 'string' }, minItems: 5 }
        const result = validate([1, 2], schema, { collectAllErrors: false })
        expect(result.valid).toBe(false)
        expect(result.errors.length).toBe(1)
        expect(result.errors[0].code).toBe('type')
      })

      it('exits early on array bounds validation failure', () => {
        const schema: Schema = { type: 'array', minItems: 5 }
        const result = validate([1], schema, { collectAllErrors: false })
        expect(result.valid).toBe(false)
        expect(result.errors.length).toBe(1)
        expect(result.errors[0].code).toBe('minItems')
      })

      it('exits early on properties validation failure', () => {
        const schema: Schema = {
          type: 'object',
          properties: { name: { type: 'string' } },
          required: ['name', 'age'],
        }
        const result = validate({ name: 123 }, schema, { collectAllErrors: false })
        expect(result.valid).toBe(false)
        expect(result.errors.length).toBe(1)
      })

      it('exits early on required validation failure', () => {
        const schema: Schema = {
          type: 'object',
          required: ['name', 'age'],
          minProperties: 5,
        }
        const result = validate({}, schema, { collectAllErrors: false })
        expect(result.valid).toBe(false)
        expect(result.errors.length).toBe(1)
        expect(result.errors[0].code).toBe('required')
      })

      it('exits early on patternProperties validation failure', () => {
        const schema: Schema = {
          type: 'object',
          patternProperties: { '^x-': { type: 'string' } },
          additionalProperties: false,
        }
        const result = validate({ 'x-value': 123, 'x-other': 456 }, schema, { collectAllErrors: false })
        expect(result.valid).toBe(false)
        expect(result.errors.length).toBe(1)
      })

      it('exits early on additionalProperties validation failure', () => {
        const schema: Schema = {
          type: 'object',
          properties: { name: { type: 'string' } },
          additionalProperties: false,
          minProperties: 10,
        }
        const result = validate({ name: 'test', extra: true }, schema, { collectAllErrors: false })
        expect(result.valid).toBe(false)
        expect(result.errors.length).toBe(1)
        expect(result.errors[0].code).toBe('additionalProperties')
      })

      it('exits early on object bounds validation failure', () => {
        const schema: Schema = {
          type: 'object',
          minProperties: 3,
        }
        const result = validate({ a: 1 }, schema, { collectAllErrors: false })
        expect(result.valid).toBe(false)
        expect(result.errors.length).toBe(1)
        expect(result.errors[0].code).toBe('minProperties')
      })

      it('exits early on dependencies validation failure', () => {
        const schema: Schema = {
          type: 'object',
          dependencies: {
            bar: ['baz'],
          },
        }
        const result = validate({ bar: 1 }, schema, { collectAllErrors: false })
        expect(result.valid).toBe(false)
        expect(result.errors.length).toBe(1)
        expect(result.errors[0].code).toBe('dependencies')
      })

      it('exits early on allOf validation failure', () => {
        const schema: Schema = {
          allOf: [{ type: 'string' }, { minLength: 5 }],
        }
        const result = validate(123, schema, { collectAllErrors: false })
        expect(result.valid).toBe(false)
        expect(result.errors.length).toBe(1)
      })

      it('exits early on anyOf validation failure', () => {
        const schema: Schema = {
          anyOf: [{ type: 'string' }, { type: 'number' }],
        }
        const result = validate(true, schema, { collectAllErrors: false })
        expect(result.valid).toBe(false)
        expect(result.errors.length).toBe(1)
        expect(result.errors[0].code).toBe('anyOf')
      })

      it('exits early on oneOf validation failure', () => {
        const schema: Schema = {
          oneOf: [{ type: 'string' }, { type: 'number' }],
        }
        const result = validate(true, schema, { collectAllErrors: false })
        expect(result.valid).toBe(false)
        expect(result.errors.length).toBe(1)
        expect(result.errors[0].code).toBe('oneOf')
      })

      it('exits early on not validation failure', () => {
        const schema: Schema = {
          not: { type: 'string' },
        }
        const result = validate('hello', schema, { collectAllErrors: false })
        expect(result.valid).toBe(false)
        expect(result.errors.length).toBe(1)
        expect(result.errors[0].code).toBe('not')
      })
    })
  })

  describe('strictPatterns option', () => {
    it('reports error for invalid regex pattern when strictPatterns is true', () => {
      const schema: Schema = { type: 'string', pattern: '[invalid' }
      const result = validate('test', schema, { strictPatterns: true })
      expect(result.valid).toBe(false)
      expect(result.errors.length).toBe(1)
      expect(result.errors[0].message).toContain('Invalid regex')
    })

    it('skips validation for invalid regex when strictPatterns is false', () => {
      const schema: Schema = { type: 'string', pattern: '[invalid' }
      const result = validate('test', schema, { strictPatterns: false })
      expect(result.valid).toBe(true)
    })

    it('reports error for invalid patternProperties regex when strictPatterns is true', () => {
      const schema: Schema = {
        type: 'object',
        patternProperties: { '[invalid': { type: 'string' } },
      }
      const result = validate({ foo: 'bar' }, schema, { strictPatterns: true })
      expect(result.valid).toBe(false)
      expect(result.errors[0].message).toContain('Invalid regex')
    })
  })

  describe('safePatterns option', () => {
    describe('with built-in heuristics (true)', () => {
      it('rejects nested quantifier patterns', () => {
        const schema: Schema = { type: 'string', pattern: '(a+)+' }
        const result = validate('aaa', schema, { safePatterns: true })
        expect(result.valid).toBe(false)
        expect(result.errors[0].message).toContain('Unsafe regex')
        expect(result.errors[0].message).toContain('Nested quantifiers')
      })

      it('rejects overlapping alternation patterns', () => {
        const schema: Schema = { type: 'string', pattern: '(a|a)+' }
        const result = validate('aaa', schema, { safePatterns: true })
        expect(result.valid).toBe(false)
        expect(result.errors[0].message).toContain('Unsafe regex')
      })

      it('rejects multiple unbounded wildcards', () => {
        const schema: Schema = { type: 'string', pattern: '.*foo.*' }
        const result = validate('foobar', schema, { safePatterns: true })
        expect(result.valid).toBe(false)
        expect(result.errors[0].message).toContain('unbounded wildcards')
      })

      it('allows safe patterns', () => {
        const schema: Schema = { type: 'string', pattern: '^[a-z]+$' }
        const result = validate('hello', schema, { safePatterns: true })
        expect(result.valid).toBe(true)
      })

      it('rejects unsafe patternProperties', () => {
        const schema: Schema = {
          type: 'object',
          patternProperties: { '(a+)+': { type: 'string' } },
        }
        const result = validate({ aaa: 'test' }, schema, { safePatterns: true })
        expect(result.valid).toBe(false)
        expect(result.errors[0].message).toContain('Unsafe regex')
      })
    })

    describe('with custom checker function', () => {
      it('uses custom checker for pattern validation', () => {
        const customChecker = jest.fn().mockReturnValue({ safe: false, reason: 'Custom rejection' })
        const schema: Schema = { type: 'string', pattern: 'any-pattern' }
        const result = validate('test', schema, { safePatterns: customChecker })
        expect(result.valid).toBe(false)
        expect(customChecker).toHaveBeenCalledWith('any-pattern')
        expect(result.errors[0].message).toContain('Custom rejection')
      })

      it('uses default reason when custom checker provides no reason', () => {
        const customChecker = jest.fn().mockReturnValue({ safe: false })
        const schema: Schema = { type: 'string', pattern: 'any-pattern' }
        const result = validate('test', schema, { safePatterns: customChecker })
        expect(result.valid).toBe(false)
        expect(result.errors[0].message).toContain('Pattern may cause ReDoS')
      })

      it('allows pattern when custom checker returns safe', () => {
        const customChecker = jest.fn().mockReturnValue({ safe: true })
        const schema: Schema = { type: 'string', pattern: '^test$' }
        const result = validate('test', schema, { safePatterns: customChecker })
        expect(result.valid).toBe(true)
        expect(customChecker).toHaveBeenCalledWith('^test$')
      })

      it('uses custom checker for patternProperties', () => {
        const customChecker = jest.fn().mockReturnValue({ safe: false, reason: 'Blocked' })
        const schema: Schema = {
          type: 'object',
          patternProperties: { '^test_': { type: 'string' } },
        }
        const result = validate({ test_foo: 'bar' }, schema, { safePatterns: customChecker })
        expect(result.valid).toBe(false)
        expect(customChecker).toHaveBeenCalledWith('^test_')
      })

      it('uses default reason for patternProperties when checker provides no reason', () => {
        const customChecker = jest.fn().mockReturnValue({ safe: false })
        const schema: Schema = {
          type: 'object',
          patternProperties: { '^test_': { type: 'string' } },
        }
        const result = validate({ test_foo: 'bar' }, schema, { safePatterns: customChecker })
        expect(result.valid).toBe(false)
        expect(result.errors[0].message).toContain('Pattern may cause ReDoS')
      })
    })

    describe('disabled (default)', () => {
      it('does not check pattern safety when safePatterns is not set', () => {
        const schema: Schema = { type: 'string', pattern: '(a+)+' }
        const result = validate('aaa', schema)
        expect(result.valid).toBe(true)
      })

      it('does not check pattern safety when safePatterns is false', () => {
        const schema: Schema = { type: 'string', pattern: '(a+)+' }
        const result = validate('aaa', schema, { safePatterns: false })
        expect(result.valid).toBe(true)
      })
    })

    describe('with collectAllErrors: false', () => {
      it('stops at first unsafe pattern error', () => {
        const schema: Schema = { type: 'string', pattern: '(a+)+' }
        const result = validate('aaa', schema, { safePatterns: true, collectAllErrors: false })
        expect(result.valid).toBe(false)
        expect(result.errors.length).toBe(1)
      })

      it('stops at first unsafe patternProperties error', () => {
        const schema: Schema = {
          type: 'object',
          patternProperties: { '(a+)+': { type: 'string' }, '(b+)+': { type: 'number' } },
        }
        const result = validate({ aaa: 'test' }, schema, { safePatterns: true, collectAllErrors: false })
        expect(result.valid).toBe(false)
        expect(result.errors.length).toBe(1)
      })
    })
  })
})
