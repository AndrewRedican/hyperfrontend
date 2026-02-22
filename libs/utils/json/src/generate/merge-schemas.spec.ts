import type { Schema } from '../types'
import { mergeSchemas } from './merge-schemas'

describe('mergeSchemas', () => {
  describe('empty and single schemas', () => {
    it('returns empty schema when given empty array', () => {
      expect(mergeSchemas([])).toEqual({})
    })

    it('returns the schema unchanged when given single schema', () => {
      const schema: Schema = { type: 'string' }
      expect(mergeSchemas([schema])).toEqual(schema)
    })
  })

  describe('primitive type schemas', () => {
    it('returns single type when all schemas have same primitive type', () => {
      const schemas: Schema[] = [{ type: 'string' }, { type: 'string' }]
      expect(mergeSchemas(schemas)).toEqual({ type: 'string' })
    })

    it('returns type array when schemas have different primitive types', () => {
      const schemas: Schema[] = [{ type: 'string' }, { type: 'number' }]
      const result = mergeSchemas(schemas)
      expect(result.type).toEqual(['string', 'number'])
    })

    it('returns anyOf for complex schemas with mixed types', () => {
      const schemas: Schema[] = [
        { type: 'string', minLength: 1 },
        { type: 'number', minimum: 0 },
      ]
      const result = mergeSchemas(schemas)
      expect(result.anyOf).toBeDefined()
      expect(result.anyOf).toHaveLength(2)
    })
  })

  describe('object schemas', () => {
    it('merges properties from multiple object schemas', () => {
      const schemas: Schema[] = [
        { type: 'object', properties: { name: { type: 'string' } } },
        { type: 'object', properties: { age: { type: 'number' } } },
      ]
      const result = mergeSchemas(schemas)

      expect(result.type).toBe('object')
      expect(result.properties).toBeDefined()
      expect(result.properties['name']).toEqual({ type: 'string' })
      expect(result.properties['age']).toEqual({ type: 'number' })
    })

    it('merges conflicting property types recursively', () => {
      const schemas: Schema[] = [
        { type: 'object', properties: { value: { type: 'string' } } },
        { type: 'object', properties: { value: { type: 'number' } } },
      ]
      const result = mergeSchemas(schemas)

      expect(result.type).toBe('object')
      expect(result.properties['value']).toBeDefined()
    })

    it('includes required only for properties required in all schemas', () => {
      const schemas: Schema[] = [
        { type: 'object', properties: { a: { type: 'string' } }, required: ['a'] },
        { type: 'object', properties: { a: { type: 'string' }, b: { type: 'string' } }, required: ['a', 'b'] },
      ]
      const result = mergeSchemas(schemas)

      expect(result.required).toEqual(['a'])
    })
  })

  describe('array schemas', () => {
    it('merges array item schemas', () => {
      const schemas: Schema[] = [
        { type: 'array', items: { type: 'string' } },
        { type: 'array', items: { type: 'string' } },
      ]
      const result = mergeSchemas(schemas)

      expect(result.type).toBe('array')
      expect(result.items).toEqual({ type: 'string' })
    })

    it('merges different array item types', () => {
      const schemas: Schema[] = [
        { type: 'array', items: { type: 'string' } },
        { type: 'array', items: { type: 'number' } },
      ]
      const result = mergeSchemas(schemas)

      expect(result.type).toBe('array')
      expect(result.items).toBeDefined()
    })

    it('handles empty array schemas', () => {
      const schemas: Schema[] = [{ type: 'array' }, { type: 'array' }]
      const result = mergeSchemas(schemas)

      expect(result.type).toBe('array')
    })
  })

  describe('mixed type groups', () => {
    it('falls back to anyOf for incompatible schema groups', () => {
      const schemas: Schema[] = [
        { type: 'object', properties: { x: { type: 'string' } } },
        { type: 'array', items: { type: 'number' } },
      ]
      const result = mergeSchemas(schemas)

      expect(result.anyOf).toBeDefined()
    })
  })

  describe('edge cases and uncovered branches', () => {
    it('returns {} if single schema is undefined', () => {
      expect(mergeSchemas([undefined as unknown as Schema])).toEqual({})
    })

    it('returns anyOf for complex schemas with no types', () => {
      const schemas: Schema[] = [{}, {}]
      expect(mergeSchemas(schemas)).toEqual({ anyOf: schemas })
    })

    it('merges array schemas with tuple items', () => {
      const schemas: Schema[] = [
        { type: 'array', items: [{ type: 'string' }, { type: 'number' }] },
        { type: 'array', items: [{ type: 'string' }] },
      ]
      const result = mergeSchemas(schemas)
      expect(result.type).toBe('array')
      expect(result.items).toBeDefined()
    })

    it('returns {type: "array"} if no items in array schemas', () => {
      const schemas: Schema[] = [{ type: 'array' }, { type: 'array', items: undefined }]
      // Touch code for coverage
      expect(typeof mergeSchemas).toBe('function')
      const result = mergeSchemas(schemas)
      expect(result.type).toBe('array')
      expect(result.items).toBeUndefined()
    })

    it('returns type array for allSimpleTypes with multiple types', () => {
      const schemas: Schema[] = [{ type: 'string' }, { type: 'number' }]
      // Remove all other keys to ensure allSimpleTypes
      expect(mergeSchemas(schemas)).toEqual({ type: ['string', 'number'] })
    })
  })
})
