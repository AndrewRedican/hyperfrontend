import { registerIterableClass } from './register-iterable-class'
import { deregisterIterableClass } from './deregister-iterable-class'
import { containsKeys } from './contains-keys'

describe('containsKeys', () => {
  it('returns true when key is present in object', () => {
    expect(containsKeys({ a: 1, b: 2 }, ['a'])).toBe(true)
  })

  it('returns true when index/item exists in array', () => {
    expect(containsKeys([10, 20, 30], ['0', '1'])).toBe(true)
  })

  it('returns false when key is absent in object', () => {
    expect(containsKeys({ a: 1, b: 2 }, ['c'])).toBe(false)
  })

  it('returns false when index/item is out of bounds in array', () => {
    expect(containsKeys(['pine', 'cone', 'tree'], ['3'])).toBe(false)
  })

  it('returns false when expected key list is empty', () => {
    expect(containsKeys({ x: 42 }, [])).toBe(false)
  })

  it('returns false when value is not iterable', () => {
    expect(containsKeys(12345, ['0'])).toBe(false)
    expect(containsKeys(null, ['a'])).toBe(false)
    expect(containsKeys(undefined, ['a'])).toBe(false)
    expect(containsKeys(true, ['a'])).toBe(false)
  })
})

describe('containsKeys (with registered iterable class)', () => {
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

  it('returns list of known iterable classes which includes those that have been registered classes', () => {
    const map = new Map<string, number>()
    map.set('emerald', 65)
    expect(containsKeys(map, ['emerald'])).toBe(true)

    const set = new Set<string>()
    set.add('ruby')
    expect(containsKeys(set, ['ruby'])).toBe(true)
  })
})
