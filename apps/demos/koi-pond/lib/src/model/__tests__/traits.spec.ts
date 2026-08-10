import { describe, expect, it } from 'vitest'
import { koiBuild, koiPhenotype, koiProfile, koiSeed, koiTraits, koiTrim } from '../traits.js'
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
    const scales = KOI_FRAMEWORKS.map((framework) => koiBuild(framework, koiSeed(framework)).lengthScale)
    expect(scales.every((scale) => scale >= 0.8 && scale <= 1.25)).toBe(true)
  })

  it('derives the same build from the same seed', () => {
    expect(koiBuild('react', 99)).toEqual(koiBuild('react', 99))
  })

  it('draws the build from different numbers than the traits', () => {
    const seed = koiSeed('preact')
    expect(koiBuild('preact', seed).lengthScale).not.toBe(koiTraits(seed).cruiseSpeed)
  })

  it('reports outline girth that follows the rendered width', () => {
    for (const framework of KOI_FRAMEWORKS) {
      const build = koiBuild(framework, koiSeed(framework))
      expect(build.girthRatio).toBeCloseTo(0.115 * build.widthScale)
    }
  })
})

describe('koiPhenotype', () => {
  it('builds the heavyweight framework broader than the featherweight', () => {
    const react = koiPhenotype('react', koiSeed('react'))
    const vanilla = koiPhenotype('vanilla', koiSeed('vanilla'))
    expect((react.width ?? 0) > (vanilla.width ?? 0) && (react.belly ?? 0) > (vanilla.belly ?? 0)).toBe(true)
  })

  it('keeps the spread restrained enough to read as one species', () => {
    const widths = KOI_FRAMEWORKS.map((framework) => koiPhenotype(framework, koiSeed(framework)).width ?? 1)
    expect(Math.max(...widths) / Math.min(...widths)).toBeLessThan(1.45)
  })

  it('varies more than a uniform scale would', () => {
    // why: The point of the phenotype is many small levers; if width and height moved in lockstep it would be a scale multiplier wearing a costume.
    const ratios = KOI_FRAMEWORKS.map((framework) => {
      const phenotype = koiPhenotype(framework, koiSeed(framework))
      return (phenotype.width ?? 1) / (phenotype.height ?? 1)
    })
    expect(new Set(ratios.map((ratio) => ratio.toFixed(3))).size).toBe(KOI_FRAMEWORKS.length)
  })

  it('agrees with the build the outline reports', () => {
    for (const framework of KOI_FRAMEWORKS) {
      const seed = koiSeed(framework)
      const build = koiBuild(framework, seed)
      const phenotype = koiPhenotype(framework, seed)
      expect({ length: phenotype.length, width: phenotype.width }).toEqual({ length: build.lengthScale, width: build.widthScale })
    }
  })

  it('derives the same body from the same seed', () => {
    expect(koiPhenotype('lit', 7)).toEqual(koiPhenotype('lit', 7))
  })
})

describe('koiTrim', () => {
  it('reaches the body wave forward so the torso works at a cruise', () => {
    for (const framework of KOI_FRAMEWORKS) {
      const trim = koiTrim(koiSeed(framework), koiTraits(koiSeed(framework)))
      expect(trim.waveReach).toBeGreaterThan(0.05)
    }
  })

  it('gives no two koi the same beat', () => {
    const frequencies = KOI_FRAMEWORKS.map((framework) => koiTrim(koiSeed(framework), koiTraits(koiSeed(framework))).frequency)
    expect(new Set(frequencies).size).toBe(KOI_FRAMEWORKS.length)
  })

  it('answers the helm with the koi its own responsiveness', () => {
    const seed = koiSeed('solid')
    expect(koiTrim(seed, koiTraits(seed)).responsiveness).toBe(koiTraits(seed).turnResponsiveness)
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

  it('carries the phenotype and trim the renderers read', () => {
    const profile = koiProfile('vue')
    expect(profile.phenotype).toEqual(koiPhenotype('vue', koiSeed('vue')))
    expect(profile.trim).toEqual(koiTrim(koiSeed('vue'), profile.traits))
  })
})
