/**
 * The depth model.
 *
 * Seven logical levels stack the koi from the pond floor to just under the
 * surface. The host owns the levels — it maps them to the z-index of the
 * containers it created — but the *look* of a level is shared, so a koi rising
 * past another agrees with the host about which of them is nearer the light.
 *
 * Passing is deliberately expensive: two koi may only cross paths when their
 * levels differ by at least {@link PASSING_SEPARATION}, and a level change is
 * rate-limited by a cooldown so the shoal never flickers between orderings.
 */
import { DEPTH_LEVELS, SURFACE_DEPTH } from './types.js'

/** Minimum level difference that lets two koi cross paths without avoiding each other. */
export const PASSING_SEPARATION = 2

/** Milliseconds a koi must hold a level before the host will grant it another change. */
export const DEPTH_COOLDOWN_MS = 2600

/** Milliseconds a koi spends rolling between two levels. */
export const DEPTH_TRANSITION_MS = 1400

/** Rendered scale at the deepest level; the surface level renders at 1. */
const DEEPEST_SCALE = 0.72

/** Rendered opacity at the deepest level; the surface level renders at 1. */
const DEEPEST_OPACITY = 0.58

/** Blur in CSS pixels applied at the deepest level, easing to 0 at the surface. */
const DEEPEST_BLUR = 1.5

/**
 * Clamps a value into an inclusive band.
 *
 * @param value - The value to clamp.
 * @param min - Band floor.
 * @param max - Band ceiling.
 * @returns The clamped value.
 */
function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value
}

/**
 * Normalises a depth level to `0` at the pond floor and `1` at the surface.
 *
 * Accepts fractional levels so a koi mid-transition reads correctly.
 *
 * @param level - The depth level, 0 through {@link SURFACE_DEPTH}.
 * @returns The normalised depth.
 */
export function depthFraction(level: number): number {
  return clamp(level, 0, SURFACE_DEPTH) / SURFACE_DEPTH
}

/**
 * How large a koi renders at a depth level.
 *
 * @param level - The depth level, fractional while transitioning.
 * @returns A scale multiplier applied to the koi's body length.
 *
 * @example Sizing a koi for its level
 * ```typescript
 * const length = pond.fishLength * profile.build.lengthScale * depthScale(3)
 * ```
 */
export function depthScale(level: number): number {
  return DEEPEST_SCALE + (1 - DEEPEST_SCALE) * depthFraction(level)
}

/**
 * How strongly a koi shows through the water at a depth level.
 *
 * @param level - The depth level, fractional while transitioning.
 * @returns An opacity between {@link DEEPEST_OPACITY} and 1.
 */
export function depthOpacity(level: number): number {
  return DEEPEST_OPACITY + (1 - DEEPEST_OPACITY) * depthFraction(level)
}

/**
 * How far out of focus the water puts a koi at a depth level.
 *
 * @param level - The depth level, fractional while transitioning.
 * @returns A blur radius in CSS pixels.
 */
export function depthBlur(level: number): number {
  return DEEPEST_BLUR * (1 - depthFraction(level))
}

/**
 * The z-index a host container takes for a depth level.
 *
 * Levels are laid between the pond floor and the surface-water layer, so a koi
 * can never paint over the water it swims under.
 *
 * @param level - The depth level.
 * @returns The stacking index for that level's container.
 */
export function depthZIndex(level: number): number {
  return 1 + clamp(Math.round(level), 0, SURFACE_DEPTH)
}

/**
 * Whether a koi at this level may ask the host for a surface ripple.
 *
 * @param level - The depth level.
 * @returns `true` only for the level immediately under the surface.
 */
export function mayRipple(level: number): boolean {
  return Math.round(level) === SURFACE_DEPTH
}

/**
 * Whether two koi are separated enough in depth to ignore each other entirely.
 *
 * @param a - One koi's depth level.
 * @param b - The other koi's depth level.
 * @returns `true` when they may cross without avoiding.
 */
export function canPass(a: number, b: number): boolean {
  return Math.abs(a - b) >= PASSING_SEPARATION
}

/** A koi's depth as the host tracks it, including any transition in flight. */
export interface DepthState {
  /** The level the koi holds, or is leaving. */
  level: number
  /** The level it is moving to, or `null` when settled. */
  target: number | null
  /** Host clock reading when the current level was granted. */
  since: number
}

/**
 * Starts a koi at a level.
 *
 * @param level - The level to hold.
 * @param now - Host clock reading.
 * @returns A settled depth state.
 */
export function startDepth(level: number, now: number): DepthState {
  return { level: clamp(Math.round(level), 0, SURFACE_DEPTH), target: null, since: now }
}

/**
 * Decides whether a requested level change is granted.
 *
 * A request is refused while a transition is in flight, while the cooldown since
 * the last grant is unspent, or when the request does not actually move the koi.
 *
 * @param state - The koi's current depth state.
 * @param requested - The level it asked for.
 * @param now - Host clock reading.
 * @returns `true` when the host should grant the change.
 *
 * @example Gating a fish's depth request
 * ```typescript
 * if (grantsDepth(state, requested, Date.now())) {
 *   shell.send('depth', { level: requested })
 * }
 * ```
 */
export function grantsDepth(state: DepthState, requested: number, now: number): boolean {
  if (state.target !== null) {
    return false
  }
  if (now - state.since < DEPTH_COOLDOWN_MS) {
    return false
  }
  const target = clamp(Math.round(requested), 0, SURFACE_DEPTH)
  return target !== state.level
}

/**
 * Begins a granted transition.
 *
 * @param state - The koi's current depth state.
 * @param target - The granted level.
 * @param now - Host clock reading.
 * @returns The transitioning depth state.
 */
export function beginDepthChange(state: DepthState, target: number, now: number): DepthState {
  return { level: state.level, target: clamp(Math.round(target), 0, SURFACE_DEPTH), since: now }
}

/**
 * Advances a transition, settling it once {@link DEPTH_TRANSITION_MS} has passed.
 *
 * @param state - The koi's depth state.
 * @param now - Host clock reading.
 * @returns The advanced state, settled when the transition has run its course.
 */
export function advanceDepth(state: DepthState, now: number): DepthState {
  if (state.target === null || now - state.since < DEPTH_TRANSITION_MS) {
    return state
  }
  return { level: state.target, target: null, since: now }
}

/**
 * The level a koi renders at right now, fractional while it is transitioning.
 *
 * @param state - The koi's depth state.
 * @param now - Host clock reading.
 * @returns The rendered level.
 */
export function renderedDepth(state: DepthState, now: number): number {
  if (state.target === null) {
    return state.level
  }
  const progress = clamp((now - state.since) / DEPTH_TRANSITION_MS, 0, 1)
  // why: A smoothstep keeps the roll gentle at both ends, so a level change reads as a glide rather than a jump.
  const eased = progress * progress * (3 - 2 * progress)
  return state.level + (state.target - state.level) * eased
}

/**
 * Spreads the shoal across every level, deepest first.
 *
 * @param count - How many koi to place.
 * @returns One starting level per koi, in the order given.
 */
export function spreadDepths(count: number): number[] {
  if (count <= 1) {
    return count === 1 ? [SURFACE_DEPTH] : []
  }
  // why: Evenly spanning the full range keeps the shoal legible at first paint; the simulation scrambles it from there.
  return Array.from({ length: count }, (_unused, index) => Math.round((index * SURFACE_DEPTH) / (count - 1)))
}

/** How many depth levels the pond offers. */
export { DEPTH_LEVELS, SURFACE_DEPTH }
