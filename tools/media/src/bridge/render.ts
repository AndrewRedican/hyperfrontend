import type { BridgeConfig } from '../models/bridge'
import type { MediaTheme } from '../models/theme'
import type { BridgeLayout, BridgeMetrics, Point } from './layout'
import type { BridgeTimeline } from './timeline'
import { floor, max, min, round } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'
import { escapeHtml } from '../lib/escape-html'
import { easeInOut, easeOut, lerp, progress } from '../lib/motion'
import { highlight } from '../panel/syntax'
import { renderApiChip, renderForeignLabel } from '../stage/api-chip'
import { wireAt } from './layout'
import { CARET_LINGER_MS, CHECK_MS, CHIP_MS, COUNT_MS, FIGURE_MS, LIGHT_MS, PULSE_MS, RETURN_MS, TICK_MS, WIRE_MS } from './timeline'

/** How far the ring round a socket grows past its rim when a wire lands, at compact size. */
const RING_REACH = 9

/** How far the ring round the tick's disc grows past its rim when the tick lands, at compact size. */
const TICK_RING_REACH = 10

/** Radius of a lit socket's glow, as a multiple of the socket's radius. */
const GLOW_RADIUS = 2.2

/** Radius of the spark at the tip of a drawing wire, at compact size. */
const SPARK_R = 3.2

/** Radius of the halo round a spark, at compact size. */
const SPARK_HALO_R = 7.5

/** Radius of the dot a wire leaves behind where it left its line, at compact size. */
const ANCHOR_R = 2.4

/** The check as a path on a unit square centred on the origin: down to the foot, then up to the tip. */
const CHECK_PATH: readonly Point[] = [
  { x: -0.46, y: 0.04 },
  { x: -0.13, y: 0.37 },
  { x: 0.48, y: -0.33 },
]

/** Everything the render helpers need at one instant. */
export interface BridgeFrame {
  /** The bridge as the scene configured it. */
  config: BridgeConfig
  /** Where everything sits. */
  layout: BridgeLayout
  /** Every moment of the bridge. */
  timeline: BridgeTimeline
  /** The measurements this profile is drawn at. */
  metrics: BridgeMetrics
  /** The visual tokens this variant is drawn with. */
  theme: MediaTheme
  /** Offset from the start of the timeline. */
  atMs: number
}

/**
 * Draw a check, centred on a point and drawn as far as asked.
 *
 * @param centre - Where the check is centred.
 * @param size - Side of the square it fills.
 * @param colour - What it is stroked with.
 * @param width - Stroke width.
 * @param drawn - How much of it is drawn, from 0 to 1.
 * @returns SVG markup.
 * @example A finished check in the success tone
 * ```ts
 * renderCheck({ x: 33, y: 148 }, 11, theme.tones.success, 2.2, 1)
 * ```
 */
export function renderCheck(centre: Point, size: number, colour: string, width: number, drawn: number): string {
  const d = CHECK_PATH.map(
    (point, index) => `${index === 0 ? 'M' : 'L'} ${(centre.x + point.x * size).toFixed(1)} ${(centre.y + point.y * size).toFixed(1)}`
  ).join(' ')
  const reveal = drawn < 1 ? ` pathLength="1" stroke-dasharray="1 1" stroke-dashoffset="${(1 - drawn).toFixed(3)}"` : ''
  return `<path d="${d}" fill="none" stroke="${colour}" stroke-width="${width.toFixed(2)}" stroke-linecap="round" stroke-linejoin="round"${reveal}/>`
}

/**
 * Draw the sheet the spec is written on: its surface, the file's name and the rule under it.
 *
 * @param frame - The instant being drawn.
 * @returns SVG markup.
 * @example The sheet, which never changes
 * ```ts
 * renderSheet(frame)
 * ```
 */
export function renderSheet(frame: BridgeFrame): string {
  const { config, metrics, theme } = frame
  const { sheet } = metrics
  const box = `<rect x="${sheet.x}" y="${sheet.y}" width="${sheet.w}" height="${sheet.h}" rx="${metrics.sheetRadiusPx}" fill="${theme.surface}" stroke="${theme.border}" stroke-width="1.5"/>`
  const name = `<text class="br-mono" x="${metrics.textXPx}" y="${metrics.fileYPx}" font-size="${metrics.filePx}" fill="${theme.text.faint}" dominant-baseline="central">${escapeHtml(config.file)}</text>`
  const rule = `<line x1="${sheet.x}" y1="${metrics.ruleYPx}" x2="${sheet.x + sheet.w}" y2="${metrics.ruleYPx}" stroke="${theme.rule}" stroke-width="1"/>`
  return `${box}${name}${rule}`
}

