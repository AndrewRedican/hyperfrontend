import type { DerivedConfig, DerivedName } from '../models/derived'
import type { MediaProfile } from '../models/profile'
import { hypot, min, round } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'

/** Width of the composition every measurement is stated for; other widths scale from it. */
const COMPACT_WIDTH = 640

/** Advance width of the monospace face as a fraction of its size, which the named face and its fallbacks share. */
const MONO_ADVANCE = 0.6

/** Space between the rail's label and its first chip, at compact size. */
const RAIL_LABEL_GAP = 20

/** Space between chips on the rail, at compact size. */
const CHIP_GAP = 10

/** How far a wire's control points sit from its ends, as a fraction of its horizontal run. */
const WIRE_BEND = 0.45

/** How far below the rail a token skims while it crosses to the lamps' column, at compact size. */
const DROP_SKIM = 22

/** How far above a lamp the token's path turns down onto it, at compact size. */
const DROP_BOW = 70

/** How far to the right of a lamp the token's descent starts, as a fraction of the distance it crosses, and its cap at compact size. */
const DROP_LEAN = 0.15

/** The most a token's descent starts to the right of its lamp, at compact size. */
const DROP_LEAN_MAX = 40

/** How far below the rail's centre the token sets off from, at compact size: the bottom edge of a chip. */
const CHIP_DROP_OFFSET = 10

/** How far a wire starts past a lamp's rim and stops short of a band's edge, at compact size. */
const WIRE_CLEARANCE = 3

/** How many straight pieces a wire is measured in when a fraction of its length is turned into a point. */
const ARC_SAMPLES = 32

/** A point in the frame, in CSS pixels. */
export interface Point {
  /** Horizontal position. */
  x: number
  /** Vertical position. */
  y: number
}

/** How the frame is sized for the surface it is being drawn for. */
export interface DerivedMetrics {
  /** Factor every measurement is scaled by from the compact composition. */
  scale: number
  /** Width of the frame. */
  widthPx: number
  /** Font size of the action chips and the header chip. */
  chipPx: number
  /** Font size of a lamp's flag name. */
  labelPx: number
  /** Font size of a derived name. */
  namePx: number
  /** Vertical centre of the action rail. */
  railYPx: number
  /** Height of a chip, as the chip stylesheet lays it out. */
  chipHPx: number
  /** Radius of a lamp. */
  lampRPx: number
  /** Horizontal centre of the lamps. */
  lampXPx: number
  /** Vertical centre of the first lamp. */
  lampTopPx: number
  /** Vertical distance between lamps. */
  lampGapPx: number
  /** Space between a lamp's rim and the end of its name. */
  lampLabelGapPx: number
  /** Left edge of a derived name's band. */
  nameXPx: number
  /** Vertical centre of the first derived name. */
  nameTopPx: number
  /** Vertical distance between derived names. */
  nameGapPx: number
  /** Vertical centre of the header chip above the names. */
  headYPx: number
  /** Height of a derived name's band. */
  bandHPx: number
  /** Horizontal padding inside a band. */
  bandPadPx: number
  /** Radius of the dot at the head of a lit band. */
  dotRPx: number
  /** Radius of the action token. */
  tokenRPx: number
}

/** Where one action's chip sits on the rail. */
export interface ChipSlot {
  /** Left edge. */
  left: number
  /** Width, as the chip stylesheet will lay it out. */
  width: number
  /** Horizontal centre, where the token leaves from. */
  centre: number
}

/** One wire from a lamp to a name that reads its flag, resolved to a curve. */
export interface WireGeometry {
  /** Index of the lamp the wire leaves. */
  lamp: number
  /** Index of the name the wire reaches. */
  name: number
  /** Whether the name reads the flag negated, so the wire carries nothing while the lamp is lit. */
  negated: boolean
  /** Where the curve leaves the lamp. */
  start: Point
  /** First control point. */
  control1: Point
  /** Second control point. */
  control2: Point
  /** Where the curve meets the band. */
  end: Point
  /** The `d` attribute of the curve. */
  d: string
  /** Distance along the curve at each of its sampled points, the last being its whole length. */
  arc: readonly number[]
}

/** The curve a token falls along, from a chip to a lamp. */
export interface DropPath {
  /** Where the token sets off. */
  from: Point
  /** First control point. */
  control1: Point
  /** Second control point. */
  control2: Point
  /** Where the token lands. */
  to: Point
}

/** Every position the renderer draws at. */
export interface DerivedLayout {
  /** Left edge of the rail's label. */
  railLabelLeft: number
  /** One slot per action, index for index. */
  chips: readonly ChipSlot[]
  /** Centre of each lamp, index for index. */
  lamps: readonly Point[]
  /** Left edge and vertical centre of each name's band, index for index. */
  names: readonly Point[]
  /** Every wire, in drawing order. */
  wires: readonly WireGeometry[]
}

