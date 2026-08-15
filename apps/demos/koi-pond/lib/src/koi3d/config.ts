/**
 * Everything you can dial on one koi, and the numbers it starts from.
 *
 * Two vocabularies live here and they are kept apart on purpose. {@link KoiPhysical}
 * is the animal's build — proportions the mesh generators read once, at build
 * time. {@link KoiAppearance} is its skin — colours and pattern the material reads
 * every frame. Neither says anything about what the koi is *doing*; that is
 * {@link KoiMotionInput}, which the pose model turns into a bent spine.
 *
 * Lengths are fractions of the koi's total nose-to-caudal-tip length unless a
 * field says otherwise, so a koi scales by changing one number.
 */
import type { KoiPatternName } from './pattern.js'

/** Where along the deformation curve the body's own profile ends. */
export const CAUDAL_ROOT = 0.8

/**
 * How far the peduncle's flesh runs on past the profile before the tail begins.
 *
 * A fish has no seam between its body and its tail: the peduncle flattens into
 * the caudal fin's base over a short run, losing its width while keeping most of
 * its height. Without this run the shell closes as a rounded stub and the blade
 * starts beside it, which reads as two parts bolted together.
 */
export const CAUDAL_BLEND = 0.032

/** How much of its height the peduncle keeps by the time it has flattened into the blade. */
export const CAUDAL_BLEND_HEIGHT = 0.58

/**
 * The station the koi pivots around when it turns, as a fraction of total length.
 *
 * A swimming fish yaws about the node of its own body wave rather than its nose;
 * putting the model origin there is what stops a turn looking like a rigid
 * sprite being rotated.
 */
export const PIVOT_STATION = 0.36

/** The head's build: the volumes that make a koi's face read from above. */
export interface KoiHeadShape {
  /** How far back the head runs, as a fraction of body length. */
  length: number
  /** Cheek and operculum width multiplier against the body's width profile. */
  width: number
  /** Cranial depth multiplier against the body's height profile. */
  height: number
  /** How bluntly the snout ends; 0 is a point, 1 is a broad rounded muzzle. */
  snout: number
  /** How much the forehead domes between the eyes. */
  forehead: number
}

/** The eyes: two of them, on opposite sides of the head. */
export interface KoiEyeShape {
  /** Where the eyes sit along the body, as a fraction of body length. */
  station: number
  /** How far apart, as a multiple of the head's local half-width. */
  spacing: number
  /** Eyeball radius as a fraction of total length. */
  size: number
  /** How far the eyeball stands proud of the skin, as a multiple of its radius. */
  protrusion: number
  /** How far above the axis the eyes ride, as a fraction of local head height. */
  rise: number
}

/** One fin's build. Every fin is a tapered membrane hung off a spine station. */
export interface KoiFinShape {
  /** Where the fin's root begins along the deformation curve. */
  station: number
  /** Where around the body the root sits, in turns: 0 is the dorsal midline, 0.25 the left flank, 0.5 the belly. */
  girth: number
  /** How far the root runs along the body, as a fraction of total length. */
  root: number
  /** How far the fin reaches from its root, as a fraction of total length. */
  span: number
  /** How far the tip trails behind the root, as a multiple of span. */
  sweep: number
  /** How much the trailing edge is scalloped between rays, 0 to 1. */
  scallop: number
  /** Outline shape: 0 is a rounded fan, 1 rises fast at the leading edge and trails away to the rear. */
  taper: number
  /** How far the membrane cups out of its own sweep plane; a flat fin reads as a plastic paddle. */
  cup: number
}

/** The caudal fin, which is built differently from the others: it is forked. */
export interface KoiCaudalShape {
  /** Tip-to-tip height of the fork, as a fraction of total length. */
  span: number
  /** How deep the fork's notch cuts back toward the peduncle, 0 to 1. */
  fork: number
  /** How far the lobe tips trail behind the notch, as a fraction of total length. */
  sweep: number
  /** Membrane thickness at the peduncle, as a fraction of total length. */
  thickness: number
  /** How far the two lobes fan sideways out of the blade's plane, tip to tip, as a fraction of total length. */
  // why: A perfectly flat vertical blade vanishes edge-on when the pond is watched from straight above; the dihedral keeps the fork silhouette present at every camera angle.
  spread: number
}

