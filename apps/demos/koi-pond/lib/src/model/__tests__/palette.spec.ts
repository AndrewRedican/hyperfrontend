import { describe, expect, it } from 'vitest'
import { koiLabel, koiPalette } from '../palette.js'
import { KOI_FRAMEWORKS } from '../types.js'

describe('koiPalette', () => {
  it('gives every koi its own marking so a visitor can tell them apart', () => {
    expect(new Set(KOI_FRAMEWORKS.map((framework) => koiPalette(framework).marking)).size).toBe(KOI_FRAMEWORKS.length)
  })

  it('wears the framework brand exactly as the accent', () => {
    expect(koiPalette('vue').accent).toBe('#42b883')
  })

  it('tints the fins translucent so they read as membrane', () => {
    expect(koiPalette('vue').fin).toBe('#42b88366')
  })

  it('mixes varieties across the shoal rather than dressing seven of one', () => {
    const patterns = new Set(KOI_FRAMEWORKS.map((framework) => koiPalette(framework).pattern))
    expect(patterns.size).toBeGreaterThanOrEqual(4)
  })

  it('keeps some koi simple and gives others real sumi', () => {
    const shades = KOI_FRAMEWORKS.map((framework) => koiPalette(framework).shade)
    // why: The blend the brief asks for — at least one fish carrying near-black sumi and at least one carrying a warm natural tone instead.
    expect(shades.some((shade) => shade === '#221e1b') && shades.some((shade) => shade === '#e08a3c')).toBe(true)
  })

  it('grounds every koi on a natural tone, never on a brand colour', () => {
    for (const framework of KOI_FRAMEWORKS) {
      const palette = koiPalette(framework)
      expect(palette.body).not.toBe(palette.marking)
      expect(palette.body).not.toBe(palette.accent)
    }
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
