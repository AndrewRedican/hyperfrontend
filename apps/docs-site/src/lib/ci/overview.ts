import type { Point } from './edge-geometry'
import type { CanvasEdge, CanvasNode } from './graph-view'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { abs, atan2, cos, hypot, max, min, PI, sin, sqrt } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'

/** The clear space kept between any two boxes. */
const GAP = 14

/** How much an orbit grows at a time until none of its boxes collide. */
const GROWTH = 0.035

/** The most times an orbit grows before it is taken as it is. */
const MAX_GROWTHS = 600

/** The widest a nested hub fans its children out: under half a turn, so no branch reaches back past its hub. */
const NESTED_FAN = 0.95 * PI

/** The space between two clusters packed side by side. */
const CLUSTER_GAP = 90

/** The space kept around the drawing. */
const MARGIN = 24

/** A cluster: projects connected to one another, laid out in rings of dependency layers. */
interface Cluster {
  /** Every member's centre, relative to the cluster's centre, by id */
  centres: Map<string, Point>
  /** Every member's ring, counted from the centre */
  rings: Map<string, number>
  /** The dependency each member hangs off, absent for the cluster's centre */
  parents: Map<string, string>
  /** The cluster's extent around the hub */
  left: number
  /** The cluster's extent around the hub */
  top: number
  /** The cluster's extent around the hub */
  right: number
  /** The cluster's extent around the hub */
  bottom: number
}

/** One box of a planned branch: where it sits relative to the branch's hub, the hub facing right. */
interface Placement {
  /** The node */
  id: string
  /** Across */
  x: number
  /** Down */
  y: number
}

/** What the overview drawing is. */
export interface OverviewDrawing {
  /** The nodes, positioned, each with its ring and the centre of its cluster */
  nodes: CanvasNode[]
  /** The drawing's width */
  width: number
  /** The drawing's height */
  height: number
  /** The centre of the largest cluster, or null for an empty drawing */
  centre: Point | null
}

/**
 * The members of a list arranged so the first sits in the middle and the rest alternate
 * outwards: heavy branches go to the middle of a wedge and light ones to its flanks, so two
 * heavy branches never sit side by side with no room between them.
 *
 * @param sorted - The members, heaviest first
 * @returns The members, heaviest in the middle
 */
export function centreHeavy<Item>(sorted: readonly Item[]): Item[] {
  const arranged: Item[] = []
  sorted.forEach((item, index) => (index % 2 === 0 ? arranged.push(item) : arranged.unshift(item)))
  return arranged
}

/** The id of the point the rings of a cluster are centred on. */
const CENTRE = '\u0000centre'

/**
 * The dependency layer of every member: zero for a member that depends on no other member, else
 * one past the deepest member it depends on; a cycle is cut where it is entered.
 *
 * @param members - The cluster's ids
 * @param dependencies - What each node depends on
 * @returns The layer by id
 */
export function dependencyLayers(members: readonly string[], dependencies: ReadonlyMap<string, ReadonlySet<string>>): Map<string, number> {
  const inside = createSet(members)
  const layer = createMap<string, number>()
  const visiting = createSet<string>()
  const measure = (id: string): number => {
    const known = layer.get(id)
    if (known !== undefined) return known
    if (visiting.has(id)) return 0
    visiting.add(id)
    let deepest = -1
    for (const dependency of dependencies.get(id) ?? [])
      if (inside.has(dependency) && dependency !== id) deepest = max(deepest, measure(dependency))
    visiting.delete(id)
    layer.set(id, deepest + 1)
    return deepest + 1
  }
  for (const id of members) measure(id)
  return layer
}

/**
 * Lays one cluster out as nested radial clusters. The tree follows dependency layers: the
 * members that depend on nothing are its root, and every other member hangs off its most
 * connected dependency on the layer just inside it, so a branch grows out of what it leans on
 * most. Sizes are planned bottom-up: each member's orbit is the smallest circle around it on which
 * the circles of everything hanging off it fit side by side, clear of its box and of each other,
 * so a hub with a large downstream claims the room it needs before anything is placed. Placement
 * runs top-down: the root spreads its children all the way round, and every nested hub fans its
 * own out on its orbit, away from its parent, the largest sub-cluster in the middle, so each
 * branch sprawls into open space instead of crowding one shared circle.
 *
 * @param members - The cluster's ids
 * @param dependencies - What each node depends on
 * @param rank - Orders ids by how connected they are, most first
 * @param width - The boxes' width
 * @param height - The boxes' height
 * @returns The cluster, its members' centres relative to its centre
 */
