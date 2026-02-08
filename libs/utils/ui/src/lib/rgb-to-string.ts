import type { Rgb } from './hex-to-rgb'

/**
 * Converts an RGB object to a CSS color string (rgba format).
 *
 * @param rgb - Object containing RGB values
 * @param rgb.r - The red component (0-255)
 * @param rgb.g - The green component (0-255)
 * @param rgb.b - The blue component (0-255)
 * @param rgb.a - Optional alpha component (0-1)
 * @returns A CSS rgba color string
 */
export function rgbToString({ r, g, b, a }: Rgb): string {
  return a !== void 0 ? `rgba(${r},${g},${b},${a})` : `rgb(${r},${g},${b})`
}
