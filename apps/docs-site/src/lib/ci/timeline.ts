import type { Execution, ExecutionChain, ExecutionClock, ExecutionLane, ExecutionTask } from './execution'
import { ceil, floor, max, min } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'

/** One task drawn on the clock. */
export interface TimelineBar {
  /** The task */
  task: ExecutionTask
  /** Its chain */
  chain: ExecutionChain
  /** When it started */
  start: number
  /** When it ended */
  end: number
}

/** One row of bars. */
export interface TimelineRow {
  /** A key unique within the lane */
  key: string
  /** The chain the row is of, or null for a slot row packed from several chains */
  chain: ExecutionChain | null
  /** The bars, in start order */
  bars: readonly TimelineBar[]
  /** The tasks of the row that have no start and end */
  unrun: readonly ExecutionTask[]
}

/** One environment on the clock. */
export interface TimelineLane {
  /** The environment's job */
  lane: ExecutionLane
  /** One row per chain, in scheduling order */
  chains: readonly TimelineRow[]
  /** The same bars packed into as few rows as their overlaps allow: one row per slot in use */
  slots: readonly TimelineRow[]
  /** Every bar of the lane */
  bars: readonly TimelineBar[]
  /** Every task of the lane without a start and end */
  unrun: readonly ExecutionTask[]
  /** The most tasks that ran at once */
  peak: number
}

/** A window onto the clock. */
export interface TimeWindow {
  /** The time at the left edge */
  start: number
  /** The time at the right edge */
  end: number
}

/** The narrowest window, in milliseconds. */
export const MIN_WINDOW_MS = 2_000

/** The intervals the axis is marked at, in milliseconds. */
const TICK_STEPS: readonly number[] = [
  1_000, 2_000, 5_000, 10_000, 15_000, 30_000, 60_000, 120_000, 300_000, 600_000, 900_000, 1_800_000, 3_600_000, 7_200_000,
]

/** A row being packed. */
interface PackedRow {
  /** When its last bar ends */
  end: number
  /** Its bars so far */
  bars: TimelineBar[]
}

/**
 * Bars packed into as few rows as their overlaps allow: each bar joins the first row whose last
 * bar ended before it started, so the rows count the slots in use and their number is the peak.
 *
 * @param bars - The bars, in any order
 * @returns The rows, each in start order
 */
export function packRows(bars: readonly TimelineBar[]): TimelineBar[][] {
  const rows: PackedRow[] = []
  for (const bar of [...bars].sort((left, right) => left.start - right.start || left.end - right.end)) {
    const row = rows.find((candidate) => candidate.end <= bar.start)
    if (row === undefined) rows.push({ end: bar.end, bars: [bar] })
    else {
      row.end = bar.end
      row.bars.push(bar)
    }
  }
  return rows.map((row) => row.bars)
}

/**
 * The lanes of an execution on its clock.
 *
 * @param execution - The execution whose lanes are drawn
 * @returns One lane per environment job, with its chain rows and its slot rows
 */
export function timelineLanes(execution: Execution): TimelineLane[] {
  return execution.lanes.map((lane) => {
    const chains: TimelineRow[] = execution.chains
      .filter((chain) => chain.environment === lane.environment)
      .map((chain) => {
        const bars: TimelineBar[] = []
        const unrun: ExecutionTask[] = []
        for (const task of chain.tasks) {
          if (task.startedAt !== null && task.endedAt !== null) bars.push({ task, chain, start: task.startedAt, end: task.endedAt })
          else unrun.push(task)
        }
        return { key: chain.project, chain, bars: bars.sort((left, right) => left.start - right.start), unrun }
      })
    const bars = chains.flatMap((row) => [...row.bars])
    const slots = packRows(bars).map((members, index) => ({ key: `slot-${index}`, chain: null, bars: members, unrun: [] }))
    return { lane, chains, slots, bars, unrun: chains.flatMap((row) => [...row.unrun]), peak: slots.length }
  })
}

/**
 * The window showing the whole clock.
 *
 * @param clock - The clock to show whole
 * @returns The window; a second wide when the clock has not started
 */
export function fitWindow(clock: ExecutionClock): TimeWindow {
  const start = clock.start ?? 0
  return { start, end: max(start + 1000, clock.end ?? start) }
}

