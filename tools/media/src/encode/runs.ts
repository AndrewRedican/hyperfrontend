/** One decoded frame, resampled to its output size. */
export interface RawFrame {
  /** Pixel data, three or four channels. */
  data: Buffer
  /** Width of the frame after resampling. */
  width: number
  /** Height of the frame after resampling. */
  height: number
}

/** A run of frames and how long each is held, after a pass has thinned or folded them. */
export interface FrameRun {
  /** The frames in order. */
  frames: RawFrame[]
  /** Display time of each frame, index for index. */
  delaysMs: number[]
}

/** One frame and how long it is shown, while a pass is deciding what survives. */
interface Run {
  /** The frame. */
  frame: RawFrame
  /** How long it is shown. */
  delayMs: number
}

/**
 * Split runs back into the frames and delays the encoder takes.
 *
 * @param runs - The surviving frames with their display times.
 * @returns The same, as two parallel lists.
 */
function unzip(runs: readonly Run[]): FrameRun {
  return { frames: runs.map((run) => run.frame), delaysMs: runs.map((run) => run.delayMs) }
}

/**
 * Fold runs of identical frames into one frame held for longer.
 *
 * A scripted scene pauses on purpose, and a pause is a run of frames that are
 * byte for byte the same. Each of those frames costs the encoder a comparison
 * and the file a header; one frame with the delays added up costs neither and
 * plays back identically. A frame with no delay recorded for it is shown for
 * no time, which is to say folded away.
 *
 * @param frames - The frames in order.
 * @param delaysMs - Display time of each frame, index for index.
 * @returns The surviving frames and their display times.
 * @example Three frames, the last two the same
 * ```ts
 * foldDuplicates([a, b, b], [100, 100, 100]) // { frames: [a, b], delaysMs: [100, 200] }
 * ```
 */
export function foldDuplicates(frames: readonly RawFrame[], delaysMs: readonly number[]): FrameRun {
  const runs: Run[] = []
  frames.forEach((frame, index) => {
    const delayMs = delaysMs[index] ?? 0
    const previous = runs[runs.length - 1]
    if (previous !== undefined && previous.frame.data.equals(frame.data)) {
      previous.delayMs += delayMs
      return
    }
    runs.push({ frame, delayMs })
  })
  return unzip(runs)
}

/**
 * Keep every nth frame, giving each survivor the display time of the frames it stands for.
 *
 * @param frames - The frames in order.
 * @param delaysMs - Display time of each frame, index for index.
 * @param keepEvery - Keep one frame in this many.
 * @returns The surviving frames and their display times.
 * @example Halving the frame rate
 * ```ts
 * decimate([a, b, c, d], [100, 100, 100, 100], 2) // { frames: [a, c], delaysMs: [200, 200] }
 * ```
 */
export function decimate(frames: readonly RawFrame[], delaysMs: readonly number[], keepEvery: number): FrameRun {
  const kept = frames.filter((_frame, index) => index % keepEvery === 0)
  return {
    frames: kept,
    delaysMs: kept.map((_frame, group) =>
      delaysMs.slice(group * keepEvery, (group + 1) * keepEvery).reduce((sum, delayMs) => sum + delayMs, 0)
    ),
  }
}
