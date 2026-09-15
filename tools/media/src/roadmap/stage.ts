import type { MediaProfile } from '../models/profile'
import type { RoadmapConfig, RoadmapMilestone, RoadmapPlaceholderGroup } from '../models/roadmap'
import type { Stage } from '../models/stage'
import type { MediaTheme } from '../models/theme'
import { renderMarkAt } from '../banner/mark'
import { escapeHtml } from '../lib/escape-html'
import { defineStage } from '../stage/define-stage'
import { figureMetrics, figureStyles, renderLines } from '../stage/figure'

/** Side of a placeholder tile in the map. */
const GHOST_PX = 14

/** Gap between placeholder tiles. */
const GHOST_GAP = 5

/** Side of a shipped tile under the line. */
const TILE_PX = 28

/** Distance between the line and the nearest row of shipped tiles. */
const DEPTH_PX = 46

/** Days in each month of a common year. */
const MONTH_DAYS: readonly number[] = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]

/** Where everything in the figure sits. */
interface RoadmapLayout {
  /** Left end of the line. */
  axisLeft: number
  /** Right end of the line. */
  axisRight: number
  /** Vertical position of the line. */
  lineY: number
  /** Day of the year the line begins on. */
  firstDay: number
  /** Day of the year the line ends on. */
  lastDay: number
}

/**
 * The day of the year a date falls on, counting from zero.
 *
 * @param date - A day as `YYYY-MM-DD`.
 * @returns Days since the first of January.
 */
function dayOfYear(date: string): number {
  const [, month = '1', day = '1'] = date.split('-')
  let days = Number(day) - 1
  for (let index = 0; index < Number(month) - 1; index += 1) {
    days += MONTH_DAYS[index] ?? 30
  }
  return days
}

/**
 * Lay the figure out for one profile.
 *
 * @param config - The year as the scene configured it.
 * @param profile - The presentation target being composed for.
 * @returns Every position the renderer needs.
 */
function roadmapLayout(config: RoadmapConfig, profile: MediaProfile): RoadmapLayout {
  const metrics = figureMetrics(profile)
  return {
    axisLeft: metrics.insetPx + 24,
    axisRight: profile.width - metrics.insetPx,
    lineY: 226,
    firstDay: dayOfYear(config.axisStart),
    lastDay: dayOfYear(config.axisEnd),
  }
}

/**
 * Where a date falls on the line.
 *
 * @param layout - Where everything sits.
 * @param date - A day as `YYYY-MM-DD`.
 * @returns Horizontal position.
 */
function dateX(layout: RoadmapLayout, date: string): number {
  const t = (dayOfYear(date) - layout.firstDay) / (layout.lastDay - layout.firstDay)
  return layout.axisLeft + t * (layout.axisRight - layout.axisLeft)
}

/**
 * Draw the line, with a mark at each month and the month's name under it.
 *
 * @param config - The year as the scene configured it.
 * @param layout - Where everything sits.
 * @returns SVG markup for the line.
 */
function renderAxis(config: RoadmapConfig, layout: RoadmapLayout): string {
  const year = config.axisStart.slice(0, 4)
  const marks = config.months
    .map((name, index) => {
      const startX = dateX(layout, `${year}-${`${index + 1}`.padStart(2, '0')}-01`)
      const middle = startX + ((MONTH_DAYS[index] ?? 30) / 2 / (layout.lastDay - layout.firstDay)) * (layout.axisRight - layout.axisLeft)
      const tick =
        index === 0
          ? ''
          : `<line class="fig-rule" x1="${startX.toFixed(1)}" y1="${layout.lineY - 4}" x2="${startX.toFixed(1)}" y2="${layout.lineY + 4}"/>`
      return `${tick}<text class="fig-mono rm-month" x="${middle.toFixed(1)}" y="${layout.lineY + 17}" text-anchor="middle">${escapeHtml(name)}</text>`
    })
    .join('')
  return `<line class="rm-axis" x1="${layout.axisLeft}" y1="${layout.lineY}" x2="${layout.axisRight}" y2="${layout.lineY}"/>${marks}`
}

/**
 * Draw the map: rows of empty tiles over the day the root declared them.
 *
 * @param config - The year as the scene configured it.
 * @param layout - Where everything sits.
 * @param theme - The visual tokens this variant is drawn with.
 * @param notePx - Font size of the row labels.
 * @returns SVG markup for the cluster and its leader down to the line.
 */
