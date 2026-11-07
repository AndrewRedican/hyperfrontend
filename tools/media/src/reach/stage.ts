import type { MediaProfile } from '../models/profile'
import type { ReachConfig, ReachEdge, ReachNode } from '../models/reach'
import type { Stage } from '../models/stage'
import type { MediaTheme } from '../models/theme'
import type { Point } from '../stage/geometry'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { abs, max, round } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { escapeHtml } from '../lib/escape-html'
import { clamp01, easeInOut, easeOut, lerp, progress, pulse } from '../lib/motion'
import { apiChipStyles, renderApiChip, renderForeignLabel } from '../stage/api-chip'
import { defineStage } from '../stage/define-stage'

/** How far along a type-only edge the change gets before it has faded away. */
const TYPE_ONLY_REACH = 0.55

/** How long the glow on a task that has just lit lasts. */
const LIGHT_MS = 700

/** How long the changed file's flash lasts. */
const CHANGE_MS = 900

/** Width past which the frame is drawn at its full density. */
const WIDE_ENOUGH = 800

/** How the frame is sized for the surface it is being drawn for. */
interface ReachMetrics {
  /** Margin between the drawing and the edge of the frame. */
  insetPx: number
  /** Width of a tile. */
  tileW: number
  /** Height of a tile. */
  tileH: number
  /** Font size of a project's name. */
  labelPx: number
  /** Font size of the task pill. */
  taskPx: number
  /** Font size of the API chip. */
  chipPx: number
  /** Radius of the travelling change. */
  dotPx: number
  /** Font size of the caption. */
  captionPx: number
}

/** An edge resolved to the segment drawn for it, rim to rim. */
interface Segment {
  /** Where it leaves the imported project's tile. */
  start: Point
  /** Where it meets the importer's tile. */
  end: Point
}

/** One change on its way along an edge. */
interface Travelling {
  /** Index of the edge it travels. */
  edge: number
  /** How far along it is, from 0 to 1. */
  t: number
  /** How visible it is: 1 while it carries, fading to 0 along a type-only edge. */
  opacity: number
}

/** The caption in force at one instant. */
interface ShownCaption {
  /** What it says. */
  text: string
  /** How far it has faded in, from 0 to 1. */
  opacity: number
}

/** Where the ripple stands at one instant. */
interface ReachState {
  /** Projects whose task has lit, with the moment each lit. */
  lit: ReadonlyMap<string, number>
  /** Indices of the edges the change has arrived along. */
  carried: ReadonlySet<number>
  /** The changes on their way. */
  travelling: readonly Travelling[]
  /** Whether the changed file has been marked. */
  changed: boolean
}

/**
 * Size the frame for the surface it is being drawn for.
 *
 * @param profile - The presentation target being composed for.
 * @returns Every measurement the renderer needs.
 */
function reachMetrics(profile: MediaProfile): ReachMetrics {
  const wide = profile.width >= WIDE_ENOUGH
  return {
    insetPx: wide ? 28 : 18,
    tileW: wide ? 150 : 118,
    tileH: wide ? 78 : 62,
    labelPx: wide ? 14.5 : 13,
    taskPx: wide ? 11.5 : 10.5,
    chipPx: wide ? 13 : 12,
    dotPx: wide ? 7 : 6,
    captionPx: wide ? 14 : 12.5,
  }
}

/**
 * Where a straight line from one tile's centre to another's leaves the first tile's border.
 *
 * @param from - The tile the line leaves.
 * @param towards - The tile it heads for.
 * @param metrics - The measurements this profile is drawn at.
 * @returns The point on the rim of `from`.
 */
function rimPoint(from: ReachNode, towards: ReachNode, metrics: ReachMetrics): Point {
  const dx = towards.x - from.x
  const dy = towards.y - from.y
  const halfW = metrics.tileW / 2
  const halfH = metrics.tileH / 2
  // why: the line meets whichever side of the rectangle it reaches first, which is the side the ratio of the offsets picks
  const scale = max(1e-6, max(abs(dx) / halfW, abs(dy) / halfH))
  return { x: from.x + dx / scale, y: from.y + dy / scale }
}

/**
 * Resolve every edge to the segment drawn for it.
 *
 * @param config - The graph as the scene configured it.
 * @param metrics - The measurements this profile is drawn at.
 * @returns One segment per edge, undefined where an end names no node.
 */
