/**
 * Deterministic per-koi traits, build, phenotype, and swimming trim.
 *
 * Every reproducible property derives from one integer seed through
 * `randomPseudo`, the only generator in `@hyperfrontend/random-generator-utils`
 * that is deterministic — the distributions (`randomGaussian`, `randomUniform`)
 * draw from an unseeded source and belong on per-frame jitter, not on identity.
 * Deriving here means a koi is the same animal on every reload, and the host and
 * the fish agree on its size without exchanging a message about it.
 *
 * Draw offsets are allocated in bands so adding a band never shifts another:
 * traits take 0–7, the body takes 8–23, the swimming trim takes 24–29, and the
 * pond's entry jitter takes 40–43.
 */
import { randomPseudo } from '@hyperfrontend/random-generator-utils'
import type { KoiSwimTrim } from '../koi3d/config.js'
import type { KoiBuild, KoiFramework, KoiPhenotype, KoiProfile, KoiTraits } from './types.js'
import { koiLabel, koiPalette } from './palette.js'
import { KOI_FRAMEWORKS } from './types.js'

/** Spacing between a fish's seed and its neighbour's, so their draws never correlate. */
const SEED_STRIDE = 977

/** Where the body's draw band starts, after the eight trait draws. */
const BODY_DRAWS = 8

/** Where the swimming trim's draw band starts. */
const TRIM_DRAWS = 24

/**
 * Each framework's notional footprint, 0 (featherweight) to 1 (heavyweight).
 *
 * A rough blend of API surface, ecosystem weight, and conceptual footprint —
 * a visual metaphor, not a measurement. A heavier framework swims as a
 * broader, deeper-bodied koi; a lighter one stays slender. The range is
 * deliberately restrained so the shoal still reads as one species.
 */
const HEFT: Readonly<Record<KoiFramework, number>> = {
  vanilla: 0.2,
  react: 1,
  vue: 0.8,
  svelte: 0.55,
  solid: 0.5,
  preact: 0.3,
  lit: 0.45,
  angular: 0.9,
}

/** The sculpted anatomy's widest half-width as a fraction of body length, at width multiplier 1. */
const ANATOMY_GIRTH_RATIO = 0.115

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

/** Every deterministic body number, derived once so build and phenotype always agree. */
interface KoiBody {
  /** Nose-to-tail length multiplier against the pond's nominal fish length. */
  lengthScale: number
  /** Body width multiplier against the sculpted anatomy. */
  widthScale: number
  /** Body height multiplier against the sculpted anatomy. */
  heightScale: number
  /** Shoulder width multiplier. */
  shoulder: number
  /** Ventral volume, 0 to 1. */
  belly: number
  /** Dorsal ridge prominence, 0 to 1. */
  dorsalRidge: number
  /** Caudal fin span as a fraction of body length. */
  tailSpan: number
  /** Caudal fork depth, 0 to 1. */
  caudalFork: number
  /** Lateral fan of the caudal lobes as a fraction of body length. */
  caudalSpread: number
  /** Pectoral fin span as a fraction of body length. */
  finSpan: number
  /** Head width multiplier. */
  headWidth: number
  /** Snout bluntness, 0 to 1. */
  snout: number
  /** Forehead dome, 0 to 1. */
  forehead: number
  /** Peduncle width multiplier. */
  peduncle: number
}

/**
 * Derives every deterministic body number for one koi.
 *
 * The framework's notional heft sets the centre of each band and the seed
 * jitters around it, so a heavier framework reads as a broader, deeper koi
 * while two koi of similar heft still differ fish to fish.
 *
 * @param framework - The framework slug, which sets the heft.
 * @param seed - The koi's stable integer seed.
 * @returns The body numbers.
 */
