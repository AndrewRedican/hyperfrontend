import { afterEach, beforeEach } from 'node:test'
import { describe, expect, it } from '@hyperfrontend/testing'
import { deregisterIterableClass } from './deregister-iterable-class'
import { registerIterableClass } from './register-iterable-class'
import { sameStructure } from './same-structure'
import { setConfig } from './shared/consts'

describe('sameStructure', () => {
  beforeEach(() => {
    setConfig({ samePositionOfOwnProperties: false })
    registerIterableClass<Set<unknown>>(
      Set,
      (set) => Array.from(set.keys()).map(String) as string[],
      (_, key) => key,
      (set, value) => set.add(value),
      (set, key) => set.delete(key)
    )
  })

  afterEach(() => {
    deregisterIterableClass(Set)
  })

  it.each([
    [42, 'hello'],
    [true, null],
  ])('returns false for mismatched primitive types: %p and %p', (left: unknown, right: unknown) => {
    expect(sameStructure(left, right)).toBe(false)
  })

  it.each([
    [
      [1, 2, 3],
      [1, 2],
    ],
    [new Set([1, 2]), new Set([1, 2, 3])],
  ])('returns false for lists that differ in length: %p and %p', (left: unknown, right: unknown) => {
    expect(sameStructure(left, right)).toBe(false)
  })

  it.each([
    [
      { a: 1, b: 2 },
      { a: 1, c: 3 },
    ],
    [{ a: 1 }, { a: 1, b: 2 }],
  ])('returns false for objects with different keys: %p and %p', (left: unknown, right: unknown) => {
    expect(sameStructure(left, right)).toBe(false)
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

  it('respects key order when configured to do so, returning false for keys in a different order', () => {
    setConfig({ samePositionOfOwnProperties: true })
    expect(sameStructure({ a: 1, b: 2 }, { b: 3, a: 4 })).toBe(false)
  })

  it('respects key order when configured to do so, returning matching data type for keys in the same order', () => {
    setConfig({ samePositionOfOwnProperties: true })
    expect(sameStructure({ a: 1, b: 2 }, { a: 3, b: 4 })).toBe('object')
  })
})
