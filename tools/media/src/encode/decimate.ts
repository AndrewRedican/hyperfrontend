import { max, min, round } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'

/** Which source frames to keep, and how long each kept frame stays on screen. */
export interface FramePlan {
  /** Zero-based indexes of the source frames that survive. */
  indexes: readonly number[]
  /** Display time of each kept frame, in milliseconds, index for index. */
  delaysMs: readonly number[]
}

/**
 * Choose which extracted frames to keep and how long to hold each one.
 *
 * Recorded video arrives at whatever rate the browser managed, which is both
 * higher than a GIF wants and not perfectly even. Rather than resample, this
 * keeps evenly spaced source frames and gives each one the display time of the
 * gap it stands for, so the animation still runs for exactly as long as the
 * source did even when the source rate was ragged.
 *
 * @param sourceCount - How many frames were extracted.
 * @param durationMs - How long those frames span.
 * @param fps - Frames per second the finished animation should run at.
 * @returns The frames to keep and their display times.
 */
export function planFrames(sourceCount: number, durationMs: number, fps: number): FramePlan {
  const kept = min(max(1, sourceCount), max(1, round((durationMs / 1000) * fps)))
  const indexes: number[] = []
  const delaysMs: number[] = []
  for (let position = 0; position < kept; position += 1) {
    indexes.push(min(sourceCount - 1, round((position * sourceCount) / kept)))
    delaysMs.push(max(20, round(((position + 1) * durationMs) / kept) - round((position * durationMs) / kept)))
  }
  return { indexes, delaysMs }
}
