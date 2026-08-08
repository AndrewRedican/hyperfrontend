/**
 * The virtual pond: a coordinate space larger than the window onto it.
 *
 * Pond space shares the viewport's axes and origin, then runs past every edge by
 * a margin measured in fish lengths. A koi that swims off screen keeps an honest
 * position and comes back on its own terms — nothing is ever clamped to the
 * viewport, and nothing bounces off it.
 *
 * The boundary is felt rather than hit. {@link boundaryPressure} reports how
 * hard the far edge is pushing on a koi *given where it is heading*: a fish
 * running parallel to an edge feels nothing, and a fish pointed at one feels the
 * pressure build long before it arrives. Steering on that pressure produces the
 * long, lazy curve a koi actually swims; steering on distance alone produces a
 * fish that bounces.
 */
import type { PondEnvironment, Vec2 } from '../model/types.js'
import { DEPTH_LEVELS } from '../model/types.js'

/** How far pond space runs past each viewport edge, in nominal fish lengths. */
export const MARGIN_FISH_LENGTHS = 1.6

/** The nominal fish length as a fraction of the viewport's shorter axis. */
const FISH_LENGTH_RATIO = 0.2

/** Smallest nominal fish length in CSS pixels, so a koi stays legible in a small card. */
const MIN_FISH_LENGTH = 90

/** Largest nominal fish length in CSS pixels, so a koi does not fill a wide desktop. */
const MAX_FISH_LENGTH = 260

/** How far inside the boundary a koi starts feeling it, in nominal fish lengths. */
const AWARENESS_FISH_LENGTHS = 2.2

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
 * Derives the nominal koi length for a viewport.
 *
 * @param width - Viewport width in CSS pixels.
 * @param height - Viewport height in CSS pixels.
 * @returns The nominal nose-to-tail length in CSS pixels.
 */
export function nominalFishLength(width: number, height: number): number {
  const shorter = Math.min(Math.max(width, 0), Math.max(height, 0))
  return clamp(shorter * FISH_LENGTH_RATIO, MIN_FISH_LENGTH, MAX_FISH_LENGTH)
}

/**
 * Describes the pond for a measured viewport.
 *
 * @param width - Viewport width in CSS pixels, as the host measured it.
 * @param height - Viewport height in CSS pixels, as the host measured it.
 * @param reducedMotion - Whether the visitor asked for reduced motion.
 * @returns The environment to announce to every fish.
 *
 * @example Announcing the world after a resize
 * ```typescript
 * const pond = describePond(frame.clientWidth, frame.clientHeight, motionQuery.matches)
 * sessions.forEach((session) => session.shell.send('pond', pond))
 * ```
 */
export function describePond(width: number, height: number, reducedMotion: boolean): PondEnvironment {
  const fishLength = nominalFishLength(width, height)
  return {
    width,
    height,
    margin: fishLength * MARGIN_FISH_LENGTHS,
    fishLength,
    depthLevels: DEPTH_LEVELS,
    reducedMotion,
  }
}

/** How far from the pond's centre a koi enters, as a fraction of the shorter viewport axis. */
const ENTRY_RADIUS_RATIO = 0.34

/** How much a koi's own seed varies its entry radius, so the shoal is not laid out on a perfect circle. */
const ENTRY_RADIUS_JITTER = 0.42

/**
 * Where one koi enters the pond, and pointing which way.
 *
 * Entry is a property of the pond rather than of any fish's brain, which is why
 * it lives here: seven apps that each chose their own entry would either
 * collide on one spot or need to negotiate, and neither is the point of the
 * demo. Deriving the station from the koi's own seed means the shoal fans out
 * on first paint with nothing exchanged between the apps at all.
 *
 * @param pond - The announced environment.
 * @param seed - The koi's stable seed, from `koiSeed`.
 * @returns Its entry nose position and heading.
 *
 * @example Placing a koi at boot
 * ```typescript
 * const entry = entryStation(pond, koiSeed('lit'))
 * const motion = createKoiMotion({ profile, pond, ...entry, depth: 3 })
 * ```
 */
export function entryStation(pond: PondEnvironment, seed: number): { position: Vec2; heading: number } {
  // magic: The seeds are multiples of 977, and 977 mod 360 is coprime with 360 — so taking the residue fans the seven koi out on an almost perfectly even 51-degree spacing, which no random draw would reliably beat.
  const angle = (seed % 360) * (Math.PI / 180)
  const centre = { x: pond.width / 2, y: pond.height / 2 }
  // why: Measured on the shorter axis so every koi enters inside the visible pond; entering out in the margin would open the scene on empty water.
  const spread = 1 - ENTRY_RADIUS_JITTER / 2 + (seed % 7) * (ENTRY_RADIUS_JITTER / 7)
  const radius = Math.min(pond.width, pond.height) * ENTRY_RADIUS_RATIO * spread
  const position = { x: centre.x + Math.cos(angle) * radius, y: centre.y + Math.sin(angle) * radius }
  return { position, heading: Math.atan2(centre.y - position.y, centre.x - position.x) }
}

/** The rectangle pond space occupies, viewport plus margins. */
export interface PondBounds {
  /** Leftmost pond-space x. */
  left: number
  /** Topmost pond-space y. */
  top: number
  /** Rightmost pond-space x. */
  right: number
  /** Bottommost pond-space y. */
  bottom: number
}

/**
 * The rectangle pond space occupies.
 *
 * @param pond - The announced environment.
 * @returns Its bounds in pond space.
 */
