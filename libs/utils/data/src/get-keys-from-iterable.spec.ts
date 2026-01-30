import { setConfig } from './shared/consts'
import { deregisterIterableClass } from './deregister-iterable-class'
import { registerIterableClass } from './register-iterable-class'
import { getKeysFromIterable } from './get-keys-from-iterable'

describe('getKeysFromIterable', () => {
  beforeEach(() => setConfig({ detectCircularReferences: false }))

  it('returns keys from array', () => {
    expect(getKeysFromIterable(['apple', 'banana', 'orange'], 'array')).toEqual(['0', '1', '2'])
  })

  it('returns keys from object', () => {
    expect(getKeysFromIterable({ name: 'Alice', age: 30 }, 'object')).toEqual(['name', 'age'])
  })

  it('returns empty list from data whose iterable type has not been registered', () => {
    expect(getKeysFromIterable(new Set([1, 2, 3]), 'unknownType')).toEqual([])
  })
})

describe('getKeysFromIterable (with custom registered iterable class)', () => {
  beforeEach(() => {
    setConfig({ detectCircularReferences: false })
    deregisterIterableClass(Map)
  })

  afterEach(() => {
    setConfig({ detectCircularReferences: false })
    deregisterIterableClass(Map)
  })

  it('returns keys from Map because it has been registered', () => {
    const rosterWithAge = new Map<string, number>([
      ['Alice', 30],
      ['Bob', 25],
      ['Charlie', 35],
    ])
    registerIterableClass<Map<unknown, unknown>>(
      Map,
      (map) => <string[]>Array.from(map.keys()),
      (map, key) => map.get(key),
      (map, value, key) => map.set(key, value),
      (map, key) => map.delete(key)
    )
    expect(getKeysFromIterable(rosterWithAge, 'Map')).toEqual(['Alice', 'Bob', 'Charlie'])
  })
})

describe('getKeysFromIterable (with config detecting circular references)', () => {
  beforeEach(() => setConfig({ detectCircularReferences: true }))
  afterEach(() => setConfig({ detectCircularReferences: false }))

  it('excludes any marker properties added to track references', () => {
    expect(getKeysFromIterable({ pizza: 'hawaiian', __$96184805415709618480541570: Symbol() }, 'object')).toEqual(['pizza'])
    expect(getKeysFromIterable({ 0: 'apple', 1: 'banana', __$96184805415709618480541570: Symbol() }, 'array')).toEqual(['0', '1'])
  })
})
