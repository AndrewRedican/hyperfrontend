import { getType } from '@hyperfrontend/data-utils'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { round } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'
import { parseInt } from '@hyperfrontend/immutable-api-utils/built-in-copy/number'

export interface Rgb {
  r: number
  g: number
  b: number
  a?: number
}

/**
 * Converts a hexadecimal color string to an RGB object.
 * Supports both 3-digit and 6-digit hex formats with optional alpha channel.
 *
 * @param hex - The hexadecimal color string (with or without # prefix)
 * @param opacity - Optional opacity value (0-1) to override alpha channel
 * @returns An RGB object with r, g, b, and optional a properties, or null if conversion fails
 * @throws {Error} When hex is not a string, opacity is not a number, or hex format is invalid
 */
export function hexToRgb(hex: string, opacity?: number): Rgb | null {
  if (getType(hex) !== 'string') {
    throw createError('Input hex must be a string')
  }

  if (opacity !== void 0 && getType(opacity) !== 'number') {
    throw createError('Input opacity must be a number')
  }

  const match =
    /^#?(([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})?)$/i.exec(hex) || /^#?(([a-f\d])([a-f\d])([a-f\d])([a-f\d])?)$/i.exec(hex)

  if (!match) {
    throw createError('Invalid hex input')
  }

  const r = parseInt(match[2].length === 1 ? match[2] + match[2] : match[2], 16)
  const g = parseInt(match[3].length === 1 ? match[3] + match[3] : match[3], 16)
  const b = parseInt(match[4].length === 1 ? match[4] + match[4] : match[4], 16)

  const result: Rgb = { r, g, b }

  if (match[5]) {
    if (opacity !== void 0) {
      throw createError('Opacity must not be provided when using 8-digit hex code')
    }
    result.a = round((parseInt(match[5], 16) / 255) * 100) / 100
  } else if (opacity !== void 0) {
    result.a = opacity
  }

  return result
}
