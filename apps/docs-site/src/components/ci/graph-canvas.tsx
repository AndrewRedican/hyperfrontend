'use client'

import type { EdgeGeometry } from '@/lib/ci/edge-geometry'
import type { CanvasEdge, CanvasGraph, CanvasNode, LinkFamily } from '@/lib/ci/graph-view'
import type { EdgeKind } from '@/lib/ci/model'
import type { ViewportPoint, ViewportTransform } from '@/lib/diagram-viewport'
import { bowedEdge, spokeBadgePoint, straightEdge } from '@/lib/ci/edge-geometry'
import { ICON_GAP, ICON_SIZE, contentWidth } from '@/lib/ci/graph-view'
import { ICON_NAMES } from '@/lib/ci/labels'
import { FIT_PADDING, ZOOM_STEP, centerTransform, clampScale, fitScale, wheelZoomFactor, zoomAtPoint } from '@/lib/diagram-viewport'
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { abs, hypot, max, min, round } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { NodeIcon } from './node-icon'

/** The colour variable of each family. */
export const FAMILY_COLOUR: Record<LinkFamily, string> = {
  import: 'var(--ci-series-1)',
  configuration: 'var(--ci-series-2)',
  tool: 'var(--ci-series-3)',
  unresolved: 'var(--ci-critical)',
}

/** The dash pattern of each kind; a solid line for a value import. */
export const KIND_DASH: Record<EdgeKind, string | null> = {
  value: null,
  type: '6 4',
  dynamic: '8 3 2 3',
  're-export-all': '12 4',
  'side-effect': '2 3',
  unresolved: '3 3',
  manifest: null,
  declared: '6 4',
  config: '2 3',
  tool: null,
}

/** The kinds in the order one of them decides a folded edge's dash. */
const KIND_PRECEDENCE: readonly EdgeKind[] = [
  'value',
  'manifest',
  'tool',
  'unresolved',
  'dynamic',
  're-export-all',
  'declared',
  'side-effect',
  'config',
  'type',
]

/** The side of one grid square, in the drawing's units, so a square shrinks as the view zooms out. */
const GRID = 24

/** How far the grid reaches beyond the drawing in every direction. */
const GRID_EXTENT = 20_000

/** How far in from a spoke's outer box its badge sits. */
const SPOKE_BADGE_INSET = 30

/** The zoom from which every line of the overview shows its badge; below it only the lines in question do, since a hundred circles at a fifth of their size say nothing. */
const BADGE_SCALE = 0.6

/** How far a pointer moves before a press becomes a drag. */
const DRAG_THRESHOLD = 3

/** What a line says, read from the project in question. */
export type Wording = 'depends on' | 'is dependent on'

/** Props for {@link GraphCanvas}. */
export interface GraphCanvasProps {
  /** What to draw */
  graph: CanvasGraph
  /** The selected node id, or null */
  selected: string | null
  /** The node ids a search matched; empty for no search */
  matched: ReadonlySet<string>
  /** The focused project's node id, or null for no focus */
  focus: string | null
  /** Called with a node id, or null for the background */
  onSelect: (id: string | null) => void
  /** Called when a line or its badge is clicked */
  onOpenEdge: (edge: CanvasEdge) => void
}

/** A press that may become a drag. */
interface Drag {
  /** The pointer's last horizontal position */
  x: number
  /** The pointer's last vertical position */
  y: number
  /** Whether it moved far enough to count as a drag */
  moved: boolean
}

/** Two fingers on the canvas. */
interface Pinch {
  /** The distance between them */
  distance: number
  /** The point between them, relative to the canvas */
  middle: ViewportPoint
}

/**
 * The dash a folded edge is drawn with: the one of its strongest kind.
 * @param kinds - The kinds among the folded links
 * @returns The pattern, or null for solid
 */
function dashOf(kinds: readonly EdgeKind[]): string | null {
  const strongest = KIND_PRECEDENCE.find((kind) => kinds.includes(kind)) ?? 'value'
  return KIND_DASH[strongest]
}

