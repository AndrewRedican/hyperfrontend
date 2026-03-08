import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { parseFloat, parseInt } from '@hyperfrontend/immutable-api-utils/built-in-copy/number'
import { rgbToHex } from './rgb-to-hex'

/**
 * Converts a CSS RGB string to a hexadecimal color string.
 * Supports both rgb() and rgba() formats.
 *
 * @param rgbString - The RGB string (e.g., "rgb(255, 0, 0)" or "rgba(255, 0, 0, 0.5)")
 * @returns A hexadecimal color string with # prefix
 */
export function rgbStringToHex(rgbString: string): string {
  // Match rgb/rgba with explicit bounds to avoid ReDoS
  const rgbOnlyRegex = /^rgba?\((\d{1,3}),\s*(\d{1,3}),\s*(\d{1,3})\)$/i
  const rgbaRegex = /^rgba?\((\d{1,3}),\s*(\d{1,3}),\s*(\d{1,3}),\s*(\d\.?\d*)\)$/i
  const match = rgbString.match(rgbaRegex) || rgbString.match(rgbOnlyRegex)

  if (!match) {
    throw createError('Invalid RGB or RGBA string')
  }

  const r = parseInt(match[1], 10)
  const g = parseInt(match[2], 10)
  const b = parseInt(match[3], 10)
  const a = match[4] !== undefined ? parseFloat(match[4]) : undefined

  // Check if RGB components are within the valid range (0-255)
  if (r < 0 || r > 255 || g < 0 || g > 255 || b < 0 || b > 255) {
    throw createError('Invalid RGB or RGBA string')
  }

  // Check if the alpha component is within the valid range (0-1)
  if (a !== undefined) {
    /* istanbul ignore next */
    if (a < 0 || a > 1) {
      throw createError('Invalid RGB or RGBA string')
    }
  }

  return rgbToHex(r, g, b, a)
}
