import { describe, expect, it } from 'vitest'
import { koiBuild, koiProfile, koiSeed, koiTraits } from '../traits.js'
import { KOI_FRAMEWORKS } from '../types.js'

describe('koiSeed', () => {
  it('gives every framework its own seed', () => {
    expect(new Set(KOI_FRAMEWORKS.map(koiSeed)).size).toBe(KOI_FRAMEWORKS.length)
  })

  it('gives the same framework the same seed on every reload', () => {
    expect(koiSeed('svelte')).toBe(koiSeed('svelte'))
  })

  it('never seeds a koi from zero, which would collapse the sin hash', () => {
    expect(KOI_FRAMEWORKS.every((framework) => koiSeed(framework) > 0)).toBe(true)
  })
})

describe('koiTraits', () => {
  it('normalises every trait into the unit band', () => {
    const traits = koiTraits(koiSeed('vue'))
    expect(Object.values(traits).every((value) => value >= 0 && value < 1)).toBe(true)
  })

  it('derives the same animal from the same seed', () => {
    expect(koiTraits(4242)).toEqual(koiTraits(4242))
  })

  it('gives each trait its own draw rather than reusing one', () => {
    const traits = koiTraits(koiSeed('lit'))
    expect(new Set(Object.values(traits)).size).toBeGreaterThan(1)
  })

  it('makes the seven koi behaviourally distinct', () => {
    const cruises = KOI_FRAMEWORKS.map((framework) => koiTraits(koiSeed(framework)).cruiseSpeed)
    expect(new Set(cruises).size).toBe(KOI_FRAMEWORKS.length)
  })
})

describe('koiBuild', () => {
  it('keeps every koi recognisably the same species', () => {
    const scales = KOI_FRAMEWORKS.map((framework) => koiBuild(koiSeed(framework)).lengthScale)
    expect(scales.every((scale) => scale >= 0.82 && scale <= 1.18)).toBe(true)
  })

  it('derives the same build from the same seed', () => {
    expect(koiBuild(99)).toEqual(koiBuild(99))
  })

  it('draws the build from different numbers than the traits', () => {
    const seed = koiSeed('preact')
    expect(koiBuild(seed).lengthScale).not.toBe(koiTraits(seed).cruiseSpeed)
  })
})

describe('koiProfile', () => {
  it('carries the framework it was asked for', () => {
    expect(koiProfile('solid').framework).toBe('solid')
  })

  it('labels the koi for the hover card', () => {
    expect(koiProfile('solid').label).toBe('SolidJS')
  })

  it('wears its framework brand as its marking', () => {
    expect(koiProfile('svelte').palette.marking).toBe('#ff3e00')
  })

  it('reproduces exactly from the framework alone', () => {
    expect(koiProfile('react')).toEqual(koiProfile('react'))
  })

  it('honours an explicitly supplied seed over the derived one', () => {
    expect(koiProfile('react', 7).traits).toEqual(koiTraits(7))
  })
})
