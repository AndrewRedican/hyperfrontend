import type { BridgeConfig, BridgeLine } from '../models/bridge'
import type { MediaProfile } from '../models/profile'
import { hypot, max, round } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'
import { clamp01 } from '../lib/motion'

/** Width of the composition every measurement is stated for; other widths scale from it. */
const COMPACT_WIDTH = 640

/** Advance width of the monospace face as a fraction of its size, which the named face and its fallbacks share. */
export const MONO_ADVANCE = 0.6

/** Average advance of the sans face as a fraction of its size, for sizing a figure round its heading. */
const SANS_ADVANCE = 0.52

/** How far a wire's control points sit from its ends, as a fraction of its horizontal run. */
const WIRE_BEND = 0.45

/** How many straight pieces a wire is measured in when a fraction of its length is turned into a point. */
const ARC_SAMPLES = 32

/** Space between the end of a line and the start of its wire, at compact size. */
const WIRE_GAP = 8

/** Vertical distance between two wires landing on one socket, at compact size. */
const LANDING_SPREAD = 6

/** How far the strip runs past the first and last socket, at compact size. */
const STRIP_OVERRUN = 16

/** Space between the figures of the report, at compact size. */
const FIGURE_GAP = 20

/** Space between the report's chip and its first figure, and between its last figure and the tick, at compact size. */
const REPORT_GAP = 16

/** A point in the frame, in CSS pixels. */
export interface Point {
  /** Horizontal position. */
  x: number
  /** Vertical position. */
  y: number
}

/** A rectangle in the frame, in CSS pixels. */
export interface Rect {
  /** Left edge. */
  x: number
  /** Top edge. */
  y: number
  /** Width. */
  w: number
  /** Height. */
  h: number
}

/** How the frame is sized for the surface it is being drawn for. */
export interface BridgeMetrics {
  /** Factor every measurement is scaled by from the compact composition. */
  scale: number
  /** Width of the frame. */
  widthPx: number
  /** The sheet the spec is written on. */
  sheet: Rect
  /** Corner radius of the sheet. */
  sheetRadiusPx: number
  /** Font size of the spec file's name. */
  filePx: number
  /** Vertical centre of the file's name. */
  fileYPx: number
  /** Vertical position of the rule under the file's name. */
  ruleYPx: number
  /** Left edge of an unindented line. */
  textXPx: number
  /** Horizontal centre of the gutter the check lands in. */
  gutterXPx: number
  /** Vertical centre of the first line. */
  lineTopPx: number
  /** Vertical distance between lines. */
  linePitchPx: number
  /** Height of a line's box. */
  lineHPx: number
  /** Font size of the typed source. */
  codePx: number
  /** Font size of the chips. */
  chipPx: number
  /** Height of a chip, as the chip stylesheet lays it out. */
  chipHPx: number
  /** Horizontal position of the strip the sockets sit on. */
  stripXPx: number
  /** Vertical centre of the first socket. */
  socketTopPx: number
  /** Vertical distance between sockets. */
  socketPitchPx: number
  /** Radius of a socket. */
  socketRPx: number
  /** Left edge of a primitive's label. */
  labelXPx: number
  /** Font size of a primitive's label. */
  labelPx: number
  /** Height of a label, as the chip stylesheet lays it out. */
  labelHPx: number
  /** Font size of the tally beside a label. */
  tallyPx: number
  /** Vertical centre of a figure's heading. */
  figureLabelYPx: number
  /** Vertical centre of a figure's number. */
  figureValueYPx: number
  /** Font size of a figure's heading. */
  figureLabelPx: number
  /** Font size of a figure's number. */
  figureValuePx: number
  /** Radius of the disc the tick lands on. */
  tickRPx: number
  /** Size of the check beside the test. */
  checkPx: number
}

/** One line of the listing, placed. */
export interface LineSlot {
  /** Left edge of the line's first character or chip. */
  left: number
  /** Vertical centre. */
  y: number
  /** Width of the chip, or 0 for a line without one. */
  chipWidth: number
  /** Width of the typed characters. */
  textWidth: number
  /** Right edge of the line once it is fully typed. */
  end: number
}

