import type { Style } from '../style'
import { getType } from '@hyperfrontend/data-utils'
import { cssObjectToString } from './css-object-to-string'
import { isValidCssSelector } from './is-valid-css-selector'

/**
 * Generates a CSS rule string from a given selector and style declaration.
 *
 * This function takes a CSS selector and either a string or a CSSStyleDeclaration object
 * representing the styles to be applied. It validates the selector and converts the CSS
 * object to a string if needed. The function then constructs and returns a valid
 * CSS rule as a string.
 *
 * @param selector - The CSS selector to which the styles will be applied
 * @param css - The styles to apply, either as a string or CSSStyleDeclaration object
 * @returns A string representing a complete CSS rule
 * @throws {Error} When the selector is invalid or the css argument is not a valid string or object
 */
export function cssRule(selector: string, css: string | Style): string {
  if (!isValidCssSelector(selector)) {
    throw new Error('A valid css select must be provided')
  }
  if (getType(css) === 'object') {
    css = cssObjectToString(css as Style).trim()
  }

  if (getType(css) !== 'string' || css.length === 0) {
    throw new Error('A valid string value must be provided to add in styleesheet.')
  }
  return `${selector}{${css}}`
}
