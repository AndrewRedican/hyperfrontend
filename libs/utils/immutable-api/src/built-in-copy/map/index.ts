/**
 * Safe Map factory with optional groupBy for ES2024+.
 *
 * @module @hyperfrontend/immutable-api-utils/built-in-copy/map
 */
/* eslint-disable workspace/lib-require-jsdoc-example */

const _Map = globalThis.Map
const _Reflect = globalThis.Reflect
const _freeze = globalThis.Object.freeze

/**
 * (Safe copy) Creates a new Map using the captured Map constructor.
 * Use this instead of `new Map()`.
 *
 * @param iterable - Optional iterable of key-value pairs.
 * @returns A new Map instance.
 */
export const createMap = <K, V>(iterable?: Iterable<readonly [K, V]> | null): Map<K, V> =>
  _Reflect.construct(_Map, iterable ? [iterable] : []) as Map<K, V>

/**
 * (Safe copy) Groups elements by key using the captured Map.groupBy if available.
 * Note: Available only in ES2024+ environments.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const mapGroupBy = (_Map as any).groupBy

/**
 * (Safe copy) Namespace object containing Map factory.
 * Note: Importing this imports all methods in this namespace (no tree-shaking).
 */
export const Map = _freeze({
  create: createMap,
  groupBy: mapGroupBy,
} as const)
