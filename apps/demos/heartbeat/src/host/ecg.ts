/**
 * Pure ECG geometry: the mostly-flat, single-sharp-spike waveform each
 * received beat contributes, the composed trace value at any point in time,
 * and the flatline judgement. The canvas painter stays thin; everything
 * measurable lives here.
 */

/** A received beat positioned on the trace timeline. */
export interface EcgBeatMark {
  /** Timestamp (ms) the beat was received. */
  at: number
  /** Whether the beat came from the rhythm or a visitor extra. */
  source: 'rhythm' | 'user'
}

/** Total duration of one beat's spike complex. */
export const COMPLEX_MS = 150
/** Offset (ms) of the spike's peak within a complex. */
export const R_PEAK_MS = 75
/** Amplitude multiplier that makes user beats read taller. */
export const USER_GAIN = 1.3
/** Multiples of the expected interval after which silence counts as flatline. */
export const FLATLINE_FACTOR = 3

/**
 * The expected time between beats at a given rate.
 *
 * @param bpm - The rate in beats per minute.
 * @returns The interval in milliseconds.
 */
export function expectedIntervalMs(bpm: number): number {
  return 60000 / bpm
}

/**
 * Judges whether the trace should read as flatlined from silence alone.
 *
 * @param nowMs - The current timestamp (ms).
 * @param lastBeatAt - Timestamp of the last received beat, or `null` when none arrived yet.
 * @param bpm - The last known pacing rate the silence is measured against.
 * @returns `true` once the silence exceeds {@link FLATLINE_FACTOR} expected intervals.
 */
export function isFlatline(nowMs: number, lastBeatAt: number | null, bpm: number): boolean {
  if (lastBeatAt === null) {
    // why: Before the first beat there is no rhythm to have lost — silence is absence of evidence, not asystole.
    return false
  }
  return nowMs - lastBeatAt > FLATLINE_FACTOR * expectedIntervalMs(bpm)
}

/** One segment of the piecewise spike shape: [start, end, amplitude]. */
const SEGMENTS: ReadonlyArray<readonly [number, number, number]> = [
  // note: A shallow lead-in dip, the single sharp spike, and a shallow settle dip — the trace stays flat everywhere else.
  [0, 40, -0.08],
  [40, 110, 1],
  [110, 150, -0.12],
]

/**
 * Samples the single-spike waveform of one beat.
 *
 * @param phaseMs - Milliseconds since the beat's onset.
 * @param gain - Amplitude multiplier; user beats pass {@link USER_GAIN}.
 * @returns The signed amplitude (the spike peak reaches `gain`), 0 outside the complex.
 */
export function waveValue(phaseMs: number, gain = 1): number {
  if (phaseMs < 0 || phaseMs > COMPLEX_MS) {
    return 0
  }
  for (const [start, end, amplitude] of SEGMENTS) {
    if (phaseMs >= start && phaseMs <= end) {
      // how: Each segment is a half-sine bump spanning its window.
      return gain * amplitude * Math.sin((Math.PI * (phaseMs - start)) / (end - start))
    }
  }
  return 0
}

/**
 * Composes the trace value at a point in time from the received beats.
 *
 * @param timeMs - The timeline position (ms) to sample.
 * @param beats - The received beats to compose.
 * @returns The summed amplitude of every complex overlapping `timeMs`.
 */
export function traceValue(timeMs: number, beats: readonly EcgBeatMark[]): number {
  let value = 0
  for (const beat of beats) {
    value += waveValue(timeMs - beat.at, beat.source === 'user' ? USER_GAIN : 1)
  }
  return value
}

/**
 * Deterministic low-amplitude baseline wander, so the live trace reads as a
 * monitor rather than a ruler.
 *
 * @param timeMs - The timeline position (ms) to sample.
 * @returns A small signed amplitude, bounded by ±0.03.
 */
export function baselineNoise(timeMs: number): number {
  return 0.015 * Math.sin(timeMs * 0.013) + 0.015 * Math.sin(timeMs * 0.0047 + 1.7)
}