/**
 * A window moved inside the clock without changing its width, or the whole clock when it is wider.
 *
 * @param window - The window to move
 * @param clock - The clock it must stay inside
 * @returns The window inside the clock
 */
export function clampWindow(window: TimeWindow, clock: ExecutionClock): TimeWindow {
  const whole = fitWindow(clock)
  const span = window.end - window.start
  if (span >= whole.end - whole.start) return whole
  const start = min(max(window.start, whole.start), whole.end - span)
  return { start, end: start + span }
}

/**
 * A window zoomed around a point.
 *
 * @param window - The window to zoom
 * @param clock - The clock it must stay inside
 * @param factor - Above one zooms in, below one out
 * @param anchor - Where the fixed point sits, as a fraction of the window from its left edge
 * @returns The window, never narrower than {@link MIN_WINDOW_MS} nor wider than the clock
 */
export function zoomWindow(window: TimeWindow, clock: ExecutionClock, factor: number, anchor: number): TimeWindow {
  const whole = fitWindow(clock)
  const span = window.end - window.start
  const next = min(max(span / factor, MIN_WINDOW_MS), whole.end - whole.start)
  const fixed = window.start + span * anchor
  const start = fixed - next * anchor
  return clampWindow({ start, end: start + next }, clock)
}

/**
 * A window moved along the clock.
 *
 * @param window - The window to move
 * @param clock - The clock it must stay inside
 * @param deltaMs - How far, positive towards the end
 * @returns The window, stopped at the clock's edges
 */
export function panWindow(window: TimeWindow, clock: ExecutionClock, deltaMs: number): TimeWindow {
  return clampWindow({ start: window.start + deltaMs, end: window.end + deltaMs }, clock)
}

/**
 * How far a window is zoomed.
 *
 * @param window - The window shown
 * @param clock - The whole clock
 * @returns One for the whole clock, more the narrower the window
 */
export function zoomOf(window: TimeWindow, clock: ExecutionClock): number {
  const whole = fitWindow(clock)
  return (whole.end - whole.start) / max(1, window.end - window.start)
}

/**
 * Where a time falls across a width.
 *
 * @param time - The time to place
 * @param window - The window shown across the width
 * @param width - The width, in pixels
 * @returns The pixel offset from the left edge
 */
export function timeToX(time: number, window: TimeWindow, width: number): number {
  return ((time - window.start) / max(1, window.end - window.start)) * width
}

/**
 * The time at a pixel offset.
 *
 * @param x - The pixel offset from the left edge
 * @param window - The window shown across the width
 * @param width - The width, in pixels
 * @returns The time at the offset
 */
export function xToTime(x: number, window: TimeWindow, width: number): number {
  return window.start + (x / max(1, width)) * (window.end - window.start)
}

/**
 * The interval between two axis marks: the smallest round step that keeps them a readable
 * distance apart at the given width.
 *
 * @param spanMs - The window's width, in milliseconds
 * @param width - The plot's width, in pixels
 * @param minGapPx - The least pixels between two marks
 * @returns The step, in milliseconds
 */
export function tickStep(spanMs: number, width: number, minGapPx = 72): number {
  const least = (spanMs * minGapPx) / max(1, width)
  return TICK_STEPS.find((step) => step >= least) ?? (TICK_STEPS[TICK_STEPS.length - 1] as number)
}

/**
 * The times the axis is marked at: every multiple of the step from the clock's start that falls
 * inside the window.
 *
 * @param window - The window shown
 * @param clock - The clock the marks count from
 * @param step - The interval, in milliseconds
 * @returns The times, in order
 */
export function tickTimes(window: TimeWindow, clock: ExecutionClock, step: number): number[] {
  const origin = clock.start ?? 0
  const first = ceil((window.start - origin) / step)
  const last = floor((window.end - origin) / step)
  const times: number[] = []
  for (let index = first; index <= last; index += 1) times.push(origin + index * step)
  return times
}

/**
 * The bars under way at a time.
 *
 * @param lanes - The lanes searched
 * @param time - The moment asked about
 * @returns The bars that had started and not ended, in lane order then start order
 */
export function barsAt(lanes: readonly TimelineLane[], time: number): TimelineBar[] {
  return lanes.flatMap((lane) => lane.bars.filter((bar) => bar.start <= time && (time < bar.end || bar.start === bar.end)))
}
