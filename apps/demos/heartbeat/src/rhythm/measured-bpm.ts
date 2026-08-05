/**
 * Measured heart rate derived from observed beat timestamps.
 *
 * The displayed rate is never copied from the configured target: it is
 * computed from the beats that actually happened — scheduled beats, visitor
 * extras, jitter, pauses, and recoveries all move it. While beats flow, the
 * reading follows the mean observed interval; once they stop, the growing
 * silence takes over the estimate so the value decays instead of freezing,
 * and it reaches 0 when the window empties.
 */

/** How far back observed beats count toward the measured rate. */
export const DEFAULT_WINDOW_MS = 10000

/** Shortest effective interval the estimate honours — caps the display at 240 bpm and guards coincident timestamps. */
export const MIN_EFFECTIVE_INTERVAL_MS = 250

/** A rolling accumulator of beat timestamps yielding the observed rate. */
export interface MeasuredBpm {
  /**
   * Records one observed beat.
   *
   * @param atMs - Timestamp (ms) the beat happened.
   */
  addBeat(atMs: number): void
  /**
   * Computes the measured rate at a point in time.
   *
   * @param nowMs - The current timestamp (ms).
   * @returns Beats per minute as a rounded integer; 0 while fewer than two beats remain in the window.
   */
  readingAt(nowMs: number): number
  /** Clears every recorded beat. */
  reset(): void
}

/**
 * Creates a measured-BPM accumulator.
 *
 * @param windowMs - How far back beats count; defaults to {@link DEFAULT_WINDOW_MS}.
 * @returns The {@link MeasuredBpm} handle.
 *
 * @example Displaying the observed rate
 * ```typescript
 * const measured = createMeasuredBpm()
 * rhythm.onBeat((beat) => measured.addBeat(beat.at))
 * setInterval(() => render(measured.readingAt(Date.now())), 250)
 * ```
 */
export function createMeasuredBpm(windowMs: number = DEFAULT_WINDOW_MS): MeasuredBpm {
  const stamps: number[] = []
  return {
    addBeat(atMs) {
      stamps.push(atMs)
    },
    readingAt(nowMs) {
      const cutoff = nowMs - windowMs
      while (stamps.length > 0 && stamps[0] !== undefined && stamps[0] < cutoff) {
        stamps.shift()
      }
      const first = stamps[0]
      const last = stamps[stamps.length - 1]
      if (first === undefined || last === undefined || stamps.length < 2) {
        return 0
      }
      const meanInterval = (last - first) / (stamps.length - 1)
      // why: While the silence since the last beat stays shorter than the mean interval the rate holds steady; once it grows past it, the silence drives the estimate down — a live decay instead of a frozen readout.
      const effective = Math.max(meanInterval, nowMs - last, MIN_EFFECTIVE_INTERVAL_MS)
      return Math.round(60000 / effective)
    },
    reset() {
      stamps.length = 0
    },
  }
}
