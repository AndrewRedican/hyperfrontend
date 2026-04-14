/**
 * Safe WeakSet factory for protected weak set construction.
 *
 * @module @hyperfrontend/immutable-api-utils/built-in-copy/weak-set
 */
/* eslint-disable workspace/lib-require-jsdoc-example */

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