/** One wire from a line to the socket of the primitive it rests on, resolved to a curve. */
export interface WireGeometry {
  /** Index of the line the wire leaves. */
  line: number
  /** Index of the primitive the wire reaches. */
  primitive: number
  /** Where the curve leaves the line. */
  start: Point
  /** First control point. */
  control1: Point
  /** Second control point. */
  control2: Point
  /** Where the curve meets the socket. */
  end: Point
  /** The `d` attribute of the curve. */
  d: string
  /** Distance along the curve at each of its sampled points, the last being its whole length. */
  arc: readonly number[]
}

/** One figure of the report, placed. */
export interface FigureSlot {
  /** Left edge of the heading and the number. */
  x: number
  /** Width of the wider of the two. */
  width: number
}

/** Everything that is measured once for a frame. */
export interface BridgeLayout {
  /** The lines, index for index with the listing. */
  lines: readonly LineSlot[]
  /** Centre of each socket, index for index with the primitives. */
  sockets: readonly Point[]
  /** Top and bottom of the strip the sockets sit on. */
  strip: readonly [number, number]
  /** Every wire, in the order its line is typed. */
  wires: readonly WireGeometry[]
  /** Left edge of the report's chip. */
  reportChipLeft: number
  /** Vertical centre of the report. */
  reportY: number
  /** The figures, index for index with the report's. */
  figures: readonly FigureSlot[]
  /** Centre of the disc the tick lands on. */
  tick: Point
}

/**
 * The width the chip stylesheet gives a chip with this many characters.
 *
 * Mirrors the padding, mark, gap and border that `apiChipStyles` sets, so a
 * line can be measured by arithmetic and its wire can leave from its end.
 *
 * @param chars - Characters in the chip's name.
 * @param fontPx - Font size of the chip.
 * @returns Width in CSS pixels.
 * @example The width of `expect` at 12 px
 * ```ts
 * chipWidth(6, 12) // 80.2
 * ```
 */
export function chipWidth(chars: number, fontPx: number): number {
  return round(fontPx * 0.5) + round(fontPx * 1.15) + round(fontPx * 0.45) + chars * fontPx * MONO_ADVANCE + round(fontPx * 0.7) + 2
}

/**
 * The height the chip stylesheet gives a chip.
 *
 * Mirrors the vertical padding, the line height and the border that
 * `apiChipStyles` sets, so a chip can be centred on a line by arithmetic.
 *
 * @param fontPx - Font size of the chip.
 * @returns Height in CSS pixels.
 * @example The height of a chip at 12 px
 * ```ts
 * chipHeight(12) // 20
 * ```
 */
export function chipHeight(fontPx: number): number {
  return fontPx + 2 * round(fontPx * 0.28) + 2
}

/**
 * How wide a run of monospace text is.
 *
 * @param text - The run.
 * @param px - Its font size.
 * @returns Its width in CSS pixels.
 * @example Four characters at the source size
 * ```ts
 * monoWidth('jest', 12) // 28.8
 * ```
 */
export function monoWidth(text: string, px: number): number {
  return text.length * px * MONO_ADVANCE
}

/**
 * Size the frame for the surface it is being drawn for.
 *
 * Everything scales with the profile's width, so the wide profile gets the
 * same composition at a larger size rather than the same size with more room
 * around it.
 *
 * @param profile - The presentation target being composed for.
 * @returns Every measurement the renderer needs.
 * @example The compact profile's strip
 * ```ts
 * bridgeMetrics(resolveProfile('compact')).stripXPx // 454
 * ```
 */