/**
 * What a line says from the point of view of one project: that it depends on the other end, or
 * that the other end is dependent on it.
 * @param edge - The line
 * @param perspective - The node id in question, or null
 * @returns The wording, or null when the line does not touch the project in question
 */
export function wordingOf(edge: CanvasEdge, perspective: string | null): Wording | null {
  if (perspective === edge.source) return 'depends on'
  if (perspective === edge.target) return 'is dependent on'
  return null
}

/**
 * The geometry of a line: a straight spoke between two rings, its badge near the outer box, or a
 * curve bowed away from the rings' centre between two members of one ring.
 * @param graph - The drawing
 * @param source - The depending box
 * @param target - The depended-on box
 * @returns The path and its middle
 */
function geometryOf(graph: CanvasGraph, source: CanvasNode, target: CanvasNode): EdgeGeometry {
  const pivot = source.pivot ?? graph.centre
  if (pivot !== null && source.ring === target.ring && source.pivot === target.pivot) return bowedEdge(source, target, pivot)
  const spoke = straightEdge(source, target)
  const sourceOuter = abs(source.ring ?? 0) > abs(target.ring ?? 0)
  return { ...spoke, mid: spokeBadgePoint(sourceOuter ? spoke.from : spoke.to, sourceOuter ? spoke.to : spoke.from, SPOKE_BADGE_INSET) }
}

/**
 * The geometry of two pointers.
 * @param pointers - The pointers down, relative to the canvas
 * @returns The pinch, or null unless exactly two are down
 */
function readPinch(pointers: ReadonlyMap<number, ViewportPoint>): Pinch | null {
  if (pointers.size !== 2) return null
  const [a, b] = [...pointers.values()] as [ViewportPoint, ViewportPoint]
  return { distance: hypot(b.x - a.x, b.y - a.y), middle: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } }
}

/**
 * The drawing on a grid that zooms with it: dragged to pan, zoomed with Ctrl or Cmd and the
 * wheel, a pinch, the toolbar or the keyboard, as the site's expanded diagrams are. Every line
 * has the same weight and no head: its badge counts the contact points behind it, and names the
 * direction relative to the project in question, the one pointed at, the one selected, or the
 * focused one. A node is selected and a line opened with a click.
 * @param props - See {@link GraphCanvasProps}.
 * @param props.graph - What to draw
 * @param props.selected - The selected node id
 * @param props.matched - The node ids a search matched
 * @param props.focus - The focused node id
 * @param props.onSelect - Told what node was clicked
 * @param props.onOpenEdge - Told what line was clicked
 * @returns The canvas
 */