function segmentsOf(config: ReachConfig, metrics: ReachMetrics): readonly (Segment | undefined)[] {
  return config.edges.map((edge) => {
    const from = config.nodes.find((node) => node.id === edge.from)
    const to = config.nodes.find((node) => node.id === edge.to)
    if (from === undefined || to === undefined) {
      return undefined
    }
    return { start: rimPoint(from, to, metrics), end: rimPoint(to, from, metrics) }
  })
}

/**
 * When the ripple has settled.
 *
 * @param config - The graph as the scene configured it.
 * @returns The offset at which the last change has arrived or faded.
 */
function settledAt(config: ReachConfig): number {
  let latest = config.changeAtMs
  for (const step of config.steps) {
    latest = max(latest, step.atMs + config.travelMs)
  }
  return latest
}

/**
 * Work out where the ripple stands at one instant.
 *
 * Nothing is remembered between frames: which tasks have lit and where each
 * change is are read out of the steps and the moment asked for, which is what
 * lets the same scene record identically anywhere.
 *
 * @param config - The graph as the scene configured it.
 * @param atMs - Offset from the start of the timeline.
 * @returns The state to draw.
 */
function reachAt(config: ReachConfig, atMs: number): ReachState {
  const lit = createMap<string, number>()
  const carried = createSet<number>()
  const travelling: Travelling[] = []
  for (const step of config.steps) {
    const edge: ReachEdge | undefined = config.edges[step.edge]
    if (edge === undefined || atMs < step.atMs) {
      continue
    }
    const arrived = step.atMs + config.travelMs
    if (edge.typeOnly === true) {
      // why: a type-only import is stripped before the task runs, so the change gets part of the way and is gone
      const t = easeOut(progress(atMs, step.atMs, config.travelMs)) * TYPE_ONLY_REACH
      const opacity = 1 - clamp01(progress(atMs, step.atMs + config.travelMs * 0.35, config.travelMs * 0.55))
      if (opacity > 0) {
        travelling.push({ edge: step.edge, t, opacity })
      }
      continue
    }
    if (atMs < arrived) {
      travelling.push({ edge: step.edge, t: easeInOut(progress(atMs, step.atMs, config.travelMs)), opacity: 1 })
      continue
    }
    carried.add(step.edge)
    if (!lit.has(edge.to)) {
      lit.set(edge.to, arrived)
    }
  }
  return { lit, carried, travelling, changed: atMs >= config.changeAtMs }
}

/**
 * Draw every edge, dashed where the import is type-only, and the changes travelling along them.
 *
 * @param config - The graph as the scene configured it.
 * @param segments - Each edge's segment.
 * @param state - Where the ripple stands.
 * @param metrics - The measurements this profile is drawn at.
 * @param theme - The visual tokens this variant is drawn with.
 * @returns SVG markup for the edges and the travelling changes.
 */
function renderEdges(
  config: ReachConfig,
  segments: readonly (Segment | undefined)[],
  state: ReachState,
  metrics: ReachMetrics,
  theme: MediaTheme
): string {
  const lines = config.edges
    .map((edge, index) => {
      const segment = segments[index]
      if (segment === undefined) {
        return ''
      }
      const carried = state.carried.has(index)
      // why: a type-only import is dashed and a spec's import dotted, so the two rules the ripple shows read apart without a legend
      const dash = edge.typeOnly === true ? ' stroke-dasharray="6 5"' : edge.fromSpec === true ? ' stroke-dasharray="1.5 4.5"' : ''
      const colour = carried ? theme.accent : theme.border
      return `<line x1="${segment.start.x.toFixed(1)}" y1="${segment.start.y.toFixed(1)}" x2="${segment.end.x.toFixed(1)}" y2="${segment.end.y.toFixed(1)}" stroke="${colour}" stroke-width="${carried ? 2.2 : 1.6}"${dash} stroke-linecap="round"/>`
    })
    .join('')
  const dots = state.travelling
    .map((change) => {
      const segment = segments[change.edge]
      if (segment === undefined) {
        return ''
      }
      const x = lerp(segment.start.x, segment.end.x, change.t)
      const y = lerp(segment.start.y, segment.end.y, change.t)
      // why: a short tail behind the dot says which way it is going without an arrowhead on the edge
      const tailT = max(0, change.t - 0.12)
      const tx = lerp(segment.start.x, segment.end.x, tailT)
      const ty = lerp(segment.start.y, segment.end.y, tailT)
      const opacity = change.opacity.toFixed(3)
      return `<line x1="${tx.toFixed(1)}" y1="${ty.toFixed(1)}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" stroke="${theme.accent}" stroke-width="${metrics.dotPx * 1.4}" stroke-linecap="round" opacity="${(change.opacity * 0.35).toFixed(3)}"/><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${metrics.dotPx * 2.2}" fill="${theme.accent}" opacity="${(change.opacity * 0.18).toFixed(3)}"/><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${metrics.dotPx}" fill="${theme.accent}" opacity="${opacity}"/>`
    })
    .join('')
  return lines + dots
}

