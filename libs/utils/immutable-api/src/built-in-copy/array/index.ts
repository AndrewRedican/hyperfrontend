/**
 * Safe copies of Array built-in static methods.
 *
 * These references are captured at module initialization time to protect against
 * prototype pollution attacks. Import only what you need for tree-shaking.
 *
 * @module @hyperfrontend/immutable-api-utils/built-in-copy/array
 */

const _Array = globalThis.Array
const _freeze = globalThis.Object.freeze

/**
 * (Safe copy) Determines whether the passed value is an Array.
 */
export const isArray = _Array.isArray

/**
 * (Safe copy) Creates an array from an array-like or iterable object.
 */
export const from = _Array.from

/**
 * (Safe copy) Creates a new Array instance from a variable number of arguments.
 */
export const of = _Array.of

/**
 * (Safe copy) Namespace object containing all Array static methods.
 * Note: Importing this imports all methods in this namespace (no tree-shaking).
 */
export const Array = _freeze(<const>{
  isArray,
  from,
  of,
})
