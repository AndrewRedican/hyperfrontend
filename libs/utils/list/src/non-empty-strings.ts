/**
 * Filters out empty, null, undefined, and whitespace-only strings from an array.
 *
 * @param values - The array of strings to filter
 * @returns A new array containing only non-empty strings with content
 * @example
 * ```typescript
 * nonEmptyStrings(['hello', '', '  ', 'world', null as unknown as string])
 * // => ['hello', 'world']
 * ```
 */
export function nonEmptyStrings(values: string[]): string[] {
  return values.filter((value) => ![undefined, null, ''].includes(value) && value.trim() !== '')
}
