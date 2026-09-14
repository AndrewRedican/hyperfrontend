import type { MediaTheme } from '../models/theme'
import type { TranscodeConfig } from '../models/transcode'
import type { TranscodeLayout, TranscodeMetrics } from './layout'
import type { TranscodeTimeline } from './timeline'
import { escapeHtml } from '../lib/escape-html'
import { progress } from '../lib/motion'

/** What every renderer is handed for one instant. */
export interface TranscodeContext {
  /** The crossing as the scene configured it. */
  config: TranscodeConfig
  /** Where every tile sits at every stage. */
  layout: TranscodeLayout
  /** The measurements this profile is drawn at. */
  metrics: TranscodeMetrics
  /** The visual tokens this variant is drawn with. */
  theme: MediaTheme
  /** Every moment on the stage's timeline. */
  timeline: TranscodeTimeline
  /** Offset from the start of the timeline. */
  atMs: number
}

/** One square tile with a glyph in it, wherever it is and however it is faring. */
export interface TileSpec {
  /** Horizontal centre. */
  x: number
  /** Vertical centre. */
  y: number
  /** Side at full size. */
  size: number
  /** How much of its full size it is drawn at. */
  scale: number
  /** How opaque it is. */
  opacity: number
  /** The tile's surface. */
  fill: string
  /** The tile's outline. */
  stroke: string
  /** Width of the outline. */
  strokeWidth: number
  /** The glyph inside, or empty for a slot with nothing in it yet. */
  glyph: string
  /** Class that sets the glyph's face and size. */
  textClass: string
  /** What the glyph is drawn in. */
  colour: string
  /** Whether the outline is dashed, for a slot that holds nothing. */
  dashed?: boolean
}

/**
 * Draw one tile.
 *
 * Scale is applied about the tile's own centre, so a tile that is growing
 * out of a funnel or shrinking into a character stays where it is headed.
 *
 * @param spec - Where the tile is and how it looks.
 * @returns SVG markup, or nothing for a tile that cannot be seen.
 * @example A byte tile at rest
 * ```ts
 * renderTile({ x: 192, y: 175, size: 36, scale: 1, opacity: 1, fill, stroke, strokeWidth: 1.5, glyph: '63', textClass: 'tc-hex', colour })
 * ```
 */
export function renderTile(spec: TileSpec): string {
  if (spec.opacity <= 0.005 || spec.scale <= 0.005) {
    return ''
  }
  const side = spec.size * spec.scale
  const half = side / 2
  const radius = (spec.size * 0.18 * spec.scale).toFixed(1)
  const dash = spec.dashed === true ? ` stroke-dasharray="${(4 * spec.scale).toFixed(1)} ${(3 * spec.scale).toFixed(1)}"` : ''
  const glyph =
    spec.glyph === ''
      ? ''
      : `<text x="${spec.x.toFixed(1)}" y="${spec.y.toFixed(1)}" class="${spec.textClass}" fill="${spec.colour}" text-anchor="middle" dominant-baseline="central"${spec.scale === 1 ? '' : ` transform="translate(${spec.x.toFixed(1)} ${spec.y.toFixed(1)}) scale(${spec.scale.toFixed(3)}) translate(${(-spec.x).toFixed(1)} ${(-spec.y).toFixed(1)})"`}>${escapeHtml(spec.glyph)}</text>`
  return `<g opacity="${spec.opacity.toFixed(3)}"><rect x="${(spec.x - half).toFixed(1)}" y="${(spec.y - half).toFixed(1)}" width="${side.toFixed(1)}" height="${side.toFixed(1)}" rx="${radius}" fill="${spec.fill}" stroke="${spec.stroke}" stroke-width="${spec.strokeWidth}"${dash}/>${glyph}</g>`
}

/**
 * How visible something is that fades in at one moment and out at another.
 *
 * @param inAt - When it starts fading in.
 * @param outAt - When it starts fading out.
 * @param fadeMs - How long each fade takes.
 * @param atMs - Offset from the start of the timeline.
 * @returns Opacity from 0 to 1.
 * @example A label that shows for two seconds
 * ```ts
 * presence(1_000, 3_000, 300, 1_150) // 0.5
 * ```
 */
export function presence(inAt: number, outAt: number, fadeMs: number, atMs: number): number {
  return progress(atMs, inAt, fadeMs) * (1 - progress(atMs, outAt, fadeMs))
}
