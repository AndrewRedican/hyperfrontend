import { after as afterAll, beforeEach } from 'node:test'
import { describe, expect, it } from '@hyperfrontend/testing'
import { deregisterIterableClass } from './deregister-iterable-class'
import { isIterable } from './is-iterable'
import { registerIterableClass } from './register-iterable-class'

describe('isIterable', () => {
  it('returns true for object and array values, regardless of having items or values or being empty', () => {
    expect(isIterable([])).toBe(true)
    expect(isIterable([1, 2, 3])).toBe(true)
    expect(isIterable({})).toBe(true)
    expect(isIterable({ a: 1, b: 2 })).toBe(true)
  })

  it('returns false for non-iterable values', () => {
    expect(isIterable(null)).toBe(false)
    expect(isIterable(undefined)).toBe(false)
    expect(isIterable(42)).toBe(false)
    expect(isIterable('hello')).toBe(false)
    expect(isIterable(true)).toBe(false)
    expect(
      isIterable(() => {
        /* empty function for test */
      })
    ).toBe(false)
  })
})

describe('isIterable with registered iterable class', () => {
  beforeEach(() => {
    registerIterableClass<Map<unknown, unknown>>(
      Map,
      (map) => Array.from(map.keys()) as string[],
      (map, key) => map.get(key),
      (map, value, key) => map.set(key, value),
      (map, key) => map.delete(key)
    )
    registerIterableClass<Set<unknown>>(
      Set,
      (set) => Array.from(set.keys()) as string[],
      (_, key) => key,
      (set, value) => set.add(value),
      (set, key) => set.delete(key)
    )
  })

  afterAll(() => deregisterIterableClass())

  it('returns true for instances of registered iterable classes', () => {
    expect(isIterable(new Map())).toBe(true)
    expect(isIterable(new Set())).toBe(true)
  })
})
