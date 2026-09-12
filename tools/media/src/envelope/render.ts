import type { EnvelopeConfig, EnvelopeSegment } from '../models/envelope'
import type { MediaTheme } from '../models/theme'
import type { EnvelopeLayout, EnvelopeMetrics, Span } from './layout'
import type { SealSchedule } from './timeline'
import { floor } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'
import { escapeHtml } from '../lib/escape-html'
import { easeOut, lerp, progress, pulse } from '../lib/motion'
import { blockLevel, cipherGlyph, renderCross, renderLock, SCRAMBLE_STEPS } from './glyphs'
import { FADE_MS, JITTER_MS, OPEN_MS, UNSEAL_STAGGER_MS } from './timeline'

/** How long the blocks and labels take to dim once the right key has opened the strip. */
const DIM_MS = 400

/** How bright the blocks stay once the strip is open: the envelope recedes and the secret is what remains. */
const BLOCK_DIM = 0.3

/** How bright the labels stay once the strip is open, a step above the blocks so they can still be made out. */
const LABEL_DIM = 0.45

/** How long the outline that flashes around a strip as it seals lasts. */
const SEAL_FLASH_MS = 700

/** How long one cell spends cycling back to its plain character. */
const UNSEAL_MS = 220

/** How many alternations the strip makes while it shakes. */
const JITTER_STEPS = 6

/** Everything one strip needs to know about itself at one instant. */
export interface RowInstant {
  /** Which strip this is, 0 or 1; the random material is keyed off it. */
  strip: number
  /** Vertical centre of the strip. */
  y: number
  /** The sealing this strip goes through. */
  schedule: SealSchedule
  /** When the plain secret starts fading in; negative for a strip shown from the first frame. */
  plainAt: number
  /** When the right key opens this strip, or undefined for a strip that stays shut. */
  openAt?: number
  /** When this strip's cells start unscrambling, or undefined for a strip that stays shut. */
  unsealAt?: number
  /** When this strip starts shaking against the wrong key, or undefined for a strip that opens. */
  jitterAt?: number
  /** When this strip's lock turns and the cross lands, or undefined for a strip that opens. */
  refuseAt?: number
}

/** What the renderer is handed for one strip at one instant. */
export interface RowContext {
  /** The strip as the scene configured it. */
  config: EnvelopeConfig
  /** Where everything on the strip sits. */
  layout: EnvelopeLayout
  /** The measurements this profile is drawn at. */
  metrics: EnvelopeMetrics
  /** The visual tokens this variant is drawn with. */
  theme: MediaTheme
  /** The strip being drawn. */
  row: RowInstant
  /** Offset from the start of the timeline. */
  atMs: number
}

/**
 * How far something has dimmed towards its resting brightness, once the
 * right key has opened the strip.
 *
 * @param row - The strip being drawn.
 * @param atMs - Offset from the start of the timeline.
 * @param resting - The brightness it settles at.
 * @returns A multiplier for its opacity.
 */
function dimming(row: RowInstant, atMs: number, resting: number): number {
  return row.openAt === undefined ? 1 : lerp(1, resting, easeOut(progress(atMs, row.openAt, DIM_MS)))
}

/**
 * Draw one run of random material, its blocks growing in one after another.
 *
 * @param context - The strip at this instant.
 * @param span - Where the run sits.
 * @param segment - How many blocks, and what they are called.
 * @param startAt - When the first block starts growing.
 * @param offset - Index of the run's first block along the whole strip, so no two runs share a pattern.
 * @param colour - The tone the run is drawn in.
 * @returns SVG markup for the blocks.
 */
function renderBlocks(context: RowContext, span: Span, segment: EnvelopeSegment, startAt: number, offset: number, colour: string): string {
  const { metrics, row, atMs } = context
  const pitch = metrics.blockPx + metrics.blockGapPx
  const dim = dimming(row, atMs, BLOCK_DIM)
  const parts: string[] = []
  for (let index = 0; index < segment.bytes; index += 1) {
    const scale = easeOut(progress(atMs, startAt + index * row.schedule.blockStaggerMs, row.schedule.blockGrowMs))
    if (scale <= 0) {
      continue
    }
    const cx = span.x + index * pitch + metrics.blockPx / 2
    const width = metrics.blockPx * scale
    const height = metrics.blockHeightPx * scale
    const opacity = blockLevel(row.strip, offset + index) * dim
    parts.push(
      `<rect x="${(cx - width / 2).toFixed(1)}" y="${(row.y - height / 2).toFixed(1)}" width="${width.toFixed(1)}" height="${height.toFixed(1)}" rx="1" fill="${colour}" opacity="${opacity.toFixed(3)}"/>`
    )
  }
  return parts.join('')
}

