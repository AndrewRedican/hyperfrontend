import type { Mark } from './banner'

/** One timescale, running from its own start to the moment every span shares. */
export interface ClockSpan {
  /** The duration, set large at the start of the span, such as `ten years`. */
  duration: string
  /** What the span measures, set under the duration. */
  label: string
  /** When the span begins, as a decimal year. */
  start: number
  /** Distance between the ruler marks along the span, in years. */
  tickYears: number
  /** Which side of the span's start the labels sit on: `start` reads rightward from it, `end` ends at it. */
  align: 'start' | 'end'
}

/** Everything a scene tells the clocks stage. */
export interface ClocksConfig {
  /** The decimal year the shared axis begins at, on the left edge. */
  axisStart: number
  /** The decimal year every span converges on. */
  axisEnd: number
  /** The spans, top to bottom. */
  spans: readonly ClockSpan[]
  /** Name of the point the spans converge on. */
  target: string
  /** The line under the target's name, such as the month it is being read in. */
  targetNote: string
  /** The mark drawn at the point of convergence. */
  mark: Mark
  /** Years labelled along the ruler at the foot of the figure. */
  rulerYears: readonly number[]
}
