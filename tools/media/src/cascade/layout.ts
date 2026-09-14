import type { CascadeConfig, ChangelogToken } from '../models/cascade'
import type { MediaProfile } from '../models/profile'
import { max, round } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'

/** Width of the composition every measurement is stated for; other widths scale from it. */
const COMPACT_WIDTH = 640

/** Advance width of the monospace face as a fraction of its size, which the named face and its fallbacks share. */
export const MONO_ADVANCE = 0.6

/** Average advance of the sans face as a fraction of its size, for sizing a tile round its label. */
const SANS_ADVANCE = 0.52

/** How far a label sits above a row's centre and a value below it, as a fraction of the tile's height. */
const TILE_SPLIT = 0.21

/** Space between the arrow and the version either side of it, at compact size. */
const ARROW_GAP = 10

/** Length of the arrow between the two versions, at compact size. */
const ARROW_LEN = 40

/** Space between the end of the changelog line and the file's name, at compact size. */
const FILE_GAP = 14

/** A point in the frame, in CSS pixels. */
export interface Point {
  /** Horizontal position. */
  x: number
  /** Vertical position. */
  y: number
}

/** How the frame is sized for the surface it is being drawn for. */
export interface CascadeMetrics {
  /** Factor every measurement is scaled by from the compact composition. */
  scale: number
  /** Width of the frame. */
  widthPx: number
  /** Left edge of every row's content. */
  rowXPx: number
  /** Vertical centre of the first row. */
  rowTopPx: number
  /** Vertical distance between rows. */
  rowGapPx: number
  /** Horizontal position of the spine. */
  spineXPx: number
  /** Length of the tick from the spine into a row. */
  tickPx: number
  /** Radius of the node the spine carries at each row. */
  nodeRPx: number
  /** Right edge of the step chips. */
  chipRightPx: number
  /** Height of a chip, as the chip stylesheet lays it out. */
  chipHPx: number
  /** Font size of the step chips. */
  chipPx: number
  /** Font size of the header line. */
  headerPx: number
  /** Font size of a field's label. */
  labelPx: number
  /** Font size of a field's value. */
  valuePx: number
  /** Font size of the two versions. */
  versionPx: number
  /** Font size of the changelog line. */
  linePx: number
  /** Font size of the file's name. */
  filePx: number
  /** Height of a field tile. */
  tileHPx: number
  /** Horizontal padding inside a tile. */
  tilePadPx: number
  /** Space between tiles. */
  tileGapPx: number
  /** Horizontal padding inside the pill a travelling copy rides on. */
  pillPadPx: number
  /** Height of the window a digit rolls through. */
  rollHPx: number
}

/** One span of the header, placed. */
export interface HeaderSpan {
  /** Left edge. */
  x: number
  /** Width of the span's characters. */
  width: number
  /** The span's characters. */
  text: string
}

/** One field tile, placed. */
export interface Tile {
  /** Left edge. */
  x: number
  /** Top edge. */
  y: number
  /** Width. */
  width: number
  /** Height. */
  height: number
  /** Centre of the label. */
  label: Point
  /** Centre of the value. */
  value: Point
}

/** One character of a version, placed. */
export interface Glyph {
  /** Horizontal centre. */
  x: number
  /** The character. */
  text: string
}

/** The version row, placed. */
export interface VersionLayout {
  /** Vertical centre of the row. */
  y: number
  /** The version on disk, character by character. */
  from: readonly Glyph[]
  /** The version after the bump, character by character. */
  to: readonly Glyph[]
  /** Where the arrow starts. */
  arrowFrom: number
  /** Where the arrow ends. */
  arrowTo: number
}

/** One token of the changelog line, placed. */
export interface TokenSlot {
  /** Left edge. */
  x: number
  /** Width of the token's characters, wrap included. */
  width: number
  /** Centre of the token. */
  centre: Point
}

