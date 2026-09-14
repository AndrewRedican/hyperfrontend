import type { LevelName } from '../models/levels'
import type { MediaProfile } from '../models/profile'
import { max } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'

/**
 * The levels in the order the scale lays them out: the one that always prints
 * on the left, the one that prints last on the right.
 *
 * The order is the logger's own priority order, highest first, so a knob on a
 * stop admits every stop to its left and hides every stop to its right.
 */
export const LEVELS: readonly LevelName[] = ['error', 'warn', 'log', 'info', 'debug']

/** Width past which the frame is drawn at its full density. */
const WIDE_ENOUGH = 800

/** How the frame is sized for the surface it is being drawn for. */
export interface LevelsMetrics {
  /** Margin between the window and the edge of the frame. */
  insetPx: number
  /** Corner radius of the window. */
  radiusPx: number
  /** Height of the title bar. */
  chromePx: number
  /** Padding inside the window, around the content. */
  padPx: number
  /** Font size of the title in the bar. */
  titlePx: number
  /** Height of the control strip the scale sits in. */
  bandPx: number
  /** Vertical centre of the rail, inside the body. */
  railY: number
  /** Vertical centre of the level words, inside the body. */
  wordY: number
  /** Horizontal centre of the first stop, inside the body. */
  stopStartX: number
  /** Distance between neighbouring stops. */
  stopGapPx: number
  /** Radius of the knob. */
  knobPx: number
  /** Radius of a stop's tick on the rail. */
  tickPx: number
  /** Font size of the level words. */
  wordPx: number
  /** Font size of the API chip. */
  chipPx: number
  /** Font size of a logged line. */
  linePx: number
  /** Diameter of the level pip at the head of a line. */
  pipPx: number
  /** Distance between neighbouring lines. */
  linePitchPx: number
}

/**
 * Size the frame for the surface it is being drawn for.
 *
 * @param profile - The presentation target being composed for.
 * @returns Every measurement the renderer needs.
 * @example The compact profile's measurements
 * ```ts
 * levelsMetrics(resolveProfile('compact'))
 * ```
 */
export function levelsMetrics(profile: MediaProfile): LevelsMetrics {
  const wide = profile.width >= WIDE_ENOUGH
  return {
    insetPx: wide ? 28 : 22,
    radiusPx: wide ? 12 : 9,
    chromePx: wide ? 38 : 32,
    padPx: wide ? 24 : 16,
    titlePx: wide ? 13 : 11,
    bandPx: wide ? 84 : 68,
    railY: wide ? 34 : 27,
    wordY: wide ? 62 : 50,
    stopStartX: wide ? 52 : 34,
    stopGapPx: wide ? 112 : 82,
    knobPx: wide ? 7 : 6,
    tickPx: wide ? 4 : 3.5,
    wordPx: wide ? 13 : 11.5,
    chipPx: wide ? 13.5 : 12,
    linePx: wide ? 15 : 13,
    pipPx: wide ? 9 : 8,
    linePitchPx: wide ? 48 : 38,
  }
}

/**
 * The size of the window body, which every position inside it is measured against.
 *
 * @param profile - The presentation target being composed for.
 * @param metrics - The measurements this profile is drawn at.
 * @returns Width and height of the body in CSS pixels.
 * @example The body of the compact window
 * ```ts
 * bodySize(profile, levelsMetrics(profile))
 * ```
 */
export function bodySize(profile: MediaProfile, metrics: LevelsMetrics): readonly [number, number] {
  // why: the window carries a one pixel border on each side, and the body is what is left under the bar
  return [profile.width - metrics.insetPx * 2 - 2, profile.height - metrics.insetPx * 2 - 2 - metrics.chromePx]
}

/**
 * Where a level sits on the scale.
 *
 * @param level - The level name, as the logger spells it.
 * @returns Its index on the scale, 0 for the level that always prints.
 * @example Where debug sits on the scale
 * ```ts
 * levelIndex('debug') // 4
 * ```
 */
export function levelIndex(level: LevelName): number {
  return max(0, LEVELS.indexOf(level))
}

/**
 * The horizontal centre of a position on the scale.
 *
 * @param metrics - The measurements this profile is drawn at.
 * @param position - A stop's index, or a point between two stops.
 * @returns Pixels from the left of the body.
 * @example The pixel the warn stop sits at
 * ```ts
 * stopX(metrics, 1)
 * ```
 */
export function stopX(metrics: LevelsMetrics, position: number): number {
  return metrics.stopStartX + position * metrics.stopGapPx
}

/**
 * The vertical centre of a line's row.
 *
 * The rows are centred as a block in the space under the control strip, so a
 * body of any height carries them without a gap at one end.
 *
 * @param metrics - The measurements this profile is drawn at.
 * @param bodyHeight - Height of the window body.
 * @param index - The row, 0 for the top one.
 * @returns Pixels from the top of the body.
 * @example The row of the log line
 * ```ts
 * lineY(metrics, bodyHeight, 2)
 * ```
 */
export function lineY(metrics: LevelsMetrics, bodyHeight: number, index: number): number {
  const block = (LEVELS.length - 1) * metrics.linePitchPx
  return metrics.bandPx + (bodyHeight - metrics.bandPx - block) / 2 + index * metrics.linePitchPx
}
