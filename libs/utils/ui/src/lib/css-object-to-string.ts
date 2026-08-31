/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Style } from '../style'
import { entries } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { logger } from '@hyperfrontend/logging'

/**
 * Converts a CSS object into a CSS string suitable for inline styles or style sheets.
 * Automatically converts camelCase properties to kebab-case.
 *
 * @param cssObj - The CSS object with property-value pairs
 * @returns A CSS string representation
 *
 * @example Converting style object to CSS
 * ```typescript
 * const styles = {
 *   backgroundColor: '#f0f0f0',
 *   fontSize: '14px',
 *   marginTop: '8px'
 * }
 *
 * cssObjectToString(styles)
 * // => 'background-color: #f0f0f0; font-size: 14px; margin-top: 8px; '
 * ```
 */
export function cssObjectToString(cssObj: Style): string {
  const errors: string[] = []

  const cssString = entries(cssObj).reduce((prev, [property, value]) => {
    try {
      const kebabCaseProperty = property.replace(/([a-z0-9]|(?=[A-Z]))([A-Z])/g, '$1-$2').toLowerCase()

      const cssValue = value === '' ? `''` : value

      return `${prev}${kebabCaseProperty}: ${cssValue}; `
    } catch (error) {
      errors.push(`Failed to convert property "${property}". Error: ${(error as any).message}`)
      return prev
    }
  }, '')

  if (errors.length > 0) {
    logger.warn('Some properties failed to convert:\n' + errors.join('\n'))
  }

  return cssString
}
