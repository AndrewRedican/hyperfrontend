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
      if ((a as unknown[]).length !== (b as unknown[]).length) return false
      for (let i = 0; i < (a as unknown[]).length; i++) {
        if (!isEqual((a as unknown[])[i], (b as unknown[])[i])) return false
      }
      return true
    }

    if (isArray(a) || isArray(b)) return false

    const keysA = keys(a as object)
    const keysB = keys(b as object)
    if (keysA.length !== keysB.length) return false

    for (const key of keysA) {
      if (!hasOwn(b as object, key)) return false
      if (!isEqual((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key])) return false
    }
    return true
  }

  return false
}
