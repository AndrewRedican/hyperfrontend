/**
 * The vocabulary every pond project shares.
 *
 * Positions are always in *pond space*: CSS pixels with the origin at the
 * virtual pond's top-left corner. The virtual pond is sized once, when the
 * scene first opens, and never changes for the life of the running instance;
 * what changes is the *view* — the window of pond space a visitor can
 * currently see through whatever frame presents the scene. Pond space
 * additionally extends past every pond edge by a margin, so a koi that has
 * swum out of the pond proper still has an honest coordinate.
 */

import type { KoiPhysical, KoiSwimTrim } from '../koi3d/config.js'

/** A point in pond space, in CSS pixels. */
export interface Vec2 {
  /** Horizontal position; 0 is the virtual pond's left edge. */
  x: number
  /** Vertical position; 0 is the virtual pond's top edge. */
  y: number
}

/** The seven framework slugs, one per koi; also each fish app's deployed sub-path. */
export type KoiFramework = 'vanilla' | 'react' | 'vue' | 'svelte' | 'solid' | 'preact' | 'lit'

/** Every framework slug in the pond's canonical order, shallowest-first by default depth. */
export const KOI_FRAMEWORKS: readonly KoiFramework[] = ['vanilla', 'react', 'vue', 'svelte', 'solid', 'preact', 'lit']

/**
 * The four visibly distinct states a koi's body reads in.
 *
 * `relaxed` is the ambient cruise; `turning` bends the spine hard through a
 * course change; `escape` is the burst away from a disturbance; and
 * `depth-transition` is the roll-and-sink (or rise) between depth levels.
 */
export type KoiPhase = 'relaxed' | 'turning' | 'escape' | 'depth-transition'

/** Number of logical depth levels, 0 (deepest) through 6 (just under the surface). */
export const DEPTH_LEVELS = 7

/** The depth level whose fish alone may ask the host for a surface ripple. */
export const SURFACE_DEPTH = DEPTH_LEVELS - 1

/** The window of pond space a visitor can currently see, in CSS pixels. */
export interface PondWindow {
  /** Pond-space x of the window's left edge. */
  x: number
  /** Pond-space y of the window's top edge. */
  y: number
  /** Window width in CSS pixels; matches the presenting frame. */
  width: number
  /** Window height in CSS pixels; matches the presenting frame. */
  height: number
}

/**
 * The world the host announces to every fish, resent whenever the view moves.
 *
 * `width` and `height` are the *virtual pond* — sized from a screen snapshot
 * when the scene first opens and stable from then on. Only `view` follows the
 * presenting frame: a gallery card, an expanded overlay, and a debug panel are
 * different windows onto the same pond, never different ponds.
 */
export interface PondEnvironment {
  /** Virtual pond width in CSS pixels; fixed for the life of the instance. */
  width: number
  /** Virtual pond height in CSS pixels; fixed for the life of the instance. */
  height: number
  /** How far pond space extends past each pond edge, in CSS pixels. */
  margin: number
  /** Nose-to-tail length of a koi at depth scale 1, in CSS pixels. */
  fishLength: number
  /** The window of the pond the presenting frame currently shows. */
  view: PondWindow
  /** How many depth levels the pond offers; always {@link DEPTH_LEVELS} today. */
  depthLevels: number
  /** Whether the visitor asked for reduced motion; every fish damps in step. */
  reducedMotion: boolean
}

/** The identity the host assigns a fish at open: who it is and where its app lives. */
export interface KoiIdentity {
  /** The framework slug rendering this koi. */
  framework: KoiFramework
  /** Stable integer seed; every reproducible trait derives from it. */
  seed: number
  /** Absolute URL of the app rendering this koi, revealed on hover. */
  url: string
  /** Depth level the host assigned at open. */
  depth: number
}

/** A surface disturbance a koi may flee. */
export interface Disturbance {
  /** Pond-space x of the strike. */
  x: number
  /** Pond-space y of the strike. */
  y: number
  /** Strike intensity, 0 to 1; a direct click is 1. */
  intensity: number
}

/**
 * One koi's occupied outline, reported to the host at low cadence.
 *
 * The outline is a spine sample chain with a half-width per sample — a capsule
 * chain. Five samples describe a koi closely enough for proximity work at a
 * fraction of the payload.
 */
export interface KoiOutline {
  /** The framework slug identifying the reporter. */
  framework: KoiFramework
  /** Nose-first spine samples in pond space. */
  spine: readonly Vec2[]
  /** Half-width at each spine sample, in CSS pixels; same length as `spine`. */
  girth: readonly number[]
  /** Heading in radians; 0 points along +x, growing clockwise on screen axes. */
  heading: number
  /** Speed along the heading, in pixels per second. */
  speed: number
  /** Current depth level. */
  depth: number
  /** The behavioural state the body is reading in. */
  phase: KoiPhase
  /**
   * The pond-space rectangle of the identity card's URL line, while the card is
   * showing.
   *
   * The koi's frame is pointer-transparent, so a link drawn inside it can never
   * be clicked; reporting where the URL text sits lets the host float a real
   * anchor over it.
   */
  card?: KoiCardLink
}

