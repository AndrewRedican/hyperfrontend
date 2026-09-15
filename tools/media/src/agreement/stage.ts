import type { AgreementConfig, AgreementSide } from '../models/agreement'
import type { MediaProfile } from '../models/profile'
import type { Stage } from '../models/stage'
import type { MediaTheme } from '../models/theme'
import { renderMarkAt } from '../banner/mark'
import { escapeHtml } from '../lib/escape-html'
import { defineStage } from '../stage/define-stage'
import { figureMetrics, figureStyles } from '../stage/figure'

/** Side of an application block. */
const BLOCK = 64

/** Height of a pane. */
const PANE_H = 200

/** Gap between the two panes. */
const PANE_GAP = 24

/** Where one pane sits. */
interface Pane {
  /** Left edge. */
  x: number
  /** Top edge. */
  y: number
  /** Width. */
  w: number
}

/**
 * Draw a pane's frame, caption and trait rows, which both sides share.
 *
 * @param side - What the pane says.
 * @param pane - Where it sits.
 * @param notePx - Font size of the trait rows.
 * @returns SVG markup for the frame and the rows.
 */
function renderPaneChrome(side: AgreementSide, pane: Pane, notePx: number): string {
  const rows = side.traits
    .map((trait, index) => {
      const y = pane.y + PANE_H + 30 + index * (notePx + 10)
      return `<text class="fig-note" x="${pane.x + 18}" y="${y}">${escapeHtml(trait.label)}</text><text class="fig-label ag-value" x="${pane.x + pane.w - 18}" y="${y}" text-anchor="end">${escapeHtml(trait.value)}</text><line class="fig-rule" x1="${pane.x + 18}" y1="${y + 7}" x2="${pane.x + pane.w - 18}" y2="${y + 7}"/>`
    })
    .join('')
  return `<rect class="ag-pane" x="${pane.x}" y="${pane.y}" width="${pane.w}" height="${PANE_H}" rx="14"/>
    <text class="fig-caps" x="${pane.x + 18}" y="${pane.y + 26}">${escapeHtml(side.caption)}</text>
    <text class="fig-note" x="${pane.x + 18}" y="${pane.y + 44}">${escapeHtml(side.note)}</text>${rows}`
}

/**
 * Draw the cohesion side: applications standing on one shared slab, joined
 * by every agreement they have to keep.
 *
 * @param side - What the pane says.
 * @param pane - Where it sits.
 * @param count - How many applications.
 * @returns SVG markup for the pane's contents.
 */
function renderCohesion(side: AgreementSide, pane: Pane, count: number): string {
  const step = BLOCK + 8
  const left = pane.x + (pane.w - (count * step - 8)) / 2
  const top = pane.y + 86
  const centres: number[] = []
  const blocks: string[] = []
  for (let index = 0; index < count; index += 1) {
    const x = left + index * step
    centres.push(x + BLOCK / 2)
    blocks.push(`<rect class="ag-block" x="${x}" y="${top}" width="${BLOCK}" height="${BLOCK}" rx="8"/>`)
  }
  const arcs: string[] = []
  for (let a = 0; a < count; a += 1) {
    for (let b = a + 1; b < count; b += 1) {
      const from = centres[a] ?? 0
      const to = centres[b] ?? 0
      // why: the further apart two applications are, the higher their agreement arcs, so six arcs stay six visible arcs rather than one thick line
      const lift = 14 + (b - a) * 12
      arcs.push(`<path class="ag-arc" d="M ${from} ${top} C ${from} ${top - lift}, ${to} ${top - lift}, ${to} ${top}"/>`)
    }
  }
  const slabY = top + BLOCK + 6
  return `${arcs.join('')}${blocks.join('')}
    <rect class="ag-slab" x="${pane.x + 20}" y="${slabY}" width="${pane.w - 40}" height="26" rx="6"/>
    <text class="fig-note ag-ground" x="${pane.x + pane.w / 2}" y="${slabY + 17}" text-anchor="middle">${escapeHtml(side.ground)}</text>`
}

/**
 * Draw the isolation side: applications each on their own ground, walls
 * between them, and one deliberate wire across the top.
 *
 * @param side - What the pane says.
 * @param pane - Where it sits.
 * @param count - How many applications.
 * @param theme - The visual tokens this variant is drawn with.
 * @returns SVG markup for the pane's contents.
 */
function renderIsolation(side: AgreementSide, pane: Pane, count: number, theme: MediaTheme): string {
  const step = BLOCK + 22
  const left = pane.x + (pane.w - (count * step - 22)) / 2
  const top = pane.y + 86
  const wireY = top - 22
  const parts: string[] = []
  for (let index = 0; index < count; index += 1) {
    const x = left + index * step
    const centre = x + BLOCK / 2
    parts.push(`<rect class="ag-block" x="${x}" y="${top}" width="${BLOCK}" height="${BLOCK}" rx="8"/>`)
    parts.push(`<rect class="ag-slab ag-slab--own" x="${x - 4}" y="${top + BLOCK + 6}" width="${BLOCK + 8}" height="10" rx="3"/>`)
    parts.push(
      `<line class="ag-drop" x1="${centre}" y1="${wireY}" x2="${centre}" y2="${top}"/><circle cx="${centre}" cy="${wireY}" r="4" fill="${theme.surfaceRaised}" stroke="${theme.accent}" stroke-width="1.6"/>`
    )
    if (index > 0) {
      const wallX = x - 11
      parts.push(`<line class="ag-wall" x1="${wallX}" y1="${top - 8}" x2="${wallX}" y2="${top + BLOCK + 16}"/>`)
    }
  }
  const first = left + BLOCK / 2
  const last = left + (count - 1) * step + BLOCK / 2
  return `<line class="ag-wire" x1="${first}" y1="${wireY}" x2="${last}" y2="${wireY}"/>${parts.join('')}
    <text class="fig-note ag-ground" x="${pane.x + pane.w / 2}" y="${top + BLOCK + 37}" text-anchor="middle">${escapeHtml(side.ground)}</text>`
}

