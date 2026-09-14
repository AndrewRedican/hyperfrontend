import type { ForgeConfig } from '../models/forge'
import type { MediaProfile } from '../models/profile'
import { hypot, max, min, round } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'
import { DOTS_PER_STREAM } from './timeline'

/** A point in the frame, in CSS pixels. */
export interface Point {
  /** Horizontal position. */
  x: number
  /** Vertical position. */
  y: number
}

/** A rectangle in the frame, by its top-left corner. */
export interface Box {
  /** Left edge. */
  x: number
  /** Top edge. */
  y: number
  /** Width. */
  width: number
  /** Height. */
  height: number
}

/** How the frame is sized for the surface it is being drawn for. */
export interface ForgeMetrics {
  /** Margin between the drawing and the edge of the frame. */
  insetPx: number
  /** Font size of a file name in the tree. */
  namePx: number
  /** Font size of a source card's name. */
  cardPx: number
  /** Font size of the API chip. */
  chipPx: number
  /** Font size of a format pill and a manifest key. */
  pillPx: number
  /** Font size of the directory labels and the manifest's name. */
  labelPx: number
  /** Radius of one entry dot. */
  dotPx: number
  /** Weight of every outline. */
  strokePx: number
}

/** One source card and the path its stream takes. */
export interface CardLayout {
  /** The card. */
  box: Box
  /** Where the stream's dots wait, one slot per dot. */
  queue: readonly Point[]
  /** Where the stream enters the builder. */
  entry: Point
}

/** One file in the output tree. */
export interface TileLayout {
  /** The tile. */
  box: Box
  /** Where a wire to the manifest leaves it. */
  port: Point
  /** Index of the entry that landed it. */
  entry: number
  /** Index of the file within that entry. */
  output: number
}

/** One key on the manifest sheet. */
export interface KeyLayout {
  /** The key's name. */
  key: string
  /** The pill. */
  box: Box
  /** Centre of the pill's top edge, where wires land. */
  top: Point
}

/** The bracket that spans every file in the tree. */
export interface BracketLayout {
  /** Horizontal position of its spine. */
  x: number
  /** Top of the spine. */
  top: number
  /** Bottom of the spine. */
  bottom: number
  /** How far its two ticks reach back toward the tree. */
  tick: number
}

/** Where everything on the stage sits. */
export interface ForgeLayout {
  /** The source cards, in entry order. */
  cards: readonly CardLayout[]
  /** Where the source directory's label sits. */
  sourceLabel: Point
  /** Where the output directory's label sits. */
  outputLabel: Point
  /** The builder's outline, as vertices. */
  hexagon: readonly Point[]
  /** Centre of the builder. */
  centre: Point
  /** Half the builder's width. */
  halfWidth: number
  /** Half the builder's height. */
  halfHeight: number
  /** Centre of the cluster the entry's dots gather in while it is being built. */
  cluster: Point
  /** Radius of that cluster. */
  clusterRadius: number
  /** Centre of the API chip. */
  chip: Point
  /** Where a freshly built file's thread leaves the builder. */
  emit: Point
  /** Every file in the tree, in the order they pop. */
  tiles: readonly TileLayout[]
  /** The bracket down the side of the tree. */
  bracket: BracketLayout
  /** The manifest sheet, in its resting place. */
  sheet: Box
  /** Where the manifest's name sits on the sheet. */
  sheetLabel: Point
  /** The keys on the sheet. */
  keys: readonly KeyLayout[]
}

/** Width the composition is authored at; every other width is scaled from it. */
const REFERENCE_WIDTH = 640

/** Advance of one monospace character as a fraction of its font size. */
const MONO_ADVANCE = 0.6

/**
 * Size the frame for the surface it is being drawn for.
 *
 * @param profile - The presentation target being composed for.
 * @returns Every measurement the renderer needs.
 */
export function forgeMetrics(profile: MediaProfile): ForgeMetrics {
  const wide = profile.width > REFERENCE_WIDTH
  return {
    insetPx: wide ? 30 : 22,
    namePx: wide ? 13 : 11,
    cardPx: wide ? 14 : 11.5,
    chipPx: wide ? 14 : 12,
    pillPx: wide ? 13 : 11,
    labelPx: wide ? 13 : 11,
    dotPx: wide ? 4.5 : 3.5,
    strokePx: 1.5,
  }
}

/**
 * How wide a run of monospace text is.
 *
 * @param text - The run.
 * @param fontPx - Its font size.
 * @returns Its width in pixels.
 */
