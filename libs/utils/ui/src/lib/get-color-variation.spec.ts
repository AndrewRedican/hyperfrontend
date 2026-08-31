/* eslint-disable @typescript-eslint/no-explicit-any */
import { getColorVariation } from './get-color-variation'

describe('getColorVariation', () => {
  it('returns a valid color variation with an intensity of 0', () => {
    const baseColor = '#FF0000'
    const intensity = 0
    const expected = 'rgba(0,0,0,0)'
    expect(getColorVariation(baseColor, intensity)).toBe(expected)
  })

  it('returns a valid color variation with an intensity of 255', () => {
    const baseColor = '#FF0000'
    const intensity = 255
    const expected = 'rgba(255,0,0,1)'
    expect(getColorVariation(baseColor, intensity)).toBe(expected)
  })

  it('throws an error for an invalid base color', () => {
    const intensity = 128
    expect(() => getColorVariation(null as any, intensity)).toThrow(
      'Invalid input types. Base color must be a string and intensity must be a number.'
    )
    expect(() => getColorVariation('INVALID_COLOR', intensity)).toThrow('Invalid hex input')
  })

  it('throws an error for an invalid intensity', () => {
    const baseColor = '#FF0000'
    const intensity = -1
    expect(() => getColorVariation(baseColor, intensity)).toThrow('Invalid intensity value. Must be a number between 0 and 255.')
  })
})