export function GraphCanvas({ graph, selected, matched, focus, onSelect, onOpenEdge }: GraphCanvasProps) {
  const gridId = useId()
  const [view, setView] = useState<ViewportTransform>({ scale: 1, tx: 0, ty: 0 })
  const [hovered, setHovered] = useState<string | null>(null)
  const frame = useRef<HTMLDivElement | null>(null)
  const viewRef = useRef(view)
  const pointers = useRef(createMap<number, ViewportPoint>())
  const drag = useRef<Drag | null>(null)
  const pinch = useRef<Pinch | null>(null)
  const byId = useMemo(() => createMap(graph.nodes.map((node) => [node.id, node] as const)), [graph])
  const edgeById = useMemo(() => createMap(graph.edges.map((edge) => [edge.id, edge] as const)), [graph])

  const apply = useCallback((next: ViewportTransform) => {
    viewRef.current = next
    setView(next)
  }, [])

  const containerSize = useCallback(() => ({ width: frame.current?.clientWidth ?? 1, height: frame.current?.clientHeight ?? 1 }), [])

  const fit = useCallback(() => {
    const size = { width: graph.width, height: graph.height }
    const container = containerSize()
    apply(centerTransform(size, container, min(1, fitScale(size, container, FIT_PADDING))))
  }, [graph, apply, containerSize])

  const actualSize = useCallback(() => {
    apply(centerTransform({ width: graph.width, height: graph.height }, containerSize(), 1))
  }, [graph, apply, containerSize])

  const zoomAt = useCallback(
    (point: ViewportPoint, scale: number) => {
      const fitted = fitScale({ width: graph.width, height: graph.height }, containerSize(), FIT_PADDING)
      apply(zoomAtPoint(viewRef.current, point, clampScale(scale, fitted)))
    },
    [graph, apply, containerSize]
  )

  const zoomStep = useCallback(
    (factor: number) => {
      const { width, height } = containerSize()
      zoomAt({ x: width / 2, y: height / 2 }, viewRef.current.scale * factor)
    },
    [zoomAt, containerSize]
  )

  // why: a filter or a focus changes what is drawn, and the reader should see all of it at once, at most at full size
  useEffect(() => {
    fit()
  }, [fit])

  // why: React may bind the wheel passively, and a zoom must stop the page from scrolling; a plain wheel still scrolls the page
  useEffect(() => {
    const element = frame.current
    if (element === null) return
    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return
      event.preventDefault()
      const rect = element.getBoundingClientRect()
      zoomAt({ x: event.clientX - rect.left, y: event.clientY - rect.top }, viewRef.current.scale * wheelZoomFactor(event.deltaY))
    }
    element.addEventListener('wheel', onWheel, { passive: false })
    return () => element.removeEventListener('wheel', onWheel)
  }, [zoomAt])

  const perspective = useMemo(() => {
    if (hovered !== null && byId.has(hovered)) return hovered
    if (selected !== null && byId.has(selected)) return selected
    return focus
  }, [hovered, selected, focus, byId])

  const emphasised = useMemo(() => {
    const ids = createSet<string>()
    const subject = hovered ?? selected
    // why: a selection the current filters do not draw would otherwise fade everything that is drawn
    if (subject === null || !(byId.has(subject) || edgeById.has(subject))) return ids
    ids.add(subject)
    for (const edge of graph.edges) {
      if (edge.id === subject || edge.source === subject || edge.target === subject) {
        ids.add(edge.id)
        ids.add(edge.source)
        ids.add(edge.target)
      }
    }
    return ids
  }, [graph, byId, edgeById, hovered, selected])

  const drawn = useMemo(
    () =>
      graph.edges.flatMap((edge) => {
        const source = byId.get(edge.source)
        const target = byId.get(edge.target)
        if (source === undefined || target === undefined) return []
        const lit = emphasised.has(edge.id)
        // why: links between members of one ring are many and say little until one of their ends is in question, so they wait to be asked for
        if (source.ring === target.ring && source.pivot === target.pivot && !lit) return []
        // why: the overview draws each project's line to the dependency it hangs off, which is the nested structure; its other dependencies, many of them on the same few foundations, wait to be asked for
        if (focus === null && source.parent !== target.id && !lit) return []
        return [{ edge, lit, geometry: geometryOf(graph, source, target) }]
      }),
    [graph, byId, emphasised, focus]
  )

  const dim = emphasised.size > 0
  const relative = (event: React.PointerEvent): ViewportPoint => {
    const rect = event.currentTarget.getBoundingClientRect()
    return { x: event.clientX - rect.left, y: event.clientY - rect.top }
  }
  const toolbarButton =
    'flex h-7 min-w-7 items-center justify-center rounded-full px-1 text-slate-700 transition-colors hover:bg-slate-200 focus-visible:ring-2 focus-visible:ring-primary-500 dark:text-slate-300 dark:hover:bg-slate-700'

  return (
    <div
      className="ci-canvas relative mt-4 h-[34rem] overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700"
      style={{ background: 'var(--ci-surface)' }}
    >
      <div
        role="group"
        aria-label="Zoom controls"
        className="absolute right-2 top-2 z-10 flex items-center gap-0.5 rounded-full bg-white/90 px-1.5 py-0.5 shadow dark:bg-slate-800/90"
      >
        <button type="button" className={toolbarButton} aria-label="Zoom out" title="Zoom out" onClick={() => zoomStep(1 / ZOOM_STEP)}>
          −
        </button>
        <span aria-live="polite" className="w-11 select-none text-center font-mono text-xs tabular-nums text-slate-700 dark:text-slate-300">
          {round(view.scale * 100)}%
        </span>
        <button type="button" className={toolbarButton} aria-label="Zoom in" title="Zoom in" onClick={() => zoomStep(ZOOM_STEP)}>
          +
        </button>
        <span aria-hidden="true" className="mx-1 h-4 w-px bg-slate-300 dark:bg-slate-600" />
        <button type="button" className={`${toolbarButton} font-mono text-xs`} aria-label="Fit to view" title="Fit to view" onClick={fit}>
          Fit
        </button>
        <button
          type="button"
          className={`${toolbarButton} font-mono text-xs`}
          aria-label="Reset zoom to 100%"
          title="Reset zoom to 100%"
          onClick={actualSize}
        >
          100%
        </button>
      </div>
      <div
        ref={frame}
        tabIndex={0}
        role="application"
        aria-label="Dependency graph. Drag to pan, Ctrl and scroll or pinch to zoom, plus and minus keys to zoom, F to fit, 0 for full size."
        className="h-full w-full cursor-grab touch-none select-none outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-500 active:cursor-grabbing"
        onKeyDown={(event) => {
          if (event.key === '+' || event.key === '=') zoomStep(ZOOM_STEP)
          else if (event.key === '-') zoomStep(1 / ZOOM_STEP)
          else if (event.key === '0') actualSize()
          else if (event.key === 'f') fit()
          else return
          event.preventDefault()
        }}
        onPointerDown={(event) => {
          pointers.current.set(event.pointerId, relative(event))
          pinch.current = readPinch(pointers.current)
          // why: capturing the pointer here would retarget the click that follows, so a node or a line could never be clicked; capture starts with the drag
          if (pointers.current.size === 1) drag.current = { x: event.clientX, y: event.clientY, moved: false }
        }}
        onPointerMove={(event) => {
          if (!pointers.current.has(event.pointerId)) return
          pointers.current.set(event.pointerId, relative(event))
          const next = readPinch(pointers.current)
          if (next !== null && pinch.current !== null) {
            zoomAt(next.middle, viewRef.current.scale * (next.distance / max(1, pinch.current.distance)))
            pinch.current = next
            return
          }
          const press = drag.current
          if (press === null) return
          const dx = event.clientX - press.x
          const dy = event.clientY - press.y
          if (!press.moved && hypot(dx, dy) < DRAG_THRESHOLD) return
          if (!press.moved) event.currentTarget.setPointerCapture(event.pointerId)
          drag.current = { x: event.clientX, y: event.clientY, moved: true }
          apply({ ...viewRef.current, tx: viewRef.current.tx + dx, ty: viewRef.current.ty + dy })
        }}
        onPointerUp={(event) => {
          const press = drag.current
          pointers.current.delete(event.pointerId)
          pinch.current = readPinch(pointers.current)
          if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
          if (pointers.current.size === 0) drag.current = null
          if (press !== null && !press.moved && (event.target as Element).hasAttribute('data-background')) onSelect(null)
        }}
        onPointerCancel={(event) => {
          pointers.current.delete(event.pointerId)
          pinch.current = null
          drag.current = null
        }}
      >
        <svg className="h-full w-full" role="img" aria-label={`${graph.nodes.length} projects and ${graph.edges.length} links`}>
          <defs>
            <pattern id={gridId} width={GRID} height={GRID} patternUnits="userSpaceOnUse">
              <path d={`M ${GRID} 0 L 0 0 0 ${GRID}`} fill="none" stroke="var(--ci-grid)" strokeWidth="1" />
            </pattern>
          </defs>
          <g transform={`translate(${view.tx} ${view.ty}) scale(${view.scale})`}>
            {/* why: the opacity is the rect's, applied once to the whole tiling, so a crossing is no darker than a line */}
            <rect
              data-background=""
              x={-GRID_EXTENT}
              y={-GRID_EXTENT}
              width={2 * GRID_EXTENT}
              height={2 * GRID_EXTENT}
              fill={`url(#${gridId})`}
              opacity="0.25"
            />
            {drawn.map(({ edge, lit, geometry }) => (
              <g
                key={edge.id}
                className="cursor-pointer"
                onPointerEnter={() => setHovered(edge.id)}
                onPointerLeave={() => setHovered(null)}
                onClick={() => onOpenEdge(edge)}
              >
                <path d={geometry.d} fill="none" stroke="transparent" strokeWidth="14" />
                <path
                  d={geometry.d}
                  fill="none"
                  stroke={FAMILY_COLOUR[edge.family]}
                  strokeWidth="1.5"
                  vectorEffect="non-scaling-stroke"
                  strokeDasharray={dashOf(edge.kinds) ?? undefined}
                  opacity={dim && !lit ? 0.15 : 0.9}
                />
              </g>
            ))}
            {graph.nodes.map((node) => (
              <Node
                key={node.id}
                node={node}
                lit={emphasised.has(node.id)}
                dim={dim && !emphasised.has(node.id)}
                matched={matched.has(node.id)}
                selected={selected === node.id}
                focused={focus === node.id}
                onSelect={onSelect}
                onHover={setHovered}
              />
            ))}
            {drawn
              .filter(({ lit }) => lit || focus !== null || view.scale >= BADGE_SCALE)
              .map(({ edge, lit, geometry }) => (
                <Badge
                  key={edge.id}
                  edge={edge}
                  at={geometry.mid}
                  wording={wordingOf(edge, perspective)}
                  dim={dim && !lit}
                  onOpen={() => onOpenEdge(edge)}
                  onHover={setHovered}
                />
              ))}
          </g>
        </svg>
      </div>
      <p className="pointer-events-none absolute bottom-2 right-2 rounded-full bg-white/80 px-2 py-0.5 text-[11px] text-slate-600 dark:bg-slate-800/80 dark:text-slate-400">
        Drag to pan · Ctrl+scroll to zoom · click a line for its contact points
      </p>
      {hovered === null ? null : <Tooltip id={hovered} byId={byId} edgeById={edgeById} />}
    </div>
  )
}

