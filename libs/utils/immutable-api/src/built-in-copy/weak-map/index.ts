/**
 * Safe copies of WeakMap built-in via factory function.
 *
 * Since constructors cannot be safely captured via Object.assign, this module
 * provides a factory function that uses Reflect.construct internally.
 *
 * These references are captured at module initialization time to protect against
 * prototype pollution attacks. Import only what you need for tree-shaking.
 *
 * @module @hyperfrontend/immutable-api-utils/built-in-copy/weak-map
 */

// Capture references at module initialization time
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
  <WeakMap<K, V>>_Reflect.construct(_WeakMap, iterable ? [iterable] : [])

/**
 * (Safe copy) Namespace object containing WeakMap factory.
 * Note: Importing this imports all methods in this namespace (no tree-shaking).
 */
export const WeakMap = _freeze(<const>{
  create: createWeakMap,
})
