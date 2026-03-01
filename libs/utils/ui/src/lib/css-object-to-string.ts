/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Style } from '../style'
import { warn } from '@hyperfrontend/immutable-api-utils/built-in-copy/console'
import { entries } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'

/**
 * Converts a CSS object into a CSS string suitable for inline styles or style sheets.
 * Automatically converts camelCase properties to kebab-case.
 *
 * @param cssObj - The CSS object with property-value pairs
 * @returns A CSS string representation
 */
export function cssObjectToString(cssObj: Style): string {
  const errors: string[] = []

  const cssString = entries(cssObj).reduce((prev, [property, value]) => {
    try {
      // Convert camelCase property to kebab-case.
      const kebabCaseProperty = property.replace(/([a-z0-9]|(?=[A-Z]))([A-Z])/g, '$1-$2').toLowerCase()

      // Check if value is an empty string and handle it
      const cssValue = value === '' ? `''` : value

      return `${prev}${kebabCaseProperty}: ${cssValue}; `
    } catch (error) {
      errors.push(`Failed to convert property "${property}". Error: ${(<any>error).message}`)
      return prev
    }
  }, '')

  if (errors.length > 0) {
    warn('Some properties failed to convert:\n' + errors.join('\n'))
  }

  return cssString
}
