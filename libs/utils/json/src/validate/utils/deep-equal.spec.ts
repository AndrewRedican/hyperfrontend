import { describe, expect, it } from '@hyperfrontend/testing'
import { isEqual } from './deep-equal'

describe('isEqual', () => {
  describe('primitive values', () => {
    it.each([
      [1, 1],
      ['hello', 'hello'],
      [true, true],
      [null, null],
    ])('returns true for identical primitives %p and %p', (a: unknown, b: unknown) => {
      expect(isEqual(a, b)).toBe(true)
    })

    it.each([
      [1, 2],
      ['hello', 'world'],
      [true, false],
    ])('returns false for different primitives %p and %p', (a: unknown, b: unknown) => {
      expect(isEqual(a, b)).toBe(false)
    })

    it.each([
      [1, '1'],
      [true, 1],
      [null, undefined],
    ])('returns false for different types %p and %p', (a: unknown, b: unknown) => {
      expect(isEqual(a, b)).toBe(false)
    })

    it.each([
      [null, {}],
      [{}, null],
      [null, []],
    ])('returns false for the null comparison of %p with %p', (a: unknown, b: unknown) => {
      expect(isEqual(a, b)).toBe(false)
    })
  })

  describe('arrays', () => {
    it.each([
      [
        [1, 2, 3],
        [1, 2, 3],
      ],
      [[], []],
    ])('returns true for identical arrays %p and %p', (a: unknown, b: unknown) => {
      expect(isEqual(a, b)).toBe(true)
    })

    it('returns false for arrays with different lengths', () => {
      expect(isEqual([1, 2], [1, 2, 3])).toBe(false)
    })

    it('returns false for arrays with different values', () => {
      expect(isEqual([1, 2, 3], [1, 2, 4])).toBe(false)
    })

    it.each([
      [[1, 2], { 0: 1, 1: 2 }],
      [{ 0: 1, 1: 2 }, [1, 2]],
    ])('returns false when comparing array and object %p with %p', (a: unknown, b: unknown) => {
      expect(isEqual(a, b)).toBe(false)
    })

    it('returns true for equal nested arrays', () => {
      expect(
        isEqual(
          [
            [1, 2],
            [3, 4],
          ],
          [
            [1, 2],
            [3, 4],
          ]
        )
      ).toBe(true)
    })

    it('returns false for nested arrays differing in an inner element', () => {
      expect(
        isEqual(
          [
            [1, 2],
            [3, 4],
          ],
          [
            [1, 2],
            [3, 5],
          ]
        )
      ).toBe(false)
    })
  })

  describe('objects', () => {
    it.each([
      [
        { a: 1, b: 2 },
        { a: 1, b: 2 },
      ],
      [{}, {}],
    ])('returns true for identical objects %p and %p', (a: unknown, b: unknown) => {
      expect(isEqual(a, b)).toBe(true)
    })

    it('returns false for objects with different keys', () => {
      expect(isEqual({ a: 1 }, { b: 1 })).toBe(false)
    })

    it('returns false for objects with different values', () => {
      expect(isEqual({ a: 1 }, { a: 2 })).toBe(false)
    })

    it('returns false for objects with different number of keys', () => {
      expect(isEqual({ a: 1, b: 2 }, { a: 1 })).toBe(false)
    })

    it('returns true for equal nested objects', () => {
      expect(isEqual({ a: { b: 1 } }, { a: { b: 1 } })).toBe(true)
    })

    it('returns false for nested objects differing in an inner value', () => {
      expect(isEqual({ a: { b: 1 } }, { a: { b: 2 } })).toBe(false)
    })

    it('returns true for equal mixed nested structures', () => {
      const obj1 = { a: [1, { b: 2 }], c: { d: [3, 4] } }
      const obj2 = { a: [1, { b: 2 }], c: { d: [3, 4] } }
      expect(isEqual(obj1, obj2)).toBe(true)
    })

    it('returns false for mixed nested structures differing in a deep value', () => {
      const obj1 = { a: [1, { b: 2 }], c: { d: [3, 4] } }
      const obj3 = { a: [1, { b: 2 }], c: { d: [3, 5] } }
      expect(isEqual(obj1, obj3)).toBe(false)
    })
  })
})