/** Everything that is measured once for a frame. */
export interface CascadeLayout {
  /** Vertical centre of each row, top to bottom. */
  rows: readonly number[]
  /** The header's spans. */
  header: readonly HeaderSpan[]
  /** The field tiles, index for index with the fields. */
  fields: readonly Tile[]
  /** The bump tile. */
  bump: Tile
  /** The version row. */
  version: VersionLayout
  /** The changelog tokens, index for index with the tokens. */
  tokens: readonly TokenSlot[]
  /** Left edge of the file's name. */
  fileX: number
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
 * @example The compact profile's spine
 * ```ts
 * cascadeMetrics(resolveProfile('compact')).spineXPx // 240
 * ```
 */
export function cascadeMetrics(profile: MediaProfile): CascadeMetrics {
  const scale = profile.width / COMPACT_WIDTH
  return {
    scale,
    widthPx: profile.width,
    rowXPx: round(260 * scale),
    rowTopPx: round(52 * scale),
    rowGapPx: round(66 * scale),
    spineXPx: round(240 * scale),
    tickPx: round(12 * scale),
    nodeRPx: round(4 * scale),
    chipRightPx: round(224 * scale),
    chipHPx: round(22 * scale),
    chipPx: round(12 * scale),
    headerPx: round(15 * scale),
    labelPx: 11.5 * scale,
    valuePx: 12.5 * scale,
    versionPx: round(20 * scale),
    linePx: round(13 * scale),
    filePx: round(11 * scale),
    tileHPx: round(40 * scale),
    tilePadPx: round(10 * scale),
    tileGapPx: round(12 * scale),
    pillPadPx: round(7 * scale),
    rollHPx: round(24 * scale),
  }
}

/**
 * How wide a run of monospace text is.
 *
 * @param text - The run.
 * @param px - Its font size.
 * @returns Its width in CSS pixels.
 * @example Four characters at the value size
 * ```ts
 * monoWidth('feat', 12.5) // 30
 * ```
 */
export function monoWidth(text: string, px: number): number {
  return text.length * px * MONO_ADVANCE
}

/**
 * A point on the path a copy travels, bowed sideways so it clears what it crosses.
 *
 * @param from - Where the copy sets off.
 * @param to - Where it lands.
 * @param bow - How far right of the straight line the middle of the path sits.
 * @param t - Position along the path from 0 to 1.
 * @returns The point at `t`.
 * @example Half way along a straight drop
 * ```ts
 * alongBow({ x: 10, y: 0 }, { x: 10, y: 100 }, 0, 0.5) // { x: 10, y: 50 }
 * ```
 */
export function alongBow(from: Point, to: Point, bow: number, t: number): Point {
  const u = 1 - t
  const cx = (from.x + to.x) / 2 + bow
  const cy = (from.y + to.y) / 2
  return { x: u * u * from.x + 2 * u * t * cx + t * t * to.x, y: u * u * from.y + 2 * u * t * cy + t * t * to.y }
}

/**
 * Place one tile with its label above its value.
 *
 * @param x - Left edge.
 * @param rowY - Vertical centre of the row it sits in.
 * @param label - The field's name.
 * @param value - The value it will hold.
 * @param metrics - The measurements this profile is drawn at.
 * @returns Where the tile sits and where its label and value are centred.
 */
function placeTile(x: number, rowY: number, label: string, value: string, metrics: CascadeMetrics): Tile {
  const width = round(max(label.length * metrics.labelPx * SANS_ADVANCE, monoWidth(value, metrics.valuePx)) + metrics.tilePadPx * 2)
  const lift = metrics.tileHPx * TILE_SPLIT
  return {
    x,
    y: rowY - metrics.tileHPx / 2,
    width,
    height: metrics.tileHPx,
    label: { x: x + width / 2, y: rowY - lift },
    value: { x: x + width / 2, y: rowY + lift },
  }
}

/**
 * The characters of a version, each centred on its own advance.
 *
 * @param version - The version whose characters are placed.
 * @param left - Left edge of its first character.
 * @param metrics - The measurements this profile is drawn at.
 * @returns One glyph per character.
 */
function placeGlyphs(version: string, left: number, metrics: CascadeMetrics): readonly Glyph[] {
  const advance = metrics.versionPx * MONO_ADVANCE
  return [...version].map((text, index) => ({ x: left + advance * (index + 0.5), text }))
}

/**
 * The full text of a token: its wrap either side of its text.
 *
 * @param token - The token whose wrap and text are joined.
 * @returns What is drawn for it.
 * @example A bold scope label
 * ```ts
 * tokenText({ text: 'api:', wrap: '**' }) // '**api:**'
 * ```
 */
export function tokenText(token: ChangelogToken): string {
  const wrap = token.wrap ?? ''
  return `${wrap}${token.text}${wrap}`
}

/**
 * Lay the cascade out down the frame.
 *
 * Five rows share one left edge to the right of the spine: the header at the
 * top, the field tiles under it, the bump tile, the two versions, and the
 * changelog line. Every position a copy sets off from or lands on is a point
 * measured here, so the flights in the timeline are plain moves between
 * points.
 *
 * @param config - The cascade as the scene configured it.
 * @param metrics - The measurements this profile is drawn at.
 * @returns Where everything sits.
 * @example The centre of the first field's value
 * ```ts
 * cascadeLayout(config, cascadeMetrics(profile)).fields[0]?.value
 * ```
 */
export function cascadeLayout(config: CascadeConfig, metrics: CascadeMetrics): CascadeLayout {
  const rows = [0, 1, 2, 3, 4].map((row) => metrics.rowTopPx + metrics.rowGapPx * row)
  const rowY = (row: number): number => rows[row] ?? metrics.rowTopPx
  let cursor = metrics.rowXPx
  const header = config.header.map((part): HeaderSpan => {
    const width = monoWidth(part.text, metrics.headerPx)
    const span = { x: cursor, width, text: part.text }
    cursor += width
    return span
  })
  cursor = metrics.rowXPx
  const fields = config.parse.fields.map((field): Tile => {
    const tile = placeTile(cursor, rowY(1), field.label, field.value, metrics)
    cursor += tile.width + metrics.tileGapPx
    return tile
  })
  const bump = placeTile(metrics.rowXPx, rowY(2), config.bump.label, config.bump.value, metrics)
  const fromWidth = monoWidth(config.increment.from, metrics.versionPx)
  const arrowFrom = metrics.rowXPx + fromWidth + ARROW_GAP * metrics.scale
  const arrowTo = arrowFrom + ARROW_LEN * metrics.scale
  const version: VersionLayout = {
    y: rowY(3),
    from: placeGlyphs(config.increment.from, metrics.rowXPx, metrics),
    to: placeGlyphs(config.increment.to, arrowTo + ARROW_GAP * metrics.scale, metrics),
    arrowFrom,
    arrowTo,
  }
  cursor = metrics.rowXPx
  const space = monoWidth(' ', metrics.linePx)
  const tokens = config.changelog.tokens.map((token): TokenSlot => {
    const width = monoWidth(tokenText(token), metrics.linePx)
    const slot = { x: cursor, width, centre: { x: cursor + width / 2, y: rowY(4) } }
    cursor += width + space
    return slot
  })
  return { rows, header, fields, bump, version, tokens, fileX: cursor - space + FILE_GAP * metrics.scale }
}
