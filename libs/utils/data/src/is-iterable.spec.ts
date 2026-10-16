import { after as afterAll, beforeEach } from 'node:test'
import { describe, expect, it } from '@hyperfrontend/testing'
import { deregisterIterableClass } from './deregister-iterable-class'
import { isIterable } from './is-iterable'
import { registerIterableClass } from './register-iterable-class'

describe('isIterable', () => {
  it.each([[[]], [[1, 2, 3]], [{}], [{ a: 1, b: 2 }]])(
    'returns true for object and array values, regardless of having items or values or being empty: %p',
    (value: unknown) => {
      expect(isIterable(value)).toBe(true)
    }
  )

  it.each([
    [null],
    [undefined],
    [42],
    ['hello'],
    [true],
    [
      () => {
        /* empty function for test */
      },
    ],
  ])('returns false for the non-iterable value %p', (value: unknown) => {
    expect(isIterable(value)).toBe(false)
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

  it.each([[new Map()], [new Set()]])('returns true for the instance %p of a registered iterable class', (value: unknown) => {
    expect(isIterable(value)).toBe(true)
  })
})
