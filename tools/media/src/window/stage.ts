import type { MediaProfile } from '../models/profile'
import type { Stage } from '../models/stage'
import type { MediaTheme } from '../models/theme'
import type { WindowCall, WindowConfig } from '../models/window'
import type { Point } from '../stage/geometry'
import { escapeHtml } from '../lib/escape-html'
import { defineStage } from '../stage/define-stage'
import { figureMetrics, figureStyles, renderArrowhead } from '../stage/figure'

/** Width of a station on the track. */
const STATION_W = 128

/** Height of a station on the track. */
const STATION_H = 42

/** Height of a source chip. */
const CHIP_H = 34

/** How far the window band reaches past the stations it holds. */
const BAND_PAD = 16

/** Where everything in the figure sits. */
interface WindowLayout {
  /** Left end of the track. */
  trackLeft: number
  /** Right end of the track, where time runs out of the frame. */
  trackRight: number
  /** Vertical position of the track. */
  trackY: number
  /** Horizontal centre of each station, left to right. */
  stations: readonly number[]
  /** Bottom edge of the window band, where the chips' connectors start. */
  bandBottom: number
  /** Top edge of the source chips. */
  chipY: number
}

/** Whether a chip is the way through or the dead end. */
type ChipTone = 'accent' | 'danger'

/**
 * Lay the figure out for one profile.
 *
 * The track runs the width of the frame with its four stations evenly
 * spaced along it, and the chips sit on a lane under the track, each under
 * the station it happens at.
 *
 * @param profile - The presentation target being composed for.
 * @returns Every position the renderer needs.
 */
function windowLayout(profile: MediaProfile): WindowLayout {
  const metrics = figureMetrics(profile)
  const trackLeft = metrics.insetPx
  const trackRight = profile.width - metrics.insetPx
  const step = (trackRight - trackLeft - 24) / 4
  const stations = [0, 1, 2, 3].map((index) => trackLeft + step * (index + 0.5))
  const trackY = metrics.insetPx + STATION_H / 2 + BAND_PAD
  return {
    trackLeft,
    trackRight,
    trackY,
    stations,
    bandBottom: trackY + STATION_H / 2 + BAND_PAD,
    chipY: trackY + 78,
  }
}

/**
 * Width of a chip for its source text.
 *
 * @param code - The source the chip carries.
 * @param monoPx - Font size of the mono face.
 * @returns Width in CSS pixels.
 */
function chipWidth(code: string, monoPx: number): number {
  return code.length * (monoPx + 1) * 0.6 + 32
}

/**
 * Draw one line of source as a chip, its word under it and the short
 * connector that ties it to the station above.
 *
 * @param call - The source and its word.
 * @param centre - Horizontal centre of the chip.
 * @param layout - Where everything sits.
 * @param tone - Whether the chip is the way through or the dead end.
 * @param notePx - Font size of the word.
 * @param monoPx - Font size of the mono face.
 * @returns SVG markup for the chip.
 */
function renderChip(call: WindowCall, centre: number, layout: WindowLayout, tone: ChipTone, notePx: number, monoPx: number): string {
  const width = chipWidth(call.code, monoPx)
  const left = centre - width / 2
  const lead =
    call.lead === undefined
      ? ''
      : `<text class="wn-lead" x="${centre.toFixed(1)}" y="${(layout.chipY + CHIP_H + notePx + 12).toFixed(1)}" text-anchor="middle">${escapeHtml(call.lead)}</text>`
  return `<g class="wn-chip wn-chip--${tone}">
      <line class="wn-tie" x1="${centre.toFixed(1)}" y1="${layout.bandBottom + 6}" x2="${centre.toFixed(1)}" y2="${layout.chipY}"/>
      <rect x="${left.toFixed(1)}" y="${layout.chipY}" width="${width.toFixed(1)}" height="${CHIP_H}" rx="8"/>
      <text class="wn-code" x="${centre.toFixed(1)}" y="${layout.chipY + CHIP_H / 2 + monoPx * 0.36}" text-anchor="middle">${escapeHtml(call.code)}</text>
      ${lead}
    </g>`
}

/**
 * Draw the accent edge from one chip to the next, or from a chip up to a
 * station, ending in an arrowhead.
 *
 * @param from - Where the edge starts.
 * @param to - Where the arrowhead sits.
 * @param angleDeg - Direction the arrowhead points.
 * @param path - The edge's `d`.
 * @returns SVG markup for the edge.
 */
function renderFlow(from: Point, to: Point, angleDeg: number, path: string): string {
  return `<path class="fig-edge fig-edge--accent" d="${path}"/>
    <circle class="wn-dot" cx="${from.x.toFixed(1)}" cy="${from.y.toFixed(1)}" r="3"/>
    <g class="wn-head">${renderArrowhead(to.x, to.y, angleDeg, 6)}</g>`
}

/**
 * Build the stylesheet for the figure, with its theme resolved into it.
 *
 * @param config - The figure as the scene configured it.
 * @param profile - The presentation target being composed for.
 * @param theme - The visual tokens this variant is drawn with.
 * @returns CSS for this figure.
 */
