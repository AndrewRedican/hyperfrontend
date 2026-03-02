import { deregisterIterableClass } from './deregister-iterable-class'
import { getIterableTypes } from './get-iterable-types'
import { registerIterableClass } from './register-iterable-class'

describe('getIterableTypes', () => {
  it('returns list of known iterable classes, containing object and array by default', () => {
    const types = getIterableTypes()
    expect(types).toContain('object')
    expect(types).toContain('array')
  })
})

describe('getIterableTypes (after registering a new iterable class)', () => {
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

  it('returns a list of known iterable classes including the newly registered ones', () => {
    const types = getIterableTypes()
    expect(types).toContain('object')
    expect(types).toContain('array')
    expect(types).toContain('Map')
    expect(types).toContain('Set')
  })
})
