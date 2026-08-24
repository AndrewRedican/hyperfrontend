/**
 * The pearls a koi swims through: its own predicted advancement, laid down.
 *
 * Every koi reports where its wound manoeuvre is about to carry it, and this is
 * where that report becomes a chain of points in the water. A pearl is placed
 * once and never moves again: the whole apparent motion of the trace is the
 * churn of its two ends — consumed where the nose reaches one, minted at the
 * horizon as the koi's own prediction reaches further out. That is what makes a
 * fish read as swimming through waypoints it called, rather than towing a
 * ribbon behind it.
 *
 * Nothing here predicts anything. The koi integrates its horizon with the same
 * arithmetic it advances by, so a chain that stays put is a koi keeping its
 * word. When it stops keeping it — an obstacle appeared along the way, an
 * escape fired, a depth pass was granted — the next report simply parts company
 * with the drawn chain from the divergence on. No signal on the wire says a
 * manoeuvre changed; the geometry says it, and the stale suffix is cut and
 * re-laid in the same tick that heard it.
 */
import type { Vec2 } from '@hyperfrontend/demo-koi-lib'
import { KOI_PATH_MAX_POINTS } from '@hyperfrontend/demo-koi-lib'

/** How many pearls of one koi's trace may be alight at once. */
export const PEARL_MAX = 10

/** How far apart pearls are laid along a path, as a fraction of the reporting koi's length. */
export const PEARL_SPACING_BODIES = 0.1

/** How far a drawn pearl may sit off a fresh path before it counts as contradicted, in pond pixels. */
export const PEARL_TOLERANCE_PX = 4

/** The alpha a pearl carries against the nose. */
export const PEARL_NOSE_ALPHA = 0.8

/** The alpha a pearl carries out at the chain's horizon. */
export const PEARL_HORIZON_ALPHA = 0.1

/** Where a point sits against a path: how far off it, and how far along it. */
interface TrackFoot {
  /** How far the point sits off the path, in pond pixels. */
  off: number
  /** The arc length the nearest point on the path sits at, in pond pixels. */
  at: number
  /** Whether that nearest point is the path's far end, so the path has nothing to say about this point. */
  beyond: boolean
}

/**
 * Where a path passes closest to a point.
 *
 * @param point - The point to place against the path.
 * @param track - The path, as at least two points.
 * @returns How far off the path the point sits, and how far along the path it sits.
 */
function footOn(point: Vec2, track: readonly Vec2[]): TrackFoot {
  let off = Number.POSITIVE_INFINITY
  let at = 0
  let travelled = 0
  let previous: Vec2 | null = null
  for (const sample of track) {
    if (previous !== null) {
      const runX = sample.x - previous.x
      const runY = sample.y - previous.y
      const span = Math.hypot(runX, runY)
      // how: The foot is clamped into the segment, so a point beside a joint answers to the joint rather than to the infinite line the segment sits on.
      const along = span > 0 ? Math.max(0, Math.min(1, ((point.x - previous.x) * runX + (point.y - previous.y) * runY) / (span * span))) : 0
      const reach = Math.hypot(point.x - (previous.x + runX * along), point.y - (previous.y + runY * along))
      if (reach < off) {
        off = reach
        at = travelled + span * along
      }
      travelled += span
    }
    previous = sample
  }
  return { off, at, beyond: at >= travelled }
}

/**
 * The point a given arc length along a path reaches.
 *
 * @param track - The path, as at least two points.
 * @param at - How far along the path to travel, in pond pixels.
 * @returns The point reached, or `null` when the path runs out first.
 */
function pointAt(track: readonly Vec2[], at: number): Vec2 | null {
  let travelled = 0
  let previous: Vec2 | null = null
  for (const sample of track) {
    if (previous !== null) {
      const span = Math.hypot(sample.x - previous.x, sample.y - previous.y)
      if (span > 0 && travelled + span >= at) {
        const along = (at - travelled) / span
        return { x: previous.x + (sample.x - previous.x) * along, y: previous.y + (sample.y - previous.y) * along }
      }
      travelled += span
    }
    previous = sample
  }
  return null
}

