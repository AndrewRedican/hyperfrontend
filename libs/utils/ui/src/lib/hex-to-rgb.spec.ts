/* eslint-disable @typescript-eslint/no-explicit-any */
import { hexToRgb } from './hex-to-rgb'

describe('hexToRgb', () => {
  it('throws error for invalid input', () => {
    expect(() => hexToRgb(null as any)).toThrow('Input hex must be a string')
    expect(() => hexToRgb('')).toThrow('Invalid hex input')
    expect(() => hexToRgb('#xyz')).toThrow('Invalid hex input')
  })

  it('throws error for invalid opacity', () => {
    expect(() => hexToRgb('#112233', '0.5' as any)).toThrow('Input opacity must be a number')
  })

  it('throws error when opacity is provided with 8-digit hex code', () => {
    expect(() => hexToRgb('#112233cc', 0.5)).toThrow('Opacity must not be provided when using 8-digit hex code')
  })

  it('converts 3-digit hex to RGB', () => {
    expect(hexToRgb('#123')).toEqual({ r: 17, g: 34, b: 51 })
    expect(hexToRgb('abc')).toEqual({ r: 170, g: 187, b: 204 })
    expect(hexToRgb('f0f')).toEqual({ r: 255, g: 0, b: 255 })
  })

  it('converts 6-digit hex to RGB', () => {
    expect(hexToRgb('#112233')).toEqual({ r: 17, g: 34, b: 51 })
    expect(hexToRgb('ff00ff')).toEqual({ r: 255, g: 0, b: 255 })
  })

  it('handles opacity', () => {
    expect(hexToRgb('#123', 0.5)).toEqual({ r: 17, g: 34, b: 51, a: 0.5 })
    expect(hexToRgb('f0f', 1)).toEqual({ r: 255, g: 0, b: 255, a: 1 })
  })

  it('handles 8-digit hex codes with opacity', () => {
    expect(hexToRgb('a0ca9280')).toEqual({ r: 160, g: 202, b: 146, a: 0.5 })
    expect(hexToRgb('#112233cc')).toEqual({ r: 17, g: 34, b: 51, a: 0.8 })
    expect(hexToRgb('ff00ffff')).toEqual({ r: 255, g: 0, b: 255, a: 1 })
  })

  it('handles 4-digit hex codes with opacity', () => {
    expect(hexToRgb('#1234')).toEqual({ r: 17, g: 34, b: 51, a: 0.27 })
    expect(hexToRgb('f0fc')).toEqual({ r: 255, g: 0, b: 255, a: 0.8 })
  })
})