/** What one cell shows at one instant. */
interface CellFace {
  /** The glyph in the cell. */
  glyph: string
  /** What the glyph is drawn in. */
  colour: string
  /** Whether the cell is mid-scramble, which lights its outline. */
  busy: boolean
}

/**
 * Work out what one cell shows: its plain character, a glyph on the way to
 * cipher, its cipher glyph, or a glyph on the way back.
 *
 * @param context - The strip at this instant.
 * @param index - Which cell.
 * @param plain - The character it held before it was scrambled.
 * @returns The glyph, its colour and whether it is still changing.
 */
function cellFace(context: RowContext, index: number, plain: string): CellFace {
  const { theme, row, atMs } = context
  const { schedule } = row
  const scrambled = progress(atMs, schedule.scrambleAt + index * schedule.cellStaggerMs, schedule.scrambleMs)
  if (scrambled <= 0) {
    return { glyph: plain, colour: theme.text.strong, busy: false }
  }
  if (scrambled < 1) {
    const step = floor(scrambled * SCRAMBLE_STEPS)
    return { glyph: cipherGlyph(row.strip, index, step, plain), colour: theme.text.plain, busy: true }
  }
  const cipher = cipherGlyph(row.strip, index, SCRAMBLE_STEPS - 1, plain)
  if (row.unsealAt === undefined) {
    return { glyph: cipher, colour: theme.text.muted, busy: false }
  }
  const unsealed = progress(atMs, row.unsealAt + index * UNSEAL_STAGGER_MS, UNSEAL_MS)
  if (unsealed <= 0) {
    return { glyph: cipher, colour: theme.text.muted, busy: false }
  }
  if (unsealed < 1) {
    const step = floor(unsealed * SCRAMBLE_STEPS)
    // why: the way back cycles through glyphs of its own, so the unscramble reads as motion rather than as the scramble played backwards frame for frame
    const glyph = step === SCRAMBLE_STEPS - 1 ? plain : cipherGlyph(row.strip, index, SCRAMBLE_STEPS + step, plain)
    return { glyph, colour: theme.tones.success, busy: true }
  }
  return { glyph: plain, colour: theme.tones.success, busy: false }
}

/**
 * Draw the character cells: the secret, plain, scrambled or restored.
 *
 * @param context - The strip at this instant.
 * @returns SVG markup for the cells.
 */
function renderCells(context: RowContext): string {
  const { config, layout, metrics, theme, row, atMs } = context
  const pitch = metrics.cellPx + metrics.cellGapPx
  const reveal = row.plainAt < 0 ? 1 : easeOut(progress(atMs, row.plainAt, FADE_MS))
  if (reveal <= 0) {
    return ''
  }
  const top = row.y - metrics.cellHeightPx / 2
  const parts: string[] = []
  for (let index = 0; index < config.secret.length; index += 1) {
    const plain = config.secret[index] ?? ' '
    const face = cellFace(context, index, plain)
    const x = layout.cells.x + index * pitch
    const stroke = face.busy ? theme.borderActive : theme.border
    parts.push(
      `<rect x="${x}" y="${top.toFixed(1)}" width="${metrics.cellPx}" height="${metrics.cellHeightPx}" rx="2.5" fill="${theme.surface}" stroke="${stroke}" stroke-width="1.5"/><text x="${(x + metrics.cellPx / 2).toFixed(1)}" y="${row.y}" class="env-cell" fill="${face.colour}" text-anchor="middle" dominant-baseline="central">${escapeHtml(face.glyph)}</text>`
    )
  }
  return `<g opacity="${reveal.toFixed(3)}">${parts.join('')}</g>`
}

/**
 * Draw one label under a run, fading in once the run is complete.
 *
 * @param context - The strip at this instant.
 * @param span - The run the label sits under.
 * @param text - What the label says: the run's name and its byte count.
 * @param at - When it starts fading in.
 * @returns SVG markup, or nothing before it starts.
 */
function renderLabel(context: RowContext, span: Span, text: string, at: number): string {
  const opacity = easeOut(progress(context.atMs, at, FADE_MS)) * dimming(context.row, context.atMs, LABEL_DIM)
  if (opacity <= 0) {
    return ''
  }
  const x = span.x + span.width / 2
  const y = context.row.y + context.layout.labelDropPx
  return `<text x="${x.toFixed(1)}" y="${y}" class="env-label" text-anchor="middle" opacity="${opacity.toFixed(3)}">${escapeHtml(text)}</text>`
}

/**
 * Draw the lock at the end of the tag, in whatever state the keys have left it.
 *
 * @param context - The strip at this instant.
 * @returns SVG markup, or nothing before the lock appears.
 */
