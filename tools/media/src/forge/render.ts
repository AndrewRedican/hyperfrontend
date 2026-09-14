import type { ForgeFormat, ForgeOutput } from '../models/forge'
import type { MediaTheme } from '../models/theme'
import type { Box, CardLayout, ForgeLayout, ForgeMetrics, KeyLayout, Point, TileLayout } from './layout'
import { escapeHtml } from '../lib/escape-html'
import { easeOut, lerp, progress } from '../lib/motion'
import { cubicPath, monoWidth, roundedPolygonPath } from './layout'
import { POP_MS, THREAD_FADE_MS } from './timeline'

/** What each format's pill says. */
const FORMAT_LABEL: Readonly<Record<ForgeFormat, string>> = {
  esm: 'ESM',
  cjs: 'CJS',
  dts: 'd.ts',
  iife: 'IIFE',
  umd: 'UMD',
}

/** How far a tile starts below its full size as it pops. */
const POP_FROM_SCALE = 0.85

/** How much a key grows once its first wire has landed. */
const LIT_SCALE = 1.06

/**
 * The colour a format's pill is drawn in.
 *
 * The two module formats take the accent, the declarations stay plain, and the
 * two browser bundles take the success tone, so the tree reads as three kinds
 * of file before any name is read.
 *
 * @param format - Which of the five output formats the file is.
 * @param theme - The visual tokens this variant is drawn with.
 * @returns A colour token.
 */
export function formatTone(format: ForgeFormat, theme: MediaTheme): string {
  if (format === 'esm' || format === 'cjs') {
    return theme.tones.accent
  }
  if (format === 'dts') {
    return theme.tones.plain
  }
  return theme.tones.success
}

/**
 * A rounded rectangle.
 *
 * @param box - The rectangle.
 * @param radius - Corner radius.
 * @param fill - Fill colour.
 * @param stroke - Outline colour.
 * @param strokeWidth - Outline weight.
 * @param extra - Further attributes, already formatted.
 * @returns SVG markup.
 */
function rect(box: Box, radius: number, fill: string, stroke: string, strokeWidth: number, extra = ''): string {
  return `<rect x="${box.x.toFixed(1)}" y="${box.y.toFixed(1)}" width="${box.width.toFixed(1)}" height="${box.height.toFixed(1)}" rx="${radius}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}"${extra}/>`
}

/**
 * A folder glyph followed by a directory name.
 *
 * @param at - Left edge and baseline of the label.
 * @param name - The directory's name.
 * @param metrics - The measurements this profile is drawn at.
 * @param theme - The visual tokens this variant is drawn with.
 * @returns SVG markup.
 */
export function renderFolderLabel(at: Point, name: string, metrics: ForgeMetrics, theme: MediaTheme): string {
  const size = metrics.labelPx
  const top = at.y - size * 0.85
  const folder = `M ${at.x} ${top + size * 0.15} h ${size * 0.4} l ${size * 0.2} ${size * 0.2} h ${size * 0.6} v ${size * 0.65} h ${-size * 1.2} z`
  return `<path d="${folder}" fill="none" stroke="${theme.text.muted}" stroke-width="${metrics.strokePx}" stroke-linejoin="round"/><text x="${(at.x + size * 1.55).toFixed(1)}" y="${at.y.toFixed(1)}" class="fg-label">${escapeHtml(name)}</text>`
}

/**
 * A source card: a file glyph and the entry's name on a surface.
 *
 * @param card - Where it sits.
 * @param name - The entry's name.
 * @param metrics - The measurements this profile is drawn at.
 * @param theme - The visual tokens this variant is drawn with.
 * @returns SVG markup.
 */
export function renderCard(card: CardLayout, name: string, metrics: ForgeMetrics, theme: MediaTheme): string {
  const { box } = card
  const glyphX = box.x + 11
  const glyphTop = box.y + box.height / 2 - 7
  const file = `M ${glyphX} ${glyphTop} h 7 l 4 4 v 10 h -11 z M ${glyphX + 7} ${glyphTop} v 4 h 4`
  return `${rect(box, 8, theme.surface, theme.border, metrics.strokePx)}<path d="${file}" fill="none" stroke="${theme.text.muted}" stroke-width="${metrics.strokePx}" stroke-linejoin="round"/><text x="${(glyphX + 18).toFixed(1)}" y="${(box.y + box.height / 2).toFixed(1)}" class="fg-card-name" dominant-baseline="central">${escapeHtml(name)}</text>`
}

