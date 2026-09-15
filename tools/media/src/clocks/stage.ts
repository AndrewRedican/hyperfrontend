import type { ClocksConfig, ClockSpan } from '../models/clocks'
import type { MediaProfile } from '../models/profile'
import type { Stage } from '../models/stage'
import type { MediaTheme } from '../models/theme'
import type { Point } from '../stage/geometry'
import { floor, round } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'
import { renderMarkAt } from '../banner/mark'
import { escapeHtml } from '../lib/escape-html'
import { defineStage } from '../stage/define-stage'
import { figureMetrics, figureStyles } from '../stage/figure'

/** Radius of the node the spans converge on. */
const NODE_RADIUS = 30

/** Radius of the dot at the start of a span. */
const START_RADIUS = 5

/** Height of a ruler mark along a span. */
const TICK_PX = 7

/** Where everything in the figure sits. */
interface ClocksLayout {
  /** Left end of the shared axis. */
  axisLeft: number
  /** Right end of the shared axis, where the spans leave it to converge. */
  axisRight: number
  /** Vertical position of each span, top to bottom. */
  rows: readonly number[]
  /** Centre of the node the spans converge on. */
  node: Point
  /** Vertical position of the ruler at the foot of the figure. */
  rulerY: number
}

/**
 * Lay the figure out for one profile.
 *
 * The axis takes the left three quarters of the frame and the node the spans
 * converge on sits in the remaining quarter, level with the middle span. The
 * ruler runs under everything, on the same axis, so the year a span starts in
 * can be read straight down from its dot.
 *
 * @param config - The spans as the scene configured them.
 * @param profile - The presentation target being composed for.
 * @returns Every position the renderer needs.
 */
function clocksLayout(config: ClocksConfig, profile: MediaProfile): ClocksLayout {
  const metrics = figureMetrics(profile)
  const axisLeft = metrics.insetPx + 24
  const axisRight = round(profile.width * 0.78)
  const rulerY = profile.height - metrics.insetPx - 30
  const rowGap = 92
  const middle = round((rulerY - 40 + metrics.insetPx) / 2)
  const rows = config.spans.map((_, index) => middle + (index - (config.spans.length - 1) / 2) * rowGap)
  return {
    axisLeft,
    axisRight,
    rows,
    node: { x: profile.width - metrics.insetPx - NODE_RADIUS - 24, y: middle },
    rulerY,
  }
}

/**
 * Where a decimal year falls on the axis.
 *
 * @param config - The spans as the scene configured them.
 * @param layout - Where everything sits.
 * @param year - A decimal year.
 * @returns Horizontal position.
 */
function yearX(config: ClocksConfig, layout: ClocksLayout, year: number): number {
  const t = (year - config.axisStart) / (config.axisEnd - config.axisStart)
  return layout.axisLeft + t * (layout.axisRight - layout.axisLeft)
}

/**
 * Draw one span: its line, its ruler marks, its start, its labels and the
 * curve that carries it into the node.
 *
 * @param span - The span being drawn.
 * @param y - Its vertical position.
 * @param config - The spans as the scene configured them.
 * @param layout - Where everything sits.
 * @param theme - The visual tokens this variant is drawn with.
 * @param lineHeightPx - How far under the line the label sits.
 * @returns SVG markup for the span.
 */
function renderSpan(
  span: ClockSpan,
  y: number,
  config: ClocksConfig,
  layout: ClocksLayout,
  theme: MediaTheme,
  lineHeightPx: number
): string {
  const startX = yearX(config, layout, span.start)
  const ticks: string[] = []
  const count = floor((config.axisEnd - span.start) / span.tickYears)
  for (let index = 1; index <= count; index += 1) {
    const x = yearX(config, layout, span.start + index * span.tickYears)
    ticks.push(
      `<line x1="${x.toFixed(1)}" y1="${(y - TICK_PX / 2).toFixed(1)}" x2="${x.toFixed(1)}" y2="${(y + TICK_PX / 2).toFixed(1)}"/>`
    )
  }
  const nodeEdge = layout.node.x - NODE_RADIUS
  const reach = (nodeEdge - layout.axisRight) * 0.6
  const curve = `M ${layout.axisRight.toFixed(1)} ${y.toFixed(1)} C ${(layout.axisRight + reach).toFixed(1)} ${y.toFixed(1)}, ${(nodeEdge - reach).toFixed(1)} ${layout.node.y.toFixed(1)}, ${nodeEdge.toFixed(1)} ${layout.node.y.toFixed(1)}`
  const anchor = span.align
  const labelX = anchor === 'start' ? startX + START_RADIUS + 10 : startX - START_RADIUS - 10
  return `
    <g class="ck-span">
      <line class="ck-line" x1="${startX.toFixed(1)}" y1="${y}" x2="${layout.axisRight}" y2="${y}"/>
      <path class="ck-line" d="${curve}"/>
      <g class="ck-ticks">${ticks.join('')}</g>
      <circle cx="${startX.toFixed(1)}" cy="${y}" r="${START_RADIUS * 2.6}" fill="${theme.accentSoft}"/>
      <circle cx="${startX.toFixed(1)}" cy="${y}" r="${START_RADIUS}" fill="${theme.accent}"/>
      <text class="ck-duration" x="${labelX.toFixed(1)}" y="${(y - 9).toFixed(1)}" text-anchor="${anchor}">${escapeHtml(span.duration)}</text>
      <text class="fig-note" x="${labelX.toFixed(1)}" y="${(y + lineHeightPx + 2).toFixed(1)}" text-anchor="${anchor}">${escapeHtml(span.label)}</text>
    </g>`
}

