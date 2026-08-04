/**
 * Thin canvas painter for the ECG: scrolls the composed trace right-to-left
 * across the stage overlay. All measurable geometry lives in `ecg.ts`; this
 * file only turns those samples into pixels.
 */
import type { EcgBeatMark } from './ecg'
import { COMPLEX_MS, baselineNoise, traceValue } from './ecg'

/** How many milliseconds one horizontal pixel spans. */
const MS_PER_PX = 6
/** The trace red, with a soft glow of the same hue. */
const TRACE_COLOR = '#ff4a55'
/** Fraction of the canvas height where the flat baseline sits. */
const BASELINE_FRACTION = 0.68
/** Fraction of the canvas height one full-gain spike rises. */
const AMPLITUDE_FRACTION = 0.34

/** The scrolling ECG painter. */
export interface EcgRenderer {
  /**
   * Adds one received beat to the trace.
   *
   * @param mark - The beat's receipt time and source.
   */
  addBeat(mark: EcgBeatMark): void
  /**
   * Forces (or releases) the flat baseline, silencing the wander noise.
   *
   * @param flat - `true` while the rhythm reads as flatlined.
   */
  setFlat(flat: boolean): void
  /** Starts the animation loop. */
  start(): void
  /** Stops the animation loop. */
  stop(): void
}

/**
 * Creates the scrolling ECG painter for a canvas.
 *
 * The canvas overlays the feature's stage, so the painter draws only the
 * trace — transparent everywhere else — and lets the stage show through.
 *
 * @param canvas - The target canvas element.
 * @returns The {@link EcgRenderer} handle.
 */
export function createEcgRenderer(canvas: HTMLCanvasElement): EcgRenderer {
  const context = canvas.getContext('2d')
  const beats: EcgBeatMark[] = []
  let flat = false
  let frame = 0

  const paint = (): void => {
    if (context === null) {
      return
    }
    const { width, height } = canvas
    const now = Date.now()
    const windowMs = width * MS_PER_PX

    // why: Beats older than the visible window plus one complex can never contribute a sample again.
    while (beats.length > 0 && beats[0] !== undefined && beats[0].at < now - windowMs - COMPLEX_MS) {
      beats.shift()
    }

    context.clearRect(0, 0, width, height)

    const baselineY = height * BASELINE_FRACTION
    const amplitude = height * AMPLITUDE_FRACTION

    context.strokeStyle = TRACE_COLOR
    context.lineWidth = 2
    context.shadowColor = TRACE_COLOR
    context.shadowBlur = 8
    context.beginPath()
    for (let x = 0; x < width; x += 1) {
      const timeMs = now - (width - x) * MS_PER_PX
      const value = traceValue(timeMs, beats) + (flat ? 0 : baselineNoise(timeMs))
      const y = baselineY - value * amplitude
      if (x === 0) {
        context.moveTo(x, y)
      } else {
        context.lineTo(x, y)
      }
    }
    context.stroke()
    context.shadowBlur = 0

    frame = requestAnimationFrame(paint)
  }

  return {
    addBeat(mark) {
      beats.push(mark)
    },
    setFlat(next) {
      flat = next
    },
    start() {
      if (frame === 0) {
        frame = requestAnimationFrame(paint)
      }
    },
    stop() {
      cancelAnimationFrame(frame)
      frame = 0
    },
  }
}
