import { entries, fromEntries } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'

/**
 * Builds a shallow copy of `source` with the supplied `keys` removed.
 * Replaces the destructure-and-discard pattern (`const { x: _x, ...rest } = obj`)
 * that leaves unused-variable warnings behind.
 *
 * @param source - Object to copy
 * @param keys - Keys to drop from the copy
 * @returns New object without the listed keys
 *
 * @example Dropping a single key
 * ```typescript
 * omitKeys({ a: 1, b: 2 }, ['a']) // => { b: 2 }
 * ```
 *
 * @example Dropping multiple keys at once
 * ```typescript
 * omitKeys({ a: 1, b: 2, c: 3 }, ['a', 'c']) // => { b: 2 }
 * ```
 */
export function omitKeys<T extends object, K extends keyof T>(source: T, keys: readonly K[]): Omit<T, K> {
  const dropSet = createSet<PropertyKey>(keys)
  return <Omit<T, K>>fromEntries(entries(source).filter(([key]) => !dropSet.has(key)))
}