/** The pond-space rectangle one koi's card URL line occupies. */
export interface KoiCardLink {
  /** Pond-space x of the rectangle's left edge. */
  x: number
  /** Pond-space y of the rectangle's top edge. */
  y: number
  /** Rectangle width in CSS pixels. */
  width: number
  /** Rectangle height in CSS pixels. */
  height: number
}

/**
 * What one koi is told about another, after the host's broad-phase filter.
 *
 * Deliberately smaller than a full {@link KoiOutline}: a neighbour needs a
 * position, a course, and a size to steer around — not the other fish's spine.
 */
export interface NeighborObservation {
  /** The neighbour's framework slug. */
  framework: KoiFramework
  /** Neighbour nose position in pond space. */
  x: number
  /** Neighbour nose position in pond space. */
  y: number
  /** Neighbour heading in radians. */
  heading: number
  /** Neighbour speed in pixels per second. */
  speed: number
  /** Neighbour depth level. */
  depth: number
  /** Neighbour nose-to-tail length in CSS pixels. */
  length: number
  /** Neighbour's widest half-width in CSS pixels, so clearance can respect a heavier build. */
  girth: number
}

/** The eight normalised behavioural traits that make each koi its own animal. */
export interface KoiTraits {
  /** How briskly it cruises when nothing is happening. */
  cruiseSpeed: number
  /** How readily a disturbance sets it off. */
  shyness: number
  /** How much it prefers company to solitude. */
  socialAffinity: number
  /** How far out it notices neighbours and disturbances. */
  awareness: number
  /** How early it starts curving away from the pond boundary. */
  directionalCaution: number
  /** How willingly it changes depth to resolve a crossing. */
  depthWillingness: number
  /** How hard it bursts when it does startle. */
  reactionIntensity: number
  /** How sharply it can change heading. */
  turnResponsiveness: number
}

/** The physical build of one koi, derived alongside its traits. */
export interface KoiBuild {
  /** Nose-to-tail length multiplier against the pond's nominal fish length. */
  lengthScale: number
  /** Widest half-width as a fraction of body length. */
  girthRatio: number
  /** Body width multiplier against the sculpted anatomy; 1 is a well-conditioned koi. */
  widthScale: number
  /** Body height multiplier against the sculpted anatomy. */
  heightScale: number
  /** Caudal fin span as a fraction of body length. */
  tailSpan: number
  /** Pectoral fin span as a fraction of body length. */
  finSpan: number
}

/** The colours one koi wears: its framework's brand carried on a real koi variety. */
export interface KoiPalette {
  /**
   * The nishikigoi pattern family the markings are drawn from.
   *
   * Mirrors the pattern names the 3D skin understands; the framework's brand
   * stays the dominant marking while the variety supplies the natural white,
   * black, and orange tones that make the animal read as a koi.
   */
  pattern: 'kohaku' | 'sanke' | 'showa' | 'ogon' | 'asagi' | 'karasu' | 'brand'
  /** Ground colour the koi is written on — a natural koi tone, not a brand colour. */
  body: string
  /** Secondary marking colour — sumi black, orange, or another natural koi tone; means nothing about the framework. */
  shade: string
  /** The framework-coloured marking splashed over the back — the dominant identifier. */
  marking: string
  /** Translucent fin and tail tint. */
  fin: string
  /** The exact brand colour, used by hover identity chrome. */
  accent: string
}

/**
 * The sculpted-body overrides one koi carries into the 3D model.
 *
 * A deeply partial {@link KoiPhysical}: only the levers a phenotype pulls are
 * present, and everything else keeps the sculpted default.
 */
export type KoiPhenotype = {
  [K in keyof KoiPhysical]?: KoiPhysical[K] extends object ? Partial<KoiPhysical[K]> : KoiPhysical[K]
}

/** Everything about one koi that never changes once the pond has opened. */
export interface KoiProfile {
  /** The framework slug rendering it. */
  framework: KoiFramework
  /** Human-readable framework name for hover identity. */
  label: string
  /** Its behavioural traits. */
  traits: KoiTraits
  /** Its physical build, as the 2D outline and the wire describe it. */
  build: KoiBuild
  /** Its sculpted-body overrides, as the 3D model takes them. */
  phenotype: KoiPhenotype
  /** Its own trim on the swimming model. */
  trim: KoiSwimTrim
  /** Its colours. */
  palette: KoiPalette
}