/**
 * The builder: a rounded hexagon that glows while it holds an entry.
 *
 * @param layout - Where everything sits.
 * @param glow - How brightly it is working, from 0 to 1.
 * @param metrics - The measurements this profile is drawn at.
 * @param theme - The visual tokens this variant is drawn with.
 * @returns SVG markup.
 */
export function renderBuilder(layout: ForgeLayout, glow: number, metrics: ForgeMetrics, theme: MediaTheme): string {
  const body = roundedPolygonPath(layout.hexagon, 10)
  const grow = (by: number): Point[] =>
    layout.hexagon.map((vertex) => ({
      x: layout.centre.x + (vertex.x - layout.centre.x) * (1 + by / layout.halfWidth),
      y: layout.centre.y + (vertex.y - layout.centre.y) * (1 + by / layout.halfWidth),
    }))
  const halo =
    glow <= 0
      ? ''
      : `<path d="${roundedPolygonPath(grow(12), 14)}" fill="none" stroke="${theme.accent}" stroke-width="${metrics.strokePx}" opacity="${(0.22 * glow).toFixed(3)}"/><path d="${roundedPolygonPath(grow(6), 12)}" fill="none" stroke="${theme.accent}" stroke-width="${(metrics.strokePx + 1.5 * glow).toFixed(2)}" opacity="${(0.6 * glow).toFixed(3)}"/>`
  const stroke = glow > 0.5 ? theme.borderActive : theme.border
  // why: a dashed ring marks the one slot an entry occupies, so an idle builder visibly holds nothing and a working one visibly holds one thing
  const slotRadius = layout.clusterRadius + 7
  const slot = `<circle cx="${layout.cluster.x.toFixed(1)}" cy="${layout.cluster.y.toFixed(1)}" r="${slotRadius}" fill="none" stroke="${theme.border}" stroke-width="${metrics.strokePx}" stroke-dasharray="3 3"/>`
  const litSlot =
    glow <= 0
      ? ''
      : `<circle cx="${layout.cluster.x.toFixed(1)}" cy="${layout.cluster.y.toFixed(1)}" r="${slotRadius}" fill="${theme.accent}" fill-opacity="${(0.1 * glow).toFixed(3)}" stroke="${theme.accent}" stroke-width="${metrics.strokePx}" stroke-dasharray="3 3" opacity="${(0.8 * glow).toFixed(3)}"/>`
  return `${halo}<path d="${body}" fill="${theme.surface}" stroke="${stroke}" stroke-width="${(metrics.strokePx + 0.5 * glow).toFixed(2)}"/>${slot}${litSlot}`
}

/**
 * One file in the tree, popping into place with a thread from the builder.
 *
 * @param tile - Where it sits.
 * @param output - The file.
 * @param popAt - When it pops.
 * @param emit - Where the builder's thread leaves from.
 * @param metrics - The measurements this profile is drawn at.
 * @param theme - The visual tokens this variant is drawn with.
 * @param atMs - Offset from the start of the timeline.
 * @returns SVG markup, or nothing before the file pops.
 */
