import type { GaltonConfig } from '../models/galton'
import type { MediaProfile } from '../models/profile'

/** Width past which the frame is drawn at its full density. */
const WIDE_ENOUGH = 800

/** How the frame is sized for the surface it is being drawn for. */
export interface GaltonMetrics {
  /** Margin between the drawing and the edge of the frame. */
  insetPx: number
  /** Font size of the API chip. */
  chipPx: number
  /** Font size of the method label above each board. */
  labelPx: number
  /** Font size of the values under the floor. */
  axisPx: number
  /** Distance from one column's left edge to the next. */
  pitchPx: number
  /** Width of a grain, a little under the pitch so neighbouring columns stay distinct. */
  grainWidthPx: number
  /** Height of a grain, which is also the height of one row of a pile. */
  grainHeightPx: number
  /** Space between the outermost column and the board's wall. */
  boardPadPx: number
  /** Space between the two boards. */
  boardGapPx: number
  /** Bottom of the API chip, where the fork to the method labels starts. */
  chipBottomY: number
  /** Vertical centre of the method labels. */
  labelY: number
  /** Top of the boards, where a grain is released. */
  boardTop: number
  /** The floor a pile stands on. */
  floorY: number
  /** Baseline of the values under the floor. */
  axisY: number
}

/** Where one board sits in the frame. */
export interface BoardGeometry {
  /** Left edge of the board. */
  x: number
  /** Width of the board. */
  width: number
  /** Horizontal centre of the board. */
  centreX: number
  /** Left edge of the first column. */
  pileX: number
}

/**
 * Size the frame for the surface it is being drawn for.
 *
 * @param profile - The presentation target being composed for.
 * @returns Every measurement the renderer needs.
 */
export function galtonMetrics(profile: MediaProfile): GaltonMetrics {
  const wide = profile.width >= WIDE_ENOUGH
  return {
    insetPx: wide ? 28 : 18,
    chipPx: wide ? 13 : 12,
    labelPx: wide ? 13.5 : 12,
    axisPx: wide ? 12 : 11,
    pitchPx: wide ? 15 : 10.5,
    grainWidthPx: wide ? 13 : 9,
    grainHeightPx: wide ? 7 : 5,
    boardPadPx: wide ? 6 : 4,
    boardGapPx: wide ? 60 : 40,
    chipBottomY: wide ? 52 : 40,
    labelY: wide ? 96 : 66,
    boardTop: wide ? 130 : 90,
    floorY: wide ? 462 : 318,
    axisY: wide ? 482 : 334,
  }
}

/**
 * Where one board sits, with every board centred as a group in the frame.
 *
 * @param config - The scene's configuration.
 * @param profile - The presentation target being composed for.
 * @param metrics - The measurements this profile is drawn at.
 * @param index - Which board, 0 for the leftmost.
 * @returns The board's horizontal extent.
 */
export function boardGeometry(config: GaltonConfig, profile: MediaProfile, metrics: GaltonMetrics, index: number): BoardGeometry {
  const width = config.columns * metrics.pitchPx + metrics.boardPadPx * 2
  const count = config.boards.length
  const total = count * width + (count - 1) * metrics.boardGapPx
  const x = (profile.width - total) / 2 + index * (width + metrics.boardGapPx)
  return { x, width, centreX: x + width / 2, pileX: x + metrics.boardPadPx }
}

/**
 * The left edge of a grain in a column.
 *
 * @param geometry - The board the column belongs to.
 * @param metrics - The measurements this profile is drawn at.
 * @param column - The column, 0 for the leftmost.
 * @returns Pixels from the left of the frame.
 */
export function grainX(geometry: BoardGeometry, metrics: GaltonMetrics, column: number): number {
  return geometry.pileX + column * metrics.pitchPx + (metrics.pitchPx - metrics.grainWidthPx) / 2
}

/**
 * The top edge of a grain once it has come to rest on its pile.
 *
 * @param metrics - The measurements this profile is drawn at.
 * @param row - How many grains sit under it in the same column.
 * @returns Pixels from the top of the frame.
 */
export function restingTop(metrics: GaltonMetrics, row: number): number {
  return metrics.floorY - (row + 1) * metrics.grainHeightPx
}