/** Props for {@link Node}. */
interface NodeProps {
  /** The node */
  node: CanvasNode
  /** Whether it is emphasised */
  lit: boolean
  /** Whether it is faded */
  dim: boolean
  /** Whether a search matched it */
  matched: boolean
  /** Whether it is selected */
  selected: boolean
  /** Whether it is the focused project */
  focused: boolean
  /** Told when it is clicked */
  onSelect: (id: string) => void
  /** Told when the pointer enters or leaves */
  onHover: (id: string | null) => void
}

/**
 * One box: its icon and label centred together, dashed for something outside the workspace's projects.
 * @param props - See {@link NodeProps}.
 * @param props.node
 * @param props.lit
 * @param props.dim
 * @param props.matched
 * @param props.selected
 * @param props.focused - Whether it is the focused project
 * @param props.onSelect
 * @param props.onHover
 * @returns The node
 */
function Node({ node, lit, dim, matched, selected, focused, onSelect, onHover }: NodeProps) {
  const start = (node.width - contentWidth(node.label)) / 2
  return (
    <g
      transform={`translate(${node.x} ${node.y})`}
      className="cursor-pointer"
      opacity={dim ? 0.3 : 1}
      onClick={(event) => {
        event.stopPropagation()
        onSelect(node.id)
      }}
      onPointerEnter={() => onHover(node.id)}
      onPointerLeave={() => onHover(null)}
    >
      <rect
        width={node.width}
        height={node.height}
        rx="6"
        fill={matched ? 'var(--ci-match)' : 'var(--ci-node)'}
        stroke={selected || focused ? 'var(--ci-series-1)' : lit ? 'var(--ci-ink-2)' : 'var(--ci-line)'}
        strokeWidth={selected || focused ? 2 : 1}
        vectorEffect="non-scaling-stroke"
        strokeDasharray={node.kind === 'project' ? undefined : '4 3'}
      />
      <NodeIcon kind={node.icon} x={start} y={(node.height - ICON_SIZE) / 2} size={ICON_SIZE} />
      <text
        x={start + ICON_SIZE + ICON_GAP}
        y={node.height / 2}
        dominantBaseline="central"
        fontSize="12"
        fontFamily="var(--font-mono)"
        fill="var(--ci-ink)"
      >
        {node.label}
      </text>
      <title>{`${node.name} (${ICON_NAMES[node.icon]})`}</title>
    </g>
  )
}