/** The physical build of one koi. */
export interface KoiPhysical {
  /** Nose-to-caudal-tip length in scene units. */
  length: number
  /** Width multiplier against the anatomy profile; 1 is a well-conditioned koi. */
  width: number
  /** Height multiplier against the anatomy profile. */
  height: number
  /** Width multiplier applied to the shoulders alone, where a koi is broadest. */
  shoulder: number
  /** Extra ventral volume below the axis, 0 to 1. */
  belly: number
  /** How pronounced the ridge along the back is, 0 to 1. */
  dorsalRidge: number
  /** Width multiplier applied to the caudal peduncle alone. */
  peduncleWidth: number
  /** Height multiplier applied to the caudal peduncle alone. */
  peduncleDepth: number
  /** The head. */
  head: KoiHeadShape
  /** The eyes. */
  eyes: KoiEyeShape
  /** The tail fin. */
  caudal: KoiCaudalShape
  /** The paired fins behind the gills. */
  pectoral: KoiFinShape
  /** The fin along the back. */
  dorsal: KoiFinShape
  /** The paired fins under the belly. */
  pelvic: KoiFinShape
  /** The single fin between the pelvics and the tail. */
  anal: KoiFinShape
}

/** The colours and markings one koi wears. */
export interface KoiAppearance {
  /** Which pattern family the markings are drawn from. */
  pattern: KoiPatternName
  /** The ground colour the koi is written on, as `#rrggbb`. */
  base: string
  /** The dominant marking colour, as `#rrggbb`. */
  primary: string
  /** The second marking colour, as `#rrggbb`. */
  secondary: string
  /** The accent used on fins and the iris, as `#rrggbb`. */
  accent: string
  /** How rough the skin is, 0 (mirror) to 1 (matte). */
  roughness: number
  /** Strength of the wet clear coat over the skin, 0 to 1. */
  gloss: number
  /** How opaque the fin membranes are, 0 to 1. */
  finOpacity: number
  /** How strongly the procedural scale relief reads, 0 to 1. */
  scaleDepth: number
  /** Scale rows across the flank; higher is finer. */
  scaleDensity: number
}

/** What the koi is doing, as a consumer describes it. */
export interface KoiMotionInput {
  /** Forward speed in body lengths per second. */
  speed: number
  /**
   * Signed turn rate in radians per second; positive turns toward the right flank.
   *
   * Matches a pond heading that grows clockwise on screen axes: feed the
   * heading's own rate of change straight in and the body bends into the turn.
   */
  turnRate: number
  /** Rate of change of speed in body lengths per second squared. */
  acceleration: number
  /** How hard the koi is bolting, 0 (calm) to 1 (full escape burst). */
  escapeIntensity: number
  /** How deep the koi is swimming, 0 (at the surface) to 1 (pond floor). */
  depth: number
  /** Signed climb rate, negative to dive and positive to rise, in body lengths per second. */
  climbRate: number
}

/** Per-koi trim on the swimming model, so two fish at the same speed still swim differently. */
export interface KoiSwimTrim {
  /** Multiplies the travelling wave's curvature. */
  amplitude: number
  /** Multiplies the tail-beat frequency. */
  frequency: number
  /** Shifts where the wave begins; positive moves it toward the snout. */
  waveReach: number
  /** Multiplies how many wavelengths fit along the koi. */
  wavesPerBody: number
  /** Multiplies the bend a turn puts in the body. */
  turn: number
  /** How sharply the koi answers the helm, 0 (ponderous) to 1 (twitchy). */
  responsiveness: number
}

/** Trim that changes nothing, which is where every koi starts. */
export const DEFAULT_TRIM: KoiSwimTrim = { amplitude: 1, frequency: 1, waveReach: 0, wavesPerBody: 1, turn: 1, responsiveness: 0.5 }

/** The mesh densities the generators build at. */
export interface KoiResolution {
  /** Vertices around each body ring. */
  radial: number
  /** Rings along the body, snout to caudal root. */
  rings: number
  /** Spans across each fin membrane. */
  finSpans: number
  /** Segments along each fin's root. */
  finSegments: number
}

/** Everything one koi is: its build, its skin, how it swims, and how finely it is tessellated. */
export interface KoiConfig {
  /** Stable integer seed; the pattern and every jitter derive from it. */
  seed: number
  /** Its build. */
  physical: KoiPhysical
  /** Its skin. */
  appearance: KoiAppearance
  /** Its own trim on the swimming model. */
  trim: KoiSwimTrim
  /** Its tessellation. */
  resolution: KoiResolution
}

