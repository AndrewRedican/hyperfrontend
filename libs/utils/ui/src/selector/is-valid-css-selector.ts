/**
 * Validates whether a string is a valid CSS selector by attempting to query with it.
 *
 * @param selector - The CSS selector string to validate
 * @returns True if the selector is valid, false otherwise
 *
 * @example Validating CSS selectors
 * ```typescript
 * isValidCssSelector('.my-class')
 * // => true
 *
 * isValidCssSelector('#header nav > ul')
 * // => true
 *
 * isValidCssSelector('[invalid')
 * // => false
 * ```
 */
export function isValidCssSelector(selector: string): boolean {
  try {
    document.createDocumentFragment().querySelector(selector)
    return true
  } catch {
    return false
  }
}
