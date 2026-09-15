import type { MediaProfile } from '../models/profile'
import type { Point, Rect } from '../stage/geometry'

/** Where everything on the loop sits. */
export interface LoopLayout {
  /** The card where the problem is defined, top left. */
  define: Rect
  /** The card where the model proposes, top right. */
  propose: Rect
  /** The rails, bottom right. */
  rails: Rect
  /** The card where the human reviews, bottom left. */
  review: Rect
  /** Vertical position of the top edge of the track. */
  topY: number
  /** Horizontal position of the right edge of the track, through the rails. */
  rightX: number
  /** Vertical position of the bottom edge of the track. */
  bottomY: number
  /** Horizontal position of the left edge of the track. */
  leftX: number
  /** Vertical position of each rail, top to bottom, the last being the one an accepted change becomes. */
  railYs: readonly number[]
  /** Vertical position of the return path along the foot. */
  returnY: number
  /** Vertical position of the caption across the top. */
  captionY: number
}

/** Width of a station card. */
const CARD_W = 214

/** Height of a station card. */
const CARD_H = 76

/** Width of the rails. */
const RAILS_W = 272

/** How far the rails reach past the track's right edge, which runs through the candidates' columns. */
const RAILS_OVERHANG = 84

/** Distance between rails. */
export const RAIL_STEP = 30

/**
 * Lay the loop out for one profile.
 *
 * The two human stations stand on the left, one above the other; the model
 * stands top right; the rails stand bottom right, where the model's output
 * has to pass before it reaches the human again. The track joins them
 * clockwise. The return path runs under everything, from the review back to
 * the rails, because what it carries is a rail.
 *
 * @param profile - The presentation target being composed for.
 * @param railCount - How many rails there are, the next one included.
 * @returns Every position the renderer needs.
 */
export function loopLayout(profile: MediaProfile, railCount: number): LoopLayout {
  const inset = 36
  const cardTop = 82
  const define = { x: inset + 24, y: cardTop, w: CARD_W, h: CARD_H }
  const propose = { x: profile.width - inset - 24 - CARD_W, y: cardTop, w: CARD_W, h: CARD_H }
  const railsTop = cardTop + CARD_H + 64
  // why: the candidates fall through the rails to the right of the labels, so the box reaches further left than the track than right of it
  const rails = { x: propose.x + CARD_W / 2 + RAILS_OVERHANG - RAILS_W, y: railsTop, w: RAILS_W, h: 48 + railCount * RAIL_STEP + 6 }
  const railYs: number[] = []
  for (let index = 0; index < railCount; index += 1) {
    railYs.push(railsTop + 48 + index * RAIL_STEP)
  }
  // why: the survivor leaves the rails between the last real rail and the one still to come, so the bottom edge of the track sits there
  const bottomY = railsTop + 48 + (railCount - 1.5) * RAIL_STEP
  const review = { x: define.x, y: bottomY - CARD_H / 2, w: CARD_W, h: CARD_H }
  return {
    define,
    propose,
    rails,
    review,
    topY: cardTop + CARD_H / 2,
    rightX: propose.x + CARD_W / 2,
    bottomY,
    leftX: define.x + CARD_W / 2,
    railYs,
    returnY: rails.y + rails.h + 30,
    captionY: 50,
  }
}

/**
 * Where a point is along a path of straight segments, a fraction of the way
 * from its first corner to its last.
 *
 * @param corners - The path's corners, in order.
 * @param t - Progress from 0 to 1, usually already eased.
 * @returns The point.
 */
export function alongPath(corners: readonly Point[], t: number): Point {
  const lengths: number[] = []
  let total = 0
  for (let index = 1; index < corners.length; index += 1) {
    const a = corners[index - 1]
    const b = corners[index]
    const length = a === undefined || b === undefined ? 0 : ((b.x - a.x) ** 2 + (b.y - a.y) ** 2) ** 0.5
    lengths.push(length)
    total += length
  }
  let remaining = t * total
  for (let index = 1; index < corners.length; index += 1) {
    const a = corners[index - 1]
    const b = corners[index]
    const length = lengths[index - 1] ?? 0
    if (a === undefined || b === undefined) {
      break
    }
    if (remaining <= length || index === corners.length - 1) {
      const u = length === 0 ? 1 : remaining / length
      return { x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u }
    }
    remaining -= length
  }
  return corners[corners.length - 1] ?? { x: 0, y: 0 }
}
