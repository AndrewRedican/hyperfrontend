import type { CanvasEdge, CanvasNode } from './graph-view'
import { from } from '@hyperfrontend/immutable-api-utils/built-in-copy/array'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { abs, cos, max, min, PI, sin } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'

/** The vertical room one label needs on a ring: its height and the gap to the next. */
const PITCH = 42

/** The widest a ring's fan opens on either side of the horizontal, in radians. */
const MAX_HALF_SPAN = (66 * PI) / 180

/** The angle between two neighbours of a ring that has room to spare, in radians. */
const PREFERRED_STEP = (20 * PI) / 180

/** The clear space between the focused project and the first ring. */
const FIRST_RING_GAP = 90

/** The clear space between the outer edge of one ring's labels and the next ring. */
const RING_GAP = 70

/** The space kept around the drawing. */
const MARGIN = 24

/**
 * The angles of a ring's members, evenly spaced and centred on the horizontal: a small ring
 * keeps a comfortable step, a large one opens to the widest fan.
 *
 * @param count - How many members the ring has
 * @returns The angles, top first
 */
export function ringAngles(count: number): number[] {
  if (count === 1) return [0]
  const half = min(MAX_HALF_SPAN, ((count - 1) * PREFERRED_STEP) / 2)
  const step = (2 * half) / (count - 1)
  return from({ length: count }, (_, index) => -half + index * step)
}

/**
 * The smallest radius at which no two neighbours of a ring overlap: labels are horizontal
 * boxes, so two neighbours need a pitch of vertical room between them.
 *
 * @param angles - The ring's angles
 * @returns The radius, zero for a ring of one
 */
export function separatingRadius(angles: readonly number[]): number {
  let radius = 0
  for (let index = 1; index < angles.length; index += 1) {
    const rise = abs(sin(angles[index] as number) - sin(angles[index - 1] as number))
    radius = max(radius, PITCH / rise)
  }
  return radius
}

/**
 * The vertical centre of a node.
 *
 * @param node - A positioned node
 * @returns Its middle
 */
function middle(node: CanvasNode): number {
  return node.y + node.height / 2
}

/** A radial drawing. */
export interface RadialDrawing {
  /** The nodes, positioned */
  nodes: CanvasNode[]
  /** The drawing's width */
  width: number
  /** The drawing's height */
  height: number
}

/**
 * Lays a focused neighbourhood out radially: the focused project at the centre, what it depends
 * on fanned out on the left and what depends on it on the right, one ring per hop. Each ring's
 * members are spaced at equal angles, ordered by the average height of the members of the ring
 * inside it they are linked to so the spokes cross as little as possible, and each ring sits at
 * the larger of the radius that keeps its labels apart and the one that clears the ring inside.
 *
 * @param nodes - The nodes, unpositioned
 * @param edges - The edges between them
 * @param focus - The focused node id
 * @param hops - The signed hop of every node: negative for a dependency, positive for a dependent
 * @returns The nodes positioned, and the drawing's size
 */
export function radialLayout(
  nodes: readonly CanvasNode[],
  edges: readonly CanvasEdge[],
  focus: string,
  hops: ReadonlyMap<string, number>
): RadialDrawing {
  const centre = nodes.find((node) => node.id === focus)
  const positioned = createMap<string, CanvasNode>()
  if (centre !== undefined) positioned.set(centre.id, { ...centre, x: -centre.width / 2, y: -centre.height / 2 })
  const neighbours = createMap<string, string[]>()
  for (const edge of edges) {
    neighbours.set(edge.source, [...(neighbours.get(edge.source) ?? []), edge.target])
    neighbours.set(edge.target, [...(neighbours.get(edge.target) ?? []), edge.source])
  }
  for (const side of [-1, 1]) {
    let inner = (centre?.width ?? 0) / 2 + FIRST_RING_GAP
    for (let ring = 1; ; ring += 1) {
      const members = nodes.filter((node) => node.id !== focus && (hops.get(node.id) ?? 1) === side * ring)
      if (members.length === 0) break
      const order = (node: CanvasNode): number => {
        const linked = (neighbours.get(node.id) ?? []).map((id) => positioned.get(id)).filter((other) => other !== undefined)
        return linked.length === 0 ? 0 : linked.reduce((sum, other) => sum + middle(other), 0) / linked.length
      }
      members.sort((left, right) => order(left) - order(right) || left.label.localeCompare(right.label))
      const angles = ringAngles(members.length)
      const radius = max(inner, separatingRadius(angles))
      members.forEach((node, index) => {
        const angle = angles[index] as number
        const reach = radius * cos(angle)
        const height = radius * sin(angle)
        const x = side > 0 ? reach : -reach - node.width
        const at = { ...node, x, y: height - node.height / 2 }
        positioned.set(node.id, at)
      })
      inner = radius + max(...members.map((node) => node.width)) + RING_GAP
    }
  }
  const all = [...positioned.values()]
  const left = min(...all.map((node) => node.x))
  const top = min(...all.map((node) => node.y))
  const right = max(...all.map((node) => node.x + node.width))
  const bottom = max(...all.map((node) => node.y + node.height))
  return {
    nodes: all.map((node) => ({ ...node, x: node.x - left + MARGIN, y: node.y - top + MARGIN })),
    width: right - left + 2 * MARGIN,
    height: bottom - top + 2 * MARGIN,
  }
}