/** Props for {@link Badge}. */
interface BadgeProps {
  /** The line */
  edge: CanvasEdge
  /** Where it sits */
  at: ViewportPoint
  /** What the line says from the project in question, or null */
  wording: Wording | null
  /** Whether it is faded */
  dim: boolean
  /** Opens the line's contact points */
  onOpen: () => void
  /** Told when the pointer enters or leaves */
  onHover: (id: string | null) => void
}

/**
 * The circle on a line counting its contact points, with the line's direction relative to the
 * project in question beneath it.
 * @param props - See {@link BadgeProps}.
 * @param props.edge
 * @param props.at
 * @param props.wording
 * @param props.dim
 * @param props.onOpen
 * @param props.onHover
 * @returns The badge
 */
function Badge({ edge, at, wording, dim, onOpen, onHover }: BadgeProps) {
  const count = String(edge.files)
  const radius = max(9, count.length * 3.4 + 4)
  return (
    <g
      transform={`translate(${at.x} ${at.y})`}
      className="cursor-pointer"
      opacity={dim ? 0.2 : 1}
      onClick={onOpen}
      onPointerEnter={() => onHover(edge.id)}
      onPointerLeave={() => onHover(null)}
    >
      <circle
        r={radius}
        fill="var(--ci-surface)"
        stroke={FAMILY_COLOUR[edge.family]}
        strokeWidth="1.25"
        vectorEffect="non-scaling-stroke"
      />
      <text textAnchor="middle" dominantBaseline="central" fontSize="10" fontFamily="var(--font-mono)" fill="var(--ci-ink)">
        {count}
      </text>
      {wording === null ? null : (
        <text
          y={radius + 9}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize="10"
          fill="var(--ci-ink-2)"
          stroke="var(--ci-surface)"
          strokeWidth="3"
          paintOrder="stroke"
        >
          {wording}
        </text>
      )}
    </g>
  )
}

