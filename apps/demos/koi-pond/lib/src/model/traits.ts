/**
 * Deterministic per-koi traits and build.
 *
 * Every reproducible property derives from one integer seed through
 * `randomPseudo`, the only generator in `@hyperfrontend/random-generator-utils`
 * that is deterministic — the distributions (`randomGaussian`, `randomUniform`)
 * draw from an unseeded source and belong on per-frame jitter, not on identity.
 * Deriving here means a koi is the same animal on every reload, and the host and
 * the fish agree on its size without exchanging a message about it.
 */
import { randomPseudo } from '@hyperfrontend/random-generator-utils'
import type { KoiBuild, KoiFramework, KoiProfile, KoiTraits } from './types.js'
import { koiLabel, koiPalette } from './palette.js'
import { KOI_FRAMEWORKS } from './types.js'

/** Spacing between a fish's seed and its neighbour's, so their draws never correlate. */
const SEED_STRIDE = 977

/** How many draws the trait vector consumes before the build starts drawing. */
const TRAIT_DRAWS = 8

/**
 * Maps a `[0, 1)` draw onto an inclusive band.
 *
 * @param draw - The unit draw.
 * @param min - Band floor.
 * @param max - Band ceiling.
 * @returns The mapped value.
 */
function band(draw: number, min: number, max: number): number {
  return min + draw * (max - min)
}

/**
 * Derives the stable seed for one framework's koi.
 *
 * @param framework - The framework slug.
 * @returns An integer seed, distinct and well-spaced per framework.
 *
 * @example Seeding a koi
 * ```typescript
 * const seed = koiSeed('lit')
 * const profile = koiProfile('lit', seed)
 * ```
 */
export function koiSeed(framework: KoiFramework): number {
  // why: Position in the canonical list rather than a string hash — stable, inspectable, and trivially reproducible by the host and the fish alike.
  return (KOI_FRAMEWORKS.indexOf(framework) + 1) * SEED_STRIDE
}

/**
 * Derives the eight normalised behavioural traits from a seed.
 *
 * Each trait takes its own draw, so changing one band never shifts another.
 *
 * @param seed - The koi's stable integer seed.
 * @returns The trait vector, every field in `[0, 1]`.
 */
export function koiTraits(seed: number): KoiTraits {
  const draw = (index: number): number => randomPseudo(seed + index)
  return {
    cruiseSpeed: draw(0),
    shyness: draw(1),
    socialAffinity: draw(2),
    awareness: draw(3),
    directionalCaution: draw(4),
    depthWillingness: draw(5),
    reactionIntensity: draw(6),
    turnResponsiveness: draw(7),
  }
}

/**
 * Derives the koi's physical build from the same seed.
 *
 * @param seed - The koi's stable integer seed.
 * @returns Its build ratios.
 */
export function koiBuild(seed: number): KoiBuild {
  const draw = (index: number): number => randomPseudo(seed + TRAIT_DRAWS + index)
  return {
    // magic: A shoal spanning 0.82x to 1.18x reads as varied without any one koi looking like a different species.
    lengthScale: band(draw(0), 0.82, 1.18),
    girthRatio: band(draw(1), 0.102, 0.128),
    tailSpan: band(draw(2), 0.22, 0.3),
    finSpan: band(draw(3), 0.15, 0.21),
  }
}

/**
 * Assembles everything about one koi that never changes once the pond opens.
 *
 * @param framework - The framework slug rendering it.
 * @param seed - Its stable integer seed; defaults to {@link koiSeed}.
 * @returns The complete profile.
 *
 * @example Building a koi from its framework alone
 * ```typescript
 * const profile = koiProfile('vue')
 * const bodyLength = pond.fishLength * profile.build.lengthScale
 * ```
 */
export function koiProfile(framework: KoiFramework, seed: number = koiSeed(framework)): KoiProfile {
  return {
    framework,
    label: koiLabel(framework),
    traits: koiTraits(seed),
    build: koiBuild(seed),
    palette: koiPalette(framework),
  }
}
