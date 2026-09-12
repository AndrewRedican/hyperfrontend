import type { GraphConfig, GraphStep } from '../models/graph'
import type { MediaProfile } from '../models/profile'
import type { Stage } from '../models/stage'
import type { MediaTheme } from '../models/theme'
import type { EdgeGeometry, Point } from './layout'
import { max, round } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'
import { escapeHtml } from '../lib/escape-html'
import { easeInOut, easeOut, progress, pulse } from '../lib/motion'
import { apiChipStyles, renderApiChip } from '../stage/api-chip'
import { defineStage } from '../stage/define-stage'
import { alongEdge, arrivalAngle, edgeGeometry } from './layout'

/** How long the cursor rests on a node it has just reached before anything else happens. */
const LANDING_MS = 250

/** How long the cursor takes to come back along an edge that closed a cycle. */
const RETURN_MS = 500

/** How long the flash on a node that was reached again lasts. */
const FLASH_MS = 900

/** Width past which the frame is drawn at its full density. */
const WIDE_ENOUGH = 800

/** How the frame is sized for the surface it is being drawn for. */
interface GraphMetrics {
  /** Margin between the drawing and the edge of the frame. */
  insetPx: number
  /** Radius of a node. */
  radiusPx: number
  /** Font size of a node's label. */
  labelPx: number
  /** Font size of an edge's property name. */
  edgePx: number
  /** Font size of the API chip. */
  chipPx: number
  /** Radius of the traversal cursor. */
  cursorPx: number
  /** Radius of the badge a found cycle is numbered with. */
  badgePx: number
}

/** Where the walk stands at one instant. */
interface WalkState {
  /** Nodes reached so far, the start included. */
  visited: readonly string[]
  /** Steps that have closed a cycle so far, in order. */
  cycles: readonly GraphStep[]
  /** The cursor's position while it is between nodes, or undefined while it stands on one or once the walk is over. */
  cursor: Point | undefined
  /** The node the cursor is standing on or heading for, for its glow. */
  current: string
  /** When each cycle was found, index for index with `cycles`. */
  foundAt: readonly number[]
}

/**
 * Size the frame for the surface it is being drawn for.
 *
 * @param profile - The presentation target being composed for.
 * @returns Every measurement the renderer needs.
 */
function graphMetrics(profile: MediaProfile): GraphMetrics {
  const wide = profile.width >= WIDE_ENOUGH
  return {
    insetPx: wide ? 28 : 18,
    radiusPx: wide ? 32 : 26,
    labelPx: wide ? 13.5 : 12,
    edgePx: wide ? 12 : 11,
    chipPx: wide ? 13 : 12,
    cursorPx: wide ? 8 : 7,
    badgePx: wide ? 11 : 10,
  }
}

/**
 * When the walk is over.
 *
 * @param config - The walk as the scene configured it.
 * @returns The offset at which the cursor has come to rest.
 */
function settledAt(config: GraphConfig): number {
  let latest = 0
  for (const step of config.steps) {
    latest = max(latest, step.atMs + config.travelMs + (step.cycle === true ? LANDING_MS + RETURN_MS : 0))
  }
  return latest
}

/**
 * Work out where the walk stands at one instant.
 *
 * Nothing is remembered between frames: the visited set, the cycles found and
 * the cursor's position are all read out of the steps and the moment asked
 * for, which is what lets the same scene record identically anywhere.
 *
 * @param config - The walk as the scene configured it.
 * @param geometries - Each edge's curve, index for index with the edges.
 * @param atMs - Offset from the start of the timeline.
 * @returns The state to draw.
 */
function walkAt(config: GraphConfig, geometries: readonly (EdgeGeometry | undefined)[], atMs: number): WalkState {
  const visited: string[] = [config.start]
  const cycles: GraphStep[] = []
  const foundAt: number[] = []
  // why: the dot is only drawn between nodes; standing on one, the node's own ring says where the walk is, so the label under it stays readable
  let cursor: Point | undefined = undefined
  let current = config.start
  for (const step of config.steps) {
    const edge = config.edges[step.edge]
    const geometry = geometries[step.edge]
    if (edge === undefined || geometry === undefined || atMs < step.atMs) {
      continue
    }
    const arrived = step.atMs + config.travelMs
    if (atMs < arrived) {
      cursor = alongEdge(geometry, easeInOut(progress(atMs, step.atMs, config.travelMs)))
      current = edge.to
      continue
    }
    if (step.cycle === true) {
      cycles.push(step)
      foundAt.push(arrived)
      const returning = arrived + LANDING_MS
      if (atMs < returning) {
        cursor = undefined
        current = edge.to
      } else if (atMs < returning + RETURN_MS) {
        cursor = alongEdge(geometry, 1 - easeInOut(progress(atMs, returning, RETURN_MS)))
        current = edge.from
      } else {
        cursor = undefined
        current = edge.from
      }
      continue
    }
    if (!visited.includes(edge.to)) {
      visited.push(edge.to)
    }
    cursor = undefined
    current = edge.to
  }
  const standing = atMs < settledAt(config) + LANDING_MS
  return { visited, cycles, cursor, current: standing ? current : '', foundAt }
}

