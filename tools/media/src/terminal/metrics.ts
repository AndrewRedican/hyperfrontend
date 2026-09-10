import type { MediaProfile } from '../models/profile'
import { floor, max } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'

/** Width past which a profile is treated as a reading surface rather than a thumbnail. */
const WIDE_ENOUGH = 800

/** Advance width of one character, as a fraction of the font size, for a monospace face. */
const CHARACTER_RATIO = 0.6

/** How the terminal is sized for the surface it is being drawn for. */
export interface TerminalMetrics {
  /** Font size of the terminal text. */
  fontSizePx: number
  /** Line height of the terminal text. */
  lineHeightPx: number
  /** Padding inside the window, around the text. */
  padPx: number
  /** Margin between the window and the edge of the frame. */
  insetPx: number
  /** Height of the title bar, or 0 when the window has none. */
  chromePx: number
  /** Corner radius of the window. */
  radiusPx: number
  /** How many rows fit inside the window. */
  rows: number
  /** How many characters fit across it. */
  columns: number
}

/**
 * Size the terminal for the surface it is being drawn for.
 *
 * A recording that is composed once and scaled down arrives at the small size
 * with type nobody can read, so the two profiles are treated as two different
 * surfaces rather than one at two magnifications. The wide one gets more rows
 * and more columns; the compact one gets proportionally larger type and shows
 * less, which is the trade a phone actually wants.
 *
 * @param profile - The presentation target being composed for.
 * @param hasTitle - Whether the window is drawn with a title bar.
 * @returns Every measurement the renderer needs.
 */
export function terminalMetrics(profile: MediaProfile, hasTitle: boolean): TerminalMetrics {
  const wide = profile.width >= WIDE_ENOUGH
  const fontSizePx = wide ? 16 : 14
  const lineHeightPx = wide ? 26 : 23
  const padPx = wide ? 24 : 16
  const insetPx = wide ? 26 : 14
  const chromePx = hasTitle ? (wide ? 38 : 32) : 0
  const inner = profile.height - insetPx * 2 - chromePx - padPx * 2
  const across = profile.width - insetPx * 2 - padPx * 2
  return {
    fontSizePx,
    lineHeightPx,
    padPx,
    insetPx,
    chromePx,
    radiusPx: wide ? 12 : 9,
    rows: max(1, floor(inner / lineHeightPx)),
    columns: max(1, floor(across / (fontSizePx * CHARACTER_RATIO))),
  }
}
