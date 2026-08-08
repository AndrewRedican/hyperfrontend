/**
 * Turning a spine into a koi you can see.
 *
 * The contour is built by walking the centreline and stepping out to either side
 * by the width profile, then closing the loop nose-to-tail. Fins hang off fixed
 * stations along the same centreline, so they swing with the body instead of
 * being pinned to it.
 *
 * Everything here emits SVG path data rather than drawing: a fish app decides
 * whether that string lands in an `<svg>` element, a canvas `Path2D`, or a
 * framework's template, and the seven of them all decide differently. That is
 * the point of keeping the geometry out here.
 */
import type { Vec2 } from '../model/types.js'
import { SPINE_JOINTS } from './spine.js'

/** Where along the body the pectoral fins hang, as a fraction from the nose. */
export const PECTORAL_STATION = 0.29

/** Where along the body the dorsal fin sits, as a fraction from the nose. */
export const DORSAL_STATION = 0.46

/** Where along the body the caudal peduncle ends and the tail fin begins. */
export const CAUDAL_STATION = 0.78

/**
 * The unit normal to the left of the body at a joint.
 *
 * @param joints - The spine, nose first.
 * @param index - Which joint to read.
 * @returns The left-hand unit normal at that joint.
 */
function normalAt(joints: readonly Vec2[], index: number): Vec2 {
  const here = joints[index]
  const ahead = joints[Math.max(0, index - 1)]
  const behind = joints[Math.min(joints.length - 1, index + 1)]
  if (here === undefined || ahead === undefined || behind === undefined) {
    return { x: 0, y: -1 }
  }
  const dx = ahead.x - behind.x
  const dy = ahead.y - behind.y
  const magnitude = Math.hypot(dx, dy)
  if (magnitude === 0) {
    return { x: 0, y: -1 }
  }
  return { x: -dy / magnitude, y: dx / magnitude }
}

/** A koi's outline, split into the two flanks the path is drawn from. */
export interface BodyContour {
  /** Nose-to-tail points down the koi's left flank. */
  left: Vec2[]
  /** Nose-to-tail points down the koi's right flank. */
  right: Vec2[]
}

/**
 * Steps out from the centreline to both flanks.
 *
 * @param joints - The spine, nose first.
 * @param girth - Half-width at each joint, same length as `joints`.
 * @returns Both flanks, nose-to-tail.
 *
 * @example Building a koi silhouette
 * ```typescript
 * const contour = bodyContour(spine.joints, spineGirth(length, build.girthRatio))
 * path.setAttribute('d', contourPath(contour))
 * ```
 */
export function bodyContour(joints: readonly Vec2[], girth: readonly number[]): BodyContour {
  const left: Vec2[] = []
  const right: Vec2[] = []
  for (let index = 0; index < joints.length; index += 1) {
    const joint = joints[index]
    const width = girth[index]
    if (joint === undefined || width === undefined) {
      continue
    }
    const normal = normalAt(joints, index)
    left.push({ x: joint.x + normal.x * width, y: joint.y + normal.y * width })
    right.push({ x: joint.x - normal.x * width, y: joint.y - normal.y * width })
  }
  return { left, right }
}

/**
 * Formats a point for SVG path data at sub-pixel precision.
 *
 * @param point - The point to format.
 * @returns The `x y` pair, rounded to two decimals.
 */
function pair(point: Vec2): string {
  return `${point.x.toFixed(2)} ${point.y.toFixed(2)}`
}

/**
 * Draws a smooth polyline through points using midpoint quadratic segments.
 *
 * Quadratics through segment midpoints give a curve that is continuous at every
 * joint without needing tangents computed for each one — cheap enough to run on
 * seven fish every frame, and smooth enough that no visitor sees the joints.
 *
 * @param points - The points to thread, in order.
 * @returns Path data starting with the first point's `L` command.
 */
function smoothThrough(points: readonly Vec2[]): string {
  const segments: string[] = []
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1]
    const current = points[index]
    if (previous === undefined || current === undefined) {
      continue
    }
    if (index === 1) {
      // why: The first joint is the curve's own start, so bending toward it would emit a control point on top of the anchor.
      segments.push(`L ${pair(current)}`)
      continue
    }
    if (index === points.length - 1) {
      segments.push(`Q ${pair(previous)} ${pair(current)}`)
      continue
    }
    const midpoint = { x: (previous.x + current.x) / 2, y: (previous.y + current.y) / 2 }
    segments.push(`Q ${pair(previous)} ${pair(midpoint)}`)
  }
  return segments.join(' ')
}

/**
 * Closes a contour into one filled body path.
 *
 * @param contour - Both flanks, nose-to-tail.
 * @returns SVG path data for the koi's body.
 */
