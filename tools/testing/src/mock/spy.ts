import type { MockFn } from './types'
import { createMockFn } from './mock-fn'

/**
 * Which flavour of property a spy replaces.
 */
export type AccessType = 'get' | 'set'

/**
 * Every spy still holding a replaced property, so `jest.restoreAllMocks` can put them all
 * back without the test naming each one.
 */
const installed = new Set<MockFn>()

/**
 * Restores every property replaced by a spy in this process.
 */
export function restoreAllMocks(): void {
  for (const spy of [...installed]) spy.mockRestore()
}

/**
 * Finds a property descriptor on an object or anywhere up its prototype chain.
 *
 * @param target - The object to search.
 * @param key - The property to find.
 * @returns The descriptor, or undefined when the property does not exist.
 */
function findDescriptor(target: object, key: PropertyKey): PropertyDescriptor | undefined {
  let current: object | null = target
  while (current) {
    const descriptor = Object.getOwnPropertyDescriptor(current, key)
    if (descriptor) return descriptor
    current = Object.getPrototypeOf(current)
  }
  return undefined
}

/**
 * Replaces a method or accessor with a mock that calls through to the original by default.
 *
 * Unlike Node's own `mock.method`, the replacement persists until it is restored
 * explicitly or by `jest.restoreAllMocks`, matching the lifetime specs expect.
 *
 * @param target - The object owning the property.
 * @param key - The property to replace.
 * @param accessType - Replace the getter or setter instead of the value.
 * @returns The installed mock.
 */
export function createSpy(target: object, key: PropertyKey, accessType?: AccessType): MockFn {
  const descriptor = findDescriptor(target, key)
  if (!descriptor) throw new TypeError(`Cannot spy on ${String(key)}: the property does not exist on the target or its prototypes`)

  const original = accessType ? descriptor[accessType] : descriptor.value
  const spy = createMockFn(typeof original === 'function' ? (original as (...args: unknown[]) => unknown) : undefined)
  const ownDescriptor = Object.getOwnPropertyDescriptor(target, key)

  spy.mockRestore = () => {
    // why: the property may have been inherited, in which case deleting restores the prototype's version.
    if (ownDescriptor) Object.defineProperty(target, key, ownDescriptor)
    else delete (target as Record<PropertyKey, unknown>)[key]
    installed.delete(spy)
    return spy
  }

  if (accessType) Object.defineProperty(target, key, { ...descriptor, [accessType]: spy, configurable: true })
  else Object.defineProperty(target, key, { ...descriptor, value: spy, configurable: true, writable: true })

  installed.add(spy)
  return spy
}