/** Props for {@link Tooltip}. */
interface TooltipProps {
  /** The hovered id */
  id: string
  /** The nodes by id */
  byId: ReadonlyMap<string, CanvasNode>
  /** The lines by id */
  edgeById: ReadonlyMap<string, CanvasEdge>
}

/**
 * What the pointer is over, as a sentence.
 * @param props - See {@link TooltipProps}.
 * @param props.id
 * @param props.byId
 * @param props.edgeById
 * @returns The tooltip
 */
function Tooltip({ id, byId, edgeById }: TooltipProps) {
  const edge = edgeById.get(id)
  const node = byId.get(id)
  const name = (nodeId: string) => byId.get(nodeId)?.name ?? nodeId
  const text =
    edge !== undefined
      ? `${name(edge.source)} depends on ${name(edge.target)} · ${edge.files} contact point${edge.files === 1 ? '' : 's'} · ${edge.kinds.join(', ')} · ${edge.roles.join(', ')}`
      : node !== undefined
        ? `${node.name} · ${ICON_NAMES[node.icon]}`
        : ''
  if (text === '') return null
  return (
    <div className="pointer-events-none absolute bottom-2 left-2 max-w-[calc(100%-20rem)] truncate rounded bg-slate-900/90 px-2 py-1 font-mono text-xs text-white dark:bg-slate-100/90 dark:text-slate-900">
      {text}
    </div>
  )
}