/**
 * Draw every tile with its task, the lit ones filled and the changed one marked.
 *
 * @param config - The graph as the scene configured it.
 * @param state - Where the ripple stands.
 * @param metrics - The measurements this profile is drawn at.
 * @param theme - The visual tokens this variant is drawn with.
 * @param atMs - Offset from the start of the timeline.
 * @returns SVG markup for the tiles.
 */
function renderNodes(config: ReachConfig, state: ReachState, metrics: ReachMetrics, theme: MediaTheme, atMs: number): string {
  const halfW = metrics.tileW / 2
  const halfH = metrics.tileH / 2
  return config.nodes
    .map((node) => {
      const litAt = state.lit.get(node.id)
      const lit = litAt !== undefined
      const glow = lit ? pulse(atMs, litAt, LIGHT_MS) : 0
      const changed = state.changed && node.id === config.changed
      const flash = changed ? pulse(atMs, config.changeAtMs, CHANGE_MS) : 0
      const stroke = changed ? theme.tones.warning : lit ? theme.accent : theme.border
      const strokeWidth = (1.6 + 1.2 * max(glow, flash)).toFixed(2)
      const x = (node.x - halfW).toFixed(1)
      const y = (node.y - halfH).toFixed(1)
      const halo =
        glow > 0
          ? `<rect x="${(node.x - halfW - 5 - 6 * glow).toFixed(1)}" y="${(node.y - halfH - 5 - 6 * glow).toFixed(1)}" width="${(metrics.tileW + 10 + 12 * glow).toFixed(1)}" height="${(metrics.tileH + 10 + 12 * glow).toFixed(1)}" rx="14" fill="none" stroke="${theme.accent}" stroke-width="1.5" opacity="${(0.5 * glow).toFixed(3)}"/>`
          : ''
      // why: the changed file is one small mark inside its tile, so the eye finds where the ripple starts without a label saying so
      const file = changed
        ? `<circle cx="${(node.x + halfW - 12).toFixed(1)}" cy="${(node.y - halfH + 12).toFixed(1)}" r="${(3.2 + 2.5 * flash).toFixed(2)}" fill="${theme.tones.warning}"/><circle cx="${(node.x + halfW - 12).toFixed(1)}" cy="${(node.y - halfH + 12).toFixed(1)}" r="${(6 + 10 * flash).toFixed(1)}" fill="none" stroke="${theme.tones.warning}" stroke-width="1.2" opacity="${(0.6 * flash).toFixed(3)}"/>`
        : ''
      const pillW = round(metrics.taskPx * 0.62 * (config.task.length + 2) + 10)
      const pillH = round(metrics.taskPx * 1.7)
      const pillX = (node.x - pillW / 2).toFixed(1)
      const pillY = (node.y + 4).toFixed(1)
      const pill = `<rect x="${pillX}" y="${pillY}" width="${pillW}" height="${pillH}" rx="${pillH / 2}" fill="${lit ? theme.accent : theme.surfaceRaised}" stroke="${lit ? theme.accent : theme.border}" stroke-width="1"/><text x="${node.x}" y="${(node.y + 4 + pillH / 2).toFixed(1)}" class="re-task${lit ? ' re-task--lit' : ''}" text-anchor="middle" dominant-baseline="central">${escapeHtml(config.task)}</text>`
      return `${halo}<rect x="${x}" y="${y}" width="${metrics.tileW}" height="${metrics.tileH}" rx="10" fill="${lit ? theme.accentSoft : theme.surface}" stroke="${stroke}" stroke-width="${strokeWidth}"/><text x="${node.x}" y="${(node.y - halfH + metrics.labelPx + 8).toFixed(1)}" class="re-label${lit ? ' re-label--lit' : ''}" text-anchor="middle" dominant-baseline="central">${escapeHtml(node.label)}</text>${pill}${file}`
    })
    .join('')
}

