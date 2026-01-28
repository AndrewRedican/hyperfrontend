import type { Rgb } from './hex-to-rgb'

export function rgbToString({ r, g, b, a }: Rgb): string {
  return a !== void 0 ? `rgba(${r},${g},${b},${a})` : `rgb(${r},${g},${b})`
}