function koiBody(framework: KoiFramework, seed: number): KoiBody {
  const heft = HEFT[framework]
  const draw = (index: number): number => randomPseudo(seed + BODY_DRAWS + index)
  return {
    // magic: A shoal spanning roughly 0.85x to 1.2x reads as varied without any one koi looking like a different species; heft carries a third of the spread so the heavyweight is visibly the larger animal.
    lengthScale: band(draw(0), 0.85, 1.08) + heft * 0.1,
    widthScale: 0.86 + heft * 0.24 + band(draw(1), -0.04, 0.04),
    heightScale: 0.9 + heft * 0.18 + band(draw(2), -0.04, 0.04),
    shoulder: 0.94 + heft * 0.14 + band(draw(3), -0.03, 0.03),
    belly: 0.3 + heft * 0.28 + band(draw(4), 0, 0.1),
    dorsalRidge: band(draw(5), 0.08, 0.22),
    tailSpan: band(draw(6), 0.22, 0.3),
    caudalFork: band(draw(7), 0.24, 0.44),
    // why: The pond is watched from above, where a purely vertical tail blade reads as a sliver — every koi fans its lobes a little sideways so the tail keeps its silhouette straight overhead. Draw 13 was the body band's next free slot; earlier draws must never shift.
    // why: The band has to clear the bank as well as the level view: a koi leaning into a turn rolls its blade back toward the vertical, and a fan that only survives level flight is the tail that disappears mid-manoeuvre.
    caudalSpread: band(draw(13), 0.2, 0.28),
    finSpan: band(draw(8), 0.15, 0.21),
    headWidth: 0.96 + heft * 0.09 + band(draw(9), -0.02, 0.02),
    snout: band(draw(10), 0.6, 0.95),
    forehead: 0.28 + heft * 0.22 + band(draw(11), 0, 0.1),
    peduncle: 0.92 + heft * 0.12 + band(draw(12), -0.03, 0.03),
  }
}

/**
 * Derives the koi's physical build from its framework and seed.
 *
 * @param framework - The framework slug, which sets the notional heft.
 * @param seed - The koi's stable integer seed.
 * @returns Its build ratios, agreeing exactly with {@link koiPhenotype}.
 */
export function koiBuild(framework: KoiFramework, seed: number): KoiBuild {
  const body = koiBody(framework, seed)
  return {
    lengthScale: body.lengthScale,
    // why: The reported outline's half-widths must describe the body actually rendered, so the ratio scales with the same width multiplier the mesh takes.
    girthRatio: ANATOMY_GIRTH_RATIO * body.widthScale,
    widthScale: body.widthScale,
    heightScale: body.heightScale,
    tailSpan: body.tailSpan,
    finSpan: body.finSpan,
  }
}

/**
 * Derives the sculpted-body overrides one koi passes to the 3D model.
 *
 * Uses many small levers rather than one uniform scale: a heavier framework
 * is wider through the shoulders, deeper through the belly, broader-headed
 * and thicker-tailed, so the shoal reads as related but individually
 * recognisable animals.
 *
 * @param framework - The framework slug, which sets the notional heft.
 * @param seed - The koi's stable integer seed.
 * @returns Partial physical overrides for the 3D koi, agreeing with {@link koiBuild}.
 *
 * @example Building this koi's 3D body
 * ```typescript
 * const koi = createKoi({ seed, physical: koiPhenotype('react', seed) })
 * ```
 */
export function koiPhenotype(framework: KoiFramework, seed: number): KoiPhenotype {
  const body = koiBody(framework, seed)
  return {
    length: body.lengthScale,
    width: body.widthScale,
    height: body.heightScale,
    shoulder: body.shoulder,
    belly: body.belly,
    dorsalRidge: body.dorsalRidge,
    peduncleWidth: body.peduncle,
    head: { width: body.headWidth, snout: body.snout, forehead: body.forehead },
    caudal: { span: body.tailSpan * 1.38, fork: body.caudalFork, spread: body.caudalSpread },
    pectoral: { span: body.finSpan * 0.92 },
  }
}

/**
 * Derives one koi's swimming trim from its seed and traits.
 *
 * The trim is what keeps two koi at the same speed from swimming in step:
 * each carries its own wave amplitude, beat frequency, and how far forward
 * the body wave reaches — the reach is deliberately biased forward so the
 * torso visibly works even at a relaxed cruise.
 *
 * @param seed - The koi's stable integer seed.
 * @param traits - Its behavioural traits, which set how sharply it answers the helm.
 * @returns Its trim on the swimming model.
 */
export function koiTrim(seed: number, traits: KoiTraits): KoiSwimTrim {
  const draw = (index: number): number => randomPseudo(seed + TRIM_DRAWS + index)
  return {
    amplitude: band(draw(0), 0.95, 1.15),
    frequency: band(draw(1), 0.92, 1.08),
    waveReach: band(draw(2), 0.08, 0.18),
    wavesPerBody: band(draw(3), 0.95, 1.05),
    turn: band(draw(4), 0.9, 1.15),
    responsiveness: traits.turnResponsiveness,
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
  const traits = koiTraits(seed)
  return {
    framework,
    label: koiLabel(framework),
    traits,
    build: koiBuild(framework, seed),
    phenotype: koiPhenotype(framework, seed),
    trim: koiTrim(seed, traits),
    palette: koiPalette(framework),
  }
}
