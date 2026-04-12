/** Creates locked property descriptors with specified value and enumerability. */
export type LockedPropDescriptorsCreator = (value: unknown, enumerable?: boolean) => PropertyDescriptor

/**
 * Creates property descriptors that lock a property as non-writable and non-configurable.
 *
 * @param value - The value for the property
 * @param enumerable - Whether the property should be enumerable
 * @returns PropertyDescriptor with locked configuration
 *
 * @example Creating locked property descriptor
 * ```typescript
 * const descriptor = lockedPropertyDescriptors('immutable', true)
 * // => { value: 'immutable', writable: false, configurable: false, enumerable: true }
 * Object.defineProperty(obj, 'key', descriptor)
 * ```
 */
export const lockedPropertyDescriptors: LockedPropDescriptorsCreator = (value, enumerable = false) => ({
  value,
  writable: false,
  configurable: false,
  enumerable,
})
