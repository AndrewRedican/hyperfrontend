import { getType } from '@hyperfrontend/data-utils'

export interface Rgb {
  r: number
  g: number
  b: number
  a?: number
}

export function hexToRgb(hex: string, opacity?: number): Rgb | null {
  if (getType(hex) !== 'string') {
    throw new Error('Input hex must be a string')
  }

  if (opacity !== void 0 && getType(opacity) !== 'number') {
    throw new Error('Input opacity must be a number')
  }

  const match =
    /^#?(([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})?)$/i.exec(hex) || /^#?(([a-f\d])([a-f\d])([a-f\d])([a-f\d])?)$/i.exec(hex)

  if (!match) {
    throw new Error('Invalid hex input')
  }

  const r = parseInt(match[2].length === 1 ? match[2] + match[2] : match[2], 16)
  const g = parseInt(match[3].length === 1 ? match[3] + match[3] : match[3], 16)
  const b = parseInt(match[4].length === 1 ? match[4] + match[4] : match[4], 16)

  const result: Rgb = { r, g, b }

  if (match[5]) {
    if (opacity !== void 0) {
      throw new Error('Opacity must not be provided when using 8-digit hex code')
    }
    result.a = Math.round((parseInt(match[5], 16) / 255) * 100) / 100
  } else if (opacity !== void 0) {
    result.a = opacity
  }

  return result
}
