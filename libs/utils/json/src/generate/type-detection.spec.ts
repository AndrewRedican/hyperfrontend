import { describe, expect, it } from '@hyperfrontend/testing'
import { getJsonType } from './type-detection'

describe('getJsonType', () => {
  describe('null detection', () => {
    it('returns null for null value', () => {
      expect(getJsonType(null)).toBe('null')
    })

    it('returns null for undefined', () => {
      expect(getJsonType(undefined)).toBe('null')
    })
  })

  describe('string detection', () => {
    it('returns string for string values', () => {
      expect(getJsonType('')).toBe('string')
      expect(getJsonType('hello')).toBe('string')
      expect(getJsonType('123')).toBe('string')
    })
  })

  describe('boolean detection', () => {
    it('returns boolean for true', () => {
      expect(getJsonType(true)).toBe('boolean')
    })

    it('returns boolean for false', () => {
      expect(getJsonType(false)).toBe('boolean')
    })
  })

  describe('number detection', () => {
    it('returns integer for whole numbers', () => {
      expect(getJsonType(0)).toBe('integer')
      expect(getJsonType(42)).toBe('integer')
      expect(getJsonType(-100)).toBe('integer')
    })

    it('returns number for floating point values', () => {
      expect(getJsonType(3.14)).toBe('number')
      expect(getJsonType(-0.5)).toBe('number')
      expect(getJsonType(1.0001)).toBe('number')
    })

    it('returns integer for whole floating point values', () => {
      expect(getJsonType(1.0)).toBe('integer')
      expect(getJsonType(100.0)).toBe('integer')
    })
  })

  describe('array detection', () => {
    it('returns array for empty arrays', () => {
      expect(getJsonType([])).toBe('array')
    })

    it('returns array for populated arrays', () => {
      expect(getJsonType([1, 2, 3])).toBe('array')
      expect(getJsonType(['a', 'b'])).toBe('array')
      expect(getJsonType([{ x: 1 }])).toBe('array')
    })
  })

  describe('object detection', () => {
    it('returns object for empty objects', () => {
      expect(getJsonType({})).toBe('object')
    })

    it('returns object for populated objects', () => {
      expect(getJsonType({ a: 1 })).toBe('object')
      expect(getJsonType({ nested: { value: true } })).toBe('object')
    })

    it('does not return object for arrays', () => {
      expect(getJsonType([])).not.toBe('object')
    })

    it('does not return object for null', () => {
      expect(getJsonType(null)).not.toBe('object')
    })
  })

  describe('edge cases', () => {
    it('returns null for functions', () => {
      expect(getJsonType(() => void 0)).toBe('null')
    })

    it('returns null for symbols', () => {
      expect(getJsonType(Symbol('test'))).toBe('null')
    })
  })
})