/**
 * Draw the listing as far as it has been typed: each line's chip, its characters, and the caret while it types.
 *
 * Nothing here carries an `opacity` or a `transform`: either one makes the
 * browser composite the element through a surface of its own, and a headless
 * screenshot can catch that surface with another element's pixels still in
 * it. A chip appears by mixing its colours in from transparent, driven by
 * the `--br-on` property its slot sets.
 *
 * @param frame - The instant being drawn.
 * @returns HTML markup, one positioned row per line that has started.
 * @example The listing fully typed
 * ```ts
 * renderLines({ ...frame, atMs: 7_000 })
 * ```
 */
export function renderLines(frame: BridgeFrame): string {
  const { config, layout, timeline, metrics, theme, atMs } = frame
  return config.lines
    .map((line, index) => {
      const slot = layout.lines[index]
      const schedule = timeline.lines[index]
      if (slot === undefined || schedule === undefined || atMs < schedule.startAt || (line.api === undefined && line.text === '')) {
        return ''
      }
      const chip =
        line.api === undefined
          ? ''
          : `<span class="br-chip" style="--br-on:${round(easeOut(progress(atMs, schedule.startAt, CHIP_MS)) * 100)}%">${renderApiChip(line.api, config.mark)}</span>`
      const typed = min(line.text.length, floor((max(0, atMs - schedule.textAt) * config.typeCps) / 1000))
      const code = typed > 0 ? `<span class="br-code">${highlight(line.text.slice(0, typed), theme.syntax)}</span>` : ''
      const caret = atMs < schedule.typedAt + CARET_LINGER_MS ? '<span class="br-caret"></span>' : ''
      return `<div class="br-line" style="left:${slot.left.toFixed(1)}px;top:${round(slot.y - metrics.lineHPx / 2)}px">${chip}${code}${caret}</div>`
    })
    .join('')
}

/**
 * Draw every wire as far as it has drawn, with a spark at the tip of one still drawing.
 *
 * @param frame - The instant being drawn.
 * @returns SVG markup.
 * @example The first wire half way to its socket
 * ```ts
 * renderWires({ ...frame, atMs: timeline.wires[0].startAt + 225 })
 * ```
 */
export function renderWires(frame: BridgeFrame): string {
  const { layout, timeline, metrics, theme, atMs } = frame
  const s = metrics.scale
  return timeline.wires
    .map((schedule) => {
      const wire = layout.wires.find((candidate) => candidate.line === schedule.line)
      if (wire === undefined || atMs < schedule.startAt) {
        return ''
      }
      const t = easeInOut(progress(atMs, schedule.startAt, WIRE_MS))
      const reveal = t < 1 ? ` pathLength="1" stroke-dasharray="1 1" stroke-dashoffset="${(1 - t).toFixed(3)}"` : ''
      const glow = `<path d="${wire.d}" fill="none" stroke="${theme.accent}" stroke-width="${(5 * s).toFixed(1)}" stroke-linecap="round" opacity="0.16"${reveal}/>`
      const core = `<path d="${wire.d}" fill="none" stroke="${theme.accent}" stroke-width="${(1.8 * s).toFixed(2)}" stroke-linecap="round"${reveal}/>`
      const anchor = `<circle cx="${wire.start.x.toFixed(1)}" cy="${wire.start.y.toFixed(1)}" r="${(ANCHOR_R * s).toFixed(1)}" fill="${theme.accent}"/>`
      if (t >= 1) {
        return `${glow}${core}${anchor}`
      }
      const tip = wireAt(wire, t)
      const spark = `<circle cx="${tip.x.toFixed(1)}" cy="${tip.y.toFixed(1)}" r="${(SPARK_HALO_R * s).toFixed(1)}" fill="${theme.accent}" opacity="0.25"/><circle cx="${tip.x.toFixed(1)}" cy="${tip.y.toFixed(1)}" r="${(SPARK_R * s).toFixed(1)}" fill="${theme.accent}"/>`
      return `${glow}${core}${anchor}${spark}`
    })
    .join('')
}

/**
 * Draw the strip and the sockets on it, a socket lighting as the first wire lands on it and ringing on every landing.
 *
 * @param frame - The instant being drawn.
 * @returns SVG markup.
 * @example The sockets with the first wire just landed
 * ```ts
 * renderSockets({ ...frame, atMs: timeline.wires[0].landAt + 100 })
 * ```
 */
