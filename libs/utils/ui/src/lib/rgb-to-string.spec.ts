import { rgbToString } from './rgb-to-string'

describe('rgbToString', () => {
  it('converts an RGB object to a string without alpha', () => {
    const rgb = { r: 255, g: 0, b: 0 }
    const expected = 'rgb(255,0,0)'
    expect(rgbToString(rgb)).toBe(expected)
  })

  it('converts an RGBA object to a string with alpha', () => {
    const rgba = { r: 255, g: 0, b: 0, a: 0.5 }
    const expected = 'rgba(255,0,0,0.5)'
    expect(rgbToString(rgba)).toBe(expected)
  })
})
