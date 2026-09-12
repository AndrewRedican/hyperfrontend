import type { TranscodeContext } from './tile'
import { clamp01, easeInOut, easeOut, lerp, progress, pulse } from '../lib/motion'
import { presence, renderTile } from './tile'
import { COLLAPSE_MS, DROP_MS, FADE_MS, FLASH_MS, FOLD_MS, REGROUP_MS } from './timeline'

/** How much of its size a tile keeps by the time it has folded into the row above. */
const FOLDED_SCALE = 0.5

/** How long the ring around a character stays lit after its bytes have dropped. */
const CHARACTER_LIT_MS = 700

/** Where one byte tile is and how it looks at one instant. */
interface ByteInstant {
  /** Horizontal centre. */
  x: number
  /** Vertical centre. */
  y: number
  /** How much of its full size it is drawn at. */
  scale: number
  /** How opaque it is. */
  opacity: number
  /** The hex it shows, which is the platform's misreading while the pair is collapsed. */
  hex: string
  /** Whether the platform call has this tile in its grip. */
  hot: boolean
  /** How far the tile has dropped out of its character, 0 before it starts. */
  dropped: number
}

/**
 * How far the misread pair is collapsed into one byte.
 *
 * @param context - The crossing at this instant.
 * @returns From 0 (two bytes) to 1 (one byte), and back.
 */
function mergedAt(context: TranscodeContext): number {
  const { timeline, atMs } = context
  const collapse = easeInOut(progress(atMs, timeline.collapseAt, COLLAPSE_MS))
  const restore = easeInOut(progress(atMs, timeline.ghostOutAt, COLLAPSE_MS))
  return collapse * (1 - restore)
}

/**
 * Work out where one byte tile is: still inside its character, dropping,
 * landed, regrouped, collapsed by the platform call, or folding back up.
 *
 * @param context - The crossing at this instant.
 * @param index - Which byte, in text order.
 * @returns The tile's position and look.
 */
function byteAt(context: TranscodeContext, index: number): ByteInstant {
  const { config, layout, metrics, timeline, atMs } = context
  const slot = layout.bytes[index]
  const characterX = layout.characters[slot?.character ?? 0] ?? 0
  const hex = slot?.hex ?? ''
  const dropped = easeOut(progress(atMs, timeline.dropAt[index] ?? 0, DROP_MS))
  // why: the tile starts behind its character and slides out of the tile's bottom edge, so it is seen to come from the character rather than from nowhere
  const hiddenY = metrics.rowAY + (metrics.charPx - metrics.bytePx) / 2 + 2
  // why: a second byte fans sideways only once it has cleared the character's bottom edge, so it is seen to drop out of the tile rather than appear beside it
  let x = lerp(characterX, slot?.landedX ?? characterX, clamp01((dropped - 0.35) / 0.65))
  let y = lerp(hiddenY, metrics.rowBY, dropped)
  const regrouped = easeInOut(progress(atMs, timeline.regroupAt, REGROUP_MS))
  x = lerp(x, slot?.groupedX ?? x, regrouped)
  let opacity = 1
  let shown = hex
  let hot = false
  if (slot !== undefined && slot.character === config.foreign.character) {
    const merged = mergedAt(context)
    const restored = easeInOut(progress(atMs, timeline.ghostOutAt, COLLAPSE_MS))
    hot = atMs >= timeline.flashAt && restored < 0.5
    const first = layout.bytes.find((candidate) => candidate.character === slot.character && candidate.ordinal === 0)
    if (slot.ordinal > 0) {
      x = lerp(x, first?.groupedX ?? x, merged)
      // why: the vanishing tile fades faster than it slides, so its hex is gone before it overlaps the one it collapses into
      opacity = clamp01(1 - merged * 1.8)
    } else if (merged > 0.5) {
      shown = config.foreign.byte
    }
  }
  const folded = easeInOut(progress(atMs, timeline.foldBAt, FOLD_MS))
  x = lerp(x, characterX, folded)
  y = lerp(y, metrics.rowAY, folded)
  const scale = lerp(1, FOLDED_SCALE, folded)
  opacity *= clamp01(1 - (folded - 0.55) / 0.45)
  return { x, y, scale, opacity, hex: shown, hot, dropped }
}

/**
 * Draw the character row: the text, each tile lit while its bytes drop and
 * ringed in success once they have all come home.
 *
 * @param context - The crossing at this instant.
 * @returns SVG markup for the character tiles.
 * @example The row at the first frame
 * ```ts
 * renderCharacters({ ...shared, atMs: 0 })
 * ```
 */
export function renderCharacters(context: TranscodeContext): string {
  const { config, layout, metrics, theme, timeline, atMs } = context
  const restored = easeOut(progress(atMs, timeline.restoredAt, FADE_MS))
  return config.characters
    .map((character, index) => {
      const firstByte = layout.bytes.findIndex((slot) => slot.character === index)
      const lit = pulse(atMs, timeline.dropAt[firstByte] ?? 0, DROP_MS + CHARACTER_LIT_MS)
      const stroke = restored > 0.5 ? theme.tones.success : lit > 0.5 ? theme.borderActive : theme.border
      return renderTile({
        x: layout.characters[index] ?? 0,
        y: metrics.rowAY,
        size: metrics.charPx,
        scale: 1,
        opacity: 1,
        fill: theme.surfaceRaised,
        stroke,
        strokeWidth: restored > 0.5 || lit > 0.5 ? 2 : 1.5,
        glyph: character.glyph,
        textClass: 'tc-char',
        colour: theme.text.strong,
      })
    })
    .join('')
}

