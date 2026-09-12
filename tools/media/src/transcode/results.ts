import type { TranscodeContext } from './tile'
import { min } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'
import { clamp01, easeInOut, easeOut, lerp, progress } from '../lib/motion'
import { BYTES_PER_GROUP, CHARS_PER_GROUP } from './layout'
import { presence, renderTile } from './tile'
import { EMERGE_MS, FADE_MS, FOLD_MS, FUNNEL_MS, GHOST_MS, STRIKE_MS } from './timeline'

/** How small a result tile is as it enters its funnel, and again as it leaves. */
const EMERGING_SCALE = 0.55

/** How opaque the platform's result is drawn: present enough to compare, never mistaken for the package's. */
const GHOST_OPACITY = 0.7

/** How far past the tiles on either side a band or a strike reaches. */
const BAND_PAD_PX = 10

/**
 * Index of the first character where the platform's result parts from the
 * package's; everything from there on is the wrong tail.
 *
 * @param context - The crossing at this instant.
 * @returns The index, or the result's length when the two agree throughout.
 */
function divergesAt(context: TranscodeContext): number {
  const { encoded, foreign } = context.config
  for (let index = 0; index < encoded.length; index += 1) {
    if (encoded[index] !== foreign.encoded[index]) {
      return index
    }
  }
  return encoded.length
}

/**
 * Draw the funnel between one group of three bytes and the four characters
 * they become, growing from its top edge down.
 *
 * @param context - The crossing at this instant.
 * @param group - Which group.
 * @returns SVG markup, or nothing before the funnel starts drawing.
 */
function renderFunnel(context: TranscodeContext, group: number): string {
  const { layout, metrics, theme, timeline, atMs } = context
  const drawn = easeOut(progress(atMs, timeline.funnelAt[group] ?? 0, FUNNEL_MS))
  const gone = easeOut(progress(atMs, timeline.foldCAt, FOLD_MS))
  const opacity = drawn * (1 - gone)
  if (opacity <= 0) {
    return ''
  }
  const firstSlot = layout.slots[group * BYTES_PER_GROUP] ?? 0
  const lastSlot = layout.slots[group * BYTES_PER_GROUP + BYTES_PER_GROUP - 1] ?? 0
  const firstResult = layout.results[group * CHARS_PER_GROUP]?.x ?? 0
  const lastResult = layout.results[group * CHARS_PER_GROUP + CHARS_PER_GROUP - 1]?.x ?? 0
  const topY = metrics.rowBY + metrics.bytePx / 2 + metrics.funnelPadPx
  const bottomY = metrics.rowCY - metrics.resultPx / 2 - metrics.funnelPadPx
  const topLeft = firstSlot - metrics.bytePx / 2
  const topRight = lastSlot + metrics.bytePx / 2
  const bottomLeft = lerp(topLeft, firstResult - metrics.resultPx / 2, drawn)
  const bottomRight = lerp(topRight, lastResult + metrics.resultPx / 2, drawn)
  const y = lerp(topY, bottomY, drawn)
  const points = `${topLeft.toFixed(1)},${topY.toFixed(1)} ${topRight.toFixed(1)},${topY.toFixed(1)} ${bottomRight.toFixed(1)},${y.toFixed(1)} ${bottomLeft.toFixed(1)},${y.toFixed(1)}`
  return `<polygon points="${points}" fill="${theme.accentSoft}" stroke="${theme.border}" stroke-width="1.5" stroke-linejoin="round" opacity="${opacity.toFixed(3)}"/>`
}

/**
 * Draw every funnel.
 *
 * @param context - The crossing at this instant.
 * @returns SVG markup for the funnels.
 * @example Both funnels, fully drawn
 * ```ts
 * renderFunnels({ ...shared, atMs: 5_000 })
 * ```
 */
export function renderFunnels(context: TranscodeContext): string {
  const parts: string[] = []
  for (let group = 0; group < context.layout.groups; group += 1) {
    parts.push(renderFunnel(context, group))
  }
  return parts.join('')
}

/**
 * Draw the result row: each tile drawn out of its funnel in turn, resting
 * on its band, and later folding back up the way it came.
 *
 * @param context - The crossing at this instant.
 * @returns SVG markup for the result tiles.
 * @example The row at rest
 * ```ts
 * renderResults({ ...shared, atMs: 5_600 })
 * ```
 */
