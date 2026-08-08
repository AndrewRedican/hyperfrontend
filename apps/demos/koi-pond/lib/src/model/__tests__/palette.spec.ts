import { describe, expect, it } from 'vitest'
import { koiLabel, koiPalette } from '../palette.js'
import { KOI_FRAMEWORKS } from '../types.js'

describe('koiPalette', () => {
  it('dresses all seven koi in one species ground', () => {
    expect(new Set(KOI_FRAMEWORKS.map((framework) => koiPalette(framework).body)).size).toBe(1)
  })

  it('gives every koi its own marking so a visitor can tell them apart', () => {
    expect(new Set(KOI_FRAMEWORKS.map((framework) => koiPalette(framework).marking)).size).toBe(KOI_FRAMEWORKS.length)
  })

  it('wears the framework brand exactly as the accent', () => {
    expect(koiPalette('vue').accent).toBe('#42b883')
  })

  it('tints the fins translucent so they read as membrane', () => {
    expect(koiPalette('vue').fin).toBe('#42b88366')
  })

  it('shades the belly darker than the back', () => {
    expect(koiPalette('lit').shade).not.toBe(koiPalette('lit').body)
  })

  it('emits colours a renderer can parse', () => {
    expect(KOI_FRAMEWORKS.every((framework) => /^#[0-9a-f]{6}$/.test(koiPalette(framework).marking))).toBe(true)
  })
})

describe('koiLabel', () => {
  it('names a framework the way its own project does', () => {
    expect(koiLabel('solid')).toBe('SolidJS')
  })

  it('names every koi in the shoal', () => {
    expect(KOI_FRAMEWORKS.every((framework) => koiLabel(framework).length > 0)).toBe(true)
  })
})
