/**
 * Rolling BPM derived from received beat timestamps.
 *
 * The host measures the rate it actually observes — user extras shorten the
 * mean interval and visibly bump the readout — rather than trusting the
 * feature's announced target.
 */

/** How far back received beats count toward the rolling rate. */
export const DEFAULT_WINDOW_MS = 10000

/** A rolling window of beat timestamps that yields the observed rate. */
export interface RollingBpm {
  /**
   * Records one received beat.
   *
   * @param atMs - Timestamp (ms) the beat was received.
   */
  addBeat(atMs: number): void
  /**
   * Computes the observed rate over the window ending now.
   *
   * @param nowMs - The current timestamp (ms).
   * @returns Beats per minute (rounded), or `null` while fewer than two beats are in the window.
   */
  bpmAt(nowMs: number): number | null
  /** Clears every recorded beat. */
  reset(): void
}

/**
 * Creates a rolling BPM window.
 *
 * @param windowMs - How far back beats count; defaults to {@link DEFAULT_WINDOW_MS}.
 * @returns The {@link RollingBpm} accumulator.
 *
 * @example Observing the rate of incoming beats
 * ```typescript
 * const rolling = createRollingBpm()
 * shell.on('beat', () => rolling.addBeat(Date.now()))
 * setInterval(() => render(rolling.bpmAt(Date.now())), 500)
 * ```
 */
export function createRollingBpm(windowMs: number = DEFAULT_WINDOW_MS): RollingBpm {
  const stamps: number[] = []
  return {
    addBeat(atMs) {
      stamps.push(atMs)
    },
    bpmAt(nowMs) {
      const cutoff = nowMs - windowMs
      while (stamps.length > 0 && stamps[0] !== undefined && stamps[0] < cutoff) {
        stamps.shift()
      }
      const first = stamps[0]
      const last = stamps[stamps.length - 1]
      if (first === undefined || last === undefined || stamps.length < 2) {
        return null
      }
      if (last <= first) {
        // why: Coincident timestamps (a user extra landing in the same millisecond) would divide by zero.
        return null
      }
      return Math.round((60000 * (stamps.length - 1)) / (last - first))
    },
    reset() {
      stamps.length = 0
    },
  }
}