/**
 * Build the stylesheet for the figure, with its theme resolved into it.
 *
 * @param config - The figure as the scene configured it.
 * @param profile - The presentation target being composed for.
 * @param theme - The visual tokens this variant is drawn with.
 * @returns CSS for this figure.
 */
function agreementStyles(config: AgreementConfig, profile: MediaProfile, theme: MediaTheme): string {
  const metrics = figureMetrics(profile)
  return `
${figureStyles(theme, metrics)}
.ag-pane { fill: ${theme.surface}; stroke: ${theme.border}; stroke-width: 1.2; }
.ag-block { fill: ${theme.surfaceRaised}; stroke: ${theme.border}; stroke-width: 1.4; }
.ag-arc { fill: none; stroke: ${theme.text.muted}; stroke-width: 1.2; opacity: 0.8; }
.ag-slab { fill: ${theme.accentSoft}; stroke: ${theme.accentSoft}; }
.ag-slab--own { fill: ${theme.rule}; stroke: none; }
.ag-ground { fill: ${theme.tones.accent}; font-weight: 600; }
.ag-wall { stroke: ${theme.text.muted}; stroke-width: 2.2; stroke-linecap: round; }
.ag-wire { stroke: ${theme.accent}; stroke-width: 1.6; stroke-dasharray: 5 4; }
.ag-drop { stroke: ${theme.accent}; stroke-width: 1.2; }
.ag-value { fill: ${theme.text.strong}; }
.ag-axis { stroke: ${theme.text.faint}; stroke-width: 1.5; stroke-linecap: round; }
`
}

/**
 * Two ways to divide a system, side by side, and where each puts the
 * agreement it cannot do without.
 *
 * On the left the applications stand on one shared slab and every pair is
 * tied to every other by the arcs above them: cheap to run together,
 * expensive to keep agreeing. On the right each stands on its own ground
 * behind a wall, tied to the rest by one deliberate wire: harder at the
 * boundary, cheap to coordinate. The axis under both says what the panes
 * differ in, and the marker says which side hyperfrontend chose.
 */
export const agreementStage: Stage<AgreementConfig> = defineStage<AgreementConfig>({
  id: 'agreement',

  styles: agreementStyles,

  durationMs(): number {
    return 0
  },

  frame({ config, profile, theme }): string {
    const metrics = figureMetrics(profile)
    const paneW = (profile.width - metrics.insetPx * 2 - PANE_GAP) / 2
    const left: Pane = { x: metrics.insetPx, y: metrics.insetPx + 8, w: paneW }
    const right: Pane = { x: metrics.insetPx + paneW + PANE_GAP, y: metrics.insetPx + 8, w: paneW }
    const axisY = left.y + PANE_H + 30 + config.cohesion.traits.length * (metrics.notePx + 10) + 34
    const axisFrom = metrics.insetPx + 24
    const axisTo = profile.width - metrics.insetPx - 24
    const markerX = axisTo - 70
    return `<div class="fig-frame">
      <svg class="fig-svg" viewBox="0 0 ${profile.width} ${profile.height}" width="${profile.width}" height="${profile.height}" aria-hidden="true">
        ${renderPaneChrome(config.cohesion, left, metrics.notePx)}
        ${renderCohesion(config.cohesion, left, config.applications)}
        ${renderPaneChrome(config.isolation, right, metrics.notePx)}
        ${renderIsolation(config.isolation, right, config.applications, theme)}
        <line class="ag-axis" x1="${axisFrom}" y1="${axisY}" x2="${axisTo}" y2="${axisY}"/>
        <line class="ag-axis" x1="${axisFrom}" y1="${axisY - 6}" x2="${axisFrom}" y2="${axisY + 6}"/>
        <line class="ag-axis" x1="${axisTo}" y1="${axisY - 6}" x2="${axisTo}" y2="${axisY + 6}"/>
        <text class="fig-note" x="${axisFrom}" y="${axisY + 28}">${escapeHtml(config.axisLeft)}</text>
        <text class="fig-note" x="${axisTo}" y="${axisY + 28}" text-anchor="end">${escapeHtml(config.axisRight)}</text>
        <circle cx="${markerX}" cy="${axisY}" r="14" fill="${theme.surfaceRaised}" stroke="${theme.accent}" stroke-width="2"/>
        ${renderMarkAt(config.mark, markerX, axisY, 17, theme.accent)}
        <text class="fig-label" x="${markerX}" y="${axisY - 23}" text-anchor="middle">${escapeHtml(config.marker)}</text>
        <text class="fig-caption" x="${profile.width / 2}" y="${profile.height - metrics.insetPx + 10}" text-anchor="middle">${escapeHtml(config.caption)}</text>
      </svg>
    </div>`
  },
})
