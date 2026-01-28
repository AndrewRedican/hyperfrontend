export function rgbToHex(r: number, g: number, b: number, a?: number): string {
  const rgbToHexComponent = (value: number): string => value.toString(16).padStart(2, '0')
  let hex = `#${rgbToHexComponent(r)}${rgbToHexComponent(g)}${rgbToHexComponent(b)}`

  if (a !== undefined) {
    hex += rgbToHexComponent(Math.round(a * 255))
  }

  return hex
}