/**
 * Draw every edge, the ones that closed a cycle lit.
 *
 * @param config - The walk as the scene configured it.
 * @param geometries - Each edge's curve.
 * @param state - Where the walk stands.
 * @param metrics - The measurements this profile is drawn at.
 * @param theme - The visual tokens this variant is drawn with.
 * @param atMs - Offset from the start of the timeline.
 * @returns SVG markup for the edges, their labels, arrowheads and badges.
 */
function renderEdges(
  config: GraphConfig,
  geometries: readonly (EdgeGeometry | undefined)[],
  state: WalkState,
  metrics: GraphMetrics,
  theme: MediaTheme,
  atMs: number
): string {
  return config.edges
    .map((edge, index) => {
      const geometry = geometries[index]
      if (geometry === undefined) {
        return ''
      }
      const found = state.cycles.findIndex((step) => step.edge === index)
      const lit = found >= 0
      const reveal = lit ? easeOut(progress(atMs, state.foundAt[found] ?? 0, 420)) : 0
      const colour = lit ? theme.tones.warning : theme.border
      const width = lit ? 2 + reveal : 1.6
      const dash = edge.bow === undefined || edge.bow === 0 || lit ? '' : ` stroke-dasharray="4 4"`
      const angle = arrivalAngle(geometry)
      const head = `<path d="M -7 -4 L 0 0 L -7 4" fill="none" stroke="${colour}" stroke-width="${width.toFixed(2)}" transform="translate(${geometry.end.x.toFixed(1)} ${geometry.end.y.toFixed(1)}) rotate(${angle})"/>`
      const labelX = geometry.middle.x + geometry.normal.x * (metrics.edgePx + 2)
      const labelY = geometry.middle.y + geometry.normal.y * (metrics.edgePx + 2)
      const label = `<text x="${labelX.toFixed(1)}" y="${labelY.toFixed(1)}" class="gr-edge-label${lit ? ' gr-edge-label--lit' : ''}" text-anchor="middle" dominant-baseline="middle">${escapeHtml(edge.label)}</text>`
      // why: a found cycle gets its number where the arc is widest, which is the one place on a back edge that is not over another edge
      const badge = lit
        ? `<g transform="translate(${(geometry.middle.x + geometry.normal.x * (metrics.edgePx + metrics.badgePx + 12)).toFixed(1)} ${(geometry.middle.y + geometry.normal.y * (metrics.edgePx + metrics.badgePx + 12)).toFixed(1)}) scale(${(0.6 + 0.4 * reveal).toFixed(3)})" opacity="${reveal.toFixed(3)}"><circle r="${metrics.badgePx}" fill="${theme.tones.warning}"/><text class="gr-badge" text-anchor="middle" dominant-baseline="central">${found + 1}</text></g>`
        : ''
      return `<path d="${geometry.d}" fill="none" stroke="${colour}" stroke-width="${width.toFixed(2)}"${dash} stroke-linecap="round"/>${head}${label}${badge}`
    })
    .join('')
}

/**
 * Draw every node, visited ones filled and the one just reached again flashing.
 *
 * @param config - The walk as the scene configured it.
 * @param state - Where the walk stands.
 * @param metrics - The measurements this profile is drawn at.
 * @param theme - The visual tokens this variant is drawn with.
 * @param atMs - Offset from the start of the timeline.
 * @returns SVG markup for the nodes.
 */
function renderNodes(config: GraphConfig, state: WalkState, metrics: GraphMetrics, theme: MediaTheme, atMs: number): string {
  return config.nodes
    .map((node) => {
      const visited = state.visited.includes(node.id)
      const flash = state.cycles.reduce((strongest, step, index) => {
        const edge = config.edges[step.edge]
        return edge !== undefined && edge.to === node.id ? max(strongest, pulse(atMs, state.foundAt[index] ?? 0, FLASH_MS)) : strongest
      }, 0)
      const standing = state.current === node.id ? 1 : 0
      const ring = flash > 0 ? theme.tones.warning : visited ? theme.accent : theme.border
      const ringWidth = 1.6 + 1.4 * max(flash, standing * 0.6)
      const fill = visited ? theme.accentSoft : theme.surface
      const halo =
        flash > 0
          ? `<circle cx="${node.x}" cy="${node.y}" r="${(metrics.radiusPx + 6 + 8 * flash).toFixed(1)}" fill="none" stroke="${theme.tones.warning}" stroke-width="1.5" opacity="${(0.5 * flash).toFixed(3)}"/>`
          : ''
      return `${halo}<circle cx="${node.x}" cy="${node.y}" r="${metrics.radiusPx}" fill="${fill}" stroke="${ring}" stroke-width="${ringWidth.toFixed(2)}"/><text x="${node.x}" y="${node.y}" class="gr-node-label${visited ? ' gr-node-label--visited' : ''}" text-anchor="middle" dominant-baseline="central">${escapeHtml(node.label)}</text>`
    })
    .join('')
}

