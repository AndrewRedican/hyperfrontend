/* lint-disable typescript/no-explicit-any */
import type { Rgb } from './hex-to-rgb'
import { describe, expect, it } from '@hyperfrontend/testing'
import { hexToRgb } from './hex-to-rgb'

describe('hexToRgb', () => {
  it('throws error for a hex input that is not a string', () => {
    expect(() => hexToRgb(null as any)).toThrow('Input hex must be a string')
  })

  it.each(['', '#xyz'])('throws error for the malformed hex input %p', (hex: string) => {
    expect(() => hexToRgb(hex)).toThrow('Invalid hex input')
  })

  it('throws error for invalid opacity', () => {
    expect(() => hexToRgb('#112233', '0.5' as any)).toThrow('Input opacity must be a number')
  })

  it('throws error when opacity is provided with 8-digit hex code', () => {
    expect(() => hexToRgb('#112233cc', 0.5)).toThrow('Opacity must not be provided when using 8-digit hex code')
  })

  it.each([
    ['#123', { r: 17, g: 34, b: 51 }],
    ['abc', { r: 170, g: 187, b: 204 }],
    ['f0f', { r: 255, g: 0, b: 255 }],
  ])('converts the 3-digit hex %p to RGB', (hex: string, rgb: Rgb) => {
    expect(hexToRgb(hex)).toEqual(rgb)
  })

  it.each([
    ['#112233', { r: 17, g: 34, b: 51 }],
    ['ff00ff', { r: 255, g: 0, b: 255 }],
  ])('converts the 6-digit hex %p to RGB', (hex: string, rgb: Rgb) => {
    expect(hexToRgb(hex)).toEqual(rgb)
  })

  it.each([
    ['#123', 0.5, { r: 17, g: 34, b: 51, a: 0.5 }],
    ['f0f', 1, { r: 255, g: 0, b: 255, a: 1 }],
  ])('converts the hex %p with the opacity %p to RGBA', (hex: string, opacity: number, rgba: Rgb) => {
    expect(hexToRgb(hex, opacity)).toEqual(rgba)
  })

  it.each([
    ['a0ca9280', { r: 160, g: 202, b: 146, a: 0.5 }],
    ['#112233cc', { r: 17, g: 34, b: 51, a: 0.8 }],
    ['ff00ffff', { r: 255, g: 0, b: 255, a: 1 }],
  ])('converts the 8-digit hex %p to RGBA', (hex: string, rgba: Rgb) => {
    expect(hexToRgb(hex)).toEqual(rgba)
  })

  it.each([
    ['#1234', { r: 17, g: 34, b: 51, a: 0.27 }],
    ['f0fc', { r: 255, g: 0, b: 255, a: 0.8 }],
  ])('converts the 4-digit hex %p to RGBA', (hex: string, rgba: Rgb) => {
    expect(hexToRgb(hex)).toEqual(rgba)
  })
})
