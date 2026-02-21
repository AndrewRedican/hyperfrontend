import { isEqual } from './deep-equal'

describe('isEqual', () => {
  describe('primitive values', () => {
    it('returns true for identical primitives', () => {
      expect(isEqual(1, 1)).toBe(true)
      expect(isEqual('hello', 'hello')).toBe(true)
      expect(isEqual(true, true)).toBe(true)
      expect(isEqual(null, null)).toBe(true)
    })

    it('returns false for different primitives', () => {
      expect(isEqual(1, 2)).toBe(false)
      expect(isEqual('hello', 'world')).toBe(false)
      expect(isEqual(true, false)).toBe(false)
    })

    it('returns false for different types', () => {
      expect(isEqual(1, '1')).toBe(false)
      expect(isEqual(true, 1)).toBe(false)
      expect(isEqual(null, undefined)).toBe(false)
    })

    it('handles null comparisons', () => {
      expect(isEqual(null, {})).toBe(false)
      expect(isEqual({}, null)).toBe(false)
      expect(isEqual(null, [])).toBe(false)
    })
  })

  describe('arrays', () => {
    it('returns true for identical arrays', () => {
      expect(isEqual([1, 2, 3], [1, 2, 3])).toBe(true)
      expect(isEqual([], [])).toBe(true)
    })

    it('returns false for arrays with different lengths', () => {
      expect(isEqual([1, 2], [1, 2, 3])).toBe(false)
    })

    it('returns false for arrays with different values', () => {
      expect(isEqual([1, 2, 3], [1, 2, 4])).toBe(false)
    })

    it('returns false when comparing array to object', () => {
      expect(isEqual([1, 2], { 0: 1, 1: 2 })).toBe(false)
      expect(isEqual({ 0: 1, 1: 2 }, [1, 2])).toBe(false)
    })

    it('handles nested arrays', () => {
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
    it('returns true for identical objects', () => {
      expect(isEqual({ a: 1, b: 2 }, { a: 1, b: 2 })).toBe(true)
      expect(isEqual({}, {})).toBe(true)
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

    it('handles nested objects', () => {
      expect(isEqual({ a: { b: 1 } }, { a: { b: 1 } })).toBe(true)
      expect(isEqual({ a: { b: 1 } }, { a: { b: 2 } })).toBe(false)
    })

    it('handles mixed nested structures', () => {
      const obj1 = { a: [1, { b: 2 }], c: { d: [3, 4] } }
      const obj2 = { a: [1, { b: 2 }], c: { d: [3, 4] } }
      const obj3 = { a: [1, { b: 2 }], c: { d: [3, 5] } }
      expect(isEqual(obj1, obj2)).toBe(true)
      expect(isEqual(obj1, obj3)).toBe(false)
    })
  })
})