function windowStyles(config: WindowConfig, profile: MediaProfile, theme: MediaTheme): string {
  const metrics = figureMetrics(profile)
  return `
${figureStyles(theme, metrics)}
.wn-track { stroke: ${theme.border}; stroke-width: 2; fill: none; stroke-linecap: round; }
.wn-track-head { stroke: ${theme.border}; stroke-width: 2; }
.wn-station { fill: ${theme.surfaceRaised}; stroke: ${theme.border}; stroke-width: 1.2; }
.wn-station--early { stroke: ${theme.accent}; }
.wn-station--late { stroke: ${theme.tones.danger}; }
.fig-svg .wn-name { font-family: ${theme.fonts.mono}; font-size: ${metrics.labelPx + 1}px; font-weight: 600; fill: ${theme.text.strong}; }
.wn-band { fill: ${theme.accentSoft}; }
.wn-chip rect { stroke-width: 1.6; }
.wn-chip--accent rect { fill: ${theme.accentSoft}; stroke: ${theme.accent}; }
.wn-chip--danger rect { fill: none; stroke: ${theme.tones.danger}; stroke-dasharray: 5 4; }
.wn-tie { stroke-width: 1.4; stroke-dasharray: 3 4; }
.wn-chip--accent .wn-tie { stroke: ${theme.accent}; }
.wn-chip--danger .wn-tie { stroke: ${theme.tones.danger}; }
.wn-lead { font-size: ${metrics.labelPx}px; font-weight: 700; }
.wn-chip--accent .wn-lead { fill: ${theme.tones.accent}; }
.wn-chip--danger .wn-lead { fill: ${theme.tones.danger}; }
.fig-svg .wn-code { font-family: ${theme.fonts.mono}; font-size: ${metrics.monoPx + 1}px; font-weight: 600; fill: ${theme.text.strong}; }
.wn-dot { fill: ${theme.accent}; }
.wn-head path { stroke: ${theme.accent}; stroke-width: 1.8; }
`
}

/**
 * The window a native ES module leaves open between reading its source and
 * binding its imports.
 *
 * One spec module travels a track of four stations, left to right: load,
 * resolve, link, evaluate. A shaded band holds the first three, the window
 * in which none of the spec's own code has run yet. Under the track the same
 * call appears twice: once on the left, read out of the source by the load
 * hook and carried along to the resolve step, which swaps the import for the
 * mock before link binds it; and once on the right, outside the window,
 * where the call actually executes, in a dashed chip, because by then there
 * is nothing left for it to change. Nothing moves: the figure is the
 * distance between reading a line and running it.
 */
export const windowStage: Stage<WindowConfig> = defineStage<WindowConfig>({
  id: 'window',

  styles: windowStyles,

  durationMs(): number {
    return 0
  },

  frame({ config, profile }): string {
    const metrics = figureMetrics(profile)
    const layout = windowLayout(profile)
    const { trackY, stations } = layout
    const [loadX = 0, resolveX = 0, linkX = 0, evaluateX = 0] = stations
    const half = STATION_W / 2
    const bandTop = trackY - STATION_H / 2 - BAND_PAD
    const band = `<rect class="wn-band" x="${(loadX - half - BAND_PAD).toFixed(1)}" y="${bandTop.toFixed(1)}" width="${(linkX - loadX + STATION_W + BAND_PAD * 2).toFixed(1)}" height="${(layout.bandBottom - bandTop).toFixed(1)}" rx="14"/>`
    const track = `<line class="wn-track" x1="${layout.trackLeft}" y1="${trackY}" x2="${layout.trackRight - 2}" y2="${trackY}"/>
      <g class="wn-track-head">${renderArrowhead(layout.trackRight, trackY, 0, 8)}</g>`
    const stationMarkup = config.stations
      .map((name, index) => {
        const x = stations[index] ?? 0
        const modifier = index === 0 ? ' wn-station--early' : index === 3 ? ' wn-station--late' : ''
        return `<rect class="wn-station${modifier}" x="${(x - half).toFixed(1)}" y="${trackY - STATION_H / 2}" width="${STATION_W}" height="${STATION_H}" rx="${STATION_H / 2}"/>
          <text class="wn-name" x="${x.toFixed(1)}" y="${trackY + 5}" text-anchor="middle">${escapeHtml(name)}</text>`
      })
      .join('')
    const chipMid = layout.chipY + CHIP_H / 2
    const readRight = loadX + chipWidth(config.read.code, metrics.monoPx) / 2
    const substituteLeft = resolveX - chipWidth(config.substitute.code, metrics.monoPx) / 2
    const substituteRight = resolveX + chipWidth(config.substitute.code, metrics.monoPx) / 2
    const handOff = renderFlow(
      { x: readRight, y: chipMid },
      { x: substituteLeft - 2, y: chipMid },
      0,
      `M ${readRight.toFixed(1)} ${chipMid} H ${(substituteLeft - 2).toFixed(1)}`
    )
    const linkFoot = trackY + STATION_H / 2 + 6
    const bind = renderFlow(
      { x: substituteRight, y: chipMid },
      { x: linkX, y: linkFoot },
      -90,
      `M ${substituteRight.toFixed(1)} ${chipMid} H ${(linkX - 18).toFixed(1)} Q ${linkX.toFixed(1)} ${chipMid} ${linkX.toFixed(1)} ${(chipMid - 18).toFixed(1)} V ${linkFoot.toFixed(1)}`
    )
    return `<div class="fig-frame">
      <svg class="fig-svg" viewBox="0 0 ${profile.width} ${profile.height}" width="${profile.width}" height="${profile.height}" aria-hidden="true">
        ${band}
        ${track}
        ${stationMarkup}
        ${renderChip(config.read, loadX, layout, 'accent', metrics.labelPx, metrics.monoPx)}
        ${renderChip(config.substitute, resolveX, layout, 'accent', metrics.labelPx, metrics.monoPx)}
        ${handOff}
        ${bind}
        ${renderChip(config.run, evaluateX, layout, 'danger', metrics.labelPx, metrics.monoPx)}
      </svg>
    </div>`
  },
})
