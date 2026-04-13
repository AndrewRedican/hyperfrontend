/**
 * Checks if a string is a valid marker format.
 *
 * @param text - The string to check
 * @returns True if the string matches the marker pattern
 *
 * @example Validating marker format
 * ```typescript
 * isMarker('__$0') // true
 * isMarker('__$123') // true
 * isMarker('regular') // false
 * ```
 */
export const isMarker = (text: string): boolean => {
  if (typeof text !== 'string' || !text.startsWith('__$')) return false
  return /^__\$[0-9]+$/.test(text)
}
