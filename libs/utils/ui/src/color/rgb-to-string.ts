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
 *
 * @example Without alpha
 * ```typescript
 * rgbToString({ r: 255, g: 87, b: 51 })
 * // => 'rgb(255,87,51)'
 * ```
 *
 * @example With alpha
 * ```typescript
 * rgbToString({ r: 52, g: 152, b: 219, a: 0.5 })
 * // => 'rgba(52,152,219,0.5)'
 * ```
 */
export function rgbToString({ r, g, b, a }: Rgb): string {
  return a !== void 0 ? `rgba(${r},${g},${b},${a})` : `rgb(${r},${g},${b})`
}
