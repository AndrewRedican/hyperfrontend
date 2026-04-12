/**
 * Safe copies of Object built-in methods.
 *
 * These references are captured at module initialization time to protect against
 * prototype pollution attacks. Import only what you need for tree-shaking.
 *
 * @module @hyperfrontend/immutable-api-utils/built-in-copy/object
 */

const _Object = globalThis.Object
const _Reflect = globalThis.Reflect
const _ObjectPrototype = _Object.prototype
const _hasOwnProperty = _ObjectPrototype.hasOwnProperty
const _toString = _ObjectPrototype.toString

/**
 * (Safe copy) Prevents modification of existing property attributes and values,
 * and prevents the addition of new properties.
 */
export const freeze = _Object.freeze

/**
 * (Safe copy) Creates an object that has the specified prototype or that has null prototype.
 */
export const create = _Object.create

/**
 * (Safe copy) Returns the names of the enumerable string properties and methods of an object.
 */
export const keys = _Object.keys

/**
 * (Safe copy) Returns an array of key/values of the enumerable own properties of an object.
 */
export const entries = _Object.entries

/**
 * (Safe copy) Returns an array of values of the enumerable own properties of an object.
 */
export const values = _Object.values

/**
 * (Safe copy) Returns an object from an iterable of key-value pairs.
 */
export const fromEntries = _Object.fromEntries

/**
 * (Safe copy) Copy the values of all enumerable own properties from one or more source objects
 * to a target object. Returns the target object.
 */
export const assign = _Object.assign

/**
 * (Safe copy) Adds a property to an object, or modifies attributes of an existing property.
 */
export const defineProperty = _Object.defineProperty

/**
 * (Safe copy) Adds one or more properties to an object, and/or modifies attributes of existing properties.
 */
export const defineProperties = _Object.defineProperties

/**
 * (Safe copy) Determines whether an object has a property with the specified name.
 */
export const objectHasOwn = _Object.hasOwn

/**
 * (Safe copy) Sets the prototype of a specified object o to object proto or null.
 */
export const setPrototypeOf = _Object.setPrototypeOf

/**
 * (Safe copy) Returns the prototype of an object.
 */
export const getPrototypeOf = _Object.getPrototypeOf

/**
 * (Safe copy) Prevents the addition of new properties to an object.
 */
export const seal = _Object.seal

/**
 * (Safe copy) Returns true if existing property attributes and values cannot be modified
 * in an object, and new properties cannot be added to the object.
 */
export const isFrozen = _Object.isFrozen

/**
 * (Safe copy) Returns true if existing property attributes cannot be modified in an object
 * and new properties cannot be added to the object.
 */
export const isSealed = _Object.isSealed

/**
 * (Safe copy) Returns a value that indicates whether new properties can be added to an object.
 */
export const isExtensible = _Object.isExtensible

/**
 * (Safe copy) Prevents the addition of new properties to an object.
 */
export const preventExtensions = _Object.preventExtensions

/**
 * (Safe copy) Gets the own property descriptor of the specified object.
 */
export const getOwnPropertyDescriptor = _Object.getOwnPropertyDescriptor

/**
 * (Safe copy) Returns the names of the own properties of an object.
 */
export const getOwnPropertyNames = _Object.getOwnPropertyNames

/**
 * (Safe copy) Returns an array of all symbol properties found directly on object o.
 */
export const getOwnPropertySymbols = _Object.getOwnPropertySymbols

/**
 * (Safe copy) Gets the own property descriptors of the specified object.
 */
export const getOwnPropertyDescriptors = _Object.getOwnPropertyDescriptors

/**
 * (Safe copy) Safe wrapper for Object.prototype.hasOwnProperty.call().
 * Checks if an object has a property as its own (not inherited) property.
 *
 * @param obj - The object to check.
 * @param key - The property key to check.
 * @returns True if the object has the property as its own property.
 *
 * @example Checking own properties
 * ```typescript
 * const user = { name: 'Alice' }
 * hasOwn(user, 'name') // => true
 * hasOwn(user, 'toString') // => false (inherited from prototype)
 * ```
 */
export const hasOwn = (obj: object, key: PropertyKey): boolean => <boolean>_Reflect.apply(_hasOwnProperty, obj, [key])

/**
 * (Safe copy) Safe wrapper for Object.prototype.toString.call().
 * Returns the internal [[Class]] property of the object as a string tag.
 *
 * @param value - The value to get the type tag from.
 * @returns The type tag string (e.g., "[object Array]").
 *
 * @example Getting type tags
 * ```typescript
 * typeTag([1, 2, 3]) // => '[object Array]'
 * typeTag(null) // => '[object Null]'
 * typeTag(Promise.resolve()) // => '[object Promise]'
 * ```
 */
export const typeTag = (value: unknown): string => <string>_Reflect.apply(_toString, value, [])

/**
 * (Safe copy) Namespace object containing all Object static methods.
 * Note: Importing this imports all methods in this namespace (no tree-shaking).
 * Named SafeObject instead of Object to avoid shadowing global Object during CJS module initialization.
 */
export const SafeObject = _Object.freeze(<const>{
  freeze,
  create,
  keys,
  entries,
  values,
  fromEntries,
  assign,
  defineProperty,
  defineProperties,
  hasOwn: objectHasOwn,
  setPrototypeOf,
  getPrototypeOf,
  seal,
  isFrozen,
  isSealed,
  isExtensible,
  preventExtensions,
  getOwnPropertyDescriptor,
  getOwnPropertyNames,
  getOwnPropertySymbols,
  getOwnPropertyDescriptors,
})
