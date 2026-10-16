import type { Schema } from '../types/schema'
import { describe, expect, it, jest } from '@hyperfrontend/testing'
import { validate } from './validate'

describe('validate', () => {
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
      expect(result).toEqual({ valid: false, errors: [expect.anything(), expect.anything()] })
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
      expect(result).toEqual({ valid: false, errors: [expect.anything()] })
    })

    describe('early exit paths with collectAllErrors: false', () => {
      it('exits early on type validation failure', () => {
        const schema: Schema = { type: 'string', minLength: 1 }
        const result = validate(123, schema, { collectAllErrors: false })
        expect(result).toEqual({ valid: false, errors: [expect.objectContaining({ code: 'type' })] })
      })

      it('exits early on enum validation failure', () => {
        const schema: Schema = { enum: ['a', 'b'], minLength: 1 }
        const result = validate('c', schema, { collectAllErrors: false })
        expect(result).toEqual({ valid: false, errors: [expect.objectContaining({ code: 'enum' })] })
      })

      it('exits early on string bounds validation failure', () => {
        const schema: Schema = { type: 'string', minLength: 5, format: 'email' }
        const result = validate('ab', schema, { collectAllErrors: false })
        expect(result).toEqual({ valid: false, errors: [expect.objectContaining({ code: 'minLength' })] })
      })

      it('exits early on format validation failure', () => {
        const schema: Schema = { type: 'string', format: 'email' }
        const result = validate('not-an-email', schema, { collectAllErrors: false })
        expect(result).toEqual({ valid: false, errors: [expect.objectContaining({ code: 'format' })] })
      })

      it('exits early on number bounds validation failure', () => {
        const schema: Schema = { type: 'number', minimum: 10 }
        const result = validate(5, schema, { collectAllErrors: false })
        expect(result).toEqual({ valid: false, errors: [expect.objectContaining({ code: 'minimum' })] })
      })

      it('exits early on items validation failure', () => {
        const schema: Schema = { type: 'array', items: { type: 'string' }, minItems: 5 }
        const result = validate([1, 2], schema, { collectAllErrors: false })
        expect(result).toEqual({ valid: false, errors: [expect.objectContaining({ code: 'type' })] })
      })

      it('exits early on array bounds validation failure', () => {
        const schema: Schema = { type: 'array', minItems: 5 }
        const result = validate([1], schema, { collectAllErrors: false })
        expect(result).toEqual({ valid: false, errors: [expect.objectContaining({ code: 'minItems' })] })
      })

      it('exits early on properties validation failure', () => {
        const schema: Schema = {
          type: 'object',
          properties: { name: { type: 'string' } },
          required: ['name', 'age'],
        }
        const result = validate({ name: 123 }, schema, { collectAllErrors: false })
        expect(result).toEqual({ valid: false, errors: [expect.anything()] })
      })

      it('exits early on required validation failure', () => {
        const schema: Schema = {
          type: 'object',
          required: ['name', 'age'],
          minProperties: 5,
        }
        const result = validate({}, schema, { collectAllErrors: false })
        expect(result).toEqual({ valid: false, errors: [expect.objectContaining({ code: 'required' })] })
      })

      it('exits early on patternProperties validation failure', () => {
        const schema: Schema = {
          type: 'object',
          patternProperties: { '^x-': { type: 'string' } },
          additionalProperties: false,
        }
        const result = validate({ 'x-value': 123, 'x-other': 456 }, schema, { collectAllErrors: false })
        expect(result).toEqual({ valid: false, errors: [expect.anything()] })
      })

      it('exits early on additionalProperties validation failure', () => {
        const schema: Schema = {
          type: 'object',
          properties: { name: { type: 'string' } },
          additionalProperties: false,
          minProperties: 10,
        }
        const result = validate({ name: 'test', extra: true }, schema, { collectAllErrors: false })
        expect(result).toEqual({ valid: false, errors: [expect.objectContaining({ code: 'additionalProperties' })] })
      })

      it('exits early on object bounds validation failure', () => {
        const schema: Schema = {
          type: 'object',
          minProperties: 3,
        }
        const result = validate({ a: 1 }, schema, { collectAllErrors: false })
        expect(result).toEqual({ valid: false, errors: [expect.objectContaining({ code: 'minProperties' })] })
      })

      it('exits early on dependencies validation failure', () => {
        const schema: Schema = {
          type: 'object',
          dependencies: {
            bar: ['baz'],
          },
        }
        const result = validate({ bar: 1 }, schema, { collectAllErrors: false })
        expect(result).toEqual({ valid: false, errors: [expect.objectContaining({ code: 'dependencies' })] })
      })

      it('exits early on allOf validation failure', () => {
        const schema: Schema = {
          allOf: [{ type: 'string' }, { minLength: 5 }],
        }
        const result = validate(123, schema, { collectAllErrors: false })
        expect(result).toEqual({ valid: false, errors: [expect.anything()] })
      })

      it('exits early on anyOf validation failure', () => {
        const schema: Schema = {
          anyOf: [{ type: 'string' }, { type: 'number' }],
        }
        const result = validate(true, schema, { collectAllErrors: false })
        expect(result).toEqual({ valid: false, errors: [expect.objectContaining({ code: 'anyOf' })] })
      })

      it('exits early on oneOf validation failure', () => {
        const schema: Schema = {
          oneOf: [{ type: 'string' }, { type: 'number' }],
        }
        const result = validate(true, schema, { collectAllErrors: false })
        expect(result).toEqual({ valid: false, errors: [expect.objectContaining({ code: 'oneOf' })] })
      })

      it('exits early on not validation failure', () => {
        const schema: Schema = {
          not: { type: 'string' },
        }
        const result = validate('hello', schema, { collectAllErrors: false })
        expect(result).toEqual({ valid: false, errors: [expect.objectContaining({ code: 'not' })] })
      })
    })
  })

  describe('strictPatterns option', () => {
    it('reports error for invalid regex pattern when strictPatterns is true', () => {
      const schema: Schema = { type: 'string', pattern: '[invalid' }
      const result = validate('test', schema, { strictPatterns: true })
      expect(result).toEqual({ valid: false, errors: [expect.objectContaining({ message: expect.stringContaining('Invalid regex') })] })
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
      expect(result).toEqual({ valid: false, errors: [expect.objectContaining({ message: expect.stringContaining('Invalid regex') })] })
    })
  })

  describe('safePatterns option', () => {
    describe('with built-in heuristics (true)', () => {
      it('rejects nested quantifier patterns', () => {
        const schema: Schema = { type: 'string', pattern: '(a+)+' }
        const result = validate('aaa', schema, { safePatterns: true })
        expect(result).toEqual({
          valid: false,
          errors: [expect.objectContaining({ message: expect.stringMatching(/Unsafe regex.*Nested quantifiers/) })],
        })
      })

      it('rejects overlapping alternation patterns', () => {
        const schema: Schema = { type: 'string', pattern: '(a|a)+' }
        const result = validate('aaa', schema, { safePatterns: true })
        expect(result).toEqual({ valid: false, errors: [expect.objectContaining({ message: expect.stringContaining('Unsafe regex') })] })
      })

      it('rejects multiple unbounded wildcards', () => {
        const schema: Schema = { type: 'string', pattern: '.*foo.*' }
        const result = validate('foobar', schema, { safePatterns: true })
        expect(result).toEqual({
          valid: false,
          errors: [expect.objectContaining({ message: expect.stringContaining('unbounded wildcards') })],
        })
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
        expect(result).toEqual({ valid: false, errors: [expect.objectContaining({ message: expect.stringContaining('Unsafe regex') })] })
      })
    })

    describe('with custom checker function', () => {
      it('passes the schema pattern to the custom checker', () => {
        const customChecker = jest.fn().mockReturnValue({ safe: false, reason: 'Custom rejection' })
        const schema: Schema = { type: 'string', pattern: 'any-pattern' }
        validate('test', schema, { safePatterns: customChecker })
        expect(customChecker).toHaveBeenCalledWith('any-pattern')
      })

      it('rejects the value with the reason from the custom checker', () => {
        const customChecker = jest.fn().mockReturnValue({ safe: false, reason: 'Custom rejection' })
        const schema: Schema = { type: 'string', pattern: 'any-pattern' }
        const result = validate('test', schema, { safePatterns: customChecker })
        expect(result).toEqual({
          valid: false,
          errors: [expect.objectContaining({ message: expect.stringContaining('Custom rejection') })],
        })
      })

      it('uses default reason when custom checker provides no reason', () => {
        const customChecker = jest.fn().mockReturnValue({ safe: false })
        const schema: Schema = { type: 'string', pattern: 'any-pattern' }
        const result = validate('test', schema, { safePatterns: customChecker })
        expect(result).toEqual({
          valid: false,
          errors: [expect.objectContaining({ message: expect.stringContaining('Pattern may cause ReDoS') })],
        })
      })

      it('allows pattern when custom checker returns safe', () => {
        const customChecker = jest.fn().mockReturnValue({ safe: true })
        const schema: Schema = { type: 'string', pattern: '^test$' }
        const result = validate('test', schema, { safePatterns: customChecker })
        expect(result.valid).toBe(true)
      })

      it('passes the schema pattern to a custom checker that returns safe', () => {
        const customChecker = jest.fn().mockReturnValue({ safe: true })
        const schema: Schema = { type: 'string', pattern: '^test$' }
        validate('test', schema, { safePatterns: customChecker })
        expect(customChecker).toHaveBeenCalledWith('^test$')
      })

      it('rejects the object when the custom checker blocks a patternProperties pattern', () => {
        const customChecker = jest.fn().mockReturnValue({ safe: false, reason: 'Blocked' })
        const schema: Schema = {
          type: 'object',
          patternProperties: { '^test_': { type: 'string' } },
        }
        const result = validate({ test_foo: 'bar' }, schema, { safePatterns: customChecker })
        expect(result.valid).toBe(false)
      })

      it('passes the patternProperties pattern to the custom checker', () => {
        const customChecker = jest.fn().mockReturnValue({ safe: false, reason: 'Blocked' })
        const schema: Schema = {
          type: 'object',
          patternProperties: { '^test_': { type: 'string' } },
        }
        validate({ test_foo: 'bar' }, schema, { safePatterns: customChecker })
        expect(customChecker).toHaveBeenCalledWith('^test_')
      })

      it('uses default reason for patternProperties when checker provides no reason', () => {
        const customChecker = jest.fn().mockReturnValue({ safe: false })
        const schema: Schema = {
          type: 'object',
          patternProperties: { '^test_': { type: 'string' } },
        }
        const result = validate({ test_foo: 'bar' }, schema, { safePatterns: customChecker })
        expect(result).toEqual({
          valid: false,
          errors: [expect.objectContaining({ message: expect.stringContaining('Pattern may cause ReDoS') })],
        })
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
        expect(result).toEqual({ valid: false, errors: [expect.anything()] })
      })

      it('stops at first unsafe patternProperties error', () => {
        const schema: Schema = {
          type: 'object',
          patternProperties: { '(a+)+': { type: 'string' }, '(b+)+': { type: 'number' } },
        }
        const result = validate({ aaa: 'test' }, schema, { safePatterns: true, collectAllErrors: false })
        expect(result).toEqual({ valid: false, errors: [expect.anything()] })
      })
    })
  })
})
