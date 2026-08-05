/**
 * Thin canvas painter for the ECG: a hospital-monitor sweep. The write head
 * travels left to right at a fixed time-per-pixel, overwriting the previous
 * pass, with a small erased gap kept just ahead of it — so the trace visibly
 * moves even when the line is flat, and a flatline still reads as a running
 * monitor. All measurable geometry lives in `ecg.ts`; this file only turns
 * those samples into pixels.
 */
import type { EcgBeatMark } from './ecg'
import { COMPLEX_MS, SWEEP_GAP_PX, baselineNoise, inSweepGap, traceValue } from './ecg'

/** How many milliseconds one horizontal pixel spans. */
const MS_PER_PX = 6
/** The trace red, with a soft glow of the same hue. */
const TRACE_COLOR = '#ff4a55'
/** Fraction of the canvas height where the flat baseline sits. */
const BASELINE_FRACTION = 0.68
/** Fraction of the canvas height one full-gain spike rises. */
const AMPLITUDE_FRACTION = 0.34

/** The sweeping ECG painter. */
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
 * Creates the sweeping ECG painter for a canvas.
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
  const samples = new Float32Array(canvas.width).fill(Number.NaN)
  let flat = false
  let frame = 0
  let lastColumn: number | null = null

  const paint = (): void => {
    if (context === null) {
      return
    }
    const { width, height } = canvas
    const now = Date.now()

    // why: A beat only shapes columns while its complex overlaps the head; once written into the sweep it persists as pixels, so old marks can go.
    while (beats.length > 0 && beats[0] !== undefined && beats[0].at < now - COMPLEX_MS - 1000) {
      beats.shift()
    }

    // how: Every column owns the instant the head passed it — the head writes each column exactly once per lap, at that column's own time.
    const column = Math.floor(now / MS_PER_PX)
    const from = lastColumn === null ? column : lastColumn + 1
    const start = column - from >= width ? column - width + 1 : from
    for (let abs = start; abs <= column; abs += 1) {
      const timeMs = abs * MS_PER_PX
      samples[abs % width] = traceValue(timeMs, beats) + (flat ? 0 : baselineNoise(timeMs))
    }
    lastColumn = column
    const headX = column % width

    context.clearRect(0, 0, width, height)

    const baselineY = height * BASELINE_FRACTION
    const amplitude = height * AMPLITUDE_FRACTION

    context.strokeStyle = TRACE_COLOR
    context.lineWidth = 2
    context.shadowColor = TRACE_COLOR
    context.shadowBlur = 8
    context.beginPath()
    let drawing = false
    for (let x = 0; x < width; x += 1) {
      const value = samples[x]
      if (value === undefined || Number.isNaN(value) || inSweepGap(x, headX, SWEEP_GAP_PX, width)) {
        drawing = false
        continue
      }
      const y = baselineY - value * amplitude
      if (drawing) {
        context.lineTo(x, y)
      } else {
        context.moveTo(x, y)
        drawing = true
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
