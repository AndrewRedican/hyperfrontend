import type { EnvelopeConfig } from '../models/envelope'
import type { MediaProfile } from '../models/profile'
import { round } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'

/** The width the composition is designed at; every measurement scales from it. */
const DESIGN_WIDTH = 640

/** How the frame is sized for the surface it is being drawn for. */
export interface EnvelopeMetrics {
  /** Margin between the drawing and the edge of the frame. */
  insetPx: number
  /** Width of one block of random material. */
  blockPx: number
  /** Gap between two blocks. */
  blockGapPx: number
  /** Height of a block. */
  blockHeightPx: number
  /** Width of one character cell. */
  cellPx: number
  /** Gap between two cells. */
  cellGapPx: number
  /** Height of a cell. */
  cellHeightPx: number
  /** Gap between two runs of the strip. */
  segmentGapPx: number
  /** Width of the lock. */
  lockPx: number
  /** Length of a key from its tip to the far side of its bow. */
  keyPx: number
  /** Font size of the characters in the cells. */
  cellFontPx: number
  /** Font size of the run labels under the strip. */
  labelPx: number
  /** Font size of the API chips. */
  chipPx: number
  /** Font size of the sign between the two strips. */
  signPx: number
  /** Vertical centre of the first strip. */
  rowAY: number
  /** Vertical centre of the second strip. */
  rowBY: number
}

/** A horizontal run of the frame. */
export interface Span {
  /** Left edge. */
  x: number
  /** Width. */
  width: number
}

/** Where everything on the strip sits, measured once and shared by both rows. */
export interface EnvelopeLayout {
  /** The salt blocks. */
  salt: Span
  /** The initialisation vector blocks. */
  iv: Span
  /** The character cells. */
  cells: Span
  /** The tag blocks. */
  tag: Span
  /** The lock. */
  lock: Span
  /** Where a key rests once it has reached the lock. */
  key: Span
  /** Where a key starts from, off the right edge of the frame. */
  keyStartX: number
  /** How far below a strip's centre the labels' baseline sits. */
  labelDropPx: number
  /** Vertical centre of the sign between the strips. */
  signY: number
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
 * @example The compact profile's cell width
 * ```ts
 * envelopeMetrics(resolveProfile('compact')).cellPx // 15
 * ```
 */
export function envelopeMetrics(profile: MediaProfile): EnvelopeMetrics {
  const unit = profile.width / DESIGN_WIDTH
  return {
    insetPx: round(22 * unit),
    blockPx: round(5 * unit),
    blockGapPx: round(1 * unit),
    blockHeightPx: round(22 * unit),
    cellPx: round(15 * unit),
    cellGapPx: round(1 * unit),
    cellHeightPx: round(26 * unit),
    segmentGapPx: round(8 * unit),
    lockPx: round(18 * unit),
    keyPx: round(30 * unit),
    cellFontPx: round(12 * unit),
    labelPx: round(11 * unit),
    chipPx: round(12 * unit),
    signPx: round(18 * unit),
    rowAY: round(148 * unit),
    rowBY: round(242 * unit),
  }
}

/**
 * The width a run of blocks takes.
 *
 * @param bytes - How many blocks.
 * @param metrics - The measurements this profile is drawn at.
 * @returns Width in pixels, the trailing gap left off.
 */
function blocksWidth(bytes: number, metrics: EnvelopeMetrics): number {
  return bytes * (metrics.blockPx + metrics.blockGapPx) - metrics.blockGapPx
}

/**
 * Lay the strip out across the frame.
 *
 * The strip and the key that ends up resting against its lock are centred
 * together, so the resolved picture at the end of the loop is the one that
 * sits in the middle of the frame.
 *
 * @param config - The strip as the scene configured it.
 * @param metrics - The measurements this profile is drawn at.
 * @param profile - The presentation target being composed for.
 * @returns Where every run, the lock and the keys sit.
 * @example Where the cells of the compact strip start
 * ```ts
 * envelopeLayout(config, envelopeMetrics(profile), profile).cells.x
 * ```
 */
export function envelopeLayout(config: EnvelopeConfig, metrics: EnvelopeMetrics, profile: MediaProfile): EnvelopeLayout {
  const saltWidth = blocksWidth(config.salt.bytes, metrics)
  const ivWidth = blocksWidth(config.iv.bytes, metrics)
  const cellsWidth = config.secret.length * (metrics.cellPx + metrics.cellGapPx) - metrics.cellGapPx
  const tagWidth = blocksWidth(config.tag.bytes, metrics)
  const lockGap = round(metrics.segmentGapPx / 2)
  const keyGap = round(metrics.segmentGapPx / 2)
  const total = saltWidth + ivWidth + cellsWidth + tagWidth + metrics.segmentGapPx * 3 + lockGap + metrics.lockPx + keyGap + metrics.keyPx
  const left = round((profile.width - total) / 2)
  const salt = { x: left, width: saltWidth }
  const iv = { x: salt.x + saltWidth + metrics.segmentGapPx, width: ivWidth }
  const cells = { x: iv.x + ivWidth + metrics.segmentGapPx, width: cellsWidth }
  const tag = { x: cells.x + cellsWidth + metrics.segmentGapPx, width: tagWidth }
  const lock = { x: tag.x + tagWidth + lockGap, width: metrics.lockPx }
  const key = { x: lock.x + metrics.lockPx + keyGap, width: metrics.keyPx }
  return {
    salt,
    iv,
    cells,
    tag,
    lock,
    key,
    keyStartX: profile.width + metrics.keyPx,
    labelDropPx: round(metrics.cellHeightPx / 2 + metrics.labelPx * 1.3),
    signY: round((metrics.rowAY + metrics.rowBY) / 2 + metrics.labelPx * 0.4),
  }
}
