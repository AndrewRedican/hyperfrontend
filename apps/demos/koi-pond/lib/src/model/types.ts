/**
 * The vocabulary every pond project shares.
 *
 * Positions are always in *pond space*: CSS pixels on the host's viewport axes,
 * with the origin at the viewport's top-left corner. Pond space extends past
 * every viewport edge by a margin, so a koi that has swum off screen still has
 * an honest coordinate — the viewport is a window onto the pond, not its edge.
 */

/** A point in pond space, in CSS pixels. */
export interface Vec2 {
  /** Horizontal position; 0 is the viewport's left edge. */
  x: number
  /** Vertical position; 0 is the viewport's top edge. */
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

/**
 * The world the host announces to every fish, resent on resize.
 *
 * `width` and `height` are the host's measured frame, not `window.innerWidth` —
 * a fish embedded in a docs-site card is smaller than the tab it renders in.
 */
export interface PondEnvironment {
  /** Visible pond width in CSS pixels, as the host measured it. */
  width: number
  /** Visible pond height in CSS pixels, as the host measured it. */
  height: number
  /** How far pond space extends past each viewport edge, in CSS pixels. */
  margin: number
  /** Nose-to-tail length of a koi at depth scale 1, in CSS pixels. */
  fishLength: number
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
 * chain, never an SVG path. Five samples describe a koi closely enough for
 * proximity work at a fraction of the payload.
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
  /** Caudal fin span as a fraction of body length. */
  tailSpan: number
  /** Pectoral fin span as a fraction of body length. */
  finSpan: number
}

/** The colours one koi wears, derived from its framework's brand. */
export interface KoiPalette {
  /** Base body colour — the koi's ground. */
  body: string
  /** Shadowed underside, painted toward the belly. */
  shade: string
  /** The framework-coloured marking splashed over the back. */
  marking: string
  /** Translucent fin and tail tint. */
  fin: string
  /** The exact brand colour, used by hover identity chrome. */
  accent: string
}

/** Everything about one koi that never changes once the pond has opened. */
export interface KoiProfile {
  /** The framework slug rendering it. */
  framework: KoiFramework
  /** Human-readable framework name for hover identity. */
  label: string
  /** Its behavioural traits. */
  traits: KoiTraits
  /** Its physical build. */
  build: KoiBuild
  /** Its colours. */
  palette: KoiPalette
}
