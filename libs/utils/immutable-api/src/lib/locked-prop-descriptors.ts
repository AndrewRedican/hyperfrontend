/** Creates locked property descriptors with specified value and enumerability. */
export type LockedPropDescriptorsCreator = (value: unknown, enumerable?: boolean) => PropertyDescriptor

export const lockedPropertyDescriptors: LockedPropDescriptorsCreator = (value, enumerable = false) => ({
  value,
  writable: false,
  configurable: false,
  enumerable,
})