export function bridgeMetrics(profile: MediaProfile): BridgeMetrics {
  const s = profile.width / COMPACT_WIDTH
  const codePx = 12 * s
  const labelPx = 12 * s
  return {
    scale: s,
    widthPx: profile.width,
    sheet: { x: round(24 * s), y: round(26 * s), w: round(376 * s), h: round(308 * s) },
    sheetRadiusPx: round(10 * s),
    filePx: 11 * s,
    fileYPx: round(46 * s),
    ruleYPx: round(60 * s),
    textXPx: round(44 * s),
    gutterXPx: round(33 * s),
    lineTopPx: round(84 * s),
    linePitchPx: round(23 * s),
    lineHPx: round(20 * s),
    codePx,
    chipPx: codePx,
    chipHPx: chipHeight(codePx),
    stripXPx: round(454 * s),
    socketTopPx: round(92 * s),
    socketPitchPx: round(56 * s),
    socketRPx: 4.5 * s,
    labelXPx: round(464 * s),
    labelPx,
    labelHPx: labelPx + 2 * round(labelPx * 0.28),
    tallyPx: 10.5 * s,
    figureLabelYPx: round(298 * s),
    figureValueYPx: round(316 * s),
    figureLabelPx: 10.5 * s,
    figureValuePx: 13 * s,
    tickRPx: round(13 * s),
    checkPx: 11 * s,
  }
}

/**
 * A point on a cubic curve.
 *
 * @param p0 - Start.
 * @param p1 - First control point.
 * @param p2 - Second control point.
 * @param p3 - End.
 * @param t - Position along the curve from 0 to 1.
 * @returns The point at `t`.
 * @example The middle of a straight run
 * ```ts
 * cubicAt({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 20, y: 0 }, { x: 30, y: 0 }, 0.5) // { x: 15, y: 0 }
 * ```
 */
export function cubicAt(p0: Point, p1: Point, p2: Point, p3: Point, t: number): Point {
  const u = 1 - t
  const a = u * u * u
  const b = 3 * u * u * t
  const c = 3 * u * t * t
  const d = t * t * t
  return { x: a * p0.x + b * p1.x + c * p2.x + d * p3.x, y: a * p0.y + b * p1.y + c * p2.y + d * p3.y }
}

/**
 * Place one line of the listing.
 *
 * @param line - The line as the scene wrote it.
 * @param index - Its position in the listing.
 * @param metrics - The measurements this profile is drawn at.
 * @returns Where it sits and how wide it is once typed.
 */
function placeLine(line: BridgeLine, index: number, metrics: BridgeMetrics): LineSlot {
  const left = metrics.textXPx + (line.indent ?? 0) * metrics.codePx * MONO_ADVANCE
  const chip = line.api === undefined ? 0 : chipWidth(line.api.length, metrics.chipPx)
  const text = monoWidth(line.text, metrics.codePx)
  return { left, y: metrics.lineTopPx + metrics.linePitchPx * index, chipWidth: chip, textWidth: text, end: left + chip + text }
}

/**
 * Resolve a wire to the curve drawn for it.
 *
 * The curve leaves the line and meets the socket on horizontal tangents, so
 * it reads as a lead from one to the other rather than as an arc. Its length
 * is measured in straight pieces so a spark can be placed a fraction of the
 * way along it.
 *
 * @param line - Position in the listing of the row the wire leaves.
 * @param primitive - Position in the primitives of the one it reaches.
 * @param start - Where it leaves the row.
 * @param end - Where it meets the socket.
 * @returns The curve, with its sampled lengths.
 */
function wireGeometry(line: number, primitive: number, start: Point, end: Point): WireGeometry {
  const run = max(1, end.x - start.x)
  const control1 = { x: start.x + run * WIRE_BEND, y: start.y }
  const control2 = { x: end.x - run * WIRE_BEND, y: end.y }
  const arc: number[] = [0]
  let previous = start
  let length = 0
  for (let index = 1; index <= ARC_SAMPLES; index += 1) {
    const point = cubicAt(start, control1, control2, end, index / ARC_SAMPLES)
    length += hypot(point.x - previous.x, point.y - previous.y)
    arc.push(length)
    previous = point
  }
  const d = `M ${start.x.toFixed(1)} ${start.y.toFixed(1)} C ${control1.x.toFixed(1)} ${control1.y.toFixed(1)}, ${control2.x.toFixed(1)} ${control2.y.toFixed(1)}, ${end.x.toFixed(1)} ${end.y.toFixed(1)}`
  return { line, primitive, start, control1, control2, end, d, arc }
}