export function pondBounds(pond: PondEnvironment): PondBounds {
  return {
    left: -pond.margin,
    top: -pond.margin,
    right: pond.width + pond.margin,
    bottom: pond.height + pond.margin,
  }
}

/**
 * Whether a pond-space point currently falls inside the visible window.
 *
 * @param pond - The announced environment.
 * @param point - The point to test.
 * @param slack - Extra pixels of tolerance beyond each viewport edge.
 * @returns `true` when the point would paint on screen.
 *
 * @example Skipping render work for an off-screen koi
 * ```typescript
 * if (!isVisible(pond, nose, bodyLength)) {
 *   return
 * }
 * ```
 */
export function isVisible(pond: PondEnvironment, point: Vec2, slack = 0): boolean {
  return point.x >= -slack && point.y >= -slack && point.x <= pond.width + slack && point.y <= pond.height + slack
}

/**
 * Places a point at a fraction across the pond, margins included.
 *
 * @param pond - The announced environment.
 * @param fx - Fraction across the pond's width, 0 to 1.
 * @param fy - Fraction down the pond's height, 0 to 1.
 * @returns The pond-space point.
 */
export function pondPoint(pond: PondEnvironment, fx: number, fy: number): Vec2 {
  const bounds = pondBounds(pond)
  return {
    x: bounds.left + (bounds.right - bounds.left) * fx,
    y: bounds.top + (bounds.bottom - bounds.top) * fy,
  }
}

/**
 * Re-places a point when the pond resizes, keeping its relative station.
 *
 * A koi three-quarters of the way across a wide pond should still be three
 * quarters across a narrow one, rather than stranded outside it.
 *
 * @param point - The point in the old pond's space.
 * @param from - The pond it was placed in.
 * @param to - The pond it is moving to.
 * @returns The equivalent point in the new pond's space.
 */
export function rescalePoint(point: Vec2, from: PondEnvironment, to: PondEnvironment): Vec2 {
  const before = pondBounds(from)
  const after = pondBounds(to)
  const spanX = before.right - before.left
  const spanY = before.bottom - before.top
  // why: A zero-span pond is a frame that has not been laid out yet; keeping the point put beats dividing by zero.
  const fx = spanX === 0 ? 0.5 : (point.x - before.left) / spanX
  const fy = spanY === 0 ? 0.5 : (point.y - before.top) / spanY
  return {
    x: after.left + (after.right - after.left) * fx,
    y: after.top + (after.bottom - after.top) * fy,
  }
}

/** How hard the pond boundary is pushing on a koi, and which way it should turn. */
export interface BoundaryPressure {
  /** How urgently the boundary is felt, 0 (not at all) to 1 (about to leave). */
  urgency: number
  /** Unit vector pointing back toward open water, or `{ x: 0, y: 0 }` when nothing is felt. */
  inward: Vec2
}

/**
 * Reports how hard the pond's edge is pushing on a koi.
 *
 * Pressure is forward-aware: it counts only the edges the koi is actually
 * heading toward, and it grows with both proximity and how squarely the koi is
 * pointed at them. A fish running parallel to an edge feels nothing at all.
 *
 * @param pond - The announced environment.
 * @param position - The koi's nose in pond space.
 * @param heading - The koi's heading in radians.
 * @returns The felt pressure and the direction back to open water.
 *
 * @example Curving away from the boundary
 * ```typescript
 * const pressure = boundaryPressure(pond, nose, heading)
 * if (pressure.urgency > 0) {
 *   steer(pressure.inward, pressure.urgency * traits.directionalCaution)
 * }
 * ```
 */
export function boundaryPressure(pond: PondEnvironment, position: Vec2, heading: number): BoundaryPressure {
  const bounds = pondBounds(pond)
  const reach = pond.fishLength * AWARENESS_FISH_LENGTHS
  const forwardX = Math.cos(heading)
  const forwardY = Math.sin(heading)

  // how: Each edge contributes only when the koi is closing on it; the contributions add, so a corner pushes harder than a wall.
  let inwardX = 0
  let inwardY = 0
  let urgency = 0

  /**
   * Folds one edge's contribution into the running pressure.
   *
   * @param gap - Distance from the koi to that edge; negative once past it.
   * @param normalX - Inward unit normal, horizontal component.
   * @param normalY - Inward unit normal, vertical component.
   */
  const consider = (gap: number, normalX: number, normalY: number): void => {
    const closing = -(forwardX * normalX + forwardY * normalY)
    if (closing <= 0) {
      return
    }
    const nearness = clamp(1 - gap / reach, 0, 1)
    if (nearness <= 0) {
      return
    }
    // magic: Squaring the nearness keeps the far half of the reach almost free and makes the last stretch decisive.
    const weight = nearness * nearness * closing
    inwardX += normalX * weight
    inwardY += normalY * weight
    urgency = Math.max(urgency, weight)
  }

  consider(position.x - bounds.left, 1, 0)
  consider(bounds.right - position.x, -1, 0)
  consider(position.y - bounds.top, 0, 1)
  consider(bounds.bottom - position.y, 0, -1)

  const magnitude = Math.hypot(inwardX, inwardY)
  if (magnitude === 0) {
    return { urgency: 0, inward: { x: 0, y: 0 } }
  }
  return { urgency: clamp(urgency, 0, 1), inward: { x: inwardX / magnitude, y: inwardY / magnitude } }
}
