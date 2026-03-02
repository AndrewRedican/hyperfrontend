import { from } from '@hyperfrontend/immutable-api-utils/built-in-copy/array'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'

/**
 * Removes duplicate strings from an array, preserving insertion order.
 *
 * @param values - The array of strings to deduplicate
 * @returns A new array containing only unique strings
 */
export function uniqueStrings(values: string[]): string[] {
  return from(createSet(values))
}