function layoutCluster(
  members: readonly string[],
  dependencies: ReadonlyMap<string, ReadonlySet<string>>,
  rank: (left: string, right: string) => number,
  width: number,
  height: number
): Cluster {
  const layer = dependencyLayers(members, dependencies)
  const foundations = members.filter((id) => layer.get(id) === 0)
  // why: a lone foundation is the centre itself; several share the innermost ring around an empty centre
  const lone = foundations.length === 1 ? (foundations[0] as string) : null
  const root = lone ?? CENTRE
  const children = createMap<string, string[]>()
  for (const id of members) {
    if (id === root) continue
    const inner = [...(dependencies.get(id) ?? [])].filter((other) => layer.get(other) === (layer.get(id) ?? 0) - 1).sort(rank)
    const parent = inner[0] ?? root
    children.set(parent, [...(children.get(parent) ?? []), id])
  }
  // why: an ancestor may turn a branch to any angle while its boxes stay upright, so a box is taken as the circle around it
  const boxRadius = hypot(width, height) / 2
  const clearance = 2 * boxRadius + GAP
  // why: planned bottom-up from the real positions of every box below, so a hub's room is measured, never estimated
  const plan = (id: string): Placement[] => {
    const below = (children.get(id) ?? []).map((child) => plan(child))
    const own: Placement[] = id === CENTRE ? [] : [{ id, x: 0, y: 0 }]
    if (below.length === 0) return own
    const extent = (branch: readonly Placement[]): number => max(...branch.map((box) => hypot(box.x, box.y)))
    const arranged = centreHeavy([...below].sort((left, right) => extent(right) - extent(left) || right.length - left.length))
    const fan = id === root ? 2 * PI : NESTED_FAN
    // why: a branch faces away from its hub, so only its boxes behind its own hub have to clear this one
    const behind = max(...arranged.map((branch) => max(...branch.map((box) => -box.x)))) + boxRadius
    let orbit = (own.length === 0 ? 0 : boxRadius) + behind + GAP
    const half = (branch: readonly Placement[], around: number): number =>
      max(...branch.map((box) => atan2(abs(box.y) + boxRadius + GAP / 2, max(1, around + box.x))))
    for (let attempt = 0; attempt < MAX_GROWTHS; attempt += 1) {
      const spans = arranged.map((branch) => 2 * half(branch, orbit))
      const needed = spans.reduce((sum, value) => sum + value, 0)
      if (needed <= fan || arranged.length === 1) {
        // why: the root spreads its branches all the way round; a nested hub fans them out away from its own parent, a little wider than they need so they breathe
        const used = id === root ? 2 * PI : min(fan, max(needed * 1.3, needed + (arranged.length - 1) * 0.12))
        const padding = (used - needed) / arranged.length
        let cursor = -used / 2
        const placed = arranged.map((branch, index) => {
          const share = (spans[index] as number) + padding
          const angle = cursor + share / 2
          cursor += share
          return branch.map((box) => ({
            id: box.id,
            x: orbit * cos(angle) + box.x * cos(angle) - box.y * sin(angle),
            y: orbit * sin(angle) + box.x * sin(angle) + box.y * cos(angle),
          }))
        })
        const boxes = placed.flat()
        const clash = placed.some((branch, index) =>
          branch.some(
            (box) =>
              own.some((hub) => hypot(box.x - hub.x, box.y - hub.y) < clearance) ||
              placed
                .slice(index + 1)
                .some((other) => other.some((neighbour) => hypot(box.x - neighbour.x, box.y - neighbour.y) < clearance))
          )
        )
        if (!clash) return [...own, ...boxes]
      }
      orbit *= 1 + GROWTH
    }
    return [...own, ...arranged.flat()]
  }
  const centres = createMap(plan(root).map((box) => [box.id, { x: box.x, y: box.y }] as const))
  const rings = createMap<string, number>()
  const depthOf = (id: string, depth: number): void => {
    if (id !== CENTRE) rings.set(id, depth)
    for (const child of children.get(id) ?? []) depthOf(child, depth + 1)
  }
  depthOf(root, 0)
  const points = [...centres.values()]
  return {
    centres,
    rings,
    parents: createMap(
      [...children].flatMap(([parent, members]) => (parent === CENTRE ? [] : members.map((member) => [member, parent] as const)))
    ),
    left: min(...points.map((point) => point.x), 0) - width / 2,
    top: min(...points.map((point) => point.y), 0) - height / 2,
    right: max(...points.map((point) => point.x), 0) + width / 2,
    bottom: max(...points.map((point) => point.y), 0) + height / 2,
  }
}