/**
 * Draw the ruler at the foot of the figure.
 *
 * @param config - The spans as the scene configured them.
 * @param layout - Where everything sits.
 * @returns SVG markup for the ruler.
 */
function renderRuler(config: ClocksConfig, layout: ClocksLayout): string {
  const marks = config.rulerYears
    .map((year) => {
      const x = yearX(config, layout, year)
      return `<line class="fig-rule" x1="${x.toFixed(1)}" y1="${layout.rulerY - 5}" x2="${x.toFixed(1)}" y2="${layout.rulerY + 5}"/><text class="fig-mono" x="${x.toFixed(1)}" y="${layout.rulerY + 22}" text-anchor="middle">${year}</text>`
    })
    .join('')
  return `<line class="fig-rule" x1="${layout.axisLeft}" y1="${layout.rulerY}" x2="${layout.axisRight}" y2="${layout.rulerY}"/>${marks}`
}

/**
 * Build the stylesheet for the figure, with its theme resolved into it.
 *
 * @param config - The spans as the scene configured them.
 * @param profile - The presentation target being composed for.
 * @param theme - The visual tokens this variant is drawn with.
 * @returns CSS for this figure.
 */
function clocksStyles(config: ClocksConfig, profile: MediaProfile, theme: MediaTheme): string {
  const metrics = figureMetrics(profile)
  return `
${figureStyles(theme, metrics)}
.ck-line { stroke: ${theme.accent}; stroke-width: 2; fill: none; stroke-linecap: round; opacity: 0.75; }
.ck-ticks line { stroke: ${theme.text.faint}; stroke-width: 1; }
.ck-duration { font-size: ${metrics.titlePx}px; font-weight: 700; fill: ${theme.text.strong}; letter-spacing: -0.01em; }
.ck-node { fill: ${theme.surfaceRaised}; stroke: ${theme.accent}; stroke-width: 2; }
`
}

/**
 * Three timescales converging on one point.
 *
 * Each span is a line along one shared axis, starting where its story starts
 * and running to the moment they all share; ruler marks along it count its
 * years or its months, so the longest span is the one with the most marks
 * and the shortest is a fine comb near the end. All three bend into one node
 * at the right. Nothing moves: the figure is the lengths, read side by side.
 */
export const clocksStage: Stage<ClocksConfig> = defineStage<ClocksConfig>({
  id: 'clocks',

  styles: clocksStyles,

  durationMs(): number {
    return 0
  },

  frame({ config, profile, theme }): string {
    const metrics = figureMetrics(profile)
    const layout = clocksLayout(config, profile)
    const spans = config.spans
      .map((span, index) => renderSpan(span, layout.rows[index] ?? layout.node.y, config, layout, theme, metrics.notePx + 6))
      .join('')
    const node = `
      <circle class="ck-node" cx="${layout.node.x}" cy="${layout.node.y}" r="${NODE_RADIUS}"/>
      ${renderMarkAt(config.mark, layout.node.x, layout.node.y, 30, theme.accent)}
      <text class="fig-label" x="${layout.node.x}" y="${layout.node.y + NODE_RADIUS + 22}" text-anchor="middle">${escapeHtml(config.target)}</text>
      <text class="fig-note" x="${layout.node.x}" y="${layout.node.y + NODE_RADIUS + 22 + metrics.notePx + 5}" text-anchor="middle">${escapeHtml(config.targetNote)}</text>`
    return `<div class="fig-frame">
      <svg class="fig-svg" viewBox="0 0 ${profile.width} ${profile.height}" width="${profile.width}" height="${profile.height}" aria-hidden="true">
        ${renderRuler(config, layout)}
        ${spans}
        ${node}
      </svg>
    </div>`
  },
})
