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
    it.each(['', 'hello', '123'])('returns string for the string value %p', (value: string) => {
      expect(getJsonType(value)).toBe('string')
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
    it.each([0, 42, -100])('returns integer for the whole number %p', (value: number) => {
      expect(getJsonType(value)).toBe('integer')
    })

    it.each([3.14, -0.5, 1.0001])('returns number for the floating point value %p', (value: number) => {
      expect(getJsonType(value)).toBe('number')
    })

    it.each([1.0, 100.0])('returns integer for the whole floating point value %p', (value: number) => {
      expect(getJsonType(value)).toBe('integer')
    })
  })

  describe('array detection', () => {
    it('returns array for empty arrays', () => {
      expect(getJsonType([])).toBe('array')
    })

    it.each([
      ['numbers', [1, 2, 3]],
      ['strings', ['a', 'b']],
      ['objects', [{ x: 1 }]],
    ])('returns array for a populated array of %s', (_label: string, value: unknown[]) => {
      expect(getJsonType(value)).toBe('array')
    })
  })

  describe('object detection', () => {
    it('returns object for empty objects', () => {
      expect(getJsonType({})).toBe('object')
    })

    it.each([{ a: 1 }, { nested: { value: true } }])('returns object for the populated object %p', (value: object) => {
      expect(getJsonType(value)).toBe('object')
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
