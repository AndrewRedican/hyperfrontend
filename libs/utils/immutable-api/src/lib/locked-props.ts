import { createTypeError } from '../built-in-copy/error'
import { create, defineProperties } from '../built-in-copy/object'
import { lockedPropertyDescriptors } from './locked-prop-descriptors'

/** Locks multiple properties on an object making them non-writable and non-configurable. */
export type PropertyLock = (
  object: object,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  propertyValuePairs: [string, any][]
) => void

/**
 * Locks multiple properties on an object making them non-writable and non-configurable.
 *
 * @param object - The object to lock properties on
 * @param propertyValuePairs - Array of [key, value] pairs to lock
 * @throws {TypeError} When a key is `__proto__`, which is never a property a locked object should carry.
 *
 * @example Locking multiple properties
 * ```typescript
 * const config = {}
 * lockedProps(config, [
 *   ['apiUrl', 'https://api.example.com'],
 *   ['version', '1.0.0'],
 * ])
 * config.apiUrl = 'hacked' // throws in strict mode, silently fails otherwise
 * ```
 */
export const lockedProps: PropertyLock = (object, propertyValuePairs) => {
  // why: a null-prototype map keeps every key a plain key, so nothing here can ever reassign the map's prototype.
  const propertyMap: PropertyDescriptorMap = create(null)
  propertyValuePairs.forEach(([key, value]) => {
    // why: an own __proto__ property is the shape of a prototype-pollution payload, so refusing it beats defining or silently skipping it.
    if (key === '__proto__') {
      throw createTypeError('Cannot lock a property named __proto__')
    }
    propertyMap[key] = lockedPropertyDescriptors(value)
  })
  defineProperties(object, propertyMap)
}
