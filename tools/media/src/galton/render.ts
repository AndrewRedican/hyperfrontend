import type { GaltonBoard, GaltonConfig } from '../models/galton'
import type { MediaTheme } from '../models/theme'
import type { BoardGeometry, GaltonMetrics } from './layout'
import type { GrainState } from './timeline'
import { escapeHtml } from '../lib/escape-html'
import { renderApiChip } from '../stage/api-chip'
import { grainX } from './layout'

/** How far the fork's corners are rounded. */
const FORK_RADIUS = 4

/**
 * Draw one board: its two walls, its floor, and the values at the floor's ends.
 *
 * @param config - The scene's configuration.
 * @param geometry - Where the board sits.
 * @param metrics - The measurements this profile is drawn at.
 * @param theme - The visual tokens this variant is drawn with.
 * @returns SVG markup for the board.
 */
export function renderBoard(config: GaltonConfig, geometry: BoardGeometry, metrics: GaltonMetrics, theme: MediaTheme): string {
  const left = geometry.x.toFixed(1)
  const right = (geometry.x + geometry.width).toFixed(1)
  // why: the floor is drawn just under the pile's resting line, so the bottom row of grains stands on it rather than sinking into it
  const floorY = (metrics.floorY + 1).toFixed(1)
  const walls = `<line x1="${left}" y1="${metrics.boardTop}" x2="${left}" y2="${metrics.floorY}" stroke="${theme.rule}" stroke-width="1.5"/><line x1="${right}" y1="${metrics.boardTop}" x2="${right}" y2="${metrics.floorY}" stroke="${theme.rule}" stroke-width="1.5"/>`
  const floor = `<line x1="${left}" y1="${floorY}" x2="${right}" y2="${floorY}" stroke="${theme.border}" stroke-width="2" stroke-linecap="round"/>`
  const [low, high] = config.axis
  const axis = `<text x="${left}" y="${metrics.axisY}" class="ga-axis" text-anchor="start">${escapeHtml(low)}</text><text x="${right}" y="${metrics.axisY}" class="ga-axis" text-anchor="end">${escapeHtml(high)}</text>`
  return `${walls}${floor}${axis}`
}

/**
 * Draw every grain of one board, landed or falling.
 *
 * @param board - The board the grains belong to.
 * @param geometry - Where the board sits.
 * @param metrics - The measurements this profile is drawn at.
 * @param theme - The visual tokens this variant is drawn with.
 * @param grains - The grains at this instant.
 * @returns SVG markup for the grains.
 */
export function renderGrains(
  board: GaltonBoard,
  geometry: BoardGeometry,
  metrics: GaltonMetrics,
  theme: MediaTheme,
  grains: readonly GrainState[]
): string {
  const fill = theme.tones[board.tone]
  return grains
    .map((grain) => {
      const x = grainX(geometry, metrics, grain.column).toFixed(1)
      return `<rect x="${x}" y="${grain.y.toFixed(1)}" width="${metrics.grainWidthPx}" height="${metrics.grainHeightPx}" rx="1" fill="${fill}"/>`
    })
    .join('')
}

/**
 * Draw the line from the stream's chip down to each board's method label.
 *
 * One stem leaves the chip, a bar runs across, and a leg drops to each label:
 * the picture of one stream feeding two methods, with no words.
 *
 * @param geometries - Where each board sits.
 * @param metrics - The measurements this profile is drawn at.
 * @param theme - The visual tokens this variant is drawn with.
 * @param centreX - Horizontal centre of the chip.
 * @returns SVG markup for the fork.
 */
export function renderFork(geometries: readonly BoardGeometry[], metrics: GaltonMetrics, theme: MediaTheme, centreX: number): string {
  const first = geometries[0]
  const last = geometries[geometries.length - 1]
  if (first === undefined || last === undefined) {
    return ''
  }
  const top = metrics.chipBottomY
  const bar = (top + metrics.labelY - metrics.labelPx) / 2
  const bottom = metrics.labelY - metrics.labelPx
  const r = FORK_RADIUS
  const legs = geometries
    .map((geometry) => {
      const x = geometry.centreX
      const side = x < centreX ? -1 : 1
      return `M ${(x - side * r).toFixed(1)} ${bar} Q ${x} ${bar} ${x} ${bar + r} V ${bottom}`
    })
    .join(' ')
  const stem = `M ${centreX} ${top} V ${bar}`
  const across = `M ${(first.centreX + r).toFixed(1)} ${bar} H ${(last.centreX - r).toFixed(1)}`
  return `<path d="${stem} ${across} ${legs}" fill="none" stroke="${theme.border}" stroke-width="1.5" stroke-linecap="round"/>`
}

/**
 * Draw the method label above one board.
 *
 * @param board - The board the label belongs to.
 * @param geometry - Where the board sits.
 * @param metrics - The measurements this profile is drawn at.
 * @returns Positioned markup for the label.
 */
export function renderLabel(board: GaltonBoard, geometry: BoardGeometry, metrics: GaltonMetrics): string {
  return `<div class="ga-method" style="left:${geometry.centreX.toFixed(1)}px;top:${metrics.labelY}px">${escapeHtml(board.label)}</div>`
}

/**
 * Draw the chip naming the call that opened the stream.
 *
 * @param config - The scene's configuration.
 * @returns Positioned markup for the chip.
 */
export function renderChip(config: GaltonConfig): string {
  return `<div class="ga-chip">${renderApiChip(config.api.name, config.api.mark)}</div>`
}
