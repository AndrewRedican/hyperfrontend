import { deregisterIterableClass } from './deregister-iterable-class'
import { registerIterableClass } from './register-iterable-class'
import { sameStructure } from './same-structure'
import { setConfig } from './shared/consts'

describe('sameStructure', () => {
  beforeEach(() => {
    setConfig({ samePositionOfOwnProperties: false })
    registerIterableClass<Set<unknown>>(
      Set,
      (set) => <string[]>Array.from(set.keys()).map(String),
      (_, key) => key,
      (set, value) => set.add(value),
      (set, key) => set.delete(key)
    )
  })

  afterEach(() => {
    deregisterIterableClass(Set)
  })

  it('returns false for mismatched primitive types', () => {
    expect(sameStructure(42, 'hello')).toBe(false)
    expect(sameStructure(true, null)).toBe(false)
  })

  it('returns false for lists that differ in length', () => {
    expect(sameStructure([1, 2, 3], [1, 2])).toBe(false)
    expect(sameStructure(new Set([1, 2]), new Set([1, 2, 3]))).toBe(false)
  })

  it('returns false for objects with different keys', () => {
    expect(sameStructure({ a: 1, b: 2 }, { a: 1, c: 3 })).toBe(false)
    expect(sameStructure({ a: 1 }, { a: 1, b: 2 })).toBe(false)
  })

  it('returns matching data type for empty arrays', () => {
    expect(sameStructure([], [])).toBe('array')
  })

  it('returns matching data type for empty objects', () => {
    expect(sameStructure({}, {})).toBe('object')
  })

  it('returns matching data type for for lists of the same length', () => {
    expect(sameStructure(['apricots', 'blueberries', 'cranberries'], ['a', 'b', 'c'])).toBe('array')
  })

  it('returns matching data type for objects with the same keys', () => {
    expect(sameStructure({ x: 10, y: 20 }, { x: 'ten', y: 'twenty' })).toBe('object')
  })

  it('respects key order when configured to do so', () => {
    setConfig({ samePositionOfOwnProperties: true })
    expect(sameStructure({ a: 1, b: 2 }, { b: 3, a: 4 })).toBe(false)
    expect(sameStructure({ a: 1, b: 2 }, { a: 3, b: 4 })).toBe('object')
  })
})
