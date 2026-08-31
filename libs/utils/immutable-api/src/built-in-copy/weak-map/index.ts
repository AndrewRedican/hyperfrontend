/**
 * Safe WeakMap factory for protected weak map construction.
 *
 * @module @hyperfrontend/immutable-api-utils/built-in-copy/weak-map
 */
/* eslint-disable workspace/lib-require-jsdoc-example */

const _WeakMap = globalThis.WeakMap
const _Reflect = globalThis.Reflect
const _freeze = globalThis.Object.freeze

/**
 * (Safe copy) Creates a new WeakMap using the captured WeakMap constructor.
 * Use this instead of `new WeakMap()`.
 *
 * @param iterable - Optional iterable of key-value pairs.
 * @returns A new WeakMap instance.
 */
export const createWeakMap = <K extends WeakKey, V>(iterable?: Iterable<readonly [K, V]> | null): WeakMap<K, V> =>
  _Reflect.construct(_WeakMap, iterable ? [iterable] : []) as WeakMap<K, V>

/**
 * (Safe copy) Namespace object containing WeakMap factory.
 * Note: Importing this imports all methods in this namespace (no tree-shaking).
 */
export const WeakMap = _freeze({
  create: createWeakMap,
} as const)
