import { after as afterAll, beforeEach } from 'node:test'
import { describe, expect, it } from '@hyperfrontend/testing'
import { deregisterIterableClass } from './deregister-iterable-class'
import { registerIterableClass } from './register-iterable-class'
import { registeredIterableClasses, registeredClasses } from './shared/consts'

describe('registerIterableClass', () => {
  beforeEach(() => deregisterIterableClass())

  afterAll(() => deregisterIterableClass())

  it('adds to the list of registered iterable classes', () => {
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
    expect(registeredIterableClasses.length).toBe(4)
    const registeredIterableClassRefs = registeredIterableClasses.map((entry) => entry.classRef)
    expect(registeredIterableClassRefs).toContain(Map)
    expect(registeredIterableClassRefs).toContain(Set)
    expect(registeredIterableClassRefs).toContain(Array)
    expect(registeredIterableClassRefs).toContain(Object)
  })

  it('registers the corresponding class data types', () => {
    registerIterableClass<Set<unknown>>(
      Set,
      (set) => Array.from(set.keys()) as string[],
      (_, key) => key,
      (set, value) => set.add(value),
      (set, key) => set.delete(key)
    )
    expect(registeredClasses).toContain(Set)
  })
})
