import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { parseFloat, parseInt } from '@hyperfrontend/immutable-api-utils/built-in-copy/number'
import { rgbToHex } from './rgb-to-hex'

/**
 * Converts a CSS RGB string to a hexadecimal color string.
 * Supports both rgb() and rgba() formats.
 *
 * @param rgbString - The RGB string (e.g., "rgb(255, 0, 0)" or "rgba(255, 0, 0, 0.5)")
 * @returns A hexadecimal color string with # prefix
 *
 * @example RGB string
 * ```typescript
 * rgbStringToHex('rgb(255, 87, 51)')
 * // => '#ff5733'
 * ```
 *
 * @example RGBA string with alpha
 * ```typescript
 * rgbStringToHex('rgba(52, 152, 219, 0.5)')
 * // => '#3498db80'
 * ```
 */
export function rgbStringToHex(rgbString: string): string {
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

  if (r < 0 || r > 255 || g < 0 || g > 255 || b < 0 || b > 255) {
    throw createError('Invalid RGB or RGBA string')
  }

  if (a !== undefined) {
    /* istanbul ignore next */
    if (a < 0 || a > 1) {
      throw createError('Invalid RGB or RGBA string')
    }
  }

  return rgbToHex(r, g, b, a)
}