export function renderResults(context: TranscodeContext): string {
  const { layout, metrics, theme, timeline, atMs } = context
  const mouthY = metrics.rowBY + metrics.bytePx / 2 + metrics.funnelPadPx + 8
  const folded = easeInOut(progress(atMs, timeline.foldCAt, FOLD_MS))
  return layout.results
    .map((slot, index) => {
      const emerged = easeOut(progress(atMs, timeline.emergeAt[index] ?? 0, EMERGE_MS))
      if (emerged <= 0) {
        return ''
      }
      let x = lerp(slot.sourceX, slot.x, emerged)
      let y = lerp(mouthY, metrics.rowCY, emerged)
      let scale = lerp(EMERGING_SCALE, 1, emerged)
      let opacity = min(1, emerged * 2.5)
      x = lerp(x, slot.sourceX, folded)
      y = lerp(y, mouthY, folded)
      scale = lerp(scale, EMERGING_SCALE, folded)
      opacity *= clamp01(1 - (folded - 0.5) / 0.5)
      const padding = slot.glyph === '='
      return renderTile({
        x,
        y,
        size: metrics.resultPx,
        scale,
        opacity,
        fill: theme.surface,
        stroke: theme.border,
        strokeWidth: 1.5,
        glyph: slot.glyph,
        textClass: 'tc-result',
        colour: padding ? theme.text.muted : theme.text.strong,
      })
    })
    .join('')
}

/**
 * Draw the platform's result peeling off from under the package's, the
 * wrong tail in danger with a line through it.
 *
 * Drawn before the result row so each tile is seen to come out from
 * beneath the tile it is compared with.
 *
 * @param context - The crossing at this instant.
 * @returns SVG markup for the ghost row and its strike.
 * @example The ghost fully peeled and struck
 * ```ts
 * renderGhost({ ...shared, atMs: 8_400 })
 * ```
 */
export function renderGhost(context: TranscodeContext): string {
  const { config, layout, metrics, theme, timeline, atMs } = context
  const gone = easeOut(progress(atMs, timeline.ghostOutAt, FADE_MS))
  if (gone >= 1) {
    return ''
  }
  const wrongFrom = divergesAt(context)
  const tiles = layout.results
    .map((slot, index) => {
      const peeled = easeOut(progress(atMs, timeline.ghostAt[index] ?? 0, GHOST_MS))
      if (peeled <= 0) {
        return ''
      }
      const wrong = index >= wrongFrom
      return renderTile({
        x: slot.x,
        y: lerp(metrics.rowCY, metrics.ghostY, peeled),
        size: metrics.resultPx,
        scale: 1,
        opacity: GHOST_OPACITY * (1 - gone),
        fill: theme.surface,
        stroke: wrong ? theme.tones.danger : theme.border,
        strokeWidth: 1.5,
        glyph: config.foreign.encoded[index] ?? '',
        textClass: 'tc-result',
        colour: wrong ? theme.tones.danger : theme.text.muted,
      })
    })
    .join('')
  const struck = easeOut(progress(atMs, timeline.strikeAt, STRIKE_MS))
  const first = layout.results[wrongFrom]
  if (struck <= 0 || first === undefined) {
    return tiles
  }
  const fromX = first.x - metrics.resultPx / 2 - 4
  const toX = lerp(fromX, layout.resultsRight + 4, struck)
  const strike = `<line x1="${fromX.toFixed(1)}" y1="${metrics.ghostY}" x2="${toX.toFixed(1)}" y2="${metrics.ghostY}" stroke="${theme.tones.danger}" stroke-width="2" stroke-linecap="round" opacity="${(1 - gone).toFixed(3)}"/>`
  return `${tiles}${strike}`
}

/**
 * Draw one soft band behind a row, to say the row is the answer.
 *
 * @param context - The crossing at this instant.
 * @param left - Left edge of the row's tiles.
 * @param right - Right edge of the row's tiles.
 * @param y - Vertical centre of the row.
 * @param size - Side of the row's tiles.
 * @param opacity - How far the band has faded in.
 * @returns SVG markup, or nothing while the band is invisible.
 */
function renderBand(context: TranscodeContext, left: number, right: number, y: number, size: number, opacity: number): string {
  if (opacity <= 0) {
    return ''
  }
  const { theme } = context
  const height = size + BAND_PAD_PX * 2
  return `<rect x="${(left - BAND_PAD_PX).toFixed(1)}" y="${(y - height / 2).toFixed(1)}" width="${(right - left + BAND_PAD_PX * 2).toFixed(1)}" height="${height}" rx="${BAND_PAD_PX + 4}" fill="${theme.tones.success}" fill-opacity="${(0.13 * opacity).toFixed(3)}" stroke="${theme.tones.success}" stroke-opacity="${(0.55 * opacity).toFixed(3)}" stroke-width="1.5"/>`
}

/**
 * Draw the bands: under the result once it is complete, and under the text
 * once the result has folded back into it.
 *
 * @param context - The crossing at this instant.
 * @returns SVG markup for both bands.
 * @example The result's band, fully in
 * ```ts
 * renderBands({ ...shared, atMs: 5_600 })
 * ```
 */
export function renderBands(context: TranscodeContext): string {
  const { layout, metrics, timeline, atMs } = context
  const result = presence(timeline.bandAt, timeline.foldCAt, FADE_MS, atMs)
  const text = easeOut(progress(atMs, timeline.restoredAt, FADE_MS))
  return `${renderBand(context, layout.resultsLeft, layout.resultsRight, metrics.rowCY, metrics.resultPx, result)}${renderBand(context, layout.charsLeft, layout.charsRight, metrics.rowAY, metrics.charPx, text)}`
}
