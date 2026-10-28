import type { Point } from './edge-geometry'
import type { IconKind } from './labels'
import type { EdgeKind, ExplorerDocument, ExplorerLink, ExplorerProject, Role } from './model'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { max } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { presentNode } from './labels'
import { overviewLayout } from './overview'
import { radialLayout } from './radial'

/** The family a link belongs to: how it is coloured and which toggle governs it. */
export type LinkFamily = 'import' | 'unresolved' | 'configuration' | 'tool'

/** The kinds an import draws. */
export const IMPORT_KINDS: readonly EdgeKind[] = ['value', 'type', 'dynamic', 're-export-all', 'side-effect']

/** The kinds a configuration file declares. */
export const CONFIGURATION_KINDS: readonly EdgeKind[] = ['manifest', 'declared', 'config']

/** Every kind, in the order the legend lists them. */
export const ALL_KINDS: readonly EdgeKind[] = [...IMPORT_KINDS, 'unresolved', ...CONFIGURATION_KINDS, 'tool']

/** Every role, in the order the legend lists them. */
export const ALL_ROLES: readonly Role[] = ['production', 'spec', 'test-config', 'lint-config', 'build-config', 'script', 'docs', 'asset']

/** What a link may point at beyond a project. */
export type ResourceKind = 'external' | 'tool' | 'config'

/** The kinds of node the canvas draws. */
export type CanvasKind = 'project' | ResourceKind

/** What the reader has switched on. */
export interface GraphFilters {
  /** The edge kinds drawn */
  kinds: ReadonlySet<EdgeKind>
  /** The roles of the files whose edges are drawn */
  roles: ReadonlySet<Role>
  /** The resources drawn beside the projects */
  resources: ReadonlySet<ResourceKind>
  /** The project types drawn */
  types: ReadonlySet<ExplorerProject['type']>
  /** A project the view is narrowed around, or null */
  focus: string | null
  /** How many hops from the focused project are kept */
  hops: number
}

/** The view a reader meets first: production imports between projects, nothing else. */
export const DEFAULT_FILTERS: GraphFilters = {
  kinds: createSet<EdgeKind>(['value', 'dynamic', 're-export-all', 'side-effect', 'unresolved']),
  roles: createSet<Role>(['production']),
  resources: createSet<ResourceKind>(),
  types: createSet<ExplorerProject['type']>(['lib', 'app', 'e2e']),
  focus: null,
  hops: 1,
}

/** A node on the canvas. */
export interface CanvasNode {
  /** `project:<name>`, `external:<name>@<version>`, `tool:<id>` or `config:<path>` */
  id: string
  /** What it is */
  kind: CanvasKind
  /** The text on it: the name without what the icon says */
  label: string
  /** The full name */
  name: string
  /** What the icon shows */
  icon: IconKind
  /** The project type, for a project */
  type: ExplorerProject['type'] | null
  /** The tags, for a project */
  tags: readonly string[]
  /** The left edge */
  x: number
  /** The top edge */
  y: number
  /** The width */
  width: number
  /** The height */
  height: number
  /** The ring the node sits on: the signed hop from the focused project, or the hop from its cluster's hub */
  ring: number | null
  /** The centre of the rings the node sits on, or null before it is placed */
  pivot: Point | null
  /** In the overview, the dependency the node hangs off; null for a centre and in a focused view */
  parent: string | null
}

/** Every link between two canvas nodes of one family, folded. */
export interface CanvasEdge {
  /** `<source>|<target>|<family>` */
  id: string
  /** The depending node's id */
  source: string
  /** The depended-on node's id */
  target: string
  /** The family */
  family: LinkFamily
  /** The kinds among the links */
  kinds: EdgeKind[]
  /** The roles among the links */
  roles: Role[]
  /** How many files draw the links */
  files: number
  /** The links */
  links: ExplorerLink[]
}

/** What the canvas draws. */
export interface CanvasGraph {
  /** The nodes */
  nodes: CanvasNode[]
  /** The edges */
  edges: CanvasEdge[]
  /** The drawing's width */
  width: number
  /** The drawing's height */
  height: number
  /** The centre of the drawing's rings: the focused project, or the hub of the largest cluster; null when empty */
  centre: Point | null
}

