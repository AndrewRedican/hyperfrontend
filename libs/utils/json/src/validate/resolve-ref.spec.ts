import type { Schema } from '../types/schema'
import { createValidationContext } from './context'
import { resolveRef } from './resolve-ref'

describe('resolveRef', () => {
  describe('definition references', () => {
    it('resolves reference to a definition', () => {
      const schema: Schema = {
        definitions: {
          address: {
            type: 'object',
            properties: { city: { type: 'string' } },
          },
        },
      }
      const ctx = createValidationContext(schema)
      const resolved = resolveRef('#/definitions/address', ctx)

      expect(resolved).toEqual({
        type: 'object',
        properties: { city: { type: 'string' } },
      })
    })

    it('returns undefined for non-existent definition', () => {
      const schema: Schema = { definitions: {} }
      const ctx = createValidationContext(schema)
      const resolved = resolveRef('#/definitions/missing', ctx)

      expect(resolved).toBeUndefined()
    })
  })

  describe('root reference', () => {
    it('resolves reference to root schema', () => {
      const schema: Schema = { type: 'object' }
      const ctx = createValidationContext(schema)
      const resolved = resolveRef('#', ctx)

      expect(resolved).toEqual(schema)
    })
  })

  describe('nested path references', () => {
    it('resolves reference to nested property', () => {
      const schema: Schema = {
        properties: {
          user: {
            type: 'object',
            properties: {
              name: { type: 'string' },
            },
          },
        },
      }
      const ctx = createValidationContext(schema)
      const resolved = resolveRef('#/properties/user', ctx)

      expect(resolved?.type).toBe('object')
    })

    it('handles JSON Pointer escaping for tildes', () => {
      const schema: Schema = {
        definitions: {
          'some~name': { type: 'string' },
        },
      }
      const ctx = createValidationContext(schema)
      const resolved = resolveRef('#/definitions/some~0name', ctx)

      expect(resolved).toEqual({ type: 'string' })
    })

    it('handles JSON Pointer escaping for slashes', () => {
      const schema: Schema = {
        definitions: {
          'some/name': { type: 'string' },
        },
      }
      const ctx = createValidationContext(schema)
      const resolved = resolveRef('#/definitions/some~1name', ctx)

      expect(resolved).toEqual({ type: 'string' })
    })
  })

  describe('external references', () => {
    it('returns undefined for external references', () => {
      const schema: Schema = {}
      const ctx = createValidationContext(schema)
      const resolved = resolveRef('http://example.com/schema.json', ctx)

      expect(resolved).toBeUndefined()
    })

    it('returns undefined for relative file references', () => {
      const schema: Schema = {}
      const ctx = createValidationContext(schema)
      const resolved = resolveRef('./other-schema.json', ctx)

      expect(resolved).toBeUndefined()
    })
  })

  describe('invalid references', () => {
    it('returns undefined for malformed JSON Pointer', () => {
      const schema: Schema = { definitions: {} }
      const ctx = createValidationContext(schema)
      const resolved = resolveRef('#definitions/test', ctx)

      expect(resolved).toBeUndefined()
    })

    it('returns undefined when path leads to non-object', () => {
      const schema: Schema = {
        type: 'string',
      }
      const ctx = createValidationContext(schema)
      const resolved = resolveRef('#/type/invalid', ctx)

      expect(resolved).toBeUndefined()
    })

    it('returns undefined when path leads to null', () => {
      const schema: Schema = {
        definitions: {
          nullDef: <Schema>(<unknown>null),
        },
      }
      const ctx = createValidationContext(schema)
      const resolved = resolveRef('#/definitions/nullDef/property', ctx)

      expect(resolved).toBeUndefined()
    })

    it('returns undefined when path leads to primitive', () => {
      const schema: Schema = {
        definitions: {
          test: { type: 'string', minLength: 1 },
        },
      }
      const ctx = createValidationContext(schema)
      const resolved = resolveRef('#/definitions/test/minLength', ctx)

      expect(resolved).toBeUndefined()
    })
  })

  describe('reference caching', () => {
    it('caches resolved references', () => {
      const schema: Schema = {
        definitions: {
          test: { type: 'string' },
        },
      }
      const ctx = createValidationContext(schema)

      resolveRef('#/definitions/test', ctx)

      expect(ctx.definitions.has('#/definitions/test')).toBe(true)
    })
  })
})
