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
    expect(registeredIterableClasses.length).toBe(2)
    const registeredIterableClassRefs = registeredIterableClasses.map((entry) => entry.classRef)
    expect(registeredIterableClassRefs).toContain(Array)
    expect(registeredIterableClassRefs).toContain(Object)
  })

  it('remove specific registered iterable classes', () => {
    deregisterIterableClass(Map)
    expect(registeredIterableClasses.length).toBe(3)
    const registeredIterableClassRefs = registeredIterableClasses.map((entry) => entry.classRef)
    expect(registeredIterableClassRefs).not.toContain(Map)
    expect(registeredIterableClassRefs).toContain(Set)
    expect(registeredIterableClassRefs).toContain(Array)
    expect(registeredIterableClassRefs).toContain(Object)
  })

  it('removes iterable classes from registered classes', () => {
    deregisterIterableClass(Set)
    expect(registeredClasses).not.toContain(Set)
    deregisterIterableClass(Map)
    expect(registeredClasses).not.toContain(Map)
  })
})
