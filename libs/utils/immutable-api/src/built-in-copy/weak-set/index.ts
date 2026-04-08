/* eslint-disable workspace/lib-require-jsdoc-example */
/**
 * Safe copies of WeakSet built-in via factory function.
 *
 * Since constructors cannot be safely captured via Object.assign, this module
 * provides a factory function that uses Reflect.construct internally.
 *
 * These references are captured at module initialization time to protect against
 * prototype pollution attacks. Import only what you need for tree-shaking.
 *
 * @module @hyperfrontend/immutable-api-utils/built-in-copy/weak-set
 */

const _WeakSet = globalThis.WeakSet
const _Reflect = globalThis.Reflect
const _freeze = globalThis.Object.freeze

/**
 * (Safe copy) Creates a new WeakSet using the captured WeakSet constructor.
 * Use this instead of `new WeakSet()`.
 *
 * @param iterable - Optional iterable of values.
 * @returns A new WeakSet instance.
 */
export const createWeakSet = <T extends WeakKey>(iterable?: Iterable<T> | null): WeakSet<T> =>
  <WeakSet<T>>_Reflect.construct(_WeakSet, iterable ? [iterable] : [])

/**
 * (Safe copy) Namespace object containing WeakSet factory.
 * Note: Importing this imports all methods in this namespace (no tree-shaking).
 */
export const WeakSet = _freeze(<const>{
  create: createWeakSet,
})
