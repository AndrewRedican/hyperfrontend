import { rgbToHex } from './rgb-to-hex'

/**
 * Converts a CSS RGB string to a hexadecimal color string.
 * Supports both rgb() and rgba() formats.
 *
 * @param rgbString - The RGB string (e.g., "rgb(255, 0, 0)" or "rgba(255, 0, 0, 0.5)")
 * @returns A hexadecimal color string with # prefix
 */
export function rgbStringToHex(rgbString: string): string {
  const rgbaRegex = /^rgba?\((\d{1,3}),\s*(\d{1,3}),\s*(\d{1,3})(?:,\s*((?:0\.)?\d+|1(?:\.0*)?))?\)$/i
  const match = rgbString.match(rgbaRegex)

  if (!match) {
    throw new Error('Invalid RGB or RGBA string')
  }

  const r = parseInt(match[1], 10)
  const g = parseInt(match[2], 10)
  const b = parseInt(match[3], 10)
  const a = match[4] !== undefined ? parseFloat(match[4]) : undefined

  // Check if RGB components are within the valid range (0-255)
  if (r < 0 || r > 255 || g < 0 || g > 255 || b < 0 || b > 255) {
    throw new Error('Invalid RGB or RGBA string')
  }

  // Check if the alpha component is within the valid range (0-1)
  if (a !== undefined) {
    /* istanbul ignore next */
    if (a < 0 || a > 1) {
      throw new Error('Invalid RGB or RGBA string')
    }
  }

  return rgbToHex(r, g, b, a)
}
