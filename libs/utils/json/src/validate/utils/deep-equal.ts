import { isArray } from '@hyperfrontend/immutable-api-utils/built-in-copy/array'
import { keys, hasOwn } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'

/**
 * Performs deep equality check for JSON values.
 *
 * Used for enum validation and uniqueItems validation.
 *
 * @param a - First value to compare
 * @param b - Second value to compare
 * @returns true if values are deeply equal, false otherwise
 * @example Comparing values for equality
 * ```typescript
 * isEqual({ name: 'Alice' }, { name: 'Alice' }) // => true
 * isEqual([1, 2, 3], [1, 2, 3])                 // => true
 * isEqual({ a: 1 }, { a: 2 })                   // => false
 * isEqual([1, 2], [2, 1])                       // => false (order matters)
 * ```
 */
export function isEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (a === null || b === null) return false
  if (typeof a !== typeof b) return false

  if (typeof a === 'object') {
    if (isArray(a) && isArray(b)) {
      if ((<unknown[]>a).length !== (<unknown[]>b).length) return false
      for (let i = 0; i < (<unknown[]>a).length; i++) {
        if (!isEqual((<unknown[]>a)[i], (<unknown[]>b)[i])) return false
      }
      return true
    }

    if (isArray(a) || isArray(b)) return false

    const keysA = keys(<object>a)
    const keysB = keys(<object>b)
    if (keysA.length !== keysB.length) return false

    for (const key of keysA) {
      if (!hasOwn(<object>b, key)) return false
      if (!isEqual((<Record<string, unknown>>a)[key], (<Record<string, unknown>>b)[key])) return false
    }
    return true
  }

  return false
}
