import type { GaltonBoard, GaltonConfig } from '../models/galton'
import type { GaltonMetrics } from './layout'
import { max } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'
import { easeIn, lerp, progress } from '../lib/motion'
import { restingTop } from './layout'

/** One grain at one instant: where it is and whether it is still falling. */
export interface GrainState {
  /** The column it fell, or is falling, into. */
  column: number
  /** How many grains sit under it in that column. */
  row: number
  /** Top edge, in pixels of the frame. */
  y: number
  /** Whether it is still between the top of the board and its resting place. */
  airborne: boolean
}

/**
 * When one grain is released.
 *
 * @param config - The scene's configuration.
 * @param index - The grain's position in its board's draw order.
 * @returns Offset from the start of the timeline.
 */
export function releaseAt(config: GaltonConfig, index: number): number {
  return config.startMs + index * config.everyMs
}

/**
 * When the last grain of any board lands.
 *
 * @param config - The scene's configuration.
 * @returns The offset at which both piles are complete.
 */
export function settledAt(config: GaltonConfig): number {
  const longest = config.boards.reduce((most, board) => max(most, board.draws.length), 0)
  return longest === 0 ? config.startMs : releaseAt(config, longest - 1) + config.fallMs
}

/**
 * Every grain of one board that has been released by one instant.
 *
 * Nothing is remembered between frames: each grain's column comes from the
 * draw sequence, its row from how many earlier draws share the column, and its
 * height from how long ago it was released. The loop stops at the first grain
 * not yet released, because releases are in draw order.
 *
 * @param config - The scene's configuration.
 * @param board - The board whose grains are wanted.
 * @param metrics - The measurements this profile is drawn at.
 * @param atMs - Offset from the start of the timeline.
 * @returns The grains to draw, landed ones first in draw order.
 */
export function grainsAt(config: GaltonConfig, board: GaltonBoard, metrics: GaltonMetrics, atMs: number): readonly GrainState[] {
  const heights: number[] = []
  const grains: GrainState[] = []
  for (let index = 0; index < board.draws.length; index += 1) {
    const released = releaseAt(config, index)
    if (atMs < released) {
      break
    }
    const column = board.draws[index] ?? 0
    const row = heights[column] ?? 0
    heights[column] = row + 1
    const rest = restingTop(metrics, row)
    if (atMs >= released + config.fallMs) {
      grains.push({ column, row, y: rest, airborne: false })
      continue
    }
    const y = lerp(metrics.boardTop, rest, easeIn(progress(atMs, released, config.fallMs)))
    grains.push({ column, row, y, airborne: true })
  }
  return grains
}