/**
 * The caption in force at one instant, fading in as it arrives.
 *
 * @param config - The graph as the scene configured it.
 * @param atMs - Offset from the start of the timeline.
 * @returns The caption's text and opacity, or undefined before the first caption.
 */
function captionAt(config: ReachConfig, atMs: number): ShownCaption | undefined {
  let current: ShownCaption | undefined = undefined
  for (const caption of config.captions) {
    if (atMs >= caption.atMs) {
      current = { text: caption.text, opacity: easeOut(progress(atMs, caption.atMs, 320)) }
    }
  }
  return current
}

/**
 * Build the stylesheet for one frame, with its theme resolved into it.
 *
 * @param config - The graph as the scene configured it.
 * @param profile - The presentation target being composed for.
 * @param theme - The visual tokens this variant is drawn with.
 * @returns CSS for this stage.
 */
function reachStyles(config: ReachConfig, profile: MediaProfile, theme: MediaTheme): string {
  const metrics = reachMetrics(profile)
  return `
${apiChipStyles(theme, metrics.chipPx)}
.re-frame { position: absolute; inset: 0; }
.re-svg { position: absolute; inset: 0; width: ${profile.width}px; height: ${profile.height}px; overflow: visible; }
.re-head { position: absolute; left: ${metrics.insetPx}px; top: ${metrics.insetPx}px; display: flex; align-items: center; gap: ${round(metrics.chipPx * 0.7)}px; }
.re-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: ${round(metrics.chipPx * 1.7)}px;
  height: ${round(metrics.chipPx * 1.7)}px;
  padding: 0 ${round(metrics.chipPx * 0.45)}px;
  border-radius: 999px;
  background: ${theme.accent};
  color: ${theme.transparent ? theme.plate : '#ffffff'};
  font-family: ${theme.fonts.mono};
  font-size: ${metrics.chipPx}px;
  font-weight: 700;
}
.re-caption {
  position: absolute;
  left: ${metrics.insetPx}px;
  right: ${metrics.insetPx}px;
  bottom: ${metrics.insetPx}px;
  text-align: center;
  font-family: ${theme.fonts.sans};
  font-size: ${metrics.captionPx}px;
  line-height: 1.3;
  color: ${theme.text.plain};
}
.re-label { font-family: ${theme.fonts.mono}; font-size: ${metrics.labelPx}px; fill: ${theme.text.muted}; }
.re-label--lit { fill: ${theme.text.strong}; font-weight: 600; }
.re-task { font-family: ${theme.fonts.mono}; font-size: ${metrics.taskPx}px; fill: ${theme.text.muted}; }
.re-task--lit { fill: ${theme.surface}; font-weight: 700; }
`
}

/**
 * A change in one project, and the tasks it reaches.
 *
 * Projects sit as tiles with the edges of their imports between them, each
 * tile carrying the one task every project has. A file in one tile changes,
 * and the change sets off along every edge that leaves it: along a value
 * import, or an import a spec makes (dotted), it arrives, the importer's task
 * lights and the count beside the call ticks up, and it sets off again from
 * there; along a type-only import, drawn dashed, it fades before it arrives
 * and the task at the far end stays dark. One line of caption under the graph
 * names the rule each moment shows. The lit tasks at the end are the
 * selection, drawn rather than listed.
 */
export const reachStage: Stage<ReachConfig> = defineStage<ReachConfig>({
  id: 'reach',

  styles: reachStyles,

  durationMs(config: ReachConfig): number {
    return settledAt(config) + (config.restMs ?? 1600)
  },

  frame({ config, profile, theme, atMs }): string {
    const metrics = reachMetrics(profile)
    const segments = segmentsOf(config, metrics)
    const state = reachAt(config, atMs)
    const count = state.lit.size === 0 ? '' : `<span class="re-count">${state.lit.size}</span>`
    const caption = captionAt(config, atMs)
    const captionMarkup =
      caption === undefined
        ? ''
        : `<div class="re-caption" style="opacity: ${caption.opacity.toFixed(3)}">${escapeHtml(caption.text)}</div>`
    return `<div class="re-frame">
      <svg class="re-svg" viewBox="0 0 ${profile.width} ${profile.height}" aria-hidden="true">
        ${renderEdges(config, segments, state, metrics, theme)}
        ${renderNodes(config, state, metrics, theme, atMs)}
      </svg>
      <div class="re-head">${renderForeignLabel(config.command)}${renderApiChip(config.api.name, config.api.mark)}${count}</div>
      ${captionMarkup}
    </div>`
  },
})