/**
 * Where a point a fraction of the way along a wire sits.
 *
 * @param wire - The curve, with its sampled lengths.
 * @param fraction - Distance along it as a fraction of its length, from 0 to 1.
 * @returns The point on the curve.
 * @example The tip of a wire half drawn
 * ```ts
 * wireAt(wire, 0.5)
 * ```
 */
export function wireAt(wire: WireGeometry, fraction: number): Point {
  const total = wire.arc[wire.arc.length - 1] ?? 0
  const target = total * clamp01(fraction)
  for (let index = 1; index < wire.arc.length; index += 1) {
    const before = wire.arc[index - 1] ?? 0
    const after = wire.arc[index] ?? before
    if (target <= after) {
      const within = after === before ? 0 : (target - before) / (after - before)
      return cubicAt(wire.start, wire.control1, wire.control2, wire.end, (index - 1 + within) / ARC_SAMPLES)
    }
  }
  return wire.end
}

/**
 * Lay the bridge out across the frame.
 *
 * The listing fills the sheet on the left, line under line; the sockets sit
 * on a strip to the right, one per primitive; every line that rests on a
 * primitive gets a wire from its end to that socket, two wires into one
 * socket landing a little apart so both can be counted; and the report sits
 * along the bottom of the sheet, its chip first, its figures next, and the
 * disc the tick lands on last.
 *
 * @param config - The bridge as the scene configured it.
 * @param metrics - The measurements this profile is drawn at.
 * @returns Where everything sits.
 * @example Where the first wire leaves its line
 * ```ts
 * bridgeLayout(config, bridgeMetrics(profile)).wires[0]?.start
 * ```
 */
export function bridgeLayout(config: BridgeConfig, metrics: BridgeMetrics): BridgeLayout {
  const lines = config.lines.map((line, index) => placeLine(line, index, metrics))
  const sockets = config.primitives.map(
    (_, index): Point => ({ x: metrics.stripXPx, y: metrics.socketTopPx + metrics.socketPitchPx * index })
  )
  const siblings = config.primitives.map((_, primitive) => config.lines.filter((line) => line.rests === primitive).length)
  const landed = config.primitives.map(() => 0)
  const wires = config.lines.flatMap((line, index): WireGeometry[] => {
    const slot = lines[index]
    const socket = line.rests === undefined ? undefined : sockets[line.rests]
    if (line.rests === undefined || slot === undefined || socket === undefined) {
      return []
    }
    const ordinal = landed[line.rests] ?? 0
    landed[line.rests] = ordinal + 1
    const spread = (ordinal - ((siblings[line.rests] ?? 1) - 1) / 2) * LANDING_SPREAD * metrics.scale
    const start = { x: slot.end + WIRE_GAP * metrics.scale, y: slot.y }
    const end = { x: socket.x - metrics.socketRPx - 1, y: socket.y + spread }
    return [wireGeometry(index, line.rests, start, end)]
  })
  const first = sockets[0]?.y ?? metrics.socketTopPx
  const last = sockets[sockets.length - 1]?.y ?? first
  const strip: readonly [number, number] = [first - STRIP_OVERRUN * metrics.scale, last + STRIP_OVERRUN * metrics.scale]
  let cursor = metrics.textXPx + chipWidth(config.report.api.length, metrics.chipPx) + REPORT_GAP * metrics.scale
  const figures = config.report.figures.map((figure): FigureSlot => {
    const width = round(
      max(figure.label.length * metrics.figureLabelPx * SANS_ADVANCE, monoWidth(figure.value.toFixed(2), metrics.figureValuePx))
    )
    const slot = { x: cursor, width }
    cursor += width + FIGURE_GAP * metrics.scale
    return slot
  })
  const reportY = (metrics.figureLabelYPx + metrics.figureValueYPx) / 2
  const tick = { x: cursor - FIGURE_GAP * metrics.scale + REPORT_GAP * metrics.scale + metrics.tickRPx, y: reportY }
  return { lines, sockets, strip, wires, reportChipLeft: metrics.textXPx, reportY, figures, tick }
}
