import { after as afterAll, beforeEach } from 'node:test'
import { describe, expect, it } from '@hyperfrontend/testing'
import { deregisterIterableClass } from './deregister-iterable-class'
import { registerIterableClass } from './register-iterable-class'
import { registeredClasses, registeredIterableClasses } from './shared/consts'

describe('deregisterIterableClass', () => {
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

  it('removes all registered iterable classes except built-in support for Object and Array', () => {
    deregisterIterableClass()
    expect(registeredIterableClasses.map((entry) => entry.classRef)).toEqual([Array, Object])
  })

  it('remove specific registered iterable classes', () => {
    deregisterIterableClass(Map)
    expect(registeredIterableClasses.map((entry) => entry.classRef)).toEqual([Set, Array, Object])
  })

  it('removes a deregistered iterable class from registered classes', () => {
    deregisterIterableClass(Set)
    expect(registeredClasses).not.toContain(Set)
  })

  it('removes a second deregistered iterable class from registered classes', () => {
    deregisterIterableClass(Set)
    deregisterIterableClass(Map)
    expect(registeredClasses).not.toContain(Map)
  })
})
