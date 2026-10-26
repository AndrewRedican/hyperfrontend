import { abs, hypot, max, min } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'

/** A point of the drawing. */
export interface Point {
  /** Across */
  x: number
  /** Down */
  y: number
}

/** A box of the drawing. */
export interface Box {
  /** Left edge */
  x: number
  /** Top edge */
  y: number
  /** Width */
  width: number
  /** Height */
  height: number
}

/** The two points a line between two boxes touches them at. */
export interface Contacts {
  /** On the first box */
  from: Point
  /** On the second box */
  to: Point
  /** The axis the boxes are apart along: across or down */
  axis: 'x' | 'y'
}

/** A line's path and the point its badge sits at. */
export interface EdgeGeometry {
  /** The SVG path */
  d: string
  /** The middle of the line */
  mid: Point
  /** Where the line leaves the first box */
  from: Point
  /** Where the line reaches the second box */
  to: Point
}

/** The furthest a line between two members of one ring bows outwards. */
const MAX_BOW = 70

/**
 * The centre of a box.
 *
 * @param box - The box measured
 * @returns Its centre
 */
function centreOf(box: Box): Point {
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
}

/**
 * Where the line from a box's centre towards a point leaves the box.
 *
 * @param box - The box measured
 * @param towards - The point the line heads for
 * @returns The point on the box's edge
 */
export function exitPoint(box: Box, towards: Point): Point {
  const c = centreOf(box)
  const dx = towards.x - c.x
  const dy = towards.y - c.y
  const scale = min(dx === 0 ? Infinity : box.width / 2 / abs(dx), dy === 0 ? Infinity : box.height / 2 / abs(dy))
  return scale === Infinity ? c : { x: c.x + dx * min(1, scale), y: c.y + dy * min(1, scale) }
}

/**
 * The points two boxes are joined at: where they face each other across a shared band, at the
 * middle of that band, or, when they share none, where the line between their centres leaves each.
 *
 * @param a - The first box
 * @param b - The second box
 * @returns The two contacts and the axis they are apart along
 */
export function contactPoints(a: Box, b: Box): Contacts {
  const top = max(a.y, b.y)
  const bottom = min(a.y + a.height, b.y + b.height)
  if (top < bottom) {
    const y = (top + bottom) / 2
    return a.x > b.x
      ? { from: { x: a.x, y }, to: { x: b.x + b.width, y }, axis: 'x' }
      : { from: { x: a.x + a.width, y }, to: { x: b.x, y }, axis: 'x' }
  }
  const left = max(a.x, b.x)
  const right = min(a.x + a.width, b.x + b.width)
  if (left < right) {
    const x = (left + right) / 2
    return a.y > b.y
      ? { from: { x, y: a.y }, to: { x, y: b.y + b.height }, axis: 'y' }
      : { from: { x, y: a.y + a.height }, to: { x, y: b.y }, axis: 'y' }
  }
  const ca = centreOf(a)
  const cb = centreOf(b)
  return { from: exitPoint(a, cb), to: exitPoint(b, ca), axis: abs(cb.x - ca.x) >= abs(cb.y - ca.y) ? 'x' : 'y' }
}

/**
 * A straight line between two boxes.
 *
 * @param a - The first box
 * @param b - The second box
 * @returns The path and its middle
 */
export function straightEdge(a: Box, b: Box): EdgeGeometry {
  const { from, to } = contactPoints(a, b)
  return { d: `M ${from.x} ${from.y} L ${to.x} ${to.y}`, mid: { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 }, from, to }
}

/**
 * A curve between two members of one ring of a radial drawing, bowed away from its centre so
 * it clears the boxes between them.
 *
 * @param a - The first box
 * @param b - The second box
 * @param centre - The drawing's centre
 * @returns The path and its middle
 */
export function bowedEdge(a: Box, b: Box, centre: Point): EdgeGeometry {
  const ca = centreOf(a)
  const cb = centreOf(b)
  const mid = { x: (ca.x + cb.x) / 2, y: (ca.y + cb.y) / 2 }
  const out = { x: mid.x - centre.x, y: mid.y - centre.y }
  const length = hypot(out.x, out.y) || 1
  const bow = min(MAX_BOW, 0.2 * hypot(cb.x - ca.x, cb.y - ca.y))
  const control = { x: mid.x + (out.x / length) * bow, y: mid.y + (out.y / length) * bow }
  const from = exitPoint(a, control)
  const to = exitPoint(b, control)
  return {
    d: `M ${from.x} ${from.y} Q ${control.x} ${control.y}, ${to.x} ${to.y}`,
    mid: { x: (from.x + 2 * control.x + to.x) / 4, y: (from.y + 2 * control.y + to.y) / 4 },
    from,
    to,
  }
}

/**
 * Where a spoke's badge sits: a fixed distance in from its outer end, where neighbouring spokes
 * are as far apart as their boxes, rather than at its middle, where spokes crowd together.
 *
 * @param outer - Where the spoke meets the box further from the centre
 * @param inner - Where it meets the box nearer the centre
 * @param inset - How far in from the outer end
 * @returns The point, never past the spoke's middle
 */
export function spokeBadgePoint(outer: Point, inner: Point, inset: number): Point {
  const length = hypot(inner.x - outer.x, inner.y - outer.y)
  if (length === 0) return outer
  const reach = min(inset, length / 2) / length
  return { x: outer.x + (inner.x - outer.x) * reach, y: outer.y + (inner.y - outer.y) * reach }
}