/**
 * Build the stylesheet for one graph, with its theme resolved into it.
 *
 * @param config - The walk as the scene configured it.
 * @param profile - The presentation target being composed for.
 * @param theme - The visual tokens this variant is drawn with.
 * @returns CSS for this graph.
 */
function graphStyles(config: GraphConfig, profile: MediaProfile, theme: MediaTheme): string {
  const metrics = graphMetrics(profile)
  return `
${apiChipStyles(theme, metrics.chipPx)}
.gr-frame { position: absolute; inset: 0; }
.gr-svg { position: absolute; inset: 0; width: ${profile.width}px; height: ${profile.height}px; overflow: visible; }
.gr-head { position: absolute; left: ${metrics.insetPx}px; top: ${metrics.insetPx}px; display: flex; align-items: center; gap: ${round(metrics.chipPx * 0.7)}px; }
.gr-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: ${round(metrics.chipPx * 1.7)}px;
  height: ${round(metrics.chipPx * 1.7)}px;
  padding: 0 ${round(metrics.chipPx * 0.45)}px;
  border-radius: 999px;
  background: ${theme.tones.warning};
  color: ${theme.transparent ? theme.plate : '#ffffff'};
  font-family: ${theme.fonts.mono};
  font-size: ${metrics.chipPx}px;
  font-weight: 700;
}
.gr-node-label { font-family: ${theme.fonts.mono}; font-size: ${metrics.labelPx}px; fill: ${theme.text.muted}; }
.gr-node-label--visited { fill: ${theme.text.strong}; font-weight: 600; }
.gr-edge-label { font-family: ${theme.fonts.mono}; font-size: ${metrics.edgePx}px; fill: ${theme.text.muted}; }
.gr-edge-label--lit { fill: ${theme.tones.warning}; font-weight: 600; }
.gr-badge { font-family: ${theme.fonts.mono}; font-size: ${round(metrics.badgePx * 1.25)}px; font-weight: 700; fill: ${theme.transparent ? theme.plate : '#ffffff'}; }
`
}

/**
 * An object graph walked to its leaves, and the edges that point back into it.
 *
 * Nodes sit in a row with the forward references between them; the back
 * references are arcs, dashed until the walk finds them. A cursor walks the
 * graph depth first, filling each node it reaches; when it follows an arc
 * onto a node it has already filled, the arc lights, a number lands on it,
 * the count beside the call ticks up, and the cursor comes back to carry on.
 * The three lit arcs at the end are the call's return value, drawn rather
 * than printed.
 */
export const graphStage: Stage<GraphConfig> = defineStage<GraphConfig>({
  id: 'graph',

  styles: graphStyles,

  durationMs(config: GraphConfig): number {
    return settledAt(config) + (config.restMs ?? 1200)
  },

  frame({ config, profile, theme, atMs }): string {
    const metrics = graphMetrics(profile)
    const geometries = config.edges.map((edge) => edgeGeometry(edge, config.nodes, metrics.radiusPx))
    const state = walkAt(config, geometries, atMs)
    const cursor =
      state.cursor === undefined
        ? ''
        : `<circle cx="${state.cursor.x.toFixed(1)}" cy="${state.cursor.y.toFixed(1)}" r="${metrics.cursorPx * 2.2}" fill="${theme.accent}" opacity="0.18"/><circle cx="${state.cursor.x.toFixed(1)}" cy="${state.cursor.y.toFixed(1)}" r="${metrics.cursorPx}" fill="${theme.accent}"/>`
    const count = state.cycles.length === 0 ? '' : `<span class="gr-count">${state.cycles.length}</span>`
    return `<div class="gr-frame">
      <svg class="gr-svg" viewBox="0 0 ${profile.width} ${profile.height}" aria-hidden="true">
        ${renderEdges(config, geometries, state, metrics, theme, atMs)}
        ${renderNodes(config, state, metrics, theme, atMs)}
        ${cursor}
      </svg>
      <div class="gr-head">${renderApiChip(config.api.name, config.api.mark)}${count}</div>
    </div>`
  },
})
