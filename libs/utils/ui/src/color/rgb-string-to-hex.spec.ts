import { describe, expect, it } from '@hyperfrontend/testing'
import { rgbStringToHex } from './rgb-string-to-hex'

describe('rgbStringToHex', () => {
  it('converts an RGB string to its HEX equivalent', () => {
    expect(rgbStringToHex('rgb(10,81,90)')).toBe('#0a515a')
  })

  it('converts an RGBA string to its HEX equivalent', () => {
    expect(rgbStringToHex('rgba(10,81,90,0.42745098039215684)')).toBe('#0a515a6d')
  })

  it('converts an RGBA string with alpha 1 to its HEX equivalent', () => {
    expect(rgbStringToHex('rgba(10,81,90,1)')).toBe('#0a515aff')
  })

  it('converts an RGBA string with alpha 0 to its HEX equivalent', () => {
    expect(rgbStringToHex('rgba(10,81,90,0)')).toBe('#0a515a00')
  })

  it('throws an error if the input is not a valid RGB or RGBA string', () => {
    expect(() => rgbStringToHex('rgb(256, 81, 90)')).toThrow('Invalid RGB or RGBA string')
    expect(() => rgbStringToHex('rgba(10, 81, 90, 1.2)')).toThrow('Invalid RGB or RGBA string')
    expect(() => rgbStringToHex('rgba(10, 81, 90, -0.1)')).toThrow('Invalid RGB or RGBA string')
    expect(() => rgbStringToHex('not a color')).toThrow('Invalid RGB or RGBA string')
  })
})
