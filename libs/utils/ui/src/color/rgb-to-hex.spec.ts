import { describe, expect, it } from '@hyperfrontend/testing'
import { rgbToHex } from './rgb-to-hex'

describe('rgbToHex', () => {
  it.each([
    [17, 34, 51, '#112233'],
    [255, 0, 255, '#ff00ff'],
  ])('converts RGB %p, %p, %p to the 6-digit hex %p', (r: number, g: number, b: number, hex: string) => {
    expect(rgbToHex(r, g, b)).toBe(hex)
  })

  it.each([
    [17, 34, 51, 0.5, '#11223380'],
    [255, 0, 255, 1, '#ff00ffff'],
  ])('converts RGB %p, %p, %p with the opacity %p to the 8-digit hex %p', (r: number, g: number, b: number, a: number, hex: string) => {
    expect(rgbToHex(r, g, b, a)).toBe(hex)
  })

  it.each([
    [0, 0, 0, '#000000'],
    [255, 255, 255, '#ffffff'],
  ])('converts the boundary channels %p, %p, %p to the hex %p', (r: number, g: number, b: number, hex: string) => {
    expect(rgbToHex(r, g, b)).toBe(hex)
  })
})