function renderMap(config: RoadmapConfig, layout: RoadmapLayout, theme: MediaTheme, notePx: number): string {
  const x = dateX(layout, config.map.date)
  // why: the first column of tiles sits over the day itself, so the leader down to the line hangs from the cluster rather than beside it
  const left = x - GHOST_PX / 2
  const top = 60
  const rowStep = GHOST_PX + 8
  const rows = config.map.groups
    .map((group: RoadmapPlaceholderGroup, row) => {
      const y = top + 42 + row * rowStep
      const tiles: string[] = []
      for (let index = 0; index < group.count; index += 1) {
        const x = left + index * (GHOST_PX + GHOST_GAP)
        tiles.push(`<rect class="rm-ghost" x="${x}" y="${y}" width="${GHOST_PX}" height="${GHOST_PX}" rx="3"/>`)
        if (group.mark !== undefined) {
          tiles.push(renderMarkAt(group.mark, x + GHOST_PX / 2, y + GHOST_PX / 2, GHOST_PX - 4, theme.text.faint))
        }
      }
      const widest = left + 6 * (GHOST_PX + GHOST_GAP) + 6
      return `${tiles.join('')}<text class="fig-note" x="${widest}" y="${y + GHOST_PX / 2 + notePx * 0.36}">${escapeHtml(group.label)}</text>`
    })
    .join('')
  const bottom = top + 42 + config.map.groups.length * rowStep - 4
  return `
    <text class="fig-caps" x="${left}" y="${top}">${escapeHtml(config.map.caption)}</text>
    <text class="fig-plain" x="${left}" y="${top + 20}">${escapeHtml(config.map.note)}</text>
    ${rows}
    <line class="rm-leader" x1="${x.toFixed(1)}" y1="${bottom}" x2="${x.toFixed(1)}" y2="${layout.lineY - 8}"/>
    <circle cx="${x.toFixed(1)}" cy="${layout.lineY}" r="5" fill="${theme.accent}"/>`
}

/**
 * Draw the band a stretch of the year is labelled with, sitting on the line.
 *
 * @param config - The year as the scene configured it.
 * @param layout - Where everything sits.
 * @returns SVG markup for the band.
 */
function renderSpan(config: RoadmapConfig, layout: RoadmapLayout): string {
  const from = dateX(layout, config.span.from)
  const to = dateX(layout, config.span.to)
  const y = layout.lineY - 34
  return `
    <rect class="fig-card--soft" x="${from.toFixed(1)}" y="${y}" width="${(to - from).toFixed(1)}" height="26" rx="6"/>
    <text class="fig-note rm-span" x="${((from + to) / 2).toFixed(1)}" y="${y + 17}" text-anchor="middle">${escapeHtml(config.span.label)}</text>`
}

/**
 * Draw one shipped thing: a dot on the line, a leader down, a tile and its
 * label.
 *
 * @param milestone - What shipped.
 * @param layout - Where everything sits.
 * @param theme - The visual tokens this variant is drawn with.
 * @param labelPx - Font size of the label under the tile.
 * @returns SVG markup for the milestone.
 */
function renderMilestone(milestone: RoadmapMilestone, layout: RoadmapLayout, theme: MediaTheme, labelPx: number): string {
  const x = dateX(layout, milestone.date)
  const top = layout.lineY + DEPTH_PX + (milestone.depth - 1) * (TILE_PX + labelPx * 2 + 24)
  const mark = milestone.mark === undefined ? '' : renderMarkAt(milestone.mark, x, top + TILE_PX / 2, TILE_PX - 8, theme.accent)
  return `
    <line class="rm-leader" x1="${x.toFixed(1)}" y1="${layout.lineY + 6}" x2="${x.toFixed(1)}" y2="${top - 3}"/>
    <circle cx="${x.toFixed(1)}" cy="${layout.lineY}" r="4" fill="${theme.accent}"/>
    <rect class="rm-tile" x="${(x - TILE_PX / 2).toFixed(1)}" y="${top}" width="${TILE_PX}" height="${TILE_PX}" rx="6"/>
    ${mark}
    <text class="fig-mono fig-mono--accent" x="${x.toFixed(1)}" y="${top + TILE_PX + 15}" text-anchor="middle">${escapeHtml(milestone.when)}</text>
    <text class="fig-label" x="${x.toFixed(1)}" y="${top + TILE_PX + 15 + labelPx + 3}" text-anchor="middle">${escapeHtml(milestone.label)}</text>`
}