/**
 * Size the frame for the surface it is being drawn for.
 *
 * @param profile - The presentation target being composed for.
 * @returns Every measurement the renderer needs.
 * @example Measurements for the compact profile
 * ```ts
 * derivedMetrics({ id: 'compact', intent: '', width: 640, height: 360, scale: 2, fps: 12 }).lampXPx // 150
 * ```
 */
export function derivedMetrics(profile: MediaProfile): DerivedMetrics {
  const s = profile.width / COMPACT_WIDTH
  return {
    scale: s,
    widthPx: profile.width,
    chipPx: 12 * s,
    labelPx: 12 * s,
    namePx: 12.5 * s,
    railYPx: round(40 * s),
    chipHPx: chipHeight(12 * s),
    lampRPx: 8 * s,
    lampXPx: round(150 * s),
    lampTopPx: round(126 * s),
    lampGapPx: round(52 * s),
    lampLabelGapPx: round(10 * s),
    nameXPx: round(456 * s),
    nameTopPx: round(112 * s),
    nameGapPx: round(33 * s),
    headYPx: round(78 * s),
    bandHPx: round(22 * s),
    bandPadPx: round(10 * s),
    dotRPx: 3 * s,
    tokenRPx: 6 * s,
  }
}

/**
 * The width the chip stylesheet gives a chip with this many characters.
 *
 * Mirrors the padding, mark, gap and border that `apiChipStyles` sets, so a
 * chip can be placed by arithmetic and the token can leave from its centre.
 *
 * @param chars - Characters in the chip's name.
 * @param fontPx - Font size of the chip.
 * @returns Width in CSS pixels.
 * @example The width of `start()` at 12 px
 * ```ts
 * chipWidth(7, 12) // 85.4
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
 * A point on a cubic curve.
 *
 * @param p0 - Start.
 * @param p1 - First control point.
 * @param p2 - Second control point.
 * @param p3 - End.
 * @param t - Position along the curve from 0 to 1.
 * @returns The point at `t`.
 * @example The middle of a curve
 * ```ts
 * cubicAt({ x: 0, y: 0 }, { x: 50, y: 0 }, { x: 50, y: 100 }, { x: 100, y: 100 }, 0.5) // { x: 50, y: 50 }
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
 * Resolve one wire to its curve.
 *
 * @param lamp - Index of the lamp.
 * @param name - Index of the name.
 * @param negated - Whether the name reads the flag negated.
 * @param from - Centre of the lamp.
 * @param to - Left edge and centre of the band.
 * @param metrics - The measurements this profile is drawn at.
 * @returns The curve, its control points and its sampled lengths.
 */
function wireGeometry(lamp: number, name: number, negated: boolean, from: Point, to: Point, metrics: DerivedMetrics): WireGeometry {
  const clearance = WIRE_CLEARANCE * metrics.scale
  const start = { x: from.x + metrics.lampRPx + clearance, y: from.y }
  const end = { x: to.x - clearance, y: to.y }
  const bend = (end.x - start.x) * WIRE_BEND
  const control1 = { x: start.x + bend, y: start.y }
  const control2 = { x: end.x - bend, y: end.y }
  const arc: number[] = [0]
  let previous = start
  for (let index = 1; index <= ARC_SAMPLES; index += 1) {
    const point = cubicAt(start, control1, control2, end, index / ARC_SAMPLES)
    arc.push((arc[index - 1] ?? 0) + hypot(point.x - previous.x, point.y - previous.y))
    previous = point
  }
  const d = `M ${start.x.toFixed(1)} ${start.y.toFixed(1)} C ${control1.x.toFixed(1)} ${control1.y.toFixed(1)}, ${control2.x.toFixed(1)} ${control2.y.toFixed(1)}, ${end.x.toFixed(1)} ${end.y.toFixed(1)}`
  return { lamp, name, negated, start, control1, control2, end, d, arc }
}

/**
 * The flags a name reads, each once, with whether it is read negated.
 *
 * @param name - The selector.
 * @returns Flag names paired with their negation, in the order the selector states them.
 */
function readsOf(name: DerivedName): readonly (readonly [string, boolean])[] {
  const reads = [...name.all, ...(name.any ?? [])]
  return reads
    .filter((read, index) => reads.findIndex((other) => other.flag === read.flag) === index)
    .map((read) => [read.flag, reads.every((other) => other.flag !== read.flag || !other.value)] as const)
}

/**
 * Lay the frame out: the rail, the lamps, the names and every wire between them.
 *
 * @param config - The store as the scene configured it.
 * @param metrics - The measurements this profile is drawn at.
 * @returns Every position the renderer draws at.
 * @example Where the second lamp sits
 * ```ts
 * derivedLayout(config, metrics).lamps[1] // { x: 150, y: 178 }
 * ```
 */
