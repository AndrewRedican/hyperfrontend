import type { KoiFramework, KoiTraits } from '../types.js'
import { describe, expect, it } from 'vitest'
import { buildPattern } from '../../koi3d/pattern.js'
import { koiPalette } from '../palette.js'
import { koiBuild, koiPhenotype, koiProfile, koiSeed, koiTraits, koiTrim, koiVariantSeed } from '../traits.js'
import { KOI_FRAMEWORKS } from '../types.js'

/** Ordinals sampled wherever a duplicate has to behave like a duplicate; 11 is the largest a pond holds. */
const ORDINALS = [1, 2, 3, 11]

/**
 * The temperament every canonical koi swims with.
 *
 * Written out rather than derived so the suite fails the moment a draw band
 * shifts: these eight fish are the shoal visitors have already met, and their
 * numbers are identity, not an implementation detail.
 */
const CANONICAL_TRAITS: Readonly<Record<KoiFramework, KoiTraits>> = {
  vanilla: {
    cruiseSpeed: 0.07926204818858196,
    shyness: 0.3064246350149915,
    socialAffinity: 0.7625579650775762,
    awareness: 0.13400963422350287,
    directionalCaution: 0.5181368078292508,
    depthWillingness: 0.4189046402279928,
    reactionIntensity: 0.42898892067250927,
    turnResponsiveness: 0.4177021121249709,
  },
  react: {
    cruiseSpeed: 0.28177931191373773,
    shyness: 0.42827592556204763,
    socialAffinity: 0.9851668594146759,
    awareness: 0.33727961283557306,
    directionalCaution: 0.13261136226628878,
    depthWillingness: 0.4805328500478936,
    reactionIntensity: 0.20201643508289635,
    turnResponsiveness: 0.4427873751401421,
  },
  vue: {
    cruiseSpeed: 0.4771215866728653,
    shyness: 0.8288294843159747,
    socialAffinity: 0.944357668651719,
    awareness: 0.8181146724191422,
    directionalCaution: 0.37779745367333817,
    depthWillingness: 0.4420516040572693,
    reactionIntensity: 0.8462419746033447,
    turnResponsiveness: 0.20569369205259136,
  },
  svelte: {
    cruiseSpeed: 0.08269212324898945,
    shyness: 0.19194005636563816,
    socialAffinity: 0.3016300304716424,
    awareness: 0.9710200730473844,
    directionalCaution: 0.6345254827720055,
    depthWillingness: 0.9005381473361922,
    reactionIntensity: 0.8365716735343085,
    turnResponsiveness: 0.9930693193982734,
  },
  solid: {
    cruiseSpeed: 0.6017671789177257,
    shyness: 0.22761066783641581,
    socialAffinity: 0.40936287281510886,
    awareness: 0.7202932980094374,
    directionalCaution: 0.1571592639966184,
    depthWillingness: 0.41979688947685645,
    reactionIntensity: 0.34510662590855645,
    turnResponsiveness: 0.5957891958933033,
  },
  preact: {
    cruiseSpeed: 0.9043234272053269,
    shyness: 0.20609556979434274,
    socialAffinity: 0.8050816061950172,
    awareness: 0.687308319715612,
    directionalCaution: 0.9101881530377796,
    depthWillingness: 0.6534594849199493,
    reactionIntensity: 0.0067549457717177575,
    turnResponsiveness: 0.40132958156846144,
  },
  lit: {
    cruiseSpeed: 0.9669448379204368,
    shyness: 0.20195766395954706,
    socialAffinity: 0.15756110418806202,
    awareness: 0.22194716554758998,
    directionalCaution: 0.5101929342299627,
    depthWillingness: 0.8386318148277496,
    reactionIntensity: 0.7167123295894271,
    turnResponsiveness: 0.6339769959167825,
  },
  angular: {
    cruiseSpeed: 0.21324871189472105,
    shyness: 0.8642392115252733,
    socialAffinity: 0.6153697200243187,
    awareness: 0.14155144113192364,
    directionalCaution: 0.2255687148499419,
    depthWillingness: 0.12948363662144402,
    reactionIntensity: 0.8682345372326381,
    turnResponsiveness: 0.6874110901871973,
  },
}

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

describe('koiVariantSeed', () => {
  it('seeds the canonical fish exactly as its framework always has', () => {
    expect(KOI_FRAMEWORKS.map((framework) => koiVariantSeed(framework, 0))).toEqual(KOI_FRAMEWORKS.map(koiSeed))
  })

  it('derives the canonical shoal the visitor already knows, trait for trait', () => {
    for (const framework of KOI_FRAMEWORKS) {
      expect(koiTraits(koiVariantSeed(framework, 0))).toEqual(CANONICAL_TRAITS[framework])
    }
  })

  it('derives a seed from the framework and ordinal alone, so every process agrees', () => {
    // magic: The solid koi is fifth in the canonical list, so its own seed is 5 * 977 and its second duplicate steps twice the variant stride.
    expect(koiVariantSeed('solid', 2)).toBe(4885 + 2 * 10_007)
  })

  it('gives every koi in a fully duplicated shoal its own seed', () => {
    const seeds = KOI_FRAMEWORKS.flatMap((framework) => [0, ...ORDINALS].map((ordinal) => koiVariantSeed(framework, ordinal)))
    expect(new Set(seeds).size).toBe(seeds.length)
  })

  it('keeps every duplicate a full stride clear of every other koi', () => {
    const seeds = KOI_FRAMEWORKS.flatMap((framework) => [0, ...ORDINALS].map((ordinal) => koiVariantSeed(framework, ordinal))).sort(
      (a, b) => a - b
    )
    // magic: 977 is the spacing the shoal is built on; any two koi closer than that could read each other's draws.
    expect(seeds.every((seed, index) => index === 0 || seed - (seeds[index - 1] ?? 0) >= 977)).toBe(true)
  })

  it('gives every duplicate its own temperament', () => {
    for (const framework of KOI_FRAMEWORKS) {
      for (const ordinal of ORDINALS) {
        expect(koiTraits(koiVariantSeed(framework, ordinal))).not.toEqual(koiTraits(koiSeed(framework)))
      }
    }
  })

  it('gives every duplicate its own body', () => {
    for (const framework of KOI_FRAMEWORKS) {
      for (const ordinal of ORDINALS) {
        expect(koiBuild(framework, koiVariantSeed(framework, ordinal))).not.toEqual(koiBuild(framework, koiSeed(framework)))
      }
    }
  })

  it('gives every duplicate its own markings', () => {
    for (const framework of KOI_FRAMEWORKS) {
      const variety = koiPalette(framework).pattern
      for (const ordinal of ORDINALS) {
        expect(buildPattern(variety, koiVariantSeed(framework, ordinal)).patches).not.toEqual(
          buildPattern(variety, koiSeed(framework)).patches
        )
      }
    }
  })

  it('keeps every duplicate in the variety and colours of its framework', () => {
    for (const framework of KOI_FRAMEWORKS) {
      for (const ordinal of ORDINALS) {
        expect(koiProfile(framework, koiVariantSeed(framework, ordinal)).palette).toEqual(koiPalette(framework))
      }
    }
  })

  it('keeps a duplicate recognisably the same species', () => {
    for (const framework of KOI_FRAMEWORKS) {
      for (const ordinal of ORDINALS) {
        const scale = koiBuild(framework, koiVariantSeed(framework, ordinal)).lengthScale
        expect(scale >= 0.8 && scale <= 1.25).toBe(true)
      }
    }
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
