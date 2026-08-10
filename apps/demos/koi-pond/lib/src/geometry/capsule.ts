/**
 * Proximity maths over reported outlines.
 *
 * A koi's occupied space is a capsule chain: the spine samples it reported, each
 * carrying a half-width. Everything the host needs — is the pointer over this
 * fish, are these two about to collide, which pairs are even worth checking —
 * reduces to distances against that chain.
 *
 * The rendered koi and the koi the physics knows about are deliberately
 * different objects, and the cheap one is the one that crosses the frame
 * boundary.
 */
import type { KoiOutline, Vec2 } from '../model/types.js'

/** An axis-aligned box in pond space. */
export interface Bounds {
  /** Leftmost x. */
  left: number
  /** Topmost y. */
  top: number
  /** Rightmost x. */
  right: number
  /** Bottommost y. */
  bottom: number
}

/**
 * The closest distance from a point to a line segment.
 *
 * @param point - The point to measure from.
 * @param from - Segment start.
 * @param to - Segment end.
 * @returns The distance in CSS pixels.
 */
export function pointSegmentDistance(point: Vec2, from: Vec2, to: Vec2): number {
  const dx = to.x - from.x
  const dy = to.y - from.y
  const lengthSquared = dx * dx + dy * dy
  if (lengthSquared === 0) {
    return Math.hypot(point.x - from.x, point.y - from.y)
  }
  const raw = ((point.x - from.x) * dx + (point.y - from.y) * dy) / lengthSquared
  const t = raw < 0 ? 0 : raw > 1 ? 1 : raw
  return Math.hypot(point.x - (from.x + dx * t), point.y - (from.y + dy * t))
}

/**
 * The signed distance from a point to a koi's body.
 *
 * Negative inside the fish, zero on its skin, positive in open water.
 *
 * @param point - The point to measure, in pond space.
 * @param spine - The koi's reported spine samples, nose first.
 * @param girth - Half-width at each sample.
 * @returns The signed distance in CSS pixels; `Infinity` for an empty chain.
 *
 * @example Hit-testing the host's pointer
 * ```typescript
 * const hovered = signedDistanceToChain(pointer, outline.spine, outline.girth) <= 0
 * ```
 */
export function signedDistanceToChain(point: Vec2, spine: readonly Vec2[], girth: readonly number[]): number {
  let best = Number.POSITIVE_INFINITY
  for (let index = 0; index < spine.length - 1; index += 1) {
    const from = spine[index]
    const to = spine[index + 1]
    const fromWidth = girth[index]
    const toWidth = girth[index + 1]
    if (from === undefined || to === undefined || fromWidth === undefined || toWidth === undefined) {
      continue
    }
    // how: Averaging the two half-widths approximates a tapered capsule closely enough; an exact cone test costs more than the shoal is worth.
    const distance = pointSegmentDistance(point, from, to) - (fromWidth + toWidth) / 2
    if (distance < best) {
      best = distance
    }
  }
  if (spine.length === 1) {
    const only = spine[0]
    const width = girth[0]
    if (only !== undefined && width !== undefined) {
      return Math.hypot(point.x - only.x, point.y - only.y) - width
    }
  }
  return best
}

/**
 * Whether a point falls on a koi's body.
 *
 * @param point - The point to test, in pond space.
 * @param outline - The koi's reported outline.
 * @param slack - Extra pixels of tolerance, so a small koi is still easy to hover.
 * @returns `true` when the point is on the fish.
 */
export function outlineContains(point: Vec2, outline: KoiOutline, slack = 0): boolean {
  return signedDistanceToChain(point, outline.spine, outline.girth) <= slack
}

/**
 * The box a capsule chain occupies.
 *
 * @param spine - The koi's spine samples.
 * @param girth - Half-width at each sample.
 * @returns The bounding box, or a degenerate box at the origin for an empty chain.
 */
export function chainBounds(spine: readonly Vec2[], girth: readonly number[]): Bounds {
  let left = Number.POSITIVE_INFINITY
  let top = Number.POSITIVE_INFINITY
  let right = Number.NEGATIVE_INFINITY
  let bottom = Number.NEGATIVE_INFINITY
  for (let index = 0; index < spine.length; index += 1) {
    const point = spine[index]
    const width = girth[index] ?? 0
    if (point === undefined) {
      continue
    }
    left = Math.min(left, point.x - width)
    top = Math.min(top, point.y - width)
    right = Math.max(right, point.x + width)
    bottom = Math.max(bottom, point.y + width)
  }
  if (left === Number.POSITIVE_INFINITY) {
    return { left: 0, top: 0, right: 0, bottom: 0 }
  }
  return { left, top, right, bottom }
}

/**
 * Whether two boxes overlap, with an optional pad on both.
 *
 * @param a - The first box.
 * @param b - The second box.
 * @param pad - Extra pixels added to every edge before testing.
 * @returns `true` when the padded boxes intersect.
 */
export function boundsOverlap(a: Bounds, b: Bounds, pad = 0): boolean {
  return a.left - pad <= b.right + pad && b.left - pad <= a.right + pad && a.top - pad <= b.bottom + pad && b.top - pad <= a.bottom + pad
}

/**
 * The smallest gap between two koi bodies.
 *
 * @param a - The first koi's outline.
 * @param b - The second koi's outline.
 * @returns The gap in CSS pixels; negative when the bodies overlap.
 *
 * @example Deciding whether an encounter needs resolving
 * ```typescript
 * if (chainGap(mine, theirs) < pond.fishLength * 0.5) {
 *   avoid(theirs)
 * }
 * ```
 */
export function chainGap(a: KoiOutline, b: KoiOutline): number {
  let best = Number.POSITIVE_INFINITY
  for (let index = 0; index < a.spine.length; index += 1) {
    const point = a.spine[index]
    const width = a.girth[index] ?? 0
    if (point === undefined) {
      continue
    }
    const distance = signedDistanceToChain(point, b.spine, b.girth) - width
    if (distance < best) {
      best = distance
    }
  }
  return best
}

/**
 * The point on a koi's body nearest a probe, used to aim hover chrome.
 *
 * @param point - The probe, in pond space.
 * @param spine - The koi's spine samples.
 * @returns The nearest spine sample, or `null` for an empty chain.
 */
export function nearestSpinePoint(point: Vec2, spine: readonly Vec2[]): Vec2 | null {
  let best: Vec2 | null = null
  let bestDistance = Number.POSITIVE_INFINITY
  for (const sample of spine) {
    const distance = Math.hypot(point.x - sample.x, point.y - sample.y)
    if (distance < bestDistance) {
      bestDistance = distance
      best = sample
    }
  }
  return best
}