/** A deeply optional {@link KoiConfig}, which is what callers actually pass. */
export type KoiConfigInput = {
  [K in keyof KoiConfig]?: KoiConfig[K] extends object
    ? { [P in keyof KoiConfig[K]]?: KoiConfig[K][P] extends object ? Partial<KoiConfig[K][P]> : KoiConfig[K][P] }
    : KoiConfig[K]
}

/** The build every koi starts from: a well-conditioned adult nishikigoi. */
export const DEFAULT_PHYSICAL: KoiPhysical = {
  length: 1,
  width: 1,
  height: 1,
  shoulder: 1,
  belly: 0.45,
  dorsalRidge: 0.16,
  peduncleWidth: 1,
  peduncleDepth: 1,
  head: { length: 0.26, width: 1.05, height: 1, snout: 0.8, forehead: 0.45 },
  eyes: { station: 0.115, spacing: 0.94, size: 0.019, protrusion: 0.42, rise: 0.34 },
  caudal: { span: 0.36, fork: 0.34, sweep: 0.22, thickness: 0.05, spread: 0.2 },
  pectoral: { station: 0.235, girth: 0.325, root: 0.05, span: 0.165, sweep: 0.6, scallop: 0.45, taper: 0.42, cup: 0.34 },
  dorsal: { station: 0.325, girth: 0, root: 0.255, span: 0.082, sweep: 0.26, scallop: 0.28, taper: 1, cup: 0.12 },
  pelvic: { station: 0.455, girth: 0.418, root: 0.042, span: 0.115, sweep: 0.66, scallop: 0.4, taper: 0.38, cup: 0.3 },
  anal: { station: 0.635, girth: 0.5, root: 0.058, span: 0.068, sweep: 0.58, scallop: 0.3, taper: 0.85, cup: 0.14 },
}

/** The skin every koi starts from: a kohaku, white with red. */
export const DEFAULT_APPEARANCE: KoiAppearance = {
  pattern: 'kohaku',
  base: '#f6f1e9',
  primary: '#d8422a',
  secondary: '#1d1a18',
  accent: '#e8734a',
  roughness: 0.52,
  gloss: 0.45,
  finOpacity: 0.8,
  scaleDepth: 0.45,
  scaleDensity: 30,
}

/** The tessellation every koi starts from; smooth from a metre away and cheap to draw. */
export const DEFAULT_RESOLUTION: KoiResolution = {
  radial: 26,
  rings: 56,
  finSpans: 11,
  finSegments: 7,
}

/** A koi that is doing nothing at all. */
export const DEFAULT_MOTION: KoiMotionInput = {
  speed: 0,
  turnRate: 0,
  acceleration: 0,
  escapeIntensity: 0,
  depth: 0.35,
  climbRate: 0,
}

/**
 * Merges a partial config over the defaults, one group at a time.
 *
 * @param input - Whatever the caller chose to override.
 * @returns A complete config with every field populated.
 *
 * @example Building a wider koi with a gold skin
 * ```typescript
 * const config = resolveKoiConfig({ physical: { width: 1.15 }, appearance: { pattern: 'ogon' } })
 * ```
 */
export function resolveKoiConfig(input: KoiConfigInput = {}): KoiConfig {
  const physical = input.physical ?? {}
  return {
    seed: input.seed ?? 1,
    physical: {
      ...DEFAULT_PHYSICAL,
      ...physical,
      head: { ...DEFAULT_PHYSICAL.head, ...physical.head },
      eyes: { ...DEFAULT_PHYSICAL.eyes, ...physical.eyes },
      caudal: { ...DEFAULT_PHYSICAL.caudal, ...physical.caudal },
      pectoral: { ...DEFAULT_PHYSICAL.pectoral, ...physical.pectoral },
      dorsal: { ...DEFAULT_PHYSICAL.dorsal, ...physical.dorsal },
      pelvic: { ...DEFAULT_PHYSICAL.pelvic, ...physical.pelvic },
      anal: { ...DEFAULT_PHYSICAL.anal, ...physical.anal },
    },
    appearance: { ...DEFAULT_APPEARANCE, ...input.appearance },
    trim: { ...DEFAULT_TRIM, ...input.trim },
    resolution: { ...DEFAULT_RESOLUTION, ...input.resolution },
  }
}
