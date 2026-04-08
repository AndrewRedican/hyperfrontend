/**
 * Checks if a string is a valid marker format.
 *
 * @param text - The string to check
 * @returns True if the string matches the marker pattern
 */
export const isMarker = (text: string): boolean => {
  if (typeof text !== 'string' || !text.startsWith('__$')) return false
  return /^__\$[0-9]+$/.test(text)
}