export function contourPath(contour: BodyContour): string {
  const nose = contour.left[0]
  if (nose === undefined) {
    return ''
  }
  const tailFirst = [...contour.right].reverse()
  return `M ${pair(nose)} ${smoothThrough(contour.left)} ${smoothThrough(tailFirst)} Z`
}

/**
 * Reads the joint index nearest a station along the body.
 *
 * @param station - Fraction from the nose, 0 to 1.
 * @returns The joint index.
 */
export function jointAtStation(station: number): number {
  return Math.round(Math.max(0, Math.min(1, station)) * (SPINE_JOINTS - 1))
}

/**
 * Draws one pectoral fin as a swept teardrop off the body.
 *
 * @param joints - The spine, nose first.
 * @param length - Nose-to-tail length in CSS pixels.
 * @param span - Fin span as a fraction of body length.
 * @param side - `1` for the left flank, `-1` for the right.
 * @param sweep - How far back the fin trails, 0 (straight out) to 1 (flat along the body).
 * @returns SVG path data for that fin.
 */
export function pectoralPath(joints: readonly Vec2[], length: number, span: number, side: 1 | -1, sweep: number): string {
  const index = jointAtStation(PECTORAL_STATION)
  const root = joints[index]
  if (root === undefined) {
    return ''
  }
  const normal = normalAt(joints, index)
  const tangent = { x: normal.y, y: -normal.x }
  const reach = length * span
  const out = { x: normal.x * side * reach, y: normal.y * side * reach }
  const trail = { x: -tangent.x * reach * sweep, y: -tangent.y * reach * sweep }
  const tip = { x: root.x + out.x + trail.x, y: root.y + out.y + trail.y }
  // how: One quadratic out and one back gives a fin with a leading edge and a trailing edge from four points.
  const lead = { x: root.x + out.x * 0.55 - trail.x * 0.2, y: root.y + out.y * 0.55 - trail.y * 0.2 }
  const back = { x: root.x + out.x * 0.35 + trail.x * 1.1, y: root.y + out.y * 0.35 + trail.y * 1.1 }
  return `M ${pair(root)} Q ${pair(lead)} ${pair(tip)} Q ${pair(back)} ${pair(root)} Z`
}

/**
 * Draws the caudal fin as a trailing double lobe off the peduncle.
 *
 * @param joints - The spine, nose first.
 * @param length - Nose-to-tail length in CSS pixels.
 * @param span - Tail span as a fraction of body length.
 * @returns SVG path data for the tail.
 */
export function caudalPath(joints: readonly Vec2[], length: number, span: number): string {
  const index = jointAtStation(CAUDAL_STATION)
  const root = joints[index]
  const tail = joints[joints.length - 1]
  if (root === undefined || tail === undefined) {
    return ''
  }
  const normal = normalAt(joints, index)
  const dx = tail.x - root.x
  const dy = tail.y - root.y
  const magnitude = Math.hypot(dx, dy)
  const back = magnitude === 0 ? { x: -1, y: 0 } : { x: dx / magnitude, y: dy / magnitude }
  const reach = length * span
  const spread = reach * 0.62
  const tipCentre = { x: tail.x + back.x * reach * 0.42, y: tail.y + back.y * reach * 0.42 }
  const upper = { x: tail.x + back.x * reach + normal.x * spread, y: tail.y + back.y * reach + normal.y * spread }
  const lower = { x: tail.x + back.x * reach - normal.x * spread, y: tail.y + back.y * reach - normal.y * spread }
  // how: The lobes meet at a notch short of the tips, which is what makes a koi tail read as flowing silk rather than a triangle.
  return `M ${pair(root)} Q ${pair(tail)} ${pair(upper)} Q ${pair(tipCentre)} ${pair(lower)} Q ${pair(tail)} ${pair(root)} Z`
}

/**
 * Draws the dorsal fin as a low ridge along the back.
 *
 * @param joints - The spine, nose first.
 * @param length - Nose-to-tail length in CSS pixels.
 * @param span - Ridge height as a fraction of body length.
 * @returns SVG path data for the dorsal fin.
 */
export function dorsalPath(joints: readonly Vec2[], length: number, span: number): string {
  const start = jointAtStation(DORSAL_STATION - 0.1)
  const end = jointAtStation(DORSAL_STATION + 0.18)
  const crest = jointAtStation(DORSAL_STATION)
  const from = joints[start]
  const to = joints[end]
  const peak = joints[crest]
  if (from === undefined || to === undefined || peak === undefined) {
    return ''
  }
  const normal = normalAt(joints, crest)
  const height = length * span
  const apex = { x: peak.x + normal.x * height, y: peak.y + normal.y * height }
  return `M ${pair(from)} Q ${pair(apex)} ${pair(to)} Z`
}
