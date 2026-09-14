import type { MediaTheme } from '../models/theme'
import { floor, imul } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'

/** The glyphs a scrambled cell is drawn from. */
const CIPHER_GLYPHS = '0123456789ABCDEF'

/** How many glyphs a cell cycles through before it settles. */
export const SCRAMBLE_STEPS = 4

/** The brightness levels a block of random material can take, darkest first. */
const BLOCK_LEVELS: readonly number[] = [0.3, 0.55, 0.8, 1]

/**
 * Fold one more input into a hash, avalanching it through the whole word.
 *
 * @param hash - The hash so far.
 * @param value - The input to fold in.
 * @returns The new hash.
 */
function fold(hash: number, value: number): number {
  // magic: the two odd multipliers and shift widths of a murmur3 finaliser, which is what makes one changed input bit move every output bit
  let mixed = imul(hash ^ (value + 0x7f4a7c15), 0x9e3779b1)
  mixed ^= mixed >>> 15
  mixed = imul(mixed, 0x85ebca77)
  mixed ^= mixed >>> 13
  return mixed
}

/**
 * A number in [0, 1) that depends on nothing but its three arguments.
 *
 * The random material has to look random and has to be the same on every
 * machine and every run, so it is hashed rather than drawn: the same strip,
 * block and step always give the same value, and two strips never share one.
 *
 * @param strip - Which strip, 0 or 1.
 * @param index - Which block or cell along it.
 * @param step - Which moment of that cell's life, for a cell that cycles.
 * @returns A value from 0 up to but not including 1.
 * @example The brightness of the first strip's third salt block
 * ```ts
 * noise(0, 2, 0)
 * ```
 */
export function noise(strip: number, index: number, step: number): number {
  let hash = fold(fold(fold(0x2545f491, strip), index), step)
  hash ^= hash >>> 16
  hash = imul(hash, 0xc2b2ae35)
  hash ^= hash >>> 16
  return (hash >>> 0) / 0x100000000
}

/**
 * The brightness one block of random material is drawn at.
 *
 * @param strip - Which strip, 0 or 1.
 * @param index - Which block along the whole strip, so no two runs repeat each other.
 * @returns An opacity from the level table.
 * @example The brightness of the second strip's first tag block
 * ```ts
 * blockLevel(1, 28)
 * ```
 */
export function blockLevel(strip: number, index: number): number {
  return BLOCK_LEVELS[floor(noise(strip, index, 0) * BLOCK_LEVELS.length)] ?? 1
}

/**
 * The glyph a cell shows at one step of its scramble, or once it has settled.
 *
 * A settled glyph is never the plain character it replaces, so a cell that
 * happens to hash to its own digit still visibly changes.
 *
 * @param strip - Which strip, 0 or 1.
 * @param cell - Which cell along the strip.
 * @param step - Which step of the scramble; `SCRAMBLE_STEPS - 1` is the settled glyph.
 * @param plain - The character the cell held before it was scrambled.
 * @returns One hex glyph.
 * @example The settled cipher glyph of the first cell
 * ```ts
 * cipherGlyph(0, 0, SCRAMBLE_STEPS - 1, 's')
 * ```
 */
export function cipherGlyph(strip: number, cell: number, step: number, plain: string): string {
  const pick = floor(noise(strip, cell, step + 1) * CIPHER_GLYPHS.length)
  const glyph = CIPHER_GLYPHS[pick] ?? '0'
  if (glyph.toLowerCase() !== plain.toLowerCase()) {
    return glyph
  }
  return CIPHER_GLYPHS[(pick + 1) % CIPHER_GLYPHS.length] ?? '0'
}

/**
 * Draw a padlock with its shackle lifted by a stated fraction.
 *
 * The shackle is drawn first so its right leg disappears into the body when
 * seated and stands clear of it when lifted, which is the whole difference
 * between a lock that is shut and one that is open.
 *
 * @param cx - Horizontal centre of the body.
 * @param cy - Vertical centre of the whole lock.
 * @param width - Width of the body.
 * @param open - How far open, from 0 (seated) to 1 (lifted clear).
 * @param colour - What the lock is drawn in.
 * @param theme - The visual tokens this variant is drawn with, for the keyhole.
 * @returns SVG markup.
 * @example A shut lock in the warning tone
 * ```ts
 * renderLock(500, 160, 18, 0, theme.tones.warning, theme)
 * ```
 */
