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

  it.each([
    ['rgb(256, 81, 90)', 'a channel above 255'],
    ['rgba(10, 81, 90, 1.2)', 'an alpha above 1'],
    ['rgba(10, 81, 90, -0.1)', 'a negative alpha'],
    ['not a color', 'no color notation'],
  ])('throws an error for the invalid RGB or RGBA string %p, with %s', (rgbString: string) => {
    expect(() => rgbStringToHex(rgbString)).toThrow('Invalid RGB or RGBA string')
  })
})
