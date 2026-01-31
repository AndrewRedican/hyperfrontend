/**
 * Converts RGB(A) color values to a hexadecimal color string.
 *
 * @param r - The red component (0-255)
 * @param g - The green component (0-255)
 * @param b - The blue component (0-255)
 * @param a - Optional alpha component (0-1)
 * @returns A hexadecimal color string with # prefix
 */
export function rgbToHex(r: number, g: number, b: number, a?: number): string {
  const rgbToHexComponent = (value: number): string => value.toString(16).padStart(2, '0')
  let hex = `#${rgbToHexComponent(r)}${rgbToHexComponent(g)}${rgbToHexComponent(b)}`

  if (a !== undefined) {
    hex += rgbToHexComponent(Math.round(a * 255))
  }

  return hex
}
