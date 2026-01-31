import { getType } from '@hyperfrontend/data-utils'
import { hexToRgb } from './hex-to-rgb'
import { rgbToString } from './rgb-to-string'

/**
 * Generates a lighter or darker variation of a base color.
 * Positive intensity lightens the color, negative intensity darkens it.
 *
 * @param baseColor - The base color in hex format (with or without # prefix)
 * @param intensity - The intensity of the variation (-1 to 1, where negative darkens and positive lightens)
 * @returns A hexadecimal color string representing the variation
 */
export function getColorVariation(baseColor: string, intensity: number) {
  if (getType(baseColor) !== 'string' || getType(intensity) !== 'number') {
    throw new Error('Invalid input types. Base color must be a string and intensity must be a number.')
  }

  if (intensity < 0 || intensity > 255) {
    throw new Error('Invalid intensity value. Must be a number between 0 and 255.')
  }

  const baseColorRGB = hexToRgb(baseColor)
  /* istanbul ignore next */
  if (!baseColorRGB) return ''
  const factor = intensity / 255
  const r = Math.round(baseColorRGB.r * factor)
  const g = Math.round(baseColorRGB.g * factor)
  const b = Math.round(baseColorRGB.b * factor)
  const a = factor

  return rgbToString({ r, g, b, a })
}
