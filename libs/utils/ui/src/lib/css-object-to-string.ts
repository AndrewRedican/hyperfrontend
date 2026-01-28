/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Style } from '../style'

export function cssObjectToString(cssObj: Style): string {
  const errors: string[] = []

  const cssString = Object.entries(cssObj).reduce((prev, [property, value]) => {
    try {
      // Convert camelCase property to kebab-case.
      const kebabCaseProperty = property.replace(/([a-z0-9]|(?=[A-Z]))([A-Z])/g, '$1-$2').toLowerCase()

      // Check if value is an empty string and handle it
      const cssValue = value === '' ? `''` : value

      return `${prev}${kebabCaseProperty}: ${cssValue}; `
    } catch (error) {
      errors.push(`Failed to convert property "${property}". Error: ${(error as any).message}`)
      return prev
    }
  }, '')

  if (errors.length > 0) {
    console.warn('Some properties failed to convert:\n' + errors.join('\n'))
  }

  return cssString
}