/**
 * Walks one koi's pearl chain forward against the path it has just reported.
 *
 * The only work is at the two ends. Pearls the nose has reached are consumed;
 * pearls the fresh path still runs through keep the position they were placed
 * at, down to their identity; pearls the fresh path contradicts are cut along
 * with everything beyond them, and the chain is re-laid from the fresh path in
 * the same call. Pearls sitting past the reported horizon are left alone: a
 * horizon that has drawn in is not a promise broken.
 *
 * @param pearls - The chain as it was last drawn, nearest first.
 * @param nose - Where the koi's nose is now, in pond space.
 * @param heading - The koi's heading in radians, which is what "reached" is measured against.
 * @param path - The advancement the koi has just reported, nearest first.
 * @param spacing - How far apart to lay pearls, in pond pixels.
 * @returns The chain to draw, nearest first; every surviving pearl is the very object that was passed in.
 *
 * @example Carrying one koi's trace across a frame
 * ```typescript
 * const chain = advanceTrace(traces.get(id) ?? [], nose, outline.heading, outline.path ?? [], spacing)
 * ```
 */
export function advanceTrace(pearls: readonly Vec2[], nose: Vec2, heading: number, path: readonly Vec2[], spacing: number): Vec2[] {
  const live: Vec2[] = []
  // why: A koi that reports no advancement draws no trace at all — an older fish, or any future producer that omits the path, simply has nothing to say here.
  if (path.length === 0 || !(spacing > 0)) {
    return live
  }
  // why: The wire cap is the host's to enforce as well as the koi's, because the outline is deliberately schema-less and nothing else on the way here counts the points.
  const track = [nose, ...path.slice(0, KOI_PATH_MAX_POINTS)]
  const forwardX = Math.cos(heading)
  const forwardY = Math.sin(heading)
  let anchor = 0
  let spent = false

  for (const pearl of pearls) {
    // why: Only the near end is consumed, so a pearl the nose has not reached yet stays exactly where it was placed however the chain behind it churns.
    if (live.length === 0 && (pearl.x - nose.x) * forwardX + (pearl.y - nose.y) * forwardY <= 0) {
      continue
    }
    if (spent) {
      live.push(pearl)
      continue
    }
    const foot = footOn(pearl, track)
    if (foot.beyond) {
      // why: A pearl past the reported horizon is not contradicted by it, so it keeps its place instead of flickering out every time the koi eases off its pace.
      spent = true
      live.push(pearl)
      continue
    }
    if (foot.off > PEARL_TOLERANCE_PX) {
      // why: The koi has committed to something else; this pearl and every pearl beyond it are promises it is no longer keeping.
      break
    }
    live.push(pearl)
    anchor = foot.at
  }

  if (!spent) {
    // why: The next pearl is measured from the last one that survived rather than from the nose, which is what holds a minted pearl still while the fish swims up to it.
    for (let at = anchor + spacing; live.length < PEARL_MAX; at += spacing) {
      const minted = pointAt(track, at)
      if (minted === null) {
        break
      }
      live.push(minted)
    }
  }
  return live
}

/**
 * The alpha one pearl is drawn at.
 *
 * @param distancePx - How far the pearl sits from the nose, in pond pixels.
 * @param reachPx - How far a full chain reaches, in pond pixels.
 * @returns The alpha, between the ink carried at the nose and what is left of it at the horizon.
 *
 * @example Fading a pearl by how far off it still is
 * ```typescript
 * context.fillStyle = `rgba(255, 255, 255, ${pearlAlpha(Math.hypot(pearl.x - nose.x, pearl.y - nose.y), reach)})`
 * ```
 */
export function pearlAlpha(distancePx: number, reachPx: number): number {
  const along = Math.max(0, Math.min(1, distancePx / reachPx))
  return PEARL_NOSE_ALPHA + (PEARL_HORIZON_ALPHA - PEARL_NOSE_ALPHA) * along
}
