/**
 * Removes duplicate strings from an array, preserving insertion order.
 *
 * @param values - The array of strings to deduplicate
 * @returns A new array containing only unique strings
 */
export function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values))
}
