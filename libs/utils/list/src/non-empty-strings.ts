/**
 * Filters out empty, null, undefined, and whitespace-only strings from an array.
 *
 * @param values - The array of strings to filter
 * @returns A new array containing only non-empty strings with content
 */
export function nonEmptyStrings(values: string[]): string[] {
  return values.filter((value) => ![undefined, null, ''].includes(value) && value.trim() !== '')
}