function renderRowLock(context: RowContext): string {
  const { layout, metrics, theme, row, atMs } = context
  const { schedule } = row
  const appear = easeOut(progress(atMs, schedule.lockAt, 200))
  if (appear <= 0) {
    return ''
  }
  const closing = easeOut(progress(atMs, schedule.closeAt, schedule.lockMs))
  const opening = row.openAt === undefined ? 0 : easeOut(progress(atMs, row.openAt, OPEN_MS))
  const open = closing < 1 ? 1 - closing : opening
  const refused = row.refuseAt !== undefined && atMs >= row.refuseAt
  const colour = refused ? theme.tones.danger : opening > 0 ? theme.tones.success : theme.tones.warning
  const cx = layout.lock.x + metrics.lockPx / 2
  const lock = renderLock(cx, row.y, metrics.lockPx, open, colour, theme)
  const cross =
    row.refuseAt === undefined
      ? ''
      : renderCross(layout.lock.x + metrics.lockPx, row.y - metrics.lockPx * 0.45, easeOut(progress(atMs, row.refuseAt, FADE_MS)), theme)
  return `<g transform="translate(${cx.toFixed(1)} ${row.y}) scale(${appear.toFixed(3)}) translate(${(-cx).toFixed(1)} ${-row.y})">${lock}</g>${cross}`
}

/**
 * The outline that flashes around the strip at the moment it seals.
 *
 * @param context - The strip at this instant.
 * @returns SVG markup, or nothing outside the flash.
 */
function renderSealFlash(context: RowContext): string {
  const { layout, metrics, theme, row, atMs } = context
  const strength = pulse(atMs, row.schedule.sealedAt, SEAL_FLASH_MS)
  if (strength <= 0) {
    return ''
  }
  const pad = 6 + 3 * (1 - strength)
  const x = layout.salt.x - pad
  const width = layout.lock.x + metrics.lockPx - layout.salt.x + pad * 2
  const height = metrics.cellHeightPx + pad * 2
  return `<rect x="${x.toFixed(1)}" y="${(row.y - height / 2).toFixed(1)}" width="${width.toFixed(1)}" height="${height.toFixed(1)}" rx="${(pad + 3).toFixed(1)}" fill="none" stroke="${theme.accent}" stroke-width="1.5" opacity="${(0.85 * strength).toFixed(3)}"/>`
}

/**
 * How far the strip is thrown sideways while it shakes against the wrong key.
 *
 * @param row - The strip being drawn.
 * @param atMs - Offset from the start of the timeline.
 * @returns A horizontal offset in pixels.
 */
function jitter(row: RowInstant, atMs: number): number {
  if (row.jitterAt === undefined) {
    return 0
  }
  const t = progress(atMs, row.jitterAt, JITTER_MS)
  if (t <= 0 || t >= 1) {
    return 0
  }
  const step = floor(t * JITTER_STEPS)
  // why: alternating whole steps rather than a sine, so every captured frame lands on a peak and the shake reads at twelve frames a second
  return 3 * (step % 2 === 0 ? 1 : -1) * (1 - t * 0.7)
}

/**
 * Draw one strip: its runs, its cells, its labels and its lock.
 *
 * @param context - The strip at this instant.
 * @returns SVG markup for the whole strip.
 * @example The first strip at one second
 * ```ts
 * renderRow({ config, layout, metrics, theme, row: rowA, atMs: 1_000 })
 * ```
 */
export function renderRow(context: RowContext): string {
  const { config, layout, theme, row } = context
  const { schedule } = row
  const cipherLabel = `${config.cipherName} ${config.secret.length}B`
  const body = [
    renderSealFlash(context),
    renderBlocks(context, layout.salt, config.salt, schedule.saltAt, 0, theme.tones.accent),
    renderBlocks(context, layout.iv, config.iv, schedule.ivAt, config.salt.bytes, theme.tones.success),
    renderCells(context),
    renderBlocks(context, layout.tag, config.tag, schedule.tagAt, config.salt.bytes + config.iv.bytes, theme.tones.warning),
    renderRowLock(context),
    renderLabel(context, layout.salt, `${config.salt.name} ${config.salt.bytes}B`, schedule.ivAt),
    renderLabel(context, layout.iv, `${config.iv.name} ${config.iv.bytes}B`, schedule.scrambleAt),
    renderLabel(context, layout.cells, cipherLabel, schedule.tagAt),
    renderLabel(context, layout.tag, `${config.tag.name} ${config.tag.bytes}B`, schedule.sealedAt),
  ].join('')
  const dx = jitter(row, context.atMs)
  return dx === 0 ? body : `<g transform="translate(${dx.toFixed(2)} 0)">${body}</g>`
}
