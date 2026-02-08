import { registerIterableClass } from './register-iterable-class'
import { deregisterIterableClass } from './deregister-iterable-class'
import { isIterableType } from './is-iterable-type'

describe('isIterableType', () => {
  it('returns true for array', () => {
    expect(isIterableType('array')).toBe(true)
  })

  it('returns true for object', () => {
    expect(isIterableType('object')).toBe(true)
  })
})

describe('isIterableType (after registering a new iterable class)', () => {
  beforeEach(() => {
    registerIterableClass<Map<unknown, unknown>>(
      Map,
      (map) => <string[]>Array.from(map.keys()),
      (map, key) => map.get(key),
      (map, value, key) => map.set(key, value),
      (map, key) => map.delete(key)
    )
    registerIterableClass<Set<unknown>>(
      Set,
      (set) => <string[]>Array.from(set.keys()),
      (_, key) => key,
      (set, value) => set.add(value),
      (set, key) => set.delete(key)
    )
  })

  afterAll(() => deregisterIterableClass())

  it('returns true for newly registered iterable types', () => {
    expect(isIterableType('Map')).toBe(true)
    expect(isIterableType('Set')).toBe(true)
  })
})
