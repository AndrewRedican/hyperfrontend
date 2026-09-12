import type { GraphEdge, GraphNode } from '../models/graph'
import { atan2, hypot, max, min, PI, round } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'

/** A point in the frame, in CSS pixels. */
export interface Point {
  /** Horizontal position. */
  x: number
  /** Vertical position. */
  y: number
}

/** An edge resolved to geometry: a cubic curve from the rim of one node to the rim of another. */
export interface EdgeGeometry {
  /** Where the curve leaves the source node's rim. */
  start: Point
  /** First control point. */
  control1: Point
  /** Second control point. */
  control2: Point
  /** Where the curve meets the target node's rim. */
  end: Point
  /** The point half way along, where the label sits. */
  middle: Point
  /** A unit vector pointing away from the curve at its middle, for the label. */
  normal: Point
  /** The `d` attribute of the curve. */
  d: string
}

/** How many samples the rim intersection is searched over. */
const RIM_SAMPLES = 64

/**
 * A point on a cubic curve.
 *
 * @param p0 - Start.
 * @param p1 - First control point.
 * @param p2 - Second control point.
 * @param p3 - End.
 * @param t - Position along the curve from 0 to 1.
 * @returns The point at `t`.
 */
export function cubicAt(p0: Point, p1: Point, p2: Point, p3: Point, t: number): Point {
  const u = 1 - t
  const a = u * u * u
  const b = 3 * u * u * t
  const c = 3 * u * t * t
  const d = t * t * t
  return { x: a * p0.x + b * p1.x + c * p2.x + d * p3.x, y: a * p0.y + b * p1.y + c * p2.y + d * p3.y }
}

/**
 * The control points that bow a chord by a stated distance.
 *
 * @param from - Start of the chord.
 * @param to - End of the chord.
 * @param bow - How far the middle of the curve sits off the chord, in pixels; negative is upward.
 * @returns Two control points, a third of the way along each end and offset by the bow.
 */
function controls(from: Point, to: Point, bow: number): readonly [Point, Point] {
  const dx = to.x - from.x
  const dy = to.y - from.y
  const length = max(1, hypot(dx, dy))
  // why: the perpendicular of the chord, flipped for a leftward-going edge, so a negative bow is always above the chord on screen whichever way the edge runs
  const nx = -dy / length
  const ny = dx / length
  const sign = dx >= 0 ? 1 : -1
  // magic: 4/3 is the control offset that makes a symmetric cubic's midpoint sit exactly `bow` off the chord
  const offset = (bow * 4) / 3
  return [
    { x: from.x + dx / 3 + nx * offset * sign, y: from.y + dy / 3 + ny * offset * sign },
    { x: from.x + (2 * dx) / 3 + nx * offset * sign, y: from.y + (2 * dy) / 3 + ny * offset * sign },
  ]
}

/**
 * Resolve an edge to the curve drawn for it.
 *
 * The curve runs centre to centre and is then cut back to each node's rim by
 * sampling, so a bowed edge meets a round node where the curve actually
 * crosses the circle rather than where a straight chord would.
 *
 * @param edge - The reference.
 * @param nodes - Every node, to look the two ends up.
 * @param radius - Radius of a node.
 * @returns The geometry, or undefined when either end names no node.
 */
export function edgeGeometry(edge: GraphEdge, nodes: readonly GraphNode[], radius: number): EdgeGeometry | undefined {
  const from = nodes.find((node) => node.id === edge.from)
  const to = nodes.find((node) => node.id === edge.to)
  if (from === undefined || to === undefined) {
    return undefined
  }
  const [c1, c2] = controls(from, to, edge.bow ?? 0)
  let tStart = 0
  let tEnd = 1
  for (let index = 0; index <= RIM_SAMPLES; index += 1) {
    const t = index / RIM_SAMPLES
    const point = cubicAt(from, c1, c2, to, t)
    if (hypot(point.x - from.x, point.y - from.y) < radius) {
      tStart = t
    }
    if (tEnd === 1 && hypot(point.x - to.x, point.y - to.y) < radius) {
      tEnd = t
    }
  }
  const start = cubicAt(from, c1, c2, to, min(tStart + 1 / RIM_SAMPLES, 1))
  const end = cubicAt(from, c1, c2, to, max(tEnd - 1 / RIM_SAMPLES, 0))
  const middle = cubicAt(from, c1, c2, to, 0.5)
  const chordMiddle = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 }
  const away = { x: middle.x - chordMiddle.x, y: middle.y - chordMiddle.y }
  const awayLength = hypot(away.x, away.y)
  // why: a straight edge has no bow to point away from, so its label goes above it
  const normal = awayLength < 0.5 ? { x: 0, y: -1 } : { x: away.x / awayLength, y: away.y / awayLength }
  const d = `M ${start.x.toFixed(1)} ${start.y.toFixed(1)} C ${c1.x.toFixed(1)} ${c1.y.toFixed(1)}, ${c2.x.toFixed(1)} ${c2.y.toFixed(1)}, ${end.x.toFixed(1)} ${end.y.toFixed(1)}`
  return { start, control1: c1, control2: c2, end, middle, normal, d }
}

/**
 * Where the cursor is when it has travelled part of an edge.
 *
 * @param geometry - The edge's curve.
 * @param t - Progress along it from 0 to 1.
 * @returns The point on the curve.
 */
export function alongEdge(geometry: EdgeGeometry, t: number): Point {
  return cubicAt(geometry.start, geometry.control1, geometry.control2, geometry.end, t)
}

/**
 * The angle the curve arrives at its end, for an arrowhead.
 *
 * @param geometry - The edge's curve.
 * @returns Degrees, as SVG's `rotate` takes them.
 */
export function arrivalAngle(geometry: EdgeGeometry): number {
  const before = alongEdge(geometry, 0.96)
  return round((atan2(geometry.end.y - before.y, geometry.end.x - before.x) * 180) / PI)
}