export function monoWidth(text: string, fontPx: number): number {
  return text.length * fontPx * MONO_ADVANCE
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
 * The part of a cubic curve from its start to a point along it.
 *
 * Splitting the curve rather than masking it is what lets a dashed wire grow
 * from its file: the dashes stay anchored at the start and the end simply
 * gets further away.
 *
 * @param p0 - Start.
 * @param p1 - First control point.
 * @param p2 - Second control point.
 * @param p3 - End.
 * @param t - How far along the curve the prefix reaches, from 0 to 1.
 * @returns The four points of the prefix, as a cubic of its own.
 */
export function cubicPrefix(p0: Point, p1: Point, p2: Point, p3: Point, t: number): readonly [Point, Point, Point, Point] {
  const mix = (a: Point, b: Point): Point => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t })
  const q0 = mix(p0, p1)
  const q1 = mix(p1, p2)
  const q2 = mix(p2, p3)
  const r0 = mix(q0, q1)
  const r1 = mix(q1, q2)
  return [p0, q0, r0, mix(r0, r1)]
}

/**
 * The `d` attribute of one cubic curve.
 *
 * @param points - Start, two control points, end.
 * @returns The path data.
 */
export function cubicPath(points: readonly [Point, Point, Point, Point]): string {
  const [p0, p1, p2, p3] = points
  return `M ${p0.x.toFixed(1)} ${p0.y.toFixed(1)} C ${p1.x.toFixed(1)} ${p1.y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}, ${p3.x.toFixed(1)} ${p3.y.toFixed(1)}`
}

/**
 * The `d` attribute of a polygon with its corners rounded off.
 *
 * @param points - The vertices, in order.
 * @param radius - How far back from each vertex the rounding starts.
 * @returns The path data.
 */
export function roundedPolygonPath(points: readonly Point[], radius: number): string {
  const parts: string[] = []
  points.forEach((vertex, index) => {
    const previous = points[(index + points.length - 1) % points.length] ?? vertex
    const next = points[(index + 1) % points.length] ?? vertex
    const toPrevious = { x: previous.x - vertex.x, y: previous.y - vertex.y }
    const toNext = { x: next.x - vertex.x, y: next.y - vertex.y }
    const lengthPrevious = max(1, hypot(toPrevious.x, toPrevious.y))
    const lengthNext = max(1, hypot(toNext.x, toNext.y))
    const cut = min(radius, lengthPrevious / 2, lengthNext / 2)
    const from = { x: vertex.x + (toPrevious.x / lengthPrevious) * cut, y: vertex.y + (toPrevious.y / lengthPrevious) * cut }
    const to = { x: vertex.x + (toNext.x / lengthNext) * cut, y: vertex.y + (toNext.y / lengthNext) * cut }
    parts.push(
      `${index === 0 ? 'M' : 'L'} ${from.x.toFixed(1)} ${from.y.toFixed(1)} Q ${vertex.x.toFixed(1)} ${vertex.y.toFixed(1)} ${to.x.toFixed(1)} ${to.y.toFixed(1)}`
    )
  })
  return `${parts.join(' ')} Z`
}

/**
 * The curve an entry's dot follows from its queue slot into the builder.
 *
 * @param from - The queue slot.
 * @param to - Where the dot settles inside the builder.
 * @returns Start, two control points, end.
 */
export function streamCurve(from: Point, to: Point): readonly [Point, Point, Point, Point] {
  const dx = to.x - from.x
  return [from, { x: from.x + dx * 0.55, y: from.y }, { x: to.x - dx * 0.35, y: to.y }, to]
}

/**
 * The curve a wire follows from a file's port down to a manifest key.
 *
 * The first control point pulls the wire down the channel beside the tree
 * before it swings across under the builder, so no wire crosses a file below
 * the one it left; the second sits straight above the key so every wire
 * arrives at its key vertically. Both reach less far the shorter the drop,
 * so a wire from the bottom of the tree falls straight rather than hooking.
 *
 * @param port - Where the wire leaves the file.
 * @param landing - Where it lands on the key.
 * @returns Start, two control points, end.
 */
export function wireCurve(port: Point, landing: Point): readonly [Point, Point, Point, Point] {
  const drop = max(1, landing.y - port.y)
  const reach = min(1, drop / 220)
  return [port, { x: port.x - 55 * reach, y: port.y + 100 * reach }, { x: landing.x, y: landing.y - 55 * reach }, landing]
}

/**
 * Lay the stage out for one frame size.
 *
 * Authored at 640 by 360 and scaled to any other width, so the wide profile
 * gets the same composition at a larger size rather than a different one.
 *
 * @param config - The forge as the scene configured it.
 * @param profile - The presentation target being composed for.
 * @param metrics - The measurements this profile is drawn at.
 * @returns Where everything sits.
 */