/**
 * The overview of every project drawn: each cluster of connected projects laid out in rings of
 * dependency layers, its foundations at the centre, the largest cluster first, the clusters packed in rows so the
 * drawing stays near the shape of the screen.
 *
 * @param nodes - The nodes, unpositioned, all of one width
 * @param edges - The edges between them
 * @returns The nodes positioned with their rings and cluster centres, the size and the main centre
 */
export function overviewLayout(nodes: readonly CanvasNode[], edges: readonly CanvasEdge[]): OverviewDrawing {
  const [first] = nodes
  if (first === undefined) return { nodes: [], width: 0, height: 0, centre: null }
  const { width, height } = first
  const adjacency = createMap<string, Set<string>>(nodes.map((node) => [node.id, createSet<string>()]))
  const dependencies = createMap<string, Set<string>>(nodes.map((node) => [node.id, createSet<string>()]))
  for (const edge of edges) {
    if (edge.source === edge.target || !adjacency.has(edge.source) || !adjacency.has(edge.target)) continue
    adjacency.get(edge.source)?.add(edge.target)
    adjacency.get(edge.target)?.add(edge.source)
    dependencies.get(edge.source)?.add(edge.target)
  }
  const labels = createMap(nodes.map((node) => [node.id, node.label] as const))
  // why: the most connected projects are the ones the drawing is planned around, so they are placed first and given the most room
  const rank = (left: string, right: string): number =>
    (adjacency.get(right)?.size ?? 0) - (adjacency.get(left)?.size ?? 0) || (labels.get(left) ?? '').localeCompare(labels.get(right) ?? '')
  const seen = createSet<string>()
  const clusters: Cluster[] = []
  for (const id of [...adjacency.keys()].sort(rank)) {
    if (seen.has(id)) continue
    const members: string[] = []
    for (const queue = [id]; queue.length > 0; ) {
      const current = queue.shift() as string
      if (seen.has(current)) continue
      seen.add(current)
      members.push(current)
      queue.push(...(adjacency.get(current) ?? []))
    }
    clusters.push(layoutCluster(members, dependencies, rank, width, height))
  }
  clusters.sort((left, right) => right.centres.size - left.centres.size)
  const area = clusters.reduce(
    (sum, cluster) => sum + (cluster.right - cluster.left + CLUSTER_GAP) * (cluster.bottom - cluster.top + CLUSTER_GAP),
    0
  )
  const rowLimit = max(clusters[0] === undefined ? 0 : clusters[0].right - clusters[0].left, sqrt(area * 1.6))
  const byId = createMap(nodes.map((node) => [node.id, node] as const))
  const positioned: CanvasNode[] = []
  let x = MARGIN
  let y = MARGIN
  let rowHeight = 0
  let drawingWidth = 0
  let centre: Point | null = null
  for (const cluster of clusters) {
    const clusterWidth = cluster.right - cluster.left
    if (x > MARGIN && x + clusterWidth > rowLimit + MARGIN) {
      x = MARGIN
      y += rowHeight + CLUSTER_GAP
      rowHeight = 0
    }
    const pivot = { x: x - cluster.left, y: y - cluster.top }
    centre ??= pivot
    for (const [id, point] of cluster.centres) {
      const node = byId.get(id) as CanvasNode
      positioned.push({
        ...node,
        x: pivot.x + point.x - width / 2,
        y: pivot.y + point.y - height / 2,
        ring: cluster.rings.get(id) ?? 0,
        pivot,
        parent: cluster.parents.get(id) ?? null,
      })
    }
    x += clusterWidth + CLUSTER_GAP
    rowHeight = max(rowHeight, cluster.bottom - cluster.top)
    drawingWidth = max(drawingWidth, x - CLUSTER_GAP + MARGIN)
  }
  return { nodes: positioned, width: drawingWidth, height: y + rowHeight + MARGIN, centre }
}
