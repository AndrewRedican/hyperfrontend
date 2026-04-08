/* eslint-disable workspace/lib-require-jsdoc-example */
/**
 * Safe copies of Set built-in via factory function.
 *
 * Since constructors cannot be safely captured via Object.assign, this module
 * provides a factory function that uses Reflect.construct internally.
 *
 * These references are captured at module initialization time to protect against
 * prototype pollution attacks. Import only what you need for tree-shaking.
 *
 * @module @hyperfrontend/immutable-api-utils/built-in-copy/set
 */

const _Set = globalThis.Set
const _Reflect = globalThis.Reflect
const _freeze = globalThis.Object.freeze

/**
 * (Safe copy) Creates a new Set using the captured Set constructor.
 * Use this instead of `new Set()`.
 *
 * @param iterable - Optional iterable of values.
 * @returns A new Set instance.
 */
export const createSet = <T>(iterable?: Iterable<T> | null): Set<T> => <Set<T>>_Reflect.construct(_Set, iterable ? [iterable] : [])

/**
 * (Safe copy) Namespace object containing Set factory.
 * Note: Importing this imports all methods in this namespace (no tree-shaking).
 */
export const Set = _freeze(<const>{
  create: createSet,
})