export function renderSockets(frame: BridgeFrame): string {
  const { config, layout, timeline, metrics, theme, atMs } = frame
  const s = metrics.scale
  const [top, bottom] = layout.strip
  const strip = `<line x1="${metrics.stripXPx}" y1="${top.toFixed(1)}" x2="${metrics.stripXPx}" y2="${bottom.toFixed(1)}" stroke="${theme.rule}" stroke-width="1.5" stroke-linecap="round"/>`
  const sockets = config.primitives
    .map((_, index) => {
      const at = layout.sockets[index]
      if (at === undefined) {
        return ''
      }
      const landings = timeline.wires.filter((wire) => wire.primitive === index).map((wire) => wire.landAt)
      const first = landings.reduce((earliest, landAt) => min(earliest, landAt), Number.POSITIVE_INFINITY)
      const level = atMs < first ? 0 : easeOut(progress(atMs, first, LIGHT_MS))
      const ring = landings.reduce((strongest, landAt) => {
        const t = progress(atMs, landAt, PULSE_MS)
        return t <= 0 || t >= 1 ? strongest : max(strongest, t)
      }, 0)
      const halo =
        ring > 0
          ? `<circle cx="${at.x}" cy="${at.y}" r="${(metrics.socketRPx + RING_REACH * s * easeOut(ring)).toFixed(1)}" fill="none" stroke="${theme.accent}" stroke-width="1.5" opacity="${(0.7 * (1 - ring)).toFixed(3)}"/>`
          : ''
      const idle = `<circle cx="${at.x}" cy="${at.y}" r="${metrics.socketRPx.toFixed(1)}" fill="${theme.surface}" stroke="${theme.border}" stroke-width="1.5"/>`
      if (level <= 0) {
        return `${idle}${halo}`
      }
      const glow = `<circle cx="${at.x}" cy="${at.y}" r="${(metrics.socketRPx * GLOW_RADIUS).toFixed(1)}" fill="${theme.accent}" opacity="${(0.2 * level).toFixed(3)}"/>`
      const lit = `<circle cx="${at.x}" cy="${at.y}" r="${metrics.socketRPx.toFixed(1)}" fill="${theme.accent}" stroke="${theme.accent}" stroke-width="1.5" opacity="${level.toFixed(3)}"/>`
      return `${idle}${glow}${lit}${halo}`
    })
    .join('')
  return `${strip}${sockets}`
}

/**
 * Draw the primitives' labels, each lighting as the first wire lands on its socket, with a tally beside the ones that keep count.
 *
 * @param frame - The instant being drawn.
 * @returns HTML markup, one positioned label per primitive.
 * @example Every label lit
 * ```ts
 * renderLabels({ ...frame, atMs: 7_000 })
 * ```
 */
export function renderLabels(frame: BridgeFrame): string {
  const { config, layout, timeline, metrics, atMs } = frame
  return config.primitives
    .map((primitive, index) => {
      const at = layout.sockets[index]
      if (at === undefined) {
        return ''
      }
      const landings = timeline.wires.filter((wire) => wire.primitive === index).map((wire) => wire.landAt)
      const first = landings.reduce((earliest, landAt) => min(earliest, landAt), Number.POSITIVE_INFINITY)
      const level = atMs < first ? 0 : easeOut(progress(atMs, first, LIGHT_MS))
      const count = landings.filter((landAt) => landAt <= atMs).length
      const tally = primitive.tally === true && count > 0 ? `<span class="br-tally">${count}</span>` : ''
      return `<div class="br-label" style="left:${metrics.labelXPx}px;top:${round(at.y - metrics.labelHPx / 2)}px;--br-on:${round(level * 100)}%">${renderForeignLabel(primitive.name)}${tally}</div>`
    })
    .join('')
}

/**
 * Draw the verdict coming back: a spark returning along the test's wire, then the check landing in the gutter beside it.
 *
 * @param frame - The instant being drawn.
 * @returns SVG markup, or nothing before the run.
 * @example The check fully drawn
 * ```ts
 * renderVerdict({ ...frame, atMs: timeline.checkAt + 300 })
 * ```
 */