export function renderTile(
  tile: TileLayout,
  output: ForgeOutput,
  popAt: number,
  emit: Point,
  metrics: ForgeMetrics,
  theme: MediaTheme,
  atMs: number
): string {
  if (atMs < popAt) {
    return ''
  }
  const pop = easeOut(progress(atMs, popAt, POP_MS))
  const scale = lerp(POP_FROM_SCALE, 1, pop)
  const tone = formatTone(output.format, theme)
  const { box } = tile
  const centre = { x: box.x + box.width / 2, y: box.y + box.height / 2 }
  const local: Box = { x: -box.width / 2, y: -box.height / 2, width: box.width, height: box.height }
  const label = FORMAT_LABEL[output.format]
  const pillWidth = monoWidth(label, metrics.pillPx) + 10
  const pill: Box = { x: local.x + 6, y: local.y + 2.5, width: pillWidth, height: box.height - 5 }
  const threadFade = 1 - easeOut(progress(atMs, popAt + 250, THREAD_FADE_MS))
  const thread =
    threadFade <= 0
      ? ''
      : `<path d="${cubicPath([emit, { x: emit.x + 28, y: emit.y }, { x: tile.port.x - 26, y: tile.port.y }, tile.port])}" fill="none" stroke="${tone}" stroke-width="${metrics.strokePx + 0.3}" stroke-linecap="round" opacity="${(0.9 * threadFade * pop).toFixed(3)}"/>`
  return `${thread}<g transform="translate(${centre.x.toFixed(1)} ${centre.y.toFixed(1)}) scale(${scale.toFixed(3)})" opacity="${pop.toFixed(3)}">${rect(local, 5, theme.surface, theme.border, metrics.strokePx)}${rect(pill, 4, tone, tone, 0, ' fill-opacity="0.16"')}<text x="${(pill.x + pill.width / 2).toFixed(1)}" y="0" class="fg-pill" text-anchor="middle" dominant-baseline="central" fill="${tone}">${escapeHtml(label)}</text><text x="${(pill.x + pill.width + 6).toFixed(1)}" y="0" class="fg-name" dominant-baseline="central">${escapeHtml(output.name)}</text><circle cx="${local.x}" cy="0" r="2" fill="${theme.border}"/></g>`
}

/**
 * The manifest sheet with its keys, each lit once its first wire has landed.
 *
 * @param layout - Where everything sits.
 * @param name - The manifest's file name.
 * @param rise - How far the sheet has risen, from 0 to 1.
 * @param litAt - When each key lights, by key.
 * @param metrics - The measurements this profile is drawn at.
 * @param theme - The visual tokens this variant is drawn with.
 * @param atMs - Offset from the start of the timeline.
 * @returns SVG markup, or nothing before the sheet starts rising.
 */
export function renderSheet(
  layout: ForgeLayout,
  name: string,
  rise: number,
  litAt: Readonly<Record<string, number>>,
  metrics: ForgeMetrics,
  theme: MediaTheme,
  atMs: number
): string {
  if (rise <= 0) {
    return ''
  }
  const dy = (1 - rise) * (layout.sheet.height + 40)
  const keys = layout.keys.map((key) => renderKey(key, litAt[key.key] ?? 0, metrics, theme, atMs)).join('')
  return `<g transform="translate(0 ${dy.toFixed(1)})" opacity="${rise.toFixed(3)}">${rect(layout.sheet, 10, theme.surface, theme.border, metrics.strokePx)}<text x="${layout.sheetLabel.x.toFixed(1)}" y="${layout.sheetLabel.y.toFixed(1)}" class="fg-label">${escapeHtml(name)}</text>${keys}</g>`
}

/**
 * One key on the sheet.
 *
 * @param key - Where it sits.
 * @param litAt - When its first wire lands.
 * @param metrics - The measurements this profile is drawn at.
 * @param theme - The visual tokens this variant is drawn with.
 * @param atMs - Offset from the start of the timeline.
 * @returns SVG markup.
 */
function renderKey(key: KeyLayout, litAt: number, metrics: ForgeMetrics, theme: MediaTheme, atMs: number): string {
  const lit = litAt > 0 && atMs >= litAt
  const grow = lit ? lerp(1, LIT_SCALE, easeOut(progress(atMs, litAt, 300))) : 1
  const centre = { x: key.box.x + key.box.width / 2, y: key.box.y + key.box.height / 2 }
  const local: Box = { x: -key.box.width / 2, y: -key.box.height / 2, width: key.box.width, height: key.box.height }
  // why: a lit key keeps its raised fill and takes only an accent edge and strong text, so the accent-on-soft-band look stays exclusive to the API chip
  const fill = theme.surfaceRaised
  const stroke = lit ? theme.accent : theme.border
  const text = lit ? theme.text.strong : theme.text.muted
  return `<g transform="translate(${centre.x.toFixed(1)} ${centre.y.toFixed(1)}) scale(${grow.toFixed(3)})">${rect(local, 999, fill, stroke, metrics.strokePx)}<text x="0" y="0" class="fg-key${lit ? ' fg-key--lit' : ''}" text-anchor="middle" dominant-baseline="central" fill="${text}">${escapeHtml(key.key)}</text></g>`
}
