/**
 * Safe copies of Reflect built-in methods.
 *
 * These references are captured at module initialization time to protect against
 * prototype pollution attacks. Import only what you need for tree-shaking.
 *
 * @module @hyperfrontend/immutable-api-utils/built-in-copy/reflect
 */

const _Reflect = globalThis.Reflect
const _freeze = globalThis.Object.freeze

/**
 * (Safe copy) Calls the function with the specified object as the this value
 * and the elements of specified array as the arguments.
 */
export const apply = _Reflect.apply

/**
 * (Safe copy) Constructs the target with the elements of specified array as the arguments.
 */
export const construct = _Reflect.construct

/**
 * (Safe copy) Gets the property of target, equivalent to target[propertyKey].
 */
export const get = _Reflect.get

/**
 * (Safe copy) Sets the property of target, equivalent to target[propertyKey] = value.
 */
export const set = _Reflect.set

/**
 * (Safe copy) Determines whether an object has a property with the specified name.
 */
export const has = _Reflect.has

/**
 * (Safe copy) Returns an array of the target object's own property keys.
 */
export const ownKeys = _Reflect.ownKeys

/**
 * (Safe copy) Adds or modifies a property on an object.
 */
export const defineProperty = _Reflect.defineProperty

/**
 * (Safe copy) Deletes a property from an object.
 */
export const deleteProperty = _Reflect.deleteProperty

/**
 * (Safe copy) Gets the property descriptor of the specified property.
 */
export const getOwnPropertyDescriptor = _Reflect.getOwnPropertyDescriptor

/**
 * (Safe copy) Returns the prototype of the specified object.
 */
export const getPrototypeOf = _Reflect.getPrototypeOf

/**
 * (Safe copy) Sets the prototype of the specified object.
 */
export const setPrototypeOf = _Reflect.setPrototypeOf

/**
 * (Safe copy) Returns a boolean indicating whether the object is extensible.
 */
export const isExtensible = _Reflect.isExtensible

/**
 * (Safe copy) Prevents new properties from being added to the object.
 */
export const preventExtensions = _Reflect.preventExtensions

/**
 * (Safe copy) Namespace object containing all Reflect methods.
 * Note: Importing this imports all methods in this namespace (no tree-shaking).
 */
export const Reflect = _freeze({
  apply,
  construct,
  get,
  set,
  has,
  ownKeys,
  defineProperty,
  deleteProperty,
  getOwnPropertyDescriptor,
  getPrototypeOf,
  setPrototypeOf,
  isExtensible,
  preventExtensions,
} as const)