/** A node's height. */
export const NODE_HEIGHT = 30

/** How wide a character of the 12px monospaced face is. */
const CHARACTER_WIDTH = 7.2

/** The icon's size. */
export const ICON_SIZE = 14

/** The space between the icon and the label. */
export const ICON_GAP = 6

/** The space between a box's content and its sides. */
const BOX_PADDING = 14

/** The narrowest a box's content is. */
const MIN_CONTENT_WIDTH = 72

/**
 * The family of a kind.
 *
 * @param kind - What produced the edge
 * @returns Import, unresolved, configuration or tool
 */
export function familyOf(kind: EdgeKind): LinkFamily {
  if (kind === 'unresolved') return 'unresolved'
  if (kind === 'tool') return 'tool'
  return IMPORT_KINDS.includes(kind) ? 'import' : 'configuration'
}

/**
 * What a link target is.
 *
 * @param target - A link target id
 * @returns The kind before the colon
 */
export function targetKind(target: string): 'project' | 'entry' | ResourceKind {
  return target.slice(0, target.indexOf(':')) as 'project' | 'entry' | ResourceKind
}

/**
 * The text a node shows.
 *
 * @param id - The node id
 * @returns The identity without its kind, a package without its version
 */
export function labelOf(id: string): string {
  const kind = targetKind(id)
  const rest = id.slice(kind.length + 1)
  if (kind !== 'external') return rest
  const at = rest.lastIndexOf('@')
  return at > 0 ? rest.slice(0, at) : rest
}

/**
 * The node a link target is drawn as: an entry by the project owning it, anything else itself.
 *
 * @param document - The explorer document
 * @returns A resolver
 */
export function targetResolver(document: ExplorerDocument): (target: string) => string {
  const owners = createMap<string, string>(document.entries.map((entry) => [`entry:${entry.id}`, `project:${entry.project}`]))
  return (target) => owners.get(target) ?? target
}

/** A link the filters keep, with the node it is drawn to. */
interface KeptLink {
  /** The link */
  link: ExplorerLink
  /** The node id the link is drawn to */
  target: string
}

/**
 * The links the filters keep, each pointing at the node it is drawn to.
 *
 * @param document - The explorer document
 * @param filters - What is switched on
 * @returns The kept links with their drawn targets
 */
function keptLinks(document: ExplorerDocument, filters: GraphFilters): KeptLink[] {
  const resolve = targetResolver(document)
  const kept: KeptLink[] = []
  for (const link of document.links) {
    if (!filters.kinds.has(link.kind) || !filters.roles.has(link.role)) continue
    const target = resolve(link.target)
    const kind = targetKind(target)
    if (kind !== 'project' && !filters.resources.has(kind as ResourceKind)) continue
    kept.push({ link, target })
  }
  return kept
}

/**
 * The signed hop of every node around a focused one: what it depends on, directly or through
 * others, negative; what depends on it, directly or through others, positive. Each side walks
 * its own direction, so a sibling or a dependent of a dependency is never drawn.
 *
 * @param edges - Pairs of node ids, the source depending on the target
 * @param focus - The node id at the centre
 * @param hops - How far each side walks
 * @returns The signed hop by node id, zero for the focus
 */
export function egoColumns(edges: readonly Pick<CanvasEdge, 'source' | 'target'>[], focus: string, hops: number): Map<string, number> {
  const columns = createMap<string, number>([[focus, 0]])
  for (const side of [-1, 1]) {
    let frontier = [focus]
    for (let step = 1; step <= hops && frontier.length > 0; step += 1) {
      const next: string[] = []
      for (const id of frontier) {
        for (const edge of edges) {
          const other = side < 0 ? (edge.source === id ? edge.target : null) : edge.target === id ? edge.source : null
          if (other === null || columns.has(other)) continue
          columns.set(other, side * step)
          next.push(other)
        }
      }
      frontier = next
    }
  }
  return columns
}