export function renderLock(cx: number, cy: number, width: number, open: number, colour: string, theme: MediaTheme): string {
  const half = width / 2
  const bodyTop = cy - 2
  const bodyHeight = width * 0.7
  const radius = half * 0.56
  const lift = 5 * open
  const legCut = 5 * open
  const shackle = `M ${(cx - radius).toFixed(1)} ${(bodyTop + 1 - lift).toFixed(1)} V ${(bodyTop - radius - lift).toFixed(1)} A ${radius.toFixed(1)} ${radius.toFixed(1)} 0 0 1 ${(cx + radius).toFixed(1)} ${(bodyTop - radius - lift).toFixed(1)} V ${(bodyTop + 1 - lift - legCut).toFixed(1)}`
  return `<path d="${shackle}" fill="none" stroke="${colour}" stroke-width="2.4" stroke-linecap="round"/>
<rect x="${(cx - half).toFixed(1)}" y="${bodyTop.toFixed(1)}" width="${width}" height="${bodyHeight.toFixed(1)}" rx="3" fill="${colour}"/>
<circle cx="${cx.toFixed(1)}" cy="${(bodyTop + bodyHeight * 0.42).toFixed(1)}" r="1.7" fill="${theme.surface}"/>
<rect x="${(cx - 0.9).toFixed(1)}" y="${(bodyTop + bodyHeight * 0.42).toFixed(1)}" width="1.8" height="${(bodyHeight * 0.32).toFixed(1)}" fill="${theme.surface}"/>`
}

/**
 * Draw a key lying flat, its tip pointing left at the lock it is for.
 *
 * @param tipX - Where the tip of the blade is.
 * @param cy - Vertical centre of the shaft.
 * @param length - Length from the tip to the far side of the bow.
 * @param colour - What the key is drawn in.
 * @returns SVG markup.
 * @example The right key, resting against a lock
 * ```ts
 * renderKey(560, 160, 30, theme.text.plain)
 * ```
 */
export function renderKey(tipX: number, cy: number, length: number, colour: string): string {
  const bowRadius = length * 0.2
  const bowX = tipX + length - bowRadius
  return `<g stroke="${colour}" stroke-width="2.2" stroke-linecap="round" fill="none">
<circle cx="${bowX.toFixed(1)}" cy="${cy.toFixed(1)}" r="${bowRadius.toFixed(1)}"/>
<circle cx="${bowX.toFixed(1)}" cy="${cy.toFixed(1)}" r="1.4" fill="${colour}" stroke="none"/>
<path d="M ${(bowX - bowRadius).toFixed(1)} ${cy.toFixed(1)} H ${tipX.toFixed(1)}"/>
<path d="M ${(tipX + 3).toFixed(1)} ${cy.toFixed(1)} v 4.5 M ${(tipX + 8).toFixed(1)} ${cy.toFixed(1)} v 3.5"/>
</g>`
}

/**
 * Draw the cross that lands on a lock the wrong key could not open.
 *
 * @param cx - Horizontal centre.
 * @param cy - Vertical centre.
 * @param scale - Size from 0 (nothing) to 1 (full).
 * @param theme - The visual tokens this variant is drawn with.
 * @returns SVG markup.
 * @example The cross at full size
 * ```ts
 * renderCross(520, 250, 1, theme)
 * ```
 */
export function renderCross(cx: number, cy: number, scale: number, theme: MediaTheme): string {
  if (scale <= 0) {
    return ''
  }
  return `<g transform="translate(${cx.toFixed(1)} ${cy.toFixed(1)}) scale(${scale.toFixed(3)})">
<circle r="7.5" fill="${theme.surface}" stroke="${theme.tones.danger}" stroke-width="1.8"/>
<path d="M -3 -3 L 3 3 M 3 -3 L -3 3" stroke="${theme.tones.danger}" stroke-width="2.2" stroke-linecap="round"/>
</g>`
}