export function forgeLayout(config: ForgeConfig, profile: MediaProfile, metrics: ForgeMetrics): ForgeLayout {
  const k = profile.width / REFERENCE_WIDTH
  const s = (value: number): number => round(value * k * 10) / 10

  // why: the tree is laid out first because the builder and the cards centre on it vertically, whatever number of files it holds
  const tileHeight = s(18)
  const pitch = s(20)
  const groupGap = s(6)
  const tileX = s(396)
  const tileWidth = s(212)
  const tiles: TileLayout[] = []
  let y = s(78)
  config.entries.forEach((entry, entryIndex) => {
    if (entryIndex > 0) {
      y += groupGap
    }
    entry.outputs.forEach((_, outputIndex) => {
      tiles.push({
        box: { x: tileX, y: y - tileHeight / 2, width: tileWidth, height: tileHeight },
        port: { x: tileX, y },
        entry: entryIndex,
        output: outputIndex,
      })
      y += pitch
    })
  })
  const treeTop = (tiles[0]?.box.y ?? s(78)) - s(1)
  const last = tiles[tiles.length - 1]
  const treeBottom = (last === undefined ? s(78) : last.box.y + last.box.height) + s(1)
  const centreY = (treeTop + treeBottom) / 2

  const centre = { x: s(288), y: centreY }
  const halfWidth = s(50)
  const halfHeight = s(52)
  // why: flat left and right faces, so a stream has a face to enter and the threads a face to leave, and the chip has the full width
  const hexagon: Point[] = [
    { x: centre.x, y: centre.y - halfHeight },
    { x: centre.x + halfWidth, y: centre.y - halfHeight / 2 },
    { x: centre.x + halfWidth, y: centre.y + halfHeight / 2 },
    { x: centre.x, y: centre.y + halfHeight },
    { x: centre.x - halfWidth, y: centre.y + halfHeight / 2 },
    { x: centre.x - halfWidth, y: centre.y - halfHeight / 2 },
  ]
  const cluster = { x: centre.x, y: centre.y - s(16) }

  const cardX = s(26)
  const cardWidth = s(137)
  const cardHeight = s(32)
  const cardSpread = s(58)
  const count = max(1, config.entries.length)
  // why: the cards sit the same distance above and below the builder's centre however many there are, so the streams enter at mirrored angles
  const cardStep = count > 1 ? (cardSpread * 2) / (count - 1) : 0
  const cards: CardLayout[] = config.entries.map((_, index) => {
    const cardY = centreY + (index - (count - 1) / 2) * cardStep
    const queue: Point[] = []
    for (let dot = 0; dot < DOTS_PER_STREAM; dot += 1) {
      queue.push({ x: cardX + cardWidth + s(9) + dot * s(9), y: cardY })
    }
    return {
      box: { x: cardX, y: cardY - cardHeight / 2, width: cardWidth, height: cardHeight },
      queue,
      entry: { x: centre.x - halfWidth, y: centre.y + (index - (count - 1) / 2) * s(26) },
    }
  })

  const sheet: Box = { x: centre.x - halfWidth - s(2), y: s(270), width: s(612) - (centre.x - halfWidth - s(2)), height: s(56) }
  const pillHeight = s(20)
  const pillPad = s(6)
  // why: the keys sit on the sheet's top row so a wire ends the moment it reaches the sheet, and the file's name goes below them where nothing has to cross it
  const pillTop = sheet.y + s(8)
  const keys: KeyLayout[] = []
  let keyX = sheet.x + s(14)
  for (const key of config.manifest.keys) {
    const width = round(monoWidth(key, metrics.pillPx) + pillPad * 2)
    const x = key === config.manifest.spanKey ? sheet.x + sheet.width - s(14) - width : keyX
    keys.push({ key, box: { x, y: pillTop, width, height: pillHeight }, top: { x: x + width / 2, y: pillTop } })
    if (key !== config.manifest.spanKey) {
      keyX = x + width + s(10)
    }
  }

  return {
    cards,
    sourceLabel: { x: cardX, y: s(60) },
    outputLabel: { x: tileX, y: s(60) },
    hexagon,
    centre,
    halfWidth,
    halfHeight,
    cluster,
    clusterRadius: s(9),
    chip: { x: centre.x, y: centre.y + s(15) },
    emit: { x: centre.x + halfWidth, y: centre.y },
    tiles,
    bracket: { x: profile.width - metrics.insetPx, top: treeTop, bottom: treeBottom, tick: s(6) },
    sheet,
    sheetLabel: { x: sheet.x + s(14), y: sheet.y + sheet.height - s(10) },
    keys,
  }
}