/**
 * The width of a box's content: its icon, the gap after it and its label in the monospaced face.
 *
 * @param label - The text the box shows
 * @returns The width in drawing units
 */
export function contentWidth(label: string): number {
  return ICON_SIZE + ICON_GAP + label.length * CHARACTER_WIDTH
}

/**
 * The drawing of a document under filters: projects in columns by dependency depth, the
 * dependencies to the left of what depends on them, the resources in a column of their own,
 * and one edge per family between two nodes.
 *
 * @param document - The explorer document
 * @param filters - What is switched on
 * @returns The nodes with their positions and the folded edges
 */
export function buildCanvas(document: ExplorerDocument, filters: GraphFilters): CanvasGraph {
  const projects = createMap(document.projects.map((project) => [project.name, project] as const))
  const folded = createMap<string, CanvasEdge>()
  const present = createSet<string>()
  for (const { link, target } of keptLinks(document, filters)) {
    const source = `project:${link.source}`
    const sourceProject = projects.get(link.source)
    if (sourceProject === undefined || !filters.types.has(sourceProject.type)) continue
    if (targetKind(target) === 'project') {
      const targetProject = projects.get(target.slice('project:'.length))
      if (targetProject === undefined || !filters.types.has(targetProject.type)) continue
    }
    const family = familyOf(link.kind)
    const id = `${source}|${target}|${family}`
    const edge = folded.get(id) ?? { id, source, target, family, kinds: [], roles: [], files: 0, links: [] }
    if (!edge.kinds.includes(link.kind)) edge.kinds.push(link.kind)
    if (!edge.roles.includes(link.role)) edge.roles.push(link.role)
    edge.files += link.files.length
    edge.links.push(link)
    folded.set(id, edge)
    present.add(source)
    present.add(target)
  }
  let edges = [...folded.values()]
  let visible = createSet<string>()
  for (const project of document.projects) if (filters.types.has(project.type)) visible.add(`project:${project.name}`)
  for (const id of present) visible.add(id)
  const ego = filters.focus === null ? null : egoColumns(edges, `project:${filters.focus}`, filters.hops)
  if (ego !== null) {
    visible = createSet([...visible].filter((id) => ego.has(id)))
    // why: an edge from a dependent straight to a dependency crosses the focus and says nothing about it
    edges = edges.filter(
      (edge) => ego.has(edge.source) && ego.has(edge.target) && (ego.get(edge.source) ?? 0) * (ego.get(edge.target) ?? 0) >= 0
    )
  }
  const unplaced: CanvasNode[] = []
  for (const id of [...visible].sort()) {
    const kind = targetKind(id) as CanvasKind
    const name = labelOf(id)
    const project = kind === 'project' ? projects.get(name) : undefined
    const { label, icon } = presentNode(id, project)
    const node: CanvasNode = {
      id,
      kind,
      label,
      name,
      icon,
      type: project?.type ?? null,
      tags: project?.tags ?? [],
      x: 0,
      y: 0,
      width: 0,
      height: NODE_HEIGHT,
      ring: ego === null ? null : (ego.get(id) ?? 1),
      pivot: null,
      parent: null,
    }
    unplaced.push(node)
  }
  // why: every box of a view has the width of its widest label, so the drawing reads as a grid of equals and no line meets a box off its edge
  const boxWidth = max(...unplaced.map((node) => contentWidth(node.label)), MIN_CONTENT_WIDTH) + 2 * BOX_PADDING
  for (const node of unplaced) node.width = boxWidth
  if (ego !== null && filters.focus !== null) {
    const focusId = `project:${filters.focus}`
    const drawing = radialLayout(unplaced, edges, focusId, ego)
    const focused = drawing.nodes.find((node) => node.id === focusId)
    const centre = focused === undefined ? null : { x: focused.x + focused.width / 2, y: focused.y + focused.height / 2 }
    return { width: drawing.width, height: drawing.height, nodes: drawing.nodes.map((node) => ({ ...node, pivot: centre })), edges, centre }
  }
  return { ...overviewLayout(unplaced, edges), edges }
}