export function derivedLayout(config: DerivedConfig, metrics: DerivedMetrics): DerivedLayout {
  const labelWidth = config.railLabel.length * metrics.labelPx * MONO_ADVANCE
  const widths = config.actions.map((action) => chipWidth(action.name.length, metrics.chipPx))
  const chipGap = CHIP_GAP * metrics.scale
  const railWidth =
    labelWidth + RAIL_LABEL_GAP * metrics.scale + widths.reduce((sum, width) => sum + width, 0) + chipGap * (widths.length - 1)
  const railLabelLeft = round((metrics.widthPx - railWidth) / 2)
  let cursor = railLabelLeft + labelWidth + RAIL_LABEL_GAP * metrics.scale
  const chips = widths.map((width) => {
    const slot = { left: round(cursor), width, centre: round(cursor + width / 2) }
    cursor += width + chipGap
    return slot
  })
  const lamps = config.lamps.map((lamp, index) => ({ x: metrics.lampXPx, y: metrics.lampTopPx + index * metrics.lampGapPx }))
  const names = config.names.map((name, index) => ({ x: metrics.nameXPx, y: metrics.nameTopPx + index * metrics.nameGapPx }))
  const wires: WireGeometry[] = []
  config.names.forEach((name, nameIndex) => {
    const to = names[nameIndex]
    if (to === undefined) {
      return
    }
    for (const [flag, negated] of readsOf(name)) {
      const lampIndex = config.lamps.findIndex((lamp) => lamp.flag === flag)
      const from = lamps[lampIndex]
      if (from !== undefined) {
        wires.push(wireGeometry(lampIndex, nameIndex, negated, from, to, metrics))
      }
    }
  })
  return { railLabelLeft, chips, lamps, names, wires }
}

/**
 * The point a stated fraction of the way along a wire, by length rather than by parameter.
 *
 * A dash drawn with `pathLength` reveals the curve by length, so the spark at
 * its tip has to be placed by length too or it drifts off the end of the dash
 * where the curve bends.
 *
 * @param wire - The wire's geometry.
 * @param fraction - How much of the wire's length has been travelled, from 0 to 1.
 * @returns The point on the curve.
 * @example The tip of a wire drawn half way
 * ```ts
 * wireAt(wire, 0.5)
 * ```
 */
export function wireAt(wire: WireGeometry, fraction: number): Point {
  const total = wire.arc[wire.arc.length - 1] ?? 0
  const wanted = total * fraction
  let index = 0
  while (index < wire.arc.length - 1 && (wire.arc[index + 1] ?? 0) < wanted) {
    index += 1
  }
  const before = wire.arc[index] ?? 0
  const after = wire.arc[index + 1] ?? before
  const within = after > before ? (wanted - before) / (after - before) : 0
  return cubicAt(wire.start, wire.control1, wire.control2, wire.end, (index + within) / ARC_SAMPLES)
}

/**
 * The curve a token falls along from a chip to the lamp it lights.
 *
 * A chip far along the rail sits over the names' header, so a token does
 * not fall straight: it skims left under the rail toward the lamps' column
 * first, then turns down onto its lamp from the upper right. A chip already
 * over the column gets what that collapses to, a plain drop.
 *
 * @param chip - The chip's slot on the rail.
 * @param lamp - Centre of the lamp.
 * @param metrics - The measurements this profile is drawn at.
 * @returns The path, leaving the chip and arriving at the lamp from above.
 * @example The fall from the first chip to the first lamp
 * ```ts
 * dropPath(layout.chips[0], layout.lamps[0], metrics)
 * ```
 */
export function dropPath(chip: ChipSlot, lamp: Point, metrics: DerivedMetrics): DropPath {
  const from = { x: chip.centre, y: metrics.railYPx + CHIP_DROP_OFFSET * metrics.scale }
  const run = from.x - lamp.x
  const lean = min(DROP_LEAN_MAX * metrics.scale, DROP_LEAN * run)
  return {
    from,
    control1: { x: lamp.x + run * 0.3, y: from.y + DROP_SKIM * metrics.scale },
    control2: { x: lamp.x + lean, y: lamp.y - DROP_BOW * metrics.scale },
    to: lamp,
  }
}

/**
 * Where a token is when it has fallen part of the way.
 *
 * @param path - The curve it falls along.
 * @param t - Progress along it from 0 to 1, usually already eased.
 * @returns The point on the curve.
 * @example A token half way down
 * ```ts
 * dropAt(path, 0.5)
 * ```
 */
export function dropAt(path: DropPath, t: number): Point {
  return cubicAt(path.from, path.control1, path.control2, path.to, t)
}