/**
 * Draw the first commits as faint stubs under the line, labelled once.
 *
 * @param config - The year as the scene configured it.
 * @param layout - Where everything sits.
 * @param notePx - Font size of the label.
 * @returns SVG markup for the stubs.
 */
function renderRoots(config: RoadmapConfig, layout: RoadmapLayout, notePx: number): string {
  const seen: number[] = []
  const stubs = config.roots.dates
    .map((date) => {
      // why: two roots on one day would draw one stub; each is nudged past the ones already on that x so all four are counted
      const base = dateX(layout, date)
      const clashes = seen.filter((x) => x === base).length
      seen.push(base)
      const x = base + clashes * 4
      return `<line class="rm-root" x1="${x.toFixed(1)}" y1="${layout.lineY + 26}" x2="${x.toFixed(1)}" y2="${layout.lineY + 52}"/><circle class="rm-root-dot" cx="${x.toFixed(1)}" cy="${layout.lineY + 55}" r="2.5"/>`
    })
    .join('')
  return `${stubs}${renderLines([config.roots.label, config.roots.note], layout.axisLeft, layout.lineY + 78, 'fig-note', notePx + 4)}`
}

/**
 * Build the stylesheet for the figure, with its theme resolved into it.
 *
 * @param config - The year as the scene configured it.
 * @param profile - The presentation target being composed for.
 * @param theme - The visual tokens this variant is drawn with.
 * @returns CSS for this figure.
 */
function roadmapStyles(config: RoadmapConfig, profile: MediaProfile, theme: MediaTheme): string {
  const metrics = figureMetrics(profile)
  return `
${figureStyles(theme, metrics)}
.rm-axis { stroke: ${theme.text.faint}; stroke-width: 1.5; stroke-linecap: round; }
.rm-month { fill: ${theme.text.faint}; }
.rm-ghost { fill: none; stroke: ${theme.text.faint}; stroke-width: 1.2; stroke-dasharray: 3 2.5; }
.rm-leader { stroke: ${theme.border}; stroke-width: 1.2; }
.rm-tile { fill: ${theme.surfaceRaised}; stroke: ${theme.accent}; stroke-width: 1.6; }
.rm-root { stroke: ${theme.text.faint}; stroke-width: 1.2; stroke-dasharray: 2 3; }
.rm-root-dot { fill: none; stroke: ${theme.text.faint}; stroke-width: 1.2; }
.rm-span { fill: ${theme.tones.accent}; font-weight: 600; }
`
}

/**
 * One year on one line: the map above it, the road below.
 *
 * The repository's first day declared every slot it would later fill, drawn
 * here as rows of empty tiles over that day. The libraries and tooling that
 * filled the spring are a band along the line. What actually shipped hangs
 * under the line on the day it did, each a solid tile, and the several first
 * commits are faint stubs beside the start with no cause attached to them.
 */
export const roadmapStage: Stage<RoadmapConfig> = defineStage<RoadmapConfig>({
  id: 'roadmap',

  styles: roadmapStyles,

  durationMs(): number {
    return 0
  },

  frame({ config, profile, theme }): string {
    const metrics = figureMetrics(profile)
    const layout = roadmapLayout(config, profile)
    const milestones = config.milestones.map((milestone) => renderMilestone(milestone, layout, theme, metrics.labelPx)).join('')
    const roadCaption = `<text class="fig-caps" x="${layout.axisRight}" y="60" text-anchor="end">${escapeHtml(config.roadCaption)}</text><text class="fig-plain" x="${layout.axisRight}" y="80" text-anchor="end">${escapeHtml(config.roadNote)}</text>`
    return `<div class="fig-frame">
      <svg class="fig-svg" viewBox="0 0 ${profile.width} ${profile.height}" width="${profile.width}" height="${profile.height}" aria-hidden="true">
        ${renderSpan(config, layout)}
        ${renderAxis(config, layout)}
        ${renderMap(config, layout, theme, metrics.notePx)}
        ${renderRoots(config, layout, metrics.notePx)}
        ${milestones}
        ${roadCaption}
      </svg>
    </div>`
  },
})
