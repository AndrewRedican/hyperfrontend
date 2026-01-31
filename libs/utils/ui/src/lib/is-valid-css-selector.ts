/**
 * Validates whether a string is a valid CSS selector by attempting to query with it.
 *
 * @param selector - The CSS selector string to validate
 * @returns True if the selector is valid, false otherwise
 */
export function isValidCssSelector(selector: string): boolean {
  try {
    document.createDocumentFragment().querySelector(selector)
    return true
  } catch {
    return false
  }
}