/**
 * Draw the line from a character down to one of its bytes.
 *
 * @param context - The crossing at this instant.
 * @param index - Which byte.
 * @param byte - Where that byte is.
 * @returns SVG markup, or nothing while the byte is still inside its character.
 */
function renderConnector(context: TranscodeContext, index: number, byte: ByteInstant): string {
  const { layout, metrics, theme } = context
  const slot = layout.bytes[index]
  const fromX = layout.characters[slot?.character ?? 0] ?? 0
  const fromY = metrics.rowAY + metrics.charPx / 2
  const toY = byte.y - (metrics.bytePx * byte.scale) / 2
  if (toY - fromY < 4 || byte.opacity <= 0.01) {
    return ''
  }
  const opacity = byte.opacity * clamp01((toY - fromY) / 16)
  return `<line x1="${fromX.toFixed(1)}" y1="${fromY.toFixed(1)}" x2="${byte.x.toFixed(1)}" y2="${toY.toFixed(1)}" stroke="${byte.hot ? theme.tones.danger : theme.border}" stroke-width="1.5" opacity="${opacity.toFixed(3)}"/>`
}

/**
 * Draw the ring that flashes around the misread pair before it collapses.
 *
 * @param context - The crossing at this instant.
 * @returns SVG markup, or nothing outside the flash.
 */
function renderFlash(context: TranscodeContext): string {
  const { config, layout, metrics, theme, timeline, atMs } = context
  const strength = pulse(atMs, timeline.flashAt, FLASH_MS)
  if (strength <= 0) {
    return ''
  }
  const pair = layout.bytes.filter((slot) => slot.character === config.foreign.character)
  const first = pair[0]
  const last = pair[pair.length - 1]
  if (first === undefined || last === undefined) {
    return ''
  }
  const pad = 3
  const x = first.groupedX - metrics.bytePx / 2 - pad
  const width = last.groupedX + metrics.bytePx / 2 + pad - x
  const height = metrics.bytePx + pad * 2
  return `<rect x="${x.toFixed(1)}" y="${(metrics.rowBY - height / 2).toFixed(1)}" width="${width.toFixed(1)}" height="${height}" rx="${pad + 4}" fill="${theme.tones.danger}" fill-opacity="${(0.12 * strength).toFixed(3)}" stroke="${theme.tones.danger}" stroke-width="1.5" opacity="${strength.toFixed(3)}"/>`
}

/**
 * Draw the empty slots: the padding the encoder fills a short last group
 * with, and the slot the platform's collapse leaves behind.
 *
 * @param context - The crossing at this instant.
 * @returns SVG markup for the dashed slots.
 */
function renderPads(context: TranscodeContext): string {
  const { config, layout, metrics, theme, timeline, atMs } = context
  const padding = presence(timeline.padAt, timeline.foldBAt, FADE_MS, atMs)
  const vacated = presence(timeline.ghostPadAt, timeline.ghostOutAt, FADE_MS, atMs)
  const slots: string[] = []
  layout.slots.forEach((x, index) => {
    const vacatedHere = layout.bytes[index]?.character === config.foreign.character && (layout.bytes[index]?.ordinal ?? 0) > 0
    const opacity = index >= layout.bytes.length ? padding : vacatedHere ? vacated : 0
    slots.push(
      renderTile({
        x,
        y: metrics.rowBY,
        size: metrics.bytePx,
        scale: 1,
        opacity,
        fill: 'none',
        stroke: vacatedHere ? theme.tones.danger : theme.text.faint,
        strokeWidth: 1.5,
        glyph: '',
        textClass: 'tc-hex',
        colour: theme.text.muted,
        dashed: true,
      })
    )
  })
  return slots.join('')
}

/**
 * Draw the byte row: every byte wherever it is, the lines that tie each to
 * its character, the empty slots, and the flash on the pair the platform
 * call misreads.
 *
 * @param context - The crossing at this instant.
 * @returns SVG markup for the whole row.
 * @example The row once every byte has landed
 * ```ts
 * renderBytes({ ...shared, atMs: 2_600 })
 * ```
 */
export function renderBytes(context: TranscodeContext): string {
  const { layout, metrics, theme } = context
  const bytes = layout.bytes.map((_, index) => byteAt(context, index))
  const connectors = bytes.map((byte, index) => renderConnector(context, index, byte)).join('')
  const tiles = bytes
    .map((byte) => {
      if (byte.dropped <= 0) {
        return ''
      }
      return renderTile({
        x: byte.x,
        y: byte.y,
        size: metrics.bytePx,
        scale: byte.scale,
        opacity: byte.opacity,
        fill: theme.surface,
        stroke: byte.hot ? theme.tones.danger : theme.border,
        strokeWidth: byte.hot ? 2 : 1.5,
        glyph: byte.hex,
        textClass: 'tc-hex',
        colour: byte.hot ? theme.tones.danger : theme.text.plain,
      })
    })
    .join('')
  return `${connectors}${renderPads(context)}${renderFlash(context)}${tiles}`
}
