import type { MatrixCell, MatrixConfig, MatrixSupport } from '../models/matrix'
import type { MediaProfile } from '../models/profile'
import type { Stage } from '../models/stage'
import type { MediaTheme } from '../models/theme'
import { round } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'
import { escapeHtml } from '../lib/escape-html'
import { defineStage } from '../stage/define-stage'

/** What each level of support is called on the cell. */
const SUPPORT_LABELS: Readonly<Record<MatrixSupport, string>> = {
  full: 'Supported',
  partial: 'Partial',
  none: 'Not supported',
}

/** The glyph drawn beside each level of support. */
const SUPPORT_GLYPHS: Readonly<Record<MatrixSupport, string>> = {
  full: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  partial: '<path d="M5 12h14"/>',
  none: '<path d="M7 7l10 10M17 7L7 17"/>',
}

/** How the strip is sized for the surface it is being drawn for. */
interface MatrixMetrics {
  /** Margin between the cells and the edge of the plate. */
  insetPx: number
  /** Gap between cells. */
  gapPx: number
  /** Padding inside a cell. */
  padPx: number
  /** Font size of the heading. */
  headingPx: number
  /** Font size of a cell's label. */
  labelPx: number
  /** Font size of a cell's detail line. */
  detailPx: number
  /** Font size of the support word. */
  supportPx: number
  /** Side of the glyph's badge. */
  badgePx: number
}

/**
 * Size the strip for the surface it is being drawn for.
 *
 * @param profile - The presentation target being composed for.
 * @returns Every measurement the renderer needs.
 */
function matrixMetrics(profile: MediaProfile): MatrixMetrics {
  const unit = profile.height / 150
  return {
    insetPx: round(20 * unit),
    gapPx: round(12 * unit),
    padPx: round(14 * unit),
    headingPx: round(13 * unit),
    labelPx: round(15 * unit),
    detailPx: round(11.5 * unit),
    supportPx: round(11 * unit),
    badgePx: round(26 * unit),
  }
}

/**
 * The colour a level of support is drawn in.
 *
 * @param support - The level.
 * @param theme - The visual tokens this variant is drawn with.
 * @returns A CSS colour.
 */
function supportColour(support: MatrixSupport, theme: MediaTheme): string {
  return support === 'full' ? theme.tones.success : support === 'partial' ? theme.tones.warning : theme.text.faint
}

/**
 * Draw one runtime's cell.
 *
 * @param cell - The runtime.
 * @param theme - The visual tokens this variant is drawn with.
 * @returns Markup for the cell.
 */
function renderCell(cell: MatrixCell, theme: MediaTheme): string {
  const colour = supportColour(cell.support, theme)
  const glyph = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${SUPPORT_GLYPHS[cell.support]}</svg>`
  return `<div class="mx-cell mx-cell--${cell.support}">
    <div class="mx-badge" style="color:${colour}">${glyph}</div>
    <div class="mx-text">
      <div class="mx-label">${escapeHtml(cell.label)}</div>
      <div class="mx-detail">${escapeHtml(cell.detail)}</div>
      <div class="mx-support" style="color:${colour}">${SUPPORT_LABELS[cell.support]}</div>
    </div>
  </div>`
}

/**
 * Build the stylesheet for one strip, with its theme resolved into it.
 *
 * @param config - The strip as the scene configured it.
 * @param profile - The presentation target being composed for.
 * @param theme - The visual tokens this variant is drawn with.
 * @returns CSS for this strip.
 */
function matrixStyles(config: MatrixConfig, profile: MediaProfile, theme: MediaTheme): string {
  const metrics = matrixMetrics(profile)
  return `
.mx-frame {
  position: absolute;
  inset: ${metrics.insetPx}px;
  display: flex;
  flex-direction: column;
  gap: ${round(metrics.gapPx * 0.8)}px;
}
.mx-heading {
  flex: none;
  font-size: ${metrics.headingPx}px;
  font-weight: 600;
  letter-spacing: 0.01em;
  color: ${theme.text.muted};
}
.mx-cells { flex: 1 1 auto; min-height: 0; display: flex; gap: ${metrics.gapPx}px; }
.mx-cell {
  flex: 1 1 0;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: ${round(metrics.padPx * 0.85)}px;
  padding: ${metrics.padPx}px;
  border: 1px solid ${theme.border};
  border-radius: ${round(metrics.padPx * 0.8)}px;
  background: ${theme.surface};
  box-shadow: ${theme.shadow};
}
.mx-cell--none { opacity: 0.72; }
.mx-badge {
  flex: none;
  width: ${metrics.badgePx}px;
  height: ${metrics.badgePx}px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: ${theme.surfaceRaised};
  border: 1px solid ${theme.border};
}
.mx-badge svg { width: ${round(metrics.badgePx * 0.6)}px; height: ${round(metrics.badgePx * 0.6)}px; }
.mx-text { min-width: 0; display: flex; flex-direction: column; gap: ${round(metrics.detailPx * 0.2)}px; }
.mx-label { font-size: ${metrics.labelPx}px; font-weight: 600; color: ${theme.text.strong}; white-space: nowrap; }
.mx-detail { font-size: ${metrics.detailPx}px; color: ${theme.text.muted}; }
.mx-support { font-size: ${metrics.supportPx}px; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase; }
`
}

/**
 * Where a package runs, as one strip of cells.
 *
 * For the part of a readme that is a two-row table of ticks and crosses: the
 * same facts, given a shape a reader takes in without reading a table, and a
 * package's own hue so the strip belongs to the readme it sits in. The facts
 * themselves stay in the readme's text, because a strip is a picture and a
 * picture cannot be searched.
 */
export const matrixStage: Stage<MatrixConfig> = defineStage<MatrixConfig>({
  id: 'matrix',

  styles: matrixStyles,

  durationMs(): number {
    return 0
  },

  frame({ config, theme }): string {
    const heading = config.heading === undefined ? '' : `<div class="mx-heading">${escapeHtml(config.heading)}</div>`
    const cells = config.cells.map((cell) => renderCell(cell, theme)).join('')
    return `<div class="mx-frame">${heading}<div class="mx-cells">${cells}</div></div>`
  },
})
