import { describe, expect, it } from '@hyperfrontend/testing'
import { rgbToHex } from './rgb-to-hex'

describe('rgbToHex', () => {
  it('converts RGB to 6-digit hex', () => {
    expect(rgbToHex(17, 34, 51)).toBe('#112233')
    expect(rgbToHex(255, 0, 255)).toBe('#ff00ff')
  })

  it('handles opacity', () => {
    expect(rgbToHex(17, 34, 51, 0.5)).toBe('#11223380')
    expect(rgbToHex(255, 0, 255, 1)).toBe('#ff00ffff')
  })

  it('handles edge cases', () => {
    expect(rgbToHex(0, 0, 0)).toBe('#000000')
    expect(rgbToHex(255, 255, 255)).toBe('#ffffff')
  })
})
