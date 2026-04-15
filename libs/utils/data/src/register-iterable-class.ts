import type { RegisteredIterableClassEntry, UnknownClass } from './models'
import { isMarker } from './is-marker'
import { registerClassTypes } from './register-class-types'
import { registeredIterableClasses, getConfig } from './shared/consts'

/**
 * Registers a custom class as iterable, allowing the data utilities API to treat instances
 * as map-like objects with their own unique data type.
 *
 * @param classRef - The class constructor to register
 * @param getKeys - Function that returns all keys from an instance
 * @param read - Function to read a value from an instance by key
 * @param write - Function to write a value to an instance (with optional key)
 * @param remove - Function to remove a key from an instance
 * @param instantiate - Factory function to create new instances (defaults to calling constructor)
 * @remarks
 * If the class is already registered, its entry will be updated with the new handlers.
 *
 * @example Registering custom iterable class
 * ```typescript
 * registerIterableClass(
 *   MyMap,
 *   (m) => [...m.keys()],
 *   (m, k) => m.get(k),
 *   (m, v, k) => m.set(k, v),
 *   (m, k) => m.delete(k)
 * )
 * ```
 */
export const registerIterableClass = <T = unknown>(
  classRef: UnknownClass<T>,
  getKeys: (target: T) => string[],
  read: (target: T, key: unknown) => unknown,
  write: (instance: T, value: unknown, key?: unknown) => void,
  remove: (instance: T, key: unknown) => void,
  instantiate = () => new classRef()
): void => {
  const existingEntryLocation = registeredIterableClasses.findIndex((entry) => entry.classRef === classRef)
  const GetKeys = (target: T) =>
    getConfig().detectCircularReferences ? [...getKeys(target)].filter((key) => !isMarker(key)) : getKeys(target)
  const entry = <RegisteredIterableClassEntry>{
    classRef,
    getKeys: GetKeys,
    read,
    write,
    remove,
    instantiate,
  }
  if (existingEntryLocation >= 0) {
    registeredIterableClasses[existingEntryLocation] = entry
    return
  }
  registeredIterableClasses.unshift(entry)
  registerClassTypes(classRef)
}
