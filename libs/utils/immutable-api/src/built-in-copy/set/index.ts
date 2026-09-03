/**
 * Safe Set factory for protected set construction.
 *
 * @module @hyperfrontend/immutable-api-utils/built-in-copy/set
 */
/* eslint-disable workspace/lib-require-jsdoc-example */

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
export const createSet = <T>(iterable?: Iterable<T> | null): Set<T> => _Reflect.construct(_Set, iterable ? [iterable] : []) as Set<T>

/**
 * (Safe copy) Namespace object containing Set factory.
 * Note: Importing this imports all methods in this namespace (no tree-shaking).
 */
export const Set = _freeze({
  create: createSet,
} as const)