export function renderVerdict(frame: BridgeFrame): string {
  const { config, layout, timeline, metrics, theme, atMs } = frame
  const index = config.lines.findIndex((line) => line.verdict === true)
  const slot = layout.lines[index]
  if (index < 0 || slot === undefined || atMs < timeline.runAt) {
    return ''
  }
  const s = metrics.scale
  const wire = layout.wires.find((candidate) => candidate.line === index)
  const back = easeInOut(progress(atMs, timeline.runAt, RETURN_MS))
  let spark = ''
  if (wire !== undefined && back < 1) {
    const at = wireAt(wire, 1 - back)
    spark = `<circle cx="${at.x.toFixed(1)}" cy="${at.y.toFixed(1)}" r="${(SPARK_HALO_R * s).toFixed(1)}" fill="${theme.tones.success}" opacity="0.25"/><circle cx="${at.x.toFixed(1)}" cy="${at.y.toFixed(1)}" r="${(SPARK_R * s).toFixed(1)}" fill="${theme.tones.success}"/>`
  }
  const drawn = easeOut(progress(atMs, timeline.checkAt, CHECK_MS))
  if (drawn <= 0) {
    return spark
  }
  const centre = { x: metrics.gutterXPx, y: slot.y }
  const ring = progress(atMs, timeline.checkAt, PULSE_MS)
  const halo =
    ring > 0 && ring < 1
      ? `<circle cx="${centre.x}" cy="${centre.y}" r="${(metrics.checkPx * 0.5 + RING_REACH * s * easeOut(ring)).toFixed(1)}" fill="none" stroke="${theme.tones.success}" stroke-width="1.5" opacity="${(0.7 * (1 - ring)).toFixed(3)}"/>`
      : ''
  return `${spark}${halo}${renderCheck(centre, metrics.checkPx, theme.tones.success, 2.2 * s, drawn)}`
}

/**
 * Draw the report along the bottom of the sheet: each figure's heading and its number counting up, then the disc and the tick landing on it.
 *
 * @param frame - The instant being drawn.
 * @returns SVG markup, or nothing before the figures appear.
 * @example The report with the tick landed
 * ```ts
 * renderReport({ ...frame, atMs: timeline.tickAt + 400 })
 * ```
 */
export function renderReport(frame: BridgeFrame): string {
  const { config, layout, timeline, metrics, theme, atMs } = frame
  if (atMs < timeline.figuresAt) {
    return ''
  }
  const s = metrics.scale
  const shown = easeOut(progress(atMs, timeline.figuresAt, FIGURE_MS))
  const figures = config.report.figures
    .map((figure, index) => {
      const slot = layout.figures[index]
      const countAt = timeline.countsAt[index]
      if (slot === undefined || countAt === undefined) {
        return ''
      }
      const counted = easeOut(progress(atMs, countAt, COUNT_MS))
      const value = lerp(0, figure.value, counted).toFixed(2)
      const label = `<text class="br-sans" x="${slot.x.toFixed(1)}" y="${metrics.figureLabelYPx}" font-size="${metrics.figureLabelPx}" font-weight="500" fill="${theme.text.faint}" opacity="${shown.toFixed(3)}" dominant-baseline="central">${escapeHtml(figure.label)}</text>`
      const number = `<text class="br-mono" x="${slot.x.toFixed(1)}" y="${metrics.figureValueYPx}" font-size="${metrics.figureValuePx}" font-weight="600" fill="${counted >= 1 ? theme.text.strong : theme.text.muted}" opacity="${shown.toFixed(3)}" dominant-baseline="central">${value}</text>`
      return `${label}${number}`
    })
    .join('')
  const drawn = easeOut(progress(atMs, timeline.tickAt, TICK_MS))
  if (drawn <= 0) {
    return figures
  }
  const { tick } = layout
  const ring = progress(atMs, timeline.tickAt, PULSE_MS)
  const halo =
    ring > 0 && ring < 1
      ? `<circle cx="${tick.x.toFixed(1)}" cy="${tick.y.toFixed(1)}" r="${(metrics.tickRPx + TICK_RING_REACH * s * easeOut(ring)).toFixed(1)}" fill="none" stroke="${theme.tones.success}" stroke-width="1.5" opacity="${(0.7 * (1 - ring)).toFixed(3)}"/>`
      : ''
  const disc = `<circle cx="${tick.x.toFixed(1)}" cy="${tick.y.toFixed(1)}" r="${metrics.tickRPx}" fill="${theme.tones.success}" opacity="${(0.18 * drawn).toFixed(3)}"/>`
  return `${figures}${halo}${disc}${renderCheck(tick, metrics.tickRPx * 1.15, theme.tones.success, 2.6 * s, drawn)}`
}

/**
 * Draw the report's chip, appearing with the figures.
 *
 * @param frame - The instant being drawn.
 * @returns HTML markup, or nothing before the figures appear.
 * @example The chip in place
 * ```ts
 * renderReportChip({ ...frame, atMs: timeline.figuresAt + 300 })
 * ```
 */
export function renderReportChip(frame: BridgeFrame): string {
  const { config, layout, timeline, metrics, atMs } = frame
  if (atMs < timeline.figuresAt) {
    return ''
  }
  const on = round(easeOut(progress(atMs, timeline.figuresAt, FIGURE_MS)) * 100)
  return `<div class="br-chip br-report" style="left:${layout.reportChipLeft}px;top:${round(layout.reportY - metrics.chipHPx / 2)}px;--br-on:${on}%">${renderApiChip(config.report.api, config.mark)}</div>`
}
