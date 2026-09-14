import { getType } from '@hyperfrontend/data-utils'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { round } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'
import { parseInt } from '@hyperfrontend/immutable-api-utils/built-in-copy/number'

/**
 * RGB color representation with optional alpha channel.
 */
export interface Rgb {
  /** Red channel (0-255) */
  r: number
  /** Green channel (0-255) */
  g: number
  /** Blue channel (0-255) */
  b: number
  /** Alpha channel (0-1) */
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
 *
 * @example 6-digit hex
 * ```typescript
 * hexToRgb('#ff5733')
 * // => { r: 255, g: 87, b: 51 }
 * ```
 *
 * @example 3-digit shorthand
 * ```typescript
 * hexToRgb('#f00')
 * // => { r: 255, g: 0, b: 0 }
 * ```
 *
 * @example With opacity override
 * ```typescript
 * hexToRgb('#3498db', 0.5)
 * // => { r: 52, g: 152, b: 219, a: 0.5 }
 * ```
 */
export function hexToRgb(hex: string, opacity?: number): Rgb | null {
  if (getType(hex) !== 'string') {
    throw createError('Input hex must be a string')
  }

  if (opacity !== void 0 && getType(opacity) !== 'number') {
    throw createError('Input opacity must be a number')
  }

  const match6 = /^#?([a-fA-F0-9]{2})([a-fA-F0-9]{2})([a-fA-F0-9]{2})$/i.exec(hex)
  const match8 = /^#?([a-fA-F0-9]{2})([a-fA-F0-9]{2})([a-fA-F0-9]{2})([a-fA-F0-9]{2})$/i.exec(hex)
  const match3 = /^#?([a-fA-F0-9])([a-fA-F0-9])([a-fA-F0-9])$/i.exec(hex)
  const match4 = /^#?([a-fA-F0-9])([a-fA-F0-9])([a-fA-F0-9])([a-fA-F0-9])$/i.exec(hex)
  const match = match8 || match6 || match4 || match3
  const isShortForm = !match8 && !match6 && (!!match3 || !!match4)
  const hasAlpha = !!match8 || !!match4

  if (!match) {
    throw createError('Invalid hex input')
  }

  const r = parseInt(isShortForm ? match[1] + match[1] : match[1], 16)
  const g = parseInt(isShortForm ? match[2] + match[2] : match[2], 16)
  const b = parseInt(isShortForm ? match[3] + match[3] : match[3], 16)

  const result: Rgb = { r, g, b }

  if (hasAlpha) {
    if (opacity !== void 0) {
      throw createError('Opacity must not be provided when using 8-digit hex code')
    }
    const alphaValue = isShortForm ? match[4] + match[4] : match[4]
    result.a = round((parseInt(alphaValue, 16) / 255) * 100) / 100
  } else if (opacity !== void 0) {
    result.a = opacity
  }

  return result
}
